"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

type ProfileAuthorLinkProps = {
  username: string;
  className?: string;
  children?: React.ReactNode;
};

export default function ProfileAuthorLink({
  username,
  className,
  children,
}: ProfileAuthorLinkProps) {
  return (
    <Link
      href={`/profile/${encodeURIComponent(username)}`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      className={cn(
        "font-medium text-foreground/90 hover:text-primary hover:underline underline-offset-2",
        className,
      )}
    >
      {children ?? username}
    </Link>
  );
}
