import { useEffect, useState } from "react";
import logoUrl from "@/assets/wrcan-logo-compact.webp";

export function BootScreen() {
  const [hidden, setHidden] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    // Show the full splash only on the first open of a session; afterwards stay out of the way.
    // Hydration is ready: never impose a timed delay before the app can be used.
    setHidden(true);
    setGone(true);
  }, []);

  if (gone) return null;

  return (
    <div
      className={`gold-pattern fixed inset-0 z-[100] flex flex-col items-center justify-center transition-opacity duration-700 ${
        hidden ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      aria-hidden={hidden}
    >
      <img
        src={logoUrl}
        alt="Wanda Recruitment and Catering Agency"
        className="w-64 max-w-[70vw] animate-in fade-in zoom-in duration-1000"
      />
      <div className="deco-rule mt-6 w-48" />
      <p className="mt-4 text-[0.6rem] tracking-[0.4em] text-primary uppercase">Nationwide</p>
    </div>
  );
}
