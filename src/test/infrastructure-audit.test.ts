import { describe, expect, it } from "vitest";
import {
  areaSqm,
  indoorCapacity,
  outdoorCapacity,
  pottiesRequired,
  staffToiletsRequired,
  SQM_PER_CHILD_INDOOR,
  SQM_PER_CHILD_OUTDOOR,
  AUDIT_SECTIONS,
} from "@/lib/infrastructure-audit";

describe("infrastructure audit rules", () => {
  it("includes the eight required infrastructure audit sections", () => {
    expect(AUDIT_SECTIONS.map((section) => section.key)).toEqual(["building", "size", "toilets", "kitchen", "safety", "water", "zoning", "bangasali"]);
  });

  it("requires inside photo slots for all four building sides", () => {
    expect(AUDIT_SECTIONS.find((section) => section.key === "building")?.photos.map((photo) => photo.key)).toEqual(["side_front", "side_back", "side_left", "side_right"]);
  });

  it("computes area as length × width", () => {
    expect(areaSqm(6, 5)).toBe(30);
  });

  it("allows 1.5 sqm per child indoors", () => {
    expect(SQM_PER_CHILD_INDOOR).toBe(1.5);
    expect(indoorCapacity(30)).toBe(20);
    expect(indoorCapacity(31)).toBe(20);
  });

  it("allows 2 sqm per child outdoors", () => {
    expect(SQM_PER_CHILD_OUTDOOR).toBe(2);
    expect(outdoorCapacity(40)).toBe(20);
    expect(outdoorCapacity(41)).toBe(20);
  });

  it("requires 1 potty per 20 children", () => {
    expect(pottiesRequired(20)).toBe(1);
    expect(pottiesRequired(21)).toBe(2);
  });

  it("requires 1 toilet per 20 staff", () => {
    expect(staffToiletsRequired(20)).toBe(1);
    expect(staffToiletsRequired(21)).toBe(2);
  });
});
