import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, Trash2 } from "lucide-react";

import {
  getAssignmentMetrics,
  exportMetricsCsv,
  exportEventLogCsv,
  purgeOldLogs,
  type AssignmentMetric,
} from "@/lib/stats.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const a = sorted[mid];
  const b = sorted[mid - 1];
  if (a === undefined) return null;
  return sorted.length % 2 || b === undefined ? a : (b + a) / 2;
}

function fmtMinutes(min: number | null): string {
  if (min === null) return "–";
  if (min < 60) return `${Math.round(min)} min`;
  return `${(min / 60).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} h`;
}


const OUTCOME_LABELS: Record<string, string> = {
  open: "Öppet",
  filled: "Tillsatt",
  expired: "Utgånget",
};

type SortKey = "published_at" | "subject" | "school_name" | "notified_count" | "minutes_to_filled" | "outcome";

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function DataTab() {
  const getMetrics = useServerFn(getAssignmentMetrics);
  const getMetricsCsv = useServerFn(exportMetricsCsv);
  const getLogCsv = useServerFn(exportEventLogCsv);
  const purge = useServerFn(purgeOldLogs);
  const [sortKey, setSortKey] = useState<SortKey>("published_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: metrics, refetch } = useQuery({
    queryKey: ["admin-metrics"],
    queryFn: () => getMetrics(),
  });

  const rows = metrics ?? [];
  const filled = rows.filter((m) => m.outcome === "filled");
  const fillRate = rows.length ? Math.round((filled.length / rows.length) * 100) : null;
  const medResponse = median(
    rows.map((m) => m.minutes_to_first_response).filter((v): v is number => v !== null),
  );
  const medFilled = median(
    filled.map((m) => m.minutes_to_filled).filter((v): v is number => v !== null),
  );
  const sorted = [...rows].sort((a, b) => {
    const va = a[sortKey];
    const vb = b[sortKey];
    if (va === null || va === undefined) return 1;
    if (vb === null || vb === undefined) return -1;
    const cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return sortAsc ? cmp : -cmp;
  });

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const exportFile = async (kind: "metrics" | "log") => {
    setBusy(true);
    try {
      const csv = kind === "metrics" ? await getMetricsCsv() : await getLogCsv();
      downloadCsv(
        kind === "metrics" ? "uppdragsstatistik.csv" : "handelselogg.csv",
        csv,
      );
    } catch {
      toast.error("Kunde inte exportera — bara admin kan exportera");
    } finally {
      setBusy(false);
    }
  };

  const purgeOld = async () => {
    if (!window.confirm("Radera all loggdata som är äldre än 12 månader? Det går inte att ångra."))
      return;
    setBusy(true);
    try {
      const n = await purge();
      toast.success(`${n} loggrader raderade`);
      void refetch();
    } catch {
      toast.error("Kunde inte radera — bara admin kan radera loggdata");
    } finally {
      setBusy(false);
    }
  };

  const SortTh = ({ label, k }: { label: string; k: SortKey }) => (
    <th
      className="cursor-pointer select-none px-3 py-2 text-left font-semibold hover:text-foreground"
      onClick={() => toggleSort(k)}
    >
      {label}
      {sortKey === k ? (sortAsc ? " ↑" : " ↓") : ""}
    </th>
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Uppdrag totalt</CardDescription>
            <CardTitle className="text-3xl">{rows.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Andel tillsatta</CardDescription>
            <CardTitle className="text-3xl">{fillRate === null ? "–" : `${fillRate} %`}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Mediantid till svar</CardDescription>
            <CardTitle className="text-3xl">{fmtMinutes(medResponse)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Mediantid till tillsatt</CardDescription>
            <CardTitle className="text-3xl">{fmtMinutes(medFilled)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alla uppdrag</CardTitle>
          <CardDescription>Klicka på en kolumnrubrik för att sortera.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <SortTh label="Publicerad" k="published_at" />
                <SortTh label="Ämne" k="subject" />
                <SortTh label="Skola" k="school_name" />
                <SortTh label="Notifierade" k="notified_count" />
                <th className="px-3 py-2 text-left font-semibold">Öppnat</th>
                <th className="px-3 py-2 text-left font-semibold">Tackat ja</th>
                <SortTh label="Tid till tillsatt" k="minutes_to_filled" />
                <SortTh label="Utfall" k="outcome" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((m) => (
                <tr key={m.assignment_id} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    {new Date(m.published_at).toLocaleDateString("sv-SE")}
                  </td>
                  <td className="px-3 py-2">{m.subject}</td>
                  <td className="px-3 py-2">{m.school_name}</td>
                  <td className="px-3 py-2">{m.notified_count}</td>
                  <td className="px-3 py-2">{m.viewed_count}</td>
                  <td className="px-3 py-2">{m.accepted_count}</td>
                  <td className="px-3 py-2">{fmtMinutes(m.minutes_to_filled)}</td>
                  <td className="px-3 py-2">{OUTCOME_LABELS[m.outcome] ?? m.outcome}</td>
                </tr>
              ))}
              {!sorted.length && (
                <tr>
                  <td className="px-3 py-6 text-center text-muted-foreground" colSpan={8}>
                    Inga uppdrag ännu — statistiken fylls på allt eftersom.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export och gallring</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" disabled={busy} onClick={() => exportFile("metrics")}>
              <Download className="mr-2 h-4 w-4" /> Exportera uppdragsstatistik (CSV)
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => exportFile("log")}>
              <Download className="mr-2 h-4 w-4" /> Exportera händelselogg (CSV)
            </Button>
            <Button variant="outline" disabled={busy} onClick={purgeOld}>
              <Trash2 className="mr-2 h-4 w-4" /> Radera loggdata äldre än 12 månader
            </Button>
          </div>
          <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Vad loggas och varför?</p>
            <p className="mt-1">
              För att förbättra matchningen loggar REKO UF händelser i tjänsten: när ett
              vikariebehov skapas och publiceras, när en notis skickas (med avstånd i km och om
              det var kort varsel), när en vikarie öppnar ett uppdrag, när någon tackar ja, när en
              skola tackar nej till en vikarie, samt när ett uppdrag tillsätts eller går ut.
              Loggen innehåller aldrig namn, e-post, telefonnummer eller postnummer. Vikarier
              lagras som en pseudonym (en envägskryptering av användar-id:t) så att samma vikarie
              kan räknas samman utan att kunna identifieras i exporterad data. Tidsstämplar sätts
              av databasen. Loggdata äldre än 12 månader raderas. Denna text kan återanvändas i
              integritetspolicyn.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
