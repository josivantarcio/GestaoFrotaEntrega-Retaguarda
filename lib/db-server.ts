import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");

let _db: Database.Database | null = null;

export function getDB(): Database.Database {
  if (_db) return _db;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const dbPath = path.join(DATA_DIR, "routelog.db");
  _db = new Database(dbPath);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  initSchema(_db);
  return _db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cidades (
      id INTEGER PRIMARY KEY,
      nome TEXT NOT NULL,
      uf TEXT NOT NULL,
      distancia_km REAL,
      criado_em TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entregadores (
      id INTEGER PRIMARY KEY,
      nome TEXT NOT NULL,
      telefone TEXT NOT NULL,
      cidades_ids TEXT NOT NULL DEFAULT '[]',
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS veiculos (
      id INTEGER PRIMARY KEY,
      placa TEXT NOT NULL,
      modelo TEXT NOT NULL,
      motorista_padrao TEXT,
      ativo INTEGER NOT NULL DEFAULT 1,
      km_atual REAL,
      criado_em TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rotas (
      id INTEGER PRIMARY KEY,
      data TEXT NOT NULL,
      veiculo_id INTEGER,
      veiculo_placa TEXT NOT NULL,
      motorista TEXT NOT NULL,
      km_saida REAL NOT NULL,
      km_chegada REAL,
      hora_saida TEXT NOT NULL,
      hora_chegada TEXT,
      status TEXT NOT NULL DEFAULT 'em_andamento',
      itens TEXT NOT NULL DEFAULT '[]',
      criado_em TEXT NOT NULL,
      atualizado_em TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_rotas_data ON rotas(data);

    CREATE TABLE IF NOT EXISTS jornadas (
      id INTEGER PRIMARY KEY,
      data TEXT NOT NULL UNIQUE,
      hora_inicio TEXT NOT NULL,
      hora_fim TEXT,
      motorista TEXT,
      criado_em TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_jornadas_data ON jornadas(data);

    CREATE TABLE IF NOT EXISTS descargas (
      id INTEGER PRIMARY KEY,
      data TEXT NOT NULL,
      hora_inicio TEXT NOT NULL,
      hora_fim TEXT,
      motoristas_ids TEXT NOT NULL DEFAULT '[]',
      observacao TEXT,
      criado_em TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_descargas_data ON descargas(data);
  `);
}

// ── Rotas ────────────────────────────────────────────────────────

export function upsertRota(payload: {
  id: number;
  data: string;
  veiculo_id?: number | null;
  veiculo_placa: string;
  motorista: string;
  km_saida: number;
  km_chegada?: number | null;
  hora_saida: string;
  hora_chegada?: string | null;
  status: string;
  itens: unknown[];
  criado_em: string;
  atualizado_em?: string;
}) {
  const db = getDB();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO rotas (id, data, veiculo_id, veiculo_placa, motorista, km_saida, km_chegada, hora_saida, hora_chegada, status, itens, criado_em, atualizado_em)
    VALUES (@id, @data, @veiculo_id, @veiculo_placa, @motorista, @km_saida, @km_chegada, @hora_saida, @hora_chegada, @status, @itens, @criado_em, @atualizado_em)
    ON CONFLICT(id) DO UPDATE SET
      data = excluded.data,
      veiculo_id = excluded.veiculo_id,
      veiculo_placa = excluded.veiculo_placa,
      motorista = excluded.motorista,
      km_saida = excluded.km_saida,
      km_chegada = excluded.km_chegada,
      hora_saida = excluded.hora_saida,
      hora_chegada = excluded.hora_chegada,
      status = excluded.status,
      itens = excluded.itens,
      atualizado_em = excluded.atualizado_em
  `).run({
    ...payload,
    veiculo_id: payload.veiculo_id ?? null,
    km_chegada: payload.km_chegada ?? null,
    hora_chegada: payload.hora_chegada ?? null,
    itens: JSON.stringify(payload.itens ?? []),
    atualizado_em: payload.atualizado_em ?? now,
  });

  return db.prepare("SELECT * FROM rotas WHERE id = ?").get(payload.id) as RotaRow;
}

export function getRotasPorData(data: string): RotaRow[] {
  const db = getDB();
  const rows = db.prepare(
    "SELECT * FROM rotas WHERE data = ? ORDER BY criado_em DESC"
  ).all(data) as RotaRow[];
  return rows.map(parseRotaRow);
}

// ── Cidades ──────────────────────────────────────────────────────

export function upsertCidade(payload: {
  id: number;
  nome: string;
  uf: string;
  distancia_km?: number | null;
  criado_em: string;
}) {
  const db = getDB();
  db.prepare(`
    INSERT INTO cidades (id, nome, uf, distancia_km, criado_em)
    VALUES (@id, @nome, @uf, @distancia_km, @criado_em)
    ON CONFLICT(id) DO UPDATE SET
      nome = excluded.nome,
      uf = excluded.uf,
      distancia_km = excluded.distancia_km
  `).run({ ...payload, distancia_km: payload.distancia_km ?? null });
}

export function deletarCidade(id: number) {
  getDB().prepare("DELETE FROM cidades WHERE id = ?").run(id);
}

// ── Entregadores ─────────────────────────────────────────────────

export function upsertEntregador(payload: {
  id: number;
  nome: string;
  telefone: string;
  cidades_ids: number[];
  ativo: boolean;
  criado_em: string;
}) {
  const db = getDB();
  db.prepare(`
    INSERT INTO entregadores (id, nome, telefone, cidades_ids, ativo, criado_em)
    VALUES (@id, @nome, @telefone, @cidades_ids, @ativo, @criado_em)
    ON CONFLICT(id) DO UPDATE SET
      nome = excluded.nome,
      telefone = excluded.telefone,
      cidades_ids = excluded.cidades_ids,
      ativo = excluded.ativo
  `).run({
    ...payload,
    cidades_ids: JSON.stringify(payload.cidades_ids),
    ativo: payload.ativo ? 1 : 0,
  });
}

export function deletarEntregador(id: number) {
  getDB().prepare("DELETE FROM entregadores WHERE id = ?").run(id);
}

// ── Veículos ─────────────────────────────────────────────────────

export function upsertVeiculo(payload: {
  id: number;
  placa: string;
  modelo: string;
  motorista_padrao?: string | null;
  ativo: boolean;
  km_atual?: number | null;
  criado_em: string;
}) {
  const db = getDB();
  db.prepare(`
    INSERT INTO veiculos (id, placa, modelo, motorista_padrao, ativo, km_atual, criado_em)
    VALUES (@id, @placa, @modelo, @motorista_padrao, @ativo, @km_atual, @criado_em)
    ON CONFLICT(id) DO UPDATE SET
      placa = excluded.placa,
      modelo = excluded.modelo,
      motorista_padrao = excluded.motorista_padrao,
      ativo = excluded.ativo,
      km_atual = excluded.km_atual
  `).run({
    ...payload,
    motorista_padrao: payload.motorista_padrao ?? null,
    km_atual: payload.km_atual ?? null,
    ativo: payload.ativo ? 1 : 0,
  });
}

export function deletarVeiculo(id: number) {
  getDB().prepare("DELETE FROM veiculos WHERE id = ?").run(id);
}

// ── Jornadas ─────────────────────────────────────────────────────

export function upsertJornada(payload: {
  id: number;
  data: string;
  hora_inicio: string;
  hora_fim?: string | null;
  motorista?: string | null;
  criado_em: string;
}) {
  const db = getDB();
  db.prepare(`
    INSERT INTO jornadas (id, data, hora_inicio, hora_fim, motorista, criado_em)
    VALUES (@id, @data, @hora_inicio, @hora_fim, @motorista, @criado_em)
    ON CONFLICT(id) DO UPDATE SET
      hora_inicio = excluded.hora_inicio,
      hora_fim = excluded.hora_fim,
      motorista = excluded.motorista
  `).run({
    ...payload,
    hora_fim: payload.hora_fim ?? null,
    motorista: payload.motorista ?? null,
  });
}

export function getJornadasPorData(data: string) {
  return getDB().prepare("SELECT * FROM jornadas WHERE data = ? ORDER BY hora_inicio").all(data);
}

export function getJornadasRecentes(limite = 30) {
  const db = getDB();
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - limite);
  const isoLimite = dataLimite.toISOString().split("T")[0];
  return db.prepare("SELECT * FROM jornadas WHERE data >= ? ORDER BY data DESC").all(isoLimite);
}

// ── Descargas ────────────────────────────────────────────────────

export function upsertDescarga(payload: {
  id: number;
  data: string;
  hora_inicio: string;
  hora_fim?: string | null;
  motoristas_ids: number[];
  observacao?: string | null;
  criado_em: string;
}) {
  const db = getDB();
  db.prepare(`
    INSERT INTO descargas (id, data, hora_inicio, hora_fim, motoristas_ids, observacao, criado_em)
    VALUES (@id, @data, @hora_inicio, @hora_fim, @motoristas_ids, @observacao, @criado_em)
    ON CONFLICT(id) DO UPDATE SET
      hora_inicio = excluded.hora_inicio,
      hora_fim = excluded.hora_fim,
      motoristas_ids = excluded.motoristas_ids,
      observacao = excluded.observacao
  `).run({
    ...payload,
    hora_fim: payload.hora_fim ?? null,
    motoristas_ids: JSON.stringify(payload.motoristas_ids),
    observacao: payload.observacao ?? null,
  });
}

export function getDescargasPorData(data: string) {
  const db = getDB();
  const rows = db.prepare("SELECT * FROM descargas WHERE data = ? ORDER BY hora_inicio").all(data) as any[];
  return rows.map((r) => ({ ...r, motoristas_ids: JSON.parse(r.motoristas_ids || "[]") }));
}

export function getDescargasRecentes(limite = 30) {
  const db = getDB();
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - limite);
  const isoLimite = dataLimite.toISOString().split("T")[0];
  const rows = db.prepare("SELECT * FROM descargas WHERE data >= ? ORDER BY data DESC").all(isoLimite) as any[];
  return rows.map((r) => ({ ...r, motoristas_ids: JSON.parse(r.motoristas_ids || "[]") }));
}

// ── Helpers ──────────────────────────────────────────────────────

interface RotaRow {
  id: number;
  data: string;
  veiculo_id: number | null;
  veiculo_placa: string;
  motorista: string;
  km_saida: number;
  km_chegada: number | null;
  hora_saida: string;
  hora_chegada: string | null;
  status: string;
  itens: string | unknown[];
  criado_em: string;
  atualizado_em: string;
}

function parseRotaRow(row: RotaRow) {
  return {
    ...row,
    itens: typeof row.itens === "string" ? JSON.parse(row.itens) : row.itens,
  };
}
