import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowUpRight, BookOpen, MapPin, Radio, WifiOff, Users, Camera } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { ECD_SECTIONS } from '@/lib/ecd';

export const Route = createFileRoute('/smartstart')({ head: () => ({ meta: [
  { title: 'SmartStart — WRCAN Hub' }, { name: 'description', content: 'Access WRCAN learning, live training sessions, field attendance and saved lessons from SmartStart.' },
  { property: 'og:title', content: 'SmartStart — WRCAN Hub' }, { property: 'og:description', content: 'Your WRCAN learning and community workspace, all in one place.' },
  { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
] }), component: SmartStart });
function SmartStart() {
  return <Shell title="SmartStart" subtitle="Learning · People · Opportunity">
    <div className="border-y border-border py-6 mb-4"><h2 className="font-display text-3xl text-primary">Your next step starts here.</h2><p className="mt-3 text-sm text-muted-foreground">WRCAN learning and community workspace.</p></div>
    <div className="divide-y divide-border">{[
      { to: '/attendance', title: 'ECD Attendance', text: 'Teacher & child daily register', icon: Camera },
      { to: '/training', title: 'Training modules', text: 'Browse the WRCAN training catalogue', icon: BookOpen },
      { to: '/sessions', title: 'Live training & field sessions', text: 'Join a broadcast or share session attendance', icon: Radio },
      { to: '/offline', title: 'Saved learning', text: 'Your saved lessons and personal drafts', icon: WifiOff },
      { to: '/media-studio', title: 'Interactive classroom', text: 'Small-group video training', icon: Users },
      { to: '/chat', title: 'Community', text: 'Connect with your WRCAN groups', icon: MapPin },
    ].map(({ to, title, text, icon: Icon }) => <Link key={to} to={to} className="flex gap-4 items-center py-5"><Icon className="size-6 shrink-0 text-primary" /><div className="min-w-0 flex-1"><h3 className="font-display text-xl">{title}</h3><p className="text-xs text-muted-foreground mt-1">{text}</p></div><ArrowUpRight className="size-4 shrink-0 text-primary" /></Link>)}</div>
    <div className="mt-8 border-t border-border pt-6"><h2 className="font-display text-2xl text-primary">DBE & SmartStart ECD Compliance</h2><p className="mt-1 text-xs text-muted-foreground">Child development, social work, health, DBE compliance, government reporting and parent community tools.</p></div>
    <Link to="/compliance" className="mt-4 flex items-center gap-3 rounded-xl border border-primary/60 bg-primary/10 px-4 py-4"><div className="flex-1"><h3 className="font-display text-xl text-primary">DBE Compliance Checklist</h3><p className="text-xs text-muted-foreground">9 sections · score your centre · save audits</p></div><ArrowUpRight className="size-5 text-primary" /></Link>
    <Link to="/ecd/$feature" params={{ feature: 'infrastructure' }} className="mt-3 flex items-center gap-3 rounded-lg border border-border px-4 py-4"><div className="min-w-0 flex-1"><h3 className="font-display text-xl text-primary">WR Care Infrastructure Audit</h3><p className="text-xs text-muted-foreground">8 sections · photo evidence · centre capacity</p></div><ArrowUpRight className="size-5 shrink-0 text-primary" /></Link>
    {ECD_SECTIONS.map((s, i) => <div key={s.title} className="mt-5"><h3 className="mb-1 text-xs font-semibold tracking-widest text-muted-foreground uppercase">{i + 1}. {s.title}</h3><div className="divide-y divide-border rounded-xl border border-border">{s.features.map((f) => <Link key={f.key} to="/ecd/$feature" params={{ feature: f.key }} className="flex items-center gap-3 px-3 py-3"><span className="flex-1 text-sm">{f.title}</span><ArrowUpRight className="size-4 text-primary" /></Link>)}</div></div>)}
    <p className="mt-6 text-xs text-muted-foreground">This workspace contains WRCAN resources. Official SmartStart partner tools or materials have not been connected.</p>
  </Shell>;
}