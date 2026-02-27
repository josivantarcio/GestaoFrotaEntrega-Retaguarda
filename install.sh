#!/usr/bin/env bash
# ==============================================================================
#  RouteLog — Instalador Linux
#  Instala Docker, sobe a Retaguarda e configura o Tray com auto-start
#  Testado: Ubuntu 20.04+, Debian 11+, Fedora 38+, Arch Linux
# ==============================================================================
set -euo pipefail

# ── Cores ─────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET} $*"; }
ok()      { echo -e "${GREEN}[OK]${RESET}   $*"; }
warn()    { echo -e "${YELLOW}[AVISO]${RESET} $*"; }
erro()    { echo -e "${RED}[ERRO]${RESET} $*" >&2; exit 1; }

# ── Banner ────────────────────────────────────────────────────────────────────
echo -e "${BOLD}"
echo "╔══════════════════════════════════════════╗"
echo "║      RouteLog — Instalador Linux         ║"
echo "║      JTarcio Softhouse                   ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${RESET}"

# ── Diretório do script ───────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# O script pode estar em logistica-retaguarda/ (caso normal do git)
# ou na pasta pai junto com as duas pastas irmãs
if [[ -f "$SCRIPT_DIR/docker-compose.yml" ]]; then
  # Estamos dentro de logistica-retaguarda/
  RETAGUARDA_DIR="$SCRIPT_DIR"
  TRAY_DIR="$(dirname "$SCRIPT_DIR")/logistica-tray"
else
  # Estamos na pasta pai
  RETAGUARDA_DIR="$SCRIPT_DIR/logistica-retaguarda"
  TRAY_DIR="$SCRIPT_DIR/logistica-tray"
fi

[[ -d "$RETAGUARDA_DIR" ]] || erro "Pasta 'logistica-retaguarda' não encontrada."
[[ -d "$TRAY_DIR" ]]       || erro "Pasta 'logistica-tray' não encontrada em $(dirname "$RETAGUARDA_DIR")"

# ── Detectar distro ───────────────────────────────────────────────────────────
detect_pkg_manager() {
  if   command -v apt-get &>/dev/null; then echo "apt"
  elif command -v dnf     &>/dev/null; then echo "dnf"
  elif command -v pacman  &>/dev/null; then echo "pacman"
  else erro "Gerenciador de pacotes não reconhecido. Instale Docker e Node.js manualmente."; fi
}
PKG=$(detect_pkg_manager)

# ── 1. Docker ─────────────────────────────────────────────────────────────────
info "Verificando Docker..."
if ! command -v docker &>/dev/null; then
  warn "Docker não encontrado. Instalando..."
  case "$PKG" in
    apt)
      sudo apt-get update -qq
      sudo apt-get install -y ca-certificates curl gnupg lsb-release
      sudo install -m 0755 -d /etc/apt/keyrings
      curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
        | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
      echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
        | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
      sudo apt-get update -qq
      sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
      ;;
    dnf)
      sudo dnf -y install dnf-plugins-core
      sudo dnf config-manager --add-repo \
        https://download.docker.com/linux/fedora/docker-ce.repo
      sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
      ;;
    pacman)
      sudo pacman -Sy --noconfirm docker docker-compose
      ;;
  esac
  sudo systemctl enable --now docker
  sudo usermod -aG docker "$USER"
  ok "Docker instalado."
else
  ok "Docker já instalado: $(docker --version)"
fi

# Garantir que o daemon está rodando
sudo systemctl enable --now docker 2>/dev/null || true

# ── 2. Node.js ────────────────────────────────────────────────────────────────
info "Verificando Node.js..."
if ! command -v node &>/dev/null; then
  warn "Node.js não encontrado. Instalando via NodeSource (LTS)..."
  curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - 2>/dev/null || \
  curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash - 2>/dev/null || \
  (sudo pacman -Sy --noconfirm nodejs npm)
  case "$PKG" in
    apt)    sudo apt-get install -y nodejs ;;
    dnf)    sudo dnf install -y nodejs ;;
    pacman) : ;; # já instalado acima
  esac
  ok "Node.js instalado: $(node --version)"
else
  ok "Node.js já instalado: $(node --version)"
fi

# ── 3. Configurar API Key da Retaguarda ───────────────────────────────────────
echo ""
echo -e "${BOLD}Configuração da Retaguarda${RESET}"
echo "────────────────────────────────────────────"

COMPOSE_FILE="$RETAGUARDA_DIR/docker-compose.yml"
CURRENT_KEY=$(grep 'ROUTELOG_API_KEY' "$COMPOSE_FILE" | sed 's/.*ROUTELOG_API_KEY=//' | tr -d ' ')

if [[ "$CURRENT_KEY" == "TROQUE_ESTA_CHAVE" ]]; then
  warn "A API Key padrão ainda está em uso."
  echo -n "  Digite uma nova API Key (mínimo 8 caracteres): "
  if [[ -t 0 ]] || [[ -e /dev/tty ]]; then
    read -r API_KEY </dev/tty 2>/dev/null || read -r API_KEY
  else
    read -r API_KEY
  fi
  [[ ${#API_KEY} -ge 8 ]] || erro "API Key deve ter pelo menos 8 caracteres."
  sed -i "s/ROUTELOG_API_KEY=TROQUE_ESTA_CHAVE/ROUTELOG_API_KEY=$API_KEY/" "$COMPOSE_FILE"
  ok "API Key atualizada."
else
  ok "API Key já configurada."
  API_KEY="$CURRENT_KEY"
fi

# ── 4. Subir Retaguarda ───────────────────────────────────────────────────────
info "Construindo e subindo a Retaguarda (Docker)..."
cd "$RETAGUARDA_DIR"

# Usar 'docker compose' (V2) ou 'docker-compose' (V1)
if docker compose version &>/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
else
  COMPOSE_CMD="docker-compose"
fi

$COMPOSE_CMD down --remove-orphans 2>/dev/null || true
$COMPOSE_CMD up -d --build
ok "Retaguarda rodando em http://localhost:3000/dashboard"

# ── 5. Habilitar Retaguarda no boot do sistema ────────────────────────────────
# O Docker já tem restart:unless-stopped no compose.
# Garantir que o Docker inicia com o SO (silencioso se sem sudo):
sudo systemctl enable docker 2>/dev/null && \
  ok "Docker configurado para iniciar com o sistema (Retaguarda sobe automaticamente)." || \
  warn "Não foi possível habilitar docker no boot automaticamente. Execute: sudo systemctl enable docker"

# ── 6. Instalar e configurar o Tray ──────────────────────────────────────────
info "Instalando dependências do Tray..."
cd "$TRAY_DIR"
npm ci --prefer-offline 2>/dev/null || npm install
npm run build
ok "Tray compilado."

# ── 7. URL do servidor para o Tray ────────────────────────────────────────────
echo ""
echo -e "${BOLD}Configuração do Tray${RESET}"
echo "────────────────────────────────────────────"
echo "  URL padrão: http://localhost:3000"
echo -n "  Usar URL padrão? [S/n]: "
if [[ -t 0 ]] || [[ -e /dev/tty ]]; then
  read -r resp </dev/tty 2>/dev/null || read -r resp
else
  read -r resp
fi
if [[ "$resp" =~ ^[Nn]$ ]]; then
  echo -n "  Digite a URL da retaguarda (ex: http://192.168.1.100:3000): "
  if [[ -t 0 ]] || [[ -e /dev/tty ]]; then
    read -r SERVER_URL </dev/tty 2>/dev/null || read -r SERVER_URL
  else
    read -r SERVER_URL
  fi
  SERVER_URL="${SERVER_URL%/}"
else
  SERVER_URL="http://localhost:3000"
fi

DASHBOARD_URL="$SERVER_URL/dashboard"
SSE_URL="$SERVER_URL/api/events"

# ── 8. Criar serviço systemd para o Tray (auto-start no login) ────────────────
info "Configurando Tray para iniciar automaticamente..."

TRAY_EXEC="$(command -v electron || true)"
NODE_EXEC="$(command -v node)"
ELECTRON_BIN="$TRAY_DIR/node_modules/.bin/electron"

# Criar wrapper script
WRAPPER="$TRAY_DIR/start-tray.sh"
cat > "$WRAPPER" <<WRAPPER_EOF
#!/usr/bin/env bash
export ROUTELOG_DASHBOARD_URL="$DASHBOARD_URL"
export ROUTELOG_SSE_URL="$SSE_URL"
export DISPLAY="\${DISPLAY:-:0}"
export DBUS_SESSION_BUS_ADDRESS="\${DBUS_SESSION_BUS_ADDRESS:-unix:path=/run/user/\$(id -u)/bus}"
cd "$TRAY_DIR"
exec "$ELECTRON_BIN" . --no-sandbox
WRAPPER_EOF
chmod +x "$WRAPPER"

# Criar autostart .desktop (funciona no GNOME, KDE, XFCE, etc.)
AUTOSTART_DIR="$HOME/.config/autostart"
mkdir -p "$AUTOSTART_DIR"
cat > "$AUTOSTART_DIR/routelog-tray.desktop" <<DESKTOP_EOF
[Desktop Entry]
Type=Application
Name=RouteLog Tray
Comment=RouteLog — notificações em tempo real
Exec=$WRAPPER
Icon=$TRAY_DIR/assets/icon.png
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
StartupNotify=false
DESKTOP_EOF

ok "Tray configurado para iniciar automaticamente no login."

# ── 9. Iniciar Tray agora ─────────────────────────────────────────────────────
echo ""
info "Iniciando o Tray agora..."
if [[ -n "${DISPLAY:-}" ]]; then
  ROUTELOG_DASHBOARD_URL="$DASHBOARD_URL" \
  ROUTELOG_SSE_URL="$SSE_URL" \
  "$ELECTRON_BIN" "$TRAY_DIR" --no-sandbox &>/dev/null &
  disown
  ok "Tray iniciado em background."
else
  warn "Variável DISPLAY não definida — Tray será iniciado no próximo login."
fi

# ── Resumo ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${GREEN}║         Instalação concluída!            ║${RESET}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  ${BOLD}Retaguarda:${RESET}  http://localhost:3000/dashboard"
echo -e "  ${BOLD}API Key:${RESET}     $API_KEY"
echo -e "  ${BOLD}Tray:${RESET}        ícone na bandeja do sistema"
echo ""
echo -e "  ${CYAN}Ambos iniciam automaticamente após reiniciar o computador.${RESET}"
echo ""
warn "Se você adicionou seu usuário ao grupo 'docker', faça logout/login para ativar."
echo ""
