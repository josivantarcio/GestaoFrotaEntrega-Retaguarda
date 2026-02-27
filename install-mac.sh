#!/usr/bin/env bash
# ==============================================================================
#  RouteLog — Instalador macOS
#  Instala Homebrew, Docker Desktop, Node.js, sobe a Retaguarda
#  e configura o Tray com LaunchAgent (auto-start no login)
#  Testado: macOS 12 Monterey+
# ==============================================================================
set -euo pipefail

# ── Cores ─────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()  { echo -e "${CYAN}[INFO]${RESET} $*"; }
ok()    { echo -e "${GREEN}[OK]${RESET}   $*"; }
warn()  { echo -e "${YELLOW}[AVISO]${RESET} $*"; }
erro()  { echo -e "${RED}[ERRO]${RESET} $*" >&2; exit 1; }

# ── Banner ────────────────────────────────────────────────────────────────────
echo -e "${BOLD}"
echo "╔══════════════════════════════════════════╗"
echo "║      RouteLog — Instalador macOS         ║"
echo "║      JTarcio Softhouse                   ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${RESET}"

# ── macOS check ───────────────────────────────────────────────────────────────
[[ "$(uname)" == "Darwin" ]] || erro "Este script é apenas para macOS."

# ── Diretório do script ───────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -f "$SCRIPT_DIR/docker-compose.yml" ]]; then
  RETAGUARDA_DIR="$SCRIPT_DIR"
  TRAY_DIR="$(dirname "$SCRIPT_DIR")/logistica-tray"
else
  RETAGUARDA_DIR="$SCRIPT_DIR/logistica-retaguarda"
  TRAY_DIR="$SCRIPT_DIR/logistica-tray"
fi

[[ -d "$RETAGUARDA_DIR" ]] || erro "Pasta 'logistica-retaguarda' não encontrada."
[[ -d "$TRAY_DIR" ]]       || erro "Pasta 'logistica-tray' não encontrada em $(dirname "$RETAGUARDA_DIR")"

# ── 1. Xcode Command Line Tools ───────────────────────────────────────────────
info "Verificando Xcode Command Line Tools..."
if ! xcode-select -p &>/dev/null; then
  warn "Instalando Xcode Command Line Tools..."
  xcode-select --install
  echo "  Siga as instruções na janela que abriu e pressione Enter quando terminar."
  read -r
fi
ok "Xcode Command Line Tools OK."

# ── 2. Homebrew ───────────────────────────────────────────────────────────────
info "Verificando Homebrew..."
if ! command -v brew &>/dev/null; then
  warn "Homebrew não encontrado. Instalando..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Adicionar ao PATH para o restante do script
  if [[ -f /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [[ -f /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
  ok "Homebrew instalado."
else
  ok "Homebrew já instalado: $(brew --version | head -1)"
fi

# ── 3. Docker Desktop ─────────────────────────────────────────────────────────
info "Verificando Docker..."
if ! command -v docker &>/dev/null; then
  warn "Docker não encontrado. Instalando Docker Desktop via Homebrew..."
  brew install --cask docker
  ok "Docker Desktop instalado."
  echo ""
  warn "Abrindo Docker Desktop — aguarde ele iniciar completamente antes de continuar."
  open -a Docker
  echo -n "  Pressione Enter quando o Docker estiver rodando (ícone na barra de menu): "
  read -r
else
  ok "Docker já instalado: $(docker --version)"
fi

# Garantir que o Docker Desktop inicia no login
defaults write com.docker.docker SUEnableAutomaticUpdate -bool false 2>/dev/null || true
# Docker Desktop já tem opção "Start at login" — informar o usuário
warn "Verifique: Docker Desktop → Configurações → General → 'Start Docker Desktop when you log in' deve estar marcado."

# Verificar se daemon está rodando
if ! docker info &>/dev/null 2>&1; then
  warn "Docker daemon não está respondendo. Aguardando..."
  open -a Docker
  for i in {1..30}; do
    docker info &>/dev/null 2>&1 && break || sleep 2
  done
  docker info &>/dev/null 2>&1 || erro "Docker não iniciou. Abra o Docker Desktop manualmente e tente novamente."
fi
ok "Docker daemon rodando."

# ── 4. Node.js ────────────────────────────────────────────────────────────────
info "Verificando Node.js..."
if ! command -v node &>/dev/null; then
  warn "Node.js não encontrado. Instalando via Homebrew..."
  brew install node@20
  brew link --overwrite node@20
  ok "Node.js instalado: $(node --version)"
else
  ok "Node.js já instalado: $(node --version)"
fi

# ── 5. Configurar API Key da Retaguarda ───────────────────────────────────────
echo ""
echo -e "${BOLD}Configuração da Retaguarda${RESET}"
echo "────────────────────────────────────────────"

COMPOSE_FILE="$RETAGUARDA_DIR/docker-compose.yml"
CURRENT_KEY=$(grep 'ROUTELOG_API_KEY' "$COMPOSE_FILE" | sed 's/.*ROUTELOG_API_KEY=//' | tr -d ' ')

if [[ "$CURRENT_KEY" == "TROQUE_ESTA_CHAVE" ]]; then
  warn "A API Key padrão ainda está em uso."
  echo -n "  Digite uma nova API Key (mínimo 8 caracteres): "
  read -r API_KEY
  [[ ${#API_KEY} -ge 8 ]] || erro "API Key deve ter pelo menos 8 caracteres."
  # macOS sed requer extensão de backup explícita
  sed -i '' "s/ROUTELOG_API_KEY=TROQUE_ESTA_CHAVE/ROUTELOG_API_KEY=$API_KEY/" "$COMPOSE_FILE"
  ok "API Key atualizada."
else
  ok "API Key já configurada."
  API_KEY="$CURRENT_KEY"
fi

# ── 6. Subir Retaguarda ───────────────────────────────────────────────────────
info "Construindo e subindo a Retaguarda (Docker)..."
cd "$RETAGUARDA_DIR"

if docker compose version &>/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
else
  COMPOSE_CMD="docker-compose"
fi

$COMPOSE_CMD down --remove-orphans 2>/dev/null || true
$COMPOSE_CMD up -d --build
ok "Retaguarda rodando em http://localhost:3000/dashboard"

# ── 7. Instalar Tray ──────────────────────────────────────────────────────────
info "Instalando dependências do Tray..."
cd "$TRAY_DIR"
npm ci --prefer-offline 2>/dev/null || npm install
npm run build
ok "Tray compilado."

ELECTRON_BIN="$TRAY_DIR/node_modules/.bin/electron"

# ── 8. URL do servidor para o Tray ────────────────────────────────────────────
echo ""
echo -e "${BOLD}Configuração do Tray${RESET}"
echo "────────────────────────────────────────────"
echo "  URL padrão: http://localhost:3000"
echo -n "  Usar URL padrão? [S/n]: "
read -r resp
if [[ "$resp" =~ ^[Nn]$ ]]; then
  echo -n "  Digite a URL da retaguarda (ex: http://192.168.1.100:3000): "
  read -r SERVER_URL
  SERVER_URL="${SERVER_URL%/}"
else
  SERVER_URL="http://localhost:3000"
fi

DASHBOARD_URL="$SERVER_URL/dashboard"
SSE_URL="$SERVER_URL/api/events"

# ── 9. Criar wrapper script do Tray ──────────────────────────────────────────
WRAPPER="$TRAY_DIR/start-tray.sh"
cat > "$WRAPPER" <<WRAPPER_EOF
#!/usr/bin/env bash
export ROUTELOG_DASHBOARD_URL="$DASHBOARD_URL"
export ROUTELOG_SSE_URL="$SSE_URL"
cd "$TRAY_DIR"
exec "$ELECTRON_BIN" . --no-sandbox
WRAPPER_EOF
chmod +x "$WRAPPER"

# ── 10. Criar LaunchAgent (auto-start no login do usuário) ───────────────────
info "Configurando Tray para iniciar automaticamente no login..."

LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
PLIST_PATH="$LAUNCH_AGENTS_DIR/com.routelog.tray.plist"
LOG_DIR="$HOME/Library/Logs/RouteLog"

mkdir -p "$LAUNCH_AGENTS_DIR" "$LOG_DIR"

cat > "$PLIST_PATH" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.routelog.tray</string>

  <key>ProgramArguments</key>
  <array>
    <string>$WRAPPER</string>
  </array>

  <key>EnvironmentVariables</key>
  <dict>
    <key>ROUTELOG_DASHBOARD_URL</key>
    <string>$DASHBOARD_URL</string>
    <key>ROUTELOG_SSE_URL</key>
    <string>$SSE_URL</string>
  </dict>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>

  <key>ThrottleInterval</key>
  <integer>10</integer>

  <key>StandardOutPath</key>
  <string>$LOG_DIR/tray.log</string>

  <key>StandardErrorPath</key>
  <string>$LOG_DIR/tray-error.log</string>
</dict>
</plist>
PLIST_EOF

# Registrar o LaunchAgent
launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl load -w "$PLIST_PATH"
ok "LaunchAgent registrado — Tray iniciará automaticamente no login."

# ── 11. Iniciar Tray agora ───────────────────────────────────────────────────
info "Iniciando o Tray agora..."
launchctl start com.routelog.tray 2>/dev/null || \
  (ROUTELOG_DASHBOARD_URL="$DASHBOARD_URL" ROUTELOG_SSE_URL="$SSE_URL" \
   nohup "$ELECTRON_BIN" "$TRAY_DIR" --no-sandbox &>/dev/null &)
ok "Tray iniciado."

# ── Resumo ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${GREEN}║         Instalação concluída!            ║${RESET}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  ${BOLD}Retaguarda:${RESET}  http://localhost:3000/dashboard"
echo -e "  ${BOLD}API Key:${RESET}     $API_KEY"
echo -e "  ${BOLD}Tray:${RESET}        ícone na barra de menu do macOS"
echo ""
echo -e "  ${CYAN}Ambos iniciam automaticamente após reiniciar o Mac.${RESET}"
echo ""
echo -e "  ${BOLD}Logs do Tray:${RESET} ~/Library/Logs/RouteLog/tray.log"
echo ""
warn "Certifique-se que Docker Desktop está configurado para iniciar no login:"
warn "Docker Desktop → Settings → General → 'Start Docker Desktop when you log in'"
echo ""
