import { isSupabaseAdminConfigured, createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { SOCIAL_REQUEST_TTL_MS } from '@/lib/socialRequests';

/** Keep in sync with MAX_PARTY_SIZE in auth.ts (avoid importing auth here). */
export const PARTY_DB_MAX_SIZE = 4;

export type PartyInviteStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';

export interface PartyInviteRow {
  id: string;
  party_id: string;
  inviter_id: string;
  invitee_id: string;
  status: PartyInviteStatus;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface PartyRow {
  id: string;
  leader_id: string;
  created_at: string;
}

export interface PartyMemberRow {
  party_id: string;
  user_id: string;
  joined_at: string;
}

export function shouldUseOnlinePartySessions(): boolean {
  return isSupabaseConfigured() && isSupabaseAdminConfigured();
}

export function getPartySessionAdminClient() {
  return createAdminClient();
}

type AdminClient = NonNullable<ReturnType<typeof getPartySessionAdminClient>>;

export const PARTY_INVITE_TTL_MS = SOCIAL_REQUEST_TTL_MS;

export function evaluatePartyCapacity(
  memberCount: number,
  maxSize = PARTY_DB_MAX_SIZE,
): { allowed: true } | { allowed: false; error: string } {
  if (memberCount >= maxSize) {
    return { allowed: false, error: `Party is full (${maxSize} players).` };
  }
  return { allowed: true };
}

export async function findPartyForUser(
  admin: AdminClient,
  userId: string,
): Promise<{ party: PartyRow; memberIds: string[]; isLeader: boolean } | null> {
  const { data: ledParty, error: ledError } = await admin
    .from('parties')
    .select('id, leader_id, created_at')
    .eq('leader_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (ledError) throw ledError;

  if (ledParty) {
    const memberIds = await listPartyMemberIds(admin, ledParty.id);
    return {
      party: ledParty as PartyRow,
      memberIds: Array.from(new Set([ledParty.leader_id, ...memberIds])),
      isLeader: true,
    };
  }

  const { data: membership, error: membershipError } = await admin
    .from('party_members')
    .select('party_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership?.party_id) return null;

  const { data: party, error: partyError } = await admin
    .from('parties')
    .select('id, leader_id, created_at')
    .eq('id', membership.party_id)
    .maybeSingle();
  if (partyError) throw partyError;
  if (!party) return null;

  const memberIds = await listPartyMemberIds(admin, party.id);
  return {
    party: party as PartyRow,
    memberIds: Array.from(new Set([party.leader_id, ...memberIds])),
    isLeader: party.leader_id === userId,
  };
}

async function listPartyMemberIds(admin: AdminClient, partyId: string): Promise<string[]> {
  const { data, error } = await admin
    .from('party_members')
    .select('user_id')
    .eq('party_id', partyId);
  if (error) throw error;
  return ((data as PartyMemberRow[] | null) || []).map(row => row.user_id);
}

/** Ensure the inviter leads a party row (create + leader membership when needed). */
export async function ensurePartyForLeader(
  admin: AdminClient,
  leaderId: string,
): Promise<{ party: PartyRow; memberIds: string[] }> {
  const existing = await findPartyForUser(admin, leaderId);
  if (existing) {
    if (!existing.isLeader) {
      throw new Error('Only the party leader can invite players.');
    }
    if (!existing.memberIds.includes(leaderId)) {
      const { error } = await admin.from('party_members').upsert({
        party_id: existing.party.id,
        user_id: leaderId,
        joined_at: new Date().toISOString(),
      }, { onConflict: 'party_id,user_id' });
      if (error) throw error;
      return { party: existing.party, memberIds: [...existing.memberIds, leaderId] };
    }
    return { party: existing.party, memberIds: existing.memberIds };
  }

  const { data: created, error: createError } = await admin
    .from('parties')
    .insert({ leader_id: leaderId })
    .select('id, leader_id, created_at')
    .single();
  if (createError) throw createError;

  const party = created as PartyRow;
  const { error: memberError } = await admin.from('party_members').insert({
    party_id: party.id,
    user_id: leaderId,
    joined_at: new Date().toISOString(),
  });
  if (memberError) throw memberError;

  return { party, memberIds: [leaderId] };
}

export async function insertPendingPartyInvite(
  admin: AdminClient,
  input: {
    partyId: string;
    inviterId: string;
    inviteeId: string;
    now?: number;
    ttlMs?: number;
  },
): Promise<PartyInviteRow> {
  const now = input.now ?? Date.now();
  const ttlMs = input.ttlMs ?? PARTY_INVITE_TTL_MS;
  const expiresAt = new Date(now + Math.max(10_000, ttlMs)).toISOString();

  const { data, error } = await admin
    .from('party_invites')
    .insert({
      party_id: input.partyId,
      inviter_id: input.inviterId,
      invitee_id: input.inviteeId,
      status: 'pending',
      expires_at: expiresAt,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as PartyInviteRow;
}

export async function loadPartyInvite(
  admin: AdminClient,
  inviteId: string,
): Promise<PartyInviteRow | null> {
  const { data, error } = await admin
    .from('party_invites')
    .select('*')
    .eq('id', inviteId)
    .maybeSingle();
  if (error) throw error;
  return data as PartyInviteRow | null;
}

export async function acceptPartyInviteRow(
  admin: AdminClient,
  invite: PartyInviteRow,
  inviteeId: string,
  now = Date.now(),
): Promise<{ partyId: string; memberIds: string[]; duplicate?: boolean }> {
  if (invite.invitee_id !== inviteeId) {
    throw new Error('Only the invited player can accept this invite.');
  }
  if (invite.status === 'accepted') {
    const memberIds = await listPartyMemberIds(admin, invite.party_id);
    return { partyId: invite.party_id, memberIds, duplicate: true };
  }
  if (invite.status !== 'pending') {
    throw new Error(`Invite is already ${invite.status}.`);
  }
  if (new Date(invite.expires_at).getTime() <= now) {
    await admin
      .from('party_invites')
      .update({ status: 'expired', updated_at: new Date(now).toISOString() })
      .eq('id', invite.id)
      .eq('status', 'pending');
    throw new Error('Party invitation expired or was withdrawn.');
  }

  const memberIds = await listPartyMemberIds(admin, invite.party_id);
  const { data: party } = await admin
    .from('parties')
    .select('leader_id')
    .eq('id', invite.party_id)
    .maybeSingle();
  const allMembers = Array.from(new Set([...(party?.leader_id ? [party.leader_id] : []), ...memberIds]));
  const capacity = evaluatePartyCapacity(allMembers.length);
  if (!capacity.allowed) throw new Error(capacity.error);

  const inviteeParty = await findPartyForUser(admin, inviteeId);
  if (inviteeParty && inviteeParty.party.id !== invite.party_id) {
    throw new Error('Leave your current party before accepting another invite.');
  }

  const { error: memberError } = await admin.from('party_members').upsert({
    party_id: invite.party_id,
    user_id: inviteeId,
    joined_at: new Date(now).toISOString(),
  }, { onConflict: 'party_id,user_id' });
  if (memberError) throw memberError;

  const { error: inviteError } = await admin
    .from('party_invites')
    .update({ status: 'accepted', updated_at: new Date(now).toISOString() })
    .eq('id', invite.id)
    .eq('status', 'pending');
  if (inviteError) throw inviteError;

  const nextMembers = await listPartyMemberIds(admin, invite.party_id);
  return {
    partyId: invite.party_id,
    memberIds: Array.from(new Set([...(party?.leader_id ? [party.leader_id] : []), ...nextMembers])),
  };
}

export async function declinePartyInviteRow(
  admin: AdminClient,
  invite: PartyInviteRow,
  inviteeId: string,
  now = Date.now(),
): Promise<{ partyId: string; duplicate?: boolean }> {
  if (invite.invitee_id !== inviteeId) {
    throw new Error('Only the invited player can decline this invite.');
  }
  if (invite.status === 'declined') {
    return { partyId: invite.party_id, duplicate: true };
  }
  if (invite.status !== 'pending') {
    throw new Error(`Invite is already ${invite.status}.`);
  }
  if (new Date(invite.expires_at).getTime() <= now) {
    await admin
      .from('party_invites')
      .update({ status: 'expired', updated_at: new Date(now).toISOString() })
      .eq('id', invite.id)
      .eq('status', 'pending');
    throw new Error('Party invitation expired or was withdrawn.');
  }

  const { error } = await admin
    .from('party_invites')
    .update({ status: 'declined', updated_at: new Date(now).toISOString() })
    .eq('id', invite.id)
    .eq('status', 'pending');
  if (error) throw error;
  return { partyId: invite.party_id };
}
