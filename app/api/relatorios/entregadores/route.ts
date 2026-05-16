import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db-server";
import type { TipoOcorrencia } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface DesempenhoEntregador {
  entregadorId: number;
  entregadorNome: string;
  totalRotas: number;
  totalCidades: number;
  volumesSaida: number;
  volumesEntregues: number;
  volumesDevolvidos: number;
  taxaEntrega: number;
  totalOcorrencias: number;
  ocorrenciasPorTipo: Partial<Record<TipoOcorrencia, number>>;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const inicio = searchParams.get("inicio");
  const fim = searchParams.get("fim");

  if (!inicio || !fim || !/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fim)) {
    return NextResponse.json({ error: "Parâmetros ?inicio=YYYY-MM-DD&fim=YYYY-MM-DD obrigatórios" }, { status: 400 });
  }

  const db = getDB();
  const rows = db.prepare(
    "SELECT * FROM rotas WHERE status='concluida' AND data >= ? AND data <= ? ORDER BY data DESC"
  ).all(inicio, fim) as any[];

  const rotas = rows.map((r) => ({
    ...r,
    itens: typeof r.itens === "string" ? JSON.parse(r.itens) : r.itens,
  }));

  const mapa: Record<number, DesempenhoEntregador> = {};

  for (const rota of rotas) {
    const rotasDoEntregador = new Set<number>();
    for (const item of rota.itens ?? []) {
      const id: number = item.entregadorId;
      if (!mapa[id]) {
        mapa[id] = {
          entregadorId: id,
          entregadorNome: item.entregadorNome,
          totalRotas: 0,
          totalCidades: 0,
          volumesSaida: 0,
          volumesEntregues: 0,
          volumesDevolvidos: 0,
          taxaEntrega: 0,
          totalOcorrencias: 0,
          ocorrenciasPorTipo: {},
        };
      }
      const e = mapa[id];
      e.totalCidades += 1;
      e.volumesSaida += item.volumesSaida ?? 0;
      e.volumesEntregues += item.volumesEntregues ?? (item.concluido ? (item.volumesSaida ?? 0) - (item.volumesDevolvidos ?? 0) : 0);
      e.volumesDevolvidos += item.volumesDevolvidos ?? 0;
      for (const oc of item.ocorrencias ?? []) {
        e.totalOcorrencias += oc.quantidade ?? 1;
        const tipo = oc.tipo as TipoOcorrencia;
        e.ocorrenciasPorTipo[tipo] = (e.ocorrenciasPorTipo[tipo] ?? 0) + (oc.quantidade ?? 1);
      }
      rotasDoEntregador.add(id);
    }
    for (const id of rotasDoEntregador) {
      if (mapa[id]) mapa[id].totalRotas += 1;
    }
  }

  // Calcula taxa de entrega
  for (const e of Object.values(mapa)) {
    e.taxaEntrega = e.volumesSaida > 0
      ? Math.round((e.volumesEntregues / e.volumesSaida) * 100)
      : 100;
  }

  const resultado = Object.values(mapa).sort((a, b) => b.taxaEntrega - a.taxaEntrega);
  return NextResponse.json(resultado);
}
