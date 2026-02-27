FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
COPY config/.env.example ./config/.env.example

RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]

