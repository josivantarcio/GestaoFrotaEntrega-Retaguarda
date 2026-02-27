import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.ROUTELOG_API_KEY ?? "";

export function verificarApiKey(req: NextRequest): boolean {
  if (!API_KEY || API_KEY.length < 8) return false;
  return req.headers.get("x-api-key") === API_KEY;
}

export function respostaForbidden(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
