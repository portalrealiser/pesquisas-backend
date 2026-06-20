# ===== Etapa 1: build do frontend (React + Vite) =====
FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ===== Etapa 2: backend + frontend servido no mesmo domínio =====
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY src ./src
# Copia o build do frontend pra ser servido pelo backend (pasta ./public)
COPY --from=frontend /app/frontend/dist ./public
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "src/index.js"]
