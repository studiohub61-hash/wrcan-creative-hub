import { describe, expect, it } from "vitest";
import { clockActionError, duplicateRegistration, parseAttendance, parsePeople, profileStats, punctualityAt, PROFILES, ATTENDANCE_KEY, type AttendancePerson, type AttendanceEntry } from "@/lib/attendance";
import { photoDimensions, PHOTO_JPEG_QUALITY } from "@/lib/attendance-photo";

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
describe("lean photos and safe attendance actions", () => {
  it("caps landscape photos at 300px", () => expect(photoDimensions(4000, 3000)).toEqual({ width: 300, height: 225 }));
  it("caps portrait photos without stretching", () => expect(photoDimensions(3000, 4000)).toEqual({ width: 225, height: 300 }));
  it("does not enlarge small photos", () => expect(photoDimensions(120, 80)).toEqual({ width: 120, height: 80 }));
  it("uses 0.6 JPEG quality", () => expect(PHOTO_JPEG_QUALITY).toBe(0.6));
  const entry: AttendanceEntry = { id: "clock-1", personId: person.id, name: person.name, role: person.role, action: "In", timestamp: "2026-11-16T06:00:00Z", photo: "" };
  it("blocks consecutive clock-ins", () => expect(clockActionError(person, [entry], "In")).not.toBeNull());
  it("allows clock-out after clock-in", () => expect(clockActionError(person, [entry], "Out")).toBeNull());
  it("blocks clock-out without clock-in", () => expect(clockActionError(person, [], "Out")).not.toBeNull());
  it("allows the next clock-in after clock-out", () => expect(clockActionError(person, [entry, { ...entry, id: "out", action: "Out", timestamp: "2026-11-16T14:00:00Z" }], "In")).toBeNull());
  it("does not use another person's attendance", () => expect(clockActionError(person, [{ ...entry, personId: "other" }], "In")).toBeNull());
  it("rejects a duplicate identity number", () => expect(duplicateRegistration({ ...person, id: "new", identityNumber: " 123 " }, [person])).toBe(true));
  it("allows different identity numbers with matching names", () => expect(duplicateRegistration({ ...person, id: "new", identityNumber: "456" }, [person])).toBe(false));
});
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