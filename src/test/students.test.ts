import { describe, it, expect } from "vitest";
import { riskOf, stats, type Student } from "@/lib/students";

const now = new Date("2026-11-03T00:00:00Z");
describe("early warning", () => {
  it("attendance below 75% is at risk", () => expect(riskOf({ attendance: 74, lastActivity: "2026-11-02" }, now)).toBe("Amber"));
  it("75% attendance and recent activity is on track", () => expect(riskOf({ attendance: 75, lastActivity: "2026-11-02" }, now)).toBe("OK"));
  it("more than 7 days inactive is at risk", () => expect(riskOf({ attendance: 90, lastActivity: "2026-10-26" }, now)).toBe("Amber"));
  it("exactly 7 days inactive is not flagged", () => expect(riskOf({ attendance: 90, lastActivity: "2026-10-27" }, now)).toBe("OK"));
  it("both rules failing is red", () => expect(riskOf({ attendance: 50, lastActivity: "2026-10-01" }, now)).toBe("Red"));
});
it("stats count placed and compliance", () => {
  const base = { id: "", name: "", phone: "", email: "", cohort: "", pace: 0, lastActivity: "2026-11-01", sponsor: "" };
  const list: Student[] = [
    { ...base, id: "a", attendance: 80, placement: "Placed", compliance: "Compliant" },
    { ...base, id: "b", attendance: 60, placement: "Training", compliance: "Non-Compliant" },
  ];
  const s = stats(list);
  expect(s).toMatchObject({ total: 2, avgAttendance: 70, placed: 1 });
  expect(s.compliance.Compliant).toBe(1);
});
