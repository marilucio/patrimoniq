import { requireProtectedSession } from "../../lib/server-auth";
import { GoalsClientPage } from "./page-client";

export default async function GoalsPage() {
  await requireProtectedSession();
  return <GoalsClientPage />;
}
