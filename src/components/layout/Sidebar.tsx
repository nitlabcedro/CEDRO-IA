/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { 
  LayoutDashboard, 
  ClipboardList, 
  PlusCircle, 
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
  const collapsed = isSidebarCollapsed;

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
        collapsed ? "md:w-20" : "md:w-72"
      } fixed md:static inset-y-0 left-0 z-40 bg-gradient-to-b from-[#004D24] via-[#003F1D] to-[#002F16] text-white border-r border-[#003F1D]/40 transition-[width,transform] duration-300 ease-in-out md:flex flex-col shrink-0 md:overflow-visible overflow-hidden relative shadow-[4px_0_24px_rgba(0,0,0,0.3)]`}
    >
      {/* Brand Header Container with Larger Logo */}
      <div className={`hidden md:block transition-[height,padding] duration-300 ease-in-out border-b border-white/10 bg-black/15 overflow-hidden relative ${
        collapsed 
          ? "h-20 p-3" 
          : "h-28 px-6 py-5"
      }`}>
        <div className="absolute inset-0 bg-[#00d136]/5 blur-2xl rounded-full opacity-100 transition-opacity duration-300" />
        
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Logo Completa (Visible when NOT collapsed) */}
          <div className={`transition-all duration-300 absolute inset-0 flex items-center justify-center ${
            collapsed ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100"
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
            collapsed ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
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
      <nav className={`flex-1 px-4 space-y-6 overflow-y-auto custom-scrollbar transition-[margin,padding] duration-300 ease-in-out relative z-10 ${
        collapsed ? "mt-4 px-2" : "mt-8"
      }`}>
        {sidebarGroups.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-2 transition-all duration-300 relative">
            {groupIdx > 0 && (
              <div className={`transition-all duration-300 ${
                collapsed 
                  ? "border-t border-white/10 mx-3 my-4" 
                  : "border-t border-white/10 mx-3 pt-4 mb-2"
              }`} />
            )}
            
            <div className={`text-[11px] font-black uppercase tracking-[0.16em] text-emerald-100/60 transition-all duration-300 ${
              collapsed ? "opacity-0 h-0 my-0 overflow-hidden pointer-events-none" : "px-4 mb-2.5 opacity-100 h-auto mt-1"
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
                  title={collapsed ? item.label : undefined}
                  className={`w-full group flex items-center rounded-xl font-bold transition-[padding,gap,background-color] duration-300 relative overflow-hidden ${
                    collapsed ? "justify-center p-3 gap-0" : "gap-3.5 px-4 py-3"
                  } ${
                    activeTab === item.id 
                       ? "bg-gradient-to-r from-[#00d136]/24 to-[#00d136]/4 text-white border-l-4 border-l-[#00d136]" 
                      : "text-emerald-100/85 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <item.icon size={19} className={`shrink-0 transition-colors duration-300 ${
                    activeTab === item.id ? "text-[#00d136]" : "text-emerald-200/60 group-hover:text-emerald-50/90"
                  } ${collapsed ? "mx-auto" : ""}`} />
                  
                  <span className={`tracking-tight transition-[opacity,transform,width,max-width] duration-300 text-sm whitespace-nowrap origin-left ${
                    collapsed 
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
        {!collapsed ? (
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
        className="absolute top-1/2 -translate-y-1/2 -right-2.5 h-14 w-5 rounded-r-xl rounded-l-none bg-gradient-to-r from-[#003F1D] to-[#002210] text-emerald-300/85 hover:text-white border-y border-r border-[#025227] hover:border-[#00d136] flex items-center justify-center transition-[transform,color] duration-300 cursor-pointer active:scale-95 shadow-[4px_0_10px_rgba(0,0,0,0.3)] z-50 md:flex hidden group/btn"
        title={isSidebarCollapsed ? "Expandir menu" : "Recolher menu"}
      >
        <ChevronLeft 
          size={11} 
          className={`transition-transform duration-300 group-hover/btn:scale-110 ${
            collapsed 
              ? "rotate-180 translate-x-[1px] group-hover/btn:translate-x-[2px]" 
              : "rotate-0 -translate-x-[1px] group-hover/btn:-translate-x-[2px]"
          }`} 
        />
      </button>

    </aside>
  );
};
export default Sidebar;
