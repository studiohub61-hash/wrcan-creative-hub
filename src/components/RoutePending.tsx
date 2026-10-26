import logoUrl from "@/assets/wrcan-logo.png";

/** Branded loader shown while a route loads, so navigation never flashes blank. */
export function RoutePending() {
  return (
    <div className="gold-pattern flex min-h-screen flex-col items-center justify-center gap-4 px-6">
      <img src={logoUrl} alt="Wanda" className="h-14 w-auto animate-pulse" />
      <span className="block h-1 w-40 overflow-hidden rounded-full bg-muted">
        <span className="rose-metal block h-full w-1/2 animate-pulse rounded-full" />
      </span>
      <p className="text-[0.6rem] tracking-[0.4em] text-primary uppercase">Loading</p>
      <span className="sr-only">Loading page…</span>
    </div>
  );
}
