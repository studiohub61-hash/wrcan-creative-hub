import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Award, BadgeCheck, Briefcase, Building2, CheckCircle2, Clock3, Crown,
  FileUp, Gem, Handshake, HeartHandshake, Loader2, Medal, Sparkles, Star,
  ToggleLeft, ToggleRight, TrendingUp, Users, X,
} from 'lucide-react';


/* ----------------------------- types & seed ----------------------------- */

type SubmissionStatus = 'Pending' | 'Approved' | 'Needs Review';
interface Submission {
  id: string;
  event: string;
  date: string;
  role: string;
  description: string;
  files: string[];
  submittedAt: string;
  status: SubmissionStatus;
  payout: number;
}
interface Pledge {
  id: string;
  company: string;
  tier: string;
  amount: number;
  message: string;
  at: string;
}
interface Tier {
  key: string;
  name: string;
  min: number;
  icon: typeof Medal;
  perks: string[];
}

const TIERS: Tier[] = [
  { key: 'bronze', name: 'Bronze', min: 5000, icon: Medal, perks: ['Logo on Sponsor Wall', 'Quarterly impact report', 'Social media thank-you'] },
  { key: 'silver', name: 'Silver', min: 25000, icon: Award, perks: ['All Bronze perks', 'Event banner placement', 'Priority access to trained catering staff'] },
  { key: 'gold', name: 'Gold', min: 100000, icon: Crown, perks: ['All Silver perks', 'Named training bursary', 'Recruitment priority lane', 'Annual gala invitation'] },
  { key: 'corporate', name: 'Custom Corporate Partner', min: 250000, icon: Gem, perks: ['All Gold perks', 'Co-branded campaigns', 'Dedicated account manager', 'Board-level impact briefing'] },
];

const SEED_SUBMISSIONS: Submission[] = [
  { id: 's1', event: 'Gala Dinner — Sandton Convention Centre', date: '2026-10-18', role: 'Fine Dining Service Lead', description: 'Coordinated 12 servers for a 200-guest plated dinner; zero service complaints, client rebooked for December.', files: ['plated-setup.jpg', 'client-feedback.png'], submittedAt: '2026-10-19 09:14', status: 'Approved', payout: 1850 },
  { id: 's2', event: 'Corporate Product Launch — Rosebank', date: '2026-10-21', role: 'Brand Ambassador', description: 'Front-of-house brand engagement, 340 guest interactions logged, 96 leads captured for the client.', files: ['launch-booth.jpg'], submittedAt: '2026-10-22 15:40', status: 'Pending', payout: 1200 },
  { id: 's3', event: 'Wedding Catering — Muldersdrift', date: '2026-10-24', role: 'Catering Logistics', description: 'Managed cold-chain transport and on-site kitchen setup for 150 guests; all courses served on schedule.', files: ['kitchen-setup.jpg', 'receipt-transport.pdf'], submittedAt: '2026-10-25 08:02', status: 'Needs Review', payout: 1600 },
];

const SEED_PLEDGES: Pledge[] = [
  { id: 'p1', company: 'Meridian Hotels Group', tier: 'Gold', amount: 120000, message: 'Proud to back the next generation of hospitality talent.', at: '2026-10-12' },
  { id: 'p2', company: 'Ubuntu Fresh Foods', tier: 'Silver', amount: 40000, message: 'Investing in skills that feed communities.', at: '2026-10-20' },
];

const SEED_SPONSORS = ['Meridian Hotels Group', 'Ubuntu Fresh Foods', 'Skyline Events Co.', 'Protea Bank Foundation', 'Golden Spoon Suppliers', 'City Lodge HR Trust'];

const SKILLS = ['Event Hosting', 'Catering Logistics', 'Fine Dining Service', 'Brand Activation', 'Client Relations'];
const ROLES = ['Brand Ambassador', 'Event Host', 'Catering Logistics', 'Fine Dining Service', 'Bar Service', 'Event Marketer'];

const fmtNum = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const fmtRand = (n: number) => `R${fmtNum(n)}`;
const statusStyle = (s: SubmissionStatus) =>
  s === 'Approved' ? 'border-primary/60 bg-primary/10 text-primary'
  : s === 'Pending' ? 'border-border bg-muted text-muted-foreground'
  : 'border-destructive/60 bg-destructive/10 text-destructive';

/* --------------------------------- page --------------------------------- */

export function PromotionsHubSection() {
  const [side, setSide] = useState<'promoter' | 'donor'>('promoter');
  const [submissions, setSubmissions] = useState<Submission[]>(SEED_SUBMISSIONS);
  const [pledges, setPledges] = useState<Pledge[]>(SEED_PLEDGES);

  return (
    <section aria-label="Promotions & Partnerships Hub">
      {/* master toggle */}
      <div className="mb-5 grid grid-cols-2 gap-3">
        {([['promoter', 'Promoter Dashboard', Briefcase], ['donor', 'Donor & Sponsor Portal', HeartHandshake]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            aria-pressed={side === key}
            onClick={() => setSide(key)}
            className={`flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-bold shadow-sm transition-all active:scale-[0.98] ${
              side === key
                ? 'border-primary bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30 ring-offset-2 ring-offset-background'
                : 'border-border bg-card text-foreground hover:border-primary/60 hover:bg-accent'
            }`}
          >
            <Icon className="size-5 shrink-0" /> <span className="text-center leading-tight">{label}</span>
          </button>
        ))}
      </div>

      {side === 'promoter'
        ? <PromoterDashboard submissions={submissions} setSubmissions={setSubmissions} />
        : <DonorPortal pledges={pledges} setPledges={setPledges} />}
    </section>
  );
}

/* --------------------------- promoter dashboard -------------------------- */

function PromoterDashboard({ submissions, setSubmissions }: { submissions: Submission[]; setSubmissions: React.Dispatch<React.SetStateAction<Submission[]>> }) {
  const [available, setAvailable] = useState(true);
  const [event, setEvent] = useState('');
  const [date, setDate] = useState('');
  const [role, setRole] = useState<string>(ROLES[0]!);
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const totals = useMemo(() => ({
    approved: submissions.filter((s) => s.status === 'Approved').reduce((a, s) => a + s.payout, 0),
    pending: submissions.filter((s) => s.status !== 'Approved').reduce((a, s) => a + s.payout, 0),
  }), [submissions]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles((f) => [...f, ...Array.from(list).map((x) => x.name)]);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!event.trim() || !date || !description.trim()) return;
    const payout = 800 + description.length * 2 + files.length * 150;
    setSubmissions((s) => [{
      id: `s${Date.now()}`, event: event.trim(), date, role, description: description.trim(),
      files, submittedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      status: 'Pending', payout,
    }, ...s]);
    setEvent(''); setDate(''); setDescription(''); setFiles([]);
    setSaved(true);
    toast.success('Work submitted for verification', { description: 'It now shows as Pending in your activity log.' });
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* profile card */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-full border border-primary/50 bg-primary/10">
            <Star className="size-7 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl text-primary">Thandi Mokoena</h2>
            <p className="text-xs text-muted-foreground">thandi.m@wrcan.co.za · +27 82 555 0147</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SKILLS.map((s) => <span key={s} className="rounded-full border border-border px-2.5 py-0.5 text-[0.65rem] tracking-wide text-muted-foreground">{s}</span>)}
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2.5">
          <span className="flex items-center gap-2 text-sm">
            <span className={`size-2 rounded-full ${available ? 'bg-primary' : 'bg-muted-foreground'}`} />
            {available ? 'Available for bookings' : 'Not available'}
          </span>
          <button onClick={() => setAvailable(!available)} aria-label="Toggle availability" className="text-primary transition-transform hover:scale-105">
            {available ? <ToggleRight className="size-8" /> : <ToggleLeft className="size-8 text-muted-foreground" />}
          </button>
        </div>
      </section>

      {/* work submission console */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 font-display text-xl text-primary"><FileUp className="size-5" /> Send Your Work</h2>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-xs text-muted-foreground">Event Name
              <input value={event} onChange={(e) => setEvent(e.target.value)} required placeholder="e.g. Gala Dinner — Sandton" className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60" />
            </label>
            <label className="block text-xs text-muted-foreground">Date
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground" />
            </label>
          </div>
          <label className="block text-xs text-muted-foreground">Role Filled
            <select value={role} onChange={(e) => setRole(e.target.value)} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground">
              {ROLES.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
          <label className="block text-xs text-muted-foreground">Performance & Achievements
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={3} placeholder="Describe what you delivered, guest feedback, results…" className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60" />
          </label>

          {/* drag & drop uploader */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
            onClick={() => fileInput.current?.click()}
            className={`cursor-pointer rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${dragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}
          >
            <FileUp className="mx-auto size-6 text-primary" />
            <p className="mt-2 text-sm">Drag & drop proof of work here, or tap to browse</p>
            <p className="mt-1 text-[0.65rem] text-muted-foreground">Photos of setups · receipts · marketing videos · client feedback</p>
            <input ref={fileInput} type="file" multiple accept="image/*,video/*,.pdf" className="hidden" onChange={(e) => addFiles(e.target.files)} />
          </div>
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <span key={`${f}-${i}`} className="flex items-center gap-1.5 rounded-full border border-primary/50 bg-primary/10 px-3 py-1 text-xs text-primary">
                  {f}
                  <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`Remove ${f}`}><X className="size-3" /></button>
                </span>
              ))}
            </div>
          )}

          <button type="submit" className="w-full rounded-lg bg-primary py-3 text-sm font-bold tracking-wide text-primary-foreground uppercase transition-opacity hover:opacity-90">
            {saved ? '✓ Submitted — added to your log' : 'Submit Work for Verification'}
          </button>
        </form>
      </section>

      {/* activity log & earnings */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-xl text-primary"><TrendingUp className="size-5" /> Activity & Earnings</h2>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-primary/50 bg-primary/10 p-3 text-center">
            <p className="text-[0.65rem] tracking-widest text-muted-foreground uppercase">Approved earnings</p>
            <p className="mt-1 font-display text-2xl text-primary">{fmtRand(totals.approved)}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-center">
            <p className="text-[0.65rem] tracking-widest text-muted-foreground uppercase">In review</p>
            <p className="mt-1 font-display text-2xl">{fmtRand(totals.pending)}</p>
          </div>
        </div>
        <div className="mt-4 divide-y divide-border">
          {submissions.map((s) => (
            <div key={s.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{s.event}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{s.role} · {s.date} · submitted {s.submittedAt}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[0.65rem] font-semibold ${statusStyle(s.status)}`}>{s.status}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
              <div className="mt-1.5 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{s.files.length} file{s.files.length === 1 ? '' : 's'} attached</span>
                <span className="font-semibold text-primary">{fmtRand(s.payout)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------ donor portal ----------------------------- */

function DonorPortal({ pledges, setPledges }: { pledges: Pledge[]; setPledges: React.Dispatch<React.SetStateAction<Pledge[]>> }) {
  const [tier, setTier] = useState<Tier>(TIERS[0]!);
  const [company, setCompany] = useState('');
  const [taxId, setTaxId] = useState('');
  const [amount, setAmount] = useState<string>(String(TIERS[0]!.min));
  const [message, setMessage] = useState('');
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);

  const totalPledged = pledges.reduce((a, p) => a + p.amount, 0);
  const stats = [
    { label: 'Youth Recruited', value: 148 + pledges.length * 2, icon: Users },
    { label: 'High-End Events Hosted', value: 63, icon: Sparkles },
    { label: 'Community Impact Hours', value: 4200 + Math.round(totalPledged / 100), icon: Clock3 },
    { label: 'Partner Contributions', value: fmtRand(totalPledged), icon: Handshake },
  ];

  const pickTier = (t: Tier) => { setTier(t); setAmount(String(t.min)); };

  const pledge = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!company.trim() || !amt || amt < tier.min) return;
    setProcessing(true);
    setTimeout(() => {
      setPledges((p) => [{ id: `p${Date.now()}`, company: company.trim(), tier: tier.name, amount: amt, message: message.trim(), at: new Date().toISOString().slice(0, 10) }, ...p]);
      setProcessing(false); setDone(true);
      toast.success('Pledge received — thank you!');
      setCompany(''); setTaxId(''); setMessage('');
      setTimeout(() => setDone(false), 3000);
    }, 1200);
  };

  return (
    <div className="space-y-6">
      {/* impact dashboard */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 font-display text-xl text-primary"><TrendingUp className="size-5" /> Impact & Transparency</h2>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {stats.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-lg border border-border bg-muted/40 p-3 text-center transition-colors hover:border-primary/50">
              <Icon className="mx-auto size-5 text-primary" />
              <p className="mt-1.5 font-display text-2xl text-primary">{typeof value === 'number' ? fmtNum(value) : value}</p>
              <p className="mt-0.5 text-[0.65rem] tracking-widest text-muted-foreground uppercase">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <TestDonation onDonate={(name, amt) => setPledges((p) => [{ id: `p${Date.now()}`, company: name, tier: 'Test Donation', amount: amt, message: 'Simulated donation', at: new Date().toISOString().slice(0, 10) }, ...p])} />

      {/* contribution terminal */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 font-display text-xl text-primary"><Building2 className="size-5" /> Contribution Terminal</h2>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {TIERS.map((t) => (
            <button
              key={t.key}
              onClick={() => pickTier(t)}
              className={`rounded-lg border p-3 text-left transition-colors ${tier.key === t.key ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}
            >
              <t.icon className={`size-5 ${tier.key === t.key ? 'text-primary' : 'text-muted-foreground'}`} />
              <p className="mt-1.5 text-sm font-semibold">{t.name}</p>
              <p className="text-[0.65rem] text-muted-foreground">from {fmtRand(t.min)}</p>
            </button>
          ))}
        </div>

        <form onSubmit={pledge} className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-xs text-muted-foreground">Company Name
              <input value={company} onChange={(e) => setCompany(e.target.value)} required placeholder="Your organisation" className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60" />
            </label>
            <label className="block text-xs text-muted-foreground">Tax ID / Exemption Details
              <input value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="e.g. SARS PBO number" className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60" />
            </label>
          </div>
          <label className="block text-xs text-muted-foreground">Support Amount (min {fmtRand(tier.min)} for {tier.name})
            <input type="number" min={tier.min} value={amount} onChange={(e) => setAmount(e.target.value)} required className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground" />
          </label>
          <label className="block text-xs text-muted-foreground">Custom Message
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} placeholder="A note to the team and community…" className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60" />
          </label>
          <button type="submit" disabled={processing} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-bold tracking-wide text-primary-foreground uppercase transition-opacity hover:opacity-90 disabled:opacity-60">
            {processing ? <><Loader2 className="size-4 animate-spin" /> Processing pledge…</> : done ? '✓ Pledge received — thank you!' : `Pledge as ${tier.name} Partner`}
          </button>
        </form>

        {pledges.length > 0 && (
          <div className="mt-4 divide-y divide-border">
            {pledges.map((p) => (
              <div key={p.id} className="py-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{p.company}</span>
                  <span className="font-semibold text-primary">{fmtRand(p.amount)}</span>
                </div>
                <p className="mt-0.5 text-muted-foreground">{p.tier} · {p.at}{p.message ? ` · “${p.message}”` : ''}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* sponsor wall & perks */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 font-display text-xl text-primary"><BadgeCheck className="size-5" /> Sponsor Wall</h2>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SEED_SPONSORS.map((s) => (
            <div key={s} className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 transition-colors hover:border-primary/50">
              <CheckCircle2 className="size-4 shrink-0 text-primary" />
              <span className="truncate text-xs font-semibold">{s}</span>
            </div>
          ))}
        </div>
        <h3 className="mt-5 text-xs font-semibold tracking-widest text-muted-foreground uppercase">Perks unlocked by tier</h3>
        <div className="mt-2 space-y-3">
          {TIERS.map((t) => (
            <div key={t.key} className="rounded-lg border border-border p-3">
              <p className="flex items-center gap-2 text-sm font-semibold"><t.icon className="size-4 text-primary" /> {t.name} <span className="text-[0.65rem] font-normal text-muted-foreground">· {fmtRand(t.min)}+</span></p>
              <ul className="mt-2 space-y-1">
                {t.perks.map((perk) => (
                  <li key={perk} className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="size-3.5 shrink-0 text-primary" /> {perk}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ----------------------------- test donation ----------------------------- */

function TestDonation({ onDonate }: { onDonate: (name: string, amount: number) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('250');
  const [card, setCard] = useState('4242 4242 4242 4242');
  const [busy, setBusy] = useState(false);
  const pay = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!name.trim() || !amt || amt <= 0) return;
    setBusy(true);
    setTimeout(() => {
      onDonate(name.trim(), amt);
      setBusy(false); setOpen(false); setName('');
      toast.success(`Test donation of ${fmtRand(amt)} successful`, { description: 'Simulation only — no money was charged.' });
    }, 1200);
  };
  const field = 'mt-1 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground';
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary bg-primary/10 py-3 text-sm font-bold tracking-wide text-primary uppercase hover:bg-primary/20">
          <HeartHandshake className="size-4" /> Make a test donation
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Test donation</DialogTitle>
          <DialogDescription>Payment simulation — no real card is charged.</DialogDescription>
        </DialogHeader>
        <form onSubmit={pay} className="space-y-3">
          <label className="block text-xs text-muted-foreground">Your name or company<input value={name} onChange={(e) => setName(e.target.value)} required className={field} /></label>
          <div className="flex gap-2">
            {[100, 250, 500, 1000].map((v) => (
              <button key={v} type="button" onClick={() => setAmount(String(v))} className={`flex-1 rounded-lg border py-2 text-xs font-semibold ${amount === String(v) ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}>{fmtRand(v)}</button>
            ))}
          </div>
          <label className="block text-xs text-muted-foreground">Amount (R)<input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} required className={field} /></label>
          <label className="block text-xs text-muted-foreground">Card number (test)<input value={card} onChange={(e) => setCard(e.target.value)} className={field} /></label>
          <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-bold text-primary-foreground uppercase disabled:opacity-60">
            {busy ? <><Loader2 className="size-4 animate-spin" /> Processing…</> : `Donate ${fmtRand(Number(amount) || 0)}`}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
