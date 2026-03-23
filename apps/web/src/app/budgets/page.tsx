import { requireProtectedSession } from "../../lib/server-auth";
import { BudgetsClientPage } from "./page-client";

export default async function BudgetsPage() {
  await requireProtectedSession();
  return <BudgetsClientPage />;
}
