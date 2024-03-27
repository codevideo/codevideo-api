# Use official Node.js image
FROM node:20 AS builder

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build TypeScript files
RUN npm run build

# Stage 2: Use a Debian-based Node.js image to run the app
FROM node:20-slim

# Set working directory
WORKDIR /usr/src/app

# Install necessary Linux CLI tools
RUN apt-get update && \
    apt-get install -y festival lame && \
    apt-get clean

# BEGIN PUPPETEER INSTALLATION - NON TRIVIAL, SEE: https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md

# Install latest chrome dev package and fonts to support major charsets (Chinese, Japanese, Arabic, Hebrew, Thai and a few others)
# Note: this installs the necessary libs to make the bundled version of Chromium that Puppeteer
# installs, work.
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Install puppeteer so it's available in the container.
RUN npm init -y &&  \
    npm i puppeteer \
    # Add user so we don't need --no-sandbox.
    # same layer as npm install to keep re-chowned files from using up several hundred MBs more space
    && groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
    && mkdir -p /home/pptruser/Downloads \
    && chown -R pptruser:pptruser /home/pptruser \
    && chown -R pptruser:pptruser /node_modules \
    && chown -R pptruser:pptruser /package.json \
    && chown -R pptruser:pptruser /package-lock.json

# END PUPPETEER INSTALLATION

# Copy only the built files from the previous stage
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/swagger.json ./
COPY --from=builder /usr/src/app/.env ./
COPY --from=builder /usr/src/app/codeVideoAsciiArt.txt ./

# Install production dependencies
RUN npm install --only=production

# Expose port 7000
EXPOSE 7000

# Command to run your app
CMD ["node", "./dist/index.js"]
