/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { CustomDropdown } from "./CustomDropdown";
import { 
  Users, 
  ChevronRight, 
  User, 
  ShieldCheck, 
  Clock, 
  X, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  SlidersHorizontal,
  Award,
  Lock,
  Eye,
  FileText,
  AlertCircle
} from "lucide-react";
import { IARecord, UserProfile, StatusAuditoria } from "../types";
import { motion, AnimatePresence } from "framer-motion";

interface SectorMapProps {
  records: IARecord[];
  profiles: UserProfile[];
}

const hasUsefulValue = (value?: unknown) => {
  const text = String(value ?? "").trim();

  if (!text) return false;

  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const uselessValues = [
    "nao informado",
    "nao preenchido",
    "nao preenchido na solicitacao",
    "nao se aplica",
    "nenhum",
    "nenhuma",
    "outro",
    "sim",
    "nao"
  ];

  return !uselessValues.includes(normalized);
};

const getCleanLastOpinion = (rawComment?: string) => {
  if (!rawComment) return "Parecer não informado pelo avaliador.";

  let text = String(rawComment).trim();

  const parecerMatch = text.match(/Parecer:\s*([\s\S]*)/i);

  if (parecerMatch?.[1]) {
    text = parecerMatch[1].trim();
  }

  text = text
    .replace(/^[“"]+|[”"]+$/g, "")
    .replace(/\s+—\s*por[\s\S]*$/i, "")
    .replace(/\s+-\s*por[\s\S]*$/i, "")
    .trim();

  if (!text) return "Parecer não informado pelo avaliador.";

  return text;
};

export default function SectorMap({ records, profiles }: SectorMapProps) {
  const [selectedIA, setSelectedIA] = useState<IARecord | null>(null);
  const [expandedSectors, setExpandedSectors] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Aprovado" | "Pendente" | "Negado">("All");
  const [riskFilter, setRiskFilter] = useState<"All" | "Baixo" | "Médio" | "Alto">("All");
  const [orderBy, setOrderBy] = useState<"volume" | "az" | "pending">("volume");
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const toggleSector = (sector: string) => {
    setExpandedSectors(prev => {
      const next = new Set(prev);
      if (next.has(sector)) next.delete(sector);
      else next.add(sector);
      return next;
    });
  };

  // Overall Inventory Stats (Calculated from baseline records for compliance oversight)
  const statsOverview = useMemo(() => {
    const sectorsSet = new Set(records.map(r => r.unidadeSetor || "Não Informado"));
    const approved = records.filter(r => r.statusAuditoria === StatusAuditoria.APROVADO).length;
    const pending = records.filter(r => r.statusAuditoria === StatusAuditoria.PENDENTE).length;
    
    return {
      totalSectors: sectorsSet.size,
      totalSolutions: records.length,
      approvedSolutions: approved,
      pendingSolutions: pending
    };
  }, [records]);

  // Search, Status and Risk Filter logic
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const searchLower = searchTerm.toLowerCase().trim();
      const matchesSearch = !searchLower || 
        (r.nomeFerramenta && r.nomeFerramenta.toLowerCase().includes(searchLower)) ||
        (r.unidadeSetor && r.unidadeSetor.toLowerCase().includes(searchLower)) ||
        (r.responsavelPreenchimento && r.responsavelPreenchimento.toLowerCase().includes(searchLower)) ||
        (r.fornecedor && r.fornecedor.toLowerCase().includes(searchLower));

      const matchesStatus = statusFilter === "All" || r.statusAuditoria === statusFilter;
      const matchesRisk = riskFilter === "All" || r.riscoResidual === riskFilter;

      return matchesSearch && matchesStatus && matchesRisk;
    });
  }, [records, searchTerm, statusFilter, riskFilter]);

  // Group records by sector after application of filters
  const sectorGroups = useMemo(() => {
    const groups: Record<string, {
      sector: string;
      records: IARecord[];
      totalIAs: number;
      authorizedCount: number;
      pendingCount: number;
      users: Set<string>;
    }> = {};

    filteredRecords.forEach(r => {
      const sector = r.unidadeSetor || "Não Informado";
      if (!groups[sector]) {
        groups[sector] = {
          sector,
          records: [],
          totalIAs: 0,
          authorizedCount: 0,
          pendingCount: 0,
          users: new Set(),
        };
      }
      
      groups[sector].records.push(r);
      groups[sector].totalIAs++;
      if (r.statusAuditoria === StatusAuditoria.APROVADO) groups[sector].authorizedCount++;
      if (r.statusAuditoria === StatusAuditoria.PENDENTE) groups[sector].pendingCount++;
      if (r.responsavelPreenchimento) groups[sector].users.add(r.responsavelPreenchimento);
    });

    const list = Object.values(groups);

    // Apply Sorting Options
    if (orderBy === "volume") {
      list.sort((a, b) => b.totalIAs - a.totalIAs);
    } else if (orderBy === "az") {
      list.sort((a, b) => a.sector.localeCompare(b.sector));
    } else if (orderBy === "pending") {
      list.sort((a, b) => b.pendingCount - a.pendingCount);
    }

    return list;
  }, [filteredRecords, orderBy]);

  // Dynamic recommendations for custom compliance GRC panel
  const getComplianceRecommendations = (ia: IARecord) => {
    const recs: string[] = [];
    
    if (ia.riscoResidual === "Alto") {
      recs.push("Exigir emissão regular de Relatório de Impacto à Proteção de Dados (RIPD).");
      recs.push("Forçar criptografia avançada de fluxo nos servidores de inteligência.");
      recs.push("Impor auditoria semestral de logs de auditoria das decisões computacionais.");
    } else if (ia.riscoResidual === "Médio") {
      recs.push("Recomendar revisão anual nas matrizes de acesso de usuários.");
      recs.push("Promover reciclagem anual opcional para os validadores humanos.");
    } else {
      recs.push("Atividade em conformidade habitual com monitoração de rotina.");
    }

    if (ia.usaDadosPessoais === "Sim" || ia.usaDadosSensiveis === "Sim") {
      recs.push("Fator de risco de privacidade detectado: garantir que termos de uso respeitem a LGPD de forma explícita.");
    }

    if (ia.validacaoHumana === "Não") {
      recs.push("Ausência de validação humana: estruturar barreira de validação pré-faturamento.");
    }

    return recs;
  };

  const showTempFeedback = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => {
      setActionFeedback(null);
    }, 4000);
  };

  // Animation variants
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemAnimation = {
    hidden: { opacity: 0, scale: 0.985, y: 8 },
    show: { 
      opacity: 1, 
      scale: 1, 
      y: 0,
      transition: {
        duration: 0.45,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  return (
    <div className="space-y-6 pb-16 font-sans">
      
      {/* 1. CABEÇALHO DA PÁGINA */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Mapa de IAs por setor
          </h1>
        </div>

        {/* Indicadores Compactos */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 min-w-[100px] text-left">
            <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-tight block">Frentes</span>
            <span className="text-base font-bold text-slate-800">{statsOverview.totalSectors} áreas</span>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 min-w-[105px] text-left">
            <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-tight block">Soluções</span>
            <span className="text-base font-bold text-slate-800">{statsOverview.totalSolutions} cadastradas</span>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 min-w-[100px] text-left">
            <span className="text-[9px] font-semibold text-emerald-700 uppercase tracking-tight block">Aprovadas</span>
            <span className="text-base font-bold text-emerald-800">{statsOverview.approvedSolutions}</span>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 min-w-[100px] text-left">
            <span className="text-[9px] font-semibold text-amber-700 uppercase tracking-tight block">Pendentes</span>
            <span className="text-base font-bold text-amber-800">{statsOverview.pendingSolutions}</span>
          </div>
        </div>
      </div>

      {/* 2. BARRA DE FILTROS */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-200 shadow-xs">
        {/* Campo de pesquisa */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            type="text"
            placeholder="Buscar IA, setor ou responsável..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 outline-none text-slate-800 focus:border-[#03440c] transition-all shadow-inner"
          />
        </div>

        {/* Filtros em linha */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 z-30">
            <SlidersHorizontal size={12} className="text-slate-400" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Status:</span>
            <CustomDropdown
              value={statusFilter}
              onChange={(val) => setStatusFilter(val as any)}
              options={[
                { value: "All", label: "Todos" },
                { value: "Aprovado", label: "Aprovadas" },
                { value: "Pendente", label: "Pendentes" },
                { value: "Negado", label: "Negadas" }
              ]}
              size="sm"
              className="w-28"
            />
          </div>

          {/* Risk Level Filter */}
          <div className="flex items-center gap-1.5 z-20">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Risco:</span>
            <CustomDropdown
              value={riskFilter}
              onChange={(val) => setRiskFilter(val as any)}
              options={[
                { value: "All", label: "Todos" },
                { value: "Baixo", label: "Baixo" },
                { value: "Médio", label: "Médio" },
                { value: "Alto", label: "Alto" }
              ]}
              size="sm"
              className="w-28"
            />
          </div>

          {/* Ordering Options */}
          <div className="flex items-center gap-1.5 z-10">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Ordenação:</span>
            <CustomDropdown
              value={orderBy}
              onChange={(val) => setOrderBy(val as any)}
              options={[
                { value: "volume", label: "Maior volume" },
                { value: "az", label: "A-Z Setor" },
                { value: "pending", label: "Mais pendentes" }
              ]}
              size="sm"
              className="w-36"
            />
          </div>
        </div>
      </div>

      {/* 3. GRID DOS CARDS DOS SETORES */}
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        {sectorGroups.map((group, idx) => {
          const approvedPercent = group.totalIAs > 0 ? (group.authorizedCount / group.totalIAs) * 100 : 0;
          const pendingPercent = group.totalIAs > 0 ? (group.pendingCount / group.totalIAs) * 100 : 0;

          // Expand logic
          const hasMultiple = group.totalIAs > 2;
          const isExpanded = expandedSectors.has(group.sector);
          const visibleRecords = isExpanded ? group.records : group.records.slice(0, 2);

          return (
            <motion.div 
              key={idx} 
              variants={itemAnimation}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:shadow-sm hover:border-slate-300 transition-all flex flex-col space-y-4"
            >
              {/* Card Header Info */}
              <div className="flex justify-between items-start">
                <div className="space-y-0.5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Unidade Setor</span>
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight leading-none">
                    {group.sector}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold text-slate-800">{group.totalIAs}</span>
                  <span className="text-[9px] font-semibold text-slate-400 block -mt-1 uppercase">Soluções</span>
                </div>
              </div>

              {/* Progress and status indicators */}
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500">
                  <span className="flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-emerald-600 block"></span> Aprovadas: {group.authorizedCount}
                  </span>
                  <span className="flex items-center gap-1 py-px">
                    <span className="size-1.5 rounded-full bg-amber-500 block"></span> Pendentes: {group.pendingCount}
                  </span>
                  <span className="text-slate-400 font-medium">
                    Responsáveis: {group.users.size}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="h-1.5 w-full bg-slate-200/60 rounded-full overflow-hidden flex gap-0.5">
                  {group.authorizedCount > 0 && (
                    <div style={{ width: `${approvedPercent}%` }} className="bg-emerald-600 h-full" title={`Aprovadas: ${group.authorizedCount}`} />
                  )}
                  {group.pendingCount > 0 && (
                    <div style={{ width: `${pendingPercent}%` }} className="bg-amber-500 h-full" title={`Pendentes: ${group.pendingCount}`} />
                  )}
                  {group.totalIAs - group.authorizedCount - group.pendingCount > 0 && (
                    <div style={{ width: `${100 - approvedPercent - pendingPercent}%` }} className="bg-slate-350 h-full" title="Negado/Outros" />
                  )}
                </div>
              </div>

              {/* List of Solution Items */}
              <div className="space-y-2.5">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Soluções cadastradas</p>
                
                <div className="divide-y divide-slate-100 border-t border-slate-100">
                  {visibleRecords.map((r, i) => (
                    <div 
                      key={i} 
                      onClick={() => setSelectedIA(r)}
                      className="flex items-center justify-between py-2 text-xs group/ia hover:bg-slate-50/50 rounded-lg px-2 -mx-2 transition-all cursor-pointer"
                    >
                      <div className="min-w-0 pr-3 space-y-0.5">
                        <p className="font-bold text-slate-800 uppercase truncate group-hover/ia:text-[#03440c] transition-colors">
                          {r.nomeFerramenta}
                        </p>
                        <p className="text-[10px] text-slate-450 truncate flex items-center gap-1">
                          <User size={10} className="text-slate-400" /> {r.responsavelPreenchimento}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Status Badge */}
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded tracking-wide uppercase ${
                          r.statusAuditoria === "Aprovado" ? "bg-emerald-50 text-emerald-700 border border-emerald-150" :
                          r.statusAuditoria === "Negado" ? "bg-red-50 text-red-700 border border-red-150" :
                          "bg-amber-50 text-amber-700 border border-amber-150"
                        }`}>
                          {r.statusAuditoria || "Pendente"}
                        </span>

                        {/* Risco Badge */}
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded tracking-wide uppercase ${
                          r.riscoResidual === "Alto" ? "bg-red-50 text-red-700 border border-red-150" :
                          r.riscoResidual === "Médio" ? "bg-amber-50 text-amber-700 border border-amber-150" :
                          "bg-emerald-50 text-emerald-700 border border-emerald-150"
                        }`}>
                          {r.riscoResidual || "Baixo"}
                        </span>

                        <ChevronRight size={12} className="text-slate-400 opacity-0 group-hover/ia:opacity-100 transition-opacity translate-x-1" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Expansion Action controls */}
              {hasMultiple && (
                <button 
                  onClick={() => toggleSector(group.sector)}
                  className="text-[10px] font-bold text-[#03440c] hover:text-[#02330a] flex items-center gap-1 cursor-pointer pt-1 self-start transition-colors"
                >
                  {isExpanded ? "Recolher" : `Ver todas as ${group.totalIAs} soluções`}
                  <ChevronRight size={12} className={`transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                </button>
              )}
            </motion.div>
          );
        })}

        {sectorGroups.length === 0 && (
          <div className="col-span-2 py-16 text-center bg-white border border-dashed border-slate-200 rounded-2xl space-y-2">
            <AlertCircle className="size-8 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-700">Nenhuma solução localizada</h3>
            <p className="text-xs text-slate-400">Verifique os filtros de busca, status ou criticidade.</p>
          </div>
        )}
      </motion.div>

      {/* 4. MODAL DE DETALHES - FICHA DA IA DE GOVERNANÇA */}
      <AnimatePresence>
        {selectedIA && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop filter */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedIA(null)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            />
            
            {/* Content Box */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              className="relative w-full max-w-3xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-4 shrink-0">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[9px] font-semibold text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded">
                      {selectedIA.id}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Ficha de Governança corporativa
                    </span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wide border ${
                      selectedIA.statusAuditoria === "Aprovado" 
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                      : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}>
                      {selectedIA.statusAuditoria || "Pendente"}
                    </span>
                    {selectedIA.unidadeSetor && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded uppercase bg-slate-100 text-slate-600 border border-slate-200">
                        {selectedIA.unidadeSetor}
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 uppercase mt-1 tracking-tight">
                    {selectedIA.nomeFerramenta}
                  </h2>
                </div>

                <button 
                  onClick={() => setSelectedIA(null)}
                  className="size-10 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Content Body - 2 Columns Bento Grid list */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1 min-h-[300px]">
                
                {/* Temporary feedback banner */}
                {actionFeedback && (
                  <div className="p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-xs flex items-center gap-2 animate-fade-in">
                    <CheckCircle2 size={14} />
                    <span>{actionFeedback}</span>
                  </div>
                )}

                {(() => {
                  const lastParecer = selectedIA.historico?.find(
                    item => item.action && 
                    !item.action.includes("Criação") && 
                    !item.action.includes("Cadastro") &&
                    !item.action.includes("Atualização")
                  );

                  const getTipoIAText = () => {
                    const parts = [];
                    if (selectedIA.tipoIA && selectedIA.tipoIA.length > 0) {
                      parts.push(...selectedIA.tipoIA);
                    }
                    if (selectedIA.tipoIAOutro) {
                      parts.push(selectedIA.tipoIAOutro);
                    }
                    return parts.join(", ");
                  };

                  const getPrivacySummary = () => {
                    const parts = [];
                    if (selectedIA.usaDadosPessoais === "Sim") parts.push("Dados Pessoais");
                    if (selectedIA.usaDadosSensiveis === "Sim") parts.push("Dados Sensíveis");
                    
                    let summary = parts.length > 0 ? parts.join(" e ") : "";
                    if (hasUsefulValue(selectedIA.quaisDados)) {
                      if (summary) {
                        summary += ` (${selectedIA.quaisDados})`;
                      } else {
                        summary = selectedIA.quaisDados;
                      }
                    }
                    return summary || "Sem dados pessoais";
                  };

                  return (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Seção 1: Identificação */}
                        <div className="space-y-3">
                          <h3 className="text-xs font-bold text-slate-850 uppercase tracking-wide border-l-2 border-[#03440c] pl-2 block">
                            1. Identificação
                          </h3>
                          <div className="bg-slate-50 border border-slate-155 rounded-xl p-4 space-y-3.5">
                            {hasUsefulValue(selectedIA.responsavelPreenchimento) && (
                              <div>
                                <p className="text-[9px] font-bold text-slate-450 uppercase">Solicitante</p>
                                <p className="text-xs font-bold text-slate-700">{selectedIA.responsavelPreenchimento}</p>
                              </div>
                            )}
                            {hasUsefulValue(selectedIA.cargo) && (
                              <div>
                                <p className="text-[9px] font-bold text-slate-450 uppercase">Cargo</p>
                                <p className="text-xs font-semibold text-slate-600">{selectedIA.cargo}</p>
                              </div>
                            )}
                            {hasUsefulValue(selectedIA.fornecedor) && (
                              <div>
                                <p className="text-[9px] font-bold text-slate-450 uppercase">Fornecedor / Desenvolvedor</p>
                                <p className="text-xs font-semibold text-slate-700">{selectedIA.fornecedor}</p>
                              </div>
                            )}
                            {(() => {
                              const iaText = getTipoIAText();
                              if (hasUsefulValue(iaText)) {
                                return (
                                  <div>
                                    <p className="text-[9px] font-bold text-slate-450 uppercase">Tipo de IA / Tecnologia</p>
                                    <p className="text-xs font-semibold text-slate-700">{iaText}</p>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>

                        {/* Seção 2: Finalidade */}
                        <div className="space-y-3 flex flex-col">
                          <h3 className="text-xs font-bold text-slate-850 uppercase tracking-wide border-l-2 border-[#03440c] pl-2 block">
                            2. Finalidade e Operação
                          </h3>
                          <div className="bg-slate-50 border border-slate-155 rounded-xl p-4 space-y-3.5 flex-1 flex flex-col justify-between">
                            <div className="space-y-3">
                              {hasUsefulValue(selectedIA.descricaoAtividade) && (
                                <div>
                                  <p className="text-[9px] font-bold text-slate-450 uppercase">Objetivo / Finalidade</p>
                                  <p className="text-xs text-slate-650 leading-relaxed text-slate-700">
                                    {selectedIA.descricaoAtividade}
                                  </p>
                                </div>
                              )}
                              {(() => {
                                const processText = selectedIA.etapaOutro || selectedIA.etapaProcesso;
                                if (hasUsefulValue(processText)) {
                                  return (
                                    <div>
                                      <p className="text-[9px] font-bold text-slate-450 uppercase">Processo impactado</p>
                                      <p className="text-xs font-bold text-slate-700">{processText}</p>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                              {hasUsefulValue(selectedIA.beneficiosEsperados) && (
                                <div>
                                  <p className="text-[9px] font-bold text-slate-450 uppercase">Benefício esperado</p>
                                  <p className="text-xs text-slate-650 leading-relaxed text-slate-700">
                                    {selectedIA.beneficiosEsperados}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Seção 3: Governança */}
                      <div className="space-y-3">
                        <h3 className="text-xs font-bold text-slate-850 uppercase tracking-wide border-l-2 border-[#03440c] pl-2 block">
                          3. Parâmetros de Governança
                        </h3>
                        <div className="bg-slate-50 border border-slate-155 rounded-xl p-4 space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {hasUsefulValue(selectedIA.criticidade) && (
                              <div className="space-y-0.5">
                                <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1">
                                  <Award size={10} className="text-slate-500" /> Criticidade
                                </span>
                                <span className="inline-block text-xs font-bold text-slate-700 uppercase">
                                  {selectedIA.criticidade ? selectedIA.criticidade.split(":")[0] : "Baixa"}
                                </span>
                              </div>
                            )}

                            {(() => {
                              const privacySummary = getPrivacySummary();
                              if (hasUsefulValue(privacySummary)) {
                                return (
                                  <div className="space-y-0.5">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1">
                                      <Lock size={10} className="text-slate-500" /> Privacidade / Tipo de Dado
                                    </span>
                                    <span className="inline-block text-xs font-bold text-slate-700 uppercase">
                                      {privacySummary}
                                    </span>
                                  </div>
                                );
                              }
                              return null;
                            })()}

                            {hasUsefulValue(selectedIA.statusUso) && (
                              <div className="space-y-0.5">
                                <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1">
                                  <Clock size={10} className="text-slate-500" /> Etapa atual do fluxo
                                </span>
                                <span className="inline-block text-xs font-bold text-[#03440c] uppercase">
                                  {selectedIA.statusUso}
                                </span>
                              </div>
                            )}
                          </div>

                          {lastParecer && (
                            <div className="border-t border-slate-200/80 pt-3">
                              <p className="text-[10px] font-black uppercase tracking-wider text-[#03440c] mb-1.5 flex items-center gap-1.5">
                                <CheckCircle2 size={12} className="text-[#03440c]" /> Último parecer
                              </p>
                              <p className="text-xs text-slate-700 italic leading-relaxed bg-white border border-slate-100 rounded-xl p-3 shadow-3xs">
                                &ldquo;{getCleanLastOpinion(lastParecer.message || lastParecer.action)}&rdquo;
                              </p>
                              {lastParecer.user && (
                                <p className="text-[10px] text-slate-450 font-semibold mt-1 text-right">
                                  — por {lastParecer.user} em {new Date(lastParecer.date).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Seção 4: Registro de Datas */}
                      {(selectedIA.createdAt || selectedIA.updatedAt) && (
                        <div className="flex gap-4 border-t border-slate-100 pt-3 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          {selectedIA.createdAt && (
                            <span>Criado em: {new Date(selectedIA.createdAt).toLocaleDateString()}</span>
                          )}
                          {selectedIA.updatedAt && (
                            <span>Atualizado em: {new Date(selectedIA.updatedAt).toLocaleDateString()}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Seção 4: Recomendações Técnicas de Compliance baseadas nos riscos */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide border-l-2 border-[#03440c] pl-2 block">
                    4. Recomendações e Plano de Mitigação GRC
                  </h3>
                  
                  <div className="border border-slate-200 bg-white rounded-xl overflow-hidden divide-y divide-slate-100">
                    {getComplianceRecommendations(selectedIA).map((rec, i) => (
                      <div key={i} className="p-3 text-[11px] text-slate-600 flex items-start gap-2.5 bg-slate-50/20">
                        <div className="size-1.5 rounded-full bg-emerald-600 mt-1 shrink-0" />
                        <span className="leading-relaxed">{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-wrap gap-2 items-center justify-between shrink-0">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      showTempFeedback("Ficha de Governança preparada para exportação PDF (Simulado).");
                    }}
                    className="bg-[#03440c] hover:bg-[#02330a] text-white text-xs font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText size={14} /> Ver relatório
                  </button>
                  <button 
                    onClick={() => {
                      showTempFeedback("Encaminhando solicitação de edição para o painel do inventário.");
                    }}
                    className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-250 text-xs font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer"
                  >
                    Editar cadastro
                  </button>
                </div>

                <button 
                  onClick={() => setSelectedIA(null)}
                  className="bg-slate-200 hover:bg-slate-350 text-slate-700 font-semibold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer"
                >
                  Fechar
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
    </div>
  );
}
