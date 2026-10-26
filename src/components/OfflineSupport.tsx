import { useEffect, useState } from 'react';
import { Link, useRouter } from '@tanstack/react-router';
import { WifiOff } from 'lucide-react';

export function OfflineSupport() {
  const router = useRouter();
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/offline-sw.js', { scope: '/' }).then(async () => {
        await navigator.serviceWorker.ready;
        await router.preloadRoute({ to: '/offline' });
      }).catch(() => { /* Installation may be blocked by browser privacy settings. */ });
    }
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, [router]);
  return offline ? <Link to="/offline" className="fixed top-0 inset-x-0 z-50 flex justify-center items-center gap-2 bg-primary text-primary-foreground py-2 text-xs"><WifiOff className="size-4" /> Offline · Saved learning</Link> : null;
}