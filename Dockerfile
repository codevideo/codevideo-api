FROM node:20-slim

WORKDIR /app

# install all deps (incl. TypeScript) so we can compile, then prune dev deps for
# a lean runtime image
COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

ENV NODE_ENV=production
ENV GENIE_HTTP_PORT=3001
# runs behind the codevideo-api nginx; trust one proxy hop so express-rate-limit
# keys on the real client IP (X-Forwarded-For)
ENV GENIE_TRUST_PROXY=1
EXPOSE 3001

# one port serves both the HTTP trigger and the WebSocket stream
CMD ["node", "dist/index.js"]
