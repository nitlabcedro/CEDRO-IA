import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, User, ArrowRight, Loader2, Building, Briefcase, Phone, ChevronDown, Eye, EyeOff, FlaskConical, Dna, Microscope, Atom, Pipette, TestTube, Sparkles } from "lucide-react";
import { getSectors } from "../storage";
import LabBackground from "./LabBackground";
import { useAuth } from "../contexts/AuthContext";

interface AuthProps {
  onAuthSuccess?: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
  const { refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [combos, setCombos] = useState<Array<{ setor: string; cargo: string }>>([
    { setor: "", cargo: "" }
  ]);
  const [cargosPorSetor, setCargosPorSetor] = useState<Record<string, string[]>>({});
  const [sectors, setSectors] = useState<string[]>([]);
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    getSectors().then(setSectors);
    try {
      const savedEmail = localStorage.getItem("cedro_remembered_email");
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch (e) {
      console.error("Erro ao ler e-mail lembrado do localStorage:", e);
    }
  }, []);

  const fetchCargosParaSetor = async (sectorName: string) => {
    if (!sectorName) return;
    if (cargosPorSetor[sectorName]) return; // Já está no cache

    try {
      const { data, error } = await supabase
        .from("sectors")
        .select("cargos")
        .eq("name", sectorName)
        .maybeSingle();

      if (!error && data && Array.isArray(data.cargos) && data.cargos.length > 0) {
        setCargosPorSetor(prev => ({ ...prev, [sectorName]: data.cargos }));
        return;
      }
    } catch (err) {
      console.error("Erro ao carregar cargos do Supabase em Auth:", err);
    }

    try {
      const rawDetails = localStorage.getItem("cedro_sectors_details_v2");
      if (rawDetails) {
        const details = JSON.parse(rawDetails);
        if (details[sectorName]?.cargos?.length > 0) {
          setCargosPorSetor(prev => ({ ...prev, [sectorName]: details[sectorName].cargos }));
          return;
        }
      }
    } catch (e) {
      console.error("Erro ao ler localStorage:", e);
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
    setCargosPorSetor(prev => ({ ...prev, [sectorName]: PRESET_CARGOS[sectorName] || ["Colaborador"] }));
  };

  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: "https://ia.labcedro.app/reset-password",
        });
        if (error) {
          setMessage({
            type: "error",
            text: "Não foi possível enviar o link de recuperação. Verifique o e-mail informado ou tente novamente."
          });
        } else {
          setMessage({
            type: "success",
            text: "Enviamos um link de recuperação para o e-mail informado. Verifique sua caixa de entrada e spam."
          });
        }
        setLoading(false);
        return;
      }

      if (mode === "login") {
        const { data: authData, error } = await supabase.auth.signInWithPassword({ 
          email: cleanEmail, 
          password: cleanPassword 
        });
        if (error) throw error;
        
        // Carrega o perfil fresco imediatamente após login bem-sucedido
        if (authData?.user?.id) {
          try {
            await refreshProfile(undefined, false, authData.user.id);
          } catch (pError) {
            console.error("Erro ao sincronizar perfil pós-login:", pError);
          }
        }

        // Persistir/remover e-mail conforme checkbox "Lembrar-me"
        try {
          if (rememberMe) {
            localStorage.setItem("cedro_remembered_email", cleanEmail);
          } else {
            localStorage.removeItem("cedro_remembered_email");
          }
        } catch (storageErr) {
          console.error("Erro ao salvar e-mail no localStorage:", storageErr);
        }
        
        if (onAuthSuccess) onAuthSuccess();
      } else {
        const ALLOWED_DOMAIN = "@labcedro.com.br";
        if (!cleanEmail.toLowerCase().endsWith(ALLOWED_DOMAIN)) {
          setMessage({ 
            type: "error", 
            text: `Apenas e-mails institucionais (${ALLOWED_DOMAIN}) podem se cadastrar na plataforma.` 
          });
          setLoading(false);
          return;
        }

        const validCombos = combos.filter(c => c.setor && c.cargo);
        if (validCombos.length === 0) {
          setMessage({ type: "error", text: "Por favor, adicione pelo menos uma atribuição de setor e cargo / função." });
          setLoading(false);
          return;
        }

        const finalSetor = validCombos.map(c => c.setor.trim()).join("; ");
        const finalCargo = validCombos.map(c => c.cargo.trim()).join("; ");

        const { data, error } = await supabase.auth.signUp({ 
          email: cleanEmail, 
          password: cleanPassword,
          options: { data: { full_name: fullName } }
        });
        if (error) throw error;
        
        const userId = data.user?.id;

        if (!userId) {
          throw new Error("Usuário não retornado após cadastro.");
        }

        const { data: existingProfile, error: existingProfileError } = await supabase
          .from("profiles")
          .select("id, role")
          .eq("id", userId)
          .maybeSingle();

        if (existingProfileError) {
          console.error("Erro ao verificar perfil existente:", existingProfileError);
          throw existingProfileError;
        }

        if (existingProfile) {
          const { error: updateProfileError } = await supabase
            .from("profiles")
            .update({
              full_name: fullName,
              setor: finalSetor,
              cargo: finalCargo,
              contato: cleanEmail,
              updated_at: new Date().toISOString()
            })
            .eq("id", userId);

          if (updateProfileError) {
            console.error("Erro ao atualizar perfil existente:", updateProfileError);
            throw updateProfileError;
          }
        } else {
          const { error: insertProfileError } = await supabase
            .from("profiles")
            .insert({
              id: userId,
              full_name: fullName,
              setor: finalSetor,
              cargo: finalCargo,
              role: "user",
              status: "Autorizado",
              contato: cleanEmail,
              updated_at: new Date().toISOString()
            });

          if (insertProfileError) {
            console.error("Erro ao criar perfil:", insertProfileError);
            throw insertProfileError;
          }
        }

        // Forçar a atualização do perfil em memória e no banco de dados para evitar atrasos na interface
        try {
          await refreshProfile({
            id: userId,
            full_name: fullName,
            setor: finalSetor,
            cargo: finalCargo,
            role: "user",
            status: "Autorizado",
            contato: cleanEmail
          }, false);
        } catch (rfErr) {
          console.warn("Aviso ao sincronizar perfil recém-criado:", rfErr);
        }

        setMessage({ type: "success", text: "Cadastro realizado! Faça login para continuar." });
        setMode("login");
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Erro ao processar solicitação" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen w-full relative flex flex-col lg:flex-row bg-cover bg-center overflow-hidden font-sans select-none"
      style={{
        backgroundImage: `url('https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1920&q=80')`
      }}
    >
      {/* Solid green overlay to serve as a custom branding filter for the background image */}
      <div className="absolute inset-0 bg-[#003F1D]/85 z-0 pointer-events-none" />

      {/* LEFT COLUMN: Main institutional area with large white Laboratório Cedro logo */}
      <div className="hidden lg:flex lg:w-[65%] flex-col justify-center items-center p-12 relative z-10">
        <div className="flex flex-col items-center justify-center text-center animate-fade-in">
          <img 
            src="https://raw.githubusercontent.com/nitlabcedro/assets/refs/heads/main/Ativo%206.png" 
            alt="Laboratório Cedro" 
            className="h-44 w-auto brightness-0 invert" 
          />
        </div>
      </div>

      {/* RIGHT COLUMN: Translucent Login Sidebar */}
      <div className="w-full lg:w-[35%] min-h-screen bg-white/95 backdrop-blur-md border-l border-slate-200 relative z-10 flex flex-col justify-between p-8 lg:p-14 xl:p-16 overflow-y-auto custom-scrollbar">
        
        {/* Subtle Laboratory Overlay Elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
          {/* Subtle Grid Lines */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-15" />
          
          {/* Faint, beautifully organized animated laboratory visual accents */}
          <motion.div 
            className="absolute top-[15%] left-[8%]"
            style={{ color: "rgba(7, 86, 24, 0.065)" }}
            animate={{ y: [0, -6, 0], rotate: [0, 6, -6, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          >
            <FlaskConical size={64} strokeWidth={1.2} />
          </motion.div>

          <motion.div 
            className="absolute top-[26%] right-[10%]"
            style={{ color: "rgba(242, 146, 34, 0.055)" }}
            animate={{ y: [0, 8, 0], rotate: [0, -8, 8, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          >
            <Pipette size={52} strokeWidth={1.2} />
          </motion.div>

          <motion.div 
            className="absolute top-[34%] left-[12%]"
            style={{ color: "rgba(242, 146, 34, 0.05)" }}
            animate={{ scale: [0.9, 1.15, 0.9], opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sparkles size={36} strokeWidth={1.2} />
          </motion.div>

          <motion.div 
            className="absolute top-[44%] right-[8%]"
            style={{ color: "rgba(7, 86, 24, 0.065)" }}
            animate={{ y: [0, -8, 0], rotate: [0, -4, 4, 0] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          >
            <Microscope size={68} strokeWidth={1.2} />
          </motion.div>

          <motion.div 
            className="absolute bottom-[38%] left-[8%]"
            style={{ color: "rgba(7, 86, 24, 0.065)" }}
            animate={{ y: [0, 6, 0], rotate: [0, 8, -8, 0] }}
            transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          >
            <TestTube size={56} strokeWidth={1.2} />
          </motion.div>

          <motion.div 
            className="absolute bottom-[24%] right-[12%]"
            style={{ color: "rgba(242, 146, 34, 0.055)" }}
            animate={{ scale: [0.95, 1.05, 0.95], rotate: [0, 360] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          >
            <Atom size={60} strokeWidth={1.2} />
          </motion.div>

          <motion.div 
            className="absolute bottom-[10%] left-[10%]"
            style={{ color: "rgba(7, 86, 24, 0.075)" }}
            animate={{ y: [0, -10, 0], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
          >
            <Dna size={72} strokeWidth={1.0} />
          </motion.div>

          {/* Abstract biological/chemical cell bubbles */}
          <div className="absolute top-[22%] right-[20%] w-2 h-2 rounded-full blur-[0.5px] animate-pulse" style={{ backgroundColor: "rgba(7, 86, 24, 0.09)" }} />
          <div className="absolute bottom-[32%] left-[22%] w-3 h-3 rounded-full blur-[0.5px] animate-pulse" style={{ backgroundColor: "rgba(7, 86, 24, 0.07)", animationDelay: "1s", animationDuration: "3s" }} />
          <div className="absolute bottom-[18%] left-[42%] w-1.5 h-1.5 rounded-full blur-[0.2px]" style={{ backgroundColor: "rgba(7, 86, 24, 0.1)" }} />
          <div className="absolute top-[62%] right-[28%] w-2.5 h-2.5 rounded-full blur-[0.5px]" style={{ backgroundColor: "rgba(7, 86, 24, 0.07)" }} />
        </div>

        {/* Top Header - Logo Cedro IA */}
        <div className="flex justify-end mb-10 items-center relative z-10">
          <div className="flex items-center gap-1.5 select-none font-display">
            <span className="text-[#075618] font-extrabold text-2xl lg:text-3xl tracking-tight">
              Cedro
            </span>
            <span className="text-[#F29222] font-semibold text-2xl lg:text-3xl tracking-wide">
              IA
            </span>
          </div>
        </div>

        {/* Mobile-only logo */}
        <div className="block lg:hidden flex flex-col items-center mb-10 relative z-10">
          <img 
            src="https://raw.githubusercontent.com/nitlabcedro/assets/refs/heads/main/Ativo%206.png" 
            alt="Laboratório Cedro" 
            className="h-20 w-auto object-contain mb-3" 
          />
          <div className="flex items-center gap-1.5 select-none font-display">
            <span className="text-[#075618] font-extrabold text-xl tracking-tight">
              Cedro
            </span>
            <span className="text-[#F29222] font-semibold text-xl tracking-wide">
              IA
            </span>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center my-auto relative z-10">
          
          {/* Header Title */}
          <div className="mb-6 relative">
            <h2 className="text-2xl lg:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#075618] via-[#094d15] to-[#F29222] tracking-tight font-display">
              {mode === "login" ? "Login" : mode === "signup" ? "Cadastro" : "Recuperar Senha"}
            </h2>
            {mode === "forgot" && (
              <p className="text-slate-500 text-xs lg:text-[13px] mt-2 font-medium">
                Informe seu e-mail para receber as instruções de recuperação.
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              {mode === "signup" && (
                <motion.div
                  key="signup-fields"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden space-y-4 pb-1"
                >
                  <div className="relative group flex items-center bg-slate-100/50 hover:bg-slate-100/80 focus-within:bg-white border border-slate-300/90 focus-within:border-[#075618] rounded-2xl transition-all duration-300 focus-within:ring-4 focus-within:ring-[#075618]/5 shadow-[0_2px_10px_rgba(0,0,0,0.04)] focus-within:shadow-md">
                    <div className="absolute left-4.5 flex items-center justify-center text-slate-500/90 group-focus-within:text-[#075618] group-hover:text-slate-600 transition-colors duration-200">
                      <User size={20} strokeWidth={1.75} />
                    </div>
                    <input
                      type="text"
                      placeholder="Nome Completo"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-13 pr-4 py-4 bg-transparent text-slate-900 outline-none text-base placeholder:text-slate-500 font-medium tracking-wide caret-[#075618]"
                    />
                  </div>
                  
                  {/* Combos Setor + Cargo */}
                  <div className="space-y-3 pt-1">
                    {combos.map((combo, index) => (
                      <div key={index} className="p-4 bg-slate-100/40 border border-slate-300/80 rounded-2xl space-y-3 relative">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-[#075618] uppercase tracking-wider">Atribuição #{index + 1}</span>
                          {combos.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const newCombos = combos.filter((_, i) => i !== index);
                                setCombos(newCombos);
                              }}
                              className="text-red-500 hover:text-red-700 text-xs font-bold transition-colors cursor-pointer uppercase tracking-wider"
                            >
                              Remover
                            </button>
                          )}
                        </div>
                        
                        {/* Select Setor */}
                        <div className="relative group flex items-center bg-white border border-slate-300/90 focus-within:border-[#075618] rounded-xl transition-all duration-300 shadow-sm focus-within:shadow-md">
                          <div className="absolute left-4.5 flex items-center justify-center text-slate-500/90 group-focus-within:text-[#075618]">
                            <Building size={18} strokeWidth={1.75} />
                          </div>
                          <select
                            required
                            value={combo.setor}
                            onChange={(e) => {
                              const sec = e.target.value;
                              const newCombos = [...combos];
                              newCombos[index] = { setor: sec, cargo: "" };
                              setCombos(newCombos);
                              fetchCargosParaSetor(sec);
                            }}
                            className="w-full pl-13 pr-10 py-3.5 bg-transparent text-slate-900 outline-none text-sm cursor-pointer appearance-none font-medium tracking-wide"
                          >
                            <option value="">Selecione o setor...</option>
                            {sectors.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                          <div className="absolute right-4.5 flex items-center pointer-events-none text-slate-500">
                            <ChevronDown size={16} strokeWidth={2} />
                          </div>
                        </div>

                        {/* Select Cargo */}
                        <div className="relative group flex items-center bg-white border border-slate-300/90 focus-within:border-[#075618] rounded-xl transition-all duration-300 shadow-sm focus-within:shadow-md">
                          <div className="absolute left-4.5 flex items-center justify-center text-slate-500/90 group-focus-within:text-[#075618]">
                            <Briefcase size={18} strokeWidth={1.75} />
                          </div>
                          <select
                            required
                            disabled={!combo.setor}
                            value={combo.cargo}
                            onChange={(e) => {
                              const newCombos = [...combos];
                              newCombos[index].cargo = e.target.value;
                              setCombos(newCombos);
                            }}
                            className="w-full pl-13 pr-10 py-3.5 bg-transparent text-slate-900 outline-none text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer appearance-none font-medium tracking-wide"
                          >
                            <option value="">{combo.setor ? "Selecione o cargo / função..." : "Selecione o setor primeiro"}</option>
                            {(cargosPorSetor[combo.setor] || []).map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                          <div className="absolute right-4.5 flex items-center pointer-events-none text-slate-500">
                            <ChevronDown size={16} strokeWidth={2} />
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <button
                      type="button"
                      onClick={() => setCombos([...combos, { setor: "", cargo: "" }])}
                      className="w-full py-3.5 border border-dashed border-slate-300 hover:border-[#075618] hover:bg-slate-50/50 rounded-2xl text-xs font-bold text-slate-600 hover:text-[#075618] transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider cursor-pointer"
                    >
                      + Adicionar outro Cargo/Setor
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email / Usuário Input */}
            <div className="relative group flex items-center bg-slate-100/50 hover:bg-slate-100/80 focus-within:bg-white border border-slate-300/90 focus-within:border-[#075618] rounded-2xl transition-all duration-300 focus-within:ring-4 focus-within:ring-[#075618]/5 shadow-[0_2px_10px_rgba(0,0,0,0.04)] focus-within:shadow-md">
              <div className="absolute left-4.5 flex items-center justify-center text-slate-500/90 group-focus-within:text-[#075618] group-hover:text-slate-600 transition-colors duration-200">
                <Mail size={20} strokeWidth={1.75} />
              </div>
              <input
                type="email"
                placeholder={mode === "signup" ? "seuemail@labcedro.com.br" : mode === "forgot" ? "E-mail" : "Usuário"}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-13 pr-4 py-4 bg-transparent text-slate-900 outline-none text-base placeholder:text-slate-500 font-medium tracking-wide caret-[#075618]"
              />
            </div>
            {mode === "signup" && (
              <p className="text-[10px] text-slate-500 font-medium pl-1 -mt-2">
                Use seu e-mail institucional (@labcedro.com.br).
              </p>
            )}

            {/* Password Input */}
            {mode !== "forgot" && (
              <div className="relative group flex items-center bg-slate-100/50 hover:bg-slate-100/80 focus-within:bg-white border border-slate-300/90 focus-within:border-[#075618] rounded-2xl transition-all duration-300 focus-within:ring-4 focus-within:ring-[#075618]/5 shadow-[0_2px_10px_rgba(0,0,0,0.04)] focus-within:shadow-md">
                <div className="absolute left-4.5 flex items-center justify-center text-slate-500/90 group-focus-within:text-[#075618] group-hover:text-slate-600 transition-colors duration-200">
                  <Lock size={20} strokeWidth={1.75} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Senha"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-13 pr-12 py-4 bg-transparent text-slate-900 outline-none text-base placeholder:text-slate-500 font-medium tracking-wide caret-[#075618]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4.5 flex items-center justify-center text-slate-500 hover:text-slate-700 focus:outline-none transition-colors duration-200"
                >
                  {showPassword ? <EyeOff size={20} strokeWidth={1.75} /> : <Eye size={20} strokeWidth={1.75} />}
                </button>
              </div>
            )}

            {/* Checkbox for Lembrar-me */}
            {mode === "login" && (
              <div className="flex items-center justify-between pt-1 select-none">
                <label className="flex items-center gap-2.5 text-slate-700 text-[13px] font-medium cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded-md bg-slate-50 border-slate-200 text-[#075618] focus:ring-[#075618]/25 focus:ring-offset-0 h-4.5 w-4.5 transition cursor-pointer" 
                  />
                  <span className="group-hover:text-slate-900 transition-colors">Lembrar-me</span>
                </label>
                <button
                  type="button"
                  onClick={() => { setMode("forgot"); setMessage(null); }}
                  className="text-slate-600 text-xs hover:text-[#075618] hover:underline transition-colors cursor-pointer font-semibold"
                >
                  Esqueci minha senha
                </button>
              </div>
            )}

            {/* Status / Error messages */}
            {message && (
              <div className={`p-3.5 rounded-xl text-xs font-semibold ${
                message.type === "success" ? "bg-emerald-50 text-[#075618] border border-emerald-100/60" : "bg-red-50 text-red-600 border border-red-100/60"
              } flex items-start gap-2 transition-all`}>
                <span className={`size-1.5 rounded-full mt-1.5 shrink-0 ${message.type === "success" ? "bg-emerald-500" : "bg-red-500"}`} />
                <span>
                  {message.text}
                </span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#03440c] hover:bg-[#075618] active:scale-[0.99] text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 cursor-pointer shadow-md hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-[#075618]/20 mt-4"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                mode === "login" ? "Login" : mode === "signup" ? "Cadastrar" : "Enviar link de recuperação"
              )}
            </button>

            {mode === "forgot" && (
              <button
                type="button"
                onClick={() => { setMode("login"); setMessage(null); }}
                className="w-full py-3.5 bg-slate-100 hover:bg-slate-200/80 active:scale-[0.99] text-slate-700 font-bold rounded-xl transition-all flex items-center justify-center text-sm cursor-pointer shadow-sm focus:outline-none focus:ring-4 focus:ring-slate-200"
              >
                Cancelar
              </button>
            )}
          </form>

          {/* Switch mode */}
          {mode !== "forgot" && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(null); }}
                className="text-slate-600 text-xs hover:text-[#075618] hover:underline transition-colors cursor-pointer"
              >
                {mode === "login" ? "Ainda não tem acesso? Cadastre-se" : "Já possui uma conta? Faça Login"}
              </button>
            </div>
          )}
        </div>

        {/* Footer actions / Support link */}
        <div className="mt-8 pt-4 border-t border-slate-100 flex flex-col items-center relative z-10">
          <button
            type="button"
            onClick={() => { setMode("forgot"); setMessage(null); }}
            className="text-slate-500 text-[12px] hover:text-[#075618] hover:underline transition-colors bg-transparent border-0 outline-none cursor-pointer"
          >
            Esqueci minha senha
          </button>
        </div>

      </div>
    </div>
  );
};
