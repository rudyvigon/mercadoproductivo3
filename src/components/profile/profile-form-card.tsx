"use client";
import { startTransition, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ProfileForm from "@/components/profile/profile-form";
import { useRouter } from "next/navigation";

export default function ProfileFormCard() {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const submitRef = useRef<(() => void) | null>(null);

  const handleClick = () => {
    if (!editing) {
      setEditing(true);
      return;
    }
    // Guardar
    submitRef.current?.();
  };

  return (
    <Card id="profile-form-card" className="md:col-span-2 xl:col-span-3">
      <CardHeader className="pb-3 flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-lg">Mi Perfil</CardTitle>
          <CardDescription>Actualiza tu información personal</CardDescription>
        </div>
        <Button
          size="sm"
          onClick={handleClick}
          variant={editing ? "default" : "outline"}
          className={`ml-auto ${!editing ? "bg-white text-[#f06d04] border border-[#f06d04] hover:bg-[#f06d04]/10" : ""}`}
        >
          {editing ? "Guardar" : "Editar perfil"}
        </Button>
      </CardHeader>
      <CardContent>
        <ProfileForm
          disabled={!editing}
          hideInternalSubmit
          registerSubmit={(fn) => {
            submitRef.current = fn;
          }}
          onSaved={() => {
            setEditing(false);
            // Forzar que el server component del dashboard recalcule los campos requeridos
            startTransition(() => router.refresh());
          }}
        />
      </CardContent>
    </Card>
  );
}
