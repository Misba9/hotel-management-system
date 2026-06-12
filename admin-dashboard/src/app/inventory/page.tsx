import { redirect } from "next/navigation";

export default function LegacyInventoryRedirect() {
  redirect("/admin/inventory");
}
