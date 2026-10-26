import { useEffect, useState } from "react";

/** Short relative time that stays accurate because callers re-render on `useTick`. */
export function timeAgo(iso: string | null | undefined) {
  if (!iso) return "—";
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

/**
 * Re-renders the calling component on a timer, so relative timestamps and
 * "live" indicators keep moving without any user interaction.
 */
export function useTick(intervalMs = 5000) {
  const [, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
}
