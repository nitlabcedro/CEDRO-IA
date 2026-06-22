import React, { useState, useMemo, useEffect } from "react";
import { 
  CheckCircle2, XCircle, Users, LayoutGrid, Search, 
  Filter, MoreHorizontal, ShieldCheck, ShieldAlert, ShieldX, 
  Database, ArrowUpRight, TrendingUp, AlertTriangle, Activity,
  ChevronLeft, Clock, Settings, Save, Check, Shield, CircleDot, Info,
  ClipboardCheck, Sliders, ChevronDown, ChevronUp, MessageSquare, Briefcase, Scale
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { IARecord, StatusAuditoria, StatusUso, UserProfile, ApprovalConfig, ApprovalWorkflow } from "../types";

interface ApprovalPageProps {
  records: IARecord[];
  profiles: UserProfile[];
  workflows: ApprovalWorkflow[];
  approvalConfig: ApprovalConfig;
  currentUserId?: string;
  onUpdateStatus: (recordId: string, status: StatusAuditoria, comment?: string, extraFields?: any) => void;
  onSaveApprovalConfig: (config: ApprovalConfig) => void;
  onViewRecord: (record: IARecord) => void;
  isAdmin: boolean;
}

const getOriginalObservacoes = (record: IARecord | null | undefined): string => {
  if (!record) return "Não informado pelo solicitante.";
  
  if (record.observacoesGeraisOriginais && record.observacoesGeraisOriginais.trim() !== "") {
    return record.observacoesGeraisOriginais;
  }
  
  const currentObs = record.observacoesGerais;
  if (!currentObs || currentObs.trim() === "") {
    return "Não informado pelo solicitante.";
  }

  const trimmed = currentObs.trim();
  const isDecision = 
    trimmed.startsWith("### FORMULÁRIO") ||
    trimmed.startsWith("### Parecer") ||
    trimmed.startsWith("Confirmação do Período de Teste") ||
    trimmed.includes("FORMULÁRIO DE AVALIAÇÃO") ||
    trimmed.includes("FORMULÁRIO DE GESTÃO DE RISCOS") ||
    trimmed.includes("Parecer Final da Etapa:") ||
    trimmed.startsWith("Direção Financeira:") ||
    trimmed.includes("Parecer:");

  if (isDecision) {
    return "Não informado pelo solicitante.";
  }

  return currentObs;
};

const parseApprovalComment = (rawComment?: string) => {
  const raw = rawComment || "";

  // Se for uma msg de redefinição de status, exibe de forma simples, sem caixas de critérios
  if (
    raw.toLowerCase().includes("redefinido por") || 
    raw.toLowerCase().includes("redefinido por administrador") ||
    raw.toLowerCase().includes("redefinição") ||
    raw.toLowerCase().includes("status redefinido")
  ) {
    return {
      criteria: [],
      parecer: raw.trim()
    };
  }

  const normalized = raw
    .replace(/###\s*FORMULÁRIO DE AVALIAÇÃO\s*-\s*[^\n\r]*/gi, "")
    .replace(/###\s*FORMULÁRIO DE GESTÃO DE RISCOS\s*\([^\)]*\)/gi, "")
    .replace(/###/g, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .trim();

  const lines = normalized
    .split(/\n|•/)
    .map(line => line.trim())
    .filter(Boolean);

  const criteria: { label: string; value: string }[] = [];
  let parecer = "";

  lines.forEach(line => {
    const cleanLine = line.trim();

    if (/^parecer final da etapa:/i.test(cleanLine)) {
      parecer = cleanLine.replace(/^parecer final da etapa:\s*/i, "").trim();
      return;
    }

    if (/^parecer:/i.test(cleanLine)) {
      parecer = cleanLine.replace(/^parecer:\s*/i, "").trim();
      return;
    }

    if (/^confirmação do período de teste:/i.test(cleanLine)) {
      criteria.push({
        label: "Período de Teste",
        value: cleanLine.replace(/^confirmação do período de teste:\s*/i, "").trim(),
      });
      return;
    }

    if (cleanLine.includes(":")) {
      const [label, ...rest] = cleanLine.split(":");
      const value = rest.join(":").trim();

      if (label.trim() && value) {
        const trimmedLabel = label.trim();
        // Skip adding the "Etapa" as a criteria parameter to keep the view cleaner since stage title card will be shown separately
        if (trimmedLabel.toLowerCase() === "etapa") {
          return;
        }
        
        let finalLabel = trimmedLabel;
        if (trimmedLabel.toLowerCase() === "nome") {
          finalLabel = "Responsável";
        } else if (trimmedLabel.toLowerCase() === "motivo") {
          finalLabel = "Motivo da Redefinição";
        }

        criteria.push({
          label: finalLabel,
          value,
        });
      }
    } else if (!parecer && cleanLine.length > 0) {
      parecer = cleanLine;
    }
  });

  return {
    criteria,
    parecer: parecer || "Parecer não informado pelo avaliador.",
  };
};

export default function ApprovalPage({
  records,
  profiles,
  workflows = [],
  approvalConfig,
  currentUserId,
  onUpdateStatus,
  onSaveApprovalConfig,
  onViewRecord,
  isAdmin
}: ApprovalPageProps) {
  const [activeTab, setActiveTab] = useState<"queue" | "config">("queue");
  const [workflowConfig, setWorkflowConfig] = useState<ApprovalConfig["steps"]>(
    approvalConfig?.steps ?? [
      { stepNumber: 1, roleName: "Coordenador NIT", isOpinionOnly: false },
      { stepNumber: 2, roleName: "Gerente NIT", isOpinionOnly: false },
      { stepNumber: 3, roleName: "Gerente TI", isOpinionOnly: false },
      { stepNumber: 4, roleName: "Período de Teste", isOpinionOnly: false },
      { stepNumber: 5, roleName: "Presidência", isOpinionOnly: false },
      { stepNumber: 6, roleName: "Direção Financeira", isOpinionOnly: true },
    ]
  );

  // Sincronizar estado ao carregar assincronamente do servidor
  useEffect(() => {
    if (approvalConfig?.steps && approvalConfig.steps.length > 0) {
      setWorkflowConfig(approvalConfig.steps);
    }
  }, [approvalConfig]);
  const [workflowSaved, setWorkflowSaved] = useState(false);
  const [approvalSearchInput, setApprovalSearchInput] = useState("");
  const [approvalSearchTerm, setApprovalSearchTerm] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setApprovalSearchTerm(approvalSearchInput);
    }, 300);

    return () => clearTimeout(timer);
  }, [approvalSearchInput]);

  const [queueFilter, setQueueFilter] = useState<"pending" | "my_turn" | "all">("my_turn");
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  
  // Custom states for interactive analysis form
  const [analysisModal, setAnalysisModal] = useState<{ isOpen: boolean; record: IARecord | null }>({ isOpen: false, record: null });
  const [auditComment, setAuditComment] = useState("");

  // States for NIT Coordenador (Etapa 1)
  const [coordAlinhamento, setCoordAlinhamento] = useState("Alinhado");
  const [coordTransferencia, setCoordTransferencia] = useState("Médio");
  const [coordViabilidade, setCoordViabilidade] = useState("Sim");

  // Coordinator private Data Fields (Analise de dados)
  const [coordUsaDadosPessoais, setCoordUsaDadosPessoais] = useState("Não");
  const [coordUsaDadosSensiveis, setCoordUsaDadosSensiveis] = useState("Não");
  const [coordQuaisDados, setCoordQuaisDados] = useState("");
  const [coordDadosAnonimizados, setCoordDadosAnonimizados] = useState("Não");
  const [coordEnvioFornecedorExterno, setCoordEnvioFornecedorExterno] = useState("Não");
  const [coordDadosTreinamentoModelo, setCoordDadosTreinamentoModelo] = useState("Não");

  const [showPainelExecutivo, setShowPainelExecutivo] = useState(false);

  // New detailed states for NIT Gerente (Etapa 2) Form
  const [g1RiscosRelevantes, setG1RiscosRelevantes] = useState<"Sim" | "Não" | "Não identificado">("Não identificado");
  const [g1TiposRisk, setG1TiposRisk] = useState<string[]>([]);
  const [g1Descricao, setG1Descricao] = useState("");

  const [g2ControlesExistentes, setG2ControlesExistentes] = useState<"Sim" | "Não" | "Parcialmente" | "Não se aplica">("Não se aplica");
  const [g2ControlesTipos, setG2ControlesTipos] = useState<string[]>([]);
  const [g2ControlesAdicionais, setG2ControlesAdicionais] = useState("");

  const [g3RiscoResidual, setG3RiscoResidual] = useState<"Baixo" | "Médio" | "Alto" | "Crítico" | "Não avaliado">("Não avaliado");
  const [g3Responsavel, setG3Responsavel] = useState("NIT");
  const [g3Observacoes, setG3Observacoes] = useState("");

  // States for TI Gerente (Etapa 3)
  const [tiInfra, setTiInfra] = useState("Compatível / Cloud nativa");
  const [tiSeguranca, setTiSeguranca] = useState("Conforme");
  const [tiIntegracao, setTiIntegracao] = useState("Não / Plataforma autônoma");
  const [tiAmbiente, setTiAmbiente] = useState("Cloud externa");
  const [tiControleAcesso, setTiControleAcesso] = useState("Adequado");
  const [tiLogs, setTiLogs] = useState("Possui logs");
  const [tiAcao, setTiAcao] = useState("Não");

  // States for Período de Teste (Etapa 4)
  const [periodoTesteConfirmado, setPeriodoTesteConfirmado] = useState<"Sim" | "Não">("Sim");

  // State to manage expanding/collapsing sections of the requester visualization
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    solicitante: true,
    identificacao: true,
    objetivo: false,
    dados: false,
    integracao: false,
    riscos: false,
    conformidade: false,
    classificacao: false,
    observacoes: false
  });

  const renderValue = (val: any, mode: "informado" | "preenchido" | "registrada" = "informado") => {
    const fallbackMap = {
      informado: "Não informado",
      preenchido: "Não preenchido na solicitação",
      registrada: "Sem informação registrada"
    };
    const fallback = fallbackMap[mode];
    if (val === undefined || val === null || (Array.isArray(val) && val.length === 0) || String(val).trim() === "") {
      return <span className="text-slate-400 italic font-medium">{fallback}</span>;
    }
    if (Array.isArray(val)) {
      return val.join(", ");
    }
    const str = String(val).trim();
    if (str.toLowerCase() === "null" || str.toLowerCase() === "undefined" || str === "") {
      return <span className="text-slate-400 italic font-medium">{fallback}</span>;
    }
    return str;
  };

  useEffect(() => {
    if (analysisModal.isOpen && analysisModal.record) {
      const record = analysisModal.record;
      setAuditComment("");
      setCoordAlinhamento("Alinhado");
      setCoordTransferencia("Médio");
      setCoordViabilidade("Sim");
      
      setCoordUsaDadosPessoais(record.usaDadosPessoais || "Não");
      setCoordUsaDadosSensiveis(record.usaDadosSensiveis || "Não");
      setCoordQuaisDados(record.quaisDados || "");
      setCoordDadosAnonimizados(record.dadosAnonimizados || "Não");
      setCoordEnvioFornecedorExterno(record.envioFornecedorExterno || "Não");
      setCoordDadosTreinamentoModelo(record.dadosTreinamentoModelo || "Não");

      setShowPainelExecutivo(false);
      
      setG1RiscosRelevantes("Não identificado");
      setG1TiposRisk([]);
      setG1Descricao("");
      setG2ControlesExistentes("Não se aplica");
      setG2ControlesTipos([]);
      setG2ControlesAdicionais("");
      setG3RiscoResidual("Não avaliado");
      setG3Responsavel("NIT");
      setG3Observacoes("");

      setTiInfra("Compatível / Cloud nativa");
      setTiSeguranca("Conforme");
      setTiIntegracao("Não / Plataforma autônoma");
      setTiAmbiente("Cloud externa");
      setTiControleAcesso("Adequado");
      setTiLogs("Possui logs");
      setTiAcao("Não");
      setPeriodoTesteConfirmado("Sim");
    }
  }, [analysisModal.record, analysisModal.isOpen]);

  const toggleSection = (sec: string) => {
    setExpandedSections(prev => ({ ...prev, [sec]: !prev[sec] }));
  };

  const privilegedProfiles = useMemo(() => {
    return profiles.filter(p => {
      const role = p.role?.toLowerCase().trim();
      return role === "admin" || role === "moderator";
    });
  }, [profiles]);

  const currentSteps = useMemo(() => {
    return approvalConfig?.steps && approvalConfig.steps.length > 0
      ? approvalConfig.steps
      : [
          { stepNumber: 1, roleName: "Coordenador NIT", isOpinionOnly: false, userId: "", userName: "" },
          { stepNumber: 2, roleName: "Gerente NIT", isOpinionOnly: false, userId: "", userName: "" },
          { stepNumber: 3, roleName: "Gerente TI", isOpinionOnly: false, userId: "", userName: "" },
          { stepNumber: 4, roleName: "Período de Teste", isOpinionOnly: false, userId: "", userName: "" },
          { stepNumber: 5, roleName: "Presidência", isOpinionOnly: false, userId: "", userName: "" },
          { stepNumber: 6, roleName: "Direção Financeira", isOpinionOnly: true, userId: "", userName: "" },
        ];
  }, [approvalConfig]);

  // Encontra o fluxo de processo real para cada IA
  const getRecordWf = (recordId: string) => {
    return workflows.find(wf => wf.iaRecordId === recordId);
  };

  const filteredRecords = useMemo(() => {
    let list = records.filter(r => {
      const term = approvalSearchTerm.toLowerCase().trim();
      if (!term) return true;

      const wf = getRecordWf(r.id);
      const currentStepNum = wf ? wf.currentStep : 1;
      const stepDef = currentSteps.find(s => s.stepNumber === currentStepNum);
      const stageName = stepDef?.roleName || "";

      const matchesSearch = 
        r.nomeFerramenta.toLowerCase().includes(term) || 
        r.unidadeSetor.toLowerCase().includes(term) ||
        r.id.toLowerCase().includes(term) ||
        (r.responsavelPreenchimento && r.responsavelPreenchimento.toLowerCase().includes(term)) ||
        stageName.toLowerCase().includes(term);

      return matchesSearch;
    });

    if (queueFilter === "pending") {
      // Somente as pendentes no resultado geral
      list = list.filter(r => (r.statusAuditoria || StatusAuditoria.PENDENTE) === StatusAuditoria.PENDENTE);
    } else if (queueFilter === "my_turn") {
      // Somente as IAs onde o usuário logado é o responsável pela etapa atual ativa
      list = list.filter(r => {
        const isPending = (r.statusAuditoria || StatusAuditoria.PENDENTE) === StatusAuditoria.PENDENTE;
        if (!isPending) return false;

        const wf = getRecordWf(r.id);
        const isWfFinished = wf && (wf.finalStatus === "aprovado" || wf.finalStatus === "negado");
        if (isWfFinished) return false;

        const currentStepNum = wf ? wf.currentStep : 1;
        const stepDef = currentSteps.find(s => s.stepNumber === currentStepNum);
        
        // Live config assigned user with fallback to active workflow's step user
        const wfStep = wf?.steps?.find(s => s.stepNumber === currentStepNum);
        const stepUserId = stepDef?.userId || wfStep?.assignedUserId;

        const currentUserProfile = profiles.find(p => p.id === currentUserId);
        const isUserAdmin = isAdmin;
        const isUserModerator = currentUserProfile?.role?.toLowerCase().trim() === "moderator";
        const isUserPrivileged = isUserAdmin || isUserModerator;

        const isStepUnassigned = !stepUserId;
        const isAssignedToMe = stepUserId === currentUserId;

        return (isAssignedToMe || (isStepUnassigned && isUserPrivileged));
      });
    }

    return list;
  }, [records, queueFilter, approvalSearchTerm, workflows, currentSteps, currentUserId, profiles, isAdmin]);

  const stats = useMemo(() => {
    const total = records.length;
    
    // IAs sob responsabilidade direta do logado
    const myTurnCount = records.filter(r => {
      const isPending = (r.statusAuditoria || StatusAuditoria.PENDENTE) === StatusAuditoria.PENDENTE;
      if (!isPending) return false;
      const wf = workflows.find(w => w.iaRecordId === r.id);
      const isWfFinished = wf && (wf.finalStatus === "aprovado" || wf.finalStatus === "negado");
      if (isWfFinished) return false;

      const currentStepNum = wf ? wf.currentStep : 1;
      const stepDef = currentSteps.find(s => s.stepNumber === currentStepNum);

      const wfStep = wf?.steps?.find(s => s.stepNumber === currentStepNum);
      const stepUserId = stepDef?.userId || wfStep?.assignedUserId;

      const currentUserProfile = profiles.find(p => p.id === currentUserId);
      const isUserAdmin = isAdmin;
      const isUserModerator = currentUserProfile?.role?.toLowerCase().trim() === "moderator";
      const isUserPrivileged = isUserAdmin || isUserModerator;

      const isStepUnassigned = !stepUserId;
      const isAssignedToMe = stepUserId === currentUserId;

      return (isAssignedToMe || (isStepUnassigned && isUserPrivileged));
    }).length;

    const totalPending = records.filter(r => (r.statusAuditoria || StatusAuditoria.PENDENTE) === StatusAuditoria.PENDENTE).length;

    return { total, myTurnCount, totalPending };
  }, [records, workflows, currentSteps, currentUserId, profiles, isAdmin]);

  return (
    <div className="space-y-6">
      {/* MOBILE REUSABLE CLEAN LAYOUT */}
      <div className="block lg:hidden space-y-5">
        {/* Título e Subtítulo */}
        <div className="pb-3 border-b border-slate-200">
          <h1 className="text-lg font-black text-[#003F1D] tracking-tight uppercase">
            Aprovação de sistemas
          </h1>
          <p className="text-xs text-[#667085] font-semibold mt-0.5">Analise e acompanhe solicitações de Inteligência Artificial</p>
        </div>

        {/* Aba Fila de Aprovação (simulada ou visual) */}
        <div className="border-b border-slate-200 pb-px">
          <button className="pb-2 text-xs font-black uppercase tracking-wider text-[#075618] border-b-2 border-[#075618]">
            Fila de aprovação
          </button>
        </div>

        {/* Card Fila de Aprovação */}
        <div className="bg-white border border-[#E3E8E1] rounded-3xl p-5 shadow-3xs space-y-4">
          <div>
            <h2 className="text-xs font-black text-[#003F1D] uppercase tracking-wider">Solicitações na Fila</h2>
          </div>

          {/* Filtros compactos - Minha vez, Pendentes, Todos */}
          <div className="flex gap-1 p-1 bg-[#F6F8F5] rounded-2xl border border-[#E3E8E1]">
            {[
              { label: "Minha vez", value: "my_turn" },
              { label: "Pendentes", value: "pending" },
              { label: "Todos", value: "all" }
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => {
                  setQueueFilter(opt.value as any);
                  setSelectedRecordId(null);
                }}
                className={`flex-1 py-2 px-1 rounded-xl text-[9px] font-black text-center uppercase tracking-wider transition-all select-none cursor-pointer ${
                  queueFilter === opt.value
                    ? "bg-white text-[#075618] border border-[#E3E8E1] shadow-3xs"
                    : "text-[#667085] hover:text-[#1F2933]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Campo de Busca */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#667085]" size={15} />
            <input
              type="text"
              placeholder="Buscar ferramenta, ID, setor..."
              value={approvalSearchInput}
              onChange={(e) => setApprovalSearchInput(e.target.value)}
              className="w-full pl-10 pr-3 py-3 bg-[#F6F8F5]/60 border border-[#E3E8E1] focus:border-[#075618] focus:bg-white text-xs font-semibold rounded-2xl outline-none placeholder:text-[#667085]/60 transition-all text-[#1F2933]"
            />
          </div>

          {/* Lista de cards */}
          <div className="space-y-3.5 pt-1">
            {filteredRecords.length > 0 ? (
              filteredRecords.map((record) => {
                const wf = getRecordWf(record.id);
                const currentStepNum = wf ? wf.currentStep : 1;
                const activeStepDef = currentSteps.find(s => s.stepNumber === currentStepNum);
                const wfStep = wf?.steps?.find(s => s.stepNumber === currentStepNum);
                const stepUserId = activeStepDef?.userId || wfStep?.assignedUserId;

                const currentUserProfile = profiles.find(p => p.id === currentUserId);
                const isUserAdmin = isAdmin;
                const isUserModerator = currentUserProfile?.role?.toLowerCase().trim() === "moderator";
                const isUserPrivileged = isUserAdmin || isUserModerator;

                const isStepUnassigned = !stepUserId;
                const isAssignedToMe = stepUserId === currentUserId;
                const isWfFinished = wf && (wf.finalStatus === "aprovado" || wf.finalStatus === "negado");
                const isMyTurn = !isWfFinished && isAssignedToMe && record.statusAuditoria === StatusAuditoria.PENDENTE;

                const dateStr = record.createdAt ? record.createdAt.slice(0, 10) : "";
                const formattedDate = dateStr 
                  ? dateStr.split("-").reverse().join("/") 
                  : "Sem data";

                return (
                  <div 
                    key={record.id}
                    className="p-4 rounded-2xl border border-[#E3E8E1] bg-[#F6F8F5]/30 space-y-4.5 text-left"
                  >
                    {/* ID e Status */}
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[9px] font-bold text-[#667085] bg-[#F6F8F5] border border-[#E3E8E1] px-2 py-0.5 rounded">
                        {record.id}
                      </span>
                      <span className={`text-[8px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                        record.statusAuditoria === StatusAuditoria.APROVADO 
                          ? "bg-[#EAF4EC] text-[#075618] border-[#BFD8C5]" 
                          : record.statusAuditoria === StatusAuditoria.NEGADO 
                            ? "bg-[#FEF3F2] text-[#B42318] border-[#FECDCA]" 
                            : "bg-[#FFF9EB] text-[#F59E0B] border-[#FEF08A]"
                      }`}>
                        {record.statusAuditoria || "Pendente"}
                      </span>
                    </div>

                    {/* Titulo */}
                    <div>
                      <h3 className="text-xs font-black text-[#1F2933] uppercase tracking-tight truncate">
                        {record.nomeFerramenta}
                      </h3>
                      <p className="text-[10px] text-[#667085] font-semibold mt-0.5">
                        {record.unidadeSetor} • {record.responsavelPreenchimento}
                      </p>
                    </div>

                    {/* Metadados: Etapa do fluxo e Data */}
                    <div className="pt-2.5 border-t border-[#E3E8E1]/60 text-[9px] font-bold text-[#667085] space-y-1">
                      {wf && !isWfFinished && (
                        <p className="text-[#075618]">
                          Etapa Atual: <span className="font-extrabold uppercase">{currentStepNum}. {activeStepDef?.roleName || "Avaliação"}</span>
                        </p>
                      )}
                      <p>
                        Cadastrada em: <span className="font-semibold text-[#1F2933]">{formattedDate}</span>
                      </p>
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex flex-col sm:flex-row gap-2 pt-1.5">
                      <button
                        onClick={() => onViewRecord(record)}
                        className="flex-1 py-2.5 px-4 bg-white hover:bg-[#EAF4EC]/40 text-[#075618] border border-[#E3E8E1] hover:border-[#BFD8C5] rounded-xl text-[10px] font-black uppercase tracking-wider transition-all select-none flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                      >
                        Ver detalhes
                      </button>

                      {isMyTurn && (
                        <button
                          onClick={() => {
                            setAnalysisModal({ isOpen: true, record });
                            setAuditComment("");
                            setCoordAlinhamento("Alinhado");
                            setCoordTransferencia("Médio");
                            setCoordViabilidade("Sim");
                            
                            setCoordUsaDadosPessoais(record.usaDadosPessoais || "Não");
                            setCoordUsaDadosSensiveis(record.usaDadosSensiveis || "Não");
                            setCoordQuaisDados(record.quaisDados || "");
                            setCoordDadosAnonimizados(record.dadosAnonimizados || "Não");
                            setCoordEnvioFornecedorExterno(record.envioFornecedorExterno || "Não");
                            setCoordDadosTreinamentoModelo(record.dadosTreinamentoModelo || "Não");
                            setShowPainelExecutivo(false);
                            
                            setG1RiscosRelevantes("Não identificado");
                            setG1TiposRisk([]);
                            setG1Descricao("");
                            setG2ControlesExistentes("Não se aplica");
                            setG2ControlesTipos([]);
                            setG2ControlesAdicionais("");
                            setG3RiscoResidual("Não avaliado");
                            setG3Responsavel("NIT");
                            setG3Observacoes("");

                            setTiInfra("Compatível / Cloud nativa");
                            setTiSeguranca("Conforme");
                            setTiIntegracao("Não / Plataforma autônoma");
                            setTiAmbiente("Cloud externa");
                            setTiControleAcesso("Adequado");
                            setTiLogs("Possui logs");
                            setTiAcao("Não");
                            setPeriodoTesteConfirmado("Sim");
                          }}
                          className="flex-1 py-2.5 px-4 bg-[#075618] text-white hover:bg-[#003F1D] border border-[#075618] rounded-xl text-[10px] font-black uppercase tracking-wider transition-all select-none flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                        >
                          Registrar parecer
                        </button>
                      )}
                    </div>

                  </div>
                );
              })
            ) : (
              <div className="py-10 text-center border border-dashed border-[#E3E8E1] rounded-2xl">
                <p className="text-xs text-[#667085] font-semibold">Nenhuma solicitação encontrada.</p>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* DESKTOP COMPLETE VIEW */}
      <div className="hidden lg:block space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Aprovação de sistemas
            </h1>
          </div>

          {/* Compact indicators */}
          <div className="hidden lg:flex items-center gap-3">
            <div className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-left min-w-[120px]">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">Na minha vez</p>
              <p className="text-lg font-bold text-slate-800">{stats.myTurnCount}</p>
            </div>
            <div className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-left min-w-[125px]">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">Pendentes</p>
              <p className="text-lg font-bold text-amber-650">{stats.totalPending}</p>
            </div>
          </div>
        </div>

        {/* Tabs Menu Navigation */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-px">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab("queue")}
              className={`pb-3 text-xs font-semibold uppercase tracking-wider transition-all relative ${
                activeTab === "queue"
                  ? "text-[#03440c] border-b-2 border-[#03440c] font-bold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Fila de aprovação
            </button>
            
            {isAdmin && (
              <button
                onClick={() => setActiveTab("config")}
                className={`pb-3 text-xs font-semibold uppercase tracking-wider transition-all relative ${
                  activeTab === "config"
                    ? "text-[#03440c] border-b-2 border-[#03440c] font-bold"
                    : "text-slate-500 hover:text-[#03440c]"
                }`}
              >
                Configurar fluxo
              </button>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab + queueFilter}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === "queue" && (() => {
              const activeRecord = (() => {
                if (filteredRecords.length === 0) return null;
                const found = filteredRecords.find(r => r.id === selectedRecordId);
                if (found) return found;
                // Only do automatic fallback to first item on initial load/when search is not active
                if (approvalSearchInput.trim() !== "") {
                  return null;
                }
                return filteredRecords[0];
              })();

              return (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
                  
                  {/* COLUNA ESQUERDA: Fila de Solicitações (col-span-5) */}
                  <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-4 flex flex-col space-y-4 shadow-sm">
                    <div>
                      <h2 className="text-xs font-bold text-slate-800 uppercase tracking-tight">Fila de aprovação</h2>
                    </div>

                    {/* Filtros compactos - Minha vez, Pendentes, Todos */}
                    <div className="flex flex-wrap gap-1 p-1 bg-slate-50 rounded-xl border border-slate-200">
                      {[
                        { label: "Minha vez", value: "my_turn" },
                        { label: "Pendentes", value: "pending" },
                        { label: "Todos", value: "all" }
                      ].map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => {
                            setQueueFilter(opt.value as any);
                            setSelectedRecordId(null);
                          }}
                          className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] font-bold text-center uppercase tracking-wide transition-all ${
                            queueFilter === opt.value
                              ? "bg-white text-slate-800 shadow-xs border border-slate-200/50"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {/* Barra de busca compacta */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input
                        type="text"
                        placeholder="Buscar ferramenta, ID, setor..."
                        value={approvalSearchInput}
                        onChange={(e) => {
                          setApprovalSearchInput(e.target.value);
                        }}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-600 focus:bg-white transition-all shadow-inner"
                      />
                    </div>

                    {/* Lista de Registros */}
                    <div className="space-y-2 overflow-y-auto max-h-[560px] pr-1">
                      {filteredRecords.length > 0 ? (
                        filteredRecords.map((record) => {
                          const isSelected = activeRecord && record.id === activeRecord.id;
                          const wf = getRecordWf(record.id);
                          const currentStepNum = wf ? wf.currentStep : 1;
                          
                          const activeStepDef = currentSteps.find(s => s.stepNumber === currentStepNum);
                          const wfStep = wf?.steps?.find(s => s.stepNumber === currentStepNum);
                          const stepUserId = activeStepDef?.userId || wfStep?.assignedUserId;

                          const currentUserProfile = profiles.find(p => p.id === currentUserId);
                          const isUserAdmin = isAdmin;
                          const isUserModerator = currentUserProfile?.role?.toLowerCase().trim() === "moderator";
                          const isUserPrivileged = isUserAdmin || isUserModerator;

                          const isStepUnassigned = !stepUserId;
                          const isAssignedToMe = stepUserId === currentUserId;
                          const isWfFinished = wf && (wf.finalStatus === "aprovado" || wf.finalStatus === "negado");
                          const isMyTurn = !isWfFinished && isAssignedToMe && record.statusAuditoria === StatusAuditoria.PENDENTE;

                          return (
                            <div
                              key={record.id}
                              onClick={() => setSelectedRecordId(record.id)}
                              className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                                isSelected
                                  ? "bg-emerald-50/20 border-emerald-600 border-l-4 shadow-xs"
                                  : isMyTurn
                                    ? "bg-amber-50/20 border-amber-300 hover:border-amber-400"
                                    : "bg-white border-slate-200 hover:border-slate-350"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span className="font-mono text-[9px] text-slate-400 font-semibold">{record.id}</span>
                                <span className={`text-[8px] px-2 py-0.5 rounded font-bold tracking-wider uppercase ${
                                  record.statusAuditoria === StatusAuditoria.APROVADO ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                                  record.statusAuditoria === StatusAuditoria.NEGADO ? "bg-red-50 text-red-700 border border-red-100" :
                                  "bg-amber-50 text-amber-700 border border-amber-100"
                                }`}>
                                  {record.statusAuditoria || "Pendente"}
                                </span>
                              </div>
                              
                              <h3 className="text-xs font-bold text-slate-800 line-clamp-1 uppercase">
                                {record.nomeFerramenta}
                              </h3>

                              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                                <span className="font-medium truncate max-w-[150px]">{record.unidadeSetor} • {record.responsavelPreenchimento}</span>
                                <span className="font-mono text-[9px] shrink-0">{new Date(record.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl">
                          <p className="text-xs text-slate-450 font-medium">Nenhuma solicitação pendente</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* COLUNA DIREITA: Detalhes e Fluxo de Aprovação (col-span-7) */}
                  <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 flex flex-col space-y-5 shadow-sm min-h-[500px]">
                    {activeRecord ? (() => {
                      const record = activeRecord;
                      const wf = getRecordWf(record.id);
                      const currentStepNum = wf ? wf.currentStep : 1;
                      const activeStepDef = currentSteps.find(s => s.stepNumber === currentStepNum);
                      
                      const wfStep = wf?.steps?.find(s => s.stepNumber === currentStepNum);
                      const stepUserId = activeStepDef?.userId || wfStep?.assignedUserId;
                      const displayedRoleName = activeStepDef?.roleName || wfStep?.roleName || "N/A";
                      const displayedUserName = activeStepDef?.userName || wfStep?.assignedUserName;

                      const currentUserProfile = profiles.find(p => p.id === currentUserId);
                      const isUserAdmin = isAdmin;
                      const isUserModerator = currentUserProfile?.role?.toLowerCase().trim() === "moderator";
                      const isUserPrivileged = isUserAdmin || isUserModerator;

                      const isStepUnassigned = !stepUserId;
                      const isAssignedToMe = stepUserId === currentUserId;
                      const isWfFinished = wf && (wf.finalStatus === "aprovado" || wf.finalStatus === "negado");
                      const isMyTurn = !isWfFinished && isAssignedToMe && record.statusAuditoria === StatusAuditoria.PENDENTE;

                      const latestDecision = record.historico?.find(
                        h => h.action && !h.action.includes("Criação") && !h.action.includes("Atualização")
                      );

                      return (
                        <>
                          {/* Pane Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-3">
                            <div>
                              <span className="font-mono text-[9px] text-slate-400 font-semibold">{record.id}</span>
                              <h2 className="text-base font-bold text-slate-900 tracking-tight uppercase mt-0.5">
                                {record.nomeFerramenta}
                              </h2>
                              <p className="text-xs text-slate-400 mt-0.5">{record.unidadeSetor} • {record.responsavelPreenchimento}</p>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {isMyTurn ? (
                                <button
                                  onClick={() => {
                                    setAnalysisModal({ isOpen: true, record });
                                    setAuditComment("");
                                    setCoordAlinhamento("Alinhado");
                                    setCoordTransferencia("Médio");
                                    setCoordViabilidade("Sim");
                                    
                                    setCoordUsaDadosPessoais(record.usaDadosPessoais || "Não");
                                    setCoordUsaDadosSensiveis(record.usaDadosSensiveis || "Não");
                                    setCoordQuaisDados(record.quaisDados || "");
                                    setCoordDadosAnonimizados(record.dadosAnonimizados || "Não");
                                    setCoordEnvioFornecedorExterno(record.envioFornecedorExterno || "Não");
                                    setCoordDadosTreinamentoModelo(record.dadosTreinamentoModelo || "Não");
                                    setShowPainelExecutivo(false);
                                    
                                    setG1RiscosRelevantes("Não identificado");
                                    setG1TiposRisk([]);
                                    setG1Descricao("");
                                    setG2ControlesExistentes("Não se aplica");
                                    setG2ControlesTipos([]);
                                    setG2ControlesAdicionais("");
                                    setG3RiscoResidual("Não avaliado");
                                    setG3Responsavel("NIT");
                                    setG3Observacoes("");

                                    setTiInfra("Compatível / Cloud nativa");
                                    setTiSeguranca("Conforme");
                                    setTiIntegracao("Não / Plataforma autônoma");
                                    setTiAmbiente("Cloud externa");
                                    setTiControleAcesso("Adequado");
                                    setTiLogs("Possui logs");
                                    setTiAcao("Não");
                                    setPeriodoTesteConfirmado("Sim");
                                  }}
                                  className="bg-[#03440c] hover:bg-[#03440c]/90 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                                >
                                  <ClipboardCheck size={14} /> Registrar parecer
                                </button>
                              ) : (
                                <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[10px] text-slate-500 font-bold flex items-center gap-1.5 select-none">
                                  <Clock size={12} className="text-slate-400" />
                                  <span>
                                    {record.statusAuditoria === StatusAuditoria.PENDENTE ? "Pendente" : "Finalizado"}
                                  </span>
                                </div>
                              )}
                              
                              <button
                                onClick={() => onViewRecord(record)}
                                className="bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-750 text-xs font-semibold px-3 py-2.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                              >
                                Ver ficha
                              </button>
                            </div>
                          </div>

                          {/* Metadata Summary Info Line */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                            <div>
                              <p className="text-[9px] text-slate-450 uppercase font-bold">Setor</p>
                              <p className="text-xs font-bold text-slate-700 truncate">{record.unidadeSetor}</p>
                            </div>
                            <div>
                              <p className="text-[9px] text-slate-450 uppercase font-bold">Solicitante</p>
                              <p className="text-xs font-bold text-slate-700 truncate">{record.responsavelPreenchimento}</p>
                            </div>
                            <div>
                              <p className="text-[9px] text-slate-450 uppercase font-bold">Data Cadastro</p>
                              <p className="text-xs font-medium text-slate-600">{new Date(record.createdAt).toLocaleDateString()}</p>
                            </div>
                            <div>
                              <p className="text-[9px] text-slate-450 uppercase font-bold">Criticidade sugerida</p>
                              <p className="text-xs font-bold text-slate-600">{record.criticidade || "Mapeamento pendente"}</p>
                            </div>
                          </div>

                          {/* Seção: Último Parecer */}
                          {latestDecision && (() => {
                            const parsedLatestDecision = parseApprovalComment(
                              latestDecision.message || latestDecision.action
                            );

                            return (
                              <div className="mt-5 rounded-2xl border border-[#BFD8C5] bg-[#F4FAF5] p-5 shadow-sm">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex items-start gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-[#EAF4EC] border border-[#BFD8C5] flex items-center justify-center text-[#075618] shrink-0">
                                      <MessageSquare size={17} />
                                    </div>

                                    <div>
                                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#075618]">
                                        Último parecer registrado
                                      </p>


                                    </div>
                                  </div>

                                  <span className="shrink-0 px-3 py-1 rounded-full bg-[#EAF4EC] border border-[#BFD8C5] text-[10px] font-black uppercase tracking-wider text-[#075618]">
                                    Parecer
                                  </span>
                                </div>

                                {parsedLatestDecision.criteria.length > 0 && (
                                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {parsedLatestDecision.criteria.map((item, index) => (
                                      <div
                                        key={`${item.label}-${index}`}
                                        className="rounded-xl border border-[#E3E8E1] bg-white px-4 py-3"
                                      >
                                        <p className="text-[9px] font-black uppercase tracking-widest text-[#667085]">
                                          {item.label}
                                        </p>

                                        <p className="mt-1 text-xs font-bold text-[#1F2933]">
                                          {item.value}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                <div className="mt-4 rounded-xl border border-[#E3E8E1] bg-white px-4 py-3">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-[#075618] mb-2">
                                    Parecer
                                  </p>

                                  <p className="text-sm leading-relaxed text-[#1F2933] font-medium whitespace-pre-line">
                                    {parsedLatestDecision.parecer}
                                  </p>
                                </div>

                                {latestDecision.action && (
                                  <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-[#075618] uppercase tracking-wide">
                                    <CheckCircle2 size={14} />
                                    <span>{latestDecision.action}</span>
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Seção: Fluxo de Governança (Horizontal Stepper) */}
                          <div className="space-y-3 pt-1">
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Fluxo de aprovação</h3>
                            
                            <div className="relative flex items-center justify-between w-full px-4">
                              {/* Thin connection line behind */}
                              <div className="absolute left-6 right-6 top-[11px] h-[1px] bg-slate-200 z-0" />
                              
                              {currentSteps.map((step) => {
                                const wfStep = wf?.steps?.find(s => s.stepNumber === step.stepNumber);
                                const hasWfStepDecision = wfStep && wfStep.status !== "aguardando";

                                const isFailed = hasWfStepDecision
                                  ? (wfStep.status === "negado")
                                  : (record.statusAuditoria === StatusAuditoria.NEGADO && step.stepNumber === currentStepNum);

                                const isPassed = !isFailed && (hasWfStepDecision
                                  ? (wfStep.status === "aprovado" || wfStep.status === "opiniao")
                                  : (step.stepNumber < currentStepNum || record.statusAuditoria === StatusAuditoria.APROVADO));

                                const isCurrent = step.stepNumber === currentStepNum && record.statusAuditoria === StatusAuditoria.PENDENTE;

                                return (
                                  <div key={step.stepNumber} className="relative z-10 flex flex-col items-center">
                                    <div
                                      title={`${step.stepNumber}. ${step.roleName}`}
                                      className={`size-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all ${
                                        isPassed
                                          ? "bg-emerald-600 border-emerald-600 text-white"
                                          : isFailed
                                            ? "bg-red-600 border-red-600 text-white"
                                            : isCurrent
                                              ? "bg-amber-500 border-amber-500 text-white ring-2 ring-amber-100 ring-offset-1 animate-pulse"
                                              : "bg-white border-slate-200 text-slate-400"
                                      }`}
                                    >
                                      {step.stepNumber}
                                    </div>
                                    
                                    <span className="text-[8px] font-bold text-slate-500 mt-1 max-w-[64px] truncate text-center uppercase tracking-tight block">
                                      {step.roleName.split(" ")[0]} {step.roleName.split(" ")[1] || ""}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Seção: Histórico Completo de Responsáveis (Vertical compact list) */}
                          <div className="space-y-3 pt-1">
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Responsáveis pelo processo</h3>
                            
                            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 bg-slate-50/10 overflow-hidden shadow-xs">
                              {currentSteps.map((step) => {
                                const wfStep = wf?.steps?.find(s => s.stepNumber === step.stepNumber);
                                const hasWfStepDecision = wfStep && wfStep.status !== "aguardando";
                                
                                const isFailed = hasWfStepDecision
                                  ? (wfStep.status === "negado")
                                  : (record.statusAuditoria === StatusAuditoria.NEGADO && step.stepNumber === currentStepNum);

                                const isPassed = !isFailed && (hasWfStepDecision
                                  ? (wfStep.status === "aprovado" || wfStep.status === "opiniao")
                                  : (step.stepNumber < currentStepNum || record.statusAuditoria === StatusAuditoria.APROVADO));

                                const isCurrent = step.stepNumber === currentStepNum && record.statusAuditoria === StatusAuditoria.PENDENTE;

                                const signerName = wfStep?.assignedUserName || step.userName || "Usuário livre";
                                const decidedAt = wfStep?.decidedAt;
                                const opinion = wfStep?.comment;

                                return (
                                  <div key={step.stepNumber} className="p-3 flex items-start gap-4 justify-between bg-white hover:bg-slate-50/50 transition-colors">
                                    <div className="space-y-1 min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-slate-400">Etapa {step.stepNumber}</span>
                                        <span className="text-slate-300">|</span>
                                        <span className="text-[11px] font-bold text-slate-800 truncate">{step.roleName}</span>
                                      </div>
                                      
                                      <p className="text-[10px] text-slate-500">
                                        Responsável: <span className="font-semibold text-slate-700">{signerName}</span>
                                      </p>

                                      {decidedAt && (
                                        <p className="text-[9px] text-slate-450 font-mono">Aprovado em {new Date(decidedAt).toLocaleDateString()}</p>
                                      )}

                                      {opinion && (
                                        <p className="text-[10px] text-slate-500 italic mt-1 leading-snug font-medium pl-2 border-l border-slate-200 bg-slate-50/50 p-1 rounded">
                                          "{opinion.replace(/###.+/g, "").replace(/•/g, "").replace(/\*/g, "").trim()}"
                                        </p>
                                      )}
                                    </div>

                                    <div className="shrink-0 pt-0.5">
                                      {isPassed ? (
                                        <span className="px-2 py-0.5 text-[8px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold uppercase rounded">Aprovado</span>
                                      ) : isFailed ? (
                                        <span className="px-2 py-0.5 text-[8px] bg-red-50 text-red-700 border border-red-200 font-bold uppercase rounded">
                                          {step.stepNumber === 6 ? "Parecer desfavorável" : "Indeferido"}
                                        </span>
                                      ) : isCurrent ? (
                                        <span className="px-2 py-0.5 text-[8px] bg-amber-50 text-amber-700 border border-amber-200 font-bold uppercase rounded animate-pulse">Atual</span>
                                      ) : (
                                        <span className="px-2 py-0.5 text-[8px] bg-slate-50 text-slate-400 border border-slate-150 font-bold uppercase rounded">Aguardando</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      );
                    })() : (
                      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400 space-y-2">
                        <ShieldCheck size={40} className="text-slate-300 pointer-events-none" />
                        <div>
                          <h3 className="text-xs font-bold text-slate-700 uppercase">Nenhum protocolo ativo</h3>
                          <p className="text-[11px]">Selecione uma solicitação da fila à esquerda para analisar</p>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              );
            })()}

            {activeTab === "config" && isAdmin && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Definir Responsáveis pelas Etapas</h3>
                  </div>
                  {workflowSaved && (
                    <span className="text-xs font-black text-brand-green bg-brand-green/10 border border-brand-green/20 px-3 py-1.5 rounded-xl uppercase">✓ Configuração salva</span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {workflowConfig.map((step, idx) => (
                    <div key={step.stepNumber} className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="size-10 rounded-xl flex items-center justify-center font-black text-sm border bg-[#03440c]/10 border-[#03440c]/20 text-[#03440c]">
                          {step.stepNumber}
                        </div>
                        <div className="flex-1">
                          <input
                            type="text"
                            value={step.roleName}
                            onChange={(e) => {
                              const updated = [...workflowConfig];
                              updated[idx] = { ...updated[idx], roleName: e.target.value };
                              setWorkflowConfig(updated);
                              setWorkflowSaved(false);
                            }}
                            className="w-full bg-transparent font-black text-slate-900 text-sm border-b border-slate-200 focus:border-brand-green outline-none pb-1 transition-colors"
                          />
                          <p className="text-[9px] text-[var(--text-muted)] font-bold uppercase tracking-widest mt-1">Cargo / Papel da etapa</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Usuário Responsável (Admin/Moderador)</label>
                        <select
                          value={step.userId ?? ""}
                          onChange={(e) => {
                            const selectedProfile = privilegedProfiles.find(p => p.id === e.target.value);
                            const updated = [...workflowConfig];
                            updated[idx] = {
                              ...updated[idx],
                              userId: e.target.value || undefined,
                              userName: selectedProfile?.full_name || undefined,
                            };
                            setWorkflowConfig(updated);
                            setWorkflowSaved(false);
                          }}
                          className="w-full px-4 py-3 bg-black/5 border border-slate-200 rounded-xl text-sm text-slate-800 font-semibold outline-none focus:border-brand-green transition-all"
                        >
                          <option value="">— Selecione um administrador ou moderador —</option>
                          {privilegedProfiles.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.full_name} ({p.role === "admin" ? "Admin" : "Moderador"}{p.cargo ? ` • ${p.cargo}` : ""})
                            </option>
                          ))}
                        </select>
                        {privilegedProfiles.length === 0 && (
                          <p className="text-[9px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 font-bold mt-1">
                            Nenhum administrador ou moderador cadastrado. Promova usuários na aba Administração IA.
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4">
                  <button
                    onClick={() => {
                      if (onSaveApprovalConfig) {
                        onSaveApprovalConfig({ steps: workflowConfig });
                        setWorkflowSaved(true);
                        setTimeout(() => setWorkflowSaved(false), 4000);
                      }
                    }}
                    className={`w-full py-4 font-black uppercase text-xs tracking-widest rounded-2xl transition-all active:scale-[0.99] flex items-center justify-center gap-2 relative overflow-hidden ${
                      workflowSaved
                        ? "bg-brand-green text-white shadow-lg shadow-brand-green/30 scale-[1.01]"
                        : "bg-[#03440c] text-white shadow-md hover:bg-[#03440c]/90"
                    }`}
                  >
                    {workflowSaved ? (
                      <>
                        <CheckCircle2 size={16} />
                        Fluxo configurado com sucesso!
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        Salvar Configuração de Etapas
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Analysis & Decision Modal Overlay */}
      <AnimatePresence>
        {analysisModal.isOpen && analysisModal.record && (() => {
          const record = analysisModal.record;
          const wf = getRecordWf(record.id);
          const currentStepNum = wf ? wf.currentStep : 1;
          const activeStepDef = currentSteps.find(s => s.stepNumber === currentStepNum);

          const handleDecisionSubmit = (status: StatusAuditoria) => {
            let finalComment = "";
            let extraFields: any = undefined;
            if (currentStepNum === 1) {
              finalComment = `Etapa: Coordenador NIT\n` +
                             `Alinhamento Estratégico: ${coordAlinhamento}\n` +
                             `Potencial de Transferência: ${coordTransferencia}\n` +
                             `Viabilidade de Patentes: ${coordViabilidade}\n` +
                             `Parecer: ${auditComment || "Etapa aprovada com ressalvas mínimas."}`;
              
              extraFields = {
                usaDadosPessoais: coordUsaDadosPessoais,
                usaDadosSensiveis: coordUsaDadosSensiveis,
                quaisDados: coordQuaisDados,
                dadosAnonimizados: coordDadosAnonimizados,
                envioFornecedorExterno: coordEnvioFornecedorExterno,
                dadosTreinamentoModelo: coordDadosTreinamentoModelo
              };
            } else if (currentStepNum === 2) {
              const riscosStr = g1TiposRisk.length > 0 ? g1TiposRisk.join(", ") : "Nenhum tipo de risco relevante selecionado";
              const controlesStr = g2ControlesTipos.length > 0 ? g2ControlesTipos.join(", ") : "Nenhum controle específico listado";
              finalComment = `Etapa: Gerente NIT (Gestão de Riscos)\n` +
                             `Riscos Relevantes?: ${g1RiscosRelevantes}\n` +
                             `Tipos de Risco: ${riscosStr}\n` +
                             `Detalhamento de Riscos: ${g1Descricao || "Nenhum"}\n` +
                             `Há Controles Implementados?: ${g2ControlesExistentes}\n` +
                             `Tipos de Controle: ${controlesStr}\n` +
                             `Controles Adicionais Necessários: ${g2ControlesAdicionais || "Nenhum"}\n` +
                             `Risco Residual após Controles: ${g3RiscoResidual}\n` +
                             `Responsável pelo Acompanhamento: ${g3Responsavel}\n` +
                             `Observações Críticas de Risco: ${g3Observacoes || "Nenhuma"}\n` +
                             `Parecer: ${auditComment || "Etapa assinada sob conformidade de processos corporativos do NIT."}`;
            } else if (currentStepNum === 3) {
              finalComment = `Etapa: Gerente TI\n` +
                             `1. Compatibilidade de Rede, Recursos e APIs: ${tiInfra}\n` +
                             `2. Garantias de Segurança de Dados e LGPD: ${tiSeguranca}\n` +
                             `3. Integração com Sistemas de TI Cedro: ${tiIntegracao}\n` +
                             `4. Ambiente de uso da ferramenta: ${tiAmbiente}\n` +
                             `5. Controle de acesso: ${tiControleAcesso}\n` +
                             `6. Logs e rastreabilidade: ${tiLogs}\n` +
                             `7. Necessita ação técnica da TI?: ${tiAcao}\n` +
                             `Parecer Técnico Justificado: ${auditComment || "Etapa validada tecnicamente pelo departamento de TI."}`;
            } else if (currentStepNum === 4) {
              finalComment = `Etapa: Período de Teste\n` +
                             `Período de Teste Realizado: ${periodoTesteConfirmado}\n` +
                             `Parecer: ${auditComment || "Nenhuma observação informada."}`;
            } else {
              // 5 e 6
              finalComment = auditComment || (status === StatusAuditoria.APROVADO ? "Parecer estratégico aprovado na íntegra." : "Recusado.");
            }

            onUpdateStatus(record.id, status, finalComment, extraFields);
            setAnalysisModal({ isOpen: false, record: null });
            setAuditComment("");
          };

          return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setAnalysisModal({ isOpen: false, record: null })}
                className="absolute inset-0 bg-[#003F1D]/45 backdrop-blur-sm"              />
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 15 }}
                className="relative w-[90vw] max-w-[92vw] h-[92vh] max-h-[92vh] bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
              >
                {/* CABEÇALHO DO POPUP (Full-width) */}
                <div className="bg-slate-50 border-b border-slate-200/60 p-6 md:px-8 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6 relative shrink-0">
                  <div className="space-y-1.5 max-w-md">
                    <span className="text-[10px] font-black uppercase text-[#03440c] tracking-[0.2em] block">Análise de Solicitação</span>
                    <h4 className="text-xl md:text-2xl font-extrabold text-slate-900 uppercase tracking-tight flex items-center gap-2.5">
                      <span className="p-2 rounded-xl bg-[#03440c]/10 text-[#03440c] shadow-xs shrink-0">
                        <Activity size={20} />
                      </span>
                      <span className="truncate" title={record.nomeFerramenta || ""}>
                        {renderValue(record.nomeFerramenta)}
                      </span>
                    </h4>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-semibold text-slate-650 flex-1 max-w-3xl items-center lg:ml-4">
                    <div className="bg-white border border-slate-200/70 rounded-xl p-3 shadow-xs flex flex-col justify-center min-h-[60px]">
                      <p className="text-[8px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Protocolo / ID</p>
                      <p className="font-mono text-slate-950 font-bold truncate pr-1">{record.id}</p>
                    </div>
                    <div className="bg-emerald-50/20 border border-emerald-500/10 rounded-xl p-3 shadow-xs flex flex-col justify-center min-h-[60px]">
                      <p className="text-[8px] text-[#03440c]/70 uppercase font-bold tracking-wider mb-0.5">Etapa Atual</p>
                      <p className="text-[#03440c] font-black uppercase truncate pr-1">
                        {wf ? `Etapa ${wf.currentStep} de ${currentSteps.length}` : "Etapa inicial"}
                      </p>
                    </div>
                    <div className="bg-white border border-slate-200/70 rounded-xl p-3 shadow-xs flex flex-col justify-center min-h-[60px]">
                      <p className="text-[8px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">Avaliador da Etapa</p>
                      <p className="text-slate-900 font-extrabold uppercase truncate pr-1" title={(() => {
                        const activeWfStep = wf?.steps?.find(s => s.stepNumber === currentStepNum);
                        return activeWfStep?.assignedUserName || activeStepDef?.assignedUserName || "Qualquer usuário qualificado";
                      })()}>
                        {(() => {
                          const activeWfStep = wf?.steps?.find(s => s.stepNumber === currentStepNum);
                          return activeWfStep?.assignedUserName || activeStepDef?.assignedUserName || "Qualquer usuário";
                        })()}
                      </p>
                    </div>
                    <div className="bg-white border border-slate-200/70 rounded-xl p-3 shadow-xs flex flex-col items-start justify-center min-h-[60px]">
                      <p className="text-[8px] text-slate-400 uppercase font-bold tracking-wider mb-1">Status Geral</p>
                      <span className={`inline-block px-2.5 py-1 rounded text-[8px] font-black uppercase border leading-none ${
                        record.status === "Aprovado" 
                          ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                          : record.status === "Rejeitado" || record.status === "Negado"
                          ? "bg-rose-50 border-rose-200 text-rose-800"
                          : "bg-amber-50 border-amber-200 text-amber-800"
                      }`}>
                        {record.status || "Pendente"}
                      </span>
                    </div>
                  </div>
                  
                  {/* Botão de Fechar */}
                  <button
                    onClick={() => setAnalysisModal({ isOpen: false, record: null })}
                      className="absolute top-5 right-5 text-[#075618] hover:text-white transition-all p-2 rounded-full bg-[#EAF4EC] hover:bg-[#075618] cursor-pointer flex items-center justify-center shadow-sm"                  >
                    <XCircle size={22} />
                  </button>
                </div>

                {/* PRINCIPAL CORPO EM DUAS COLUNAS */}
                <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden min-h-0">
                  <div className="w-full lg:w-[40%] border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col lg:h-full bg-slate-50/50 overflow-y-visible lg:overflow-y-auto custom-scrollbar shrink-0">
                    <div className="p-4 md:p-8 space-y-4">
                      {/* Folder 1: Solicitante */}
                      <div className={`bg-white border rounded-2xl overflow-hidden transition-all duration-200 ${
                        expandedSections.solicitante 
                          ? "border-[#03440c]/30 shadow-md shadow-[#03440c]/5 ring-1 ring-[#03440c]/5" 
                          : "border-slate-200/80 shadow-sm"
                      }`}>
                        <button
                          type="button"
                          onClick={() => toggleSection("solicitante")}
                          className={`w-full p-4.5 flex items-center justify-between font-bold text-xs uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                            expandedSections.solicitante 
                              ? "bg-emerald-50/60 text-[#03440c] border-b border-emerald-100/50" 
                              : "bg-slate-50/70 text-slate-700 hover:bg-slate-100/80 border-b border-transparent"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Users size={14} className={expandedSections.solicitante ? "text-[#03440c]" : "text-slate-500"} /> 1. Solicitante
                          </span>
                          {expandedSections.solicitante ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        {expandedSections.solicitante && (
                          <div className="p-4.5 grid grid-cols-2 gap-4 text-xs font-semibold text-slate-700 border-t border-slate-100 bg-white">
                            <div>
                              <p className="text-[8px] text-slate-400 uppercase font-black tracking-wider mb-0.5">Setor Solicitante</p>
                              <p className="uppercase font-extrabold text-slate-800">{renderValue(record.unidadeSetor, "preenchido")}</p>
                            </div>
                            <div>
                              <p className="text-[8px] text-slate-400 uppercase font-black tracking-wider mb-0.5">Cargo</p>
                              <p className="capitalize text-slate-800">{renderValue(record.cargo, "preenchido")}</p>
                            </div>
                            <div className="col-span-2 pt-2 border-t border-slate-100/50">
                              <p className="text-[8px] text-slate-400 uppercase font-black tracking-wider mb-0.5">Solicitante</p>
                              <p className="text-slate-850 font-bold">{renderValue(record.responsavelPreenchimento, "preenchido")}</p>
                            </div>
                            <div className="col-span-2 pt-2 border-t border-slate-100/50">
                              <p className="text-[8px] text-slate-400 uppercase font-black tracking-wider mb-0.5">Contato</p>
                              <p className="text-slate-850 font-bold">
                                {(() => {
                                  const matchingProfile = profiles.find(p => p.full_name === record.responsavelPreenchimento || p.id === record.ownerId);
                                  const contactVal = record.contato || matchingProfile?.contato;
                                  return renderValue(contactVal, "preenchido");
                                })()}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Folder 2: Identificação */}
                      <div className={`bg-white border rounded-2xl overflow-hidden transition-all duration-200 ${
                        expandedSections.identificacao 
                          ? "border-[#03440c]/30 shadow-md shadow-[#03440c]/5 ring-1 ring-[#03440c]/5" 
                          : "border-slate-200/80 shadow-sm"
                      }`}>
                        <button
                          type="button"
                          onClick={() => toggleSection("identificacao")}
                          className={`w-full p-4.5 flex items-center justify-between font-bold text-xs uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                            expandedSections.identificacao 
                              ? "bg-emerald-50/60 text-[#03440c] border-b border-emerald-100/50" 
                              : "bg-slate-50/70 text-slate-700 hover:bg-slate-100/80 border-b border-transparent"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Sliders size={14} className={expandedSections.identificacao ? "text-[#03440c]" : "text-slate-500"} /> 2. Identificação da IA
                          </span>
                          {expandedSections.identificacao ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        {expandedSections.identificacao && (
                          <div className="p-4.5 space-y-4 text-xs font-semibold text-slate-700 border-t border-slate-100 bg-white">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="col-span-2">
                                <p className="text-[8px] text-slate-400 uppercase font-black tracking-wider mb-0.5">Nome da Ferramenta</p>
                                <p className="font-black uppercase text-[#03440c] text-sm tracking-tight">{renderValue(record.nomeFerramenta, "preenchido")}</p>
                              </div>
                              <div className="pt-2 border-t border-slate-100/50">
                                <p className="text-[8px] text-slate-400 uppercase font-black tracking-wider mb-0.5">Fornecedor / Desenvolvedor</p>
                                <p className="uppercase text-slate-800">{renderValue(record.fornecedor, "preenchido")}</p>
                              </div>
                              <div className="pt-2 border-t border-slate-100/50">
                                <p className="text-[8px] text-slate-400 uppercase font-black tracking-wider mb-0.5">Versão / Plano</p>
                                <p className="text-slate-800">{renderValue(record.versao, "preenchido")}</p>
                              </div>
                              <div className="col-span-2 pt-2 border-t border-slate-100/50">
                                <p className="text-[8px] text-slate-400 uppercase font-black tracking-wider mb-0.5">Utiliza ou Exige IA?</p>
                                <p className="uppercase text-slate-800 font-bold">{renderValue(record.utilizaIA, "preenchido")}</p>
                              </div>
                            </div>
                            <div className="pt-2 border-t border-slate-100/50">
                              <p className="text-[8px] text-slate-400 uppercase font-black tracking-wider mb-1">Tipo de IA / Tecnologia</p>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {record.tipoIA && record.tipoIA.length > 0 ? (
                                  record.tipoIA.map((t: string) => (
                                    <span key={t} className="px-2.5 py-1 bg-[#03440c]/8 text-emerald-900 text-[10px] rounded-lg font-black uppercase tracking-tight">{t}</span>
                                  ))
                                ) : (
                                  <span className="text-slate-400 italic">Mapeamento não preenchido</span>
                                )}
                              </div>
                            </div>
                            {record.tipoIAOutro && record.tipoIAOutro.trim() !== "" && (
                              <div className="pt-2 border-t border-slate-100/50">
                                <p className="text-[8px] text-slate-400 uppercase font-black tracking-wider mb-1">Tipo de IA (Outro Especificado)</p>
                                <p className="mt-1 font-medium bg-slate-50 p-3 rounded-xl border border-slate-150 text-slate-700 leading-relaxed text-[11px]">{record.tipoIAOutro}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Folder 3: Objetivo */}
                      <div className={`bg-white border rounded-2xl overflow-hidden transition-all duration-200 ${
                        expandedSections.objetivo 
                          ? "border-[#03440c]/30 shadow-md shadow-[#03440c]/5 ring-1 ring-[#03440c]/5" 
                          : "border-slate-200/80 shadow-sm"
                      }`}>
                        <button
                          type="button"
                          onClick={() => toggleSection("objetivo")}
                          className={`w-full p-4.5 flex items-center justify-between font-bold text-xs uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                            expandedSections.objetivo 
                              ? "bg-emerald-50/60 text-[#03440c] border-b border-emerald-100/50" 
                              : "bg-slate-50/70 text-slate-700 hover:bg-slate-100/80 border-b border-transparent"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Info size={14} className={expandedSections.objetivo ? "text-[#03440c]" : "text-slate-500"} /> 3. Finalidade e Objetivos
                          </span>
                          {expandedSections.objetivo ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        {expandedSections.objetivo && (
                          <div className="p-4.5 space-y-4 text-xs font-semibold text-slate-700 border-t border-slate-100 bg-white">
                            <div>
                              <p className="text-[8px] text-slate-400 uppercase font-black tracking-wider mb-1">Descrição da Atividade</p>
                              <p className="bg-slate-50/75 p-3.5 rounded-xl border border-slate-150/80 italic mt-1 font-medium leading-relaxed text-slate-650">
                                {record.descricaoAtividade ? `"${record.descricaoAtividade}"` : <span className="text-slate-400 italic">Não informado</span>}
                              </p>
                            </div>
                            <div className="pt-2 border-t border-slate-100/50">
                              <p className="text-[8px] text-slate-400 uppercase font-black tracking-wider mb-1">Objetivos / Finalidade</p>
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {record.objetivos && record.objetivos.length > 0 ? (
                                  record.objetivos.map((t: string) => (
                                    <span key={t} className="px-2.5 py-1 bg-blue-50/80 border border-blue-250/50 text-blue-700 text-[10px] rounded-lg font-black uppercase tracking-tight">{t}</span>
                                  ))
                                ) : (
                                  <span className="text-slate-400 italic">Não preenchido na solicitação</span>
                                )}
                              </div>
                            </div>
                            {record.objetivoOutro && record.objetivoOutro.trim() !== "" && (
                              <div className="pt-2 border-t border-slate-100/50">
                                <p className="text-[8px] text-slate-400 uppercase font-black tracking-wider mb-1">Outro Objetivo Mapeado</p>
                                <p className="mt-1 font-medium bg-slate-50 p-3 rounded-xl border border-slate-150 text-slate-700 leading-relaxed text-[11px]">{record.objetivoOutro}</p>
                              </div>
                            )}
                            <div className="pt-2 border-t border-slate-100/50">
                              <p className="text-[8px] text-slate-400 uppercase font-black tracking-wider mb-0.5">Etapa do Processo</p>
                              <p className="font-extrabold uppercase mt-0.5 text-slate-800">
                                {record.etapaProcesso ? (record.etapaProcesso + (record.etapaOutro ? ` (${record.etapaOutro})` : "")) : <span className="text-slate-400 italic">Não preenchido</span>}
                              </p>
                            </div>
                            <div className="pt-2 border-t border-slate-100/50">
                              <p className="text-[8px] text-slate-400 uppercase font-black tracking-wider mb-1">Benefícios Esperados</p>
                              <p className="bg-slate-50/75 p-3.5 rounded-xl border border-slate-150/80 italic mt-1 font-medium leading-relaxed text-slate-650">
                                {record.beneficiosEsperados ? `"${record.beneficiosEsperados}"` : <span className="text-slate-400 italic">Não informado</span>}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Folder 9: Observações e Envio */}
                      <div className={`bg-white border rounded-2xl overflow-hidden transition-all duration-200 ${
                        expandedSections.observacoes 
                          ? "border-[#03440c]/30 shadow-md shadow-[#03440c]/5 ring-1 ring-[#03440c]/5" 
                          : "border-slate-200/80 shadow-sm"
                      }`}>
                        <button
                          type="button"
                          onClick={() => toggleSection("observacoes")}
                          className={`w-full p-4.5 flex items-center justify-between font-bold text-xs uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                            expandedSections.observacoes 
                              ? "bg-emerald-50/60 text-[#03440c] border-b border-emerald-100/50" 
                              : "bg-slate-50/70 text-slate-700 hover:bg-slate-100/80 border-b border-transparent"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <ClipboardCheck size={14} className={expandedSections.observacoes ? "text-[#03440c]" : "text-slate-500"} /> 9. Observações e Envio
                          </span>
                          {expandedSections.observacoes ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        {expandedSections.observacoes && (
                          <div className="p-4.5 space-y-4 text-xs font-semibold text-slate-700 border-t border-slate-100 bg-white">
                            <div>
                              <p className="text-[8px] text-slate-400 uppercase font-black tracking-wider mb-1">Observações Gerais do Solicitante</p>
                              <p className="bg-slate-50/75 p-3.5 rounded-xl border border-slate-150/80 italic mt-1 font-medium leading-relaxed text-slate-650">
                                {getOriginalObservacoes(record) === "Não informado pelo solicitante." ? (
                                  <span className="text-slate-400 italic">Não informado pelo solicitante.</span>
                                ) : (
                                  `"${getOriginalObservacoes(record)}"`
                                )}
                              </p>
                            </div>
                            {((record.anexos && record.anexos.trim() !== "") || record.documentoNome) && (
                              <div className="pt-2 border-t border-slate-100/50 space-y-2">
                                <p className="text-[8px] text-slate-400 uppercase font-black tracking-wider mb-1">Anexos / Links de Referência</p>
                                {record.anexos && record.anexos.trim() !== "" && (
                                  <div className="mt-1 bg-indigo-55/35 border border-indigo-100 p-3 rounded-xl flex items-center gap-2 shadow-xs">
                                    <span className="text-indigo-850 text-xs font-semibold truncate max-w-full">
                                      📎 {record.anexos}
                                    </span>
                                  </div>
                                )}
                                {record.documentoNome && (
                                  <div className="mt-2 bg-emerald-50 border border-emerald-150 p-3 rounded-xl flex flex-col xs:flex-row xs:items-center justify-between gap-3 shadow-xs">
                                    <div className="min-w-0 flex items-center gap-2">
                                      <span className="text-base">📁</span>
                                      <div className="min-w-0">
                                        <p className="text-[11px] font-black text-[#03440c] uppercase truncate" title={record.documentoNome}>
                                          {record.documentoNome}
                                        </p>
                                        <p className="text-[9px] text-[#667085] mt-0.5 font-mono">
                                          {record.documentoTamanho ? `${(record.documentoTamanho / 1024).toFixed(1)} KB` : "Documento"}
                                        </p>
                                      </div>
                                    </div>
                                    {record.documentoUrl && (
                                      <a
                                        href={record.documentoUrl}
                                        download={record.documentoNome}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="bg-[#03440c] hover:bg-[#022807] text-white text-[9.5px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-lg text-center select-none cursor-pointer transition-all self-end xs:self-auto shrink-0"
                                      >
                                        Baixar
                                      </a>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* COLUNA DIREITA: Form de Preenchimento de Aprovação do Decisor [60%] */}
                  <div className="w-full lg:w-[60%] flex flex-col lg:h-full bg-white p-4 md:p-8 justify-between lg:overflow-y-auto custom-scrollbar border-t lg:border-t-0 lg:border-l border-slate-150 space-y-6 shrink-0">
                    <div>
                      {/* Header do Formulário */}
                      <div className="flex items-center gap-3.5 border-b border-slate-100 pb-5">
                        <div className="size-11 rounded-1.5xl bg-emerald-50 text-[#03440c] border border-emerald-100 flex items-center justify-center font-black text-base shadow-xs">
                          {currentStepNum}
                        </div>
                        <div>
                          <span className="text-[9px] text-[#03440c] font-bold uppercase tracking-wider block">Estágio de Governança Ativo</span>
                          <h4 className="text-sm font-extrabold text-slate-900 uppercase tracking-tight">
                            Formulário de Parecer: <span className="text-[#03440c]">{activeStepDef?.roleName || "Decisor Autorizado"}</span>
                          </h4>
                        </div>
                      </div>

                      {/* Card: Resumo Rápido da Solicitação */}
                      <div className="bg-slate-50 border border-slate-200/50 rounded-2xl p-5 space-y-4 shadow-xs mt-4">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest block">Briefing para Tomada de Decisão</span>
                          <span className="text-[8px] bg-[#03440c]/8 text-[#03440c] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">Dados Principais</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <p className="text-[8px] text-slate-400 uppercase font-black tracking-wider mb-0.5">Setor Solicitante</p>
                            <p className="font-extrabold text-slate-800 uppercase truncate text-[11px]">{renderValue(record.unidadeSetor)}</p>
                          </div>
                          <div>
                            <p className="text-[8px] text-slate-400 uppercase font-black tracking-wider mb-0.5">Criticidade Declarada</p>
                            <span className={`inline-block mt-0.5 px-2.5 py-1 rounded text-[8px] font-black uppercase border leading-none ${
                              record.criticidade?.toLowerCase().includes("alta") || record.criticidade?.toLowerCase().includes("crít")
                                ? "bg-rose-50 border-rose-250 text-rose-850"
                                : record.criticidade?.toLowerCase().includes("méd")
                                ? "bg-amber-50 border-amber-250 text-amber-850"
                                : "bg-emerald-50 border-emerald-250 text-emerald-850"
                            }`}>
                              {record.criticidade || "Baixa"}
                            </span>
                          </div>
                          <div className="col-span-2 pt-2 border-t border-slate-200/40">
                            <p className="text-[8px] text-slate-400 uppercase font-black tracking-wider mb-1">Finalidade declarada do uso</p>
                            <p className="text-[11px] text-slate-600 font-medium leading-relaxed italic bg-white p-3 border border-slate-200/60 rounded-xl max-h-24 overflow-y-auto custom-scrollbar">
                              {record.descricaoAtividade ? `"${record.descricaoAtividade}"` : "Descrição não fornecida."}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Histórico Recente de pareceres de etapas concluídas */}
                      {(() => {
                        const prevSteps = (wf?.steps || [])
                          .filter((s) => s.stepNumber < currentStepNum && s.status !== "aguardando")
                          .sort((a, b) => a.stepNumber - b.stepNumber);
                        return (
                          <div className="bg-slate-50/40 border border-slate-200/60 rounded-2xl p-5 space-y-3.5 mt-4">
                            <h5 className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Histórico de Pareceres Anteriores</h5>
                            {prevSteps.length === 0 ? null : (
                              <div className="space-y-4 max-h-80 overflow-y-auto custom-scrollbar pr-1">
                                {prevSteps.map((s) => {
                                  const parsed = parseApprovalComment(s.comment);

                                  return (
                                    <div
                                      key={s.stepNumber}
                                      className="rounded-2xl border border-[#E3E8E1] bg-white p-4 shadow-sm"
                                    >
                                      <div className="flex items-start justify-between gap-4">
                                        <div>
                                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#075618]">
                                            Etapa {s.stepNumber}
                                          </p>

                                          <h4 className="mt-1 text-sm font-black text-[#1F2933]">
                                            {s.roleName}
                                          </h4>

                                          <p className="mt-1 text-xs font-semibold text-[#667085]">
                                            Responsável: {s.assignedUserName || "Aprovação livre"}
                                          </p>
                                        </div>

                                        <span
                                          className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider border ${
                                            s.status === "negado"
                                              ? "bg-[#FEF3F2] text-[#B42318] border-[#FDA29B]"
                                              : "bg-[#EAF4EC] text-[#075618] border-[#BFD8C5]"
                                          }`}
                                        >
                                          {s.status === "negado" ? "Indeferido" : "Aprovado"}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                    {/* FORMULÁRIO DE PREENCHIMENTO EXCLUSIVO DAS CONTAS ATIVAS DE COORDENADOR NIT, GERENTE NIT, E GERENTE TI */}
                    {currentStepNum === 1 && (
                      <div className="space-y-6 pt-2">
                        {/* CARD 1: RECURSOS OBRIGATÓRIOS DO COORDENADOR NIT */}
                        <div className="bg-[#03440c]/3 border border-[#03440c]/10 rounded-2xl p-5 space-y-4">
                          <p className="text-[10px] font-black text-[#03440c] uppercase tracking-wider flex items-center gap-1.5 border-b border-[#03440c]/10 pb-2">
                            <span>✓</span> RECURSOS OBRIGATÓRIOS DO COORDENADOR NIT
                          </p>
                          
                          {/* Campo 1 */}
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Alinhamento Estratégico de Inovação</label>
                            <div className="flex gap-2">
                              {["Alinhado", "Parcialmente Alinhado", "Não Alinhado"].map(opt => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => setCoordAlinhamento(opt)}
                                  className={`flex-1 py-3 px-1 rounded-xl text-[10px] font-extrabold uppercase tracking-wider border transition-all duration-200 cursor-pointer ${
                                    coordAlinhamento === opt
                                      ? "bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs ring-2 ring-emerald-500/10"
                                      : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Campo 2 */}
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Potencial de Transferência ou Patente</label>
                            <div className="flex gap-2">
                              {["Alto", "Médio", "Baixo", "Não avaliado"].map(opt => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => setCoordTransferencia(opt)}
                                  className={`flex-1 py-3 px-1 rounded-xl text-[9px] font-extrabold uppercase tracking-wider border transition-all duration-200 cursor-pointer ${
                                    coordTransferencia === opt
                                      ? "bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs ring-2 ring-emerald-500/10"
                                      : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Campo 3 */}
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Viabilidade de Registro de Software</label>
                            <div className="flex gap-2">
                              {["Sim", "Não", "Em estudo"].map(opt => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => setCoordViabilidade(opt)}
                                  className={`flex-1 py-3 px-1 rounded-xl text-[10px] font-extrabold uppercase tracking-wider border transition-all duration-200 cursor-pointer ${
                                    coordViabilidade === opt
                                      ? "bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs ring-2 ring-emerald-500/10"
                                      : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* CARD 2: PRIVACIDADE E DADOS */}
                        <div className="bg-indigo-50/20 border border-indigo-200/50 rounded-2xl p-5 space-y-4">
                          <p className="text-[10px] font-black text-indigo-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-indigo-200/20 pb-2">
                            <span>🛡️</span> ANÁLISE DE DADOS E PRIVACIDADE — COORDENADOR NIT
                          </p>
                          
                          {/* Campo Dados Pessoais */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-505 uppercase tracking-wider block">Utiliza dados pessoais?</label>
                              <div className="flex gap-2">
                                {["Sim", "Não"].map(opt => (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => setCoordUsaDadosPessoais(opt)}
                                    className={`flex-1 py-3 rounded-xl text-[10px] font-extrabold uppercase tracking-wider border transition-all duration-200 cursor-pointer ${
                                      coordUsaDadosPessoais === opt
                                        ? "bg-indigo-50 border-indigo-400 text-indigo-800 shadow-xs ring-2 ring-indigo-550/15"
                                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                    }`}
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-505 uppercase tracking-wider block">Utiliza dados sensíveis?</label>
                              <div className="flex gap-2">
                                {["Sim", "Não"].map(opt => (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => setCoordUsaDadosSensiveis(opt)}
                                    className={`flex-1 py-3 rounded-xl text-[10px] font-extrabold uppercase tracking-wider border transition-all duration-200 cursor-pointer ${
                                      coordUsaDadosSensiveis === opt
                                        ? "bg-indigo-50 border-indigo-400 text-indigo-800 shadow-xs ring-2 ring-indigo-555/15"
                                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                    }`}
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Campo Quais Dados são Processados */}
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-505 uppercase tracking-wider block">Quais Dados são Processados?</label>
                            <textarea
                              value={coordQuaisDados}
                              onChange={(e) => setCoordQuaisDados(e.target.value)}
                              placeholder="Descreva detalhadamente os dados analisados/processados pela ferramenta (ex: CPF, nome, prontuário, exames, etc.)."
                              className="w-full text-xs font-semibold p-4 outline-none rounded-xl border border-slate-200 focus:border-indigo-400 focus:bg-indigo-50/10 placeholder-slate-400 bg-white text-slate-750 min-h-[70px] resize-none shadow-sm transition-all"
                            />
                          </div>

                          {/* Campo Dados Anonimizados */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-505 uppercase tracking-wider block">Os dados são anonimizados?</label>
                              <div className="flex gap-1.5">
                                {["Sim", "Não", "Parcial"].map(opt => (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => setCoordDadosAnonimizados(opt)}
                                    className={`flex-1 py-3 rounded-xl text-[10px] font-extrabold uppercase tracking-wider border transition-all duration-200 cursor-pointer ${
                                      coordDadosAnonimizados === opt
                                        ? "bg-indigo-50 border-indigo-400 text-indigo-800 shadow-xs ring-2 ring-indigo-550/15"
                                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                    }`}
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-505 uppercase tracking-wider block">Compartilha ambiente externo / Fornecedor?</label>
                              <div className="flex gap-2">
                                {["Sim", "Não"].map(opt => (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => setCoordEnvioFornecedorExterno(opt)}
                                    className={`flex-1 py-3 rounded-xl text-[10px] font-extrabold uppercase tracking-wider border transition-all duration-200 cursor-pointer ${
                                      coordEnvioFornecedorExterno === opt
                                        ? "bg-indigo-50 border-indigo-400 text-indigo-800 shadow-xs ring-2 ring-indigo-550/15"
                                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                    }`}
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Campo Armazenamento de treinamento de dados */}
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">A ferramenta armazena ou utiliza os dados para treinamento?</label>
                            <div className="flex gap-2">
                              {["Sim", "Não", "Não sei"].map(opt => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => setCoordDadosTreinamentoModelo(opt)}
                                  className={`flex-1 py-3 rounded-xl text-[10px] font-extrabold uppercase tracking-wider border transition-all duration-200 cursor-pointer ${
                                    coordDadosTreinamentoModelo === opt
                                      ? "bg-indigo-50 border-indigo-400 text-indigo-800 shadow-xs ring-2 ring-indigo-550/15"
                                      : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {currentStepNum === 2 && (
                      <div className="space-y-4 pt-1">
                        {/* PAINEL EXECUTIVO DE DECISÃO RÁPIDA (PARA O GERENTE DO NIT) */}
                        <div className="bg-gradient-to-br from-[#075618]/5 via-[#075618]/0 to-slate-50/40 border border-[#BFD8C5]/50 rounded-2xl p-4 shadow-2xs space-y-3 transition-all">
                          <button
                            type="button"
                            onClick={() => setShowPainelExecutivo(prev => !prev)}
                            className="w-full flex items-center justify-between cursor-pointer group hover:opacity-95"
                          >
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-lg bg-[#075618]/10 text-[#075618]">
                                <Activity size={13} />
                              </div>
                              <p className="text-[10px] font-black uppercase text-[#075618] tracking-wider">Painel Executivo de Decisão Rápida</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[8px] bg-white border border-[#BFD8C5] text-[#075618] font-black px-2.5 py-0.5 rounded-full uppercase tracking-widest group-hover:bg-[#EAF4EC]/40 transition-all">
                                {showPainelExecutivo ? "Ocultar Síntese ✖" : "Ver Síntese ⚡"}
                              </span>
                            </div>
                          </button>

                          {showPainelExecutivo && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pt-3 border-t border-dashed border-[#BFD8C5]/40 transition-all duration-300">
                              {/* Bloco A: Resumo Crítico do Solicitante */}
                              <div className="bg-white border border-slate-200/60 p-3.5 rounded-xl space-y-2.5 shadow-2xs">
                                <p className="text-[8px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                                  <Info size={10} className="text-slate-505" /> DADOS DA SOLICITAÇÃO
                                </p>
                                
                                <div className="space-y-2 text-xs text-slate-705 font-semibold">
                                  <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    <span className="text-[8px] text-[#075618]/70 font-black uppercase">IA Proposta</span>
                                    <span className="font-extrabold text-slate-900 truncate max-w-[140px] uppercase text-[10px]">{record.nomeFerramenta}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-[10px] px-1">
                                    <span className="text-[8px] text-slate-400 uppercase">Setor / Cargo</span>
                                    <span className="font-semibold text-slate-600 truncate max-w-[150px] uppercase">{record.unidadeSetor} • {record.cargo || "Não inf."}</span>
                                  </div>
                                  
                                  {/* Alerta de Risco LGPD */}
                                  <div className="flex justify-between items-center text-[10px] px-1">
                                    <span className="text-[8px] text-slate-400 uppercase">Tratamento de Dados</span>
                                    <div className="flex gap-1">
                                      <span className={`px-2 py-0.5 rounded text-[8px] font-black ${record.usaDadosPessoais === "Sim" ? "bg-amber-100 text-amber-805" : "bg-slate-100 text-slate-500"}`}>
                                        {record.usaDadosPessoais === "Sim" ? "PESSOAIS ⚠️" : "NÃO PESSOAIS"}
                                      </span>
                                      <span className={`px-2 py-0.5 rounded text-[8px] font-black ${record.usaDadosSensiveis === "Sim" ? "bg-rose-100 text-rose-805" : "bg-slate-100 text-slate-500"}`}>
                                        {record.usaDadosSensiveis === "Sim" ? "SENSÍVEIS 🔥" : "NÃO SENSÍVEIS"}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Criticidade Estimada */}
                                  <div className="flex justify-between items-center text-[10px] px-1">
                                    <span className="text-[8px] text-slate-400 uppercase">Criticidade Geral</span>
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${
                                      record.criticidade?.toLowerCase().includes("alta") || record.criticidade?.toLowerCase().includes("crít")
                                        ? "bg-rose-50 border-rose-200 text-rose-850"
                                        : record.criticidade?.toLowerCase().includes("méd")
                                        ? "bg-amber-50 border-amber-200 text-amber-850"
                                        : "bg-emerald-50 border-emerald-200 text-emerald-850"
                                    }`}>
                                      {record.criticidade || "Baixa"}
                                    </span>
                                  </div>

                                  {/* Resumo da descrição */}
                                  <div className="pt-2 border-t border-slate-100">
                                    <span className="text-[8px] text-slate-400 uppercase block mb-1">Finalidade do Uso</span>
                                    <p className="text-[10px] text-slate-650 font-medium leading-relaxed italic bg-emerald-50/5 p-2 rounded-lg border border-emerald-100/10 truncate">
                                      {record.descricaoAtividade || "Nenhuma descrição fornecida."}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {/* Bloco B: Parecer Consolidado do Coordenador NIT */}
                              {(() => {
                                const coordStep = wf?.steps?.find(s => s.stepNumber === 1);
                                const commentRaw = coordStep?.comment || "";
                                
                                const matchAlinhamento = commentRaw.match(/Alinhamento Estratégico:\s*([^\n•]+)/i);
                                const matchTransferencia = commentRaw.match(/Potencial de Transferência:\s*([^\n•]+)/i);
                                const matchViabilidade = commentRaw.match(/Viabilidade de Patentes:\s*([^\n•]+)/i);
                                const matchParecerText = commentRaw.match(/\*\*Parecer:\*\*\s*(.+)$/is) || commentRaw.match(/Parecer Final:\s*(.+)$/is) || commentRaw.match(/\*\*Parecer Final da Etapa:\*\*\s*(.+)$/is);

                                const alinhamentoVal = matchAlinhamento ? matchAlinhamento[1].trim() : "Alinhado";
                                const transferenciaVal = matchTransferencia ? matchTransferencia[1].trim() : "Médio";
                                const viabilidadeVal = matchViabilidade ? matchViabilidade[1].trim() : "Sim";
                                const parecerJustificativa = matchParecerText ? matchParecerText[1].trim() : (commentRaw ? commentRaw : "Sem parecer detalhado do coordenador do NIT.");

                                return (
                                  <div className="bg-white border border-slate-200/60 p-3.5 rounded-xl space-y-2.5 shadow-2xs">
                                    <p className="text-[8px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                                      <ShieldCheck size={10} className="text-[#075618]" /> PARECER COORDENADOR NIT
                                    </p>
                                    
                                    <div className="space-y-2 text-xs text-slate-705 font-semibold">
                                      <div className="flex justify-between items-center text-[10px] px-1">
                                        <span className="text-[8px] text-slate-400 uppercase">Alinhamento</span>
                                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${
                                          alinhamentoVal.includes("Não") ? "bg-rose-50 border-rose-220 text-rose-850" : alinhamentoVal.includes("Parcial") ? "bg-amber-50 border-amber-220 text-amber-850" : "bg-emerald-50 border-emerald-220 text-emerald-850"
                                        }`}>{alinhamentoVal}</span>
                                      </div>
                                      
                                      <div className="flex justify-between items-center text-[10px] px-1">
                                        <span className="text-[8px] text-slate-400 uppercase">Transferência</span>
                                        <span className="text-slate-905 font-extrabold uppercase">{transferenciaVal}</span>
                                      </div>

                                      <div className="flex justify-between items-center text-[10px] px-1">
                                        <span className="text-[8px] text-slate-400 uppercase">Reg. Software</span>
                                        <span className={`px-2 py-0.5 rounded text-[8px] font-black border ${
                                          viabilidadeVal === "Sim" ? "bg-emerald-50 text-emerald-805 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"
                                        }`}>{viabilidadeVal}</span>
                                      </div>

                                      {/* Parecer textual reduzido */}
                                      <div className="pt-2 border-t border-slate-100">
                                        <span className="text-[8px] text-slate-400 uppercase block mb-1">Parecer Coordenador</span>
                                        <p className="text-[10px] text-slate-650 font-medium leading-relaxed italic bg-indigo-50/5 p-2 rounded-lg border border-indigo-100/10 truncate">
                                          {parecerJustificativa}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>

                        {/* FORMULÁRIO GESTÃO DE RISCO DO GERENTE NIT - DESIGN COMPACTO E LIMPO */}
                        <div className="space-y-4">
                          {/* BLOCO 1 - IDENTIFICAÇÃO DOS RISCOS (Compacto) */}
                          <div className="bg-white border border-[#BFD8C5]/45 rounded-2xl p-4 space-y-3.5 shadow-2xs">
                            <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
                              <span className="text-[9px] bg-[#075618] text-white size-4.5 rounded-full flex items-center justify-center font-black">1</span>
                              <h5 className="text-[9px] font-black text-[#075618] uppercase tracking-widest">Identificação dos riscos</h5>
                            </div>

                            {/* Campo 1.1 */}
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">1. Foram identificados riscos relevantes no uso da IA?</label>
                              <div className="flex gap-1.5">
                                {["Sim", "Não", "Não identificado"].map((opt) => (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => setG1RiscosRelevantes(opt as any)}
                                    className={`flex-1 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wider border transition-all duration-200 cursor-pointer ${
                                      g1RiscosRelevantes === opt
                                        ? "bg-emerald-50 border-[#03440c] text-[#03440c] shadow-2xs ring-1 ring-[#03440c]/10"
                                        : "bg-white border-slate-205 text-slate-500 hover:bg-slate-50"
                                    }`}
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Campo 1.2 */}
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">2. Tipo de risco identificado (Multi-escolha)</label>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 text-[9px] font-semibold">
                                {[
                                  "Dados e sigilo",
                                  "Segurança da informação",
                                  "Integração com sistemas",
                                  "Processo operacional",
                                  "Resultado laboratorial",
                                  "Uso inadequado da IA",
                                  "Falha de validação humana",
                                  "Reputacional",
                                  "Outro"
                                ].map((opt) => {
                                  const isSelected = g1TiposRisk.includes(opt);
                                  return (
                                    <button
                                      key={opt}
                                      type="button"
                                      onClick={() => {
                                        if (isSelected) {
                                          setG1TiposRisk(g1TiposRisk.filter(item => item !== opt));
                                        } else {
                                          setG1TiposRisk([...g1TiposRisk, opt]);
                                        }
                                      }}
                                      className={`py-1.5 px-2.5 rounded-lg border text-[9px] font-bold uppercase transition-all duration-200 text-left flex items-center justify-between cursor-pointer ${
                                        isSelected
                                          ? "bg-emerald-50/70 border-[#03440c]/70 text-[#03440c] shadow-2xs ring-1 ring-[#03440c]/5"
                                          : "bg-white border-slate-200 text-slate-605 hover:bg-slate-50"
                                      }`}
                                    >
                                      <span className="truncate">{opt}</span>
                                      {isSelected ? (
                                        <span className="size-3.5 rounded-full bg-[#03440c] text-white flex items-center justify-center font-black text-[8px] shrink-0">✓</span>
                                      ) : (
                                        <span className="size-3.5 rounded-full border border-slate-250 flex items-center justify-center text-[8px] text-slate-300 shrink-0"></span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Campo 1.3 - Condicional */}
                            {(g1RiscosRelevantes === "Sim" || g1TiposRisk.length > 0) && (
                              <div className="space-y-1.5 pt-0.5">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">3. Descrição dos riscos identificados</label>
                                <textarea
                                  value={g1Descricao}
                                  onChange={(e) => setG1Descricao(e.target.value)}
                                  placeholder="Descreva tecnicamente os riscos mapeados nesta IA, como viés na tomada de decisões, problemas na segurança dos dados ou vazamentos..."
                                  className="w-full h-18 bg-slate-50/30 border border-slate-200 hover:border-slate-350 text-slate-900 placeholder-slate-400 rounded-xl p-3 text-xs font-semibold focus:border-[#03440c] focus:ring-1 focus:ring-[#03440c]/10 outline-none transition-all resize-none shadow-sm"
                                />
                              </div>
                            )}
                          </div>

                          {/* BLOCO 2 - CONTROLES E MITIGAÇÃO (Compacto) */}
                          <div className="bg-white border border-[#BFD8C5]/45 rounded-2xl p-4 space-y-3.5 shadow-2xs">
                            <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
                              <span className="text-[9px] bg-[#075618] text-white size-4.5 rounded-full flex items-center justify-center font-black">2</span>
                              <h5 className="text-[9px] font-black text-[#075618] uppercase tracking-widest">Controles e mitigação</h5>
                            </div>

                            {/* Campo 2.1 */}
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">1. Existem controles previstos ou implementados para reduzir os riscos?</label>
                              <div className="flex gap-1.5 flex-wrap md:flex-nowrap">
                                {["Sim", "Não", "Parcialmente", "Não se aplica"].map((opt) => (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => setG2ControlesExistentes(opt as any)}
                                    className={`flex-1 py-1.5 px-2 rounded-lg text-[9px] font-extrabold uppercase tracking-wider border transition-all duration-200 cursor-pointer ${
                                      g2ControlesExistentes === opt
                                        ? "bg-emerald-50 border-[#03440c] text-[#03440c] shadow-2xs ring-1 ring-[#03440c]/10"
                                        : "bg-white border-slate-205 text-slate-500 hover:bg-slate-50"
                                    }`}
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Campo 2.2 */}
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">2. Quais controles existem? (Multi-escolha)</label>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 text-[9px] font-semibold">
                                {[
                                  "Revisão humana obrigatória",
                                  "Restrição de acesso",
                                  "Controle de dados inseridos",
                                  "Monitoramento de uso",
                                  "Logs e trilha de auditoria",
                                  "Validação técnica prévia",
                                  "Treinamento dos usuários",
                                  "Controle de versão",
                                  "Plano de contingência",
                                  "Uso em ambiente de teste/homologação",
                                  "Outro"
                                ].map((opt) => {
                                  const isSelected = g2ControlesTipos.includes(opt);
                                  return (
                                    <button
                                      key={opt}
                                      type="button"
                                      onClick={() => {
                                        if (isSelected) {
                                          setG2ControlesTipos(g2ControlesTipos.filter(item => item !== opt));
                                        } else {
                                          setG2ControlesTipos([...g2ControlesTipos, opt]);
                                        }
                                      }}
                                      className={`py-1.5 px-2.5 rounded-lg border text-[9px] font-bold uppercase transition-all duration-200 text-left flex items-center justify-between cursor-pointer ${
                                        isSelected
                                          ? "bg-emerald-50/70 border-[#03440c]/70 text-[#03440c] shadow-2xs ring-1 ring-[#03440c]/5"
                                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                      }`}
                                    >
                                      <span className="truncate">{opt}</span>
                                      {isSelected ? (
                                        <span className="size-3.5 rounded-full bg-[#03440c] text-white flex items-center justify-center font-black text-[8px] shrink-0">✓</span>
                                      ) : (
                                        <span className="size-3.5 rounded-full border border-slate-250 flex items-center justify-center text-[8px] text-slate-300 shrink-0"></span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Campo 2.3 - Condicional */}
                            {(g2ControlesExistentes === "Não" || g2ControlesExistentes === "Parcialmente") && (
                              <div className="space-y-1.5 pt-0.5">
                                <div className="flex items-center justify-between">
                                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                                    3. Controles adicionais necessários
                                  </label>
                                  <span className="text-[8px] bg-rose-50 border border-rose-250 text-rose-800 font-extrabold tracking-wider uppercase px-2 py-0.5 rounded-lg">
                                    Obrigatório ⚠️
                                  </span>
                                </div>
                                <textarea
                                  value={g2ControlesAdicionais}
                                  onChange={(e) => setG2ControlesAdicionais(e.target.value)}
                                  placeholder="Liste e descreva quais medidas preventivas adicionais são sugeridas ou necessárias para mitigar os riscos mapeados..."
                                  className="w-full h-18 bg-slate-50/30 border border-slate-200 hover:border-slate-350 text-slate-900 placeholder-slate-400 rounded-xl p-3 text-xs font-semibold focus:border-[#03440c] focus:ring-1 focus:ring-[#03440c]/10 outline-none transition-all resize-none shadow-sm"
                                  required={g2ControlesExistentes === "Não" || g2ControlesExistentes === "Parcialmente"}
                                />
                              </div>
                            )}
                          </div>

                          {/* BLOCO 3 - RISCO RESIDUAL E RESPONSABILIDADE (Compacto) */}
                          <div className="bg-white border border-[#BFD8C5]/45 rounded-2xl p-4 space-y-3.5 shadow-2xs">
                            <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
                              <span className="text-[9px] bg-[#075618] text-white size-4.5 rounded-full flex items-center justify-center font-black">3</span>
                              <h5 className="text-[9px] font-black text-[#075618] uppercase tracking-widest">Risco residual e responsabilidade</h5>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                              {/* Risco Residual */}
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">1. Risco residual após os controles</label>
                                <div className="flex flex-wrap gap-1">
                                  {[
                                    { val: "Baixo", col: "bg-emerald-50 border-emerald-250 text-emerald-800", selCol: "bg-[#075618] border-[#075618] text-white shadow-2xs" },
                                    { val: "Médio", col: "bg-amber-50 border-amber-250 text-amber-850", selCol: "bg-amber-500 border-amber-500 text-white shadow-2xs" },
                                    { val: "Alto", col: "bg-orange-50 border-orange-250 text-orange-850", selCol: "bg-orange-600 border-orange-600 text-white shadow-2xs" },
                                    { val: "Crítico", col: "bg-rose-50 border-rose-250 text-rose-850", selCol: "bg-rose-600 border-rose-600 text-white shadow-2xs" },
                                    { val: "Não avaliado", col: "bg-slate-50 border-slate-250 text-slate-500", selCol: "bg-slate-505 border-slate-505 text-white shadow-2xs" }
                                  ].map((opt) => {
                                    const isSelected = g3RiscoResidual === opt.val;
                                    return (
                                      <button
                                        key={opt.val}
                                        type="button"
                                        onClick={() => setG3RiscoResidual(opt.val as any)}
                                        className={`px-2.5 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wider border transition-all duration-200 cursor-pointer ${
                                          isSelected ? opt.selCol : `${opt.col} hover:bg-slate-50`
                                        }`}
                                      >
                                        {opt.val}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Responsável pelo Acompanhamento (Dropdown) */}
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">2. Responsável pelo acompanhamento do risco</label>
                                <select
                                  value={g3Responsavel}
                                  onChange={(e) => setG3Responsavel(e.target.value)}
                                  className="w-full py-1.5 px-3 rounded-lg text-xs font-black uppercase tracking-wider border border-slate-205 text-slate-700 bg-white hover:border-[#03440c] focus:border-[#03440c] outline-none transition-all shadow-2xs cursor-pointer"
                                >
                                  {[
                                    "NIT",
                                    "TI",
                                    "Segurança da Informação",
                                    "Qualidade",
                                    "Responsável técnico",
                                    "Setor solicitante",
                                    "Gestor da área",
                                    "Outro"
                                  ].map((opt) => (
                                    <option key={opt} value={opt} className="font-extrabold uppercase text-[10px] text-slate-700">
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* Campo 3.3 */}
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">3. Observações de riscos e controles</label>
                              <textarea
                                value={g3Observacoes}
                                onChange={(e) => setG3Observacoes(e.target.value)}
                                placeholder="Insira quaisquer notas, observações jurídicas, de patentes ou recomendações especiais sobre os riscos e formas de mitigação planejados..."
                                className="w-full h-18 bg-slate-50/30 border border-slate-200 hover:border-slate-350 text-slate-900 placeholder-slate-400 rounded-xl p-3 text-xs font-semibold focus:border-[#03440c] focus:ring-1 focus:ring-[#03440c]/10 outline-none transition-all resize-none shadow-sm"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}


                    {currentStepNum === 3 && (
                      <div className="space-y-4 pt-1">
                        {/* Título da seção */}
                        <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 flex items-center gap-2.5">
                          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-700">
                            <ShieldCheck size={14} />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-indigo-900 uppercase tracking-wider">Homologação Gerente TI</p>
                            <span className="text-[9px] text-slate-500 font-medium tracking-tight">Avaliação estrita de compliance, infraestrutura de rede, LGPD e integrações corporativas.</span>
                          </div>
                        </div>

                        {/* Bloco de Campos de TI */}
                        <div className="bg-white border border-slate-200/85 rounded-2xl p-4 space-y-1 shadow-2xs">
                          
                          {/* 1. Compatibilidade */}
                          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between py-2 border-b border-slate-100 gap-2">
                            <div className="space-y-0.5">
                              <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">1. Compatibilidade de Rede, Recursos e APIs</label>
                              <span className="text-[9px] text-slate-400 font-medium block leading-tight">Capacidade de hospedar ou conectar à rede corporativa</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {["Compatível / Cloud nativa", "Requer novas VMs", "Incompatível"].map(opt => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => setTiInfra(opt)}
                                  className={`px-2.5 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wider border transition-all duration-200 cursor-pointer ${
                                    tiInfra === opt
                                      ? "bg-indigo-50 border-indigo-400 text-indigo-805 shadow-xs ring-2 ring-indigo-550/15"
                                      : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* 2. Segurança */}
                          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between py-2 border-b border-slate-100 gap-2">
                            <div className="space-y-0.5">
                              <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">2. Garantias de Segurança de Dados e LGPD</label>
                              <span className="text-[9px] text-slate-400 font-medium block leading-tight">Adequabilidade às leis de segurança de dados do país</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {["Conforme", "Alerta", "Crítico"].map(opt => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => setTiSeguranca(opt)}
                                  className={`px-2.5 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wider border transition-all duration-200 cursor-pointer ${
                                    tiSeguranca === opt
                                      ? "bg-indigo-50 border-indigo-400 text-indigo-805 shadow-xs ring-2 ring-indigo-550/15"
                                      : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* 3. Integração */}
                          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between py-2 border-b border-slate-100 gap-2">
                            <div className="space-y-0.5">
                              <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">3. Integração com Sistemas de TI Cedro</label>
                              <span className="text-[9px] text-slate-400 font-medium block leading-tight">Interação com ecossistema interno Cedro</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {["Não / Plataforma autônoma", "Sim / Requer API", "Sim / Requer customização"].map(opt => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => setTiIntegracao(opt)}
                                  className={`px-2.5 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wider border transition-all duration-200 cursor-pointer ${
                                    tiIntegracao === opt
                                      ? "bg-indigo-50 border-indigo-400 text-indigo-805 shadow-xs ring-2 ring-indigo-550/15"
                                      : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* 4. Ambiente de uso da ferramenta */}
                          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between py-2 border-b border-slate-100 gap-2">
                            <div className="space-y-0.5">
                              <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">4. Ambiente de uso da ferramenta</label>
                              <span className="text-[9px] text-slate-400 font-medium block leading-tight">Local físico ou virtual de execução da IA</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {["Cloud externa", "Ambiente interno", "Não identificado"].map(opt => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => setTiAmbiente(opt)}
                                  className={`px-2.5 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wider border transition-all duration-200 cursor-pointer ${
                                    tiAmbiente === opt
                                      ? "bg-indigo-50 border-indigo-400 text-indigo-805 shadow-xs ring-2 ring-indigo-550/15"
                                      : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* 5. Controle de acesso */}
                          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between py-2 border-b border-slate-100 gap-2">
                            <div className="space-y-0.5">
                              <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">5. Controle de acesso</label>
                              <span className="text-[9px] text-slate-400 font-medium block leading-tight">Segurança de login e permissões de usuários</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {["Adequado", "Requer ajuste", "Não informado"].map(opt => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => setTiControleAcesso(opt)}
                                  className={`px-2.5 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wider border transition-all duration-200 cursor-pointer ${
                                    tiControleAcesso === opt
                                      ? "bg-indigo-50 border-indigo-400 text-indigo-805 shadow-xs ring-2 ring-indigo-550/15"
                                      : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* 6. Logs e rastreabilidade */}
                          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between py-2 border-b border-slate-100 gap-2">
                            <div className="space-y-0.5">
                              <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">6. Logs e rastreabilidade</label>
                              <span className="text-[9px] text-slate-400 font-medium block leading-tight">Registro de ações para auditoria técnica de acessos</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {["Possui logs", "Não possui logs", "Não informado"].map(opt => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => setTiLogs(opt)}
                                  className={`px-2.5 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wider border transition-all duration-200 cursor-pointer ${
                                    tiLogs === opt
                                      ? "bg-indigo-50 border-indigo-400 text-indigo-805 shadow-xs ring-2 ring-indigo-550/15"
                                      : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* 7. Necessita ação técnica da TI? */}
                          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between py-2 gap-2">
                            <div className="space-y-0.5">
                              <label className="text-[10px] font-black text-slate-700 uppercase tracking-wider block">7. Necessita ação técnica da TI?</label>
                              <span className="text-[9px] text-slate-400 font-medium block leading-tight">Esforço técnico operacional do time Cedro</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {["Não", "Sim, baixa complexidade", "Sim, alta complexidade"].map(opt => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => setTiAcao(opt)}
                                  className={`px-2.5 py-1.5 rounded-lg text-[9px] font-extrabold uppercase tracking-wider border transition-all duration-200 cursor-pointer ${
                                    tiAcao === opt
                                      ? "bg-indigo-50 border-indigo-400 text-indigo-805 shadow-xs ring-2 ring-indigo-550/15"
                                      : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>

                        </div>
                      </div>
                    )}

                    {/* Etapas de decisão / Formulários dinâmicos baseados no tipo de etapa */}
                    {currentStepNum === 4 ? (
                      <div className="bg-gradient-to-br from-emerald-50/40 via-white to-slate-50 border border-emerald-250 p-6 rounded-2xl space-y-5 shadow-xs">
                        <div className="flex items-center gap-3 border-b border-dashed border-emerald-200 pb-3">
                          <div className="p-2 bg-emerald-50 text-emerald-800 rounded-xl">
                            <CheckCircle2 size={18} />
                          </div>
                          <div>
                            <h3 className="text-sm font-black uppercase text-emerald-850 tracking-wider">Confirmação Geral de Período de Teste</h3>
                            <span className="text-[10px] text-slate-505 font-semibold block">Inovação e Homologabilidade Prática da IA</span>
                          </div>
                        </div>
                        
                        <p className="text-xs text-slate-650 leading-relaxed font-semibold">
                          Antes de avançar no fluxo para a análise orçamentária e financeira, confirme formalmente se a ferramenta de IA foi exaustivamente simulada ou testada e demonstrou a utilidade pretendida em conformidade com as diretivas das comissões do Cedro.
                        </p>
                        
                        <div className="bg-emerald-50/10 border border-emerald-100 p-4 rounded-xl space-y-3">
                          <p className="text-[10px] font-black text-slate-800 uppercase tracking-wider">
                            O período de teste foi realizado e a ferramenta demonstrou condições operacionais mínimas?
                          </p>
                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() => setPeriodoTesteConfirmado("Sim")}
                              className={`flex-1 py-3.5 px-4 rounded-xl text-xs font-black transition-all border flex items-center justify-center gap-2 cursor-pointer ${
                                periodoTesteConfirmado === "Sim"
                                  ? "bg-[#03440c] border-[#03440c] text-white shadow-md shadow-emerald-100"
                                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                              }`}
                            >
                              <CheckCircle2 size={14} className={periodoTesteConfirmado === "Sim" ? "text-white" : "text-emerald-700"} /> SIM, HOMOLOGADA ✅
                            </button>
                            <button
                              type="button"
                              onClick={() => setPeriodoTesteConfirmado("Não")}
                              className={`flex-1 py-3.5 px-4 rounded-xl text-xs font-black transition-all border flex items-center justify-center gap-2 cursor-pointer ${
                                periodoTesteConfirmado === "Não"
                                  ? "bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-100 animate-pulse"
                                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                              }`}
                            >
                              <XCircle size={14} className={periodoTesteConfirmado === "Não" ? "text-white" : "text-rose-600"} /> NÃO HOMOLOGADA ❌
                            </button>
                          </div>
                        </div>

                        {/* Campo Observações Opcional */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">Observações do Solicitador / Comentários Técnicos (Opcional)</label>
                          <textarea
                            value={auditComment}
                            onChange={(e) => setAuditComment(e.target.value)}
                            placeholder="Insira detalhes adicionais sobre o período de teste e suas condições técnicas observadas no laboratório..."
                            className="w-full h-24 bg-white border border-slate-200 hover:border-slate-350 text-slate-900 placeholder-slate-400 rounded-xl p-4 text-xs font-semibold focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/10 outline-none transition-all resize-none shadow-sm"
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Etapas 5 e 6 (Presidência e Direção Financeira) têm modo de visualização exclusivo de governança e decisão, sem campo de justificativa */}
                        {(currentStepNum === 5 || currentStepNum === 6) ? null : (
                          /* Parecer de Texto Livre Comum a Todos (exceto Etapa 4 que é embutido e Etapas 5/6 que não necessitam de explicações) */
                          <div className="space-y-2.5 pt-2">
                            <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                              <MessageSquare size={13} className="text-[#03440c]" /> Parecer Técnico Justificado
                            </label>
                            <textarea 
                              value={auditComment}
                              onChange={(e) => setAuditComment(e.target.value)}
                              placeholder="Descreva aqui sua justificativa técnica detalhada corporativa. Seus argumentos de parecer fundamentarão documentalmente o histórico desta IA no banco do Cedro..."
                              className="w-full h-32 bg-white border border-slate-200 hover:border-slate-350 text-slate-900 placeholder-slate-400 rounded-2xl p-4 text-xs font-semibold focus:border-[#03440c] focus:ring-2 focus:ring-[#03440c]/10 outline-none transition-all resize-none shadow-sm"
                              required
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Ações / Botões Finais de Aprovar ou Negar no Final do Formulário */}
                  <div className="border-t border-slate-250 pt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <button 
                      onClick={() => setAnalysisModal({ isOpen: false, record: null })}
                      className="w-full sm:w-auto px-6 py-3.5 text-[10px] font-black text-slate-500 hover:text-slate-800 tracking-wider uppercase transition-all duration-200 rounded-xl hover:bg-slate-100 text-center cursor-pointer border border-transparent hover:border-slate-205"
                    >
                      Cancelar
                    </button>
                    {currentStepNum === 4 ? (
                      <button 
                        onClick={() => {
                          const statusToSubmit = periodoTesteConfirmado === "Sim" ? StatusAuditoria.APROVADO : StatusAuditoria.NEGADO;
                          handleDecisionSubmit(statusToSubmit);
                        }}
                        className={`w-full sm:w-auto py-3.5 px-8 text-[11px] font-black text-white tracking-widest uppercase transition-all duration-200 border rounded-xl text-center active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
                          periodoTesteConfirmado === "Sim" 
                            ? "bg-[#03440c] hover:bg-emerald-800 border-transparent shadow-[#03440c]/10 hover:shadow-md" 
                            : "bg-rose-600 hover:bg-rose-700 border-transparent shadow-rose-650/15 hover:shadow-md"
                        }`}
                      >
                        {periodoTesteConfirmado === "Sim" ? (
                          <>
                            <CheckCircle2 size={14} /> Confirmar Decisão (Aprovar)
                          </>
                        ) : (
                          <>
                            <XCircle size={14} /> Confirmar Decisão (Negar)
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                        <button 
                          onClick={() => handleDecisionSubmit(StatusAuditoria.NEGADO)}
                          className="w-full sm:w-auto py-3.5 px-6.5 text-[11px] font-black text-white tracking-widest uppercase transition-all duration-200 bg-rose-600 hover:bg-rose-700 hover:shadow-md rounded-xl text-center active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-rose-500/10 border border-transparent"
                        >
                          <XCircle size={14} /> Negar Etapa
                        </button>
                        <button 
                          onClick={() => handleDecisionSubmit(StatusAuditoria.APROVADO)}
                          className="w-full sm:w-auto py-3.5 px-7 text-[11px] font-black text-white tracking-widest uppercase transition-all duration-200 bg-[#03440c] hover:bg-emerald-800 hover:shadow-md rounded-xl text-center active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-emerald-500/10 border border-transparent"
                        >
                          <CheckCircle2 size={14} /> Aprovar Etapa
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
