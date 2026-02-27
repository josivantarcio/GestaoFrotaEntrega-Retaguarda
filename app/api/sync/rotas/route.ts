import { NextRequest, NextResponse } from "next/server";
import { getRotasPorData } from "@/lib/db-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const data = req.nextUrl.searchParams.get("data");
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json({ error: "Parâmetro ?data=YYYY-MM-DD obrigatório" }, { status: 400 });
  }

  const rotas = getRotasPorData(data);
  return NextResponse.json(rotas);
}
