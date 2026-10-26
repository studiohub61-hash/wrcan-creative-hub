import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ExternalLink, Radio } from "lucide-react";
import { Plate } from "@/components/EmpireUI";
import { timeAgo, useTick } from "@/lib/live-time";
import { getLiveJobs } from "@/lib/live-jobs.functions";

const REGIONS = ["All", "South Africa", "Europe", "Americas", "Worldwide"] as const;

export function LiveJobsFeed({ term }: { term: string }) {
  const fetchJobs = useServerFn(getLiveJobs);
  const [region, setRegion] = useState<(typeof REGIONS)[number]>("All");
  useTick();
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["live-jobs"],
    queryFn: () => fetchJobs(),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const t = term.trim().toLowerCase();
  const list = (data?.jobs ?? [])
    .filter((j) => region === "All" || j.region === region)
    .filter((j) => !t || `${j.title} ${j.company} ${j.location}`.toLowerCase().includes(t));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display flex items-center gap-2 text-lg font-semibold">
          <Radio className={`h-4 w-4 text-primary ${isFetching ? "animate-pulse" : ""}`} /> Live global jobs
        </h2>
        <span className="text-[0.6rem] tracking-widest text-muted-foreground uppercase">
          {data ? `Updated ${timeAgo(data.fetchedAt)} · ${data.jobs.length}` : "Connecting…"}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {REGIONS.map((r) => (
          <button key={r} type="button" onClick={() => setRegion(r)}
            className={`rounded-full px-3 py-1 text-[0.6rem] font-semibold tracking-widest uppercase ${region === r ? "rose-metal" : "border border-border bg-card/70 text-muted-foreground"}`}>
            {r}
          </button>
        ))}
      </div>
      {isLoading ? <p className="py-4 text-center text-sm text-muted-foreground">Fetching live jobs…</p> : null}
      {list.slice(0, 60).map((j) => (
        <a key={j.id} href={j.url} target="_blank" rel="noopener noreferrer" className="block">
          <Plate className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-semibold">{j.title}</h3>
              <p className="truncate text-xs text-muted-foreground">{j.company} · {j.type}</p>
              <p className="mt-1 text-[0.65rem] text-muted-foreground">
                {j.location} · {timeAgo(j.postedAt)} · via {j.source}
              </p>
            </div>
            <ExternalLink className="h-4 w-4 shrink-0 text-primary/70" />
          </Plate>
        </a>
      ))}
      {!isLoading && list.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">No live jobs in this region right now.</p> : null}
    </div>
  );
}
