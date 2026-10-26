"use client";

import { useState } from "react";

/** A profile photo that quietly falls back to initials if there isn't one (or it won't load). */
export function AvatarImg({ src, initials, className }: { src: string; initials: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span aria-hidden className={`grid shrink-0 place-items-center rounded-pill bg-team-2 font-bold text-on-team-2 ${className}`}>{initials}</span>;
  return (
    <span aria-hidden className={`relative grid shrink-0 place-items-center overflow-hidden rounded-pill bg-team-2 font-bold text-on-team-2 ${className}`}>
      {initials}
      <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className="absolute inset-0 size-full object-cover" />
    </span>
  );
}
