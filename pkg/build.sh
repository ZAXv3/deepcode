TERMUX_PKG_HOMEPAGE=https://github.com/ZAXv3/deepcode
TERMUX_PKG_DESCRIPTION="Agentic coding assistant CLI for Termux with BYOP/BYOK/BYOM support"
TERMUX_PKG_LICENSE="MIT"
TERMUX_PKG_MAINTAINER="ZAXV3 <rscripts65@gmail.com>"
TERMUX_PKG_VERSION=0.2.0
TERMUX_PKG_SKIP_SRC_EXCLUDE=true

TERMUX_PKG_BUILD_IN_SRC=true
TERMUX_PKG_SERVICE_SCRIPT=()

termux_step_make() {
    npm install --production
    npm run build
}

termux_step_make_install() {
    mkdir -p "$TERMUX_PREFIX/share/deepcode"
    mkdir -p "$TERMUX_PREFIX/bin"
    
    # Copy built files
    cp -r dist/* "$TERMUX_PREFIX/share/deepcode/"
    cp package.json "$TERMUX_PREFIX/share/deepcode/"
    cp -r node_modules "$TERMUX_PREFIX/share/deepcode/"
    
    # Create wrapper script
    cat > "$TERMUX_PREFIX/bin/deepcode" << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
exec node "$PREFIX/share/deepcode/cli/index.js" "$@"
EOF
    chmod 755 "$TERMUX_PREFIX/bin/deepcode"
}

termux_step_create_debscripts() {
    cat > postinst << 'EOF'
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
echo "  Or for plain mode:"
echo "     deepcode -p"
echo ""
EOF
}
