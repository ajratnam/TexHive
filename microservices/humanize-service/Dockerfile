FROM node:24-alpine

RUN apk update && apk add --no-cache chromium
ENV PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium"

WORKDIR /app

COPY package*.json /app/
RUN npm install

COPY . /app/

ENV PORT=8003
EXPOSE 8003

CMD ["node", "index.js"]