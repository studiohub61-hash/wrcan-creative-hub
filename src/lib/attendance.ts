export const ATTENDANCE_ROLES = ["Teacher", "Child", "Parent / Farmer"] as const;
export type AttendanceRole = typeof ATTENDANCE_ROLES[number];
export type AttendanceAction = "In" | "Out";
export type Punctuality = "On Time" | "Late";
export type AttendancePerson = { id: string; name: string; role: AttendanceRole; identityNumber: string; contact: string; site: string; photo: string; startTime: string; endTime: string };
export type AttendanceEntry = { id: string; personId?: string; name: string; role: AttendanceRole; timestamp: string; action: AttendanceAction; photo: string; punctuality?: Punctuality };
export const ATTENDANCE_KEY = "wrcan.attendance.v1";
export const PEOPLE_KEY = "wrcan.attendance.people.v1";
export const PROFILES: Record<AttendanceRole, { id: string; name: string }[]> = {
  Teacher: [{ id: "teacher-1", name: "Nomsa Dlamini" }, { id: "teacher-2", name: "Thandi Nkosi" }, { id: "teacher-3", name: "Lerato Molefe" }],
  Child: [{ id: "child-1", name: "Amani Mokoena" }, { id: "child-2", name: "Luhle Ndlovu" }, { id: "child-3", name: "Zoe Jacobs" }, { id: "child-4", name: "Sipho Khumalo" }],
  "Parent / Farmer": [],
};

export function isAttendanceRole(value: unknown): value is AttendanceRole {
  return ATTENDANCE_ROLES.some(role => role === value);
}

export function isPhoto(value: unknown): value is string {
  return typeof value === "string" && (value === "" || /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value));
}

export function isShiftTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function samplePeople(): AttendancePerson[] {
  return ATTENDANCE_ROLES.flatMap(role => PROFILES[role].map(p => ({ ...p, role, identityNumber: "", contact: "", site: "Sample SmartStart site", photo: "", startTime: "08:00", endTime: "16:00" })));
}

export function parsePeople(raw: string | null): AttendancePerson[] {
  if (!raw) return [];
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error("Invalid saved people");
  return data.filter((person): person is AttendancePerson => {
    if (!person || typeof person !== "object") return false;
    const p = person as Record<string, unknown>;
    return typeof p['id'] === "string" && typeof p['name'] === "string" && p['name'].trim().length > 0 && isAttendanceRole(p['role']) && typeof p['identityNumber'] === "string" && typeof p['contact'] === "string" && typeof p['site'] === "string" && isPhoto(p['photo']) && isShiftTime(p['startTime']) && isShiftTime(p['endTime']);
  });
}

// Custom shift hours are South African local time, irrespective of the browser timezone.
export function punctualityAt(timestamp: Date, startTime: string, endTime = "23:59"): Punctuality {
  if (!isShiftTime(startTime) || !isShiftTime(endTime)) throw new Error("Invalid shift hours");
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(timestamp);
  const hour = Number(parts.find(p => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find(p => p.type === "minute")?.value ?? 0);
  const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  let current = hour * 60 + minute;
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  if (start > end && current <= end) current += 1440;
  return current > start ? "Late" : "On Time";
}

export function profileStats(person: AttendancePerson, entries: AttendanceEntry[]) {
  const clockIns = entries.filter(e => e.action === "In" && (e.personId ? e.personId === person.id : e.role === person.role && e.name === person.name && PROFILES[person.role].some(p => p.id === person.id)));
  const ordered = [...clockIns].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  const rating = (e: AttendanceEntry) => e.punctuality ?? punctualityAt(new Date(e.timestamp), person.startTime, person.endTime);
  return { count: clockIns.length, onTime: clockIns.filter(e => rating(e) === "On Time").length, punctuality: ordered[0] ? rating(ordered[0]) : null };
}

export function parseAttendance(raw: string | null): AttendanceEntry[] {
  if (!raw) return [];
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error("Invalid saved attendance");
  return data.filter((entry): entry is AttendanceEntry => {
    if (!entry || typeof entry !== "object") return false;
    const e = entry as Record<string, unknown>;
    return typeof e['id'] === "string" && typeof e['name'] === "string" && isAttendanceRole(e['role']) && (e['action'] === "In" || e['action'] === "Out") && typeof e['timestamp'] === "string" && Number.isFinite(Date.parse(e['timestamp'])) && isPhoto(e['photo']) && (e['personId'] === undefined || typeof e['personId'] === "string") && (e['punctuality'] === undefined || e['punctuality'] === "On Time" || e['punctuality'] === "Late");
  });
}