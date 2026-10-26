import { useEffect } from "react";
import { toast } from "sonner";
import { Copy, Facebook, Linkedin, Mail, MessageCircle, Send, Share2, X } from "lucide-react";

export type ShareTarget = { text: string; url?: string };

const NETWORKS = (text: string, url: string) => [
  {
    label: "WhatsApp",
    icon: MessageCircle,
    href: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`.trim())}`,
  },
  {
    label: "Telegram",
    icon: Send,
    href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    label: "Facebook",
    icon: Facebook,
    href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`,
  },
  {
    label: "X",
    icon: X,
    href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  },
  {
    label: "LinkedIn",
    icon: Linkedin,
    href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    label: "Email",
    icon: Mail,
    href: `mailto:?subject=${encodeURIComponent("Shared from Wanda")}&body=${encodeURIComponent(`${text}\n\n${url}`)}`,
  },
];

export function ShareSheet({ target, onClose }: { target: ShareTarget; onClose: () => void }) {
  const url = target.url ?? (typeof window !== "undefined" ? window.location.href : "");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const nativeShare = async () => {
    if (!navigator.share) {
      toast.error("Pick a network below to share.");
      return;
    }
    try {
      await navigator.share({ text: target.text, url });
      onClose();
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-plate w-full max-w-2xl rounded-t-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-3 text-center text-[0.65rem] tracking-widest text-muted-foreground uppercase">
          Share to
        </p>
        <div className="grid grid-cols-4 gap-3">
          {NETWORKS(target.text, url).map((n) => (
            <a
              key={n.label}
              href={n.href}
              target="_blank"
              rel="noreferrer noopener"
              onClick={onClose}
              className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card/60 px-2 py-3 text-[0.6rem] tracking-widest uppercase hover:bg-accent/40"
            >
              <n.icon className="h-5 w-5 text-primary" />
              {n.label}
            </a>
          ))}
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(`${target.text} ${url}`.trim());
              toast.success("Copied");
              onClose();
            }}
            className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card/60 px-2 py-3 text-[0.6rem] tracking-widest uppercase hover:bg-accent/40"
          >
            <Copy className="h-5 w-5 text-primary" />
            Copy
          </button>
          <button
            type="button"
            onClick={() => void nativeShare()}
            className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card/60 px-2 py-3 text-[0.6rem] tracking-widest uppercase hover:bg-accent/40"
          >
            <Share2 className="h-5 w-5 text-primary" />
            More
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-full border border-primary/60 px-6 py-2 text-xs tracking-widest text-primary uppercase"
        >
          Close
        </button>
      </div>
    </div>
  );
}
