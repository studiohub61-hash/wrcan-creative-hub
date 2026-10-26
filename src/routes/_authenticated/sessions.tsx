import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, MapPin, Radio, Square, Users } from 'lucide-react';
import { Shell } from '@/components/Shell';
import { Field, RoseButton, inputClass } from '@/components/EmpireUI';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { broadcastEmbed, distanceMetres, geofenceStatus } from '@/lib/session-location';
import { toast } from 'sonner';

export const Route = createFileRoute('/_authenticated/sessions')({ head: () => ({ meta: [
  { title: 'Live Training & Field Sessions — WRCAN Hub' }, { name: 'description', content: 'Host or join live training broadcasts with optional, consent-based location sharing and geofence attendance.' },
  { property: 'og:title', content: 'Live Training & Field Sessions — WRCAN Hub' }, { property: 'og:description', content: 'Live broadcasts and private session attendance for WRCAN members.' },
  { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
] }), component: SessionsPage });
type Session = Tables<'hub_sessions'>;

function SessionsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;
  const [title, setTitle] = useState('');
  const [radius, setRadius] = useState('500');
  const [stream, setStream] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sharing, setSharing] = useState(false);
  const [consent, setConsent] = useState(false);
  const [position, setPosition] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const watch = useRef<number | null>(null);
  const lastSent = useRef(0);
  const generation = useRef(0);
  const isHost = session?.host_id === user?.id;
  const active = !!session && !session.closed_at && new Date(session.ends_at).getTime() > now;

  const stopTracking = useCallback(async () => {
    generation.current += 1;
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    setSharing(false);
    setPosition(null);
    const current = sessionRef.current;
    if (current && user) {
      const { error: deletionError } = await supabase.from('hub_session_locations').delete().eq('session_id', current.id).eq('user_id', user.id);
      if (deletionError) setError('Sharing stopped. The last location will expire from the live view within two minutes.');
    }
  }, [user?.id]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (session && !active) void stopTracking();
  }, [active, session?.id, stopTracking]);
  useEffect(() => {
    const stop = () => { void stopTracking(); };
    window.addEventListener('pagehide', stop);
    return () => { window.removeEventListener('pagehide', stop); void stopTracking(); };
  }, [stopTracking]);

  const { data: locations = [] } = useQuery({
    queryKey: ['session-locations', session?.id], enabled: !!session && active && !!isHost, refetchInterval: 10000,
    queryFn: async () => {
      if (!session) return [];
      const { data, error: e } = await supabase.from('hub_session_locations').select('*').eq('session_id', session.id).gt('updated_at', new Date(Date.now() - 120000).toISOString());
      if (e) throw e;
      return data;
    },
  });
  useEffect(() => {
    if (!session || !isHost || !active) return;
    const channel = supabase.channel(`session-${session.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'hub_session_locations', filter: `session_id=eq.${session.id}` }, () => { void qc.invalidateQueries({ queryKey: ['session-locations', session.id] }); }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [session?.id, isHost, active, qc]);
  useEffect(() => {
    if (!session || !active) return;
    const timer = window.setInterval(async () => {
      const { data } = await supabase.from('hub_sessions').select('*').eq('id', session.id).maybeSingle();
      if (!data || data.closed_at) { await stopTracking(); setSession(current => current ? { ...current, closed_at: new Date().toISOString() } : null); }
    }, 10000);
    return () => window.clearInterval(timer);
  }, [session?.id, active, stopTracking]);

  const currentPosition = () => new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Location is unavailable in this browser.')); return; }
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  });
  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setError(''); setBusy(true);
    try {
      const embed = broadcastEmbed(stream);
      if (stream.trim() && !embed) throw new Error('Enter a valid HTTPS YouTube video or live broadcast link.');
      const metres = Number(radius);
      if (!Number.isInteger(metres) || metres < 50 || metres > 50000) throw new Error('Choose a radius between 50 and 50,000 metres.');
      const p = await currentPosition();
      const { data, error: e } = await supabase.from('hub_sessions').insert({ host_id: user.id, title: title.trim(), radius_m: metres, latitude: p.coords.latitude, longitude: p.coords.longitude, stream_url: embed }).select().single();
      if (e) throw e;
      setSession(data); setConsent(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Allow location access to set the session centre.'); } finally { setBusy(false); }
  };
  const join = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    const { data, error: e } = await supabase.from('hub_sessions').select('*').eq('code', code.trim().toUpperCase()).is('closed_at', null).gt('ends_at', new Date().toISOString()).maybeSingle();
    setBusy(false);
    if (e || !data) { setError(e?.message ?? 'No active session with that code.'); return; }
    setSession(data); setConsent(false);
  };
  const startTracking = () => {
    if (!session || !user || !consent || !active || !navigator.geolocation) { setError('Location access is unavailable or consent is missing.'); return; }
    setError(''); setSharing(true); lastSent.current = 0;
    const currentSession = session;
    const currentUser = user;
    const epoch = ++generation.current;
    watch.current = navigator.geolocation.watchPosition(async p => {
      if (generation.current !== epoch) return;
      const point = { latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy };
      setPosition(point);
      if (Date.now() - lastSent.current < 10000) return;
      lastSent.current = Date.now();
      const { error: e } = await supabase.from('hub_session_locations').upsert({ session_id: currentSession.id, user_id: currentUser.id, ...point }, { onConflict: 'session_id,user_id' });
      if (generation.current !== epoch) { await supabase.from('hub_session_locations').delete().eq('session_id', currentSession.id).eq('user_id', currentUser.id); return; }
      if (e) { setError(`Location could not be shared: ${e.message}`); await stopTracking(); }
    }, e => { setError(e.code === 1 ? 'Location permission was denied. You can still watch without sharing.' : 'Could not get your location. Sharing has stopped.'); void stopTracking(); }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
  };
  const leave = async () => { await stopTracking(); setSession(null); setConsent(false); setCode(''); };
  const close = async () => {
    if (!session || !isHost) return;
    const { error: e } = await supabase.from('hub_sessions').update({ closed_at: new Date().toISOString() }).eq('id', session.id);
    if (e) { setError(e.message); return; }
    await stopTracking(); setSession({ ...session, closed_at: new Date().toISOString() });
  };
  const freshLocations = locations.filter(l => new Date(l.updated_at).getTime() > now - 120000);
  return <Shell title="Training sessions" subtitle="Live broadcasts · Field attendance">
    {error && <p role="alert" className="mb-4 break-words text-sm text-destructive">{error}</p>}
    {!session ? <>
      <form onSubmit={join} className="space-y-3 border-y border-border py-6"><h2 className="font-display text-xl flex items-center gap-2"><Radio className="size-5 text-primary" /> Join a session</h2><Field label="Session code"><input required aria-label="Session code" className={inputClass} value={code} maxLength={10} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} /></Field><RoseButton disabled={busy} type="submit">Join session</RoseButton></form>
      <form onSubmit={create} className="space-y-4 py-6"><h2 className="font-display text-xl">Host a training session</h2><Field label="Session title"><input required maxLength={160} aria-label="Session title" className={inputClass} value={title} onChange={e => setTitle(e.target.value)} /></Field><Field label="Training area radius (metres)"><input required type="number" min={50} max={50000} aria-label="Training area radius" className={inputClass} value={radius} onChange={e => setRadius(e.target.value)} /></Field><Field label="YouTube live broadcast link (optional)"><input type="url" aria-label="Broadcast link" className={inputClass} value={stream} onChange={e => setStream(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" /></Field><p className="text-xs text-muted-foreground">Your current location sets the training area's centre. Sessions end automatically after four hours. Only the host can view members’ shared locations.</p><RoseButton disabled={busy || !title.trim()} type="submit"><MapPin className="size-4" />{busy ? 'Please wait…' : 'Set centre & create'}</RoseButton></form>
    </> : <section className="space-y-5 py-4">
      <div className="border-y border-border py-4"><p className="text-xs uppercase text-primary">{active ? 'Active session' : 'Session ended'}{isHost ? ' · Host' : ''}</p><h2 className="font-display text-2xl mt-2 break-words">{session.title}</h2><div className="flex flex-wrap items-center gap-3 mt-3"><strong className="font-mono text-lg text-primary">{session.code}</strong><RoseButton variant="outline" className="!p-2" aria-label="Copy session code" title="Copy session code" onClick={async () => { try { await navigator.clipboard.writeText(session.code); toast.success('Session code copied'); } catch { setError('Copy is unavailable. Select the code above.'); } }}><Copy className="size-4" /></RoseButton></div><p className="text-xs text-muted-foreground mt-2">{session.radius_m}m radius · Ends {new Date(session.ends_at).toLocaleTimeString()}</p></div>
      {active && session.stream_url && <div><div className="aspect-video w-full bg-card"><iframe className="w-full h-full" src={broadcastEmbed(session.stream_url) ?? undefined} title="Live training broadcast" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /></div><p className="mt-2 text-xs text-muted-foreground">Broadcast hosted by YouTube. Live availability and audience capacity depend on the broadcast provider.</p></div>}
      {active && !session.stream_url && <p className="text-sm text-muted-foreground">No broadcast is attached to this field session.</p>}
      {active && <section className="border-y border-border py-5 space-y-3"><h3 className="font-display text-xl flex items-center gap-2"><MapPin className="size-5 text-primary" /> Session location</h3><p className="text-xs text-muted-foreground">Optional. While sharing, your precise location is sent to this session’s host about every 10 seconds. It stops when you leave, close this page, or the session ends. Keep this page open; background tracking is not guaranteed. GPS is approximate, not proof of attendance. Stopped or stale locations disappear from the live view within two minutes.</p>{!sharing ? <><label className="flex items-start gap-3 text-sm"><input className="mt-1 accent-primary" type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />I consent to sharing my live location with this session’s host.</label><RoseButton disabled={!consent} onClick={startTracking}><MapPin className="size-4" />Start sharing</RoseButton></> : <><p role="status" className="text-sm text-primary">● Location sharing is on{position ? ` · ${geofenceStatus(distanceMetres(session, position), position.accuracy, session.radius_m)} training area · accuracy ±${Math.round(position.accuracy)}m` : ' · Waiting for GPS…'}</p><RoseButton variant="outline" onClick={() => void stopTracking()}><Square className="size-4" />Stop sharing</RoseButton></>}</section>}
      {isHost && active && <section><h3 className="font-display text-xl flex items-center gap-2"><Users className="size-5 text-primary" />Live attendance ({freshLocations.length})</h3>{!freshLocations.length && <p className="text-sm text-muted-foreground mt-3">No members are sharing a current location.</p>}<ul className="divide-y divide-border">{freshLocations.map(loc => <li key={loc.user_id} className="py-3 flex flex-wrap gap-2 justify-between text-sm"><span>Member {loc.user_id.slice(0, 8)}</span><span className="text-primary">{geofenceStatus(distanceMetres(session, loc), loc.accuracy, session.radius_m)} · ±{Math.round(loc.accuracy)}m</span></li>)}</ul></section>}
      <div className="flex flex-wrap gap-3">{isHost && active && <RoseButton onClick={() => void close()}><Square className="size-4" />End session</RoseButton>}<RoseButton variant="outline" onClick={() => void leave()}>Leave session</RoseButton></div>
    </section>}
    <div className="border-t border-border py-6 text-xs text-muted-foreground"><p>For a large audience, attach an existing YouTube Live broadcast. Broadcast setup and streaming take place on YouTube; WRCAN does not provide its own mass-streaming service.</p><Link to="/media-studio" className="inline-block mt-3 text-primary underline">Open interactive small-group classroom</Link><span className="mx-2">·</span><Link to="/live-studio" className="text-primary underline">Practice control room</Link></div>
  </Shell>;
}