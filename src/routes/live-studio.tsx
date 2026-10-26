import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft, BellRing, Camera, CameraOff, Check, ChevronDown, ChevronUp, Circle, Clapperboard,
  Coffee, Gauge, Hand, Heart, ImagePlus, Mic, MicOff, MessageSquare, MonitorUp, Pause, Play,
  Radio, Send, Sparkles, ThumbsUp, Timer, Upload, UserPlus, Users, Wifi, X, BarChart3,
} from "lucide-react";
import logoUrl from "@/assets/wrcan-logo.png";
import { Button } from "@/components/ui/button";
import { usePresence } from "@/hooks/usePresence";

export const Route = createFileRoute("/live-studio")({
  head: () => ({
    meta: [
      { title: "Media House Hub — Wanda Live Studio" },
      { name: "description", content: "Train as a radio presenter, actor, vlogger or producer in Wanda's interactive Media House Hub." },
      { property: "og:title", content: "Wanda Media House Hub" },
      { property: "og:description", content: "Professional hands-on media training desks for presenters, actors, vloggers and producers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LiveStudio,
});

type Scene = "Presenter" | "Interview" | "Panel" | "Screen share" | "Break";
const SCENES: Scene[] = ["Presenter", "Interview", "Panel", "Screen share", "Break"];
type P = { id: number; name: string; hand: boolean; muted: boolean; stage: boolean };
type Q = { id: number; text: string; votes: number; answered: boolean };
type Desk = "radio" | "prompter" | "vlogger" | "producer";
type VloggerAlert = { id: number; icon: "heart" | "comment" | "follow"; text: string };

const DESKS: { id: Desk; title: string; short: string; icon: typeof Radio }[] = [
  { id: "radio", title: "Radio Presenter Desk", short: "Radio", icon: Radio },
  { id: "prompter", title: "TV / Actor Prompter", short: "Prompter", icon: Clapperboard },
  { id: "vlogger", title: "Vlogger Engagement Sim", short: "Vlogger", icon: BellRing },
  { id: "producer", title: "Producer Booth", short: "Producer", icon: ImagePlus },
];

const PROMPTER_SCRIPT = `Good evening, South Africa, and welcome to Wanda Tonight.\n\nOur top story: young creators across the country are turning practical media skills into new careers.\n\nTonight we meet the voices, presenters and producers shaping a more connected future.\n\nStay with us for interviews, community stories and opportunities you can act on today.\n\nI'm your presenter. This is Wanda Tonight.`;
const WAVE_HEIGHTS = ["h-3", "h-7", "h-5", "h-9", "h-4", "h-8", "h-6", "h-10", "h-5", "h-7", "h-3", "h-8", "h-4", "h-6"];

const KEY = "wanda-live-studio";
const initialPeople: P[] = [
  { id: 1, name: "Thandi Mokoena", hand: true, muted: false, stage: false },
  { id: 2, name: "Edward Sithole", hand: false, muted: true, stage: false },
  { id: 3, name: "Lerato Dlamini", hand: true, muted: false, stage: false },
  { id: 4, name: "Sipho Ndlovu", hand: false, muted: false, stage: false },
  { id: 5, name: "Ayanda Khumalo", hand: false, muted: true, stage: false },
];

function LiveStudio() {
  const { onlineCount } = usePresence();
  const [preview, setPreview] = useState<Scene>("Presenter");
  const [program, setProgram] = useState<Scene>("Break");
  const [fade, setFade] = useState(false);
  const [live, setLive] = useState(false);
  const [rec, setRec] = useState(false);
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [overlay, setOverlay] = useState({ lower: true, logo: true, captions: false, timer: false });
  const [lowerName, setLowerName] = useState("Wanda Facilitator");
  const [tab, setTab] = useState<"people" | "chat" | "qa" | "poll">("people");
  const [people, setPeople] = useState<P[]>(initialPeople);
  const [chat, setChat] = useState<{ who: string; text: string }[]>([
    { who: "Thandi", text: "Good morning from Soweto!" },
    { who: "Sipho", text: "Audio is clear 👍" },
  ]);
  const [msg, setMsg] = useState("");
  const [qs, setQs] = useState<Q[]>([
    { id: 1, text: "How do I get my SETA certificate?", votes: 4, answered: false },
    { id: 2, text: "Is there radio training in Durban?", votes: 2, answered: false },
  ]);
  const [poll, setPoll] = useState<{ q: string; opts: { t: string; v: number }[]; live: boolean }>({
    q: "Which skill should we cover next?", opts: [{ t: "Interviews", v: 0 }, { t: "CV writing", v: 0 }, { t: "Radio voice", v: 0 }], live: false,
  });
  const [rooms, setRooms] = useState<string[][] | null>(null);
  const [secs, setSecs] = useState(0);
  const [ai, setAi] = useState("");
  const [aiLog, setAiLog] = useState<string[]>([]);
  const [toast, setToast] = useState("");
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [desk, setDesk] = useState<Desk>("radio");
  const [radioOn, setRadioOn] = useState(false);
  const [radioMuted, setRadioMuted] = useState(false);
  const [prompterRunning, setPrompterRunning] = useState(false);
  const [prompterSpeed, setPrompterSpeed] = useState(2);
  const [vloggerAlerts, setVloggerAlerts] = useState<VloggerAlert[]>([]);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverName, setCoverName] = useState("Wanda Evening Drive");
  const [dragging, setDragging] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const prompterRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<string | null>(null);
  const alertIdRef = useRef(0);

  const say = (t: string) => { setToast(t); setTimeout(() => setToast(""), 2200); };

  // persistence
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (s) { setPreview(s.preview); setOverlay(s.overlay); setChat(s.chat); setLowerName(s.lowerName); }
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify({ preview, overlay, chat: chat.slice(-30), lowerName }));
  }, [preview, overlay, chat, lowerName]);

  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [live]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream, program]);
  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream]);

  useEffect(() => {
    if (!prompterRunning) return;
    const timer = window.setInterval(() => {
      const element = prompterRef.current;
      if (!element) return;
      element.scrollTop += prompterSpeed;
      if (element.scrollTop + element.clientHeight >= element.scrollHeight - 2) {
        element.scrollTop = 0;
      }
    }, 45);
    return () => window.clearInterval(timer);
  }, [prompterRunning, prompterSpeed]);

  useEffect(() => () => {
    if (coverRef.current) URL.revokeObjectURL(coverRef.current);
  }, []);

  const toggleCam = async () => {
    if (cam) { stream?.getTracks().forEach((t) => t.stop()); setStream(null); setCam(false); return; }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      setStream(s); setCam(true);
    } catch { say("Camera not available — showing a placeholder"); }
  };

  const take = () => {
    setFade(true);
    setTimeout(() => { setProgram(preview); setFade(false); }, 250);
    say(`${preview} is now live on program`);
  };

  // keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.code === "Space") { e.preventDefault(); take(); }
      if (e.key === "r") setRec((r) => !r);
      if (e.key === "m") setMic((m) => !m);
      if (e.key === "c") toggleCam();
      if (e.key === "b") setPreview("Break");
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const runAi = (cmd: string) => {
    const c = cmd.toLowerCase();
    let r = "Suggestion: try “interview layout”, “lower third”, “start a poll”, “break screen” or “summarize”.";
    if (c.includes("interview")) { setPreview("Interview"); r = "Interview layout placed in Preview. Press Take live when ready."; }
    else if (c.includes("speaker") || c.includes("presenter")) { setPreview("Presenter"); r = "Presenter scene placed in Preview."; }
    else if (c.includes("lower")) { setOverlay((o) => ({ ...o, lower: true })); r = `Lower third switched on for “${lowerName}”.`; }
    else if (c.includes("poll")) { setTab("poll"); r = "Poll panel opened — edit and launch it."; }
    else if (c.includes("break")) { setPreview("Break"); r = "Break screen placed in Preview."; }
    else if (c.includes("summar")) { r = `Summary: ${people.length} attendees, ${chat.length} chat messages, ${qs.filter((q) => q.answered).length}/${qs.length} questions answered, ${Math.floor(secs / 60)} min live.`; }
    setAiLog((l) => [`${cmd} → ${r}`, ...l].slice(0, 5));
    setAi("");
  };

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const onStage = people.filter((p) => p.stage);
  const totalVotes = poll.opts.reduce((a, o) => a + o.v, 0) || 1;

  const triggerVloggerAlert = (kind: VloggerAlert["icon"]) => {
    const content = {
      heart: "Nomsa and 24 others liked your live",
      comment: "Thabo: This is powerful — keep going!",
      follow: "12 new viewers followed your channel",
    }[kind];
    const id = ++alertIdRef.current;
    setVloggerAlerts((items) => [...items.slice(-2), { id, icon: kind, text: content }]);
    window.setTimeout(() => setVloggerAlerts((items) => items.filter((item) => item.id !== id)), 4200);
  };

  const loadCover = (file?: File) => {
    if (!file || !file.type.startsWith("image/")) { say("Choose a JPG, PNG or WebP cover image"); return; }
    if (coverRef.current) URL.revokeObjectURL(coverRef.current);
    const nextUrl = URL.createObjectURL(file);
    coverRef.current = nextUrl;
    setCoverUrl(nextUrl);
    setCoverName(file.name.replace(/\.[^.]+$/, "") || "Now playing");
    setDragging(false);
    say("Cover art is now playing");
  };

  const Canvas = ({ scene, small }: { scene: Scene; small?: boolean }) => (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-card">
      {scene === "Break" ? (
        <div className="flex h-full flex-col items-center justify-center gap-2">
          <img src={logoUrl} alt="" className={small ? "h-8" : "h-20"} />
          <p className={`rose-text font-display ${small ? "text-xs" : "text-2xl"}`}>We'll be right back</p>
        </div>
      ) : (
        <div className={`grid h-full gap-1 p-1 ${scene === "Interview" || scene === "Screen share" ? "grid-cols-2" : scene === "Panel" ? "grid-cols-2 grid-rows-2" : ""}`}>
          {scene === "Screen share" ? (
            <div className="flex items-center justify-center rounded bg-muted text-xs text-muted-foreground"><MonitorUp className="mr-1 h-4 w-4" />Shared screen</div>
          ) : null}
          {Array.from({ length: scene === "Panel" ? 4 : scene === "Interview" ? 2 : 1 }).map((_, i) => (
            <div key={i} className="relative flex items-center justify-center overflow-hidden rounded bg-muted">
              {i === 0 && cam && !small ? (
                <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs text-muted-foreground">{i === 0 ? "You" : onStage[i - 1]?.name ?? `Guest ${i}`}</span>
              )}
            </div>
          ))}
        </div>
      )}
      {!small && overlay.logo && <img src={logoUrl} alt="" className="absolute top-2 right-2 h-8 opacity-90" />}
      {!small && overlay.lower && scene !== "Break" && (
        <div className="rose-metal absolute bottom-3 left-3 rounded px-3 py-1 text-xs font-semibold">{lowerName}</div>
      )}
      {!small && overlay.captions && <div className="absolute inset-x-0 bottom-10 text-center text-xs text-foreground"><span className="bg-background/80 px-2">Welcome to today's Wanda session…</span></div>}
      {!small && overlay.timer && <div className="absolute top-2 left-2 rounded bg-background/80 px-2 text-xs text-primary">{fmt(secs)}</div>}
      {!small && vloggerAlerts.length > 0 && (
        <div className="absolute right-3 bottom-3 z-10 w-[min(85%,18rem)] space-y-2" aria-live="polite">
          {vloggerAlerts.map((item) => (
            <div key={item.id} className="flex items-center gap-2 rounded-md border border-primary/50 bg-background/90 px-3 py-2 text-xs shadow-lg backdrop-blur">
              {item.icon === "heart" ? <Heart className="size-4 fill-destructive text-destructive" /> : item.icon === "comment" ? <MessageSquare className="size-4 text-primary" /> : <UserPlus className="size-4 text-primary" />}
              <span className="flex-1">{item.text}</span>
              <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => setVloggerAlerts((items) => items.filter((alert) => alert.id !== item.id))} aria-label="Dismiss alert"><X /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const Btn = ({ on, onClick, children, label }: { on?: boolean; onClick: () => void; children: React.ReactNode; label: string }) => (
    <Button type="button" title={label} aria-label={label} onClick={onClick} variant={on ? "default" : "outline"}
      className="h-9 rounded-full px-3 text-xs">
      {children}
    </Button>
  );

  const DeskControls = () => (
    <section className="glass-plate rounded-xl border border-primary/20 p-4" aria-label={`${DESKS.find((item) => item.id === desk)?.title} controls`}>
      {desk === "radio" && (
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-primary">Radio Presenter Desk</p>
            <h2 className="font-display mt-1 text-xl">Voice control</h2>
            <div className="mt-4 flex h-12 items-end gap-1 rounded-md border border-border bg-background/50 p-2" aria-label={radioOn && !radioMuted ? "Sound wave active" : "Sound wave idle"}>
              {WAVE_HEIGHTS.map((height, index) => <span key={index} className={`w-full rounded-sm bg-primary transition-all ${height} ${radioOn && !radioMuted ? "animate-pulse" : "opacity-25"}`} />)}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 md:w-52 md:flex-col">
            <Button type="button" variant={radioOn ? "destructive" : "outline"} className="h-11 flex-1 border-2 md:w-full" onClick={() => setRadioOn((value) => !value)}><Radio />{radioOn ? "ON AIR" : "Go on air"}</Button>
            <Button type="button" variant="outline" className="h-11 flex-1 border-2 md:w-full" onClick={() => setRadioMuted((value) => !value)}>{radioMuted ? <MicOff /> : <Mic />}{radioMuted ? "Mic muted" : "Mic live"}</Button>
          </div>
        </div>
      )}
      {desk === "prompter" && (
        <div className="grid gap-4 md:grid-cols-[1fr_220px]">
          <div ref={prompterRef} className="h-44 overflow-y-auto rounded-md border-2 border-primary/30 bg-background/70 px-5 py-12 text-center font-display text-xl leading-relaxed scroll-smooth">
            <div className="whitespace-pre-line">{PROMPTER_SCRIPT}</div>
            <div className="h-32" />
          </div>
          <div className="space-y-3 rounded-md border border-border p-3">
            <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-primary">Prompter speed</p>
            <Button type="button" variant={prompterRunning ? "default" : "outline"} className="h-11 w-full border-2" onClick={() => setPrompterRunning((value) => !value)}>{prompterRunning ? <Pause /> : <Play />}{prompterRunning ? "Pause script" : "Roll script"}</Button>
            <div className="grid grid-cols-[40px_1fr_40px] items-center gap-2">
              <Button type="button" size="icon" variant="outline" onClick={() => setPrompterSpeed((value) => Math.max(1, value - 1))} aria-label="Slower prompter"><ChevronDown /></Button>
              <span className="text-center text-xs"><Gauge className="mr-1 inline size-4 text-primary" />Speed {prompterSpeed}</span>
              <Button type="button" size="icon" variant="outline" onClick={() => setPrompterSpeed((value) => Math.min(5, value + 1))} aria-label="Faster prompter"><ChevronUp /></Button>
            </div>
          </div>
        </div>
      )}
      {desk === "vlogger" && (
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-primary">Vlogger Engagement Sim</p>
          <h2 className="font-display mt-1 text-xl">Test audience reactions</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <Button type="button" variant="outline" className="h-12 border-2" onClick={() => triggerVloggerAlert("heart")}><Heart />Trigger likes</Button>
            <Button type="button" variant="outline" className="h-12 border-2" onClick={() => triggerVloggerAlert("comment")}><MessageSquare />Trigger comment</Button>
            <Button type="button" variant="outline" className="h-12 border-2" onClick={() => triggerVloggerAlert("follow")}><UserPlus />Trigger followers</Button>
          </div>
        </div>
      )}
      {desk === "producer" && (
        <div className="grid gap-4 sm:grid-cols-[1fr_240px]">
          <div onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); loadCover(event.dataTransfer.files[0]); }} className={`flex min-h-40 flex-col items-center justify-center rounded-md border-2 border-dashed p-5 text-center transition-colors ${dragging ? "border-primary bg-primary/10" : "border-border bg-background/40"}`}>
            <Upload className="size-7 text-primary" />
            <p className="mt-2 text-sm font-semibold">Drop cover art here</p>
            <p className="mt-1 text-xs text-muted-foreground">JPG, PNG or WebP stays on this device</p>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => loadCover(event.target.files?.[0])} />
            <Button type="button" variant="outline" className="mt-3 border-2" onClick={() => fileRef.current?.click()}><ImagePlus />Browse files</Button>
          </div>
          <div className="overflow-hidden rounded-md border border-primary/40 bg-card shadow-lg">
            <div className="aspect-square bg-muted">
              {coverUrl ? <img src={coverUrl} alt="Now playing cover art" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><img src={logoUrl} alt="Wanda placeholder cover" className="h-20 opacity-70" /></div>}
            </div>
            <div className="p-3"><p className="text-[0.6rem] uppercase tracking-widest text-primary">Now playing</p><p className="mt-1 truncate font-display text-lg">{coverName}</p></div>
          </div>
        </div>
      )}
    </section>
  );

  return (
    <div className="gold-pattern min-h-screen text-foreground">
      <div className="mx-auto max-w-[1500px] space-y-3 p-3">
        <header className="glass-plate flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2">
          <div className="flex items-center gap-2">
            <Link to="/" aria-label="Back home"><ArrowLeft className="h-5 w-5 text-primary" /></Link>
            <img src={logoUrl} alt="Wanda" className="h-8" />
            <h1 className="font-display rose-text text-lg font-semibold uppercase tracking-wide">Media House Hub</h1>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {onlineCount > 0 ? (
              <span className="flex items-center gap-1 text-muted-foreground" title="Creators online in the Media House right now">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                {onlineCount} online
              </span>
            ) : (
              <span className="flex items-center gap-1 text-muted-foreground"><Wifi className="h-4 w-4 text-primary" />Good</span>
            )}
            <span className="flex items-center gap-1 text-muted-foreground"><Timer className="h-4 w-4" />{fmt(secs)}</span>
            {rec && <span className="balloon-red rounded-full px-2 py-0.5">● REC</span>}
            {live ? <span className="balloon-red rounded-full px-2 py-0.5">LIVE</span> : <span className="text-muted-foreground">Studio ready</span>}
          </div>
        </header>

        <div className="grid gap-3 xl:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            <div className="grid gap-3 lg:grid-cols-[210px_1fr]">
              <nav className="glass-plate rounded-xl border border-primary/20 p-2" aria-label="Training control desks">
                <p className="mb-2 px-2 text-[0.6rem] font-semibold uppercase tracking-widest text-muted-foreground">Training control desks</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1">
                  {DESKS.map(({ id, title, short, icon: Icon }, index) => (
                    <Button key={id} type="button" variant={desk === id ? "default" : "outline"} onClick={() => setDesk(id)} className="h-auto min-h-16 justify-start whitespace-normal border-2 px-3 py-3 text-left" aria-label={title} aria-pressed={desk === id}>
                      <span className="flex size-7 shrink-0 items-center justify-center rounded border border-current/30"><Icon /></span>
                      <span><span className="block text-[0.6rem] opacity-70">0{index + 1}</span><span className="hidden leading-tight sm:block">{title}</span><span className="leading-tight sm:hidden">{short}</span></span>
                    </Button>
                  ))}
                </div>
              </nav>
              <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
                <div className="glass-plate rounded-xl p-2">
                <p className="mb-1 text-[0.6rem] uppercase tracking-widest text-muted-foreground">Preview</p>
                <Canvas scene={preview} small />
                  <Button type="button" onClick={take} className="mt-2 w-full rounded-full text-xs uppercase tracking-widest">Take live (Space)</Button>
                </div>
                <div className={`glass-plate rounded-xl p-2 transition-opacity duration-200 ${fade ? "opacity-30" : ""}`}>
                  <p className="mb-1 text-[0.6rem] uppercase tracking-widest text-primary">Program · live output</p>
                  <Canvas scene={program} />
                </div>
              </div>
            </div>

            <DeskControls />

            <div className="glass-plate flex flex-wrap items-center gap-2 rounded-xl p-2">
              <Btn label="Microphone (M)" on={mic} onClick={() => setMic(!mic)}>{mic ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}</Btn>
              <Btn label="Camera (C)" on={cam} onClick={toggleCam}>{cam ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}</Btn>
              <Btn label="Record (R)" on={rec} onClick={() => setRec(!rec)}><Circle className="h-4 w-4" />Record</Btn>
              <Btn label="Breakout rooms" onClick={() => {
                const r: string[][] = [[], []]; people.forEach((p, i) => r[i % 2]?.push(p.name)); setRooms(r);
              }}><Users className="h-4 w-4" />Breakouts</Btn>
              <div className="ml-auto flex gap-2">
                <Btn label="Go live" on={live} onClick={() => { setLive(!live); say(live ? "Stream paused" : "You are live (practice mode)"); }}><Radio className="h-4 w-4" />{live ? "Pause" : "Go live"}</Btn>
                <Btn label="End session" onClick={() => setConfirmEnd(true)}><X className="h-4 w-4" />End</Btn>
              </div>
            </div>

            <div className="glass-plate grid grid-cols-3 gap-2 rounded-xl p-2 sm:grid-cols-5">
              {SCENES.map((s) => (
                <button key={s} onClick={() => setPreview(s)} className={`rounded-lg border p-1 text-left ${preview === s ? "border-primary" : "border-border"} ${program === s ? "ring-2 ring-destructive" : ""}`}>
                  <div className="flex aspect-video items-center justify-center rounded bg-muted">
                    {s === "Break" ? <Coffee className="h-4 w-4 text-primary" /> : s === "Screen share" ? <MonitorUp className="h-4 w-4 text-primary" /> : <Users className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="mt-1 text-[0.65rem]">{s}</p>
                </button>
              ))}
            </div>

            <div className="glass-plate rounded-xl p-3">
              <p className="mb-2 text-[0.6rem] uppercase tracking-widest text-muted-foreground">Scene settings</p>
              <div className="flex flex-wrap gap-2">
                {(["lower", "logo", "captions", "timer"] as const).map((k) => (
                  <Btn key={k} label={k} on={overlay[k]} onClick={() => setOverlay({ ...overlay, [k]: !overlay[k] })}>
                    {{ lower: "Lower third", logo: "Logo", captions: "Captions", timer: "Timer" }[k]}
                  </Btn>
                ))}
                <input value={lowerName} onChange={(e) => setLowerName(e.target.value)} className="rose-plate h-9 rounded-full px-3 text-xs outline-none" aria-label="Lower third text" />
              </div>
            </div>

            <div className="glass-plate rounded-xl p-3">
              <form onSubmit={(e) => { e.preventDefault(); if (ai.trim()) runAi(ai.trim()); }} className="flex gap-2">
                <Sparkles className="mt-2 h-4 w-4 text-primary" />
                <input value={ai} onChange={(e) => setAi(e.target.value)} placeholder="Ask Wanda to prepare the studio…" className="rose-plate h-9 flex-1 rounded-full px-3 text-xs outline-none" />
              </form>
              <div className="mt-2 flex flex-wrap gap-1">
                {["Create an interview layout", "Show the current speaker", "Add a lower third", "Start a poll", "Prepare a break screen", "Summarize this session"].map((c) => (
                  <button key={c} onClick={() => runAi(c)} className="rounded-full border border-border px-2 py-1 text-[0.65rem] hover:bg-accent">{c}</button>
                ))}
              </div>
              {aiLog.length > 0 && (
                <ul className="mt-2 space-y-1 text-[0.7rem] text-muted-foreground">
                  {aiLog.map((l, i) => <li key={i}>✦ {l}</li>)}
                </ul>
              )}
              <p className="mt-1 text-[0.6rem] text-muted-foreground">Assistant suggestions are rule-based helpers for practice.</p>
            </div>
          </div>

          <aside className="glass-plate flex flex-col rounded-xl p-2 lg:max-h-[calc(100vh-90px)]">
            <div className="grid grid-cols-4 gap-1">
              {([["people", Users], ["chat", MessageSquare], ["qa", Hand], ["poll", BarChart3]] as const).map(([k, I]) => (
                <button key={k} onClick={() => setTab(k)} aria-label={k} className={`flex justify-center rounded-md py-2 ${tab === k ? "rose-metal" : "text-muted-foreground"}`}><I className="h-4 w-4" /></button>
              ))}
            </div>
            <div className="mt-2 flex-1 space-y-2 overflow-y-auto text-xs">
              {tab === "people" && (<>
                <p className="text-muted-foreground">{people.length} attending · {people.filter((p) => p.hand).length} hands raised</p>
                {people.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 rounded-lg bg-card/60 p-2">
                    <span className="flex-1 truncate">{p.name}{p.stage ? " · on stage" : ""}</span>
                    {p.hand && <Hand className="h-4 w-4 text-primary" />}
                    <button title="Mute" onClick={() => setPeople(people.map((x) => x.id === p.id ? { ...x, muted: !x.muted } : x))}>{p.muted ? <MicOff className="h-4 w-4 text-muted-foreground" /> : <Mic className="h-4 w-4" />}</button>
                    <button title="Promote to stage" onClick={() => { setPeople(people.map((x) => x.id === p.id ? { ...x, stage: !x.stage, hand: false } : x)); say(`${p.name} ${p.stage ? "left" : "joined"} the stage`); }}><UserPlus className="h-4 w-4 text-primary" /></button>
                    <button title="Remove" onClick={() => setPeople(people.filter((x) => x.id !== p.id))}><X className="h-4 w-4 text-destructive" /></button>
                  </div>
                ))}
              </>)}
              {tab === "chat" && (<>
                {chat.map((c, i) => <p key={i}><b className="text-primary">{c.who}:</b> {c.text}</p>)}
                <form onSubmit={(e) => { e.preventDefault(); if (msg.trim()) { setChat([...chat, { who: "You", text: msg.trim() }]); setMsg(""); } }} className="flex gap-1 pt-2">
                  <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Message" className="rose-plate h-8 flex-1 rounded-full px-3 outline-none" />
                  <button aria-label="Send" className="rose-metal rounded-full px-2"><Send className="h-4 w-4" /></button>
                </form>
              </>)}
              {tab === "qa" && [...qs].sort((a, b) => b.votes - a.votes).map((q) => (
                <div key={q.id} className={`rounded-lg bg-card/60 p-2 ${q.answered ? "opacity-50" : ""}`}>
                  <p>{q.text}</p>
                  <div className="mt-1 flex gap-2">
                    <button onClick={() => setQs(qs.map((x) => x.id === q.id ? { ...x, votes: x.votes + 1 } : x))} className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" />{q.votes}</button>
                    <button onClick={() => setQs(qs.map((x) => x.id === q.id ? { ...x, answered: true } : x))} className="flex items-center gap-1"><Check className="h-3 w-3" />Answered</button>
                    <button onClick={() => { setLowerName(q.text); setOverlay({ ...overlay, lower: true }); say("Question shown on stage"); }} className="text-primary">Show on stage</button>
                  </div>
                </div>
              ))}
              {tab === "poll" && (<>
                <input value={poll.q} onChange={(e) => setPoll({ ...poll, q: e.target.value })} className="rose-plate h-8 w-full rounded-full px-3 outline-none" />
                {poll.opts.map((o, i) => (
                  <div key={i}>
                    <div className="flex gap-1">
                      <input value={o.t} onChange={(e) => setPoll({ ...poll, opts: poll.opts.map((x, j) => j === i ? { ...x, t: e.target.value } : x) })} className="flex-1 rounded border border-border bg-transparent px-2 py-1" />
                      {poll.live && <button onClick={() => setPoll({ ...poll, opts: poll.opts.map((x, j) => j === i ? { ...x, v: x.v + 1 } : x) })} className="text-primary">Vote</button>}
                    </div>
                    {poll.live && <div className="mt-1 h-2 rounded bg-muted"><div className="rose-metal h-2 rounded transition-all" style={{ width: `${(o.v / totalVotes) * 100}%` }} /></div>}
                  </div>
                ))}
                <div className="flex gap-2">
                  <button onClick={() => setPoll({ ...poll, opts: [...poll.opts, { t: "New option", v: 0 }] })} className="text-primary">+ Option</button>
                  <button onClick={() => { setPoll({ ...poll, live: true, opts: poll.opts.map((o) => ({ ...o, v: Math.floor(Math.random() * 8) })) }); say("Poll launched"); }} className="rose-metal ml-auto rounded-full px-3 py-1">Launch</button>
                </div>
              </>)}
            </div>
          </aside>
        </div>
        <p className="text-center text-[0.6rem] text-muted-foreground">Practice studio · shortcuts: Space take live · R record · M mic · C camera · B break. For real group calls use the Media Studio live classroom.</p>
      </div>

      {rooms && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <div className="glass-plate w-full max-w-sm rounded-xl p-4">
            <h2 className="font-display rose-text text-lg">Breakout rooms</h2>
            {rooms.map((r, i) => <p key={i} className="mt-2 text-xs"><b className="text-primary">Room {i + 1}:</b> {r.join(", ")}</p>)}
            <button onClick={() => setRooms(null)} className="rose-metal mt-4 w-full rounded-full py-2 text-xs uppercase">Close rooms</button>
          </div>
        </div>
      )}
      {confirmEnd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <div className="glass-plate w-full max-w-sm rounded-xl p-4 text-center">
            <p className="text-sm">End this session for everyone?</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setConfirmEnd(false)} className="flex-1 rounded-full border border-border py-2 text-xs">Cancel</button>
              <button onClick={() => { setLive(false); setRec(false); setSecs(0); setProgram("Break"); setConfirmEnd(false); say("Session ended"); }} className="balloon-red flex-1 rounded-full py-2 text-xs">End session</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="balloon-red fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-xs">{toast}</div>}
    </div>
  );
}
