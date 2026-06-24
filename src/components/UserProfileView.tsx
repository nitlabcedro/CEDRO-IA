import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
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

      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/avatar-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;
      const finalAvatarUrl = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          avatar_url: finalAvatarUrl,
          updated_at: new Date().toISOString()
        })
        .eq("id", user.id);

      if (updateError) {
        throw updateError;
      }

      setAvatarPreview(finalAvatarUrl);

      setFormData(prev => ({
        ...prev,
        avatar_url: finalAvatarUrl
      }));

      refreshProfile({ avatar_url: finalAvatarUrl }).catch((err) => {
        console.error("Erro ao atualizar perfil após upload:", err);
      });

      setMessage({ type: "success", text: "Foto atualizada com sucesso." });
    } catch (err) {
      console.error("Erro ao atualizar foto:", err);
      setMessage({ type: "error", text: "Não foi possível atualizar a foto." });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          ...formData,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      
      await refreshProfile(formData);
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

  const avatarSrc = avatarPreview || "";

  return (
    <div className="w-full max-w-none select-none tracking-tight animate-fade-in">
      <div className="space-y-8">
        {/* CARD HERO DO PERFIL */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-[#E3E8E1] rounded-3xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden"
        >
          <div className="flex flex-col md:flex-row items-center gap-6 z-10 w-full">
            {/* Avatar container with solid green border */}
            <div className="relative shrink-0">
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
              <label 
                htmlFor="avatar-upload-hero"
                className={`absolute bottom-0 right-0 p-2.5 bg-[#075618] border-2 border-white text-white rounded-full shadow-md transition-all flex items-center justify-center ${uploading ? "opacity-60 pointer-events-none cursor-not-allowed" : "hover:bg-[#003F1D] active:scale-95 cursor-pointer"}`}
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
              </label>

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
            </div>

            {/* User Meta Information Group */}
            <div className="text-center md:text-left space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-center md:justify-start gap-2.5">
                <h2 className="text-2xl md:text-3xl font-black text-[#1F2933] tracking-tight">
                  {formData.full_name || user?.email?.split("@")[0] || "Membro Cedro"}
                </h2>
                <span className="w-fit self-center px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-700 rounded-full text-[10px] font-extrabold uppercase tracking-widest leading-none shadow-3xs select-none">
                  {profile?.role === "admin" ? "Administrador" : "Colaborador"}
                </span>
                <span className="w-fit self-center px-3 py-1 bg-[#EAF4EC] border border-[#BFD8C5] text-[#075618] rounded-full text-[10px] font-extrabold uppercase tracking-widest leading-none shadow-3xs select-none">
                  Ativo
                </span>
              </div>
              
              <p className="text-sm font-bold text-[#667085] flex items-center justify-center md:justify-start gap-1">
                <Briefcase size={14} className="text-[#075618] shrink-0" />
                {formData.cargo || "Função corporativa não declarada"}
              </p>
              
              <div className="h-px bg-[#E3E8E1] max-w-[280px] mx-auto md:mx-0 py-0"></div>
              
              <p className="text-xs text-[#667085] font-medium max-w-lg leading-relaxed">
                Setor: <span className="font-bold text-[#1F2933]">{formData.setor && formData.setor.trim() !== "" ? formData.setor : "Não informado"}</span>
              </p>
            </div>
          </div>

          {/* Sair da Conta Button right-aligned with red outline styling */}
          <div className="z-10 shrink-0 md:self-center w-full md:w-auto">
            <button 
              onClick={() => signOut()}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-[#FEF3F2] hover:bg-[#FEE4E2] text-[#B42318] border border-[#FECDCA] rounded-2xl active:scale-95 transition-all text-xs font-bold uppercase tracking-wider cursor-pointer shadow-3xs shrink-0"
            >
              <LogOut size={14} />
              Sair da Conta
            </button>
          </div>
        </motion.div>

        {/* COMPOSIÇÃO DE DUAS COLUNAS ABAIXO DO HERO */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* COLUNA ESQUERDA: CARDS MENORES */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* CARD 1: RESUMO DO PERFIL */}
            <motion.div 
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white border border-[#E3E8E1] rounded-3xl p-6 md:p-7 shadow-sm relative overflow-hidden"
            >
              <div className="flex items-center gap-3 mb-4.5 pb-4 border-b border-[#E3E8E1]">
                <div className="p-2.5 bg-[#EAF4EC] text-[#075618] rounded-xl border border-[#BFD8C5]">
                  <Info size={17} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-[#1F2933] uppercase tracking-tight">Resumo do Perfil</h4>
                </div>
              </div>

              <div className="space-y-4">
                {/* Usuário desde row */}
                <div className="flex items-center gap-3.5">
                  <div className="p-2 bg-[#F6F8F5] border border-[#E3E8E1] rounded-lg text-[#667085] shrink-0">
                    <Calendar size={14} />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-[#667085] uppercase tracking-tight">Usuário Desde</p>
                    <p className="text-xs font-bold text-[#1F2933] mt-0.5">{formattedCreatedDate}</p>
                  </div>
                </div>

                {/* Último acesso row */}
                <div className="flex items-center gap-3.5">
                  <div className="p-2 bg-[#F6F8F5] border border-[#E3E8E1] rounded-lg text-[#667085] shrink-0">
                    <Sparkles size={14} />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-[#667085] uppercase tracking-tight">Autorização de Acesso</p>
                    <p className="text-xs font-bold text-[#1F2933] mt-0.5">Sessão estabelecida e ativa</p>
                  </div>
                </div>




              </div>
            </motion.div>

          </div>

          {/* COLUNA DIREITA: CARD GRANDE DE INFORMAÇÕES PESSOAIS */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white border border-[#E3E8E1] rounded-3xl p-6 md:p-8 shadow-sm relative"
            >
              <div className="mb-6 pb-5 border-b border-[#E3E8E1] select-none">
                <h3 className="text-lg font-black text-[#1F2933] uppercase tracking-tight">Informações Pessoais</h3>
              </div>

              <form onSubmit={handleUpdate} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  
                  {/* Nome Completo field */}
                  <div className="space-y-2">
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
                  </div>

                  {/* Cargo field */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-[#667085] uppercase tracking-widest ml-1 select-none flex items-center gap-1">
                      <Briefcase size={12} className="text-[#075618]" /> Cargo
                    </label>
                    <div className="relative">
                      <select
                        required
                        value={formData.cargo}
                        onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                        className="w-full pl-5 pr-12 py-4 bg-white border border-[#E3E8E1] rounded-2xl focus:border-[#075618] focus:ring-4 focus:ring-[#075618]/5 outline-none transition-all text-sm appearance-none cursor-pointer text-[#1F2933] font-bold shadow-3xs"
                      >
                        <option value="">Selecione seu cargo...</option>
                        {(() => {
                          const distinctCargos = [...cargosDisponiveis];
                          if (formData.cargo && !distinctCargos.includes(formData.cargo)) {
                            distinctCargos.push(formData.cargo);
                          }
                          return distinctCargos.map((c: string) => (
                            <option key={c} value={c}>{c}</option>
                          ));
                        })()}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#667085]">
                        <svg className="size-4 fill-current opacity-70" viewBox="0 0 20 20">
                          <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Contato / E-mail de mensagens field */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-[#667085] uppercase tracking-widest ml-1 select-none flex items-center gap-1">
                      <Mail size={12} className="text-[#075618]" /> Contato / E-mail de Mensagens
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.contato}
                      onChange={(e) => setFormData({ ...formData, contato: e.target.value })}
                      className="w-full px-5 py-4 bg-white border border-[#E3E8E1] rounded-2xl focus:border-[#075618] focus:ring-4 focus:ring-[#075618]/5 outline-none transition-all text-sm text-[#1F2933] font-bold shadow-3xs"
                      placeholder="Ex: seu.nome@cedrolab.com.br"
                    />
                  </div>

                  {/* Setor de atuação field */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-[#667085] uppercase tracking-widest ml-1 select-none flex items-center gap-1">
                      <Building size={12} className="text-[#075618]" /> Setor de Atuação
                    </label>
                    <div className="relative">
                      {profile?.role === "admin" ? (
                        <>
                          <select
                            value={formData.setor}
                            onChange={(e) => setFormData({ ...formData, setor: e.target.value })}
                            className="w-full pl-5 pr-12 py-4 bg-white border border-[#E3E8E1] rounded-2xl focus:border-[#075618] focus:ring-4 focus:ring-[#075618]/5 outline-none transition-all text-sm appearance-none cursor-pointer text-[#1F2933] font-bold shadow-3xs"
                          >
                            <option value="">Selecione um departamento...</option>
                            {sectors.map((sec) => (
                              <option key={sec} value={sec}>{sec}</option>
                            ))}
                          </select>
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#667085]">
                            <svg className="size-4 fill-current opacity-70" viewBox="0 0 20 20">
                              <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                            </svg>
                          </div>
                        </>
                      ) : (
                        <input
                          type="text"
                          value={formData.setor}
                          disabled
                          className="w-full px-5 py-4 bg-[#F6F8F5] border border-[#E3E8E1] rounded-2xl text-sm text-[#667085] font-medium cursor-not-allowed select-none"
                          placeholder="Departamento Restrito"
                        />
                      )}
                    </div>
                  </div>

                  {/* E-mail (Disabled, informational only) */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-[#667085] uppercase tracking-widest ml-1 select-none flex items-center gap-1">
                      <Mail size={12} className="text-[#075618]" /> E-mail Credenciado
                    </label>
                    <input
                      type="text"
                      value={user?.email || ""}
                      disabled
                      className="w-full px-5 py-4 bg-[#F6F8F5] border border-[#E3E8E1] rounded-2xl text-sm text-[#667085] font-medium cursor-not-allowed select-none"
                    />
                  </div>

                  {/* URL da foto de perfil field */}
                  <div className="space-y-2">
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
                  </div>

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
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4.5 bg-[#075618] hover:bg-[#003F1D] text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-sm hover:shadow active:scale-[0.985] transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                >
                  {loading ? (
                    <Loader2 className="animate-spin text-white" size={18} />
                  ) : (
                    <>
                      <Save size={18} />
                      Salvar Alterações
                    </>
                  )}
                </button>
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
    </div>
  );
};
