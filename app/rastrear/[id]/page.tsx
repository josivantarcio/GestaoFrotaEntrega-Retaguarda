"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface Localizacao {
  id: number;
  rota_id: number;
  lat: number;
  lng: number;
  velocidade: number | null;
  criado_em: string;
}

interface InfoRota {
  motorista: string;
  veiculo_placa: string;
  status: string;
  hora_saida: string;
  data: string;
}

export default function RastrearPage({ params }: { params: { id: string } }) {
  const rotaId = Number(params.id);
  const [posicao, setPosicao] = useState<Localizacao | null>(null);
  const [infoRota, setInfoRota] = useState<InfoRota | null>(null);
  const [encerrada, setEncerrada] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  useEffect(() => {
    async function carregarDados() {
      const { data: rota } = await supabase
        .from("rotas")
        .select("motorista, veiculo_placa, status, hora_saida, data")
        .eq("id", rotaId)
        .single();

      if (rota) {
        setInfoRota(rota);
        if (rota.status === "concluida") setEncerrada(true);
      }

      const { data: locs } = await supabase
        .from("localizacoes")
        .select("*")
        .eq("rota_id", rotaId)
        .order("criado_em", { ascending: false })
        .limit(1);

      if (locs && locs.length > 0) {
        setPosicao(locs[0]);
        setUltimaAtualizacao(new Date(locs[0].criado_em));
      }
    }

    carregarDados();

    const channel = supabase
      .channel(`localizacoes-rota-${rotaId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "localizacoes", filter: `rota_id=eq.${rotaId}` },
        (payload) => {
          const nova = payload.new as Localizacao;
          setPosicao(nova);
          setUltimaAtualizacao(new Date(nova.criado_em));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rotas", filter: `id=eq.${rotaId}` },
        (payload) => {
          if (payload.new.status === "concluida") setEncerrada(true);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [rotaId]);

  const mapsUrl = posicao
    ? `https://maps.google.com/maps?q=${posicao.lat},${posicao.lng}&z=15&output=embed`
    : null;

  const dataBR = (d: string) => {
    const [a, m, dia] = d.split("-");
    return `${dia}/${m}/${a}`;
  };

  const horaRelativa = (d: Date) => {
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return `há ${diff}s`;
    if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
    return `há ${Math.floor(diff / 3600)}h`;
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f3f4f6", fontFamily: "sans-serif" }}>
      {/* Header */}
      <div style={{ backgroundColor: "#ee4d2d", padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 24 }}>📍</div>
        <div>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>
            {infoRota ? `${infoRota.motorista} · ${infoRota.veiculo_placa}` : "Carregando…"}
          </div>
          <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>
            {infoRota ? `Saída ${infoRota.hora_saida} — ${dataBR(infoRota.data)}` : ""}
          </div>
        </div>
        {encerrada && (
          <div style={{ marginLeft: "auto", backgroundColor: "#dc2626", borderRadius: 20, padding: "4px 12px", color: "#fff", fontSize: 12, fontWeight: 700 }}>
            ENCERRADA
          </div>
        )}
        {!encerrada && posicao && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#4ade80", animation: "pulse 2s infinite" }} />
            <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 12 }}>AO VIVO</span>
          </div>
        )}
      </div>

      {/* Mapa */}
      <div style={{ position: "relative", height: "calc(100vh - 140px)", backgroundColor: "#e5e7eb" }}>
        {mapsUrl ? (
          <iframe
            ref={iframeRef}
            key={`${posicao?.lat}-${posicao?.lng}`}
            src={mapsUrl}
            width="100%"
            height="100%"
            style={{ border: "none", display: "block" }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12 }}>
            <div style={{ fontSize: 48 }}>📡</div>
            <div style={{ color: "#6b7280", fontSize: 15, textAlign: "center", padding: "0 32px" }}>
              {encerrada
                ? "Esta rota foi encerrada."
                : "Aguardando primeira localização…\nO motorista precisa estar com o app aberto."}
            </div>
          </div>
        )}
      </div>

      {/* Rodapé */}
      <div style={{ backgroundColor: "#fff", padding: "10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #e5e7eb" }}>
        <div style={{ fontSize: 12, color: "#6b7280" }}>
          {ultimaAtualizacao ? `Atualizado ${horaRelativa(ultimaAtualizacao)}` : "Sem dados ainda"}
        </div>
        {posicao?.velocidade != null && posicao.velocidade > 0 && (
          <div style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>
            {Math.round(posicao.velocidade * 3.6)} km/h
          </div>
        )}
        <div style={{ fontSize: 11, color: "#9ca3af" }}>_RotaFacil · Jt@rcio_</div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
