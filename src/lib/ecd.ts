export type EcdFeature = { key: string; title: string; hint: string };
export type EcdSection = { title: string; features: EcdFeature[] };

export const ECD_SECTIONS: EcdSection[] = [
  { title: "Child Development", features: [
    { key: "elom", title: "ELOM Assessment", hint: "Record a child's ELOM assessment result" },
    { key: "milestones", title: "Developmental Milestones", hint: "Note a milestone reached or delayed" },
    { key: "ilp", title: "Individual Learning Plans", hint: "Goals and support plan for a child" },
    { key: "outcomes", title: "Early Learning Outcomes", hint: "Observed learning outcomes" },
  ] },
  { title: "Social Worker", features: [
    { key: "protection", title: "Child Protection & Abuse Reporting", hint: "Confidential concern report" },
    { key: "referral", title: "Referral System", hint: "Refer a child or family to a service" },
    { key: "case", title: "Case Management", hint: "Open and follow up a case" },
    { key: "psychosocial", title: "Psychosocial Support", hint: "Support session notes" },
  ] },
  { title: "Health & EHS", features: [
    { key: "rthb", title: "Road to Health Booklet", hint: "Booklet checked and up to date" },
    { key: "immunisation", title: "Immunisation Tracker", hint: "Vaccines given or due" },
    { key: "growth", title: "Growth Monitoring", hint: "Height, weight and notes" },
    { key: "nutrition", title: "Nutrition & Meals", hint: "Meals served and menu" },
    { key: "ehs", title: "EHS Environmental Safety Checklist", hint: "Safety check result" },
    { key: "infrastructure", title: "Infrastructure Audit", hint: "Building and facilities audit" },
  ] },
  { title: "DBE Compliance", features: [
    { key: "registration", title: "DBE Registration", hint: "Registration status and number" },
    { key: "attendance", title: "Daily Attendance Register", hint: "Date and children present" },
    { key: "staff", title: "Staff Qualifications & Vetting", hint: "Staff member, qualification, vetting" },
    { key: "finance", title: "Financial Management", hint: "Income or expense entry" },
    { key: "ncf", title: "Learning Programme NCF", hint: "NCF activity or theme delivered" },
  ] },
  { title: "Government Dashboard", features: [
    { key: "monitoring", title: "Real-time Monitoring", hint: "Monitoring visit or observation" },
    { key: "provincial", title: "Provincial Overview", hint: "Province / district notes" },
    { key: "scoring", title: "Compliance Scoring", hint: "Score and gaps found" },
    { key: "evidence", title: "Evidence Vault", hint: "Describe evidence kept" },
  ] },
  { title: "Parent & Community", features: [
    { key: "parents", title: "Parent Engagement", hint: "Meeting or activity with parents" },
    { key: "communication", title: "Communication", hint: "Notice sent to parents" },
    { key: "homevisit", title: "Home Visit Tracker", hint: "Home visit date and outcome" },
  ] },
];

export const ECD_FEATURES = ECD_SECTIONS.flatMap((s) => s.features.map((f) => ({ ...f, section: s.title })));
export const findEcdFeature = (key: string) => ECD_FEATURES.find((f) => f.key === key);
