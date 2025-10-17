// /js/invites.js — invitations (API simple)
import { supabase } from "./api.js?v=20251017";

export async function inviteByEmail(eventId, inviteeEmail) {
  const { data: ur } = await supabase.auth.getUser();
  const user = ur?.user;
  if (!user) throw new Error("Not signed in");

  // insère avec inviter_id si colonne existe ; sinon, sans
  let { error } = await supabase.from("invitations").insert({
    event_id: eventId, inviter_id: user.id, invitee_email: inviteeEmail
  });
  if (error && /inviter_id/.test(error.message || "")) {
    ({ error } = await supabase.from("invitations").insert({
      event_id: eventId, invitee_email: inviteeEmail
    }));
  }
  if (error) throw error;
  return true;
}

export async function listInvitesForEvent(eventId) {
  const { data, error } = await supabase.from("invitations")
    .select("id,event_id,invitee_email,status,created_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function respondInvite(inviteId, status) {
  const { error } = await supabase.from("invitations")
    .update({ status }).eq("id", inviteId);
  if (error) throw error;
}

export function subscribeInvitesForEvent(eventId, onChange) {
  const channel = supabase.channel("invites-by-event-" + eventId)
    .on("postgres_changes", { event: "*", schema: "public", table: "invitations", filter: `event_id=eq.${eventId}` },
      () => { try { onChange && onChange(); } catch { } })
    .subscribe();
  return () => supabase.removeChannel(channel);
}
