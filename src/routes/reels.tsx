import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, Download, Eye, Forward, Heart, Loader2, Share2, Trash2, Upload, Volume2, VolumeX } from "lucide-react";
import { ShareSheet } from "@/components/ShareSheet";
import logoUrl from "@/assets/wrcan-logo.png";
import { Shell } from "@/components/Shell";
import { Field, Plate, RoseButton, areaClass, inputClass } from "@/components/EmpireUI";
import { UserAvatar } from "@/components/Avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { compressImage, signedUrl } from "@/lib/media";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/reels")({
  head: () => ({
    meta: [
      { title: "Talent Reels — Show Off Your Skills | Wanda" },
      {
        name: "description",
        content:
          "Talent Reels on Wanda: jobseekers, students and caterers upload short videos and photos of their skills so recruiters can hire from real proof of work.",
      },
      { property: "og:title", content: "Talent Reels — Show Off Your Skills | Wanda" },
      {
        property: "og:description",
        content: "Short skill videos and photos from South African talent, ready for recruiters.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReelsPage,
});

type Reel = Tables<"talent_reels">;

function ReelsPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const { data: reels = [], isLoading } = useQuery({
    queryKey: ["talent-reels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("talent_reels")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("wanda-reels")
      .on("postgres_changes", { event: "*", schema: "public", table: "talent_reels" }, () => {
        void qc.invalidateQueries({ queryKey: ["talent-reels"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  const term = q.trim().toLowerCase();
  const visible = term
    ? reels.filter((r) =>
        [r.title, r.caption, r.skill_tag, r.area]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(term)),
      )
    : reels;

  return (
    <Shell title="Talent Reels" subtitle="Show off your skills">
      <div className="space-y-3 pb-6">
        <RoseButton
          type="button"
          className="w-full"
          onClick={() => {
            if (!user) {
              void navigate({ to: "/auth" });
              return;
            }
            setOpen((v) => !v);
          }}
        >
          <Upload className="h-4 w-4" /> Upload your reel
        </RoseButton>

        {open && user ? (
          <ReelUpload
            defaultArea={profile?.suburb || profile?.city || ""}
            onDone={() => {
              setOpen(false);
              void qc.invalidateQueries({ queryKey: ["talent-reels"] });
            }}
          />
        ) : null}

        <input
          className={inputClass}
          placeholder="Search skills, areas or names"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        {isLoading ? <Plate className="text-center text-sm">Loading reels…</Plate> : null}
        {!isLoading && visible.length === 0 ? (
          <Plate className="text-center text-sm text-muted-foreground">
            No reels yet. Upload the first one and get noticed by recruiters.
          </Plate>
        ) : null}

        {visible.map((r) => (
          <ReelCard key={r.id} reel={r} />
        ))}
      </div>
    </Shell>
  );
}

function ReelUpload({ defaultArea, onDone }: { defaultArea: string; onDone: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [skill, setSkill] = useState("");
  const [area, setArea] = useState(defaultArea);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!title.trim()) {
      toast.error("Give your reel a title.");
      return;
    }
    if (!file) {
      toast.error("Choose a video or photo.");
      return;
    }
    const kind = file.type.startsWith("video/") ? "video" : "image";
    const prepared = kind === "image" ? await compressImage(file) : file;
    if (prepared.size > 80 * 1024 * 1024) {
      toast.error("Reels must be under 80 MB.");
      return;
    }
    setBusy(true);
    const safe = prepared.name.replace(/[^\w.\-]+/g, "_");
    const path = `${user.id}/reels/${crypto.randomUUID()}-${safe}`;
    const up = await supabase.storage
      .from("talent")
      .upload(path, prepared, { contentType: prepared.type || "application/octet-stream" });
    if (up.error) {
      setBusy(false);
      toast.error(up.error.message);
      return;
    }
    const gps = await (await import("@/lib/gps")).getGps();
    const { error } = await supabase.from("talent_reels").insert({
      user_id: user.id,
      kind,
      title: title.trim(),
      caption: caption.trim() || null,
      skill_tag: skill.trim() || null,
      area: area.trim() || null,
      media_path: path,
      media_mime: prepared.type || null,
      ...gps,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Reel published");
    setTitle("");
    setCaption("");
    setFile(null);
    onDone();
  };

  return (
    <Plate>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Title">
          <input
            className={inputClass}
            value={title}
            maxLength={100}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Silver service plating demo"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Skill tag">
            <input
              className={inputClass}
              value={skill}
              maxLength={40}
              onChange={(e) => setSkill(e.target.value)}
              placeholder="Catering"
            />
          </Field>
          <Field label="Area">
            <input
              className={inputClass}
              value={area}
              maxLength={80}
              onChange={(e) => setArea(e.target.value)}
              placeholder="Dobsonville"
            />
          </Field>
        </div>
        <Field label="Caption">
          <textarea
            rows={2}
            maxLength={400}
            className={areaClass}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
        </Field>
        <input
          ref={fileRef}
          type="file"
          accept="video/*,image/*"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <RoseButton type="button" variant="outline" onClick={() => fileRef.current?.click()}>
            {file ? "Change media" : "Choose video or photo"}
          </RoseButton>
          {file ? <span className="text-xs text-muted-foreground">{file.name}</span> : null}
          <RoseButton type="submit" disabled={busy} className="ml-auto">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Publish reel
          </RoseButton>
        </div>
      </form>
    </Plate>
  );
}

function ReelCard({ reel }: { reel: Reel }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [url, setUrl] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [outro, setOutro] = useState(false);
  const counted = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let live = true;
    void signedUrl("talent", reel.media_path).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [reel.media_path]);

  // TikTok-style autoplay: play while the reel is the one on screen, pause otherwise.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        const v = videoRef.current;
        if (!v) return;
        if (entry && entry.isIntersecting && entry.intersectionRatio > 0.6) {
          void v.play().catch(() => undefined);
        } else {
          v.pause();
        }
      },
      { threshold: [0, 0.6, 1] },
    );
    io.observe(frame);
    return () => io.disconnect();
  }, [url]);

  const { data: likes = [] } = useQuery({
    queryKey: ["reel-likes", reel.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reel_likes")
        .select("user_id")
        .eq("reel_id", reel.id);
      if (error) throw error;
      return data;
    },
  });

  const liked = likes.some((l) => l.user_id === user?.id);

  const toggleLike = async () => {
    if (!user) {
      toast.error("Sign in to like reels.");
      return;
    }
    if (liked) {
      await supabase.from("reel_likes").delete().eq("reel_id", reel.id).eq("user_id", user.id);
    } else {
      await supabase.from("reel_likes").insert({ reel_id: reel.id, user_id: user.id });
    }
    void qc.invalidateQueries({ queryKey: ["reel-likes", reel.id] });
  };

  const countView = () => {
    if (counted.current) return;
    counted.current = true;
    void supabase
      .from("talent_reels")
      .update({ views: reel.views + 1 })
      .eq("id", reel.id);
  };

  return (
    <Plate className="space-y-2">
      <div className="flex items-start gap-2">
        <UserAvatar userId={reel.user_id} size={36} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">{reel.title}</h2>
          <p className="text-[0.65rem] tracking-widest text-muted-foreground uppercase">
            {[reel.skill_tag, reel.area].filter(Boolean).join(" · ") || "Talent"}
          </p>
        </div>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Eye className="h-3.5 w-3.5" /> {reel.views}
        </span>
      </div>

      <div ref={frameRef} className="relative overflow-hidden rounded-xl">
        {url ? (
          reel.kind === "video" ? (
            <video
              ref={videoRef}
              src={url}
              playsInline
              muted={muted}
              loop={false}
              preload="metadata"
              onPlay={countView}
              onEnded={() => {
                setOutro(true);
                window.setTimeout(() => {
                  setOutro(false);
                  const v = videoRef.current;
                  if (v) {
                    v.currentTime = 0;
                    void v.play().catch(() => undefined);
                  }
                }, 2200);
              }}
              onClick={() => {
                const v = videoRef.current;
                if (!v) return;
                if (v.paused) void v.play().catch(() => undefined);
                else v.pause();
              }}
              className="w-full rounded-xl"
            />
          ) : (
            <img
              src={url}
              alt={reel.title}
              loading="lazy"
              onLoad={countView}
              className="w-full rounded-xl"
            />
          )
        ) : (
          <div className="h-48 w-full animate-pulse rounded-xl bg-muted/40" />
        )}

        {/* Persistent brand watermark */}
        <img
          src={logoUrl}
          alt=""
          aria-hidden
          className="pointer-events-none absolute top-2 right-2 h-9 w-9 rounded-full object-contain opacity-70"
        />

        {/* Wanda logo outro at the end of every reel */}
        {outro ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/85 backdrop-blur-sm animate-fade-in">
            <img src={logoUrl} alt="Wanda" className="h-24 w-24 object-contain" />
            <p className="rose-text font-display text-lg tracking-empire">WANDA</p>
          </div>
        ) : null}

        {reel.kind === "video" && url ? (
          <button
            type="button"
            onClick={() => {
              setMuted((m) => !m);
              const v = videoRef.current;
              if (v) void v.play().catch(() => undefined);
            }}
            aria-label={muted ? "Unmute reel" : "Mute reel"}
            className="absolute bottom-2 right-2 rounded-full bg-background/70 p-2 text-foreground"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        ) : null}
      </div>

      {reel.caption ? <p className="text-sm">{reel.caption}</p> : null}

      <button
        type="button"
        onClick={() => void toggleLike()}
        className={`inline-flex items-center gap-1 text-xs ${liked ? "text-primary" : "text-muted-foreground"}`}
      >
        <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} /> {likes.length}
      </button>
      <ReelMenu reel={reel} url={url} />
    </Plate>
  );
}

function ReelMenu({ reel, url }: { reel: Reel; url: string | null }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [share, setShare] = useState(false);
  const link = typeof window !== "undefined" ? `${window.location.origin}/reels#${reel.id}` : "";
  const text = `${reel.title} — Talent Reel on Wanda`;
  const btn = "inline-flex items-center gap-1 rounded-lg border border-primary/40 px-2.5 py-1 text-xs hover:bg-primary/10";
  const del = async () => {
    if (!confirm("Delete this reel for everyone?")) return;
    await supabase.storage.from("talent").remove([reel.media_path]);
    const { error } = await supabase.from("talent_reels").delete().eq("id", reel.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Reel deleted");
    void qc.invalidateQueries({ queryKey: ["talent-reels"] });
  };
  return (
    <div className="flex flex-wrap gap-2 pt-1">
      <button type="button" className={btn} onClick={() => setShare(true)}><Share2 className="h-3.5 w-3.5" /> Share</button>
      <button
        type="button"
        className={btn}
        onClick={() => {
          void navigator.clipboard?.writeText(`${text} ${link}`);
          toast.success("Copied — paste it into any chat to forward");
          void navigate({ to: "/chat" });
        }}
      >
        <Forward className="h-3.5 w-3.5" /> Forward
      </button>
      <button type="button" className={btn} onClick={() => { void navigator.clipboard?.writeText(link); toast.success("Link copied"); }}>
        <Copy className="h-3.5 w-3.5" /> Copy link
      </button>
      {url ? (
        <a className={btn} href={url} download target="_blank" rel="noreferrer"><Download className="h-3.5 w-3.5" /> Save</a>
      ) : null}
      {user?.id === reel.user_id ? (
        <button type="button" className={`${btn} border-destructive/60 text-destructive`} onClick={() => void del()}>
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </button>
      ) : null}
      {share ? <ShareSheet target={{ text, url: link }} onClose={() => setShare(false)} /> : null}
    </div>
  );
}
