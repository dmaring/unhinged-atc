#!/bin/bash
# Script to help record and convert gameplay demo for README

echo "🎬 Unhinged ATC Demo Recording Helper"
echo "======================================"
echo ""
echo "This script will help you create a demo GIF for the README."
echo ""
echo "STEPS:"
echo "1. Make sure the dev server is running (pnpm dev)"
echo "2. Open http://localhost:5173 in your browser"
echo "3. Use macOS screen recording (Cmd+Shift+5) to record 10-15 seconds of gameplay"
echo "4. Save the recording to this directory as 'demo-raw.mov'"
echo "5. Run this script again to convert to GIF"
echo ""

if [ ! -f "demo-raw.mov" ]; then
  echo "❌ demo-raw.mov not found in current directory"
  echo ""
  echo "Please record your gameplay and save as 'demo-raw.mov', then run this script again."
  echo ""
  echo "Recording tips:"
  echo "  - Keep it under 15 seconds"
  echo "  - Show: login → radar view → issuing commands → chaos button → collision"
  echo "  - Make sure terminal messages are visible"
  exit 1
fi

echo "✅ Found demo-raw.mov"
echo ""
echo "Converting to optimized GIF..."
echo ""

# Convert to GIF with optimization
# - Scale to 800px width (good for README)
# - 10 FPS (smooth but smaller file size)
# - Optimize palette for better quality
ffmpeg -i demo-raw.mov \
  -vf "fps=10,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer" \
  -y demo.gif

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Success! Created demo.gif"
  echo ""
  ls -lh demo.gif
  echo ""
  echo "To add to README.md, use:"
  echo ""
  echo "![Unhinged ATC Gameplay](demo.gif)"
  echo ""
  echo "Or for better GitHub compatibility:"
  echo ""
  echo "<p align=\"center\">"
  echo "  <img src=\"demo.gif\" alt=\"Unhinged ATC Gameplay\" width=\"800\">"
  echo "</p>"
else
  echo ""
  echo "❌ Conversion failed. Check that ffmpeg is installed."
fi
