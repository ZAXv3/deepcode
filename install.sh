#!/data/data/com.termux/files/usr/bin/bash

# ==========================================
# Deepcode Installer for Termux
# ==========================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

INSTALL_DIR="${HOME}/deepcode"
BIN_DIR="${HOME}/.local/bin"

echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              Deepcode Installer for Termux                 ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}[*] Installing Node.js...${NC}"
    pkg install -y nodejs
fi

echo -e "${GREEN}[+] Node.js found: $(node --version)${NC}"

# Check for npm
if ! command -v npm &> /dev/null; then
    echo -e "${YELLOW}[*] Installing npm...${NC}"
    pkg install -y npm
fi

echo -e "${GREEN}[+] npm found: $(npm --version)${NC}"

# Create directories
echo -e "${YELLOW}[*] Creating installation directories...${NC}"
mkdir -p "${INSTALL_DIR}"
mkdir -p "${BIN_DIR}"

# Check if already installed
if [ -d "${INSTALL_DIR}/.git" ]; then
    echo -e "${YELLOW}[*] Deepcode already installed. Updating...${NC}"
    cd "${INSTALL_DIR}"
    git pull
else
    echo -e "${YELLOW}[*] Cloning Deepcode repository...${NC}"
    # For now, copy from current directory if it exists
    if [ -d "./Deepcode" ]; then
        cp -r ./Deepcode/* "${INSTALL_DIR}/"
    else
        echo -e "${RED}[!] Please clone the repository first:${NC}"
        echo -e "    git clone <repo-url> ${INSTALL_DIR}"
        exit 1
    fi
fi

# Install dependencies
echo -e "${YELLOW}[*] Installing dependencies...${NC}"
cd "${INSTALL_DIR}"
npm install --production

# Build
echo -e "${YELLOW}[*] Building Deepcode...${NC}"
npm run build

# Create wrapper script
echo -e "${YELLOW}[*] Creating wrapper script...${NC}"
cat > "${BIN_DIR}/deepcode" << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
exec node "${HOME}/deepcode/dist/cli/index.js" "$@"
EOF
chmod +x "${BIN_DIR}/deepcode"

# Add to PATH if not already there
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
    echo -e "${YELLOW}[*] Adding ${BIN_DIR} to PATH...${NC}"
    echo '' >> "${HOME}/.bashrc"
    echo '# Deepcode' >> "${HOME}/.bashrc"
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> "${HOME}/.bashrc"
    export PATH="$BIN_DIR:$PATH"
fi

# Create default config if it doesn't exist
CONFIG_DIR="${HOME}/.config/deepcode"
if [ ! -f "${CONFIG_DIR}/deepcode.json" ]; then
    echo -e "${YELLOW}[*] Creating default configuration...${NC}"
    mkdir -p "${CONFIG_DIR}"
    cat > "${CONFIG_DIR}/deepcode.json" << 'EOF'
{
  "$schema": "https://deepcode.dev/config.json",
  "model": "anthropic/claude-sonnet-4-6",
  "small_model": "anthropic/claude-3-haiku",
  "default_agent": "build",
  "shell": "/data/data/com.termux/files/usr/bin/bash",
  "logLevel": "INFO",
  "provider": {
    "anthropic": {
      "apiKey": "env:ANTHROPIC_API_KEY"
    }
  },
  "permission": {
    "edit": "ask",
    "bash": {
      "git *": "allow",
      "npm *": "allow",
      "pkg *": "allow",
      "rm *": "deny",
      "*": "ask"
    }
  }
}
EOF
    echo -e "${GREEN}[+] Default config created at ${CONFIG_DIR}/deepcode.json${NC}"
fi

# Verify installation
echo ""
echo -e "${BLUE}==========================================${NC}"
if command -v deepcode &> /dev/null; then
    echo -e "${GREEN}[+] Deepcode installed successfully!${NC}"
    echo -e "${GREEN}[+] Version: $(deepcode --version)${NC}"
else
    echo -e "${YELLOW}[!] Deepcode installed. You may need to restart your shell.${NC}"
    echo -e "${YELLOW}[!] Or run: source ~/.bashrc${NC}"
fi
echo -e "${BLUE}==========================================${NC}"
echo ""
echo -e "${CYAN}Quick Start:${NC}"
echo -e "  1. Set your API key:"
echo -e "     ${YELLOW}export ANTHROPIC_API_KEY='your-key-here'${NC}"
echo -e ""
echo -e "  2. Start interactive mode:"
echo -e "     ${YELLOW}deepcode${NC}"
echo -e ""
echo -e "  3. Or send a single message:"
echo -e "     ${YELLOW}deepcode \"What does this code do?\"${NC}"
echo -e ""
echo -e "${CYAN}Documentation:${NC}"
echo -e "  https://deepcode.dev/docs"
echo ""
