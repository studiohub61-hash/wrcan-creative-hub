// Ward 50 (Snake Park) Manager & Coach Dashboard — demo data + logic.
// Device-local demo: review decisions persist in localStorage, no cloud writes yet.

export type WardMode = "coach" | "manager";
export type EvidenceCategory = "Morning Alert" | "Attendance" | "Nutrition" | "Infrastructure";
export type EvidenceStatus = "pending" | "approved" | "rejected" | "needs_work";
export type ReviewStatus = Exclude<EvidenceStatus, "pending">;
export type EcdTier = "Bronze" | "Progressing" | "Silver Ready";

export type Coach = { id: string; name: string; phone: string; ecds: number; battery: number; reviewed: number; gpsLive: boolean };
export type Ecd = { id: string; name: string; principal: string; coachId: string; daysIn: number; tier: EcdTier; checked: number[] };
export type Evidence = {
  id: string;
  ecdId: string;
  coachId: string;
  category: EvidenceCategory;
  text: string;
  hoursAgo: number;
  gps: { latitude: number; longitude: number; accuracy: number };
  status: EvidenceStatus;
  comment: string;
  meetsItem: number | null;
};
export type Review = { status: ReviewStatus; comment: string };
export type Filters = { ecdId: string; category: string; status: string; from: string; to: string };

export const REVIEW_KEY = "wrcan.ward50.v1";
export const TRACKER_ITEMS = 15;
export const RED_FLAG_DAYS = 3;
export const PROGRAM_DAYS = 60;

export const BRONZE_SILVER_ITEMS = [
  "Registration & permit displayed",
  "Daily attendance register kept",
  "Staff police clearance on file",
  "Emergency contact list current",
  "First-aid kit stocked",
  "Safe play area inspected",
  "Daily nutrition menu posted",
  "Nap & rest space clean",
  "Handwashing point working",
  "Fire extinguisher serviced",
  "Learning materials per child",
  "Daily programme timetable visible",
  "Parent committee meeting held",
  "Child protection policy signed",
  "Health & safety inspection passed",
];

const SNAKE_PARK = { latitude: -26.2593, longitude: 27.8571 };

function seed(
  id: string,
  ecdId: string,
  coachId: string,
  category: EvidenceCategory,
  text: string,
  hoursAgo: number,
  status: EvidenceStatus,
  comment: string,
  meetsItem: number | null = null,
): Evidence {
  const n = Number(id.slice(-2)) || 0;
  return {
    id, ecdId, coachId, category, text, hoursAgo, status, comment, meetsItem,
    gps: { latitude: SNAKE_PARK.latitude + (n % 7) * 0.0012, longitude: SNAKE_PARK.longitude + (n % 5) * 0.0011, accuracy: 7 + (n % 9) },
  };
}

export const COACHES: Coach[] = [
  { id: "c1", name: "Themba Dube", phone: "+27 71 234 5678", ecds: 8, battery: 72, reviewed: 21, gpsLive: true },
  { id: "c2", name: "Kholiwe Ndlovu", phone: "+27 82 447 1190", ecds: 9, battery: 45, reviewed: 17, gpsLive: true },
  { id: "c3", name: "Priya Singh", phone: "+27 61 903 2244", ecds: 8, battery: 88, reviewed: 23, gpsLive: false },
];

export const ECD_LIST: Ecd[] = [
  { id: "ecd-001", name: "Little Stars ECD", principal: "Grace Mahlangu", coachId: "c1", daysIn: 22, tier: "Progressing", checked: [0, 1, 3, 4] },
  { id: "ecd-002", name: "Ubuntu Creche", principal: "Samukelo Ngcobo", coachId: "c1", daysIn: 12, tier: "Progressing", checked: [0, 4, 7] },
  { id: "ecd-003", name: "Thandekile Day Care", principal: "Nomvula Zwane", coachId: "c1", daysIn: 47, tier: "Silver Ready", checked: [0, 1, 2, 4, 6, 9, 13] },
  { id: "ecd-004", name: "Bright Beginnings", principal: "Thulani Mabaso", coachId: "c1", daysIn: 9, tier: "Progressing", checked: [0, 5] },
  { id: "ecd-005", name: "Snake Park Kids Haven", principal: "Busisiwe Mkhize", coachId: "c1", daysIn: 6, tier: "Bronze", checked: [4] },
  { id: "ecd-006", name: "Ikusasa Early Learning", principal: "Jabu Sithole", coachId: "c1", daysIn: 18, tier: "Progressing", checked: [1, 4, 6] },
  { id: "ecd-007", name: "Sizanani Educare", principal: "Pretty Mahlaba", coachId: "c1", daysIn: 48, tier: "Silver Ready", checked: [0, 1, 2, 4, 6, 10, 13] },
  { id: "ecd-008", name: "Vutha Day Care", principal: "Lindiwe Rakoma", coachId: "c1", daysIn: 3, tier: "Bronze", checked: [] },
  { id: "ecd-009", name: "Thembelihle Creche", principal: "Zanele Khoza", coachId: "c2", daysIn: 8, tier: "Bronze", checked: [4, 8] },
  { id: "ecd-010", name: "Jabulani Toddlers", principal: "Bongi Mdluli", coachId: "c2", daysIn: 14, tier: "Bronze", checked: [0, 1] },
  { id: "ecd-011", name: "Rea Hlasela ECD", principal: "Tebogo Monyane", coachId: "c2", daysIn: 11, tier: "Bronze", checked: [3] },
  { id: "ecd-012", name: "Mamelani Kids", principal: "Ayanda Mahlambi", coachId: "c3", daysIn: 44, tier: "Silver Ready", checked: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] },
  { id: "ecd-013", name: "Zizanani Playgroup", principal: "Nomsa Baloyi", coachId: "c1", daysIn: 25, tier: "Progressing", checked: [0, 1, 4] },
  { id: "ecd-014", name: "Pholosho Centre", principal: "Elias Mahlangu", coachId: "c2", daysIn: 45, tier: "Silver Ready", checked: [0, 1, 2, 4, 5, 8, 13] },
  { id: "ecd-015", name: "Dedication Day Care", principal: "Khosi Mabuza", coachId: "c2", daysIn: 7, tier: "Bronze", checked: [] },
  { id: "ecd-016", name: "Spring of Hope", principal: "Puleng Motloung", coachId: "c2", daysIn: 20, tier: "Progressing", checked: [1, 4, 6] },
  { id: "ecd-017", name: "Lerato Educare", principal: "Mpho Nkosi", coachId: "c2", daysIn: 4, tier: "Bronze", checked: [] },
  { id: "ecd-018", name: "Bright Path Academy", principal: "Sipho Mahlangu", coachId: "c3", daysIn: 30, tier: "Progressing", checked: [0, 1, 4, 12] },
  { id: "ecd-019", name: "Siyakhula Kids", principal: "Ntombi Langa", coachId: "c3", daysIn: 16, tier: "Progressing", checked: [1, 4] },
  { id: "ecd-020", name: "Amohela Bana", principal: "Kagiso Tshabalala", coachId: "c3", daysIn: 27, tier: "Progressing", checked: [0, 4, 9] },
  { id: "ecd-021", name: "Mvula Day Care", principal: "Refiloe Sibanyoni", coachId: "c2", daysIn: 5, tier: "Bronze", checked: [] },
  { id: "ecd-022", name: "Tshepo Centre", principal: "Mandla Mavuso", coachId: "c3", daysIn: 50, tier: "Silver Ready", checked: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] },
  { id: "ecd-023", name: "Phakamisa ECD", principal: "Zodwa Mzila", coachId: "c3", daysIn: 34, tier: "Progressing", checked: [0, 4, 6, 9] },
  { id: "ecd-024", name: "Joyful Hearts Creche", principal: "Ayanda Mahlaba", coachId: "c3", daysIn: 21, tier: "Progressing", checked: [1, 4] },
  { id: "ecd-025", name: "Young Achievers", principal: "Vusi Mnguni", coachId: "c3", daysIn: 10, tier: "Progressing", checked: [0, 4] },
];

export const SEED_EVIDENCE: Evidence[] = [
  seed("ev-01", "ecd-007", "c1", "Morning Alert", "07:30 gates open, 22 children signed in, morning song under the tree", 3, "approved", ""),
  seed("ev-02", "ecd-007", "c1", "Attendance", "Register complete, 2 absentees phoned parents", 26, "approved", ""),
  seed("ev-03", "ecd-007", "c1", "Nutrition", "Kitchen inspected, lentil stew menu posted", 3, "approved", "", 6),
  seed("ev-04", "ecd-014", "c2", "Nutrition", "Porridge served, kitchen door latch broken — repair needed", 5, "needs_work", "Please photograph the latch repair when it is done."),
  seed("ev-05", "ecd-014", "c2", "Attendance", "18 of 21 present, register filled", 28, "approved", ""),
  seed("ev-06", "ecd-022", "c3", "Infrastructure", "New handwashing stand installed outside the toilets", 8, "approved", "", 8),
  seed("ev-07", "ecd-022", "c3", "Morning Alert", "Principal signed the child protection policy with the committee", 30, "approved", "", 13),
  seed("ev-08", "ecd-002", "c1", "Morning Alert", "Circle time started 08:00, all staff present", 4, "approved", ""),
  seed("ev-09", "ecd-003", "c1", "Nutrition", "Food delivery received, stock sheet updated", 6, "pending", ""),
  seed("ev-10", "ecd-005", "c1", "Infrastructure", "Play area fence panel loose — flagged to centre", 7, "rejected", "Photo too dark to verify the fence — please retake."),
  seed("ev-11", "ecd-009", "c2", "Attendance", "Register kept by hand, printed register still needed", 9, "pending", ""),
  seed("ev-12", "ecd-012", "c3", "Morning Alert", "Staff police clearance copies collected and filed", 50, "approved", "", 2),
  seed("ev-13", "ecd-016", "c2", "Nutrition", "Garden beds planted with spinach for the feeding scheme", 55, "approved", ""),
  seed("ev-14", "ecd-011", "c2", "Attendance", "Last visit: register checked with principal", 121, "pending", ""),
  seed("ev-16", "ecd-020", "c3", "Infrastructure", "Fire extinguisher serviced, service tag photographed", 76, "approved", "", 9),
  seed("ev-17", "ecd-004", "c1", "Attendance", "New children registered, 24 on roll", 20, "approved", ""),
  seed("ev-19", "ecd-001", "c1", "Morning Alert", "Morning exercise circle on the lawn, weather fine", 2, "approved", ""),
  seed("ev-20", "ecd-006", "c1", "Nutrition", "Fruit delivered, cold storage at 4°C", 4, "approved", ""),
  seed("ev-21", "ecd-010", "c1", "Attendance", "Register signed, 19 of 23 present", 21, "approved", ""),
  seed("ev-22", "ecd-013", "c1", "Morning Alert", "Morning Alert checklist complete, gates locked behind parents", 26, "approved", ""),
  seed("ev-23", "ecd-018", "c3", "Morning Alert", "Staff arrival recorded, timetable visible on wall", 5, "approved", ""),
  seed("ev-24", "ecd-019", "c3", "Attendance", "Register complete, 2 late arrivals logged", 8, "approved", ""),
  seed("ev-25", "ecd-023", "c3", "Nutrition", "Menu week 3 posted, protein portion confirmed", 44, "approved", ""),
  seed("ev-26", "ecd-005", "c1", "Infrastructure", "Toilet door hinge fixed after last review", 52, "approved", ""),
  seed("ev-27", "ecd-021", "c2", "Morning Alert", "First visit completed, centre walkthrough done", 3, "approved", ""),
  seed("ev-28", "ecd-024", "c3", "Attendance", "Attendance register introduced to staff", 27, "approved", ""),
  seed("ev-11b", "ecd-015", "c2", "Nutrition", "Menu photographed, needs bigger print", 11, "pending", ""),
  seed("ev-12b", "ecd-008", "c1", "Morning Alert", "Opening day walkthrough, no photo yet", 5, "pending", ""),
];

/** Demo "today" is fixed so seed ages stay consistent; the UI passes real Date.now(). */
export const DEMO_NOW = new Date("2026-10-26T08:00:00.000Z");

export function evidenceAt(entry: Evidence, now: number): string {
  return new Date(now - entry.hoursAgo * 3_600_000).toISOString();
}

export function daysInProgram(ecd: Ecd): number {
  return Math.min(PROGRAM_DAYS, ecd.daysIn);
}

export function daysLeft(ecd: Ecd): number {
  return Math.max(0, PROGRAM_DAYS - ecd.daysIn);
}

export function startDate(ecd: Ecd, now: number): string {
  return new Date(now - ecd.daysIn * 86_400_000).toISOString().slice(0, 10);
}

/** Tracker item is met when the centre pre-checked it or approved evidence covers it. */
export function trackerMet(ecd: Ecd, evidence: Evidence[]): number[] {
  const met = new Set(ecd.checked);
  for (const ev of evidence) {
    if (ev.ecdId === ecd.id && ev.status === "approved" && ev.meetsItem !== null) met.add(ev.meetsItem);
  }
  return [...met].filter((i) => i >= 0 && i < TRACKER_ITEMS).sort((a, b) => a - b);
}

export function trackerProgress(ecd: Ecd, evidence: Evidence[]): number {
  return Math.round((trackerMet(ecd, evidence).length / TRACKER_ITEMS) * 100);
}

export function redFlags(ecds: Ecd[], evidence: Evidence[], now: number): { ecd: Ecd; daysSince: number | null }[] {
  const out: { ecd: Ecd; daysSince: number | null }[] = [];
  for (const ecd of ecds) {
    const own = evidence.filter((ev) => ev.ecdId === ecd.id);
    if (!own.length) { out.push({ ecd, daysSince: null }); continue; }
    const latest = Math.min(...own.map((ev) => ev.hoursAgo));
    const days = Math.floor(latest / 24);
    if (days >= RED_FLAG_DAYS) out.push({ ecd, daysSince: days });
  }
  return out;
}

export function kpiStats(ecds: Ecd[], evidence: Evidence[]): { total: number; compliance: number; avgDays: number; readyGold: number } {
  const total = evidence.length;
  const approved = evidence.filter((ev) => ev.status === "approved").length;
  const silver = ecds.filter((e) => e.tier === "Silver Ready");
  const avgDays = silver.length ? Math.round(silver.reduce((s, e) => s + e.daysIn, 0) / silver.length) : 0;
  return {
    total: ecds.length,
    compliance: total ? Math.round((approved / total) * 100) : 0,
    avgDays,
    readyGold: ecds.filter((e) => trackerProgress(e, evidence) === 100).length,
  };
}

export function tasksToday(coachId: string, ecds: Ecd[], evidence: Evidence[]): { assigned: number; notSubmitted: number; flagged: number } {
  const assigned = ecds.filter((e) => e.coachId === coachId);
  const submitted = new Set(evidence.filter((ev) => ev.coachId === coachId && ev.hoursAgo <= 24).map((ev) => ev.ecdId));
  const notSubmitted = assigned.filter((e) => !submitted.has(e.id)).length;
  const flagged = evidence.filter((ev) => ev.coachId === coachId && ev.hoursAgo <= 24 && (ev.status === "needs_work" || ev.status === "rejected")).length;
  return { assigned: assigned.length, notSubmitted, flagged };
}

export function qualityByCategory(evidence: Evidence[]): { category: EvidenceCategory; percent: number; count: number }[] {
  const categories: EvidenceCategory[] = ["Morning Alert", "Attendance", "Nutrition", "Infrastructure"];
  return categories.map((category) => {
    const own = evidence.filter((ev) => ev.category === category);
    const approved = own.filter((ev) => ev.status === "approved").length;
    return { category, percent: own.length ? Math.round((approved / own.length) * 100) : 0, count: own.length };
  });
}

export function inRange(timestamp: string, from: string, to: string): boolean {
  const day = timestamp.slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

export function applyFilters(evidence: Evidence[], filters: Filters, now: number): Evidence[] {
  return evidence
    .map((ev) => ({ ...ev, timestamp: evidenceAt(ev, now) }))
    .filter((ev) => {
      if (filters.ecdId && ev.ecdId !== filters.ecdId) return false;
      if (filters.category && ev.category !== filters.category) return false;
      if (filters.status && ev.status !== filters.status) return false;
      return inRange(ev.timestamp, filters.from, filters.to);
    })
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function formatGps(gps: Evidence["gps"]): string {
  return `${gps.latitude.toFixed(4)}°, ${gps.longitude.toFixed(4)}° (±${gps.accuracy} m)`;
}

export function coachDailyRows(evidence: Evidence[], ecds: Ecd[]): Record<string, unknown>[] {
  const byId = new Map(ecds.map((e) => [e.id, e]));
  return evidence.map((ev) => {
    const ecd = byId.get(ev.ecdId);
    return {
      ECD_ID: ev.ecdId,
      ECD_Name: ecd?.name ?? "",
      Principal_Name: ecd?.principal ?? "",
      Date: ev.timestamp.slice(0, 10),
      Evidence_Type: ev.category,
      Photo_URL: "",
      GPS_Lat: ev.gps.latitude.toFixed(6),
      GPS_Lon: ev.gps.longitude.toFixed(6),
      Status: ev.status,
      Coach_Comment: ev.comment,
      Coach_Name: COACHES.find((c) => c.id === ev.coachId)?.name ?? "",
    };
  });
}

export function managerWeeklyRows(ecds: Ecd[], evidence: Evidence[], now: number): Record<string, unknown>[] {
  return ecds.map((ecd) => {
    const own = evidence.filter((ev) => ev.ecdId === ecd.id);
    const approved = own.filter((ev) => ev.status === "approved").length;
    const latest = own.length ? Math.min(...own.map((ev) => ev.hoursAgo)) : null;
    const flagged = own.filter((ev) => ev.status === "rejected" || ev.status === "needs_work").length;
    return {
      ECD_ID: ecd.id,
      Total_Submitted: own.length,
      Approved: approved,
      Compliance_Rate: own.length ? Math.round((approved / own.length) * 100) : 0,
      Bronze_Items_Completed: trackerMet(ecd, evidence).length,
      Silver_Ready: trackerProgress(ecd, evidence) === 100 ? "Y" : "N",
      Days_In_Program: daysInProgram(ecd),
      Last_Date: latest === null ? "" : new Date(now - latest * 3_600_000).toISOString().slice(0, 10),
      Flagged_Issues: flagged,
    };
  });
}

export function parseReviews(raw: string | null): Record<string, Review> {
  if (!raw) return {};
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid saved reviews");
  const out: Record<string, Review> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const v = value as Record<string, unknown>;
    if (v["status"] !== "approved" && v["status"] !== "rejected" && v["status"] !== "needs_work") continue;
    if (typeof v["comment"] !== "string") continue;
    out[key] = { status: v["status"], comment: v["comment"] };
  }
  return out;
}

export function applyReviews(evidence: Evidence[], reviews: Record<string, Review>): Evidence[] {
  return evidence.map((ev) => {
    const review = reviews[ev.id];
    return review ? { ...ev, status: review.status, comment: review.comment } : ev;
  });
}
