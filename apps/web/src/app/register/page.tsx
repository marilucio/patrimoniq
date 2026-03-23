import { redirectAuthenticatedUser } from "../../lib/server-auth";
import { RegisterClientPage } from "./page-client";

export default async function RegisterPage() {
  await redirectAuthenticatedUser();
  return <RegisterClientPage />;
}
