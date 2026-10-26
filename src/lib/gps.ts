/** Best-effort GPS fix for uploads. Resolves to nulls if denied or slow. */
export function getGps(timeoutMs = 6000): Promise<{ latitude: number | null; longitude: number | null }> {
  return new Promise((resolve) => {
    const none = { latitude: null, longitude: null };
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(none);
    const t = window.setTimeout(() => resolve(none), timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        window.clearTimeout(t);
        resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude });
      },
      () => {
        window.clearTimeout(t);
        resolve(none);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 120_000 },
    );
  });
}
