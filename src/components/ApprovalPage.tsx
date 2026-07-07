import React, { useState, useMemo, useEffect } from "react";
import { CustomDropdown } from "./CustomDropdown";
import { 
  CheckCircle2, XCircle, Users, LayoutGrid, Search, 
  Filter, MoreHorizontal, ShieldCheck, ShieldAlert, ShieldX, 
  Database, ArrowUpRight, TrendingUp, AlertTriangle, Activity,
  ChevronLeft, Clock, Settings, Save, Check, Shield, CircleDot, Info,
  ClipboardCheck, Sliders, ChevronDown, ChevronUp, MessageSquare, Briefcase, Scale, X
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
  if (!record) return "Não preenchido";
  
  if (record.observacoesGeraisOriginais && record.observacoesGeraisOriginais.trim() !== "") {
    return record.observacoesGeraisOriginais;
  }
  
  const currentObs = record.observacoesGerais;
  if (!currentObs || currentObs.trim() === "") {
    return "Não preenchido";
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
    return "Não preenchido";
  }

  return currentObs;
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
      parecer: getCleanLastOpinion(raw.trim())
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
    parecer: getCleanLastOpinion(parecer || rawComment),
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
  const [coordClarezaSolicitacao, setCoordClarezaSolicitacao] = useState("Sim");
  const [coordUsoIA, setCoordUsoIA] = useState("Sim");
  const [coordEncaminhamento, setCoordEncaminhamento] = useState("Sim");

  const [showPainelExecutivo, setShowPainelExecutivo] = useState(false);

  // States for NIT Gerente (Etapa 2)
  const [gerNitImportancia, setGerNitImportancia] = useState("Sim");
  const [gerNitRiscos, setGerNitRiscos] = useState("Não");
  const [gerNitCuidados, setGerNitCuidados] = useState("Não");
  const [gerNitEncaminhamento, setGerNitEncaminhamento] = useState("Sim");

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
  const [showDetailedFolders, setShowDetailedFolders] = useState(false);
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
      setShowDetailedFolders(false);
      setAuditComment("");
      setCoordClarezaSolicitacao("Sim");
      setCoordUsoIA("Sim");
      setCoordEncaminhamento("Sim");

      setShowPainelExecutivo(false);
      
      setGerNitImportancia("Sim");
      setGerNitRiscos("Não");
      setGerNitCuidados("Não");
      setGerNitEncaminhamento("Sim");

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

  // Encontra se o usuário logado está configurado como responsável para a etapa 5 (Presidência) ou etapa 6 (Direção Financeira)
  const isStep5Or6User = useMemo(() => {
    return currentSteps.some(step => 
      (step.stepNumber === 5 || step.stepNumber === 6) && 
      step.userId === currentUserId
    );
  }, [currentSteps, currentUserId]);

  // Força o filtro "Minha vez" para usuários da etapa 5 e 6
  useEffect(() => {
    if (isStep5Or6User && queueFilter !== "my_turn") {
      setQueueFilter("my_turn");
    }
  }, [isStep5Or6User, queueFilter]);

  // Encontra o fluxo de processo real para cada IA
  const getRecordWf = (recordId: string) => {
    return workflows.find(wf => wf.iaRecordId === recordId);
  };

  const filteredRecords = useMemo(() => {
    let list = records.filter(r => r.statusUso !== StatusUso.CANCELADA && r.statusUso !== StatusUso.SUSPENSO);

    // Se o usuário logado pertence à etapa 5 ou 6 do fluxo, ele SÓ pode ver as IAs que estão aguardando estritamente a sua aprovação
    if (isStep5Or6User) {
      list = list.filter(r => {
        const isPending = (r.statusAuditoria || StatusAuditoria.PENDENTE) === StatusAuditoria.PENDENTE;
        if (!isPending) return false;

        const wf = getRecordWf(r.id);
        const isWfFinished = wf && (wf.finalStatus === "aprovado" || wf.finalStatus === "negado" || wf.finalStatus === "cancelado");
        if (isWfFinished) return false;

        const currentStepNum = wf ? wf.currentStep : 1;
        // Deve estar exatamente na etapa dele (5 ou 6)
        if (currentStepNum !== 5 && currentStepNum !== 6) return false;

        const stepDef = currentSteps.find(s => s.stepNumber === currentStepNum);
        const wfStep = wf?.steps?.find(s => s.stepNumber === currentStepNum);
        const stepUserId = stepDef?.userId || wfStep?.assignedUserId;

        // O usuário logado deve ser o responsável designado por esta etapa
        return stepUserId === currentUserId;
      });
    }

    // Filtro de busca textual
    list = list.filter(r => {
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

    // Filtros de abas somente para usuários comuns (ou não restritos das etapas 5 e 6)
    if (!isStep5Or6User) {
      if (queueFilter === "pending") {
        list = list.filter(r => (r.statusAuditoria || StatusAuditoria.PENDENTE) === StatusAuditoria.PENDENTE);
      } else if (queueFilter === "my_turn") {
        list = list.filter(r => {
          const isPending = (r.statusAuditoria || StatusAuditoria.PENDENTE) === StatusAuditoria.PENDENTE;
          if (!isPending) return false;

          const wf = getRecordWf(r.id);
          const isWfFinished = wf && (wf.finalStatus === "aprovado" || wf.finalStatus === "negado" || wf.finalStatus === "cancelado");
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
        });
      }
    }

    return list;
  }, [records, queueFilter, approvalSearchTerm, workflows, currentSteps, currentUserId, profiles, isAdmin, isStep5Or6User]);

  const stats = useMemo(() => {
    const total = records.length;
    const activeRecords = records.filter(r => r.statusUso !== StatusUso.CANCELADA && r.statusUso !== StatusUso.SUSPENSO);
    
    // IAs sob responsabilidade direta do logado
    const myTurnCount = activeRecords.filter(r => {
      const isPending = (r.statusAuditoria || StatusAuditoria.PENDENTE) === StatusAuditoria.PENDENTE;
      if (!isPending) return false;
      const wf = workflows.find(w => w.iaRecordId === r.id);
      const isWfFinished = wf && (wf.finalStatus === "aprovado" || wf.finalStatus === "negado" || wf.finalStatus === "cancelado");
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

    const totalPending = isStep5Or6User 
      ? myTurnCount 
      : activeRecords.filter(r => (r.statusAuditoria || StatusAuditoria.PENDENTE) === StatusAuditoria.PENDENTE).length;

    return { total, myTurnCount, totalPending };
  }, [records, workflows, currentSteps, currentUserId, profiles, isAdmin, isStep5Or6User]);

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
          {!isStep5Or6User ? (
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
          ) : (
            <div className="px-1 py-0.5 flex items-center justify-between bg-[#F6F8F5] border border-[#E3E8E1] rounded-2xl">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#075618] bg-emerald-50 border border-emerald-100 px-2.5 py-1.5 rounded-xl w-full text-center">
                Apenas solicitações aguardando sua decisão
              </span>
            </div>
          )}

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
                const isWfFinished = (wf && (wf.finalStatus === "aprovado" || wf.finalStatus === "negado" || wf.finalStatus === "cancelado")) || record.statusUso === StatusUso.CANCELADA || record.statusUso === StatusUso.SUSPENSO;
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
                            setCoordClarezaSolicitacao("Sim");
                            setCoordUsoIA("Sim");
                            setCoordEncaminhamento("Sim");
                            setShowPainelExecutivo(false);
                            
                            setGerNitImportancia("Sim");
                            setGerNitRiscos("Não");
                            setGerNitCuidados("Não");
                            setGerNitEncaminhamento("Sim");

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
            initial={{ opacity: 0, scale: 0.985, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.985, y: -8 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
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
                    {!isStep5Or6User ? (
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
                    ) : (
                      <div className="px-1 py-1 flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#075618] bg-emerald-50 border border-emerald-100/50 px-3 py-1.5 rounded-lg w-full text-center">
                          Apenas solicitações aguardando sua decisão
                        </span>
                      </div>
                    )}

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
                    <div className="space-y-2 pr-1 pb-6">
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
                          const isWfFinished = (wf && (wf.finalStatus === "aprovado" || wf.finalStatus === "negado" || wf.finalStatus === "cancelado")) || record.statusUso === StatusUso.CANCELADA || record.statusUso === StatusUso.SUSPENSO;
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
                      const isWfFinished = (wf && (wf.finalStatus === "aprovado" || wf.finalStatus === "negado" || wf.finalStatus === "cancelado")) || record.statusUso === StatusUso.CANCELADA || record.statusUso === StatusUso.SUSPENSO;
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
                                    setCoordClarezaSolicitacao("Sim");
                                    setCoordUsoIA("Sim");
                                    setCoordEncaminhamento("Sim");
                                    setShowPainelExecutivo(false);
                                    
                                    setGerNitImportancia("Sim");
                                    setGerNitRiscos("Não");
                                    setGerNitCuidados("Não");
                                    setGerNitEncaminhamento("Sim");

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
                        <CustomDropdown
                          value={step.userId ?? ""}
                          onChange={(val) => {
                            const selectedProfile = privilegedProfiles.find(p => p.id === val);
                            const updated = [...workflowConfig];
                            updated[idx] = {
                              ...updated[idx],
                              userId: val || undefined,
                              userName: selectedProfile?.full_name || undefined,
                            };
                            setWorkflowConfig(updated);
                            setWorkflowSaved(false);
                          }}
                          placeholder="— Selecione um administrador ou moderador —"
                          options={privilegedProfiles.map(p => ({
                            value: p.id,
                            label: `${p.full_name} (${p.role === "admin" ? "Admin" : "Moderador"}${p.cargo ? ` • ${p.cargo}` : ""})`
                          }))}
                          size="md"
                        />
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

          const prevSteps = (wf?.steps || [])
            .filter((s) => s.stepNumber < currentStepNum && s.status !== "aguardando")
            .sort((a, b) => a.stepNumber - b.stepNumber);

          const activeWfStep = wf?.steps?.find(s => s.stepNumber === currentStepNum);
          const activeEvaluatorName = activeWfStep?.assignedUserName || activeStepDef?.assignedUserName || "Qualquer usuário";

          const renderMobileQuestion = (
            number: string,
            title: string,
            description: string,
            options: string[],
            value: string,
            onChange: (val: string) => void
          ) => (
            <div className="rounded-2xl border border-[#E8E7E7] bg-[#FAFAFA] p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#075618]/10 text-[10px] font-extrabold text-[#075618] font-lato">
                  {number}
                </div>
                <div className="space-y-1">
                  <p className="font-lato text-sm font-extrabold text-[#111111] leading-tight">
                    {title}
                  </p>
                  <p className="font-noto text-xs text-slate-500 leading-normal">
                    {description}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 pt-1">
                {options.map((opt) => {
                  const isSelected = value === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => onChange(opt)}
                      className={`w-full rounded-xl border px-4 py-3 text-left text-xs font-bold transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? "border-[#075618] bg-[#075618] text-white shadow-sm"
                          : "border-[#E8E7E7] bg-white text-slate-600 hover:border-[#075618]/40 hover:bg-[#075618]/5"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          );

          const handleDecisionSubmit = (status: StatusAuditoria) => {
            let finalComment = "";
            let extraFields: any = undefined;
            if (currentStepNum === 1) {
              finalComment = `Etapa: Coordenador NIT (Triagem Inicial)\n` +
                             `Clareza da Solicitação: ${coordClarezaSolicitacao}\n` +
                             `Uso de Inteligência Artificial: ${coordUsoIA}\n` +
                             `Encaminhamento: ${coordEncaminhamento}\n` +
                             `Parecer da Triagem: ${auditComment || "Triagem inicial realizada sem observações complementares."}`;
              
              extraFields = undefined;
            } else if (currentStepNum === 2) {
              finalComment = `Etapa: Gerente NIT\n` +
                             `Riscos da Solicitação: ${gerNitRiscos}\n` +
                             `Cuidados Necessários: ${gerNitCuidados}\n` +
                             `Encaminhamento para TI: ${gerNitEncaminhamento}\n` +
                             `Parecer do Gerente NIT: ${auditComment || "Análise realizada sem observações complementares."}`;
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
            <>
              {/* LAYOUT DESKTOP */}
              <div className="fixed inset-0 z-50 hidden lg:flex items-center justify-center bg-[#003F1D]/55 backdrop-blur-sm p-6">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setAnalysisModal({ isOpen: false, record: null })}
                  className="absolute inset-0"
                />
                <motion.div
                  initial={{ scale: 0.95, opacity: 0, y: 15 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: 15 }}
                  className="relative w-[92vw] max-w-[1280px] h-[92vh] max-h-[92vh] overflow-hidden rounded-[28px] border border-[#E8E7E7] bg-white shadow-[0_30px_90px_rgba(17,17,17,0.22)] flex flex-col z-10"
                >
                {/* Barra superior de marca Cedro */}
                <div className="absolute left-0 top-0 h-1.5 w-full bg-gradient-to-r from-[#075618] via-[#075618] to-[#F29222] z-20" />

                {/* CABEÇALHO DO POPUP (Full-width) */}
                <div className="border-b border-[#E8E7E7] bg-white px-8 py-6 relative pt-8 flex-shrink-0">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 pr-12">
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <span className="rounded-full bg-[#075618]/10 px-3 py-1 text-[10px] font-black text-[#075618] uppercase tracking-wide font-noto">
                          {wf ? `Etapa ${wf.currentStep} de ${currentSteps.length}` : "Etapa inicial"}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide font-noto ${
                          record.status === "Aprovado" 
                            ? "bg-[#075618]/10 text-[#075618]" 
                            : record.status === "Rejeitado" || record.status === "Negado"
                            ? "bg-rose-500/10 text-rose-700"
                            : "bg-[#F29222]/10 text-[#9A4F00]"
                        }`}>
                          {record.status || "Pendente"}
                        </span>
                      </div>

                      <h2 className="font-lato text-3xl font-extrabold text-[#111111] tracking-tight">
                        {renderValue(record.nomeFerramenta)}
                      </h2>

                      <p className="mt-1 font-noto text-xs font-semibold text-slate-500">
                        ID/Protocolo: <span className="font-mono text-[#111111]">{record.id}</span> • Avaliador: <span className="text-[#075618] uppercase font-bold">
                          {(() => {
                            const activeWfStep = wf?.steps?.find(s => s.stepNumber === currentStepNum);
                            return activeWfStep?.assignedUserName || activeStepDef?.assignedUserName || "Qualquer usuário";
                          })()}
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="rounded-2xl border border-[#E8E7E7] bg-[#FAFAFA] px-5 py-3 min-w-[180px] shadow-3xs">
                        <p className="font-noto text-[10px] font-black uppercase tracking-wide text-slate-400">Tipo de IA / Tecnologia</p>
                        <p className="mt-1 font-lato text-sm font-extrabold text-[#075618] truncate" title={record.tipoIA?.join(', ')}>
                          {record.tipoIA && record.tipoIA.length > 0 ? record.tipoIA[0] : "Não mapeado"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-[#E8E7E7] bg-[#FAFAFA] px-5 py-3 min-w-[180px] shadow-3xs">
                        <p className="font-noto text-[10px] font-black uppercase tracking-wide text-slate-400">Setor Solicitante</p>
                        <p className="mt-1 font-lato text-sm font-extrabold text-[#075618] uppercase truncate" title={record.unidadeSetor}>
                          {renderValue(record.unidadeSetor)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Botão de Fechar */}
                  <button
                    onClick={() => setAnalysisModal({ isOpen: false, record: null })}
                    className="absolute top-6 right-6 text-slate-400 hover:text-white transition-all p-2.5 rounded-full bg-[#FAFAFA] hover:bg-rose-600 border border-[#E8E7E7] cursor-pointer flex items-center justify-center shadow-sm"
                  >
                    <XCircle size={20} />
                  </button>
                </div>

                {/* PRINCIPAL CORPO SCROLLABLE (Grid em duas colunas) */}
                <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6 bg-[#F6F8F5] px-8 py-6 overflow-y-auto max-h-[calc(92vh-190px)] flex-1 custom-scrollbar">
                  
                  {/* COLUNA ESQUERDA: HISTÓRICO E RESUMO DA SOLICITAÇÃO */}
                  <div className="space-y-5">
                    
                    {/* Card 1: Avaliador atual */}
                    <div className="rounded-3xl border border-[#E8E7E7] bg-gradient-to-br from-[#075618] to-[#003F1D] p-5 text-white shadow-sm space-y-2 relative overflow-hidden">
                      <div className="absolute right-[-15px] bottom-[-15px] text-white/5 font-display text-[90px] font-black pointer-events-none select-none leading-none">
                        NIT
                      </div>
                      <p className="font-noto text-[10px] font-black uppercase tracking-wider text-[#FAFAFA]/70">
                        Avaliador atual
                      </p>
                      <h4 className="font-lato text-lg font-extrabold tracking-tight">
                        {activeStepDef?.roleName || "Decisor"}
                      </h4>
                      <p className="font-noto text-xs text-[#FAFAFA]/80 leading-relaxed">
                        {activeStepDef?.description}
                      </p>
                    </div>

                    {/* Card 3: Resumo da solicitação */}
                    <div className="rounded-3xl border border-[#E8E7E7] bg-white p-5 shadow-sm space-y-4">
                      <h5 className="font-lato text-sm font-extrabold text-[#111111]">Resumo da Solicitação</h5>
                      
                      <div className="space-y-3.5 font-noto text-xs text-slate-700">
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase font-black tracking-wider mb-0.5">Setor Solicitante</p>
                          <p className="uppercase font-extrabold text-[#111111]">{renderValue(record.unidadeSetor, "preenchido")}</p>
                        </div>
                        <div className="pt-2.5 border-t border-[#E8E7E7]">
                          <p className="text-[9px] text-slate-400 uppercase font-black tracking-wider mb-0.5">Cargo</p>
                          <p className="capitalize font-extrabold text-[#111111]">{renderValue(record.cargo, "preenchido")}</p>
                        </div>
                        <div className="pt-2.5 border-t border-[#E8E7E7]">
                          <p className="text-[9px] text-slate-400 uppercase font-black tracking-wider mb-0.5">Solicitante</p>
                          <p className="text-[#111111] font-extrabold">{renderValue(record.responsavelPreenchimento, "preenchido")}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowDetailedFolders(!showDetailedFolders)}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#075618]/30 bg-[#075618]/5 px-4 py-3 font-noto text-xs font-black uppercase tracking-wide text-[#075618] transition-all hover:bg-[#075618]/10"
                      >
                        {showDetailedFolders ? "Ocultar Detalhes" : "Ver Detalhes da Solicitação"}
                      </button>

                      {/* Pastas Sanfonadas sob demanda */}
                      {showDetailedFolders && (
                        <div className="space-y-3 pt-3 border-t border-[#E8E7E7] animate-fadeIn">
                          {/* Identidade IA Folder */}
                          <div className={`bg-white border rounded-2xl overflow-hidden transition-all duration-200 ${
                            expandedSections.identificacao 
                              ? "border-[#075618]/30 shadow-md ring-1 ring-[#075618]/5" 
                              : "border-[#E8E7E7] shadow-xs"
                          }`}>
                            <button
                              type="button"
                              onClick={() => toggleSection("identificacao")}
                              className={`w-full p-4 flex items-center justify-between font-display text-xs font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                                expandedSections.identificacao 
                                  ? "bg-[#075618]/5 text-[#075618] border-b border-[#075618]/10" 
                                  : "bg-[#FAFAFA] text-slate-700 hover:bg-slate-100 border-b border-transparent"
                              }`}
                            >
                              <span className="flex items-center gap-2 font-display">
                                <Sliders size={14} className={expandedSections.identificacao ? "text-[#075618]" : "text-slate-500"} /> 1. Identificação da IA
                              </span>
                              {expandedSections.identificacao ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                            {expandedSections.identificacao && (
                              <div className="p-4.5 space-y-3 text-xs font-semibold text-slate-700 border-t border-[#E8E7E7] bg-white font-sans">
                                <div>
                                  <p className="text-[9px] text-slate-900 uppercase font-black tracking-wider mb-0.5">Nome da Ferramenta</p>
                                  <p className="font-black uppercase text-[#075618] text-sm tracking-tight">{renderValue(record.nomeFerramenta, "preenchido")}</p>
                                </div>
                                <div className="pt-2 border-t border-[#E8E7E7]">
                                  <p className="text-[9px] text-slate-900 uppercase font-black tracking-wider mb-0.5">Fornecedor / Desenvolvedor</p>
                                  <p className="uppercase text-slate-800">{renderValue(record.fornecedor, "preenchido")}</p>
                                </div>
                                <div className="pt-2 border-t border-[#E8E7E7]">
                                  <p className="text-[9px] text-slate-900 uppercase font-black tracking-wider mb-0.5">Criticidade</p>
                                  <p className="uppercase text-slate-800 font-extrabold">{renderValue(record.criticidade, "preenchido")}</p>
                                </div>
                                <div className="pt-2 border-t border-[#E8E7E7]">
                                  <p className="text-[9px] text-slate-900 uppercase font-black tracking-wider mb-1">Tipo de IA / Tecnologia</p>
                                  <div className="flex flex-wrap gap-1.5 mt-1">
                                    {record.tipoIA && record.tipoIA.length > 0 ? (
                                      record.tipoIA.map((t: string) => (
                                        <span key={t} className="px-2 py-1 bg-[#075618]/8 text-[#075618] text-[10px] rounded-lg font-black uppercase tracking-tight font-sans">{t}</span>
                                      ))
                                    ) : (
                                      <span className="text-slate-400 italic">Mapeamento não preenchido</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Objetivo Folder */}
                          <div className={`bg-white border rounded-2xl overflow-hidden transition-all duration-200 ${
                            expandedSections.objetivo 
                              ? "border-[#075618]/30 shadow-md ring-1 ring-[#075618]/5" 
                              : "border-[#E8E7E7] shadow-xs"
                          }`}>
                            <button
                              type="button"
                              onClick={() => toggleSection("objetivo")}
                              className={`w-full p-4 flex items-center justify-between font-display text-xs font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                                expandedSections.objetivo 
                                  ? "bg-[#075618]/5 text-[#075618] border-b border-[#075618]/10" 
                                  : "bg-[#FAFAFA] text-slate-700 hover:bg-slate-100 border-b border-transparent"
                              }`}
                            >
                              <span className="flex items-center gap-2 font-display">
                                <Info size={14} className={expandedSections.objetivo ? "text-[#075618]" : "text-slate-500"} /> 2. Finalidade e Objetivos
                              </span>
                              {expandedSections.objetivo ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                            {expandedSections.objetivo && (
                              <div className="p-4.5 space-y-3 text-xs font-semibold text-slate-700 border-t border-[#E8E7E7] bg-white font-sans">
                                <div>
                                  <p className="text-[9px] text-slate-900 uppercase font-black tracking-wider mb-1">Descrição da Atividade</p>
                                  <p className="bg-[#FAFAFA] p-3 rounded-xl border border-[#E8E7E7] italic mt-1 font-medium leading-relaxed text-slate-650">
                                    {record.descricaoAtividade ? `"${record.descricaoAtividade}"` : <span className="text-slate-400 italic">Não preenchido</span>}
                                  </p>
                                </div>
                                <div className="pt-2 border-t border-[#E8E7E7]">
                                  <p className="text-[9px] text-slate-900 uppercase font-black tracking-wider mb-1">Objetivos / Finalidade</p>
                                  <div className="flex flex-wrap gap-1.5 mt-1.5 font-sans">
                                    {record.objetivos && record.objetivos.length > 0 ? (
                                      record.objetivos.map((t: string) => (
                                        <span key={t} className="px-2 py-1 bg-[#F29222]/10 border border-[#F29222]/20 text-[#9A4F00] text-[10px] rounded-lg font-black uppercase tracking-tight">{t}</span>
                                      ))
                                    ) : (
                                      <span className="text-slate-400 italic">Não preenchido na solicitação</span>
                                    )}
                                  </div>
                                </div>
                                <div className="pt-2 border-t border-[#E8E7E7]">
                                  <p className="text-[9px] text-slate-900 uppercase font-black tracking-wider mb-1">Benefícios Esperados</p>
                                  <p className="bg-[#FAFAFA] p-3 rounded-xl border border-[#E8E7E7] italic mt-1 font-medium leading-relaxed text-slate-650">
                                    {record.beneficiosEsperados ? `"${record.beneficiosEsperados}"` : <span className="text-slate-400 italic">Não preenchido</span>}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Observações & Envio Folder */}
                          <div className={`bg-white border rounded-2xl overflow-hidden transition-all duration-200 ${
                            expandedSections.observacoes 
                              ? "border-[#075618]/30 shadow-md ring-1 ring-[#075618]/5" 
                              : "border-[#E8E7E7] shadow-xs"
                          }`}>
                            <button
                              type="button"
                              onClick={() => toggleSection("observacoes")}
                              className={`w-full p-4 flex items-center justify-between font-display text-xs font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                                expandedSections.observacoes 
                                  ? "bg-[#075618]/5 text-[#075618] border-b border-[#075618]/10" 
                                  : "bg-[#FAFAFA] text-slate-700 hover:bg-slate-100 border-b border-transparent"
                              }`}
                            >
                              <span className="flex items-center gap-2 font-display">
                                <ClipboardCheck size={14} className={expandedSections.observacoes ? "text-[#075618]" : "text-slate-500"} /> 3. Observações e Envio
                              </span>
                              {expandedSections.observacoes ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                            {expandedSections.observacoes && (
                              <div className="p-4.5 space-y-3 text-xs font-semibold text-slate-700 border-t border-[#E8E7E7] bg-white font-sans">
                                <div>
                                  <p className="text-[9px] text-slate-900 uppercase font-black tracking-wider mb-1">Observações Gerais do Solicitante</p>
                                  <p className="bg-[#FAFAFA] p-3.5 rounded-xl border border-[#E8E7E7] italic mt-1 font-medium leading-relaxed text-slate-650">
                                    {getOriginalObservacoes(record) === "Não preenchido" ? (
                                      <span className="text-slate-400 italic">Não preenchido</span>
                                    ) : (
                                      `"${getOriginalObservacoes(record)}"`
                                    )}
                                  </p>
                                </div>
                                {((record.anexos && record.anexos.trim() !== "") || record.documentoNome) && (
                                  <div className="pt-2 border-t border-[#E8E7E7] space-y-2">
                                    <p className="text-[9px] text-slate-900 uppercase font-black tracking-wider mb-1">Anexos / Links de Referência</p>
                                    {record.anexos && record.anexos.trim() !== "" && (
                                      <div className="mt-1 bg-[#FAFAFA] border border-[#E8E7E7] p-3 rounded-xl flex items-center gap-2 shadow-xs">
                                        <span className="text-slate-700 text-xs font-semibold truncate max-w-full">
                                          📎 {record.anexos}
                                        </span>
                                      </div>
                                    )}
                                    {record.documentoNome && (
                                      <div className="mt-2 bg-[#075618]/5 border border-[#075618]/15 p-3 rounded-xl flex flex-col xs:flex-row xs:items-center justify-between gap-3 shadow-xs">
                                        <div className="min-w-0 flex items-center gap-2">
                                          <span className="text-base">📁</span>
                                          <div className="min-w-0">
                                            <p className="text-[11px] font-black text-[#075618] uppercase truncate" title={record.documentoNome}>
                                              {record.documentoNome}
                                            </p>
                                            <p className="text-[9px] text-slate-500 mt-0.5 font-mono">
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
                                            className="bg-[#075618] hover:bg-[#064817] text-white text-[9.5px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-lg text-center select-none cursor-pointer transition-all self-end xs:self-auto shrink-0"
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
                      )}
                    </div>

                    {/* Card 2: Histórico de pareceres */}
                    {(() => {
                      const prevSteps = (wf?.steps || [])
                        .filter((s) => s.stepNumber < currentStepNum && s.status !== "aguardando")
                        .sort((a, b) => a.stepNumber - b.stepNumber);
                      
                      if (prevSteps.length === 0) return null;
                      
                      return (
                        <div className="rounded-3xl border border-[#E8E7E7] bg-white p-5 shadow-sm space-y-4">
                          <h5 className="font-lato text-sm font-extrabold text-[#111111]">Histórico de Pareceres</h5>
                          <div className="space-y-4 pr-1">
                            {prevSteps.map((s) => {
                              const parsed = parseApprovalComment(s.comment);

                              return (
                                <div
                                  key={s.stepNumber}
                                  className="relative rounded-2xl border border-[#E8E7E7] bg-[#FAFAFA] p-4 text-xs font-noto"
                                >
                                  <div className="absolute left-0 top-4 h-8 w-1 rounded-r-full bg-[#075618]" />
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#075618]">
                                        Etapa {s.stepNumber} • {s.roleName}
                                      </p>
                                      <p className="mt-1 text-slate-800 leading-relaxed max-w-full font-medium break-words whitespace-pre-line">
                                        {parsed.parecer || s.comment || "(Sem parecer informado)"}
                                      </p>
                                      <p className="mt-1 text-[9px] font-semibold text-slate-400">
                                        Por: {s.assignedUserName || "Aprovação Livre"}
                                      </p>
                                    </div>

                                    <span
                                      className={`shrink-0 rounded-full px-2 py-0.5 text-[8.5px] font-black uppercase tracking-wider border ${
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
                        </div>
                      );
                    })()}
                  </div>

                  {/* COLUNA DIREITA: FORMULÁRIOS DAS ETAPAS DE DECISÃO */}
                  <div className="space-y-6">
                    {currentStepNum === 1 && (
                      <div className="space-y-5 pt-1">
                        {/* FORMULÁRIO DA ETAPA 1 — COORDENADOR NIT - PREMIUM CEDRO */}
                        <div className="relative overflow-hidden rounded-3xl border border-[#E8E7E7] bg-white p-6 shadow-[0_18px_45px_rgba(17,17,17,0.06)] space-y-6 animate-fadeIn">
                          {/* Detalhe estético superior de acordo com a marca Cedro */}
                          <div className="absolute left-0 top-0 h-1.5 w-full bg-gradient-to-r from-[#075618] via-[#075618] to-[#F29222]" />

                          {/* Cabeçalho premium da etapa */}
                          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5 border-b border-[#E8E7E7] pb-5 pt-2">
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <span className="inline-flex items-center rounded-full bg-[#075618]/10 px-3 py-1 text-[10px] font-bold text-[#075618] uppercase tracking-wide font-noto">
                                  Etapa 1
                                </span>
                                <span className="inline-flex items-center rounded-full bg-[#F29222]/10 px-3 py-1 text-[10px] font-bold text-[#9A4F00] uppercase tracking-wide font-noto">
                                  Coordenador NIT
                                </span>
                              </div>

                              <h3 className="font-lato text-xl font-extrabold text-[#111111] tracking-tight">
                                Formulário — Coordenador NIT
                              </h3>
                            </div>

                             <div className="rounded-2xl border border-[#E8E7E7] bg-[#F8F8F8] px-4 py-3 min-w-[190px]">
                              <p className="font-noto text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                Tipo de análise
                              </p>
                              <p className="mt-1 font-lato text-sm font-extrabold text-[#075618]">
                                Triagem e Filtragem
                              </p>
                            </div>
                          </div>

                          {/* Questão 1: Clareza */}
                          <div className="group rounded-2xl border border-[#E8E7E7] bg-gradient-to-br from-white to-[#F8F8F8] p-5 shadow-sm transition-all hover:border-[#075618]/35 hover:shadow-md">
                            <div className="flex items-start gap-4">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#075618]/10 text-xs font-extrabold text-[#075618] font-lato">
                                01
                              </div>
                              <div className="flex-1 space-y-3">
                                <p className="font-lato text-[15px] font-extrabold text-[#111111] tracking-tight">
                                  A solicitação está clara o suficiente para continuidade da análise?
                                </p>
                                <p className="font-noto text-xs leading-relaxed text-slate-500">
                                  Avaliar se objetivo, descrição, processo impactado e benefícios esperados permitem compreender perfeitamente a demanda.
                                </p>
                                <div className="flex gap-2 pt-1">
                                  {["Sim", "Não"].map((opt) => (
                                    <button
                                      key={opt}
                                      type="button"
                                      onClick={() => setCoordClarezaSolicitacao(opt)}
                                      className={`rounded-xl border px-5 py-2.5 text-xs font-bold transition-all cursor-pointer font-noto duration-200 ${
                                        coordClarezaSolicitacao === opt
                                          ? "border-[#075618] bg-[#075618]/10 text-[#075618] shadow-sm ring-2 ring-[#075618]/10"
                                          : "border-[#E8E7E7] bg-white text-slate-600 hover:border-[#075618]/40 hover:bg-[#075618]/5 hover:text-[#075618]"
                                      }`}
                                    >
                                      {opt}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Questão 2: Uso de IA */}
                          <div className="group rounded-2xl border border-[#E8E7E7] bg-gradient-to-br from-white to-[#F8F8F8] p-5 shadow-sm transition-all hover:border-[#075618]/35 hover:shadow-md">
                            <div className="flex items-start gap-4">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#075618]/10 text-xs font-extrabold text-[#075618] font-lato">
                                02
                              </div>
                              <div className="flex-1 space-y-3">
                                <p className="font-lato text-[15px] font-extrabold text-[#111111] tracking-tight">
                                  A solicitação envolve o uso de Inteligência Artificial?
                                </p>
                                <p className="font-noto text-xs leading-relaxed text-slate-500">
                                  Verificar se a demanda utiliza IA para apoiar, automatizar, analisar, gerar dados ou otimizar processos.
                                </p>
                                <div className="flex flex-wrap gap-2 pt-1">
                                  {["Sim", "Não", "Precisa de esclarecimento"].map((opt) => (
                                    <button
                                      key={opt}
                                      type="button"
                                      onClick={() => setCoordUsoIA(opt)}
                                      className={`rounded-xl border px-4 py-2.5 text-xs font-bold transition-all cursor-pointer font-noto duration-200 ${
                                        coordUsoIA === opt
                                          ? "border-[#075618] bg-[#075618]/10 text-[#075618] shadow-sm ring-2 ring-[#075618]/10"
                                          : "border-[#E8E7E7] bg-white text-slate-600 hover:border-[#075618]/40 hover:bg-[#075618]/5 hover:text-[#075618]"
                                      }`}
                                    >
                                      {opt}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Questão 3: Encaminhamento */}
                          <div className="group rounded-2xl border border-[#E8E7E7] bg-gradient-to-br from-white to-[#F8F8F8] p-5 shadow-sm transition-all hover:border-[#075618]/35 hover:shadow-md">
                            <div className="flex items-start gap-4">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#075618]/10 text-xs font-extrabold text-[#075618] font-lato">
                                03
                              </div>
                              <div className="flex-1 space-y-3">
                                <p className="font-lato text-[15px] font-extrabold text-[#111111] tracking-tight">
                                  A solicitação pode seguir para análise do Gerente NIT?
                                </p>
                                <p className="font-noto text-xs leading-relaxed text-slate-500">
                                  Indicar se a solicitação possui as informações adequadas para seguir adiante no fluxo de governança.
                                </p>
                                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                                  {["Sim", "Sim, com observações", "Não, precisa de ajustes"].map((opt) => {
                                    const isYellow = opt === "Não, precisa de ajustes";
                                    return (
                                      <button
                                        key={opt}
                                        type="button"
                                        onClick={() => setCoordEncaminhamento(opt)}
                                        className={`flex-1 rounded-xl border px-3 py-2.5 text-xs font-bold transition-all cursor-pointer font-noto duration-200 ${
                                          coordEncaminhamento === opt
                                            ? isYellow
                                              ? "border-[#F29222] bg-[#F29222]/10 text-[#9A4F00] shadow-sm ring-2 ring-[#F29222]/10"
                                              : "border-[#075618] bg-[#075618]/10 text-[#075618] shadow-sm ring-2 ring-[#075618]/10"
                                            : "border-[#E8E7E7] bg-white text-slate-600 hover:border-[#075618]/40 hover:bg-[#075618]/5 hover:text-[#075618]"
                                        }`}
                                      >
                                        {opt}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {currentStepNum === 2 && (
                      <div className="space-y-5 pt-1">
                        {/* FORMULÁRIO DA ETAPA 2 — GERENTE NIT - PREMIUM CEDRO */}
                        <div className="relative overflow-hidden rounded-3xl border border-[#E8E7E7] bg-white p-6 shadow-[0_18px_45px_rgba(17,17,17,0.06)] space-y-6 animate-fadeIn">
                          {/* Detalhe estético superior de acordo com a marca Cedro */}
                          <div className="absolute left-0 top-0 h-1.5 w-full bg-gradient-to-r from-[#075618] via-[#075618] to-[#F29222]" />

                          {/* Cabeçalho premium da etapa */}
                          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5 border-b border-[#E8E7E7] pb-5 pt-2">
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <span className="inline-flex items-center rounded-full bg-[#075618]/10 px-3 py-1 text-[10px] font-bold text-[#075618] uppercase tracking-wide font-noto">
                                  Etapa 2
                                </span>
                                <span className="inline-flex items-center rounded-full bg-[#F29222]/10 px-3 py-1 text-[10px] font-bold text-[#9A4F00] uppercase tracking-wide font-noto">
                                  Gerente NIT
                                </span>
                              </div>

                              <h3 className="font-lato text-xl font-extrabold text-[#111111] tracking-tight">
                                Formulário — Gerente NIT
                              </h3>
                            </div>

                            <div className="rounded-2xl border border-[#E8E7E7] bg-[#F8F8F8] px-4 py-3 min-w-[190px]">
                              <p className="font-noto text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                Tipo de análise
                              </p>
                              <p className="mt-1 font-lato text-sm font-extrabold text-[#075618]">
                                Governança e Risco
                              </p>
                            </div>
                          </div>

                          {/* Questão 1: Riscos */}
                          <div className="group rounded-2xl border border-[#E8E7E7] bg-gradient-to-br from-white to-[#F8F8F8] p-5 shadow-sm transition-all hover:border-[#075618]/35 hover:shadow-md">
                            <div className="flex items-start gap-4">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#075618]/10 text-xs font-extrabold text-[#075618] font-lato">
                                01
                              </div>
                              <div className="flex-1 space-y-3">
                                <p className="font-lato text-[15px] font-extrabold text-[#111111] tracking-tight">
                                  Essa inteligência artificial pode gerar algum risco para o processo ou para o laboratório?
                                </p>
                                <p className="font-noto text-xs leading-relaxed text-slate-500">
                                  Considerar riscos no uso da inteligência artificial, impacto no processo, erros, dependência da ferramenta ou uso inadequado.
                                </p>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
                                  {["Não", "Sim, risco baixo", "Sim, risco moderado", "Sim, risco alto"].map((opt) => {
                                    const isYellow = opt === "Sim, risco moderado" || opt === "Sim, risco alto";
                                    return (
                                      <button
                                        key={opt}
                                        type="button"
                                        onClick={() => setGerNitRiscos(opt)}
                                        className={`rounded-xl border px-2 py-2.5 text-[10px] sm:text-xs font-bold transition-all cursor-pointer font-noto duration-200 ${
                                          gerNitRiscos === opt
                                            ? isYellow
                                              ? "border-[#F29222] bg-[#F29222]/10 text-[#9A4F00] shadow-sm ring-2 ring-[#F29222]/10"
                                              : "border-[#075618] bg-[#075618]/10 text-[#075618] shadow-sm ring-2 ring-[#075618]/10"
                                            : "border-[#E8E7E7] bg-white text-slate-600 hover:border-[#075618]/40 hover:bg-[#075618]/5 hover:text-[#075618]"
                                        }`}
                                      >
                                        {opt}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Questão 2: Cuidados necessários */}
                          <div className="group rounded-2xl border border-[#E8E7E7] bg-gradient-to-br from-white to-[#F8F8F8] p-5 shadow-sm transition-all hover:border-[#075618]/35 hover:shadow-md">
                            <div className="flex items-start gap-4">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#075618]/10 text-xs font-extrabold text-[#075618] font-lato">
                                02
                              </div>
                              <div className="flex-1 space-y-3">
                                <p className="font-lato text-[15px] font-extrabold text-[#111111] tracking-tight">
                                  Essa inteligência artificial precisa de algum cuidado ou regra para ser utilizada?
                                </p>
                                <p className="font-noto text-xs leading-relaxed text-slate-500">
                                  Exemplo: validação humana, treinamento, limite de uso, monitoramento ou orientação aos usuários.
                                </p>
                                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                                  {["Não", "Sim, cuidado simples", "Sim, cuidado obrigatório"].map((opt) => {
                                    const isYellow = opt === "Sim, cuidado obrigatório";
                                    return (
                                      <button
                                        key={opt}
                                        type="button"
                                        onClick={() => setGerNitCuidados(opt)}
                                        className={`flex-1 rounded-xl border px-3 py-2.5 text-xs font-bold transition-all cursor-pointer font-noto duration-200 id-care-button-${opt.replace(/\s+/g, '-').toLowerCase()} ${
                                          gerNitCuidados === opt
                                            ? isYellow
                                              ? "border-[#F29222] bg-[#F29222]/10 text-[#9A4F00] shadow-sm ring-2 ring-[#F29222]/10"
                                              : "border-[#075618] bg-[#075618]/10 text-[#075618] shadow-sm ring-2 ring-[#075618]/10"
                                            : "border-[#E8E7E7] bg-white text-slate-600 hover:border-[#075618]/40 hover:bg-[#075618]/5 hover:text-[#075618]"
                                        }`}
                                      >
                                        {opt}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Questão 3: Encaminhamento */}
                          <div className="group rounded-2xl border border-[#E8E7E7] bg-gradient-to-br from-white to-[#F8F8F8] p-5 shadow-sm transition-all hover:border-[#075618]/35 hover:shadow-md">
                            <div className="flex items-start gap-4">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#075618]/10 text-xs font-extrabold text-[#075618] font-lato">
                                03
                              </div>
                              <div className="flex-1 space-y-3">
                                <p className="font-lato text-[15px] font-extrabold text-[#111111] tracking-tight">
                                  A solicitação pode seguir para análise da TI?
                                </p>
                                <p className="font-noto text-xs leading-relaxed text-slate-500">
                                  Indicar se a solicitação pode avançar ou se precisa de ajustes antes da próxima etapa.
                                </p>
                                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                                  {["Sim", "Sim, com observações", "Não"].map((opt) => (
                                    <button
                                      key={opt}
                                      type="button"
                                      onClick={() => setGerNitEncaminhamento(opt)}
                                      className={`flex-1 rounded-xl border px-3 py-2.5 text-xs font-bold transition-all cursor-pointer font-noto duration-200 ${
                                        gerNitEncaminhamento === opt
                                          ? "border-[#075618] bg-[#075618]/10 text-[#075618] shadow-sm ring-2 ring-[#075618]/10"
                                          : "border-[#E8E7E7] bg-white text-slate-600 hover:border-[#075618]/40 hover:bg-[#075618]/5 hover:text-[#075618]"
                                      }`}
                                    >
                                      {opt}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>


                        </div>
                      </div>
                    )}


                    {currentStepNum === 3 && (
                      <div className="space-y-5 pt-1">
                        {/* FORMULÁRIO DA ETAPA 3 — GERENTE TI - PREMIUM CEDRO */}
                        <div className="relative overflow-hidden rounded-3xl border border-[#E8E7E7] bg-white p-6 shadow-[0_18px_45px_rgba(17,17,17,0.06)] space-y-6 animate-fadeIn">
                          {/* Detalhe estético superior de acordo com a marca Cedro */}
                          <div className="absolute left-0 top-0 h-1.5 w-full bg-gradient-to-r from-[#075618] via-[#075618] to-[#F29222]" />

                          {/* Cabeçalho premium da etapa */}
                          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5 border-b border-[#E8E7E7] pb-5 pt-2">
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <span className="inline-flex items-center rounded-full bg-[#075618]/10 px-3 py-1 text-[10px] font-bold text-[#075618] uppercase tracking-wide font-noto">
                                  Etapa 3
                                </span>
                                <span className="inline-flex items-center rounded-full bg-[#F29222]/10 px-3 py-1 text-[10px] font-bold text-[#9A4F00] uppercase tracking-wide font-noto">
                                  Gerente TI
                                </span>
                              </div>

                              <h3 className="font-lato text-xl font-extrabold text-[#111111] tracking-tight">
                                Formulário — Gerente TI (Tecnologia e Segurança)
                              </h3>
                            </div>

                            <div className="rounded-2xl border border-[#E8E7E7] bg-[#F8F8F8] px-4 py-3 min-w-[190px]">
                              <p className="font-noto text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                Tipo de análise
                              </p>
                              <p className="mt-1 font-lato text-sm font-extrabold text-[#075618]">
                                Homologação Técnica
                              </p>
                            </div>
                          </div>

                          {/* Critério 1: Compatibilidade */}
                          <div className="group rounded-2xl border border-[#E8E7E7] bg-gradient-to-br from-white to-[#F8F8F8] p-5 shadow-sm transition-all hover:border-[#075618]/35 hover:shadow-md">
                            <div className="flex items-start gap-4">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#075618]/10 text-xs font-extrabold text-[#075618] font-lato">
                                01
                              </div>
                              <div className="flex-1 space-y-3">
                                <p className="font-lato text-[15px] font-extrabold text-[#111111] tracking-tight">
                                  Compatibilidade de Rede, Recursos e APIs
                                </p>
                                <p className="font-noto text-xs leading-relaxed text-slate-500">
                                  Capacidade técnica de hospedar a nova inteligência artificial ou conectá-la com integridade à infraestrutura de rede corporativa Cedro.
                                </p>
                                <div className="flex flex-wrap gap-2 pt-1">
                                  {["Compatível / Cloud nativa", "Requer novas VMs", "Incompatível"].map((opt) => (
                                    <button
                                      key={opt}
                                      type="button"
                                      onClick={() => setTiInfra(opt)}
                                      className={`rounded-xl border px-3.5 py-2.5 text-xs font-bold transition-all cursor-pointer font-noto duration-200 ${
                                        tiInfra === opt
                                          ? "border-[#075618] bg-[#075618]/10 text-[#075618] shadow-sm ring-2 ring-[#075618]/10"
                                          : "border-[#E8E7E7] bg-white text-slate-600 hover:border-[#075618]/40 hover:bg-[#075618]/5 hover:text-[#075618]"
                                      }`}
                                    >
                                      {opt}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Critério 2: Segurança */}
                          <div className="group rounded-2xl border border-[#E8E7E7] bg-gradient-to-br from-white to-[#F8F8F8] p-5 shadow-sm transition-all hover:border-[#075618]/35 hover:shadow-md">
                            <div className="flex items-start gap-4">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#075618]/10 text-xs font-extrabold text-[#075618] font-lato">
                                02
                              </div>
                              <div className="flex-1 space-y-3">
                                <p className="font-lato text-[15px] font-extrabold text-[#111111] tracking-tight">
                                  Garantias de Segurança de Dados e LGPD
                                </p>
                                <p className="font-noto text-xs leading-relaxed text-slate-500">
                                  Nível de conformidade regulatória quanto às leis gerais de proteção de dados nacionais e privacidade de dados.
                                </p>
                                <div className="flex flex-wrap gap-2 pt-1">
                                  {["Conforme", "Alerta", "Crítico"].map((opt) => {
                                    const isRed = opt === "Crítico";
                                    const isYellow = opt === "Alerta";
                                    return (
                                      <button
                                        key={opt}
                                        type="button"
                                        onClick={() => setTiSeguranca(opt)}
                                        className={`rounded-xl border px-4 py-2.5 text-xs font-bold transition-all cursor-pointer font-noto duration-200 ${
                                          tiSeguranca === opt
                                            ? isRed
                                              ? "border-rose-600 bg-rose-50 text-rose-800 shadow-sm ring-2 ring-rose-300/20"
                                              : isYellow
                                              ? "border-[#F29222] bg-[#F29222]/10 text-[#9A4F00] shadow-sm ring-2 ring-[#F29222]/10"
                                              : "border-[#075618] bg-[#075618]/10 text-[#075618] shadow-sm ring-2 ring-[#075618]/10"
                                            : "border-[#E8E7E7] bg-white text-slate-600 hover:border-[#075618]/40 hover:bg-[#075618]/5 hover:text-[#075618]"
                                        }`}
                                      >
                                        {opt}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Critério 3: Integração */}
                          <div className="group rounded-2xl border border-[#E8E7E7] bg-gradient-to-br from-white to-[#F8F8F8] p-5 shadow-sm transition-all hover:border-[#075618]/35 hover:shadow-md">
                            <div className="flex items-start gap-4">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#075618]/10 text-xs font-extrabold text-[#075618] font-lato">
                                03
                              </div>
                              <div className="flex-1 space-y-3">
                                <p className="font-lato text-[15px] font-extrabold text-[#111111] tracking-tight">
                                  Integração com Sistemas Externos / Internos
                                </p>
                                <p className="font-noto text-xs leading-relaxed text-slate-500">
                                  Exigência de intercomunicação, endpoints de API dedicados ou processos de adaptação técnica de outros softwares locais.
                                </p>
                                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                                  {["Não / Plataforma autônoma", "Sim / Requer API", "Sim / Requer customização"].map((opt) => (
                                    <button
                                      key={opt}
                                      type="button"
                                      onClick={() => setTiIntegracao(opt)}
                                      className={`flex-1 rounded-xl border px-3 py-2.5 text-center text-xs font-bold transition-all cursor-pointer font-noto duration-200 ${
                                        tiIntegracao === opt
                                          ? "border-[#075618] bg-[#075618]/10 text-[#075618] shadow-sm ring-2 ring-[#075618]/10"
                                          : "border-[#E8E7E7] bg-white text-slate-600 hover:border-[#075618]/40 hover:bg-[#075618]/5 hover:text-[#075618]"
                                      }`}
                                    >
                                      {opt}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Critério 4: Ambiente de uso */}
                          <div className="group rounded-2xl border border-[#E8E7E7] bg-gradient-to-br from-white to-[#F8F8F8] p-5 shadow-sm transition-all hover:border-[#075618]/35 hover:shadow-md">
                            <div className="flex items-start gap-4">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#075618]/10 text-xs font-extrabold text-[#075618] font-lato">
                                04
                              </div>
                              <div className="flex-1 space-y-3">
                                <p className="font-lato text-[15px] font-extrabold text-[#111111] tracking-tight">
                                  Ambiente de Hospedagem e Execução
                                </p>
                                <p className="font-noto text-xs leading-relaxed text-slate-500">
                                  Natureza física ou de rede onde a plataforma residirá (cloud pública, nuvem privada do Cedro ou servidores locais).
                                </p>
                                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                                  {["Cloud externa", "Ambiente interno", "Não identificado"].map((opt) => (
                                    <button
                                      key={opt}
                                      type="button"
                                      onClick={() => setTiAmbiente(opt)}
                                      className={`flex-1 rounded-xl border px-3 py-2.5 text-center text-xs font-bold transition-all cursor-pointer font-noto duration-200 ${
                                        tiAmbiente === opt
                                          ? "border-[#075618] bg-[#075618]/10 text-[#075618] shadow-sm ring-2 ring-[#075618]/10"
                                          : "border-[#E8E7E7] bg-white text-slate-600 hover:border-[#075618]/40 hover:bg-[#075618]/5 hover:text-[#075618]"
                                      }`}
                                    >
                                      {opt}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Critério 5: Controle de acesso */}
                          <div className="group rounded-2xl border border-[#E8E7E7] bg-gradient-to-br from-white to-[#F8F8F8] p-5 shadow-sm transition-all hover:border-[#075618]/35 hover:shadow-md">
                            <div className="flex items-start gap-4">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#075618]/10 text-xs font-extrabold text-[#075618] font-lato">
                                05
                              </div>
                              <div className="flex-1 space-y-3">
                                <p className="font-lato text-[15px] font-extrabold text-[#111111] tracking-tight">
                                  Controle de Acesso e Governança de Usuários
                                </p>
                                <p className="font-noto text-xs leading-relaxed text-slate-500">
                                  Qualidade das regras de login único, criptografia de credenciais e mapeamento de permissões administrativas.
                                </p>
                                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                                  {["Adequado", "Requer ajuste", "Não informado"].map((opt) => {
                                    const isYellow = opt === "Requer ajuste";
                                    return (
                                      <button
                                        key={opt}
                                        type="button"
                                        onClick={() => setTiControleAcesso(opt)}
                                        className={`flex-1 rounded-xl border px-3 py-2.5 text-center text-xs font-bold transition-all cursor-pointer font-noto duration-200 ${
                                          tiControleAcesso === opt
                                            ? isYellow
                                              ? "border-[#F29222] bg-[#F29222]/10 text-[#9A4F00] shadow-sm ring-2 ring-[#F29222]/10"
                                              : "border-[#075618] bg-[#075618]/10 text-[#075618] shadow-sm ring-2 ring-[#075618]/10"
                                            : "border-[#E8E7E7] bg-white text-slate-600 hover:border-[#075618]/40 hover:bg-[#075618]/5 hover:text-[#075618]"
                                        }`}
                                      >
                                        {opt}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Critério 6: Logs e Auditabilidade */}
                          <div className="group rounded-2xl border border-[#E8E7E7] bg-gradient-to-br from-white to-[#F8F8F8] p-5 shadow-sm transition-all hover:border-[#075618]/35 hover:shadow-md">
                            <div className="flex items-start gap-4">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#075618]/10 text-xs font-extrabold text-[#075618] font-lato">
                                06
                              </div>
                              <div className="flex-1 space-y-3">
                                <p className="font-lato text-[15px] font-extrabold text-[#111111] tracking-tight">
                                  Rastreabilidade e Logs de Auditoria
                                </p>
                                <p className="font-noto text-xs leading-relaxed text-slate-500">
                                  Geração constante de histórico de transações internas e logs de uso para auditoria judicial e análise pós-incidentes.
                                </p>
                                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                                  {["Possui logs", "Não possui logs", "Não informado"].map((opt) => (
                                    <button
                                      key={opt}
                                      type="button"
                                      onClick={() => setTiLogs(opt)}
                                      className={`flex-1 rounded-xl border px-3 py-2.5 text-center text-xs font-bold transition-all cursor-pointer font-noto duration-200 ${
                                        tiLogs === opt
                                          ? "border-[#075618] bg-[#075618]/10 text-[#075618] shadow-sm ring-2 ring-[#075618]/10"
                                          : "border-[#E8E7E7] bg-white text-slate-600 hover:border-[#075618]/40 hover:bg-[#075618]/5 hover:text-[#075618]"
                                      }`}
                                    >
                                      {opt}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Critério 7: Ação técnica */}
                          <div className="group rounded-2xl border border-[#E8E7E7] bg-gradient-to-br from-white to-[#F8F8F8] p-5 shadow-sm transition-all hover:border-[#075618]/35 hover:shadow-md">
                            <div className="flex items-start gap-4">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#075618]/10 text-xs font-extrabold text-[#075618] font-lato">
                                07
                              </div>
                              <div className="flex-1 space-y-3">
                                <p className="font-lato text-[15px] font-extrabold text-[#111111] tracking-tight">
                                  Esforço Operacional de Implantação da TI
                                </p>
                                <p className="font-noto text-xs leading-relaxed text-slate-500">
                                  Demanda de mão de obra do time técnico interno para implementar, homologar ou dar sustentabilidade futura a esta inteligência artificial.
                                </p>
                                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                                  {["Não", "Sim, baixa complexidade", "Sim, alta complexidade"].map((opt) => {
                                    const isYellow = opt === "Sim, alta complexidade";
                                    return (
                                      <button
                                        key={opt}
                                        type="button"
                                        onClick={() => setTiAcao(opt)}
                                        className={`flex-1 rounded-xl border px-3 py-2.5 text-center text-xs font-bold transition-all cursor-pointer font-noto duration-200 ${
                                          tiAcao === opt
                                            ? isYellow
                                              ? "border-[#F29222] bg-[#F29222]/10 text-[#9A4F00] shadow-sm ring-2 ring-[#F29222]/10"
                                              : "border-[#075618] bg-[#075618]/10 text-[#075618] shadow-sm ring-2 ring-[#075618]/10"
                                            : "border-[#E8E7E7] bg-white text-slate-600 hover:border-[#075618]/40 hover:bg-[#075618]/5 hover:text-[#075618]"
                                        }`}
                                      >
                                        {opt}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>


                        </div>
                      </div>
                    )}

                    {/* Etapas de decisão / Formulários dinâmicos baseados no tipo de etapa */}
                    {currentStepNum === 4 && (
                      <div className="space-y-5 pt-1">
                        {/* FORMULÁRIO DA ETAPA 4 — PERÍODO DE TESTE - PREMIUM CEDRO */}
                        <div className="relative overflow-hidden rounded-3xl border border-[#E8E7E7] bg-white p-6 shadow-[0_18px_45px_rgba(17,17,17,0.06)] space-y-6 animate-fadeIn">
                          {/* Detalhe estético superior de acordo com a marca Cedro */}
                          <div className="absolute left-0 top-0 h-1.5 w-full bg-gradient-to-r from-[#075618] via-[#075618] to-[#F29222]" />

                          {/* Cabeçalho premium da etapa */}
                          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5 border-b border-[#E8E7E7] pb-5 pt-2">
                            <div>
                              <div className="flex items-center gap-2 mb-3">
                                <span className="inline-flex items-center rounded-full bg-[#075618]/10 px-3 py-1 text-[10px] font-bold text-[#075618] uppercase tracking-wide font-noto">
                                  Etapa 4
                                </span>
                                <span className="inline-flex items-center rounded-full bg-[#F29222]/10 px-3 py-1 text-[10px] font-bold text-[#9A4F00] uppercase tracking-wide font-noto">
                                  Período de Teste
                                </span>
                              </div>

                              <h3 className="font-lato text-xl font-extrabold text-[#111111] tracking-tight">
                                Confirmação do Período de Teste
                              </h3>
                            </div>

                            <div className="rounded-2xl border border-[#E8E7E7] bg-[#F8F8F8] px-4 py-3 min-w-[190px]">
                              <p className="font-noto text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                Tipo de análise
                              </p>
                              <p className="mt-1 font-lato text-sm font-extrabold text-[#075618]">
                                Homologação Experimental
                              </p>
                            </div>
                          </div>

                          {/* Bloco de Confirmação */}
                          <div className="group rounded-2xl border border-[#E8E7E7] bg-gradient-to-br from-white to-[#F8F8F8] p-5 shadow-sm transition-all hover:border-[#075618]/35 hover:shadow-md">
                            <div className="flex items-start gap-4">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#075618]/10 text-xs font-extrabold text-[#075618] font-lato">
                                01
                              </div>
                              <div className="flex-1 space-y-3">
                                <p className="font-lato text-[15px] font-extrabold text-[#111111] tracking-tight">
                                  O período de teste foi realizado e a ferramenta demonstrou condições operacionais adequadas?
                                </p>
                                <p className="font-noto text-xs leading-relaxed text-slate-500">
                                  Sinalizar se os testes comprovaram a segurança técnica e utilidade prática no fluxo de atividades do setor solicitante.
                                </p>
                                <div className="flex gap-3 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => setPeriodoTesteConfirmado("Sim")}
                                    className={`flex-1 rounded-xl border px-4 py-3.5 text-xs font-bold transition-all cursor-pointer font-noto duration-200 flex items-center justify-center gap-2 ${
                                      periodoTesteConfirmado === "Sim"
                                        ? "border-[#075618] bg-[#075618] text-white shadow-md shadow-[#075618]/15"
                                        : "border-[#E8E7E7] bg-white text-slate-600 hover:border-[#075618]/40 hover:bg-[#075618]/5 hover:text-[#075618]"
                                    }`}
                                  >
                                    <CheckCircle2 size={14} /> SIM, HOMOLOGADA
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPeriodoTesteConfirmado("Não")}
                                    className={`flex-1 rounded-xl border px-4 py-3.5 text-xs font-bold transition-all cursor-pointer font-noto duration-200 flex items-center justify-center gap-2 ${
                                      periodoTesteConfirmado === "Não"
                                        ? "border-rose-600 bg-rose-600 text-white shadow-md shadow-rose-600/15"
                                        : "border-[#E8E7E7] bg-white text-slate-600 hover:border-[#075618]/40 hover:bg-[#075618]/5 hover:text-[#075618]"
                                    }`}
                                  >
                                    <XCircle size={14} /> NÃO HOMOLOGADA
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Campo Observações */}
                          <div className="space-y-2">
                            <label className="text-sm font-bold text-[#111111] font-lato block">
                              Relatório Geral do Período de Teste e Observações
                            </label>
                            <p className="font-noto text-xs leading-relaxed text-slate-500">
                              Insira detalhes adicionais sobre o período de teste e as condições técnicas observadas na ferramenta durante a simulação prática (opcional).
                            </p>
                            <textarea
                              value={auditComment}
                              onChange={(e) => setAuditComment(e.target.value)}
                              placeholder="Registre observações técnicas relativas aos testes realizados com a Inteligência Artificial..."
                              className="w-full h-32 rounded-2xl border border-[#E8E7E7] bg-white p-4 font-noto text-sm leading-relaxed text-[#111111] placeholder-slate-400 outline-none transition-all duration-200 focus:border-[#075618] focus:ring-4 focus:ring-[#075618]/5 resize-none shadow-[inset_0_2px_4px_rgba(17,17,17,0.02)]"
                            />
                          </div>


                        </div>
                      </div>
                    )}

                        {/* Etapas 5 e 6 (Presidência e Direção Financeira) têm modo de visualização exclusivo de governança e decisão, sem campo de justificativa */}
                        {(currentStepNum === 5 || currentStepNum === 6) ? (
                          <div className="space-y-5 pt-1">
                            {/* DECIÃO EXECUTIVA / GOVERNANÇA E FINANÇAS */}
                            <div className="relative overflow-hidden rounded-3xl border border-[#E8E7E7] bg-white p-6 shadow-[0_18px_45px_rgba(17,17,17,0.06)] space-y-6 animate-fadeIn">
                              <div className="absolute left-0 top-0 h-1.5 w-full bg-gradient-to-r from-[#075618] via-[#075618] to-[#F29222]" />

                              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5 border-b border-[#E8E7E7] pb-5 pt-2">
                                <div>
                                  <div className="flex items-center gap-2 mb-3">
                                    <span className="inline-flex items-center rounded-full bg-[#075618]/10 px-3 py-1 text-[10px] font-bold text-[#075618] uppercase tracking-wide font-noto">
                                      Etapa {currentStepNum}
                                    </span>
                                    <span className="inline-flex items-center rounded-full bg-[#F29222]/10 px-3 py-1 text-[10px] font-bold text-[#9A4F00] uppercase tracking-wide font-noto">
                                      {currentStepNum === 5 ? "Presidência" : "Direção Financeira"}
                                    </span>
                                  </div>

                                  <h3 className="font-lato text-xl font-extrabold text-[#111111] tracking-tight">
                                    {currentStepNum === 5 ? "Parecer Executivo da Presidência" : "Homologação de Investimento & Aquisição"}
                                  </h3>
                                </div>

                                <div className="rounded-2xl border border-[#E8E7E7] bg-[#F8F8F8] px-4 py-3 min-w-[190px]">
                                  <p className="font-noto text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                    Tipo de análise
                                  </p>
                                  <p className="mt-1 font-lato text-sm font-extrabold text-[#075618]">
                                    {currentStepNum === 5 ? "Governança Executiva" : "Validação Financeira"}
                                  </p>
                                </div>
                              </div>

                              <div className="rounded-2xl border border-[#075618]/10 bg-gradient-to-br from-[#075618]/5 to-transparent p-5 space-y-3">
                                <h4 className="font-lato text-sm font-bold text-[#075618] uppercase tracking-wider flex items-center gap-2">
                                  <ClipboardCheck size={16} /> Diretriz de Tomada de Decisão
                                </h4>
                                <p className="font-noto text-xs leading-relaxed text-[#111111] font-medium">
                                  {currentStepNum === 5
                                    ? "Como Presidente do NIT / Grupo Cedro, valide se os pareceres técnicos prévios do Coordenador NIT, Gerente NIT e Gerente TI estão em plena conformidade com a visão estratégica de inovação do laboratório. Esta etapa não exige preenchimento de justificativa complementar, sendo validada diretamente pelo ato de Aprovação ou Indeferimento no painel."
                                    : "Como Diretor Financeiro, realize a homologação orçamentária para liberação de uso da Inteligência Artificial. Verifique a viabilidade financeira e o ROI projetado antes de aprovar. Esta etapa conclui o fluxo e libera o status definitivo da ferramenta."}
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* Parecer de Texto Livre Comum a Todos (exceto Etapa 4 que é embutido e Etapas 5/6 que não necessitam de explicações) */
                          <div className="rounded-2xl border border-[#E8E7E7] bg-[#FAFAFA] p-5 space-y-3 mt-4">
                            {currentStepNum === 2 ? (
                              <>
                                <label className="text-sm font-bold text-[#111111] font-lato block uppercase tracking-tight">
                                  Parecer Técnico Justificado
                                </label>
                              </>
                            ) : (
                              <label className="text-xs font-bold text-[#111111] font-lato uppercase tracking-wider flex items-center gap-2">
                                <MessageSquare size={14} className="text-[#075618]" /> Parecer Técnico Justificado
                              </label>
                            )}
                            <textarea 
                              value={auditComment}
                              onChange={(e) => setAuditComment(e.target.value)}
                              placeholder={
                                currentStepNum === 1 
                                  ? "Registre uma breve justificativa sobre a clareza da solicitação, uso de Inteligência Artificial e encaminhamento para a próxima etapa."
                                  : currentStepNum === 2
                                  ? "Registre de forma breve a análise sobre importância da solicitação, riscos, cuidados necessários e encaminhamento para a próxima etapa."
                                  : "Descreva aqui sua justificativa técnica detalhada corporativa. Seus argumentos de parecer fundamentarão documentalmente o histórico desta IA no banco do Cedro..."
                              }
                              className="w-full h-32 rounded-2xl border border-[#E8E7E7] bg-white p-4 text-sm text-[#111111] placeholder:text-slate-400 focus:border-[#075618] focus:ring-4 focus:ring-[#075618]/10 outline-none transition-all resize-none shadow-sm font-noto"
                              required
                            />
                          </div>
                        )}
                    </div>
                  </div>

                  {/* Ações / Botões Finais de Aprovar ou Negar no Final do Formulário */}
                  <div className="sticky bottom-0 z-20 flex items-center justify-between gap-4 border-t border-[#E8E7E7] bg-white/95 px-8 py-5 backdrop-blur flex-shrink-0">
                    <button 
                      onClick={() => setAnalysisModal({ isOpen: false, record: null })}
                      className="px-6 py-3 font-sans text-xs font-black uppercase tracking-wide text-slate-500 hover:text-slate-800 hover:bg-[#FAFAFA] border border-[#E8E7E7] rounded-2xl transition-all duration-200 text-center cursor-pointer"
                    >
                      Cancelar
                    </button>
                    {currentStepNum === 4 ? (
                      <button 
                        onClick={() => {
                          const statusToSubmit = periodoTesteConfirmado === "Sim" ? StatusAuditoria.APROVADO : StatusAuditoria.NEGADO;
                          handleDecisionSubmit(statusToSubmit);
                        }}
                        className={`py-3 px-8 text-xs font-black text-white tracking-widest uppercase transition-all duration-200 rounded-2xl text-center active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                          periodoTesteConfirmado === "Sim" 
                            ? "bg-[#075618] hover:bg-[#064817] shadow-[#075618]/20" 
                            : "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20"
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
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => handleDecisionSubmit(StatusAuditoria.NEGADO)}
                          className="py-3 px-6 text-xs font-black text-rose-600 hover:text-white tracking-widest uppercase transition-all duration-200 bg-white hover:bg-rose-600 border border-rose-200 hover:border-rose-600 rounded-2xl text-center active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-rose-500/5"
                        >
                          <XCircle size={14} /> Negar Etapa
                        </button>
                        <button 
                          onClick={() => handleDecisionSubmit(StatusAuditoria.APROVADO)}
                          className="py-3 px-7 text-xs font-black text-white tracking-widest uppercase transition-all duration-200 bg-[#075618] hover:bg-[#064817] rounded-2xl text-center active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[#075618]/20 border border-transparent"
                        >
                          <CheckCircle2 size={14} /> Aprovar Etapa
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>

              {/* LAYOUT MOBILE */}
              <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#003F1D]/55 backdrop-blur-sm lg:hidden">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setAnalysisModal({ isOpen: false, record: null })}
                  className="absolute inset-0 bg-transparent"
                />
                <motion.div
                  initial={{ y: "100%", opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: "100%", opacity: 0 }}
                  transition={{ type: "spring", damping: 25, stiffness: 200 }}
                  className="relative h-[100dvh] w-full max-w-[430px] overflow-hidden bg-white shadow-2xl flex flex-col z-10"
                >
                  {/* Barra superior de marca Cedro */}
                  <div className="absolute left-0 top-0 h-1.5 w-full bg-gradient-to-r from-[#075618] via-[#075618] to-[#F29222] z-20" />

                  {/* CABEÇALHO MOBILE */}
                  <div className="sticky top-0 z-30 border-b border-[#064817] bg-[#075618] px-5 pb-4 pt-5 flex-shrink-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-white/10 border border-white/25 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white">
                          ETAPA {wf ? wf.currentStep : 1} DE {currentSteps.length}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide border ${
                          record.status === "Aprovado" 
                            ? "bg-white text-[#075618] border-white" 
                            : record.status === "Rejeitado" || record.status === "Negado"
                            ? "bg-rose-500 text-white border-rose-600"
                            : "bg-amber-400 text-[#543d00] border-amber-500"
                        }`}>
                          {record.status || "PENDENTE"}
                        </span>
                      </div>

                      <button 
                        onClick={() => setAnalysisModal({ isOpen: false, record: null })}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20 shadow-sm cursor-pointer"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <div className="mt-4 font-lato text-2xl font-extrabold tracking-tight !text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.15)]">
                      {renderValue(record.nomeFerramenta)}
                    </div>

                    <p className="mt-2 font-noto text-xs font-medium leading-relaxed !text-white">
                      ID/Protocolo: <span className="font-extrabold !text-white">{record.id}</span>
                      <span className="mx-2 !text-white/40">•</span>
                      Avaliador: <span className="font-black !text-white uppercase tracking-wide">{activeEvaluatorName}</span>
                    </p>
                  </div>

                  {/* ÁREA DE CONTEÚDO COM SCROLL */}
                  <div className="flex-1 overflow-y-auto bg-[#F6F8F5] px-3.5 py-3.5 pb-48 space-y-2.5 custom-scrollbar">
                    
                    {/* HISTÓRICO DE PARECERES */}
                    {prevSteps.length > 0 && (
                      <div className="rounded-2xl border border-[#E8E7E7] bg-white p-4 shadow-sm space-y-4">
                        <h5 className="font-lato text-lg font-extrabold text-[#111111]">Histórico de Pareceres</h5>
                        <div className="space-y-4">
                          {prevSteps.map((s, idx) => {
                            const parsed = parseApprovalComment(s.comment);
                            const isNegado = s.status === "negado";
                            return (
                              <div key={s.stepNumber} className="relative rounded-2xl border border-[#E8E7E7] bg-white p-3 pl-12">
                                {/* Marcador circular */}
                                <div className={`absolute left-3 top-4 flex h-7 w-7 items-center justify-center rounded-full text-white z-10 ${isNegado ? "bg-rose-600" : "bg-[#075618]"}`}>
                                  {isNegado ? <XCircle size={14} /> : <Check size={14} />}
                                </div>
                                
                                {/* Linha vertical conectando itens */}
                                {idx < prevSteps.length - 1 && (
                                  <div className="absolute left-[25px] top-10 h-10 w-px bg-[#075618]/35 z-0" />
                                )}

                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="font-noto text-[10px] font-black uppercase tracking-widest text-[#075618]">
                                      Etapa {s.stepNumber} • {s.roleName}
                                    </p>
                                    <p className="mt-1 font-noto text-sm font-semibold text-[#111111] break-words whitespace-pre-line">
                                      {parsed.parecer || s.comment || "(Sem parecer informado)"}
                                    </p>
                                    <p className="mt-1 font-noto text-xs font-semibold text-slate-400">
                                      Por: {s.assignedUserName || "Aprovação Livre"}
                                    </p>
                                  </div>

                                  <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase ${
                                    isNegado
                                      ? "bg-rose-500/10 text-rose-700 border-rose-600/20"
                                      : "bg-[#075618]/10 text-[#075618] border-[#075618]/20"
                                  }`}>
                                    {isNegado ? "INDEFERIDO" : "APROVADO"}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* SEÇÕES RECOLHÍVEIS */}
                    {/* 1. Solicitante */}
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => setExpandedSections(prev => ({ ...prev, solicitante: !prev.solicitante }))}
                        className="flex w-full items-center justify-between rounded-2xl border border-[#E8E7E7] bg-white px-4 py-3 shadow-sm cursor-pointer"
                      >
                        <div className="flex items-center">
                          <Users size={16} className="mr-3 text-[#075618]" />
                          <span className="font-lato text-sm font-extrabold uppercase tracking-wide text-[#075618]">1. Solicitante</span>
                        </div>
                        {expandedSections.solicitante ? <ChevronUp size={16} className="text-[#075618]" /> : <ChevronDown size={16} className="text-[#075618]" />}
                      </button>
                      {expandedSections.solicitante && (
                        <div className="border border-t-0 border-[#E8E7E7] px-4 py-4 space-y-3 bg-white rounded-b-2xl">
                          <div>
                            <p className="font-noto text-[10px] font-black uppercase tracking-wide text-slate-400">Solicitante</p>
                            <p className="mt-1 font-noto text-sm font-bold text-[#111111]">{renderValue(record.responsavelPreenchimento, "preenchido")}</p>
                          </div>
                          <div className="pt-2 border-t border-[#E8E7E7]">
                            <p className="font-noto text-[10px] font-black uppercase tracking-wide text-slate-400">Cargo</p>
                            <p className="mt-1 font-noto text-sm font-bold text-[#111111] capitalize">{renderValue(record.cargo, "preenchido")}</p>
                          </div>
                          <div className="pt-2 border-t border-[#E8E7E7]">
                            <p className="font-noto text-[10px] font-black uppercase tracking-wide text-slate-400">Setor Solicitante</p>
                            <p className="mt-1 font-noto text-sm font-bold text-[#111111] uppercase">{renderValue(record.unidadeSetor, "preenchido")}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 2. Identificação da IA */}
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => setExpandedSections(prev => ({ ...prev, identificacao: !prev.identificacao }))}
                        className="flex w-full items-center justify-between rounded-2xl border border-[#E8E7E7] bg-white px-4 py-3 shadow-sm cursor-pointer"
                      >
                        <div className="flex items-center">
                          <Sliders size={16} className="mr-3 text-[#075618]" />
                          <span className="font-lato text-sm font-extrabold uppercase tracking-wide text-[#075618]">2. Identificação da IA</span>
                        </div>
                        {expandedSections.identificacao ? <ChevronUp size={16} className="text-[#075618]" /> : <ChevronDown size={16} className="text-[#075618]" />}
                      </button>
                      {expandedSections.identificacao && (
                        <div className="border border-t-0 border-[#E8E7E7] px-4 py-4 space-y-3 bg-white rounded-b-2xl">
                          <div>
                            <p className="font-noto text-[10px] font-black uppercase tracking-wide text-slate-400">Nome da Ferramenta</p>
                            <p className="mt-1 font-noto text-sm font-bold text-[#111111] uppercase">{renderValue(record.nomeFerramenta, "preenchido")}</p>
                          </div>
                          <div className="pt-2 border-t border-[#E8E7E7]">
                            <p className="font-noto text-[10px] font-black uppercase tracking-wide text-slate-400">Fornecedor / Desenvolvedor</p>
                            <p className="mt-1 font-noto text-sm font-bold text-[#111111] uppercase">{renderValue(record.fornecedor, "preenchido")}</p>
                          </div>
                          <div className="pt-2 border-t border-[#E8E7E7]">
                            <p className="font-noto text-[10px] font-black uppercase tracking-wide text-slate-400">Criticidade</p>
                            <p className="mt-1 font-noto text-sm font-bold text-[#111111] uppercase">{renderValue(record.criticidade, "preenchido")}</p>
                          </div>
                          <div className="pt-2 border-t border-[#E8E7E7]">
                            <p className="font-noto text-[10px] font-black uppercase tracking-wide text-slate-400">Tipo de IA / Tecnologia</p>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {record.tipoIA && record.tipoIA.length > 0 ? (
                                record.tipoIA.map((t: string) => (
                                  <span key={t} className="px-2 py-1 bg-[#075618]/8 text-[#075618] text-[10px] rounded-lg font-black uppercase tracking-tight">{t}</span>
                                ))
                              ) : (
                                <span className="text-slate-400 italic">Mapeamento não preenchido</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 3. Finalidade e Objetivos */}
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => setExpandedSections(prev => ({ ...prev, objetivo: !prev.objetivo }))}
                        className="flex w-full items-center justify-between rounded-2xl border border-[#E8E7E7] bg-white px-4 py-3 shadow-sm cursor-pointer"
                      >
                        <div className="flex items-center">
                          <Info size={16} className="mr-3 text-[#075618]" />
                          <span className="font-lato text-sm font-extrabold uppercase tracking-wide text-[#075618]">3. Finalidade e Objetivos</span>
                        </div>
                        {expandedSections.objetivo ? <ChevronUp size={16} className="text-[#075618]" /> : <ChevronDown size={16} className="text-[#075618]" />}
                      </button>
                      {expandedSections.objetivo && (
                        <div className="border border-t-0 border-[#E8E7E7] px-4 py-4 space-y-3 bg-white rounded-b-2xl">
                          <div>
                            <p className="font-noto text-[10px] font-black uppercase tracking-wide text-slate-400">Descrição da Atividade</p>
                            <p className="mt-1 font-noto text-sm font-bold text-[#111111] italic bg-[#FAFAFA] p-3 rounded-xl border border-[#E8E7E7] leading-relaxed">
                              {record.descricaoAtividade ? `"${record.descricaoAtividade}"` : <span className="text-slate-400 italic">Não preenchido</span>}
                            </p>
                          </div>
                          <div className="pt-2 border-t border-[#E8E7E7]">
                            <p className="font-noto text-[10px] font-black uppercase tracking-wide text-slate-400">Objetivos / Finalidade</p>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {record.objetivos && record.objetivos.length > 0 ? (
                                record.objetivos.map((t: string) => (
                                  <span key={t} className="px-2 py-1 bg-[#F29222]/10 border border-[#F29222]/20 text-[#9A4F00] text-[10px] rounded-lg font-black uppercase tracking-tight">{t}</span>
                                ))
                              ) : (
                                <span className="text-slate-400 italic">Não preenchido na solicitação</span>
                              )}
                            </div>
                          </div>
                          <div className="pt-2 border-t border-[#E8E7E7]">
                            <p className="font-noto text-[10px] font-black uppercase tracking-wide text-slate-400">Benefícios Esperados</p>
                            <p className="mt-1 font-noto text-sm font-bold text-[#111111] italic bg-[#FAFAFA] p-3 rounded-xl border border-[#E8E7E7] leading-relaxed">
                              {record.beneficiosEsperados ? `"${record.beneficiosEsperados}"` : <span className="text-slate-400 italic">Não preenchido</span>}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 9. Observações e Envio */}
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => setExpandedSections(prev => ({ ...prev, observacoes: !prev.observacoes }))}
                        className="flex w-full items-center justify-between rounded-2xl border border-[#E8E7E7] bg-white px-4 py-3 shadow-sm cursor-pointer"
                      >
                        <div className="flex items-center">
                          <ClipboardCheck size={16} className="mr-3 text-[#075618]" />
                          <span className="font-lato text-sm font-extrabold uppercase tracking-wide text-[#075618]">9. Observações e Envio</span>
                        </div>
                        {expandedSections.observacoes ? <ChevronUp size={16} className="text-[#075618]" /> : <ChevronDown size={16} className="text-[#075618]" />}
                      </button>
                      {expandedSections.observacoes && (
                        <div className="border border-t-0 border-[#E8E7E7] px-4 py-4 space-y-3 bg-white rounded-b-2xl">
                          <div>
                            <p className="font-noto text-[10px] font-black uppercase tracking-wide text-slate-400">Observações Gerais do Solicitante</p>
                            <p className="mt-1 font-noto text-sm font-bold text-[#111111] italic bg-[#FAFAFA] p-3 rounded-xl border border-[#E8E7E7] leading-relaxed">
                              {getOriginalObservacoes(record) === "Não preenchido" ? (
                                <span className="text-slate-400 italic">Não preenchido</span>
                              ) : (
                                `"${getOriginalObservacoes(record)}"`
                              )}
                            </p>
                          </div>
                          {((record.anexos && record.anexos.trim() !== "") || record.documentoNome) && (
                            <div className="pt-2 border-t border-[#E8E7E7] space-y-2">
                              <p className="font-noto text-[10px] font-black uppercase tracking-wide text-slate-400">Anexos / Links de Referência</p>
                              {record.anexos && record.anexos.trim() !== "" && (
                                <div className="mt-1 bg-[#FAFAFA] border border-[#E8E7E7] p-3 rounded-xl flex items-center gap-2 shadow-xs">
                                  <span className="text-slate-700 text-xs font-semibold truncate max-w-full">
                                    📎 {record.anexos}
                                  </span>
                                </div>
                              )}
                              {record.documentoNome && (
                                <div className="mt-2 bg-[#075618]/5 border border-[#075618]/15 p-3 rounded-xl flex flex-col xs:flex-row xs:items-center justify-between gap-3 shadow-xs">
                                  <div className="min-w-0 flex items-center gap-2">
                                    <span className="text-base">📁</span>
                                    <div className="min-w-0">
                                      <p className="text-[11px] font-black text-[#075618] uppercase truncate" title={record.documentoNome}>
                                        {record.documentoNome}
                                      </p>
                                      <p className="text-[9px] text-slate-500 mt-0.5 font-mono">
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
                                      className="bg-[#075618] hover:bg-[#064817] text-white text-[9.5px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-lg text-center select-none cursor-pointer transition-all self-end xs:self-auto shrink-0"
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

                    {/* FORMULÁRIO DA ETAPA ATUAL */}
                    <div className="rounded-2xl border border-[#E8E7E7] bg-white p-4 shadow-sm space-y-4">
                      <p className="font-lato text-base font-extrabold text-[#111111] border-b border-[#E8E7E7] pb-2">
                        Formulário de Decisão
                      </p>

                      {currentStepNum === 1 && (
                        <div className="space-y-4">
                          {renderMobileQuestion(
                            "01",
                            "A solicitação está clara o suficiente para continuidade da análise?",
                            "Avaliar se objetivo, descrição, processo impactado e benefícios esperados permitem compreender perfeitamente a demanda.",
                            ["Sim", "Não"],
                            coordClarezaSolicitacao,
                            setCoordClarezaSolicitacao
                          )}
                          {renderMobileQuestion(
                            "02",
                            "A ferramenta/software requisitado caracteriza-se de fato como Inteligência Artificial?",
                            "Validar se a ferramenta utiliza modelos de aprendizado de máquina, redes neurais, LLMs, NLP ou algoritmos avançados de automação cognitiva.",
                            ["Sim", "Não"],
                            coordUsoIA,
                            setCoordUsoIA
                          )}
                          {renderMobileQuestion(
                            "03",
                            "Encaminhamento da solicitação do Coordenador NIT",
                            "Decisão final da triagem para prosseguimento no fluxo NIT ou devolução/reprovação imediata.",
                            ["Sim, dar andamento ao fluxo", "Não, devolver/cancelar"],
                            coordEncaminhamento,
                            setCoordEncaminhamento
                          )}
                        </div>
                      )}

                      {currentStepNum === 2 && (
                        <div className="space-y-4">
                          {renderMobileQuestion(
                            "01",
                            "Identificação de Riscos Institucionais",
                            "Possíveis impactos jurídicos, reputacionais, de segurança da informação ou vazamento de dados corporativos/pessoais.",
                            ["Sim, alto impacto", "Sim, baixo impacto", "Não mapeado"],
                            gerNitRiscos,
                            setGerNitRiscos
                          )}
                          {renderMobileQuestion(
                            "02",
                            "Necessidade de Cuidados Especiais de Governança",
                            "Necessidade de termos de uso específicos, políticas de consentimento de dados de laboratório ou controles rígidos.",
                            ["Sim", "Não"],
                            gerNitCuidados,
                            setGerNitCuidados
                          )}
                          {renderMobileQuestion(
                            "03",
                            "Encaminhamento para a TI do Cedro",
                            "Indicação de que a solicitação está apta para análise técnica e de segurança pela gerência de tecnologia.",
                            ["Sim", "Não"],
                            gerNitEncaminhamento,
                            setGerNitEncaminhamento
                          )}
                        </div>
                      )}

                      {currentStepNum === 3 && (
                        <div className="space-y-4">
                          {renderMobileQuestion(
                            "01",
                            "Compatibilidade de Infraestrutura e Rede",
                            "Se o software de IA exige servidores dedicados, APIs de alta vazão ou portas de rede específicas no ambiente Cedro.",
                            ["Sim", "Sim, com ajustes", "Não"],
                            tiInfra,
                            setTiInfra
                          )}
                          {renderMobileQuestion(
                            "02",
                            "Segurança de Dados Corporativos e LGPD",
                            "Garantias de criptografia em trânsito/repouso e conformidade com a Lei Geral de Proteção de Dados.",
                            ["Sim", "Não"],
                            tiSeguranca,
                            setTiSeguranca
                          )}
                          {renderMobileQuestion(
                            "03",
                            "Integração com Sistemas Cedro",
                            "Necessidade de integrações com o ERP, barramentos de mensageria internos ou bancos de dados corporativos.",
                            ["Sim", "Não"],
                            tiIntegracao,
                            setTiIntegracao
                          )}
                          {renderMobileQuestion(
                            "04",
                            "Ambiente de Hospedagem / Operação",
                            "Classificação do ambiente operacional onde a solução de Inteligência Artificial processará as informações.",
                            ["SaaS Externo", "On-Premises Cedro", "Híbrido"],
                            tiAmbiente,
                            setTiAmbiente
                          )}
                          {renderMobileQuestion(
                            "05",
                            "Método de Controle de Acesso e Identidade",
                            "Mecanismo de autenticação exigido para garantir segurança dos operadores na ferramenta de IA.",
                            ["Não", "Sim, via SSO Cedro", "Sim, via credenciais específicas"],
                            tiControleAcesso,
                            setTiControleAcesso
                          )}
                          {renderMobileQuestion(
                            "06",
                            "Rastreabilidade e Logs de Auditoria",
                            "Geração constante de histórico de transações internas e logs de uso para auditoria judicial e análise pós-incidentes.",
                            ["Não", "Sim"],
                            tiLogs,
                            setTiLogs
                          )}
                          {renderMobileQuestion(
                            "07",
                            "Esforço Operacional de Implantação da TI",
                            "Demanda de mão de obra do time técnico interno para implementar, homologar ou dar sustentabilidade futura a esta inteligência artificial.",
                            ["Não", "Sim, baixa complexidade", "Sim, alta complexidade"],
                            tiAcao,
                            setTiAcao
                          )}
                        </div>
                      )}

                      {currentStepNum === 4 && (
                        <div className="space-y-4">
                          {renderMobileQuestion(
                            "01",
                            "O período de teste foi realizado e a ferramenta demonstrou condições operacionais adequadas?",
                            "Sinalizar se os testes comprovaram a segurança técnica e utilidade prática no fluxo de atividades do setor solicitante.",
                            ["Sim", "Não"],
                            periodoTesteConfirmado,
                            setPeriodoTesteConfirmado
                          )}
                        </div>
                      )}

                      {/* Parecer Técnico textarea */}
                      <div className="space-y-2 pt-2">
                        <label className="text-xs font-bold text-[#111111] font-lato uppercase tracking-wider flex items-center gap-2">
                          <MessageSquare size={14} className="text-[#075618]" /> Parecer Técnico Justificado
                        </label>
                        <textarea
                          value={auditComment}
                          onChange={(e) => setAuditComment(e.target.value)}
                          placeholder={
                            currentStepNum === 1 
                              ? "Registre o parecer da triagem sobre a clareza e elegibilidade técnica desta solicitação de Inteligência Artificial..."
                              : currentStepNum === 2
                              ? "Registre de forma breve a análise sobre importância da solicitação, riscos, cuidados necessários e encaminhamento para a próxima etapa."
                              : "Descreva aqui sua justificativa técnica detalhada corporativa. Seus argumentos de parecer fundamentarão documentalmente o histórico desta IA no banco do Cedro..."
                          }
                          className="min-h-[120px] w-full rounded-2xl border border-[#E8E7E7] bg-white p-4 font-noto text-sm text-[#111111] placeholder:text-slate-400 focus:border-[#075618] focus:ring-4 focus:ring-[#075618]/10 outline-none resize-none shadow-sm font-semibold"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* RODAPÉ FIXO COM BOTÕES */}
                  <div className="fixed bottom-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 border-t border-[#E8E7E7] bg-white/95 px-4 py-4 backdrop-blur">
                    {currentStepNum === 4 ? (
                      <div className="flex flex-col">
                        <button 
                          onClick={() => {
                            const statusToSubmit = periodoTesteConfirmado === "Sim" ? StatusAuditoria.APROVADO : StatusAuditoria.NEGADO;
                            handleDecisionSubmit(statusToSubmit);
                          }}
                          className={`flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-4 font-noto text-sm font-black uppercase tracking-wide text-white shadow-lg ${
                            periodoTesteConfirmado === "Sim" 
                              ? "bg-[#075618] shadow-[#075618]/20" 
                              : "bg-[#E40046] shadow-red-500/20"
                          }`}
                        >
                          {periodoTesteConfirmado === "Sim" ? (
                            <>
                              <CheckCircle2 size={16} /> Confirmar Decisão (Aprovar)
                            </>
                          ) : (
                            <>
                              <XCircle size={16} /> Confirmar Decisão (Negar)
                            </>
                          )}
                        </button>
                        <button 
                          onClick={() => setAnalysisModal({ isOpen: false, record: null })}
                          className="mt-3 w-full py-2 text-center font-noto text-xs font-black uppercase tracking-wide text-slate-500 hover:text-slate-800 cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        <div className="flex gap-3">
                          <button 
                            onClick={() => handleDecisionSubmit(StatusAuditoria.NEGADO)}
                            className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-[#E40046] px-5 py-4 font-noto text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-red-500/20 cursor-pointer"
                          >
                            <XCircle size={16} /> Negar etapa
                          </button>
                          <button 
                            onClick={() => handleDecisionSubmit(StatusAuditoria.APROVADO)}
                            className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-[#075618] px-5 py-4 font-noto text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-[#075618]/20 cursor-pointer"
                          >
                            <CheckCircle2 size={16} /> Aprovar etapa
                          </button>
                        </div>
                        <button 
                          onClick={() => setAnalysisModal({ isOpen: false, record: null })}
                          className="mt-3 w-full py-2 text-center font-noto text-xs font-black uppercase tracking-wide text-slate-500 hover:text-slate-800 cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            </>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
