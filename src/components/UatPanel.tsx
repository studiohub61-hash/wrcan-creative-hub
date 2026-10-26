import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, ChevronDown, CircleDashed, Download, FlaskConical, RotateCcw, XCircle, Zap } from "lucide-react";

import { Plate, RoseButton } from "@/components/EmpireUI";
import { downloadCsv } from "@/lib/csv";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Status = "todo" | "pass" | "fail";
type Case = { id: string; area: string; title: string; steps: string; to?: string };

const CASES: Case[] = [
  { id: "reg-1", area: "Registration", title: "Create an account", steps: "Sign up with name, email and member type, then confirm the email.", to: "/auth" },
  { id: "reg-2", area: "Registration", title: "Sign in and out", steps: "Sign in with the new account, refresh the page, then sign out.", to: "/auth" },
  { id: "prof-1", area: "Profile", title: "Complete the profile", steps: "Add age, qualification, skills, city and suburb, then save.", to: "/profile" },
  { id: "prof-2", area: "Profile", title: "Upload a profile photo", steps: "Choose a picture and check it shows on the profile and in chat.", to: "/profile" },
  { id: "trn-1", area: "Training", title: "Browse and open a module", steps: "Open Training, filter by provider (YES, SETA, UNICEF, NEMISA) and open a module.", to: "/training" },
  { id: "trn-2", area: "Training", title: "Enrol and finish a module", steps: "Enrol, complete the module and check the progress bar reaches 100%.", to: "/training" },
  { id: "cert-1", area: "Certificates", title: "Download a certificate", steps: "After completing a module, download the certificate from Certificates.", to: "/certificates" },
  { id: "cert-2", area: "Certificates", title: "Upload an existing certificate", steps: "Upload a PDF or photo with a title and check it lists correctly.", to: "/certificates" },
  { id: "job-1", area: "Jobs", title: "See auto-matched jobs", steps: "Open Jobs and check each vacancy shows a match score for your profile.", to: "/jobs" },
  { id: "job-2", area: "Jobs", title: "Apply for a job", steps: "Open a vacancy, apply with a cover note and check the status.", to: "/jobs" },
  { id: "job-3", area: "Jobs", title: "Post a vacancy (recruiter)", steps: "Sign in as a recruiter or caterer, post a job and see it appear live.", to: "/jobs" },
  { id: "chat-1", area: "Chat", title: "Send text and emoji", steps: "Start a chat and send a message; it must arrive instantly on a second device.", to: "/chat" },
  { id: "chat-2", area: "Chat", title: "Send media", steps: "Send a picture, a voice note, a PDF and a location.", to: "/chat" },
  { id: "chat-3", area: "Chat", title: "Read receipts and unread badge", steps: "Check ticks update and the unread badge clears when read.", to: "/chat" },
  { id: "reel-1", area: "Reels & Status", title: "Post a talent reel", steps: "Upload a short video with a title and skill tag.", to: "/reels" },
  { id: "reel-2", area: "Reels & Status", title: "Post a 24-hour status", steps: "Post a text or picture status and check it is visible to others.", to: "/status" },
  { id: "don-1", area: "Donors", title: "Make a test donation", steps: "Open Donors, choose a campaign and record a donation.", to: "/donors" },
  { id: "dev-1", area: "Devices", title: "Phone layout", steps: "Check every page fits a small phone screen without sideways scrolling." },
  { id: "dev-2", area: "Devices", title: "Install to home screen", steps: "Install the app from the browser menu on Android, iPhone and Windows." },
];

const STORE_KEY = "wrcan-uat-v1";
type Saved = Record<string, { status: Status; note: string }>;

type Check = { id: string; label: string; state: "idle" | "running" | "ok" | "fail"; detail?: string };

const CHECKS: { id: string; label: string; run: () => Promise<string> }[] = [
  {
    id: "backend",
    label: "Backend reachable",
    run: async () => {
      const { error } = await supabase.from("training_modules").select("id", { head: true, count: "exact" }).limit(1);
      if (error) throw new Error(error.message);
      return "Connected";
    },
  },
  {
    id: "modules",
    label: "Training modules loaded",
    run: async () => {
      const { count, error } = await supabase.from("training_modules").select("id", { count: "exact", head: true });
      if (error) throw new Error(error.message);
      if (!count) throw new Error("No modules found");
      return `${count} modules`;
    },
  },
  {
    id: "jobs",
    label: "Open vacancies loaded",
    run: async () => {
      const { count, error } = await supabase.from("jobs").select("id", { count: "exact", head: true });
      if (error) throw new Error(error.message);
      if (!count) throw new Error("No vacancies found");
      return `${count} vacancies`;
    },
  },
  {
    id: "impact",
    label: "Live statistics function",
    run: async () => {
      const { data, error } = await supabase.rpc("impact_stats");
      if (error) throw new Error(error.message);
      const members = (data as { members?: number } | null)?.members ?? 0;
      return `${members} members`;
    },
  },
  {
    id: "session",
    label: "Signed-in session",
    run: async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Not signed in");
      return data.session.user.email ?? "Signed in";
    },
  },
  {
    id: "realtime",
    label: "Real-time channel",
    run: () =>
      new Promise<string>((resolve, reject) => {
        const ch = supabase.channel(`uat-${Date.now()}`);
        const timer = setTimeout(() => {
          void supabase.removeChannel(ch);
          reject(new Error("Timed out"));
        }, 6000);
        ch.subscribe((s) => {
          if (s === "SUBSCRIBED") {
            clearTimeout(timer);
            void supabase.removeChannel(ch);
            resolve("Subscribed");
          } else if (s === "CHANNEL_ERROR") {
            clearTimeout(timer);
            void supabase.removeChannel(ch);
            reject(new Error("Channel error"));
          }
        });
      }),
  },
];

export function UatPanel() {
  const { user } = useAuth();
  const [saved, setSaved] = useState<Saved>({});
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [checks, setChecks] = useState<Check[]>(CHECKS.map((c) => ({ id: c.id, label: c.label, state: "idle" })));
  const [running, setRunning] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORE_KEY);
      if (raw) setSaved(JSON.parse(raw) as Saved);
    } catch {
      /* ignore corrupt storage */
    }
    setReady(true);
  }, []);

  const persist = useCallback((next: Saved) => {
    setSaved(next);
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(next));
    } catch {
      /* storage full or blocked */
    }
  }, []);

  const statusOf = (id: string): Status => saved[id]?.status ?? "todo";
  const setStatus = (id: string, status: Status) =>
    persist({ ...saved, [id]: { status, note: saved[id]?.note ?? "" } });
  const setNote = (id: string, note: string) =>
    persist({ ...saved, [id]: { status: saved[id]?.status ?? "todo", note } });

  const counts = useMemo(() => {
    const pass = CASES.filter((c) => statusOf(c.id) === "pass").length;
    const fail = CASES.filter((c) => statusOf(c.id) === "fail").length;
    return { pass, fail, todo: CASES.length - pass - fail };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);

  const percent = Math.round((counts.pass / CASES.length) * 100);
  const areas = useMemo(() => Array.from(new Set(CASES.map((c) => c.area))), []);

  const runChecks = async () => {
    setRunning(true);
    setChecks(CHECKS.map((c) => ({ id: c.id, label: c.label, state: "running" })));
    const results = await Promise.all(
      CHECKS.map(async (c): Promise<Check> => {
        try {
          return { id: c.id, label: c.label, state: "ok", detail: await c.run() };
        } catch (e) {
          return { id: c.id, label: c.label, state: "fail", detail: e instanceof Error ? e.message : "Failed" };
        }
      }),
    );
    setChecks(results);
    setRunning(false);
  };

  const exportCsv = () => {
    downloadCsv(
      `wrcan-uat-${new Date().toISOString().slice(0, 10)}.csv`,
      CASES.map((c) => ({
        area: c.area,
        test: c.title,
        steps: c.steps,
        result: statusOf(c.id),
        note: saved[c.id]?.note ?? "",
        tester: user?.email ?? "",
      })),
    );
  };

  const reset = () => persist({});

  return (
    <section aria-labelledby="uat-title" className="mt-2 mb-8">
      <Plate className="space-y-4">
        <div className="flex items-center gap-3">
          <FlaskConical className="h-6 w-6 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h2 id="uat-title" className="font-display rose-text text-sm font-semibold tracking-widest uppercase">
              UAT testing panel
            </h2>
            <p className="text-[0.7rem] text-muted-foreground">
              Walk through each scenario and mark it pass or fail before launch.
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-xl font-bold text-primary">{ready ? percent : 0}%</p>
            <p className="text-[0.6rem] tracking-widest text-muted-foreground uppercase">passed</p>
          </div>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={ready ? percent : 0} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${ready ? percent : 0}%` }} />
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg border border-border px-2 py-2"><b className="text-primary">{ready ? counts.pass : 0}</b> pass</div>
          <div className="rounded-lg border border-border px-2 py-2"><b className="text-destructive">{ready ? counts.fail : 0}</b> fail</div>
          <div className="rounded-lg border border-border px-2 py-2"><b>{ready ? counts.todo : CASES.length}</b> to do</div>
        </div>

        <div className="rounded-xl border border-border/70 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase"><Zap className="h-3.5 w-3.5 text-primary" /> Live system checks</h3>
            <button type="button" onClick={runChecks} disabled={running} className="rounded-full border border-primary/60 px-3 py-1 text-[0.65rem] tracking-widest text-primary uppercase disabled:opacity-50">
              {running ? "Running…" : "Run checks"}
            </button>
          </div>
          <ul className="space-y-1">
            {checks.map((c) => (
              <li key={c.id} className="flex items-center gap-2 text-xs">
                {c.state === "ok" ? <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> : c.state === "fail" ? <XCircle className="h-4 w-4 shrink-0 text-destructive" /> : <CircleDashed className={`h-4 w-4 shrink-0 text-muted-foreground ${c.state === "running" ? "animate-spin" : ""}`} />}
                <span className="flex-1">{c.label}</span>
                {c.detail ? <span className={c.state === "fail" ? "text-destructive" : "text-muted-foreground"}>{c.detail}</span> : null}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          {areas.map((area) => (
            <div key={area}>
              <h3 className="mb-1 text-[0.65rem] font-semibold tracking-widest text-muted-foreground uppercase">{area}</h3>
              <ul className="divide-y divide-border/60 rounded-xl border border-border/70">
                {CASES.filter((c) => c.area === area).map((c) => {
                  const st = ready ? statusOf(c.id) : "todo";
                  const isOpen = open === c.id;
                  return (
                    <li key={c.id}>
                      <button type="button" onClick={() => setOpen(isOpen ? null : c.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left" aria-expanded={isOpen}>
                        {st === "pass" ? <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> : st === "fail" ? <XCircle className="h-4 w-4 shrink-0 text-destructive" /> : <CircleDashed className="h-4 w-4 shrink-0 text-muted-foreground" />}
                        <span className="flex-1 text-sm">{c.title}</span>
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </button>
                      {isOpen ? (
                        <div className="space-y-2 px-3 pb-3">
                          <p className="text-xs text-muted-foreground">{c.steps}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            {c.to ? (
                              <Link to={c.to} className="rounded-full border border-border px-3 py-1 text-[0.65rem] tracking-widest uppercase">Open page</Link>
                            ) : null}
                            <button type="button" onClick={() => setStatus(c.id, "pass")} className={`rounded-full border px-3 py-1 text-[0.65rem] tracking-widest uppercase ${st === "pass" ? "border-primary bg-primary/15 text-primary" : "border-border"}`}>Pass</button>
                            <button type="button" onClick={() => setStatus(c.id, "fail")} className={`rounded-full border px-3 py-1 text-[0.65rem] tracking-widest uppercase ${st === "fail" ? "border-destructive bg-destructive/15 text-destructive" : "border-border"}`}>Fail</button>
                            <button type="button" onClick={() => setStatus(c.id, "todo")} className="rounded-full border border-border px-3 py-1 text-[0.65rem] tracking-widest uppercase">Clear</button>
                          </div>
                          <textarea
                            value={saved[c.id]?.note ?? ""}
                            onChange={(e) => setNote(c.id, e.target.value)}
                            placeholder="Notes: what happened, device, browser…"
                            rows={2}
                            className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-xs"
                          />
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <RoseButton type="button" onClick={exportCsv} className="!px-4 !py-2"><Download className="h-3.5 w-3.5" /> Export results</RoseButton>
          <RoseButton type="button" variant="outline" onClick={reset} className="!px-4 !py-2"><RotateCcw className="h-3.5 w-3.5" /> Reset</RoseButton>
        </div>
        <p className="text-center text-[0.6rem] text-muted-foreground">Results are saved on this device only. Export to share them.</p>
      </Plate>
    </section>
  );
}
