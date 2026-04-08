import type { Metadata } from "next";
import { DashboardPageFeature } from "@/features/dashboard/dashboard-page";

export const metadata: Metadata = {
  title: "Dashboard"
};

export default function AdminHomePage() {
  return <DashboardPageFeature />;
}
