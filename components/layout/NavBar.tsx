"use client";
import { LayoutDashboard, BarChart2, Map, Radio, Users, Home } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", Icon: Home },
  { href: "/gestao", label: "Gestão", Icon: LayoutDashboard },
  { href: "/mapa", label: "Mapa Geral", Icon: Map },
  { href: "/relatorios", label: "Relatórios", Icon: BarChart2 },
  { href: "/relatorios/entregadores", label: "Entregadores", Icon: Users },
  { href: "/acompanhar", label: "Acompanhar", Icon: Radio },
];

export function NavBar() {
  const path = usePathname();
  return (
    <header className="bg-[#0d47a1] text-white px-5 py-2.5 flex items-center gap-4 shadow-md flex-shrink-0">
      <div className="flex items-center gap-2 mr-4">
        <span className="text-base font-bold tracking-tight">RotaFácil</span>
        <span className="text-xs bg-white/20 rounded px-2 py-0.5 font-medium">Retaguarda</span>
      </div>
      <nav className="flex items-center gap-1 flex-wrap">
        {LINKS.map(({ href, label, Icon }) => {
          const ativo = path === href || (href !== "/dashboard" && path.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                ativo
                  ? "bg-white/30 text-white"
                  : "bg-white/10 hover:bg-white/20 text-blue-100"
              }`}
            >
              <Icon size={13} />
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
