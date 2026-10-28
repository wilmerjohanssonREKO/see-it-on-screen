/** True when either side of a match is a test account — such emails must never be delivered. */
export function isSandbox(substituteIsTest?: boolean | null, schoolIsTest?: boolean | null): boolean {
  return substituteIsTest === true || schoolIsTest === true;
}
