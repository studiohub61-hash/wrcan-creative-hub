import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import medallion from "@/assets/medallion.png";

type MedallionProps = {
  to: string;
  label: string;
  icon: LucideIcon;
  caption?: string;
};

export function Medallion({ to, label, icon: Icon, caption }: MedallionProps) {
  return (
    <Link to={to} className="group flex flex-col items-center gap-2 text-center">
      <div className="relative aspect-square w-full max-w-[9.5rem] transition-transform duration-300 group-hover:scale-[1.06] group-active:scale-95">
        <img
          src={medallion}
          alt=""
          aria-hidden
          loading="lazy"
          className="absolute inset-0 h-full w-full drop-shadow-[0_10px_18px_oklch(0.4_0.06_35/0.35)]"
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
          <Icon className="mb-1 h-6 w-6 text-primary-foreground/95 drop-shadow" strokeWidth={1.5} />
          <span className="font-display text-[0.72rem] leading-tight font-semibold tracking-wide text-primary-foreground uppercase drop-shadow">
            {label}
          </span>
        </div>
      </div>
      {caption ? (
        <span className="text-[0.65rem] tracking-widest text-muted-foreground uppercase">
          {caption}
        </span>
      ) : null}
    </Link>
  );
}
