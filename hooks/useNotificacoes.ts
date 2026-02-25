"use client";
import { useCallback, useEffect } from "react";
import type { EventoNotificacao } from "@/lib/types";

const SONS: Record<string, string> = {
  rota_iniciada: "/sounds/rota-iniciada.mp3",
  cidade_concluida: "/sounds/cidade-concluida.mp3",
  rota_encerrada: "/sounds/rota-encerrada.mp3",
  ocorrencia_registrada: "/sounds/ocorrencia.mp3",
};

function textoEvento(evento: EventoNotificacao): { titulo: string; corpo: string } {
  switch (evento.tipo) {
    case "rota_iniciada":
      return {
        titulo: "Rota Iniciada",
        corpo: `${evento.rota.motorista} saiu com ${evento.rota.veiculo_placa} às ${evento.rota.hora_saida}`,
      };
    case "cidade_concluida": {
      const ent = evento.cidade.volumesEntregues ?? evento.cidade.volumesSaida - (evento.cidade.volumesDevolvidos ?? 0);
      return {
        titulo: `Entrega Concluída — ${evento.cidade.cidadeNome}`,
        corpo: `${evento.rota.motorista} · ${ent}/${evento.cidade.volumesSaida} volumes às ${evento.cidade.horaConclusao ?? ""}`,
      };
    }
    case "rota_encerrada": {
      const km = evento.rota.km_chegada
        ? ` · ${(evento.rota.km_chegada - evento.rota.km_saida).toFixed(0)} km rodados`
        : "";
      return {
        titulo: "Rota Encerrada",
        corpo: `${evento.rota.motorista} chegou às ${evento.rota.hora_chegada ?? "--"}${km}`,
      };
    }
    case "ocorrencia_registrada":
      return {
        titulo: `Ocorrência — ${evento.cidade.cidadeNome}`,
        corpo: evento.ocorrencia.descricao || evento.ocorrencia.tipo,
      };
  }
}

export function useNotificacoes() {
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const dispararNotificacao = useCallback((evento: EventoNotificacao) => {
    // Som
    const somPath = SONS[evento.tipo];
    if (somPath) {
      try {
        const audio = new Audio(somPath);
        audio.volume = 0.65;
        audio.play().catch(() => {});
      } catch {}
    }

    // Notificação push do navegador
    if ("Notification" in window && Notification.permission === "granted") {
      const { titulo, corpo } = textoEvento(evento);
      try {
        new Notification(titulo, {
          body: corpo,
          icon: "/icon.png",
          tag: evento.tipo,
          requireInteraction: evento.tipo === "ocorrencia_registrada",
        });
      } catch {}
    }
  }, []);

  return { dispararNotificacao };
}
