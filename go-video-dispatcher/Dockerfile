# Stage 1: Build the Go binary
FROM golang:1.23-alpine AS builder

# Install git (if needed for dependencies)
RUN apk add --no-cache git
WORKDIR /usr/src/app

# Copy go.mod and go.sum files and download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy all source files
COPY . .

# Copy environment file
COPY .env .

# Build the binary with optimizations for production (-s -w removes debug info)
RUN go build -ldflags="-s -w" -o go-video-dispatcher main.go

# Stage 2: Build the puppeteer-runner
RUN apk add --no-cache nodejs npm
WORKDIR /usr/src/app/puppeteer-runner
RUN npm install

# Stage 2: Create a minimal runtime image
FROM zenika/alpine-chrome:with-puppeteer

# Switch to root to install packages
USER root

# Install FFmpeg (needed for final webm to mp4 conversion)
RUN apk add --no-cache ffmpeg

WORKDIR /usr/src/app

# Copy the Go binary from the builder stage
COPY --from=builder /usr/src/app/go-video-dispatcher .

# Copy the puppeteer-runner folder if needed by the Go binary
COPY --from=builder /usr/src/app/puppeteer-runner ./puppeteer-runner

# Copy the environment file into the final image
COPY --from=builder /usr/src/app/.env .

# Expose 7000
EXPOSE 7000

CMD ["./go-video-dispatcher"]