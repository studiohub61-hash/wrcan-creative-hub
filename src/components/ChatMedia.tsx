import { useEffect, useState } from "react";
import { FileText, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Message = Tables<"messages">;

function useSignedUrl(path: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!path) {
      setUrl(null);
      return;
    }
    void supabase.storage
      .from("chat-media")
      .createSignedUrl(path, 60 * 60)
      .then(({ data }) => {
        if (alive) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      alive = false;
    };
  }, [path]);
  return url;
}

export function MessageBubbleBody({ message }: { message: Message }) {
  const url = useSignedUrl(message.media_path ?? null);

  if (message.kind === "location") {
    const lat = message.latitude ?? 0;
    const lng = message.longitude ?? 0;
    return (
      <a
        href={`https://www.google.com/maps?q=${lat},${lng}`}
        target="_blank"
        rel="noreferrer noopener"
        className="flex items-center gap-2 text-sm underline"
      >
        <MapPin className="h-4 w-4" />
        Live location · {lat.toFixed(4)}, {lng.toFixed(4)}
      </a>
    );
  }

  if (message.kind === "image") {
    return (
      <div className="space-y-1">
        {url ? (
          <img
            src={url}
            alt={message.body ?? "Shared image"}
            className="max-h-72 w-full rounded-lg object-cover"
          />
        ) : (
          <div className="h-40 w-52 animate-pulse rounded-lg bg-muted" />
        )}
        {message.body ? <p className="text-sm">{message.body}</p> : null}
      </div>
    );
  }

  if (message.kind === "video") {
    return url ? (
      <video src={url} controls className="max-h-72 w-full rounded-lg" />
    ) : (
      <div className="h-40 w-52 animate-pulse rounded-lg bg-muted" />
    );
  }

  if (message.kind === "audio") {
    return (
      <div className="min-w-[13rem]">
        {url ? <audio src={url} controls className="w-full" /> : null}
        {message.duration_ms ? (
          <span className="text-[0.65rem] opacity-70">
            {Math.round(message.duration_ms / 1000)}s voice note
          </span>
        ) : null}
      </div>
    );
  }

  if (message.kind === "file") {
    return (
      <a
        href={url ?? "#"}
        target="_blank"
        rel="noreferrer noopener"
        className="flex items-center gap-2 text-sm underline"
      >
        <FileText className="h-5 w-5 shrink-0" />
        <span className="truncate">{message.body || "Document"}</span>
      </a>
    );
  }

  return <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>;
}
