FROM node:20-slim

# ffmpeg for WAV->MP3 encoding
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY tsconfig.json ./
COPY src ./src

# Hugging Face model cache lives here; mount a volume to persist the ~300MB
# Kokoro model across container restarts (otherwise re-downloaded on each boot).
ENV HF_HOME=/app/.hf-cache
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
