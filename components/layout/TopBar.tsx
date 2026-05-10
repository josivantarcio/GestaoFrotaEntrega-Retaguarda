"use client";
import { Wifi, WifiOff, Bell, BellOff, MapPin, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";

const SITE_URL = "https://logistica-retaguarda.vercel.app";

function mensagemGrupo(): string {
  const data = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return (
    `🚚 *RotaFácil — Acompanhamento ao vivo*\n` +
    `📅 ${data.charAt(0).toUpperCase() + data.slice(1)}\n\n` +
    `Acompanhe as entregas de hoje em tempo real:\n` +
    `🔗 ${SITE_URL}/acompanhar\n\n` +
    `Selecione sua cidade e veja onde está o motorista! 📍`
  );
}

export function TopBar({ conectado }: { conectado: boolean }) {
  const [hora, setHora] = useState("");
  const [data, setData] = useState("");
  const [permissao, setPermissao] = useState<NotificationPermission>("default");

  useEffect(() => {
    function atualizar() {
      const agora = new Date();
      setHora(agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
      setData(agora.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }));
    }
    atualizar();
    const id = setInterval(atualizar, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if ("Notification" in window) setPermissao(Notification.permission);
  }, []);

  async function ativarNotificacoes() {
    if (!("Notification" in window)) return;
    if (permissao === "denied") {
      alert(
        "Notificações bloqueadas pelo navegador.\n\n" +
        "Para reativar:\n" +
        "• Chrome: clique no cadeado na barra de endereço → Notificações → Permitir\n" +
        "• Firefox: clique no escudo → Permissões → Notificações → Permitir\n" +
        "• Safari: Preferências → Sites → Notificações → Permitir"
      );
      return;
    }
    const perm = await Notification.requestPermission();
    setPermissao(perm);
  }

  function compartilharGrupo() {
    const texto = encodeURIComponent(mensagemGrupo());
    window.open(`https://wa.me/?text=${texto}`, "_blank");
  }

  return (
    <header className="bg-[#0d47a1] text-white px-5 py-3 flex items-center justify-between shadow-md flex-shrink-0">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight">RotaFácil</h1>
          <span className="text-xs bg-white/20 rounded px-2 py-0.5 font-medium">Retaguarda</span>
        </div>
        <p className="text-xs text-blue-200 capitalize mt-0.5">{data}</p>
      </div>

      <div className="flex items-center gap-3">
        {permissao !== "granted" && (
          <button
            onClick={ativarNotificacoes}
            title={permissao === "denied" ? "Ver como reativar notificações" : "Ativar notificações"}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              permissao === "denied"
                ? "bg-red-500/30 hover:bg-red-500/40 text-red-200"
                : "bg-white/20 hover:bg-white/30"
            }`}
          >
            {permissao === "denied" ? <BellOff size={13} /> : <Bell size={13} />}
            {permissao === "denied" ? "Notif. bloqueadas" : "Ativar notificações"}
          </button>
        )}

        <button
          onClick={compartilharGrupo}
          title="Enviar link de acompanhamento para o grupo do WhatsApp"
          className="flex items-center gap-1.5 bg-green-500/30 hover:bg-green-500/40 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors text-green-100"
        >
          <MessageCircle size={13} />
          Avisar grupo
        </button>

        <Link
          href="/acompanhar"
          className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
        >
          <MapPin size={13} />
          Acompanhar
        </Link>

        <span className="text-sm font-mono font-bold tabular-nums">{hora}</span>

        <div
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
            conectado ? "bg-green-500/30 text-green-100" : "bg-black/20 text-red-200"
          }`}
        >
          {conectado ? <Wifi size={12} /> : <WifiOff size={12} />}
          {conectado ? "Conectado" : "Reconectando..."}
        </div>
      </div>
    </header>
  );
}
