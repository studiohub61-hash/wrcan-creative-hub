import { useSyncExternalStore } from "react";

export const PLACEMENTS = ["Unplaced", "Training", "Interview", "Placed"] as const;
export const COMPLIANCE = ["Compliant", "Document Pending", "Non-Compliant"] as const;
export type Placement = (typeof PLACEMENTS)[number];
export type Compliance = (typeof COMPLIANCE)[number];
export type Student = {
  id: string; name: string; phone: string; email: string; cohort: string;
  attendance: number; pace: number; lastActivity: string; placement: Placement;
  compliance: Compliance; sponsor: string; flagged?: boolean; nudgedAt?: string;
};
export type RiskLevel = "Red" | "Amber" | "OK";

export const STORE_KEY = "wrcan.students.v1";
export const ATTENDANCE_MIN = 75;
export const INACTIVE_DAYS = 7;

const SEED: Student[] = [
  { id: "s1", name: "Lerato Mokoena", phone: "0712345678", email: "lerato@example.com", cohort: "Radio Presenting 2026", attendance: 92, pace: 80, lastActivity: "2026-11-02", placement: "Interview", compliance: "Compliant", sponsor: "Sample Sponsor A" },
  { id: "s2", name: "Sipho Dlamini", phone: "0723456789", email: "sipho@example.com", cohort: "ECD Practitioner", attendance: 68, pace: 55, lastActivity: "2026-10-20", placement: "Unplaced", compliance: "Document Pending", sponsor: "Sample Sponsor B" },
  { id: "s3", name: "Naledi Khumalo", phone: "0734567890", email: "naledi@example.com", cohort: "Media Production", attendance: 81, pace: 70, lastActivity: "2026-10-24", placement: "Training", compliance: "Non-Compliant", sponsor: "" },
  { id: "s4", name: "Thabo Nkosi", phone: "0745678901", email: "thabo@example.com", cohort: "Radio Presenting 2026", attendance: 97, pace: 95, lastActivity: "2026-11-01", placement: "Placed", compliance: "Compliant", sponsor: "Sample Sponsor A" },
];

const daysBetween = (from: string, now: Date) => Math.floor((now.getTime() - new Date(from + "T00:00:00Z").getTime()) / 86400000);

/** Red when both rules fail, Amber when one does. */
export function riskOf(s: Pick<Student, "attendance" | "lastActivity">, now: Date): RiskLevel {
  const low = s.attendance < ATTENDANCE_MIN;
  const stale = daysBetween(s.lastActivity, now) > INACTIVE_DAYS;
  return low && stale ? "Red" : low || stale ? "Amber" : "OK";
}

export function stats(list: Student[]) {
  const comp = Object.fromEntries(COMPLIANCE.map((c) => [c, list.filter((s) => s.compliance === c).length])) as Record<Compliance, number>;
  return {
    total: list.length,
    avgAttendance: list.length ? Math.round(list.reduce((a, s) => a + s.attendance, 0) / list.length) : 0,
    placed: list.filter((s) => s.placement === "Placed").length,
    compliance: comp,
  };
}

export const whatsappLink = (s: Student) => {
  const digits = s.phone.replace(/\D/g, "").replace(/^0/, "27");
  return `https://wa.me/${digits}?text=${encodeURIComponent(`Hi ${s.name.split(" ")[0]}, we miss you in ${s.cohort}! Please check in with WRCAN.`)}`;
};

// ---- shared store (device-local) ----
let cache: Student[] | null = null;
const listeners = new Set<() => void>();
function read(): Student[] {
  if (cache) return cache;
  try { const raw = localStorage.getItem(STORE_KEY); cache = raw ? JSON.parse(raw) : SEED; } catch { cache = SEED; }
  return cache!;
}
function write(next: Student[]) {
  cache = next;
  try { localStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => { if (e.key === STORE_KEY) { cache = null; l(); } };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(l); window.removeEventListener("storage", onStorage); };
}
export function useStudents() {
  return useSyncExternalStore(subscribe, read, () => SEED);
}
export const studentStore = {
  upsert(s: Student) { const l = read(); write(l.some((x) => x.id === s.id) ? l.map((x) => (x.id === s.id ? s : x)) : [...l, s]); },
  remove(id: string) { write(read().filter((x) => x.id !== id)); },
  patch(id: string, p: Partial<Student>) { write(read().map((x) => (x.id === id ? { ...x, ...p } : x))); },
};
