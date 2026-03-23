import { redirectAuthenticatedUser } from "../../lib/server-auth";
import { ForgotPasswordClientPage } from "./page-client";

export default async function ForgotPasswordPage() {
  await redirectAuthenticatedUser();
  return <ForgotPasswordClientPage />;
}
