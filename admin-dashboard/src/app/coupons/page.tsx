import { redirect } from "next/navigation";

export default function LegacyCouponsRedirect() {
  redirect("/admin/marketing");
}
