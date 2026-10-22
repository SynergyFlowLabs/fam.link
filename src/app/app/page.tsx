import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function AppHome() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-ink-soft">Signed in as {user.email}.</p>
    </div>
  );
}
