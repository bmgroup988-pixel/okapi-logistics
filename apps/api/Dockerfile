# Image de production de l'API Okapi Logistics.
# Contexte de build = RACINE du monorepo (dépendance workspace @okapi/shared) :
#   docker build -f apps/api/Dockerfile -t okapi-api:latest .
#
# Les migrations (prisma migrate deploy) et les contraintes SQL
# (db:constraints) NE sont PAS lancées automatiquement au démarrage du
# conteneur — à exécuter explicitement en étape de déploiement (voir
# docs/10-guide-hebergement-ovhcloud.md), pour ne jamais les rejouer par
# accident à chaque redémarrage/scale-up.

FROM node:20-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
# @okapi/shared a un script "prepare" (build auto au npm ci) : besoin de sa
# source complète, pas seulement de son package.json.
COPY packages/shared packages/shared
# Postinstall (prisma generate) a besoin du schéma — copié avant `npm ci`.
COPY apps/api/prisma apps/api/prisma
RUN npm ci --workspace @okapi/shared --workspace @okapi/api --include-workspace-root

FROM deps AS build
COPY apps/api apps/api
RUN npm run build --workspace @okapi/api
# `npm prune` retire les devDependencies de node_modules SANS rejouer les
# scripts d'installation (contrairement à un second `npm ci --omit=dev`, qui
# redéclenche le "prepare" de @okapi/shared et échoue car @types/node aurait
# déjà été retiré). Le node_modules pruné est copié tel quel dans le runtime.
RUN npm prune --omit=dev

# ---------------------------------------------------------------- runtime
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S okapi && adduser -S okapi -G okapi

COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/package.json ./
COPY --from=build /repo/packages/shared/package.json packages/shared/package.json
COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/apps/api/package.json apps/api/package.json
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/api/prisma apps/api/prisma

USER okapi
WORKDIR /app/apps/api
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD \
  node -e "fetch('http://localhost:3000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
