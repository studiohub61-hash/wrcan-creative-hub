import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { Plate } from "@/components/EmpireUI";
import { supabase } from "@/integrations/supabase/client";
import { usePresence, lastSeenLabel } from "@/hooks/usePresence";

const ago = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  return h < 24 ? `${h} h ago` : `${Math.floor(h / 24)} d ago`;
};

type Member = { id: string; full_name: string; member_type: string; city: string | null; suburb: string | null; last_seen_at: string };

export function MembersPanel() {
  const { isOnline } = usePresence();
  const [filter, setFilter] = useState<"all" | "online" | "offline">("all");
  const { data = [] } = useQuery({
    queryKey: ["control-room-members"],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("control_room_members");
      if (error) throw error;
      return (data ?? []) as Member[];
    },
  });
  const online = data.filter((m) => isOnline(m.id));
  const list = filter === "online" ? online : filter === "offline" ? data.filter((m) => !isOnline(m.id)) : data;
  const tab = (k: typeof filter, label: string) => (
    <button
      type="button"
      onClick={() => setFilter(k)}
      className={`rounded-lg border px-3 py-1 text-xs ${filter === k ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}
    >
      {label}
    </button>
  );
  return (
    <Plate>
      <h2 className="font-display rose-text text-sm font-semibold tracking-widest uppercase">
        Members · {online.length} online · {data.length - online.length} offline
      </h2>
      <div className="mt-3 flex gap-2">
        {tab("all", "All")}
        {tab("online", "Online")}
        {tab("offline", "Offline")}
      </div>
      <ul className="mt-3 max-h-80 divide-y divide-border/60 overflow-y-auto">
        {list.map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-2">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${isOnline(m.id) ? "bg-primary" : "bg-muted-foreground/40"}`} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{m.full_name || "Member"}</p>
              <p className="truncate text-[0.65rem] text-muted-foreground">
                {m.member_type} · {m.suburb || m.city || "—"}
              </p>
            </div>
            <span className="shrink-0 text-[0.65rem] text-muted-foreground">
              {isOnline(m.id) ? "online" : lastSeenLabel(m.last_seen_at)}
            </span>
          </li>
        ))}
      </ul>
    </Plate>
  );
}

type Upload = { kind: string; user_id: string; full_name: string; title: string; latitude: number; longitude: number; created_at: string };

export function UploadsPanel() {
  const { data = [] } = useQuery({
    queryKey: ["control-room-uploads"],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("control_room_uploads");
      if (error) throw error;
      return (data ?? []) as Upload[];
    },
  });
  return (
    <Plate>
      <h2 className="font-display rose-text text-sm font-semibold tracking-widest uppercase">Uploads with GPS location</h2>
      <ul className="mt-3 max-h-72 divide-y divide-border/60 overflow-y-auto">
        {data.map((u, i) => (
          <li key={i} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm">
                {u.full_name} · <span className="text-muted-foreground">{u.kind}</span>
              </p>
              <p className="truncate text-[0.65rem] text-muted-foreground">
                {u.title} · {ago(u.created_at)}
              </p>
            </div>
            <a
              className="shrink-0 rounded-lg border border-primary/50 px-2 py-1 text-xs text-primary"
              target="_blank"
              rel="noreferrer"
              href={`https://www.google.com/maps?q=${u.latitude},${u.longitude}`}
            >
              <MapPin className="inline h-3 w-3" /> Map
            </a>
          </li>
        ))}
        {data.length === 0 ? <li className="py-3 text-sm text-muted-foreground">No located uploads yet.</li> : null}
      </ul>
    </Plate>
  );
}
