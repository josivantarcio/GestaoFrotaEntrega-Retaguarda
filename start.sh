#!/bin/bash
set -e

echo "======================================="
echo "  RouteLog — iniciando servidor..."
echo "======================================="

docker compose up -d

echo ""
echo "  Servidor rodando em:"
echo "  http://localhost:3000/dashboard"
echo ""
echo "  Para parar: docker compose down"
echo "======================================="
