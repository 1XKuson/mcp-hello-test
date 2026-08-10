FROM node:22-alpine

WORKDIR /app

# Copy manifests first so dependency layers survive edits to server.js.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.js ./

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
