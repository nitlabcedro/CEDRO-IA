/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Filter, Eye, Edit, Trash2, ArrowUpDown, AlertTriangle, CheckCircle2, PlusCircle, Database, FileSpreadsheet, ChevronLeft, ChevronRight, RotateCcw, ShieldAlert, ClipboardList } from "lucide-react";
import { IARecord, StatusUso, Criticidade, ClassificacaoRisco, StatusAuditoria, ApprovalWorkflow } from "../types";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

interface InventoryProps {
  records: IARecord[];
  onEdit: (record: IARecord) => void;
  onView: (record: IARecord) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  onRefresh: () => void;
  isAdmin?: boolean;
  approvalConfig?: any;
  onSaveApprovalConfig?: any;
  workflows?: ApprovalWorkflow[];
  currentUser?: any;
  currentUserProfile?: any;
  onCancelRequest?: (id: string) => Promise<void>;
}

export default function Inventory({ 
  records, 
  onEdit, 
  onView, 
  onDelete, 
  onAdd, 
  onRefresh, 
  isAdmin, 
  approvalConfig, 
  workflows,
  currentUser,
  currentUserProfile,
  onCancelRequest
}: InventoryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSetor, setFilterSetor] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterRisco, setFilterRisco] = useState("");
  const [filterDadosSensiveis, setFilterDadosSensiveis] = useState("");
  const [sortField, setSortField] = useState<keyof IARecord | "">("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  
  // Cancel State
  const [cancelTargetRecord, setCancelTargetRecord] = useState<IARecord | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const isRequester = (record: IARecord) => {
    if (!currentUser) return false;

    // 1. Se existir ownerId (ou userId ou createdBy como fallback), comparar com currentUser.id
    const recordOwnerId = record.ownerId || (record as any).userId || (record as any).createdBy;
    if (recordOwnerId) {
      return String(recordOwnerId) === String(currentUser.id);
    }

    // 2. Se não existir, comparar e-mail do usuário logado com o e-mail/contato da solicitação
    const userEmail = currentUser.email?.toLowerCase().trim();
    if (userEmail) {
      const contatoLower = (record.contato || "").toLowerCase().trim();
      const emailSolicitanteLower = (record as any).emailSolicitante?.toLowerCase().trim();
      
      if (contatoLower.includes(userEmail) || (emailSolicitanteLower && emailSolicitanteLower === userEmail)) {
        return true;
      }
    }

    // 3. Se não houver e-mail, comparar nome normalizado do perfil logado com responsavelPreenchimento, apenas como fallback
    const userName = currentUserProfile?.full_name || "";
    const respName = record.responsavelPreenchimento || "";
    
    if (userName && respName) {
      const normalize = (str: string) => 
        str.normalize("NFD")
           .replace(/[\u0300-\u036f]/g, "")
           .toLowerCase()
           .replace(/[^a-z0-9]/g, "")
           .trim();
      return normalize(userName) === normalize(respName);
    }

    return false;
  };

  const canCancel = (record: IARecord) => {
    // 1. O usuário logado for o responsável/solicitante da IA
    const isOwner = isRequester(record);
    const isUserAllowed = isOwner || isAdmin;

    if (!isUserAllowed) return false;

    // 2. A solicitação ainda não estiver finalizada e o status não for nenhum dos finais:
    const statusLower = (record.statusUso || "").toLowerCase().trim();
    const statusAuditoriaLower = (record.statusAuditoria || "").toLowerCase().trim();

    const isFinalStatus = 
      statusLower === "aprovado" || 
      statusLower === "não aprovado" || 
      statusLower === "negado" || 
      statusLower === "cancelada" || 
      statusLower === "cancelada pelo solicitante" ||
      statusAuditoriaLower === "aprovado" ||
      statusAuditoriaLower === "negado";

    return !isFinalStatus;
  };
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Calculate high-level KPIs based on all unfiltered records (the whole database)
  const totalIAs = records.length;
  const emAvaliacaoCount = records.filter(r => r.statusUso === StatusUso.EM_AVALIACAO).length;
  const altoRiscoCount = records.filter(
    r => r.classificacaoRiscoManual === ClassificacaoRisco.ALTO || r.classificacaoRiscoManual === ClassificacaoRisco.CRITICO
  ).length;
  const comDadosSensiveisCount = records.filter(
    r => r.usaDadosSensiveis && (r.usaDadosSensiveis.toLowerCase().trim() === "sim" || r.usaDadosSensiveis.toLowerCase().trim() === "s")
  ).length;

  // Get unique sectors for filter
  const sectors = useMemo(() => {
    const allSectors = Array.from(new Set(records.map(r => r.unidadeSetor).filter(Boolean)));
    return allSectors;
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        r.nomeFerramenta.toLowerCase().includes(searchLower) ||
        r.fornecedor.toLowerCase().includes(searchLower) ||
        r.id.toLowerCase().includes(searchLower) ||
        (r.unidadeSetor && r.unidadeSetor.toLowerCase().includes(searchLower)) ||
        (r.classificacaoRiscoManual && r.classificacaoRiscoManual.toLowerCase().includes(searchLower)) ||
        (r.statusUso && r.statusUso.toLowerCase().includes(searchLower)) ||
        (r.usaDadosSensiveis && r.usaDadosSensiveis.toLowerCase().includes(searchLower));
      
      const matchesSetor = !filterSetor || r.unidadeSetor === filterSetor;
      const matchesStatus = !filterStatus || r.statusUso === filterStatus;
      const matchesRisco = !filterRisco || r.classificacaoRiscoManual === filterRisco;
      const matchesSensiveis = !filterDadosSensiveis || r.usaDadosSensiveis === filterDadosSensiveis;

      return matchesSearch && matchesSetor && matchesStatus && matchesRisco && matchesSensiveis;
    }).sort((a, b) => {
      if (!sortField) return 0;
      const valA = a[sortField];
      const valB = b[sortField];
      
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDirection === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return 0;
    });
  }, [records, searchTerm, filterSetor, filterStatus, filterRisco, filterDadosSensiveis, sortField, sortDirection]);

  // Paginated visible chunk of filters
  const paginatedRecords = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return filteredRecords.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredRecords, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage) || 1;

  const handleSort = (field: keyof IARecord) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const exportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Inventário IA Cedro");

    // Header stylings
    const brandGreen = "00C875";
    const labDark = "0F172A";

    // Add Title and Metadata
    worksheet.mergeCells('A1:H1');
    const titleCell = worksheet.getRow(1).getCell(1);
    titleCell.value = "LABORATÓRIO CEDRO - INVENTÁRIO DE INTELIGÊNCIA ARTIFICIAL";
    titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: labDark } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 40;

    worksheet.mergeCells('A2:H2');
    const subTitleRow = worksheet.getRow(2);
    subTitleRow.getCell(1).value = `Relatório gerado em: ${new Date().toLocaleString('pt-BR')}`;
    subTitleRow.getCell(1).font = { italic: true, color: { argb: '64748B' } };
    subTitleRow.getCell(1).alignment = { horizontal: 'center' };
    subTitleRow.height = 20;

    // Blank row
    worksheet.addRow([]);

    // Set columns headers (now on row 4)
    const headerRowIndex = 4;
    const columns = [
      { header: "ID", key: "id", width: 18 },
      { header: "NOME DA FERRAMENTA", key: "nome", width: 35 },
      { header: "FORNECEDOR", key: "fornecedor", width: 25 },
      { header: "SETOR", key: "setor", width: 25 },
      { header: "STATUS", key: "status", width: 22 },
      { header: "CLASSIFICAÇÃO RISCO", key: "risco", width: 25 },
      { header: "DADOS SENSÍVEIS", key: "dados_sensiveis", width: 18 },
      { header: "DATA DE REGISTRO", key: "data", width: 20 },
    ];

    const headerRow = worksheet.getRow(headerRowIndex);
    headerRow.values = columns.map(c => c.header);
    headerRow.height = 35;
    
    headerRow.eachCell((cell, colNumber) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: brandGreen }
      };
      cell.font = {
        color: { argb: '000000' },
        bold: true,
        size: 11
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'medium' },
        right: { style: 'thin' }
      };
      
      // Sync width from columns definition
      worksheet.getColumn(colNumber).width = columns[colNumber - 1].width;
    });

    // Add data
    filteredRecords.forEach((r) => {
      const row = worksheet.addRow([
        r.id,
        r.nomeFerramenta,
        r.fornecedor,
        r.unidadeSetor,
        r.statusUso,
        r.classificacaoRiscoManual,
        r.usaDadosSensiveis,
        r.dataRegistro,
      ]);

      row.height = 25;
      row.eachCell((cell, colNumber) => {
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
          left: { style: 'thin', color: { argb: 'E2E8F0' } },
          right: { style: 'thin', color: { argb: 'E2E8F0' } }
        };

        // Conditional styling for Status (col 5)
        if (colNumber === 5 && r.statusUso === StatusUso.APROVADO) {
          cell.font = { color: { argb: '059669' }, bold: true };
        }

        // Conditional styling for Risco (col 6)
        if (colNumber === 6 && (r.classificacaoRiscoManual === ClassificacaoRisco.ALTO || r.classificacaoRiscoManual === ClassificacaoRisco.CRITICO)) {
          cell.font = { color: { argb: 'DC2626' }, bold: true };
        }
      });
    });

    // Final border and cosmetic touch
    worksheet.views = [{ state: 'frozen', ySplit: 4 }];

    // Create binary and save
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, `inventario_ia_cedro_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getStatusBadge = (status: StatusUso) => {
    const styles: Record<StatusUso, { bg: string, border: string, dot: string }> = {
      [StatusUso.APROVADO]: {
        bg: "bg-emerald-50 text-[#075618]",
        border: "border-emerald-100",
        dot: "bg-emerald-500",
      },
      [StatusUso.APROVADO_COM_RESTRICOES]: {
        bg: "bg-amber-50 text-amber-700",
        border: "border-amber-100",
        dot: "bg-amber-500",
      },
      [StatusUso.NAO_APROVADO]: {
        bg: "bg-rose-50 text-rose-750",
        border: "border-rose-100",
        dot: "bg-rose-500",
      },
      [StatusUso.EM_AVALIACAO]: {
        bg: "bg-blue-50 text-blue-700",
        border: "border-blue-100",
        dot: "bg-blue-500",
      },
      [StatusUso.EM_TESTE_PILOTO]: {
        bg: "bg-cyan-50 text-cyan-750",
        border: "border-cyan-100",
        dot: "bg-cyan-500",
      },
      [StatusUso.SUSPENSO]: {
        bg: "bg-slate-100 text-slate-700",
        border: "border-slate-200",
        dot: "bg-slate-500",
      },
      [StatusUso.CANCELADA]: {
        bg: "bg-[#F29222]/10 text-[#9A4F00]",
        border: "border-[#F29222]/30",
        dot: "bg-[#F29222]",
      },
    };

    const currentStyle = styles[status] || {
      bg: "bg-slate-50 text-slate-600",
      border: "border-slate-100",
      dot: "bg-slate-400",
    };

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border tracking-tight ${currentStyle.bg} ${currentStyle.border}`}>
        <span className={`size-1.5 rounded-full ${currentStyle.dot} animate-pulse`}></span>
        {status}
      </span>
    );
  };

  const getRiscoBadge = (risco: string) => {
    const currentRisco = risco || "BAIXO RISCO";
    const isHigh = currentRisco === ClassificacaoRisco.CRITICO || currentRisco === ClassificacaoRisco.ALTO;
    const isMedium = currentRisco === ClassificacaoRisco.MEDIO;

    if (isHigh) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100">
          <ShieldAlert size={12} className="text-rose-500 shrink-0" />
          <span>{currentRisco}</span>
        </span>
      );
    }
    if (isMedium) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">
          <AlertTriangle size={12} className="text-amber-500 shrink-0" />
          <span>{currentRisco}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
        <CheckCircle2 size={12} className="text-[#075618] shrink-0" />
        <span>{currentRisco}</span>
      </span>
    );
  };

  const getWorkflowBadge = (record: IARecord) => {
    const recordWorkflow = workflows?.find(w => w.iaRecordId === record.id);
    
    // Default 6 step definitions
    const stepsDef = approvalConfig?.steps ?? [
      { stepNumber: 1, roleName: "Coordenador NIT" },
      { stepNumber: 2, roleName: "Gerente NIT" },
      { stepNumber: 3, roleName: "Gerente TI" },
      { stepNumber: 4, roleName: "Período de Teste" },
      { stepNumber: 5, roleName: "Presidência" },
      { stepNumber: 6, roleName: "Direção Financeira" },
    ];

    const isApprov = record.statusAuditoria === "Aprovado" || recordWorkflow?.finalStatus === "aprovado" || record.statusUso === StatusUso.APROVADO;
    const isNeg = record.statusAuditoria === "Negado" || recordWorkflow?.finalStatus === "negado" || record.statusUso === StatusUso.NAO_APROVADO;
    
    const currentStepNum = recordWorkflow ? recordWorkflow.currentStep : (isApprov || isNeg ? 0 : 1);

    if (isApprov) {
      return (
        <div className="flex flex-col gap-1.5 justify-center">
          <div className="flex items-center gap-0.5" title="Todos as 6 etapas aprovadas">
            {stepsDef.map((step: any) => (
              <span 
                key={step.stepNumber} 
                className="size-2 rounded-full bg-emerald-500 border border-emerald-600 shrink-0"
                title={`Etapa ${step.stepNumber}: ${step.roleName} - Aprovado`}
              />
            ))}
          </div>
          <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 rounded px-2 py-0.5 w-fit uppercase tracking-tight">
            Aprovada Final
          </span>
        </div>
      );
    }

    if (isNeg) {
      return (
        <div className="flex flex-col gap-1.5 justify-center">
          <div className="flex items-center gap-0.5" title="Fluxo encerrado por reprovação">
            {stepsDef.map((step: any) => {
              const sNum = step.stepNumber;
              const isRejectedHere = sNum === currentStepNum || recordWorkflow?.steps?.find(s => s.stepNumber === sNum)?.status === "negado";
              
              const dotColor = isRejectedHere ? "bg-rose-500 border-rose-600" : "bg-slate-100 border-slate-200";
              return (
                <span 
                  key={sNum} 
                  className={`size-2 rounded-full border shrink-0 ${dotColor}`}
                  title={`Etapa ${sNum}: ${step.roleName}`}
                />
              );
            })}
          </div>
          <span className="text-[10px] text-rose-600 font-bold bg-rose-50 border border-rose-100 rounded px-2 py-0.5 w-fit uppercase tracking-tight">
            Reprovada
          </span>
        </div>
      );
    }

    if (!recordWorkflow) {
      return (
        <div className="flex flex-col gap-1 justify-center">
          <div className="flex items-center gap-0.5">
            {stepsDef.map((step: any) => (
              <span 
                key={step.stepNumber} 
                className="size-2 rounded-full bg-slate-100 border border-slate-200 shrink-0"
                title={`Etapa ${step.stepNumber}: ${step.roleName}`}
              />
            ))}
          </div>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
            Análise inicial
          </span>
        </div>
      );
    }

    const activeStepDef = stepsDef.find((s: any) => s.stepNumber === currentStepNum);
    const stepLabel = activeStepDef ? activeStepDef.roleName : `Etapa ${currentStepNum}`;

    return (
      <div className="flex flex-col gap-1.5 justify-center">
        <div className="flex items-center gap-0.5">
          {stepsDef.map((step: any) => {
            const sNum = step.stepNumber;
            const wfStep = recordWorkflow?.steps?.find(s => s.stepNumber === sNum);
            
            const isStepFailed = wfStep?.status === "negado" || (isNeg && sNum === currentStepNum);
            const isStepPassed = !isStepFailed && (wfStep?.status === "aprovado" || wfStep?.status === "opiniao" || sNum < currentStepNum || isApprov);
            const isStepCurrent = sNum === currentStepNum && !isApprov && !isNeg;

            let dotColor = "bg-slate-100 border-slate-200";
            if (isStepFailed) {
              dotColor = "bg-rose-500 border-rose-600";
            } else if (isStepPassed) {
              dotColor = "bg-emerald-500 border-emerald-600";
            } else if (isStepCurrent) {
              dotColor = "bg-amber-400 border-amber-500 animate-pulse";
            }

            return (
              <span 
                key={sNum} 
                className={`size-2.5 rounded-full border-[1.5px] ${dotColor} shrink-0`}
                title={`Etapa ${sNum}: ${step.roleName} (${isStepFailed ? 'Negada' : isStepPassed ? 'Aprovada' : isStepCurrent ? 'Em Andamento' : 'Aguardando'})`}
              />
            );
          })}
        </div>
        <span className="text-[11px] font-bold text-slate-700 tracking-tight block">
          Etapa {currentStepNum}: <span className="text-slate-400 font-semibold">{stepLabel}</span>
        </span>
      </div>
    );
  };

  const rangeStart = (currentPage - 1) * itemsPerPage + 1;
  const rangeEnd = Math.min(currentPage * itemsPerPage, filteredRecords.length);

  return (
    <div className="space-y-6 pb-10">
      {/* 1. Internal Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3 w-full justify-end">
          <button 
            onClick={exportExcel}
            className="px-4 py-2.5 bg-white border border-slate-205 text-slate-700 hover:text-[#075618] hover:bg-slate-50 font-semibold rounded-xl text-xs tracking-tight transition-all active:scale-95 flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <FileSpreadsheet size={16} className="text-emerald-600" />
            <span>Exportar inventário</span>
          </button>
          <button 
            onClick={onAdd}
            className="px-5 py-2.5 bg-[#075618] hover:bg-[#054112] text-white font-semibold rounded-xl text-xs tracking-tight transition-all active:scale-95 flex items-center gap-2 shadow-md hover:shadow-lg hover:shadow-emerald-900/10 cursor-pointer"
          >
            <PlusCircle size={16} />
            <span>Novo registro</span>
          </button>
        </div>
      </div>

      {/* 3. Small Mini KPI summary block */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 rounded-xl text-[#075618]">
            <Database size={18} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total de IAs</p>
            <p className="text-lg font-extrabold text-slate-800 leading-tight mt-0.5">{totalIAs}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600">
            <ClipboardList size={18} />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Em avaliação</p>
            <p className="text-lg font-extrabold text-slate-800 leading-tight mt-0.5">{emAvaliacaoCount}</p>
          </div>
        </div>
      </div>

      {/* 2. Compact Search and Single Header */}
      <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Pesquisar por nome, fornecedor ou ID..." 
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl focus:ring-2 focus:ring-[#075618]/10 focus:border-[#075618] focus:bg-white text-slate-800 placeholder-slate-400 transition-all outline-none font-medium text-sm tracking-tight"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
              <strong className="text-slate-800 font-bold">{filteredRecords.length}</strong> {filteredRecords.length === 1 ? "resultado encontrado" : "resultados encontrados"}
            </span>

            {(searchTerm || filterSetor || filterStatus || filterRisco || filterDadosSensiveis) && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setFilterSetor("");
                  setFilterStatus("");
                  setFilterRisco("");
                  setFilterDadosSensiveis("");
                  setCurrentPage(1);
                }}
                className="px-3.5 py-2 bg-rose-50/50 hover:bg-rose-50 text-rose-600 hover:text-rose-700 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 border border-rose-100/60 cursor-pointer"
              >
                <RotateCcw size={13} />
                <span>Limpar filtros</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Table - Clean Corporate Look */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col relative">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#075618]/5 text-xs font-bold uppercase text-slate-500 border-b border-slate-100">
              <tr>
                <th className="pl-6 pr-4 py-4.5 tracking-tight cursor-pointer hover:bg-slate-50/80 transition-all" onClick={() => handleSort("id")}>
                  <div className="flex items-center gap-1.5 group">ID <ArrowUpDown size={12} className="opacity-40 group-hover:opacity-100 transition-opacity" /></div>
                </th>
                <th className="px-4 py-4.5 tracking-tight cursor-pointer hover:bg-slate-50/80 transition-all min-w-[200px]" onClick={() => handleSort("nomeFerramenta")}>
                  <div className="flex items-center gap-1.5 group">Nome da IA <ArrowUpDown size={12} className="opacity-40 group-hover:opacity-100 transition-opacity" /></div>
                </th>
                <th className="px-4 py-4.5 tracking-tight cursor-pointer hover:bg-slate-50/80 transition-all min-w-[140px]" onClick={() => handleSort("unidadeSetor")}>
                  <div className="flex items-center gap-1.5 group">Setor <ArrowUpDown size={12} className="opacity-40 group-hover:opacity-100 transition-opacity" /></div>
                </th>
                <th className="px-4 py-4.5 tracking-tight min-w-[140px]">Status</th>
                <th className="px-4 py-4.5 tracking-tight min-w-[155px]">Etapa Atual</th>
                <th className="pl-4 pr-6 py-4.5 tracking-tight text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {paginatedRecords.map((record) => (
                <tr 
                  key={record.id} 
                  className="border-b border-slate-100 hover:bg-slate-50/40 transition-all duration-200 cursor-default"
                >
                  <td className="pl-6 pr-4 py-4 whitespace-nowrap">
                    <span className="font-mono text-[10px] text-[#075618] bg-[#075618]/8 px-2.5 py-1 rounded-md border border-[#075618]/15 font-bold uppercase tracking-tight inline-block">
                      {record.id}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800 tracking-tight text-sm uppercase">
                        {record.nomeFerramenta}
                      </span>
                      {record.fornecedor && record.fornecedor.toLowerCase().trim() !== "interno" && (
                        <span className="text-[11px] text-slate-400 font-medium">
                          {record.fornecedor}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className="px-2.5 py-1 bg-cyan-50 border border-cyan-100 rounded-md text-[10px] font-bold text-cyan-750 uppercase tracking-tight">
                      {record.unidadeSetor}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {getStatusBadge(record.statusUso)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {getWorkflowBadge(record)}
                  </td>
                  <td className="pl-4 pr-6 py-4 text-right whitespace-nowrap">
                    {/* 5. Ações por linha */}
                    <div className="flex items-center justify-end gap-1.5">
                      {canCancel(record) && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setCancelTargetRecord(record);
                          }}
                          className="inline-flex items-center justify-center rounded-xl border border-[#F29222]/30 bg-[#F29222]/10 px-3 py-2 text-xs font-bold text-[#9A4F00] transition-all hover:bg-[#F29222]/15 cursor-pointer"
                        >
                          Cancelar solicitação
                        </button>
                      )}
                      {(() => {
                        const recordWorkflow = workflows?.find(w => w.iaRecordId === record.id);
                        const isApprov = record.statusAuditoria === "Aprovado" || recordWorkflow?.finalStatus === "aprovado" || record.statusUso === StatusUso.APROVADO;
                        const isNeg = record.statusAuditoria === "Negado" || recordWorkflow?.finalStatus === "negado" || record.statusUso === StatusUso.NAO_APROVADO;
                        const isCompleted = isApprov || isNeg || record.statusUso === StatusUso.APROVADO_COM_RESTRICOES;
                        const showWarning = false;
                        
                        return (
                          <button 
                            onClick={(e) => { 
                              e.preventDefault();
                              e.stopPropagation(); 
                              if (showWarning) {
                                setWarningMessage("O relatório ficará pronto quando todas as avaliações forem feitas.");
                                return;
                              }
                              onView(record); 
                            }} 
                            title={showWarning ? "O relatório ficará pronto quando todas as avaliações forem feitas" : "Visualizar Detalhes"}
                            className={`flex items-center justify-center size-8 rounded-lg transition-all active:scale-95 cursor-pointer border ${
                              showWarning 
                                ? "text-amber-500 border-amber-200 bg-amber-50/50 hover:bg-amber-100" 
                                : "text-slate-500 border-slate-200 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50 bg-white"
                            }`}
                          >
                            {showWarning ? (
                              <AlertTriangle size={14} className="text-amber-500 animate-pulse" />
                            ) : (
                              <Eye size={14} />
                            )}
                          </button>
                        );
                      })()}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 opacity-40">
                      <Database size={40} className="text-slate-400" />
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Nenhum registro encontrado no inventário
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 7. Paginação / Rodapé da tabela */}
        <div className="bg-white border-t border-slate-100 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500 font-medium">
            {filteredRecords.length === 0 ? (
              "Exibindo 0 registros"
            ) : (
              <>
                Exibindo <span className="font-semibold text-slate-700">{rangeStart}</span> a{" "}
                <span className="font-semibold text-slate-700">{rangeEnd}</span> de{" "}
                <span className="font-semibold text-slate-700">{filteredRecords.length}</span>{" "}
                {filteredRecords.length === 1 ? "registro" : "registros"}
              </>
            )}
          </div>
          
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent rounded-lg text-slate-600 transition-colors cursor-pointer"
                title="Página Anterior"
              >
                <ChevronLeft size={16} />
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const pg = idx + 1;
                  const isCurrent = pg === currentPage;
                  return (
                    <button
                      key={pg}
                      onClick={() => setCurrentPage(pg)}
                      className={`size-7 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        isCurrent 
                          ? "bg-[#075618] text-white" 
                          : "bg-white border border-slate-150 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {pg}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent rounded-lg text-slate-600 transition-colors cursor-pointer"
                title="Próxima Página"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>


      {/* Warning popup for normal users when evaluations are not finished */}
      {warningMessage && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full border border-slate-100 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center gap-3 text-amber-600 mb-3">
                <div className="p-2 bg-amber-50 rounded-lg">
                  <AlertTriangle size={20} />
                </div>
                <h3 className="font-bold text-slate-800 text-sm">Relatório em processamento</h3>
              </div>
              <p className="text-slate-600 text-xs leading-relaxed">
                {warningMessage}
              </p>
            </div>
            <div className="bg-slate-50 px-6 py-3 flex justify-end">
              <button
                onClick={() => setWarningMessage(null)}
                className="px-4 py-1.5 bg-[#075618] hover:bg-[#054012] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel request confirmation modal */}
      {cancelTargetRecord && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-100 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center gap-3 text-[#9A4F00] mb-3">
                <div className="p-2 bg-[#F29222]/10 rounded-lg">
                  <AlertTriangle size={20} />
                </div>
                <h3 className="font-extrabold text-slate-800 text-base">
                  Cancelar solicitação de IA?
                </h3>
              </div>
              <p className="text-slate-600 text-xs leading-relaxed mb-3">
                Você está prestes a cancelar a solicitação para a ferramenta <strong className="text-slate-800 uppercase">{cancelTargetRecord.nomeFerramenta}</strong>.
              </p>
              <p className="text-slate-500 text-[11px] leading-relaxed">
                Esta ação irá cancelar a solicitação e interromper o andamento do fluxo de aprovação. O registro permanecerá disponível para consulta no inventário e no histórico.
              </p>
            </div>
            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-2 border-t border-slate-100">
              <button
                onClick={() => setCancelTargetRecord(null)}
                disabled={isCancelling}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Voltar
              </button>
              <button
                onClick={async () => {
                  setIsCancelling(true);
                  if (onCancelRequest) {
                    await onCancelRequest(cancelTargetRecord.id);
                  }
                  setIsCancelling(false);
                  setCancelTargetRecord(null);
                }}
                disabled={isCancelling}
                className="px-4 py-2 bg-[#9A4F00] hover:bg-[#804200] disabled:bg-[#9A4F00]/50 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                {isCancelling ? "Cancelando..." : "Confirmar cancelamento"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

