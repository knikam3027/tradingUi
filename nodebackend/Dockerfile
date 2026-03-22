FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --only=production

COPY . .

# Ensure runtime data directory exists
RUN mkdir -p data

EXPOSE 8000

CMD ["node", "server.js"]
