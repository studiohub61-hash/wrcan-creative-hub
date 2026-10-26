import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Plate({
  children,
  className = "",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`glass-plate rounded-xl p-4 ${onClick ? "cursor-pointer transition-shadow hover:shadow-lg" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export function RoseButton({
  children,
  className = "",
  variant = "solid",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "solid" | "outline" }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-xs font-semibold tracking-widest uppercase transition-transform active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100";
  const style =
    variant === "solid"
      ? "rose-metal"
      : "border border-primary/60 bg-card/70 text-primary hover:bg-accent/50";
  return (
    <button className={`${base} ${style} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function MatchRing({ score }: { score: number }) {
  return (
    <div className="relative h-12 w-12 shrink-0">
      <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90">
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--muted)" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * 97.4} 97.4`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[0.65rem] font-bold text-primary">
        {score}
      </span>
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[0.65rem] tracking-widest text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  "rose-plate w-full rounded-full px-5 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none focus:ring-2 focus:ring-ring";

export const areaClass =
  "rose-plate w-full rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none focus:ring-2 focus:ring-ring";
