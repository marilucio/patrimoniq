import { redirectAuthenticatedUser } from "../../lib/server-auth";
import { LoginClientPage } from "./page-client";

export default async function LoginPage() {
  await redirectAuthenticatedUser();
  return <LoginClientPage />;
}
