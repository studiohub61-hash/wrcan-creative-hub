import type { ReactNode } from "react";

/** Pulsing dot marking a surface that updates on its own. */
export function LivePulse({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`flex items-center gap-2 text-[0.65rem] tracking-widest text-muted-foreground uppercase ${className}`}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
      </span>
      {children}
    </span>
  );
}
