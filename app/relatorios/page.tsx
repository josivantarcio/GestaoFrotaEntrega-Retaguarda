"use client";
export const dynamic = "force-dynamic";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  BarChart2, Package, AlertTriangle, CheckCircle2, Truck,
  Download, Search, ChevronDown, ChevronUp, FileText, Users,
} from "lucide-react";
import { NavBar } from "@/components/layout/NavBar";
import type { Rota, ItemRota, Ocorrencia } from "@/lib/types";
import { LABELS_OCORRENCIA } from "@/lib/types";

// ── Helpers ──────────────────────────────────────────────────
function hoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function inicioDeMes() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function dataBR(iso: string) {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

function kmTotal(rota: Rota): number {
  if (rota.km_chegada && rota.km_saida) return rota.km_chegada - rota.km_saida;
  return 0;
}

type Aba = "rotas" | "ocorrencias" | "exportar";

// ── Exportação CSV ────────────────────────────────────────────
function gerarCSVRotas(rotas: Rota[]): string {
  const linhas: string[][] = [
    ["Data", "Motorista", "Veículo", "KM Saída", "KM Chegada", "KM Rodados", "Hora Saída", "Hora Chegada", "Status", "Cidades", "Volumes Saída", "Volumes Entregues", "Ocorrências"],
  ];
  for (const r of rotas) {
    const volumes = r.itens.reduce((s, i) => s + i.volumesSaida, 0);
    const entregues = r.itens.reduce((s, i) => s + (i.volumesEntregues ?? (i.concluido ? i.volumesSaida : 0)), 0);
    const ocs = r.itens.reduce((s, i) => s + (i.ocorrencias?.length ?? 0), 0);
    linhas.push([
      dataBR(r.data), r.motorista, r.veiculo_placa,
      String(r.km_saida), String(r.km_chegada ?? ""),
      String(kmTotal(r)), r.hora_saida, r.hora_chegada ?? "",
      r.status === "concluida" ? "Concluída" : "Em andamento",
      String(r.itens.length), String(volumes), String(entregues), String(ocs),
    ]);
  }
  return linhas.map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
}

function gerarCSVOcorrencias(rotas: Rota[]): string {
  const linhas: string[][] = [
    ["Data", "Motorista", "Veículo", "Cidade", "Entregador", "Tipo", "Quantidade", "Descrição"],
  ];
  for (const r of rotas) {
    for (const item of r.itens) {
      for (const oc of item.ocorrencias ?? []) {
        linhas.push([
          dataBR(r.data), r.motorista, r.veiculo_placa,
          item.cidadeNome, item.entregadorNome,
          LABELS_OCORRENCIA[oc.tipo] ?? oc.tipo,
          String(oc.quantidade), oc.descricao ?? "",
        ]);
      }
    }
  }
  return linhas.map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
}

function baixarCSV(conteudo: string, nome: string) {
  const blob = new Blob(["﻿" + conteudo], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome; a.click();
  URL.revokeObjectURL(url);
}

// ── KPI card ─────────────────────────────────────────────────
function KpiCard({ icone, titulo, valor, sub, alerta = false }: {
  icone: React.ReactNode; titulo: string; valor: string | number; sub?: string; alerta?: boolean;
}) {
  return (
    <div className={`bg-white rounded-2xl border p-4 shadow-sm ${alerta ? "border-amber-200" : "border-gray-100"}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{titulo}</p>
        {icone}
      </div>
      <p className={`text-2xl font-bold ${alerta ? "text-amber-600" : "text-gray-900"}`}>{valor}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ── Card de rota expandível ───────────────────────────────────
function RotaCardHistorico({ rota }: { rota: Rota }) {
  const [aberto, setAberto] = useState(false);
  const concluidas = rota.itens.filter((i) => i.concluido).length;
  const volumes = rota.itens.reduce((s, i) => s + i.volumesSaida, 0);
  const ocs = rota.itens.reduce((s, i) => s + (i.ocorrencias?.length ?? 0), 0);
  const km = kmTotal(rota);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setAberto((v) => !v)}
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
      >
        <div className={`rounded-lg p-1.5 flex-shrink-0 ${rota.status === "concluida" ? "bg-green-50" : "bg-blue-50"}`}>
          <Truck size={14} className={rota.status === "concluida" ? "text-green-600" : "text-blue-600"} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-800">{rota.motorista}</span>
            <span className="text-xs text-gray-400">{rota.veiculo_placa}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              rota.status === "concluida" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
            }`}>
              {rota.status === "concluida" ? "Concluída" : "Em andamento"}
            </span>
            {ocs > 0 && (
              <span className="flex items-center gap-1 text-xs text-amber-600 font-semibold">
                <AlertTriangle size={10} /> {ocs}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
            <span>{dataBR(rota.data)}</span>
            <span>{rota.hora_saida}{rota.hora_chegada ? ` → ${rota.hora_chegada}` : ""}</span>
            <span>{concluidas}/{rota.itens.length} cidades</span>
            <span>{volumes} vol.</span>
            {km > 0 && <span>{km} km</span>}
          </div>
        </div>
        {aberto ? <ChevronUp size={14} className="text-gray-300 flex-shrink-0" /> : <ChevronDown size={14} className="text-gray-300 flex-shrink-0" />}
      </button>

      {aberto && (
        <div className="border-t border-gray-50 divide-y divide-gray-50">
          {rota.itens.map((item, idx) => {
            const ite_ocs = item.ocorrencias ?? [];
            return (
              <div key={idx} className="px-4 py-2.5 flex items-start gap-3">
                <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                  item.concluido ? "bg-green-100" : "bg-gray-100"
                }`}>
                  {item.concluido
                    ? <CheckCircle2 size={10} className="text-green-600" />
                    : <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-medium ${item.concluido ? "text-gray-500" : "text-gray-700"}`}>{item.cidadeNome}</span>
                    <span className="text-xs text-gray-400">{item.entregadorNome}</span>
                    <span className="text-xs text-gray-400">{item.volumesSaida} vol.</span>
                    {item.horaConclusao && <span className="text-xs text-gray-400">{item.horaConclusao}</span>}
                  </div>
                  {ite_ocs.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {ite_ocs.map((oc, i) => (
                        <span key={i} className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                          {LABELS_OCORRENCIA[oc.tipo] ?? oc.tipo}{oc.quantidade > 1 ? ` ×${oc.quantidade}` : ""}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Aba Ocorrências ───────────────────────────────────────────
function AbaOcorrencias({ rotas }: { rotas: Rota[] }) {
  type OcComContexto = Ocorrencia & { data: string; motorista: string; placa: string; cidade: string; entregador: string };

  const todas = useMemo<OcComContexto[]>(() => {
    const lista: OcComContexto[] = [];
    for (const r of rotas) {
      for (const item of r.itens) {
        for (const oc of item.ocorrencias ?? []) {
          lista.push({ ...oc, data: r.data, motorista: r.motorista, placa: r.veiculo_placa, cidade: item.cidadeNome, entregador: item.entregadorNome });
        }
      }
    }
    return lista.sort((a, b) => b.data.localeCompare(a.data));
  }, [rotas]);

  const porTipo = useMemo(() => {
    const mapa: Record<string, number> = {};
    for (const oc of todas) mapa[oc.tipo] = (mapa[oc.tipo] ?? 0) + oc.quantidade;
    return Object.entries(mapa).sort((a, b) => b[1] - a[1]);
  }, [todas]);

  if (todas.length === 0) {
    return (
      <div className="text-center py-16">
        <CheckCircle2 size={40} className="text-gray-200 mx-auto mb-3" />
        <p className="text-gray-400 font-medium">Nenhuma ocorrência no período</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Ranking por tipo */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Ranking por tipo</p>
        <div className="space-y-2">
          {porTipo.map(([tipo, qtd]) => {
            const max = porTipo[0][1];
            return (
              <div key={tipo} className="flex items-center gap-3">
                <span className="text-xs text-gray-600 w-44 flex-shrink-0 truncate">{LABELS_OCORRENCIA[tipo as keyof typeof LABELS_OCORRENCIA] ?? tipo}</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(qtd / max) * 100}%` }} />
                </div>
                <span className="text-xs font-bold text-gray-700 w-6 text-right">{qtd}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lista detalhada */}
      <div className="space-y-2">
        {todas.map((oc, idx) => (
          <div key={idx} className="bg-white rounded-xl border border-amber-100 shadow-sm px-4 py-3 flex items-start gap-3">
            <AlertTriangle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-gray-800">{LABELS_OCORRENCIA[oc.tipo as keyof typeof LABELS_OCORRENCIA] ?? oc.tipo}</span>
                {oc.quantidade > 1 && <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">×{oc.quantidade}</span>}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400 flex-wrap">
                <span>{dataBR(oc.data)}</span>
                <span>{oc.motorista}</span>
                <span>{oc.cidade}</span>
                <span>{oc.entregador}</span>
              </div>
              {oc.descricao && <p className="text-xs text-gray-500 mt-1 italic">"{oc.descricao}"</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Aba Exportar ──────────────────────────────────────────────
function AbaExportar({ rotas, inicio, fim }: { rotas: Rota[]; inicio: string; fim: string }) {
  const periodo = `${inicio}_${fim}`;
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-blue-600" />
          <p className="font-semibold text-gray-800">Exportar dados do período</p>
        </div>
        <p className="text-sm text-gray-500">
          {rotas.length} rota{rotas.length !== 1 ? "s" : ""} · {dataBR(inicio)} a {dataBR(fim)}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => baixarCSV(gerarCSVRotas(rotas), `rotas_${periodo}.csv`)}
            disabled={rotas.length === 0}
            className="flex items-center gap-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl p-4 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={18} className="text-blue-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-800">Rotas completas</p>
              <p className="text-xs text-blue-500 mt-0.5">CSV com todas as rotas, KM, volumes e status</p>
            </div>
          </button>

          <button
            onClick={() => baixarCSV(gerarCSVOcorrencias(rotas), `ocorrencias_${periodo}.csv`)}
            disabled={rotas.length === 0}
            className="flex items-center gap-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl p-4 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={18} className="text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Ocorrências</p>
              <p className="text-xs text-amber-500 mt-0.5">CSV com cada ocorrência, tipo, motorista e cidade</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────
export default function RelatoriosPage() {
  const [inicio, setInicio] = useState(inicioDeMes());
  const [fim, setFim] = useState(hoje());
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [buscado, setBuscado] = useState(false);
  const [aba, setAba] = useState<Aba>("rotas");

  const buscar = useCallback(async () => {
    if (!inicio || !fim) return;
    setCarregando(true);
    try {
      const res = await fetch(`/api/relatorios/rotas?inicio=${inicio}&fim=${fim}`);
      if (res.ok) setRotas(await res.json());
    } finally {
      setCarregando(false);
      setBuscado(true);
    }
  }, [inicio, fim]);

  // KPIs
  const totalRotas = rotas.length;
  const concluidas = rotas.filter((r) => r.status === "concluida").length;
  const totalVolumes = rotas.reduce((s, r) => s + r.itens.reduce((si, i) => si + i.volumesSaida, 0), 0);
  const totalEntregues = rotas.reduce((s, r) => s + r.itens.reduce((si, i) => si + (i.volumesEntregues ?? (i.concluido ? i.volumesSaida : 0)), 0), 0);
  const totalOcs = rotas.reduce((s, r) => s + r.itens.reduce((si, i) => si + (i.ocorrencias?.length ?? 0), 0), 0);
  const totalKm = rotas.reduce((s, r) => s + kmTotal(r), 0);
  const taxaEntrega = totalVolumes > 0 ? Math.round((totalEntregues / totalVolumes) * 100) : 0;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <NavBar />

      <main className="flex-1 px-5 py-6 max-w-5xl mx-auto w-full space-y-5">

        {/* Filtro de período */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Período</p>
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">De</label>
              <input
                type="date"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Até</label>
              <input
                type="date"
                value={fim}
                onChange={(e) => setFim(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <button
              onClick={buscar}
              disabled={carregando}
              className="flex items-center gap-2 bg-[#0d47a1] hover:bg-blue-800 text-white rounded-lg px-5 py-2 text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {carregando
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Search size={14} />
              }
              Buscar
            </button>
          </div>
        </div>

        {/* KPIs */}
        {buscado && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard icone={<Truck size={18} className="text-blue-600" />} titulo="Rotas" valor={totalRotas} sub={`${concluidas} concluída${concluidas !== 1 ? "s" : ""}`} />
            <KpiCard icone={<Package size={18} className="text-purple-600" />} titulo="Volumes" valor={`${totalEntregues}/${totalVolumes}`} sub={`${taxaEntrega}% entregues`} />
            <KpiCard icone={<AlertTriangle size={18} className="text-amber-500" />} titulo="Ocorrências" valor={totalOcs} sub="no período" alerta={totalOcs > 0} />
            <KpiCard icone={<BarChart2 size={18} className="text-green-600" />} titulo="KM Rodados" valor={totalKm > 0 ? `${totalKm} km` : "—"} sub="total do período" />
          </div>
        )}

        {/* Tabs */}
        {buscado && (
          <>
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
              {(["rotas", "ocorrencias", "exportar"] as Aba[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setAba(tab)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                    aba === tab ? "bg-white shadow-sm text-gray-800" : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {tab === "rotas" ? `Rotas (${totalRotas})` : tab === "ocorrencias" ? `Ocorrências (${totalOcs})` : "Exportar CSV"}
                </button>
              ))}
            </div>

            <div>
              {aba === "rotas" && (
                rotas.length === 0 ? (
                  <div className="text-center py-16">
                    <Truck size={40} className="text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 font-medium">Nenhuma rota no período</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {rotas.map((r) => <RotaCardHistorico key={r.id} rota={r} />)}
                  </div>
                )
              )}
              {aba === "ocorrencias" && <AbaOcorrencias rotas={rotas} />}
              {aba === "exportar" && <AbaExportar rotas={rotas} inicio={inicio} fim={fim} />}
            </div>
          </>
        )}

        {!buscado && !carregando && (
          <div className="text-center py-16">
            <BarChart2 size={48} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">Selecione o período e clique em Buscar</p>
          </div>
        )}
      </main>
    </div>
  );
}
