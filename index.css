import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { CustomDropdown } from "./CustomDropdown";
import { 
  User, 
  Mail, 
  Briefcase, 
  Building, 
  Phone, 
  Save, 
  Loader2, 
  Camera, 
  LogOut, 
  ShieldCheck, 
  ChevronRight, 
  ChevronDown,
  Calendar, 
  Lock, 
  Info, 
  AppWindow, 
  Sparkles,
  CheckCircle2,
  X
} from "lucide-react";
import { getSectors } from "../storage";

export const UserProfileView: React.FC = () => {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || "",
    cargo: profile?.cargo || "",
    setor: profile?.setor || "",
    contato: profile?.contato || "",
    avatar_url: profile?.avatar_url || ""
  });
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sectors, setSectors] = useState<string[]>([]);
  const [avatarPreview, setAvatarPreview] = useState<string>(profile?.avatar_url || "");
  const [cargosDisponiveis, setCargosDisponiveis] = useState<string[]>([]);
  const [editCombos, setEditCombos] = useState<Array<{ setor: string; cargo: string }>>([]);
  const [cargosPorSetor, setCargosPorSetor] = useState<Record<string, string[]>>({});

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
      console.error("Erro ao carregar cargos do Supabase em UserProfileView:", err);
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

  useEffect(() => {
    editCombos.forEach(combo => {
      if (combo.setor) {
        fetchCargosParaSetor(combo.setor);
      }
    });
  }, [editCombos]);

  useEffect(() => {
    const currentSector = formData.setor;
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
        console.error("Erro ao carregar cargos do Supabase em UserProfileView:", err);
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
        console.error("Error getting cargos in profile view:", e);
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
  }, [formData.setor]);

  // Password alteration modal state
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const fetchSectors = async () => {
      const list = await getSectors();
      setSectors(list);
    };
    fetchSectors();
  }, []);

  // Sincroniza os dados locais com o perfil global da sessão de maneira reativa e otimista
  useEffect(() => {
    if (profile) {
      const defaultContato = profile.contato || user?.email || "";
      setFormData({
        full_name: profile.full_name || "",
        cargo: profile.cargo || "",
        setor: profile.setor || "",
        contato: defaultContato,
        avatar_url: profile.avatar_url || ""
      });
      setAvatarPreview(profile.avatar_url || "");

      const sList = (profile.setor || "").split(";").map(s => s.trim()).filter(Boolean);
      const cList = (profile.cargo || "").split(";").map(c => c.trim()).filter(Boolean);
      const list = sList.length > 0 ? sList.map((sec, idx) => ({
        setor: sec,
        cargo: cList[idx] || "Colaborador"
      })) : [{ setor: "", cargo: "" }];
      setEditCombos(list);

      // Se o campo de contato na tabela profiles estiver vazio no banco de dados e tivermos o email do usuario
      if (!profile.contato && user?.email) {
        console.log("Sincronizando silenciosamente o contato com o email do auth do usuario:", user.email);
        supabase
          .from("profiles")
          .update({ contato: user.email })
          .eq("id", user.id)
          .then(({ error }) => {
            if (!error) {
              console.log("Contato sincronizado na tabela de profiles do Supabase com sucesso!");
              refreshProfile({ contato: user.email }, true).catch(() => {});
            }
          });
      }
    }
  }, [profile, user]);

  useEffect(() => {
    if (user?.id) {
      refreshProfile();
    }
  }, [user?.id]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setMessage(null);

      if (!user) {
        throw new Error("Usuário não encontrado para atualizar a foto.");
      }

      const file = e.target.files?.[0];

      if (!file) {
        return;
      }

      const localPreviewUrl = URL.createObjectURL(file);

      setAvatarPreview(localPreviewUrl);
      setFormData(prev => ({
        ...prev,
        avatar_url: localPreviewUrl
      }));

      // Atualiza o contexto global do perfil de forma instantânea/otimista
      refreshProfile({ avatar_url: localPreviewUrl }, true).catch((err) => {
        console.error("Erro ao atualizar o avatar de forma otimista:", err);
      });

      setUploading(true);

      // Conversão do arquivo selecionado para Base64
      const reader = new FileReader();
      const fileLoadedPromise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64Str = result.split(",")[1];
          resolve(base64Str);
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
      });

      const base64Data = await fileLoadedPromise;

      // Obter o token de autenticação atualizado para validar a requisição na API
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error("Sessão não encontrada ou expirada. Faça login novamente.");
      }

      // Enviar via proxy seguro no servidor
      const response = await fetch("/api/avatar/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          fileBase64: base64Data,
          fileName: file.name,
          fileType: file.type
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Erro de rede no servidor: ${response.status}`);
      }

      const resJson = await response.json();
      const finalAvatarUrl = `${resJson.publicUrl}?t=${Date.now()}`;

      setAvatarPreview(finalAvatarUrl);

      setFormData(prev => ({
        ...prev,
        avatar_url: finalAvatarUrl
      }));

      refreshProfile({ avatar_url: finalAvatarUrl }).catch((err) => {
        console.error("Erro ao atualizar perfil após upload:", err);
      });

      setMessage({ type: "success", text: "Foto atualizada com sucesso." });
    } catch (err: any) {
      console.error("Erro ao atualizar foto:", err);
      setMessage({ type: "error", text: err.message || "Não foi possível atualizar a foto." });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const toggleAdminMode = async () => {
    if (!user) return;
    const newRole = profile?.role === "admin" ? "user" : "admin";
    try {
      setLoading(true);
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole })
        .eq("id", user.id);
      
      if (error) throw error;
      await refreshProfile();
      setMessage({ type: "success", text: `Modo Administrador ${newRole === "admin" ? "ativado" : "desativado"} com sucesso!` });
    } catch (err: any) {
      console.error("Erro ao alternar modo admin:", err);
      setMessage({ type: "error", text: "Não foi possível alternar o modo administrador." });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    setMessage(null);

    const isCurrentUserAdmin = profile?.role?.toLowerCase().trim() === "admin";
    let updatedFormData = { ...formData };

    if (isCurrentUserAdmin) {
      const validCombos = editCombos.filter(c => c.setor && c.cargo);
      if (validCombos.length === 0) {
        setMessage({ type: "error", text: "Por favor, adicione pelo menos uma atribuição de setor e cargo / função." });
        setLoading(false);
        return;
      }

      const finalSetor = validCombos.map(c => c.setor.trim()).join("; ");
      const finalCargo = validCombos.map(c => c.cargo.trim()).join("; ");

      updatedFormData = {
        ...formData,
        setor: finalSetor,
        cargo: finalCargo
      };
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          ...updatedFormData,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      
      await refreshProfile(updatedFormData);
      setMessage({ type: "success", text: "Perfil atualizado com sucesso!" });
      setTimeout(() => setMessage(null), 5000);
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Erro ao atualizar perfil" });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "As senhas informadas não coincidem." });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordMessage({ type: "error", text: "A nova senha deve possuir pelo menos 6 caracteres." });
      return;
    }

    try {
      setPasswordLoading(true);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      
      if (error) throw error;
      
      setPasswordMessage({ type: "success", text: "Senha corporativa atualizada com sucesso!" });
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setIsPasswordModalOpen(false);
        setPasswordMessage(null);
      }, 2500);
    } catch (err: any) {
      setPasswordMessage({ type: "error", text: err.message || "Erro ao atualizar senha." });
    } finally {
      setPasswordLoading(false);
    }
  };

  // Human readable registration date
  const formattedCreatedDate = user?.created_at 
    ? new Date(user.created_at).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })
    : "Março de 2026";

  const isCurrentUserAdmin = profile?.role?.toLowerCase().trim() === "admin";
  const isNitMember = (profile?.setor || "")
    .split(";")
    .map(s => s.trim().toUpperCase())
    .includes("NIT");
  const avatarSrc = avatarPreview || "";

  const itemVariants = {
    hidden: { opacity: 0, y: 6 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { type: "spring", stiffness: 220, damping: 22 } 
    }
  };

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: 0.05
          }
        }
      }}
      className="w-full max-w-none select-none tracking-tight"
    >
      <div className="space-y-8">
        {/* CARD HERO DO PERFIL */}
        <motion.div 
          variants={{
            hidden: { opacity: 0, y: 8 },
            visible: { 
              opacity: 1, 
              y: 0, 
              transition: { type: "spring", stiffness: 180, damping: 20 }
            }
          }}
          className="bg-white border border-[#E3E8E1] rounded-3xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden"
        >
          {/* Subtle decorative glowing background blur */}
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-[#075618]/5 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-[#F29222]/5 rounded-full blur-2xl pointer-events-none" />

          <div className="flex flex-col md:flex-row items-center gap-6 z-10 w-full">
            {/* Avatar container with solid green border */}
            <motion.div 
              whileHover={{ scale: 1.03 }}
              className="relative shrink-0"
            >
              <div className="size-28 md:size-32 rounded-full p-1 bg-[#EAF4EC] border-2 border-[#075618] shadow-sm relative">
                <div className="w-full h-full rounded-full bg-white overflow-hidden flex items-center justify-center p-0.5">
                  {avatarSrc ? (
                    <div className="relative w-full h-full">
                      <img 
                        src={avatarSrc} 
                        alt="Avatar Usuário" 
                        className="w-full h-full object-cover rounded-full" 
                        referrerPolicy="no-referrer"
                      />

                      {uploading && (
                        <div className="absolute inset-0 rounded-full bg-white/45 backdrop-blur-[1px] flex items-center justify-center">
                          <Loader2 className="animate-spin text-[#075618] w-7 h-7" />
                        </div>
                      )}
                    </div>
                  ) : uploading ? (
                    <Loader2 className="animate-spin text-[#075618] w-8 h-8" />
                  ) : (
                    <User size={48} className="text-slate-300" />
                  )}
                </div>
              </div>
              <motion.label 
                whileHover={{ scale: 1.1, backgroundColor: "#003F1D" }}
                whileTap={{ scale: 0.9 }}
                htmlFor="avatar-upload-hero"
                className={`absolute bottom-0 right-0 p-2.5 bg-[#075618] border-2 border-white text-white rounded-full shadow-md transition-all flex items-center justify-center ${uploading ? "opacity-60 pointer-events-none cursor-not-allowed" : "cursor-pointer"}`}
                title="Modificar imagem"
              >
                <Camera size={13} />
                <input 
                  id="avatar-upload-hero"
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleAvatarUpload}
                  disabled={uploading}
                />
              </motion.label>

              {uploading && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center">
                  <p className="text-xs font-bold text-amber-800">
                    Enviando foto...
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-amber-700">
                    Aguarde alguns segundos até a imagem ser salva no perfil.
                  </p>
                </div>
              )}
            </motion.div>

            {/* User Meta Information Group */}
            <div className="text-center md:text-left space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-center md:justify-start gap-2.5">
                <h2 className="text-2xl md:text-3xl font-black text-[#1F2933] tracking-tight">
                  {formData.full_name || user?.email?.split("@")[0] || "Membro Cedro"}
                </h2>
                <motion.span 
                  whileHover={{ scale: 1.05 }}
                  className="w-fit self-center px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-700 rounded-full text-[10px] font-extrabold uppercase tracking-widest leading-none shadow-3xs select-none cursor-default"
                >
                  {profile?.role === "admin" ? "Administrador" : "Colaborador"}
                </motion.span>
                <motion.span 
                  whileHover={{ scale: 1.05 }}
                  className="w-fit self-center px-3 py-1 bg-[#EAF4EC] border border-[#BFD8C5] text-[#075618] rounded-full text-[10px] font-extrabold uppercase tracking-widest leading-none shadow-3xs select-none cursor-default"
                >
                  Ativo
                </motion.span>
              </div>
              
              <div className="flex flex-wrap gap-2 justify-center md:justify-start mt-2">
                {(() => {
                  const sectors = (formData.setor || "").split(";").map(s => s.trim()).filter(Boolean);
                  const cargos = (formData.cargo || "").split(";").map(c => c.trim()).filter(Boolean);
                  
                  if (sectors.length === 0) {
                    return (
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold">
                        Nenhuma atribuição declarada
                      </span>
                    );
                  }
                  
                  return sectors.map((sec, idx) => {
                    const carg = cargos[idx] || "Colaborador";
                    return (
                      <motion.div 
                        key={idx} 
                        whileHover={{ scale: 1.03, y: -1 }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#EAF4EC] border border-[#BFD8C5]/60 text-slate-800 rounded-xl text-xs font-bold shadow-3xs cursor-default"
                      >
                        <span className="text-[#075618] uppercase tracking-wide text-[9px] bg-[#075618]/10 px-1.5 py-0.5 rounded-md font-extrabold">{sec}</span>
                        <span className="text-slate-600 text-[11px] font-semibold">{carg}</span>
                      </motion.div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>

          {/* Sair da Conta Button right-aligned with red outline styling */}
          <div className="z-10 shrink-0 md:self-center w-full md:w-auto">
            <motion.button 
              whileHover={{ scale: 1.03, backgroundColor: "#FEE4E2" }}
              whileTap={{ scale: 0.98 }}
              onClick={() => signOut()}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-[#FEF3F2] text-[#B42318] border border-[#FECDCA] rounded-2xl transition-all text-xs font-bold uppercase tracking-wider cursor-pointer shadow-3xs shrink-0"
            >
              <LogOut size={14} />
              Sair da Conta
            </motion.button>
          </div>
        </motion.div>

        {/* COMPOSIÇÃO DE DUAS COLUNAS ABAIXO DO HERO */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8" style={{ perspective: 1200 }}>
          
          {/* COLUNA ESQUERDA: CARDS MENORES */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* CARD 1: RESUMO DO PERFIL */}
            <motion.div 
              variants={{
                hidden: { opacity: 0, y: 12 },
                visible: { 
                  opacity: 1, 
                  y: 0,
                  transition: { type: "spring", stiffness: 180, damping: 20 }
                }
              }}
              className="bg-white border border-[#E3E8E1] rounded-3xl p-6 md:p-7 shadow-sm relative overflow-hidden"
            >
              <div className="flex items-center gap-3 mb-4.5 pb-4 border-b border-[#E3E8E1]">
                <div>
                  <h4 className="text-sm font-black text-[#1F2933] uppercase tracking-tight">Resumo do Perfil</h4>
                </div>
              </div>

              <div className="space-y-4">
                {/* Usuário desde row */}
                <motion.div variants={itemVariants} className="flex items-center gap-3.5">
                  <div className="p-2 bg-[#F6F8F5] border border-[#E3E8E1] rounded-lg text-[#667085] shrink-0">
                    <Calendar size={14} />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-[#667085] uppercase tracking-tight">Usuário Desde</p>
                    <p className="text-xs font-bold text-[#1F2933] mt-0.5">{formattedCreatedDate}</p>
                  </div>
                </motion.div>

                {/* Último acesso row */}
                <motion.div variants={itemVariants} className="flex items-center gap-3.5">
                  <div className="p-2 bg-[#F6F8F5] border border-[#E3E8E1] rounded-lg text-[#667085] shrink-0">
                    <Sparkles size={14} />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-[#667085] uppercase tracking-tight">Autorização de Acesso</p>
                    <p className="text-xs font-bold text-[#1F2933] mt-0.5">Sessão estabelecida e ativa</p>
                  </div>
                </motion.div>

                {/* Ativar Modo Administrador Switch/Button */}
                {isNitMember && (
                  <motion.div variants={itemVariants} className="pt-4 border-t border-[#E3E8E1]">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      disabled={loading}
                      onClick={toggleAdminMode}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider shadow-3xs ${
                        profile?.role === "admin"
                          ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200"
                          : "bg-emerald-50 hover:bg-emerald-100 text-[#075618] border border-emerald-200"
                      }`}
                    >
                      <ShieldCheck size={14} />
                      {profile?.role === "admin" ? "Desativar Modo Admin" : "Ativar Modo Admin"}
                    </motion.button>
                  </motion.div>
                )}




              </div>
            </motion.div>

          </div>

          {/* COLUNA DIREITA: CARD GRANDE DE INFORMAÇÕES PESSOAIS */}
          <div className="lg:col-span-2">
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 12 },
                visible: { 
                  opacity: 1, 
                  y: 0, 
                  transition: { type: "spring", stiffness: 180, damping: 20 }
                }
              }}
              className="bg-white border border-[#E3E8E1] rounded-3xl p-6 md:p-8 shadow-sm relative"
            >
              <div className="mb-6 pb-5 border-b border-[#E3E8E1] select-none">
                <h3 className="text-lg font-black text-[#1F2933] uppercase tracking-tight">Informações Pessoais</h3>
              </div>

              <form onSubmit={handleUpdate} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  
                  {/* Nome Completo field */}
                  <motion.div variants={itemVariants} className="space-y-2">
                    <label className="text-[10px] font-bold text-[#667085] uppercase tracking-widest ml-1 select-none flex items-center gap-1">
                      <User size={12} className="text-[#075618]" /> Nome Completo
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="w-full px-5 py-4 bg-white border border-[#E3E8E1] rounded-2xl focus:border-[#075618] focus:ring-4 focus:ring-[#075618]/5 outline-none transition-all text-sm text-[#1F2933] font-bold shadow-3xs"
                      placeholder="Ex: Carlos Ferreira"
                    />
                  </motion.div>

                  {/* E-mail (Disabled, informational only) */}
                  <motion.div variants={itemVariants} className="space-y-2">
                    <label className="text-[10px] font-bold text-[#667085] uppercase tracking-widest ml-1 select-none flex items-center gap-1">
                      <Mail size={12} className="text-[#075618]" /> E-mail Credenciado
                    </label>
                    <input
                      type="text"
                      value={user?.email || ""}
                      disabled
                      className="w-full px-5 py-4 bg-[#F6F8F5] border border-[#E3E8E1] rounded-2xl text-sm text-[#667085] font-medium cursor-not-allowed select-none"
                    />
                  </motion.div>

                  {/* Cargo/Setor (Editável se Administrador, caso contrário Apenas Leitura) */}
                  <motion.div variants={itemVariants} className="col-span-1 sm:col-span-2 space-y-3 pt-2">
                    <label className="text-[10px] font-bold text-[#667085] uppercase tracking-widest ml-1 select-none flex items-center gap-1">
                      <Building size={12} className="text-[#075618]" /> Cargo/Setor
                    </label>

                    {isCurrentUserAdmin ? (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {editCombos.map((combo, index) => (
                            <div key={index} className="p-4 bg-[#F6F8F5] border border-[#E3E8E1] rounded-2xl space-y-3 relative shadow-3xs">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-[#075618] uppercase tracking-wider">Atribuição #{index + 1}</span>
                                {editCombos.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newCombos = editCombos.filter((_, i) => i !== index);
                                      setEditCombos(newCombos);
                                    }}
                                    className="text-red-500 hover:text-red-700 text-xs font-bold transition-colors cursor-pointer uppercase tracking-wider"
                                  >
                                    Remover
                                  </button>
                                )}
                              </div>
                              
                              {/* Select Setor */}
                              <CustomDropdown
                                placeholder="Selecione o setor..."
                                value={combo.setor}
                                options={sectors}
                                onChange={(sec) => {
                                  const newCombos = [...editCombos];
                                  newCombos[index] = { setor: sec, cargo: "" };
                                  setEditCombos(newCombos);
                                  fetchCargosParaSetor(sec);
                                }}
                                icon={<Building size={14} />}
                                size="md"
                              />

                              {/* Select Cargo */}
                              <CustomDropdown
                                placeholder={combo.setor ? "Selecione o cargo..." : "Selecione o setor primeiro"}
                                value={combo.cargo}
                                options={cargosPorSetor[combo.setor] || []}
                                onChange={(carg) => {
                                  const newCombos = [...editCombos];
                                  newCombos[index].cargo = carg;
                                  setEditCombos(newCombos);
                                }}
                                icon={<Briefcase size={14} />}
                                disabled={!combo.setor}
                                size="md"
                              />
                            </div>
                          ))}
                        </div>
                        
                        <button
                          type="button"
                          onClick={() => setEditCombos([...editCombos, { setor: "", cargo: "" }])}
                          className="w-full py-3 border border-dashed border-slate-300 hover:border-[#075618] hover:bg-slate-50/50 rounded-2xl text-xs font-bold text-[#667085] hover:text-[#075618] transition-all flex items-center justify-center gap-1.5 uppercase tracking-wider cursor-pointer"
                        >
                          + Adicionar outro Cargo/Setor
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-wrap gap-2.5">
                        {(() => {
                          const sList = (profile?.setor || "").split(";").map(s => s.trim()).filter(Boolean);
                          const cList = (profile?.cargo || "").split(";").map(c => c.trim()).filter(Boolean);
                          
                          if (sList.length === 0) {
                            return (
                              <span className="px-3 py-1.5 bg-[#F6F8F5] text-[#667085] border border-[#E3E8E1] rounded-xl text-xs font-semibold">
                                Nenhuma atribuição declarada
                              </span>
                            );
                          }
                          
                          return sList.map((sec, idx) => {
                            const carg = cList[idx] || "Colaborador";
                            return (
                              <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-[#F6F8F5] border border-[#E3E8E1] text-[#1F2933] rounded-2xl text-xs font-bold shadow-3xs">
                                <span className="text-[#075618] uppercase tracking-wider text-[9px] bg-[#075618]/10 px-2 py-0.5 rounded-lg font-extrabold">{sec}</span>
                                <span className="text-[#1F2933] font-bold text-xs">{carg}</span>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </motion.div>

                  {/* URL da foto de perfil field */}
                  <motion.div variants={itemVariants} className="col-span-1 sm:col-span-2 space-y-2">
                    <label className="text-[10px] font-bold text-[#667085] uppercase tracking-widest ml-1 select-none flex items-center gap-1">
                      <Camera size={12} className="text-[#075618]" /> URL da foto de perfil
                    </label>
                    <input
                      type="url"
                      value={formData.avatar_url}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData({ ...formData, avatar_url: val });
                        setAvatarPreview(val);
                      }}
                      className="w-full px-5 py-4 bg-white border border-[#E3E8E1] rounded-2xl focus:border-[#075618] focus:ring-4 focus:ring-[#075618]/5 outline-none transition-all text-sm text-[#1F2933] font-bold shadow-3xs"
                      placeholder="https://exemplo.com/foto.jpg"
                    />
                  </motion.div>

                </div>

                {/* Feedback message display */}
                {message && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-2xl text-xs font-bold border leading-relaxed ${
                      message.type === "success" 
                        ? "bg-[#EAF4EC] border-[#BFD8C5] text-[#075618]" 
                        : "bg-[#FEF3F2] border-[#FECDCA] text-[#B42318]"
                    }`}
                  >
                    {message.text}
                  </motion.div>
                )}

                {/* Submit button using solid corporate primary green */}
                <motion.div variants={itemVariants}>
                  <motion.button
                    whileHover={{ scale: 1.015, backgroundColor: "#003F1D" }}
                    whileTap={{ scale: 0.995 }}
                    type="submit"
                    disabled={loading}
                    className="w-full py-4.5 bg-[#075618] text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-sm hover:shadow transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {loading ? (
                      <Loader2 className="animate-spin text-white" size={18} />
                    ) : (
                      <>
                        <Save size={18} />
                        Salvar Alterações
                      </>
                    )}
                  </motion.button>
                </motion.div>
              </form>
            </motion.div>
          </div>

        </div>
      </div>

      {/* DIALOG/MODAL COMPLETO DE ALTERAÇÃO DE SENHA CORPORATIVA */}
      <AnimatePresence>
        {isPasswordModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop layer */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPasswordModalOpen(false)}
              className="absolute inset-0 bg-[#1F2933]/40 backdrop-blur-xs"
            />
            
            {/* Modal Body */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl border border-[#E3E8E1] p-6 md:p-8 w-full max-w-md relative z-10 shadow-2xl"
            >
              <button 
                onClick={() => setIsPasswordModalOpen(false)}
                className="absolute top-5 right-5 p-1 text-[#667085] hover:text-[#1F2933] rounded-xl hover:bg-[#F6F8F5] transition-all cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-[#EAF4EC] text-[#075618] rounded-2xl shrink-0 border border-[#BFD8C5]">
                  <Lock size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-[#1F2933] uppercase tracking-tight">Alterar Senha</h3>
                  <p className="text-[10px] text-[#667085] font-semibold uppercase tracking-wider">Garanta a segurança de seus acessos</p>
                </div>
              </div>

              <form onSubmit={handlePasswordChange} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#667085] uppercase tracking-widest ml-1">Nova Senha Corporativa</label>
                  <input 
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 dígitos"
                    className="w-full px-4 py-3 bg-white border border-[#E3E8E1] rounded-2xl focus:border-[#075618] focus:ring-4 focus:ring-[#075618]/5 outline-none transition-all text-sm text-[#1F2933] font-semibold shadow-3xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#667085] uppercase tracking-widest ml-1">Confirmar Nova Senha</label>
                  <input 
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirmar nova senha"
                    className="w-full px-4 py-3 bg-white border border-[#E3E8E1] rounded-2xl focus:border-[#075618] focus:ring-4 focus:ring-[#075618]/5 outline-none transition-all text-sm text-[#1F2933] font-semibold shadow-3xs"
                  />
                </div>

                {passwordMessage && (
                  <div className={`p-4 rounded-2xl text-xs font-bold leading-relaxed border ${
                    passwordMessage.type === "success" 
                      ? "bg-[#EAF4EC] border-[#BFD8C5] text-[#075618]" 
                      : "bg-[#FEF3F2] border-[#FECDCA] text-[#B42318]"
                  }`}>
                    {passwordMessage.text}
                  </div>
                )}

                <div className="flex gap-3 justify-end pt-2">
                  <button 
                    type="button"
                    onClick={() => setIsPasswordModalOpen(false)}
                    className="px-5 py-3 border border-[#E3E8E1] text-[#667085] rounded-2xl hover:bg-[#F6F8F5] text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={passwordLoading}
                    className="px-6 py-3 bg-[#075618] hover:bg-[#003F1D] text-white rounded-2xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    {passwordLoading ? (
                      <Loader2 className="animate-spin text-white" size={14} />
                    ) : (
                      "Confirmar Nova Senha"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
