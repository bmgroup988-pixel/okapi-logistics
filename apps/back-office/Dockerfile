# Image de production du back-office (SPA statique servie par nginx).
# Contexte de build = RACINE du monorepo :
#   docker build -f apps/back-office/Dockerfile \
#     --build-arg VITE_API_BASE=https://api.votredomaine.com/api/v1 \
#     -t okapi-back-office:latest .

FROM node:20-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/back-office/package.json apps/back-office/package.json
# @okapi/shared a un script "prepare" (build auto au npm ci) : besoin de sa
# source complète, pas seulement de son package.json.
COPY packages/shared packages/shared
RUN npm ci --workspace @okapi/shared --workspace @okapi/back-office --include-workspace-root

COPY apps/back-office apps/back-office

ARG VITE_API_BASE=/api/v1
ENV VITE_API_BASE=${VITE_API_BASE}
RUN npm run build --workspace @okapi/back-office

# ---------------------------------------------------------------- runtime
FROM nginx:1.27-alpine AS runtime
COPY apps/back-office/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/back-office/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD \
  wget -qO- http://localhost/ >/dev/null || exit 1
