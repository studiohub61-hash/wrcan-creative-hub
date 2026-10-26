import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, MapPin, ShieldCheck, X } from "lucide-react";
import { Shell } from "@/components/Shell";
import { MatchRing, Plate, RoseButton, areaClass } from "@/components/EmpireUI";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { matchJob, scoreBand } from "@/lib/matching";

async function fetchJob(jobId: string) {
  const { data, error } = await supabase.from("jobs").select("*").eq("id", jobId).maybeSingle();
  if (error) throw error;
  return data;
}

export const Route = createFileRoute("/jobs/$jobId")({
  // Prefetched on link hover so a vacancy opens instantly.
  loader: ({ context, params }) =>
    context.queryClient.prefetchQuery({
      queryKey: ["job", params.jobId],
      queryFn: () => fetchJob(params.jobId),
    }),
  head: () => ({
    meta: [
      { title: "Vacancy Details & Auto-Match — WRCAN App" },
      {
        name: "description",
        content:
          "See how your WRCAN registration profile scores against this vacancy, then apply with your auto-matched dossier in one tap.",
      },
      { property: "og:title", content: "Vacancy Details & Auto-Match — WRCAN App" },
      {
        property: "og:description",
        content: "Requirements, salary, match reasons and one-tap application on WRCAN.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JobDetail,
});

function JobDetail() {
  const { jobId } = Route.useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: job } = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => fetchJob(jobId),
  });

  const { data: application } = useQuery({
    queryKey: ["application", jobId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("*")
        .eq("job_id", jobId)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Live: a recruiter moving this application along shows up without a refresh.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`application-${jobId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "applications", filter: `job_id=eq.${jobId}` },
        () => void qc.invalidateQueries({ queryKey: ["application", jobId] }),
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [jobId, user, qc]);

  if (!job) {
    return (
      <Shell title="Vacancy">
        <p className="text-center text-sm text-muted-foreground">Loading vacancy…</p>
      </Shell>
    );
  }

  const match = matchJob(profile, job);

  const apply = async () => {
    if (!user) {
      void navigate({ to: "/auth" });
      return;
    }
    if (!profile) {
      toast.error("Complete your registration profile first.");
      void navigate({ to: "/profile" });
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("applications").insert({
      user_id: user.id,
      job_id: job.id,
      match_score: match.score,
      cover_note: note.trim() || null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    void qc.invalidateQueries({ queryKey: ["application", jobId, user.id] });
    toast.success(`Applied with a ${match.score}% auto-match.`);
  };

  return (
    <Shell title={job.title} subtitle={job.company}>
      <div className="space-y-4 pb-6">
        <Plate className="flex items-start gap-3">
          <MatchRing score={match.score} />
          <div className="min-w-0 flex-1">
            <p className="text-xs tracking-widest text-primary uppercase">
              {scoreBand(match.score)}
            </p>
            <p className="mt-1 flex items-center gap-1 text-[0.7rem] text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {[job.city, job.province].filter(Boolean).join(", ") || "South Africa"} ·{" "}
              {job.employment_type}
            </p>
            {job.salary_min ? (
              <p className="mt-1 text-sm font-semibold">
                R{job.salary_min.toLocaleString()}
                {job.salary_max ? ` – R${job.salary_max.toLocaleString()}` : "+"} p/m
              </p>
            ) : null}
          </div>
        </Plate>

        <Plate className="space-y-2">
          <h2 className="font-display text-lg font-semibold">Why you match</h2>
          {match.reasons.map((r) => (
            <p key={r} className="flex items-start gap-2 text-sm text-foreground">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {r}
            </p>
          ))}
          {match.blockers.map((b) => (
            <p key={b} className="flex items-start gap-2 text-sm text-muted-foreground">
              <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              {b}
            </p>
          ))}
        </Plate>

        <Plate className="space-y-2">
          <h2 className="font-display text-lg font-semibold">The role</h2>
          <p className="text-sm whitespace-pre-line text-muted-foreground">{job.description}</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[0.7rem] text-muted-foreground">
            <span>Age {job.min_age}–{job.max_age}</span>
            <span>{job.min_experience} yrs experience</span>
            <span>{job.required_qualification ?? "No formal requirement"}</span>
            <span>{job.positions} position(s)</span>
          </div>
          {(job.required_skills ?? []).length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {job.required_skills.map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-accent/50 px-2 py-0.5 text-[0.6rem] tracking-widest text-primary uppercase"
                >
                  {s}
                </span>
              ))}
            </div>
          ) : null}
          {job.disability_friendly ? (
            <p className="mt-2 flex items-center gap-2 text-xs text-primary">
              <ShieldCheck className="h-4 w-4" /> Disability-inclusive employer
            </p>
          ) : null}
        </Plate>

        {application ? (
          <Plate>
            <p className="text-sm">
              Application submitted — status{" "}
              <span className="text-primary uppercase">{application.status}</span> with a{" "}
              {application.match_score}% match.
            </p>
          </Plate>
        ) : (
          <Plate className="space-y-3">
            <h2 className="font-display text-lg font-semibold">Apply</h2>
            <textarea
              className={areaClass}
              rows={3}
              maxLength={800}
              value={note}
              placeholder="Add a short motivation (optional)"
              onChange={(e) => setNote(e.target.value)}
            />
            <RoseButton className="w-full" disabled={busy} onClick={() => void apply()}>
              {busy ? "Submitting…" : user ? "Apply with my dossier" : "Sign in to apply"}
            </RoseButton>
          </Plate>
        )}
      </div>
    </Shell>
  );
}
