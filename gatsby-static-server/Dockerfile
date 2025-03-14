# Stage 1: Clone and build the Gatsby site
FROM node:20-alpine AS builder
WORKDIR /app

# Install git and build dependencies (python3, make, g++) needed by node-gyp
RUN apk add --no-cache git python3 make g++

# Clone the repository UPDATE COMMIT AS NEEDED!!!!
RUN git clone https://github.com/codevideo/codevideo-ide-react.git && \
    cd codevideo-ide-react && \
    git checkout d26c2c8c033b65155c540f01b380be20bbf41e9a && \
    # replace index.tsx with v3.tsx - there is some issue with prefix paths, it always redirects to the index page???
    cp example/src/pages/v3.tsx example/src/pages/index.tsx

# Change working directory to the example folder (where the Gatsby site is)
WORKDIR /app/codevideo-ide-react/example

# Install dependencies and build the production site
RUN npm install
RUN npm run build

# Stage 2: Serve the built site
FROM node:20-alpine
WORKDIR /app

# Copy the production build output (Gatsby outputs to the "public" folder by default)
COPY --from=builder /app/codevideo-ide-react/example/public ./public

# Install a simple static file server globally
RUN npm install -g serve

# Expose port 7001 (as mapped in your docker-compose)
EXPOSE 7001

# Use "serve" to serve the static site from the public folder
CMD ["serve", "-s", "public", "-l", "7001"]
