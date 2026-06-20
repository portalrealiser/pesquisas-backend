FROM node:22-alpine

WORKDIR /app

# Instala dependências primeiro (melhor cache de build)
COPY package*.json ./
RUN npm install --omit=dev

# Copia o restante do código
COPY . .

ENV NODE_ENV=production
# O EasyPanel serve o app pelo "proxy port". Mantenha 8080 também na variável PORT.
EXPOSE 8080

CMD ["node", "src/index.js"]
