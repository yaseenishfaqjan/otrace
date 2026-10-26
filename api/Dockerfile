FROM node:22-alpine
WORKDIR /app

# The build context is the REPOSITORY ROOT, not api/.

COPY api/package.json ./api/
RUN cd api && npm install --omit=dev

COPY api ./api
COPY shared ./shared
COPY theme ./theme
COPY theme-overrides ./theme-overrides
# Homepage FROM THE STUDIO and theme pages import journal posts from here.
COPY site/src/content ./site/src/content

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "api/server.js"]