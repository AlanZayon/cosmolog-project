"use client";

import Link from "next/link";
import type { ApiProfile } from "@/lib/api/types";

type ProfileSearchCardProps = {
  profile: ApiProfile;
};

export default function ProfileSearchCard({ profile }: ProfileSearchCardProps) {
  const href = `/profile/${encodeURIComponent(profile.username)}`;

  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-accent"
    >
      {profile.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt=""
          className="h-12 w-12 shrink-0 rounded-full object-cover border border-border"
        />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-lg font-semibold text-muted-foreground">
          {profile.username[0]?.toUpperCase() || "?"}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm truncate">@{profile.username}</p>
        {profile.bio ? (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{profile.bio}</p>
        ) : null}
      </div>
    </Link>
  );
}
