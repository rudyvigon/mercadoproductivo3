export default function LoadingDashboard() {
  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6 animate-pulse">
      {/* Título y subtítulo */}
      <div className="space-y-2">
        <div className="h-8 w-64 bg-muted rounded" />
        <div className="h-4 w-80 bg-muted rounded" />
      </div>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {/* Card: Resumen */}
        <div className="rounded-lg border bg-card p-4">
          <div className="space-y-2 mb-3">
            <div className="h-5 w-24 bg-muted rounded" />
            <div className="h-4 w-48 bg-muted rounded" />
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-4 w-32 bg-muted rounded" />
            </div>
            <div className="flex items-center justify-between">
              <div className="h-4 w-16 bg-muted rounded" />
              <div className="h-4 w-20 bg-muted rounded" />
            </div>
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-6 w-24 bg-muted rounded" />
            </div>
            <div className="flex items-center justify-between">
              <div className="h-4 w-28 bg-muted rounded" />
              <div className="h-4 w-40 bg-muted rounded" />
            </div>
          </div>
        </div>

        {/* Card: Accesos rápidos (xl: col-span-2) */}
        <div className="rounded-lg border bg-card p-4 xl:col-span-2">
          <div className="space-y-2 mb-3">
            <div className="h-5 w-28 bg-muted rounded" />
            <div className="h-4 w-56 bg-muted rounded" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="h-9 bg-muted rounded" />
            <div className="h-9 bg-muted rounded" />
            <div className="h-9 bg-muted rounded" />
            <div className="h-9 bg-muted rounded" />
          </div>
        </div>

        {/* Card: Requisitos para publicar (a lo ancho) */}
        <div className="rounded-lg border bg-card p-4 md:col-span-2 xl:col-span-3">
          <div className="space-y-2 mb-3">
            <div className="h-5 w-64 bg-muted rounded" />
            <div className="h-4 w-80 bg-muted rounded" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="h-4 w-40 bg-muted rounded" />
                <div className="h-6 w-24 bg-muted rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Card: Perfil (formulario embebido) */}
        <div id="profile-form-card" className="rounded-lg border bg-card p-4 md:col-span-2 xl:col-span-3">
          <div className="space-y-2 mb-4">
            <div className="h-5 w-32 bg-muted rounded" />
            <div className="h-4 w-64 bg-muted rounded" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-9 w-full bg-muted rounded" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-9 w-full bg-muted rounded" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-4">
            <div className="space-y-2 lg:col-span-1">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-9 w-full bg-muted rounded" />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-9 w-full bg-muted rounded" />
            </div>
            <div className="space-y-2 lg:col-span-1">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-9 w-full bg-muted rounded" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
