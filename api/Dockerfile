FROM node:22-alpine
WORKDIR /app

# The build context is the REPOSITORY ROOT, not api/.
#
# api/catalog.js reads ../shared/product-media.json at import time, and the
# theme renderer reads ../theme. With an api-only context neither is in the
# image: the catalogue throws before the server ever listens, the container
# never comes up, and live checkout goes down with it. The three directories
# keep their relative positions here for that reason.

# Copy the manifest first so a code-only change reuses the install layer.
COPY api/package.json ./api/
RUN cd api && npm install --omit=dev

COPY api ./api
COPY shared ./shared
COPY theme ./theme

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "api/server.js"]
