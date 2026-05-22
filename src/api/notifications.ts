import { supabase } from "../supabaseClient";

export type AppNotification = {
  id: string;
  type: string;
  actor_id: string | null;
  actor_name: string | null;
  whiskey_day_id: number | null;
  whiskey_name: string | null;
  body: string | null;
  read: boolean;
  created_at: string;
};

export async function getNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as AppNotification[];
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("read", false);
  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("read", false);
  if (error) throw error;
}
