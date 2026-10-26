import { supabase } from "@/integrations/supabase/client";

const appId = import.meta.env['VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID'] as
  | string
  | undefined;
const vapidKey = import.meta.env['VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY'] as
  | string
  | undefined;

const firebaseConfig = {
  apiKey:
    (import.meta.env['VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY'] as
      | string
      | undefined) ?? "",
  projectId:
    (import.meta.env['VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID'] as
      | string
      | undefined) ?? "",
  appId: appId ?? "",
  messagingSenderId: appId?.split(":")[1] ?? "",
};

export type PushStatus =
  | "registered"
  | "not-configured"
  | "unsupported"
  | "open-in-new-tab"
  | "denied"
  | "error";

export type PushResult = { status: PushStatus; token?: string; message?: string };

export const pushStatusMessage: Record<PushStatus, string> = {
  registered: "Background push is armed on this device.",
  "not-configured": "Push is not configured for this build yet.",
  unsupported: "This browser can't receive background notifications.",
  "open-in-new-tab":
    "Open Wanda in its own browser tab (or install it to your home screen) to switch notifications on.",
  denied: "Notifications are blocked — enable them for this site in your browser settings.",
  error: "Could not enable notifications.",
};

/** Must be called from a user gesture. */
export async function enablePush(userId: string): Promise<PushResult> {
  if (
    !firebaseConfig.apiKey ||
    !firebaseConfig.projectId ||
    !appId ||
    !vapidKey ||
    !firebaseConfig.messagingSenderId
  ) {
    return { status: "not-configured" };
  }
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    return { status: "unsupported" };
  }

  const { getMessaging, getToken, isSupported, onMessage } = await import("firebase/messaging");
  if (!(await isSupported())) return { status: "unsupported" };
  if (window.top !== window.self) return { status: "open-in-new-tab" };

  const permission =
    Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return { status: "denied" };

  try {
    const { initializeApp, getApps } = await import("firebase/app");
    const query = new URLSearchParams({
      apiKey: firebaseConfig.apiKey,
      projectId: firebaseConfig.projectId,
      appId,
      messagingSenderId: firebaseConfig.messagingSenderId,
    }).toString();
    const registration = await navigator.serviceWorker.register(
      `/firebase-messaging-sw.js?${query}`,
    );
    const app = getApps()[0] ?? initializeApp(firebaseConfig);
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
    if (!token) return { status: "denied" };

    await supabase
      .from("device_tokens")
      .upsert(
        {
          user_id: userId,
          token,
          platform: /android/i.test(navigator.userAgent)
            ? "android"
            : /iphone|ipad|ipod/i.test(navigator.userAgent)
              ? "ios"
              : "web",
          user_agent: navigator.userAgent.slice(0, 300),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "token" },
      );

    // Foreground messages: show a native notification too.
    onMessage(messaging, (payload) => {
      const d = payload.data ?? {};
      if (document.visibilityState === "visible") return;
      void registration.showNotification(d['title'] ?? "Wanda", {
        body: d['body'] ?? "New message",
        icon: "/icons/icon-192.png",
        tag: d['conversationId'] ?? "wanda-chat",
      });
    });

    return { status: "registered", token };
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

export function pushPermission(): NotificationPermission | "unavailable" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unavailable";
  return Notification.permission;
}

/** Short attention chime for in-app arrivals (no asset download). */
export function chime() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.09);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
    osc.onended = () => void ctx.close();
  } catch {
    /* audio is best-effort */
  }
  try {
    navigator.vibrate?.([120, 60, 120]);
  } catch {
    /* vibration is best-effort */
  }
}
