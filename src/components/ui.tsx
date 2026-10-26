import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { AvatarImg } from "./avatar-img";

// Server-safe primitives from replica/design/components.md. Tokens only, no raw colours.

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap transition-[background-color,transform] duration-100 active:scale-[.98] disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus [&_svg]:size-[18px] [&_svg]:shrink-0";
const variants: Record<Variant, string> = {
  primary: "bg-team text-on-team hover:bg-[color-mix(in_srgb,var(--team)_90%,var(--text))]",
  secondary: "bg-surface text-fg border border-border hover:bg-sunken",
  ghost: "text-team-ink hover:bg-team-soft",
  danger: "bg-danger text-on-danger hover:bg-[color-mix(in_srgb,var(--danger)_90%,var(--text))]",
};
const sizes: Record<Size, string> = {
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-13 px-5 text-base",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button type="button" {...props} className={buttonClass(variant, size, className)} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link {...props} className={buttonClass(variant, size, className)} />;
}

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid content-start gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="flex items-center gap-1 text-xs font-medium text-danger">
          <AlertCircle aria-hidden className="size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  "w-full min-h-11 rounded-md border border-border-input bg-bg px-3 text-base text-fg placeholder:text-muted focus:outline-2 focus:outline-focus focus:-outline-offset-1 aria-[invalid=true]:border-danger disabled:bg-sunken";

export function Input({ error, id, ...props }: ComponentProps<"input"> & { error?: string; id: string }) {
  return (
    <input
      id={id}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : props["aria-describedby"]}
      {...props}
      className={`${inputClass} ${props.className ?? ""}`}
    />
  );
}

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div {...props} className={`rounded-lg border border-border bg-bg ${className}`} />;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-lg font-semibold">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid justify-items-center gap-2 rounded-lg border border-dashed border-border-input px-4 py-8 text-center">
      <div className="grid size-13 place-items-center rounded-pill bg-sunken text-muted [&_svg]:size-6" aria-hidden>
        {icon}
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {hint && <p className="max-w-[40ch] text-sm text-muted">{hint}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function Banner({ tone = "info", icon, children }: { tone?: "info" | "warning" | "danger"; icon?: ReactNode; children: ReactNode }) {
  const tones = {
    info: "bg-team-soft [&_svg]:text-team-ink",
    warning: "bg-warning-soft [&_svg]:text-warning",
    danger: "bg-danger-soft [&_svg]:text-danger",
  };
  return (
    <div role={tone === "danger" ? "alert" : undefined} className={`flex items-start gap-2.5 rounded-md px-3.5 py-3 text-sm ${tones[tone]}`}>
      {icon && <span className="mt-0.5 [&_svg]:size-[18px]">{icon}</span>}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Avatar({ name, size = 40, src }: { name: string; size?: 24 | 32 | 40 | 64 | 96; src?: string | null }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  const dims = { 24: "size-6 text-[10px]", 32: "size-8 text-xs", 40: "size-10 text-sm", 64: "size-16 text-lg", 96: "size-24 text-2xl" }[size];
  // Initials sit underneath the photo, so there's never an empty circle while it loads.
  if (src) return <AvatarImg src={src} initials={initials} className={dims} />;
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center rounded-pill bg-team-2 font-bold text-on-team-2 ${dims}`}>
      {initials}
    </span>
  );
}

/**
 * A team's crest, or its initials in the team colours when it has none. Wrapped in the
 * team's colour scope so it shows the right colours anywhere in the app.
 */
export function TeamCrest({
  teamId,
  name,
  crestUrl,
  size = 40,
  className = "",
}: {
  teamId: string;
  name: string;
  crestUrl: string | null | undefined;
  size?: 16 | 20 | 24 | 32 | 40 | 48 | 64;
  className?: string;
}) {
  const dims = { 16: "size-4 text-[7px] rounded-[4px]", 20: "size-5 text-[8px] rounded-[5px]", 24: "size-6 text-[9px] rounded-md", 32: "size-8 text-[11px] rounded-md", 40: "size-10 text-xs rounded-lg", 48: "size-12 text-sm rounded-lg", 64: "size-16 text-base rounded-xl" }[size];
  const initials = name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z0-9]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <span data-team={teamId} aria-hidden className={`grid shrink-0 place-items-center overflow-hidden ${dims} ${crestUrl ? "bg-bg ring-1 ring-border" : "bg-team font-display font-bold text-on-team"} ${className}`}>
      {crestUrl ? <img src={crestUrl} alt="" loading="lazy" decoding="async" className="size-full object-cover" /> : initials}
    </span>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
