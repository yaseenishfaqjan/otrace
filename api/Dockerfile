FROM node:22-alpine
WORKDIR /app
# Copy the manifest first so a code-only change reuses the install layer.
COPY package.json ./
RUN npm install --omit=dev
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
