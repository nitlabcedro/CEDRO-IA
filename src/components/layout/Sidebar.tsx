/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { 
  LayoutDashboard, 
  ClipboardList, 
  PlusCircle, 
  ChevronRight, 
  Users, 
  Building2, 
  ShieldAlert, 
  Bell, 
  MessageSquare, 
  UserCircle, 
  ChevronLeft, 
  ShieldCheck 
} from "lucide-react";
import { UserProfile } from "../../types";

interface SidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  profile: UserProfile | null;
  isCurrentUserAdmin: boolean;
  isCurrentUserPrivileged: boolean;
  onNewSolicitation: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isSidebarOpen,
  setIsSidebarOpen,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  activeTab,
  setActiveTab,
  profile,
  isCurrentUserAdmin,
  isCurrentUserPrivileged,
  onNewSolicitation,
}) => {
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "inventory", label: "Inventário de IA", icon: ClipboardList },
    { id: "approval_queue", label: "Aprovação de IAs", icon: ShieldCheck, privilegedOnly: true },
    { id: "sectors", label: "Mapa de IAs", icon: Users, adminOnly: true },
    { id: "sectors_mgr", label: "Setores", icon: Building2, adminOnly: true },
    { id: "admin", label: "Administração IA", icon: ShieldAlert, adminOnly: false, privilegedOnly: true },
    { id: "new", label: "Nova Solicitação", icon: PlusCircle },
    { id: "alerts", label: "Alertas", icon: Bell },
    { id: "chat", label: "Chat", icon: MessageSquare },
    { id: "profile", label: "Meu Perfil", icon: UserCircle },
  ].filter(item => 
    (!item.adminOnly || isCurrentUserAdmin) && 
    (!("privilegedOnly" in item && item.privilegedOnly) || isCurrentUserPrivileged)
  );

  const sidebarGroupConfigs = [
    {
      title: "IA e Inventário",
      itemIds: ["dashboard", "inventory", "new"]
    },
    {
      title: "Administração",
      itemIds: ["approval_queue", "sectors", "sectors_mgr", "admin"],
      show: isCurrentUserAdmin || isCurrentUserPrivileged
    },
    {
      title: "Auxiliares",
      itemIds: ["alerts", "chat", "profile"]
    }
  ];

  const sidebarGroups = sidebarGroupConfigs
    .filter(g => g.show === undefined || g.show)
    .map(g => {
      const items = g.itemIds
        .map(id => menuItems.find(item => item.id === id))
        .filter((item): item is typeof menuItems[number] => !!item);
      return {
        title: g.title,
        items
      };
    })
    .filter(g => g.items.length > 0);

  return (
    <aside 
      className={`${
        isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      } ${
        isSidebarCollapsed ? "md:w-20" : "md:w-72"
      } fixed md:static inset-y-0 left-0 z-40 bg-gradient-to-b from-[#004D24] via-[#003F1D] to-[#002F16] text-white border-r border-[#003F1D]/40 transition-all duration-300 ease-in-out md:flex flex-col shrink-0 md:overflow-visible overflow-hidden relative shadow-[4px_0_24px_rgba(0,0,0,0.3)] animate-fade-in`}
    >
      {/* Soft internal light overlay for visual thickness and premium glow */}
      <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-[#00d136]/10 to-transparent pointer-events-none blur-3xl opacity-80" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#00d136]/3 to-transparent pointer-events-none blur-2xl opacity-60" />

      {/* Dynamic & Organic Biotech / Lab Cedro Decorative Vectors */}
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden opacity-[0.07] z-0">
        <svg className="absolute inset-y-0 left-0 w-8 h-full text-emerald-450 stroke-[1]" fill="none" viewBox="0 0 32 800" preserveAspectRatio="none">
          <line x1="8" y1="0" x2="8" y2="100%" stroke="currentColor" strokeDasharray="5 15" />
          <line x1="16" y1="0" x2="16" y2="100%" stroke="currentColor" strokeDasharray="1 30" />
          <path d="M 4 80 L 12 80 M 4 160 L 12 160 M 4 240 L 12 240 M 4 320 L 12 320 M 4 400 L 12 400 M 4 480 L 12 480 M 4 560 L 12 560 M 4 640 L 12 640 M 4 720 L 12 720" stroke="currentColor" />
        </svg>

        <svg className="absolute bottom-16 right-4 w-28 h-96 text-emerald-300 stroke-[1.25]" fill="none" viewBox="0 0 112 384">
          <path d="M 40 384 C 40 340, 20 300, 20 250 C 20 200, 80 170, 80 120 C 80 70, 40 30, 40 0" stroke="currentColor" strokeDasharray="3 3" />
          <path d="M 72 384 C 72 340, 92 300, 92 250 C 92 200, 32 170, 32 120 C 32 70, 72 30, 72 0" stroke="currentColor" strokeDasharray="3 3" />
          
          <line x1="22" y1="290" x2="90" y2="290" stroke="currentColor" />
          <circle cx="22" cy="290" r="3" fill="currentColor" />
          <circle cx="90" cy="290" r="3" fill="currentColor" />

          <line x1="28" y1="210" x2="84" y2="210" stroke="currentColor" />
          <circle cx="28" cy="210" r="2.5" fill="currentColor" />
          <circle cx="84" cy="210" r="2.5" fill="currentColor" />

          <line x1="32" y1="120" x2="80" y2="120" stroke="currentColor" />
          <circle cx="32" cy="120" r="3.5" fill="currentColor" />
          <circle cx="80" cy="120" r="3.5" fill="currentColor" />

          <line x1="43" y1="50" x2="69" y2="50" stroke="currentColor" />
          <circle cx="43" cy="50" r="2.5" fill="currentColor" />
          <circle cx="69" cy="50" r="2.5" fill="currentColor" />

          <path d="M 40 330 L 10 300 M 72 330 L 102 300" stroke="currentColor" />
          <path d="M 28 150 L 8 130 M 84 150 L 104 130" stroke="currentColor" />
        </svg>

        <svg className="absolute top-1/4 left-6 w-12 h-64 text-emerald-405 stroke-[1] opacity-75" fill="none" viewBox="0 0 50 200">
          <path d="M 10 0 C 10 30, 40 50, 40 80 C 40 110, 10 130, 10 160 C 10 190, 40 210, 40 240" stroke="currentColor" strokeDasharray="2 3" />
          <path d="M 40 0 C 40 30, 10 50, 10 80 C 10 110, 40 130, 40 160 C 40 190, 10 210, 10 240" stroke="currentColor" strokeDasharray="2 3" />
          <line x1="15" y1="40" x2="35" y2="40" stroke="currentColor" />
          <circle cx="15" cy="40" r="1.5" fill="currentColor" />
          <circle cx="35" cy="40" r="1.5" fill="currentColor" />

          <line x1="20" y1="80" x2="30" y2="80" stroke="currentColor" />
          <circle cx="20" cy="80" r="2" fill="currentColor" />
          <circle cx="30" cy="80" r="2" fill="currentColor" />

          <line x1="15" y1="120" x2="35" y2="120" stroke="currentColor" />
          <circle cx="15" cy="120" r="1.5" fill="currentColor" />
          <circle cx="35" cy="120" r="1.5" fill="currentColor" />
        </svg>
        
        <div className="absolute top-36 right-0 translate-x-12 opacity-40">
          <svg className="w-40 h-40 text-emerald-400 rotate-45" fill="none" viewBox="0 0 100 100">
            <rect x="10" y="10" width="80" height="80" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 4" />
            <circle cx="50" cy="50" r="35" stroke="currentColor" strokeWidth="0.75" />
            <line x1="50" y1="0" x2="50" y2="100" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 4" />
            <line x1="0" y1="50" x2="100" y2="50" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 4" />
          </svg>
        </div>
      </div>

      {/* Brand Header Container with Larger Logo */}
      <div className={`hidden md:block transition-all duration-300 border-b border-white/10 bg-black/15 overflow-hidden relative ${
        isSidebarCollapsed 
          ? "h-20 p-3" 
          : "h-28 px-6 py-5"
      }`}>
        <div className="absolute inset-0 bg-[#00d136]/5 blur-2xl rounded-full opacity-100 transition-opacity duration-300" />
        
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Logo Completa (Visible when NOT collapsed) */}
          <div className={`transition-all duration-300 absolute inset-0 flex items-center justify-center ${
            isSidebarCollapsed ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100"
          }`}>
            <img
              src="https://raw.githubusercontent.com/nitlabcedro/assets/refs/heads/main/Ativo%206.png"
              alt="Laboratório Cedro"
              className="h-16 w-auto object-contain brightness-0 invert drop-shadow-[0_2px_8px_rgba(0,209,54,0.15)]"
              draggable={false}
            />
          </div>

          {/* Logo Símbolo (Visible when collapsed) */}
          <div className={`transition-all duration-300 absolute inset-0 flex items-center justify-center ${
            isSidebarCollapsed ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
          }`}>
            <img 
              src="https://raw.githubusercontent.com/nitlabcedro/assets/refs/heads/main/Ativo%206%20(1).png" 
              alt="Laboratório Cedro" 
              className="h-10 w-auto brightness-0 invert object-contain filter drop-shadow-[0_2px_8px_rgba(0,209,54,0.2)]" 
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </div>

      {/* Navigation items with elegant styling */}
      <nav className={`flex-1 px-4 space-y-6 overflow-y-auto custom-scrollbar transition-all duration-300 relative z-10 ${
        isSidebarCollapsed ? "mt-4 px-2" : "mt-8"
      }`}>
        {sidebarGroups.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-2 transition-all duration-300 relative">
            {groupIdx > 0 && (
              <div className={`transition-all duration-300 ${
                isSidebarCollapsed 
                  ? "border-t border-white/10 mx-3 my-4" 
                  : "border-t border-white/10 mx-3 pt-4 mb-2"
              }`} />
            )}
            
            <div className={`text-[11px] font-black uppercase tracking-[0.16em] text-emerald-100/60 transition-all duration-300 ${
              isSidebarCollapsed ? "opacity-0 h-0 my-0 overflow-hidden pointer-events-none" : "px-4 mb-2.5 opacity-100 h-auto mt-1"
            }`}>
              {group.title}
            </div>
            
            <div className="space-y-1">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === "new") onNewSolicitation();
                    setActiveTab(item.id);
                    if (window.innerWidth < 768) setIsSidebarOpen(false);
                  }}
                  title={isSidebarCollapsed ? item.label : undefined}
                  className={`w-full group flex items-center rounded-xl font-bold transition-all duration-200 relative overflow-hidden ${
                    isSidebarCollapsed ? "justify-center p-3 gap-0" : "gap-3.5 px-4 py-3"
                  } ${
                    activeTab === item.id 
                      ? "bg-gradient-to-r from-[#00d136]/24 to-[#00d136]/4 text-white border-l-4 border-l-[#00d136] shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]" 
                      : "text-emerald-100/85 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <item.icon size={19} className={`shrink-0 transition-all duration-300 ${
                    activeTab === item.id ? "text-[#00d136] scale-110" : "text-emerald-200/60 group-hover:text-emerald-50/90 group-hover:scale-105"
                  } ${isSidebarCollapsed ? "mx-auto" : ""}`} />
                  
                  <span className={`tracking-tight transition-all duration-300 text-sm whitespace-nowrap origin-left ${
                    isSidebarCollapsed 
                      ? "opacity-0 translate-x-3 w-0 max-w-0 overflow-hidden pointer-events-none" 
                      : "opacity-100 translate-x-0 w-auto max-w-[200px]"
                  }`}>
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Sidebar Footer with brand */}
      <div className="p-6 border-t border-white/10 bg-black/15 mt-auto select-none md:block hidden relative z-10 shrink-0">
        {!isSidebarCollapsed ? (
          <div className="flex items-center justify-start">
            <img 
              src="https://raw.githubusercontent.com/nitlabcedro/assets/refs/heads/main/Ativo%206.png" 
              alt="Laboratório Cedro" 
              className="h-8 w-auto brightness-0 invert object-contain opacity-75 hover:opacity-100 transition-opacity duration-200"
              referrerPolicy="no-referrer"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center">
            <img 
              src="https://raw.githubusercontent.com/nitlabcedro/assets/refs/heads/main/Ativo%206%20(1).png" 
              alt="Símbolo Laboratório Cedro" 
              className="h-5 w-auto brightness-0 invert opacity-65"
            />
          </div>
        )}
      </div>

      <button
        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        className="absolute top-1/2 -translate-y-1/2 -right-2 h-14 w-4.5 rounded-r-xl rounded-l-none bg-gradient-to-r from-[#003F1D] to-[#002210] text-emerald-300/80 hover:text-white border-y border-r border-[#025227] hover:border-[#00d136] flex items-center justify-center transition-all duration-300 cursor-pointer active:scale-95 shadow-[4px_0_10px_rgba(0,0,0,0.3)] z-50 md:flex hidden hover:w-5.5 hover:-right-2.5 group/btn"
        title={isSidebarCollapsed ? "Expandir menu" : "Recolher menu"}
      >
        <ChevronLeft 
          size={11} 
          className={`transition-all duration-300 group-hover/btn:scale-110 ${
            isSidebarCollapsed 
              ? "rotate-180 translate-x-[1px] group-hover/btn:translate-x-[2px]" 
              : "rotate-0 -translate-x-[1px] group-hover/btn:-translate-x-[2px]"
          }`} 
        />
      </button>
    </aside>
  );
};
export default Sidebar;
