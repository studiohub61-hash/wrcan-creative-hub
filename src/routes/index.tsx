import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  Award,
  Briefcase,
  CircleDot,
  Film,
  GraduationCap,
  MessageCircle,
  Radio,
  UserRound,
  Users,
} from "lucide-react";

import { Medallion } from "@/components/Medallion";
import { Shell } from "@/components/Shell";
import { SmartStartButton } from "@/components/SmartStartButton";
import { PromotionsHubSection } from "@/components/PromotionsHub";
import { RoseButton } from "@/components/EmpireUI";
import { useControlAccess } from "@/hooks/useBadges";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WRCAN App — Training, Jobs & Certificates in South Africa" },
      {
        name: "description",
        content:
          "WRCAN connects students, job seekers, recruiters and catering companies with accredited training, auto-matched vacancies and real-time chat.",
      },
      { property: "og:title", content: "WRCAN App — Build an Empire" },
      {
        property: "og:description",
        content:
          "Accredited training modules, downloadable certificates, auto-matched jobs and WhatsApp-style chat, all in one South African platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const TILES = [
  { to: "/campaign", label: "Campaign", icon: Award, caption: "Evidence machine" },
  { to: "/smartstart", label: "SmartStart", icon: Users, caption: "Learning hub" },
  { to: "/training", label: "Training", icon: GraduationCap, caption: "YES · SETA · UNICEF" },
  { to: "/media-studio", label: "Media Studio", icon: Radio, caption: "Radio · video calls" },
  { to: "/live-studio", label: "Live Studio", icon: Activity, caption: "Broadcast control room" },
  { to: "/jobs", label: "Jobs", icon: Briefcase, caption: "Auto-matched" },
  { to: "/reels", label: "Talent Reels", icon: Film, caption: "Show your skills" },
  { to: "/status", label: "Status", icon: CircleDot, caption: "24-hour updates" },
  { to: "/certificates", label: "Certificates", icon: Award, caption: "Download" },
  { to: "/chat", label: "Chat", icon: MessageCircle, caption: "Groups & direct" },
  { to: "/profile", label: "My Profile", icon: UserRound, caption: "Registration" },
  { to: "/jobs", label: "Recruiters", icon: Users, caption: "Post vacancies" },
  { to: "/control-room", label: "Control Room", icon: Activity, caption: "Live figures" },

];


function Index() {
  const { user, profile, loading } = useAuth();
  const { allowed: canControl } = useControlAccess();
  const tiles = TILES.filter((t) => t.to !== "/control-room" || canControl);

  return (
    <Shell title="Build an Empire" subtitle="WRCAN Specialists">
      <div className="-mx-5 mb-6 flex gap-4 overflow-x-auto px-5 pb-1" aria-label="Stories">
        {[
          { to: "/reels", label: "Talent Reels", icon: Film },
          { to: "/status", label: "Status", icon: CircleDot },
          { to: "/live-studio", label: "Live", icon: Activity },
          { to: "/training", label: "Training", icon: GraduationCap },
          { to: "/certificates", label: "Certificates", icon: Award },
        ].map(({ to, label, icon: Icon }) => (
          <Link key={label} to={to} className="flex shrink-0 flex-col items-center gap-1.5">
            <span className="rounded-full bg-gradient-to-tr from-primary via-accent to-primary p-[2px]">
              <span className="flex size-16 items-center justify-center rounded-full border-2 border-background bg-card">
                <Icon className="size-6 text-primary" />
              </span>
            </span>
            <span className="text-[0.65rem] tracking-wide text-muted-foreground">{label}</span>
          </Link>
        ))}
      </div>

      {!loading && !user ? (
        <div className="mb-6 text-center">
          <p className="mb-3 text-sm text-muted-foreground">
            Sign in to unlock training, certificates, matching and chat.
          </p>
          <Link to="/auth">
            <RoseButton>Sign in to your empire</RoseButton>
          </Link>
        </div>
      ) : null}

      {profile ? (
        <p className="mb-5 text-center text-xs tracking-widest text-muted-foreground uppercase">
          Welcome, {profile.full_name || "Member"} · {profile.member_type}
        </p>
      ) : null}

      <div className="mb-8 rounded-2xl border border-primary/30 bg-card/60 p-3 shadow-sm sm:p-5">
        <div className="mb-4 text-center">
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">Promotions & Partnerships Hub</p>
          <p className="text-xs text-muted-foreground">Promoters · Donors · Sponsors</p>
        </div>
        <PromotionsHubSection />
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-6 pb-6">
        {tiles.map((t) =>
          t.to === "/smartstart" ? <SmartStartButton key={t.label} /> : <Medallion key={t.label} {...t} />,
        )}
      </div>

    </Shell>
  );
}
