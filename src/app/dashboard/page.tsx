import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/auth/signout-button";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 p-6">
      <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
      <pre className="rounded-lg bg-muted/20 p-4 text-sm text-muted-foreground ring-1 ring-border">
        {JSON.stringify(user, null, 2)}
      </pre>
      <div>
        <SignOutButton />
      </div>
    </main>
  );
}
