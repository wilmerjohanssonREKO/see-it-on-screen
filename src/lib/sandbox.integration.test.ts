import { it } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";

// Run against the configured backend. Every fixture and assertion runs in one
// transaction which is rolled back, including successful tests. No email calls.
it("sandbox database isolation (rollback-only)", async (t) => {
  const url = process.env['SUPABASE_DB_URL'];
  if (!url) { t.skip("SUPABASE_DB_URL is required"); return; }
  const sql = postgres(url, { max: 1, prepare: false });
  const rollback = new Error("sandbox-test-rollback");
  try {
    const [capability] = await sql<{can_impersonate:boolean}[]>`select pg_has_role(current_user,'authenticated','MEMBER') as can_impersonate`;
    if (!capability?.can_impersonate) {
      t.skip("The available connection is read-only; rollback-only role tests require an authorized test connection");
      return;
    }
    await sql.begin(async (tx) => {
      const admins = await tx<{user_id:string}[]>`select user_id from public.user_roles where role='admin' limit 1`;
      const users = await tx<{id:string}[]>`select id from public.profiles p where not exists(select 1 from public.school_members m where m.user_id=p.id) and not exists(select 1 from public.user_roles r where r.user_id=p.id and r.role='admin') and not exists(select 1 from public.assignments a where a.assigned_substitute_id=p.id) and not exists(select 1 from public.assignment_declines d where d.substitute_id=p.id) order by id limit 2`;
      assert.equal(users.length, 2, "requires two non-admin substitute profiles");
      const admin = admins[0]?.user_id;
      assert.ok(admin);
      const real = users[0]?.id;
      const test = users[1]?.id;
      if (!real || !test) throw new Error('Missing test fixtures');
      await tx`select set_config('request.jwt.claim.sub',${admin},true)`;
      await tx`set local role authenticated`;
      // Test-only changes to existing accounts are uncommitted and rolled back.
      await tx`update public.profiles set approved=true,background_status='approved',is_test=(id=${test}) where id in (${real},${test})`;
      const schools = await tx<{id:string,is_test:boolean}[]>`insert into public.schools(name,is_test) values ('REKO_TEST_ROLLBACK_REAL',false),('REKO_TEST_ROLLBACK_SANDBOX',true) returning id,is_test`;
      const realSchool = schools.find(s => !s.is_test)?.id;
      const testSchool = schools.find(s => s.is_test)?.id;
      assert.ok(realSchool); assert.ok(testSchool);
      const jobs = await tx<{id:string,school_id:string}[]>`insert into public.assignments(school_id,subject,assignment_date,start_time,end_time,status) values (${realSchool},'REKO_TEST_REAL',current_date+7,'09:00','10:00','open'),(${testSchool},'REKO_TEST_SANDBOX',current_date+7,'11:00','12:00','open') returning id,school_id`;
      const realJob = jobs.find(j => j.school_id===realSchool)?.id;
      const testJob = jobs.find(j => j.school_id===testSchool)?.id;
      assert.ok(realJob); assert.ok(testJob);
      async function asUser(id: string) {
        await tx`reset role`;
        await tx`select set_config('request.jwt.claim.sub',${id},true)`;
        await tx`set local role authenticated`;
      }
      await t.test("missing profile or school fails closed", async () => {
        const [row] = await tx<{allowed:boolean}[]>`select public.same_sandbox('00000000-0000-0000-0000-000000000000',${realSchool}) as allowed`;
        assert.equal(row?.allowed,false);
      });
      await t.test("test substitute sees only test jobs in RPC and RLS",async () => {
        await asUser(test);
        const rows = await tx<{id:string}[]>`select id from public.substitute_assignments() where id in (${realJob},${testJob})`;
        assert.deepEqual(rows.map(r=>r.id),[testJob]);
        const direct = await tx<{id:string}[]>`select id from public.assignments where id in (${realJob},${testJob})`;
        assert.deepEqual(direct.map(r=>r.id),[testJob]);
      });
      await t.test("real substitute sees only real jobs",async () => {
        await asUser(real);
        const rows = await tx<{id:string}[]>`select id from public.substitute_assignments() where id in (${realJob},${testJob})`;
        assert.deepEqual(rows.map(r=>r.id),[realJob]);
      });
      await t.test("test substitute cannot claim a real job",async () => {
        await asUser(test);
        const [row] = await tx<{result:string}[]>`select public.claim_assignment(${realJob}) as result`;
        assert.equal(row?.result,'already_filled');
      });
      await t.test("real substitute cannot claim a test job",async () => {
        await asUser(real);
        const [row] = await tx<{result:string}[]>`select public.claim_assignment(${testJob}) as result`;
        assert.equal(row?.result,'already_filled');
      });
      await t.test("test substitute can claim a test job",async () => {
        await asUser(test);
        const [row] = await tx<{result:string}[]>`select public.claim_assignment(${testJob}) as result`;
        assert.equal(row?.result,'claimed');
      });
      await t.test("non-admin cannot read inbox or purge test data",async () => {
        const inbox = await tx`select id from public.sandbox_emails`;
        assert.equal(inbox.length,0);
        await assert.rejects(tx.savepoint(async sp=>{await sp`select public.purge_sandbox_data()`;}),/Endast admin/);
      });
      await t.test("non-admin cannot change test flag",async () => {
        await assert.rejects(tx.savepoint(async sp=>{await sp`select public.admin_set_test('substitute',${test},false)`;}),/Endast admin/);
        await assert.rejects(tx.savepoint(async sp=>{await sp`update public.profiles set is_test=false where id=${test}`;}),/Endast admin/);
      });
      await t.test("admin cannot move an assigned test account into real mode",async () => {
        await asUser(admin);
        await assert.rejects(tx.savepoint(async sp=>{await sp`select public.admin_set_test('substitute',${test},false)`;}),/uppdragshistorik/);
      });
      await t.test("admin cannot move a school with jobs between modes",async () => {
        await assert.rejects(tx.savepoint(async sp=>{await sp`select public.admin_set_test('school',${testSchool},false)`;}),/Skolan har uppdrag/);
      });
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
  finally { await sql.end(); }
});