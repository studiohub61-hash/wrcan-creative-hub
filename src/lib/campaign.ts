import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/media";

export const DOC_TYPES: Record<string, string> = {
  birth_certificate: "Birth certificate",
  health_certificate: "Centre health certificate",
  immunisation_card: "Immunisation card",
  dsd_registration: "DSD registration",
  id_document: "Parent ID document",
};

export const MILESTONES = [
  "Enjoys learning stories",
  "Washes hands independently",
  "Age-appropriate counting",
  "Recognises colours",
  "Plays well with others",
];

export const INCIDENT_TYPES = ["Suspected neglect", "Suspected abuse", "Injury at centre", "Missed meals", "Other concern"];

/** Upload into the private campaign bucket under the user's own folder. */
export async function uploadCampaignFile(userId: string, folder: string, file: File | Blob, ext?: string) {
  let body: File | Blob = file;
  if (file instanceof File && file.type.startsWith("image/")) body = await compressImage(file);
  const extension = ext ?? (file instanceof File ? file.name.split(".").pop() : "bin") ?? "bin";
  const path = `${userId}/${folder}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("campaign").upload(path, body, body.type ? { contentType: body.type } : {});
  if (error) throw new Error(error.message);
  return path;
}

export async function campaignUrl(path: string | null | undefined) {
  if (!path) return null;
  const { data } = await supabase.storage.from("campaign").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export type CampaignStats = {
  centres: number;
  evidence_total: number;
  evidence_complete: number;
  evidence_week: number;
  children_no_birth_cert: number;
  centres_health_expired: number;
  documents_by_type: Record<string, number>;
  visits_total: number;
  last_visit_at: string | null;
  days_since_visit: number | null;
  voice_notes: number;
  voice_notes_week: number;
  milestones: { milestone: string; achieved: number; total: number; pct: number }[];
  incidents_open: number;
  generated_at: string;
};

/** RED when no government visit has been logged within 30 days. */
export function visitAlert(days: number | null): "red" | "ok" {
  return days === null || days > 30 ? "red" : "ok";
}

export async function weeklyReportPdf(s: CampaignStats) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 864e5);
  let y = 20;
  const line = (text: string, size = 11, gap = 7) => {
    doc.setFontSize(size);
    doc.text(text, 15, y);
    y += gap;
  };
  line("WRCAN Campaign Report", 20, 10);
  line(`Week ${start.toLocaleDateString()} – ${end.toLocaleDateString()}`, 11, 12);
  line("Evidence before/after", 14, 8);
  line(`Logs: ${s.evidence_total} total, ${s.evidence_complete} with before & after, ${s.evidence_week} this week`);
  y += 4;
  line("Document wallet – bottlenecks", 14, 8);
  line(`${s.children_no_birth_cert} children without a valid birth certificate`);
  line(`${s.centres_health_expired} centres with a missing/expired health certificate`);
  Object.entries(s.documents_by_type).forEach(([k, n]) => line(`• ${DOC_TYPES[k] ?? k}: ${n} outstanding`));
  y += 4;
  line("Government visits", 14, 8);
  line(`${s.visits_total} visits logged · last visit ${s.last_visit_at ? new Date(s.last_visit_at).toLocaleDateString() : "never"}`);
  if (visitAlert(s.days_since_visit) === "red") line(`RED: no government visit for ${s.days_since_visit ?? "any"} days`);
  y += 4;
  line("Parent voice", 14, 8);
  line(`${s.voice_notes} voice notes (${s.voice_notes_week} this week)`);
  y += 4;
  line("Child development milestones", 14, 8);
  if (!s.milestones.length) line("No milestones recorded yet");
  s.milestones.forEach((m) => line(`• ${m.milestone}: ${m.pct}% (${m.achieved}/${m.total})`));
  y += 4;
  line(`Open confidential cases: ${s.incidents_open} (details withheld)`, 11);
  line(`Centres reporting: ${s.centres}`);
  doc.setFontSize(8);
  doc.text(`Generated ${new Date(s.generated_at).toLocaleString()}`, 15, 285);
  doc.save(`wrcan-campaign-report-${end.toISOString().slice(0, 10)}.pdf`);
}
