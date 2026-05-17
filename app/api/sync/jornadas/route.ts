import { NextRequest, NextResponse } from "next/server";
import { verificarApiKey, respostaForbidden } from "@/lib/api-auth";
import { getJornadasPorData } from "@/lib/db-server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!verificarApiKey(req)) return respostaForbidden();
  const data = req.nextUrl.searchParams.get("data") ?? new Date().toISOString().split("T")[0];
  const jornadas = await getJornadasPorData(data);
  return NextResponse.json(jornadas);
}
