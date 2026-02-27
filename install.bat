@echo off
:: ==============================================================================
::  RouteLog — Instalador Windows
::  Este arquivo chama o install.ps1 com as permissões corretas
::  Double-click neste arquivo para instalar
:: ==============================================================================

:: Verificar se está rodando como Administrador; se não, pedir elevação
net session >nul 2>&1
if %errorLevel% neq 0 (
  echo Solicitando permissoes de Administrador...
  powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

:: Executar o script PowerShell
powershell -ExecutionPolicy Bypass -File "%~dp0install.ps1"
