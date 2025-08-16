"use client";
import { useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Redirector({ url }: { url: string }) {
  useEffect(() => {
    if (url) {
      try {
        window.location.assign(url);
      } catch {}
    }
  }, [url]);

  return (
    <div className="mx-auto max-w-md p-6">
      <Card>
        <CardHeader>
          <CardTitle>Redirigiendo…</CardTitle>
          <CardDescription>Te estamos llevando al checkout. Si no ocurre automáticamente, usa el botón.</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-end">
          <Button asChild>
            <Link href={url || "/dashboard/plan"}>Continuar</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
