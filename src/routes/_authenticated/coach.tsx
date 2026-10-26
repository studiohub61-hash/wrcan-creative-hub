import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { Plate } from "@/components/EmpireUI";
import { supabase } from "@/integrations/supabase/client";
import { useControlAccess } from "@/hooks/useBadges";
import { campaignUrl } from "@/lib/campaign";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/coach")({
  head: () => ({
    meta: [
      { title: "Coach Dashboard — WRCAN Campaign" },
      { name: "description", content: "Parent voice notes, government visits and confidential case management for coaches and social workers." },
      { property: "og:title", content: "Coach Dashboard — WRCAN" },
      { property: "og:description", content: "Restricted campaign dashboard for coaches." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CoachPage,
});

function Signed({ path, kind }: { path: string | null; kind: "audio" | "image" | "link" }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { void campaignUrl(path).then(setUrl); }, [path]);
  if (!url) return null;
  if (kind === "audio") return <audio controls src={url} className="mt-1 w-full" />;
  if (kind === "image") return <img src={url} alt="Evidence" className="mt-1 h-24 rounded-lg object-cover" />;
  return <a href={url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">Open attachment</a>;
}

function CoachPage() {
  const { allowed, loading } = useControlAccess();
  const qc = useQueryClient();
  const voice = useQuery({ queryKey: ["coach-voice"], enabled: allowed, refetchInterval: 20000, queryFn: async () => (await supabase.from("campaign_voice_notes").select("*").order("created_at", { ascending: false }).limit(50)).data ?? [] });
  const visits = useQuery({ queryKey: ["coach-visits"], enabled: allowed, queryFn: async () => (await supabase.from("campaign_visits").select("*").order("visited_at", { ascending: false }).limit(20)).data ?? [] });
  const incidents = useQuery({ queryKey: ["coach-incidents"], enabled: allowed, refetchInterval: 20000, queryFn: async () => (await supabase.from("campaign_incidents").select("*").order("created_at", { ascending: false })).data ?? [] });

  if (loading) return <Shell title="Coach dashboard"><p className="text-sm text-muted-foreground">Checking access…</p></Shell>;
  if (!allowed) return <Shell title="Coach dashboard"><p className="py-8 text-center text-sm text-muted-foreground">This dashboard is restricted to coaches and social workers.</p></Shell>;

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("campaign_incidents").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    void qc.invalidateQueries({ queryKey: ["coach-incidents"] });
  };
  const markHeard = async (id: string) => {
    await supabase.from("campaign_voice_notes").update({ status: "heard" }).eq("id", id);
    void qc.invalidateQueries({ queryKey: ["coach-voice"] });
  };

  return (
    <Shell title="Coach dashboard" subtitle="Restricted">
      <div className="space-y-4 pb-8">
        <Plate>
          <h2 className="mb-2 font-display text-sm tracking-widest uppercase">Confidential cases ({incidents.data?.filter((i) => i.status !== "closed").length ?? 0} open)</h2>
          {!incidents.data?.length && <p className="text-xs text-muted-foreground">No reports.</p>}
          <ul className="divide-y divide-border">{incidents.data?.map((i) => (
            <li key={i.id} className="py-3 text-sm">
              <p className="font-semibold">{i.category} · {i.centre}</p>
              <p className="text-xs text-muted-foreground">{new Date(i.created_at).toLocaleString()}</p>
              <p className="mt-1 break-words">{i.description}</p>
              <Signed path={i.evidence_path} kind="link" />
              <select aria-label="Case status" className="mt-2 rounded border border-border bg-background px-2 py-1 text-xs" value={i.status} onChange={(e) => void setStatus(i.id, e.target.value)}>
                {["open", "investigating", "referred", "closed"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </li>
          ))}</ul>
        </Plate>
        <Plate>
          <h2 className="mb-2 font-display text-sm tracking-widest uppercase">Parent voice notes</h2>
          {!voice.data?.length && <p className="text-xs text-muted-foreground">No voice notes yet.</p>}
          <ul className="divide-y divide-border">{voice.data?.map((v) => (
            <li key={v.id} className="py-3 text-sm">
              <p>{v.centre} · {v.language} · {new Date(v.created_at).toLocaleString()} {v.status === "new" && <b className="text-primary">NEW</b>}</p>
              {v.summary && <p className="text-xs text-muted-foreground">“{v.summary}”</p>}
              <Signed path={v.audio_path} kind="audio" />
              {v.status === "new" && <button type="button" className="mt-1 text-xs text-primary underline" onClick={() => void markHeard(v.id)}>Mark as heard</button>}
            </li>
          ))}</ul>
        </Plate>
        <Plate>
          <h2 className="mb-2 font-display text-sm tracking-widest uppercase">Government visits</h2>
          {!visits.data?.length && <p className="text-xs text-muted-foreground">No visits logged.</p>}
          <ul className="divide-y divide-border">{visits.data?.map((v) => (
            <li key={v.id} className="py-3 text-sm">
              <p>{v.official_name} ({v.department}) · {v.centre}</p>
              <p className="text-xs text-muted-foreground">{new Date(v.visited_at).toLocaleString()}{v.latitude ? ` · GPS ${v.latitude.toFixed(4)}, ${v.longitude?.toFixed(4)}` : ""}</p>
              <div className="flex gap-2"><Signed path={v.photo_path} kind="image" /><img src={v.signature} alt="Signature" className="mt-1 h-24 rounded-lg border border-border bg-background" /></div>
            </li>
          ))}</ul>
        </Plate>
      </div>
    </Shell>
  );
}
