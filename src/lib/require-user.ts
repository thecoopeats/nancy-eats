import { redirect } from "next/navigation";
import { auth } from "@/auth";

/** Use at the top of any signed-in page. Sends visitors to sign in first. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  return session.user as typeof session.user & { id: string };
}
