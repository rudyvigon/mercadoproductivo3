"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ProfileForm from "@/components/profile/profile-form";

export default function ProfileFormCard() {
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
        <Button size="sm" onClick={handleClick} className="ml-auto">
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
          onSaved={() => setEditing(false)}
        />
      </CardContent>
    </Card>
  );
}
