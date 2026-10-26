import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { signedUrl } from "@/lib/media";

const initials = (name?: string | null) =>
  (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "W";

/** Gold-ringed avatar rendered from a private `avatars` storage path. */
export function Avatar({
  path,
  name,
  size = 44,
  className = "",
}: {
  path?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (!path) return;
    void signedUrl("avatars", path).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [path]);

  return (
    <span
      className={`rose-metal inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.34) }}
    >
      {url ? (
        <img src={url} alt={name ?? "Member"} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

/** Avatar looked up by user id (cached across the app). */
export function UserAvatar({
  userId,
  name,
  size = 40,
  className = "",
}: {
  userId?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}) {
  const { data } = useQuery({
    queryKey: ["avatar-profile", userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("avatar_url, full_name")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <Avatar
      path={data?.avatar_url ?? null}
      name={name ?? data?.full_name ?? null}
      size={size}
      className={className}
    />
  );
}
