/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { 
  Database,
  Clock, 
  CheckCircle2, 
  XCircle, 
  ShieldAlert, 
  Activity, 
  PlusCircle, 
  Sparkles,
  Calendar,
  AlertOctagon,
  Eye,
  FileSpreadsheet,
  Download
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { IARecord, StatusUso, Criticidade, ClassificacaoRisco, StatusAuditoria } from "../types";
import { 
  KPICard, 
  TableCard, 
  ActionCard, 
  StatusBadge,  
  RiskBadge 
} from "./DashboardComponents";

interface DashboardProps {
  records: IARecord[];
  onNavigate: (tab: string) => void;
  onView?: (record: IARecord) => void;
  isAdmin?: boolean;
  workflows?: any[];
  approvalConfig?: any;
  currentUserId?: string;
}

export default function Dashboard({ 
  records, 
  onNavigate, 
  onView,
  isAdmin, 
  workflows = [], 
  approvalConfig, 
  currentUserId 
}: DashboardProps) {
  
  // 1. SELECT INTERVAL STATE
  const [period, setPeriod] = useState<string>("30-days");

  // 2. PARSE AND CALCULATE REAL-TIME STATS
  const stats = useMemo(() => {
    const total = records.length;
    const aprovadas = records.filter(r => r.statusUso === StatusUso.APROVADO || r.statusUso === StatusUso.APROVADO_COM_RESTRICOES).length;
    const emAvaliacao = records.filter(r => r.statusUso === StatusUso.EM_AVALIACAO || r.statusUso === StatusUso.EM_TESTE_PILOTO).length;
    const negadas = records.filter(r => r.statusUso === StatusUso.NAO_APROVADO || r.statusUso === StatusUso.SUSPENSO).length;
    const dadosSensiveis = records.filter(r => r.usaDadosSensiveis === "Sim").length;

    return {
      total,
      aprovadas,
      emAvaliacao,
      negadas,
      dadosSensiveis
    };
  }, [records]);

  // 3. EXPORT EXCEL FUNCTION PRESERVING LOGIC
  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Inventário de IA Cedro");

    // Header styling configurations
    const bgBrandGreen = "075618";
    const whiteText = "FFFFFF";

    // Add corporate title bar
    worksheet.mergeCells("A1:F1");
    const titleCell = worksheet.getRow(1).getCell(1);
    titleCell.value = "MAPEAMENTO DE IA - LABORATÓRIO CEDRO";
    titleCell.font = { size: 14, bold: true, color: { argb: whiteText } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgBrandGreen } };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    worksheet.getRow(1).height = 40;

    worksheet.mergeCells("A2:F2");
    const subtitleCell = worksheet.getRow(2).getCell(1);
    subtitleCell.value = `Relatório gerado em: ${new Date().toLocaleString("pt-BR")} | Total de Sistemas: ${records.length}`;
    subtitleCell.font = { italic: true, color: { argb: "555555" }, size: 10 };
    subtitleCell.alignment = { horizontal: "center" };
    worksheet.getRow(2).height = 20;

    worksheet.addRow([]); // Blank row

    // Setup headers
    const headers = [
      { header: "ID", key: "id", width: 18 },
      { header: "NOME DA FERRAMENTA", key: "nome", width: 32 },
      { header: "UNIDADE / SETOR", key: "setor", width: 22 },
      { header: "STATUS", key: "status", width: 22 },
      { header: "RISCO RELEVADO", key: "risco", width: 22 },
      { header: "DATA DE CADASTRO", key: "data", width: 18 }
    ];

    const headerIndex = 4;
    const headerRow = worksheet.getRow(headerIndex);
    headerRow.values = headers.map(h => h.header);
    headerRow.height = 30;

    headerRow.eachCell((cell, colNum) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "EDF5EF" } }; // Light brand green bg
      cell.font = { color: { argb: "0B2D12" }, bold: true, size: 11 };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        top: { style: "thin", color: { argb: "D1E2D5" } },
        bottom: { style: "medium", color: { argb: "075618" } },
        left: { style: "thin", color: { argb: "D1E2D5" } },
        right: { style: "thin", color: { argb: "D1E2D5" } }
      };
      worksheet.getColumn(colNum).width = headers[colNum - 1].width;
    });

    // Populate data cells
    records.forEach(r => {
      const row = worksheet.addRow([
        r.id,
        r.nomeFerramenta,
        r.unidadeSetor,
        r.statusUso,
        r.criticidade ? r.criticidade.split(":")[0] : "Não avaliada",
        r.dataRegistro || r.createdAt?.slice(0, 10) || ""
      ]);

      row.height = 24;
      row.eachCell((cell, colNum) => {
        cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true, indent: 1 };
        cell.border = {
          bottom: { style: "thin", color: { argb: "E8E7E7" } },
          left: { style: "thin", color: { argb: "E8E7E7" } },
          right: { style: "thin", color: { argb: "E8E7E7" } }
        };

        // Custom cell colors for highlighting status or risk
        if (colNum === 4) {
          if (r.statusUso === StatusUso.APROVADO) {
            cell.font = { color: { argb: "10B981" }, bold: true }; // Green
          } else if (r.statusUso === StatusUso.NAO_APROVADO) {
            cell.font = { color: { argb: "EF4444" }, bold: true }; // Red
          } else {
            cell.font = { color: { argb: "F59E0B" }, bold: true }; // Yellow
          }
        }
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, `cedro_governança_ia_${new Date().getTime()}.xlsx`);
  };

  // 4. GENERATING TEMPORAL DATASOURCES (VISÃO GERAL DA GOVERNANÇA)
  // Dynamic temporal evolution based on records registration dates
  const evolutionData = useMemo(() => {
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    
    if (records.length === 0) {
      const now = new Date();
      return Array.from({ length: 6 }).map((_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        return {
          name: monthNames[d.getMonth()],
          "Total de IAs": 0
        };
      });
    }

    const now = new Date();
    const chartData = [];
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mIdx = d.getMonth();
      const year = d.getFullYear();
      
      const endOfMonth = new Date(year, mIdx + 1, 0, 23, 59, 59, 999);
      
      const totalCount = records.filter(r => {
        const dateStr = r.dataRegistro || r.createdAt;
        if (!dateStr) return true;
        const rDate = new Date(dateStr);
        return isNaN(rDate.getTime()) || rDate.getTime() <= endOfMonth.getTime();
      }).length;

      chartData.push({
        name: monthNames[mIdx],
        "Total de IAs": totalCount
      });
    }

    return chartData;
  }, [records]);

  // 5. DONUT CHART DATA (DISTRIBUIÇÃO POR STATUS)
  const donutData = useMemo(() => {
    return [
      { name: "Aprovadas", value: stats.aprovadas, color: "#10B981" }, // Emerald Green
      { name: "Em avaliação", value: stats.emAvaliacao, color: "#F59E0B" }, // Amber Orange
      { name: "Negadas", value: stats.negadas, color: "#EF4444" } // Rose Red
    ].filter(item => item.value >= 0);
  }, [stats]);

  // 7. FILTER PENDÊNCIAS PRIORITÁRIAS
  const priorityPedings = useMemo(() => {
    // Show maximum 5 priority items
    // First: "Em avaliação" status
    // Second: Critical or High Risk
    // Third: Active workflow in awaiting step
    return [...records]
      .sort((a, b) => {
        const aEval = a.statusUso === StatusUso.EM_AVALIACAO ? 2 : 0;
        const bEval = b.statusUso === StatusUso.EM_AVALIACAO ? 2 : 0;
        
        const aCrit = a.criticidade?.includes("ALTA") ? 1 : 0;
        const bCrit = b.criticidade?.includes("ALTA") ? 1 : 0;
        
        return (bEval + bCrit) - (aEval + aCrit);
      })
      .slice(0, 5);
  }, [records]);

  // 8. GENERATION OF NEXT ACTIONS (PRÓXIMAS AÇÕES CARD)
  const nextActions = useMemo(() => {
    const arr: any[] = [];
    
    // Parse pending workflows to assign action pieces
    workflows.forEach((wf, idx) => {
      if (wf.finalStatus === "pendente") {
        const correspondingRecord = records.find(r => r.id === wf.iaRecordId);
        if (correspondingRecord) {
          const currentStepItem = wf.steps?.find((s: any) => s.stepNumber === wf.currentStep);
          const roleAssigned = currentStepItem?.roleName || "Avaliador";

          arr.push({
            id: `wf-${wf.iaRecordId}`,
            type: "Fila de Aprovação",
            iaName: `${correspondingRecord.nomeFerramenta} (${roleAssigned})`,
            date: "Pendente",
            icon: <Clock size={16} className="text-amber-500 animate-pulse" />,
            action: () => onNavigate("approval_queue")
          });
        }
      }
    });

    // Fallbacks if list is sparse so UI looks beautiful and premium
    if (arr.length < 3) {
      arr.push({
        id: "act-inv",
        type: "Inventário Geral",
        iaName: "Mapear nova ferramenta integrada",
        date: "Rotina",
        icon: <PlusCircle size={16} className="text-[#075618]" />,
        action: () => onNavigate("new")
      });
      arr.push({
        id: "act-rev",
        type: "Conformidade LGPD",
        iaName: "Revisar uso de cookies e dados anônimos",
        date: "Semanal",
        icon: <Sparkles size={16} className="text-teal-500" />,
        action: () => onNavigate("inventory")
      });
    }

    return arr.slice(0, 3);
  }, [workflows, records, onNavigate]);

  return (
    <div className="space-y-8 pb-10 bg-transparent text-slate-800">
      
      {/* 1. KPIs ROW FOR THE TOP */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KPICard 
          label="Total de IAs" 
          value={stats.total} 
          comparison="vs. 30 dias" 
          icon={<Database size={16} />} 
          accentColor="slate" 
        />
        <KPICard 
          label="Em avaliação" 
          value={stats.emAvaliacao} 
          comparison="Pendentes de parecer" 
          icon={<Clock size={16} />} 
          accentColor="orange" 
        />
        <KPICard 
          label="Aprovadas" 
          value={stats.aprovadas} 
          comparison="Acesso autorizado" 
          icon={<CheckCircle2 size={16} />} 
          accentColor="green" 
        />
        <KPICard 
          label="Negadas" 
          value={stats.negadas} 
          comparison="Uso restrito" 
          icon={<XCircle size={16} />} 
          accentColor="red" 
        />
      </div>

      {/* 2. AREA GRAPHS MAIN CONTAINER (12 COLUMNS METRICS CHANNELS) */}
      <div className="grid grid-cols-12 gap-6">
        
        {/* BIG GRAPH: VISÃO GERAL DA GOVERNANÇA (8 COLUMNS DESKTOP) */}
        <div className="col-span-12 xl:col-span-8 bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wide">Visão geral da governança</h3>
            </div>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-600 text-xs px-3 py-1.5 rounded-lg outline-none cursor-pointer focus:border-[#075618] transition-all"
            >
              <option value="30-days">Últimos 30 dias</option>
              <option value="90-days">Últimos 90 dias</option>
              <option value="180-days">Histórico completo</option>
            </select>
          </div>

          <div className="h-68 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={evolutionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#075618" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#075618" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="name" 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: "600" }} 
                />
                <YAxis 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: "600" }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "#ffffff", 
                    border: "1px solid #f1f5f9", 
                    borderRadius: "12px", 
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05)",
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#1e293b"
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="Total de IAs" 
                  stroke="#075618" 
                  strokeWidth={2.5} 
                  fillOpacity={1} 
                  fill="url(#colorTotal)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* DONUT STATUS CARD (4 COLUMNS DESKTOP) */}
        <div className="col-span-12 xl:col-span-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wide mb-4">Distribuição por status</h3>

            <div className="h-44 w-full relative mb-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {donutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "#ffffff", 
                      border: "1px solid #f1f5f9", 
                      borderRadius: "8px", 
                      fontSize: "11px",
                      fontWeight: "bold",
                    }} 
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-black text-slate-800 tracking-tight">{stats.total}</span>
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Total</span>
              </div>
            </div>

            {/* LEGENDS ROW */}
            <div className="grid grid-cols-3 gap-2 py-3 border-t border-slate-50">
              {donutData.map((item, idx) => {
                const pct = stats.total ? Math.round((item.value / stats.total) * 100) : 0;
                return (
                  <div key={idx} className="flex flex-col items-center text-center">
                    <span className="text-[9px] font-black uppercase text-slate-400 truncate w-full flex items-center justify-center gap-1.5">
                      <span className="size-1.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                      {item.name}
                    </span>
                    <span className="text-sm font-black text-slate-800 mt-1">{item.value} <span className="text-[10px] font-bold text-slate-400">({pct}%)</span></span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>

      {/* 3. PRIORITIZED PENDINGS + ACTIONS GRID */}
      <div className="grid grid-cols-12 gap-6">
        
        {/* PENDÊNCIAS TABELA (8 COLUMNS DESKTOP) */}
        <div className="col-span-12 xl:col-span-8">
          <TableCard 
            title="Pendências prioritárias" 
            records={priorityPedings} 
            onNavigate={onNavigate} 
            onViewRecord={(rec) => {
              onViewRecord(rec);
            }} 
          />
        </div>

        {/* PRÓXIMAS AÇÕES (4 COLUMNS DESKTOP) */}
        <div className="col-span-12 xl:col-span-4 flex flex-col gap-6">
          {isAdmin && (
            <ActionCard 
              title="Próximas ações" 
              actions={nextActions} 
              onNavigate={onNavigate} 
            />
          )}
        </div>

      </div>



    </div>
  );

  // Helper inside click-to-view mechanism
  function onViewRecord(record: IARecord) {
    if (onView) {
      onView(record);
    } else {
      onNavigate("report");
    }
  }
}
