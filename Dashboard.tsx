import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, User, ArrowRight, Loader2, Building, Briefcase, Phone, ChevronDown, Eye, EyeOff, FlaskConical, Dna, Microscope, Atom, Pipette, TestTube, Sparkles } from "lucide-react";
import { getSectors } from "../storage";
import LabBackground from "./LabBackground";
import LabLiquidAnimation from "./LabLiquidAnimation";
import { useAuth } from "../contexts/AuthContext";
import { CustomDropdown } from "./CustomDropdown";

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

  const formContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.05
      }
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.25, ease: "easeInOut" }
    }
  };

  const fieldVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 110, damping: 18 }
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
      <div className="hidden lg:flex lg:w-[65%] flex-col justify-center items-center p-12 relative z-10 select-none">
        <div className="relative w-full max-w-lg aspect-square flex items-center justify-center">
          
          {/* Central logo */}
          <div className="flex flex-col items-center justify-center text-center z-20">
            <img 
              src="https://raw.githubusercontent.com/nitlabcedro/assets/refs/heads/main/Ativo%206.png" 
              alt="Laboratório Cedro" 
              className="h-44 w-auto brightness-0 invert select-none pointer-events-none" 
            />
          </div>

        </div>
      </div>

      {/* RIGHT COLUMN: Translucent Login Sidebar */}
      <div className="w-full lg:w-[35%] min-h-screen bg-white/95 backdrop-blur-md border-l border-slate-200 relative z-10 flex flex-col justify-between p-8 lg:p-14 xl:p-16 overflow-y-auto custom-scrollbar">
        
        {/* Subtle Laboratory Overlay Elements */}
        <LabLiquidAnimation />

        {/* Top Header Placeholder (Empty to align properly) */}
        <div className="flex justify-end mb-10 items-center relative z-10 min-h-[36px]" />

        {/* Mobile-only logo */}
        <div className="block lg:hidden flex flex-col items-center mb-10 relative z-10">
          <img 
            src="https://raw.githubusercontent.com/nitlabcedro/assets/refs/heads/main/Ativo%206.png" 
            alt="Laboratório Cedro" 
            className="h-20 w-auto object-contain" 
          />
        </div>

        <div className="flex-1 flex flex-col justify-center my-auto relative z-10" style={{ perspective: 1000 }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={formContainerVariants}
              className="w-full flex flex-col"
            >
              {/* Header Title */}
              <motion.div variants={fieldVariants} className="mb-6 relative">
                <h2 className="text-2xl lg:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#075618] via-[#094d15] to-[#F29222] tracking-tight font-display">
                  {mode === "login" ? "Login" : mode === "signup" ? "Cadastro" : "Recuperar Senha"}
                </h2>
                {mode === "forgot" && (
                  <p className="text-slate-500 text-xs lg:text-[13px] mt-2 font-medium">
                    Informe seu e-mail para receber as instruções de recuperação.
                  </p>
                )}
              </motion.div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === "signup" && (
                  <div className="space-y-4 pb-1 relative z-30">
                    <motion.div variants={fieldVariants} className="relative group flex items-center bg-slate-100/50 hover:bg-slate-100/80 focus-within:bg-white border-2 border-[#075618]/50 group-hover:border-[#075618]/80 focus-within:border-[#075618] rounded-2xl transition-all duration-300 focus-within:ring-4 focus-within:ring-[#075618]/10 shadow-[0_2px_10px_rgba(0,0,0,0.04)] focus-within:shadow-md">
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
                    </motion.div>
                    
                    {/* Combos Setor + Cargo */}
                    <motion.div variants={fieldVariants} className="space-y-3 pt-1 relative z-20">
                      {combos.map((combo, index) => (
                        <div key={index} style={{ zIndex: combos.length - index }} className="p-4 bg-emerald-50/20 border-2 border-[#075618]/20 rounded-2xl space-y-4 relative shadow-sm">
                          {combos.length > 1 && (
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => {
                                  const newCombos = combos.filter((_, i) => i !== index);
                                  setCombos(newCombos);
                                }}
                                className="text-red-600 hover:text-red-800 text-[10px] font-extrabold transition-colors cursor-pointer uppercase tracking-wider bg-red-50 hover:bg-red-100 px-2 py-1 rounded-md border border-red-200"
                              >
                                Remover Setor/Cargo
                              </button>
                            </div>
                          )}
                          
                          {/* Select Setor */}
                          <CustomDropdown
                            label="Setor *"
                            placeholder="Selecione o setor..."
                            value={combo.setor}
                            options={sectors}
                            size="lg"
                            onChange={(sec) => {
                              const newCombos = [...combos];
                              newCombos[index] = { setor: sec, cargo: "" };
                              setCombos(newCombos);
                              fetchCargosParaSetor(sec);
                            }}
                            icon={<Building size={18} strokeWidth={2.25} />}
                          />

                          {/* Select Cargo */}
                          <CustomDropdown
                            label="Cargo *"
                            placeholder={combo.setor ? "Selecione o cargo..." : "Selecione o setor primeiro"}
                            value={combo.cargo}
                            options={cargosPorSetor[combo.setor] || []}
                            size="lg"
                            onChange={(carg) => {
                              const newCombos = [...combos];
                              newCombos[index].cargo = carg;
                              setCombos(newCombos);
                            }}
                            icon={<Briefcase size={18} strokeWidth={2.25} />}
                            disabled={!combo.setor}
                          />
                        </div>
                      ))}
                      
                      <button
                        type="button"
                        onClick={() => setCombos([...combos, { setor: "", cargo: "" }])}
                        className="w-full py-3.5 border border-dashed border-slate-300 hover:border-[#075618] hover:bg-slate-50/50 rounded-2xl text-xs font-bold text-slate-600 hover:text-[#075618] transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider cursor-pointer"
                      >
                        + Adicionar outro Cargo/Setor
                      </button>
                    </motion.div>
                  </div>
                )}

                {/* Email / Usuário Input */}
                <motion.div variants={fieldVariants} className="relative group flex items-center bg-slate-100/50 hover:bg-slate-100/80 focus-within:bg-white border-2 border-[#075618]/50 group-hover:border-[#075618]/80 focus-within:border-[#075618] rounded-2xl transition-all duration-300 focus-within:ring-4 focus-within:ring-[#075618]/10 shadow-[0_2px_10px_rgba(0,0,0,0.04)] focus-within:shadow-md">
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
                </motion.div>
                {mode === "signup" && (
                  <p className="text-[10px] text-slate-500 font-medium pl-1 -mt-2">
                    Use seu e-mail institucional (@labcedro.com.br).
                  </p>
                )}

                {/* Password Input */}
                {mode !== "forgot" && (
                  <motion.div variants={fieldVariants} className="relative group flex items-center bg-slate-100/50 hover:bg-slate-100/80 focus-within:bg-white border-2 border-[#075618]/50 group-hover:border-[#075618]/80 focus-within:border-[#075618] rounded-2xl transition-all duration-300 focus-within:ring-4 focus-within:ring-[#075618]/10 shadow-[0_2px_10px_rgba(0,0,0,0.04)] focus-within:shadow-md">
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
                  </motion.div>
                )}

                {/* Checkbox for Lembrar-me */}
                {mode === "login" && (
                  <motion.div variants={fieldVariants} className="flex items-center justify-between pt-1 select-none">
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
                  </motion.div>
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
                <motion.div variants={fieldVariants}>
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
                </motion.div>

                {mode === "forgot" && (
                  <motion.div variants={fieldVariants}>
                    <button
                      type="button"
                      onClick={() => { setMode("login"); setMessage(null); }}
                      className="w-full py-3.5 bg-slate-100 hover:bg-slate-200/80 active:scale-[0.99] text-slate-700 font-bold rounded-xl transition-all flex items-center justify-center text-sm cursor-pointer shadow-sm focus:outline-none focus:ring-4 focus:ring-slate-200"
                    >
                      Cancelar
                    </button>
                  </motion.div>
                )}
              </form>

              {/* Switch mode */}
              {mode !== "forgot" && (
                <motion.div variants={fieldVariants} className="mt-6 text-center">
                  <button
                    type="button"
                    onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(null); }}
                    className="text-slate-600 text-xs hover:text-[#075618] hover:underline transition-colors cursor-pointer"
                  >
                    {mode === "login" ? "Ainda não tem acesso? Cadastre-se" : "Já possui uma conta? Faça Login"}
                  </button>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
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
