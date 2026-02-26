FROM node:20-alpine
WORKDIR /app

COPY naf-server/index.js ./index.js
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

EXPOSE 8888
CMD ["node", "index.js"]
