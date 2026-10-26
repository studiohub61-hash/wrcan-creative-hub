import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;
type Job = Tables<"jobs">;
type Module = Tables<"training_modules">;

const QUAL_RANK: Record<string, number> = {
  none: 0,
  "no formal schooling": 0,
  "grade 8": 1,
  "grade 9": 2,
  "grade 10": 3,
  "grade 11": 4,
  "grade 12": 5,
  matric: 5,
  certificate: 6,
  diploma: 7,
  degree: 8,
  honours: 9,
  masters: 10,
  doctorate: 11,
};

export function qualRank(value?: string | null): number {
  if (!value) return 0;
  return QUAL_RANK[value.trim().toLowerCase()] ?? 0;
}

export function ageFrom(dob?: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const diff = Date.now() - birth.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

function overlap(a: string[], b: string[]): number {
  if (b.length === 0) return 1;
  const lowerA = a.map((s) => s.toLowerCase().trim());
  const hits = b.filter((s) =>
    lowerA.some((x) => x.includes(s.toLowerCase().trim()) || s.toLowerCase().trim().includes(x)),
  ).length;
  return hits / b.length;
}

export type MatchResult = { score: number; reasons: string[]; blockers: string[] };

/** Weighted auto-match between a participant and a vacancy. */
export function matchJob(profile: Profile | null, job: Job): MatchResult {
  const reasons: string[] = [];
  const blockers: string[] = [];
  if (!profile) return { score: 0, reasons, blockers: ["Complete your profile to be matched"] };

  let score = 0;
  const age = ageFrom(profile.date_of_birth);

  // Age fit — 20
  if (age === null) {
    blockers.push("Add your date of birth for an age match");
  } else if (age >= job.min_age && age <= job.max_age) {
    score += 20;
    reasons.push(`Age ${age} fits the ${job.min_age}-${job.max_age} bracket`);
  } else {
    blockers.push(`Age bracket is ${job.min_age}-${job.max_age}`);
  }

  // Academic qualification — 25
  const need = qualRank(job.required_qualification);
  const have = qualRank(profile.highest_qualification);
  if (have >= need) {
    score += 25;
    reasons.push(`${profile.highest_qualification ?? "Your schooling"} meets the requirement`);
  } else {
    score += Math.max(0, 25 - (need - have) * 8);
    blockers.push(`Requires ${job.required_qualification}`);
  }

  // Skills — 30
  const skillFit = overlap(profile.skills ?? [], job.required_skills ?? []);
  score += Math.round(skillFit * 30);
  if (skillFit >= 0.5) reasons.push(`${Math.round(skillFit * 100)}% skills overlap`);
  else if ((job.required_skills ?? []).length) blockers.push("Skills gap on this role");

  // Experience — 15
  if (profile.experience_years >= job.min_experience) {
    score += 15;
    if (job.min_experience > 0) reasons.push(`${profile.experience_years} yrs experience`);
  } else {
    score += Math.max(0, 15 - (job.min_experience - profile.experience_years) * 5);
  }

  // Location — 10
  if (profile.province && job.province && profile.province === job.province) {
    score += 10;
    reasons.push(`Based in ${job.province}`);
  } else if (!job.province) {
    score += 5;
  }

  // Disability-friendly bonus
  if (profile.has_disability && job.disability_friendly) {
    score = Math.min(100, score + 6);
    reasons.push("Disability-inclusive employer");
  }

  return { score: Math.max(0, Math.min(100, score)), reasons, blockers };
}

/** Weighted auto-match between a participant and a training module. */
export function matchModule(profile: Profile | null, mod: Module): MatchResult {
  const reasons: string[] = [];
  const blockers: string[] = [];
  if (!profile) return { score: 0, reasons, blockers: ["Complete your profile to be matched"] };

  let score = 30; // everyone is trainable
  const age = ageFrom(profile.date_of_birth);

  if (age === null) {
    blockers.push("Add your date of birth");
  } else if (age >= mod.min_age && age <= mod.max_age) {
    score += 25;
    reasons.push(`Eligible at age ${age}`);
  } else {
    blockers.push(`Age bracket ${mod.min_age}-${mod.max_age}`);
  }

  const need = qualRank(mod.required_qualification);
  const have = qualRank(profile.highest_qualification);
  if (have >= need) {
    score += 25;
    reasons.push("Entry requirement met");
  } else {
    blockers.push(`Requires ${mod.required_qualification}`);
  }

  const interest = overlap(
    [...(profile.skills ?? []), profile.field_of_study ?? "", profile.member_type],
    mod.tags ?? [],
  );
  score += Math.round(interest * 20);
  if (interest > 0.2) reasons.push("Matches your field and skills");

  return { score: Math.max(0, Math.min(100, score)), reasons, blockers };
}

export function scoreBand(score: number): string {
  if (score >= 80) return "Prime match";
  if (score >= 60) return "Strong match";
  if (score >= 40) return "Possible match";
  return "Stretch";
}
