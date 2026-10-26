import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2, Trash2, Video } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Plate, RoseButton, areaClass } from "@/components/EmpireUI";
import { UserAvatar } from "@/components/Avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { compressImage, signedUrl } from "@/lib/media";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/status")({
  head: () => ({
    meta: [
      { title: "Status — Wanda Recruitment & Catering" },
      {
        name: "description",
        content:
          "Post a 24-hour status update with text, photos or video and see what other Wanda members are doing right now.",
      },
      { property: "og:title", content: "Status — Wanda Recruitment & Catering" },
      {
        property: "og:description",
        content: "24-hour status updates from jobseekers, students, recruiters and caterers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StatusPage,
});

type StatusPost = Tables<"status_posts">;

const ago = (iso: string) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  return `${Math.floor(mins / 60)} h ago`;
};

function StatusPage() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const imageRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLInputElement | null>(null);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["status-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("status_posts")
        .select("*")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const { data: names = {} } = useQuery({
    queryKey: ["status-names", posts.map((p) => p.user_id).join(",")],
    enabled: posts.length > 0,
    queryFn: async () => {
      const ids = [...new Set(posts.map((p) => p.user_id))];
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, city, suburb")
        .in("id", ids);
      const map: Record<string, string> = {};
      (data ?? []).forEach((p) => {
        map[p.id] = `${p.full_name || "Member"}${p.suburb || p.city ? ` · ${p.suburb ?? p.city}` : ""}`;
      });
      return map;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("wanda-status")
      .on("postgres_changes", { event: "*", schema: "public", table: "status_posts" }, () => {
        void qc.invalidateQueries({ queryKey: ["status-posts"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  const post = async (extra: Partial<StatusPost> = {}) => {
    if (!user) return;
    setBusy(true);
    const gps = await (await import("@/lib/gps")).getGps();
    const { error } = await supabase.from("status_posts").insert({
      user_id: user.id,
      kind: "text",
      body: body.trim() || null,
      ...gps,
      ...extra,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setBody("");
    toast.success("Status posted — live for 24 hours");
    void qc.invalidateQueries({ queryKey: ["status-posts"] });
  };

  const upload = async (file: File, kind: "image" | "video") => {
    if (!user) return;
    const prepared = kind === "image" ? await compressImage(file) : file;
    if (prepared.size > 60 * 1024 * 1024) {
      toast.error("Keep status media under 60 MB.");
      return;
    }
    setBusy(true);
    const safe = prepared.name.replace(/[^\w.\-]+/g, "_");
    const path = `${user.id}/status/${crypto.randomUUID()}-${safe}`;
    const { error } = await supabase.storage
      .from("talent")
      .upload(path, prepared, { contentType: prepared.type || "application/octet-stream" });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await post({ kind, media_path: path, media_mime: prepared.type || null });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("status_posts").delete().eq("id", id);
    if (error) toast.error(error.message);
    else void qc.invalidateQueries({ queryKey: ["status-posts"] });
  };

  return (
    <Shell title="Status" subtitle="24-hour updates · Live">
      <div className="space-y-3 pb-6">
        <Plate className="space-y-3">
          <p className="text-[0.65rem] tracking-widest text-muted-foreground uppercase">
            Posting as {profile?.full_name || "Member"}
          </p>
          <textarea
            rows={3}
            maxLength={500}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Available for shifts this weekend in Dobsonville…"
            className={areaClass}
          />
          <input
            ref={imageRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f, "image");
              e.target.value = "";
            }}
          />
          <input
            ref={videoRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f, "video");
              e.target.value = "";
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <RoseButton
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => imageRef.current?.click()}
            >
              <Camera className="h-4 w-4" /> Photo
            </RoseButton>
            <RoseButton
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => videoRef.current?.click()}
            >
              <Video className="h-4 w-4" /> Video
            </RoseButton>
            <RoseButton
              type="button"
              disabled={busy || !body.trim()}
              onClick={() => void post()}
              className="ml-auto"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Post status
            </RoseButton>
          </div>
        </Plate>

        {isLoading ? <Plate className="text-center text-sm">Loading statuses…</Plate> : null}
        {!isLoading && posts.length === 0 ? (
          <Plate className="text-center text-sm text-muted-foreground">
            No live statuses yet. Be the first to post.
          </Plate>
        ) : null}

        {posts.map((p) => (
          <Plate key={p.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <UserAvatar userId={p.user_id} name={names[p.user_id] ?? null} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{names[p.user_id] ?? "Member"}</p>
                <p className="text-[0.65rem] tracking-widest text-muted-foreground uppercase">
                  {ago(p.created_at)}
                </p>
              </div>
              {p.user_id === user?.id ? (
                <button
                  type="button"
                  aria-label="Delete status"
                  onClick={() => void remove(p.id)}
                  className="p-2 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            {p.body ? <p className="text-sm">{p.body}</p> : null}
            {p.media_path ? <StatusMedia path={p.media_path} kind={p.kind} /> : null}
          </Plate>
        ))}
      </div>
    </Shell>
  );
}

export function StatusMedia({ path, kind }: { path: string; kind: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void signedUrl("talent", path).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [path]);
  if (!url) return <div className="h-40 w-full animate-pulse rounded-xl bg-muted/40" />;
  return kind === "video" ? (
    <video src={url} controls playsInline preload="metadata" className="w-full rounded-xl" />
  ) : (
    <img src={url} alt="Status media" loading="lazy" className="w-full rounded-xl" />
  );
}
