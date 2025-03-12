#!/bin/sh
# Simple script to test audio functionality

# Generate a short test tone and play it
echo "Generating test tone..."
AUDIODEV=virtual_output speaker-test -t sine -f 440 -l 1 &
SPEAKER_PID=$!

# Let it play for a moment
sleep 2

# Kill the speaker test
kill $SPEAKER_PID 2>/dev/null || true

# Verify pulse is still running
if pgrep pulseaudio > /dev/null; then
  echo "✅ PulseAudio is running properly"
else
  echo "❌ PulseAudio is not running"
  exit 1
fi

# Show active sound devices
echo "ALSA devices:"
aplay -l

echo "Audio test completed"