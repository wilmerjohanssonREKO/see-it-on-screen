export type OutboxJob = {
  id: string;
  assignment_id: string;
  version: number;
  school_id: string;
  substitute_id: string | null;
  recipient_kind: 'school' | 'substitute';
  recipient: string;
  template: string;
  payload: Record<string, unknown>;
  test_snapshot: boolean;
  lock_token: string;
  attempts: number;
};

/** Decide before contacting a provider. Missing accounts never default to live delivery. */
export function deliveryDisposition(
  job: Pick<OutboxJob, 'recipient_kind' | 'recipient' | 'test_snapshot' | 'template' | 'substitute_id' | 'version'>,
  school: { email: string | null; is_test: boolean } | null,
  substitute: { email: string | null; is_test: boolean } | null,
  assignment: { notification_version: number; assigned_substitute_id: string | null; status: string } | null,
): 'capture' | 'send' | 'recipient_unavailable' | 'recipient_changed' | 'superseded' {
  if (!school || !assignment) return 'recipient_unavailable';
  // A prepared deletion erases the former substitute's identity. The school
  // still needs its cancellation; its immutable snapshot prevents test mail leaks.
  const erasedSchoolCancellation = job.template === 'uppdrag-avbokat' && job.recipient_kind === 'school' && job.substitute_id === null;
  if (!substitute && !erasedSchoolCancellation) return 'recipient_unavailable';
  if (job.template === 'uppdrag-avbokat' && assignment.status === 'filled' &&
      (job.recipient_kind === 'school' || assignment.assigned_substitute_id === job.substitute_id)) return 'superseded';
  if (job.template !== 'uppdrag-avbokat' && (assignment.notification_version !== job.version ||
      assignment.status !== 'filled' || assignment.assigned_substitute_id !== job.substitute_id)) return 'superseded';
  const currentEmail = job.recipient_kind === 'school' ? school.email : substitute?.email;
  if (!job.recipient || !currentEmail) return 'recipient_unavailable';
  if (job.recipient.toLowerCase() !== currentEmail.toLowerCase()) return 'recipient_changed';
  return job.test_snapshot || school.is_test || substitute?.is_test ? 'capture' : 'send';
}
