# Stage 1: Build the Go binary
FROM golang:1.23-alpine AS builder

# Install git (if needed for dependencies)
RUN apk add --no-cache git
WORKDIR /usr/src/app

# Copy go mod files and download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy all source files (ensure your build context includes the necessary folders)
COPY . .

# Copy environment file
COPY .env .

# Build the binary with optimizations for production (-s -w removes debug info)
RUN go build -ldflags="-s -w" -o go-video-dispatcher main.go

# Optional: if your Go code uses the puppeteer-runner,
# ensure that folder is in your build context and copy it here.
# For example, if it's located at ./puppeteer-runner relative to go-video-dispatcher:
RUN apk add --no-cache nodejs npm
WORKDIR /usr/src/app/puppeteer-runner
RUN npm install

# Stage 2: Create a minimal runtime image
FROM alpine:latest

# Install required runtime packages
RUN apk add --no-cache \
    ca-certificates \
    nodejs \
    npm \
    chromium \
    ffmpeg \
    fontconfig \
    font-noto-all \
    ttf-dejavu
    # maybe for audio capture idk
    # alsa-lib \
    # alsa-utils \
    # pulseaudio \
    # pulseaudio-utils \
    # dbus \
    # dbus-x11 \
    # xvfb \
    # libstdc++ \
    # mesa-dri-gallium \
    # sudo

# Create necessary directories for PulseAudio
# RUN mkdir -p /etc/pulse /run/pulse /run/dbus /root/.config/pulse

# # Set proper permissions
# RUN chmod 777 /run/pulse /tmp

# # Configure PulseAudio to work in containerized environment
# COPY pulse-client.conf /etc/pulse/client.conf
# COPY system.pa /etc/pulse/system.pa

# # Add ALSA configuration for routing to PulseAudio
# COPY asound.conf /etc/asound.conf

WORKDIR /usr/src/app

# Copy the Go binary from the builder stage
COPY --from=builder /usr/src/app/go-video-dispatcher .

# Copy the puppeteer-runner folder if needed by the Go binary
COPY --from=builder /usr/src/app/puppeteer-runner ./puppeteer-runner

# Copy the environment file into the final image
COPY --from=builder /usr/src/app/.env .

# Expose the appropriate port if your service listens on one (internal only if not published)
EXPOSE 7000

# Copy the start script and audio test script
# COPY start-services.sh test-audio.sh /usr/src/app/
# RUN chmod +x /usr/src/app/start-services.sh /usr/src/app/test-audio.sh

# Set Chromium flags as environment variables to ensure audio works
# ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
# ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
# ENV DISPLAY=:99
# ENV PULSE_SERVER=/run/pulse/native

# Make sure these directories exist with proper permissions
# RUN mkdir -p /run/pulse/.config/pulse && \
#     chmod -R 777 /run/pulse

# Run the binary with PulseAudio in the background
# CMD ["/usr/src/app/start-services.sh", "./go-video-dispatcher"]
CMD ["./go-video-dispatcher"]