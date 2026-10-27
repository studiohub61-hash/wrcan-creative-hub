import { describe, expect, it } from "vitest";
import {
  COACHES,
  ECD_LIST,
  PROGRAM_DAYS,
  RED_FLAG_DAYS,
  SEED_EVIDENCE,
  TRACKER_ITEMS,
  applyFilters,
  applyReviews,
  coachDailyRows,
  daysLeft,
  daysInProgram,
  evidenceAt,
  kpiStats,
  managerWeeklyRows,
  parseReviews,
  qualityByCategory,
  redFlags,
  tasksToday,
  trackerMet,
  trackerProgress,
} from "@/lib/ward50";

const NOW = Date.parse("2026-10-26T08:00:00.000Z");

describe("ward50 demo data", () => {
  it("has 25 ECDs, 3 coaches and a 15-item tracker", () => {
    expect(ECD_LIST).toHaveLength(25);
    expect(COACHES).toHaveLength(3);
    expect(TRACKER_ITEMS).toBe(15);
  });

  it("every ECD is assigned to a known coach", () => {
    const coachIds = new Set(COACHES.map((c) => c.id));
    for (const ecd of ECD_LIST) expect(coachIds.has(ecd.coachId)).toBe(true);
  });
});

describe("60-day countdown", () => {
  it("caps days in program at 60 and never goes negative on days left", () => {
    const ecd = { ...ECD_LIST[0], daysIn: 47 };
    expect(daysInProgram(ecd)).toBe(47);
    expect(daysLeft(ecd)).toBe(PROGRAM_DAYS - 47);
    const over = { ...ECD_LIST[0], daysIn: 80 };
    expect(daysInProgram(over)).toBe(PROGRAM_DAYS);
    expect(daysLeft(over)).toBe(0);
  });
});

describe("tracker", () => {
  it("counts pre-checked items plus approved evidence items", () => {
    const ecd = ECD_LIST.find((e) => e.id === "ecd-007")!;
    const met = trackerMet(ecd, SEED_EVIDENCE);
    // pre-checked [0,1,2,4,6,10,13] + approved ev-03 meetsItem 6 (already counted)
    expect(met).toEqual([0, 1, 2, 4, 6, 10, 13]);
    expect(trackerProgress(ecd, SEED_EVIDENCE)).toBe(Math.round((7 / TRACKER_ITEMS) * 100));
  });

  it("ignores non-approved evidence for tracker items", () => {
    const ecd = ECD_LIST.find((e) => e.id === "ecd-005")!;
    // ev-10 (meetsItem null, rejected) must not add anything beyond pre-checked [4]
    expect(trackerMet(ecd, SEED_EVIDENCE)).toEqual([4]);
  });
});

describe("red flags", () => {
  it("flags ECDs with no evidence or no evidence in 3+ days", () => {
    const flags = redFlags(ECD_LIST, SEED_EVIDENCE, NOW);
    const byId = new Map(flags.map((f) => [f.ecd.id, f.daysSince]));
    // ecd-011 latest evidence is 121h ago → 5 days
    expect(byId.get("ecd-011")).toBe(5);
    // ecd-008 has evidence 5h ago → not flagged
    expect(byId.has("ecd-008")).toBe(false);
    // any flagged entry is either null (no evidence) or >= RED_FLAG_DAYS
    for (const f of flags) {
      if (f.daysSince !== null) expect(f.daysSince).toBeGreaterThanOrEqual(RED_FLAG_DAYS);
    }
  });
});

describe("reviews", () => {
  it("applies saved reviews over seed evidence", () => {
    const reviewed = applyReviews(SEED_EVIDENCE, {
      "ev-09": { status: "approved", comment: "Verified on site" },
    });
    expect(reviewed.find((e) => e.id === "ev-09")?.status).toBe("approved");
    expect(reviewed.find((e) => e.id === "ev-09")?.comment).toBe("Verified on site");
  });

  it("parses valid saved reviews and rejects malformed data", () => {
    expect(parseReviews(null)).toEqual({});
    expect(parseReviews('{"ev-01":{"status":"approved","comment":"ok"}}')).toEqual({
      "ev-01": { status: "approved", comment: "ok" },
    });
    expect(() => parseReviews("[1,2]")).toThrow();
    expect(parseReviews('{"ev-01":{"status":"bogus","comment":"x"}}')).toEqual({});
  });
});

describe("filters & exports", () => {
  it("filters by ECD, category, status and date range", () => {
    const rows = applyFilters(
      SEED_EVIDENCE,
      { ecdId: "ecd-007", category: "Nutrition", status: "approved", from: "", to: "" },
      NOW,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("ev-03");

    const ranged = applyFilters(
      SEED_EVIDENCE,
      { ecdId: "", category: "", status: "", from: "2026-10-26", to: "2026-10-26" },
      NOW,
    );
    for (const r of ranged) expect(r.timestamp.slice(0, 10)).toBe("2026-10-26");
  });

  it("produces coach daily rows with GPS and manager weekly rows per ECD", () => {
    const filtered = applyFilters(SEED_EVIDENCE, { ecdId: "", category: "", status: "", from: "", to: "" }, NOW);
    const daily = coachDailyRows(filtered, ECD_LIST);
    expect(daily).toHaveLength(SEED_EVIDENCE.length);
    expect(daily[0]).toHaveProperty("GPS_Lat");
    expect(daily[0]).toHaveProperty("Coach_Name");

    const weekly = managerWeeklyRows(ECD_LIST, SEED_EVIDENCE, NOW);
    expect(weekly).toHaveLength(ECD_LIST.length);
    expect(weekly[0]).toHaveProperty("Compliance_Rate");
    expect(weekly[0]).toHaveProperty("Silver_Ready");
  });
});

describe("kpis & tasks", () => {
  it("computes compliance as approved share of evidence", () => {
    const kpis = kpiStats(ECD_LIST, SEED_EVIDENCE);
    const approved = SEED_EVIDENCE.filter((e) => e.status === "approved").length;
    expect(kpis.compliance).toBe(Math.round((approved / SEED_EVIDENCE.length) * 100));
    expect(kpis.total).toBe(25);
  });

  it("counts coach tasks for the last 24h", () => {
    const t = tasksToday("c1", ECD_LIST, SEED_EVIDENCE);
    expect(t.assigned).toBe(ECD_LIST.filter((e) => e.coachId === "c1").length);
    expect(t.notSubmitted).toBeGreaterThanOrEqual(0);
    expect(t.flagged).toBe(0); // c1 has no needs_work/rejected within 24h
  });

  it("reports quality per category", () => {
    const q = qualityByCategory(SEED_EVIDENCE);
    expect(q).toHaveLength(4);
    const nutrition = q.find((x) => x.category === "Nutrition")!;
    expect(nutrition.count).toBe(SEED_EVIDENCE.filter((e) => e.category === "Nutrition").length);
  });

  it("evidenceAt derives an ISO timestamp from hours ago", () => {
    expect(evidenceAt(SEED_EVIDENCE[0], NOW)).toBe("2026-10-26T05:00:00.000Z");
  });
});
