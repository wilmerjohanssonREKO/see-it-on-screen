import { it } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";

it("sandbox ownership comparison matches stored flags and denies missing owners", async (t) => {
  const url = process.env['SUPABASE_DB_URL'];
  if (!url) { t.skip("SUPABASE_DB_URL required"); return; }
  const sql = postgres(url, {max:1,prepare:false});
  try {
    const rows = await sql<{actual:boolean,expected:boolean}[]>`
      select public.same_sandbox(p.id,s.id) as actual,(p.is_test=s.is_test) as expected
      from public.profiles p cross join public.schools s`;
    assert.ok(rows.length>0);
    for (const row of rows) assert.equal(row.actual,row.expected);
    const [missing] = await sql<{actual:boolean}[]>`select public.same_sandbox('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000000') as actual`;
    assert.equal(missing?.actual,false);
    const [mismatch] = await sql<{count:number}[]>`select count(*)::int as count from public.assignments a where a.assigned_substitute_id is not null and not public.same_sandbox(a.assigned_substitute_id,a.school_id)`;
    assert.equal(mismatch?.count,0,"assigned jobs must not cross modes");
  } finally { await sql.end(); }
});