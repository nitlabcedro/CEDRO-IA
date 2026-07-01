/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  Printer, 
  ArrowLeft, 
  Download, 
  AlertTriangle, 
  Activity, 
  Edit, 
  Clipboard, 
  FileText, 
  Info, 
  Target, 
  Database, 
  ShieldCheck, 
  ShieldAlert, 
  History, 
  HelpCircle, 
  Check, 
  CheckCircle2, 
  Users, 
  Cpu, 
  Lock, 
  ChevronRight,
  TrendingUp,
  FileCheck2,
  Bookmark,
  ExternalLink
} from "lucide-react";
import { IARecord, StatusUso, ClassificacaoRisco, StatusAuditoria, ApprovalWorkflow, ApprovalConfig } from "../types";


interface ReportViewProps {
  record: IARecord;
  onBack: () => void;
  onEdit?: (record: IARecord) => void;
  isAdmin?: boolean;
  workflows?: ApprovalWorkflow[];
  approvalConfig?: ApprovalConfig;
}

type TabType = "visao-geral" | "finalidade-uso" | "dados-utilizados" | "riscos-controles" | "historico" | "relatorio";

// helper to format comment text
const formatComment = (commentRaw?: string) => {
  if (!commentRaw) return [<p key="empty" className="text-xs text-slate-500 italic">Nenhum detalhe adicional fornecido.</p>];
  
  const lines = commentRaw.split("\n").map(l => l.trim()).filter(Boolean);
  
  return lines.map((line, idx) => {
    // Check if it's a heading
    if (line.startsWith("###")) {
      const cleanHeading = line.replace(/###/g, "").trim();
      return (
        <h5 key={idx} className="text-[10px] font-black uppercase text-rose-900 tracking-wider mt-4 first:mt-0 mb-1 border-b border-rose-100 pb-0.5">
          {cleanHeading}
        </h5>
      );
    }
    
    // Check if it's a key-value pair with colon
    if (line.includes(":") && !line.startsWith("http://") && !line.startsWith("https://")) {
      const parts = line.split(":");
      const key = parts[0].replace(/^[•\-\*]\s*/, "").replace(/\*\*/g, "").trim();
      const val = parts.slice(1).join(":").replace(/\*\*/g, "").trim();
      
      // If it's the main parecer final, make it larger
      if (key.toLowerCase().includes("parecer final") || key.toLowerCase().includes("parecer")) {
        return (
          <div key={idx} className="mt-2.5 p-3 bg-white/80 rounded-xl border border-rose-100/70 shadow-3xs text-slate-800">
            <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest block mb-0.5">{key}</span>
            <p className="text-xs font-bold leading-normal">{val}</p>
          </div>
        );
      }
      
      return (
        <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between text-xs py-1.5 border-b border-rose-100/30 font-semibold text-slate-700">
          <span className="text-slate-500 font-bold">{key}</span>
          <span className="text-rose-950 font-black sm:text-right">{val}</span>
        </div>
      );
    }
    
    // Fallback simple line
    const cleanLine = line.replace(/^[•\-\*]\s*/, "").replace(/\*\*/g, "").trim();
    return (
      <p key={idx} className="text-xs text-rose-800 leading-normal font-semibold mt-1">
        • {cleanLine}
      </p>
    );
  });
};

export default function ReportView({ record, onBack, onEdit, isAdmin, workflows, approvalConfig }: ReportViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>("visao-geral");
  const [expandedEvents, setExpandedEvents] = useState<Record<number, boolean>>({});
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);

  const handleDownloadPDF = async () => {
    const element = document.getElementById("report-content");

    if (!element) {
      alert("Não foi possível encontrar a área de relatório.");
      return;
    }

    setIsDownloadingPdf(true);

    let tempContainer: HTMLDivElement | null = null;
    let tempStyleTag: HTMLStyleElement | null = null;
    const disabledStates: Array<{ sheet: HTMLStyleElement | HTMLLinkElement; wasDisabled: boolean }> = [];

    try {
      // Helper function to convert modern colors into RGB/RGBA via canvas
      const convertColorToRgb = (colorStr: string): string => {
        if (!colorStr) return colorStr;
        const lower = colorStr.toLowerCase();
        if (!lower.includes("oklch") && !lower.includes("oklab") && !lower.includes("color-mix")) {
          return colorStr;
        }

        try {
          const canvas = document.createElement("canvas");
          canvas.width = 1;
          canvas.height = 1;
          const ctx = canvas.getContext("2d");
          if (!ctx) return "rgb(100, 116, 139)";

          ctx.fillStyle = colorStr;
          ctx.fillRect(0, 0, 1, 1);
          const data = ctx.getImageData(0, 0, 1, 1).data;
          
          if (data[3] === 0 && !lower.includes("transparent")) {
            return "rgb(100, 116, 139)";
          }
          return `rgba(${data[0]}, ${data[1]}, ${data[2]}, ${data[3] / 255})`;
        } catch (e) {
          console.warn("Falha ao converter cor via canvas:", colorStr, e);
          return "rgb(100, 116, 139)";
        }
      };

      const cleanColorsInCssText = (cssText: string): string => {
        const colorRegex = /(oklch|oklab|color-mix)\s*\((?:[^()]*|\((?:[^()]*|\([^()]*\))*\))*\)/gi;
        return cssText.replace(colorRegex, (match) => {
          return convertColorToRgb(match);
        });
      };

      const html2pdfModule = await import("html2pdf.js");
      const html2pdfLib = (html2pdfModule.default || html2pdfModule) as any;

      const clonedElement = element.cloneNode(true) as HTMLElement;

      // Clean inline styles on the cloned element itself and all its descendants
      const allSelfAndChildren = [clonedElement, ...Array.from(clonedElement.querySelectorAll("*"))] as HTMLElement[];
      allSelfAndChildren.forEach((el) => {
        const styleAttr = el.getAttribute("style");
        if (styleAttr && (styleAttr.includes("oklch") || styleAttr.includes("oklab") || styleAttr.includes("color-mix"))) {
          const cleaned = cleanColorsInCssText(styleAttr);
          el.setAttribute("style", cleaned);
        }
      });

      // Fetch and clean all document stylesheets to ensure html2canvas won't crash
      const stylesheets = Array.from(document.querySelectorAll("style, link[rel='stylesheet']")) as Array<HTMLStyleElement | HTMLLinkElement>;
      let combinedCss = "";

      for (const sheetEl of stylesheets) {
        let cssText = "";
        if (sheetEl.tagName === "STYLE") {
          cssText = sheetEl.textContent || "";
        } else if (sheetEl.tagName === "LINK") {
          const href = (sheetEl as HTMLLinkElement).href;
          const isSameOrigin = !href || href.startsWith(window.location.origin) || href.startsWith("/");
          if (isSameOrigin) {
            try {
              const url = new URL(href, window.location.origin);
              const relativePath = url.pathname + url.search;
              const res = await fetch(relativePath);
              if (res.ok) {
                cssText = await res.text();
              }
            } catch (e) {
              console.warn("Falha ao buscar css do stylesheet local:", href, e);
            }
          }
        }
        combinedCss += cssText + "\n";
      }

      // Create a temporary cleaned stylesheet
      const cleanCss = cleanColorsInCssText(combinedCss);
      tempStyleTag = document.createElement("style");
      tempStyleTag.id = "temp-pdf-clean-sheet";
      tempStyleTag.textContent = cleanCss;
      document.head.appendChild(tempStyleTag);

      // Disable original stylesheets
      stylesheets.forEach((sheet) => {
        disabledStates.push({ sheet, wasDisabled: sheet.disabled });
        sheet.disabled = true;
      });

      tempContainer = document.createElement("div");
      tempContainer.style.position = "fixed";
      tempContainer.style.left = "-9999px";
      tempContainer.style.top = "0";
      tempContainer.style.width = "760px";
      tempContainer.style.backgroundColor = "#ffffff";
      tempContainer.style.color = "#1F2933";
      tempContainer.style.zIndex = "-1";

      const pdfSafeStyle = document.createElement("style");
      pdfSafeStyle.textContent = `
        * {
          box-sizing: border-box;
          color-scheme: light !important;
        }

        #pdf-export-root,
        #pdf-export-root * {
          font-family: "Noto Sans", "Lato", "Arial", sans-serif !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          box-shadow: none !important;
          text-shadow: none !important;
          filter: none !important;
        }

        #pdf-export-root {
          border: none !important;
          background: #ffffff !important;
          color: #1F2933 !important;
          padding: 16px 20px !important;
          box-shadow: none !important;
        }

        /* Afinar e suavizar todas as bordas do PDF */
        #pdf-export-root [class*="border"] {
          border-width: 0.75px !important;
          border-style: solid !important;
          border-color: #cbd5e1 !important; /* Suaviza as bordas pretas grossas de fallback */
        }

        #pdf-export-root .border-none,
        #pdf-export-root [class*="border-none"] {
          border: none !important;
          border-width: 0 !important;
        }

        /* Estilo do cabeçalho sem sombras e com borda inferior fina */
        #pdf-export-root .bg-gradient-to-br,
        #pdf-export-root [class*="bg-gradient"] {
          background-image: none !important;
          background-color: #f8fafc !important; /* Fundo limpo e cinza claro plano */
          box-shadow: none !important;
          border-bottom: 2px solid #075618 !important;
          padding: 12px 16px !important;
        }

        /* Reduzir o logotipo de forma elegante */
        #pdf-export-root img[alt="Laboratório Cedro"],
        #pdf-export-root img {
          max-height: 28px !important;
          height: 28px !important;
          width: auto !important;
          margin: 0 !important;
        }

        /* Reduções de margens, espaçamentos e preenchimentos para condensar tudo em uma única folha */
        #pdf-export-root .p-10 {
          padding: 12px 16px !important;
        }
        #pdf-export-root .p-8 {
          padding: 10px 14px !important;
        }
        #pdf-export-root .p-6 {
          padding: 8px 12px !important;
        }
        #pdf-export-root .p-5 {
          padding: 6px 10px !important;
        }
        #pdf-export-root .p-4.5 {
          padding: 6px 10px !important;
        }
        #pdf-export-root .p-4 {
          padding: 6px 10px !important;
        }
        #pdf-export-root .pb-6 {
          padding-bottom: 4px !important;
        }
        #pdf-export-root .mb-8 {
          margin-bottom: 8px !important;
        }
        #pdf-export-root .mb-6 {
          margin-bottom: 6px !important;
        }
        #pdf-export-root .mt-6 {
          margin-top: 8px !important;
        }
        #pdf-export-root .my-8 {
          margin-top: 8px !important;
          margin-bottom: 8px !important;
        }
        #pdf-export-root .mt-12 {
          margin-top: 10px !important;
        }
        #pdf-export-root .gap-8 {
          gap: 12px !important;
        }
        #pdf-export-root .gap-6 {
          gap: 10px !important;
        }
        #pdf-export-root .grid {
          gap: 10px !important;
        }
        #pdf-export-root .space-y-12 > * + * {
          margin-top: 12px !important;
        }
        #pdf-export-root .space-y-6 > * + * {
          margin-top: 8px !important;
        }
        #pdf-export-root .space-y-4 > * + * {
          margin-top: 6px !important;
        }
        #pdf-export-root .space-y-2 > * + * {
          margin-top: 4px !important;
        }

        /* Fontes compactadas para o laudo caber em 1 folha sem quebrar e mantendo legibilidade alta */
        #pdf-export-root h1 {
          font-size: 18px !important;
          margin-bottom: 4px !important;
          line-height: 1.2 !important;
          text-align: left !important;
        }
        #pdf-export-root h2 {
          font-size: 13px !important;
          line-height: 1.2 !important;
        }
        #pdf-export-root h3 {
          font-size: 11px !important;
          line-height: 1.2 !important;
        }
        #pdf-export-root .text-4xl {
          font-size: 18px !important;
        }
        #pdf-export-root .text-3xl {
          font-size: 15px !important;
        }
        #pdf-export-root .text-2xl {
          font-size: 13px !important;
        }
        #pdf-export-root .text-xl {
          font-size: 12px !important;
        }
        #pdf-export-root .text-lg {
          font-size: 11px !important;
        }
        #pdf-export-root .text-sm {
          font-size: 10px !important;
        }
        #pdf-export-root .text-xs {
          font-size: 8.5px !important;
        }
        #pdf-export-root label {
          font-size: 8px !important;
          margin-bottom: 3px !important;
          font-weight: 700 !important;
        }
        #pdf-export-root p,
        #pdf-export-root span,
        #pdf-export-root font,
        #pdf-export-root li {
          font-size: 10px !important;
          line-height: 1.3 !important;
        }

        /* Ajustes de boxes específicos */
        #pdf-export-root .px-6.py-3 {
          padding: 4px 8px !important;
        }
        #pdf-export-root .px-4.py-2 {
          padding: 3px 6px !important;
        }
        #pdf-export-root .p-10.relative {
          padding: 12px 16px !important;
        }
        #pdf-export-root font {
          font-size: 9px !important;
        }

        #pdf-export-root .bg-white {
          background-color: #ffffff !important;
        }

        #pdf-export-root .text-white {
          color: #ffffff !important;
        }

        #pdf-export-root [class*="bg-emerald"],
        #pdf-export-root [class*="bg-green"],
        #pdf-export-root [class*="bg-[#075618]"] {
          background-color: #EAF4EC !important;
        }

        #pdf-export-root [class*="text-emerald"],
        #pdf-export-root [class*="text-green"],
        #pdf-export-root [class*="text-[#075618]"] {
          color: #075618 !important;
        }

        #pdf-export-root [class*="border-emerald"],
        #pdf-export-root [class*="border-green"],
        #pdf-export-root [class*="border-[#E3E8E1]"] {
          border-color: #d1fae5 !important;
        }

        #pdf-export-root [class*="bg-amber"] {
          background-color: #FFFAEB !important;
        }

        #pdf-export-root [class*="text-amber"] {
          color: #B54708 !important;
        }

        #pdf-export-root [class*="border-amber"] {
          border-color: #fef3c7 !important;
        }

        #pdf-export-root [class*="bg-rose"],
        #pdf-export-root [class*="bg-red"] {
          background-color: #FEF3F2 !important;
        }

        #pdf-export-root [class*="text-rose"],
        #pdf-export-root [class*="text-red"] {
          color: #B42318 !important;
        }

        #pdf-export-root [class*="border-rose"],
        #pdf-export-root [class*="border-red"] {
          border-color: #fee2e2 !important;
        }

        #pdf-export-root [class*="bg-slate"] {
          background-color: #F8FAFC !important;
        }

        #pdf-export-root [class*="text-slate"] {
          color: #475569 !important;
        }

        /* Prevenir quebras de páginas */
        #pdf-export-root section,
        #pdf-export-root .rounded-2xl,
        #pdf-export-root .rounded-3xl {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
      `;

      clonedElement.id = "pdf-export-root";

      tempContainer.appendChild(pdfSafeStyle);
      tempContainer.appendChild(clonedElement);
      document.body.appendChild(tempContainer);

      const safeFileName = `Laudo_IA_${record.nomeFerramenta || "IA"}_${record.id || "registro"}`
        .replace(/[^a-zA-Z0-9_-]/g, "_");

      const opt = {
        margin: [0.15, 0.15, 0.15, 0.15],
        filename: `${safeFileName}.pdf`,
        image: {
          type: "jpeg",
          quality: 0.98
        },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
          logging: false,
          scrollX: 0,
          scrollY: 0,
          windowWidth: 794
        },
        jsPDF: {
          unit: "in",
          format: "letter",
          orientation: "portrait"
        },
        pagebreak: {
          mode: ["avoid-all", "css", "legacy"]
        }
      };

      await html2pdfLib().set(opt).from(clonedElement).save();
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      alert("Houve um problema ao gerar o PDF. Como alternativa, clique em 'Imprimir Laudo' e selecione 'Salvar como PDF'.");
    } finally {
      // Re-enable original stylesheets
      disabledStates.forEach(({ sheet, wasDisabled }) => {
        try {
          sheet.disabled = wasDisabled;
        } catch (e) {
          console.warn("Erro ao reabilitar folha de estilo:", e);
        }
      });

      // Remove temporary cleaned stylesheet
      if (tempStyleTag) {
        try {
          tempStyleTag.remove();
        } catch (e) {
          console.warn("Erro ao remover folha de estilo temporária:", e);
        }
      }

      // Remove temporary cloned container
      if (tempContainer) {
        tempContainer.remove();
      }

      setIsDownloadingPdf(false);
    }
  };

  // Dynamic approval workflow helpers
  const workflow = workflows?.find(w => w.iaRecordId === record.id);
  const isWfFinished = !!(workflow && (workflow.finalStatus === "aprovado" || workflow.finalStatus === "negado"));
  const currentStepNum = workflow ? workflow.currentStep : 1;
  const deniedSteps = workflow?.steps?.filter(s => s.status === "negado") || [];

  const getWorkflowSteps = () => {
    if (approvalConfig?.steps && approvalConfig.steps.length > 0) {
      return approvalConfig.steps;
    }
    return [
      { stepNumber: 1, roleName: "Coordenador NIT", isOpinionOnly: false, userId: "", userName: "" },
      { stepNumber: 2, roleName: "Gerente NIT", isOpinionOnly: false, userId: "", userName: "" },
      { stepNumber: 3, roleName: "Gerente TI", isOpinionOnly: false, userId: "", userName: "" },
      { stepNumber: 4, roleName: "Período de Teste", isOpinionOnly: false, userId: "", userName: "" },
      { stepNumber: 5, roleName: "Presidência", isOpinionOnly: false, userId: "", userName: "" },
      { stepNumber: 6, roleName: "Direção Financeira", isOpinionOnly: true, userId: "", userName: "" },
    ];
  };

  const getActiveStepDef = () => {
    return getWorkflowSteps().find(s => s.stepNumber === currentStepNum);
  };

  const getEtapaAtualText = () => {
    if (!workflow) {
      if (record.statusUso === StatusUso.APROVADO) return "Homologado";
      if (record.statusUso === StatusUso.EM_AVALIACAO) return "Triagem Inicial NIT";
      return "Cadastro Concluído";
    }
    if (isWfFinished) {
      return workflow.finalStatus === "aprovado" ? "Homologado (Concluído)" : "Declinado / Não Aprovado";
    }
    const def = getActiveStepDef();
    return def ? `${currentStepNum}. ${def.roleName}` : `Etapa ${currentStepNum}`;
  };

  const getResponsavelAtualText = () => {
    if (!workflow) return record.quemValida || "Comitê de Governança do Laboratório";
    if (isWfFinished) {
      return "Processo Finalizado";
    }
    const wfStep = workflow.steps?.find(s => s.stepNumber === currentStepNum);
    const def = getActiveStepDef();
    return wfStep?.assignedUserName || def?.userName || record.quemValida || "Aguardando definição";
  };

  const getSituacaoFluxoText = () => {
    if (!workflow) {
      if (record.statusUso === StatusUso.EM_AVALIACAO) return "Aguardando parecer da etapa atual";
      return "Cadastro concluído e ativo";
    }
    if (isWfFinished) {
      return workflow.finalStatus === "aprovado" 
        ? "Homologada em produção com auditorias regulares" 
        : "Proposta rejeitada no fluxo regulatório";
    }
    const def = getActiveStepDef();
    return `Aguardando deliberação de ${def?.roleName || "Comitê"}`;
  };

  const getDynamicNextStepText = () => {
    if (!workflow) {
      return getNextStepDescription(record.statusUso);
    }
    if (isWfFinished) {
      return workflow.finalStatus === "aprovado" 
        ? "Processo 100% concluído. Monitoramento das atividades laboratoriais em andamento." 
        : "Processo indeferido pelo comitê. Revisar proposta regulatória.";
    }
    const def = getActiveStepDef();
    return def 
      ? `Próxima ação de aprovação com: "${def.roleName}". Responsável: ${def.userName || "Comitê de Avaliadores"}.` 
      : getNextStepDescription(record.statusUso);
  };

  const toggleEvent = (idx: number) => {
    setExpandedEvents(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const getStatusBgColor = (status: StatusUso) => {
    switch (status) {
      case StatusUso.APROVADO:
        return "bg-emerald-50 text-emerald-800 border-emerald-250";
      case StatusUso.APROVADO_COM_RESTRICOES:
        return "bg-amber-50 text-amber-800 border-amber-250";
      case StatusUso.EM_AVALIACAO:
        return "bg-indigo-50 text-indigo-800 border-indigo-250";
      case StatusUso.EM_TESTE_PILOTO:
        return "bg-cyan-50 text-cyan-850 border-cyan-250";
      case StatusUso.SUSPENSO:
        return "bg-slate-100 text-slate-800 border-slate-200";
      case StatusUso.NAO_APROVADO:
      default:
        return "bg-rose-50 text-rose-800 border-rose-250";
    }
  };

  const getStatusMetadata = (status: StatusUso) => {
    switch (status) {
      case StatusUso.APROVADO:
        return {
          label: "Aprovado",
          sub: "",
          color: "bg-emerald-50/50 text-emerald-800 border-emerald-200/60 shadow-emerald-100/30",
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />,
          dotColor: "bg-emerald-500",
          glowColor: "shadow-emerald-500/10"
        };
      case StatusUso.APROVADO_COM_RESTRICOES:
        return {
          label: "Aprovado com restrições",
          sub: "Autorizado sob condicionantes específicos de monitoramento.",
          color: "bg-amber-50/50 text-amber-800 border-amber-200/60 shadow-amber-100/30",
          icon: <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />,
          dotColor: "bg-amber-500",
          glowColor: "shadow-amber-500/10"
        };
      case StatusUso.EM_AVALIACAO:
        return {
          label: "Em avaliação",
          sub: "Em análise ativa pelo comitê técnico-jurídico multidisciplinar.",
          color: "bg-indigo-50/50 text-indigo-800 border-indigo-200/60 shadow-indigo-100/30",
          icon: <Activity className="w-5 h-5 text-indigo-600 animate-pulse shrink-0" />,
          dotColor: "bg-indigo-500",
          glowColor: "shadow-indigo-500/10"
        };
      case StatusUso.EM_TESTE_PILOTO:
        return {
          label: "Em teste piloto",
          sub: "Fase de experimentação assistida para validações empíricas.",
          color: "bg-cyan-50/50 text-cyan-800 border-cyan-200/60 shadow-cyan-100/30",
          icon: <TrendingUp className="w-5 h-5 text-cyan-600 shrink-0" />,
          dotColor: "bg-cyan-500",
          glowColor: "shadow-cyan-500/10"
        };
      case StatusUso.SUSPENSO:
        return {
          label: "Suspenso",
          sub: "Operação pausada temporariamente para adequação.",
          color: "bg-slate-100/60 text-slate-800 border-slate-200/60 shadow-slate-100/30",
          icon: <AlertTriangle className="w-5 h-5 text-slate-600 shrink-0" />,
          dotColor: "bg-slate-500",
          glowColor: "shadow-slate-500/10"
        };
      case StatusUso.NAO_APROVADO:
      default:
        return {
          label: "Não aprovado",
          sub: "Proposta indeferida por não atender aos requisitos de integridade.",
          color: "bg-rose-50/50 text-rose-800 border-rose-200/60 shadow-rose-100/30",
          icon: <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />,
          dotColor: "bg-rose-500",
          glowColor: "shadow-rose-500/10"
        };
    }
  };

  const getRiskTextColor = (risk: ClassificacaoRisco) => {
    switch (risk) {
      case ClassificacaoRisco.BAIXO:
        return "text-[#075618] font-black";
      case ClassificacaoRisco.MEDIO:
        return "text-[#F59E0B] font-black";
      case ClassificacaoRisco.ALTO:
        return "text-orange-600 font-black";
      case ClassificacaoRisco.CRITICO:
        return "text-[#B42318] font-black";
      default:
        return "text-[#667085] font-black";
    }
  };

  const getNextStepDescription = (status: StatusUso) => {
    switch (status) {
      case StatusUso.EM_AVALIACAO:
        return "Aguardar parecer técnico das comissões multidisciplinares de TI, Inovação e diretrizes do dpo.";
      case StatusUso.APROVADO:
        return "Fluxo regular de monitoramento contínuo nas atividades laboratoriais regulares.";
      case StatusUso.APROVADO_COM_RESTRICOES:
        return "Acompanhar cumprimento de pendências técnicas indicadas no termo do comitê.";
      case StatusUso.EM_TESTE_PILOTO:
        return "Avaliar logs de segurança e métricas de precisão emitidos no ciclo experimental.";
      case StatusUso.SUSPENSO:
        return "Operação retida. Solicitar auditoria extraordinária ou reunião técnica reguladora.";
      case StatusUso.NAO_APROVADO:
      default:
        return "Revisar diretrizes rejeitadas ou reformular cadastro regulatório junto ao NIT.";
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getStatusColor = (status: StatusUso) => {
    switch (status) {
      case StatusUso.APROVADO:
        return "bg-emerald-50 text-emerald-800 border-emerald-200 dot-bg-emerald-500";
      case StatusUso.APROVADO_COM_RESTRICOES:
        return "bg-amber-50 text-amber-800 border-amber-200 dot-bg-amber-500";
      case StatusUso.EM_AVALIACAO:
        return "bg-indigo-50 text-indigo-800 border-indigo-200 dot-bg-indigo-500";
      case StatusUso.EM_TESTE_PILOTO:
        return "bg-cyan-50 text-cyan-800 border-cyan-200 dot-bg-cyan-500";
      case StatusUso.SUSPENSO:
        return "bg-slate-100 text-slate-800 border-slate-200 dot-bg-slate-500";
      case StatusUso.NAO_APROVADO:
      default:
        return "bg-rose-50 text-rose-800 border-rose-200 dot-bg-rose-500";
    }
  };

  const getRiskColor = (risk: ClassificacaoRisco) => {
    switch (risk) {
      case ClassificacaoRisco.BAIXO:
        return "bg-emerald-50 border-emerald-100 text-emerald-700";
      case ClassificacaoRisco.MEDIO:
        return "bg-amber-50 border-amber-100 text-amber-700";
      case ClassificacaoRisco.ALTO:
        return "bg-orange-50 border-orange-100 text-orange-700";
      case ClassificacaoRisco.CRITICO:
        return "bg-rose-50 border-rose-100 text-rose-700";
      default:
        return "bg-slate-50 border-slate-100 text-slate-700";
    }
  };

  // Timeline events fallback
  const getTimelineEvents = () => {
    let timeline: Array<{ date: string; action: string; user?: string; message?: string }> = [];

    if (record.historico && record.historico.length > 0) {
      timeline = [...record.historico];
    } else {
      // Fallback baseline events
      timeline.push({
        date: record.dataRegistro || "01/06/2026",
        action: "Cadastro Inicial da Solução",
        user: record.responsavelPreenchimento,
        message: "O cadastro inicial e autodeclaração de conformidade da IA foi estruturado e submetido para apreciação do NIT."
      });

      if (record.alinhadoLGPD === "Sim") {
        timeline.push({
          date: record.dataRegistro || "01/06/2026",
          action: "Conformidade LGPD Homologada",
          user: "Encarregado de Proteção de Dados (DPO)",
          message: "Conformidade preliminar LGPD homologada perante as salvaguardas regulatórias declaradas."
        });
      }
    }

    // Dynamically append decided workflow steps as history nodes
    if (workflow && workflow.steps) {
      workflow.steps.forEach((step) => {
        if (step.status !== "aguardando" && step.decidedAt) {
          const rawDate = new Date(step.decidedAt);
          const formattedDate = rawDate.toLocaleDateString("pt-BR") + " " + rawDate.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });
          const statusVerb = step.status === "aprovado" ? "APROVADO" : step.status === "negado" ? "REJEITADO" : "OPINADO";
          
          // Deduplicate based on step/stage number
          const alreadyExists = timeline.some((t) => {
            const tAction = t.action || "";
            
            // Extract step number (e.g. from "Etapa 6/6" or "Etapa 6: PRESIDÊNCIA")
            const matchT = tAction.match(/etapa\s*(\d+)/i);
            if (matchT && parseInt(matchT[1], 10) === step.stepNumber) {
              return true;
            }
            
            return tAction.includes(step.roleName) && t.date.includes(rawDate.toLocaleDateString("pt-BR"));
          });
          
          if (!alreadyExists) {
            timeline.push({
              date: formattedDate,
              action: `Etapa ${step.stepNumber}: ${step.roleName} - ${statusVerb}`,
              user: step.assignedUserName || "Decisor do Comitê",
              message: step.comment 
                ? `Parecer técnico registrado pelo relator da etapa: "${step.comment.replace(/###.+/g, "").replace(/•/g, "").trim()}"` 
                : `Fluxo de decisão da etapa técnica concluído com parecer favorável.`
            });
          }
        }
      });
    }

    // Robust date parser for both ISO formats and DD/MM/YYYY HH:MM
    const parseEventDate = (dateStr: string): number => {
      if (!dateStr) return 0;
      if (dateStr.includes("T") || dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) return d.getTime();
      }

      const parts = dateStr.split(" ");
      const datePart = parts[0];
      const timePart = parts[1] || "00:00:00";

      const dParts = datePart.split("/");
      if (dParts.length === 3) {
        const day = parseInt(dParts[0], 10);
        const month = parseInt(dParts[1], 10) - 1;
        const year = parseInt(dParts[2], 10);

        const tParts = timePart.split(":");
        const hours = parseInt(tParts[0] || "0", 10);
        const minutes = parseInt(tParts[1] || "0", 10);
        const seconds = parseInt(tParts[2] || "0", 10);

        const d = new Date(year, month, day, hours, minutes, seconds);
        if (!isNaN(d.getTime())) return d.getTime();
      }

      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    };

    // Sort timeline events in reverse chronological order (newest first)
    timeline.sort((a, b) => parseEventDate(b.date) - parseEventDate(a.date));

    return timeline;
  };

  // Re-use current ReportView layout inside the "relatorio" tab / laudo print view
  const renderFormalReport = () => (
    <div
      id="report-content"
      className="bg-white text-slate-900"
      style={{
        width: "760px",
        minHeight: "980px",
        maxHeight: "980px",
        padding: "28px 32px",
        fontFamily: '"Noto Sans", "Lato", "Arial", sans-serif',
        boxSizing: "border-box",
        overflow: "hidden"
      }}
    >
      {/* CABEÇALHO */}
      <div style={{ borderBottom: "3px solid #075618", paddingBottom: "12px", marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
          <div>
            <img
              src="https://raw.githubusercontent.com/nitlabcedro/assets/refs/heads/main/Ativo%206.png"
              alt="Laboratório Cedro"
              style={{ height: "38px", objectFit: "contain", marginBottom: "10px" }}
              crossOrigin="anonymous"
            />

            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
              <span style={{
                background: "#EAF4EC",
                color: "#075618",
                border: "1px solid #BFD8C5",
                borderRadius: "999px",
                padding: "5px 10px",
                fontSize: "9px",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>
                Laudo de Inteligência Artificial
              </span>

              <span style={{
                background: "#F6F8F5",
                color: "#475569",
                border: "1px solid #CBD5E1",
                borderRadius: "999px",
                padding: "5px 10px",
                fontSize: "9px",
                fontWeight: 800,
                textTransform: "uppercase"
              }}>
                REF: {record.id}
              </span>
            </div>

            <h1 style={{
              fontSize: "28px",
              lineHeight: "30px",
              fontWeight: 900,
              color: "#0F172A",
              margin: 0,
              textTransform: "uppercase"
            }}>
              {record.nomeFerramenta || "Ferramenta de IA"}
            </h1>
          </div>

          <div style={{ textAlign: "right", minWidth: "180px" }}>
            <div style={{
              display: "inline-block",
              border: "1px solid #F59E0B",
              color: "#B54708",
              background: "#FFFAEB",
              borderRadius: "999px",
              padding: "7px 12px",
              fontSize: "9px",
              fontWeight: 900,
              textTransform: "uppercase"
            }}>
              {record.statusUso || "Em avaliação"}
            </div>

            <p style={{
              marginTop: "10px",
              marginBottom: 0,
              fontSize: "9px",
              color: "#64748B",
              fontWeight: 700,
              textTransform: "uppercase"
            }}>
              Gerado em: {new Date().toLocaleDateString("pt-BR")}
            </p>
          </div>
        </div>
      </div>

      {/* RESUMO PRINCIPAL */}
      {(() => {
        const summaryItems = [
          { label: "Setor", value: record.unidadeSetor || "Não informado" },
          { label: "Fornecedor", value: record.fornecedor || "Não informado" },
          { label: "Responsável", value: record.responsavelPreenchimento || "Não informado" }
        ].filter(item => !(item.label === "Fornecedor" && item.value.toLowerCase() === "interno"));

        return (
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${summaryItems.length}, 1fr)`,
            gap: "10px",
            marginBottom: "20px"
          }}>
            {summaryItems.map((item, index) => (
              <div
                key={index}
                style={{
                  border: "1px solid #D9E5DC",
                  background: "#F6F8F5",
                  borderRadius: "10px",
                  padding: "10px 12px",
                  minHeight: "50px"
                }}
              >
                <div style={{
                  fontSize: "7.5px",
                  fontWeight: 900,
                  color: "#64748B",
                  textTransform: "uppercase",
                  letterSpacing: "0.4px",
                  marginBottom: "4px"
                }}>
                  {item.label}
                </div>
                <div style={{
                  fontSize: "10px",
                  fontWeight: 900,
                  color: "#0F172A",
                  textTransform: "uppercase",
                  lineHeight: "12px"
                }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* BLOCO 1 */}
      <section style={{ marginBottom: "20px" }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          borderBottom: "1px solid #E2E8F0",
          paddingBottom: "8px",
          marginBottom: "12px"
        }}>
          <span style={{
            background: "#EAF4EC",
            color: "#075618",
            border: "1px solid #BFD8C5",
            borderRadius: "6px",
            padding: "3px 7px",
            fontSize: "8px",
            fontWeight: 900
          }}>
            01
          </span>
          <h2 style={{
            margin: 0,
            fontSize: "10px",
            fontWeight: 900,
            color: "#334155",
            textTransform: "uppercase",
            letterSpacing: "0.8px"
          }}>
            Identificação e propósito
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "16px" }}>
          <div>
            <p style={{
              margin: "0 0 5px 0",
              fontSize: "8px",
              fontWeight: 900,
              color: "#64748B",
              textTransform: "uppercase"
            }}>
              Descrição da atividade
            </p>
            <div style={{
              border: "1px solid #E2E8F0",
              background: "#FFFFFF",
              borderRadius: "10px",
              padding: "11px 12px",
              minHeight: "70px",
              fontSize: "10px",
              lineHeight: "14px",
              color: "#334155",
              fontWeight: 600
            }}>
              {record.descricaoAtividade || "Não informado."}
            </div>
          </div>

          <div>
            <p style={{
              margin: "0 0 5px 0",
              fontSize: "8px",
              fontWeight: 900,
              color: "#64748B",
              textTransform: "uppercase"
            }}>
              Objetivos estratégicos
            </p>
            <div style={{
              border: "1px solid #E2E8F0",
              background: "#FFFFFF",
              borderRadius: "10px",
              padding: "11px 12px",
              minHeight: "70px",
              fontSize: "10px",
              lineHeight: "14px",
              color: "#334155",
              fontWeight: 700
            }}>
              {record.objetivos?.join(", ") || "Não informado."}
            </div>
          </div>
        </div>

        <div style={{ marginTop: "12px" }}>
          <p style={{
            margin: "0 0 6px 0",
            fontSize: "8px",
            fontWeight: 900,
            color: "#64748B",
            textTransform: "uppercase"
          }}>
            Categorias de IA associadas
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {(record.tipoIA && record.tipoIA.length > 0 ? record.tipoIA : ["Não informado"]).map((tipo, index) => (
              <span
                key={index}
                style={{
                  border: "1px solid #BFD8C5",
                  background: "#EAF4EC",
                  color: "#075618",
                  borderRadius: "999px",
                  padding: "6px 11px",
                  fontSize: "8px",
                  fontWeight: 900,
                  textTransform: "uppercase"
                }}
              >
                {tipo}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* BLOCO 2 */}
      {isAdmin && (
        <section style={{ marginBottom: "20px" }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            borderBottom: "1px solid #E2E8F0",
            paddingBottom: "8px",
            marginBottom: "12px"
          }}>
            <span style={{
              background: "#FFFAEB",
              color: "#B54708",
              border: "1px solid #FEDF89",
              borderRadius: "6px",
              padding: "3px 7px",
              fontSize: "8px",
              fontWeight: 900
            }}>
              02
            </span>
            <h2 style={{
              margin: 0,
              fontSize: "10px",
              fontWeight: 900,
              color: "#334155",
              textTransform: "uppercase",
              letterSpacing: "0.8px"
            }}>
              Privacidade e proteção de dados
            </h2>
          </div>

          <div style={{
            border: "1px solid #D9E5DC",
            borderRadius: "12px",
            background: "#F8FAFC",
            padding: "14px",
            display: "grid",
            gridTemplateColumns: "0.8fr 1.2fr",
            gap: "16px"
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div>
                <p style={{ margin: 0, fontSize: "7.5px", color: "#64748B", fontWeight: 900, textTransform: "uppercase" }}>
                  Dados pessoais
                </p>
                <p style={{ margin: "5px 0 0 0", fontSize: "12px", color: "#0F172A", fontWeight: 900, textTransform: "uppercase" }}>
                  {record.usaDadosPessoais || "Não"}
                </p>
              </div>

              <div>
                <p style={{ margin: 0, fontSize: "7.5px", color: "#64748B", fontWeight: 900, textTransform: "uppercase" }}>
                  Alinhamento LGPD
                </p>
                <p style={{ margin: "5px 0 0 0", fontSize: "12px", color: record.alinhadoLGPD === "Sim" ? "#075618" : "#B54708", fontWeight: 900, textTransform: "uppercase" }}>
                  {record.alinhadoLGPD || "Em avaliação"}
                </p>
              </div>
            </div>

            <div>
              <p style={{ margin: 0, fontSize: "7.5px", color: "#64748B", fontWeight: 900, textTransform: "uppercase" }}>
                Categorias de dados coletados
              </p>
              <p style={{
                margin: "5px 0 0 0",
                fontSize: "10px",
                lineHeight: "14px",
                color: "#334155",
                fontWeight: 700
              }}>
                {record.quaisDados || "Nenhuma categoria de dados foi detalhada."}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* BLOCO 3 */}
      {isAdmin && (
        <section style={{ marginBottom: "20px" }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            borderBottom: "1px solid #E2E8F0",
            paddingBottom: "8px",
            marginBottom: "12px"
          }}>
            <span style={{
              background: "#EAF4EC",
              color: "#075618",
              border: "1px solid #BFD8C5",
              borderRadius: "6px",
              padding: "3px 7px",
              fontSize: "8px",
              fontWeight: 900
            }}>
              03
            </span>
            <h2 style={{
              margin: 0,
              fontSize: "10px",
              fontWeight: 900,
              color: "#334155",
              textTransform: "uppercase",
              letterSpacing: "0.8px"
            }}>
              Governança e controles de risco
            </h2>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "12px"
          }}>
            <div style={{
              border: "1px solid #E2E8F0",
              borderRadius: "12px",
              padding: "13px 12px",
              background: "#FFFFFF"
            }}>
              <p style={{ margin: 0, fontSize: "7.5px", color: "#64748B", fontWeight: 900, textTransform: "uppercase" }}>
                Supervisão humana
              </p>
              <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: record.validacaoHumana === "Sim" ? "#075618" : "#B42318", fontWeight: 900, textTransform: "uppercase" }}>
                {record.validacaoHumana === "Sim" ? "Operação assistida" : "Não informada"}
              </p>
              <p style={{ margin: "5px 0 0 0", fontSize: "8.5px", color: "#64748B", fontWeight: 700 }}>
                {record.quemValida || "Responsável não informado"}
              </p>
            </div>

            <div style={{
              border: "1px solid #E2E8F0",
              borderRadius: "12px",
              padding: "13px 12px",
              background: "#FFFFFF"
            }}>
              <p style={{ margin: 0, fontSize: "7.5px", color: "#64748B", fontWeight: 900, textTransform: "uppercase" }}>
                Risco residual
              </p>
              <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#075618", fontWeight: 900, textTransform: "uppercase" }}>
                {record.riscoResidual || "Não avaliado"}
              </p>
            </div>

            <div style={{
              border: "1px solid #E2E8F0",
              borderRadius: "12px",
              padding: "13px 12px",
              background: "#FFFFFF"
            }}>
              <p style={{ margin: 0, fontSize: "7.5px", color: "#64748B", fontWeight: 900, textTransform: "uppercase" }}>
                Riscos identificados
              </p>
              <p style={{ margin: "6px 0 0 0", fontSize: "10px", lineHeight: "13px", color: "#334155", fontWeight: 700 }}>
                {record.quaisRiscos || "Nenhum risco registrado."}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ASSINATURAS */}
      <section style={{
        marginTop: "22px",
        border: "1px solid #D9E5DC",
        borderRadius: "12px",
        background: "#F6F8F5",
        padding: "16px"
      }}>
        <p style={{
          margin: "0 0 16px 0",
          fontSize: "8px",
          color: "#64748B",
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: "0.6px"
        }}>
          Assinaturas
        </p>

        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "24px",
          justifyContent: "flex-start"
        }}>
          {workflow?.steps
            ?.filter((step) => step.status !== "aguardando" && step.decidedAt)
            .map((step) => {
              const rawDate = step.decidedAt ? new Date(step.decidedAt) : new Date();
              const formattedDate = rawDate.toLocaleDateString("pt-BR");
              const isNegado = step.status === "negado";
              
              const statusLabel = isNegado 
                ? `INDEFERIDO EM ${formattedDate}` 
                : (step.status === "opiniao" ? `PARECER EM ${formattedDate}` : `APROVADO EM ${formattedDate}`);
              
              const borderTopColor = isNegado ? "#EF4444" : "#94A3B8";
              const roleColor = isNegado ? "#DC2626" : "#075618";
              const statusColor = isNegado ? "#DC2626" : "#64748B";

              return (
                <div key={step.stepNumber} style={{ borderTop: `1px solid ${borderTopColor}`, paddingTop: "12px", textAlign: "center", flex: "1 1 160px", maxWidth: "240px" }}>
                  <p style={{ margin: 0, fontSize: "9px", fontWeight: 900, color: "#0F172A", textTransform: "uppercase" }}>
                    {step.assignedUserName || "Comitê autorizado"}
                  </p>
                  <p style={{ margin: "4px 0 0 0", fontSize: "7.5px", fontWeight: 900, color: roleColor, textTransform: "uppercase" }}>
                    {step.roleName}
                  </p>
                  <p style={{ margin: "4px 0 0 0", fontSize: "7.5px", fontWeight: 900, color: statusColor, textTransform: "uppercase" }}>
                    {statusLabel}
                  </p>
                </div>
              );
            })}
        </div>
      </section>

      {/* RODAPÉ */}
      <div style={{
        marginTop: "18px",
        paddingTop: "10px",
        borderTop: "1px solid #E2E8F0",
        textAlign: "center"
      }}>
        <p style={{
          margin: 0,
          fontSize: "7.5px",
          color: "#64748B",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.5px"
        }}>
          Sistema de Governança Integrado — REF: {record.id} — Cedro IA — Laboratório Cedro
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-10 pb-24 max-w-7xl mx-auto px-4 sm:px-0 bg-[#F6F8F5]/30">
      {/* 1. Cabeçalho da IA */}
      <div className="flex flex-col gap-6 border-b border-[#E3E8E1] pb-8 print:hidden">
        {/* Back Link */}
        <div>
          <button 
            onClick={onBack} 
            className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-[#075618] transition-all uppercase tracking-wider group cursor-pointer"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
            Voltar ao Inventário
          </button>
        </div>

        {/* Title, Badge status y acciones */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="space-y-3 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight uppercase leading-none truncate pr-2">
                {record.nomeFerramenta}
              </h1>
              {/* Status Badge */}
              <div className={`px-3 py-1 bg-white border text-[10px] font-black uppercase tracking-tight rounded-full flex items-center gap-1.5 shadow-3xs shrink-0 ${getStatusColor(record.statusUso)}`}>
                <div className={`size-1.5 rounded-full ${getStatusColor(record.statusUso).split(" ").pop()}`} />
                <span>{record.statusUso}</span>
              </div>
            </div>

          </div>

          {/* Action Buttons Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            {onEdit && (
              <button
                onClick={() => onEdit(record)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4.5 py-3 bg-white border border-[#E3E8E1] hover:border-[#075618] hover:text-[#075618] text-slate-700 text-xs font-black uppercase rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                <Edit size={14} />
                Editar cadastro
              </button>
            )}

            {record.statusUso === StatusUso.EM_AVALIACAO && (
              <div className="flex-1 sm:flex-none flex items-center gap-2.5 px-4.5 py-3 bg-indigo-50/60 border border-indigo-100 text-indigo-800 text-xs font-bold uppercase rounded-xl shadow-sm">
                <Activity size={14} className="animate-pulse flex-shrink-0" />
                <span>Em Aprovação</span>
              </div>
            )}




          </div>
        </div>
      </div>

      {/* Justificativa de Indeferimento */}
      {(record.statusUso === StatusUso.NAO_APROVADO || deniedSteps.length > 0) && (
        <section className="rounded-2xl border border-rose-200 bg-rose-50/40 p-6 lg:p-8 space-y-6 print:hidden shadow-sm relative overflow-hidden animate-fade-in">
          {/* Top highlight bar */}
          <div className="absolute top-0 left-0 right-0 h-[4px] bg-rose-600" />
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-100 rounded-xl text-rose-700 shrink-0 shadow-3xs">
                <ShieldAlert size={22} className="shrink-0" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-rose-700">
                  Parecer Técnico de Indeferimento / Não Conformidade
                </p>
                <h2 className="mt-1 text-lg font-black text-rose-950">
                  Justificativa de Indeferimento da Proposta
                </h2>
              </div>
            </div>
            <div className="px-3.5 py-1 text-[10px] font-black text-rose-900 bg-rose-100 rounded-full border border-rose-200/50 uppercase tracking-widest self-start sm:self-auto shadow-2xs">
              Recusada pelas Instâncias de Governança
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {deniedSteps.length > 0 ? (
              deniedSteps.map((step, sIdx) => (
                <div key={sIdx} className="bg-white border border-rose-100 p-5 rounded-2xl shadow-3xs hover:border-rose-300/40 transition-all">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-rose-50 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="size-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] font-bold shadow-3xs">
                        ✗
                      </span>
                      <h4 className="text-xs sm:text-sm font-extrabold uppercase text-rose-950">
                        Etapa {step.stepNumber}: {step.roleName}
                      </h4>
                    </div>
                    {step.decidedAt && (
                      <span className="text-[9.5px] font-bold text-slate-400">
                        Decidido em: {new Date(step.decidedAt).toLocaleString("pt-BR")}
                      </span>
                    )}
                  </div>

                  <div className="space-y-3 mt-4">
                    <div className="p-4 bg-rose-50/25 rounded-xl border border-dashed border-rose-100/60">
                      <div className="flex flex-wrap items-center justify-between gap-2.5 mb-2.5">
                        <span className="text-[9px] font-black uppercase text-rose-600 tracking-wider">Avaliador Responsável</span>
                        <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{step.assignedUserName || "Não identificado"}</span>
                      </div>
                      
                      <div className="space-y-1.5 mt-3 pt-2.5 border-t border-rose-100/40">
                        <span className="text-[9.5px] font-black uppercase text-rose-900 tracking-widest block mb-1">Fundamentação Técnica e Justificativa da Recusa</span>
                        <div className="space-y-2 text-slate-700">
                          {formatComment(step.comment)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white border border-rose-100 p-6 rounded-2xl shadow-3xs">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <h4 className="text-xs sm:text-sm font-extrabold uppercase text-rose-950">Parecer Final Consolidado</h4>
                    <p className="text-xs font-bold text-slate-700 leading-relaxed">
                      {record.parecerTecnico || "Este projeto foi indeferido na triagem inicial ou pelo comitê central de governança."}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 2. Resumo executivo */}
      <section className="rounded-2xl border border-[#E3E8E1] bg-[#F6F8F5] p-6 lg:p-8 space-y-6 print:hidden">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#075618]">
              Resumo executivo
            </p>
            <h2 className="mt-1 text-lg font-black text-[#003F1D]">
              Visão rápida da solicitação
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Finalidade da IA */}
          <div className="bg-white border border-[#E3E8E1] p-5 rounded-2xl flex flex-col justify-between shadow-3xs hover:border-[#075618]/30 transition-all">
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-[#075618] uppercase tracking-widest block">Finalidade da IA</span>
              <p className="text-xs text-slate-700 font-bold leading-relaxed line-clamp-4">
                {record.descricaoAtividade || "Nenhuma descrição de atividade registrada."}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-[#667085]">
              <span>Setor: {record.unidadeSetor}</span>
              <span className="text-[9px] font-black uppercase text-[#075618] bg-[#EAF4EC] px-2 py-0.5 rounded">Ativa</span>
            </div>
          </div>

          {/* Card 2: Status da Avaliação */}
          <div className="bg-white border border-[#E3E8E1] p-5 rounded-2xl flex flex-col justify-between shadow-3xs hover:border-[#075618]/30 transition-all relative overflow-hidden">
            {/* Top decorative gradient line linked to status */}
            <div className={`absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-current to-transparent opacity-40 ${
              record.statusUso === StatusUso.APROVADO ? "text-emerald-500" :
              record.statusUso === StatusUso.APROVADO_COM_RESTRICOES ? "text-amber-500" :
              record.statusUso === StatusUso.EM_AVALIACAO ? "text-indigo-500" :
              record.statusUso === StatusUso.EM_TESTE_PILOTO ? "text-cyan-500" :
              record.statusUso === StatusUso.SUSPENSO ? "text-slate-500" :
              "text-rose-500"
            }`} />

            <div className="space-y-4 flex-1 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#075618] uppercase tracking-widest block">Status da Avaliação</span>
                <span className="flex h-2 w-2 relative">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${getStatusMetadata(record.statusUso).dotColor}`} />
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${getStatusMetadata(record.statusUso).dotColor}`} />
                </span>
              </div>

              <div className={`flex-1 flex flex-col justify-center items-center py-5 px-4 rounded-xl border border-solid transition-all duration-300 ${getStatusMetadata(record.statusUso).color}`}>
                <div className="flex items-center gap-2 mb-2">
                  {getStatusMetadata(record.statusUso).icon}
                  <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-center leading-tight">
                    {record.statusUso}
                  </span>
                </div>
                {getStatusMetadata(record.statusUso).sub && (
                  <p className="text-[10px] font-semibold text-slate-550 text-center leading-normal max-w-[210px] opacity-90">
                    {getStatusMetadata(record.statusUso).sub}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Situação atual da aprovação */}
      <section className="rounded-2xl border border-[#E3E8E1] bg-white p-6 lg:p-8 space-y-6 print:hidden">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#075618]">
            Situação da aprovação
          </p>
          <h2 className="mt-1 text-lg font-black text-[#003F1D]">
            Etapas de aprovação
          </h2>
        </div>



        {/* Dynamic Stepper */}
        <div className="pt-2">
          {workflow && workflow.steps && workflow.steps.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {[...workflow.steps].sort((a, b) => a.stepNumber - b.stepNumber).map((step) => {
                const isFailed = step.status === "negado";
                const isPassed = step.status === "aprovado" || step.status === "opiniao";
                const isCurrent = step.stepNumber === currentStepNum && !isWfFinished;
                const isAwaiting = !isPassed && !isFailed && !isCurrent;
                
                const signerName = step.assignedUserName || "Aprovação livre";
                
                return (
                  <div 
                    key={step.stepNumber} 
                    className={`border p-4 flex flex-col justify-between transition-all rounded-2xl shadow-3xs hover:shadow-xs min-h-[140px] ${
                      isPassed 
                        ? "bg-[#EAF4EC]/65 border-[#EBF5EC] text-[#075618]" 
                        : isFailed 
                          ? "bg-rose-50 border-rose-200 text-rose-900" 
                          : isCurrent 
                            ? "bg-amber-50/70 border-amber-300 text-amber-900 ring-2 ring-amber-100 ring-offset-1 animate-fade-in" 
                            : "bg-slate-50/50 border-[#E3E8E1] text-slate-400"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`size-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                          isPassed 
                            ? "bg-[#075618] text-white" 
                            : isFailed 
                              ? "bg-[#B42318] text-white" 
                              : isCurrent 
                                ? "bg-[#F59E0B] text-white animate-pulse" 
                                : "bg-slate-200 text-slate-500"
                        }`}>
                          {isPassed ? "✓" : isFailed ? "✗" : step.stepNumber}
                        </div>
                        <span className={`text-[9.5px] font-black uppercase tracking-widest ${
                          isPassed ? "text-[#075618]" : isFailed ? "text-rose-800" : isCurrent ? "text-amber-800" : "text-slate-400"
                        }`}>
                          Etapa {step.stepNumber}
                        </span>
                      </div>
                      
                      <p className={`text-[11.5px] font-extrabold uppercase line-clamp-1 ${isCurrent ? "text-slate-900 font-black" : isAwaiting ? "text-slate-400" : "text-slate-800"}`}>
                        {step.roleName}
                      </p>
                    </div>

                    <div className="mt-4">
                      
                      <div className="pt-2 border-t border-slate-100/60 text-[10px] leading-relaxed">
                        <span className="text-slate-400 font-bold block uppercase text-[8px] tracking-wide">Responsável</span>
                        <span className={`font-black uppercase truncate block text-[10.5px] ${isCurrent ? "text-[#003F1D]" : isAwaiting ? "text-slate-400 font-medium" : "text-slate-700"}`}>
                          {signerName}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-1 relative">
              {/* Step 1: Cadastro */}
              <div className="bg-[#EAF4EC]/60 border border-[#E3E8E1] p-4.5 rounded-2xl flex flex-col justify-between">
                <div className="flex items-center gap-2 mb-2">
                  <div className="size-5 rounded-full bg-[#075618] text-white flex items-center justify-center text-[9px] font-bold">
                    ✓
                  </div>
                  <span className="text-[9px] font-black uppercase text-[#075618] tracking-widest">1. Triagem</span>
                </div>
                <p className="text-xs font-bold text-[#003F1D]">Cadastro do Projeto</p>
                <p className="text-[10px] text-slate-500 mt-1.5 leading-normal">Cadastro inicial e autoenquadramento efetuados.</p>
              </div>
 
              {/* Step 2: Análise NIT */}
              <div className={`border p-4.5 rounded-2xl flex flex-col justify-between ${
                record.statusUso !== StatusUso.EM_AVALIACAO 
                  ? "bg-[#EAF4EC]/60 border-[#E3E8E1] text-[#075618]" 
                  : "bg-amber-50/50 border-amber-200 text-amber-900"
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`size-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                    record.statusUso !== StatusUso.EM_AVALIACAO 
                      ? "bg-[#075618] text-white" 
                      : "bg-[#F59E0B] text-white animate-pulse"
                  }`}>
                    {record.statusUso !== StatusUso.EM_AVALIACAO ? "✓" : "2"}
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest">2. Parecer NIT</span>
                </div>
                <p className="text-xs font-bold text-slate-800">Análise de Viabilidade</p>
                <p className="text-[10px] text-slate-500 mt-1.5 leading-normal">
                  {record.statusUso !== StatusUso.EM_AVALIACAO 
                    ? "Concluído com parecer de viabilidade." 
                    : "Aguardando homologação do colegiado NIT."}
                </p>
              </div>
 
              {/* Step 3: LGPD */}
              <div className={`border p-4.5 rounded-2xl flex flex-col justify-between ${
                record.alinhadoLGPD === 'Sim' 
                  ? "bg-[#EAF4EC]/60 border-[#E3E8E1]" 
                  : record.alinhadoLGPD === 'Em avaliação'
                    ? "bg-amber-50/50 border-amber-200 text-amber-900"
                    : "bg-slate-50/60 border-[#E3E8E1]"
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`size-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                    record.alinhadoLGPD === 'Sim' 
                      ? "bg-[#075618] text-white" 
                      : record.alinhadoLGPD === 'Em avaliação'
                        ? "bg-[#F59E0B] text-white"
                        : "bg-slate-300 text-slate-600"
                  }`}>
                    {record.alinhadoLGPD === 'Sim' ? "✓" : "3"}
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest">3. Segurança & LGPD</span>
                </div>
                <p className="text-xs font-bold text-slate-800">Avaliação DPO</p>
                <p className="text-[10px] text-slate-500 mt-1.5 leading-normal">
                  {record.alinhadoLGPD === 'Sim'
                    ? "Conformidade e bases legais atestadas pelo DPO."
                    : record.alinhadoLGPD === 'Não'
                      ? "Ajustes de segurança recomendados."
                      : "Diligências e mapeamento de dados de pacientes."}
                </p>
              </div>
 
              {/* Step 4: Homologação */}
              <div className={`border p-4.5 rounded-2xl flex flex-col justify-between ${
                record.statusUso === StatusUso.APROVADO || record.statusUso === StatusUso.APROVADO_COM_RESTRICOES
                  ? "bg-[#EAF4EC]/60 border-[#E3E8E1]"
                  : record.statusUso === StatusUso.NAO_APROVADO
                    ? "bg-rose-50 border-rose-220 text-rose-905"
                    : "bg-slate-50/60 border-[#E3E8E1]"
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`size-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                    record.statusUso === StatusUso.APROVADO || record.statusUso === StatusUso.APROVADO_COM_RESTRICOES
                      ? "bg-[#075618] text-white"
                      : record.statusUso === StatusUso.NAO_APROVADO
                        ? "bg-[#B42318] text-white"
                        : "bg-slate-300 text-slate-600"
                  }`}>
                    {(record.statusUso === StatusUso.APROVADO || record.statusUso === StatusUso.APROVADO_COM_RESTRICOES) ? "✓" : "4"}
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest">4. Homologação</span>
                </div>
                <p className="text-xs font-bold text-slate-800">Autorização Final</p>
                <p className="text-[10px] text-slate-500 mt-1.5 leading-normal">
                  {record.statusUso === StatusUso.APROVADO 
                    ? "Solução homologada para uso ativo no Laboratório."
                    : record.statusUso === StatusUso.APROVADO_COM_RESTRICOES
                      ? "Homologada com restrições técnicas."
                      : record.statusUso === StatusUso.NAO_APROVADO
                        ? "Projeto declinado pelo comitê colegiado."
                        : "Aguardando parecer final das etapas."}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>



      {/* 5. Navegação por Abas - hidden on print */}
      <div className="flex border-b border-slate-200 overflow-x-auto print:hidden gap-1 select-none custom-scrollbar pb-px">
        {[
          { id: "visao-geral", label: "Resumo", icon: Info },
          { id: "finalidade-uso", label: "Uso da IA", icon: Target },
          { id: "dados-utilizados", label: "Dados tratados", icon: Database },
          { id: "riscos-controles", label: "Riscos", icon: ShieldAlert },
          { id: "historico", label: "Histórico", icon: History },
          { id: "relatorio", label: "Relatório", icon: FileText },
        ].filter(tab => isAdmin || (tab.id !== "dados-utilizados" && tab.id !== "riscos-controles")).map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-1.5 px-5 py-3.5 border-b-2 text-xs font-black uppercase tracking-tight whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? "border-[#075618] text-[#075618] bg-[#EAF4EC]/30 font-black"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200"
              }`}
            >
              <tab.icon size={14} className={isActive ? "text-[#075618]" : "text-slate-400"} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* 6. Conteúdo Dinâmico das Abas */}
      <div className="bg-white border border-[#E3E8E1] rounded-3xl p-6 md:p-8 shadow-sm">
        
        {/* TAB 1: RESUMO / VISÃO GERAL */}
        {activeTab === "visao-geral" && (
          <div className="space-y-8 animate-fade-in text-slate-700">
            <div className="border-b border-[#E3E8E1] pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-black text-[#003F1D] uppercase tracking-widest flex items-center gap-2">
                  <Info size={16} className="text-[#075618]" />
                  Resumo da Ficha Técnica
                </h3>
              </div>
              <div className="bg-[#EAF4EC]/50 border border-emerald-100 px-3 py-1.5 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase text-[#075618] shadow-3xs self-start md:self-auto">
                <span>Avaliador: Coordenador NIT (Etapa 1)</span>
              </div>
            </div>

            <div className={`grid grid-cols-1 ${isAdmin ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-6`}>
              {/* Card 1 — O que é esta IA? */}
              <div className="bg-[#F6F8F5]/40 border border-[#E3E8E1] p-6 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <span className="p-1 px-2.5 bg-[#EAF4EC] text-[#075618] text-[9px] font-black rounded-lg">Identidade</span>
                  <h4 className="text-[11px] font-black uppercase tracking-widest text-[#003F1D]">O que é esta IA?</h4>
                </div>
                <div className="space-y-3.5 text-xs">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Nome da Ferramenta</span>
                    <p className="font-extrabold text-[#1F2933] text-sm uppercase">{record.nomeFerramenta || "Não informado"}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Descrição da Atividade</span>
                    <p className="font-semibold text-slate-650 leading-relaxed text-[12.5px]">
                      {record.descricaoAtividade || "Não informada"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Tipo de Inteligência Artificial</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {record.tipoIA && record.tipoIA.length > 0 ? (
                        record.tipoIA.map((t, idx) => (
                          <span key={idx} className="px-2.5 py-1 bg-white border border-[#E3E8E1] text-[10px] font-bold text-[#003F1D] uppercase rounded-md shadow-3xs">
                            {t}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400 italic font-semibold">Não informado</span>
                      )}
                    </div>
                  </div>
                  {record.fornecedor && record.fornecedor.toLowerCase() !== "interno" && (
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Fornecedor da Solução</span>
                      <p className="font-extrabold text-slate-800 uppercase">{record.fornecedor}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 2 — Quem solicitou? */}
              <div className="bg-[#F6F8F5]/40 border border-[#E3E8E1] p-6 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <span className="p-1 px-2.5 bg-[#EAF4EC] text-[#075618] text-[9px] font-black rounded-lg">Ficha Solicitante</span>
                  <h4 className="text-[11px] font-black uppercase tracking-widest text-[#003F1D]">Quem solicitou?</h4>
                </div>
                <div className="space-y-3.5 text-xs font-semibold">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Setor Requisitante</span>
                    <p className="font-extrabold text-[#003F1D] text-sm uppercase">{record.unidadeSetor || "Não informado"}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Responsável Técnico</span>
                    <p className="font-extrabold text-[#1F2933] uppercase">{record.responsavelPreenchimento || "Não informado"}</p>
                    <p className="text-[10px] text-[#667085] mt-0.5">{record.cargo || "Função não especificada"}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Data de Cadastro</span>
                    <p className="font-extrabold text-slate-800 uppercase">{record.dataRegistro || "Não informada"}</p>
                  </div>
                </div>
              </div>

              {/* Card 3 — Classificação inicial */}
              {isAdmin && (
                <div className="bg-[#F6F8F5]/40 border border-[#E3E8E1] p-6 rounded-2xl space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <span className="p-1 px-2.5 bg-[#EAF4EC] text-[#075618] text-[9px] font-black rounded-lg">Classificação</span>
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-[#003F1D]">Classificação Inicial</h4>
                  </div>
                  <div className="space-y-3.5 text-xs font-semibold text-slate-800">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Nível de Criticidade</span>
                      <span className={`px-2.5 py-1 text-[10px] font-black uppercase border rounded-md shadow-3xs ${getRiskColor(record.criticidade as unknown as ClassificacaoRisco)}`}>
                        {record.criticidade || "MÉDIO"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Autonomia Operacional</span>
                      <p className="font-extrabold text-slate-800 uppercase">{record.grauAutonomia || "Não avaliado"}</p>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Público Impactado</span>
                      <p className="font-extrabold text-slate-800 uppercase">
                        {record.naturezaUso === "Assistencial" || record.naturezaUso === "Diagnóstico" ? "Pacientes e Corpo Assistencial" : "Processos de Negócios / Interno"}
                      </p>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Status de Produção</span>
                      <span className={`px-2.5 py-1 text-[10px] font-black uppercase border rounded-md ${getStatusBgColor(record.statusUso)}`}>
                        {record.statusUso}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Observações e Documentação do Solicitante */}
            <div className="bg-[#EAF4EC]/10 border border-teal-100/60 p-6 rounded-2xl space-y-4">
              <h4 className="text-[11px] font-black uppercase tracking-widest text-[#003F1D] border-b border-teal-150/40 pb-2 flex items-center gap-2">
                <FileText size={14} className="text-[#075618]" />
                Observações e Anexos do Solicitante
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-semibold">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Observações Gerais</span>
                  <p className="font-semibold text-slate-650 leading-relaxed italic bg-white p-3 rounded-xl border border-slate-150">
                    {record.observacoesGerais && record.observacoesGerais.trim() !== "" ? `"${record.observacoesGerais}"` : "Nenhuma observação geral registrada."}
                  </p>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Referências, Links ou Arquivos do Usuário</span>
                  <div className="space-y-3">
                    {record.anexos && record.anexos.trim() !== "" ? (
                      <p className="font-semibold text-slate-650 leading-relaxed bg-white p-3 rounded-xl border border-slate-150">
                        {record.anexos}
                      </p>
                    ) : null}
                    {record.documentoNome ? (
                      <div className="flex items-center justify-between bg-emerald-50/50 border border-[#075618]/20 p-3.5 rounded-xl shadow-3xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-xl shrink-0">📎</span>
                          <div className="min-w-0">
                            <p className="text-[11px] font-black text-[#003F1D] truncate leading-none uppercase" title={record.documentoNome}>
                              {record.documentoNome}
                            </p>
                            <p className="text-[9px] text-[#667085] mt-1 font-mono">
                              {record.documentoTamanho ? `${(record.documentoTamanho / 1024).toFixed(1)} KB` : ""} • {record.documentoTipo || "Documento"}
                            </p>
                          </div>
                        </div>
                        {record.documentoUrl && (
                          <a 
                            href={record.documentoUrl} 
                            download={record.documentoNome}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-[#075618] hover:bg-[#05340e] text-white text-[10px] font-bold px-3 py-1.5 rounded-lg ml-3 uppercase select-none transition-all cursor-pointer whitespace-nowrap"
                          >
                            Baixar
                          </a>
                        )}
                      </div>
                    ) : (
                      <p className="font-semibold text-slate-400 italic bg-slate-50/55 p-3 rounded-xl border border-slate-150">
                        Nenhum arquivo físico anexado.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: FINALIDADE E USO */}
        {activeTab === "finalidade-uso" && (
          <div className="space-y-8 animate-fade-in text-slate-700">
            <div className="border-b border-[#E3E8E1] pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <Target size={16} className="text-[#075618]" />
                  Finalidade e Fluxo de Uso
                </h3>
              </div>
              <div className="bg-[#EAF4EC]/50 border border-emerald-100 px-3 py-1.5 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase text-[#075618] shadow-3xs self-start md:self-auto">
                <span>Avaliador: Período de Teste (Etapa 4)</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Processos e Objetivos */}
              <div className="space-y-6">
                <div className="bg-slate-50 border border-slate-200/60 p-6 rounded-2xl space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-[#075618]">Objetivos Mapeados</h4>
                  <div className="space-y-3">
                    {record.objetivos && record.objetivos.length > 0 ? (
                      record.objetivos.map((obj, i) => (
                        <div key={i} className="flex items-center gap-2.5 text-xs font-semibold uppercase text-slate-700">
                          <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" />
                          <span>{obj}</span>
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic">Nenhum</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Benefícios e Decisão */}
              <div className="space-y-6">
                <div className="bg-[#075618]/5 border border-emerald-100/60 p-6 rounded-2xl">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-[#075618] mb-2">Benefícios</h4>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-semibold italic">
                    "{record.beneficiosEsperados || "Nenhum benefício foi autodeclarado."}"
                  </p>
                </div>

                {isAdmin && (
                  <div className="bg-slate-50 border border-slate-200/60 p-6 rounded-2xl space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200 pb-2">Governança nos Resultados</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Impacto em Laudos Clínicos</span>
                        <p className={`text-xs font-extrabold uppercase ${record.impactoResultadosLaboratoriais === "Sim" ? "text-rose-700" : "text-slate-500"}`}>{record.impactoResultadosLaboratoriais || "Não"}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Validação Humana Ativa</span>
                        <p className={`text-xs font-extrabold uppercase ${record.validacaoHumana === "Sim" ? "text-[#075618]" : "text-rose-700"}`}>{record.validacaoHumana || "Não"}</p>
                      </div>
                    </div>
                    {record.quemValida && (
                      <div className="pt-2 border-t border-slate-200/60">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Responsável Designado</span>
                        <p className="text-xs font-extrabold text-slate-800 uppercase tracking-tight">{record.quemValida}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: DADOS UTILIZADOS */}
        {activeTab === "dados-utilizados" && isAdmin && (
          <div className="space-y-8 animate-fade-in text-slate-700">
            <div className="border-b border-[#E3E8E1] pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <Database size={16} className="text-[#075618]" />
                  Modelagem de Dados & Coleta
                </h3>
              </div>
              <div className="bg-[#EAF4EC]/50 border border-emerald-100 px-3 py-1.5 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase text-[#075618] shadow-3xs self-start md:self-auto">
                <span>Avaliador: Gerente TI (Etapa 3)</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Inventário de Tipos de Dados */}
              <div className="md:col-span-2 space-y-6">
                <div className="bg-slate-50 border border-slate-200/60 p-6 rounded-2xl">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-[#075618] mb-3">Dados Utilizados Ativamente</h4>
                  <p className="text-sm font-extrabold text-[#111111] leading-relaxed select-all">
                    {record.quaisDados || "Nenhum mapeamento de dados registrado."}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-50 border border-slate-200/60 p-5 rounded-xl text-center space-y-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Origem Interna</span>
                    <p className="text-xs font-extrabold text-slate-700 uppercase tracking-tight">{record.integradaSistemaInterno === "Sim" ? `Sim (${record.qualSistema || "Sistemas"})` : "Não"}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200/60 p-5 rounded-xl text-center space-y-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Envio Externo</span>
                    <p className="text-xs font-extrabold text-slate-700 uppercase tracking-tight">{record.envioFornecedorExterno || "Não"}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200/60 p-5 rounded-xl text-center space-y-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Treina Modelo</span>
                    <p className="text-xs font-extrabold text-slate-700 uppercase tracking-tight">{record.dadosTreinamentoModelo || "Não"}</p>
                  </div>
                </div>
              </div>

              {/* Sensibilidade de Dados */}
              <div className="bg-slate-50 border border-slate-200/60 p-5 rounded-2xl space-y-5">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-200 pb-2">Controles de Privacidade</h4>
                
                <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200/50 shadow-sm">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dados Pessoais</span>
                  <span className={`px-2.5 py-1 text-[9px] font-extrabold rounded uppercase tracking-tight ${
                    record.usaDadosPessoais === "Sim" ? "bg-amber-100 text-amber-800 border border-amber-200" : "bg-slate-100 text-slate-500"
                  }`}>
                    {record.usaDadosPessoais}
                  </span>
                </div>

                <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200/50 shadow-sm">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dados Sensíveis</span>
                  <span className={`px-2.5 py-1 text-[9px] font-extrabold rounded uppercase tracking-tight ${
                    record.usaDadosSensiveis === "Sim" ? "bg-rose-100 text-rose-800 border border-rose-200 animate-pulse" : "bg-slate-100 text-slate-500"
                  }`}>
                    {record.usaDadosSensiveis}
                  </span>
                </div>

                <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200/50 shadow-sm">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dados Anonimizados</span>
                  <span className={`px-2.5 py-1 text-[9px] font-extrabold rounded uppercase tracking-tight ${
                    record.dadosAnonimizados === "Sim" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                  }`}>
                    {record.dadosAnonimizados || "Não informado"}
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight block">Instruções de Proteção</span>
                  <p className="text-xs text-slate-500 bg-white p-3 rounded-xl border border-slate-200/50 italic leading-relaxed">
                    {record.obsProtecaoDados || "Nenhuma instrução específica informada."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: RISCOS E CONTROLES */}
        {activeTab === "riscos-controles" && isAdmin && (
          <div className="space-y-8 animate-fade-in text-slate-700">
            <div className="border-b border-[#E3E8E1] pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-black text-[#003F1D] uppercase tracking-widest flex items-center gap-2">
                  <ShieldAlert size={16} className="text-[#075618]" />
                  Análise de Riscos & Controles Mitigadores
                </h3>
              </div>
              <div className="bg-[#EAF4EC]/50 border border-emerald-100 px-3 py-1.5 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase text-[#075618] shadow-3xs self-start md:self-auto">
                <span>Avaliador: Gerente NIT (Etapa 2)</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Risks Column */}
              <div className="space-y-6">
                <div className="bg-slate-50 border border-slate-205/60 p-6 rounded-2xl">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-[#075618]">Riscos de Integridade Mapeados</h4>
                    <span className={`px-2 py-0.5 text-[8.5px] font-black rounded uppercase border ${
                      record.riscosIdentificados === "Sim" ? "bg-rose-50 text-rose-700 border-rose-200 animate-pulse" : "bg-slate-100 text-slate-500 border-transparent"
                    }`}>
                      Mapeado: {record.riscosIdentificados || "Não"}
                    </span>
                  </div>

                  <div className="space-y-3.5">
                    {record.quaisRiscos ? (
                      record.quaisRiscos.split(",").map((riskStr, idx) => (
                        <div key={idx} className="p-3 bg-white border border-slate-200 rounded-xl flex items-start gap-2.5 hover:border-amber-400 transition-colors">
                          <AlertTriangle size={15} className="text-amber-500 mt-0.5 flex-shrink-0" />
                          <span className="text-xs font-black uppercase tracking-tight text-slate-700 leading-tight">
                            {riskStr.trim()}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 italic">Nenhum risco de segurança cadastrado.</p>
                    )}
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-205/60 p-5 rounded-2xl flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Risco Residual Técnico</span>
                    <p className="text-lg font-black text-emerald-800 uppercase tracking-wide">{record.riscoResidual || "Não avaliado"}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Gestor do Risco</span>
                    <p className="text-xs font-extrabold text-slate-700 uppercase tracking-wide">{record.responsavelRisco || "Gestor de Risco designado"}</p>
                  </div>
                </div>
              </div>

              {/* Controls Column */}
              <div className="space-y-6">
                <div className="bg-slate-50 border border-slate-205/60 p-6 rounded-2xl">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-[#075618]">Controles Técnicos Ativos</h4>
                    <span className={`px-2 py-0.5 text-[8.5px] font-black rounded uppercase border ${
                      record.controlesImplementados === "Sim" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-transparent"
                    }`}>
                      Ativo: {record.controlesImplementados || "Não"}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {record.quaisControles && record.quaisControles.length > 0 ? (
                      record.quaisControles.map((ctrl, i) => (
                        <div key={i} className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-slate-200/70 rounded-xl text-xs font-bold text-slate-700 uppercase tracking-tight leading-none shadow-sm">
                          <Check size={14} className="text-emerald-600 font-extrabold flex-shrink-0" />
                          <span>{ctrl}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 italic">Nenhum controle ativo mapeado.</p>
                    )}
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-205/60 p-5 rounded-2xl">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight block mb-1">Medidas Operacionais Coletadas</span>
                  <p className="text-xs text-slate-500 bg-white p-3 rounded-xl border border-slate-200/50 italic leading-relaxed">
                    {record.obsRiscosControles || "Nenhuma observação operacional registrada."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}



        {/* TAB 6: HISTÓRICO */}
        {activeTab === "historico" && (
          <div className="space-y-8 animate-fade-in text-slate-700">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <History size={16} className="text-[#075618]" />
                Registros de Auditoria & Alterações
              </h3>

            </div>

            <div className="max-w-3xl mx-auto py-4">
              <div className="relative border-l-2 border-slate-200 ml-3.5 pl-6 space-y-8 pb-4">
                {getTimelineEvents().map((ev, i) => {
                  const isLong = ev.message.length > 120;
                  const isExpanded = !!expandedEvents[i];
                  return (
                    <div key={i} className="relative group">
                      {/* Circle Indicator */}
                      <div className="absolute -left-[32px] top-1.5 size-4.5 rounded-full border-4 border-white bg-[#075618] shadow group-hover:scale-110 transition-transform flex items-center justify-center">
                        <div className="size-1 bg-white rounded-full"></div>
                      </div>
                      
                      {/* Content Box */}
                      <div className="bg-[#F6F8F5]/40 border border-[#E3E8E1] p-5 rounded-2xl hover:bg-white transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-2.5">
                          <h4 className="font-black text-xs sm:text-sm text-[#003F1D] uppercase tracking-tight leading-none">
                            {ev.action}
                          </h4>
                          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-tight shrink-0 bg-white px-2 py-0.5 rounded border border-[#E3E8E1] shadow-3xs leading-none">
                            {ev.date}
                          </span>
                        </div>
                        
                        <div className="space-y-2">
                          <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                            {isLong && !isExpanded ? `${ev.message.substring(0, 120)}...` : ev.message}
                          </p>
                          {isLong && (
                            <button
                              onClick={() => toggleEvent(i)}
                              className="text-[10px] font-black uppercase text-[#075618] hover:text-[#003F1D] transition-colors cursor-pointer flex items-center gap-1"
                            >
                              {isExpanded ? "Ver menos" : "Ver mais"}
                            </button>
                          )}
                        </div>

                        {ev.user && (
                          <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1 mt-3 pt-2.5 border-t border-slate-100">
                            <Users size={10} /> Executor: {ev.user}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: RELATÓRIO DO LAUDO (PRINTABLE ORIGINAL DOC VIEW) */}
        {activeTab === "relatorio" && (
          <div className="space-y-6 animate-fade-in text-slate-800">
            {/* Action Bar for PDF Generation and Print - hidden on actual print layout */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-emerald-50/50 border border-emerald-100 rounded-3xl print:hidden">
              <div className="space-y-1">
                <span className="inline-block px-2.5 py-0.5 bg-[#EAF4EC] border border-[#BFD8C5] text-[#075618] text-[9px] font-black uppercase tracking-wider rounded-md">
                  Exportação de Conformidade
                </span>
                <h4 className="text-sm font-extrabold uppercase tracking-tight text-slate-800">Documento Oficial</h4>

              </div>
              <div className="flex flex-wrap items-center gap-3 self-end sm:self-center">
                <button
                  type="button"
                  id="btn-baixar-pdf"
                  onClick={handleDownloadPDF}
                  disabled={isDownloadingPdf}
                  className={`px-5 py-2.5 bg-[#075618] hover:bg-[#003F1D] text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer select-none ${
                    isDownloadingPdf ? "opacity-75 cursor-not-allowed" : ""
                  }`}
                >
                  {isDownloadingPdf ? (
                    <>
                      <span className="size-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                      Gerando PDF...
                    </>
                  ) : (
                    <>
                      <Download size={14} />
                      Baixar PDF
                    </>
                  )}
                </button>
                <button
                  type="button"
                  id="btn-imprimir-laudo"
                  onClick={() => window.print()}
                  className="px-5 py-2.5 bg-white border border-[#E8E7E7] text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-350 text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer select-none"
                >
                  <Printer size={14} />
                  Imprimir Laudo
                </button>
              </div>
            </div>

            {/* Official Report Area */}
            {renderFormalReport()}
          </div>
        )}

      </div>
    </div>
  );
}
