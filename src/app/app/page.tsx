import type { Metadata } from "next";
import { RevenueOSWorkspace } from "@/components/RevenueOSWorkspace";

export const metadata: Metadata = {
  title: "RevenueOS Workspace | iTechSmart",
  description: "Signed-in RevenueOS workspace for tenant bootstrap, CRM proof data, and live API verification.",
  alternates: {
    canonical: "/app",
  },
};

export default function AppPage() {
  return <RevenueOSWorkspace />;
}
