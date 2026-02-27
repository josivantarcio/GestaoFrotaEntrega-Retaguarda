# ==============================================================================
#  RouteLog — Instalador Windows (PowerShell)
#  Instala Docker Desktop, Node.js, sobe a Retaguarda e configura
#  o Tray com auto-start via Task Scheduler
#
#  Execute como Administrador:
#    Clique direito em install.ps1 → "Executar com PowerShell"
#  ou via terminal admin:
#    powershell -ExecutionPolicy Bypass -File install.ps1
#
#  Testado: Windows 10 21H2+, Windows 11
# ==============================================================================

#Requires -Version 5.1

param(
  [switch]$SemInteracao   # passa -SemInteracao para modo não-interativo (CI)
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Funções de saída ──────────────────────────────────────────────────────────
function Info  { param($m) Write-Host "[INFO]  $m" -ForegroundColor Cyan }
function Ok    { param($m) Write-Host "[OK]    $m" -ForegroundColor Green }
function Aviso { param($m) Write-Host "[AVISO] $m" -ForegroundColor Yellow }
function Erro  { param($m) Write-Host "[ERRO]  $m" -ForegroundColor Red; exit 1 }

# ── Banner ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║      RouteLog — Instalador Windows       ║" -ForegroundColor Cyan
Write-Host "║      JTarcio Softhouse                   ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── Verificar privilégios de Administrador ────────────────────────────────────
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator
)
if (-not $isAdmin) {
  Erro "Execute este script como Administrador. Clique direito → 'Executar com PowerShell' e confirme o UAC."
}

# ── Diretórios ────────────────────────────────────────────────────────────────
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# O script pode estar dentro de logistica-retaguarda/ ou na pasta pai
if (Test-Path (Join-Path $ScriptDir "docker-compose.yml")) {
  $RetaguardaDir = $ScriptDir
  $TrayDir       = Join-Path (Split-Path -Parent $ScriptDir) "logistica-tray"
} else {
  $RetaguardaDir = Join-Path $ScriptDir "logistica-retaguarda"
  $TrayDir       = Join-Path $ScriptDir "logistica-tray"
}

if (-not (Test-Path $RetaguardaDir)) { Erro "Pasta 'logistica-retaguarda' não encontrada." }
if (-not (Test-Path $TrayDir))       { Erro "Pasta 'logistica-tray' não encontrada em $(Split-Path -Parent $RetaguardaDir)" }

# ── Função auxiliar: verificar comando ───────────────────────────────────────
function CommandExists { param($cmd) return [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }

# ── Função: aguardar Docker iniciar ──────────────────────────────────────────
function AguardarDocker {
  Info "Aguardando Docker daemon iniciar..."
  $tentativas = 0
  do {
    Start-Sleep -Seconds 3
    $tentativas++
    $ok = (docker info 2>$null) -and $?
    if ($tentativas % 5 -eq 0) { Aviso "Ainda aguardando Docker... ($tentativas tentativas)" }
  } while (-not $ok -and $tentativas -lt 40)

  if (-not $ok) { Erro "Docker não iniciou após 2 minutos. Abra o Docker Desktop manualmente e execute novamente." }
  Ok "Docker daemon respondendo."
}

# ── 1. winget ────────────────────────────────────────────────────────────────
Info "Verificando winget..."
if (-not (CommandExists "winget")) {
  Aviso "winget não encontrado."
  Aviso "Instale o 'App Installer' pela Microsoft Store e execute novamente."
  Start-Process "ms-windows-store://pdp/?ProductId=9NBLGGH4NNS1"
  Erro "Instale o winget e execute o script novamente."
}
Ok "winget disponível."

# ── 2. Docker Desktop ────────────────────────────────────────────────────────
Info "Verificando Docker..."
if (-not (CommandExists "docker")) {
  Aviso "Docker não encontrado. Instalando Docker Desktop via winget..."
  winget install -e --id Docker.DockerDesktop --accept-source-agreements --accept-package-agreements
  Ok "Docker Desktop instalado."
  Aviso "O Docker Desktop precisa ser iniciado manualmente pela primeira vez."
  Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe" -ErrorAction SilentlyContinue
  AguardarDocker
} else {
  Ok "Docker já instalado: $(docker --version)"
  # Verificar se daemon está rodando
  if (-not (docker info 2>$null)) {
    Aviso "Docker instalado mas daemon não está rodando. Iniciando Docker Desktop..."
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe" -ErrorAction SilentlyContinue
    AguardarDocker
  }
}

# ── 3. Node.js ────────────────────────────────────────────────────────────────
Info "Verificando Node.js..."
if (-not (CommandExists "node")) {
  Aviso "Node.js não encontrado. Instalando via winget..."
  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
  # Recarregar PATH
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" +
              [System.Environment]::GetEnvironmentVariable("Path","User")
  Ok "Node.js instalado: $(node --version)"
} else {
  Ok "Node.js já instalado: $(node --version)"
}

# ── 4. Configurar API Key da Retaguarda ───────────────────────────────────────
Write-Host ""
Write-Host "Configuração da Retaguarda" -ForegroundColor White
Write-Host "────────────────────────────────────────────"

$ComposeFile = Join-Path $RetaguardaDir "docker-compose.yml"
$ComposeContent = Get-Content $ComposeFile -Raw
$CurrentKey = if ($ComposeContent -match 'ROUTELOG_API_KEY=(.+)') { $Matches[1].Trim() } else { "" }

if ($CurrentKey -eq "TROQUE_ESTA_CHAVE") {
  Aviso "A API Key padrão ainda está em uso."
  do {
    $ApiKey = Read-Host "  Digite uma nova API Key (mínimo 8 caracteres)"
  } while ($ApiKey.Length -lt 8)

  $ComposeContent = $ComposeContent -replace 'ROUTELOG_API_KEY=TROQUE_ESTA_CHAVE', "ROUTELOG_API_KEY=$ApiKey"
  Set-Content -Path $ComposeFile -Value $ComposeContent -NoNewline
  Ok "API Key atualizada."
} else {
  Ok "API Key já configurada."
  $ApiKey = $CurrentKey
}

# ── 5. Subir Retaguarda ───────────────────────────────────────────────────────
Info "Construindo e subindo a Retaguarda (Docker)..."
Push-Location $RetaguardaDir
try {
  & docker compose down --remove-orphans 2>$null
  & docker compose up -d --build
  if ($LASTEXITCODE -ne 0) { Erro "Falha ao subir a Retaguarda. Verifique os logs com: docker compose logs" }
  Ok "Retaguarda rodando em http://localhost:3000/dashboard"
} finally {
  Pop-Location
}

# ── 6. Configurar Docker para iniciar com o Windows ──────────────────────────
Info "Configurando Docker Desktop para iniciar com o Windows..."
$dockerSettingsPath = "$env:APPDATA\Docker\settings-store.json"
if (Test-Path $dockerSettingsPath) {
  $dockerSettings = Get-Content $dockerSettingsPath | ConvertFrom-Json
  $dockerSettings | Add-Member -NotePropertyName "autoStart" -NotePropertyValue $true -Force
  $dockerSettings | ConvertTo-Json -Depth 10 | Set-Content $dockerSettingsPath
  Ok "Docker Desktop configurado para iniciar com o Windows."
} else {
  Aviso "Não foi possível configurar auto-start do Docker Desktop automaticamente."
  Aviso "Faça manualmente: Docker Desktop → Settings → General → 'Start Docker Desktop when you log in'"
}

# ── 7. Instalar Tray ──────────────────────────────────────────────────────────
Info "Instalando dependências do Tray..."
Push-Location $TrayDir
try {
  & npm ci --prefer-offline 2>$null
  if ($LASTEXITCODE -ne 0) { & npm install }
  & npm run build
  if ($LASTEXITCODE -ne 0) { Erro "Falha ao compilar o Tray." }
  Ok "Tray compilado."
} finally {
  Pop-Location
}

$ElectronBin = Join-Path $TrayDir "node_modules\.bin\electron.cmd"
if (-not (Test-Path $ElectronBin)) {
  $ElectronBin = Join-Path $TrayDir "node_modules\.bin\electron"
}

# ── 8. URL do servidor para o Tray ────────────────────────────────────────────
Write-Host ""
Write-Host "Configuração do Tray" -ForegroundColor White
Write-Host "────────────────────────────────────────────"
Write-Host "  URL padrão: http://localhost:3000"
$resp = Read-Host "  Usar URL padrão? [S/n]"
if ($resp -match '^[Nn]$') {
  $ServerUrl = Read-Host "  Digite a URL da retaguarda (ex: http://192.168.1.100:3000)"
  $ServerUrl = $ServerUrl.TrimEnd('/')
} else {
  $ServerUrl = "http://localhost:3000"
}

$DashboardUrl = "$ServerUrl/dashboard"
$SseUrl       = "$ServerUrl/api/events"

# ── 9. Criar script wrapper do Tray ──────────────────────────────────────────
$WrapperPath = Join-Path $TrayDir "start-tray.cmd"
@"
@echo off
set ROUTELOG_DASHBOARD_URL=$DashboardUrl
set ROUTELOG_SSE_URL=$SseUrl
cd /d "$TrayDir"
start "" "$ElectronBin" . --no-sandbox
"@ | Set-Content -Path $WrapperPath -Encoding ASCII

# ── 10. Task Scheduler: auto-start no logon do usuário ───────────────────────
Info "Configurando Tray para iniciar automaticamente no logon..."

$TaskName   = "RouteLog Tray"
$TaskUser   = $env:USERNAME
$Action     = New-ScheduledTaskAction `
                -Execute "cmd.exe" `
                -Argument "/c `"$WrapperPath`""

$Trigger    = New-ScheduledTaskTrigger -AtLogOn -User $TaskUser
$Settings   = New-ScheduledTaskSettingsSet `
                -AllowStartIfOnBatteries `
                -DontStopIfGoingOnBatteries `
                -ExecutionTimeLimit (New-TimeSpan -Hours 0) `
                -RestartCount 3 `
                -RestartInterval (New-TimeSpan -Minutes 1)

$Principal  = New-ScheduledTaskPrincipal `
                -UserId $TaskUser `
                -LogonType Interactive `
                -RunLevel Limited

# Remover tarefa anterior se existir
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

Register-ScheduledTask `
  -TaskName  $TaskName `
  -Action    $Action `
  -Trigger   $Trigger `
  -Settings  $Settings `
  -Principal $Principal `
  -Description "RouteLog Tray — notificações em tempo real de rotas" | Out-Null

Ok "Tarefa agendada criada: '$TaskName' (inicia no logon do usuário)."

# ── 11. Iniciar Tray agora ───────────────────────────────────────────────────
Info "Iniciando o Tray agora..."
Start-ScheduledTask -TaskName $TaskName 2>$null
if ($LASTEXITCODE -ne 0) {
  # fallback direto
  $env:ROUTELOG_DASHBOARD_URL = $DashboardUrl
  $env:ROUTELOG_SSE_URL       = $SseUrl
  Start-Process -FilePath $ElectronBin -ArgumentList "$TrayDir . --no-sandbox" -WindowStyle Hidden
}
Ok "Tray iniciado."

# ── Resumo ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║         Instalação concluída!            ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  Retaguarda:  http://localhost:3000/dashboard" -ForegroundColor White
Write-Host "  API Key:     $ApiKey"                         -ForegroundColor White
Write-Host "  Tray:        ícone na bandeja do sistema"     -ForegroundColor White
Write-Host ""
Write-Host "  Ambos iniciam automaticamente após reiniciar o Windows." -ForegroundColor Cyan
Write-Host ""
Aviso "Certifique-se que o Docker Desktop inicia com o Windows:"
Aviso "Docker Desktop → Settings → General → 'Start Docker Desktop when you log in'"
Write-Host ""
Write-Host "Pressione Enter para fechar..."
Read-Host | Out-Null
