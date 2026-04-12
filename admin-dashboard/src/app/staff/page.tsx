import { redirect } from "next/navigation";

/** @deprecated Use `/admin/staff` (inside admin shell). */
export default function LegacyStaffPage() {
  redirect("/admin/staff");
}
