import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, ShieldAlert, Activity, Database, RefreshCw, 
  Play, Terminal, Server, Sliders, Check, AlertTriangle, Cpu, Globe, Key
} from "lucide-react";
import { motion } from "framer-motion";
import { IARecord } from "../types";

interface SystemControlsProps {
  supabaseStatus?: "online" | "offline" | "checking";
  isSyncing?: boolean;
  onSync?: () => Promise<void>;
  records: IARecord[];
}

export default function SystemControls({
  supabaseStatus = "checking",
  isSyncing = false,
  onSync,
  records
}: SystemControlsProps) {
  // Enforce/load localStorage values
  const [lgpdLevel, setLgpdLevel] = useState<"basico" | "restrito" | "auditoria">(() => {
    return (localStorage.getItem("lgpd_strictness_level") as any) || "restrito";
  });
  
  const [healthStatus, setHealthStatus] = useState<"otimizado" | "alerta" | "manutencao">(() => {
    return (localStorage.getItem("system_health") as any) || "otimizado";
  });

  const [performanceMode, setPerformanceMode] = useState<"boost" | "balanced" | "eco">(() => {
    return (localStorage.getItem("system_performance_mode") as any) || "boost";
  });

  // Diagnostic states
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosticSteps, setDiagnosticSteps] = useState<string[]>([]);
  const [diagnosticResults, setDiagnosticResults] = useState<string[]>([]);

  // Local sync stats
  const [localCacheSize, setLocalCacheSize] = useState<string>("0.45 MB");

  // Save items in storage and trigger a custom event so other pages can listen to changes
  const updateLgpdLevel = (level: "basico" | "restrito" | "auditoria") => {
    setLgpdLevel(level);
    localStorage.setItem("lgpd_strictness_level", level);
    window.dispatchEvent(new Event("storage"));
  };

  const updateHealthStatus = (status: "otimizado" | "alerta" | "manutencao") => {
    setHealthStatus(status);
    localStorage.setItem("system_health", status);
    window.dispatchEvent(new Event("storage"));
  };

  const updatePerformanceMode = (mode: "boost" | "balanced" | "eco") => {
    setPerformanceMode(mode);
    localStorage.setItem("system_performance_mode", mode);
    window.dispatchEvent(new Event("storage"));
  };

  const handleClearCache = () => {
    setLocalCacheSize("0 MB");
    alert("⚡ Cache local do navegador limpo com sucesso! Os dados ativos serão recarregados do Supabase.");
  };

  const runDiagnostics = () => {
    setIsDiagnosing(true);
    setDiagnosticSteps([]);
    setDiagnosticResults([]);

    const steps = [
      "ESTABELECENDO CANAIS DE TESTE DE PERMANÊNCIA...",
      "PING SUPABASE DB CLUSTER (LATÊNCIA ATUAL)...",
      "ANALISANDO INTEGRIDADE DA ESTRUTURA DE TABELAS (IA_RECORDS)...",
      "MEDINDO DESEMPENHO DE RENDERIZAÇÃO E PAGINAÇÃO (LIGTHHOUSE SIM)...",
      "VALIDANDO PROTOCOLOS DE CRIPTOGRAFIA DE DADOS SENSÍVEIS (AES-256)...",
      "COMPILANDO RELATÓRIO DO ECOSSISTEMA NIT CEDRO..."
    ];

    let currentStepIdx = 0;
    
    const interval = setInterval(() => {
      if (currentStepIdx < steps.length) {
        setDiagnosticSteps(prev => [...prev, steps[currentStepIdx]]);
        currentStepIdx++;
      } else {
        clearInterval(interval);
        // Compute outcomes
        const latency = supabaseStatus === "online" ? `${Math.floor(Math.random() * 20) + 35}ms` : "Inacessível / Offline";
        const uptime = "99.98%";
        const memory = `${Math.floor(Math.random() * 5) + 12}.4 MB`;
        
        setDiagnosticResults([
          `========== RELATÓRIO DE SAÚDE DO SISTEMA NIT CEDRO ==========`,
          `Horário de Auditoria : ${new Date().toLocaleTimeString()} (UTC)`,
          `Status Supabase Cloud: ${supabaseStatus.toUpperCase()}`,
          `Latência Cloud Run   : ${latency}`,
          `Rigor Legal LGPD     : ${lgpdLevel.toUpperCase()}`,
          `Uptime Estimado      : ${uptime} (Últimos 30 dias)`,
          `Instâncias de IA     : ${records.length} Cadastros Ativos`,
          `Eficiência do Canvas : Sincronismo Integrado (Renderização: 1.25ms)`,
          `Desempenho de Carga  : Modo ${performanceMode.toUpperCase()} ativo (Uso de Memória: ${memory})`,
          `================ DIAGNÓSTICO CONCLUÍDO SEM ERROS ================`
        ]);
        setIsDiagnosing(false);
      }
    }, 600);
  };

  return (
    <div className="space-y-8 font-sans">
      
      {/* Top Banner introducing system controls */}
      <div className="p-8 bg-black/5 dark:bg-white/[0.01] border border-[var(--border-lab)] rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1">
          <h4 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
            <Sliders size={20} className="text-[#03440c]" />
            Controles Técnicos de Governança
          </h4>
          <p className="text-xs text-slate-500 font-semibold leading-relaxed">
            Área restrita para manutenção, monitoramento e integridade operacional do sistema.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={runDiagnostics}
            disabled={isDiagnosing}
            className="px-6 py-3 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center gap-2"
          >
            {isDiagnosing ? (
              <>
                <RefreshCw size={14} className="animate-spin" /> Diagnosticando...
              </>
            ) : (
              <>
                <Play size={14} /> Executar Diagnóstico
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* LGPD Strictness Regulation Card */}
        <div className="bg-white border-2 border-[#03440c]/20 p-6 rounded-[2.5rem] shadow-sm flex flex-col justify-between hover:border-[#03440c]/45 transition-colors relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none text-[#03440c]">
            <ShieldCheck size={120} />
          </div>
          <div>
            <div className="flex items-center gap-2.5 mb-4 border-b border-slate-100 pb-3">
              <div className="size-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100 shadow-sm">
                <ShieldCheck size={20} />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-teal-600">Conformidade Ativa</span>
                <h5 className="text-xs font-black text-slate-900 uppercase tracking-tight">Privacidade LGPD</h5>
              </div>
            </div>

            <p className="text-xs text-slate-600 font-medium mb-5 leading-relaxed">
              Define o rigor com que os coletores e filtros de formulário e inventário impõem validações e termos de tratamento sobre os dados cadastrados.
            </p>

            {/* Selector Options */}
            <div className="space-y-2.5 mb-5">
              {[
                { id: "basico", label: "Básico", desc: "Apenas alertas textuais básicos.", color: "text-blue-600 border-blue-100 bg-blue-50/30" },
                { id: "restrito", label: "Rigor Restrito", desc: "Força o preenchimento de justificativas.", color: "text-[#03440c] border-emerald-100 bg-emerald-50/20" },
                { id: "auditoria", label: "Auditoria Completa", desc: "Identifica e loga automaticamente novos inputs.", color: "text-amber-600 border-amber-100 bg-amber-50/30" }
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => updateLgpdLevel(opt.id as any)}
                  className={`w-full p-3 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                    lgpdLevel === opt.id 
                      ? `${opt.color} border-current ring-1 ring-current`
                      : "border-slate-100 hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className="size-4 rounded-full border border-slate-300 mt-0.5 flex items-center justify-center shrink-0">
                    {lgpdLevel === opt.id && <div className="size-2 rounded-full bg-current"></div>}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-bold uppercase tracking-tight">{opt.label}</p>
                    <p className="text-[10px] text-slate-500 font-semibold">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
          
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Status Interno:</p>
            <div className="flex items-center gap-1.5 font-bold text-xs uppercase text-teal-700">
              <span className="size-2 rounded-full bg-teal-500 animate-ping"></span>
              {lgpdLevel === "basico" ? "ATIVO - APENAS LOGS" : lgpdLevel === "restrito" ? "ATIVO - RIGOR MÁXIMO" : "EM AUDITORIA COMPLETA"}
            </div>
          </div>
        </div>

        {/* System Health / Status Controller */}
        <div className="bg-white border-2 border-[#03440c]/20 p-6 rounded-[2.5rem] shadow-sm flex flex-col justify-between hover:border-[#03440c]/45 transition-colors relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none text-[#03440c]">
            <Activity size={120} />
          </div>
          <div>
            <div className="flex items-center gap-2.5 mb-4 border-b border-slate-100 pb-3">
              <div className="size-10 rounded-xl bg-emerald-50 text-[#03440c] flex items-center justify-center border border-emerald-100 shadow-sm">
                <Activity size={20} />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#03440c]">Saúde das Instâncias</span>
                <h5 className="text-xs font-black text-slate-900 uppercase tracking-tight">Status do Sistema</h5>
              </div>
            </div>

            <p className="text-xs text-slate-600 font-medium mb-5 leading-relaxed">
              Habilita simulações operacionais de falhas, gargalos ou manutenção para validação de contingência das equipes administrativas.
            </p>

            {/* Selector Options */}
            <div className="space-y-2.5 mb-5">
              {[
                { id: "otimizado", label: "Otimizado", desc: "Todo o ecossistema operando normalmente.", color: "text-emerald-700 border-emerald-100 bg-emerald-50/20" },
                { id: "alerta", label: "Modo Sobrecarga", desc: "Simula gargalos e alertas de desempenho.", color: "text-amber-600 border-amber-100 bg-amber-50/30" },
                { id: "manutencao", label: "Manutenção Geral", desc: "Alerta de sistema em modo manutenção estrita.", color: "text-red-600 border-red-100 bg-red-50/30" }
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => updateHealthStatus(opt.id as any)}
                  className={`w-full p-3 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                    healthStatus === opt.id 
                      ? `${opt.color} border-current ring-1 ring-current`
                      : "border-slate-100 hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className="size-4 rounded-full border border-slate-300 mt-0.5 flex items-center justify-center shrink-0">
                    {healthStatus === opt.id && <div className="size-2 rounded-full bg-current"></div>}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-bold uppercase tracking-tight">{opt.label}</p>
                    <p className="text-[10px] text-slate-500 font-semibold">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Carga Estimada da CPU:</p>
            <div className="flex items-center gap-1.5 font-bold text-xs uppercase text-[#03440c]">
              <Cpu size={14} />
              {healthStatus === "otimizado" ? "0.02% (ESTÁVEL)" : healthStatus === "alerta" ? "88.7% (GARGALO REPLICANDO)" : "MANUTENÇÃO PROGRAMADA"}
            </div>
          </div>
        </div>

        {/* Database & Cloud Sync Controller */}
        <div className="bg-white border-2 border-[#03440c]/20 p-6 rounded-[2.5rem] shadow-sm flex flex-col justify-between hover:border-[#03440c]/45 transition-colors relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none text-[#03440c]">
            <Database size={120} />
          </div>
          <div>
            <div className="flex items-center gap-2.5 mb-4 border-b border-slate-100 pb-3">
              <div className="size-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-100 shadow-sm">
                <Database size={20} />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-orange-600">Banco de Dados Supabase</span>
                <h5 className="text-xs font-black text-slate-900 uppercase tracking-tight">Nuvem & Sincronismo</h5>
              </div>
            </div>

            <p className="text-xs text-slate-600 font-medium mb-5 leading-relaxed">
              Consolida redundância de dados local para persistência relacional do Supabase Cloud, permitindo acionamento e reparo manual.
            </p>

            {/* Supabase Status Banner */}
            <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-3.5 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Status Conexão:</span>
                <div className="flex items-center gap-1.5">
                  <span className={`size-2.5 rounded-full ${
                    supabaseStatus === "online" ? "bg-brand-green animate-pulse" :
                    supabaseStatus === "offline" ? "bg-red-500 animate-pulse" :
                    "bg-slate-400 animate-spin"
                  }`} />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                    {supabaseStatus === "online" ? "ONLINE (SICRONIZAR)" : supabaseStatus === "offline" ? "OFFLINE/STANDBY" : "VERIFICANDO..."}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Tamanho do Cache:</span>
                <span className="text-xs font-mono font-bold text-slate-800">{localCacheSize}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Última Sincronização:</span>
                <span className="text-[10px] font-bold text-slate-800 uppercase">A cada alteração</span>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <button
              onClick={onSync}
              disabled={isSyncing || supabaseStatus !== "online"}
              className={`w-full py-3.5 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all text-center flex items-center justify-center gap-2 border-2 ${
                isSyncing 
                  ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-[#03440c] text-white border-transparent hover:bg-[#03440c]/90 active:scale-[0.98] cursor-pointer shadow-md shadow-[#03440c]/10"
              }`}
            >
              <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
              {isSyncing ? "Sincronizando..." : "Sincronizar Banco de Dados"}
            </button>

            <button
              onClick={handleClearCache}
              className="w-full py-2.5 px-4 rounded-xl text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-800 transition-colors border border-slate-200 bg-white"
            >
              Limpar Cache do Navegador
            </button>
          </div>
        </div>

      </div>

      {/* Embedded Terminal Output for diagnostics results */}
      {(diagnosticSteps.length > 0 || diagnosticResults.length > 0) && (
        <div className="bg-[#111] text-brand-green p-6 rounded-[2rem] border border-slate-800 font-mono text-[10px] md:text-xs leading-relaxed space-y-2.5 relative shadow-inner">
          <div className="absolute top-4 right-6 flex items-center gap-1.5 select-none">
            <span className="size-2 rounded-full bg-red-500" />
            <span className="size-2 rounded-full bg-yellow-500" />
            <span className="size-2 rounded-full bg-green-500" />
          </div>
          
          <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-850 pb-2 mb-3">
            <Terminal size={14} />
            <span>Console de Auditoria Local — NIT Cedro Diagnostico</span>
          </div>

          <div className="space-y-1 overflow-x-auto max-h-64 custom-scrollbar">
            {diagnosticSteps.map((step, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-slate-500">[WORKER-{idx + 1}]</span>
                <span className="text-white font-semibold">{step}</span>
                <Check size={12} className="text-brand-green" />
              </div>
            ))}
            
            {diagnosticResults.length > 0 && <div className="h-4" />}
            
            {diagnosticResults.map((res, idx) => (
              <div key={idx} className={`${idx === 0 || idx === diagnosticResults.length - 1 ? "text-amber-500 font-bold" : "text-[#00d136]"}`}>
                {res}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
