import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Award, BookOpen } from "lucide-react";
import { Shell } from "@/components/Shell";
import { MatchRing, Plate, inputClass } from "@/components/EmpireUI";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { matchModule, scoreBand } from "@/lib/matching";

export const Route = createFileRoute("/training")({
  head: () => ({
    meta: [
      { title: "Accredited Training Modules — WRCAN App" },
      {
        name: "description",
        content:
          "Browse YES, SETA and UNICEF accredited training modules on WRCAN, auto-matched to your age, qualifications and skills.",
      },
      { property: "og:title", content: "Accredited Training Modules — WRCAN App" },
      {
        property: "og:description",
        content: "YES, SETA and UNICEF training with downloadable certificates on completion.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TrainingPage,
});

function TrainingPage() {
  const { profile } = useAuth();
  const [q, setQ] = useState("");

  const { data: modules = [], isLoading } = useQuery({
    queryKey: ["training_modules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_modules")
        .select("*")
        .eq("is_active", true)
        .order("title");
      if (error) throw error;
      return data;
    },
  });

  const ranked = useMemo(() => {
    const term = q.trim().toLowerCase();
    return modules
      .filter(
        (m) =>
          !term ||
          m.title.toLowerCase().includes(term) ||
          m.provider.toLowerCase().includes(term) ||
          (m.tags ?? []).some((t) => t.toLowerCase().includes(term)),
      )
      .map((m) => ({ mod: m, match: matchModule(profile, m) }))
      .sort((a, b) => b.match.score - a.match.score);
  }, [modules, q, profile]);

  return (
    <Shell title="Training" subtitle="YES · SETA · UNICEF accredited">
      <input
        className={`${inputClass} mb-4`}
        placeholder="Search modules, providers, skills"
        value={q}
        maxLength={80}
        onChange={(e) => setQ(e.target.value)}
      />

      {!profile ? (
        <p className="mb-4 text-center text-xs tracking-widest text-muted-foreground uppercase">
          Complete your profile for personalised matching
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-center text-sm text-muted-foreground">Loading modules…</p>
      ) : null}

      <div className="space-y-3 pb-4">
        {ranked.map(({ mod, match }) => (
          <Link key={mod.id} to="/training/$moduleId" params={{ moduleId: mod.id }}>
            <Plate className="flex items-start gap-3">
              <MatchRing score={match.score} />
              <div className="min-w-0 flex-1">
                <h2 className="font-display truncate text-base font-semibold">{mod.title}</h2>
                <p className="text-xs text-muted-foreground">
                  {mod.provider}
                  {mod.accrediting_body ? ` · ${mod.accrediting_body}` : ""}
                  {mod.nqf_level ? ` · NQF ${mod.nqf_level}` : ""}
                </p>
                <p className="mt-1 flex items-center gap-3 text-[0.65rem] tracking-widest text-primary uppercase">
                  <span className="inline-flex items-center gap-1">
                    <BookOpen className="h-3 w-3" /> {mod.duration_hours}h
                  </span>
                  {mod.is_accredited ? (
                    <span className="inline-flex items-center gap-1">
                      <Award className="h-3 w-3" /> Certificate
                    </span>
                  ) : null}
                  <span>{scoreBand(match.score)}</span>
                </p>
              </div>
            </Plate>
          </Link>
        ))}
      </div>
    </Shell>
  );
}
