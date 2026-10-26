export function distanceMetres(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function geofenceStatus(distance: number, accuracy: number, radius: number) {
  if (distance + accuracy <= radius) return 'Inside';
  if (distance - accuracy > radius) return 'Outside';
  return 'Uncertain';
}
export function broadcastEmbed(value: string): string | null {
  if (!value.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase();
    let id = '';
    if (host === 'youtu.be') id = url.pathname.slice(1);
    if (['youtube.com', 'www.youtube.com'].includes(host)) id = url.searchParams.get('v') ?? url.pathname.match(/^\/(?:live|embed)\/([^/]+)$/)?.[1] ?? '';
    if (/^[\w-]{11}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
    return null;
  } catch { return null; }
}