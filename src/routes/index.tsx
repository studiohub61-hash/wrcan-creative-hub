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
import { UatPanel } from "@/components/UatPanel";
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

      <div className="grid grid-cols-2 gap-x-4 gap-y-6 pb-6">
        {tiles.map((t) =>
          t.to === "/smartstart" ? <SmartStartButton key={t.label} /> : <Medallion key={t.label} {...t} />,
        )}
      </div>

      <UatPanel />
    </Shell>
  );
}
