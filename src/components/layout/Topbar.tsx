/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Bell, UserCircle, ChevronDown, X, CheckCircle2, Eye } from "lucide-react";
import { UserProfile, IARecord } from "../../types";
import { SystemAlert, saveAlertInteraction } from "../../lib/alerts";

interface TopbarProps {
  profile: UserProfile | null;
  isCurrentUserAdmin: boolean;
  activeUnreadAlertsCount: number;
  setActiveTab: (tab: any) => void;
  systemAlerts: SystemAlert[];
  triggerAlertsRefresh: () => void;
  records: IARecord[];
  setSelectedRecord: (record: IARecord | null) => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  profile,
  isCurrentUserAdmin,
  activeUnreadAlertsCount,
  setActiveTab,
  systemAlerts,
  triggerAlertsRefresh,
  records,
  setSelectedRecord,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="bg-[#003F1D] border-b-3 border-[#F58220] px-6 md:px-8 h-20 flex items-center justify-end sticky top-0 z-30 shadow-md select-none shrink-0 w-full relative">
      {/* Tech decorative background overlay */}
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden opacity-[0.08] flex items-center justify-between px-10">
        <svg className="absolute inset-0 w-full h-full text-emerald-300 stroke-[1]" fill="none">
          <line x1="0" y1="20" x2="100%" y2="20" stroke="currentColor" strokeDasharray="4 12" />
          <line x1="0" y1="60" x2="100%" y2="60" stroke="currentColor" strokeDasharray="1 15" />
          
          <path d="M 200 45 L 210 45 M 205 40 L 205 50" stroke="currentColor" strokeWidth="0.75" />
          <path d="M 50% 15 L 50% 25 M 49.5% 20 L 50.5% 20" stroke="currentColor" strokeWidth="0.75" />

          <path d="M 40 40 L 120 40 L 140 20 L 300 20 L 315 35 L 450 35" stroke="currentColor" />
          <circle cx="120" cy="40" r="2.5" fill="currentColor" />
          <circle cx="300" cy="20" r="2.5" fill="currentColor" />
          
          <path d="M 130 45 L 145 30 L 285 30" stroke="currentColor" strokeWidth="0.75" strokeDasharray="2 3" opacity="0.7" />

          <path d="M 25 15 L 15 15 L 15 25" stroke="currentColor" strokeWidth="1.25" />
          
          <path d="M 95% 45 L 82% 45 L 80% 20 L 70% 20" stroke="currentColor" />
          <rect x="80%" y="18" width="5" height="4" fill="currentColor" className="animate-pulse" />
          
          <circle cx="75%" cy="30" r="12" stroke="currentColor" strokeDasharray="3 3" opacity="0.6" />
          <circle cx="75%" cy="30" r="4" stroke="currentColor" opacity="0.4" />
        </svg>
      </div>

      {/* Main Right Block */}
      <div className="flex items-center gap-4 pl-4 shrink-0 relative z-10">
        
        {/* Alerts Bell Button & Popup Container */}
        <div className="relative">
          <button 
            onClick={() => setIsOpen(!isOpen)} 
            className="size-10 flex items-center justify-center p-2.5 bg-emerald-950/40 hover:bg-emerald-950/60 border border-emerald-800/40 hover:border-emerald-700/60 rounded-full relative transition-all active:scale-95 text-emerald-100 hover:text-white shrink-0 cursor-pointer shadow-sm"
            title="Notificações"
          >
            <Bell size={18} />
            {activeUnreadAlertsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 size-2 bg-[#F58220] rounded-full border border-[#003F1D] shadow-sm animate-pulse" />
            )}
          </button>

          {isOpen && (
            <>
              {/* Click-away backdrop */}
              <div className="fixed inset-0 z-40 cursor-default" onClick={() => setIsOpen(false)} />
              
              {/* Popover content */}
              <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white border border-[#E3E8E1] rounded-2xl shadow-xl z-50 text-[#1F2933] overflow-hidden animate-fade-in origin-top-right">
                
                {/* Header */}
                <div className="p-4 border-b border-[#E3E8E1] bg-[#FAF9F6] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-xs uppercase tracking-wider text-[#003F1D]">Notificações</span>
                    {activeUnreadAlertsCount > 0 && (
                      <span className="text-[10px] font-black bg-[#EAF4EC] border border-[#BFD8C5] text-[#075618] px-2 py-0.5 rounded-full">
                        {activeUnreadAlertsCount} novas
                      </span>
                    )}
                  </div>
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="p-1 hover:bg-[#EAF4EC] text-[#667085] hover:text-[#075618] rounded-lg transition-colors cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Alerts List */}
                <div className="max-h-96 overflow-y-auto custom-scrollbar divide-y divide-[#E3E8E1]/60">
                  {systemAlerts.filter(a => a.status === "Ativo").length === 0 ? (
                    <div className="py-12 text-center px-4">
                      <div className="inline-flex p-3 bg-[#EAF4EC] text-[#075618] border border-[#BFD8C5]/60 rounded-full mb-3 select-none">
                        <CheckCircle2 size={20} />
                      </div>
                      <p className="text-xs font-bold text-[#1F2933] uppercase tracking-wide">Sem pendências</p>
                      <p className="text-[11px] text-[#667085] mt-1">
                        O ecossistema do laboratório Cedro está em conformidade.
                      </p>
                    </div>
                  ) : (
                    systemAlerts
                      .filter(a => a.status === "Ativo")
                      .map((alert) => {
                        const badgeStyle = 
                          alert.level === "CRÍTICO"
                            ? "bg-[#FEF3F2] text-[#B42318] border border-[#FECDCA]"
                            : alert.level === "ATENÇÃO"
                              ? "bg-[#FFF9EB] text-[#F59E0B] border border-[#FEF08A]"
                              : "bg-[#EAF4EC] text-[#075618] border border-[#BFD8C5]";

                        return (
                          <div key={alert.id} className="p-4 hover:bg-[#FAF9F6] transition-colors flex flex-col gap-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex flex-col gap-1 min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded tracking-wider ${badgeStyle}`}>
                                    {alert.level}
                                  </span>
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                                    {alert.source}
                                  </span>
                                </div>
                                <h4 className="font-extrabold text-[#1F2933] text-xs uppercase tracking-tight leading-snug">
                                  {alert.title}
                                </h4>
                              </div>
                              
                              {/* Action Row */}
                              <div className="flex items-center gap-1 shrink-0">
                                {alert.status === "Ativo" && (
                                  <button
                                    onClick={() => {
                                      saveAlertInteraction(alert.id, "Lido");
                                      triggerAlertsRefresh();
                                    }}
                                    className="text-[9px] font-extrabold text-[#075618] hover:bg-[#EAF4EC] px-2.5 py-1 rounded-md border border-[#BFD8C5]/50 transition-colors cursor-pointer"
                                    title="Marcar como lido"
                                  >
                                    Lido
                                  </button>
                                )}
                              </div>
                            </div>
                            
                            <p className="text-[11px] text-[#667085] leading-relaxed font-medium">
                              {alert.desc}
                            </p>
                            
                            {/* If notification has actionType */}
                            {alert.actionType === "open-ia" && alert.relatedRecordId && (
                              <button
                                onClick={() => {
                                  const matched = records.find(r => r.id === alert.relatedRecordId);
                                  if (matched) {
                                    setSelectedRecord(matched);
                                    setActiveTab("report");
                                    setIsOpen(false);
                                  }
                                }}
                                className="self-start text-[9px] font-black text-[#075618] hover:underline flex items-center gap-1 mt-0.5 cursor-pointer uppercase tracking-wider"
                              >
                                <Eye size={10} /> Abrir Solicitação de IA
                              </button>
                            )}

                            {alert.actionType === "open-profile" && (
                              <button
                                onClick={() => {
                                  setActiveTab("profile");
                                  setIsOpen(false);
                                }}
                                className="self-start text-[9px] font-black text-[#075618] hover:underline flex items-center gap-1 mt-0.5 cursor-pointer uppercase tracking-wider"
                              >
                                <UserCircle size={10} /> Meu Perfil
                              </button>
                            )}
                          </div>
                        );
                      })
                  )}
                </div>
                
              </div>
            </>
          )}
        </div>

        {/* User Block with perfect alignment */}
        <div 
          onClick={() => setActiveTab("profile")}
          className="flex items-center gap-3 pl-4.5 border-l border-emerald-800/40 cursor-pointer group select-none"
          title="Meu Perfil"
        >
          <div className="size-10.5 rounded-full border border-emerald-900/40 overflow-hidden flex items-center justify-center p-0.5 bg-emerald-950/20 group-hover:border-emerald-400 transition-all shadow-sm shrink-0">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover rounded-full" />
            ) : (
              <UserCircle size={22} className="text-emerald-100" />
            )}
          </div>
          
          <div className="flex flex-col text-left hidden sm:flex">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-black text-white group-hover:text-emerald-300 transition-colors leading-tight">
                {profile?.full_name || "Membro Cedro"}
              </p>
              {isCurrentUserAdmin && (
                <span className="text-[8px] font-black bg-emerald-800/30 border border-emerald-600/30 text-emerald-200 px-1.5 py-0.5 rounded uppercase font-sans shrink-0 leading-none">
                  ADMIN
                </span>
              )}
            </div>
            <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider mt-0.5">
              {profile?.cargo || ""}
            </p>
          </div>
          
          <ChevronDown size={14} className="text-emerald-200 group-hover:text-white transition-colors animate-fade-in" />
        </div>

      </div>
    </header>
  );
};
export default Topbar;
