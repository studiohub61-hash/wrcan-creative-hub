import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { BookOpen, Trash2, WifiOff } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { RoseButton, areaClass } from '@/components/EmpireUI';
import { readSavedModules, removeOfflineModule, type SavedModule } from '@/lib/offline-training';

export const Route = createFileRoute('/offline')({
  head: () => ({ meta: [
    { title: 'Saved Learning — WRCAN Hub' },
    { name: 'description', content: 'Read saved WRCAN training lessons and keep learning notes without a connection.' },
    { property: 'og:title', content: 'Saved Learning — WRCAN Hub' },
    { property: 'og:description', content: 'Your downloaded lessons and personal learning drafts.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }), component: OfflinePage,
});
function OfflinePage() {
  const [modules, setModules] = useState<SavedModule[]>([]);
  const [selected, setSelected] = useState<SavedModule | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { setModules(readSavedModules()); }, []);
  const open = (mod: SavedModule) => { setSelected(mod); try { setDraft(localStorage.getItem(`wrcan-learning-draft-${mod.id}`) ?? ''); } catch { setError('Notes are unavailable on this device.'); } };
  return <Shell title="Saved learning" subtitle="Available on this device">
    <div className="flex items-center gap-2 border-y border-border py-4 text-sm text-muted-foreground"><WifiOff className="size-5 shrink-0 text-primary" /> Lessons and notes stay on this device. Assessments and certificates need a connection.</div>
    {error && <p role="alert" className="py-3 text-sm text-destructive">{error}</p>}
    {!modules.length ? <p className="py-8 text-sm text-muted-foreground">No saved modules yet. Open a training module while connected and choose “Save offline”.</p> : <div className="divide-y divide-border">{modules.map(mod => <div key={mod.id} className="flex items-center gap-3 py-4"><BookOpen className="size-5 text-primary shrink-0" /><div className="min-w-0 flex-1"><h2 className="font-display text-lg break-words">{mod.title}</h2><p className="text-xs text-muted-foreground">{mod.provider} · {mod.lessons.length} lessons</p><RoseButton variant="outline" className="mt-2 !px-4 !py-2" onClick={() => open(mod)}>Read lessons</RoseButton></div><RoseButton variant="outline" title="Remove saved module" aria-label={`Remove ${mod.title}`} className="!p-2" onClick={() => { try { removeOfflineModule(mod.id); setModules(readSavedModules()); if (selected?.id === mod.id) setSelected(null); } catch { setError('Could not remove this module.'); } }}><Trash2 className="size-4" /></RoseButton></div>)}</div>}
    {selected && <section className="border-t border-border pt-6 pb-8"><h2 className="font-display text-2xl">{selected.title}</h2>{selected.lessons.map(lesson => <article className="py-5 border-b border-border" key={lesson.title}><h3 className="font-display text-lg text-primary">{lesson.title}</h3>{lesson.body.map(p => <p key={p} className="mt-3 text-sm leading-relaxed text-muted-foreground">{p}</p>)}<ul className="mt-3 space-y-1 text-sm">{lesson.takeaways.map(t => <li key={t}>• {t}</li>)}</ul></article>)}<label className="block mt-6 text-sm">My learning draft<textarea aria-label="My learning draft" className={`${areaClass} mt-2`} rows={6} value={draft} onChange={e => { setDraft(e.target.value); try { localStorage.setItem(`wrcan-learning-draft-${selected.id}`, e.target.value); setError(''); } catch { setError('Your notes could not be saved. Device storage may be full.'); } }} /></label><p className="mt-2 text-xs text-muted-foreground">Saved automatically on this device only.</p></section>}
  </Shell>;
}