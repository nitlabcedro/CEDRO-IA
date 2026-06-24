/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { 
  CheckCircle2, XCircle, Users, LayoutGrid, Search, 
  Filter, MoreHorizontal, ShieldCheck, ShieldAlert, ShieldX, 
  Database, ArrowUpRight, AlertTriangle, Activity,
  ChevronLeft, ChevronRight, Sliders, Calendar, ArrowRight,
  User, Check, X, Shield, RefreshCw, FolderLock, Trash2, SlidersHorizontal, Edit
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  IARecord,  
  StatusAuditoria, 
  StatusUso, 
  UserProfile, 
  ApprovalConfig, 
  ApprovalWorkflow 
} from "../types";
import { getSectors, deleteRecord } from "../storage";
import SystemControls from "./SystemControls";
import SectorsManager from "./SectorsManager";

interface AdminPanelProps {
  records: IARecord[];
  profiles: UserProfile[];
  onUpdateStatus: (recordId: string, status: StatusAuditoria, comment?: string) => void;
  onViewRecord: (record: IARecord) => void;
  onEditRecord?: (record: IARecord) => void;
  onDeleteRecord?: (id: string) => void;
  onUpdateUserRole?: (userId: string, newRole: "admin" | "moderator" | "user") => void;
  onDeleteUser?: (userId: string) => void;
  approvalConfig?: ApprovalConfig;
  onSaveApprovalConfig?: (config: ApprovalConfig) => void;
  currentUserId?: string;
  workflows?: ApprovalWorkflow[];
  supabaseStatus?: "online" | "offline" | "checking";
  isSyncing?: boolean;
  onSync?: () => Promise<void>;
  onResetStatus?: (recordId: string, reason?: string) => Promise<void>;
  onNavigate?: (tab: string) => void;
}

type AdminTab = "approvals" | "sectors" | "users" | "system_controls";

const ITEMS_PER_PAGE = 8;

export default function AdminPanel({ 
  records, 
  profiles, 
  onUpdateStatus, 
  onViewRecord, 
  onEditRecord,
  onDeleteRecord,
  onUpdateUserRole,
  onDeleteUser,
  approvalConfig,
  onSaveApprovalConfig,
  currentUserId,
  workflows = [],
  supabaseStatus = "checking",
  isSyncing = false,
  onSync,
  onResetStatus,
  onNavigate
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("approvals");

  useEffect(() => {
    if (activeTab === "system_controls" || activeTab === "sectors") {
      setActiveTab("approvals");
    }
  }, [activeTab]);
  const [approvalFilter, setApprovalFilter] = useState<StatusAuditoria | "all">(StatusAuditoria.PENDENTE);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [isConfiguringSectors, setIsConfiguringSectors] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLButtonElement | null>(null);
  const [registeredSectorsList, setRegisteredSectorsList] = useState<string[]>([]);
  const [deleteRecordConfirmId, setDeleteRecordConfirmId] = useState<string | null>(null);
  
  // Setup user status reset and workflow visualization states
  const [viewFlowRecord, setViewFlowRecord] = useState<IARecord | null>(null);
  const [resetStatusRecord, setResetStatusRecord] = useState<IARecord | null>(null);
  const [resetReason, setResetReason] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  // Load and memoize the active workflow and merged steps for the visual workflow flow tracker
  const activeFlowWf = useMemo(() => {
    if (!viewFlowRecord) return null;
    return workflows?.find(wf => wf.iaRecordId === viewFlowRecord.id);
  }, [viewFlowRecord, workflows]);

  const currentFlowSteps = useMemo(() => {
    if (!viewFlowRecord) return [];
    const configSteps = approvalConfig?.steps || [];
    return [1, 2, 3, 4, 5].map(sNum => {
      const cStep = configSteps.find(s => s.stepNumber === sNum);
      const wfStep = activeFlowWf?.steps?.find(s => s.stepNumber === sNum);
      return {
        stepNumber: sNum,
        roleName: wfStep?.roleName || cStep?.roleName || `Etapa ${sNum}`,
        assignedUserName: wfStep?.assignedUserName || cStep?.userName || "Não designado",
        status: wfStep?.status || "aguardando",
        comment: wfStep?.comment || "",
        decidedAt: wfStep?.decidedAt || null,
        isOpinionOnly: wfStep?.isOpinionOnly || cStep?.isOpinionOnly || false,
      };
    });
  }, [viewFlowRecord, activeFlowWf, approvalConfig]);

  const currentUserRole = useMemo(() => {
    return profiles.find(p => p.id === currentUserId)?.role || "user";
  }, [profiles, currentUserId]);
  const isCurrentUserAdmin = currentUserRole === "admin";
  
  // Pagination states
  const [approvalsPage, setApprovalsPage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);
  const [sectorsPage, setSectorsPage] = useState(1);

  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Close custom context menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch real registered sectors to show counts accurately
  useEffect(() => {
    getSectors()
      .then(list => setRegisteredSectorsList(list))
      .catch(() => {});
  }, [records]);

  // Handle pagination reset on filter changes
  useEffect(() => {
    setApprovalsPage(1);
  }, [approvalFilter, searchTerm]);

  useEffect(() => {
    setUsersPage(1);
  }, [searchTerm]);

  // Statistics for the Administrative Header
  const stats = useMemo(() => {
    const totalCount = records.length;
    const pendingCount = records.filter(r => (r.statusAuditoria || StatusAuditoria.PENDENTE) === StatusAuditoria.PENDENTE).length;
    const approvedCount = records.filter(r => r.statusAuditoria === StatusAuditoria.APROVADO).length;
    const deniedCount = records.filter(r => r.statusAuditoria === StatusAuditoria.NEGADO).length;
    const uniqueUsersCount = profiles.length > 0 ? profiles.length : new Set(records.map(r => r.responsavelPreenchimento)).size;
    const sectorsCount = registeredSectorsList.length > 0 ? registeredSectorsList.length : new Set(records.map(r => r.unidadeSetor)).size;

    return {
      total: totalCount,
      pending: pendingCount,
      approved: approvedCount,
      denied: deniedCount,
      uniqueUsers: uniqueUsersCount,
      sectors: sectorsCount
    };
  }, [records, profiles, registeredSectorsList]);

  // Custom 6 workflow steps config
  const workflowSteps = useMemo(() => {
    return approvalConfig?.steps ?? [
      { stepNumber: 1, roleName: "Coordenador NIT", isOpinionOnly: false },
      { stepNumber: 2, roleName: "Gerente NIT", isOpinionOnly: false },
      { stepNumber: 3, roleName: "Gerente TI", isOpinionOnly: false },
      { stepNumber: 4, roleName: "Período de Teste", isOpinionOnly: false },
      { stepNumber: 5, roleName: "Presidência", isOpinionOnly: false },
      { stepNumber: 6, roleName: "Direção Financeira", isOpinionOnly: true },
    ];
  }, [approvalConfig]);

  // Privileged moderators
  const privilegedProfiles = useMemo(() => {
    return profiles.filter(p => {
      const role = p.role?.toLowerCase().trim();
      return role === "admin" || role === "moderator";
    });
  }, [profiles]);

  // Approvals filtering
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const recordStatus = r.statusAuditoria || StatusAuditoria.PENDENTE;
      const matchesStatus = approvalFilter === "all" || recordStatus === approvalFilter;
      
      const valSearch = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm.trim() || 
                           r.nomeFerramenta.toLowerCase().includes(valSearch) || 
                           r.unidadeSetor.toLowerCase().includes(valSearch) ||
                           r.id.toLowerCase().includes(valSearch) ||
                           (r.responsavelPreenchimento || "").toLowerCase().includes(valSearch);
      
      return matchesStatus && matchesSearch;
    });
  }, [records, approvalFilter, searchTerm]);

  // Sector stats maps
  const sectorData = useMemo(() => {
    const sectors: Record<string, { total: number; pending: number; approved: number; denied: number }> = {};
    
    // Seed configured sectors to ensure all registered sectors are displayed even with 0 IAs
    const sectorsToUse = registeredSectorsList.length > 0 ? registeredSectorsList : Array.from(new Set(records.map(r => r.unidadeSetor)));
    sectorsToUse.forEach(sec => {
      if (sec) {
        sectors[sec] = { total: 0, pending: 0, approved: 0, denied: 0 };
      }
    });

    records.forEach(r => {
      if (r.unidadeSetor) {
        if (!sectors[r.unidadeSetor]) {
          sectors[r.unidadeSetor] = { total: 0, pending: 0, approved: 0, denied: 0 };
        }
        sectors[r.unidadeSetor].total++;
        if ((r.statusAuditoria || StatusAuditoria.PENDENTE) === StatusAuditoria.PENDENTE) {
          sectors[r.unidadeSetor].pending++;
        } else if (r.statusAuditoria === StatusAuditoria.APROVADO) {
          sectors[r.unidadeSetor].approved++;
        } else if (r.statusAuditoria === StatusAuditoria.NEGADO) {
          sectors[r.unidadeSetor].denied++;
        }
      }
    });

    return Object.entries(sectors).sort((a, b) => b[1].total - a[1].total);
  }, [records, registeredSectorsList]);

  // Selected Sector stats
  const selectedSectorInfo = useMemo(() => {
    if (!selectedSector) return null;
    const sectorIAs = records.filter(r => r.unidadeSetor === selectedSector);
    const sectorUsers = Array.from(new Set(sectorIAs.map(r => r.responsavelPreenchimento)));
    return {
      name: selectedSector,
      records: sectorIAs,
      users: sectorUsers,
      stats: {
        total: sectorIAs.length,
        approved: sectorIAs.filter(r => r.statusAuditoria === StatusAuditoria.APROVADO).length,
        pending: sectorIAs.filter(r => (r.statusAuditoria || StatusAuditoria.PENDENTE) === StatusAuditoria.PENDENTE).length,
        denied: sectorIAs.filter(r => r.statusAuditoria === StatusAuditoria.NEGADO).length
      }
    };
  }, [selectedSector, records]);

  // Chosen User History/Details
  const selectedUserInfo = useMemo(() => {
    if (!selectedUser) return null;
    
    const profile = profiles.find(p => p.id === selectedUser || p.full_name === selectedUser);
    const userName = profile?.full_name || selectedUser;
    
    const userIAs = records.filter(r => 
      r.responsavelPreenchimento === userName
    ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      name: userName,
      profile: profile,
      records: userIAs,
      sector: profile?.setor || userIAs[0]?.unidadeSetor || "Não Informado",
      stats: {
        total: userIAs.length,
        approved: userIAs.filter(r => r.statusAuditoria === StatusAuditoria.APROVADO).length,
        pending: userIAs.filter(r => (r.statusAuditoria || StatusAuditoria.PENDENTE) === StatusAuditoria.PENDENTE).length,
        denied: userIAs.filter(r => r.statusAuditoria === StatusAuditoria.NEGADO).length
      }
    };
  }, [selectedUser, records, profiles]);

  // Preparation of users list metrics
  const usersWithStats = useMemo(() => {
    const isProfile = profiles.length > 0;
    const list = isProfile 
      ? profiles 
      : Array.from(new Set(records.map(r => r.responsavelPreenchimento)))
          .map(name => ({ id: name, full_name: name, role: 'user' as const, status: 'Autorizado' as const, setor: 'Geral' }));

    const dataList = list.map(userItem => {
      const userProfile = isProfile ? (userItem as UserProfile) : null;
      const userName = isProfile ? (userItem as UserProfile).full_name : (userItem as any).full_name;
      
      const userIAs = records.filter(r => r.responsavelPreenchimento === userName);
      const hasPending = userIAs.some(r => (r.statusAuditoria || StatusAuditoria.PENDENTE) === StatusAuditoria.PENDENTE);
      const userId = userProfile?.id || userName;

      return {
        userItem,
        userProfile,
        userName,
        userIAs,
        hasPending,
        userId
      };
    });

    if (searchTerm.trim()) {
      const val = searchTerm.toLowerCase();
      return dataList.filter(u => 
        u.userName.toLowerCase().includes(val) || 
        (u.userProfile?.setor || "").toLowerCase().includes(val) ||
        (u.userProfile?.cargo || "").toLowerCase().includes(val)
      );
    }
    
    return dataList;
  }, [profiles, records, searchTerm]);

  // Paginated Slices
  const paginatedApprovals = useMemo(() => {
    const startIndex = (approvalsPage - 1) * ITEMS_PER_PAGE;
    return filteredRecords.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredRecords, approvalsPage]);

  const paginatedUsers = useMemo(() => {
    const startIndex = (usersPage - 1) * ITEMS_PER_PAGE;
    return usersWithStats.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [usersWithStats, usersPage]);

  // Archiving/Action simulations
  const handleArchiveRecord = (record: IARecord) => {
    if (window.confirm(`Deseja realmente arquivar permanentemente o registro ${record.nomeFerramenta} (${record.id})?`)) {
      onUpdateStatus(record.id, StatusAuditoria.NEGADO, "Arquivado e descontinuado via painel de administração corporativa.");
      alert(`O registro ${record.id} foi transferido para a fila de descontinuados.`);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 font-sans">
      
      {/* 1. Header Section */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-200">
        <div>
          <h1 id="admin-panel-title" className="text-3xl font-bold tracking-tight text-slate-900">
            Administração IA
          </h1>
        </div>
        
        {/* Dynamic Sync feedback if connected */}
        {supabaseStatus === "online" && (
          <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 text-[11px] font-medium text-emerald-800 self-start lg:self-center">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Conexão Nuvem Segura
          </div>
        )}
      </header>

      {/* 2. Summary Indicators Panel (Grid) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {[
          { 
            title: "Solicitações pendentes", 
            val: stats.pending, 
            support: "Aguardando análise", 
            icon: Activity, 
            bg: "bg-amber-500/10", 
            txt: "text-amber-700", 
            border: "border-amber-200/60" 
          },
          { 
            title: "IAs aprovadas", 
            val: stats.approved, 
            support: "Total aprovadas", 
            icon: ShieldCheck, 
            bg: "bg-emerald-500/10", 
            txt: "text-emerald-700", 
            border: "border-emerald-200/60" 
          },
          { 
            title: "IAs negadas", 
            val: stats.denied, 
            support: "Total negadas", 
            icon: ShieldX, 
            bg: "bg-rose-500/10", 
            txt: "text-rose-700", 
            border: "border-rose-200/60" 
          },
          { 
            title: "Usuários cadastrados", 
            val: stats.uniqueUsers, 
            support: "Ativos no sistema", 
            icon: Users, 
            bg: "bg-slate-100", 
            txt: "text-slate-700", 
            border: "border-slate-300/60" 
          },
          { 
            title: "Setores cadastrados", 
            val: stats.sectors, 
            support: "Total de setores", 
            icon: LayoutGrid, 
            bg: "bg-slate-100", 
            txt: "text-slate-700", 
            border: "border-slate-300/60" 
          },
        ].map((item, idx) => (
          <div 
            key={idx}
            className={`bg-white border ${item.border} rounded-2xl p-5 shadow-xs hover:shadow-sm transition-all duration-200`}
          >
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate">
                {item.title}
              </span>
              <div className={`size-8 rounded-xl ${item.bg} ${item.txt} flex items-center justify-center shrink-0`}>
                <item.icon size={16} />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-900 font-mono">
                {String(item.val).padStart(2, "0")}
              </span>
              <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                {item.support}
              </span>
            </div>
          </div>
        ))}
      </section>

      {/* 3. Navigation Tabs */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-50 p-1.5 rounded-2xl border border-slate-200/80">
        <div className="flex flex-wrap items-center gap-1">
          {[
            { id: "approvals", label: "Cadastro de IAs" },
            { id: "users", label: "Usuários" },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { 
                setActiveTab(tab.id as AdminTab); 
                setSelectedSector(null); 
                setSelectedUser(null);
                setIsConfiguringSectors(false);
              }}
              className={`px-5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all ${
                activeTab === tab.id 
                ? "bg-white text-[#03440c] shadow-xs border border-slate-200/80 font-bold" 
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Global Toolbar specific to Current View */}
        {activeTab === "approvals" && (
          <div className="flex flex-wrap items-center gap-3 md:self-center">
            {/* Horizontal Filter chips */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
              {[
                { label: "Todos", val: "all" },
                { label: "Pendentes", val: StatusAuditoria.PENDENTE },
                { label: "Aprovados", val: StatusAuditoria.APROVADO },
                { label: "Negados", val: StatusAuditoria.NEGADO },
              ].map(opt => (
                <button
                  key={opt.val}
                  onClick={() => setApprovalFilter(opt.val as any)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold tracking-wide transition-all ${
                    approvalFilter === opt.val 
                    ? "bg-[#03440c] text-white shadow-2xs font-bold" 
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Micro search field */}
            <div className="relative group flex-1 md:w-60 min-w-[150px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#03440c] transition-colors" size={14} />
              <input 
                type="text"
                placeholder="Buscar IA, ID ou Setor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:border-[#03440c] focus:ring-1 focus:ring-[#03440c]/10 outline-none transition-all shadow-2xs"
              />
            </div>
          </div>
        )}

        {/* Custom Users search */}
        {activeTab === "users" && !selectedUser && (
          <div className="relative group max-w-sm w-full md:w-64 self-end md:self-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#03440c] transition-colors" size={14} />
            <input 
              type="text"
              placeholder="Buscar responsável ou cargo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:border-[#03440c] focus:ring-1 focus:ring-[#03440c]/10 outline-none transition-all shadow-2xs"
            />
          </div>
        )}
      </div>

      {/* 4. Tab Contents rendering with framer-motion transition */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab + (activeTab === "approvals" ? approvalFilter : "") + String(selectedSector) + String(selectedUser) + String(isConfiguringSectors)}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          
          {/* ==================== CADASTRO DE IAS TAB ==================== */}
          {activeTab === "approvals" && (
            <div className="space-y-4">
              {paginatedApprovals.length > 0 ? (
                paginatedApprovals.map((record) => {
                  const recordWorkflow = workflows.find(wf => wf.iaRecordId === record.id);
                  const currentStepNum = recordWorkflow ? recordWorkflow.currentStep : 1;
                  
                  // Compute last comment/decision from history
                  const lastParecer = record.historico?.find(
                    item => item.action && 
                    !item.action.includes("Criação") && 
                    !item.action.includes("Cadastro") &&
                    !item.action.includes("Atualização")
                  );

                  return (
                    <article 
                      key={record.id} 
                      className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs hover:shadow-sm hover:border-slate-300 transition-all duration-200 relative overflow-hidden"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                        
                        {/* LEFT SECTION (Identity) */}
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          {/* Identicon block representing system / IA */}
                          <div className="size-12 rounded-xl bg-slate-50 border border-slate-200 text-[#03440c] flex items-center justify-center shrink-0 shadow-3xs">
                            <Database size={24} />
                          </div>

                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 
                                onClick={() => onViewRecord(record)}
                                className="text-base font-bold text-slate-950 hover:text-[#03440c] transition-colors leading-snug cursor-pointer truncate"
                              >
                                {record.nomeFerramenta}
                              </h3>
                              <span className="inline-flex items-center px-1.5 py-0.5 bg-slate-100 text-slate-500 border border-slate-200 text-[10px] font-mono font-medium rounded">
                                {record.id}
                              </span>
                            </div>

                            {/* Aligned corporate indicators */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-slate-600 font-medium pt-1">
                              <div className="flex items-center gap-1.5 text-slate-500">
                                <Database size={13} className="text-slate-400" />
                                <span className="font-semibold text-slate-800">Setor:</span> 
                                <span className="truncate">{record.unidadeSetor}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-slate-500">
                                <User size={13} className="text-slate-400" />
                                <span className="font-semibold text-slate-800">Responsável:</span> 
                                <span className="truncate">{record.responsavelPreenchimento}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-slate-500">
                                <Calendar size={13} className="text-slate-400" />
                                <span className="font-semibold text-slate-800">Criado em:</span> 
                                <span>{new Date(record.createdAt).toLocaleDateString()}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-slate-500">Privacidade:</span>
                                {record.usaDadosSensiveis === "Sim" ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-250 text-[10px] font-semibold rounded-full">
                                    <ShieldAlert size={10} /> Dados sensíveis
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-semibold rounded-full">
                                    <ShieldCheck size={10} /> Dados comuns
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* RIGHT SECTION (Stats, Workflow dots, Actions) */}
                        <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end justify-between gap-4 shrink-0 w-full sm:w-auto self-stretch sm:self-center lg:self-start">
                          
                          {/* BADGES AND PROGRESS STEPS */}
                          <div className="space-y-3 w-full sm:w-auto flex flex-col items-stretch sm:items-start lg:items-end">
                            <div className="flex items-center justify-between sm:justify-start lg:justify-end gap-3.5">
                              
                              {/* Workflow Step Indicator Nodes */}
                              <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200" title={`Fluxo de Aprovação — Etapa Atual: ${currentStepNum}/5`}>
                                {workflowSteps.map((step) => {
                                  const sNum = step.stepNumber;
                                  const wfStep = recordWorkflow?.steps?.find(s => s.stepNumber === sNum);
                                  
                                  const isFailed = wfStep?.status === "negado" || (record.statusAuditoria === StatusAuditoria.NEGADO && sNum === currentStepNum);
                                  const isPassed = !isFailed && (wfStep?.status === "aprovado" || wfStep?.status === "opiniao" || (sNum < currentStepNum || record.statusAuditoria === StatusAuditoria.APROVADO));
                                  const isCurrent = sNum === currentStepNum && (record.statusAuditoria || StatusAuditoria.PENDENTE) === StatusAuditoria.PENDENTE;

                                  let circleStyle = "bg-slate-200 text-slate-400 border-slate-300";
                                  if (isFailed) {
                                    circleStyle = "bg-rose-500 text-white border-rose-600";
                                  } else if (isPassed) {
                                    circleStyle = "bg-emerald-600 text-white border-emerald-700";
                                  } else if (isCurrent) {
                                    circleStyle = "bg-amber-400 text-slate-900 font-bold border-amber-500 animate-pulse";
                                  }

                                  return (
                                    <span 
                                      key={sNum}
                                      className={`size-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${circleStyle}`}
                                      title={`${step.roleName} — ${isPassed ? 'Aprovado' : isFailed ? 'Negado/Reprovado' : isCurrent ? 'Etapa Atual' : 'Aguardando'}`}
                                    >
                                      {sNum}
                                    </span>
                                  );
                                })}
                              </div>

                              {/* Status Badge */}
                              <div className="shrink-0">
                                {record.statusAuditoria === StatusAuditoria.APROVADO ? (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-250 text-xs font-semibold rounded-full shadow-2xs">
                                    <CheckCircle2 size={12} className="text-emerald-600" /> Aprovado
                                  </span>
                                ) : record.statusAuditoria === StatusAuditoria.NEGADO ? (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-800 border border-rose-250 text-xs font-semibold rounded-full shadow-2xs">
                                    <XCircle size={12} className="text-rose-600" /> Negado
                                  </span>
                                ) : recordWorkflow && currentStepNum > 1 ? (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-50 text-orange-850 border border-orange-250 text-xs font-semibold rounded-full shadow-2xs">
                                    <Activity size={12} className="text-orange-500 animate-spin" /> Em avaliação
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50/60 text-amber-800 border border-amber-250 text-xs font-semibold rounded-full shadow-2xs">
                                    <AlertTriangle size={12} className="text-amber-500" /> Pendente
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* ACTION BUTTONS GROUP */}
                          <div className="flex items-center flex-wrap sm:justify-end gap-2 w-full sm:w-auto">
                            {/* Ver Ficha Technical view triggers detail modal */}
                            <button
                              onClick={() => onViewRecord(record)}
                              className="px-3.5 py-2 text-xs font-semibold text-[#03440c] bg-[#03440c]/5 hover:bg-[#03440c] hover:text-white rounded-lg border border-[#03440c]/15 hover:border-transparent transition-all cursor-pointer flex items-center gap-1 shadow-3xs"
                            >
                              Ver ficha <ArrowRight size={13} />
                            </button>

                            {/* Editar button */}
                            <button
                              onClick={() => onEditRecord?.(record)}
                              className="px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50/50 hover:bg-blue-600 hover:text-white rounded-lg border border-blue-200 hover:border-transparent transition-all cursor-pointer flex items-center gap-1 shadow-3xs"
                            >
                              Editar
                            </button>

                            {/* Excluir button with confirmation */}
                            <div className="relative">
                              <AnimatePresence>
                                {deleteRecordConfirmId === record.id && (
                                  <motion.div 
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="absolute right-0 bottom-full mb-2 flex items-center gap-1.5 bg-white border border-rose-100 rounded-xl shadow-xl p-1.5 z-50 whitespace-nowrap text-slate-700"
                                  >
                                    <span className="text-[10px] font-bold text-slate-500 px-1">Excluir?</span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setDeleteRecordConfirmId(null);
                                      }}
                                      className="px-2 py-1 text-[9px] font-bold text-slate-500 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                                    >
                                      Não
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onDeleteRecord?.(record.id);
                                        setDeleteRecordConfirmId(null);
                                      }}
                                      className="px-2 py-1 text-[9px] font-bold bg-rose-600 text-white hover:bg-rose-700 rounded-md transition-colors cursor-pointer"
                                    >
                                      Sim
                                    </button>
                                  </motion.div>
                                )}
                              </AnimatePresence>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (deleteRecordConfirmId === record.id) {
                                    setDeleteRecordConfirmId(null);
                                  } else {
                                    setDeleteRecordConfirmId(record.id);
                                  }
                                }}
                                className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer flex items-center gap-1 shadow-3xs ${
                                  deleteRecordConfirmId === record.id
                                    ? "bg-rose-600 border-rose-600 text-white"
                                    : "text-rose-600 bg-rose-50/55 border-rose-205 hover:bg-rose-600 hover:text-white hover:border-transparent"
                                }`}
                                title="Excluir Registro"
                              >
                                Excluir
                              </button>
                            </div>

                            {/* Action toggle Context Menu */}
                            <div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (openMenuId === record.id) {
                                    setOpenMenuId(null);
                                    setMenuAnchor(null);
                                  } else {
                                    setOpenMenuId(record.id);
                                    setMenuAnchor(e.currentTarget);
                                  }
                                }}
                                className={`size-8 rounded-lg flex items-center justify-center border transition-all ${
                                  openMenuId === record.id 
                                  ? "bg-slate-100 border-slate-350 text-slate-850" 
                                  : "bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                                }`}
                                title="Ações Administrativas"
                              >
                                <MoreHorizontal size={14} />
                              </button>
                            </div>
                          </div>

                        </div>
                      </div>

                      {/* Discretely integrated latest comment/parecer banner if exists */}
                      {lastParecer && (
                        <div className={`mt-4 p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                          record.statusAuditoria === StatusAuditoria.NEGADO 
                          ? "bg-rose-50/55 border-rose-150 text-rose-800" 
                          : "bg-[#03440c]/5 border-[#03440c]/10 text-slate-800"
                        }`}>
                          {record.statusAuditoria === StatusAuditoria.NEGADO ? (
                            <XCircle size={14} className="shrink-0 mt-0.5 text-rose-600" />
                          ) : (
                            <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-[#03440c]" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold uppercase tracking-wider text-[9px] text-slate-500 mb-0.5">Último Parecer</p>
                            <span className="font-normal text-slate-700 leading-normal">
                              &ldquo;{lastParecer.message || lastParecer.action}&rdquo;
                            </span>
                            {lastParecer.user && (
                              <span className="text-[11px] text-slate-500 font-semibold ml-2">
                                — por {lastParecer.user} em {new Date(lastParecer.date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })
              ) : (
                /* Elegant Search Empty State */
                <div className="flex flex-col items-center justify-center p-12 py-20 text-center bg-white border border-slate-200 rounded-2xl shadow-xs">
                  <div className="size-14 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 text-slate-400 mb-4 animate-pulse">
                    <Search size={20} />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-1">Nenhum resultado encontrado</h4>
                  <p className="text-xs text-slate-500 max-w-sm mb-5 leading-relaxed">
                    Não localizamos registros correspondentes ao filtro ou busca na base do Laboratório Cedro.
                  </p>
                  <button
                    onClick={() => {
                      setSearchTerm("");
                      setApprovalFilter("all");
                    }}
                    className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                  >
                    Redefinir Filtros
                  </button>
                </div>
              )}

              {/* Pagination controls */}
              {filteredRecords.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                  <span className="text-xs text-slate-500 font-medium">
                    Mostrando {(approvalsPage - 1) * ITEMS_PER_PAGE + 1} a {Math.min(approvalsPage * ITEMS_PER_PAGE, filteredRecords.length)} de {filteredRecords.length} registros
                  </span>
                  <div className="flex gap-2">
                    <button
                      disabled={approvalsPage === 1}
                      onClick={() => setApprovalsPage(p => Math.max(1, p - 1))}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <ChevronLeft size={14} /> Anterior
                    </button>
                    <button
                      disabled={approvalsPage * ITEMS_PER_PAGE >= filteredRecords.length}
                      onClick={() => setApprovalsPage(p => p + 1)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      Próximo <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================== SETORES TAB ==================== */}
          {activeTab === "sectors" && (
            <div className="space-y-6">
              
              {/* Sector Management Mode Selection */}
              {isConfiguringSectors ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setIsConfiguringSectors(false)}
                      className="flex items-center gap-1.5 font-bold text-[#03440c] bg-[#03440c]/5 hover:bg-[#03440c]/10 hover:text-[#006400] transition-all px-4 py-2 rounded-xl text-xs"
                    >
                      <ChevronLeft size={16} /> Voltar para Painel Setorial
                    </button>
                    <h3 className="text-sm font-bold text-slate-700">Edição Estrutural</h3>
                  </div>
                  
                  {/* Reuse SectorsManager beautifully */}
                  <SectorsManager 
                    records={records} 
                    profiles={profiles} 
                    approvalConfig={approvalConfig}
                    onSaveApprovalConfig={onSaveApprovalConfig}
                    onRefresh={() => {}} 
                  />
                </div>
              ) : !selectedSector ? (
                /* Main sectors list */
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[17px] font-bold text-slate-900">Áreas Técnicas</h2>
                    
                    {/* Switch to SectorsManager layout */}
                    <button
                      onClick={() => setIsConfiguringSectors(true)}
                      className="px-4 py-2 bg-white text-slate-700 hover:bg-slate-50 border border-slate-250 cursor-pointer text-xs font-bold rounded-xl shadow-2xs transition-colors flex items-center gap-2"
                    >
                      <SlidersHorizontal size={14} className="text-[#03440c]" />
                      Configurar Setores
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {sectorData.map(([sectorName, secStats], idx) => {
                      const approvalRate = secStats.total > 0 ? Math.round((secStats.approved / secStats.total) * 100) : 0;
                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedSector(sectorName)}
                          className="bg-white border border-slate-205 rounded-2xl p-6 shadow-2xs hover:shadow-sm hover:border-slate-350 transition-all cursor-pointer relative group flex flex-col justify-between min-h-[180px]"
                        >
                          <div>
                            <div className="flex justify-between items-start gap-4 mb-4">
                              <div className="size-10 rounded-xl bg-slate-50 border border-slate-200 text-[#03440c] flex items-center justify-center shrink-0">
                                <LayoutGrid size={20} />
                              </div>
                              <div className="flex items-center gap-1.5">
                                {secStats.pending > 0 && (
                                  <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-bold rounded uppercase tracking-wider animate-pulse">
                                    {secStats.pending} Pend.
                                  </span>
                                )}
                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 text-[9px] font-bold rounded uppercase tracking-wider">
                                  {secStats.total} IAs
                                </span>
                              </div>
                            </div>
                            
                            <h3 className="text-base font-bold text-slate-900 group-hover:text-[#03440c] transition-colors uppercase tracking-tight truncate">
                              {sectorName}
                            </h3>
                          </div>

                          <div className="space-y-3.5 pt-4">
                            {/* Proportional metric bar */}
                            <div className="space-y-1">
                              <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase">
                                <span>Aprovação</span>
                                <span className="font-mono text-slate-800 font-bold">{approvalRate}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                                <div 
                                  style={{ width: `${secStats.total > 0 ? (secStats.approved / secStats.total) * 100 : 0}%` }} 
                                  className="h-full bg-emerald-500"
                                ></div>
                                <div 
                                  style={{ width: `${secStats.total > 0 ? (secStats.pending / secStats.total) * 100 : 0}%` }} 
                                  className="h-full bg-amber-400"
                                ></div>
                                <div 
                                  style={{ width: `${secStats.total > 0 ? (secStats.denied / secStats.total) * 100 : 0}%` }} 
                                  className="h-full bg-rose-500"
                                ></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Sector Detail Drilldown */
                <div className="space-y-6">
                  <button 
                    onClick={() => setSelectedSector(null)}
                    className="flex items-center gap-1.5 font-bold text-[#03440c] hover:text-[#006400] text-xs transition-all hover:-translate-x-1"
                  >
                    <ChevronLeft size={16} /> Voltar para Setores
                  </button>

                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Sector Profile Statistics sidebar */}
                    <div className="lg:col-span-1 space-y-5">
                      <div className="bg-white border border-slate-205 rounded-2xl p-6 shadow-2xs">
                        <div className="size-12 rounded-xl bg-slate-50 border border-slate-200 text-[#03440c] flex items-center justify-center mb-4 shadow-3xs">
                          <LayoutGrid size={24} />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 leading-tight">
                          {selectedSectorInfo.name}
                        </h2>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block pt-1 pb-4 border-b border-slate-100">
                          Detalhamento Setorial
                        </span>

                        <div className="space-y-3 pt-5">
                          {[
                            { label: "Total cadastrado", val: selectedSectorInfo.stats.total, bg: "bg-slate-50", text: "text-slate-800" },
                            { label: "Aprovados", val: selectedSectorInfo.stats.approved, bg: "bg-emerald-50 text-emerald-800", text: "text-emerald-700" },
                            { label: "Pendentes", val: selectedSectorInfo.stats.pending, bg: "bg-amber-50 text-amber-800", text: "text-amber-700" },
                            { label: "Negados", val: selectedSectorInfo.stats.denied, bg: "bg-rose-50 text-rose-800", text: "text-rose-700" },
                          ].map((secMetric, idx) => (
                            <div key={idx} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-100">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                {secMetric.label}
                              </span>
                              <span className={`text-base font-bold font-mono ${secMetric.text}`}>
                                {secMetric.val}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Members active inside sector */}
                      <div className="bg-white border border-slate-205 rounded-2xl p-6 shadow-2xs">
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-4 flex items-center gap-2">
                          <Users size={14} className="text-[#03440c]" /> Usuários Ativos
                        </h3>
                        
                        <div className="space-y-2 max-h-56 overflow-y-auto">
                          {selectedSectorInfo.users.map((item, idx) => (
                            <div 
                              key={idx} 
                              onClick={() => { setSelectedUser(item); setActiveTab("users"); }}
                              className="flex items-center gap-3 p-2 bg-slate-50/50 hover:bg-slate-150 border border-slate-100 rounded-xl transition-all cursor-pointer"
                            >
                              <div className="size-7 rounded-lg bg-emerald-700/5 text-slate-800 border border-slate-200 text-xs font-bold flex items-center justify-center overflow-hidden">
                                {item.substring(0, 2).toUpperCase()}
                              </div>
                              <span className="text-xs font-semibold text-slate-700 uppercase truncate">
                                {item}
                              </span>
                            </div>
                          ))}
                          {selectedSectorInfo.users.length === 0 && (
                            <p className="text-[10px] text-slate-400 font-medium italic">Nenhum responsável vinculado.</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Sector Specific Inventory Content */}
                    <div className="lg:col-span-3 space-y-4">
                      {selectedSectorInfo.records.map((record) => (
                        <div 
                          key={record.id} 
                          className="bg-white border border-slate-205 rounded-2xl p-5 shadow-2xs hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden"
                        >
                          <div className={`absolute top-0 left-0 w-1 h-full ${
                            record.statusAuditoria === StatusAuditoria.APROVADO ? "bg-emerald-500" :
                            record.statusAuditoria === StatusAuditoria.NEGADO ? "bg-rose-500" :
                            "bg-amber-400"
                          }`}></div>

                          <div className="space-y-1.5 flex-1 min-w-0">
                            <h4 
                              onClick={() => onViewRecord(record)}
                              className="text-base font-bold text-slate-900 uppercase cursor-pointer hover:text-[#03440c] transition-colors truncate"
                            >
                              {record.nomeFerramenta}
                            </h4>
                            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-500">
                              <span className="flex items-center gap-1"><User size={12} /> {record.responsavelPreenchimento}</span>
                              <span className="flex items-center gap-1"><Database size={12} /> {record.fornecedor}</span>
                              <span>ID: {record.id}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3.5 self-end sm:self-center shrink-0">
                            {/* Static status badge */}
                            {record.statusAuditoria === StatusAuditoria.APROVADO ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-800 border border-emerald-250 text-[10px] font-bold uppercase rounded-md shadow-3xs">
                                <Check size={10} /> Homologado
                              </span>
                            ) : record.statusAuditoria === StatusAuditoria.NEGADO ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-rose-50 text-rose-800 border border-rose-250 text-[10px] font-bold uppercase rounded-md shadow-3xs">
                                <X size={10} /> Recusado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-800 border border-amber-250 text-[10px] font-bold uppercase rounded-md shadow-3xs">
                                <Activity size={10} className="animate-pulse" /> Em avaliação
                              </span>
                            )}

                            {/* View flow button */}
                            <button 
                              onClick={() => setViewFlowRecord(record)}
                              className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-[#03440c] border border-slate-200 hover:border-slate-350 rounded-lg text-[10px] font-bold uppercase cursor-pointer transition flex items-center gap-1 shadow-3xs"
                              title="Visualizar Fluxo de Aprovação"
                            >
                              <FolderLock size={12} /> Fluxo
                            </button>

                            <button 
                              onClick={() => onViewRecord(record)}
                              className="size-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 text-slate-500 cursor-pointer"
                              title="Visualizar Ficha"
                            >
                              <ArrowRight size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================== USUÁRIOS TAB ==================== */}
          {activeTab === "users" && (
            <div className="space-y-6">
              
              {!selectedUser ? (
                /* Primary corporative user directory list */
                <div className="bg-white border border-slate-205 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Responsáveis Técnicos</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Gestão de acessos, papéis de conformidade e contas acadêmicas</p>
                    </div>
                    <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                      {usersWithStats.length} Ativos
                    </span>
                  </div>

                  {paginatedUsers.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase bg-slate-50/20">
                            <th className="px-6 py-3.5 font-bold">Nome / Cargo</th>
                            <th className="px-6 py-3.5 font-bold">Unidade Setorial</th>
                            <th className="px-6 py-3.5 font-bold text-center">Registros IA</th>
                            <th className="px-6 py-3.5 font-bold">Permissão / Status</th>
                            <th className="px-6 py-3.5 font-bold text-right">Controles</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {paginatedUsers.map(({ userItem, userProfile, userName, userIAs, hasPending, userId }) => {
                            const cargo = userProfile?.cargo || "";
                            const setor = userProfile?.setor || userIAs[0]?.unidadeSetor || "Não Associado";
                            const role = userProfile?.role || "user";
                            const status = userProfile?.status || "Autorizado";

                            return (
                              <tr key={userId} className="hover:bg-slate-50/50 transition-colors text-xs">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="size-8 rounded-lg bg-emerald-50 border border-slate-200 text-[#03440c] flex items-center justify-center font-bold text-xs shadow-3xs overflow-hidden">
                                      {userProfile?.avatar_url ? (
                                        <img src={userProfile.avatar_url} alt={userName} className="size-full object-cover" />
                                      ) : (
                                        userName.substring(0, 2).toUpperCase()
                                      )}
                                    </div>
                                    <div className="space-y-0.5">
                                      <p className="font-bold text-slate-900 uppercase tracking-tight">{userName}</p>
                                      <p className="text-[10px] text-slate-400 font-semibold">{cargo}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 font-semibold text-slate-600 uppercase">
                                  {setor}
                                </td>
                                <td className="px-6 py-4 text-center font-bold text-slate-800 font-mono">
                                  {String(userIAs.length).padStart(2, "0")}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex flex-wrap items-center gap-2">
                                    {/* Role Badges */}
                                    {role === "admin" ? (
                                      <span className="inline-flex items-center px-2 py-0.5 bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-bold rounded">
                                        Administrador
                                      </span>
                                    ) : role === "moderator" ? (
                                      <span className="inline-flex items-center px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold rounded">
                                        Moderador
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-semibold rounded">
                                        Editor de Inventário
                                      </span>
                                    )}

                                    {/* Governance State Badge */}
                                    {hasPending ? (
                                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-semibold rounded-full animate-pulse">
                                        <AlertTriangle size={10} /> Pendências
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-semibold rounded-full">
                                        <ShieldCheck size={10} /> Conformidade
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-2.5">
                                    
                                    {/* Permission Adjusters if Handler is provided */}
                                    {onUpdateUserRole && userProfile && (
                                      <div className="flex gap-1.5">
                                        <button
                                          disabled={updatingUserId === userProfile.id}
                                          onClick={async () => {
                                            setUpdatingUserId(userProfile.id);
                                            try {
                                              const newRole = userProfile.role === "admin" ? "user" : "admin";
                                              await onUpdateUserRole(userProfile.id, newRole);
                                            } finally {
                                              setUpdatingUserId(null);
                                            }
                                          }}
                                          className={`px-2 py-1 text-[9px] uppercase tracking-wide border rounded-lg font-bold transition-all cursor-pointer ${
                                            userProfile.role === "admin"
                                            ? "bg-rose-50 border-rose-250 text-rose-850 hover:bg-rose-100"
                                            : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-250"
                                          }`}
                                          title="Alternar permissão Administrador"
                                        >
                                          {userProfile.role === "admin" ? "Revogar Admin" : "Fazer Admin"}
                                        </button>
                                      </div>
                                    )}

                                    {/* Histórico Drilldown triggering view */}
                                    <button 
                                      onClick={() => setSelectedUser(userName)}
                                      className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg text-[9px] font-bold uppercase transition-all flex items-center gap-1"
                                    >
                                      Histórico <ArrowRight size={11} />
                                    </button>

                                    {/* Danger User Removal with protection confirms */}
                                    {onDeleteUser && userProfile && (
                                      <div className="relative inline-block">
                                        {showDeleteConfirm === userProfile.id ? (
                                          <div className="absolute right-0 bottom-full mb-1.5 p-2 bg-white border border-rose-300 rounded-xl shadow-lg z-50 min-w-[150px] text-center">
                                            <p className="text-[9px] text-slate-800 font-bold uppercase mb-1.5">Excluir?</p>
                                            <div className="flex gap-1 justify-center">
                                              <button 
                                                onClick={() => setShowDeleteConfirm(null)} 
                                                className="px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-[8px] font-bold uppercase"
                                              >
                                                Não
                                              </button>
                                              <button 
                                                onClick={async () => {
                                                  setDeletingUserId(userProfile.id);
                                                  try {
                                                    await onDeleteUser(userProfile.id);
                                                  } finally {
                                                    setDeletingUserId(null);
                                                    setShowDeleteConfirm(null);
                                                  }
                                                }}
                                                className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[8px] font-bold uppercase"
                                              >
                                                Sim
                                              </button>
                                            </div>
                                          </div>
                                        ) : null}

                                        <button
                                          onClick={() => setShowDeleteConfirm(userProfile.id)}
                                          className="size-7 flex items-center justify-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors border border-rose-150"
                                          title="Deletar Conta Permanentemente"
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    )}

                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-slate-500 font-medium italic">
                      Nenhum responsável atende aos critérios de pesquisa.
                    </div>
                  )}

                  {/* Users Pagination */}
                  {usersWithStats.length > ITEMS_PER_PAGE && (
                    <div className="p-5 border-t border-slate-200 bg-slate-50/50 flex justify-between items-center">
                      <span className="text-xs text-slate-500">
                        Página {usersPage} de {Math.ceil(usersWithStats.length / ITEMS_PER_PAGE)}
                      </span>
                      <div className="flex gap-1.5">
                        <button
                          disabled={usersPage === 1}
                          onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                          className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-250 text-xs font-bold rounded-lg disabled:opacity-40 transition-colors cursor-pointer"
                        >
                          Anterior
                        </button>
                        <button
                          disabled={usersPage * ITEMS_PER_PAGE >= usersWithStats.length}
                          onClick={() => setUsersPage(p => p + 1)}
                          className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-250 text-xs font-bold rounded-lg disabled:opacity-40 transition-colors cursor-pointer"
                        >
                          Próximo
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* User Custody Profile History Drilldown view */
                <div className="space-y-6">
                  <button 
                    onClick={() => setSelectedUser(null)}
                    className="flex items-center gap-1.5 font-bold text-[#03440c] hover:text-[#006400] text-xs transition-colors"
                  >
                    <ChevronLeft size={16} /> Voltar para Pesquisa de Usuários
                  </button>

                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <div className="lg:col-span-1 space-y-5">
                      {/* Custodian main metrics */}
                      <div className="bg-white border border-slate-205 rounded-2xl p-6 shadow-2xs text-center">
                        <div className="size-20 rounded-full bg-emerald-50 border border-slate-205 text-emerald-800 flex items-center justify-center font-bold text-2xl mx-auto mb-4 overflow-hidden shadow-3xs">
                          {selectedUserInfo.profile?.avatar_url ? (
                            <img src={selectedUserInfo.profile.avatar_url} alt={selectedUserInfo.name} className="size-full object-cover" />
                          ) : (
                            selectedUserInfo.name.substring(0, 2).toUpperCase()
                          )}
                        </div>

                        <h2 className="text-lg font-bold text-slate-900 leading-snug truncate uppercase">
                          {selectedUserInfo.name}
                        </h2>
                        <p className="text-xs text-slate-400 font-semibold">{selectedUserInfo.profile?.cargo || ""}</p>
                        
                        <div className="flex justify-center mt-3">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-[#03440c] border border-emerald-250 text-[10px] font-bold rounded-full uppercase">
                            <ShieldCheck size={10} /> Perfil Ativo
                          </span>
                        </div>

                        <div className="border-t border-slate-100 mt-5 pt-5 space-y-3.5 text-left text-xs font-medium">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] text-slate-400 uppercase font-bold">Unidade Setorial</span>
                            <span className="text-slate-800 uppercase font-semibold">{selectedUserInfo.sector}</span>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] text-slate-400 uppercase font-bold">Nível de Acesso</span>
                            <span className="text-slate-800 uppercase font-semibold">
                              {selectedUserInfo.profile?.role === "admin" ? "Administrador corporativo" : "Editor de Inventário"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Cumulative activities details list */}
                      <div className="bg-white border border-slate-205 rounded-2xl p-5 shadow-2xs space-y-3.5 text-xs text-slate-600">
                        <div className="flex justify-between items-center border-b border-rose-50 pb-2">
                          <span className="font-bold text-slate-500 uppercase text-[10px]">Cadastros Totais</span>
                          <span className="font-bold font-mono text-slate-900 text-base">{selectedUserInfo.records.length}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-rose-50 pb-2">
                          <span className="font-bold text-slate-500 uppercase text-[10px]">Aprovados</span>
                          <span className="font-bold font-mono text-emerald-700 text-base">{selectedUserInfo.stats.approved}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-slate-500 uppercase text-[10px]">Pendentes</span>
                          <span className="font-bold font-mono text-amber-700 text-base">{selectedUserInfo.stats.pending}</span>
                        </div>
                      </div>
                    </div>

                    <div className="lg:col-span-3 space-y-4">
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide border-b border-slate-100 pb-2">
                        Ferramentas e Cadastros Sob Custódia
                      </h3>

                      {selectedUserInfo.records.map((record) => (
                        <div 
                          key={record.id} 
                          className="bg-white border border-slate-205 rounded-2xl p-5 shadow-2xs hover:shadow-xs transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden"
                        >
                          <div className={`absolute top-0 left-0 w-1 h-full ${
                            record.statusAuditoria === StatusAuditoria.APROVADO ? "bg-emerald-500" :
                            record.statusAuditoria === StatusAuditoria.NEGADO ? "bg-rose-500" :
                            "bg-amber-400"
                          }`}></div>

                          <div className="space-y-1">
                            <h4 className="font-bold text-slate-900 uppercase">
                              {record.nomeFerramenta}
                            </h4>
                            <div className="flex flex-wrap items-center gap-3.5 text-xs font-semibold text-slate-500">
                              <span>Fornecedor: {record.fornecedor}</span>
                              <span>Data de cadastro: {new Date(record.createdAt).toLocaleDateString()}</span>
                              <span>ID: {record.id}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 self-stretch sm:self-auto justify-between shrink-0">
                            {/* Short auditoria indicator tag */}
                            {record.statusAuditoria === StatusAuditoria.APROVADO ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-150 text-[10px] font-semibold">
                                Ativo / Homologado
                              </span>
                            ) : record.statusAuditoria === StatusAuditoria.NEGADO ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-150 text-[10px] font-semibold">
                                Indeferido
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-150 text-[10px] font-semibold">
                                Em Análise
                              </span>
                            )}

                            <button 
                              onClick={() => onViewRecord(record)}
                              className="size-8 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-500"
                              title="Visualizar ficha"
                            >
                              <ArrowRight size={14} />
                            </button>
                          </div>
                        </div>
                      ))}

                      {selectedUserInfo.records.length === 0 && (
                        <div className="p-10 text-center text-slate-400 font-medium italic border-2 border-dashed border-slate-200 rounded-2xl">
                          Nenhum registro técnico cadastrado por este responsável.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================== SYSTEM CONTROLS TAB ==================== */}
          {activeTab === "system_controls" && (
            <SystemControls
              supabaseStatus={supabaseStatus}
              isSyncing={isSyncing}
              onSync={onSync}
              records={records}
            />
          )}

        </motion.div>
      </AnimatePresence>

      {/* ==================== HISTÓRICO E FLUXO VISUAL DE APROVAÇÃO (READ-ONLY) ==================== */}
      <AnimatePresence>
        {viewFlowRecord && (
          <div className="fixed inset-0 z-110 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewFlowRecord(null)}
              className="absolute inset-0 bg-slate-900/45 backdrop-blur-xs"
            />
            
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative w-full max-w-xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden"
            >
              <div className="p-6 sm:p-8 space-y-6 max-h-[85vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center gap-4 border-b border-slate-100 pb-5">
                  <div className="size-12 rounded-xl bg-[#03440c]/5 text-[#03440c] border border-[#03440c]/15 flex items-center justify-center shrink-0">
                    <FolderLock size={24} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-slate-800 uppercase tracking-tight truncate">
                      Visualizar Fluxo de Aprovação
                    </h3>
                    <p className="text-xs text-slate-400 font-semibold truncate">
                      {viewFlowRecord.nomeFerramenta} — Protocolo: {viewFlowRecord.id}
                    </p>
                  </div>
                </div>

                {/* Brief IA details */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3.5 text-xs text-slate-700">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Setor solicitante</p>
                      <p className="font-bold text-slate-900 uppercase pt-0.5 truncate">{viewFlowRecord.unidadeSetor}</p>
                      <p className="text-[11px] text-slate-500 truncate">{viewFlowRecord.responsavelPreenchimento}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Status Auditoria</p>
                      <p className="font-bold text-slate-900 uppercase pt-0.5 animate-pulse text-[#03440c]">
                        {viewFlowRecord.statusAuditoria === "Aprovado" ? "HOMOLOGADO" : viewFlowRecord.statusAuditoria === "Negado" ? "RECUSADO" : "PENDENTE / EM AVALIAÇÃO"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Vertical Timeline Steps */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Histórico de Alçadas e Etapas</h4>
                  <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                    {currentFlowSteps.map((step) => {
                      const isComplete = step.status === "aprovado" || step.status === "opinado" || step.status === "decidido";
                      const isRejected = step.status === "negado" || step.status === "rejeitado" || step.status === "indeferido";
                      const isPending = step.status === "pendente" || step.status === "em_avaliacao" || step.status === "aguardando";

                      return (
                        <div key={step.stepNumber} className="relative">
                          {/* Circle indicator node */}
                          <div className={`absolute -left-[22px] top-1 size-5 rounded-full border flex items-center justify-center shrink-0 z-10 ${
                            isComplete 
                              ? "bg-emerald-500 border-emerald-600 text-white" 
                              : isRejected 
                                ? "bg-rose-50 border-rose-600 text-white" 
                                : isPending && step.stepNumber === (activeFlowWf?.currentStep || 1)
                                  ? "bg-amber-100 border-amber-400 text-amber-700 animate-pulse"
                                  : "bg-white border-slate-200 text-slate-400"
                          }`}>
                            {isComplete ? <Check size={11} strokeWidth={3} /> : 
                             isRejected ? <X size={11} strokeWidth={3} /> : 
                             <span className="text-[9px] font-bold">{step.stepNumber}</span>}
                          </div>

                          {/* Content */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-slate-800">
                                Etapa {step.stepNumber}: {step.roleName}
                              </span>
                              {step.isOpinionOnly && (
                                <span className="inline-flex px-1.5 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 text-[9px] font-bold uppercase rounded-sm">
                                  Opinativo
                                </span>
                              )}
                              {isPending && step.stepNumber === (activeFlowWf?.currentStep || 1) && (
                                <span className="inline-flex px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-bold uppercase rounded-sm">
                                  Aguardando Decisão
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500">
                              Designado: <span className="font-semibold text-slate-700">{step.assignedUserName}</span>
                            </p>

                            {/* Comment speech bubble */}
                            {step.comment && (
                              <div className="mt-2 text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg p-3 relative before:absolute before:-top-3 before:left-3 before:border-8 before:border-transparent before:border-b-slate-50">
                                <p className="italic font-medium">"{step.comment}"</p>
                                {step.decidedAt && (
                                  <p className="text-[10px] text-slate-400 font-semibold mt-1">
                                    Registrado em {new Date(step.decidedAt).toLocaleString("pt-BR")}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Footer action */}
                <div className="flex items-center justify-between border-t border-slate-100 pt-5">
                  {onNavigate ? (
                    <button 
                      onClick={() => {
                        setViewFlowRecord(null);
                        onNavigate("approval_queue");
                      }}
                      className="text-xs text-[#03440c] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                    >
                      Ir para a fila oficial de aprovação <ArrowUpRight size={14} />
                    </button>
                  ) : <div />}

                  <button 
                    onClick={() => setViewFlowRecord(null)}
                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold uppercase text-[10px] tracking-wide rounded-xl transition cursor-pointer shadow-xs"
                  >
                    Fechar
                  </button>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==================== REDEFINIR STATUS (MODAL DE CONFIRMAÇÃO) ==================== */}
      <AnimatePresence>
        {resetStatusRecord && (
          <div className="fixed inset-0 z-110 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { if (!isResetting) setResetStatusRecord(null); }}
              className="absolute inset-0 bg-slate-900/45 backdrop-blur-xs"
            />
            
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden"
            >
              <div className="p-6 sm:p-8 space-y-6">
                
                {/* Warnings Header */}
                <div className="flex items-start gap-4 border-b border-slate-100 pb-5">
                  <div className="size-12 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0 shadow-3xs">
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                      Redefinição de Análise
                    </h3>
                    <p className="text-xs text-slate-400 font-semibold uppercase">{resetStatusRecord.nomeFerramenta} • ID: {resetStatusRecord.id}</p>
                  </div>
                </div>

                {/* Informative notification banner */}
                <div className="p-4 bg-amber-50/60 border border-amber-250/70 rounded-xl text-xs text-amber-900 font-medium leading-relaxed">
                  Tem certeza de que deseja redefinir o status desta IA? Ela retornará para o estado Pendente e passará pelo fluxo de aprovação desde o início.
                </div>

                {/* Justification input */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                    Motivo da redefinição (opcional)
                  </label>
                  <textarea 
                    value={resetReason}
                    onChange={(e) => setResetReason(e.target.value)}
                    disabled={isResetting}
                    placeholder="Descreva a justificativa para o reinício da análise. Esse motivo ficará documentado de forma indelével no histórico técnico da ferramenta..."
                    className="w-full h-24 bg-white border border-slate-250 text-slate-800 placeholder-slate-400 rounded-xl p-3.5 text-xs font-medium focus:border-[#03440c] focus:ring-1 focus:ring-[#03440c]/10 outline-none transition-all resize-none shadow-3xs"
                  />
                </div>

                {/* Footer confirm triggers */}
                <div className="flex items-center gap-3 pt-2">
                  <button 
                    onClick={() => {
                      setResetStatusRecord(null);
                      setResetReason("");
                    }}
                    disabled={isResetting}
                    className="flex-1 py-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-slate-200 hover:border-slate-350 font-bold uppercase text-[10px] tracking-wide rounded-xl transition-all cursor-pointer disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={async () => {
                      if (!resetStatusRecord || !onResetStatus) return;
                      setIsResetting(true);
                      try {
                        await onResetStatus(resetStatusRecord.id, resetReason);
                        setResetStatusRecord(null);
                        setResetReason("");
                      } catch (err) {
                        console.error(err);
                      } finally {
                        setIsResetting(false);
                      }
                    }}
                    disabled={isResetting}
                    className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 border border-amber-300 disabled:opacity-50 text-white font-bold uppercase text-[10px] tracking-wide rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                  >
                    {isResetting ? (
                      <>
                        <RefreshCw size={12} className="animate-spin" /> Redefinindo...
                      </>
                    ) : (
                      <>
                        <RefreshCw size={12} /> Confirmar Redefinição
                      </>
                    )}
                  </button>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==================== DROPDOWN MENU WITH PORTAL ==================== */}
      <AnimatePresence>
        {openMenuId && menuAnchor && (
          <AdminDropdownPortal
            record={records.find(r => r.id === openMenuId)!}
            anchorEl={menuAnchor}
            onClose={() => {
              setOpenMenuId(null);
              setMenuAnchor(null);
            }}
            onViewRecord={onViewRecord}
            onEditRecord={onEditRecord}
            onViewFlow={(rec) => setViewFlowRecord(rec)}
            onResetStatusTrigger={(rec) => setResetStatusRecord(rec)}
            handleArchiveRecord={handleArchiveRecord}
            isAdmin={isCurrentUserAdmin}
          />
        )}
      </AnimatePresence>

    </div>
  );
}

interface AdminDropdownPortalProps {
  record: IARecord;
  anchorEl: HTMLButtonElement;
  onClose: () => void;
  onViewRecord: (record: IARecord) => void;
  onEditRecord?: (record: IARecord) => void;
  onViewFlow: (record: IARecord) => void;
  onResetStatusTrigger: (record: IARecord) => void;
  handleArchiveRecord: (record: IARecord) => void;
  isAdmin: boolean;
}

function AdminDropdownPortal({
  record,
  anchorEl,
  onClose,
  onViewRecord,
  onEditRecord,
  onViewFlow,
  onResetStatusTrigger,
  handleArchiveRecord,
  isAdmin,
}: AdminDropdownPortalProps) {
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, placement: "bottom" });

  useEffect(() => {
    const updatePosition = () => {
      if (!anchorEl) return;
      const rect = anchorEl.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      
      const dropdownHeight = 220; // Expanded dropdown height
      const dropdownWidth = 208;  // w-52 is 13rem = 208px
      
      let fixedTop = rect.bottom + 6; // 6px padding below the context button
      let fixedLeft = rect.right - dropdownWidth; // align right
      let placement = "bottom";

      // If it overflows viewport height, invert position upwards
      if (fixedTop + dropdownHeight > viewportHeight) {
        fixedTop = rect.top - dropdownHeight - 6;
        placement = "top";
      }

      // Safeguard horizontal alignment boundaries
      if (fixedLeft < 10) {
        fixedLeft = 10;
      } else if (fixedLeft + dropdownWidth > viewportWidth - 10) {
        fixedLeft = viewportWidth - dropdownWidth - 10;
      }

      setCoords({ top: fixedTop, left: fixedLeft, placement });
    };

    updatePosition();

    // Recalculate on scroll or load
    window.addEventListener("scroll", updatePosition, { passive: true });
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition);
      window.removeEventListener("resize", updatePosition);
    };
  }, [anchorEl]);

  // Handle keyboard (Escape) and click-outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        anchorEl && !anchorEl.contains(target)
      ) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [anchorEl, onClose]);

  // Check if reset action should be visible based on status
  const showResetAction = isAdmin && (record.statusAuditoria === StatusAuditoria.APROVADO || record.statusAuditoria === StatusAuditoria.NEGADO);

  return createPortal(
    <motion.div
      ref={dropdownRef}
      initial={{ opacity: 0, scale: 0.95, y: coords.placement === "bottom" ? -5 : 5 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: coords.placement === "bottom" ? -5 : 5 }}
      transition={{ duration: 0.15 }}
      style={{
        position: "fixed",
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        width: "13rem", // w-52
      }}
      className="bg-white border border-slate-200 rounded-xl shadow-lg z-100 py-1.5 focus:outline-none"
    >
      <button 
        onClick={() => { onClose(); onViewRecord(record); }}
        className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-950 font-medium flex items-center gap-2.5 transition-colors cursor-pointer"
      >
        <SheetIcon size={14} className="text-slate-400" /> Visualizar detalhes
      </button>
      <button 
        onClick={() => { onClose(); onEditRecord?.(record); }}
        className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-950 font-medium flex items-center gap-2.5 transition-colors cursor-pointer"
      >
        <Sliders size={14} className="text-slate-400" /> Editar registro
      </button>
      <button 
        onClick={() => { onClose(); onViewFlow(record); }}
        className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-950 font-medium flex items-center gap-2.5 transition-colors cursor-pointer"
      >
        <FolderLock size={14} className="text-slate-400" /> Visualizar fluxo
      </button>
      <button 
        onClick={() => { onClose(); onViewRecord(record); }}
        className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-950 font-medium flex items-center gap-2.5 transition-colors cursor-pointer"
      >
        <Calendar size={14} className="text-slate-400" /> Visualizar histórico
      </button>

      {showResetAction && (
        <>
          <div className="h-px bg-slate-100 my-1"></div>
          <button 
            onClick={() => { onClose(); onResetStatusTrigger(record); }}
            className="w-full text-left px-4 py-2 text-xs text-amber-600 hover:bg-amber-50 hover:text-amber-700 font-semibold flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <RefreshCw size={14} className="text-amber-500 animate-hover-spin" /> Redefinir status
          </button>
        </>
      )}

      <div className="h-px bg-slate-100 my-1"></div>
      <button 
        onClick={() => { onClose(); handleArchiveRecord(record); }}
        className="w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-rose-50/50 hover:text-red-700 font-semibold flex items-center gap-2.5 transition-colors cursor-pointer"
      >
        <Trash2 size={14} className="text-red-500" /> Arquivar registro
      </button>
    </motion.div>,
    document.body
  );
}

// Simple internal indicator icon fallback helper
function SheetIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}
