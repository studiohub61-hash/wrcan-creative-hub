import { Bell, Radio } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useRealtime } from "@/hooks/useRealtime";

const sast = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }).format(new Date(iso));

export function NotificationBell() {
  const { notices, unread, markRead, clear } = useRealtime();
  return <Popover onOpenChange={open => { if (open) markRead(); }}>
    <PopoverTrigger asChild><button aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} className="relative inline-flex size-9 items-center justify-center rounded-full border border-border bg-card text-foreground">
      <Bell className="size-4" />{unread > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-primary px-1 text-[10px] font-semibold leading-5 text-primary-foreground">{unread > 99 ? "99+" : unread}</span>}
    </button></PopoverTrigger>
    <PopoverContent align="end" className="w-72 p-0">
      <div className="flex items-center justify-between border-b border-border px-3 py-2"><span className="text-sm font-semibold">Live notifications</span><Button size="sm" variant="ghost" onClick={clear} disabled={!notices.length}>Clear</Button></div>
      <ul className="max-h-72 overflow-y-auto">{notices.length ? notices.map(n => <li key={n.id} className="border-b border-border px-3 py-2 text-sm last:border-0">{n.text}<div className="text-xs text-muted-foreground">{sast(n.at)}</div></li>) : <li className="px-3 py-4 text-sm text-muted-foreground">No new activity.</li>}</ul>
    </PopoverContent>
  </Popover>;
}

export function LiveSiteActivity() {
  const { live, logs, participants } = useRealtime();
  const onSite = participants.filter(p => p.status === "on_site");
  return <section aria-label="Live Site Activity" className="rounded-lg border border-border bg-card p-4 text-left">
    <div className="mb-3 flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 font-sans text-base font-semibold"><Radio className="size-4 text-primary" /> Live Site Activity</h2><span className="text-xs text-muted-foreground">{live ? `${onSite.length} on site` : "Offline"}</span></div>
    {!live ? <p className="text-sm text-muted-foreground"><Link to="/auth" className="text-primary underline">Sign in</Link> to see live clock-ins from every device.</p> :
    logs.length === 0 ? <p className="text-sm text-muted-foreground">No live clock-ins yet.</p> :
    <ul className="divide-y divide-border">{logs.slice(0, 10).map(l => <li key={l.id} className="flex items-center justify-between gap-2 py-2 text-sm">
      <span className="min-w-0 truncate"><span className="font-medium">{l.name}</span> <span className="text-muted-foreground">· {l.role} · {l.action === "In" ? "In" : "Out"} {sast(l.created_at)}</span></span>
      {l.punctuality && <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${l.punctuality === "Late" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>{l.punctuality}</span>}
    </li>)}</ul>}
  </section>;
}
