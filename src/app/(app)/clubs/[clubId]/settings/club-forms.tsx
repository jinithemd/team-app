"use client";

import { useActionState, useState } from "react";
import { clubAdminAction, updateClubAction, type FormState } from "@/app/actions";
import { Button, Field, Input, buttonClass, inputClass } from "@/components/ui";
import { ColorField } from "@/app/(app)/teams/new/create-team-form";

/** Read a logo file and shrink anything big, keeping SVGs as they are. */
async function readLogo(file: File): Promise<string> {
  if (file.type === "image/svg+xml") return await new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.readAsDataURL(file);
  });
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const size = Math.min(512, Math.max(img.width, img.height));
    const scale = size / Math.max(img.width, img.height);
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ClubSettingsForm({ clubId, club }: { clubId: string; club: { name: string; color: string; colorSecondary: string | null; blurb: string; joinOpen: boolean; logo: string | null } }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateClubAction.bind(null, clubId), null);
  const fe = state?.fieldErrors ?? {};
  const [color, setColor] = useState(club.color);
  const [secondary, setSecondary] = useState<string | null>(club.colorSecondary);
  const [logo, setLogo] = useState<string | null>(club.logo);
  const [logoErr, setLogoErr] = useState<string | null>(null);
  return (
    <form action={action} className="grid gap-6" noValidate>
      <h2 className="text-xl font-bold">Name, logo and colours</h2>
      <Field id="name" label="Club name" error={fe.name}>
        <Input id="name" name="name" maxLength={80} defaultValue={club.name} error={fe.name} />
      </Field>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-semibold">Club logo</legend>
        <input type="hidden" name="logo" value={logo ?? ""} />
        <div className="flex items-center gap-4">
          <span className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-surface">
            {logo ? <img src={logo} alt="Club logo" className="size-full object-contain" /> : <span className="text-xs text-muted">No logo</span>}
          </span>
          <div className="grid gap-1.5">
            <label className={buttonClass("secondary", "sm", "cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus")}>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  setLogoErr(null);
                  if (!f) return;
                  if (f.size > 5_000_000) return setLogoErr("That file is over 5 MB.");
                  const d = await readLogo(f);
                  if (d.length > 400_000) return setLogoErr("Still too big after shrinking. Try a PNG or SVG.");
                  setLogo(d);
                }}
              />
              {logo ? "Change logo" : "Upload logo"}
            </label>
            {logo && (
              <button type="button" className="justify-self-start text-sm font-semibold text-muted" onClick={() => setLogo(null)}>
                Remove
              </button>
            )}
            <p className="text-xs text-muted">Square PNG, JPG or SVG. Shows in the header, on the club page and on players&apos; home screens.</p>
          </div>
        </div>
        {(logoErr || fe.logo) && <p className="text-xs font-medium text-danger">{logoErr ?? fe.logo}</p>}
      </fieldset>
      <ColorField label="Club colour" name="color" value={color} onChange={(v) => v && setColor(v)} error={fe.color} />
      <ColorField label="Second colour" name="colorSecondary" value={secondary} onChange={setSecondary} optional />
      <Field id="blurb" label="A line about the club" hint="On the public club page">
        <textarea id="blurb" name="blurb" rows={2} maxLength={280} defaultValue={club.blurb} className={`${inputClass} py-2`} />
      </Field>
      <label className="flex items-start gap-3">
        <input type="checkbox" name="joinOpen" defaultChecked={club.joinOpen} className="mt-1 size-4 accent-[var(--team)]" />
        <span>
          <span className="block text-sm font-semibold">Taking new players</span>
          <span className="block text-xs text-muted">People who find the club page can ask to join a team.</span>
        </span>
      </label>
      {state?.error && !Object.keys(fe).length && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm font-medium text-success">{state.message}</p>}
      <button className={buttonClass("primary", "lg", "w-full sm:w-auto sm:justify-self-start")} disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </button>
      <p className="text-xs text-muted">Club teams use these colours. Players see your name and logo everywhere in the app; &quot;Powered by Areno&quot; stays small at the bottom.</p>
    </form>
  );
}

export function ClubAdmins({ clubId, isOwner, admins }: { clubId: string; isOwner: boolean; admins: { userId: string; name: string; email: string; role: string; label: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(clubAdminAction.bind(null, clubId), null);
  return (
    <section aria-labelledby="admins-h" className="grid gap-3">
      <h2 id="admins-h" className="text-xl font-bold">
        Club admins
      </h2>
      <p className="text-sm text-muted">Admins run every club team. The treasurer sees and confirms dues for every team.</p>
      <ul>
        {admins.map((a) => (
          <li key={a.userId} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2.5">
            <span className="min-w-0">
              <span className="block font-semibold">{a.name}</span>
              <span className="block text-sm break-all text-muted">
                {a.label} · {a.email}
              </span>
            </span>
            {isOwner && a.role !== "owner" && (
              <form action={action}>
                <input type="hidden" name="remove" value={a.userId} />
                <Button type="submit" variant="ghost" size="sm" disabled={pending}>
                  Remove
                </Button>
              </form>
            )}
          </li>
        ))}
      </ul>
      {isOwner && (
        <form action={action} className="grid gap-3 rounded-lg border border-border p-4" noValidate>
          <h3 className="font-semibold">Add someone</h3>
          <Field id="admin-email" label="Their email" error={state?.fieldErrors?.email}>
            <Input id="admin-email" name="email" type="email" error={state?.fieldErrors?.email} />
          </Field>
          <label className="grid gap-1 text-sm font-semibold">
            As
            <select name="role" defaultValue="admin" className={`${inputClass} sm:max-w-xs`}>
              <option value="admin">Club admin</option>
              <option value="treasurer">Club treasurer</option>
            </select>
          </label>
          {state?.error && !state.fieldErrors && <p role="alert" className="text-sm text-danger">{state.error}</p>}
          {state?.ok && <p role="status" className="text-sm text-success">{state.message}</p>}
          <button className={buttonClass("primary", "md", "justify-self-start")} disabled={pending}>
            Add
          </button>
        </form>
      )}
    </section>
  );
}
