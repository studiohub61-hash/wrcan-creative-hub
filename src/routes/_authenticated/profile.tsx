import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Shell } from "@/components/Shell";
import { Avatar } from "@/components/Avatar";
import { Field, Plate, RoseButton, areaClass, inputClass } from "@/components/EmpireUI";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { compressImage } from "@/lib/media";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My WRCAN Registration Profile" },
      {
        name: "description",
        content:
          "Capture your member type, age, academic qualifications, skills and availability so WRCAN can auto-match you to training and jobs.",
      },
      { property: "og:title", content: "My WRCAN Registration Profile" },
      {
        property: "og:description",
        content: "Complete your WRCAN registration to unlock auto-matched training and vacancies.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

type MemberType = Database["public"]["Enums"]["member_type"];

const MEMBER_TYPES: { value: MemberType; label: string; blurb: string }[] = [
  { value: "student", label: "Student", blurb: "Learnerships & accredited training" },
  { value: "jobseeker", label: "Job Seeker", blurb: "Auto-matched vacancies" },
  { value: "recruiter", label: "Recruiter", blurb: "Post vacancies & shortlist" },
  { value: "caterer", label: "Catering Company", blurb: "Staffing & catering contracts" },
];

const QUALIFICATIONS = [
  "None",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11",
  "Grade 12",
  "Certificate",
  "Diploma",
  "Degree",
  "Honours",
  "Masters",
  "Doctorate",
];

const PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
  "Western Cape",
];

const schema = z.object({
  full_name: z.string().trim().min(2, "Full name is required").max(120),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  bio: z.string().trim().max(1000).optional().or(z.literal("")),
  company_name: z.string().trim().max(120).optional().or(z.literal("")),
  disability_detail: z.string().trim().max(300).optional().or(z.literal("")),
  experience_years: z.number().int().min(0).max(60),
});

const listToArray = (v: string) =>
  v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 40);

function ProfilePage() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoRef = useRef<HTMLInputElement | null>(null);

  const uploadPhoto = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose a photo.");
      return;
    }
    setUploadingPhoto(true);
    try {
      const small = await compressImage(file, 512, 0.8);
      const path = `${user.id}/avatar-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, small, { contentType: small.type || "image/jpeg", upsert: true });
      if (upErr) throw upErr;
      const previous = profile?.avatar_url ?? null;
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: path, updated_at: new Date().toISOString() })
        .eq("id", user.id);
      if (error) throw error;
      if (previous && previous !== path) {
        await supabase.storage.from("avatars").remove([previous]);
      }
      await refreshProfile();
      toast.success("Profile picture updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removePhoto = async () => {
    if (!user || !profile?.avatar_url) return;
    setUploadingPhoto(true);
    await supabase.storage.from("avatars").remove([profile.avatar_url]);
    const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
    setUploadingPhoto(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refreshProfile();
    toast.success("Profile picture removed.");
  };


  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    member_type: "jobseeker" as MemberType,
    date_of_birth: "",
    gender: "",
    city: "",
    suburb: "",
    province: "",
    highest_qualification: "",
    field_of_study: "",
    skills: "",
    languages: "",
    experience_years: 0,
    has_disability: false,
    disability_detail: "",
    availability: "",
    drivers_licence: false,
    company_name: "",
    bio: "",
    is_public: true,
  });

  useEffect(() => {
    if (!profile) return;
    setForm({
      full_name: profile.full_name ?? "",
      phone: profile.phone ?? "",
      member_type: profile.member_type,
      date_of_birth: profile.date_of_birth ?? "",
      gender: profile.gender ?? "",
      city: profile.city ?? "",
      suburb: profile.suburb ?? "",
      province: profile.province ?? "",
      highest_qualification: profile.highest_qualification ?? "",
      field_of_study: profile.field_of_study ?? "",
      skills: (profile.skills ?? []).join(", "),
      languages: (profile.languages ?? []).join(", "),
      experience_years: profile.experience_years ?? 0,
      has_disability: profile.has_disability ?? false,
      disability_detail: profile.disability_detail ?? "",
      availability: profile.availability ?? "",
      drivers_licence: profile.drivers_licence ?? false,
      company_name: profile.company_name ?? "",
      bio: profile.bio ?? "",
      is_public: profile.is_public ?? true,
    });
  }, [profile]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = schema.safeParse({
      full_name: form.full_name,
      phone: form.phone,
      city: form.city,
      bio: form.bio,
      company_name: form.company_name,
      disability_detail: form.disability_detail,
      experience_years: Number(form.experience_years) || 0,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]!.message);
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      email: user.email ?? null,
      full_name: form.full_name.trim(),
      phone: form.phone.trim() || null,
      member_type: form.member_type,
      date_of_birth: form.date_of_birth || null,
      gender: form.gender || null,
      city: form.city.trim() || null,
      suburb: form.suburb.trim() || null,
      province: form.province || null,
      highest_qualification: form.highest_qualification || null,
      field_of_study: form.field_of_study.trim() || null,
      skills: listToArray(form.skills),
      languages: listToArray(form.languages),
      experience_years: Number(form.experience_years) || 0,
      has_disability: form.has_disability,
      disability_detail: form.has_disability ? form.disability_detail.trim() || null : null,
      availability: form.availability || null,
      drivers_licence: form.drivers_licence,
      company_name: form.company_name.trim() || null,
      bio: form.bio.trim() || null,
      is_public: form.is_public,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refreshProfile();
    toast.success("Profile saved — matching updated.");
  };

  const isCompany = form.member_type === "recruiter" || form.member_type === "caterer";

  return (
    <Shell title="Registration Portal" subtitle="Your WRCAN dossier">
      <form onSubmit={save} className="space-y-5 pb-6">
        <Plate className="flex items-center gap-4">
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadPhoto(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => photoRef.current?.click()}
            className="relative rounded-full"
            aria-label="Change profile picture"
          >
            <Avatar path={profile?.avatar_url ?? null} name={form.full_name} size={76} />
            <span className="absolute -right-1 -bottom-1 rose-metal flex h-7 w-7 items-center justify-center rounded-full">
              <Camera className="h-3.5 w-3.5" />
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-semibold">Profile picture</h2>
            <p className="text-[0.65rem] tracking-widest text-muted-foreground uppercase">
              Shown in chat, your area group and talent reels
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={uploadingPhoto}
                onClick={() => photoRef.current?.click()}
                className="rounded-full border border-primary/60 px-4 py-1.5 text-[0.65rem] tracking-widest text-primary uppercase disabled:opacity-50"
              >
                {uploadingPhoto ? "Uploading…" : profile?.avatar_url ? "Change" : "Upload"}
              </button>
              {profile?.avatar_url ? (
                <button
                  type="button"
                  disabled={uploadingPhoto}
                  onClick={() => void removePhoto()}
                  className="rounded-full border border-border px-4 py-1.5 text-[0.65rem] tracking-widest text-muted-foreground uppercase disabled:opacity-50"
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>
        </Plate>

        <Plate>
          <h2 className="font-display mb-3 text-lg font-semibold">Member type</h2>
          <div className="grid grid-cols-2 gap-3">
            {MEMBER_TYPES.map((m) => {
              const active = form.member_type === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setForm({ ...form, member_type: m.value })}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    active
                      ? "rose-metal border-transparent"
                      : "border-border bg-card/70 text-foreground hover:bg-accent/40"
                  }`}
                >
                  <span className="block text-xs font-semibold tracking-widest uppercase">
                    {m.label}
                  </span>
                  <span
                    className={`mt-1 block text-[0.65rem] ${active ? "opacity-90" : "text-muted-foreground"}`}
                  >
                    {m.blurb}
                  </span>
                </button>
              );
            })}
          </div>
        </Plate>

        <Plate className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Personal details</h2>
          <Field label="Full name">
            <input
              className={inputClass}
              value={form.full_name}
              maxLength={120}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <input
                className={inputClass}
                value={form.phone}
                maxLength={20}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
            <Field label="Date of birth">
              <input
                type="date"
                className={inputClass}
                value={form.date_of_birth}
                onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Gender">
              <select
                className={inputClass}
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
              >
                <option value="">Select</option>
                <option>Female</option>
                <option>Male</option>
                <option>Other</option>
                <option>Prefer not to say</option>
              </select>
            </Field>
            <Field label="Province">
              <select
                className={inputClass}
                value={form.province}
                onChange={(e) => setForm({ ...form, province: e.target.value })}
              >
                <option value="">Select</option>
                {PROVINCES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="City / township">
              <input
                className={inputClass}
                value={form.city}
                maxLength={80}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </Field>
            <Field label="Suburb / area">
              <input
                className={inputClass}
                value={form.suburb}
                maxLength={80}
                placeholder="e.g. Dobsonville"
                onChange={(e) => setForm({ ...form, suburb: e.target.value })}
              />
            </Field>
          </div>
          <p className="text-[0.65rem] tracking-widest text-muted-foreground uppercase">
            Your area places you in the local seekers chat group automatically.
          </p>
        </Plate>

        <Plate className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Qualifications & skills</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Highest qualification">
              <select
                className={inputClass}
                value={form.highest_qualification}
                onChange={(e) => setForm({ ...form, highest_qualification: e.target.value })}
              >
                <option value="">Select</option>
                {QUALIFICATIONS.map((q) => (
                  <option key={q}>{q}</option>
                ))}
              </select>
            </Field>
            <Field label="Years experience">
              <input
                type="number"
                min={0}
                max={60}
                className={inputClass}
                value={form.experience_years}
                onChange={(e) =>
                  setForm({ ...form, experience_years: Number(e.target.value) || 0 })
                }
              />
            </Field>
          </div>
          <Field label="Field of study">
            <input
              className={inputClass}
              value={form.field_of_study}
              maxLength={120}
              placeholder="e.g. Hospitality, Business Admin"
              onChange={(e) => setForm({ ...form, field_of_study: e.target.value })}
            />
          </Field>
          <Field label="Skills (comma separated)">
            <input
              className={inputClass}
              value={form.skills}
              maxLength={500}
              placeholder="Food prep, POS, Customer service"
              onChange={(e) => setForm({ ...form, skills: e.target.value })}
            />
          </Field>
          <Field label="Languages (comma separated)">
            <input
              className={inputClass}
              value={form.languages}
              maxLength={300}
              placeholder="isiZulu, English, Sesotho"
              onChange={(e) => setForm({ ...form, languages: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Availability">
              <select
                className={inputClass}
                value={form.availability}
                onChange={(e) => setForm({ ...form, availability: e.target.value })}
              >
                <option value="">Select</option>
                <option>Immediately</option>
                <option>2 weeks notice</option>
                <option>1 month notice</option>
                <option>Weekends only</option>
              </select>
            </Field>
            <Field label="Driver's licence">
              <select
                className={inputClass}
                value={form.drivers_licence ? "yes" : "no"}
                onChange={(e) => setForm({ ...form, drivers_licence: e.target.value === "yes" })}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </Field>
          </div>
        </Plate>

        <Plate className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Inclusion & visibility</h2>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={form.has_disability}
              onChange={(e) => setForm({ ...form, has_disability: e.target.checked })}
            />
            I live with a disability (unlocks disability-inclusive matching)
          </label>
          {form.has_disability ? (
            <Field label="Support needed">
              <input
                className={inputClass}
                value={form.disability_detail}
                maxLength={300}
                onChange={(e) => setForm({ ...form, disability_detail: e.target.value })}
              />
            </Field>
          ) : null}
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={form.is_public}
              onChange={(e) => setForm({ ...form, is_public: e.target.checked })}
            />
            Show my profile to verified recruiters
          </label>
        </Plate>

        {isCompany ? (
          <Plate className="space-y-3">
            <h2 className="font-display text-lg font-semibold">Company</h2>
            <Field label="Company name">
              <input
                className={inputClass}
                value={form.company_name}
                maxLength={120}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
              />
            </Field>
          </Plate>
        ) : null}

        <Plate className="space-y-3">
          <h2 className="font-display text-lg font-semibold">About</h2>
          <textarea
            className={areaClass}
            rows={4}
            maxLength={1000}
            value={form.bio}
            placeholder="Tell recruiters about your experience"
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
          />
        </Plate>

        <div className="flex flex-col items-center gap-3">
          <RoseButton type="submit" disabled={saving} className="w-full">
            {saving ? "Saving…" : "Save my dossier"}
          </RoseButton>
          <RoseButton
            type="button"
            variant="outline"
            className="w-full"
            onClick={async () => {
              await signOut();
              void navigate({ to: "/auth", replace: true });
            }}
          >
            Sign out
          </RoseButton>
        </div>
      </form>
    </Shell>
  );
}
