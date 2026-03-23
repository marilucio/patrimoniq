import { requireProtectedSession } from "../../lib/server-auth";
import { SettingsClientPage } from "./page-client";

export default async function SettingsPage() {
  await requireProtectedSession();
  return <SettingsClientPage />;
}
