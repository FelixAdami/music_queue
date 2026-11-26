FROM node:24-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=node:node . .
USER node

ENV PORT=3001
EXPOSE 3001

CMD ["node", "server.js"]
