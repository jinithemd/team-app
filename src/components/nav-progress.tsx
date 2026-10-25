"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * A thin bar across the top while the next page loads, so a tap always shows something is
 * happening. Starts on any same-site link click or form submit; stops when the address changes.
 * (A loading.tsx skeleton would do this too, but in Next 15 it can leave forms stuck after saving.)
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [active, setActive] = useState(false);

  useEffect(() => setActive(false), [pathname, search]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      setActive(true);
    };
    const onSubmit = () => setActive(true);
    const onDone = () => setActive(false);
    document.addEventListener("click", onClick);
    document.addEventListener("submit", onSubmit);
    window.addEventListener("pageshow", onDone);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("submit", onSubmit);
      window.removeEventListener("pageshow", onDone);
    };
  }, []);

  // Forms that save in place (no new address) end when the button stops being busy.
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setActive(false), 8000);
    return () => clearTimeout(t);
  }, [active]);

  return (
    <div aria-hidden className={`pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden transition-opacity ${active ? "opacity-100" : "opacity-0"}`}>
      <div className="nav-progress h-full w-1/3 bg-team" />
    </div>
  );
}
