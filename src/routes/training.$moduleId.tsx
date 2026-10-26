import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { buildLessons, buildQuiz } from "@/lib/curriculum";
import { toast } from "sonner";
import { Shell } from "@/components/Shell";
import { MatchRing, Plate, RoseButton } from "@/components/EmpireUI";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { matchModule } from "@/lib/matching";

export const Route = createFileRoute("/training/$moduleId")({
  head: () => ({
    meta: [
      { title: "Training Module — WRCAN App" },
      {
        name: "description",
        content:
          "Enrol in an accredited WRCAN training module, track your progress and download your certificate on completion.",
      },
      { property: "og:title", content: "Training Module — WRCAN App" },
      {
        property: "og:description",
        content: "Enrol, learn and earn an accredited certificate on WRCAN.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: () => (
    <Shell title="Module unavailable">
      <p className="text-center text-sm text-muted-foreground">
        We couldn't load this module. Please try again.
      </p>
    </Shell>
  ),
  notFoundComponent: () => (
    <Shell title="Module not found">
      <p className="text-center text-sm text-muted-foreground">This module no longer exists.</p>
    </Shell>
  ),
  component: ModulePage,
});

function certNumber() {
  return `WRCAN-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function ModulePage() {
  const { moduleId } = Route.useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [lessonIndex, setLessonIndex] = useState(0);
  const [quizOpen, setQuizOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<number | null>(null);

  const { data: mod } = useQuery({
    queryKey: ["training_module", moduleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("training_modules")
        .select("*")
        .eq("id", moduleId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: enrollment } = useQuery({
    queryKey: ["enrollment", moduleId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("*")
        .eq("module_id", moduleId)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const lessons = useMemo(() => (mod ? buildLessons(mod) : []), [mod]);
  const quiz = useMemo(() => (mod ? buildQuiz(mod) : []), [mod]);

  if (!mod) {
    return (
      <Shell title="Training">
        <p className="text-center text-sm text-muted-foreground">Loading module…</p>
      </Shell>
    );
  }

  const match = matchModule(profile, mod);
  const lesson = lessons[Math.min(lessonIndex, lessons.length - 1)]!;

  const downloadManual = () => {
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(mod.title)} — Training Manual</title>
<style>
 body{font-family:Georgia,serif;background:#0d0d0d;color:#f5e6b8;margin:0;padding:48px;}
 h1{font-size:30px;color:#e8c25a;margin:0 0 4px;}
 h2{font-size:19px;color:#e8c25a;border-bottom:1px solid #8a6c22;padding-bottom:6px;margin-top:34px;}
 p,li{font-size:14px;line-height:1.65;color:#efe3c4;}
 .meta{font-size:11px;letter-spacing:.25em;text-transform:uppercase;color:#c9a94a;}
 @media print{body{background:#fff;color:#222}h1,h2{color:#8a6c22}p,li{color:#222}}
</style></head><body>
<h1>${esc(mod.title)}</h1>
<p class="meta">${esc(mod.provider)}${mod.accrediting_body ? " · " + esc(mod.accrediting_body) : ""} · ${mod.duration_hours}h${mod.nqf_level ? " · NQF " + mod.nqf_level : ""}</p>
<p>${esc(mod.description)}</p>
${lessons
  .map(
    (l, i) => `<h2>Unit ${i + 1}: ${esc(l.title)}</h2>${l.body.map((b) => `<p>${esc(b)}</p>`).join("")}<ul>${l.takeaways.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`,
  )
  .join("")}
<h2>Assessment preparation</h2><ol>${quiz.map((q) => `<li>${esc(q.q)}</li>`).join("")}</ol>
<p class="meta">Wanda Recruitment &amp; Catering Agency · Nationwide</p>
</body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${mod.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-manual.html`;
    a.click();
    URL.revokeObjectURL(url);
  };


  const enrol = async () => {
    if (!user) {
      void navigate({ to: "/auth" });
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("enrollments")
      .insert({ user_id: user.id, module_id: mod.id, status: "in_progress", progress: 10 });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    void qc.invalidateQueries({ queryKey: ["enrollment", moduleId, user.id] });
    toast.success("Enrolled. Your journey begins.");
  };

  const saveProgress = async (progress: number) => {
    if (!user || !enrollment || enrollment.status === "completed") return;
    if (progress <= enrollment.progress) return;
    setBusy(true);
    const { error } = await supabase
      .from("enrollments")
      .update({ progress, status: "in_progress" })
      .eq("id", enrollment.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    void qc.invalidateQueries({ queryKey: ["enrollment", moduleId, user.id] });
  };

  const submitQuiz = async () => {
    if (!user || !enrollment) return;
    const correct = quiz.reduce((n, q, i) => (answers[i] === q.answer ? n + 1 : n), 0);
    const score = Math.round((correct / quiz.length) * 100);
    setResult(score);

    if (score < 60) {
      toast.error(`Scored ${score}% — 60% needed. Review the lessons and try again.`);
      return;
    }

    setBusy(true);
    const { error } = await supabase
      .from("enrollments")
      .update({
        progress: 100,
        status: "completed",
        completed_at: new Date().toISOString(),
        score,
      })
      .eq("id", enrollment.id);

    if (!error) {
      await supabase.from("certificates").insert({
        user_id: user.id,
        module_id: mod.id,
        certificate_number: certNumber(),
        learner_name: profile?.full_name || user.email || "WRCAN Learner",
        module_title: mod.title,
        provider: mod.provider,
        score,
      });
    }
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    void qc.invalidateQueries({ queryKey: ["enrollment", moduleId, user.id] });
    toast.success(`Passed with ${score}% — certificate issued.`);
    void navigate({ to: "/certificates" });
  };


  return (
    <Shell title={mod.title} subtitle={mod.provider}>
      <div className="space-y-4 pb-6">
        <Plate className="flex items-start gap-3">
          <MatchRing score={match.score} />
          <div>
            <p className="text-xs text-muted-foreground">
              {mod.accrediting_body ? `${mod.accrediting_body} · ` : ""}
              {mod.nqf_level ? `NQF ${mod.nqf_level} · ` : ""}
              {mod.duration_hours}h{mod.credits ? ` · ${mod.credits} credits` : ""}
            </p>
            <ul className="mt-2 space-y-1 text-xs text-foreground">
              {match.reasons.map((r) => (
                <li key={r}>✓ {r}</li>
              ))}
              {match.blockers.map((b) => (
                <li key={b} className="text-muted-foreground">
                  • {b}
                </li>
              ))}
            </ul>
          </div>
        </Plate>

        <Plate>
          <h2 className="font-display mb-2 text-lg font-semibold">About this module</h2>
          <p className="text-sm text-muted-foreground">{mod.description}</p>
          {(mod.tags ?? []).length ? (
            <p className="mt-3 flex flex-wrap gap-2">
              {mod.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-primary/40 px-3 py-1 text-[0.6rem] tracking-widest text-primary uppercase"
                >
                  {t}
                </span>
              ))}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {mod.manual_url ? (
              <a
                href={mod.manual_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs tracking-widest text-primary uppercase underline"
              >
                Open external manual
              </a>
            ) : null}
            <RoseButton variant="outline" onClick={downloadManual}>
              Download training manual
            </RoseButton>
          </div>
        </Plate>


        <Plate className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Your progress</h2>
          {!enrollment ? (
            <RoseButton onClick={enrol} disabled={busy} className="w-full">
              {user ? "Enrol now" : "Sign in to enrol"}
            </RoseButton>
          ) : (
            <>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="rose-metal h-full"
                  style={{ width: `${enrollment.progress}%` }}
                  aria-hidden
                />
              </div>
              <p className="text-xs tracking-widest text-muted-foreground uppercase">
                {enrollment.progress}% · {enrollment.status.replace("_", " ")}
                {enrollment.score !== null ? ` · ${enrollment.score}%` : ""}
              </p>
              {enrollment.status === "completed" ? (
                <RoseButton className="w-full" onClick={() => void navigate({ to: "/certificates" })}>
                  View certificate
                </RoseButton>
              ) : null}
            </>
          )}
        </Plate>

        {enrollment ? (
          <>
            <Plate className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-lg font-semibold">Course content</h2>
                <span className="text-[0.6rem] tracking-widest text-muted-foreground uppercase">
                  Lesson {lessonIndex + 1} of {lessons.length}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {lessons.map((l, i) => (
                  <button
                    key={l.title}
                    onClick={() => setLessonIndex(i)}
                    className={`rounded-full border px-3 py-1 text-[0.6rem] tracking-widest uppercase transition-colors ${
                      i === lessonIndex
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-primary/30 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              <div>
                <h3 className="font-display text-base font-semibold">{lesson.title}</h3>
                {lesson.body.map((p) => (
                  <p key={p} className="mt-2 text-sm text-muted-foreground">
                    {p}
                  </p>
                ))}
                <ul className="mt-3 space-y-1 text-xs text-foreground">
                  {lesson.takeaways.map((t) => (
                    <li key={t}>✓ {t}</li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-2">
                <RoseButton
                  variant="outline"
                  className="flex-1"
                  disabled={lessonIndex === 0}
                  onClick={() => setLessonIndex((i) => Math.max(0, i - 1))}
                >
                  Back
                </RoseButton>
                <RoseButton
                  className="flex-1"
                  disabled={busy}
                  onClick={() => {
                    if (lessonIndex < lessons.length - 1) {
                      const next = lessonIndex + 1;
                      setLessonIndex(next);
                      void saveProgress(Math.round(((next + 1) / (lessons.length + 1)) * 100));
                    } else {
                      setQuizOpen(true);
                      void saveProgress(90);
                    }
                  }}
                >
                  {lessonIndex < lessons.length - 1 ? "Next lesson" : "Start assessment"}
                </RoseButton>
              </div>
            </Plate>

            {quizOpen || enrollment.status === "completed" ? (
              <Plate className="space-y-4">
                <h2 className="font-display text-lg font-semibold">Final assessment</h2>
                <p className="text-xs tracking-widest text-muted-foreground uppercase">
                  {quiz.length} questions · pass mark 60%
                </p>

                {quiz.map((question, qi) => (
                  <div key={question.q} className="space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      {qi + 1}. {question.q}
                    </p>
                    <div className="space-y-1">
                      {question.options.map((opt, oi) => {
                        const chosen = answers[qi] === oi;
                        const graded = result !== null;
                        const correct = oi === question.answer;
                        return (
                          <button
                            key={opt}
                            disabled={graded}
                            onClick={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
                            className={`block w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                              graded && correct
                                ? "border-primary bg-primary/15 text-primary"
                                : chosen
                                  ? "border-primary/70 bg-accent/40 text-foreground"
                                  : "border-border text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {result !== null ? (
                  <p className="text-sm font-semibold text-primary">
                    You scored {result}% — {result >= 60 ? "passed" : "not yet, try again"}.
                  </p>
                ) : null}

                <div className="flex gap-2">
                  <RoseButton
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setAnswers({});
                      setResult(null);
                    }}
                  >
                    Reset answers
                  </RoseButton>
                  <RoseButton
                    className="flex-1"
                    disabled={busy || Object.keys(answers).length < quiz.length}
                    onClick={submitQuiz}
                  >
                    Submit assessment
                  </RoseButton>
                </div>
              </Plate>
            ) : null}
          </>
        ) : null}
      </div>
    </Shell>
  );
}

