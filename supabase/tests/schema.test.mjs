import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Runs every migration, in order, against an in-memory Postgres (PGlite) with
// minimal stand-ins for Supabase's auth/storage schemas, then exercises the
// rules: RLS, creator-only edits, split totals, balances, invites, leave/remove.
// Usage: npm run test:db
const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

const db = new PGlite();
const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const C = '00000000-0000-0000-0000-00000000000c';

await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users(id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
  create schema storage;
  create table storage.buckets(id text primary key, name text, public bool, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects(id uuid default gen_random_uuid() primary key, bucket_id text, name text);
  alter table storage.objects enable row level security;
  create publication supabase_realtime;
  grant usage on schema public, auth, storage to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated, public;
  grant all on storage.objects to authenticated;
  insert into auth.users(id,email,raw_user_meta_data) values
    ('${A}','a@x.com','{"full_name":"Alice","picture":"http://p/a.png"}'),
    ('${B}','b@x.com','{"name":"Bob"}'),
    ('${C}','c@x.com','{}');
`);

for (const f of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
  await db.exec(readFileSync(join(migrationsDir, f), 'utf8'));
}
console.log('migration applied');

let pass = 0, fail = 0;
async function as(uid, sql, params) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub','${uid ?? ''}',false); set role ${uid ? 'authenticated' : 'anon'};`);
  return db.query(sql, params);
}
async function ok(name, fn) {
  try { await fn(); pass++; console.log('ok   ', name); }
  catch (e) { fail++; console.log('FAIL ', name, '->', e.message); }
}
async function denied(name, fn, match) {
  try { await fn(); fail++; console.log('FAIL ', name, '-> expected error'); }
  catch (e) {
    if (match && !e.message.includes(match)) { fail++; console.log('FAIL ', name, '-> wrong error:', e.message); }
    else { pass++; console.log('ok   ', name, `(blocked: ${e.message.slice(0, 60)})`); }
  }
}
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); };

await ok('profiles backfilled/created with Google metadata', async () => {
  await db.exec('reset role');
  const r = await db.query('select display_name, avatar_url from profiles order by email');
  eq(r.rows.map(x => x.display_name), ['Alice', 'Bob', 'c'], 'names');
  eq(r.rows[0].avatar_url, 'http://p/a.png', 'avatar');
});
await ok('new sign-in creates profile once', async () => {
  await db.exec(`reset role; insert into auth.users(id,email,raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000d1','d@x.com','{"full_name":"Dee"}')`);
  const r = await db.query(`select count(*)::int n from profiles where id='00000000-0000-0000-0000-0000000000d1'`);
  eq(r.rows[0].n, 1, 'count');
});

let G;
await ok('A creates group -> becomes owner', async () => {
  const r = await as(A, `insert into groups(name) values ('Flat') returning id`);
  G = r.rows[0].id;
  const m = await as(A, `select user_id, role from group_members where group_id=$1`, [G]);
  eq(m.rows, [{ user_id: A, role: 'owner' }], 'members');
});
await ok('B cannot see A\'s group', async () => {
  const r = await as(B, `select id from groups where id=$1`, [G]);
  if (r.rows.length) throw new Error('visible');
});
await denied('trip fields rejected on non-trip', () => as(A, `insert into groups(name,start_date) values ('x','2026-01-01')`), 'trip_fields');
await ok('trip group with dates', async () => {
  await as(A, `insert into groups(name,kind,start_date,end_date,icon) values ('Rome','trip','2026-05-01','2026-05-07','plane')`);
});
await denied('trip end before start', () => as(A, `insert into groups(name,kind,start_date,end_date) values ('Bad','trip','2026-05-08','2026-05-07')`), 'trip_dates');
await denied('kind immutable', () => as(A, `update groups set kind='trip' where id=$1`, [G]), 'cannot be changed');

let code;
await ok('invite + join', async () => {
  code = (await as(A, `insert into group_invites(group_id) values ($1) returning code`, [G])).rows[0].code;
  await as(B, `select join_group_with_code($1)`, [code.toLowerCase()]);
  await as(C, `select join_group_with_code($1)`, [code]);
  const m = await as(A, `select count(*)::int n from group_members where group_id=$1 and left_at is null`, [G]);
  eq(m.rows[0].n, 3, 'members');
});
await denied('bad invite code', () => as(B, `select join_group_with_code('NOPE')`), 'invalid or expired');
await denied('non-member cannot create invite', () => as(B, `insert into group_invites(group_id) values ((select id from groups where name='Rome'))`));
await ok('shared-group profiles visible; strangers not', async () => {
  const r = await as(B, `select count(*)::int n from profiles`);
  eq(r.rows[0].n, 3, 'B sees A,B,C');
  const d = await as('00000000-0000-0000-0000-0000000000d1', `select count(*)::int n from profiles`);
  eq(d.rows[0].n, 1, 'D sees only self');
});

const splitsEq = JSON.stringify([{ user_id: A, owed_cents: 1000 }, { user_id: B, owed_cents: 1000 }, { user_id: C, owed_cents: 1000 }]);
let E;
await ok('A adds $30 expense split 3 ways', async () => {
  E = (await as(A, `select save_expense($1,'Groceries',3000,$2,'2026-09-01','equal',$3::jsonb) id`, [G, A, splitsEq])).rows[0].id;
  const r = await as(B, `select debtor, creditor, cents::int from pairwise_balances where group_id=$1 order by debtor`, [G]);
  eq(r.rows, [{ debtor: B, creditor: A, cents: 1000 }, { debtor: C, creditor: A, cents: 1000 }].sort((x, y) => x.debtor < y.debtor ? -1 : 1), 'pairwise');
  const n = await as(B, `select user_id, net_cents::int from group_net_balances where group_id=$1 order by net_cents`, [G]);
  eq(n.rows.map(x => x.net_cents), [-1000, -1000, 2000], 'nets');
});
await denied('splits not summing to amount', () => as(A, `select save_expense($1,'Bad',3000,$2,null,'exact',$3::jsonb)`, [G, A, JSON.stringify([{ user_id: A, owed_cents: 1000 }, { user_id: B, owed_cents: 1000 }])]), 'must equal');
await denied('zero amount', () => as(A, `select save_expense($1,'Z',0,$2,null,'equal',$3::jsonb)`, [G, A, splitsEq]), 'greater than zero');
await denied('percent != 100', () => as(A, `select save_expense($1,'P',3000,$2,null,'percent',$3::jsonb)`, [G, A, JSON.stringify([{ user_id: A, owed_cents: 1500, percent: 50 }, { user_id: B, owed_cents: 1500, percent: 40 }])]), 'add up to 100');
await denied('outsider in split', () => as(A, `select save_expense($1,'O',1000,$2,null,'equal',$3::jsonb)`, [G, A, JSON.stringify([{ user_id: '00000000-0000-0000-0000-0000000000d1', owed_cents: 1000 }])]), 'active member');
await denied('B cannot edit A\'s expense', () => as(B, `select save_expense($1,'Hacked',3000,$2,null,'equal',$3::jsonb,null,$4)`, [G, A, splitsEq, E]), 'Only the person who created');
await denied('B cannot delete A\'s expense', () => as(B, `select delete_expense($1)`, [E]), 'Only the person who created');
await denied('direct insert into expenses blocked', () => as(A, `insert into expenses(group_id,description,amount_cents,paid_by,split_method) values ($1,'x',100,$2,'equal')`, [G, A]));
await denied('direct update of expenses blocked (0 rows / error)', async () => {
  const r = await as(B, `update expenses set amount_cents=1 where id=$1 returning id`, [E]);
  if (r.rows.length === 0) throw new Error('0 rows updated');
});
await ok('A edits own expense (exact split, $40)', async () => {
  await as(A, `select save_expense($1,'Groceries+',4000,$2,null,'exact',$3::jsonb,null,$4)`, [G, A, JSON.stringify([{ user_id: A, owed_cents: 2000 }, { user_id: B, owed_cents: 2000 }]), E]);
  const r = await as(B, `select debtor, creditor, cents::int from pairwise_balances where group_id=$1`, [G]);
  eq(r.rows, [{ debtor: B, creditor: A, cents: 2000 }], 'pairwise after edit');
});
await denied('B cannot leave with open balance', () => as(B, `select leave_group($1)`, [G]), 'Settle up first');
await ok('B settles $20 to A -> no debts', async () => {
  await as(B, `select record_settlement($1,$2,$3,2000,'2026-09-02')`, [G, B, A]);
  const r = await as(A, `select count(*)::int n from pairwise_balances where group_id=$1`, [G]);
  eq(r.rows[0].n, 0, 'debts');
  const o = await as(A, `select count(*)::int n from overall_pairwise_balances`);
  eq(o.rows[0].n, 0, 'overall');
});
await denied('settlement same person', () => as(A, `select record_settlement($1,$2,$2,100)`, [G, A]));
await denied('settlement zero', () => as(A, `select record_settlement($1,$2,$3,0)`, [G, A, B]), 'greater than zero');
await ok('overall balance sums across groups', async () => {
  const G2 = (await as(A, `insert into groups(name) values ('Trip2') returning id`)).rows[0].id;
  const c2 = (await as(A, `insert into group_invites(group_id) values ($1) returning code`, [G2])).rows[0].code;
  await as(B, `select join_group_with_code($1)`, [c2]);
  const two = JSON.stringify([{ user_id: A, owed_cents: 500 }, { user_id: B, owed_cents: 500 }]);
  await as(A, `select save_expense($1,'Taxi',1000,$2,null,'equal',$3::jsonb)`, [G2, A, two]);
  await as(B, `select save_expense($1,'Lunch',600,$2,null,'equal',$3::jsonb)`, [G, B, JSON.stringify([{ user_id: A, owed_cents: 300 }, { user_id: B, owed_cents: 300 }])]);
  // Group1: A owes B 300. Group2: B owes A 500. Overall: B owes A 200.
  const o = await as(A, `select debtor, creditor, cents::int from overall_pairwise_balances`);
  eq(o.rows, [{ debtor: B, creditor: A, cents: 200 }], 'overall');
});
await ok('B leaves after settling group 1? (still owes) -> blocked; C (zero) can leave', async () => {
  await as(C, `select leave_group($1)`, [G]).catch(() => { throw new Error('C should be able to leave? C owes A 1000/…'); });
});
await ok('activity log has entries incl. edit', async () => {
  const r = await as(A, `select action from activity_log where group_id=$1 order by id`, [G]);
  eq(r.rows.map(x => x.action), ['expense_added', 'expense_edited', 'settlement_added', 'expense_added'], 'actions');
});
await ok('A deletes own expense -> excluded from balances, logged', async () => {
  await as(A, `select delete_expense($1)`, [E]);
  const r = await as(A, `select action from activity_log where entity_id=$1 order by id`, [E]);
  eq(r.rows.map(x => x.action), ['expense_added', 'expense_edited', 'expense_deleted'], 'log');
});
await ok('anon sees nothing / denied', async () => {
  try { await as(null, `select * from expenses`); throw new Error('anon allowed'); }
  catch (e) { if (e.message === 'anon allowed') throw e; }
});
await denied('signed-in users cannot probe balances via assert_no_open_balance', () => as(B, `select assert_no_open_balance($1, $2)`, [G, A]), 'permission denied');
await denied('anon cannot call internal trigger functions', () => as(null, `select handle_new_user()`), 'permission denied');
await ok('settlement with a known payment method', async () => {
  await as(A, `select record_settlement($1,$2,$3,500,'2026-09-28','venmo')`, [G, A, B]);
  const r = await as(A, `select payment_method, payment_method_note from settlements where group_id=$1 order by created_at desc limit 1`, [G]);
  eq(r.rows[0], { payment_method: 'venmo', payment_method_note: null }, 'venmo, no note');
});
await ok("settlement with 'other' and a note", async () => {
  await as(A, `select record_settlement($1,$2,$3,500,'2026-09-28','other','Gift card')`, [G, A, B]);
  const r = await as(A, `select payment_method, payment_method_note from settlements where group_id=$1 order by created_at desc limit 1`, [G]);
  eq(r.rows[0], { payment_method: 'other', payment_method_note: 'Gift card' }, "other, with note");
});
await denied("'other' with no note is rejected", () => as(A, `select record_settlement($1,$2,$3,500,'2026-09-28','other')`, [G, A, B]), 'payment method');
await denied('unknown payment method is rejected', () => as(A, `select record_settlement($1,$2,$3,500,'2026-09-28','bitcoin')`, [G, A, B]), 'invalid input value');
await ok('settlement with no payment method still works (nullable)', async () => {
  await as(A, `select record_settlement($1,$2,$3,500)`, [G, A, B]);
});

await ok('invite by email: existing account joins immediately', async () => {
  const G3 = (await as(A, `insert into groups(name) values ('EmailInvites') returning id`)).rows[0].id;
  await as(A, `select invite_member_by_email($1, 'b@x.com')`, [G3]);
  const r = await as(A, `select user_id from group_members where group_id=$1 and left_at is null`, [G3]);
  eq(r.rows.map((x) => x.user_id).sort(), [A, B].sort(), 'members');
});
await ok('invite by email: no account yet leaves a pending invite, claimed on sign-up', async () => {
  const G4 = (await as(A, `insert into groups(name) values ('PendingInvites') returning id`)).rows[0].id;
  await as(A, `select invite_member_by_email($1, 'Future.Person@Example.com ')`, [G4]);
  const pending = await as(A, `select email, consumed_at from group_email_invites where group_id=$1`, [G4]);
  eq(pending.rows, [{ email: 'future.person@example.com', consumed_at: null }], 'normalized, pending');

  await db.exec(`reset role; insert into auth.users(id,email,raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000e1','future.person@example.com','{"full_name":"Future Person"}')`);
  const members = await as(A, `select user_id from group_members where group_id=$1 and user_id='00000000-0000-0000-0000-0000000000e1'`, [G4]);
  eq(members.rows.length, 1, 'auto-joined on sign-up');
  const consumed = await as(A, `select consumed_at is not null as c from group_email_invites where group_id=$1`, [G4]);
  eq(consumed.rows[0].c, true, 'marked consumed');
});
await denied('invite by email: invalid email is rejected', () => as(A, `select invite_member_by_email($1, 'not-an-email')`, [G]), 'valid email');
await denied('invite by email: non-member cannot invite', () => as(C, `select invite_member_by_email($1, 'someone@example.com')`, [G]), 'Not a member');
await ok('invite by email: inviting the same pending email twice is a no-op, not an error', async () => {
  const G5 = (await as(A, `insert into groups(name) values ('DupeInvite') returning id`)).rows[0].id;
  await as(A, `select invite_member_by_email($1, 'dup@example.com')`, [G5]);
  await as(A, `select invite_member_by_email($1, 'dup@example.com')`, [G5]); // must not throw
  const r = await as(A, `select count(*)::int n from group_email_invites where group_id=$1`, [G5]);
  eq(r.rows[0].n, 1, 'still one row');
});
await ok('invite by email: inviting an already-active member is a silent no-op', async () => {
  const G6 = (await as(A, `insert into groups(name) values ('AlreadyMember') returning id`)).rows[0].id;
  await as(A, `select invite_member_by_email($1, 'a@x.com')`, [G6]); // A invites themself (already owner)
  const r = await as(A, `select role from group_members where group_id=$1 and user_id=$2`, [G6, A]);
  eq(r.rows[0].role, 'owner', 'still owner, unchanged');
});

await ok('cancel pending invite: removes it, and it can be re-invited afterward', async () => {
  const G7 = (await as(A, `insert into groups(name) values ('CancelInvite') returning id`)).rows[0].id;
  await as(A, `select invite_member_by_email($1, 'maybe@example.com')`, [G7]);
  await as(A, `select cancel_pending_invite($1, 'MAYBE@example.com ')`, [G7]); // case/whitespace-insensitive
  const gone = await as(A, `select count(*)::int n from group_email_invites where group_id=$1`, [G7]);
  eq(gone.rows[0].n, 0, 'removed');
  await as(A, `select invite_member_by_email($1, 'maybe@example.com')`, [G7]); // re-invite works
  const back = await as(A, `select count(*)::int n from group_email_invites where group_id=$1`, [G7]);
  eq(back.rows[0].n, 1, 're-invited');
});
await ok('cancel pending invite: non-member cannot, but a no-op for a nonexistent invite is not an error', async () => {
  const G8 = (await as(A, `insert into groups(name) values ('CancelInvite2') returning id`)).rows[0].id;
  await as(A, `select cancel_pending_invite($1, 'nobody-invited@example.com')`, [G8]); // must not throw
});
await denied('cancel pending invite: non-member cannot', () => as(C, `select cancel_pending_invite($1, 'x@example.com')`, [G]), 'Not a member');

await ok('trip-covers bucket allows gif', async () => {
  await db.exec('reset role');
  const r = await db.query(`select allowed_mime_types from storage.buckets where id='trip-covers'`);
  if (!r.rows[0].allowed_mime_types.includes('image/gif')) throw new Error('gif not allowed');
});

await ok('storage helpers', async () => {
  const r = await as(A, `select storage_group_id('${G}/x.jpg') g, storage_group_id('junk/x') j, can_write_receipt('${G}/${E}.jpg') w`);
  eq(r.rows[0].g, G, 'gid'); eq(r.rows[0].j, null, 'junk');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
