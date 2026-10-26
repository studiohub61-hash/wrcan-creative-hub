import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Camera,
  ExternalLink,
  Users,

  Check,
  Copy,
  Forward,
  MapPin,
  Mic,
  Paperclip,
  Plus,
  Search,
  Send,
  Share2,
  Square,
  Trash2,
  Video,
} from "lucide-react";
import { Shell } from "@/components/Shell";
import { Plate, inputClass } from "@/components/EmpireUI";
import { ShareSheet } from "@/components/ShareSheet";
import { MessageBubbleBody } from "@/components/ChatMedia";
import { UserAvatar } from "@/components/Avatar";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Database, Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "WRCAN Chat — Real-time Messaging, Media & Location" },
      {
        name: "description",
        content:
          "WhatsApp-style real-time chat on WRCAN: send text, photos, videos, voice notes, PDFs and your live location to recruiters, trainers and teams.",
      },
      { property: "og:title", content: "WRCAN Chat — Real-time Messaging, Media & Location" },
      {
        property: "og:description",
        content: "Voice notes, media, documents and location sharing between members and recruiters.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatPage,
});

type Message = Tables<"messages">;
type Conversation = Tables<"conversations">;
type MessageKind = Database["public"]["Enums"]["message_kind"];

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });

function ChatPage() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);

  // Mark the open chat as read (clears the red badge), and keep it read while open.
  useEffect(() => {
    if (!activeId || !user) return;
    const markRead = async () => {
      await supabase
        .from("conversation_participants")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", activeId)
        .eq("user_id", user.id);
      void qc.invalidateQueries({ queryKey: ["unread-count"] });
    };
    void markRead();
    const ch = supabase
      .channel(`read-${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
        () => void markRead(),
      )
      .subscribe();
    return () => {
      void markRead();
      void supabase.removeChannel(ch);
    };
  }, [activeId, user, qc]);

  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: parts, error: pErr } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user!.id);
      if (pErr) throw pErr;
      const ids = (parts ?? []).map((p) => p.conversation_id);
      if (ids.length === 0) return [] as Conversation[];
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .in("id", ids)
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Realtime: refresh the conversation list whenever any thread moves.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("wrcan-conversations")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
        void qc.invalidateQueries({ queryKey: ["conversations", user.id] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, qc]);

  // The freshly created conversation may not be in the cached list yet — fetch it directly.
  const { data: activeFallback = null } = useQuery({
    queryKey: ["conversation", activeId],
    enabled: !!activeId && !conversations.some((c) => c.id === activeId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("id", activeId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const active = conversations.find((c) => c.id === activeId) ?? activeFallback;

  if (active) {
    return (
      <ChatThread
        conversation={active}
        conversations={conversations}
        onBack={() => setActiveId(null)}
        senderName={profile?.full_name || user?.email || "Member"}
      />
    );
  }


  return (
    <Shell title="Chat" subtitle="Real-time · Media · Location">
      <div className="space-y-3 pb-6">
        <button
          type="button"
          onClick={() => setNewChatOpen((v) => !v)}
          className="rose-metal flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-xs font-semibold tracking-widest uppercase"
        >
          <Plus className="h-4 w-4" /> Start a new chat
        </button>

        {newChatOpen ? (
          <NewChat
            onCreated={(id) => {
              setNewChatOpen(false);
              setActiveId(id);
              void qc.invalidateQueries({ queryKey: ["conversations", user?.id] });
            }}
          />
        ) : null}

        {conversations.length === 0 ? (
          <Plate className="text-center text-sm text-muted-foreground">
            No conversations yet. Start one with a recruiter, trainer or fellow member.
          </Plate>
        ) : null}

        {conversations.map((c) => (
          <Plate key={c.id} onClick={() => setActiveId(c.id)} className="flex items-center gap-3">
            <div className="rose-metal flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
              {(c.title ?? "W").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{c.title ?? "WRCAN chat"}</p>
              <p className="text-[0.7rem] text-muted-foreground">
                {c.is_group ? "Group" : "Direct"} · {timeOf(c.last_message_at)}
              </p>
            </div>
          </Plate>
        ))}

        <Communities
          onOpen={(id) => {
            setActiveId(id);
            void qc.invalidateQueries({ queryKey: ["conversations", user?.id] });
          }}
        />
      </div>

    </Shell>
  );
}

/** Official WRCAN community groups — every registered member can join and chat in real time. */
function Communities({ onOpen }: { onOpen: (id: string) => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const { data: groups = [] } = useQuery({
    queryKey: ["communities"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("is_community", true)
        .order("title");
      if (error) throw error;
      return data;
    },
  });

  const { data: joined = [] } = useQuery({
    queryKey: ["community-memberships", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data.map((r) => r.conversation_id);
    },
  });

  const join = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.rpc("join_community", { _conversation_id: id });
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["community-memberships", user?.id] });
    await qc.invalidateQueries({ queryKey: ["conversations", user?.id] });
    toast.success("You joined the group.");
    onOpen(id);
  };

  if (groups.length === 0) return null;

  return (
    <div className="space-y-3 pt-4">
      <p className="text-[0.65rem] tracking-widest text-muted-foreground uppercase">
        WRCAN community groups
      </p>
      {groups.map((g) => {
        const isMember = joined.includes(g.id);
        return (
          <Plate key={g.id} className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="rose-metal flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                <Users className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{g.title}</p>
                <p className="line-clamp-2 text-[0.7rem] text-muted-foreground">{g.description}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy === g.id}
                onClick={() => (isMember ? onOpen(g.id) : void join(g.id))}
                className="rose-metal rounded-full px-5 py-1.5 text-[0.65rem] font-semibold tracking-widest uppercase disabled:opacity-50"
              >
                {busy === g.id ? "Joining…" : isMember ? "Open chat" : "Join group"}
              </button>
              {g.invite_url ? (
                <a
                  href={g.invite_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center gap-1 rounded-full border border-primary/60 px-5 py-1.5 text-[0.65rem] tracking-widest text-primary uppercase"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> WhatsApp group
                </a>
              ) : null}
            </div>
          </Plate>
        );
      })}
    </div>
  );
}


function NewChat({ onCreated }: { onCreated: (id: string) => void }) {
  const { user, profile } = useAuth();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [group, setGroup] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [picked, setPicked] = useState<Record<string, string>>({});

  const { data: people = [] } = useQuery({
    queryKey: ["chat-people", q],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("id, full_name, member_type, city")
        .neq("id", user!.id)
        .limit(20);
      if (q.trim()) query = query.ilike("full_name", `%${q.trim()}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const start = async (otherId: string, otherName: string) => {
    if (!user) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("start_direct_chat", {
      _other_id: otherId,
      _title: `${profile?.full_name || "You"} & ${otherName}`,
    });
    setBusy(false);
    if (error || !data) {
      toast.error(error?.message ?? "Could not start the chat");
      return;
    }
    onCreated(data as string);
  };

  const createGroup = async () => {
    if (!user) return;
    const title = groupTitle.trim();
    const ids = Object.keys(picked);
    if (title.length < 2) {
      toast.error("Give the group a name.");
      return;
    }
    if (ids.length === 0) {
      toast.error("Add at least one member.");
      return;
    }
    setBusy(true);
    const { data: conv, error } = await supabase
      .from("conversations")
      .insert({ title, is_group: true, created_by: user.id })
      .select("id")
      .single();
    if (error || !conv) {
      setBusy(false);
      toast.error(error?.message ?? "Could not create the group");
      return;
    }
    const rows = [user.id, ...ids].map((id) => ({ conversation_id: conv.id, user_id: id }));
    const { error: pErr } = await supabase.from("conversation_participants").insert(rows);
    setBusy(false);
    if (pErr) {
      toast.error(pErr.message);
      return;
    }
    toast.success("Group created");
    setGroupTitle("");
    setPicked({});
    setGroup(false);
    onCreated(conv.id);
  };

  return (
    <Plate className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setGroup(false)}
          className={`rounded-full px-4 py-2 text-[0.65rem] tracking-widest uppercase ${
            group ? "border border-border text-muted-foreground" : "rose-metal"
          }`}
        >
          Direct chat
        </button>
        <button
          type="button"
          onClick={() => setGroup(true)}
          className={`rounded-full px-4 py-2 text-[0.65rem] tracking-widest uppercase ${
            group ? "rose-metal" : "border border-border text-muted-foreground"
          }`}
        >
          New group
        </button>
      </div>

      {group ? (
        <input
          className={inputClass}
          placeholder="Group name e.g. Dobsonville Caterers"
          value={groupTitle}
          maxLength={80}
          onChange={(e) => setGroupTitle(e.target.value)}
        />
      ) : null}

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          className={inputClass}
          placeholder="Search members by name"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        {people.map((p) => {
          const selected = !!picked[p.id];
          return (
            <button
              key={p.id}
              type="button"
              disabled={busy}
              onClick={() => {
                if (!group) {
                  void start(p.id, p.full_name || "Member");
                  return;
                }
                setPicked((prev) => {
                  const next = { ...prev };
                  if (next[p.id]) delete next[p.id];
                  else next[p.id] = p.full_name || "Member";
                  return next;
                });
              }}
              className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left disabled:opacity-50 ${
                selected
                  ? "border-primary bg-accent/40"
                  : "border-border bg-card/60 hover:bg-accent/40"
              }`}
            >
              <UserAvatar userId={p.id} name={p.full_name} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{p.full_name || "Member"}</span>
                <span className="block text-[0.65rem] tracking-widest text-muted-foreground uppercase">
                  {p.member_type}
                  {p.city ? ` · ${p.city}` : ""}
                </span>
              </span>
              {group && selected ? <Check className="h-4 w-4 text-primary" /> : null}
            </button>
          );
        })}
        {people.length === 0 ? (
          <p className="text-xs text-muted-foreground">No members found.</p>
        ) : null}
      </div>

      {group ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void createGroup()}
          className="rose-metal w-full rounded-full px-6 py-3 text-xs font-semibold tracking-widest uppercase disabled:opacity-50"
        >
          Create group ({Object.keys(picked).length})
        </button>
      ) : null}
    </Plate>
  );
}


function ChatThread({
  conversation,
  conversations,
  onBack,
  senderName,
}: {
  conversation: Conversation;
  conversations: Conversation[];
  onBack: () => void;
  senderName: string;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [menuFor, setMenuFor] = useState<Message | null>(null);
  const [forwardFor, setForwardFor] = useState<Message | null>(null);
  const [shareText, setShareText] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const startedAtRef = useRef(0);
  const endRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);


  const key = useMemo(() => ["messages", conversation.id], [conversation.id]);

  const { data: messages = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true })
        .limit(300);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`wrcan-messages-${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          qc.setQueryData<Message[]>(key, (prev = []) =>
            prev.some((m) => m.id === (payload.new as Message).id)
              ? prev
              : [...prev, payload.new as Message],
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const updated = payload.new as Message;
          qc.setQueryData<Message[]>(key, (prev = []) =>
            prev.map((m) => (m.id === updated.id ? updated : m)),
          );
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversation.id, key, qc]);


  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async (payload: Partial<Message> & { kind: MessageKind }) => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversation.id,
      sender_id: user.id,
      ...payload,
    });
    if (!error) {
      await supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conversation.id);
    }
    setBusy(false);
    if (error) toast.error(error.message);
  };

  const sendText = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText("");
    await send({ kind: "text", body });
  };

  const upload = async (file: File, kind: MessageKind, extra: Partial<Message> = {}) => {
    if (!user) return;
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Files must be under 50 MB.");
      return;
    }
    setBusy(true);
    const safe = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${user.id}/${conversation.id}/${crypto.randomUUID()}-${safe}`;
    const { error } = await supabase.storage.from("chat-media").upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await send({
      kind,
      body: kind === "file" || kind === "image" ? file.name : null,
      media_path: path,
      media_mime: file.type || null,
      media_size: file.size,
      ...extra,
    });
  };

  const shareLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Location is not available on this device.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        void send({
          kind: "location",
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      () => toast.error("Could not get your location."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const toggleRecording = async () => {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        const duration = Date.now() - startedAtRef.current;
        const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: blob.type });
        void upload(file, "audio", { duration_ms: duration });
      };
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.start();
      setRecording(true);
    } catch {
      toast.error("Microphone permission denied.");
    }
  };

  const textOf = (m: Message) =>
    m.body ??
    (m.kind === "location" ? `https://maps.google.com/?q=${m.latitude},${m.longitude}` : m.kind);

  const copyMessage = async (m: Message) => {
    try {
      await navigator.clipboard.writeText(textOf(m));
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy.");
    }
    setMenuFor(null);
  };

  const deleteMessage = async (m: Message) => {
    const { error } = await supabase
      .from("messages")
      .update({ deleted_at: new Date().toISOString(), body: null, media_path: null })
      .eq("id", m.id);
    setMenuFor(null);
    if (error) toast.error(error.message);
    else {
      qc.setQueryData<Message[]>(key, (prev = []) => prev.filter((x) => x.id !== m.id));
      toast.success("Message deleted for everyone");
    }
  };

  const forwardMessage = async (m: Message, targetId: string) => {
    if (!user) return;
    const { error } = await supabase.from("messages").insert({
      conversation_id: targetId,
      sender_id: user.id,
      kind: m.kind,
      body: m.body,
      media_path: m.media_path,
      media_mime: m.media_mime,
      media_size: m.media_size,
      duration_ms: m.duration_ms,
      latitude: m.latitude,
      longitude: m.longitude,
    });
    setForwardFor(null);
    if (error) toast.error(error.message);
    else {
      await supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", targetId);
      toast.success("Message sent on");
    }
  };


  return (
    <Shell bare>
      <div className="flex h-screen flex-col">
        <header className="glass-plate flex items-center gap-3 px-3 py-3">
          <button type="button" onClick={onBack} aria-label="Back to chats">
            <ArrowLeft className="h-5 w-5 text-primary" />
          </button>
          <div className="rose-metal flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold">
            {(conversation.title ?? "W").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{conversation.title ?? "WRCAN chat"}</p>
            <p className="text-[0.65rem] tracking-widest text-muted-foreground uppercase">
              {senderName} · online
            </p>
          </div>
        </header>

        <div className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
          {messages
            .filter((m) => !m.deleted_at)
            .map((m) => {
              const mine = m.sender_id === user?.id;
              return (
                <div
                  key={m.id}
                  className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}
                >
                  {!mine ? <UserAvatar userId={m.sender_id} size={28} /> : null}
                  <button
                    type="button"
                    onClick={() => setMenuFor(m)}
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-left shadow-sm ${
                      mine
                        ? "rounded-br-sm bg-primary text-primary-foreground"
                        : "rounded-bl-sm bg-card text-card-foreground"
                    }`}
                  >
                    <MessageBubbleBody message={m} />
                    <span className="mt-1 block text-right text-[0.6rem] opacity-70">
                      {timeOf(m.created_at)}
                    </span>
                  </button>
                </div>
              );
            })}
          <div ref={endRef} />
        </div>

        {menuFor ? (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 backdrop-blur-sm"
            onClick={() => setMenuFor(null)}
          >
            <div
              className="glass-plate w-full max-w-2xl space-y-2 rounded-t-2xl p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => void copyMessage(menuFor)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm hover:bg-accent/40"
              >
                <Copy className="h-4 w-4 text-primary" /> Copy
              </button>
              <button
                type="button"
                onClick={() => {
                  setForwardFor(menuFor);
                  setMenuFor(null);
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm hover:bg-accent/40"
              >
                <Forward className="h-4 w-4 text-primary" /> Forward / move to another chat
              </button>
              <button
                type="button"
                onClick={() => {
                  setShareText(textOf(menuFor));
                  setMenuFor(null);
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm hover:bg-accent/40"
              >
                <Share2 className="h-4 w-4 text-primary" /> Share to social networks
              </button>
              {menuFor.sender_id === user?.id ? (
                <button
                  type="button"
                  onClick={() => void deleteMessage(menuFor)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-destructive hover:bg-accent/40"
                >
                  <Trash2 className="h-4 w-4" /> Delete for everyone
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {forwardFor ? (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 backdrop-blur-sm"
            onClick={() => setForwardFor(null)}
          >
            <div
              className="glass-plate max-h-[70vh] w-full max-w-2xl space-y-2 overflow-y-auto rounded-t-2xl p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="mb-2 text-[0.65rem] tracking-widest text-muted-foreground uppercase">
                Send to
              </p>
              {conversations
                .filter((c) => c.id !== conversation.id)
                .map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => void forwardMessage(forwardFor, c.id)}
                    className="flex w-full items-center gap-3 rounded-lg border border-border bg-card/60 px-3 py-2 text-left text-sm hover:bg-accent/40"
                  >
                    <div className="rose-metal flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold">
                      {(c.title ?? "W").slice(0, 1).toUpperCase()}
                    </div>
                    <span className="truncate">{c.title ?? "Wanda chat"}</span>
                  </button>
                ))}
              {conversations.filter((c) => c.id !== conversation.id).length === 0 ? (
                <p className="text-xs text-muted-foreground">No other chats yet.</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {shareText ? (
          <ShareSheet target={{ text: shareText }} onClose={() => setShareText(null)} />
        ) : null}


        <form onSubmit={sendText} className="glass-plate flex items-end gap-1 px-2 py-2">
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
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.doc,.docx,.xls,.xlsx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f, "file");
              e.target.value = "";
            }}
          />

          <button
            type="button"
            aria-label="Send a photo"
            onClick={() => imageRef.current?.click()}
            className="p-2 text-primary"
          >
            <Camera className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Send a video"
            onClick={() => videoRef.current?.click()}
            className="p-2 text-primary"
          >
            <Video className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Send a document"
            onClick={() => fileRef.current?.click()}
            className="p-2 text-primary"
          >
            <Paperclip className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Share my location"
            onClick={shareLocation}
            className="p-2 text-primary"
          >
            <MapPin className="h-5 w-5" />
          </button>

          <textarea
            rows={1}
            value={text}
            maxLength={4000}
            placeholder="Message"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendText(e);
              }
            }}
            className="rose-plate max-h-28 min-h-11 flex-1 resize-none rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />

          {text.trim() ? (
            <button
              type="submit"
              aria-label="Send message"
              disabled={busy}
              className="rose-metal flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-50"
            >
              <Send className="h-5 w-5" />
            </button>
          ) : (
            <button
              type="button"
              aria-label={recording ? "Stop recording" : "Record a voice note"}
              onClick={() => void toggleRecording()}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                recording ? "bg-destructive text-destructive-foreground" : "rose-metal"
              }`}
            >
              {recording ? <Square className="h-4 w-4" /> : <Mic className="h-5 w-5" />}
            </button>
          )}
        </form>
      </div>
    </Shell>
  );
}
