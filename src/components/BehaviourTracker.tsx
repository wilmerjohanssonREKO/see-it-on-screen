import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { onConsentChange, readChoice } from "@/lib/consent";
import { normalizePath } from "@/lib/behaviour-score";

type Ev = { s: string; p: string; path: string; t: string; el?: string; x?: number; y?: number; v?: number; d: string; w: number };

const INTERACTIVE = "a,button,[role=button],input,select,textarea,label,summary,[role=tab],[role=checkbox]";

function allowed() {
  return readChoice("analytics") === "granted";
}

function sessionId(): string {
  try {
    let id = sessionStorage.getItem("reko_bsid");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("reko_bsid", id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function device(w: number) {
  return w < 768 ? "mobile" : w < 1024 ? "tablet" : "desktop";
}

/** A short, non-personal label: tag plus static button/link text or a field's name. Never values. */
function describe(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") {
    const type = tag === "input" ? (el as HTMLInputElement).type : tag;
    if (type === "password") return "fält: lösenord";
    const label = el.getAttribute("aria-label") || (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent) || el.getAttribute("name") || type;
    return `fält: ${String(label).trim().slice(0, 40)}`;
  }
  const text = (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40);
  const kind = tag === "a" ? "länk" : tag === "button" || el.getAttribute("role") === "button" ? "knapp" : tag;
  return text ? `${kind}: ${text}` : kind;
}

function nearestText(el: Element): string {
  const section = el.closest("section,header,footer,nav,main,form,[data-slot=card]");
  const heading = section?.querySelector("h1,h2,h3");
  const where = heading?.textContent?.trim().slice(0, 30);
  return `${el.tagName.toLowerCase()}${where ? ` i "${where}"` : ""}`;
}

export function BehaviourTracker() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (pathname.startsWith("/lovable")) return;
    let active = allowed();
    const sid = sessionId();
    const pvid = crypto.randomUUID();
    const path = normalizePath(pathname);
    const started = performance.now();
    const queue: Ev[] = [];
    let maxScroll = 0;
    let moves = 0;
    let lastMove = 0;
    let formStarted = false;
    let formDone = false;
    let ended = false;
    const recent: { t: number; x: number; y: number }[] = [];

    const w = () => window.innerWidth;
    const push = (e: Omit<Ev, "s" | "p" | "path" | "d" | "w">) => {
      if (!active) return;
      queue.push({ s: sid, p: pvid, path, d: device(w()), w: w(), ...e });
      if (queue.length >= 50) flush();
    };
    const flush = (keepalive = false) => {
      if (!queue.length || !active) return;
      const batch = queue.splice(0, 60);
      const url = `${import.meta.env['VITE_SUPABASE_URL']}/rest/v1/rpc/record_behaviour_events`;
      const key = import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] as string;
      void fetch(url, {
        method: "POST",
        keepalive,
        headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
        body: JSON.stringify({ p_events: batch }),
      }).catch(() => undefined);
    };
    const pos = (e: MouseEvent) => {
      const doc = document.documentElement;
      return { x: e.pageX / Math.max(doc.scrollWidth, 1), y: e.pageY / Math.max(doc.scrollHeight, 1) };
    };
    const measureScroll = () => {
      const doc = document.documentElement;
      const depth = ((window.scrollY + window.innerHeight) / Math.max(doc.scrollHeight, 1)) * 100;
      maxScroll = Math.max(maxScroll, Math.min(100, depth));
    };

    const onClick = (e: MouseEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;
      const { x, y } = pos(e);
      const interactive = target.closest(INTERACTIVE);
      const now = performance.now();
      recent.push({ t: now, x: e.clientX, y: e.clientY });
      while (recent.length && now - recent[0]!.t > 700) recent.shift();
      const near = recent.filter((r) => Math.hypot(r.x - e.clientX, r.y - e.clientY) < 30);
      const el = interactive ? describe(interactive) : nearestText(target);
      if (near.length === 3) push({ t: "rage_click", el, x, y });
      push({ t: interactive ? "click" : "dead_click", el, x, y });
    };
    const onMove = (e: MouseEvent) => {
      const now = performance.now();
      if (now - lastMove < 1000 || moves >= 40) return;
      lastMove = now;
      moves++;
      push({ t: "move", ...pos(e) });
    };
    const onFocus = (e: FocusEvent) => {
      if (!formStarted && e.target instanceof Element && e.target.closest("form") && e.target.matches("input,textarea,select")) {
        formStarted = true;
        push({ t: "form_start", el: describe(e.target) });
      }
    };
    const onSubmit = () => {
      formDone = true;
      push({ t: "form_submit" });
      flush();
    };
    const end = () => {
      if (ended) return;
      ended = true;
      measureScroll();
      push({ t: "scroll", v: Math.round(maxScroll) });
      push({ t: "leave", v: Math.round(performance.now() - started) });
      if (formStarted && !formDone) push({ t: "form_abandon" });
      flush(true);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush(true);
    };

    push({ t: "pageview" });
    measureScroll();
    const timer = window.setInterval(() => flush(), 5000);
    window.addEventListener("click", onClick, { capture: true, passive: true });
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("scroll", measureScroll, { passive: true });
    document.addEventListener("focusin", onFocus);
    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", end);
    const offConsent = onConsentChange(() => {
      const was = active;
      active = allowed();
      if (!active) queue.length = 0;
      else if (!was) push({ t: "pageview" });
    });

    return () => {
      end();
      window.clearInterval(timer);
      window.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("scroll", measureScroll);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", end);
      offConsent();
    };
  }, [pathname]);

  return null;
}
