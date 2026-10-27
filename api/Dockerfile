FROM node:22-alpine
WORKDIR /app

# The build context is the REPOSITORY ROOT, not api/.

COPY api/package.json ./api/
RUN cd api && npm install --omit=dev

COPY api ./api
COPY shared ./shared
COPY theme ./theme
COPY theme-overrides ./theme-overrides
# Journal posts, public photography, and the SEO files the API serves itself
# so the storefront does not need the React image.
COPY site/src/content ./site/src/content
COPY site/public ./site/public
COPY seo ./seo

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "api/server.js"]