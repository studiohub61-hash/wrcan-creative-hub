import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Participant = Tables<"participants">;
export type AttendanceLog = Tables<"attendance_logs">;
export type LiveNotice = { id: string; text: string; at: string };

type Ctx = {
  live: boolean; participants: Participant[]; logs: AttendanceLog[]; notices: LiveNotice[]; unread: number;
  markRead: () => void; clear: () => void;
  register: (p: TablesInsert<"participants">) => Promise<boolean>;
  logClock: (l: TablesInsert<"attendance_logs">) => Promise<boolean>;
};
const RealtimeContext = createContext<Ctx | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [notices, setNotices] = useState<LiveNotice[]>([]);
  const [unread, setUnread] = useState(0);

  const notify = useCallback((text: string) => {
    toast(text);
    setNotices(n => [{ id: crypto.randomUUID(), text, at: new Date().toISOString() }, ...n].slice(0, 30));
    setUnread(u => u + 1);
  }, []);

  useEffect(() => {
    if (!user) { setParticipants([]); setLogs([]); return; }
    let cancelled = false;
    void Promise.all([
      supabase.from("participants").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("attendance_logs").select("*").order("created_at", { ascending: false }).limit(200),
    ]).then(([p, l]) => { if (cancelled) return; setParticipants(p.data ?? []); setLogs(l.data ?? []); });
    const channel = supabase.channel(`live-attendance-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "participants" }, payload => {
        const row = payload.new as Participant;
        if (payload.eventType === "INSERT") { setParticipants(p => [row, ...p.filter(x => x.id !== row.id)]); notify(`${row.name} registered as ${row.role}`); }
        else if (payload.eventType === "UPDATE") setParticipants(p => p.map(x => x.id === row.id ? row : x));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "attendance_logs" }, payload => {
        const row = payload.new as AttendanceLog;
        setLogs(l => [row, ...l.filter(x => x.id !== row.id)].slice(0, 200));
        notify(`${row.name} clocked ${row.action === "In" ? "in" : "out"}${row.punctuality ? ` · ${row.punctuality}` : ""}`);
      })
      .subscribe();
    return () => { cancelled = true; void supabase.removeChannel(channel); };
  }, [user, notify]);

  const register = useCallback(async (p: TablesInsert<"participants">) => !(await supabase.from("participants").upsert(p)).error, []);
  const logClock = useCallback(async (l: TablesInsert<"attendance_logs">) => {
    const { error } = await supabase.from("attendance_logs").insert(l);
    if (!error) await supabase.from("participants").update({ status: l.action === "In" ? "on_site" : "off_site" }).eq("id", l.participant_id);
    return !error;
  }, []);

  const value = useMemo<Ctx>(() => ({ live: !!user, participants, logs, notices, unread, markRead: () => setUnread(0), clear: () => { setNotices([]); setUnread(0); }, register, logClock }), [user, participants, logs, notices, unread, register, logClock]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error("useRealtime must be used inside RealtimeProvider");
  return ctx;
}
