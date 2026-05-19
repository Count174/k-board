#!/usr/bin/env bash
# Генерация Xcode-проекта без XcodeGen (нужен только Python 3).
set -euo pipefail
python3 "$(dirname "$0")/generate_xcodeproj.py"
