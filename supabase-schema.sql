-- ═══════════════════════════════════════════════════════════════════
-- ROUTELOG — Schema Supabase
-- Execute tudo de uma vez no SQL Editor do painel supabase.com
-- ═══════════════════════════════════════════════════════════════════

-- ── Tabelas ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cidades (
  id            BIGINT PRIMARY KEY,
  nome          TEXT NOT NULL,
  uf            CHAR(2) NOT NULL,
  distancia_km  NUMERIC(8,2),
  criado_em     TIMESTAMPTZ NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS entregadores (
  id            BIGINT PRIMARY KEY,
  nome          TEXT NOT NULL,
  telefone      TEXT NOT NULL,
  cidades_ids   JSONB NOT NULL DEFAULT '[]',
  ativo         BOOLEAN NOT NULL DEFAULT true,
  criado_em     TIMESTAMPTZ NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS veiculos (
  id               BIGINT PRIMARY KEY,
  placa            TEXT NOT NULL,
  modelo           TEXT NOT NULL,
  motorista_padrao TEXT,
  ativo            BOOLEAN NOT NULL DEFAULT true,
  km_atual         NUMERIC(10,2),
  criado_em        TIMESTAMPTZ NOT NULL,
  atualizado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rotas (
  id                   BIGINT PRIMARY KEY,
  data                 DATE NOT NULL,
  veiculo_id           BIGINT REFERENCES veiculos(id),
  veiculo_placa        TEXT NOT NULL,
  motorista            TEXT NOT NULL,
  km_saida             NUMERIC(10,2) NOT NULL,
  km_chegada           NUMERIC(10,2),
  hora_saida           TEXT NOT NULL,
  hora_chegada         TEXT,
  status               TEXT NOT NULL DEFAULT 'em_andamento'
                         CHECK (status IN ('aguardando_saida', 'em_andamento', 'concluida')),
  itens                JSONB NOT NULL DEFAULT '[]',
  pausas_alimentacao   JSONB NOT NULL DEFAULT '[]',
  trocas_veiculo       JSONB NOT NULL DEFAULT '[]',
  criado_em            TIMESTAMPTZ NOT NULL,
  atualizado_em        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migração: adicionar colunas se não existirem
ALTER TABLE rotas ADD COLUMN IF NOT EXISTS pausas_alimentacao JSONB NOT NULL DEFAULT '[]';
ALTER TABLE rotas ADD COLUMN IF NOT EXISTS trocas_veiculo JSONB NOT NULL DEFAULT '[]';
ALTER TABLE rotas DROP CONSTRAINT IF EXISTS rotas_status_check;
ALTER TABLE rotas ADD CONSTRAINT rotas_status_check CHECK (status IN ('aguardando_saida', 'em_andamento', 'concluida'));

-- ── Índices ───────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_rotas_status     ON rotas(status);
CREATE INDEX IF NOT EXISTS idx_rotas_data       ON rotas(data DESC);
CREATE INDEX IF NOT EXISTS idx_rotas_atualizado ON rotas(atualizado_em DESC);

-- ── Trigger: atualiza atualizado_em automaticamente ───────────────────

CREATE OR REPLACE FUNCTION touch_atualizado_em()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_rotas_updated
  BEFORE UPDATE ON rotas
  FOR EACH ROW EXECUTE FUNCTION touch_atualizado_em();

CREATE TRIGGER trg_cidades_updated
  BEFORE UPDATE ON cidades
  FOR EACH ROW EXECUTE FUNCTION touch_atualizado_em();

CREATE TRIGGER trg_entregadores_updated
  BEFORE UPDATE ON entregadores
  FOR EACH ROW EXECUTE FUNCTION touch_atualizado_em();

CREATE TRIGGER trg_veiculos_updated
  BEFORE UPDATE ON veiculos
  FOR EACH ROW EXECUTE FUNCTION touch_atualizado_em();

-- ── Row Level Security ────────────────────────────────────────────────

ALTER TABLE cidades      ENABLE ROW LEVEL SECURITY;
ALTER TABLE entregadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE veiculos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE rotas        ENABLE ROW LEVEL SECURITY;

-- Leitura pública (retaguarda usa anon key)
CREATE POLICY "leitura publica" ON cidades      FOR SELECT USING (true);
CREATE POLICY "leitura publica" ON entregadores FOR SELECT USING (true);
CREATE POLICY "leitura publica" ON veiculos     FOR SELECT USING (true);
CREATE POLICY "leitura publica" ON rotas        FOR SELECT USING (true);

-- Escrita apenas via service_role (app RN usa service_role key)
CREATE POLICY "escrita service role" ON cidades
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "escrita service role" ON entregadores
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "escrita service role" ON veiculos
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "escrita service role" ON rotas
  FOR ALL USING (auth.role() = 'service_role');

-- ── Jornadas ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS jornadas (
  id          BIGINT PRIMARY KEY,
  data        DATE NOT NULL,
  hora_inicio TEXT NOT NULL,
  hora_fim    TEXT,
  motorista   TEXT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jornadas_data ON jornadas(data DESC);

ALTER TABLE jornadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leitura publica" ON jornadas FOR SELECT USING (true);
CREATE POLICY "escrita service role" ON jornadas
  FOR ALL USING (auth.role() = 'service_role');

-- ── Descargas ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS descargas (
  id             BIGINT PRIMARY KEY,
  data           DATE NOT NULL,
  hora_inicio    TEXT NOT NULL,
  hora_fim       TEXT,
  motoristas_ids TEXT NOT NULL DEFAULT '[]',
  observacao     TEXT,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_descargas_data ON descargas(data DESC);

ALTER TABLE descargas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leitura publica" ON descargas FOR SELECT USING (true);
CREATE POLICY "escrita service role" ON descargas
  FOR ALL USING (auth.role() = 'service_role');

-- ── Realtime ──────────────────────────────────────────────────────────
-- No painel Supabase: Database > Replication > marcar as tabelas abaixo
-- Ou execute:
ALTER PUBLICATION supabase_realtime ADD TABLE rotas;
ALTER PUBLICATION supabase_realtime ADD TABLE cidades;
ALTER PUBLICATION supabase_realtime ADD TABLE entregadores;
ALTER PUBLICATION supabase_realtime ADD TABLE veiculos;
ALTER PUBLICATION supabase_realtime ADD TABLE jornadas;
ALTER PUBLICATION supabase_realtime ADD TABLE descargas;

-- ── Rastreamento em tempo real ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS localizacoes (
  id         BIGSERIAL PRIMARY KEY,
  rota_id    BIGINT NOT NULL REFERENCES rotas(id) ON DELETE CASCADE,
  lat        DOUBLE PRECISION NOT NULL,
  lng        DOUBLE PRECISION NOT NULL,
  velocidade REAL,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_localizacoes_rota_id  ON localizacoes(rota_id);
CREATE INDEX IF NOT EXISTS idx_localizacoes_criado_em ON localizacoes(rota_id, criado_em DESC);

ALTER TABLE localizacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leitura publica" ON localizacoes FOR SELECT USING (true);
CREATE POLICY "escrita service role" ON localizacoes
  FOR ALL USING (auth.role() = 'service_role');

ALTER PUBLICATION supabase_realtime ADD TABLE localizacoes;
