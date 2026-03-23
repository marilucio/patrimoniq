import { requireProtectedSession } from "../../lib/server-auth";
import { ReportsClientPage } from "./page-client";

export default async function ReportsPage() {
  await requireProtectedSession();
  return <ReportsClientPage />;
}
