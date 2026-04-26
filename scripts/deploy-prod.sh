#!/usr/bin/env bash
set -euo pipefail

# One-command deploy:
# 1) local commit + push
# 2) remote pull
# 3) build/sync frontend if frontend changed
# 4) pm2 restart
#
# Usage:
#   ./scripts/deploy-prod.sh -m "feat: message"
# Optional env:
#   DEPLOY_SSH="root@192573"
#   DEPLOY_REMOTE_DIR="~/k-board"
#   DEPLOY_PM2_APP="k-board"
#   DEPLOY_WWW_DIR="/var/www/k-board/html"

DEPLOY_SSH="${DEPLOY_SSH:-root@45.148.102.92}"
DEPLOY_REMOTE_DIR="${DEPLOY_REMOTE_DIR:-k-board}"
DEPLOY_PM2_APP="${DEPLOY_PM2_APP:-k-board}"
DEPLOY_WWW_DIR="${DEPLOY_WWW_DIR:-/var/www/k-board/html}"

COMMIT_MSG=""
SKIP_COMMIT="${SKIP_COMMIT:-0}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -m|--message)
      COMMIT_MSG="${2:-}"
      shift 2
      ;;
    --skip-commit)
      SKIP_COMMIT="1"
      shift
      ;;
    *)
      echo "Unknown arg: $1"
      echo "Usage: $0 -m \"commit message\" [--skip-commit]"
      exit 1
      ;;
  esac
done

if [[ "$SKIP_COMMIT" != "1" && -z "$COMMIT_MSG" ]]; then
  echo "Commit message is required. Pass -m \"message\" or use --skip-commit."
  exit 1
fi

echo "==> Checking local repository"
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not a git repository."
  exit 1
fi

if [[ "$SKIP_COMMIT" != "1" ]]; then
  echo "==> Local commit"
  git add -A
  if git diff --cached --quiet; then
    echo "No staged changes after git add -A. Nothing to commit."
  else
    git commit -m "$COMMIT_MSG"
  fi
fi

echo "==> Push to origin/main"
git push origin main

echo "==> Remote deploy on ${DEPLOY_SSH}"
ssh "$DEPLOY_SSH" "bash -s" <<EOF
set -euo pipefail

cd "$DEPLOY_REMOTE_DIR"
OLD_REV=\$(git rev-parse HEAD)
echo "[remote] old rev: \$OLD_REV"

git pull --ff-only

NEW_REV=\$(git rev-parse HEAD)
echo "[remote] new rev: \$NEW_REV"

if [[ "\$OLD_REV" == "\$NEW_REV" ]]; then
  echo "[remote] no new commits after pull."
fi

FRONT_CHANGED=0
while IFS= read -r f; do
  if [[ "\$f" == frontend/* ]]; then
    FRONT_CHANGED=1
    break
  fi
done < <(git diff --name-only "\$OLD_REV" "\$NEW_REV")

if [[ "\$FRONT_CHANGED" -eq 1 ]]; then
  echo "[remote] frontend changed -> build and sync static files"
  cd "$DEPLOY_REMOTE_DIR/frontend"
  npm run build

  sudo mkdir -p "$DEPLOY_WWW_DIR"
  sudo rm -rf "$DEPLOY_WWW_DIR"/*
  sudo cp -a "$DEPLOY_REMOTE_DIR/frontend/dist/." "$DEPLOY_WWW_DIR/"
  sudo chown -R www-data:www-data "$DEPLOY_WWW_DIR"
else
  echo "[remote] frontend unchanged -> skip static rebuild"
fi

cd "$DEPLOY_REMOTE_DIR"
pm2 restart "$DEPLOY_PM2_APP"
echo "[remote] pm2 restart done"
EOF

echo "==> Deploy completed"
