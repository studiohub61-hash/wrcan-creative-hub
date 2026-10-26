import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useUnreadCount() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data = 0 } = useQuery({
    queryKey: ["unread-count", user?.id],
    enabled: !!user,
    staleTime: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_unread_count");
      if (error) return 0;
      return (data as number) ?? 0;
    },
  });

  // Live badge: the count moves the moment a message arrives or is read,
  // instead of waiting for the next poll.
  useEffect(() => {
    if (!user) return;
    const invalidate = () => void qc.invalidateQueries({ queryKey: ["unread-count"] });
    const channel = supabase
      .channel(`unread-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, invalidate)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_participants" },
        invalidate,
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [user, qc]);

  return data;
}

export function useControlAccess() {
  const { user } = useAuth();
  const { data = false, isLoading } = useQuery({
    queryKey: ["control-access", user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("can_view_control_room");
      if (error) return false;
      return !!data;
    },
  });
  return { allowed: data, loading: !!user && isLoading };
}
