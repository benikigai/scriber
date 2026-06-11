FROM node:20-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    alsa-utils \
    ca-certificates \
    chromium \
    ffmpeg \
    fonts-liberation \
    pulseaudio \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV SCRIBER_CHROME_EXECUTABLE_PATH=/usr/bin/chromium

EXPOSE 3000

CMD ["npm", "run", "start"]
