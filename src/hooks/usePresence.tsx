import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type PresenceValue = {
  /** user ids currently connected to the Wanda network */
  online: Set<string>;
  /** the same people, with the display name they are broadcasting */
  onlineMembers: { id: string; name: string }[];
  isOnline: (id: string | null | undefined) => boolean;
  onlineCount: number;
};

const PresenceContext = createContext<PresenceValue>({
  online: new Set(),
  onlineMembers: [],
  isOnline: () => false,
  onlineCount: 0,
});

/** Global "who is online" channel — one connection for the whole app. */
export function PresenceProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [names, setNames] = useState<Record<string, string>>({});
  const name = profile?.full_name || "Member";

  useEffect(() => {
    if (!user) {
      setOnline(new Set());
      setNames({});
      return;
    }

    const channel = supabase.channel("wanda-presence", {
      config: { presence: { key: user.id } },
    });

    const sync = () => {
      const state = channel.presenceState<{ name?: string }>();
      setOnline(new Set(Object.keys(state)));
      setNames(
        Object.fromEntries(
          Object.entries(state).map(([id, metas]) => [id, metas[0]?.name || "Member"]),
        ),
      );
    };

    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.track({ at: new Date().toISOString(), name });
        }
      });

    // Keep "last seen" fresh while the tab lives, and stamp it on the way out.
    const touch = () => {
      void supabase
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", user.id);
    };
    touch();
    const timer = window.setInterval(touch, 60_000);
    window.addEventListener("pagehide", touch);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pagehide", touch);
      touch();
      void supabase.removeChannel(channel);
    };
  }, [user, name]);

  const value = useMemo<PresenceValue>(
    () => ({
      online,
      onlineMembers: [...online].map((id) => ({ id, name: names[id] || "Member" })),
      isOnline: (id) => (id ? online.has(id) : false),
      onlineCount: online.size,
    }),
    [online, names],
  );

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
}

export function usePresence() {
  return useContext(PresenceContext);
}

export function lastSeenLabel(iso: string | null | undefined) {
  if (!iso) return "offline";
  const then = new Date(iso);
  const mins = Math.floor((Date.now() - then.getTime()) / 60000);
  if (mins < 1) return "last seen just now";
  if (mins < 60) return `last seen ${mins} min ago`;
  const today = new Date();
  const sameDay = then.toDateString() === today.toDateString();
  const time = then.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `last seen today at ${time}`;
  const yest = new Date(today.getTime() - 86400000);
  if (then.toDateString() === yest.toDateString()) return `last seen yesterday at ${time}`;
  return `last seen ${then.toLocaleDateString("en-ZA", { day: "2-digit", month: "short" })}`;
}
