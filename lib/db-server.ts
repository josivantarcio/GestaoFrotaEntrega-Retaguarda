// Camada de acesso a dados — Supabase (compatível com a interface anterior)
import { getSupabaseServer } from "./supabase";

function sb() {
  return getSupabaseServer();
}

// ── Helpers ──────────────────────────────────────────────────────

function parseItens(row: any) {
  if (!row) return row;
  return {
    ...row,
    itens: typeof row.itens === "string" ? JSON.parse(row.itens) : (row.itens ?? []),
  };
}

function parseMotoristas(row: any) {
  if (!row) return row;
  return {
    ...row,
    motoristas_ids: typeof row.motoristas_ids === "string"
      ? JSON.parse(row.motoristas_ids)
      : (row.motoristas_ids ?? []),
  };
}

// ── Rotas ────────────────────────────────────────────────────────

export async function upsertRota(payload: {
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
  pausas_alimentacao?: unknown[];
  trocas_veiculo?: unknown[];
  criado_em: string;
  atualizado_em?: string;
}) {
  const now = new Date().toISOString();
  const { data, error } = await sb()
    .from("rotas")
    .upsert({
      ...payload,
      itens: JSON.stringify(payload.itens ?? []),
      pausas_alimentacao: JSON.stringify(payload.pausas_alimentacao ?? []),
      trocas_veiculo: JSON.stringify(payload.trocas_veiculo ?? []),
      atualizado_em: payload.atualizado_em ?? now,
    }, { onConflict: "id" })
    .select()
    .single();

  if (error) throw error;
  return parseItens(data);
}

export async function getRotasPorData(data: string) {
  const { data: rows, error } = await sb()
    .from("rotas")
    .select("*")
    .eq("data", data)
    .order("criado_em", { ascending: false });

  if (error) throw error;
  return (rows ?? []).map(parseItens);
}

// ── Cidades ──────────────────────────────────────────────────────

export async function upsertCidade(payload: {
  id: number;
  nome: string;
  uf: string;
  distancia_km?: number | null;
  criado_em: string;
}) {
  const { error } = await sb()
    .from("cidades")
    .upsert({ ...payload, distancia_km: payload.distancia_km ?? null }, { onConflict: "id" });
  if (error) throw error;
}

export async function deletarCidade(id: number) {
  const { error } = await sb().from("cidades").delete().eq("id", id);
  if (error) throw error;
}

// ── Entregadores ─────────────────────────────────────────────────

export async function upsertEntregador(payload: {
  id: number;
  nome: string;
  telefone: string;
  cidades_ids: number[];
  ativo: boolean;
  criado_em: string;
}) {
  const { error } = await sb()
    .from("entregadores")
    .upsert({
      ...payload,
      cidades_ids: JSON.stringify(payload.cidades_ids),
      ativo: payload.ativo ? 1 : 0,
    }, { onConflict: "id" });
  if (error) throw error;
}

export async function deletarEntregador(id: number) {
  const { error } = await sb().from("entregadores").delete().eq("id", id);
  if (error) throw error;
}

// ── Veículos ─────────────────────────────────────────────────────

export async function upsertVeiculo(payload: {
  id: number;
  placa: string;
  modelo: string;
  motorista_padrao?: string | null;
  ativo: boolean;
  km_atual?: number | null;
  criado_em: string;
}) {
  const { error } = await sb()
    .from("veiculos")
    .upsert({
      ...payload,
      motorista_padrao: payload.motorista_padrao ?? null,
      km_atual: payload.km_atual ?? null,
      ativo: payload.ativo ? 1 : 0,
    }, { onConflict: "id" });
  if (error) throw error;
}

export async function deletarVeiculo(id: number) {
  const { error } = await sb().from("veiculos").delete().eq("id", id);
  if (error) throw error;
}

// ── Jornadas ─────────────────────────────────────────────────────

export async function upsertJornada(payload: {
  id: number;
  data: string;
  hora_inicio: string;
  hora_fim?: string | null;
  motorista?: string | null;
  criado_em: string;
}) {
  const { error } = await sb()
    .from("jornadas")
    .upsert({
      ...payload,
      hora_fim: payload.hora_fim ?? null,
      motorista: payload.motorista ?? null,
    }, { onConflict: "id" });
  if (error) throw error;
}

export async function getJornadasPorData(data: string) {
  const { data: rows, error } = await sb()
    .from("jornadas")
    .select("*")
    .eq("data", data)
    .order("hora_inicio");
  if (error) throw error;
  return rows ?? [];
}

export async function getJornadasRecentes(limite = 30) {
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - limite);
  const isoLimite = dataLimite.toISOString().split("T")[0];
  const { data: rows, error } = await sb()
    .from("jornadas")
    .select("*")
    .gte("data", isoLimite)
    .order("data", { ascending: false });
  if (error) throw error;
  return rows ?? [];
}

// ── Descargas ────────────────────────────────────────────────────

export async function upsertDescarga(payload: {
  id: number;
  data: string;
  hora_inicio: string;
  hora_fim?: string | null;
  motoristas_ids: number[];
  observacao?: string | null;
  criado_em: string;
}) {
  const { error } = await sb()
    .from("descargas")
    .upsert({
      ...payload,
      hora_fim: payload.hora_fim ?? null,
      motoristas_ids: JSON.stringify(payload.motoristas_ids),
      observacao: payload.observacao ?? null,
    }, { onConflict: "id" });
  if (error) throw error;
}

export async function getDescargasPorData(data: string) {
  const { data: rows, error } = await sb()
    .from("descargas")
    .select("*")
    .eq("data", data)
    .order("hora_inicio");
  if (error) throw error;
  return (rows ?? []).map(parseMotoristas);
}

export async function getDescargasRecentes(limite = 30) {
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - limite);
  const isoLimite = dataLimite.toISOString().split("T")[0];
  const { data: rows, error } = await sb()
    .from("descargas")
    .select("*")
    .gte("data", isoLimite)
    .order("data", { ascending: false });
  if (error) throw error;
  return (rows ?? []).map(parseMotoristas);
}
