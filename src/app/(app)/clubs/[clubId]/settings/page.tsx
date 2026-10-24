import type { Metadata } from "next";
import { getClubAdmin } from "@/lib/data";
import { ClubSettingsForm, ClubAdmins } from "./club-forms";

export const metadata: Metadata = { title: "Club settings" };

export default async function ClubSettingsPage({ params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params;
  const c = (await getClubAdmin(clubId))!;
  if (!c.canEdit) return <p className="text-muted">Only the club owner or admins can change the club.</p>;
  return (
    <div className="grid gap-8">
      <ClubSettingsForm clubId={clubId} club={{ name: c.club.name, color: c.club.color, colorSecondary: c.club.colorSecondary, blurb: c.club.blurb ?? "", joinOpen: c.club.joinOpen, logo: c.club.logo }} />
      <ClubAdmins clubId={clubId} isOwner={c.isOwner} admins={c.admins.map((a) => ({ userId: a.userId, name: `${a.person.firstName} ${a.person.lastName}`, email: a.email, role: a.role, label: a.label }))} />
    </div>
  );
}
