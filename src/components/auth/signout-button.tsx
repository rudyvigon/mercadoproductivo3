"use client";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";

export default function SignOutButton() {
  const supabase = createClient();
  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
  }
  return (
    <Button variant="secondary" onClick={signOut}>
      <LogOut size={16} />
      Cerrar sesión
    </Button>
  );
}
