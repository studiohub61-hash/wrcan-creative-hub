import { createServerFn } from "@tanstack/react-start";

export type LiveJob = {
  id: string;
  title: string;
  company: string;
  location: string;
  region: "South Africa" | "Europe" | "Americas" | "Worldwide";
  type: string;
  url: string;
  source: string;
  postedAt: string;
};

function regionOf(loc: string): LiveJob["region"] {
  const l = loc.toLowerCase();
  if (/south africa|johannesburg|cape town|durban|pretoria|\bza\b|africa|emea/.test(l)) return "South Africa";
  if (/usa|united states|\bus\b|america|canada|mexico|brazil|latam|new york|california/.test(l)) return "Americas";
  if (/europe|germany|uk|united kingdom|france|spain|netherlands|berlin|london|ireland|poland|italy|portugal|sweden|austria|switzerland/.test(l)) return "Europe";
  return "Worldwide";
}

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

export const getLiveJobs = createServerFn({ method: "GET" }).handler(async () => {
  const opts = { headers: { "User-Agent": "WRCAN-App/1.0" } };
  const [remotive, jobicy, arbeit] = await Promise.all([
    safe(fetch("https://remotive.com/api/remote-jobs?limit=60", opts).then((r) => r.json())),
    safe(fetch("https://jobicy.com/api/v2/remote-jobs?count=50", opts).then((r) => r.json())),
    safe(fetch("https://www.arbeitnow.com/api/job-board-api", opts).then((r) => r.json())),
  ]);
  const out: LiveJob[] = [];
  for (const j of (remotive?.jobs ?? []) as any[]) {
    const loc = j.candidate_required_location || "Worldwide";
    out.push({ id: `rm-${j.id}`, title: j.title, company: j.company_name, location: loc, region: regionOf(loc), type: j.job_type || "Remote", url: j.url, source: "Remotive", postedAt: j.publication_date });
  }
  for (const j of (jobicy?.jobs ?? []) as any[]) {
    const loc = j.jobGeo || "Worldwide";
    out.push({ id: `jc-${j.id}`, title: j.jobTitle, company: j.companyName, location: loc, region: regionOf(loc), type: Array.isArray(j.jobType) ? j.jobType.join(", ") : j.jobType || "Remote", url: j.url, source: "Jobicy", postedAt: j.pubDate });
  }
  for (const j of (arbeit?.data ?? []) as any[]) {
    const loc = j.location || "Europe";
    out.push({ id: `an-${j.slug}`, title: j.title, company: j.company_name, location: loc, region: "Europe", type: (j.job_types ?? []).join(", ") || (j.remote ? "Remote" : "On-site"), url: j.url, source: "Arbeitnow", postedAt: new Date((j.created_at ?? 0) * 1000).toISOString() });
  }
  out.sort((a, b) => +new Date(b.postedAt) - +new Date(a.postedAt));
  return { jobs: out.slice(0, 200), fetchedAt: new Date().toISOString() };
});
