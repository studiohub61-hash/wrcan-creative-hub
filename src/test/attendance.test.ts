import { describe, expect, it } from "vitest";
import { parseAttendance, PROFILES, ATTENDANCE_KEY } from "@/lib/attendance";

describe("device-local attendance", () => {
  it("provides teacher and child mock profiles immediately", () => {
    expect(PROFILES.Teacher[0]?.name).toBe("Nomsa Dlamini");
    expect(PROFILES.Child[0]?.name).toBe("Amani Mokoena");
  });
  it("restores clock-in and clock-out records with photos", () => {
    const records = ["In", "Out"].map((action, i) => ({ id: String(i), name: "Nomsa Dlamini", role: "Teacher", timestamp: "2026-10-22T08:00:00.000Z", action, photo: "data:image/jpeg;base64,cGhvdG8=" }));
    localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(records));
    expect(parseAttendance(localStorage.getItem(ATTENDANCE_KEY))).toEqual(records);
    localStorage.removeItem(ATTENDANCE_KEY);
  });
  it("rejects malformed or non-image records", () => {
    expect(parseAttendance(JSON.stringify([{ id: "1", name: "Test", role: "Child", timestamp: "2026-10-22", action: "In", photo: "javascript:alert(1)" }]))).toEqual([]);
    expect(() => parseAttendance("not json")).toThrow();
    expect(parseAttendance(null)).toEqual([]);
  });
});