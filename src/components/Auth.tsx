import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, User, ArrowRight, Loader2, Building, Briefcase, Phone } from "lucide-react";
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
  const [setor, setSetor] = useState("");
  const [cargo, setCargo] = useState("");
  const [cargosDisponiveis, setCargosDisponiveis] = useState<string[]>([]);
  const [sectors, setSectors] = useState<string[]>([]);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    getSectors().then(setSectors);
  }, []);

  useEffect(() => {
    if (!setor) {
      setCargosDisponiveis([]);
      setCargo("");
      return;
    }

    const loadCargos = async () => {
      try {
        const { data, error } = await supabase
          .from("sectors")
          .select("cargos")
          .eq("name", setor)
          .maybeSingle();

        if (!error && data && Array.isArray(data.cargos) && data.cargos.length > 0) {
          setCargosDisponiveis(data.cargos);
          setCargo("");
          return;
        }
      } catch (err) {
        console.error("Erro ao carregar cargos do Supabase em Auth:", err);
      }

      try {
        const rawDetails = localStorage.getItem("cedro_sectors_details_v2");
        if (rawDetails) {
          const details = JSON.parse(rawDetails);
          if (details[setor]?.cargos?.length > 0) {
            setCargosDisponiveis(details[setor].cargos);
            setCargo("");
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
      setCargosDisponiveis(PRESET_CARGOS[setor] || ["Colaborador"]);
      setCargo("");
    };

    loadCargos();
  }, [setor]);

  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    try {
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

        if (!setor) {
          setMessage({ type: "error", text: "Por favor, selecione seu setor." });
          setLoading(false);
          return;
        }
        if (!cargo.trim()) {
          setMessage({ type: "error", text: "Por favor, selecione seu cargo / função." });
          setLoading(false);
          return;
        }
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
              setor: setor,
              cargo: cargo.trim(),
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
              setor: setor,
              cargo: cargo.trim(),
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
            setor: setor,
            cargo: cargo.trim(),
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
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#F6F8F5] overflow-y-auto lg:overflow-hidden font-sans">
      
      {/* COLUNA ESQUERDA (lg:w-1/2) — Painel institucional decorativo */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#003F1D] flex-col justify-center items-center p-12 relative overflow-hidden">
        {/* LabBackground as decorative background with opacity-10 */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <LabBackground />
        </div>
 
        {/* Logo centralizada */}
        <div className="z-10 flex flex-col items-center justify-center">
          <img 
            src="https://raw.githubusercontent.com/nitlabcedro/assets/refs/heads/main/Ativo%206.png" 
            alt="Cedro IA – Laboratório Cedro" 
            className="h-56 w-auto brightness-0 invert transition-all" 
          />
          <h1 className="text-white font-black text-3xl font-display tracking-wider mt-4">Cedro IA</h1>
        </div>
      </div>
 
      {/* COLUNA DIREITA (lg:w-1/2) — Formulário */}
      <div className="w-full lg:w-1/2 flex items-center justify-center min-h-screen bg-[#F9FBF8] p-6 lg:p-12 xl:p-16">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 85, damping: 20 }}
          className="w-full max-w-md lg:max-w-none lg:w-[70%] bg-white border-0 lg:border border-slate-100/80 rounded-none lg:rounded-[3rem] shadow-none lg:shadow-[0_32px_64px_rgba(3,68,12,0.04)] p-8 lg:p-16 xl:p-20 relative z-10 flex flex-col justify-between"
        >
          {/* Top block */}
          <div className="mb-8 flex flex-col items-center lg:items-start select-none w-full">
            {/* Minimalist touch for mobile: show logo only on mobile to identify the brand, with dark filter, above the title */}
            <div className="block lg:hidden mb-6 flex flex-col items-center">
              <img 
                src="https://raw.githubusercontent.com/nitlabcedro/assets/refs/heads/main/Ativo%206.png" 
                alt="Cedro IA – Laboratório Cedro" 
                className="h-28 w-auto [filter:var(--logo-filter)]" 
              />
              <span className="text-[#075618] font-black text-xl font-display tracking-wider mt-2 text-center">Cedro IA</span>
            </div>

            <h2 className="text-3xl font-black text-[#1F2933] uppercase tracking-tight font-display text-center lg:text-left w-full font-bold">
              {mode === "login" ? "Login" : "Cadastro"}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4.5">
            <AnimatePresence mode="wait">
              {mode === "signup" && (
                <motion.div
                  key="signup-fields"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden space-y-4.5"
                >
                  <div className="relative">
                    <User className="absolute left-4.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      placeholder="Nome Completo"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-13 pr-4 py-4 bg-slate-50 hover:bg-slate-50/70 border border-slate-100/80 focus:border-[#075618]/50 focus:bg-white focus:ring-4 focus:ring-[#075618]/5 outline-none transition-all text-[#1F2933] font-semibold text-[13px] rounded-2xl placeholder:text-slate-400"
                    />
                  </div>
                  <div className="relative">
                    <Building className="absolute left-4.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                    <select
                      required
                      value={setor}
                      onChange={(e) => setSetor(e.target.value)}
                      className="w-full pl-13 pr-10 py-4 bg-slate-50 hover:bg-slate-50/70 border border-slate-100/80 focus:border-[#075618]/50 focus:bg-white focus:ring-4 focus:ring-[#075618]/5 outline-none transition-all text-[#1F2933] font-semibold text-[13px] rounded-2xl appearance-none placeholder:text-slate-400 cursor-pointer"
                    >
                      <option value="" className="text-slate-400 font-medium">Selecione seu setor *</option>
                      {sectors.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="relative">
                    <Briefcase className="absolute left-4.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                    <select
                      required
                      disabled={!setor}
                      value={cargo}
                      onChange={(e) => setCargo(e.target.value)}
                      className="w-full pl-13 pr-10 py-4 bg-slate-50 hover:bg-slate-50/70 disabled:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed border border-slate-100/80 focus:border-[#075618]/50 focus:bg-white focus:ring-4 focus:ring-[#075618]/5 outline-none transition-all text-[#1F2933] font-semibold text-[13px] rounded-2xl appearance-none cursor-pointer placeholder:text-slate-400"
                    >
                      <option value="" className="text-slate-400 font-medium">{setor ? "Selecione seu cargo / função *" : "Selecione o setor primeiro"}</option>
                      {cargosDisponiveis.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative">
              <Mail className="absolute left-4.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="email"
                placeholder={mode === "signup" ? "seuemail@labcedro.com.br" : "E-mail profissional"}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-13 pr-4 py-4 bg-slate-50 hover:bg-slate-50/70 border border-slate-100/80 focus:border-[#075618]/50 focus:bg-white focus:ring-4 focus:ring-[#075618]/5 outline-none transition-all text-[#1F2933] font-semibold text-[13px] rounded-2xl placeholder:text-slate-400"
              />
            </div>

            {mode === "signup" && (
              <p className="text-[10px] text-[#667085] font-medium -mt-2 pl-1">
                Use seu e-mail institucional (@labcedro.com.br) para se cadastrar.
              </p>
            )}

            <div className="relative">
              <Lock className="absolute left-4.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="password"
                placeholder="Senha"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-13 pr-4 py-4 bg-slate-50 hover:bg-slate-50/70 border border-slate-100/80 focus:border-[#075618]/50 focus:bg-white focus:ring-4 focus:ring-[#075618]/5 outline-none transition-all text-[#1F2933] font-semibold text-[13px] rounded-2xl placeholder:text-slate-400"
              />
            </div>

            {message && (
              <div className={`p-4 rounded-2xl text-xs font-semibold ${
                message.type === "success" ? "bg-[#EAF4EC]" : "bg-red-50 text-red-500 border border-red-100/40"
              } flex items-start gap-2.5 transition-all`}>
                <span className={`size-1.5 rounded-full mt-1.5 shrink-0 ${message.type === "success" ? "bg-emerald-500" : "bg-red-500"}`} />
                <span className={message.type === "success" ? "text-[#075618]" : "text-red-500"}>
                  {message.text}
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4.5 bg-[#03440c] hover:bg-[#075618] active:scale-[0.99] text-white font-extrabold rounded-2xl transition-all flex items-center justify-center gap-2.5 mt-4 disabled:opacity-50 uppercase tracking-widest text-[11px] shadow-lg shadow-[#03440c]/10 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <>
                  {mode === "login" ? "Entrar na plataforma" : "Criar minha conta"}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center border-t border-slate-100/70 pt-6">
            <p className="text-slate-400 text-xs font-semibold">
              {mode === "login" ? "Ainda não tem acesso?" : "Já possui uma conta?"}
              <button
                onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(null); }}
                className="ml-2 text-[#075618] font-black hover:underline cursor-pointer"
              >
                {mode === "login" ? "Cadastre-se" : "Faça Login"}
              </button>
            </p>
          </div>
        </motion.div>
      </div>

    </div>
  );
};
