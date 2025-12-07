#!/bin/bash
# Build tất cả Lambda Python packages
# Chạy script này trước khi terraform apply để đảm bảo tất cả zip files đã được build

set -e

echo ""
echo "========================================"
echo "  Building All Lambda Python Packages"
echo "========================================"
echo ""

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FAILED=()

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "[ERROR] Docker not found. Install Docker: https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Note: Individual build scripts for bash would need to be created
# For now, we'll use a simple approach: call PowerShell scripts if available, or create bash equivalents

echo "⚠️  Note: Bash build scripts not yet implemented."
echo "   Please use PowerShell scripts on Windows or create bash equivalents."
echo "   Or use WSL on Windows to run PowerShell scripts."
echo ""

exit 0


