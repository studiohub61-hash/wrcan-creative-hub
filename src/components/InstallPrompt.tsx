import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function InstallPrompt() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone;
    if (standalone || localStorage.getItem("wanda-install-dismissed")) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
      setIos(true);
      setHidden(false);
    }
    const onInstalled = () => setHidden(true);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (hidden) return null;
  const close = () => {
    localStorage.setItem("wanda-install-dismissed", "1");
    setHidden(true);
  };

  return (
    <div className="glass-plate fixed inset-x-3 bottom-20 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl p-3">
      <img src="/icons/icon-192.png" alt="" className="h-10 w-10 rounded-lg" />
      <div className="min-w-0 flex-1 text-xs">
        <p className="font-semibold text-foreground">Install Wanda</p>
        {ios ? (
          <p className="text-muted-foreground">
            Tap <Share className="inline h-3 w-3" /> then “Add to Home Screen”.
          </p>
        ) : (
          <p className="text-muted-foreground">Add the app to your phone or computer.</p>
        )}
      </div>
      {evt ? (
        <button
          type="button"
          className="rose-metal flex items-center gap-1 rounded-full px-3 py-1.5 text-[0.65rem] font-semibold tracking-widest uppercase"
          onClick={async () => {
            await evt.prompt();
            await evt.userChoice;
            setEvt(null);
            setHidden(true);
          }}
        >
          <Download className="h-3 w-3" /> Install
        </button>
      ) : null}
      <button type="button" aria-label="Dismiss" onClick={close} className="text-muted-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
