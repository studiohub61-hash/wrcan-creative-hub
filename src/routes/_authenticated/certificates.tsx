import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Award, CheckCircle2, Download, FileText, Trash2, Upload } from "lucide-react";
import { UserAvatar } from "@/components/Avatar";
import { Shell } from "@/components/Shell";
import { Plate, RoseButton, inputClass } from "@/components/EmpireUI";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/certificates")({
  head: () => ({
    meta: [
      { title: "My Accredited Certificates — WRCAN App" },
      {
        name: "description",
        content:
          "Download your accredited WRCAN certificates for completed YES, SETA and UNICEF training modules.",
      },
      { property: "og:title", content: "My Accredited Certificates — WRCAN App" },
      {
        property: "og:description",
        content: "Every completed WRCAN module issues a numbered, downloadable certificate.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CertificatesPage,
});

type Certificate = Tables<"certificates">;

function certificateHtml(cert: Certificate) {
  const issued = new Date(cert.issued_at).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>${cert.certificate_number} — WRCAN Certificate</title>
<style>
  @page { size: A4 landscape; margin: 0 }
  body { margin:0; font-family: Georgia, serif; background:#fdf7f4; color:#3b2a26 }
  .sheet { width:1120px; height:780px; margin:0 auto; padding:60px; box-sizing:border-box; text-align:center;
    border:14px double #b76e79; background:linear-gradient(160deg,#fffdfc,#f7e6e2) }
  h1 { font-size:44px; letter-spacing:6px; text-transform:uppercase; margin:24px 0 6px; color:#8c4a52 }
  h2 { font-size:34px; margin:28px 0 6px }
  .name { font-size:40px; letter-spacing:2px; border-bottom:2px solid #b76e79; display:inline-block; padding:0 40px 8px }
  p { font-size:18px; line-height:1.7 }
  .meta { margin-top:40px; display:flex; justify-content:space-between; font-size:14px; letter-spacing:2px; text-transform:uppercase }
</style></head>
<body><div class="sheet">
  <p style="letter-spacing:8px;text-transform:uppercase">WRCAN Specialists</p>
  <h1>Certificate of Completion</h1>
  <p>This certifies that</p>
  <div class="name">${cert.learner_name}</div>
  <p>has successfully completed the accredited programme</p>
  <h2>${cert.module_title}</h2>
  <p>Presented by ${cert.provider}${cert.score !== null ? ` · Final assessment ${cert.score}%` : ""}</p>
  <div class="meta"><span>No. ${cert.certificate_number}</span><span>Issued ${issued}</span></div>
</div>
<script>window.print()</script>
</body></html>`;
}

function download(cert: Certificate) {
  const blob = new Blob([certificateHtml(cert)], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `WRCAN-${cert.certificate_number}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

type Uploaded = Tables<"uploaded_certificates">;
type DirRow = { user_id: string; full_name: string; city: string | null; wanda_certs: number; uploaded_certs: number; completed: number };
type Achievements = { certificates: Certificate[]; completed: { title: string; provider: string; score: number | null; completed_at: string | null }[] };

async function openUpload(path: string) {
  const { data, error } = await supabase.storage.from("certificates").createSignedUrl(path, 300);
  if (error || !data) { toast.error("Could not open this certificate"); return; }
  window.open(data.signedUrl, "_blank", "noopener");
}

function useLive(table: "certificates" | "uploaded_certificates", keys: string[][]) {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel(`live-${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () =>
        keys.forEach((k) => void qc.invalidateQueries({ queryKey: k })),
      )
      .subscribe();
    return () => void supabase.removeChannel(ch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, table]);
}

function UploadedList({ userId, own }: { userId: string; own?: boolean }) {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["uploaded-certs", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("uploaded_certificates").select("*").eq("user_id", userId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Uploaded[];
    },
  });
  if (!data.length) return <p className="text-xs text-muted-foreground">No uploaded certificates.</p>;
  return (
    <ul className="space-y-2">
      {data.map((u) => (
        <li key={u.id} className="flex items-center gap-2 rounded-lg border border-border/60 p-2">
          <FileText className="h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{u.title}</p>
            <p className="truncate text-[0.7rem] text-muted-foreground">
              {u.issuer || "Own upload"}{u.issued_on ? ` · ${u.issued_on}` : ""}
            </p>
          </div>
          <button type="button" aria-label="Open" onClick={() => void openUpload(u.file_path)} className="text-primary"><Download className="h-4 w-4" /></button>
          {own ? (
            <button type="button" aria-label="Delete" className="text-muted-foreground" onClick={async () => {
              await supabase.storage.from("certificates").remove([u.file_path]);
              await supabase.from("uploaded_certificates").delete().eq("id", u.id);
              void qc.invalidateQueries({ queryKey: ["uploaded-certs", userId] });
            }}><Trash2 className="h-4 w-4" /></button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function UploadForm({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [issuer, setIssuer] = useState("");
  const [date, setDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) { toast.error("Add a title and choose a file"); return; }
    if (file.size > 20 * 1024 * 1024) { toast.error("File must be under 20 MB"); return; }
    setBusy(true);
    const path = `${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const up = await supabase.storage.from("certificates").upload(path, file, { contentType: file.type });
    if (up.error) { setBusy(false); toast.error("Upload failed"); return; }
    const gps = await (await import("@/lib/gps")).getGps();
    const { error } = await supabase.from("uploaded_certificates").insert({ user_id: userId, title: title.trim(), issuer: issuer.trim() || null, issued_on: date || null, file_path: path, file_mime: file.type, ...gps });
    setBusy(false);
    if (error) { toast.error("Could not save certificate"); return; }
    toast.success("Certificate uploaded");
    setTitle(""); setIssuer(""); setDate(""); setFile(null);
    (e.target as HTMLFormElement).reset();
    void qc.invalidateQueries({ queryKey: ["uploaded-certs", userId] });
  };
  return (
    <form onSubmit={submit} className="space-y-2">
      <input className={inputClass} placeholder="Certificate title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input className={inputClass} placeholder="Issued by (e.g. SETA, school)" value={issuer} onChange={(e) => setIssuer(e.target.value)} />
      <input className={inputClass} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <input className={inputClass} type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <RoseButton type="submit" className="w-full" disabled={busy}><Upload className="h-4 w-4" /> {busy ? "Uploading…" : "Upload certificate"}</RoseButton>
    </form>
  );
}

function MemberDetail({ row, onBack }: { row: DirRow; onBack: () => void }) {
  const { data } = useQuery({
    queryKey: ["achievements", row.user_id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("member_achievements", { _user_id: row.user_id });
      if (error) throw error;
      return data as unknown as Achievements;
    },
  });
  return (
    <div className="space-y-3">
      <button type="button" onClick={onBack} className="text-xs tracking-widest text-primary uppercase">← All members</button>
      <Plate className="flex items-center gap-3">
        <UserAvatar userId={row.user_id} name={row.full_name} size={48} />
        <div><h2 className="font-display text-lg font-semibold">{row.full_name || "Member"}</h2>
          <p className="text-xs text-muted-foreground">{row.city ?? "South Africa"}</p></div>
      </Plate>
      <Plate className="space-y-2">
        <h3 className="font-display rose-text text-sm font-semibold uppercase">Wanda certificates</h3>
        {(data?.certificates ?? []).length === 0 ? <p className="text-xs text-muted-foreground">None yet.</p> : null}
        {(data?.certificates ?? []).map((c) => (
          <div key={c.id} className="flex items-center gap-2">
            <Award className="h-5 w-5 shrink-0 text-primary" />
            <p className="min-w-0 flex-1 truncate text-sm">{c.module_title}</p>
            <button type="button" aria-label="Download" className="text-primary" onClick={() => download(c)}><Download className="h-4 w-4" /></button>
          </div>
        ))}
      </Plate>
      <Plate className="space-y-2"><h3 className="font-display rose-text text-sm font-semibold uppercase">Uploaded certificates</h3><UploadedList userId={row.user_id} /></Plate>
      <Plate className="space-y-2">
        <h3 className="font-display rose-text text-sm font-semibold uppercase">Completed training & tasks</h3>
        {(data?.completed ?? []).length === 0 ? <p className="text-xs text-muted-foreground">Nothing completed yet.</p> : null}
        {(data?.completed ?? []).map((t, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate">{t.title}</span>
            <span className="text-[0.7rem] text-muted-foreground">{t.score !== null ? `${t.score}%` : ""}</span>
          </div>
        ))}
      </Plate>
    </div>
  );
}

function Directory() {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<DirRow | null>(null);
  const { data = [], isLoading } = useQuery({
    queryKey: ["cert-directory"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("certificate_directory");
      if (error) throw error;
      return data as unknown as DirRow[];
    },
  });
  if (sel) return <MemberDetail row={sel} onBack={() => setSel(null)} />;
  const rows = data.filter((r) => (r.full_name ?? "").toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-3">
      <input className={inputClass} placeholder="Search member name" value={q} onChange={(e) => setQ(e.target.value)} />
      {isLoading ? <p className="text-center text-sm text-muted-foreground">Loading members…</p> : null}
      {!isLoading && rows.length === 0 ? <p className="text-center text-sm text-muted-foreground">No members with certificates yet.</p> : null}
      {rows.map((r) => (
        <Plate key={r.user_id} onClick={() => setSel(r)} className="flex cursor-pointer items-center gap-3">
          <UserAvatar userId={r.user_id} name={r.full_name} size={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{r.full_name || "Member"}</p>
            <p className="text-[0.7rem] text-muted-foreground">
              {Number(r.wanda_certs) + Number(r.uploaded_certs)} certificates · {r.completed} completed
            </p>
          </div>
        </Plate>
      ))}
    </div>
  );
}

function CertificatesPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"mine" | "members">("mine");
  useLive("certificates", [["certificates"], ["cert-directory"], ["achievements"]]);
  useLive("uploaded_certificates", [["uploaded-certs"], ["cert-directory"]]);

  const { data: certs = [], isLoading } = useQuery({
    queryKey: ["certificates", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("certificates")
        .select("*")
        .eq("user_id", user!.id)
        .order("issued_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <Shell title="Certificates" subtitle="Accredited & downloadable">
      <div className="mb-4 grid grid-cols-2 gap-2">
        {(["mine", "members"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`rounded-full py-2 text-xs font-semibold tracking-widest uppercase ${tab === t ? "rose-metal" : "glass-plate text-muted-foreground"}`}>
            {t === "mine" ? "My certificates" : "Members"}
          </button>
        ))}
      </div>
      {tab === "members" ? <Directory /> : (
      <div className="space-y-3 pb-6">
        {user ? (
          <Plate className="space-y-2">
            <h2 className="font-display rose-text text-sm font-semibold uppercase">Upload a certificate</h2>
            <UploadForm userId={user.id} />
            <UploadedList userId={user.id} own />
          </Plate>
        ) : null}
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading certificates…</p>
        ) : null}

        {!isLoading && certs.length === 0 ? (
          <Plate className="text-center">
            <Award className="mx-auto mb-2 h-8 w-8 text-primary" />
            <p className="text-sm text-muted-foreground">
              No Wanda certificates yet. Complete a module and yours is issued instantly.
            </p>
            <Link to="/training" className="mt-3 inline-block">
              <RoseButton>Browse training</RoseButton>
            </Link>
          </Plate>
        ) : null}

        {certs.map((c) => (
          <Plate key={c.id} className="space-y-2">
            <div className="flex items-start gap-3">
              <Award className="mt-1 h-6 w-6 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <h2 className="font-display truncate text-base font-semibold">{c.module_title}</h2>
                <p className="text-xs text-muted-foreground">
                  {c.provider} · No. {c.certificate_number}
                </p>
                <p className="text-[0.7rem] text-muted-foreground">
                  Issued {new Date(c.issued_at).toLocaleDateString("en-ZA")}
                  {c.score !== null ? ` · ${c.score}%` : ""}
                </p>
              </div>
            </div>
            <RoseButton className="w-full" onClick={() => download(c)}>
              <Download className="h-4 w-4" /> Download certificate
            </RoseButton>
          </Plate>
        ))}
      </div>
      )}
    </Shell>
  );
}
