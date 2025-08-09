This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
```

Abre http://localhost:3000 en tu navegador (el proyecto siempre corre en el puerto 3000 por defecto).

Puedes empezar a editar la página principal en `src/app/page.tsx`. La página se actualiza automáticamente al guardar.

Fuentes: se usa `Inter` con [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts), definido en `src/app/layout.tsx`.

Build y producción:

```bash
npm run build
npm run start
```

Calidad de código:

```bash
npm run type-check
npm run lint
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.
Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## CI (GitHub Actions)

Este repo ejecuta CI en cada push/PR contra `main` con el workflow `.github/workflows/ci.yml`:

- __Type check__: `npm run type-check`
- __Lint__: `npm run lint`
- __Build__: `npm run build`

En GitHub, verás el check "CI". Puedes requerirlo en protección de rama.

## Protección de rama (`main`)

Recomendado habilitar en GitHub:

- __Require a pull request before merging__ (1 revisión mínima).
- __Require status checks to pass before merging__: seleccionar "CI".
- __Require branches to be up to date before merging__.

Ruta: `Settings` > `Branches` > `Branch protection rules` > `New rule` > Branch name pattern: `main`.

## Deploy con Vercel

1. En Vercel, "Add New... > Project" y elige `rudyvigon/mercadoproductivo3`.
2. Framework: Next.js (detectado automáticamente).
3. Comandos: Build `npm run build`, Dev `npm run dev`.
4. Variables de entorno: actualmente no se requieren (se puede añadir más tarde si procede).
5. Deploy. Vercel creará un dominio preview por PR y producirá en `main`.

Este repo incluye `vercel.json` con comandos de build/dev y el proyecto está listo para auto-deploy por GitHub App de Vercel.
