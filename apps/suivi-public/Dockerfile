# Image de production du site public de suivi (Next.js, sortie "standalone").
# Contexte de build = RACINE du monorepo :
#   docker build -f apps/suivi-public/Dockerfile \
#     --build-arg NEXT_PUBLIC_API_BASE=https://api.votredomaine.com/api/v1 \
#     -t okapi-suivi-public:latest .
# NEXT_PUBLIC_API_BASE est figée DANS le bundle au build (comportement Next.js
# standard) : une image par environnement (staging/production) si l'URL diffère.

FROM node:20-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/suivi-public/package.json apps/suivi-public/package.json
# @okapi/shared a un script "prepare" (build auto au npm ci) : besoin de sa
# source complète, pas seulement de son package.json.
COPY packages/shared packages/shared
RUN npm ci --workspace @okapi/shared --workspace @okapi/suivi-public --include-workspace-root

COPY apps/suivi-public apps/suivi-public

ARG NEXT_PUBLIC_API_BASE=http://localhost:3000/api/v1
ENV NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE}
RUN npm run build --workspace @okapi/suivi-public

# ---------------------------------------------------------------- runtime
FROM node:20-alpine AS runtime
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
RUN addgroup -S okapi && adduser -S okapi -G okapi

COPY --from=build /repo/apps/suivi-public/.next/standalone ./
COPY --from=build /repo/apps/suivi-public/.next/static ./apps/suivi-public/.next/static
COPY --from=build /repo/apps/suivi-public/public ./apps/suivi-public/public

USER okapi
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD \
  node -e "fetch('http://localhost:3000/fr').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/suivi-public/server.js"]
