/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { CustomDropdown } from "./CustomDropdown";
import { 
  Building2, 
  Plus, 
  Search, 
  Users, 
  Database, 
  AlertCircle, 
  Check, 
  X,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  User,
  Activity,
  FileText,
  SlidersHorizontal,
  CircleDot,
  Briefcase,
  Lightbulb,
  Cpu,
  Megaphone,
  Scale,
  ClipboardCheck,
  FlaskConical,
  Microscope
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { IARecord, UserProfile } from "../types";
import { getSectors, saveSectors } from "../storage";
import { supabase } from "../lib/supabase";

interface SectorsProps {
  records: IARecord[];
  profiles: UserProfile[];
  onRefresh?: () => void;
  approvalConfig?: any;
  onSaveApprovalConfig?: any;
}

interface SectorDetail {
  description: string;
  responsible: string;
  status: "Ativo" | "Inativo";
  cargos?: string[];
}

// Predefined detailed description & representatives mapping of institutional sectors
const PRESET_SECTORS_DETAILS: Record<string, SectorDetail> = {
  "NIT": {
    description: "Núcleo de Inovação e Tecnologia responsável por pesquisa, desenvolvimento e inovação estruturada do laboratório.",
    responsible: "Ricardo Almeida",
    status: "Ativo",
    cargos: ["Pesquisador de IA", "Analista de Inovação", "Gestor de Portfólio", "Engenheiro de Processos"]
  },
  "TI": {
    description: "Gerencia a infraestrutura cibernética, servidores locais, sistemas internos e suporte tecnológico de alta performance.",
    responsible: "Mariana Souza",
    status: "Ativo",
    cargos: ["Analista de Suporte", "Administrador de Sistemas", "Desenvolvedor de Software", "Engenheiro de Dados"]
  },
  "Marketing": {
    description: "Responsável pela comunicação institucional, reputação de marca e relacionamento estratégico com o público.",
    responsible: "Juliana Martins",
    status: "Ativo",
    cargos: ["Analista de Comunicação", "Designer Gráfico", "Especialista em SEO", "Social Media"]
  },
  "Administrativo": {
    description: "Cuida do planejamento estratégico administrativo, fluxos financeiros e suporte de governança corporativa.",
    responsible: "Carlos Henrique",
    status: "Ativo",
    cargos: ["Auxiliar Administrativo", "Assistente Financeiro", "Gerente de Operações", "Analista de Contratos"]
  },
  "Jurídico": {
    description: "Responsável pelo suporte legal, conformidade com a LGPD, redação de contratos e assessoria regulatória geral.",
    responsible: "Beatriz Lima",
    status: "Ativo",
    cargos: ["Advogado Integrado", "Assessor LGPD", "Consultor Regulatório", "Assistente Jurídico"]
  },
  "Direção Técnica": {
    description: "Liderança médica, supervisão de laudos técnicos e garantia irrestrita de qualidade analítica laboratorial.",
    responsible: "Dr. Felipe Costa",
    status: "Ativo",
    cargos: ["Diretor Técnico", "Supervisor Analítico", "Responsável Técnico", "Auditor Médico"]
  },
  "Qualidade": {
    description: "Coordena acreditações de qualidade, aplicação jurídica de normas ISO e planos de verificação de processos sanitários.",
    responsible: "Ana Teresa",
    status: "Ativo",
    cargos: ["Gestor de Qualidade", "Analista de Qualidade", "Auditor de Processos", "Inspetor Sanitário"]
  },
  "Atendimento / Recepção": {
    description: "Suporte direto do público na triagem, agendamentos presenciais e pesquisa ativa de satisfação clínica.",
    responsible: "Fernanda Costa",
    status: "Ativo",
    cargos: ["Recepcionista", "Atendente Técnico", "Supervisor de Relacionamento", "Auxiliar de Caixa"]
  },
  "Laboratório de Patologia": {
    description: "Preparação macroscópica de biópsias, análises citológicas detalhadas e controle de laudos imuno-histoquímicos.",
    responsible: "Dr. Sergio Morais",
    status: "Ativo",
    cargos: ["Médico Patologista", "Técnico em Histologia", "Citotécnico", "Auxiliar de Laboratório"]
  },
  "Laboratório Central": {
    description: "Processamento automatizado de exames bioquímicos e hematológicos de rotina clínica emergencial ou diagnóstica.",
    responsible: "Dra. Heloísa Abreu",
    status: "Ativo",
    cargos: ["Biomédico Palestrante", "Técnico em Análises Clínicas", "Farmacêutico Bioquímico", "Auxiliar de Coleta"]
  }
};

/**
 * Returns dynamic professional icons styled for standard department designations
 */
function getSectorIcon(name: string) {
  const norm = name.toLowerCase().trim();
  if (norm.includes("nit") || norm.includes("inovação") || norm.includes("tecnologia")) return Lightbulb;
  if (norm.includes("ti") || norm.includes("tecnologia da informação") || norm.includes("infraestrutura") || norm.includes("suporte")) return Cpu;
  if (norm.includes("marketing") || norm.includes("comunicação")) return Megaphone;
  if (norm.includes("administrativo") || norm.includes("financeiro") || norm.includes("diretoria") || norm.includes("corporativo")) return Briefcase;
  if (norm.includes("jurídico") || norm.includes("legal") || norm.includes("contratos")) return Scale;
  if (norm.includes("técnica") || norm.includes("direção técnica")) return Activity;
  if (norm.includes("qualidade") || norm.includes("gestão de qualidade")) return ClipboardCheck;
  if (norm.includes("atendimento") || norm.includes("recepção")) return Users;
  if (norm.includes("patologia") || norm.includes("biópsia")) return Microscope;
  if (norm.includes("central") || norm.includes("laboratório")) return FlaskConical;
  return Building2;
}

export default function SectorsManager({ records, profiles, onRefresh }: SectorsProps) {
  const [sectors, setSectors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusSelect, setStatusSelect] = useState<"All" | "Ativo" | "Inativo">("All");
  const [quickFilter, setQuickFilter] = useState<"All" | "Active" | "Inactive" | "WithIA" | "WithoutIA">("All");
  
  // Sector Meta Info Dictionary
  const [sectorDetails, setSectorDetails] = useState<Record<string, SectorDetail>>(PRESET_SECTORS_DETAILS);

  // Action states
  const [activeMenuSector, setActiveMenuSector] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Modal form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | "view">("create");
  const [selectedSectorName, setSelectedSectorName] = useState<string | null>(null);
  const [deleteConfirmSector, setDeleteConfirmSector] = useState<string | null>(null);
  
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formResponsible, setFormResponsible] = useState("");
  const [formStatus, setFormStatus] = useState<"Ativo" | "Inativo">("Ativo");
  const [formCargos, setFormCargos] = useState<string[]>([]);
  const [newCargoInput, setNewCargoInput] = useState("");

  const itemVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { type: "spring", stiffness: 220, damping: 22 } 
    }
  };

  const isNameDuplicate = 
    modalMode === "create"
      ? (formName.trim() !== "" && sectors.some(s => s.toLowerCase().trim() === formName.toLowerCase().trim()))
      : modalMode === "edit"
      ? (selectedSectorName !== null && formName.trim() !== "" && formName.toLowerCase().trim() !== selectedSectorName.toLowerCase().trim() && sectors.some(s => s.toLowerCase().trim() === formName.toLowerCase().trim()))
      : false;

  // Load baseline sector names from DB / storage
  const fetchSectorsList = async () => {
    setLoading(true);
    try {
      const list = await getSectors();
      setSectors(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSectorsList();
  }, []);

  useEffect(() => {
    const loadSectorDetails = async () => {
      const { data, error } = await supabase
        .from("sectors")
        .select("name, description, responsible, status, cargos");
      
      if (!error && data && data.length > 0) {
        const details: Record<string, SectorDetail> = {};
        data.forEach((row: any) => {
          details[row.name] = {
            description: row.description || "",
            responsible: row.responsible || "",
            status: row.status || "Ativo",
            cargos: Array.isArray(row.cargos) ? row.cargos : ["Colaborador"]
          };
        });
        setSectorDetails(details);
      }
    };
    loadSectorDetails();
  }, []);

  // Merge dynamic properties and metrics with sector names
  const sectorsWithMetrics = useMemo(() => {
    return sectors.map(sectorName => {
      const sectorIAs = records.filter(r => (r.unidadeSetor || "").trim().toLowerCase() === sectorName.trim().toLowerCase());
      const sectorProfiles = profiles.filter(p => (p.setor || "").trim().toLowerCase() === sectorName.trim().toLowerCase());
      
      const details = sectorDetails[sectorName] || PRESET_SECTORS_DETAILS[sectorName] || {
        description: `Setor estratégico para suporte analítico e operações do Laboratório Cedro.`,
        responsible: "Gestor Cedro",
        status: "Ativo" as const
      };

      return {
        name: sectorName,
        iaCount: sectorIAs.length,
        userCount: sectorProfiles.length,
        description: details.description,
        responsible: details.responsible,
        status: details.status
      };
    });
  }, [sectors, records, profiles, sectorDetails]);

  // Unified filtering: statusSelect, quickFilter, searchTerm
  const filteredSectors = useMemo(() => {
    return sectorsWithMetrics.filter(sec => {
      // 1. Search term (matches name, description or responsible)
      const matchesSearch = !searchTerm.trim() || 
        sec.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sec.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sec.responsible.toLowerCase().includes(searchTerm.toLowerCase());

      // 2. Status Select filter
      const matchesStatusSelect = statusSelect === "All" || sec.status === statusSelect;

      // 3. Quick select chips
      let matchesQuick = true;
      if (quickFilter === "Active") matchesQuick = sec.status === "Ativo";
      if (quickFilter === "Inactive") matchesQuick = sec.status === "Inativo";
      if (quickFilter === "WithIA") matchesQuick = sec.iaCount > 0;
      if (quickFilter === "WithoutIA") matchesQuick = sec.iaCount === 0;

      return matchesSearch && matchesStatusSelect && matchesQuick;
    });
  }, [sectorsWithMetrics, searchTerm, statusSelect, quickFilter]);

  // Stats calculation for Summary panel
  const statsSummary = useMemo(() => {
    const total = sectorsWithMetrics.length;
    const active = sectorsWithMetrics.filter(s => s.status === "Ativo").length;
    const withIA = sectorsWithMetrics.filter(s => s.iaCount > 0).length;
    const totalIAs = records.length;
    
    // total from profiles prop
    const totalProfiles = profiles.length;
    
    const withoutIA = Math.max(0, total - withIA);
    const withIAPercent = total > 0 ? Math.round((withIA / total) * 100) : 0;
    const withoutIAPercent = total > 0 ? 100 - withIAPercent : 0;

    return {
      total,
      active,
      withIA,
      withoutIA,
      totalIAs,
      totalProfiles,
      withIAPercent,
      withoutIAPercent
    };
  }, [sectorsWithMetrics, records, profiles]);

  // Pagination bounds checking
  const totalPages = Math.ceil(filteredSectors.length / itemsPerPage) || 1;
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const paginatedSectors = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredSectors.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredSectors, currentPage]);

  // Click outside to close actions menu helper
  useEffect(() => {
    const handleOutsideClick = () => setActiveMenuSector(null);
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  // Form Handlers
  const handleOpenCreateModal = () => {
    setModalMode("create");
    setSelectedSectorName(null);
    setFormName("");
    setFormDescription("");
    setFormResponsible("");
    setFormStatus("Ativo");
    setFormCargos(["Colaborador"]);
    setNewCargoInput("");
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (sec: typeof sectorsWithMetrics[0]) => {
    setModalMode("edit");
    setSelectedSectorName(sec.name);
    setFormName(sec.name);
    setFormDescription(sec.description);
    setFormResponsible(sec.responsible);
    setFormStatus(sec.status);
    
    const details = sectorDetails[sec.name] || PRESET_SECTORS_DETAILS[sec.name] || {};
    setFormCargos(details.cargos || ["Colaborador"]);
    setNewCargoInput("");
    
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleOpenViewModal = (sec: typeof sectorsWithMetrics[0]) => {
    setModalMode("view");
    setSelectedSectorName(sec.name);
    setFormName(sec.name);
    setFormDescription(sec.description);
    setFormResponsible(sec.responsible);
    setFormStatus(sec.status);
    
    const details = sectorDetails[sec.name] || PRESET_SECTORS_DETAILS[sec.name] || {};
    setFormCargos(details.cargos || ["Colaborador"]);
    setNewCargoInput("");
    
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (sectorName: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const current = sectorDetails[sectorName] || PRESET_SECTORS_DETAILS[sectorName] || {
      description: "Setor estratégico Cedro.",
      responsible: "Gestor Cedro",
      status: "Ativo"
    };

    const newStatus = current.status === "Ativo" ? "Inativo" : "Ativo";
    
    setSectorDetails(prev => ({
      ...prev,
      [sectorName]: {
        ...current,
        status: newStatus
      }
    }));
    await supabase.from("sectors")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("name", sectorName);

    setSuccessMsg(`O status do setor "${sectorName}" foi alterado para ${newStatus}.`);
  };

  const handleDeleteSector = async (sectorName: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const updatedSectors = sectors.filter(s => s !== sectorName);
    const previousSectors = [...sectors];
    setSectors(updatedSectors);

    // 1. Deletar do banco Supabase na tabela "sectors" primeiro
    try {
      const { error: deleteError } = await supabase.from("sectors").delete().eq("name", sectorName);
      
      if (deleteError) {
        console.error("Erro ao deletar setor do Supabase:", deleteError);
        setErrorMsg(`Não foi possível apagar no Supabase: ${deleteError.message}`);
        setSectors(previousSectors); // rollback
        return;
      }
      
      // 2. Com a remoção garantida, atualizar o metadata secundário e detalhes locais
      const ok = await saveSectors(updatedSectors);
      if (ok) {
        setSectorDetails(prev => {
          const next = { ...prev };
          delete next[sectorName];
          return next;
        });
        setSuccessMsg(`Setor "${sectorName}" removido com sucesso.`);
        if (onRefresh) onRefresh();
      } else {
        setErrorMsg("Erro ao atualizar o cache e metadados de listagem após exclusão.");
        setSectors(previousSectors); // rollback
      }
    } catch (e: any) {
      console.error("Erro inesperado na exclusão do setor:", e);
      setErrorMsg(`Erro inesperado ao excluir: ${e.message || e}`);
      setSectors(previousSectors); // rollback
    }
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const sName = formName.trim();
    if (!sName) return;

    if (modalMode === "create") {
      // Check duplicate
      if (sectors.some(s => s.toLowerCase().trim() === sName.toLowerCase())) {
        setErrorMsg("Este setor já existe.");
        return;
      }

      const updated = [...sectors, sName];
      setSectors(updated);
      const ok = await saveSectors(updated);
      if (ok) {
        setSectorDetails(prev => ({
          ...prev,
          [sName]: {
            description: formDescription.trim() || "Setor de saúde e governança corporativa.",
            responsible: formResponsible.trim() || "Não especificado",
            status: formStatus,
            cargos: formCargos.length > 0 ? formCargos : ["Colaborador"]
          }
        }));
        await supabase.from("sectors").upsert({
          name: sName,
          description: formDescription.trim() || "Setor de saúde e governança corporativa.",
          responsible: formResponsible.trim() || "Não especificado",
          status: formStatus,
          cargos: formCargos.length > 0 ? formCargos : ["Colaborador"],
          updated_at: new Date().toISOString()
        }, { onConflict: "name" });
        setSuccessMsg(`Setor "${sName}" criado com sucesso!`);
        setIsModalOpen(false);
        if (onRefresh) onRefresh();
      } else {
        setErrorMsg("Falha ao salvar o novo setor. Verifique a conexão.");
        setSectors(sectors); // Rollback
      }

    } else if (modalMode === "edit" && selectedSectorName) {
      let updatedSectors = [...sectors];
      if (selectedSectorName.toLowerCase() !== sName.toLowerCase()) {
        const isDuplicateOfOther = sectors.some(s => s.toLowerCase() === sName.toLowerCase() && s.toLowerCase() !== selectedSectorName.toLowerCase());
        if (isDuplicateOfOther) {
          setErrorMsg("Já existe outro setor com este nome.");
          return;
        }
        // rename
        updatedSectors = sectors.map(s => s === selectedSectorName ? sName : s);
      }

      setSectors(updatedSectors);
      const ok = await saveSectors(updatedSectors);
      if (ok) {
        setSectorDetails(prev => {
          const next = { ...prev };
          if (selectedSectorName !== sName) {
            delete next[selectedSectorName];
          }
          next[sName] = {
            description: formDescription.trim() || "Setor de saúde e governança.",
            responsible: formResponsible.trim() || "Não especificado",
            status: formStatus,
            cargos: formCargos.length > 0 ? formCargos : ["Colaborador"]
          };
          return next;
        });
        await supabase.from("sectors").upsert({
          name: sName,
          description: formDescription.trim() || "Setor de saúde e governança.",
          responsible: formResponsible.trim() || "Não especificado",
          status: formStatus,
          cargos: formCargos.length > 0 ? formCargos : ["Colaborador"],
          updated_at: new Date().toISOString()
        }, { onConflict: "name" });

        // Se o nome mudou, deletar o registro antigo
        if (selectedSectorName !== sName) {
          await supabase.from("sectors").delete().eq("name", selectedSectorName);
        }

        // Update records in local lists dynamically if any mismatch
        setSuccessMsg(`Setor "${sName}" atualizado com sucesso.`);
        setIsModalOpen(false);
        if (onRefresh) onRefresh();
      } else {
        setErrorMsg("Erro ao persistir mudanças no banco.");
        setSectors(sectors);
      }
    }
  };

  return (
    <div id="sectors-dashboard-view" className="space-y-6 pb-16 font-sans text-slate-800">
      
      {/* 1. CABEÇALHO DA PÁGINA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Setores
          </h1>
        </div>
      </div>

      {/* Temporarily alerts display */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-250 text-emerald-800 rounded-xl text-xs flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-sans font-medium">
            <Check size={14} /> {successMsg}
          </span>
          <button onClick={() => setSuccessMsg(null)} className="hover:text-emerald-900 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-250 text-red-800 rounded-xl text-xs flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-sans font-medium">
            <AlertCircle size={14} /> {errorMsg}
          </span>
          <button onClick={() => setErrorMsg(null)} className="hover:text-red-900 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* 2. BARRA DE FILTROS E AÇÕES */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          
          {/* Campo de Busca */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Buscar setores, responsáveis ou descrições..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-250 rounded-xl text-xs outline-none text-slate-800 focus:bg-white focus:border-[#03440c] transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Select Status */}
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={12} className="text-slate-400" />
              <CustomDropdown
                value={statusSelect}
                onChange={(val) => { setStatusSelect(val as any); setCurrentPage(1); }}
                options={[
                  { value: "All", label: "Todos os status" },
                  { value: "Ativo", label: "Ativo" },
                  { value: "Inativo", label: "Inativo" }
                ]}
                size="sm"
                className="w-36"
              />
            </div>

            {/* CTA action button */}
            <button
              onClick={handleOpenCreateModal}
              className="bg-[#03440c] hover:bg-[#02330a] text-white font-bold text-xs px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer h-9 shadow-xs"
            >
              <Plus size={14} /> Cadastrar setor
            </button>
          </div>
        </div>

        {/* Quick Filters Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mr-1">Filtros Rápidos:</span>
          
          {[
            { id: "All", label: "Todos" },
            { id: "Active", label: "Ativos" },
            { id: "Inactive", label: "Inativos" },
            { id: "WithIA", label: "Com IA" },
            { id: "WithoutIA", label: "Sem IA" }
          ].map((chip) => (
            <button
              key={chip.id}
              onClick={() => { setQuickFilter(chip.id as any); setCurrentPage(1); }}
              className={`text-[11px] font-semibold px-3 py-1 rounded-full transition-all cursor-pointer ${
                quickFilter === chip.id 
                  ? "bg-[#03440c]/10 text-[#03440c] border border-[#03440c]/25 font-bold" 
                  : "bg-slate-100 text-slate-650 hover:bg-slate-200 border border-transparent"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. CORPO PRINCIPAL EM DUAS COLUNAS */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        
        {/* COLUNA ESQUERDA — CARD DE RESUMO GERAL (xl:col-span-1) */}
        <div className="xl:col-span-1 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col space-y-5">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider block border-l-2 border-[#03440c] pl-2">
                Resumo geral
              </h3>
              <p className="text-[10px] text-slate-450 mt-1 uppercase tracking-tight">Estatísticas Institucionais</p>
            </div>

            {/* List indicators stacked */}
            <div className="space-y-3.5">
              
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-slate-50 border border-slate-150 flex items-center justify-center text-slate-600">
                  <Building2 size={14} />
                </div>
                <div>
                  <p className="text-[10px] text-slate-450 font-medium uppercase tracking-tight leading-none mb-0.5">Total de setores</p>
                  <p className="text-sm font-bold text-slate-800">{statsSummary.total}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-emerald-50 border border-emerald-150 flex items-center justify-center text-emerald-600">
                  <Check size={14} />
                </div>
                <div>
                  <p className="text-[10px] text-slate-450 font-medium uppercase tracking-tight leading-none mb-0.5">Setores ativos</p>
                  <p className="text-sm font-bold text-slate-800">{statsSummary.active}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-indigo-50 border border-indigo-150 flex items-center justify-center text-indigo-600">
                  <Activity size={14} />
                </div>
                <div>
                  <p className="text-[10px] text-slate-450 font-medium uppercase tracking-tight leading-none mb-0.5">Setores com IA</p>
                  <p className="text-sm font-bold text-slate-800">{statsSummary.withIA}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-amber-50 border border-amber-150 flex items-center justify-center text-amber-600">
                  <Database size={14} />
                </div>
                <div>
                  <p className="text-[10px] text-slate-450 font-medium uppercase tracking-tight leading-none mb-0.5">Total de soluções (IAs)</p>
                  <p className="text-sm font-bold text-slate-800">{statsSummary.totalIAs}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
                  <Users size={14} />
                </div>
                <div>
                  <p className="text-[10px] text-slate-450 font-medium uppercase tracking-tight leading-none mb-0.5">Colaboradores (perfis)</p>
                  <p className="text-sm font-bold text-slate-800">{statsSummary.totalProfiles}</p>
                </div>
              </div>

            </div>

            {/* Distribution chart subpart */}
            <div className="border-t border-slate-100 pt-5 space-y-3.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Distribuição por IA
              </span>

              <div className="flex items-center gap-4">
                {/* Donut chart visualization in clean SVG circles */}
                <div className="relative size-16 flex-shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 36 36" className="size-16 rotate-[-90deg]">
                    {/* Background Ring */}
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#e2e8f0" strokeWidth="3.5" />
                    {/* Segment Ring (Com IA) */}
                    <circle 
                      cx="18" 
                      cy="18" 
                      r="15.915" 
                      fill="none" 
                      stroke="#03440c" 
                      strokeWidth="3.5" 
                      strokeDasharray={`${statsSummary.withIAPercent} ${100 - statsSummary.withIAPercent}`} 
                      strokeDashoffset="0" 
                      className="transition-all duration-500 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xs font-bold text-slate-800">{statsSummary.withIAPercent}%</span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 justify-between">
                    <span className="flex items-center gap-1 leading-none truncate">
                      <span className="size-2 rounded-full bg-[#03440c] block" />
                      Com IA
                    </span>
                    <span className="font-bold text-slate-800 whitespace-nowrap">
                      {statsSummary.withIA} ({statsSummary.withIAPercent}%)
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1.5 justify-between">
                    <span className="flex items-center gap-1 leading-none truncate">
                      <span className="size-2 rounded-full bg-slate-250 border border-slate-400 block" />
                      Sem IA
                    </span>
                    <span className="font-semibold text-slate-500 whitespace-nowrap">
                      {statsSummary.withoutIA} ({statsSummary.withoutIAPercent}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* COLUNA DIREITA — GRADE DE SETORES (xl:col-span-3) */}
        <div className="xl:col-span-3 space-y-6">
          {loading ? (
            <div className="py-24 text-center text-slate-500 bg-white border border-slate-200 rounded-2xl">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#03440c] mx-auto mb-4"></div>
              <span className="text-xs font-semibold">Carregando setores da governança analítica...</span>
            </div>
          ) : paginatedSectors.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatePresence mode="popLayout">
                {paginatedSectors.map((sec) => {
                  const IconComponent = getSectorIcon(sec.name);

                  return (
                    <motion.div
                      key={sec.name}
                      layout
                      initial={{ opacity: 0, scale: 0.97, y: 6 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.97, y: -6 }}
                      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                      className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:shadow-sm hover:border-slate-350 transition-all flex flex-col justify-between space-y-4 relative"
                    >
                      {/* Top Row header */}
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {/* Bullet/Led visual accent representing laboratory standard sample indicator */}
                          <div className="size-2 rounded-full bg-[#03440c] shrink-0 animate-pulse" />
                          <div className="min-w-0">
                            <h3 className="text-[13px] font-bold text-slate-800 uppercase tracking-tight truncate leading-tight hover:text-[#03440c] cursor-pointer" onClick={() => handleOpenViewModal(sec)} title={sec.name}>
                              {sec.name}
                            </h3>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 relative">
                          {/* Status Badge */}
                          <button
                            onClick={() => handleToggleStatus(sec.name)}
                            className={`text-[8.5px] font-bold px-2 py-0.5 rounded uppercase tracking-wider transition-colors cursor-pointer ${
                              sec.status === "Ativo" 
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-150 hover:bg-emerald-100" 
                                : "bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-150"
                            }`}
                            title="Clique para alternar o status"
                          >
                            {sec.status}
                          </button>

                          {/* Options dropdown button */}
                          <div className="relative">
                            <button
                              onClick={(e) => { e.stopPropagation(); setActiveMenuSector(prev => prev === sec.name ? null : sec.name); }}
                              className="size-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer transition-colors"
                            >
                              <MoreVertical size={14} />
                            </button>

                            {/* Options Float Dropdown Menu */}
                            {activeMenuSector === sec.name && (
                              <div 
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-20 text-[11px] font-semibold text-slate-700 animate-fade-in"
                              >
                                <button 
                                  onClick={() => { handleOpenViewModal(sec); setActiveMenuSector(null); }} 
                                  className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 transition-colors block"
                                >
                                  Visualizar detalhes
                                </button>
                                <button 
                                  onClick={() => { handleOpenEditModal(sec); setActiveMenuSector(null); }} 
                                  className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 transition-colors block text-slate-800"
                                >
                                  Editar setor
                                </button>
                                <button 
                                  onClick={() => { handleToggleStatus(sec.name); setActiveMenuSector(null); }} 
                                  className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 transition-colors block text-emerald-850"
                                >
                                  Marcar como {sec.status === "Ativo" ? "Inativo" : "Ativo"}
                                </button>
                                <div className="border-t border-slate-100 my-1"></div>
                                <button 
                                  onClick={() => { handleDeleteSector(sec.name); setActiveMenuSector(null); }} 
                                  className="w-full text-left px-3.5 py-1.5 hover:bg-red-50 text-red-600 transition-colors block font-bold"
                                >
                                  Excluir
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Brief description column */}
                      <p className="text-xs text-slate-600 leading-relaxed font-normal flex-1 line-clamp-2 min-h-[2.5rem]">
                        {sec.description}
                      </p>

                      {/* Lower metrics stats bar */}
                      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-[10px] font-semibold text-slate-500">
                        <div className="space-y-0.5">
                          <span className="text-slate-400 block text-[8px] uppercase tracking-wider">IAs</span>
                          <span className="font-bold text-slate-750 flex items-center gap-1 font-mono">
                            <Database size={11} className="text-[#03440c]" /> {sec.iaCount.toString().padStart(2, "0")} instâncias
                          </span>
                        </div>
                        
                        <div className="space-y-0.5">
                          <span className="text-slate-400 block text-[8px] uppercase tracking-wider">Colaboradores</span>
                          <span className="font-bold text-slate-750 flex items-center gap-1 font-mono">
                            <Users size={11} className="text-[#03440c]" /> {sec.userCount.toString().padStart(2, "0")} perfis
                          </span>
                        </div>

                        <div className="space-y-0.5 min-w-0">
                          <span className="text-slate-400 block text-[8px] uppercase tracking-wider">Responsável</span>
                          <span className="font-bold text-slate-750 block truncate" title={sec.responsible}>
                            {sec.responsible}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          ) : (
            <div className="py-20 text-center bg-white border border-slate-200 border-dashed rounded-3xl space-y-3">
              <Building2 className="text-slate-300 mx-auto" size={40} />
              <h4 className="text-sm font-bold text-slate-700">Nenhum setor cadastrado</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">Nenhum departamento atende aos parâmetros atuais dos filtros aplicados.</p>
              <button 
                onClick={() => { setSearchTerm(""); setStatusSelect("All"); setQuickFilter("All"); }}
                className="text-xs font-bold text-[#03440c] bg-[#03440c]/10 px-3.5 py-1.5 rounded-xl hover:bg-[#03440c]/15 cursor-pointer transition-colors"
              >
                Limpar filtros
              </button>
            </div>
          )}

          {/* 4. PAGINAÇÃO NO RODAPÉ */}
          {filteredSectors.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 text-xs font-medium text-slate-500">
              {/* Text indicator to the left */}
              <span>
                Mostrando <span className="font-bold text-slate-700">{Math.min(filteredSectors.length, (currentPage - 1) * itemsPerPage + 1)}</span> a{" "}
                <span className="font-bold text-slate-700">{Math.min(filteredSectors.length, currentPage * itemsPerPage)}</span> de{" "}
                <span className="font-bold text-slate-700">{filteredSectors.length}</span> setores
              </span>

              {/* Paginated actions buttons list */}
              <div className="flex items-center gap-1.5">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="size-8 rounded-lg border border-slate-205 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>

                {Array.from({ length: totalPages }).map((_, i) => {
                  const pNum = i + 1;
                  return (
                    <button
                      key={pNum}
                      onClick={() => setCurrentPage(pNum)}
                      className={`size-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        currentPage === pNum
                          ? "bg-[#03440c] text-white"
                          : "border border-slate-205 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {pNum}
                    </button>
                  );
                })}

                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="size-8 rounded-lg border border-slate-205 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
        
      </div>

      {/* 5. POPUP / MODAL DE DETALHES, CRIAÇÃO E EDIÇÃO DO SETOR */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop Filter */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            />

            {/* Modal Body */}
            <motion.div
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={{
                hidden: { opacity: 0, scale: 0.98, y: 8 },
                visible: { 
                  opacity: 1, 
                  scale: 1, 
                  y: 0,
                  transition: {
                    staggerChildren: 0.04,
                    delayChildren: 0.02
                  }
                }
              }}
              className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                <div>
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-0.5">
                    Cedro GRC - Gestão Departamental
                  </span>
                  <h3 className="text-base font-bold text-slate-800 uppercase tracking-tight">
                    {modalMode === "create" ? "Cadastrar novo setor" : modalMode === "edit" ? "Editar Setor" : "Detalhes do Setor"}
                  </h3>
                </div>

                <button
                  onClick={() => setIsModalOpen(false)}
                  className="size-9 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-750 cursor-pointer border border-transparent hover:border-slate-300 transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Form Content body */}
              <form onSubmit={handleSaveForm} className="flex-1 overflow-y-auto p-6 space-y-4">
                
                {/* 2 columns layout on desktop to match precise reference */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Nome do setor */}
                  <motion.div variants={itemVariants} className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Nome do Setor *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Endocrinologia, Nit..."
                      disabled={modalMode === "view"}
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className={`w-full px-3.5 py-2.5 disabled:bg-slate-100 border disabled:text-slate-500 rounded-xl text-xs outline-none focus:bg-white transition-all font-semibold ${
                        isNameDuplicate 
                          ? "border-red-300 text-red-900 bg-red-50/25 focus:border-red-500" 
                          : "bg-slate-50 border-slate-250 text-slate-800 focus:border-[#03440c]"
                      }`}
                    />
                    {isNameDuplicate && (
                      <span className="text-[10px] font-bold text-red-650 tracking-tight block mt-1 animate-pulse">
                        ⚠️ Este setor já está cadastrado no sistema.
                      </span>
                    )}
                  </motion.div>

                  {/* Responsável */}
                  <motion.div variants={itemVariants} className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Responsável / Diretor *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Mariana Souza..."
                      disabled={modalMode === "view"}
                      value={formResponsible}
                      onChange={(e) => setFormResponsible(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 disabled:bg-slate-100 border border-slate-250 disabled:text-slate-500 rounded-xl text-xs outline-none focus:bg-white focus:border-[#03440c] transition-all font-semibold text-slate-800"
                    />
                  </motion.div>

                </div>

                {/* Status */}
                <motion.div variants={itemVariants} className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Status do Setor</label>
                  <div className="flex items-center gap-4 pt-1">
                    <label className={`flex items-center gap-2 cursor-pointer text-xs font-semibold px-4 py-2 border rounded-xl transition-all ${
                      formStatus === "Ativo" 
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300 font-bold" 
                        : "bg-slate-50 hover:bg-slate-100 border-slate-250 text-slate-600"
                    }`}>
                      <input
                        type="radio"
                        name="modal_status"
                        value="Ativo"
                        disabled={modalMode === "view"}
                        checked={formStatus === "Ativo"}
                        onChange={() => setFormStatus("Ativo")}
                        className="accent-[#03440c]"
                      />
                      Setor Ativo
                    </label>

                    <label className={`flex items-center gap-2 cursor-pointer text-xs font-semibold px-4 py-2 border rounded-xl transition-all ${
                      formStatus === "Inativo" 
                        ? "bg-red-50 text-red-800 border-red-300 font-bold" 
                        : "bg-slate-50 hover:bg-slate-100 border-slate-250 text-slate-600"
                    }`}>
                      <input
                        type="radio"
                        name="modal_status"
                        value="Inativo"
                        disabled={modalMode === "view"}
                        checked={formStatus === "Inativo"}
                        onChange={() => setFormStatus("Inativo")}
                        className="accent-red-650"
                      />
                      Setor Inativo
                    </label>
                  </div>
                </motion.div>

                {/* Descrição */}
                <motion.div variants={itemVariants} className="space-y-1.5 pt-1">
                  <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Histórico / Descrição Institucional *</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Escreva breve resumo operacional descrevendo as atribuições, pesquisa ou fluxos de negócio sob custódia operacional deste setor..."
                    disabled={modalMode === "view"}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 disabled:bg-slate-100 border border-slate-250 disabled:text-slate-500 rounded-xl text-xs outline-none focus:bg-white focus:border-[#03440c] transition-all resize-none leading-relaxed font-sans text-slate-700"
                  />
                </motion.div>

                {/* Cargos / Funções no Setor */}
                <motion.div variants={itemVariants} className="space-y-2 border-t border-slate-100 pt-4">
                  <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">
                    Cargos / Funções Cadastrados para este Setor *
                  </label>
                  
                  {/* List of badges */}
                  <div className="flex flex-wrap gap-2 py-1">
                    {formCargos.length === 0 ? (
                      <span className="text-xs text-slate-450 italic">Nenhum cargo cadastrado. Adicione pelo menos um.</span>
                    ) : (
                      formCargos.map((cargoItem, idx) => (
                        <div 
                          key={idx} 
                          className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-150 text-[#03440c] rounded-full text-xs font-semibold"
                        >
                          <span>{cargoItem}</span>
                          {modalMode !== "view" && (
                            <button
                              type="button"
                              onClick={() => setFormCargos(formCargos.filter(c => c !== cargoItem))}
                              className="text-slate-400 hover:text-red-700 cursor-pointer transition-colors"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {modalMode !== "view" && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Adicionar novo cargo (ex: Analista de TI, Médico Patologista)"
                        value={newCargoInput || ""}
                        onChange={(e) => setNewCargoInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const val = newCargoInput.trim();
                            if (val && !formCargos.includes(val)) {
                              setFormCargos([...formCargos, val]);
                              setNewCargoInput("");
                            }
                          }
                        }}
                        className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-250 rounded-xl text-xs outline-none focus:bg-white focus:border-[#03440c] transition-all text-slate-800 font-semibold"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const val = newCargoInput.trim();
                          if (val && !formCargos.includes(val)) {
                            setFormCargos([...formCargos, val]);
                            setNewCargoInput("");
                          }
                        }}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-250 font-bold text-xs rounded-xl cursor-pointer transition-all h-10"
                      >
                        Adicionar
                      </button>
                    </div>
                  )}
                </motion.div>

                {/* Active solution count preview if viewing details */}
                {modalMode === "view" && selectedSectorName && (
                  <div className="bg-slate-50 border border-slate-150 p-4 rounded-xl text-xs space-y-2 pt-3">
                    <span className="font-bold text-slate-700 block uppercase text-[9.5px]">Auditoria de Instâncias Associadas</span>
                    <div className="flex gap-4">
                      <div>
                        <span className="text-[9.5px] text-slate-400 uppercase font-semibold">Tecnologias de IA</span>
                        <div className="text-base font-extrabold text-[#03440c] font-mono leading-none">
                          {records.filter(r => (r.unidadeSetor || "").trim().toLowerCase() === selectedSectorName.toLowerCase().trim()).length.toString().padStart(2, "0")}
                        </div>
                      </div>
                      <div className="border-r border-slate-250 h-8 self-center" />
                      <div>
                        <span className="text-[9.5px] text-slate-400 uppercase font-semibold">Perfis Ativos</span>
                        <div className="text-base font-extrabold text-[#03440c] font-mono leading-none">
                          {profiles.filter(p => (p.setor || "").trim().toLowerCase() === selectedSectorName.toLowerCase().trim()).length.toString().padStart(2, "0")}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </form>

              {/* Footer controls button */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="bg-white hover:bg-slate-150 text-slate-750 font-semibold text-xs border border-slate-250 px-4 py-2 rounded-xl transition-all cursor-pointer h-9"
                >
                  {modalMode === "view" ? "Fechar" : "Cancelar"}
                </button>

                {modalMode !== "view" && (
                  <button
                    type="submit"
                    disabled={isNameDuplicate}
                    onClick={handleSaveForm}
                    className="bg-[#03440c] hover:bg-[#02330a] disabled:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs px-5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 h-9 shadow-xs"
                  >
                    Salvar alterações
                  </button>
                )}
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>



    </div>
  );
}
