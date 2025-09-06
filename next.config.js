/** @type {import('next').NextConfig} */
const path = require('path');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
let supabaseHostname = undefined;
try {
  if (SUPABASE_URL) {
    supabaseHostname = new URL(SUPABASE_URL).hostname;
  }
} catch {}

const nextConfig = {
  reactStrictMode: true,
  // Evita ejecutar ESLint y TypeScript dentro de `next build` (la CI ya corre pasos separados)
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: {
    remotePatterns: [
      // Hostname dinámico desde la URL del proyecto Supabase (recomendado)
      ...(supabaseHostname
        ? [{ protocol: 'https', hostname: supabaseHostname, pathname: '/storage/v1/object/public/**' }]
        : []),
      // Permitir cualquier proyecto de Supabase (útil si cambian entornos)
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
      // Fallback explícito por si se utiliza otro proyecto localmente
      { protocol: 'https', hostname: 'xsgcscgdzbhiphgyzbfm.supabase.co', pathname: '/storage/v1/object/public/**' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'plus.unsplash.com' },
      { protocol: 'https', hostname: 'via.placeholder.com' },
    ],
  },
  webpack: (config) => {
    // Configurar alias para rutas absolutas
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, 'src'),
    };
    return config;
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
    ];
  },
  // Las Server Actions están habilitadas por defecto en Next.js 14+
};

module.exports = nextConfig;
