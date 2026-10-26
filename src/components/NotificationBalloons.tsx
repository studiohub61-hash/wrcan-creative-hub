import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { MessageCircle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Balloon = { id: string; title: string; text: string };

const preview = (m: { kind: string; body: string | null }) =>
  m.kind === "text"
    ? (m.body ?? "").slice(0, 80)
    : ({ image: "📷 Photo", video: "🎥 Video", audio: "🎤 Voice note", file: "📄 Document", location: "📍 Location", contact: "👤 Contact" } as Record<string, string>)[m.kind] ?? "New message";

/** Red pop-up balloons for new chat messages, shown anywhere in the app. */
export function NotificationBalloons() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [items, setItems] = useState<Balloon[]>([]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`balloons-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, async (payload) => {
        const m = payload.new as { id: string; sender_id: string; kind: string; body: string | null };
        if (m.sender_id === user.id) return;
        void qc.invalidateQueries({ queryKey: ["unread-count"] });
        if (window.location.pathname.startsWith("/chat")) return;
        const { data: p } = await supabase.from("profiles").select("full_name").eq("id", m.sender_id).maybeSingle();
        const b = { id: m.id, title: p?.full_name || "New message", text: preview(m) };
        setItems((prev) => [b, ...prev].slice(0, 3));
        setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== b.id)), 6000);
      })
      .subscribe();
    return () => void supabase.removeChannel(ch);
  }, [user, qc]);

  if (!items.length || pathname.startsWith("/chat")) return null;

  return (
    <div className="pointer-events-none fixed top-3 right-3 z-[90] flex w-72 max-w-[85vw] flex-col gap-2">
      {items.map((b) => (
        <div
          key={b.id}
          role="status"
          className="balloon-red pointer-events-auto relative flex cursor-pointer items-start gap-2 rounded-2xl px-3 py-2 animate-in slide-in-from-top-4 fade-in"
          onClick={() => {
            setItems((prev) => prev.filter((x) => x.id !== b.id));
            void navigate({ to: "/chat" });
          }}
        >
          <MessageCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold">{b.title}</p>
            <p className="truncate text-xs opacity-90">{b.text}</p>
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={(e) => {
              e.stopPropagation();
              setItems((prev) => prev.filter((x) => x.id !== b.id));
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
