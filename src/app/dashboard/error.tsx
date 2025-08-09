"use client";

export default function DashboardError({ error }: { error: Error & { digest?: string } }) {
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold">Error en Dashboard</h2>
      <pre className="mt-2 text-xs bg-red-950/30 text-red-200 p-2 rounded whitespace-pre-wrap">
        {error.message}
      </pre>
    </div>
  );
}
