ARG NODE_IMAGE=node:20-bookworm
ARG LIBRECHAT_ARCHIVE=LibreChat-0.8.6-rc1.tar.gz
ARG LIBRECHAT_ARCHIVE_SHA256=ccc1adcbe0e7ab62839c2ab952bb2b3d6d7371eab8aaa13d84fbce4c629fb5ad

FROM ${NODE_IMAGE} AS source
ARG LIBRECHAT_ARCHIVE
ARG LIBRECHAT_ARCHIVE_SHA256
COPY integrations/librechat/upstream/${LIBRECHAT_ARCHIVE} /tmp/librechat.tar.gz
RUN echo "${LIBRECHAT_ARCHIVE_SHA256}  /tmp/librechat.tar.gz" | sha256sum -c - \
  && mkdir /src \
  && tar -xzf /tmp/librechat.tar.gz -C /src --strip-components=1 \
  && rm /tmp/librechat.tar.gz
COPY integrations/librechat/patches /patches
RUN node /patches/apply-patches.js /src

FROM source AS build
ARG LIBRECHAT_NPM_CACHE_ID=librechat-npm
WORKDIR /src
RUN --mount=type=cache,id=${LIBRECHAT_NPM_CACHE_ID},target=/root/.npm,sharing=locked \
  npm config set fetch-retry-maxtimeout 120000 \
  && npm config set fetch-retries 3 \
  && npm ci --no-audit --no-fund
RUN npm run frontend

FROM ${NODE_IMAGE} AS runtime
ARG LIBRECHAT_NPM_CACHE_ID=librechat-npm
RUN curl --version
WORKDIR /app
COPY --from=source /src/package.json /src/package-lock.json ./
COPY --from=source /src/api/package.json ./api/package.json
COPY --from=source /src/client/package.json ./client/package.json
COPY --from=source /src/packages/data-provider/package.json ./packages/data-provider/package.json
COPY --from=source /src/packages/data-schemas/package.json ./packages/data-schemas/package.json
COPY --from=source /src/packages/api/package.json ./packages/api/package.json
COPY --from=source /src/packages/client/package.json ./packages/client/package.json
RUN --mount=type=cache,id=${LIBRECHAT_NPM_CACHE_ID},target=/root/.npm,sharing=locked \
  npm config set fetch-retry-maxtimeout 120000 \
  && npm config set fetch-retries 3 \
  && npm ci --omit=dev --no-audit --no-fund
COPY --from=source /src/api ./api
COPY --from=source /src/config ./config
COPY --from=build /src/packages/data-provider/dist ./packages/data-provider/dist
COPY --from=build /src/packages/data-schemas/dist ./packages/data-schemas/dist
COPY --from=build /src/packages/api/dist ./packages/api/dist
COPY --from=build /src/client/dist ./client/dist
ENV HOST=0.0.0.0
ENV PORT=3080
EXPOSE 3080
WORKDIR /app/api
CMD ["node", "server/index.js"]
