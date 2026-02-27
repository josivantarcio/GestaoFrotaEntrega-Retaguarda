# RouteLog — Retaguarda

Painel web para acompanhamento em tempo real das operações de entrega. Recebe dados do app mobile RouteLog via API REST e exibe o status das rotas com atualização automática via Server-Sent Events (SSE).

**Desenvolvido por Josevan Oliveira — JTarcio Softhouse**

---

## Funcionalidades

- Dashboard com rotas do dia em tempo real
- Atualização automática via SSE (sem necessidade de recarregar a página)
- Polling de fallback a cada 15 segundos caso a conexão SSE caia
- API REST para recebimento de dados do app mobile
- Autenticação por API Key no header `x-api-key`
- Banco de dados SQLite local (sem dependência de serviço externo)
- Deploy via Docker com volume persistente
- Scripts de inicialização para Linux e Windows

---

## Stack

| Tecnologia | Uso |
|---|---|
| Next.js 16 (App Router) | Framework web |
| Tailwind CSS v4 | Estilização |
| better-sqlite3 | Banco de dados SQLite (server-side) |
| lucide-react | Ícones |
| date-fns | Formatação de datas |
| SSE (Server-Sent Events) | Comunicação em tempo real |

---

## Estrutura do projeto

```
app/
  layout.tsx                   # Layout global
  page.tsx                     # Redirecionamento para /dashboard
  dashboard/
    page.tsx                   # Painel principal de rotas
  api/
    events/
      route.ts                 # Endpoint SSE — stream de eventos em tempo real
    sync/
      rota/route.ts            # POST: recebe rota do app mobile
      rotas/route.ts           # GET: lista rotas por data
      cidade/route.ts          # POST: recebe cidade
      cidade/[id]/route.ts     # DELETE: remove cidade
      entregador/route.ts      # POST: recebe entregador
      entregador/[id]/route.ts # DELETE: remove entregador
      veiculo/route.ts         # POST: recebe veículo
      veiculo/[id]/route.ts    # DELETE: remove veículo
hooks/
  useRotasRealtime.ts          # Hook SSE + polling fallback
lib/
  api-auth.ts                  # Verificação da API Key
  db-server.ts                 # Camada SQLite com better-sqlite3
  sse-bus.ts                   # Barramento de eventos SSE em memória
  types.ts                     # Tipos compartilhados
```

---

## Configuração

Crie o arquivo `.env.local` na raiz do projeto:

```env
# Chave de autenticação — use o mesmo valor no app mobile
ROUTELOG_API_KEY=sua-chave-secreta-aqui

# Diretório onde o SQLite será salvo
DATA_DIR=./data
```

> A API Key deve ter no mínimo 8 caracteres. Configure a mesma chave no app mobile em **Cadastros → Configurações do Servidor**.

---

## Executar localmente

```bash
npm install
npm run dev
```

O painel estará disponível em `http://localhost:3000`.

Para acessar pelo celular na mesma rede Wi-Fi, use o IP do computador:
```
http://192.168.1.100:3000
```

---

## Deploy com Docker

```bash
# Subir o container
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar
docker-compose down
```

O banco de dados é persistido no volume `routelog-data` e sobrevive a reinicializações do container.

### Variáveis de ambiente no Docker

Edite o `docker-compose.yml` ou crie um arquivo `.env`:

```env
ROUTELOG_API_KEY=sua-chave-secreta-aqui
```

---

## Scripts de inicialização rápida

**Linux:**
```bash
chmod +x start.sh
./start.sh
```

**Windows:**
```
start.bat
```

---

## API

Todos os endpoints exigem o header:
```
x-api-key: sua-chave-secreta-aqui
```

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/api/sync/rotas?data=AAAA-MM-DD` | Lista rotas de uma data |
| `POST` | `/api/sync/rota` | Cria ou atualiza rota |
| `POST` | `/api/sync/cidade` | Cria ou atualiza cidade |
| `DELETE` | `/api/sync/cidade/[id]` | Remove cidade |
| `POST` | `/api/sync/entregador` | Cria ou atualiza entregador |
| `DELETE` | `/api/sync/entregador/[id]` | Remove entregador |
| `POST` | `/api/sync/veiculo` | Cria ou atualiza veículo |
| `DELETE` | `/api/sync/veiculo/[id]` | Remove veículo |
| `GET` | `/api/events` | Stream SSE de eventos em tempo real |

### Evento SSE

```json
{
  "tipo": "rota_upserted",
  "tabela": "rotas",
  "payload": { ... }
}
```

---

## Acesso externo (4G / fora da rede local)

Para acessar o servidor de fora da rede local, use um serviço de DNS dinâmico gratuito como o [DuckDNS](https://www.duckdns.org):

1. Crie um subdomínio em duckdns.org (ex: `routelog.duckdns.org`)
2. Instale o cliente DuckDNS no computador para manter o IP atualizado
3. Configure o **Port Forwarding** no roteador: porta `3000` → IP do computador na rede local
4. No app mobile, configure a URL como `http://routelog.duckdns.org:3000`

---

## Projetos relacionados

- **[RouteLog App Mobile](https://github.com/josivantarcio/GestaoFrotaEntrega)** — app Android que envia os dados
- **[RouteLog Tray](https://github.com/josivantarcio/GestaoFrotaEntrega-Tray)** — notificações no SO via bandeja do sistema

---

## Licença

Uso interno — JTarcio Softhouse.
