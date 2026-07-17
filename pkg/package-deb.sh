#!/data/data/com.termux/files/usr/bin/bash

# ==========================================
# Deepcode Termux Package Builder
# ==========================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_DIR/build"
DEB_DIR="$BUILD_DIR/deb"
VERSION=$(node -e "console.log(require('$PROJECT_DIR/package.json').version)")

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           Deepcode Termux Package Builder v${VERSION}           ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Clean previous build
echo -e "${YELLOW}[*] Cleaning previous build...${NC}"
rm -rf "$BUILD_DIR"
mkdir -p "$DEB_DIR/data/data/com.termux/files/usr"
mkdir -p "$DEB_DIR/data/data/com.termux/files/usr/bin"
mkdir -p "$DEB_DIR/data/data/com.termux/files/usr/share/deepcode"

PREFIX="$DEB_DIR/data/data/com.termux/files/usr"

# Go to project directory
cd "$PROJECT_DIR"

# Install dependencies
echo -e "${YELLOW}[*] Installing dependencies...${NC}"
npm install --production 2>&1 | tail -3

# Build TypeScript using full path
echo -e "${YELLOW}[*] Building TypeScript...${NC}"
node ./node_modules/typescript/bin/tsc 2>&1 | tail -5 || true

# Copy files
echo -e "${YELLOW}[*] Copying files...${NC}"
cp -r dist/* "$PREFIX/share/deepcode/"
cp package.json "$PREFIX/share/deepcode/"
cp -r node_modules "$PREFIX/share/deepcode/"

# Create wrapper script
cat > "$PREFIX/bin/deepcode" << 'WRAPPER'
#!/data/data/com.termux/files/usr/bin/bash
exec node "$PREFIX/share/deepcode/cli/index.js" "$@"
WRAPPER
chmod 755 "$PREFIX/bin/deepcode"

# Create control file
echo -e "${YELLOW}[*] Creating control file...${NC}"
mkdir -p "$DEB_DIR/DEBIAN"
cat > "$DEB_DIR/DEBIAN/control" << EOF
Package: deepcode
Version: ${VERSION}
Architecture: aarch64
Maintainer: ZAXV3 <rscripts65@gmail.com>
Depends: nodejs
Section: utils
Priority: optional
Homepage: https://github.com/ZAXv3/deepcode
Description: Agentic coding assistant CLI for Termux
 Deepcode is a powerful AI-powered coding assistant designed
 specifically for Termux on Android. It brings the full power
 of AI-assisted coding to your mobile terminal with native
 Android integration.
 .
 Features:
 - Multi-provider AI support (Anthropic, OpenAI, Google)
 - BYOP/BYOK/BYOM (Bring Your Own Provider/Key/Model)
 - Agent system with built-in agents
 - 9 core tools (read, write, edit, bash, glob, grep, webfetch, websearch, todowrite)
 - Rich TUI with streaming and animations
 - MCP client for external tool integration
 - Skills and plugin systems
EOF

# Create postinst script
cat > "$DEB_DIR/DEBIAN/postinst" << 'POSTINST'
#!/data/data/com.termux/files/usr/bin/bash
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              Deepcode installed successfully!              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Quick Start:"
echo "  1. Set your API key:"
echo "     export ANTHROPIC_API_KEY='your-key-here'"
echo ""
echo "  2. Start Deepcode:"
echo "     deepcode"
echo ""
POSTINST
chmod 755 "$DEB_DIR/DEBIAN/postinst"

# Fix permissions
chmod 755 "$DEB_DIR/DEBIAN"

# Build package
echo -e "${YELLOW}[*] Building .deb package...${NC}"
cd "$DEB_DIR"
dpkg-deb --build "$DEB_DIR" "$BUILD_DIR/deepcode_${VERSION}_aarch64.deb"

echo ""
echo -e "${BLUE}==========================================${NC}"
if [ -f "$BUILD_DIR/deepcode_${VERSION}_aarch64.deb" ]; then
    echo -e "${GREEN}[+] Package built successfully!${NC}"
    echo -e "${GREEN}[+] Location: $BUILD_DIR/deepcode_${VERSION}_aarch64.deb${NC}"
    echo -e "${GREEN}[+] Size: $(du -h "$BUILD_DIR/deepcode_${VERSION}_aarch64.deb" | cut -f1)${NC}"
    echo ""
    echo -e "${CYAN}To install:${NC}"
    echo -e "  pkg install -y $BUILD_DIR/deepcode_${VERSION}_aarch64.deb"
else
    echo -e "${RED}[!] Build failed!${NC}"
    exit 1
fi
echo -e "${BLUE}==========================================${NC}"
