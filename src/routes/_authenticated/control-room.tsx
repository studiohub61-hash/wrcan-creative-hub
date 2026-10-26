import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  Activity,
  Award,
  Briefcase,
  Film,
  MessageCircle,
  Radio,
  UserCheck,
  Users,
} from "lucide-react";
import { Shell } from "@/components/Shell";
import { LivePulse } from "@/components/LiveBadge";
import { timeAgo, useTick } from "@/lib/live-time";
import { Plate } from "@/components/EmpireUI";
import { supabase } from "@/integrations/supabase/client";
import { useControlAccess } from "@/hooks/useBadges";
import { Lock } from "lucide-react";
import { MembersPanel, UploadsPanel } from "@/components/ControlRoomPanels";

export const Route = createFileRoute("/_authenticated/control-room")({
  head: () => ({
    meta: [
      { title: "Control Room — Wanda Recruitment & Catering" },
      {
        name: "description",
        content:
          "Live Wanda control room: members, sign-ups today, active sessions, reel views, certificates, jobs and chat volume in real time.",
      },
      { property: "og:title", content: "Control Room — Wanda Recruitment & Catering" },
      {
        property: "og:description",
        content: "Real-time activity dashboard for the Wanda recruitment and catering network.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ControlRoomPage,
});

type Stats = {
  total_users: number;
  new_users_today: number;
  emails_captured: number;
  emails_today: number;
  active_sessions: number;
  active_24h: number;
  reel_views: number;
  reels_count: number;
  interactions: number;
  certificates: number;
  certificates_today: number;
  recruiters: number;
  recruiters_online: number;
  jobs: number;
  jobs_this_week: number;
  applications: number;
  messages: number;
  messages_last_hour: number;
  enrollments: number;
  completions: number;
  daily_active: { day: string; value: number }[];
  recent_logins: {
    email: string;
    full_name: string | null;
    last_seen_at: string | null;
    place: string;
  }[];
  generated_at: string;
};

const n = (v: number | undefined) => (v ?? 0).toLocaleString("en-ZA");

const ago = (iso: string | null) => {
  if (!iso) return "—";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
};

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Plate className="flex items-center gap-3">
      <span className="rose-metal flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
        <Icon className="h-5 w-5" strokeWidth={1.8} />
      </span>
      <div className="min-w-0">
        <p className="text-[0.6rem] tracking-widest text-muted-foreground uppercase">{label}</p>
        <p className="font-display rose-text text-xl font-semibold leading-tight">{value}</p>
        {sub ? <p className="truncate text-[0.65rem] text-muted-foreground">{sub}</p> : null}
      </div>
    </Plate>
  );
}

function ControlRoomPage() {
  const { allowed, loading } = useControlAccess();
  if (loading) return <Shell title="Control Room"><p className="py-10 text-center text-sm text-muted-foreground">Checking access…</p></Shell>;
  if (!allowed)
    return (
      <Shell title="Control Room" subtitle="Restricted">
        <Plate className="text-center">
          <Lock className="mx-auto mb-2 h-8 w-8 text-primary" />
          <p className="text-sm text-muted-foreground">The Control Room is private to the Wanda owner.</p>
        </Plate>
      </Shell>
    );
  return <ControlRoomLive />;
}

function ControlRoomLive() {
  const qc = useQueryClient();
  useTick();

  const { data, isLoading, error } = useQuery({
    queryKey: ["control-room-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("control_room_stats_secure");
      if (error) throw error;
      return data as unknown as Stats;
    },
  });

  // Live refresh the moment anything moves in the network — no polling.
  useEffect(() => {
    const invalidate = () => qc.invalidateQueries({ queryKey: ["control-room-stats"] });
    const channel = supabase
      .channel("control-room")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "talent_reels" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "applications" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "certificates" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "enrollments" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "status_posts" }, invalidate)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const trend = data?.daily_active ?? [];
  const peak = Math.max(1, ...trend.map((d) => d.value));

  return (
    <Shell title="Control Room" subtitle="Live network activity">
      {isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading live figures…</p>
      ) : error ? (
        <Plate className="text-center text-sm text-muted-foreground">
          Live figures are unavailable right now. Please try again shortly.
        </Plate>
      ) : (
        <div className="space-y-6 pb-6">
          <LivePulse className="justify-center">
            Live · updated {timeAgo(data?.generated_at)}
          </LivePulse>

          <div className="grid grid-cols-2 gap-3">
            <Stat
              icon={Users}
              label="Total members"
              value={n(data?.total_users)}
              sub={`${n(data?.new_users_today)} joined today`}
            />
            <Stat
              icon={Activity}
              label="Active now"
              value={n(data?.active_sessions)}
              sub={`${n(data?.active_24h)} in last 24 h`}
            />
            <Stat
              icon={Film}
              label="Reel views"
              value={n(data?.reel_views)}
              sub={`${n(data?.reels_count)} reels posted`}
            />
            <Stat
              icon={Radio}
              label="Interactions"
              value={n(data?.interactions)}
              sub="Likes, messages & applications"
            />
            <Stat
              icon={Award}
              label="Certificates"
              value={n(data?.certificates)}
              sub={`${n(data?.certificates_today)} issued today`}
            />
            <Stat
              icon={UserCheck}
              label="Recruiters online"
              value={n(data?.recruiters_online)}
              sub={`${n(data?.recruiters)} recruiters & caterers`}
            />
            <Stat
              icon={Briefcase}
              label="Open jobs"
              value={n(data?.jobs)}
              sub={`${n(data?.jobs_this_week)} posted this week`}
            />
            <Stat
              icon={MessageCircle}
              label="Chat messages"
              value={n(data?.messages)}
              sub={`${n(data?.messages_last_hour)} in the last hour`}
            />
          </div>

          <Plate>
            <h2 className="font-display rose-text text-sm font-semibold tracking-widest uppercase">
              Active members · last 7 days
            </h2>
            <div className="mt-4 flex h-32 items-end gap-2">
              {trend.map((d, i) => (
                <div key={`${d.day}-${i}`} className="flex flex-1 flex-col items-center gap-2">
                  <div
                    className="rose-metal w-full rounded-t-md"
                    style={{ height: `${Math.max(6, (d.value / peak) * 100)}%` }}
                    title={`${d.value}`}
                  />
                  <span className="text-[0.6rem] tracking-widest text-muted-foreground uppercase">
                    {d.day}
                  </span>
                </div>
              ))}
            </div>
          </Plate>

          <div className="grid grid-cols-3 gap-3">
            <Stat icon={Users} label="Enrolments" value={n(data?.enrollments)} />
            <Stat icon={Award} label="Completions" value={n(data?.completions)} />
            <Stat icon={Briefcase} label="Applications" value={n(data?.applications)} />
          </div>

          <MembersPanel />
          <UploadsPanel />

          <Plate>
            <h2 className="font-display rose-text text-sm font-semibold tracking-widest uppercase">
              Recent activity
            </h2>
            <ul className="mt-3 divide-y divide-border/60">
              {(data?.recent_logins ?? []).map((r, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">{r.full_name || r.email}</p>
                    <p className="truncate text-[0.65rem] text-muted-foreground">
                      {r.email} · {r.place}
                    </p>
                  </div>
                  <span className="shrink-0 text-[0.65rem] tracking-widest text-muted-foreground uppercase">
                    {ago(r.last_seen_at)}
                  </span>
                </li>
              ))}
              {(data?.recent_logins ?? []).length === 0 ? (
                <li className="py-3 text-sm text-muted-foreground">No activity yet.</li>
              ) : null}
            </ul>
          </Plate>
        </div>
      )}
    </Shell>
  );
}
