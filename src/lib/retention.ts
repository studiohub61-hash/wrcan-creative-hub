export const RETENTION_DEMO = { matriculants: 50, bachelors: 35, enrolled: 30, active: 28, nationalRetention: 55, costPerDropout: 59200 };
export type Risk = "On track" | "At risk" | "Dropout alert" | "Withdrawn";
export const STUDENTS = Array.from({ length: 30 }, (_, i) => ({
  id: `ST-${String(i + 1).padStart(3, "0")}`,
  province: i < 18 ? "Gauteng" : i < 25 ? "Limpopo" : "KwaZulu-Natal",
  risk: (i < 24 ? "On track" : i < 27 ? "At risk" : i === 27 ? "Dropout alert" : "Withdrawn") as Risk,
}));
export function calculateRetention(enrolled: number, active: number, nationalRetention: number, cost: number) {
  const expectedDropouts = enrolled * (1 - nationalRetention / 100);
  const actualDropouts = enrolled - active;
  const baselineLoss = Math.round(expectedDropouts * cost);
  const actualLoss = Math.round(actualDropouts * cost);
  return { expectedDropouts, actualDropouts, baselineLoss, actualLoss, savings: baselineLoss - actualLoss, retention: enrolled ? active / enrolled * 100 : 0 };
}
export function filterStudents(risk: string, query: string) {
  return STUDENTS.filter(s => (risk === "All" || s.risk === risk) && `${s.id} ${s.province}`.toLowerCase().includes(query.toLowerCase()));
}
export function csvCell(value: string | number) {
  const text = String(value);
  return `"${/^[=+\-@]/.test(text) ? "'" : ""}${text.replaceAll('"', '""')}"`;
}
export function donorReport(enrolled: number, active: number, national: number, cost: number, evidence: { student: string; note: string; timestamp: string; gps: string }[]) {
  const results = calculateRetention(enrolled, active, national, cost);
  const rows: (string | number)[][] = [["WRCAN retention — SAMPLE DATA, NOT VERIFIED IMPACT"], ["Metric", "Value"], ["Enrolled", enrolled], ["Active", active], ["National benchmark (%)", national], ["Cost per dropout (ZAR)", cost], ["Baseline loss (ZAR)", results.baselineLoss], ["Actual loss (ZAR)", results.actualLoss], ["Modelled savings (ZAR)", results.savings], [], ["Student", "Province", "Risk"], ...STUDENTS.map(s => [s.id, s.province, s.risk]), [], ["Intervention student", "Note", "Timestamp", "GPS"], ...evidence.map(e => [e.student, e.note, e.timestamp, e.gps])];
  return rows.map(row => row.map(csvCell).join(",")).join("\r\n");
}