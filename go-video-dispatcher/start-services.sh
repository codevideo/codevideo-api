#!/bin/sh
set -e

# Create directories
mkdir -p /var/run/dbus /run/pulse /tmp/pulse

# Remove any existing PulseAudio socket or pid files
rm -f /tmp/pulse-socket /tmp/pulse-*.socket /tmp/pulse-*.pid /run/pulse/* /run/dbus/pid

# Remove X server locks
rm -f /tmp/.X*-lock /tmp/.X11-unix/X*

# Clean up any existing processes
pkill pulseaudio 2>/dev/null || true
pkill Xvfb 2>/dev/null || true
pkill dbus-daemon 2>/dev/null || true

# Start dbus daemon required for PulseAudio
dbus-daemon --system --fork

# Sleep to ensure dbus is up
sleep 2

# Start Xvfb
Xvfb :99 -screen 0 1920x1080x24 -ac &
export DISPLAY=:99

# Wait for Xvfb to initialize
sleep 2

# Set specific PulseAudio permissions
chmod 777 /tmp /run/pulse

# Start PulseAudio in system mode with specific config
pulseaudio --system --disallow-exit --disallow-module-loading --log-level=debug --exit-idle-time=-1 --file=/etc/pulse/system.pa &

# Give it time to fully initialize
sleep 3

# Create virtual sink for audio capture
pactl load-module module-null-sink sink_name=virtual_output sink_properties=device.description="Virtual_Output"
pactl load-module module-loopback source=virtual_output.monitor sink=virtual_output latency_msec=1

# Set as default sink
pactl set-default-sink virtual_output

# Verify audio setup
echo "=== PulseAudio Status ==="
pactl info
echo "=== PulseAudio Sinks ==="
pactl list short sinks
echo "=== PulseAudio Sources ==="
pactl list short sources

# Run a quick audio test to verify our setup works
echo "Testing audio setup..."
/usr/src/app/test-audio.sh

# Start the main application
echo "Starting main application: $@"
exec "$@"