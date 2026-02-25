"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type { Rota, ItemRota, Ocorrencia, EventoNotificacao } from "@/lib/types";

interface Options {
  dataFiltro: string; // "YYYY-MM-DD"
  onEvento: (e: EventoNotificacao) => void;
}

export function useRotasRealtime({ dataFiltro, onEvento }: Options) {
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [conectado, setConectado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const rotasRef = useRef<Map<number, Rota>>(new Map());

  const carregar = useCallback(async () => {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from("rotas")
      .select("*")
      .eq("data", dataFiltro)
      .order("criado_em", { ascending: false });

    if (data) {
      const mapa = new Map<number, Rota>();
      data.forEach((r: Rota) => mapa.set(r.id, r));
      rotasRef.current = mapa;
      setRotas([...mapa.values()]);
    }
  }, [dataFiltro]);

  // Carregamento inicial
  useEffect(() => {
    setCarregando(true);
    carregar().finally(() => setCarregando(false));
  }, [carregar]);

  // Polling a cada 10s como fallback quando WebSocket não conecta
  useEffect(() => {
    const intervalo = setInterval(carregar, 10_000);
    return () => clearInterval(intervalo);
  }, [carregar]);

  // Realtime
  useEffect(() => {
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`rotas-dia-${dataFiltro}`)
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "rotas" },
        (payload: any) => {
          const nova = payload.new as Rota;
          // Filtra apenas rotas do dia monitorado
          if (nova.data !== dataFiltro) return;

          const antiga = rotasRef.current.get(nova.id);

          if (!antiga) {
            onEvento({ tipo: "rota_iniciada", rota: nova });
          } else if (nova.status === "concluida" && antiga.status !== "concluida") {
            onEvento({ tipo: "rota_encerrada", rota: nova });
          } else {
            detectarMudancasItens(antiga, nova, onEvento);
          }

          rotasRef.current.set(nova.id, nova);
          setRotas(
            [...rotasRef.current.values()].sort(
              (a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime()
            )
          );
        }
      )
      .subscribe((status: string, err?: Error) => {
        setConectado(status === "SUBSCRIBED");
        if (err) console.error("[Realtime]", status, err.message);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dataFiltro, onEvento]);

  return { rotas, conectado, carregando };
}

function detectarMudancasItens(
  antiga: Rota,
  nova: Rota,
  onEvento: (e: EventoNotificacao) => void
) {
  nova.itens.forEach((itemNovo: ItemRota, idx: number) => {
    const itemAntigo = antiga.itens[idx];
    if (!itemAntigo) return;

    if (itemNovo.concluido && !itemAntigo.concluido) {
      onEvento({ tipo: "cidade_concluida", rota: nova, cidade: itemNovo });
      return;
    }

    const ocosNovo = itemNovo.ocorrencias?.length ?? 0;
    const ocosAntigo = itemAntigo.ocorrencias?.length ?? 0;
    if (ocosNovo > ocosAntigo) {
      const novaOco = itemNovo.ocorrencias[ocosNovo - 1] as Ocorrencia;
      onEvento({ tipo: "ocorrencia_registrada", rota: nova, cidade: itemNovo, ocorrencia: novaOco });
    }
  });
}
