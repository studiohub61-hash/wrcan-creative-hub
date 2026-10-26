import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Check, ChevronRight, Circle, Clipboard, Download, ExternalLink, Headphones, Mic, MicOff, Play, Radio, Square, Users, Video, X } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { LivePulse } from "@/components/LiveBadge";
import { useAuth } from "@/hooks/useAuth";
import { useRoomPresence } from "@/hooks/useRoomPresence";
import studioImage from "@/assets/radio-studio.jpg";

export const Route = createFileRoute("/media-studio")({
  head: () => ({ meta: [
    { title: "Radio & Media Studio — WRCAN App" },
    { name: "description", content: "Practise radio presenting on camera, record a demo, and join a live video training room with other WRCAN students." },
    { property: "og:title", content: "Radio & Media Studio — WRCAN App" },
    { property: "og:description", content: "Radio presenting practice, video demos and live online training rooms for aspiring South African broadcasters." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: MediaStudioPage,
});

const SCRIPTS = [
  { title: "The opening link", length: "30 seconds", prompt: "Good morning, South Africa. You're tuned in to Wanda Radio. I'm your host, and coming up: the stories shaping our communities today. Stay with us.", focus: "Warmth · timing · clear station identification" },
  { title: "The community bulletin", length: "45 seconds", prompt: "Here's your community update. This week, local learners and job seekers are connecting with new training opportunities. If you have a story worth sharing, we want to hear from you. I'm your host, and this is Wanda Radio.", focus: "Clarity · pace · pronunciation" },
  { title: "The interview handover", length: "60 seconds", prompt: "Welcome back. Today we're speaking to a young creative about turning a passion for media into a career. Thank you for joining us. To start, tell us about the moment you knew broadcasting was for you.", focus: "Listening · introduction · open questions" },
];

const LESSONS = [
  { number: "01", title: "Find your on-air voice", description: "Breath control, articulation, mic distance and speaking with confidence.", icon: Mic },
  { number: "02", title: "Write for the ear", description: "Structure a short bulletin, opening link and interview introduction.", icon: Radio },
  { number: "03", title: "Present on camera", description: "Framing, eye line, body language and clear delivery for video.", icon: Video },
  { number: "04", title: "Produce a show", description: "Rundowns, cues, interviews, levels and handovers in a studio team.", icon: Headphones },
];

const roomUrl = (code: string) => `https://meet.jit.si/WRCANMediaStudio${code}`;
const validCode = (code: string) => /^[A-Z0-9]{6,24}$/.test(code);

function MediaStudioPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"practice" | "classroom">("practice");
  const [scriptIndex, setScriptIndex] = useState(0);
  const currentScript = SCRIPTS[scriptIndex] ?? SCRIPTS[0];
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [recording, setRecording] = useState(false);
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [activeCode, setActiveCode] = useState("");
  // Live roster of classmates in this room code (presence only — no media stored).
  const roomMembers = useRoomPresence(user && activeCode ? activeCode : null);
  const [copied, setCopied] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const clipRef = useRef<string | null>(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = streamRef.current;
  }, [cameraOn, tab]);

  useEffect(() => () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (clipRef.current) URL.revokeObjectURL(clipRef.current);
  }, []);

  const startCamera = async () => {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) { setError("Camera access is unavailable in this browser. Try a secure browser connection."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      stream.getAudioTracks().forEach((track) => { track.enabled = micOn; });
      setCameraOn(true);
    } catch {
      setError("Camera or microphone access was denied. Allow access in your browser and try again.");
    }
  };

  const stopCamera = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
    setRecording(false);
  };

  const toggleMic = () => {
    streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !micOn; });
    setMicOn((value) => !value);
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream || !window.MediaRecorder) { setError("Recording is not available in this browser."); return; }
    try {
      const mimeType = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      if (clipRef.current) URL.revokeObjectURL(clipRef.current);
      clipRef.current = null;
      setClipUrl(null);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        if (!chunksRef.current.length) return;
        const url = URL.createObjectURL(new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" }));
        clipRef.current = url;
        setClipUrl(url);
        setRecording(false);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setError("");
    } catch { setError("Recording could not start on this device."); }
  };

  const createRoom = () => {
    const generated = Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) => (byte % 36).toString(36).toUpperCase()).join("");
    setCode(generated);
    setActiveCode(generated);
    setError("");
  };

  const joinRoom = () => {
    const clean = code.trim().toUpperCase();
    if (!validCode(clean)) { setError("Enter a room code of 6–24 letters or numbers."); return; }
    setCode(clean);
    setActiveCode(clean);
    setError("");
  };

  const shareRoom = async () => {
    if (!activeCode) return;
    const text = `Join my WRCAN media training room. Code: ${activeCode}\n${roomUrl(activeCode)}`;
    try {
      if (navigator.share) await navigator.share({ title: "WRCAN media training room", text, url: roomUrl(activeCode) });
      else { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 2500); }
    } catch { setError("Sharing was cancelled or unavailable. You can copy the room code instead."); }
  };

  return (
    <Shell bare>
      <div className="pb-28">
        <div className="relative h-[390px] overflow-hidden sm:h-[450px]">
          <img src={studioImage} width={1536} height={1024} alt="Professional radio studio with microphones, headphones and a mixing desk" className="h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 px-6 pb-8">
            <Link to="/" className="text-xs font-semibold uppercase tracking-widest text-primary">WRCAN / The Empire</Link>
            <div className="mt-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary"><Radio className="size-4" /> Media academy</div>
            <h1 className="font-display mt-2 text-5xl font-semibold leading-none text-foreground sm:text-6xl">Your voice.<br /><span className="rose-text">On air.</span></h1>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-foreground/85">Step into the studio. Practise your delivery, record a showreel and meet your class on camera.</p>
          </div>
        </div>

        <div className="mx-auto max-w-2xl px-4">
          <div className="mt-3 grid grid-cols-2 border-b border-border" role="tablist" aria-label="Media studio views">
            <Button type="button" role="tab" aria-selected={tab === "practice"} variant="ghost" onClick={() => setTab("practice")} className={`h-12 rounded-none border-b-2 text-xs uppercase tracking-widest ${tab === "practice" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}><Mic /> Practice studio</Button>
            <Button type="button" role="tab" aria-selected={tab === "classroom"} variant="ghost" onClick={() => { stopCamera(); setTab("classroom"); setError(""); }} className={`h-12 rounded-none border-b-2 text-xs uppercase tracking-widest ${tab === "classroom" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}><Users /> Live classroom</Button>
          </div>

          {tab === "practice" ? <div role="tabpanel" className="pt-7">
            <div className="mb-5 flex items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-widest text-primary">01 / Practice</p><h2 className="font-display mt-1 text-3xl text-foreground">The presenter&apos;s desk</h2></div><span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Circle className="size-2 fill-primary text-primary" /> Private session</span></div>
            <div className="relative aspect-video overflow-hidden border border-border bg-card">
              {cameraOn ? <video ref={videoRef} autoPlay playsInline muted className="h-full w-full scale-x-[-1] object-cover" aria-label="Your camera preview" /> : <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground"><Camera className="size-10 text-primary" strokeWidth={1} /><p className="text-sm">Your studio preview</p><p className="text-xs">Only you can see this until you share a recording.</p></div>}
              {recording && <span className="absolute left-3 top-3 flex items-center gap-2 bg-background/85 px-3 py-2 text-xs font-bold uppercase tracking-widest text-destructive"><Circle className="size-3 animate-pulse fill-current" /> Recording</span>}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button type="button" onClick={cameraOn ? stopCamera : startCamera} variant={cameraOn ? "outline" : "default"} className="h-10">{cameraOn ? <CameraOff /> : <Camera />}{cameraOn ? "End preview" : "Start camera"}</Button>
              {cameraOn && <><Button type="button" size="icon" variant="outline" onClick={toggleMic} aria-label={micOn ? "Mute microphone" : "Unmute microphone"} title={micOn ? "Mute microphone" : "Unmute microphone"}>{micOn ? <Mic /> : <MicOff />}</Button><Button type="button" variant={recording ? "destructive" : "outline"} onClick={recording ? () => recorderRef.current?.stop() : startRecording}>{recording ? <Square /> : <Circle />}{recording ? "Stop recording" : "Record a take"}</Button></>}
            </div>
            {clipUrl && <div className="mt-5 border-t border-border pt-5"><h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">Your latest take</h3><video src={clipUrl} controls playsInline className="aspect-video w-full bg-card" /><a href={clipUrl} download={`wrcan-radio-demo.${recorderRef.current?.mimeType.includes("mp4") ? "mp4" : "webm"}`} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary"><Download className="size-4" /> Download recording</a><p className="mt-2 text-xs text-muted-foreground">Recordings stay on this device until you download them. They are not uploaded to WRCAN.</p></div>}
            <div className="mt-8 border-t border-border pt-6"><p className="text-xs font-semibold uppercase tracking-widest text-primary">Choose your exercise</p><div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">{SCRIPTS.map((script, index) => <Button key={script.title} type="button" variant={scriptIndex === index ? "default" : "outline"} onClick={() => setScriptIndex(index)} className="h-auto min-h-12 whitespace-normal px-3 py-3 text-left text-xs">{script.title}</Button>)}</div>{currentScript && <div className="mt-5 border-l-2 border-primary pl-4"><p className="text-xs uppercase tracking-widest text-muted-foreground">{currentScript.length} · {currentScript.focus}</p><blockquote className="font-display mt-3 text-2xl leading-snug text-foreground">“{currentScript.prompt}”</blockquote></div>}</div>
          </div> : <div role="tabpanel" className="pt-7"><p className="text-xs font-semibold uppercase tracking-widest text-primary">02 / Live session</p><h2 className="font-display mt-1 text-3xl text-foreground">The online classroom</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Create a shareable room and send its code to your class, or enter the code your host gave you. Your camera and microphone controls appear when you join.</p>
            {!user ? <div className="mt-6 border-t border-border py-6"><p className="mb-4 text-sm text-foreground">Sign in to join a video session with your classmates.</p><Button asChild><Link to="/auth">Sign in to WRCAN <ChevronRight /></Link></Button></div> : <>
              {!activeCode ? <div className="mt-6 space-y-4 border-t border-border py-6"><Button type="button" onClick={createRoom} className="w-full h-12"><Video /> Create a room</Button><div className="flex items-center gap-3 text-xs uppercase tracking-widest text-muted-foreground"><span className="h-px flex-1 bg-border" /> or join a room <span className="h-px flex-1 bg-border" /></div><label className="block text-xs font-semibold uppercase tracking-widest text-primary" htmlFor="room-code">Room code</label><div className="flex gap-2"><input id="room-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 24))} placeholder="Enter code" autoComplete="off" className="min-w-0 flex-1 border border-input bg-card px-4 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" /><Button type="button" onClick={joinRoom}>Join <ChevronRight /></Button></div></div> : <div className="mt-6"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-widest text-muted-foreground">Room code</p><strong className="font-mono text-lg tracking-widest text-primary">{activeCode}</strong></div><div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={shareRoom}>{copied ? <Check /> : <Clipboard />}{copied ? "Copied" : "Invite"}</Button><Button type="button" variant="outline" size="icon" onClick={() => { setActiveCode(""); setCode(""); }} aria-label="Leave room" title="Leave room"><X /></Button></div></div><div className="mb-3 flex flex-wrap items-center gap-2"><LivePulse>{roomMembers.length} in this room now</LivePulse>{roomMembers.length > 0 ? <span className="truncate text-xs text-muted-foreground">{roomMembers.map((member) => member.name).join(", ")}</span> : null}</div><div className="aspect-video min-h-[300px] overflow-hidden border border-border bg-card sm:min-h-[390px]"><iframe key={activeCode} src={roomUrl(activeCode)} title="Live WRCAN media training video call" allow="camera; microphone; display-capture; fullscreen; autoplay" className="h-full w-full" referrerPolicy="strict-origin-when-cross-origin" /></div><a href={roomUrl(activeCode)} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-primary"><ExternalLink className="size-4" /> Open call in a new tab if it does not load here</a><p className="mt-3 text-xs text-muted-foreground">Calls are hosted by Jitsi Meet. Anyone with your room code can join; share it only with your class. Jitsi may ask you to sign in to start a new room.</p></div>}
            </>}
          </div>}

          {error && <p role="alert" className="mt-4 border-l-2 border-destructive px-3 py-2 text-sm text-destructive">{error}</p>}
          <section className="mt-12 border-t border-border pt-8"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-widest text-primary">The syllabus</p><h2 className="font-display mt-1 text-3xl text-foreground">From mic to media</h2></div><span className="text-xs text-muted-foreground">4 foundations</span></div><div className="divide-y divide-border">{LESSONS.map(({ number, title, description, icon: Icon }) => <div key={number} className="flex items-start gap-4 py-5"><span className="font-display w-8 shrink-0 text-xl text-primary">{number}</span><Icon className="mt-1 size-5 shrink-0 text-primary" strokeWidth={1.5} /><div><h3 className="font-display text-xl text-foreground">{title}</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p></div></div>)}</div><p className="mt-4 text-xs leading-relaxed text-muted-foreground">Independent practice inspired by broadcast workflows. This demo is not affiliated with SABC and does not issue an accredited qualification.</p></section>
          <div className="mt-9 flex items-center gap-3 border-t border-border pt-6 text-sm text-muted-foreground"><Play className="size-4 shrink-0 text-primary" /><span>Ready for more? Explore the full training catalogue.</span><Link to="/training" className="ml-auto shrink-0 font-semibold text-primary">Training →</Link></div>
        </div>
      </div>
    </Shell>
  );
}