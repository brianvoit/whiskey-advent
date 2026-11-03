import { supabase } from "../supabaseClient";

export type Invite = {
  id: string;
  token: string;
  contact_type: "email" | "phone";
  contact: string;
  first_name: string | null;
  last_name: string | null;
  legacy_profile_id: string | null;
  created_at: string;
  accepted_at: string | null;
};

/** Invites not yet accepted, newest first. Admins only (RLS). */
export async function getOpenInvites(): Promise<Invite[]> {
  const { data, error } = await supabase
    .from("invites")
    .select("id, token, contact_type, contact, first_name, last_name, legacy_profile_id, created_at, accepted_at")
    .is("accepted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Invite[];
}

export async function createInvite(params: {
  contactType: "email" | "phone";
  contact: string;
  firstName: string | null;
  lastName: string | null;
  legacyProfileId: string | null;
  invitedBy: string;
}): Promise<Invite> {
  const { data, error } = await supabase
    .from("invites")
    .insert({
      contact_type: params.contactType,
      contact: params.contact.trim(),
      first_name: params.firstName?.trim() || null,
      last_name: params.lastName?.trim() || null,
      legacy_profile_id: params.legacyProfileId,
      invited_by: params.invitedBy,
    })
    .select("id, token, contact_type, contact, first_name, last_name, legacy_profile_id, created_at, accepted_at")
    .single();
  if (error) throw error;
  return data as Invite;
}

export async function cancelInvite(id: string): Promise<void> {
  const { error } = await supabase.from("invites").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Accepts the invite this device was opened with, for the signed-in user.
 * Returns "joined" | "linked" | "reactivated" | "already" | "used" | "invalid".
 */
export async function redeemInvite(token: string): Promise<string> {
  const { data, error } = await supabase.rpc("redeem_invite", { p_token: token });
  if (error) throw error;
  return data as string;
}
