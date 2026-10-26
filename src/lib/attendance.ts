export type AttendanceRole = "Teacher" | "Child";
export type AttendanceAction = "In" | "Out";
export type AttendanceEntry = { id: string; name: string; role: AttendanceRole; timestamp: string; action: AttendanceAction; photo: string };
export const ATTENDANCE_KEY = "wrcan.attendance.v1";
export const PROFILES = {
  Teacher: [{ id: "teacher-1", name: "Nomsa Dlamini" }, { id: "teacher-2", name: "Thandi Nkosi" }, { id: "teacher-3", name: "Lerato Molefe" }],
  Child: [{ id: "child-1", name: "Amani Mokoena" }, { id: "child-2", name: "Luhle Ndlovu" }, { id: "child-3", name: "Zoe Jacobs" }, { id: "child-4", name: "Sipho Khumalo" }],
};

export function parseAttendance(raw: string | null): AttendanceEntry[] {
  if (!raw) return [];
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error("Invalid saved attendance");
  return data.filter((entry): entry is AttendanceEntry => {
    if (!entry || typeof entry !== "object") return false;
    const e = entry as Record<string, unknown>;
    return typeof e['id'] === "string" && typeof e['name'] === "string" && (e['role'] === "Teacher" || e['role'] === "Child") && (e['action'] === "In" || e['action'] === "Out") && typeof e['timestamp'] === "string" && Number.isFinite(Date.parse(e['timestamp'])) && typeof e['photo'] === "string" && e['photo'].startsWith("data:image/jpeg;base64,");
  });
}