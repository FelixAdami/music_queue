# Stage 1: Build frontend
FROM node:24-alpine AS frontend-build

WORKDIR /app/my-app

COPY my-app/package*.json ./
RUN npm ci

COPY my-app/ ./
# Vite embeds this URL at build time so QR codes open on guest devices.
ARG VITE_PUBLIC_URL
ENV VITE_PUBLIC_URL=$VITE_PUBLIC_URL
RUN npm run build


# Stage 2: Prepare backend
FROM node:24-alpine AS production

WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/ ./

# Copy the compiled React frontend into the application
COPY --from=frontend-build /app/my-app/dist /app/my-app/dist

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"]
