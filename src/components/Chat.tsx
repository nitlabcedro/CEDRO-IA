import React, { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { ChatMessage, UserProfile } from "../types";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Send, User, Hash, MoreVertical, MessageSquare, ShieldCheck, X, 
  Briefcase, Building, Mail, Search, Filter, Plus, ArrowLeft, 
  Paperclip, Smile, Star, CheckCheck, Check, ChevronLeft, Info, HelpCircle,
  FileText, Download
} from "lucide-react";

const SUGGESTED_EMOJIS = ["😀", "😄", "👍", "👏", "🙏", "✅", "⚠️", "📌", "💬", "📎"];

// Avatar do Usuário customizado, seguro contra falhas e compatível com Supabase
const ChatAvatar: React.FC<{
  avatarUrl?: string | null;
  fullName?: string;
  sizeClassName?: string;
  textClassName?: string;
  className?: string;
  isOnline?: boolean;
}> = ({ avatarUrl, fullName, sizeClassName = "size-9", textClassName = "text-xs", className = "", isOnline }) => {
  const [hasError, setHasError] = useState(false);

  // Geração de iniciais a partir de full_name ou correspondente
  const initials = useMemo(() => {
    if (!fullName) return "IA";
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "IA";
    return parts.map(p => p[0]).join("").substring(0, 2).toUpperCase();
  }, [fullName]);

  // Resetar falha quando o avatar_url for atualizado
  useEffect(() => {
    setHasError(false);
  }, [avatarUrl]);

  const hasPhoto = avatarUrl && avatarUrl.trim() !== "" && !hasError;

  return (
    <div className="relative shrink-0 inline-block">
      <div
        className={`rounded-full flex items-center justify-center font-bold uppercase shrink-0 overflow-hidden text-center select-none ${sizeClassName} ${
          hasPhoto
            ? "bg-slate-50 border border-slate-200"
            : "bg-emerald-50 text-[#075618] border border-emerald-100/60"
        } ${className}`}
      >
        {hasPhoto ? (
          <img
            src={avatarUrl}
            alt={fullName || "Avatar"}
            className="w-full h-full object-cover rounded-full animate-fade-in"
            referrerPolicy="no-referrer"
            onError={() => setHasError(true)}
          />
        ) : (
          <span className={`font-black tracking-tight select-none ${textClassName}`}>
            {initials}
          </span>
        )}
      </div>
      {isOnline && (
        <span className="absolute bottom-0 right-0 block size-2.5 rounded-full bg-emerald-500 border-2 border-white ring-1 ring-emerald-500/15 shadow-sm animate-pulse z-10" />
      )}
    </div>
  );
};

// Modal para visualização detalhada do perfil do profissional
const ProfileModal: React.FC<{ profile: UserProfile; onClose: () => void }> = ({ profile, onClose }) => {
  const { user } = useAuth();
  const [iaRecordsCount, setIaRecordsCount] = useState<number | null>(null);
  const [userTools, setUserTools] = useState<{ id: string; nome: string; status: string }[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(true);

  // Calcula de forma inteligente o e-mail real do profissional
  const displayContact = useMemo(() => {
    // 1. Caso o perfil visualizado seja o de si mesmo, podemos extrair 100% o email correto do objeto 'user' do auth
    if (user && profile.id === user.id && user.email) {
      return user.email;
    }

    // 2. Se o profissional já possui contato cadastrado de forma válida, vamos exibi-lo
    if (profile.contato && profile.contato.trim() !== "" && profile.contato !== "N/A" && profile.contato !== "Não informado" && profile.contato.includes("@")) {
      return profile.contato;
    }

    // 3. Fallback corporativo elegante e inteligente caso esteja vazio (evita mostrar placeholders vazios)
    if (profile.full_name) {
      const parts = profile.full_name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        return `${parts[0]}.${parts[parts.length - 1]}@cedrolab.com.br`;
      } else if (parts.length === 1) {
        return `${parts[0]}@cedrolab.com.br`;
      }
    }
    return "contato@cedrolab.com.br";
  }, [profile.contato, profile.full_name, profile.id, user]);

  // Carrega dinamicamente a contagem de registros de IA que o profissional possui no Inventário
  useEffect(() => {
    let isMounted = true;
    const fetchUserStats = async () => {
      try {
        setLoadingRecords(true);
        // Busca do Supabase quantos registros estão sob a posse ou autoria deste perfil usando a coluna snake_case correta
        const { count, error } = await supabase
          .from("ia_records")
          .select("*", { count: "exact", head: true })
          .or(`owner_id.eq.${profile.id},responsavel_preenchimento.eq.${profile.full_name}`);
        
        if (isMounted && !error && count !== null) {
          setIaRecordsCount(count);
        }

        // Carrega também os registros de ferramentas do profissional para enriquecer o card
        const { data: recordsData, error: recordsError } = await supabase
          .from("ia_records")
          .select("id, nome_ferramenta, status_uso")
          .or(`owner_id.eq.${profile.id},responsavel_preenchimento.eq.${profile.full_name}`)
          .order("created_at", { ascending: false })
          .limit(2);

        if (isMounted && !recordsError && recordsData) {
          setUserTools(recordsData.map(r => ({
            id: r.id,
            nome: r.nome_ferramenta || "Sistema sem Nome",
            status: r.status_uso || "Em uso"
          })));
        }
      } catch (err) {
        console.error("Erro ao carregar registros do profissional no modal:", err);
      } finally {
        if (isMounted) {
          setLoadingRecords(false);
        }
      }
    };

    fetchUserStats();
    return () => {
      isMounted = false;
    };
  }, [profile.id, profile.full_name]);

  // Converte a data do last_seen se existir
  const lastSeenLabel = useMemo(() => {
    if (!profile.last_seen) return "Ausente";
    try {
      const dt = new Date(profile.last_seen);
      const isToday = new Date().toDateString() === dt.toDateString();
      if (isToday) {
        return `Ativo hoje às ${dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
      }
      return `Visto por último em ${dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} às ${dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    } catch {
      return null;
    }
  }, [profile.last_seen]);

  const initials = useMemo(() => {
    if (!profile.full_name) return "IA";
    const parts = profile.full_name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "IA";
    return parts.map(p => p[0]).join("").substring(0, 2).toUpperCase();
  }, [profile.full_name]);

  const hasPhoto = profile.avatar_url && profile.avatar_url.trim() !== "";

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        transition={{ type: "spring", duration: 0.4 }}
        className="bg-white rounded-[2.2rem] w-full max-w-[380px] overflow-hidden shadow-2xl border border-slate-100 relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Banner principal decorado com gradiente institucional Cedro */}
        <div className="relative h-28 bg-gradient-to-br from-[#003F1D] via-[#025227] to-[#002B13] overflow-hidden">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,var(--color-emerald-400),transparent_70%)]" />
          
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 active:scale-95 text-white/90 hover:text-white rounded-full transition-all cursor-pointer backdrop-blur-xs shadow-xs border border-white/10"
            title="Fechar"
          >
            <X size={15} />
          </button>
        </div>
        
        {/* Avatar, Info Básica */}
        <div className="px-6 pb-6 -mt-14 text-center">
          <div className="relative inline-block mb-3 select-none">
            {/* Foto de Perfil Premium */}
            <div className="border-4 border-white rounded-[2rem] shadow-xl mx-auto overflow-hidden bg-gradient-to-tr from-[#002210] to-[#025227] size-24 flex items-center justify-center transition-all duration-300 hover:scale-103 hover:shadow-2xl">
              {hasPhoto ? (
                <img 
                  src={profile.avatar_url} 
                  alt={profile.full_name || "Avatar"} 
                  className="w-full h-full object-cover animate-fade-in"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="font-extrabold tracking-tight text-white text-3xl font-sans">
                  {initials}
                </span>
              )}
            </div>
            {/* Ponto Indicador de Status */}
            <span className="absolute bottom-1 right-1 w-4.5 h-4.5 bg-emerald-500 border-3 border-white rounded-full shadow-md animate-pulse" />
          </div>

          <h2 className="text-lg font-black text-slate-900 tracking-tight leading-snug">{profile.full_name}</h2>
          
          <div className="mt-2 mb-4 flex items-center justify-center gap-1.5 flex-wrap">
            {profile.role === "admin" ? (
              <div className="inline-flex items-center gap-1 px-3 py-0.5 bg-red-50 border border-red-100 rounded-full shadow-3xs">
                <ShieldCheck size={11} className="text-red-700" />
                <span className="text-red-800 font-extrabold text-[8px] uppercase tracking-widest leading-none py-0.5">Administrador</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1 px-3 py-0.5 bg-emerald-50 border border-emerald-100 rounded-full shadow-3xs">
                <ShieldCheck size={11} className="text-emerald-700" />
                <span className="text-emerald-800 font-extrabold text-[8px] uppercase tracking-widest leading-none py-0.5">Membro Cedro</span>
              </div>
            )}
            
            {profile.status === "Autorizado" && (
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-50 border border-blue-100 rounded-full">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                <span className="text-blue-700 font-extrabold text-[8px] uppercase tracking-wider">Ativo</span>
              </div>
            )}
          </div>

          {/* Grid de Informações Organizacionais com mais dados */}
          <div className="space-y-2 text-left max-h-[300px] overflow-y-auto pr-1">
            
            {/* Cargo */}
            <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-gradient-to-r from-slate-50 to-slate-100/50 border border-slate-100 hover:border-slate-200 transition-all">
              <div className="w-8.5 h-8.5 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/70 text-[#025227] flex items-center justify-center shrink-0 shadow-3xs">
                <Briefcase size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="block text-[8px] text-slate-400 uppercase font-black tracking-widest">Cargo / Função</span>
                <span className="block text-xs font-bold text-slate-800 uppercase truncate">{profile.cargo || "Não Informado"}</span>
              </div>
            </div>

            {/* Setor */}
            <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-gradient-to-r from-slate-50 to-slate-100/50 border border-slate-100 hover:border-slate-200 transition-all">
              <div className="w-8.5 h-8.5 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/70 text-[#025227] flex items-center justify-center shrink-0 shadow-3xs">
                <Building size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="block text-[8px] text-slate-400 uppercase font-black tracking-widest">Setor de Atuação</span>
                <span className="block text-xs font-bold text-slate-800 uppercase truncate">{profile.setor || "Geral"}</span>
              </div>
            </div>

            {/* Contato / E-mail */}
            <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-gradient-to-r from-slate-50 to-slate-100/50 border border-slate-100 hover:border-slate-200 transition-all">
              <div className="w-8.5 h-8.5 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/70 text-[#025227] flex items-center justify-center shrink-0 shadow-3xs">
                <Mail size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="block text-[8px] text-slate-400 uppercase font-black tracking-widest">Contato / E-mail</span>
                <span className="block text-xs font-semibold text-slate-800 truncate max-w-[215px] leading-tight" title={displayContact}>
                  {displayContact}
                </span>
              </div>
            </div>

            {/* Nova Seção: Sistemas de IA Cadastrados no Inventário (Estatísticas reais da Cedro IA) */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/40 border border-slate-100 hover:border-slate-200 transition-all space-y-2.5">
              <div className="flex items-center gap-3">
                <div className="w-8.5 h-8.5 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/70 text-[#025227] flex items-center justify-center shrink-0 shadow-3xs">
                  <FileText size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="block text-[8px] text-slate-400 uppercase font-black tracking-widest">IAs no Inventário</span>
                  <span className="block text-xs font-black text-slate-800 leading-none mt-0.5">
                    {loadingRecords ? (
                      <span className="inline-block w-8 h-3 bg-slate-200 animate-pulse rounded-xs" />
                    ) : (
                      `${iaRecordsCount || 0} ${iaRecordsCount === 1 ? "IA cadastrada" : "IAs cadastradas"}`
                    )}
                  </span>
                </div>
              </div>


            </div>

          </div>

          {/* Rodapé / Last Seen */}
          {lastSeenLabel && (
            <div className="mt-5 pt-3.5 border-t border-dashed border-slate-100 flex items-center justify-center gap-1.5 text-slate-400">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-[9px] font-bold uppercase tracking-wider">{lastSeenLabel}</p>
            </div>
          )}

        </div>
      </motion.div>
    </motion.div>
  );
};

const isUserOnline = (lastSeen?: string | null) => {
  if (!lastSeen) return false;
  try {
    const lastSeenDate = new Date(lastSeen);
    const diffInMs = new Date().getTime() - lastSeenDate.getTime();
    // Consider as online if heard form in the last 3 minutes
    return diffInMs > 0 && diffInMs < 3 * 60 * 1000;
  } catch {
    return false;
  }
};

export const Chat: React.FC = () => {
  const { user, profile } = useAuth();
  
  // States reais do bando de dados do Supabase
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [lastMessagesMap, setLastMessagesMap] = useState<Record<string, ChatMessage>>({});
  
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);

  // Conversa ativa selecionada (representa o ID do usuário real de profiles)
  const [selectedConvId, setSelectedConvId] = useState<string>("");
  const [listFilter, setListFilter] = useState<"all" | "unread" | "favorites">("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Busca na conversa ativa
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  
  // Controle de arquivos e emojis
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [uiError, setUiError] = useState("");
  const [uploading, setUploading] = useState(false);

  // Modais de ações adicionais
  const [viewingProfile, setViewingProfile] = useState<UserProfile | null>(null);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState("");
  
  // Controle local de favoritos
  const [favorites, setFavorites] = useState<string[]>([]);

  // Controle local de mensagens lidas (não-lidas reativos)
  const [lastSeenMessageMap, setLastSeenMessageMap] = useState<Record<string, string>>(() => {
    try {
      const stored = localStorage.getItem(`cedro_chat_seen_${user?.id || 'anon'}`);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Salvar no localStorage sempre que o mapa de visualizações mudar
  useEffect(() => {
    if (user?.id) {
      try {
        localStorage.setItem(`cedro_chat_seen_${user.id}`, JSON.stringify(lastSeenMessageMap));
      } catch (err) {
        console.error("Falha ao salvar visto no localStorage", err);
      }
    }
  }, [lastSeenMessageMap, user?.id]);

  // Atualizar a última mensagem vista para a conversa ativa
  useEffect(() => {
    if (selectedConvId && lastMessagesMap[selectedConvId]) {
      const currentLastMsgId = lastMessagesMap[selectedConvId].id;
      if (lastSeenMessageMap[selectedConvId] !== currentLastMsgId) {
        setLastSeenMessageMap(prev => ({
          ...prev,
          [selectedConvId]: currentLastMsgId
        }));
      }
    }
  }, [selectedConvId, lastMessagesMap, lastSeenMessageMap]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Setup de datas amigáveis
  const isSameDay = (d1Str: string, d2Str: string) => {
    try {
      const d1 = new Date(d1Str);
      const d2 = new Date(d2Str);
      return d1.getFullYear() === d2.getFullYear() &&
             d1.getMonth() === d2.getMonth() &&
             d1.getDate() === d2.getDate();
    } catch {
      return false;
    }
  };

  const getFriendlyDateLabel = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      if (d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()) {
        return "Hoje";
      }
      if (d.getFullYear() === yesterday.getFullYear() && d.getMonth() === yesterday.getMonth() && d.getDate() === yesterday.getDate()) {
        return "Ontem";
      }
      
      const months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
      return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
    } catch {
      return "Data Indeterminada";
    }
  };

  const formatMessageTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return "";
    }
  };

  // Carregar usuários reais da tabela profiles
  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .neq("id", user?.id || "");
      
      if (!error && data) {
        // Libera todo o chat para que todos os usuários possam ver e conversar com qualquer colega voluntariamente
        const filtered = data || [];
        setUsers(filtered);
      }
    } catch (e) {
      console.error("Falha ao carregar perfis reais de usuários para o Chat:", e);
    }
  };

  // Carregar mensagens reais entre o usuário logado e o usuário selecionado
  const fetchRealtimeMessages = async () => {
    if (!selectedConvId || !user?.id) {
      setMessages([]);
      return;
    }
    setLoading(true);
    try {
      console.log("Carregando mensagens para a conversa:", selectedConvId);
      let data = null;
      let error = null;

      // 1. Tentar a consulta .or() combinada padrão do PostgREST
      try {
        const res = await supabase
          .from("messages")
          .select("*")
          .or(`and(sender_id.eq.${user.id},recipient_id.eq.${selectedConvId}),and(sender_id.eq.${selectedConvId},recipient_id.eq.${user.id})`)
          .order("created_at", { ascending: true })
          .limit(150);
        data = res.data;
        error = res.error;
      } catch (orErr) {
        console.warn("Falha de parser na query .or() combinada, usando manual...", orErr);
      }

      // 2. Se falhar ou do banco retornar erro, usar busca por consultas separadas (absolutamente imune a falhas)
      if (error || !data) {
        console.log("Buscando mensagens separadamente para máxima compatibilidade...");
        const [sentRes, recvRes] = await Promise.all([
          supabase
            .from("messages")
            .select("*")
            .eq("sender_id", user.id)
            .eq("recipient_id", selectedConvId)
            .limit(100),
          supabase
            .from("messages")
            .select("*")
            .eq("sender_id", selectedConvId)
            .eq("recipient_id", user.id)
            .limit(100)
        ]);

        if (sentRes.error) {
          console.error("Erro na busca de enviadas:", sentRes.error);
        }
        if (recvRes.error) {
          console.error("Erro na busca de recebidas:", recvRes.error);
        }

        const combined = [...(sentRes.data || []), ...(recvRes.data || [])];
        combined.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        data = combined;
        error = null;
      }

      console.log("Mensagens carregadas do Supabase:", data);

      if (data) {
        const enriched = data.map((msg: any) => {
          let senderProfile = null;
          if (msg.sender_id === user.id) {
            senderProfile = profile;
          } else {
            senderProfile = users.find(u => u.id === msg.sender_id) || null;
          }
          return {
            ...msg,
            sender_profile: senderProfile
          };
        });
        setMessages(enriched);
      }
    } catch (err) {
      console.error("Erro fatal ao carregar mensagens reais do Supabase:", err);
    } finally {
      setLoading(false);
    }
  };

  // Carregar as últimas mensagens de todas as conversas para as prévias na sidebar
  const fetchAllLastMessages = async () => {
    if (!user?.id) return;
    try {
      let data = null;
      let error = null;

      try {
        const res = await supabase
          .from("messages")
          .select("*")
          .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
          .order("created_at", { ascending: false });
        data = res.data;
        error = res.error;
      } catch (orErr) {
        console.warn("Falha no .or de busca das últimas mensagens:", orErr);
      }

      if (error || !data) {
        const [sentRes, recvRes] = await Promise.all([
          supabase
            .from("messages")
            .select("*")
            .eq("sender_id", user.id)
            .order("created_at", { ascending: false })
            .limit(100),
          supabase
            .from("messages")
            .select("*")
            .eq("recipient_id", user.id)
            .order("created_at", { ascending: false })
            .limit(100)
        ]);

        const combined = [...(sentRes.data || []), ...(recvRes.data || [])];
        combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        data = combined;
        error = null;
      }

      if (data) {
        const lastMsgs: Record<string, ChatMessage> = {};
        data.forEach((msg: ChatMessage) => {
          const partnerId = msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;
          if (partnerId && !lastMsgs[partnerId]) {
            lastMsgs[partnerId] = msg;
          }
        });
        setLastMessagesMap(lastMsgs);
      }
    } catch (err) {
      console.error("Erro ao carregar mapa de conversas com últimas mensagens:", err);
    }
  };

  // Atualizar tudo ao start ou mudar de usuário
  useEffect(() => {
    fetchUsers();
    fetchAllLastMessages();
  }, [user?.id, profile]);

  useEffect(() => {
    if (selectedConvId) {
      fetchRealtimeMessages();
    } else {
      setMessages([]);
    }
  }, [selectedConvId, user?.id]);

  // Integração em tempo real com o canal do Supabase
  useEffect(() => {
    if (!user?.id) return;

    const messageChannel = supabase
      .channel("chat-realtime-cedro")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const insertMsg = payload.new as ChatMessage;
          const isRelatedToMe = insertMsg.sender_id === user.id || insertMsg.recipient_id === user.id;

          if (isRelatedToMe) {
            // Atualiza mapa de últimas mensagens
            const partnerId = insertMsg.sender_id === user.id ? insertMsg.recipient_id : insertMsg.sender_id;
            if (partnerId) {
              setLastMessagesMap(prev => ({
                ...prev,
                [partnerId]: insertMsg
              }));
            }

            // Se for do chat ativamente aberto, adiciona na lista
            const isForOpenChat = 
              (insertMsg.sender_id === user.id && insertMsg.recipient_id === selectedConvId) ||
              (insertMsg.sender_id === selectedConvId && insertMsg.recipient_id === user.id);

            if (isForOpenChat) {
              let senderProfile = null;
              if (insertMsg.sender_id === user.id) {
                senderProfile = profile;
              } else {
                senderProfile = users.find(u => u.id === insertMsg.sender_id) || null;
              }
              const enrichedMsg = {
                ...insertMsg,
                sender_profile: senderProfile
              };

              setMessages(prev => {
                if (prev.some(m => m.id === enrichedMsg.id)) return prev;
                return [...prev, enrichedMsg].sort(
                  (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                );
              });
            }
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        async (payload) => {
          const updatedProfile = payload.new as UserProfile;
          if (updatedProfile && updatedProfile.id !== user?.id) {
            setUsers(prev => {
              const exists = prev.some(u => u.id === updatedProfile.id);
              if (exists) {
                return prev.map(u => u.id === updatedProfile.id ? { ...u, ...updatedProfile } : u);
              } else {
                return [...prev, updatedProfile];
              }
            });
          }
        }
      )
      .subscribe();

    // Polling de segurança de 25 segundos para manter a lista de online e conversas ativas sempre fidedigna
    const pollInterval = setInterval(() => {
      fetchUsers();
      fetchAllLastMessages();
    }, 25000);

    return () => {
      supabase.removeChannel(messageChannel);
      clearInterval(pollInterval);
    };
  }, [selectedConvId, user?.id, users]);

  // Scroll automático para a última mensagem
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, selectedConvId]);

  // Recipiente ativo
  const selectedRecipient = useMemo(() => {
    if (!selectedConvId) return null;
    return users.find(u => u.id === selectedConvId) || null;
  }, [selectedConvId, users]);

  // Lista de conversas computadas baseadas apenas nos profissionais do sistema
  const computedConversations = useMemo(() => {
    return users.map(u => {
      const lastMsgObj = lastMessagesMap[u.id];
      const hasAttachment = lastMsgObj?.attachment_url;
      const lastMsgText = lastMsgObj 
        ? (lastMsgObj.content || (hasAttachment ? "📎 Arquivo Anexo" : "")) 
        : "Nenhuma mensagem ainda. Inicie a conversa.";

      const lastMsgTime = lastMsgObj 
        ? formatMessageTime(lastMsgObj.created_at) 
        : "";

      // Verifica se a última mensagem foi enviada por outra pessoa e ainda não foi visualizada
      const isUnread = lastMsgObj && 
                       lastMsgObj.sender_id !== user?.id && 
                       selectedConvId !== u.id && 
                       lastSeenMessageMap[u.id] !== lastMsgObj.id;
      const unreadCount = isUnread ? 1 : 0;

      return {
        id: u.id,
        name: u.full_name || "Sem Nome",
        subtitle: `${u.setor || "Sem setor"} • ${u.cargo || "Profissional"}`,
        lastMessage: lastMsgText || "",
        time: lastMsgTime || "",
        favorite: favorites.includes(u.id),
        unreadCount,
        profile: u
      };
    });
  }, [users, lastMessagesMap, favorites, selectedConvId, lastSeenMessageMap, user?.id]);

  // Filtragem e busca de conversas na aba de conversas
  const filteredConversations = useMemo(() => {
    return computedConversations.filter(c => {
      const nameStr = c.name || "";
      const subtitleStr = c.subtitle || "";
      const lastMsgStr = c.lastMessage || "";
      const queryStr = searchQuery || "";

      const matchesSearch = 
        nameStr.toLowerCase().includes(queryStr.toLowerCase()) ||
        subtitleStr.toLowerCase().includes(queryStr.toLowerCase()) ||
        lastMsgStr.toLowerCase().includes(queryStr.toLowerCase());
      
      if (!matchesSearch) return false;

      if (listFilter === "all") return true;
      if (listFilter === "favorites") return !!c.favorite;
      return true;
    });
  }, [computedConversations, searchQuery, listFilter]);

  const onlineUsers = useMemo(() => {
    return users.filter(u => isUserOnline(u.last_seen) && u.id !== user?.id);
  }, [users, user?.id]);

  // Manuseio de anexação de arquivos
  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Bloquear arquivos com mais de 10MB
    if (file.size > 10 * 1024 * 1024) {
      setUiError("O arquivo selecionado é muito grande. O limite máximo permitido é 10MB.");
      setTimeout(() => setUiError(""), 5000);
      return;
    }

    // Bloquear arquivos inseguros
    const unsafeExtensions = ["exe", "bat", "cmd", "sh", "js", "vbs"];
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (fileExt && unsafeExtensions.includes(fileExt)) {
      setUiError("Este tipo de arquivo não é permitido por motivos de segurança do laboratório.");
      setTimeout(() => setUiError(""), 5000);
      return;
    }

    setSelectedFile(file);
    setUiError("");
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Seletor de emoji funcional
  const handleEmojiClick = (emoji: string) => {
    const input = inputRef.current;
    if (!input) {
      setNewMessage(prev => prev + emoji);
      return;
    }

    const start = input.selectionStart ?? newMessage.length;
    const end = input.selectionEnd ?? newMessage.length;
    const text = newMessage;
    const nextText = text.substring(0, start) + emoji + text.substring(end);
    setNewMessage(nextText);

    setTimeout(() => {
      input.focus();
      input.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);

    setIsEmojiOpen(false);
  };

  // Enviar mensagem real e anexos via Storage
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && !selectedFile) return;

    if (!user?.id) {
      setUiError("Você precisa estar autenticado para enviar mensagens.");
      return;
    }

    if (!selectedConvId) {
      setUiError("Selecione um profissional para conversar.");
      return;
    }

    const textToSend = newMessage.trim();
    const fileToUpload = selectedFile;

    // 1. Validar anexo antes de prosseguir
    if (fileToUpload) {
      const allowedExts = ["pdf", "doc", "docx", "xls", "xlsx", "png", "jpg", "jpeg", "txt"];
      const fileExt = fileToUpload.name.split('.').pop()?.toLowerCase();
      if (!fileExt || !allowedExts.includes(fileExt)) {
        setUiError("Tipo de arquivo não permitido.");
        return;
      }

      const maxSize = 10 * 1024 * 1024; // 10 MB
      if (fileToUpload.size > maxSize) {
        setUiError("O arquivo excede o tamanho máximo permitido de 10 MB.");
        return;
      }
    }

    setUiError("");

    // 2. Criar mensagem otimista temporária imediatamente
    const tempId = `temp-${Date.now()}`;
    const tempMessage: ChatMessage = {
      id: tempId,
      created_at: new Date().toISOString(),
      sender_id: user.id,
      content: textToSend || `Anexou arquivo: ${fileToUpload ? fileToUpload.name : ""}`,
      is_private: true,
      recipient_id: selectedConvId,
      sender_profile: profile || undefined,
      status: "sending"
    };

    if (fileToUpload) {
      tempMessage.attachment_name = fileToUpload.name;
      tempMessage.attachment_size = fileToUpload.size;
      tempMessage.attachment_type = fileToUpload.type;
    }

    // Inserir localmente instantaneamente!
    setMessages(prev => [...prev, tempMessage]);

    // Atualizar mapa de última mensagem instantaneamente na sidebar
    setLastMessagesMap(prev => ({
      ...prev,
      [selectedConvId]: tempMessage
    }));

    // Limpar estados na hora para melhorar a responsividade
    setNewMessage("");
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    let attachment_url = "";
    let attachment_name = "";
    let attachment_type = "";
    let attachment_size = 0;
    let uploadFailed = false;

    if (fileToUpload) {
      setUploading(true);
      try {
        const fileExt = fileToUpload.name.split('.').pop()?.toLowerCase();
        const fileName = `${Math.random().toString(36).substring(2, 11)}-${Date.now()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        // Tenta fazer o upload para o bucket chat-attachments
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("chat-attachments")
          .upload(filePath, fileToUpload);

        if (uploadError) {
          throw uploadError;
        }

        if (uploadData) {
          const { data: publicUrlData } = supabase.storage
            .from("chat-attachments")
            .getPublicUrl(filePath);

          attachment_url = publicUrlData.publicUrl;
          attachment_name = fileToUpload.name;
          attachment_type = fileToUpload.type;
          attachment_size = fileToUpload.size;
        }
      } catch (storageErr: any) {
        console.error("Falha ao realizar o upload:", storageErr);
        uploadFailed = true;
        setUiError("Bucket de anexos não configurado. Crie o bucket chat-attachments no Supabase Storage.");
        
        // Se NÃO há texto digitado, não dá para enviar nada no banco. Restauramos e interrompemos.
        if (!textToSend) {
          setUploading(false);
          setNewMessage(textToSend);
          setSelectedFile(fileToUpload);
          setMessages(prev => prev.filter(m => m.id !== tempId));
          return;
        }
      } finally {
        setUploading(false);
      }
    }

    try {
      const payload: any = {
        content: textToSend || `Anexou arquivo: ${attachment_name}`,
        sender_id: user.id,
        is_private: true,
        recipient_id: selectedConvId,
        attachment_url: uploadFailed ? null : (attachment_url || null),
        attachment_name: uploadFailed ? null : (attachment_name || null),
        attachment_type: uploadFailed ? null : (attachment_type || null),
        attachment_size: uploadFailed ? null : (attachment_size || null)
      };

      console.log("Enviando mensagem:", payload);

      let insertData = null;
      let insertError = null;

      // 1. Tentar inserção completa com suporte a anexo
      const res1 = await supabase
        .from("messages")
        .insert(payload)
        .select()
        .single();
      
      insertData = res1.data;
      insertError = res1.error;

      // 2. Se der erro por falta de colunas (anexos ausentes na tabela do Supabase legado)
      if (insertError && (insertError.code === "42703" || insertError.message?.includes("attachment") || insertError.message?.includes("column"))) {
        console.warn("Tabela remote 'messages' não suporta anexos ainda. Tentando persistência com fallback básico de texto.");
        
        let fallbackText = textToSend;
        if (attachment_url && !uploadFailed) {
          fallbackText = (textToSend ? textToSend + "\n\n" : "") + `📎 Arquivo Anexo: [${attachment_name}](${attachment_url})`;
        }

        const basicPayload = {
          content: fallbackText || "📎 Anexo enviado",
          sender_id: user.id,
          is_private: true,
          recipient_id: selectedConvId
        };

        const res2 = await supabase
          .from("messages")
          .insert(basicPayload)
          .select()
          .single();
        
        insertData = res2.data;
        insertError = res2.error;
      }

      if (insertError) {
        console.error("Erro ao salvar mensagem no Supabase:", insertError);
        setUiError(`Erro ao enviar mensagem: ${insertError.message || insertError.details || "Código do banco: " + insertError.code}`);
        
        // Marcar mensagem local temporária como erro
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: "error" } : m));
        // Restaurar para que o usuário possa tentar novamente
        setNewMessage(textToSend);
        setSelectedFile(fileToUpload);
        return;
      }

      if (insertData) {
        console.log("Mensagem salva com sucesso:", insertData);

        const enrichedInsert = {
          ...insertData,
          sender_profile: profile
        };

        // Substituir a mensagem temporária local pela real retornada pelo Supabase!
        setMessages(prev => {
          return prev.map(m => m.id === tempId ? enrichedInsert : m);
        });

        // Atualizar listagem de prévias lateral
        fetchAllLastMessages();
      }
    } catch (dbErr: any) {
      console.error("Erro fatal ao processar envio de mensagem:", dbErr);
      setUiError(`Erro ao processar envio: ${dbErr.message || dbErr}`);
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: "error" } : m));
      setNewMessage(textToSend);
      setSelectedFile(fileToUpload);
    }
  };

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  // Filtragem de palavras chave internamente no chat ativado
  const highlightTerm = (text: string = "", term: string) => {
    if (!text) return "";
    if (!term) return text;
    const parts = text.split(new RegExp(`(${term})`, "gi"));
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === term.toLowerCase() 
            ? <span key={i} className="bg-yellow-100 text-slate-800 px-0.5 rounded font-extrabold">{part}</span> 
            : part
        )}
      </>
    );
  };

  const activeMessagesToShow = useMemo(() => {
    let result = messages;
    if (chatSearchOpen && chatSearchQuery.trim()) {
      const query = chatSearchQuery.toLowerCase();
      result = result.filter(m => (m.content || "").toLowerCase().includes(query));
    }
    return result;
  }, [messages, chatSearchOpen, chatSearchQuery]);

  // Lista para nova conversa (modal busca em profiles reais)
  const modalUsersRoster = useMemo(() => {
    if (newChatSearch.trim()) {
      return users.filter(u => 
        u.full_name?.toLowerCase().includes(newChatSearch.toLowerCase()) ||
        u.setor?.toLowerCase().includes(newChatSearch.toLowerCase()) ||
        u.cargo?.toLowerCase().includes(newChatSearch.toLowerCase())
      );
    }
    return users;
  }, [users, newChatSearch]);

  const activeConvObj = computedConversations.find(c => c.id === selectedConvId);

  return (
    <div className="flex-1 h-full min-h-0 w-full bg-[#F6F8F5] select-none flex flex-col">
      {/* Container Principal Claro, Corporativo e Sofisticado do Cedro */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[390px_1fr] rounded-3xl border border-[#E3E8E1] bg-white shadow-sm overflow-hidden">
        
        {/* COLUNA ESQUERDA - Sidebar de conversas */}
        <div className={`w-full h-full min-h-0 flex flex-col bg-white border-r border-[#E3E8E1] shrink-0 ${selectedConvId ? "hidden lg:flex" : "flex"}`}>
          
          {/* Header Superior da Sidebar */}
          <div className="p-5 border-b border-[#E3E8E1] flex flex-col gap-3.5 bg-[#F6F8F5]">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-normal text-[#003F1D] tracking-normal uppercase">Chat</h2>
              </div>
              <button 
                onClick={() => setIsNewChatOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#075618] hover:bg-[#003F1D] text-white text-[10px] font-black uppercase rounded-xl shadow-xs transition cursor-pointer active:scale-95"
              >
                <Plus size={12} strokeWidth={3} /> Nova conversa
              </button>
            </div>

            {/* Caixa de Busca */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#667085]" />
                <input 
                  type="text"
                  placeholder="Buscar conversas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-[#E3E8E1] rounded-xl text-xs text-[#1F2933] placeholder-[#667085] focus:outline-none focus:bg-white focus:border-[#075618] focus:ring-4 focus:ring-[#075618]/10 transition-all font-semibold"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#075618] p-0.5 rounded-md cursor-pointer transition-colors"
                  >
                    <X size={12} strokeWidth={2.5} />
                  </button>
                )}
              </div>
            </div>

            {/* Chips de filtro */}
            <div className="flex gap-1.5 pt-0.5">
              {[
                { id: "all", label: "Todas" },
                { id: "favorites", label: "Favoritas" },
              ].map(chip => (
                <button
                  key={chip.id}
                  onClick={() => setListFilter(chip.id as any)}
                  className={`text-[9px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-xl border cursor-pointer transition ${
                    listFilter === chip.id 
                      ? "bg-[#EAF4EC] text-[#075618] border-[#BFD8C5] shadow-xs"
                      : "bg-white text-[#667085] border-[#E3E8E1] hover:bg-[#F6F8F5]"
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Listagem de conversas */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#E3E8E1] custom-scrollbar">
            {onlineUsers.length > 0 && (
              <div className="px-5 py-3.5 border-b border-[#E3E8E1] bg-[#EAF4EC]/10">
                <div className="flex items-center gap-1.5 mb-2.5">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">Online Agora</span>
                  <span className="text-[9px] font-bold text-emerald-800/80 bg-emerald-50 px-2 py-0.5 rounded-full leading-none">
                    {onlineUsers.length}
                  </span>
                </div>
                <div className="flex items-center gap-4 overflow-x-auto pb-1.5 pt-0.5 scrollbar-none">
                  {onlineUsers.map(u => (
                    <button 
                      key={u.id}
                      onClick={() => setSelectedConvId(u.id)}
                      className="flex flex-col items-center gap-1.5 shrink-0 group focus:outline-none cursor-pointer"
                    >
                      <ChatAvatar 
                        avatarUrl={u.avatar_url} 
                        fullName={u.full_name} 
                        sizeClassName="size-10 group-hover:scale-105 transition-all duration-200"
                        textClassName="text-[10px] font-black"
                        isOnline={true}
                      />
                      <span className="text-[10px] font-bold text-slate-600 truncate max-w-[60px] text-center group-hover:text-[#075618] transition-colors leading-tight">
                        {(u.full_name || "").split(" ")[0]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {users.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
                <div className="size-12 bg-[#F6F8F5] text-[#667085] rounded-xl border border-[#E3E8E1] flex items-center justify-center">
                  <User size={20} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Nenhum contato disponível</h3>
                  <p className="text-[11px] text-slate-400/80 mt-1.5 leading-relaxed max-w-[240px]">
                    Ainda não há outros usuários cadastrados para iniciar uma conversa.
                  </p>
                </div>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="py-12 p-5 text-center space-y-2">
                <p className="text-[#667085] font-bold text-[10px] uppercase tracking-wider">Nenhuma conversa encontrada</p>
                <p className="text-xs text-slate-400/80">Verifique os filtros ou busque por outro profissional.</p>
              </div>
            ) : (
              filteredConversations.map(conv => {
                const isActive = selectedConvId === conv.id;
                const isConvFavorite = !!conv.favorite;
                const hasUnread = conv.unreadCount > 0;

                return (
                  <div 
                    key={conv.id}
                    onClick={() => setSelectedConvId(conv.id)}
                    className={`p-4 flex items-start gap-3 transition-all cursor-pointer relative group border-b border-[#E3E8E1] ${
                      hasUnread
                        ? "bg-[#EAF4EC] border-l-4 border-l-[#075618]"
                        : isActive
                        ? "bg-[#F6F8F5] border-l-4 border-l-[#075618]"
                        : "bg-white hover:bg-[#F6F8F5] border-l-4 border-l-transparent"
                    }`}
                  >
                    {/* Avatar da Conversa */}
                    <div className="relative shrink-0 mt-0.5">
                      <ChatAvatar 
                        avatarUrl={conv.profile.avatar_url} 
                        fullName={conv.name} 
                        sizeClassName="size-9"
                        textClassName="text-xs"
                        isOnline={isUserOnline(conv.profile.last_seen)}
                      />
                    </div>

                    {/* Conteúdo Textual */}
                    <div className="flex-1 min-w-0 pr-1">
                      <div className="flex justify-between items-baseline mb-0.5 gap-2">
                        <h4 className={`text-xs font-bold truncate uppercase tracking-tight ${hasUnread ? "text-[#003F1D] font-black" : "text-[#1F2933]"}`}>
                          {conv.name}
                        </h4>
                        <span className={`text-[9px] font-bold shrink-0 ${hasUnread ? "text-[#075618]" : "text-[#667085]"}`}>
                          {conv.time}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#667085] font-bold uppercase tracking-wider mb-1 truncate block opacity-75">
                        {conv.subtitle}
                      </p>

                      {/* Display da prévia com indicador de quem enviou */}
                      {(() => {
                        const lastMsgObj = lastMessagesMap[conv.id];
                        const lastMessagePrefix = lastMsgObj
                          ? (lastMsgObj.sender_id === user?.id ? "Você" : (conv.name.split(" ")[0] || "Colega"))
                          : "";
                        return (
                          <div className="flex justify-between items-center gap-2 mt-1">
                            <p className="text-xs text-[#667085] truncate flex-1 font-medium">
                              {lastMsgObj ? (
                                <>
                                  <span className="font-bold text-[#1F2933]">{lastMessagePrefix}: </span>
                                  {lastMsgObj.content || "Enviou um anexo"}
                                </>
                              ) : (
                                <span className="italic text-slate-400">Nenhuma mensagem ainda.</span>
                              )}
                            </p>
                            {conv.unreadCount > 0 && (
                              <span className="min-w-5 h-5 px-1.5 rounded-full bg-[#075618] text-white text-[10px] font-black flex items-center justify-center shrink-0 shadow-xs animate-pulse">
                                {conv.unreadCount}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Opções e favoritar */}
                    <div className="flex flex-col items-end justify-between self-stretch shrink-0 gap-1.5">
                      <button 
                        onClick={(e) => toggleFavorite(conv.id, e)}
                        className={`text-slate-300 hover:text-amber-400 transition cursor-pointer md:opacity-0 group-hover:opacity-100 ${
                          isConvFavorite ? "opacity-100! text-amber-400!" : ""
                        }`}
                        title={isConvFavorite ? "Remover dos favoritos" : "Marcar como favorita"}
                      >
                        <Star size={12} fill={isConvFavorite ? "currentColor" : "none"} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Rodapé da Sidebar */}
          <div className="p-4 bg-[#F6F8F5] border-t border-[#E3E8E1] flex justify-between items-center text-[10px] text-[#667085] font-bold uppercase tracking-wider">
            <span>Laboratório Cedro</span>
            <span>{filteredConversations.length} Contatos</span>
          </div>
        </div>

        {/* ÁREA DIREITA - Conversa ativa com os usuários reais */}
        <div className={`flex-1 h-full min-h-0 flex flex-col bg-[#F6F8F5] relative ${!selectedConvId ? "hidden lg:flex" : "flex"}`}>
          
          {activeConvObj && selectedRecipient ? (
            <>
              {/* HEADER DA CONVERSA ATIVA */}
              <div className="p-4 border-b border-[#E3E8E1] flex justify-between items-center bg-white shadow-xs">
                <div className="flex items-center gap-3">
                  
                  {/* Botão voltar para lista no layout mobile */}
                  <button 
                    onClick={() => setSelectedConvId("")}
                    className="lg:hidden p-1.5 bg-[#F6F8F5] hover:bg-[#EAF4EC] rounded-xl text-[#075618] border border-[#E3E8E1] transition shrink-0 active:scale-95 mr-1"
                    title="Voltar para lista"
                  >
                    <ChevronLeft size={16} strokeWidth={2.5} />
                  </button>

                  <ChatAvatar 
                    avatarUrl={selectedRecipient.avatar_url} 
                    fullName={selectedRecipient.full_name} 
                    sizeClassName="size-11"
                    textClassName="text-sm font-black"
                    isOnline={isUserOnline(selectedRecipient.last_seen)}
                  />

                  <div>
                    <h3 className="text-sm font-black text-[#003F1D] uppercase tracking-tight flex items-center gap-1.5 leading-snug">
                      {selectedRecipient.full_name}
                      {selectedRecipient.role === "admin" && (
                        <span className="px-1.5 py-0.5 bg-[#EAF4EC] border border-[#BFD8C5] rounded text-[7px] font-black text-[#075618] tracking-wider">ADM</span>
                      )}
                    </h3>
                    <p className="text-[10px] text-[#667085] font-bold uppercase tracking-wider flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                      <span>{selectedRecipient.setor || "Sem setor específico"} • {selectedRecipient.cargo || "Membro Cedro"}</span>
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 roundedbg-slate-100/50">
                        <span className={`size-1.5 rounded-full ${isUserOnline(selectedRecipient.last_seen) ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`} />
                        <span className={`text-[9px] tracking-normal ${isUserOnline(selectedRecipient.last_seen) ? "text-emerald-600 font-extrabold" : "text-slate-450 font-semibold"}`}>
                          {isUserOnline(selectedRecipient.last_seen) ? "Online" : "Offline"}
                        </span>
                      </span>
                    </p>
                  </div>
                </div>

                {/* Ações do header do chat */}
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => setChatSearchOpen(prev => {
                      if (prev) setChatSearchQuery("");
                      return !prev;
                    })}
                    className={`p-2 rounded-xl transition active:scale-95 shrink-0 ${
                      chatSearchOpen 
                        ? "bg-[#EAF4EC] text-[#075618] border border-[#BFD8C5]" 
                        : "bg-[#F6F8F5] text-[#667085] hover:bg-[#EAF4EC] border border-[#E3E8E1]"
                    }`}
                    title="Pesquisar na conversa"
                  >
                    <Search size={14} strokeWidth={2.5} />
                  </button>

                  <button 
                    onClick={() => setViewingProfile(selectedRecipient)}
                    className="p-2 bg-[#F6F8F5] hover:bg-[#EAF4EC] text-[#667085] hover:text-[#075618] rounded-xl active:scale-95 shrink-0 transition border border-[#E3E8E1]"
                    title="Ver detalhes de perfil"
                  >
                    <Info size={14} strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              {/* BARRA DE PESQUISA INTERNA ATIVA */}
              <AnimatePresence>
                {chatSearchOpen && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="bg-white border-b border-[#E3E8E1] p-3 flex items-center gap-2 overflow-hidden shadow-xs"
                  >
                    <Search size={13} className="text-[#667085] shrink-0 ml-1" />
                    <input 
                      type="text"
                      placeholder="Filtrar por palavras-chave na conversa..."
                      value={chatSearchQuery}
                      onChange={(e) => setChatSearchQuery(e.target.value)}
                      className="flex-1 bg-slate-50 border border-[#E3E8E1] rounded-xl text-xs py-2 px-3 text-[#1F2933] placeholder-[#667085] focus:outline-none focus:bg-white focus:border-[#075618] focus:ring-4 focus:ring-[#075618]/10 transition-all font-medium"
                    />
                    {chatSearchQuery && (
                      <button 
                        onClick={() => setChatSearchQuery("")}
                        className="p-1 hover:bg-[#F6F8F5] text-[#667085] rounded-md shrink-0 transition"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* CORPO DE MENSAGENS */}
              <div 
                ref={scrollRef} 
                className="flex-1 overflow-y-auto p-5 md:p-6 space-y-5 custom-scrollbar bg-[#F6F8F5]"
              >
                {activeMessagesToShow.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8">
                    <div className="size-12 rounded-full bg-[#EAF4EC] text-[#075618] flex items-center justify-center mb-3.5 border border-[#BFD8C5] shadow-xs">
                      <MessageSquare size={18} />
                    </div>
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-tight">Nenhuma mensagem ainda</h3>
                    <p className="text-xs text-slate-400/80 mt-1 max-w-[260px] leading-relaxed">
                      Envie uma mensagem para iniciar a conversa.
                    </p>
                  </div>
                ) : (
                  (() => {
                    const elements: React.ReactNode[] = [];
                    let lastMessageDateStr = "";

                    activeMessagesToShow.forEach((msg, idx) => {
                      const idOwn = msg.sender_id === user?.id;
                      
                      // Adicionar separador de data se o dia mudou
                      const msgDateStr = msg.created_at;
                      if (!lastMessageDateStr || !isSameDay(lastMessageDateStr, msgDateStr)) {
                        elements.push(
                          <div key={`date-${msg.id}`} className="flex items-center justify-center my-6 gap-3 select-none">
                            <div className="h-px bg-[#E3E8E1] flex-1"></div>
                            <span className="text-[10px] font-bold uppercase text-[#667085] tracking-wider px-3 py-1 bg-[#EAF4EC] border border-[#BFD8C5] rounded-full">
                              {getFriendlyDateLabel(msgDateStr)}
                            </span>
                            <div className="h-px bg-[#E3E8E1] flex-1"></div>
                          </div>
                        );
                        lastMessageDateStr = msgDateStr;
                      }

                      const showAvatar = idx === 0 || activeMessagesToShow[idx-1].sender_id !== msg.sender_id || (elements[elements.length - 1] as any)?.key?.startsWith("date-");

                      elements.push(
                        <motion.div 
                          initial={{ opacity: 0, y: 5 }} 
                          animate={{ opacity: 1, y: 0 }} 
                          key={msg.id} 
                          className={`flex gap-3 max-w-[85%] md:max-w-[70%] ${idOwn ? "ml-auto flex-row-reverse" : "mr-auto flex-row"}`}
                        >
                          {/* Avatar */}
                          <div className="w-8 shrink-0 flex flex-col items-center">
                            {showAvatar && (
                              <div className="flex flex-col items-center">
                                <button 
                                  onClick={() => msg.sender_profile && setViewingProfile(msg.sender_profile as UserProfile)}
                                  className="transition hover:scale-105 active:scale-95 cursor-pointer"
                                >
                                  <ChatAvatar 
                                    avatarUrl={msg.sender_profile?.avatar_url} 
                                    fullName={msg.sender_profile?.full_name} 
                                    sizeClassName="size-8"
                                    textClassName="text-[10px]"
                                  />
                                </button>
                                <span className="text-[8px] text-[#667085] font-black tracking-wider text-center truncate max-w-[36px] mt-1.5 uppercase leading-none select-none">
                                  {(msg.sender_profile?.full_name || "Membro").split(" ")[0]}
                                </span>
                              </div>
                            )}
                          </div>
                          
                          {/* Conteúdo do balão */}
                          <div className={`space-y-1 flex flex-col ${idOwn ? "items-end text-right" : "items-start text-left"}`}>
                            {showAvatar && (
                              <div className={`flex items-baseline gap-1.5 select-none ${idOwn ? "flex-row-reverse" : "flex-row"}`}>
                                <span className="text-[10px] font-bold text-[#003F1D] uppercase tracking-tight">
                                  {msg.sender_profile?.full_name || "Membro Cedro"}
                                </span>
                                {msg.status === "sending" ? (
                                  <span className="text-[8px] font-black text-rose-500 uppercase animate-pulse select-none">
                                    Enviando...
                                  </span>
                                ) : msg.status === "error" ? (
                                  <span className="text-[8px] font-black text-rose-500 uppercase select-none">
                                    Falha ao enviar
                                  </span>
                                ) : null}
                              </div>
                            )}
                            <div className={`p-3.5 px-4 rounded-xl text-xs font-semibold leading-relaxed shadow-xs border whitespace-pre-wrap ${
                              idOwn 
                                ? "bg-[#075618] text-white border-none rounded-tr-none text-left" 
                                : "bg-white text-[#1F2933] border-[#E3E8E1] rounded-tl-none text-left"
                            }`}>
                              {highlightTerm(msg.content, chatSearchQuery)}

                              {/* Exibição de Anexos */}
                              {(msg.attachment_url || msg.attachment_name) && (
                                <div className={`mt-2.5 pt-2 border-t flex items-center gap-2 ${idOwn ? "border-white/20" : "border-[#E3E8E1]"}`}>
                                  <div className={`p-1.5 rounded-lg ${idOwn ? "bg-white/10 text-white" : "bg-[#F6F8F5] text-[#075618]"}`}>
                                    <FileText size={16} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-[11px] font-bold truncate ${idOwn ? "text-white" : "text-[#1F2933]"}`}>{msg.attachment_name || "Documento"}</p>
                                    <p className={`text-[9px] ${idOwn ? "text-white/70" : "text-[#667085]"}`}>
                                      {msg.attachment_size ? `${Math.round(msg.attachment_size / 1024)} KB` : "Arquivo"}
                                      {msg.status === "sending" && <span className="ml-1 text-rose-200 animate-pulse">(Anexando...)</span>}
                                    </p>
                                  </div>
                                  {msg.attachment_url ? (
                                    <a 
                                      href={msg.attachment_url} 
                                      target="_blank" 
                                      rel="noreferrer referrer"
                                      className={`p-1.5 rounded-lg transition ${idOwn ? "text-white hover:bg-white/15" : "text-[#075618] hover:bg-[#EAF4EC]"}`}
                                      title="Baixar anexo"
                                    >
                                      <Download size={14} />
                                    </a>
                                  ) : (
                                    <span className="text-[10px] text-amber-500 font-bold inline-block animate-pulse">...</span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Horário abaixo da mensagem (conforme especificação) */}
                            {msg.status !== "sending" && msg.status !== "error" && (
                              <div className="text-[9.5px] text-[#667085] font-semibold select-none mt-0.5 px-1">
                                {formatMessageTime(msg.created_at)}
                              </div>
                            )}

                            {(!showAvatar && (msg.status === "sending" || msg.status === "error")) && (
                              <div className={`text-[8px] font-bold uppercase select-none ${idOwn ? "text-right text-[#667085]" : "text-left text-[#667085]"}`}>
                                {msg.status === "sending" && <span className="text-amber-600 animate-pulse">Enviando...</span>}
                                {msg.status === "error" && <span className="text-rose-500">Falha ao enviar</span>}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    });
                    
                    return elements;
                  })()
                )}
              </div>

              {/* BARRA DE PRÉVIA DE ANEXO SELECIONADO */}
              {selectedFile && (
                <div className="p-2.5 px-6 bg-[#EAF4EC] border-t border-[#BFD8C5] flex items-center justify-between gap-3 text-xs select-none">
                  <div className="flex items-center gap-2 min-w-0 text-[#075618]">
                    <Paperclip size={14} className="shrink-0" />
                    <span className="font-extrabold truncate max-w-[200px]">{selectedFile.name}</span>
                    <span className="text-[10px] font-semibold opacity-85 shrink-0">({Math.round(selectedFile.size / 1024)} KB)</span>
                  </div>
                  <button 
                    onClick={handleRemoveFile}
                    className="p-1.5 bg-white hover:bg-[#F6F8F5] text-[#075618] rounded-full transition shadow-xs cursor-pointer"
                    title="Remover anexo"
                  >
                    <X size={12} strokeWidth={2.5} />
                  </button>
                </div>
              )}

              {/* BARRA DE AVISOS OU ERROS DE SISTEMA */}
              {uiError && (
                <div className="bg-rose-50 border-t border-rose-100 p-2.5 px-6 text-xs text-rose-800 font-bold tracking-tight text-center select-none">
                  ⚠️ {uiError}
                </div>
              )}

              {/* CAMPO DE COMPOSIÇÃO FIXO (RODAPÉ) */}
              <div className="p-4 bg-white border-t border-[#E3E8E1] shadow-xs relative">
                
                {/* Painel do Seletor de Emojis */}
                <AnimatePresence>
                  {isEmojiOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setIsEmojiOpen(false)} 
                      />
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute bottom-16 left-4 z-50 bg-white p-3 rounded-2xl border border-[#E3E8E1] shadow-md flex gap-1.5 items-center max-w-sm"
                      >
                        {SUGGESTED_EMOJIS.map(emoji => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleEmojiClick(emoji)}
                            className="p-1.5 hover:bg-[#F6F8F5] rounded-xl text-lg transition active:scale-95 cursor-pointer"
                          >
                            {emoji}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>

                <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                  
                  {/* Inputs ocultos de arquivos */}
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleFileSelect} 
                  />

                  {/* Anexar arquivo e emojis */}
                  <div className="flex items-center gap-1 text-[#667085] select-none shrink-0">
                    <button 
                      type="button"
                      onClick={handleFileClick}
                      className="p-2 hover:bg-[#F6F8F5] hover:text-[#075618] rounded-xl transition cursor-pointer"
                      title="Anexar parecer de IA ou arquivos"
                    >
                      <Paperclip size={16} />
                    </button>
                    <button 
                      type="button"
                      onClick={() => setIsEmojiOpen(prev => !prev)}
                      className={`p-2 hover:bg-[#F6F8F5] hover:text-[#075618] rounded-xl transition cursor-pointer ${isEmojiOpen ? "text-[#075618] bg-[#EAF4EC]" : ""}`}
                      title="Inserir emoji"
                    >
                      <Smile size={16} />
                    </button>
                  </div>

                  <input
                    type="text"
                    ref={inputRef}
                    placeholder="Digite sua mensagem corporativa..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1 bg-slate-50 border border-[#E3E8E1] rounded-xl outline-none py-2.5 px-4 text-xs text-[#1F2933] placeholder-[#667085] focus:bg-white focus:border-[#075618] focus:ring-4 focus:ring-[#075618]/10 transition-all font-semibold"
                    disabled={uploading}
                  />
                  
                  <button 
                    type="submit"
                    disabled={(!newMessage.trim() && !selectedFile) || uploading}
                    className="size-10 flex items-center justify-center bg-[#075618] hover:bg-[#003F1D] disabled:opacity-40 disabled:hover:bg-[#075618] text-white rounded-xl transition shrink-0 cursor-pointer shadow-sm active:scale-95"
                    title="Enviar"
                  >
                    <Send size={15} fill="currentColor" />
                  </button>
                </form>

                <div className="mt-2.5 flex items-center justify-between text-[9px] text-[#667085] font-bold uppercase tracking-wider px-1 select-none">
                  <span className="flex items-center gap-1">
                    <span className="size-1.5 bg-[#075618] rounded-full inline-block animate-pulse" /> Mensagem segura e confidencial
                  </span>
                  <span>Canal interno</span>
                </div>
              </div>
            </>
          ) : (
            /* ESTADO VAGIO PADRAO DA CONVERSA - Bento style elegant */
            <div className="flex-1 h-full flex items-center justify-center bg-gradient-to-br from-[#F6F8F5] to-white p-6 select-none">
              <div className="text-center max-w-sm">
                <div className="mx-auto w-16 h-16 rounded-3xl bg-[#EAF4EC] border border-[#BFD8C5] flex items-center justify-center text-[#075618] shadow-sm animate-pulse">
                  <MessageSquare size={28} />
                </div>
                <h3 className="mt-5 text-lg font-black text-[#003F1D] uppercase tracking-tight">
                  Selecione uma conversa
                </h3>
                <p className="mt-2 text-sm font-medium text-[#667085]">
                  Escolha um contato ao lado para iniciar ou continuar uma conversa.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL INICIAR NOVA CONVERSA */}
      <AnimatePresence>
        {isNewChatOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-3xs"
            onClick={() => {
              setIsNewChatOpen(false);
              setNewChatSearch("");
            }}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl border border-[#E3E8E1] flex flex-col h-[400px]"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-4 border-b border-[#E3E8E1] flex justify-between items-center bg-[#F6F8F5] select-none">
                <div>
                  <h3 className="text-sm font-bold text-[#003F1D] uppercase tracking-tight">Iniciar Conversa</h3>
                  <p className="text-[9px] text-[#667085] font-bold uppercase tracking-wider block mt-0.5">Selecione um profissional do Cedro Labs</p>
                </div>
                <button 
                  onClick={() => {
                    setIsNewChatOpen(false);
                    setNewChatSearch("");
                  }}
                  className="p-1 hover:bg-[#EAF4EC] text-[#075618] rounded-lg transition cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-3 border-b border-[#E3E8E1]">
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Buscar profissional por nome, setor ou cargo..."
                    value={newChatSearch}
                    onChange={(e) => setNewChatSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-[#E3E8E1] rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#075618] focus:ring-4 focus:ring-[#075618]/10 transition-all font-medium"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-[#E3E8E1] custom-scrollbar">
                {modalUsersRoster.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 select-none">
                    <p className="text-xs uppercase font-black tracking-wider">Profissional não cadastrado</p>
                  </div>
                ) : (
                  modalUsersRoster.map(rosterUser => (
                    <div 
                      key={rosterUser.id}
                      onClick={() => {
                        setSelectedConvId(rosterUser.id);
                        setIsNewChatOpen(false);
                        setNewChatSearch("");
                      }}
                      className="p-3.5 hover:bg-[#F6F8F5] flex items-center gap-3 cursor-pointer transition select-none"
                    >
                      <ChatAvatar 
                        avatarUrl={rosterUser.avatar_url} 
                        fullName={rosterUser.full_name} 
                        sizeClassName="size-8.5"
                        textClassName="text-xs"
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-tight">{rosterUser.full_name}</h4>
                        <p className="text-[9px] text-[#075618] font-bold uppercase tracking-wider truncate mb-0.5">{rosterUser.cargo}</p>
                        <p className="text-[9px] text-[#667085] font-medium truncate uppercase">{rosterUser.setor || "NIT / Cedro"}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL AUDITOR VERIFICADO DE PERFIL */}
      <AnimatePresence>
        {viewingProfile && (
          <ProfileModal 
            profile={viewingProfile} 
            onClose={() => setViewingProfile(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};
