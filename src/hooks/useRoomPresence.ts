import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type RoomMember = { id: string; name: string };

/**
 * Live roster of the members who are in a shared room right now (Supabase
 * presence — nothing is stored, and no media leaves the browser). Used by the
 * Media Studio classroom so students can see who is already in a room code.
 */
export function useRoomPresence(roomCode: string | null) {
  const { user, profile } = useAuth();
  const [members, setMembers] = useState<RoomMember[]>([]);
  const name = profile?.full_name || "Member";

  useEffect(() => {
    if (!user || !roomCode) {
      setMembers([]);
      return;
    }

    const channel = supabase.channel(`studio-room-${roomCode}`, {
      config: { presence: { key: user.id } },
    });

    const sync = () => {
      const state = channel.presenceState<{ name?: string }>();
      setMembers(
        Object.entries(state).map(([id, metas]) => ({ id, name: metas[0]?.name || "Member" })),
      );
    };

    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void channel.track({ name });
      });

    return () => {
      setMembers([]);
      void supabase.removeChannel(channel);
    };
  }, [roomCode, user, name]);

  return members;
}
