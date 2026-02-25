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
  id            BIGINT PRIMARY KEY,
  data          DATE NOT NULL,
  veiculo_id    BIGINT REFERENCES veiculos(id),
  veiculo_placa TEXT NOT NULL,
  motorista     TEXT NOT NULL,
  km_saida      NUMERIC(10,2) NOT NULL,
  km_chegada    NUMERIC(10,2),
  hora_saida    TEXT NOT NULL,
  hora_chegada  TEXT,
  status        TEXT NOT NULL DEFAULT 'em_andamento'
                  CHECK (status IN ('em_andamento', 'concluida')),
  itens         JSONB NOT NULL DEFAULT '[]',
  criado_em     TIMESTAMPTZ NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

-- ── Realtime ──────────────────────────────────────────────────────────
-- No painel Supabase: Database > Replication > marcar as tabelas abaixo
-- Ou execute:
ALTER PUBLICATION supabase_realtime ADD TABLE rotas;
ALTER PUBLICATION supabase_realtime ADD TABLE cidades;
ALTER PUBLICATION supabase_realtime ADD TABLE entregadores;
ALTER PUBLICATION supabase_realtime ADD TABLE veiculos;
