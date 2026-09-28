import { toDateString } from './expenses';
import { supabase } from './supabase';

export type GroupSummary = {
  id: string;
  name: string;
  kind: 'group' | 'trip';
  startDate: string | null;
  endDate: string | null;
  coverImagePath: string | null;
  icon: string | null;
  memberCount: number;
  /** My net balance in this group, in cents. Positive = I'm owed. */
  myNetCents: number;
};

/** Small preset of trip icons, used when a member doesn't set a cover photo. */
export const TRIP_ICONS = [
  'airplane-outline',
  'sunny-outline',
  'snow-outline',
  'boat-outline',
  'car-outline',
  'gift-outline',
  'star-outline',
  'home-outline',
] as const;
export type TripIcon = (typeof TRIP_ICONS)[number];

export type Member = {
  userId: string;
  role: 'owner' | 'member';
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
};

export type GroupDetail = {
  id: string;
  name: string;
  kind: 'group' | 'trip';
  startDate: string | null;
  endDate: string | null;
  coverImagePath: string | null;
  icon: string | null;
  members: Member[];
};

function unwrap<T>(result: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (result.error) throw new Error(result.error.message);
  return result.data as NonNullable<T>;
}

export async function fetchMyGroups(userId: string): Promise<GroupSummary[]> {
  const memberships = unwrap(
    await supabase
      .from('group_members')
      .select('groups(id, name, kind, start_date, end_date, cover_image_path, icon, created_at)')
      .eq('user_id', userId)
      .is('left_at', null)
  );

  const groups = memberships
    .map((m) => m.groups)
    .filter((g): g is NonNullable<typeof g> => g !== null)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (groups.length === 0) return [];

  const ids = groups.map((g) => g.id);
  const [members, balances] = await Promise.all([
    supabase.from('group_members').select('group_id').in('group_id', ids).is('left_at', null),
    supabase.from('group_net_balances').select('group_id, net_cents').eq('user_id', userId).in('group_id', ids),
  ]);

  const counts = new Map<string, number>();
  for (const row of unwrap(members)) counts.set(row.group_id, (counts.get(row.group_id) ?? 0) + 1);
  const nets = new Map<string, number>();
  for (const row of unwrap(balances)) {
    if (row.group_id && row.net_cents !== null) nets.set(row.group_id, Number(row.net_cents));
  }

  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    kind: g.kind,
    startDate: g.start_date,
    endDate: g.end_date,
    coverImagePath: g.cover_image_path,
    icon: g.icon,
    memberCount: counts.get(g.id) ?? 1,
    myNetCents: nets.get(g.id) ?? 0,
  }));
}

export async function fetchGroup(groupId: string): Promise<GroupDetail> {
  const [group, members] = await Promise.all([
    supabase.from('groups').select('id, name, kind, start_date, end_date, cover_image_path, icon').eq('id', groupId).single(),
    supabase
      .from('group_members')
      .select('user_id, role, joined_at, profiles(display_name, avatar_url, email)')
      .eq('group_id', groupId)
      .is('left_at', null)
      .order('joined_at'),
  ]);
  const g = unwrap(group);
  return {
    id: g.id,
    name: g.name,
    kind: g.kind,
    startDate: g.start_date,
    endDate: g.end_date,
    coverImagePath: g.cover_image_path,
    icon: g.icon,
    members: unwrap(members).map((m) => ({
      userId: m.user_id,
      role: m.role,
      displayName: m.profiles?.display_name ?? 'Member',
      avatarUrl: m.profiles?.avatar_url ?? null,
      email: m.profiles?.email ?? null,
    })),
  };
}

export async function createGroup(name: string): Promise<string> {
  const row = unwrap(await supabase.from('groups').insert({ name: name.trim() }).select('id').single());
  return row.id;
}

export async function createTrip(input: { name: string; startDate: Date; endDate: Date; icon?: TripIcon }): Promise<string> {
  const row = unwrap(
    await supabase
      .from('groups')
      .insert({
        name: input.name.trim(),
        kind: 'trip',
        start_date: toDateString(input.startDate),
        end_date: toDateString(input.endDate),
        icon: input.icon ?? null,
      })
      .select('id')
      .single()
  );
  return row.id;
}

/** Any active member may edit a trip's details (name/dates/cover/icon). */
export async function updateTrip(
  groupId: string,
  input: { name: string; startDate: Date; endDate: Date; coverImagePath?: string | null; icon?: string | null }
): Promise<void> {
  unwrap(
    await supabase
      .from('groups')
      .update({
        name: input.name.trim(),
        start_date: toDateString(input.startDate),
        end_date: toDateString(input.endDate),
        ...(input.coverImagePath !== undefined && { cover_image_path: input.coverImagePath }),
        ...(input.icon !== undefined && { icon: input.icon }),
      })
      .eq('id', groupId)
      .select('id')
      .single()
  );
}

/** Returns a currently valid invite code for the group, creating one if needed. */
export async function getOrCreateInviteCode(groupId: string): Promise<string> {
  const existing = unwrap(
    await supabase
      .from('group_invites')
      .select('code')
      .eq('group_id', groupId)
      .is('revoked_at', null)
      .gt('expires_at', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
  );
  if (existing.length > 0) return existing[0].code;
  return unwrap(await supabase.from('group_invites').insert({ group_id: groupId }).select('code').single()).code;
}

export async function joinGroupWithCode(code: string): Promise<string> {
  return unwrap(await supabase.rpc('join_group_with_code', { p_code: code }));
}

export async function leaveGroup(groupId: string): Promise<void> {
  unwrap(await supabase.rpc('leave_group', { p_group: groupId }));
}

export async function removeMember(groupId: string, userId: string): Promise<void> {
  unwrap(await supabase.rpc('remove_group_member', { p_group: groupId, p_user: userId }));
}

export function inviteLink(code: string): string {
  return `shakedown://join/${code}`;
}

/**
 * Invites someone by email (e.g. picked from a phone contact). If that email
 * already has an account, they're added to the group right away; otherwise the
 * invite is claimed automatically the first time they sign in with that email.
 */
export async function inviteByEmail(groupId: string, email: string): Promise<void> {
  unwrap(await supabase.rpc('invite_member_by_email', { p_group_id: groupId, p_email: email }));
}

export type PendingInvite = { email: string; createdAt: string };

/** Invited-by-email people who haven't joined yet (an invite code has no such list). */
export async function fetchPendingInvites(groupId: string): Promise<PendingInvite[]> {
  const rows = unwrap(
    await supabase
      .from('group_email_invites')
      .select('email, created_at')
      .eq('group_id', groupId)
      .is('consumed_at', null)
      .order('created_at', { ascending: false })
  );
  return rows.map((r) => ({ email: r.email, createdAt: r.created_at }));
}

/** Removes a pending email invite before it's been accepted. */
export async function cancelPendingInvite(groupId: string, email: string): Promise<void> {
  unwrap(await supabase.rpc('cancel_pending_invite', { p_group_id: groupId, p_email: email }));
}
