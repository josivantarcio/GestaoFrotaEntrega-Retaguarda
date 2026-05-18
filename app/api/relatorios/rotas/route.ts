import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const inicio = searchParams.get("inicio");
  const fim = searchParams.get("fim");

  if (!inicio || !fim || !/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fim)) {
    return NextResponse.json({ error: "Parâmetros ?inicio=YYYY-MM-DD&fim=YYYY-MM-DD obrigatórios" }, { status: 400 });
  }

  const { data: rows, error } = await getSupabaseServer()
    .from("rotas")
    .select("*")
    .gte("data", inicio)
    .lte("data", fim)
    .order("data", { ascending: false })
    .order("criado_em", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rotas = (rows ?? []).map((r: any) => ({
    ...r,
    itens: typeof r.itens === "string" ? JSON.parse(r.itens) : (r.itens ?? []),
    pausas_alimentacao: typeof r.pausas_alimentacao === "string" ? JSON.parse(r.pausas_alimentacao) : (r.pausas_alimentacao ?? []),
  }));

  return NextResponse.json(rotas);
}
