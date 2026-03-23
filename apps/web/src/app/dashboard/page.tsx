import { requireProtectedSession } from "../../lib/server-auth";
import { DashboardClientPage } from "./page-client";

export default async function DashboardPage() {
  await requireProtectedSession();
  return <DashboardClientPage />;
}
