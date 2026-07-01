/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Save, X, Info, AlertTriangle, ShieldCheck, Zap, Database, Share2, ClipboardCheck, Scale, FileText, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { 
  StatusAuditoria,
  IARecord, TiposIA, ObjetivosIA, EtapaProcesso, RiscoResidual, 
  Criticidade, NaturezaUso, GrauAutonomia, ClassificacaoRisco, StatusUso 
} from "../types";
import { generateId, getGlobalRecords, getSectors } from "../storage";

import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

interface RegistrationFormProps {
  initialData?: IARecord | null;
  onSave: (record: IARecord) => Promise<void> | void;
  onCancel: () => void;
  isAdmin?: boolean;
}

// ... helper components defined outside to prevent re-mounting focus loss issues ...
const BadgePerfil = () => (
  <span className="ml-2 inline-flex items-center gap-1 text-[9px] font-black bg-[#E8E7E7] text-[#111111]/80 border border-slate-300 px-2 py-0.5 rounded-full uppercase tracking-wider select-none">
    👤 Perfil
  </span>
);

const BadgeAutomatico = () => (
  <span className="ml-2 inline-flex items-center gap-1 text-[9px] font-black bg-[#075618]/10 text-[#075618] border border-[#075618]/25 px-2 py-0.5 rounded-full uppercase tracking-wider select-none">
    ⚙️ Automático
  </span>
);

const getInputClass = (val: any, disabled?: boolean) => {
  const base = "w-full p-4 rounded-2xl font-semibold text-sm outline-none transition-all placeholder:text-slate-400 shadow-xs";
  if (disabled) {
    return `${base} bg-[#E8E7E7] text-[#111111]/70 border border-[#E8E7E7] cursor-not-allowed select-none`;
  }
  const isFilled = Array.isArray(val) ? val.length > 0 : !!val;
  const borderClass = isFilled ? "border-[#075618]/45" : "border-[#E8E7E7]";
  return `${base} bg-slate-50/50 hover:bg-slate-50 focus:bg-white text-[#111111] border ${borderClass} focus:ring-4 focus:ring-[#075618]/10 focus:border-[#075618] focus:shadow-sm`;
};

const InputGroup = ({ 
  label, 
  required, 
  children, 
  infoAction,
  badge
}: { 
  label: string; 
  required?: boolean; 
  children: React.ReactNode; 
  infoAction?: React.ReactNode;
  badge?: React.ReactNode;
}) => (
  <div className="space-y-1.5 w-full group">
    <div className="flex items-center justify-between gap-2 w-full">
      <label className="text-xs font-bold text-[#111111] flex items-center gap-1.5 uppercase tracking-tight group-focus-within:text-[#075618] transition-colors">
        <div className="size-1.5 rounded-full bg-slate-300 group-focus-within:bg-[#075618] group-focus-within:shadow-[0_0_6px_rgba(7,86,24,0.5)] transition-all"></div>
        <span>{label}</span>
        {required && <span className="text-red-500 font-bold ml-0.5">*</span>}
        {badge}
      </label>
      {infoAction}
    </div>
    {children}
  </div>
);

const RadioGroup = ({ 
  label, 
  value, 
  options, 
  onChange, 
  required,
  onInfoClick
}: { 
  label: string; 
  value: string; 
  options: string[]; 
  onChange: (val: string) => void; 
  required?: boolean;
  onInfoClick?: () => void;
}) => (
  <InputGroup 
    label={label} 
    required={required}
    infoAction={onInfoClick ? (
      <button
        type="button"
        onClick={onInfoClick}
        className="px-2.5 py-1 rounded-md bg-[#075618]/10 hover:bg-[#075618] text-[#075618] hover:text-white border border-[#075618]/30 hover:border-[#075618] flex items-center justify-center transition-all cursor-pointer hover:scale-105 shadow-sm font-sans"
        title="Explicar"
      >
        <span className="text-[9px] font-black uppercase tracking-wider">Explicação</span>
      </button>
    ) : null}
  >
    <div className="flex flex-wrap gap-3">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all border ${
            value === opt 
              ? "bg-[#075618] text-white border-[#075618] shadow-sm scale-[1.05]" 
              : "bg-white text-[#111111] border-[#E8E7E7] hover:border-[#075618]/50 hover:text-[#075618]"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  </InputGroup>
);

const CheckboxGroup = ({ 
  label, 
  value, 
  options, 
  onToggle, 
  required,
  onInfoClick
}: { 
  label: string; 
  value: string[]; 
  options: string[]; 
  onToggle: (val: string) => void; 
  required?: boolean;
  onInfoClick?: () => void;
}) => (
  <InputGroup 
    label={label} 
    required={required}
    infoAction={onInfoClick ? (
      <button
        type="button"
        onClick={onInfoClick}
        className="px-2.5 py-1 rounded-md bg-[#075618]/10 hover:bg-[#075618] text-[#075618] hover:text-white border border-[#075618]/30 hover:border-[#075618] flex items-center justify-center transition-all cursor-pointer hover:scale-105 shadow-sm font-sans"
        title="Explicar tipos de IA"
      >
        <span className="text-[9px] font-black uppercase tracking-wider">Explicação</span>
      </button>
    ) : null}
  >
    <div className="flex flex-wrap gap-3">
      {options.map(opt => {
         const isSelected = value.includes(opt);
         return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all border ${
              isSelected 
                ? "bg-[#075618] text-white border-[#075618] shadow-sm scale-[1.05]" 
                : "bg-white text-[#111111] border-[#E8E7E7] hover:border-[#075618]/50 hover:text-[#075618]"
            }`}
          >
            {opt}
          </button>
         );
      })}
    </div>
  </InputGroup>
);

const TextArea = ({ 
  label, 
  value, 
  onChange, 
  required, 
  placeholder,
  className 
}: { 
  label: string; 
  value: string; 
  onChange: (val: string) => void; 
  required?: boolean; 
  placeholder?: string;
  className?: string;
}) => {
  const isFilled = !!value;
  const borderClass = isFilled ? "border-[#075618]/45" : "border-[#E8E7E7]";
  const combinedClass = `w-full p-4 rounded-2xl font-bold text-sm outline-none transition-all placeholder:text-slate-400 bg-white text-[#111111] border ${borderClass} focus:ring-2 focus:ring-[#075618]/15 focus:border-[#075618] focus:shadow-[0_0_8px_rgba(7,86,24,0.15)] min-h-[100px]`;
  return (
    <InputGroup label={label} required={required}>
      <textarea 
        className={combinedClass}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </InputGroup>
  );
};

export default function RegistrationForm({ initialData, onSave, onCancel, isAdmin }: RegistrationFormProps) {
  const { profile } = useAuth();
  const [formData, setFormData] = useState<Partial<IARecord>>({
    id: "",
    unidadeSetor: "",
    responsavelPreenchimento: "",
    cargo: "",
    dataRegistro: new Date().toISOString().split('T')[0],
    utilizaIA: "Sim",
    nomeFerramenta: "",
    fornecedor: "",
    versao: "",
    tipoIA: [],
    descricaoAtividade: "",
    objetivos: [],
    etapaProcesso: EtapaProcesso.OUTRO,
    beneficiosEsperados: "",
    usaDadosPessoais: "Não",
    usaDadosSensiveis: "Não",
    quaisDados: "",
    dadosAnonimizados: "Não",
    envioFornecedorExterno: "Não",
    dadosTreinamentoModelo: "Não",
    integradaSistemaInterno: "Não",
    impactoResultadosLaboratoriais: "Não",
    validacaoHumana: "Sim",
    riscosIdentificados: "Não",
    controlesImplementados: "Não",
    quaisControles: [],
    riscoResidual: RiscoResidual.NAO_AVALIADO,
    alinhadoLGPD: "Em avaliação",
    politicaInterna: "Não",
    treinamentoColaboradores: "Não",
    documentacaoTecnica: "Não se aplica",
    contratoProtecaoDados: "Não se aplica",
    statusUso: StatusUso.EM_AVALIACAO,
    statusAuditoria: StatusAuditoria.PENDENTE,
    necessitaPlanoAcao: "Não",
    areaAvaliadora: ["NIT"]
  });

  const [activeSection, setActiveSection] = useState(0);
  const [showTypeIAPopup, setShowTypeIAPopup] = useState(false);
  const [showDadosInfoPopup, setShowDadosInfoPopup] = useState(false);
  const [showDadosAnonimizadosPopup, setShowDadosAnonimizadosPopup] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [sectors, setSectors] = useState<string[]>([]);
  const [cargosDisponiveis, setCargosDisponiveis] = useState<string[]>([]);
  const [outroActive, setOutroActive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savingStep, setSavingStep] = useState("");

  useEffect(() => {
    const fetchSectors = async () => {
      const list = await getSectors();
      setSectors(list);
    };
    fetchSectors();
  }, []);

  useEffect(() => {
    const currentSector = formData.unidadeSetor;
    if (!currentSector) {
      setCargosDisponiveis([]);
      return;
    }

    const loadCargos = async () => {
      try {
        const { data, error } = await supabase
          .from("sectors")
          .select("cargos")
          .eq("name", currentSector)
          .maybeSingle();

        if (!error && data && Array.isArray(data.cargos) && data.cargos.length > 0) {
          setCargosDisponiveis(data.cargos);
          return;
        }
      } catch (err) {
        console.error("Erro ao carregar cargos do Supabase em RegistrationForm:", err);
      }

      try {
        const rawDetails = localStorage.getItem("cedro_sectors_details_v2");
        if (rawDetails) {
          const details = JSON.parse(rawDetails);
          if (details[currentSector] && Array.isArray(details[currentSector].cargos)) {
            setCargosDisponiveis(details[currentSector].cargos);
            return;
          }
        }
      } catch (e) {
        console.error("Error getting cargos in RegistrationForm:", e);
      }

      const PRESET_CARGOS: Record<string, string[]> = {
        "NIT": ["Pesquisador de IA", "Analista de Inovação", "Gestor de Portfólio", "Engenheiro de Processos"],
        "TI": ["Analista de Suporte", "Administrador de Sistemas", "Desenvolvedor de Software", "Engenheiro de Dados"],
        "Marketing": ["Analista de Comunicação", "Designer Gráfico", "Especialista em SEO", "Social Media"],
        "Administrativo": ["Auxiliar Administrativo", "Assistente Financeiro", "Gerente de Operações", "Analista de Contratos"],
        "Jurídico": ["Advogado Integrado", "Assessor LGPD", "Consultor Regulatório", "Assistente Jurídico"],
        "Direção Técnica": ["Diretor Técnico", "Supervisor Analítico", "Responsável Técnico", "Auditor Médico"],
        "Qualidade": ["Gestor de Qualidade", "Analista de Qualidade", "Auditor de Processos", "Inspetor Sanitário"],
        "Atendimento / Recepção": ["Recepcionista", "Atendente Técnico", "Supervisor de Relacionamento", "Auxiliar de Caixa"],
        "Laboratório de Patologia": ["Médico Patologista", "Técnico em Histologia", "Citotécnico", "Auxiliar de Laboratório"],
        "Laboratório Central": ["Biomédico Palestrante", "Técnico em Análises Clínicas", "Farmacêutico Bioquímico", "Auxiliar de Coleta"]
      };

      setCargosDisponiveis(PRESET_CARGOS[currentSector] || ["Colaborador"]);
    };

    loadCargos();
  }, [formData.unidadeSetor]);

   useEffect(() => {
    if (initialData) {
      setFormData(initialData);
      const presets = ["ChatGPT", "Google Gemini", "Microsoft Copilot", "Claude", "Grok"];
      if (initialData.nomeFerramenta && !presets.includes(initialData.nomeFerramenta)) {
        setOutroActive(true);
      } else {
        setOutroActive(false);
      }
    } else if (!isInitialized && profile) {
      const fetchAndSetId = async () => {
        const records = await getGlobalRecords();
        
        const sList = (profile.setor || "").split(";").map(s => s.trim()).filter(Boolean);
        const cList = (profile.cargo || "").split(";").map(c => c.trim()).filter(Boolean);
        const defaultSetor = sList[0] || "";
        const defaultCargo = cList[0] || "";

        setFormData(prev => ({ 
          ...prev, 
          id: generateId(records),
          unidadeSetor: defaultSetor || (prev.unidadeSetor || ""),
          responsavelPreenchimento: profile.full_name || prev.responsavelPreenchimento || "",
          cargo: defaultCargo || (prev.cargo || ""),
          dataRegistro: prev.dataRegistro || new Date().toISOString().split('T')[0]
        }));
        setOutroActive(false);
        setIsInitialized(true);
      };
      fetchAndSetId();
    }
  }, [initialData, profile, isInitialized]);

  const isProfileIncompleteForStep1 = (() => {
    if (!profile || !profile.full_name || profile.full_name.trim() === "") return true;
    const sList = (profile.setor || "").split(";").map(s => s.trim()).filter(Boolean);
    const cList = (profile.cargo || "").split(";").map(c => c.trim()).filter(Boolean);
    return sList.length === 0 || cList.length === 0;
  })();

  const isStep1Incomplete = !formData.unidadeSetor || 
    formData.unidadeSetor.trim() === "" || 
    formData.unidadeSetor.trim() === "Não definido" || 
    formData.unidadeSetor.trim() === "Nao definido" || 
    !formData.responsavelPreenchimento || 
    formData.responsavelPreenchimento.trim() === "" || 
    !formData.cargo || 
    formData.cargo.trim() === "" || 
    formData.cargo.trim() === "Colaborador" || 
    formData.cargo.trim() === "Não definido" || 
    formData.cargo.trim() === "Não informado" || 
    !formData.dataRegistro || 
    formData.dataRegistro.trim() === "";

  const isStep2Incomplete = !formData.nomeFerramenta || 
    formData.nomeFerramenta.trim() === "";

  const isStep3Incomplete = !formData.descricaoAtividade || 
    formData.descricaoAtividade.trim() === "" ||
    !formData.objetivos || 
    formData.objetivos.length === 0 ||
    (formData.objetivos.includes(ObjetivosIA.OUTRO) && (!formData.objetivoOutro || formData.objetivoOutro.trim() === "")) ||
    !formData.beneficiosEsperados || 
    formData.beneficiosEsperados.trim() === "";

  const updateField = (field: keyof IARecord, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleArrayToggle = (field: "tipoIA" | "objetivos" | "quaisControles" | "areaAvaliadora", value: any) => {
    const current = (formData[field] as any[]) || [];
    const newVal = current.includes(value) 
      ? current.filter(v => v !== value) 
      : [...current, value];
    
    if (field === "objetivos") {
      setFormData(prev => ({
        ...prev,
        objetivos: newVal,
        ...(newVal.includes(ObjetivosIA.OUTRO) ? {} : { objetivoOutro: "" })
      }));
    } else {
      updateField(field, newVal);
    }
  };

  // Automatic Risk Classification Logic
  useEffect(() => {
    let suggestedRisk = ClassificacaoRisco.BAIXO;

    const impactsResults = formData.impactoResultadosLaboratoriais === "Sim";
    const sensitiveData = formData.usaDadosSensiveis === "Sim";
    const personalData = formData.usaDadosPessoais === "Sim";
    const noHumanValidation = formData.validacaoHumana === "Não";
    const noLGPD = formData.alinhadoLGPD === "Não";
    const noControls = formData.controlesImplementados === "Não";
    const highCriticity = formData.criticidade === Criticidade.ALTA;

    if (noLGPD && (personalData || sensitiveData)) {
      suggestedRisk = ClassificacaoRisco.CRITICO;
    } else if (impactsResults && noControls) {
      suggestedRisk = ClassificacaoRisco.CRITICO;
    } else if (sensitiveData && noHumanValidation) {
      suggestedRisk = ClassificacaoRisco.CRITICO;
    } else if (impactsResults || highCriticity) {
      suggestedRisk = ClassificacaoRisco.ALTO;
    } else if (sensitiveData || personalData) {
      suggestedRisk = ClassificacaoRisco.MEDIO;
    } else if (formData.criticidade === Criticidade.MEDIA) {
      suggestedRisk = ClassificacaoRisco.MEDIO;
    }

    if (formData.classificacaoRiscoAutomatico !== suggestedRisk) {
      updateField("classificacaoRiscoAutomatico", suggestedRisk);
      // Only auto-update manual if user hasn't touched it (simplified logic)
      if (!formData.classificacaoRiscoManual) {
        updateField("classificacaoRiscoManual", suggestedRisk);
      }
    }
  }, [
    formData.impactoResultadosLaboratoriais,
    formData.usaDadosSensiveis,
    formData.usaDadosPessoais,
    formData.validacaoHumana,
    formData.alinhadoLGPD,
    formData.controlesImplementados,
    formData.criticidade
  ]);

  const sections = [
    { label: "Solicitante", icon: FileText },
    { label: "Escolha da IA", icon: Zap },
    { label: "Objetivo", icon: Info },
    { label: "Observações e Envio", icon: ClipboardCheck },
  ];

  const visibleSections = sections;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Safety guard: only allow save if we are on the very last section (Phase 4: Observações e Envio)
    if (activeSection !== visibleSections.length - 1) {
      console.warn("Submit prevented: Not in the final section.", activeSection);
      return;
    }
    
    const nativeEvent = e.nativeEvent as any;
    const submitter = nativeEvent.submitter as HTMLButtonElement | null;

    if (submitter && submitter.getAttribute("data-action") !== "save-record") {
      return;
    }
    
    // Rule 5: Não permitir salvar a solicitação se a Etapa 1 estiver incompleta
    if (isStep1Incomplete || isProfileIncompleteForStep1) {
      alert("Complete seu perfil para continuar. Informe seu cargo/função antes de abrir uma solicitação de IA.");
      setActiveSection(0);
      return;
    }

    const cleanSector = (formData.unidadeSetor || "").trim();
    if (!cleanSector || cleanSector.toLowerCase() === "não definido" || cleanSector.toLowerCase() === "nao definido") {
      alert("Por favor, preencha o campo obrigatório 'Setor' na primeira seção. Ele não pode ser vazio ou 'Não definido'.");
      setActiveSection(0);
      return;
    }
    if (isStep2Incomplete) {
      alert("Por favor, selecione ou informe o nome da IA (Fase 2).");
      setActiveSection(1);
      return;
    }
    if (isStep3Incomplete) {
      alert("Por favor, preencha todos os campos obrigatórios da Fase 3 — Objetivo.");
      setActiveSection(2);
      return;
    }
    
    const now = new Date().toISOString();
    const history = formData.historico || [];
    
    const cleanObservacoesGerais = (formData.observacoesGerais || "").trim();
    const originalObs = initialData?.observacoesGeraisOriginais || formData.observacoesGeraisOriginais || cleanObservacoesGerais;

    const cleanNome = (formData.nomeFerramenta || "").trim() || `Solicitação de IA — ${cleanSector || "Geral"}`;
    const presets = ["ChatGPT", "Google Gemini", "Microsoft Copilot", "Claude", "Grok"];
    const cleanTipoIA = presets.includes(cleanNome) ? [TiposIA.CHATBOT, TiposIA.IA_GENERATIVA] : [TiposIA.OUTRO];
    const cleanTipoIAOutro = presets.includes(cleanNome) ? "Atendimento automatizado" : cleanNome;

    setIsSaving(true);
    setSavingStep("Salvando registro de IA no Supabase...");

    try {
      await onSave({
        ...formData,
        nomeFerramenta: cleanNome,
        tipoIA: cleanTipoIA,
        tipoIAOutro: cleanTipoIAOutro,
        observacoesGerais: cleanObservacoesGerais,
        observacoesGeraisOriginais: originalObs,
        utilizaIA: formData.utilizaIA || "Sim",
        fornecedor: formData.fornecedor || "Interno",
        createdAt: initialData ? initialData.createdAt : now,
        updatedAt: now,
        historico: history,
      } as IARecord);
    } catch (err: any) {
      console.error(err);
      alert(`⚠️ Erro ao salvar: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Prevent implicit submission when pressing Enter inside input fields
    if (e.key === "Enter") {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT") {
        e.preventDefault();
      }
    }
  };

  const sharedInputClass = "w-full p-4 bg-black/5 dark:bg-white/5 border border-brand-green/35 dark:border-brand-green/20 rounded-2xl text-[var(--text-bright)] font-bold text-sm outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all placeholder:text-[var(--text-muted)] shadow-inner";

  return (
    <div className="bg-[var(--bg-main)] rounded-[2rem] shadow-xl dark:shadow-black/40 border border-[var(--border-lab)] overflow-hidden flex flex-col md:flex-row min-h-[700px] relative">
      {/* Sidebar Stepper - AI Lab Navigation */}
      <div className="bg-[var(--bg-sidebar)] md:w-72 p-6 space-y-2 flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible shrink-0 border-b md:border-b-0 md:border-r border-[var(--border-lab)] scrollbar-hide relative z-10">
        <div className="hidden md:block text-xs text-[var(--text-muted)] font-bold uppercase tracking-wide mb-6 px-4 font-display">NOVA SOLICITAÇÃO</div>
        {visibleSections.map((sec, i) => (
          <button
            key={i}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Form validation constraints on direct sidebar navigation click
              if (i > 0 && (isStep1Incomplete || isProfileIncompleteForStep1)) {
                alert("Complete seu perfil para continuar. Informe seu cargo/função antes de abrir uma solicitação de IA.");
                return;
              }
              if (i > 1 && isStep2Incomplete) {
                alert("Por favor, selecione ou informe o nome da IA (Fase 2) antes de avançar.");
                return;
              }
              if (i > 2 && isStep3Incomplete) {
                alert("Por favor, preencha todos os campos explicativos da Fase 3 — Objetivo antes de avançar.");
                return;
              }
              setActiveSection(i);
            }}
            className={`flex items-center gap-4 w-full p-4 rounded-2xl transition-all whitespace-nowrap text-left group relative overflow-hidden border ${
              activeSection === i 
                ? "bg-[#075618]/10 text-[#075618] font-bold border-[#075618]/35" 
                : "text-[var(--text-muted)] hover:text-[#111111] hover:bg-black/5 border-[var(--border-lab)]"
            }`}
          >
            {activeSection === i && (
              <motion.div layoutId="form-active" className="absolute left-0 top-0 bottom-0 w-1 bg-[#075618]" />
            )}
            <div className={`p-2 rounded-xl border transition-colors ${
              activeSection === i ? "bg-[#075618]/15 border-[#075618]/30" : "bg-black/5 dark:bg-white/5 border-[var(--border-lab)] group-hover:border-[#111111]/30"
            }`}>
              <sec.icon size={16} className={activeSection === i ? "text-[#075618]" : "text-[var(--text-muted)]"} />
            </div>
            <div className="flex flex-col">
              <span className={`text-[10px] font-sans tracking-normal uppercase text-left transition-colors ${
                activeSection === i ? "text-[#F29222] font-semibold opacity-100" : "text-[var(--text-muted)] opacity-60"
              }`}>Fase 0{i+1}</span>
              <span className={`text-[13px] tracking-normal font-sans text-left uppercase ${
                activeSection === i ? "text-[#075618] font-bold" : "text-[var(--text-muted)] font-medium"
              }`}>{sec.label}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Form Area */}
      <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="flex-1 flex flex-col min-w-0 bg-[var(--bg-main)] relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-green/5 blur-3xl rounded-full pointer-events-none"></div>
        <div className="p-10 flex-1 overflow-y-auto custom-scrollbar relative z-10">
          <div className="mb-12 flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-[var(--border-lab)] pb-8">
             <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="px-3 py-1 bg-[#F29222]/10 border border-[#F29222]/35 rounded-full">
                    <p className="text-[10px] font-bold text-[#F29222] uppercase tracking-wide">Etapa {activeSection + 1} de {visibleSections.length}</p>
                  </div>
                  <div className="size-1 rounded-full bg-slate-300"></div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-tight">Conexão Segura Ativa</span>
                </div>
                <h2 className="text-4xl font-black text-[#111111] tracking-normal font-display uppercase">
                  {sections[activeSection].label.toUpperCase()}
                </h2>
             </div>
             <div className="px-6 py-3 bg-[#E8E7E7]/40 rounded-2xl font-mono text-xs font-extrabold text-[#075618] border border-[#075618]/20">
               Protocolo: {formData.id}
             </div>
          </div>

          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {activeSection === 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {isProfileIncompleteForStep1 && (
                  <div className="col-span-1 md:col-span-2 p-5 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 rounded-2xl flex items-start gap-3">
                    <AlertTriangle className="shrink-0 mt-0.5" size={18} />
                    <span className="text-xs font-bold uppercase tracking-wide leading-relaxed">
                      Complete seu perfil para continuar. Informe seu cargo/função antes de abrir uma solicitação de IA.
                    </span>
                  </div>
                )}
                <InputGroup label="Setor" required badge={!isAdmin ? <BadgePerfil /> : null}>
                  {!isAdmin ? (
                    (() => {
                      const sList = (profile?.setor || "").split(";").map(s => s.trim()).filter(Boolean);
                      if (sList.length > 1) {
                        return (
                          <select
                            className={getInputClass(formData.unidadeSetor)}
                            value={formData.unidadeSetor || ""}
                            onChange={(e) => {
                              const selectedSector = e.target.value;
                              const sListAll = (profile?.setor || "").split(";").map(s => s.trim()).filter(Boolean);
                              const cListAll = (profile?.cargo || "").split(";").map(c => c.trim()).filter(Boolean);
                              const matchedIdx = sListAll.indexOf(selectedSector);
                              const matchedCargo = matchedIdx !== -1 ? cListAll[matchedIdx] : "";
                              
                              setFormData(prev => ({
                                ...prev,
                                unidadeSetor: selectedSector,
                                cargo: matchedCargo || prev.cargo
                              }));
                            }}
                            required
                          >
                            <option value="">Selecione um dos seus setores...</option>
                            {sList.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        );
                      }
                      
                      return (
                        <input 
                          className={getInputClass(formData.unidadeSetor, true)}
                          value={formData.unidadeSetor || ""}
                          disabled
                          required
                        />
                      );
                    })()
                  ) : (
                    <>
                      <input 
                        className={getInputClass(formData.unidadeSetor)}
                        value={formData.unidadeSetor || ""}
                        onChange={(e) => updateField("unidadeSetor", e.target.value)}
                        placeholder="Ex: NIT, TI, Marketing, Hematologia..."
                        required
                        list="setores-list"
                      />
                      <datalist id="setores-list">
                        {sectors.map(sec => (
                          <option key={sec} value={sec} />
                        ))}
                      </datalist>
                    </>
                  )}
                </InputGroup>
                <InputGroup label="Responsável pelo Preenchimento" required>
                  <input 
                    className={getInputClass(formData.responsavelPreenchimento)}
                    value={formData.responsavelPreenchimento || ""}
                    onChange={(e) => updateField("responsavelPreenchimento", e.target.value)}
                    placeholder="Nome Completo"
                    required
                  />
                </InputGroup>
                <InputGroup label="Cargo" required badge={!isAdmin ? <BadgePerfil /> : null}>
                  {!isAdmin ? (
                    (() => {
                      const sListAll = (profile?.setor || "").split(";").map(s => s.trim()).filter(Boolean);
                      const cListAll = (profile?.cargo || "").split(";").map(c => c.trim()).filter(Boolean);
                      
                      const currentSector = formData.unidadeSetor;
                      const validCargosForCurrentSector = sListAll
                        .map((sec, idx) => (sec === currentSector ? cListAll[idx] : null))
                        .filter(Boolean) as string[];

                      if (validCargosForCurrentSector.length > 1) {
                        return (
                          <select 
                            className={getInputClass(formData.cargo)}
                            value={formData.cargo || ""}
                            onChange={(e) => updateField("cargo", e.target.value)}
                            required
                          >
                            <option value="">Selecione o cargo para este setor...</option>
                            {validCargosForCurrentSector.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        );
                      }

                      const assignedCargo = validCargosForCurrentSector[0] || formData.cargo || "Colaborador";
                      return (
                        <input 
                          className={getInputClass(assignedCargo, true)}
                          value={assignedCargo}
                          disabled
                          required
                        />
                      );
                    })()
                  ) : (
                    <select 
                      className={getInputClass(formData.cargo)}
                      value={formData.cargo || ""}
                      onChange={(e) => updateField("cargo", e.target.value)}
                      required
                    >
                      <option value="">Selecione seu cargo / função...</option>
                      {cargosDisponiveis.map((c: string) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  )}
                </InputGroup>
                <InputGroup label="Data do Registro" required badge={<BadgeAutomatico />}>
                  <input 
                    type="date"
                    className={getInputClass(formData.dataRegistro, true)}
                    value={formData.dataRegistro || ""}
                    onChange={(e) => updateField("dataRegistro", e.target.value)}
                    required
                    disabled
                  />
                </InputGroup>
              </div>
            )}
            
            {/* ... other sections will follow the same pattern through shared styles ... */}
            {/* Updating the sharedInputClass for the Lab Look */}

            {activeSection === 1 && (
              <div className="space-y-6">
                <InputGroup label="Selecione a Inteligência Artificial corporativa desejada" required>
                  <p className="text-xs text-slate-500 font-sans font-medium mb-3 leading-relaxed">
                    Estas são as inteligências artificiais disponíveis para a escolha do solicitante. Selecione uma das opções abaixo ou marque <strong>"Outro"</strong> para digitar uma ferramenta diferente.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                      { name: "ChatGPT" },
                      { name: "Google Gemini" },
                      { name: "Microsoft Copilot" },
                      { name: "Claude" },
                      { name: "Grok" },
                      { name: "Outro" }
                    ].map((ia) => {
                      const isSelected = ia.name === "Outro" ? outroActive : (formData.nomeFerramenta === ia.name && !outroActive);
                      return (
                        <button
                          key={ia.name}
                          type="button"
                          onClick={() => {
                            if (ia.name === "Outro") {
                              setOutroActive(true);
                              updateField("nomeFerramenta", "");
                            } else {
                              setOutroActive(false);
                              updateField("nomeFerramenta", ia.name);
                            }
                          }}
                          className={`p-4 rounded-2xl text-left border transition-all relative overflow-hidden flex flex-col justify-center min-h-[80px] focus:outline-none ${
                            isSelected
                              ? "bg-[#075618]/10 text-[#075618] border-[#075618] shadow-[0_4px_12px_rgba(7,86,24,0.1)] scale-[1.02]"
                              : "bg-white text-[#111111] border-[#E8E7E7] hover:border-[#075618]/45 hover:bg-[#075618]/5"
                          }`}
                        >
                          {isSelected && (
                            <span className="absolute top-2 right-2 text-xs bg-[#075618] text-white px-2 py-0.5 rounded-full font-black uppercase tracking-wider text-[8px]">
                              Selecionado
                            </span>
                          )}
                          <div className="space-y-0.5">
                            <h4 className="text-sm font-black uppercase tracking-tight font-display">{ia.name}</h4>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </InputGroup>

                {outroActive && (
                  <div className="mt-4 p-6 bg-[#075618]/5 border border-[#075618]/20 rounded-3xl space-y-3 animate-in slide-in-from-top-4 duration-300">
                    <InputGroup label="Escreva o nome da Inteligência Artificial desejada" required>
                      <input
                        type="text"
                        className={getInputClass(formData.nomeFerramenta)}
                        value={formData.nomeFerramenta || ""}
                        onChange={(e) => updateField("nomeFerramenta", e.target.value)}
                        placeholder="Ex: ChatGPT, Gemini..."
                        required
                      />
                    </InputGroup>
                  </div>
                )}
              </div>
            )}

            {activeSection === 2 && (
              <div className="space-y-6">
                <TextArea 
                  label="Descreva onde e como a IA será utilizada" 
                  value={formData.descricaoAtividade as string}
                  onChange={(val) => updateField("descricaoAtividade", val)}
                  required 
                  placeholder="Exemplo: A IA será utilizada no setor de atendimento para auxiliar na organização de mensagens, respostas frequentes e triagem inicial de solicitações."
                />
                <CheckboxGroup 
                  label="Objetivo da Utilização" 
                  options={Object.values(ObjetivosIA)} 
                  value={formData.objetivos as any[]}
                  onToggle={(val) => handleArrayToggle("objetivos", val)}
                  required 
                />

                {formData.objetivos?.includes(ObjetivosIA.OUTRO) && (
                  <InputGroup label="Descreva o outro objetivo" required>
                    <input 
                      type="text"
                      className={getInputClass(formData.objetivoOutro)}
                      value={formData.objetivoOutro || ""}
                      onChange={(e) => updateField("objetivoOutro", e.target.value)}
                      placeholder="Descreva o outro objetivo"
                      required
                    />
                  </InputGroup>
                )}

                <TextArea 
                  label="Quais benefícios são esperados com o uso da IA?" 
                  value={formData.beneficiosEsperados as string}
                  onChange={(val) => updateField("beneficiosEsperados", val)}
                  required
                  placeholder="Exemplo: Reduzir tempo de atendimento, padronizar respostas, diminuir retrabalho, apoiar a equipe na análise de informações e melhorar a produtividade do setor."
                />
              </div>
            )}

            {activeSection === 3 && (
              <div className="space-y-6">
                <TextArea 
                  label="Observações Gerais" 
                  value={formData.observacoesGerais as string}
                  onChange={(val) => updateField("observacoesGerais", val)}
                />
                <TextArea 
                  label="Referências, links ou documentos relacionados" 
                  value={formData.anexos as string}
                  onChange={(val) => updateField("anexos", val)}
                  placeholder="Informe links, nomes de arquivos, protocolos, pastas, documentos físicos ou outras referências relacionadas à solicitação. Exemplo: manual da ferramenta, link do fornecedor, e-mail de referência, pasta compartilhada ou documento físico arquivado." 
                />

                {/* Campo de Anexo de Documento Físico */}
                <div className="space-y-2 mt-4 pb-4">
                  <label className="block text-xs font-black uppercase text-slate-700 tracking-wider">
                    Anexar Documento Técnico Complementar (Opcional)
                  </label>
                  <p className="text-[11px] text-slate-400 font-medium leading-normal">
                    Anexe o manual oficial, termo de conformidade, proposta ou especificação técnica relevante sobre esta solução de IA para apoiar o fluxo de governança.
                  </p>

                  <input
                    type="file"
                    id="documento-file-input"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      
                      const reader = new FileReader();
                      reader.onload = () => {
                        updateField("documentoUrl", reader.result as string);
                        updateField("documentoNome", file.name);
                        updateField("documentoTamanho", file.size);
                        updateField("documentoTipo", file.type);
                      };
                      reader.readAsDataURL(file);
                    }}
                    accept=".pdf,.docx,.doc,.xlsx,.xls,.png,.jpg,.jpeg"
                  />

                  {formData.documentoNome ? (
                    <div className="bg-emerald-50/50 border border-[#075618]/25 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-3xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-2xl select-none shrink-0 font-normal">📄</span>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-[#003F1D] truncate uppercase" title={formData.documentoNome}>
                            {formData.documentoNome}
                          </p>
                          <p className="text-[10px] text-[#667085] mt-1 font-mono font-medium">
                            {formData.documentoTamanho ? `${(formData.documentoTamanho / 1024).toFixed(1)} KB` : ""} • {formData.documentoTipo || "Arquivo"}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          updateField("documentoUrl", undefined);
                          updateField("documentoNome", undefined);
                          updateField("documentoTamanho", undefined);
                          updateField("documentoTipo", undefined);
                          const fileInput = document.getElementById("documento-file-input") as HTMLInputElement;
                          if (fileInput) fileInput.value = "";
                        }}
                        className="p-2 text-slate-400 hover:text-lab-red hover:bg-rose-50 rounded-xl transition-all font-bold text-xs uppercase flex items-center gap-1 shrink-0 select-none cursor-pointer"
                        title="Remover documento"
                      >
                        <X size={14} /> Remover
                      </button>
                    </div>
                  ) : (
                    <div 
                      onClick={() => document.getElementById("documento-file-input")?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const file = e.dataTransfer.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => {
                            updateField("documentoUrl", reader.result as string);
                            updateField("documentoNome", file.name);
                            updateField("documentoTamanho", file.size);
                            updateField("documentoTipo", file.type);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="border-2 border-dashed border-slate-200 hover:border-[#075618] bg-slate-50/50 hover:bg-[#EAF4EC]/10 rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-2 cursor-pointer transition-all group"
                    >
                      <div className="size-10 bg-slate-100 group-hover:bg-[#EAF4EC] border border-slate-250 group-hover:border-emerald-200/50 text-[#075618] rounded-xl flex items-center justify-center shrink-0 transition-colors">
                        <FileText size={18} />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-black text-slate-700 group-hover:text-[#003F1D] transition-colors uppercase">
                          Clique ou arraste um arquivo aqui
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium">
                          PDF, DOCX, XLSX ou Imagens até 10MB
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                

              </div>
            )}

                      </div>
        </div>

        {/* Footer Actions */}
        <div className="p-8 border-t border-[var(--border-lab)] bg-black/5 dark:bg-white/[0.02] flex flex-col md:flex-row gap-6 justify-between items-center relative z-10">
          <button type="button" onClick={onCancel} className="flex items-center gap-2 text-xs font-bold text-[var(--text-muted)] hover:text-lab-red transition-all uppercase tracking-tight group">
            <X size={14} className="group-hover:scale-125 transition-transform" /> Cancelar Registro
          </button>
          <div className="flex gap-4">
             {activeSection > 0 && (
               <button 
                 key="btn-voltar"
                 type="button" 
                 onClick={(e) => {
                   e.preventDefault();
                   e.stopPropagation();
                   setActiveSection(s => s - 1);
                 }} 
                 className="px-8 py-3 bg-white border border-[#E8E7E7] text-[#111111] text-xs font-bold uppercase tracking-tight rounded-xl hover:bg-[#E8E7E7]/50 hover:text-[#075618] transition-all active:scale-95 shadow-sm"
               >
                 Voltar
               </button>
             )}
             {activeSection < visibleSections.length - 1 ? (
               <button 
                 key="btn-proximo"
                 type="button" 
                 onClick={(e) => {
                   e.preventDefault();
                   e.stopPropagation();
                   if (activeSection === 0 && (isStep1Incomplete || isProfileIncompleteForStep1)) {
                     alert("Complete seu perfil para continuar. Informe seu cargo/função antes de abrir uma solicitação de IA.");
                     return;
                   }
                   if (activeSection === 1 && isStep2Incomplete) {
                     alert("Por favor, selecione ou informe o nome da IA (Fase 2).");
                     return;
                   }
                   if (activeSection === 2 && isStep3Incomplete) {
                     alert("Por favor, preencha todos os campos obrigatórios de Objetivos e Benefícios (Fase 3).");
                     return;
                   }
                   setActiveSection(s => s + 1);
                 }} 
                 disabled={
                   (activeSection === 0 && (isStep1Incomplete || isProfileIncompleteForStep1)) ||
                   (activeSection === 1 && isStep2Incomplete) ||
                   (activeSection === 2 && isStep3Incomplete)
                 }
                 className={`px-10 py-3 text-xs font-bold uppercase tracking-tight rounded-xl transition-all shadow-md flex items-center gap-2 border ${
                   ((activeSection === 0 && (isStep1Incomplete || isProfileIncompleteForStep1)) ||
                    (activeSection === 1 && isStep2Incomplete) ||
                     (activeSection === 2 && isStep3Incomplete))
                     ? "bg-[#E8E7E7] text-[#111111]/45 border-[#E8E7E7] cursor-not-allowed select-none"
                     : "bg-[#075618] hover:bg-[#075618]/90 text-white border-[#075618] active:scale-95 cursor-pointer shadow-[0_4px_10px_rgba(7,86,24,0.15)]"
                 }`}
               >
                 Próxima Etapa <ChevronRight size={14} />
               </button>
             ) : (
               <button 
                 key="btn-salvar"
                 type="submit" 
                 data-action="save-record" disabled={isSaving}
                 className={`px-10 py-3 bg-[#075618] text-white text-xs font-bold uppercase tracking-tight rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2 ${
                    isSaving
                      ? "opacity-60 cursor-not-allowed select-none bg-[#075618]/80"
                      : "hover:bg-[#075618]/90 cursor-pointer shadow-[0_4px_10px_rgba(7,86,24,0.15)]"
                  }`}
               >
                 {isSaving ? (
                    <span className="flex items-center gap-2">
                      Aguarde...
                      <span className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
                    </span>
                  ) : (
                    <>
                      Salvar Registro <Save size={14} />
                    </>
                  )}
               </button>
             )}
          </div>
        </div>
      </form>

      {/* Saving Loading View Overlay */}
      {isSaving && (
        <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-[6px] z-50 flex flex-col items-center justify-center p-6 transition-all duration-300 animate-in fade-in">
          <div className="bg-white p-10 rounded-[2.5rem] border border-[#075618]/15 shadow-[0_25px_60px_-15px_rgba(7,86,24,0.15)] flex flex-col items-center text-center max-w-sm w-full space-y-6 relative overflow-hidden">
            {/* Ambient background glow inside the popup */}
            <div className="absolute -top-12 -left-12 w-24 h-24 bg-[#075618]/5 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -right-12 w-24 h-24 bg-[#075618]/5 rounded-full blur-2xl pointer-events-none" />
            
            <div className="relative flex items-center justify-center">
              {/* Outer light green background circle */}
              <div className="size-24 rounded-full bg-[#075618]/5 flex items-center justify-center relative border border-[#075618]/10 shadow-inner">
                {/* Inner white circle holding the save icon */}
                <div className="size-18 rounded-full border border-[#075618]/10 flex items-center justify-center bg-white shadow-sm">
                  <Save size={24} className="text-[#075618]" />
                </div>
                {/* SVG circular track with smooth animated spinner segment */}
                <svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 100 100">
                  <motion.circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="transparent"
                    stroke="#075618"
                    strokeWidth="3.5"
                    strokeDasharray="276.4"
                    initial={{ strokeDashoffset: 276.4 }}
                    animate={{ strokeDashoffset: [200, 50, 200], rotate: [0, 360] }}
                    transition={{ 
                      strokeDashoffset: { repeat: Infinity, duration: 2, ease: "easeInOut" },
                      rotate: { repeat: Infinity, duration: 1.5, ease: "linear" }
                    }}
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
            
            <div className="space-y-1">
              <h3 className="text-base font-black uppercase tracking-[0.12em] text-[#075618] font-sans">
                Salvando Solicitação
              </h3>
            </div>
            
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden relative">
              <motion.div 
                className="bg-[#075618] h-full rounded-full"
                initial={{ width: "10%", x: "0%" }}
                animate={{ width: ["15%", "45%", "15%"], x: ["0%", "200%", "0%"] }}
                transition={{ 
                  repeat: Infinity, 
                  duration: 2.2, 
                  ease: "easeInOut" 
                }}
              />
            </div>
            
            <span className="text-[9px] font-black uppercase tracking-[0.25em] text-[#075618]/85 animate-pulse">
              Por favor, aguarde
            </span>
          </div>
        </div>
      )}

      {/* Styled Popup Informing AI Types */}
      {showTypeIAPopup && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-[4px] z-50 flex items-center justify-center p-4" onClick={() => setShowTypeIAPopup(false)}>
          <div className="bg-white border border-[#E8E7E7] rounded-[2rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-in scale-in duration-200" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-6 border-b border-[#E8E7E7] flex items-center justify-between bg-[#E8E7E7]/20">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-[#075618]/10 text-[#075618] flex items-center justify-center border border-[#075618]/20">
                  <Info size={18} />
                </div>
                <div>
                  <h3 className="text-xl font-bold font-display uppercase text-[#111111] tracking-tight">Tipos de Inteligência Artificial</h3>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowTypeIAPopup(false)}
                className="p-2 hover:bg-black/5 rounded-full transition-colors text-slate-500 hover:text-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-8 max-h-[60vh] overflow-y-auto space-y-4 custom-scrollbar text-left font-sans bg-white">
              <div className="grid grid-cols-1 gap-3.5">
                {[
                  {
                    title: "Chatbot",
                    description: "Chatbot é uma IA feita para conversar com pessoas, responder perguntas ou atender usuários.",
                    color: "border-l-teal-500",
                    tag: "Interação"
                  },
                  {
                    title: "Machine Learning",
                    description: "Machine Learning é uma IA que aprende com dados e melhora suas respostas ou previsões com o tempo.",
                    color: "border-l-indigo-500",
                    tag: "Aprendizado"
                  },
                  {
                    title: "Automação",
                    description: "Automação é uma IA usada para executar tarefas repetitivas, como preencher informações, enviar alertas ou organizar dados.",
                    color: "border-l-amber-500",
                    tag: "Processos"
                  },
                  {
                    title: "Análise de Imagens",
                    description: "Análise de Imagens é uma IA que consegue interpretar fotos, exames, documentos escaneados ou outros tipos de imagem.",
                    color: "border-l-blue-500",
                    tag: "Visão Computacional"
                  },
                  {
                    title: "IA Generativa",
                    description: "IA Generativa é uma IA que cria conteúdos, como textos, imagens, relatórios, respostas ou sugestões.",
                    color: "border-l-fuchsia-500",
                    tag: "Geração"
                  },
                  {
                    title: "Algoritmo de Apoio à Decisão",
                    description: "Algoritmo de Apoio à Decisão é uma IA que ajuda uma pessoa a escolher o melhor caminho, mostrando análises, riscos ou recomendações.",
                    color: "border-l-rose-500",
                    tag: "Decisão"
                  },
                  {
                    title: "Equipamento com IA Embarcada",
                    description: "Equipamento com IA Embarcada é quando a inteligência artificial já vem dentro de uma máquina, aparelho ou equipamento.",
                    color: "border-l-cyan-500",
                    tag: "Hardware"
                  },
                  {
                    title: "Outro",
                    description: "Outro é usado quando a IA não se encaixa bem em nenhuma das opções anteriores.",
                    color: "border-l-slate-400",
                    tag: "Geral"
                  }
                ].map((item, idx) => (
                  <div key={idx} className={`p-4 bg-slate-50 border border-[#E8E7E7] border-l-4 ${item.color} rounded-2xl flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 hover:bg-slate-100 transition-colors`}>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold font-display uppercase tracking-tight text-[#111111]">{item.title}</h4>
                      <p className="text-xs text-[#111111]/70 leading-relaxed font-sans font-medium">{item.description}</p>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-wider bg-slate-200/50 py-1 px-2.5 rounded-full border border-[#E8E7E7] text-slate-600 self-start shrink-0 font-sans">
                      {item.tag}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-[#E8E7E7] flex justify-end bg-[#E8E7E7]/20">
              <button
                type="button"
                onClick={() => setShowTypeIAPopup(false)}
                className="px-6 py-2.5 bg-[#075618] text-white hover:bg-[#075618]/90 font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 duration-150 font-sans"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Styled Unified Popup Informing Personal & Sensitive Data */}
      {showDadosInfoPopup && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-[4px] z-50 flex items-center justify-center p-4" onClick={() => setShowDadosInfoPopup(false)}>
          <div className="bg-white border border-[#E8E7E7] rounded-[2rem] w-full max-w-4xl overflow-hidden shadow-2xl animate-in scale-in duration-200" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-6 border-b border-[#E8E7E7] flex items-center justify-between bg-[#E8E7E7]/20">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-[#075618]/10 text-[#075618] flex items-center justify-center border border-[#075618]/20">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h3 className="text-xl font-bold font-display uppercase text-[#111111] tracking-tight">Dados Pessoais & Sensíveis</h3>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowDadosInfoPopup(false)}
                className="p-2 hover:bg-black/5 rounded-full transition-colors text-slate-500 hover:text-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-8 max-h-[60vh] overflow-y-auto space-y-6 custom-scrollbar text-left font-sans bg-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Personal Data Column */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-[#E8E7E7] pb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-[#075618] bg-[#075618]/10 px-2.5 py-1 rounded-md">
                      Dados Pessoais
                    </span>
                  </div>
                  <div className="space-y-3.5">
                    {[
                      {
                        title: "O que são?",
                        description: "Dados pessoais são informações que ajudam a identificar uma pessoa.",
                        color: "border-l-[#075618]"
                      },
                      {
                        title: "Exemplos",
                        description: "Nome, CPF, telefone, e-mail, endereço, data de nascimento, matrícula, foto, número de prontuário ou qualquer informação que mostre quem é a pessoa.",
                        color: "border-l-indigo-500"
                      },
                      {
                        title: "Em uma IA",
                        description: "Isso acontece quando o sistema usa, lê, guarda ou analisa informações de pessoas.",
                        color: "border-l-teal-500"
                      }
                    ].map((item, idx) => (
                      <div key={idx} className={`p-4 bg-slate-50 border border-[#E8E7E7] border-l-4 ${item.color} rounded-2xl flex flex-col gap-1 hover:bg-slate-100 transition-colors`}>
                        <h4 className="text-xs font-bold font-display uppercase tracking-tight text-[#111111]">{item.title}</h4>
                        <p className="text-xs text-[#111111]/70 leading-relaxed font-sans font-medium">{item.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sensitive Data Column */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-[#E8E7E7] pb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-rose-600 bg-rose-50 px-2.5 py-1 rounded-md text-white">
                      Dados Sensíveis
                    </span>
                  </div>
                  <div className="space-y-3.5">
                    {[
                      {
                        title: "O que são?",
                        description: "Dados sensíveis são dados pessoais mais delicados. São informações que precisam de mais cuidado, porque podem expor muito a vida da pessoa.",
                        color: "border-l-rose-500"
                      },
                      {
                        title: "Exemplos",
                        description: "Dados de saúde, exames, diagnósticos, biometria, religião, raça, opinião política, dados genéticos e informações sobre vida sexual.",
                        color: "border-l-amber-500"
                      },
                      {
                        title: "Em uma IA",
                        description: "Isso acontece quando o sistema usa informações mais privadas ou importantes sobre alguém.",
                        color: "border-l-fuchsia-500"
                      }
                    ].map((item, idx) => (
                      <div key={idx} className={`p-4 bg-slate-50 border border-[#E8E7E7] border-l-4 ${item.color} rounded-2xl flex flex-col gap-1 hover:bg-slate-100 transition-colors`}>
                        <h4 className="text-xs font-bold font-display uppercase tracking-tight text-[#111111]">{item.title}</h4>
                        <p className="text-xs text-[#111111]/70 leading-relaxed font-sans font-medium">{item.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-[#E8E7E7] flex justify-end bg-[#E8E7E7]/20">
              <button
                type="button"
                onClick={() => setShowDadosInfoPopup(false)}
                className="px-6 py-2.5 bg-[#075618] text-white hover:bg-[#075618]/90 font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 duration-150 font-sans"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Styled Popup Informing Anonimized Data */}
      {showDadosAnonimizadosPopup && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-[4px] z-50 flex items-center justify-center p-4" onClick={() => setShowDadosAnonimizadosPopup(false)}>
          <div className="bg-white border border-[#E8E7E7] rounded-[2rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-in scale-in duration-200" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-6 border-b border-[#E8E7E7] flex items-center justify-between bg-[#E8E7E7]/20">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-[#075618]/10 text-[#075618] flex items-center justify-center border border-[#075618]/20">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h3 className="text-xl font-bold font-display uppercase text-[#111111] tracking-tight">Dados Anonimizados</h3>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowDadosAnonimizadosPopup(false)}
                className="p-2 hover:bg-black/5 rounded-full transition-colors text-slate-500 hover:text-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-8 max-h-[60vh] overflow-y-auto space-y-4 custom-scrollbar text-left font-sans bg-white">
              <div className="grid grid-cols-1 gap-3.5">
                {[
                  {
                    title: "O que são dados anonimizados?",
                    description: "Dados anonimizados são informações que foram modificadas para que não seja mais possível saber de quem são.",
                    color: "border-l-[#075618]",
                    tag: "Conceito"
                  },
                  {
                    title: "Analogia simples",
                    description: "É como apagar a etiqueta com o nome da pessoa.",
                    color: "border-l-indigo-500",
                    tag: "Analogia"
                  },
                  {
                    title: "Exemplo prático",
                    description: "Em vez de exibir dados diretamente identificáveis (Ex: \"Maria Silva — CPF — telefone — resultado do exame\"), o sistema mostra apenas dados agregados ou desidentificados (Ex: \"Paciente 001 — idade — sexo — resultado do exame\").",
                    color: "border-l-amber-500",
                    tag: "Exemplo"
                  }
                ].map((item, idx) => (
                  <div key={idx} className={`p-4 bg-slate-50 border border-[#E8E7E7] border-l-4 ${item.color} rounded-2xl flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 hover:bg-slate-100 transition-colors`}>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold font-display uppercase tracking-tight text-[#111111]">{item.title}</h4>
                      <p className="text-xs text-[#111111]/70 leading-relaxed font-sans font-medium">{item.description}</p>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-wider bg-slate-200/50 py-1 px-2.5 rounded-full border border-[#E8E7E7] text-slate-600 self-start shrink-0 font-sans">
                      {item.tag}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-[#E8E7E7] flex justify-end bg-[#E8E7E7]/20">
              <button
                type="button"
                onClick={() => setShowDadosAnonimizadosPopup(false)}
                className="px-6 py-2.5 bg-[#075618] text-[#ffffff] hover:bg-[#075618]/90 font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 duration-150 font-sans"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
