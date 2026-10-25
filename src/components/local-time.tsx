"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * A time shown in the viewer's own time zone. The server doesn't know it (a server in UTC
 * would show a Toronto player the wrong hour), so the text is filled in by the browser.
 */
export function LocalTime({ iso, format, className }: { iso: string; format: (d: Date) => string; className?: string }) {
  const text = useSyncExternalStore(subscribe, () => format(new Date(iso)), () => "");
  return (
    <time dateTime={iso} className={className}>
      {text}
    </time>
  );
}
