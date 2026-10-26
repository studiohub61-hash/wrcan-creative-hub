import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Shell } from "@/components/Shell";
import { Field, RoseButton, inputClass } from "@/components/EmpireUI";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in to your Empire — WRCAN App" },
      {
        name: "description",
        content:
          "Sign in or register on WRCAN to access accredited training, certificates, auto-matched jobs and real-time chat.",
      },
      { property: "og:title", content: "Sign in to your Empire — WRCAN App" },
      {
        property: "og:description",
        content: "Register as a student, job seeker, recruiter or catering company on WRCAN.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  fullName: z.string().trim().max(120).optional(),
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) void navigate({ to: "/profile", replace: true });
  }, [loading, user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password, fullName });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]!.message);
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: parsed.data.fullName ?? "" },
          },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Check your email to confirm your account.");
        } else {
          toast.success("Welcome to WRCAN. Complete your profile.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
        toast.success("Signed in.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (res.error) toast.error(res.error.message ?? "Google sign-in failed");
  };

  return (
    <Shell title="Sign in to your Empire" subtitle="WRCAN Specialists">
      <form onSubmit={submit} className="mx-auto mt-4 max-w-sm space-y-4">
        {mode === "signup" ? (
          <Field label="Full name">
            <input
              className={inputClass}
              value={fullName}
              maxLength={120}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
            />
          </Field>
        ) : null}

        <Field label="Email">
          <input
            className={inputClass}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.co.za"
          />
        </Field>

        <Field label="Password">
          <input
            className={inputClass}
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </Field>

        <div className="flex flex-col items-center gap-3 pt-2">
          <RoseButton type="submit" disabled={busy} className="w-full">
            {mode === "signin" ? "Sign in as operator" : "Create my empire"}
          </RoseButton>
          <RoseButton type="button" variant="outline" className="w-full" onClick={google}>
            Continue with Google
          </RoseButton>
          <button
            type="button"
            className="text-xs tracking-widest text-muted-foreground uppercase hover:text-primary"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "New here? Register" : "Already registered? Sign in"}
          </button>
        </div>
      </form>
    </Shell>
  );
}
