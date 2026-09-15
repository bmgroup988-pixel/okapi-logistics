/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@okapi/shared'],
  // Image Docker de production allégée (copie uniquement les fichiers
  // nécessaires à l'exécution) — voir apps/suivi-public/Dockerfile.
  output: 'standalone',
  // La page affiche une seule image servie par URL S3 signée : `next/image`
  // tenterait de la proxifier/optimiser et invaliderait la signature. ESLint
  // Next (règle no-img-element) n'est pas configuré ici ; lint via `tsc`.
  eslint: { ignoreDuringBuilds: true },
  env: {
    NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000/api/v1',
  },
  async redirects() {
    return [{ source: '/', destination: '/fr', permanent: false }];
  },
};

export default nextConfig;
