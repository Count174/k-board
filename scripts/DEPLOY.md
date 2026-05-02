# One-command deploy (Cursor-friendly)

## Setup

1. Make script executable:

```bash
chmod +x ./scripts/deploy-prod.sh
```

2. Optional: set env vars once (in shell profile):

```bash
export DEPLOY_SSH="root@45.148.102.92"
export DEPLOY_REMOTE_DIR="/root/k-board"
export DEPLOY_PM2_APP="k-board"
export DEPLOY_WWW_DIR="/var/www/k-board/html"
export DEPLOY_LANDING_WWW_DIR="/var/www/o-board-landing/html"
```

## Usage

### Full flow (commit + push + server deploy)

```bash
./scripts/deploy-prod.sh -m "feat: your message"
```

### Deploy only (if commit/push already done)

```bash
./scripts/deploy-prod.sh --skip-commit
```

## What it does

1. `git add -A`
2. `git commit -m "..."`
3. `git push origin main`
4. SSH to server, `git pull --ff-only`
5. If changed files include `frontend/*`:
   - `npm run build` in `frontend/`
   - sync `frontend/dist` to `DEPLOY_WWW_DIR` (default `/var/www/k-board/html`)
6. If changed files include `o-board-landing/*`:
   - `npm run build` in `o-board-landing/`
   - sync `o-board-landing/dist` to `DEPLOY_LANDING_WWW_DIR` (default `/var/www/o-board-landing/html`)
7. `pm2 restart k-board`
