FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .

RUN mkdir -p uploads

EXPOSE 3000

ENV NODE_ENV=production

CMD ["sh", "-c", "node wait-for-postgres.js && node app.js"]
