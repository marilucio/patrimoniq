import { requireProtectedSession } from "../../lib/server-auth";
import { NetWorthClientPage } from "./page-client";

export default async function NetWorthPage() {
  await requireProtectedSession();
  return <NetWorthClientPage />;
}
