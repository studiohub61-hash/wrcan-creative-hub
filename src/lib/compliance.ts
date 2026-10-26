export type ComplianceSection = { key: string; title: string; items: string[] };

export const COMPLIANCE_SECTIONS: ComplianceSection[] = [
  { key: "governance", title: "Governance & Registration", items: ["NPO Registration Certificate valid & displayed", "Principal appointed with signed contract", "Governing Body minutes filed quarterly", "Compliance with Children's Act 38 of 2005"] },
  { key: "infrastructure", title: "Infrastructure & Safety", items: ["Perimeter fence secure, lockable gate", "Fire extinguisher serviced & accessible", "Emergency evacuation plan posted", "First aid kit stocked & accessible"] },
  { key: "health", title: "Health & Safety Daily", items: ["Toilets: photo before cleaning", "Toilets: photo after cleaning with Jik", "Handwash basin with soap within 2m", "Potties: 1 per 20 kids, cleaned after each use", "Toilet paper available at all times", "Kitchen: photo before & after cleaning", "Washable floor, clean & non-slip", "Separate tap with running water for food prep", "Dated cleaning schedule maintained (60-day log)", "Photo proof taken twice daily (morning & afternoon)"] },
  { key: "staffing", title: "Staffing & Training", items: ["Staff-to-child ratio compliance maintained", "Valid police clearance for all staff", "First Aid Level 1 certified staff on site", "Ongoing training records up to date"] },
  { key: "nutrition", title: "Nutrition & Feeding", items: ["2 meals + 1 snack daily provided", "Menu planned weekly, displayed for parents", "Clean drinking water available at all times", "Allergies recorded & managed"] },
  { key: "learning", title: "Learning Programme", items: ["Daily programme follows NELDS curriculum", "Weekly activity plan displayed", "Learning through play observed", "Learner progress tracked quarterly"] },
  { key: "parents", title: "Parent & Community Engagement", items: ["Parent communication book in use", "Quarterly parents meeting held & minuted", "Complaints register maintained", "Community involvement encouraged"] },
  { key: "records", title: "Record Keeping & Admin", items: ["Admissions register updated daily", "Attendance register completed daily", "Incident/accident logbook maintained", "All records retained for 3 years"] },
  { key: "monitoring", title: "Monitoring & Evaluation", items: ["Monthly self-assessment conducted", "Corrective action plan implemented", "DBE compliance checklist reviewed monthly", "Continuous improvement documented"] },
];

export const COMPLIANCE_TOTAL = COMPLIANCE_SECTIONS.reduce((n, s) => n + s.items.length, 0);

export function complianceScore(checked: string[]): number {
  return Math.round((checked.length / COMPLIANCE_TOTAL) * 100);
}
