import { describe, expect, it } from "vitest";
import { parseAttendance, parsePeople, profileStats, punctualityAt, PROFILES, ATTENDANCE_KEY, type AttendancePerson, type AttendanceEntry } from "@/lib/attendance";

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

const person: AttendancePerson = { id: "registered-1", name: "Test Person", role: "Parent / Farmer", identityNumber: "123", contact: "0710000000", site: "Test Farm", photo: "data:image/jpeg;base64,cGhvdG8=", startTime: "08:00", endTime: "16:00" };
describe("registration and custom shift sync", () => {
  it.each(["Teacher", "Child", "Parent / Farmer"] as const)("restores registered %s details and hours", role => {
    expect(parsePeople(JSON.stringify([{ ...person, role }]))).toEqual([{ ...person, role }]);
  });
  it("is on time exactly at custom start in Johannesburg", () => expect(punctualityAt(new Date("2026-11-11T06:00:00Z"), "08:00")).toBe("On Time"));
  it("is on time before custom start", () => expect(punctualityAt(new Date("2026-11-11T05:59:00Z"), "08:00")).toBe("On Time"));
  it("is late after custom start", () => expect(punctualityAt(new Date("2026-11-11T06:01:00Z"), "08:00")).toBe("Late"));
  it("compares against each person's custom start", () => expect(punctualityAt(new Date("2026-11-11T06:01:00Z"), "09:00")).toBe("On Time"));
  it("counts overnight clock-ins after midnight as late", () => expect(punctualityAt(new Date("2026-11-11T23:00:00Z"), "22:00", "06:00")).toBe("Late"));
  it("restores punctuality in registered people's logs", () => {
    const e = { id: "e1", personId: person.id, name: person.name, role: person.role, timestamp: "2026-11-11T06:01:00Z", action: "In", photo: person.photo, punctuality: "Late" };
    expect(parseAttendance(JSON.stringify([e]))).toEqual([e]);
  });
  it("updates count and latest rating without including clock-outs or matching names", () => {
    const base: AttendanceEntry = { id: "1", personId: person.id, name: person.name, role: person.role, timestamp: "2026-11-11T06:00:00Z", action: "In", photo: person.photo, punctuality: "On Time" };
    const entries: AttendanceEntry[] = [base, { ...base, id: "2", timestamp: "2026-11-12T06:01:00Z", punctuality: "Late" }, { ...base, id: "3", action: "Out" }, { ...base, id: "4", personId: "different-person" }];
    expect(profileStats(person, entries)).toEqual({ count: 2, onTime: 1, punctuality: "Late" });
  });
  it("rejects invalid custom hours and unsafe photos", () => {
    expect(parsePeople(JSON.stringify([{ ...person, startTime: "25:00" }, { ...person, photo: "javascript:alert(1)" }]))).toEqual([]);
  });
});