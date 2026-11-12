/** Only explicit local auth destinations are accepted; never trust a redirect URL from search. */
export function authDestination(mode: unknown): "/inbjudan" | "/aterstall-losenord" | null {
  return mode === "invite" ? "/inbjudan" : mode === "recovery" ? "/aterstall-losenord" : null;
}
export function invitationToken(value: string | null): string | null {
  return value && /^[0-9a-f]{64}$/.test(value) ? value : null;
}
export const INVITATION_STORAGE_KEY = "reko.pending-invitation";
