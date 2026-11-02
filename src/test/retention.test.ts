import { describe, expect, it } from "vitest";
import { calculateRetention, STUDENTS, filterStudents, donorReport } from "@/lib/retention";

describe("sample retention model", () => {
  it("calculates the 30 enrolled, 28 active cohort against 55% retention at R59,200", () => {
    const result = calculateRetention(30, 28, 55, 59200);
    expect(result.baselineLoss).toBe(799200);
    expect(result.actualLoss).toBe(118400);
    expect(result.savings).toBe(680800);
    expect(result.retention).toBeCloseTo(93.3333);
  });
  it("counts 24 on track, 3 at risk, 1 alert and 2 withdrawn", () => {
    expect(filterStudents("On track", "")).toHaveLength(24);
    expect(filterStudents("At risk", "")).toHaveLength(3);
    expect(filterStudents("Dropout alert", "")).toHaveLength(1);
    expect(filterStudents("Withdrawn", "")).toHaveLength(2);
  });
  it("distributes all 30 enrolled students across the three provinces", () => {
    expect(STUDENTS.filter(s => s.province === "Gauteng")).toHaveLength(18);
    expect(STUDENTS.filter(s => s.province === "Limpopo")).toHaveLength(7);
    expect(STUDENTS.filter(s => s.province === "KwaZulu-Natal")).toHaveLength(5);
  });
  it("handles zero enrollment without a nonfinite retention rate", () => {
    expect(calculateRetention(0, 0, 55, 59200).retention).toBe(0);
  });
  it("exports intervention metadata and neutralizes spreadsheet formulas", () => {
    const csv = donorReport(30, 28, 55, 59200, [{ student: "ST-001", note: "=1+1", timestamp: "2026-11-02T12:00:00Z", gps: "Not captured" }]);
    expect(csv).toContain('"680800"');
    expect(csv).toContain('"\'=1+1"');
    expect(csv).toContain('"2026-11-02T12:00:00Z"');
  });
});