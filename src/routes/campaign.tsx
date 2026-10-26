import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileDown, Megaphone, ShieldAlert } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Plate, RoseButton } from "@/components/EmpireUI";
import { supabase } from "@/integrations/supabase/client";
import { DOC_TYPES, visitAlert, weeklyReportPdf, type CampaignStats } from "@/lib/campaign";
import { useControlAccess } from "@/hooks/useBadges";

export const Route = createFileRoute("/campaign")({
  head: () => ({
    meta: [
      { title: "Campaign Dashboard — WRCAN Evidence Machine" },
      { name: "description", content: "Public evidence dashboard: before/after logs, document bottlenecks, government visits and child milestones." },
      { property: "og:title", content: "WRCAN Campaign Dashboard — Proof, not slogans" },
      { property: "og:description", content: "Making government work visible with live evidence from ECD centres." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CampaignPage,
});

function Stat({ value, label, alert }: { value: number | string; label: string; alert?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 text-center ${alert ? "border-destructive bg-destructive/10" : "border-border"}`}>
      <p className={`font-display text-2xl font-bold ${alert ? "text-destructive" : "text-primary"}`}>{value}</p>
      <p className="text-[0.65rem] tracking-widest text-muted-foreground uppercase">{label}</p>
    </div>
  );
}

function CampaignPage() {
  const { allowed: isCoach } = useControlAccess();
  const { data: s, isLoading, error } = useQuery({
    queryKey: ["campaign-stats"],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("campaign_public_stats");
      if (error) throw error;
      return data as unknown as CampaignStats;
    },
  });
  const red = s ? visitAlert(s.days_since_visit) === "red" : false;

  return (
    <Shell title="Campaign" subtitle="Proof, not slogans">
      <div className="mb-4 flex flex-wrap justify-center gap-2">
        <Link to="/campaign-tools"><RoseButton className="!px-4 !py-2"><Megaphone className="size-4" /> Log evidence</RoseButton></Link>
        {s && <RoseButton variant="outline" className="!px-4 !py-2" onClick={() => void weeklyReportPdf(s)}><FileDown className="size-4" /> Weekly report PDF</RoseButton>}
        {isCoach && <Link to="/coach"><RoseButton variant="outline" className="!px-4 !py-2"><ShieldAlert className="size-4" /> Coach dashboard</RoseButton></Link>}
      </div>
      {isLoading && <p className="text-center text-sm text-muted-foreground">Loading live figures…</p>}
      {error && <p className="text-center text-sm text-destructive">Could not load figures.</p>}
      {s && (
        <div className="space-y-4 pb-8">
          {red && (
            <p role="alert" className="rounded-xl bg-destructive px-4 py-3 text-center text-sm font-semibold text-destructive-foreground">
              RED · No government visit {s.days_since_visit === null ? "logged yet" : `for ${s.days_since_visit} days`}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Stat value={s.centres} label="centres reporting" />
            <Stat value={s.evidence_complete} label="before/after proofs" />
            <Stat value={s.children_no_birth_cert} label="children no birth cert" alert={s.children_no_birth_cert > 0} />
            <Stat value={s.centres_health_expired} label="centres health cert expired" alert={s.centres_health_expired > 0} />
            <Stat value={s.visits_total} label="government visits" />
            <Stat value={s.voice_notes} label="parent voice notes" />
          </div>
          <Plate>
            <h2 className="mb-2 font-display text-sm tracking-widest uppercase">Document bottlenecks</h2>
            {Object.keys(s.documents_by_type).length === 0 ? <p className="text-xs text-muted-foreground">No outstanding documents logged.</p> : (
              <ul className="space-y-1 text-sm">{Object.entries(s.documents_by_type).map(([k, n]) => <li key={k} className="flex justify-between"><span>{DOC_TYPES[k] ?? k}</span><b className="text-destructive">{n}</b></li>)}</ul>
            )}
          </Plate>
          <Plate>
            <h2 className="mb-2 font-display text-sm tracking-widest uppercase">Child development milestones</h2>
            {!s.milestones.length ? <p className="text-xs text-muted-foreground">No milestones recorded yet.</p> : s.milestones.map((m) => (
              <div key={m.milestone} className="mb-2">
                <div className="flex justify-between text-xs"><span>{m.milestone}</span><b>{m.pct}%</b></div>
                <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${m.pct}%` }} /></div>
              </div>
            ))}
          </Plate>
          <p className="text-center text-[0.65rem] text-muted-foreground">Updated {new Date(s.generated_at).toLocaleTimeString()} · Confidential cases open: {s.incidents_open} (details never shown publicly)</p>
        </div>
      )}
    </Shell>
  );
}
