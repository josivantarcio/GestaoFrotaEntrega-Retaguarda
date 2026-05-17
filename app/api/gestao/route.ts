import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const inicio = searchParams.get("inicio");
  const fim = searchParams.get("fim");

  if (!inicio || !fim) {
    return NextResponse.json({ error: "?inicio=YYYY-MM-DD&fim=YYYY-MM-DD obrigatórios" }, { status: 400 });
  }

  const { data: rows, error } = await getSupabaseServer()
    .from("rotas")
    .select("*")
    .gte("data", inicio)
    .lte("data", fim)
    .order("data", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rotas = (rows ?? []).map((r: any) => ({
    ...r,
    itens: typeof r.itens === "string" ? JSON.parse(r.itens) : (r.itens ?? []),
  }));

  const concluidas = rotas.filter((r: any) => r.status === "concluida");

  const totalRotas = rotas.length;
  const totalConcluidas = concluidas.length;
  const totalVolumes = rotas.reduce((s: number, r: any) => s + (r.itens ?? []).reduce((si: number, i: any) => si + (i.volumesSaida ?? 0), 0), 0);
  const totalEntregues = rotas.reduce((s: number, r: any) => s + (r.itens ?? []).reduce((si: number, i: any) => si + (i.volumesEntregues ?? (i.concluido ? (i.volumesSaida ?? 0) - (i.volumesDevolvidos ?? 0) : 0)), 0), 0);
  const totalDevolvidos = rotas.reduce((s: number, r: any) => s + (r.itens ?? []).reduce((si: number, i: any) => si + (i.volumesDevolvidos ?? 0), 0), 0);
  const totalOcorrencias = rotas.reduce((s: number, r: any) => s + (r.itens ?? []).reduce((si: number, i: any) => si + (i.ocorrencias?.length ?? 0), 0), 0);
  const totalKm = concluidas.reduce((s: number, r: any) => s + (r.km_chegada && r.km_saida ? r.km_chegada - r.km_saida : 0), 0);
  const taxaEntrega = totalVolumes > 0 ? Math.round((totalEntregues / totalVolumes) * 100) : 0;

  const volumesPorDia: Record<string, { saida: number; entregues: number; rotas: number }> = {};
  for (const r of rotas) {
    if (!volumesPorDia[r.data]) volumesPorDia[r.data] = { saida: 0, entregues: 0, rotas: 0 };
    for (const i of r.itens ?? []) {
      volumesPorDia[r.data].saida += i.volumesSaida ?? 0;
      volumesPorDia[r.data].entregues += i.volumesEntregues ?? (i.concluido ? (i.volumesSaida ?? 0) - (i.volumesDevolvidos ?? 0) : 0);
    }
    volumesPorDia[r.data].rotas += 1;
  }
  const tendencia = Object.entries(volumesPorDia)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, v]) => ({ data, ...v }));

  const mapaEntregadores: Record<string, { nome: string; volumes: number; entregues: number; ocorrencias: number; cidades: number }> = {};
  for (const r of concluidas) {
    for (const i of r.itens ?? []) {
      const id = String(i.entregadorId);
      if (!mapaEntregadores[id]) mapaEntregadores[id] = { nome: i.entregadorNome, volumes: 0, entregues: 0, ocorrencias: 0, cidades: 0 };
      mapaEntregadores[id].volumes += i.volumesSaida ?? 0;
      mapaEntregadores[id].entregues += i.volumesEntregues ?? (i.concluido ? (i.volumesSaida ?? 0) - (i.volumesDevolvidos ?? 0) : 0);
      mapaEntregadores[id].ocorrencias += i.ocorrencias?.length ?? 0;
      mapaEntregadores[id].cidades += 1;
    }
  }
  const rankingEntregadores = Object.entries(mapaEntregadores)
    .map(([id, e]) => ({ id, ...e, taxa: e.volumes > 0 ? Math.round((e.entregues / e.volumes) * 100) : 100 }))
    .sort((a, b) => b.entregues - a.entregues);

  const ocsPorTipo: Record<string, number> = {};
  for (const r of rotas) {
    for (const i of r.itens ?? []) {
      for (const oc of i.ocorrencias ?? []) {
        ocsPorTipo[oc.tipo] = (ocsPorTipo[oc.tipo] ?? 0) + (oc.quantidade ?? 1);
      }
    }
  }
  const rankingOcorrencias = Object.entries(ocsPorTipo)
    .sort(([, a], [, b]) => b - a)
    .map(([tipo, qtd]) => ({ tipo, qtd }));

  const mapaMotoristas: Record<string, { nome: string; rotas: number; km: number; volumes: number }> = {};
  for (const r of concluidas) {
    const m = r.motorista;
    if (!mapaMotoristas[m]) mapaMotoristas[m] = { nome: m, rotas: 0, km: 0, volumes: 0 };
    mapaMotoristas[m].rotas += 1;
    mapaMotoristas[m].km += r.km_chegada && r.km_saida ? r.km_chegada - r.km_saida : 0;
    mapaMotoristas[m].volumes += (r.itens ?? []).reduce((s: number, i: any) => s + (i.volumesSaida ?? 0), 0);
  }
  const rankingMotoristas = Object.values(mapaMotoristas).sort((a, b) => b.rotas - a.rotas);

  return NextResponse.json({
    kpis: { totalRotas, totalConcluidas, totalVolumes, totalEntregues, totalDevolvidos, totalOcorrencias, totalKm, taxaEntrega },
    tendencia,
    rankingEntregadores,
    rankingOcorrencias,
    rankingMotoristas,
  });
}
