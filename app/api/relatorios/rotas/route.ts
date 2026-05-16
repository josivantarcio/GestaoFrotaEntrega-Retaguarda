import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const inicio = searchParams.get("inicio");
  const fim = searchParams.get("fim");

  if (!inicio || !fim || !/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fim)) {
    return NextResponse.json({ error: "Parâmetros ?inicio=YYYY-MM-DD&fim=YYYY-MM-DD obrigatórios" }, { status: 400 });
  }

  const db = getDB();
  const rows = db.prepare(
    "SELECT * FROM rotas WHERE data >= ? AND data <= ? ORDER BY data DESC, criado_em DESC"
  ).all(inicio, fim) as any[];

  const rotas = rows.map((r) => ({
    ...r,
    itens: typeof r.itens === "string" ? JSON.parse(r.itens) : r.itens,
  }));

  return NextResponse.json(rotas);
}
