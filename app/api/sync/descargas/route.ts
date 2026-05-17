import { NextRequest, NextResponse } from "next/server";
import { verificarApiKey, respostaForbidden } from "@/lib/api-auth";
import { getDescargasPorData } from "@/lib/db-server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!verificarApiKey(req)) return respostaForbidden();
  const data = req.nextUrl.searchParams.get("data") ?? new Date().toISOString().split("T")[0];
  const descargas = await getDescargasPorData(data);
  return NextResponse.json(descargas);
}
