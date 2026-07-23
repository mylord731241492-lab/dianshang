ARG NODE_IMAGE=node:20-bookworm
FROM ${NODE_IMAGE} AS frontend-build

WORKDIR /build/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

FROM ${NODE_IMAGE}

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3456

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

COPY --from=frontend-build /build/frontend/dist /app/frontend/dist

RUN node scripts/patch-canvas-server-image-storage.js

RUN mkdir -p /app/data /app/uploads /app/logs

EXPOSE 3456

CMD ["node", "server.js"]
