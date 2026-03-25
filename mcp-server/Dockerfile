FROM node:20-alpine
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install
COPY src ./src
RUN npm run build
EXPOSE 3333
CMD ["node", "dist/server.js"]
