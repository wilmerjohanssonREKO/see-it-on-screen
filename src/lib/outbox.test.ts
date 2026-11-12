import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deliveryDisposition } from './outbox';

const job = { recipient_kind: 'school' as const, recipient: 'school@example.com', test_snapshot: false, template: 'vikarie-tilldelad', substitute_id: 'sub', version: 2 };
const school = { email: 'school@example.com', is_test: false };
const profile = { email: 'sub@example.com', is_test: false };
const assignment = { notification_version: 2, assigned_substitute_id: 'sub', status: 'filled' };
test('never delivers when recipient or relationship data is missing', () => {
  assert.equal(deliveryDisposition(job, null, profile, assignment), 'recipient_unavailable');
  assert.equal(deliveryDisposition(job, school, null, assignment), 'recipient_unavailable');
  assert.equal(deliveryDisposition(job, school, profile, null), 'recipient_unavailable');
});
test('any test marker forces capture, including an immutable queue snapshot', () => {
  assert.equal(deliveryDisposition({ ...job, test_snapshot: true }, school, profile, assignment), 'capture');
  assert.equal(deliveryDisposition(job, { ...school, is_test: true }, profile, assignment), 'capture');
  assert.equal(deliveryDisposition(job, school, { ...profile, is_test: true }, assignment), 'capture');
});
test('obsolete confirmations and changed recipients are not sent', () => {
  assert.equal(deliveryDisposition(job, school, profile, { ...assignment, notification_version: 3 }), 'superseded');
  assert.equal(deliveryDisposition(job, school, profile, { ...assignment, assigned_substitute_id: 'another' }), 'superseded');
  assert.equal(deliveryDisposition(job, { ...school, email: 'changed@example.com' }, profile, assignment), 'recipient_changed');
  assert.equal(deliveryDisposition(job, school, profile, assignment), 'send');
});

test('a school cancellation survives identity erasure without allowing other missing recipients', () => {
  const cancellation = { ...job, template: 'uppdrag-avbokat', substitute_id: null };
  const ended = { ...assignment, status: 'expired', assigned_substitute_id: null, notification_version: 3 };
  assert.equal(deliveryDisposition(cancellation, school, null, ended), 'send');
  assert.equal(deliveryDisposition({ ...cancellation, test_snapshot: true }, school, null, ended), 'capture');
  assert.equal(deliveryDisposition({ ...cancellation, recipient_kind: 'substitute' }, school, null, ended), 'recipient_unavailable');
  assert.equal(deliveryDisposition({ ...cancellation, template: 'vikarie-tilldelad' }, school, null, ended), 'recipient_unavailable');
});
test('old cancellation does not override a replacement booking for the same recipient', () => {
  const cancellation = { ...job, template: 'uppdrag-avbokat' };
  assert.equal(deliveryDisposition(cancellation, school, profile, assignment), 'superseded');
  assert.equal(deliveryDisposition({ ...cancellation, recipient_kind: 'substitute', recipient: 'sub@example.com' }, school, profile, assignment), 'superseded');
  assert.equal(deliveryDisposition({ ...cancellation, recipient_kind: 'substitute', recipient: 'sub@example.com' }, school, profile, { ...assignment, assigned_substitute_id: 'replacement' }), 'send');
});
