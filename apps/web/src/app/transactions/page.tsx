import { requireProtectedSession } from "../../lib/server-auth";
import { TransactionsClientPage } from "./page-client";

export default async function TransactionsPage() {
  await requireProtectedSession();
  return <TransactionsClientPage />;
}
