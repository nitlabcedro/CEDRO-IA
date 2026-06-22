/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { 
  TrendingUp, 
  ChevronRight, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  ShieldAlert, 
  Bell, 
  Calendar, 
  ArrowRight,
  Database,
  Info
} from "lucide-react";
import { IARecord, StatusUso, ClassificacaoRisco } from "../types";

// ==========================================
// 1. STATUS & RISK BADGES
// ==========================================

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  let bg = "bg-slate-50 text-slate-700 border-slate-200/60";
  let dot = "bg-slate-500";
  let label = status;

  const normalized = status?.toLowerCase() || "";

  if (normalized.includes("aprovado") && !normalized.includes("restri")) {
    bg = "bg-emerald-50 text-emerald-700 border-emerald-200/50";
    dot = "bg-emerald-600";
    label = "Aprovado";
  } else if (normalized.includes("restri")) {
    bg = "bg-teal-50 text-teal-700 border-teal-200/50";
    dot = "bg-teal-600";
    label = "Aprovado com Restrições";
  } else if (normalized.includes("avalia") || normalized.includes("pendente")) {
    bg = "bg-amber-50 text-amber-700 border-amber-200/50";
    dot = "bg-amber-600";
    label = "Em Avaliação";
  } else if (normalized.includes("piloto") || normalized.includes("teste")) {
    bg = "bg-indigo-50 text-indigo-700 border-indigo-200/50";
    dot = "bg-indigo-600";
    label = "Piloto / Teste";
  } else if (normalized.includes("negado") || normalized.includes("não aprovado") || normalized.includes("suspens")) {
    bg = "bg-rose-50 text-rose-700 border-rose-200/50";
    dot = "bg-rose-600";
    label = normalized.includes("suspens") ? "Suspenso" : "Não Aprovado";
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold tracking-wide ${bg}`}>
      <span className={`size-1.5 rounded-full ${dot}`}></span>
      {label}
    </span>
  );
};

interface RiskBadgeProps {
  risk: string;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ risk }) => {
  let bg = "bg-slate-50 text-slate-700 border-slate-200/60";
  let label = risk;

  const normalized = risk?.toLowerCase() || "";

  if (normalized.includes("baixo")) {
    bg = "bg-emerald-50 text-emerald-700 border-emerald-100";
    label = "Baixo Risco";
  } else if (normalized.includes("medio") || normalized.includes("médio")) {
    bg = "bg-amber-50 text-amber-700 border-amber-100";
    label = "Médio Risco";
  } else if (normalized.includes("alto")) {
    bg = "bg-rose-50 text-rose-700 border-rose-100 font-bold";
    label = "Alto Risco";
  } else if (normalized.includes("critico") || normalized.includes("crítico")) {
    bg = "bg-red-100 text-red-800 border-red-200 font-black";
    label = "Risco Crítico";
  } else {
    bg = "bg-slate-100 text-slate-600 border-slate-200";
    label = "Não Avaliado";
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md border text-[11px] font-bold uppercase tracking-wider ${bg}`}>
      {label}
    </span>
  );
};

// ==========================================
// 2. KPI CARD
// ==========================================

interface KPICardProps {
  label: string;
  value: number;
  comparison: string;
  icon: React.ReactNode;
  accentColor: "green" | "orange" | "red" | "amber" | "slate";
}

export const KPICard: React.FC<KPICardProps> = ({ label, value, comparison, icon, accentColor }) => {
  // Styles based on accent category
  const borderStyles = {
    green: "border-l-4 border-l-emerald-500",
    orange: "border-l-4 border-l-amber-500",
    red: "border-l-4 border-l-rose-500",
    amber: "border-l-4 border-l-yellow-600",
    slate: "border-l-4 border-l-slate-700",
  };

  const textStyles = {
    green: "text-emerald-700",
    orange: "text-amber-700",
    red: "text-rose-600",
    amber: "text-yellow-700",
    slate: "text-slate-800",
  };

  const iconBgStyles = {
    green: "bg-emerald-50 text-emerald-600",
    orange: "bg-amber-50 text-amber-600",
    red: "bg-rose-50 text-rose-600",
    amber: "bg-yellow-50 text-yellow-600",
    slate: "bg-slate-100 text-slate-600",
  };

  return (
    <div className={`bg-white p-4 px-5 rounded-xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.01)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:translate-y-[-1px] transition-all duration-300 relative overflow-hidden ${borderStyles[accentColor]}`}>
      <div className="flex justify-between items-center w-full">
        <div className="space-y-1">
          <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-[0.12em]">{label}</p>
          <h3 className={`text-2xl font-black tracking-tight ${textStyles[accentColor]} leading-none`}>
            {value.toString().padStart(2, "0")}
          </h3>
        </div>
        <div className={`p-1.5 rounded-lg transition-transform duration-300 shrink-0 ${iconBgStyles[accentColor]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 3. TABLE CARD (PENDÊNCIAS PRIORITÁRIAS)
// ==========================================

interface TableCardProps {
  title: string;
  subtitle?: string;
  records: IARecord[];
  onNavigate: (tab: string) => void;
  onViewRecord: (record: IARecord) => void;
}

export const TableCard: React.FC<TableCardProps> = ({ title, subtitle, records, onNavigate, onViewRecord }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] overflow-hidden flex flex-col h-full">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div>
          <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wide">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-400 font-medium mt-0.5">{subtitle}</p>}
        </div>
        <button 
          onClick={() => onNavigate("inventory")}
          className="text-[10px] text-[#075618] hover:text-[#075618]/80 px-3.5 py-1.5 bg-[#075618]/5 hover:bg-[#075618]/10 rounded-lg font-black tracking-wider uppercase transition-all duration-150 flex items-center gap-1 active:scale-95"
        >
          Ver Todas <ArrowRight size={12} />
        </button>
      </div>

      <div className="overflow-auto divide-y divide-slate-100 custom-scrollbar flex-1">
        {records.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <div className="inline-flex p-4 bg-emerald-50 rounded-full text-emerald-600 border border-emerald-100">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-slate-800 font-bold uppercase text-xs tracking-wider">Tudo em Conformidade!</p>
              <p className="text-[11px] text-slate-400">Nenhuma pendência prioritária aguardando ação.</p>
            </div>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/30 text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                <th className="px-6 py-4.5">ID / Nome</th>
                <th className="px-6 py-4.5">Setor</th>
                <th className="px-6 py-4.5 text-center">Risco</th>
                <th className="px-6 py-4.5">Status</th>
                <th className="px-6 py-4.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800 font-sans">
              {records.map((record) => (
                <tr key={record.id} className="hover:bg-slate-50/40 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-800 group-hover:text-[#075618] transition-colors">{record.nomeFerramenta}</span>
                      <span className="font-mono text-[10px] text-slate-400 mt-0.5">{record.id}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">
                    {record.unidadeSetor}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <RiskBadge risk={record.criticidade || "Não avaliado"} />
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={record.statusUso} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => onViewRecord(record)}
                      className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider bg-slate-100 hover:bg-[#075618] text-slate-600 hover:text-white rounded-lg border border-slate-200 hover:border-[#075618] transition-all duration-150 active:scale-95 cursor-pointer"
                    >
                      Analisar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 4. ACTION CARD (PRÓXIMAS AÇÕES)
// ==========================================

interface ActionItem {
  id: string;
  type: string;
  iaName: string;
  date: string;
  icon: React.ReactNode;
  action: () => void;
}

interface ActionCardProps {
  title: string;
  actions: ActionItem[];
  onNavigate: (tab: string) => void;
}

export const ActionCard: React.FC<ActionCardProps> = ({ title, actions, onNavigate }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] p-6 flex flex-col h-full justify-between">
      <div>
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-50">
          <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wide">{title}</h3>
          <span className="text-[9px] bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
            {actions.length} Ativas
          </span>
        </div>

        {actions.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <CheckCircle2 className="mx-auto text-emerald-300" size={24} />
            <p className="text-xs font-bold uppercase tracking-wider">Nenhuma ação pendente</p>
            <p className="text-[10px]">Parabéns, você está em dia com a governança.</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {actions.map((act) => (
              <div 
                key={act.id} 
                onClick={act.action}
                className="flex items-start gap-3 p-3 bg-slate-50/55 hover:bg-slate-50 border border-slate-100 hover:border-slate-200 rounded-xl transition-all duration-200 cursor-pointer group"
              >
                <div className="p-2.5 bg-white shadow-sm border border-slate-100 group-hover:border-[#075618]/20 group-hover:text-[#075618] rounded-xl text-slate-500 shrink-0 transition-all duration-200">
                  {act.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-[10px] font-extrabold uppercase text-[#075618] tracking-widest">{act.type}</span>
                    <span className="text-[9px] font-mono font-bold text-slate-400 shrink-0">{act.date}</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-800 truncate uppercase mt-0.5 group-hover:text-[#075618] transition-colors">{act.iaName}</h4>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button 
        onClick={() => onNavigate("approval_queue")}
        className="w-full mt-6 bg-[#075618] hover:bg-[#075618]/90 text-white font-black text-xs uppercase tracking-widest py-3 rounded-xl shadow-md cursor-pointer shadow-[#075618]/10 active:scale-95 transition-all flex items-center justify-center gap-1.5"
      >
        Filas de Aprovação <ChevronRight size={14} />
      </button>
    </div>
  );
};

// ==========================================
// 5. ALERT CARD (ALERTAS RECENTES)
// ==========================================

interface AlertItem {
  id: string;
  title: string;
  description: string;
  time: string;
  level: "high" | "medium" | "low";
}

interface AlertCardProps {
  title: string;
  alerts: AlertItem[];
  onNavigate: (tab: string) => void;
}

export const AlertCard: React.FC<AlertCardProps> = ({ title, alerts, onNavigate }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] p-6 h-full flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-50">
          <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wide flex items-center gap-2">
            <Bell size={14} className="text-amber-500" /> {title}
          </h3>
          <span className="text-[10px] font-bold text-slate-400">Tempo real</span>
        </div>

        {alerts.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <div className="size-10 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-500">
              <CheckCircle2 size={20} />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider">Sem alertas críticos</p>
            <p className="text-[10px]">O monitoramento não detectou desvios.</p>
          </div>
        ) : (
          <div className="space-y-3.5 max-h-[310px] overflow-y-auto pr-1">
            {alerts.map((al) => {
              const borderCol = al.level === "high" ? "border-l-rose-500 bg-rose-50/10" : al.level === "medium" ? "border-l-amber-500 bg-amber-50/10" : "border-l-slate-400 bg-slate-50/20";
              const dotCol = al.level === "high" ? "bg-rose-500" : al.level === "medium" ? "bg-amber-500" : "bg-slate-400";
              const textCol = al.level === "high" ? "text-rose-700" : al.level === "medium" ? "text-amber-700" : "text-slate-700";

              return (
                <div 
                  key={al.id} 
                  className={`p-3 rounded-xl border border-slate-100 border-l-4 ${borderCol} space-y-1`}
                >
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1.5">
                      <span className={`size-1.5 rounded-full ${dotCol}`}></span>
                      <span className={`text-[10px] font-extrabold uppercase tracking-wide ${textCol}`}>{al.title}</span>
                    </span>
                    <span className="text-[9px] font-mono text-slate-400">{al.time}</span>
                  </div>
                  <p className="text-xs text-slate-600 font-sans font-medium leading-relaxed leading-snug">{al.description}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button 
        onClick={() => onNavigate("inventory")}
        className="w-full mt-6 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 font-black text-xs uppercase tracking-widest py-3 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
      >
        Auditar Inventário <ArrowRight size={14} />
      </button>
    </div>
  );
};
