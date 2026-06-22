/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { LayoutDashboard, ClipboardList, PlusCircle, FileText, Menu, X, ChevronRight, Activity, ShieldAlert, CheckCircle2, AlertTriangle, Users, Database, MessageSquare, UserCircle, Building2, ShieldCheck, Bell, ChevronLeft, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { IARecord, StatusUso, UserProfile, StatusAuditoria, ApprovalWorkflow, ApprovalConfig } from "./types";
import { getRecords, deleteRecord, addRecord, updateRecord, checkSupabaseStatus, saveRecordsToSupabase, getProfiles, updateUserProfile } from "./storage";
import { supabase } from "./lib/supabase";
import { Sidebar } from "./components/layout/Sidebar";
import { Topbar } from "./components/layout/Topbar";
import { useNotifications } from "./hooks/useNotifications";
import Dashboard from "./components/Dashboard";
import Inventory from "./components/Inventory";
import SectorMap from "./components/SectorMap";
import AdminPanel from "./components/AdminPanel";
import SectorsManager from "./components/SectorsManager";
import RegistrationForm from "./components/RegistrationForm";
import ReportView from "./components/ReportView";
import LabBackground from "./components/LabBackground";
import { Auth } from "./components/Auth";
import { UserProfileView } from "./components/UserProfileView";
import { Chat } from "./components/Chat";
import { useAuth } from "./contexts/AuthContext";
import ApprovalPage from "./components/ApprovalPage";
import { generateSystemAlerts, saveAlertInteraction } from "./lib/alerts";
import { Eye, CheckCircle, AlertCircle, Info, Check } from "lucide-react";

export default function App() {
  const { user, profile, loading: authLoading, refreshProfile, signOut } = useAuth();
  const isCurrentUserAdmin = profile?.role?.toLowerCase().trim() === "admin";
  const isCurrentUserModerator = profile?.role?.toLowerCase().trim() === "moderator";
  const isCurrentUserPrivileged = isCurrentUserAdmin || isCurrentUserModerator;
  const [activeTab, setActiveTab] = useState<"dashboard" | "inventory" | "new" | "report" | "profile" | "chat" | "sectors" | "admin" | "sectors_mgr" | "approval_queue" | "alerts">(() => {
    const saved = localStorage.getItem("active_tab");
    return (saved as any) || "profile";
  }); // inicia no perfil ou aba salva
  const [records, setRecords] = useState<IARecord[]>([]);
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>([]);
  const [approvalConfig, setApprovalConfig] = useState<ApprovalConfig>({
    steps: [
      { stepNumber: 1, roleName: "Coordenador NIT", isOpinionOnly: false },
      { stepNumber: 2, roleName: "Gerente NIT", isOpinionOnly: false },
      { stepNumber: 3, roleName: "Gerente TI", isOpinionOnly: false },
      { stepNumber: 4, roleName: "Período de Teste", isOpinionOnly: false },
      { stepNumber: 5, roleName: "Presidência", isOpinionOnly: false },
      { stepNumber: 6, roleName: "Direção Financeira", isOpinionOnly: true },
    ]
  });
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [supabaseStatus, setSupabaseStatus] = useState<"online" | "offline" | "checking">("checking");
  const [selectedRecord, setSelectedRecord] = useState<IARecord | null>(null);

  // Efeitos para persistência de estado (evita perder foco em reconstruções do código / live reload)
  useEffect(() => {
    localStorage.setItem("active_tab", activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (selectedRecord) {
      localStorage.setItem("selected_record_id", selectedRecord.id);
    } else {
      localStorage.removeItem("selected_record_id");
    }
  }, [selectedRecord]);

  useEffect(() => {
    if (records.length > 0 && !selectedRecord) {
      const savedId = localStorage.getItem("selected_record_id");
      if (savedId) {
        const found = records.find(r => r.id === savedId);
        if (found) {
          setSelectedRecord(found);
        }
      }
    } else if (selectedRecord && records.length > 0) {
      const found = records.find(r => r.id === selectedRecord.id);
      if (found && JSON.stringify(found) !== JSON.stringify(selectedRecord)) {
        setSelectedRecord(found);
      }
    }
  }, [records, selectedRecord]);
  const [originTab, setOriginTab] = useState<string | null>("inventory");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const isDarkMode = false; // Modo escuro removido - apenas modo claro

  // Estados e lógicas para o sistema integrado de Alertas
  const [alertsToken, setAlertsToken] = useState(0);
  const triggerAlertsRefresh = () => setAlertsToken(prev => prev + 1);
  const [alertFilter, setAlertFilter] = useState<"all" | "critical" | "warning" | "info" | "resolved">("all");

  const systemAlerts = useMemo(() => {
    return generateSystemAlerts(records, workflows, profile, supabaseStatus);
  }, [records, workflows, profile, supabaseStatus, alertsToken]);

  const activeUnreadAlertsCount = useMemo(() => {
    return systemAlerts.filter(a => a.status === "Ativo").length;
  }, [systemAlerts]);

  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const { toasts, addToast, removeToast } = useNotifications();

  // Dark mode removido - garantir que a classe dark nunca seja aplicada
  useEffect(() => { document.documentElement.classList.remove("dark"); }, []);

  const [isSyncing, setIsSyncing] = useState(false);

  const loadApprovalData = async () => {
    try {
      let configData: any[] | null = null;
      try {
        const configRes = await fetch("/api/workflow/config");
        if (configRes.ok) {
          configData = await configRes.json();
        }
      } catch (err) {
        console.warn("API de config indisponível, tentando Supabase direto:", err);
      }

      if (!configData) {
        const { data: dbConfigData } = await supabase
          .from("approval_config")
          .select("*")
          .order("step_number");
        configData = dbConfigData;
      }

      if (configData && configData.length > 0) {
        // Migramos automaticamente o fluxo do banco (passo 5: Direção Financeira, passo 6: Presidência)
        // para o novo fluxo (passo 5: Presidência, passo 6: Direção Financeira) e invertemos revisores
        const step5Row = configData.find(c => c.step_number === 5);
        if (step5Row && step5Row.role_name === "Direção Financeira") {
          console.log("Migrando banco de dados de aprovação: trocando etapas 5 e 6...");
          const step6Row = configData.find(c => c.step_number === 6);

          const step5UserId = step5Row.assigned_user_id || null;
          const step5UserName = step5Row.assigned_user_name || null;

          const step6UserId = step6Row ? step6Row.assigned_user_id || null : null;
          const step6UserName = step6Row ? step6Row.assigned_user_name || null : null;

          // Atualizar passo 5 para Presidência e receber o revisor do passo 6 original
          supabase
            .from("approval_config")
            .update({
              role_name: "Presidência",
              is_opinion_only: false,
              assigned_user_id: step6UserId,
              assigned_user_name: step6UserName
            })
            .eq("step_number", 5)
            .then(() => {});

          supabase
            .from("approval_steps")
            .update({
              role_name: "Presidência",
              is_opinion_only: false,
              assigned_user_id: step6UserId,
              assigned_user_name: step6UserName
            })
            .eq("step_number", 5)
            .then(() => {});

          // Atualizar passo 6 para Direção Financeira e receber o revisor do passo 5 original
          supabase
            .from("approval_config")
            .update({
              role_name: "Direção Financeira",
              is_opinion_only: true,
              assigned_user_id: step5UserId,
              assigned_user_name: step5UserName
            })
            .eq("step_number", 6)
            .then(() => {});

          supabase
            .from("approval_steps")
            .update({
              role_name: "Direção Financeira",
              is_opinion_only: true,
              assigned_user_id: step5UserId,
              assigned_user_name: step5UserName
            })
            .eq("step_number", 6)
            .then(() => {});
          
          configData = configData.map(c => {
            if (c.step_number === 5) {
              return {
                ...c,
                role_name: "Presidência",
                is_opinion_only: false,
                assigned_user_id: step6UserId,
                assigned_user_name: step6UserName,
              };
            }
            if (c.step_number === 6) {
              return {
                ...c,
                role_name: "Direção Financeira",
                is_opinion_only: true,
                assigned_user_id: step5UserId,
                assigned_user_name: step5UserName,
              };
            }
            return c;
          });
        }

        setApprovalConfig({
          steps: configData.map((c: any) => ({
            stepNumber: c.step_number,
            roleName: c.step_number === 6 ? "Direção Financeira" : c.step_number === 5 ? "Presidência" : c.role_name,
            userId: c.assigned_user_id,
            userName: c.assigned_user_name,
            isOpinionOnly: c.step_number === 6 ? true : c.step_number === 5 ? false : c.is_opinion_only,
          }))
        });
      }

      let wfData: any[] | null = null;
      try {
        const listRes = await fetch("/api/workflow/list");
        if (listRes.ok) {
          wfData = await listRes.json();
        }
      } catch (err) {
        console.warn("API de workflows indisponível, tentando Supabase direto:", err);
      }

      if (!wfData) {
        // Obter do supabase diretamente
        const { data: dbWf } = await supabase
          .from("approval_workflows")
          .select("*, steps:approval_steps(*)");
        
        if (!dbWf || dbWf.length === 0 || dbWf[0].steps === undefined) {
          const { data: rawWfs } = await supabase.from("approval_workflows").select("*");
          const { data: rawSteps } = await supabase.from("approval_steps").select("*");
          if (rawWfs) {
            wfData = rawWfs.map(w => ({
              ...w,
              steps: (rawSteps || []).filter((s: any) => s.workflow_id === w.id)
            }));
          }
        } else {
          wfData = dbWf;
        }
      }

      if (wfData) {
        setWorkflows(wfData.map((wf: any) => ({
          iaRecordId: wf.ia_record_id,
          currentStep: wf.current_step,
          finalStatus: wf.final_status,
          completedAt: wf.completed_at,
          steps: (wf.steps || []).map((s: any) => ({
            stepNumber: s.step_number,
            roleName: s.step_number === 5 ? "Presidência" : s.step_number === 6 ? "Direção Financeira" : s.role_name,
            assignedUserId: s.assigned_user_id,
            assignedUserName: s.assigned_user_name,
            status: s.status,
            comment: s.comment,
            decidedAt: s.decided_at,
            isOpinionOnly: s.is_opinion_only,
          }))
        })));
      }
    } catch (e) {
      console.warn("Erro ao carregar dados de aprovação:", e);
    }
  };

  const refreshRecords = async () => {
    setIsSyncing(true);
    try {
      const isOnline = await checkSupabaseStatus();
      setSupabaseStatus(isOnline ? "online" : "offline");
      
      const isAdmin = profile?.role?.toLowerCase().trim() === "admin";
      const isModerator = profile?.role?.toLowerCase().trim() === "moderator";
      const isPrivileged = isAdmin || isModerator;
      
      const data = await getRecords(user?.id, isPrivileged, profile?.setor);
      setRecords(data);
      
      // Sempre buscar perfis para que o chat e outros componentes tenham os dados correspondentes
      const usersData = await getProfiles();
      if (isPrivileged) {
        setProfiles(usersData);
      } else {
        const userSector = profile?.setor?.toLowerCase().trim();
        const filteredUsers = usersData.filter(p => {
          const isUserAdmin = p.role?.toLowerCase().trim() === "admin";
          const isSameSector = p.setor && userSector && p.setor.toLowerCase().trim() === userSector;
          return isUserAdmin || isSameSector;
        });
        setProfiles(filteredUsers);
      }

      // Carregar dados de conformidade e fluxos ativos de aprovação
      await loadApprovalData();
    } catch (error) {
      console.error("Erro ao atualizar registros:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (user && profile) refreshRecords();

    // Heartbeat for last_seen status
    let interval: any;
    if (user && profile) {
      const updatePresence = async () => {
        try {
          await updateUserProfile(user.id, { last_seen: new Date().toISOString() });
        } catch (e) {
          console.warn("Falha no heartbeat de presença:", e);
        }
      };
      
      updatePresence(); // Initial call
      interval = setInterval(updatePresence, 60000); // Every 1 minute
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [user, profile]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const isOnline = await checkSupabaseStatus();
      setSupabaseStatus(isOnline ? "online" : "offline");
    }, 30000); // Check every 30s
    
    return () => clearInterval(interval);
  }, []);

  // Refs to always keep current values inside real-time event listeners
  const activeTabRef = React.useRef(activeTab);
  const profileRef = React.useRef(profile);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    if (!user) return;

    console.log("🔔 Iniciando escutadores em tempo real para notificações...");

    // 1. Escutador de novas mensagens no chat
    const messageChannel = supabase
      .channel("global-chat-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const msg = payload.new as any;
          if (!msg || msg.sender_id === user.id) return;

          const currentTab = activeTabRef.current;
          let shouldNotify = false;

          if (currentTab !== "chat") {
            // Se não está no chat, notifica sobre mensagens públicas ou privadas direcionadas para si
            if (!msg.is_private) {
              shouldNotify = true;
            } else if (msg.recipient_id === user.id) {
              shouldNotify = true;
            }
          } else {
            // Se está na tela do chat, notifica apenas se for mensagem privada direcionada e o remetente não for o chat ativo atual
            if (msg.is_private && msg.recipient_id === user.id) {
              const activeChatWith = localStorage.getItem("active_chat_with");
              if (activeChatWith !== msg.sender_id) {
                shouldNotify = true;
              }
            }
          }

          if (shouldNotify) {
            try {
              const { data: senderProf } = await supabase
                .from("profiles")
                .select("full_name")
                .eq("id", msg.sender_id)
                .single();

              const senderName = senderProf?.full_name || "Colega";
              addToast({
                title: `Chat: ${senderName}`,
                message: msg.content.length > 60 ? `${msg.content.slice(0, 60)}...` : msg.content,
                type: "chat",
                actionLabel: "Ver Mensagem",
                onAction: () => {
                  setActiveTab("chat");
                }
              });
            } catch (err) {
              console.error("Erro ao buscar remetente:", err);
            }
          }
        }
      )
      .subscribe();

    // 2. Escutador de avaliações de IA de interesse
    const recordChannel = supabase
      .channel("global-records-notifications")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "ia_records" },
        async (payload) => {
          const recordRaw = payload.new as any;
          if (!recordRaw || !recordRaw.data) return;

          const updatedRec = recordRaw.data as IARecord;
          updatedRec.id = recordRaw.id; // Garante ID correto

          setRecords(prevRecords => {
            const oldRec = prevRecords.find(r => r.id === updatedRec.id);
            if (oldRec) {
              const statusAuditoriaChanged = oldRec.statusAuditoria !== updatedRec.statusAuditoria;
              const statusUsoChanged = oldRec.statusUso !== updatedRec.statusUso;

              if (statusAuditoriaChanged || statusUsoChanged) {
                const currentProfile = profileRef.current;
                
                // Notificar se a IA editada pertence ao mesmo setor do usuário
                const isRelevantForMe = 
                  updatedRec.unidadeSetor?.toLowerCase().trim() === currentProfile?.setor?.toLowerCase().trim();

                const isUpdatedByMe = currentProfile?.role?.toLowerCase().trim() === "admin" && 
                  (activeTabRef.current === "admin" || activeTabRef.current === "sectors");

                if (isRelevantForMe && !isUpdatedByMe) {
                  let text = "";
                  if (statusAuditoriaChanged && statusUsoChanged) {
                    text = `Auditoria: "${updatedRec.statusAuditoria}" e Uso: "${updatedRec.statusUso}".`;
                  } else if (statusAuditoriaChanged) {
                    text = `Auditoria atualizada para "${updatedRec.statusAuditoria}".`;
                  } else {
                    text = `Status de uso atualizado para "${updatedRec.statusUso}".`;
                  }

                  setTimeout(() => {
                    addToast({
                      title: `IA Avaliada: ${updatedRec.nomeFerramenta}`,
                      message: text,
                      type: updatedRec.statusAuditoria === StatusAuditoria.APROVADO ? "success" : "info",
                      actionLabel: "Analisar",
                      onAction: () => {
                        setSelectedRecord(updatedRec);
                        setActiveTab("report");
                      }
                    });
                  }, 50);
                }
              }
              return prevRecords.map(r => r.id === updatedRec.id ? updatedRec : r);
            }
            return prevRecords;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(recordChannel);
    };
  }, [user]);

  const handleSync = async () => {
    if (supabaseStatus !== "online") {
      alert("Supabase está offline. Verifique suas chaves de API.");
      return;
    }
    
    setIsSyncing(true);
    try {
      console.log("Forçando sincronização manual...");
      const isAdmin = isCurrentUserAdmin;
      await saveRecordsToSupabase(records, user?.id, isAdmin);
      await refreshRecords();
      alert("✅ Sincronização concluída com sucesso!");
    } catch (error: any) {
      console.error("Erro na sincronização manual:", error);
      alert(`❌ Erro na sincronização: ${error.message || "Erro desconhecido"}. Verifique o SQL do Supabase.`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleEdit = (record: IARecord) => {
    setSelectedRecord(record);
    setActiveTab("new");
  };

  const handleView = (record: IARecord) => {
    setOriginTab(activeTab);
    setSelectedRecord(record);
    setActiveTab("report");
  };

  const handleDelete = async (id: string) => {
    // Optimistic update
    const previousRecords = [...records];
    setRecords(prev => prev.filter(r => r.id !== id));
    
    try {
      await deleteRecord(id);
      await refreshRecords();
      if (selectedRecord?.id === id) {
        setSelectedRecord(null);
      }
    } catch (error) {
      console.error("Erro ao excluir:", error);
      setRecords(previousRecords);
      alert("Houve um erro ao excluir o registro. Por favor, tente novamente.");
    }
  };

  const handleSave = async (record: IARecord) => {
    const isNew = !records.find(r => r.id === record.id);
    const isAdmin = isCurrentUserAdmin;
    
    try {
      if (isNew) {
        await addRecord(record, user?.id, isAdmin);
        // Criar workflow de aprovação automaticamente e de forma consistente no Backend com fallback se falhar conexao
        try {
          const { data, error: sessionErr } = await supabase.auth.getSession();
          if (sessionErr) throw new Error(sessionErr.message);
          const session = data?.session;
          if (!session?.access_token) {
            throw new Error("Sessão ou token de acesso de autenticação não encontrado.");
          }
          
          let success = false;
          try {
            const initRes = await fetch("/api/workflow/init", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${session.access_token}`
              },
              body: JSON.stringify({ recordId: record.id })
            });
            
            if (initRes.ok) {
              success = true;
            } else {
              const errBody = await initRes.json().catch(() => ({}));
              console.warn("Retorno de erro na inicialização do workflow:", errBody);
            }
          } catch (fetchErr) {
            console.warn("Falha de conexão com a API de inicialização de workflow. Usando fallback direto:", fetchErr);
          }

          if (!success) {
            // Callback direto no supabase
            const { data: existingWf } = await supabase
              .from("approval_workflows")
              .select("id, current_step, final_status")
              .eq("ia_record_id", record.id)
              .maybeSingle();

            let targetWf = existingWf;
            let needsSteps = false;

            if (existingWf) {
              const { data: existingSteps } = await supabase
                .from("approval_steps")
                .select("id")
                .eq("workflow_id", existingWf.id);

              if (!existingSteps || existingSteps.length === 0) {
                needsSteps = true;
              }
            } else {
              const { data: newWf, error: newWfErr } = await supabase
                .from("approval_workflows")
                .insert({
                  ia_record_id: record.id,
                  current_step: 1,
                  final_status: "pendente",
                })
                .select("id, current_step, final_status")
                .single();

              if (newWfErr || !newWf) {
                throw new Error(`Não foi possível inicializar o fluxo de aprovação local: ${newWfErr?.message || "Erro desconhecido"}`);
              }
              targetWf = newWf;
              needsSteps = true;
            }

            if (needsSteps && targetWf) {
              const { data: configRows } = await supabase
                .from("approval_config")
                .select("*")
                .order("step_number");

              const defaultSteps = [
                { step_number: 1, role_name: "Coordenador NIT", is_opinion_only: false },
                { step_number: 2, role_name: "Gerente NIT", is_opinion_only: false },
                { step_number: 3, role_name: "Gerente TI", is_opinion_only: false },
                { step_number: 4, role_name: "Período de Teste", is_opinion_only: false },
                { step_number: 5, role_name: "Presidência", is_opinion_only: false },
                { step_number: 6, role_name: "Direção Financeira", is_opinion_only: true },
              ];

              const stepsToInsert = (configRows && configRows.length > 0)
                ? configRows.map((c: any) => ({
                    workflow_id: targetWf.id,
                    ia_record_id: record.id,
                    step_number: c.step_number,
                    role_name: c.role_name,
                    assigned_user_id: c.assigned_user_id || null,
                    assigned_user_name: c.assigned_user_name || null,
                    status: "aguardando",
                    comment: null,
                    is_opinion_only: c.is_opinion_only || false,
                    decided_at: null,
                  }))
                : defaultSteps.map(s => ({
                    workflow_id: targetWf.id,
                    ia_record_id: record.id,
                    step_number: s.step_number,
                    role_name: s.role_name,
                    assigned_user_id: null,
                    assigned_user_name: null,
                    status: "aguardando",
                    comment: null,
                    is_opinion_only: s.is_opinion_only,
                    decided_at: null,
                  }));

              await supabase.from("approval_steps").insert(stepsToInsert);
            }

            // Atualizar status de uso para Em avaliação
            const { data: iaRecord } = await supabase
              .from("ia_records")
              .select("data")
              .eq("id", record.id)
              .single();

            if (iaRecord?.data) {
              const recordData = iaRecord.data as any;
              const updatedData = {
                ...recordData,
                statusUso: "Em avaliação",
              };

              await supabase
                .from("ia_records")
                .update({
                  data: updatedData,
                  status_uso: "Em avaliação",
                  updated_at: new Date().toISOString()
                })
                .eq("id", record.id);
            }
          }
        } catch (wfErr) {
          console.error("Erro ao criar workflow:", wfErr);
          throw wfErr;
        }
      } else {
        await updateRecord(record, user?.id, isAdmin);
      }
      await Promise.all([refreshRecords(), loadApprovalData()]);
      setActiveTab("inventory");
      setSelectedRecord(null);
    } catch (error: any) {
      console.error("Erro ao salvar registro:", error);
      alert(`⚠️ Erro ao salvar: ${error.message || "Erro desconhecido"}. Verifique o console ou a estrutura do banco.`);
    }
  };

  const handleSaveApprovalConfig = async (config: ApprovalConfig) => {
    try {
      for (const step of config.steps) {
        await supabase.from("approval_config").upsert({
          step_number: step.stepNumber,
          role_name: step.roleName,
          assigned_user_id: step.userId || null,
          assigned_user_name: step.userName || null,
          is_opinion_only: step.isOpinionOnly || false,
          updated_at: new Date().toISOString(),
          updated_by: user?.id,
        }, { onConflict: "step_number" });
      }

      // Sincronizar também os fluxos ativos (pendentes) com os novos responsáveis e nomes
      const { data: activeWfs } = await supabase
        .from("approval_workflows")
        .select("id")
        .eq("final_status", "pendente");

      if (activeWfs && activeWfs.length > 0) {
        const activeWfIds = activeWfs.map(w => w.id);
        for (const step of config.steps) {
          await supabase
            .from("approval_steps")
            .update({
              role_name: step.roleName,
              assigned_user_id: step.userId || null,
              assigned_user_name: step.userName || null,
            })
            .in("workflow_id", activeWfIds)
            .eq("step_number", step.stepNumber);
        }
      }

      setApprovalConfig(config);
      await loadApprovalData(); // Recarrega os dados do workflow atualizados
    } catch (e) {
      console.error("Erro ao salvar config de aprovação:", e);
    }
  };

  const handleUpdateStatus = async (recordId: string, status: any, comment?: string, extraFields?: any) => {
    const record = records.find(r => r.id === recordId);
    if (!record) return;

    // Verificar se o usuário atual é o responsável designado para a etapa atual, um admin ou moderador
    const wf = workflows.find(w => w.iaRecordId === recordId);
    const currentStepNum = wf ? wf.currentStep : 1;
    const configStep = approvalConfig?.steps?.find(s => s.stepNumber === currentStepNum);
    const wfStep = wf?.steps?.find(s => s.stepNumber === currentStepNum);
    const assignedUserId = configStep?.userId || wfStep?.assignedUserId;

    const isAssignedToMe = assignedUserId === user?.id;

    if (!assignedUserId) {
      alert("Esta etapa ainda não possui responsável definido. Configure o fluxo antes de aprovar ou negar.");
      return;
    }

    if (!isAssignedToMe) {
      alert("Apenas o responsável designado para esta etapa pode aprovar ou negar.");
      return;
    }

    const decision = status === StatusAuditoria.APROVADO ? "aprovado" : "negado";

    try {
      const { data, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) {
        throw new Error(`Erro ao recuperar sessão: ${sessionErr.message}`);
      }
      const session = data?.session;
      
      let success = false;
      let result: any = null;

      try {
        const response = await fetch("/api/workflow/decide", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({ recordId, decision, comment, coordinatorData: extraFields })
        });

        if (response.ok) {
          result = await response.json();
          success = true;
        } else {
          const errRes = await response.json().catch(() => ({}));
          console.warn("O servidor retornou erro na decisão:", errRes);
          if (errRes.error) {
            alert(`⚠️ ${errRes.error}`);
            return;
          }
        }
      } catch (err) {
        console.warn("Falha de conexão com a API de decisão do workflow. Iniciando fallback local no Supabase:", err);
      }

      if (!success) {
        const wfData = await supabase
          .from("approval_workflows")
          .select("id, current_step, final_status")
          .eq("ia_record_id", recordId)
          .maybeSingle();

        let activeWf = wfData.data;
        if (!activeWf) {
          throw new Error("Workflow ativo não encontrado no Supabase.");
        }

        const { data: stepRow } = await supabase
          .from("approval_steps")
          .select("id, is_opinion_only, assigned_user_id, assigned_user_name")
          .eq("workflow_id", activeWf.id)
          .eq("step_number", activeWf.current_step)
          .maybeSingle();

        if (!stepRow) {
          throw new Error("Etapa do fluxo não encontrada diretamente no banco.");
        }

        const decisionStatus = decision === "aprovado" ? "aprovado" : "negado";
        const fullName = (session?.user as any)?.user_metadata?.full_name || session?.user?.email || "Avaliador";

        await supabase
          .from("approval_steps")
          .update({
            status: decisionStatus,
            comment: comment || null,
            decided_at: new Date().toISOString(),
            assigned_user_id: stepRow.assigned_user_id || user?.id,
            assigned_user_name: stepRow.assigned_user_name || fullName,
          })
          .eq("id", stepRow.id);

        const { data: allSteps } = await supabase
          .from("approval_steps")
          .select("step_number")
          .eq("workflow_id", activeWf.id);

        const stepNumbers = (allSteps || []).map((step: any) => Number(step.step_number));
        const maxStep = stepNumbers.length > 0 ? Math.max(...stepNumbers) : 6;

        const currentStepNumber = Number(activeWf.current_step);
        const nextStep = currentStepNumber + 1;
        const isFinalStep = currentStepNumber === maxStep;
        const isFinancialStep = currentStepNumber === 6;

        let finalStatus = "pendente";
        let newAuditStatus = "Pendente";
        let newStatusUso = "Em avaliação";
        let workflowUpdatePayload: any = {};

        if (decision === "negado" && isFinancialStep) {
          // Exceção: Direção Financeira desfavorável não reprova a IA. Como ela é o passo 6 (final), concluímos o fluxo como aprovado.
          finalStatus = "aprovado";
          newAuditStatus = "Aprovado";
          newStatusUso = "Aprovado";

          workflowUpdatePayload = {
            current_step: currentStepNumber,
            final_status: "aprovado",
            completed_at: new Date().toISOString()
          };
        } else if (decision === "negado") {
          // Negativa real nas demais etapas encerra o fluxo.
          finalStatus = "negado";
          newAuditStatus = "Negado";
          newStatusUso = "Não aprovado";

          workflowUpdatePayload = {
            current_step: currentStepNumber,
            final_status: "negado",
            completed_at: new Date().toISOString()
          };
        } else if (decision === "aprovado" && isFinalStep) {
          // Aprovação encerra o fluxo como aprovado.
          finalStatus = "aprovado";
          newAuditStatus = "Aprovado";
          newStatusUso = "Aprovado";

          workflowUpdatePayload = {
            current_step: currentStepNumber,
            final_status: "aprovado",
            completed_at: new Date().toISOString()
          };
        } else {
          // Aprovação de etapa intermediária avança normalmente.
          finalStatus = "pendente";
          newAuditStatus = "Pendente";

          if (nextStep >= 4) {
            newStatusUso = "Em teste/piloto";
          } else {
            newStatusUso = "Em avaliação";
          }

          workflowUpdatePayload = {
            current_step: nextStep,
            final_status: "pendente"
          };
        }

        await supabase
          .from("approval_workflows")
          .update(workflowUpdatePayload)
          .eq("id", activeWf.id);

        const { data: iaRecord } = await supabase
          .from("ia_records")
          .select("data")
          .eq("id", recordId)
          .single();

        if (iaRecord?.data) {
          const recordData = iaRecord.data as any;
          let actionLabel = decision === "aprovado"
            ? `Etapa ${currentStepNumber}/${maxStep} aprovada por ${fullName}`
            : `Etapa ${currentStepNumber}/${maxStep} negada por ${fullName}`;

          if (decision === "negado" && isFinancialStep) {
            actionLabel = `Direção Financeira: parecer desfavorável. Fluxo concluído com aprovação da Presidência.`;
          }

          const updatedData = {
            ...recordData,
            ...(extraFields || {}),
            statusAuditoria: newAuditStatus,
            statusUso: newStatusUso,
            observacoesGeraisOriginais: recordData.observacoesGeraisOriginais || recordData.observacoesGerais || "",
            historico: [{
              date: new Date().toISOString(),
              user: fullName,
              action: actionLabel,
              message: comment || actionLabel
            }, ...(recordData.historico || [])]
          };

          const updatePayload: any = {
            data: updatedData,
            status_uso: newStatusUso,
          };

          const currentDateStr = new Date().toISOString().split("T")[0];

          if (decision === "negado" && isFinancialStep) {
            updatePayload.status_uso = "Aprovado";
            updatedData.statusUso = "Aprovado";
            updatedData.statusAuditoria = "Aprovado";
            updatePayload.observacoes_gerais = comment || "Direção Financeira: parecer desfavorável. Fluxo concluído com aprovação da Presidência.";
          } else if (decision === "negado") {
            updatePayload.status_uso = "Não aprovado";
            updatePayload.parecer_tecnico = "IA indeferida no fluxo de aprovacão.";
            updatePayload.data_aprovacao = currentDateStr;
            if (comment) {
              updatePayload.observacoes_gerais = comment;
            }

            updatedData.statusUso = "Não aprovado";
            updatedData.statusAuditoria = "Negado";
            updatedData.parecerTecnico = "IA indeferida no fluxo de aprovação.";
            updatedData.dataAprovacao = currentDateStr;
          } else if (decision === "aprovado" && isFinalStep) {
            updatePayload.status_uso = "Aprovado";
            updatePayload.parecer_tecnico = "IA aprovada no fluxo de aprovação.";
            updatePayload.data_aprovacao = currentDateStr;
            if (comment) {
              updatePayload.observacoes_gerais = comment;
            }

            updatedData.statusUso = "Aprovado";
            updatedData.statusAuditoria = "Aprovado";
            updatedData.parecerTecnico = "IA aprovada no fluxo de aprovação.";
            updatedData.dataAprovacao = currentDateStr;
          }

          await supabase
            .from("ia_records")
            .update(updatePayload)
            .eq("id", recordId);
        }

        let responseMessage = "";
        if (decision === "negado" && isFinancialStep) {
          responseMessage = "Parecer financeiro desfavorável registrado. Fluxo concluído com aprovação da Presidência.";
        } else if (finalStatus === "aprovado") {
          responseMessage = "IA aprovada com sucesso.";
        } else if (finalStatus === "negado") {
          responseMessage = "IA indeferida.";
        } else {
          responseMessage = `Aprovado! Aguardando etapa ${nextStep}.`;
        }

        result = {
          finalStatus,
          message: responseMessage
        };
      }

      const newAuditStatus = result.finalStatus === "aprovado" 
        ? StatusAuditoria.APROVADO 
        : result.finalStatus === "negado" 
          ? StatusAuditoria.NEGADO 
          : StatusAuditoria.PENDENTE;

      const newStatusUso = result.finalStatus === "aprovado"
        ? StatusUso.APROVADO
        : result.finalStatus === "negado"
          ? StatusUso.NAO_APROVADO
          : StatusUso.EM_AVALIACAO;

      const updatedRecord = {
        ...record,
        statusAuditoria: newAuditStatus,
        statusUso: newStatusUso,
      };

      setRecords(prev => prev.map(r => r.id === recordId ? updatedRecord : r));

      if (result.finalStatus === "aprovado") {
        addToast({ title: "IA Aprovada!", message: result.message, type: "success" });
      } else if (result.finalStatus === "negado") {
        addToast({ title: "IA Indeferida", message: result.message, type: "warning" });
      } else {
        addToast({ title: "Etapa Concluída", message: result.message, type: "info" });
      }

      await refreshRecords();
      await loadApprovalData();
    } catch (error: any) {
      console.error("Erro ao atualizar status:", error);
      alert(`⚠️ Erro ao atualizar status: ${error.message || "Erro de conexão com o servidor"}`);
      await refreshRecords();
    }
  };

  const handleResetStatus = async (recordId: string, reason?: string) => {
    try {
      const { data, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) {
        throw new Error(`Erro ao recuperar sessão: ${sessionErr.message}`);
      }
      const session = data?.session;
      
      let success = false;
      let resultMessage = "";

      try {
        const response = await fetch("/api/workflow/reset-status", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({ recordId, reason })
        });

        const contentType = response.headers.get("content-type");
        if (response.ok && contentType && contentType.indexOf("application/json") !== -1) {
          const result = await response.json();
          success = true;
          resultMessage = result.message || "";
        }
      } catch (err) {
        console.warn("Rota API de reset-status falhou, executando redefinição direta no Supabase:", err);
      }

      if (!success) {
        const { data: iaRecord } = await supabase
          .from("ia_records")
          .select("*")
          .eq("id", recordId)
          .single();

        if (!iaRecord) {
          throw new Error("Registro de IA não encontrado");
        }

        const { data: workflow } = await supabase
          .from("approval_workflows")
          .select("*")
          .eq("ia_record_id", recordId)
          .maybeSingle();

        if (workflow) {
          await supabase
            .from("approval_workflows")
            .update({
              current_step: 1,
              final_status: "pendente",
              completed_at: null
            })
            .eq("id", workflow.id);

          await supabase
            .from("approval_steps")
            .update({
              status: "aguardando",
              comment: null,
              decided_at: null
            })
            .eq("workflow_id", workflow.id);
        }

        const recordData = iaRecord.data ? { ...iaRecord.data } : {};
        const oldStatus = iaRecord.status || recordData.statusAuditoria || "Não avaliado";
        const fullName = (session?.user as any)?.user_metadata?.full_name || session?.user?.email || "Administrador";

        const now = new Date();
        const pad = (num: number) => String(num).padStart(2, "0");
        const formattedDate = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
        const infoMessage = `O status desta IA foi redefinido por um administrador em ${formattedDate} e ela retornou para análise no início do fluxo de aprovação.${reason ? ` Motivo: ${reason}` : ""}`;

        const newHistoryEntry = {
          date: now.toISOString(),
          user: fullName,
          action: "Status redefinido por administrador",
          message: infoMessage
        };

        recordData.statusAuditoria = "Pendente";
        recordData.statusUso = "Em avaliação";
        recordData.dataAprovacao = null;
        recordData.parecerTecnico = "";
        recordData.historico = [newHistoryEntry, ...(recordData.historico || [])];

        const { error: updateErr } = await supabase
          .from("ia_records")
          .update({
            data: recordData,
            status: "Pendente",
            status_uso: "Em avaliação",
            parecer_tecnico: "",
            data_aprovacao: null
          })
          .eq("id", recordId);

        if (updateErr) {
          console.error("Erro durante update do ia_records:", updateErr);
          await supabase
            .from("ia_records")
            .update({
              data: recordData
            })
            .eq("id", recordId);
        }
      }

      addToast({ 
        title: "Status Redefinido", 
        message: "A IA retornou para análise no fluxo de aprovação com sucesso.", 
        type: "success" 
      });

      await refreshRecords();
      await loadApprovalData();
    } catch (error: any) {
      console.error("Erro ao redefinir status:", error);
      alert(`Erro: ${error.message || "Erro desconhecido ao redefinir status"}`);
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: "admin" | "moderator" | "user") => {
    // Check if it's a real GUID/UUID (Fallback names are not UUIDs)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    
    if (!isUuid) {
      alert(`⚠️ Não foi possível atualizar: Este usuário ainda não possui uma conta de acesso ao sistema (perfil incompleto). Apenas usuários que já fizeram login pelo menos uma vez podem ser tornados administradores.`);
      return;
    }

    // Guard against self-demotion to avoid losing access to admin panel accidentally
    if (userId === user?.id && newRole === "user") {
      const confirmSelf = window.confirm("⚠️ Você está prestes a remover seus próprios privilégios de administrador. Você perderá acesso a este painel. Deseja continuar?");
      if (!confirmSelf) return;
    }

    // Optimistic update
    const previousProfiles = [...profiles];
    setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role: newRole } : p));

    try {
      console.log(`🚀 Solicitando alteração de cargo para usuário ${userId} para: ${newRole}`);
      
      // Get the session token for authentication
      const { data, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) {
        throw new Error(`Erro ao recuperar sessão: ${sessionErr.message}`);
      }
      const session = data?.session;
      
      const response = await fetch("/api/admin/update-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ userId, newRole })
      });

      let result;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        result = await response.json();
      } else {
        const text = await response.text();
        throw new Error(`Erro do servidor (${response.status}): O servidor não retornou JSON. Verifique se as rotas de API estão configuradas.`);
      }

      if (!response.ok) {
        throw new Error(result.error || "Falha na comunicação com o servidor");
      }
      
      if (result.success && result.profile) {
        console.log(`✅ Alteração persistida via API para ${userId}`);
        setProfiles(prev => prev.map(p => p.id === userId ? result.profile : p));
      } else {
        throw new Error("Resposta inesperada do servidor.");
      }
      
      // Full refresh to ensure consistency across all data
      if (userId === user?.id) {
        await refreshProfile();
      }
      await refreshRecords();
      const roleLabel = newRole === "admin" ? "ADMINISTRADOR" : newRole === "moderator" ? "MODERADOR" : "USUÁRIO COMUM";
      alert(`✅ Sucesso! O usuário agora tem acesso de ${roleLabel}.`);
    } catch (error: any) {
      console.error("❌ Erro fatal ao atualizar role do usuário:", error);
      // Rollback
      setProfiles(previousProfiles);
      alert(`Erro: ${error.message || "Erro desconhecido ao atualizar permissões"}`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const { data, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) {
        throw new Error(`Erro ao recuperar sessão: ${sessionErr.message}`);
      }
      const session = data?.session;
      const response = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ userId })
      });

      let result;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        result = await response.json();
      } else {
        await response.text(); // consume body anyway
        throw new Error(`Erro do servidor (${response.status}). Verifique se as rotas de API do backend estão ativas no ambiente de produção.`);
      }

      if (!response.ok) {
        throw new Error(result.error || "Falha ao apagar usuário");
      }

      setProfiles(prev => prev.filter(p => p.id !== userId));
      alert("✅ Usuário apagado com sucesso.");
    } catch (error: any) {
      console.error("Erro ao apagar usuário:", error);
      alert(`⚠️ Erro ao apagar: ${error.message}`);
    }
  };

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "inventory", label: "Inventário de IA", icon: ClipboardList },
    { id: "approval_queue", label: "Aprovação de IAs", icon: ShieldCheck, privilegedOnly: true },
    { id: "sectors", label: "Mapa de IAs", icon: Users, adminOnly: true },
    { id: "sectors_mgr", label: "Setores", icon: Building2, adminOnly: true },
    { id: "admin", label: "Administração IA", icon: ShieldAlert, adminOnly: false, privilegedOnly: true },
    { id: "new", label: "Nova Solicitação", icon: PlusCircle },
    { id: "alerts", label: "Alertas", icon: Bell },
    { id: "chat", label: "Chat", icon: MessageSquare },
    { id: "profile", label: "Meu Perfil", icon: UserCircle },
  ].filter(item => (!item.adminOnly || isCurrentUserAdmin) && (!("privilegedOnly" in item && item.privilegedOnly) || isCurrentUserPrivileged));

  const sidebarGroupConfigs = [
    {
      title: "IA e Inventário",
      itemIds: ["dashboard", "inventory", "new"]
    },
    {
      title: "Administração",
      itemIds: ["approval_queue", "sectors", "sectors_mgr", "admin"],
      show: isCurrentUserAdmin
    },
    {
      title: "Auxiliares",
      itemIds: ["alerts", "chat", "profile"]
    }
  ];

  const sidebarGroups = sidebarGroupConfigs
    .filter(g => g.show === undefined || g.show)
    .map(g => {
      const items = g.itemIds
        .map(id => menuItems.find(item => item.id === id))
        .filter((item): item is typeof menuItems[number] => !!item);
      return {
        title: g.title,
        items
      };
    })
    .filter(g => g.items.length > 0);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lab-cyan"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={isDarkMode ? "dark" : ""}>
        <Auth />
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans selection:bg-brand-green selection:text-black transition-colors duration-300 bg-[var(--bg-main)] ${isDarkMode ? "dark" : ""}`}>
      <LabBackground />

      {/* VERSÃO MOBILE DO CEDRO IA MONITOR */}
      <div className="block lg:hidden min-h-screen flex flex-col bg-[#F6F8F5] text-[#1F2933]">
        {/* 1. TOPO FIXO / STICKY */}
        <header className="sticky top-0 z-50 bg-white border-b border-[#E3E8E1] h-16 flex items-center justify-center px-4 shadow-3xs">
          <img 
            src="https://raw.githubusercontent.com/nitlabcedro/assets/refs/heads/main/Ativo%206.png" 
            alt="Laboratório Cedro" 
            className="h-8 w-auto object-contain brightness-0 text-[#003F1D]" 
            referrerPolicy="no-referrer"
          />
        </header>

        {/* 2. CONTEÚDO */}
        <main className="flex-1 overflow-y-auto pb-24 pt-5 px-4">
          {activeTab === "profile" ? (
            <UserProfileView />
          ) : (
            <ApprovalPage 
              records={records}
              profiles={profiles}
              workflows={workflows}
              approvalConfig={approvalConfig}
              currentUserId={user?.id}
              onUpdateStatus={handleUpdateStatus}
              onSaveApprovalConfig={handleSaveApprovalConfig}
              onViewRecord={handleView}
              isAdmin={isCurrentUserAdmin}
            />
          )}
        </main>

        {/* 3. NAVEGAÇÃO INFERIOR */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#E3E8E1] rounded-t-3xl shadow-[0_-4px_16px_rgba(0,0,0,0.03)]" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <div className="flex justify-around items-center h-16">
            
            {/* Aba Aprovação de IAs */}
            <button
              onClick={() => setActiveTab("approval_queue")}
              className="flex flex-col items-center justify-center flex-1 h-full select-none transition-colors active:scale-95 cursor-pointer"
            >
              <div className={`p-1 transition-colors ${activeTab === "approval_queue" ? "text-[#075618]" : "text-[#667085]"}`}>
                <ClipboardList size={20} strokeWidth={activeTab === "approval_queue" ? 2.5 : 2} />
              </div>
              <span className={`text-[10px] font-black uppercase tracking-wider transition-colors ${
                activeTab === "approval_queue" ? "text-[#075618]" : "text-[#667085]"
              }`}>
                Aprovação de IAs
              </span>
            </button>

            {/* Aba Meu Perfil */}
            <button
              onClick={() => setActiveTab("profile")}
              className="flex flex-col items-center justify-center flex-1 h-full select-none transition-colors active:scale-95 cursor-pointer"
            >
              <div className={`p-1 transition-colors ${activeTab === "profile" ? "text-[#075618]" : "text-[#667085]"}`}>
                <UserCircle size={20} strokeWidth={activeTab === "profile" ? 2.5 : 2} />
              </div>
              <span className={`text-[10px] font-black uppercase tracking-wider transition-colors ${
                activeTab === "profile" ? "text-[#075618]" : "text-[#667085]"
              }`}>
                Meu Perfil
              </span>
            </button>

          </div>
        </nav>
      </div>

      {/* VERSÃO DESKTOP COMPLETA DO CEDRO IA MONITOR */}
      <div className="hidden lg:flex min-h-screen flex-row w-full relative">

      <Sidebar
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        profile={profile}
        isCurrentUserAdmin={isCurrentUserAdmin}
        isCurrentUserPrivileged={isCurrentUserPrivileged}
        onNewSolicitation={() => setSelectedRecord(null)}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-[#FAF9F6]">
        <Topbar
          profile={profile}
          isCurrentUserAdmin={isCurrentUserAdmin}
          activeUnreadAlertsCount={activeUnreadAlertsCount}
          setActiveTab={setActiveTab}
        />

        <div className={`flex-1 ${activeTab === 'chat' ? 'overflow-hidden h-[calc(100vh-80px)]' : 'overflow-auto'} p-6 md:p-8 custom-scrollbar bg-[var(--bg-content)]`}>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className={`max-w-[95rem] w-full mx-auto relative ${
                activeTab === "chat"
                  ? "bg-[var(--bg-card-page)] border-2 border-[var(--border-page)] rounded-2xl p-3 md:p-4 shadow-2xl text-[var(--text-bright)] h-full min-h-0 flex flex-col"
                  : "bg-[var(--bg-card-page)] border-2 border-[var(--border-page)] rounded-2xl p-6 md:p-10 shadow-2xl text-[var(--text-bright)]"
              }`}
            >
              {activeTab === "dashboard" && (
                <Dashboard records={records} onNavigate={(tab) => setActiveTab(tab)} onView={handleView} isAdmin={isCurrentUserAdmin} workflows={workflows} approvalConfig={approvalConfig} currentUserId={user?.id} />
              )}
              {activeTab === "inventory" && (
                <Inventory 
                  records={records} 
                  onEdit={handleEdit} 
                  onView={handleView} 
                  onDelete={handleDelete}
                  onAdd={() => {
                    setSelectedRecord(null);
                    setActiveTab("new");
                  }}
                  onRefresh={refreshRecords} approvalConfig={approvalConfig} onSaveApprovalConfig={handleSaveApprovalConfig}
                  isAdmin={isCurrentUserAdmin}
                  workflows={workflows}
                />
              )}
              {activeTab === "sectors" && isCurrentUserAdmin && (
                <SectorMap records={records} profiles={profiles} />
              )}
              {activeTab === "sectors_mgr" && isCurrentUserAdmin && (
                <SectorsManager records={records} profiles={profiles} onRefresh={refreshRecords} approvalConfig={approvalConfig} onSaveApprovalConfig={handleSaveApprovalConfig} />
              )}
              {activeTab === "approval_queue" && isCurrentUserPrivileged && (
                <ApprovalPage 
                  records={records}
                  profiles={profiles}
                  workflows={workflows}
                  approvalConfig={approvalConfig}
                  currentUserId={user?.id}
                  onUpdateStatus={handleUpdateStatus}
                  onSaveApprovalConfig={handleSaveApprovalConfig}
                  onViewRecord={handleView}
                  isAdmin={isCurrentUserAdmin}
                />
              )}
              {activeTab === "admin" && isCurrentUserPrivileged && (
                <AdminPanel 
                  records={records} 
                  profiles={profiles}
                  onUpdateStatus={handleUpdateStatus} 
                  onViewRecord={handleView} 
                  onEditRecord={handleEdit}
                  onDeleteRecord={handleDelete}
                  onUpdateUserRole={handleUpdateUserRole}
                  onDeleteUser={handleDeleteUser}
                  approvalConfig={approvalConfig}
                  onSaveApprovalConfig={handleSaveApprovalConfig}
                  currentUserId={user?.id}
                  workflows={workflows}
                  supabaseStatus={supabaseStatus}
                  isSyncing={isSyncing}
                  onSync={handleSync}
                  onResetStatus={handleResetStatus}
                  onNavigate={(tab) => setActiveTab(tab)}
                />
              )}
              {activeTab === "chat" && (
                <Chat />
              )}
              {activeTab === "profile" && (
                <UserProfileView />
              )}
              {activeTab === "alerts" && (
                <div className="w-full max-w-none select-none space-y-6 text-[#1F2933] animate-fade-in">
                  
                  {/* Cabeçalho */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#E3E8E1] pb-6">
                    <div>
                      <h3 className="text-2xl font-black text-[#003F1D] tracking-tight uppercase">Central de Alertas</h3>
                    </div>
                    <span className="text-[10px] font-black text-[#075618] px-3.5 py-1.5 bg-[#EAF4EC] border border-[#BFD8C5] rounded-full uppercase tracking-wider font-sans shadow-3xs flex items-center gap-1.5 select-none">
                      <span className="size-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      Status: Ativo e Monitorando
                    </span>
                  </div>

                  {/* Cards Pequenos no Topo */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Card 1: Alertas ativos */}
                    <div className="bg-white p-5 rounded-2xl border border-[#E3E8E1] shadow-3xs flex items-center gap-4 transition-all hover:scale-[1.01]">
                      <div className="p-3 bg-[#EAF4EC]/70 text-[#075618] rounded-xl border border-[#BFD8C5]/40 select-none">
                        <Bell size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-[#667085] uppercase tracking-wider">Alertas ativos</p>
                        <p className="text-xl font-black text-[#1F2933] mt-0.5">
                          {systemAlerts.filter(a => a.status !== "Resolvido").length}
                        </p>
                      </div>
                    </div>

                    {/* Card 2: Críticos */}
                    <div className="bg-white p-5 rounded-2xl border border-[#E3E8E1] shadow-3xs flex items-center gap-4 transition-all hover:scale-[1.01]">
                      <div className="p-3 bg-[#FEF3F2] text-[#B42318] rounded-xl border border-[#FECDCA]/60 select-none">
                        <AlertCircle size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-[#667085] uppercase tracking-wider">Críticos</p>
                        <p className="text-xl font-black text-[#B42318] mt-0.5">
                          {systemAlerts.filter(a => a.status !== "Resolvido" && a.level === "CRÍTICO").length}
                        </p>
                      </div>
                    </div>

                    {/* Card 3: Pendentes */}
                    <div className="bg-white p-5 rounded-2xl border border-[#E3E8E1] shadow-3xs flex items-center gap-4 transition-all hover:scale-[1.01]">
                      <div className="p-3 bg-[#FFF9EB] text-[#F59E0B] rounded-xl border border-[#FEF08A]/60 select-none">
                        <Info size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-[#667085] uppercase tracking-wider">Atenção / Pendentes</p>
                        <p className="text-xl font-black text-[#F59E0B] mt-0.5">
                          {systemAlerts.filter(a => a.status !== "Resolvido" && a.level === "ATENÇÃO").length}
                        </p>
                      </div>
                    </div>

                    {/* Card 4: Resolvidos */}
                    <div className="bg-white p-5 rounded-2xl border border-[#E3E8E1] shadow-3xs flex items-center gap-4 transition-all hover:scale-[1.01]">
                      <div className="p-3 bg-[#EAF4EC]/70 text-emerald-700 rounded-xl border border-[#BFD8C5]/40 select-none">
                        <CheckCircle size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-[#667085] uppercase tracking-wider">Resolvidos</p>
                        <p className="text-xl font-black text-emerald-700 mt-0.5">
                          {systemAlerts.filter(a => a.status === "Resolvido").length}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Filtros */}
                  <div className="flex flex-wrap gap-2 pt-2 pb-1 border-b border-[#E3E8E1]/60">
                    {[
                      { id: "all", label: "Ativos" },
                      { id: "critical", label: "Críticos" },
                      { id: "warning", label: "Atenção" },
                      { id: "info", label: "Informativos" },
                      { id: "resolved", label: "Resolvidos" },
                    ].map((filt) => (
                      <button
                        key={filt.id}
                        onClick={() => setAlertFilter(filt.id as any)}
                        className={`text-[10px] font-extrabold uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
                          alertFilter === filt.id
                            ? "bg-[#075618] text-white shadow-3xs hover:bg-[#003F1D]"
                            : "bg-white text-[#667085] border border-[#E3E8E1] hover:bg-[#F6F8F5] hover:text-[#1F2933]"
                        }`}
                      >
                        {filt.label}
                      </button>
                    ))}
                  </div>

                  {/* Listagem de Alertas */}
                  {(() => {
                    // Filtrar as notificações com base nas abas
                    const filtered = systemAlerts.filter(a => {
                      if (alertFilter === "all") return a.status !== "Resolvido";
                      if (alertFilter === "critical") return a.status !== "Resolvido" && a.level === "CRÍTICO";
                      if (alertFilter === "warning") return a.status !== "Resolvido" && a.level === "ATENÇÃO";
                      if (alertFilter === "info") return a.status !== "Resolvido" && a.level === "INFORMATIVO";
                      if (alertFilter === "resolved") return a.status === "Resolvido";
                      return true;
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="py-16 text-center space-y-4 bg-white rounded-3xl border border-[#E3E8E1] shadow-3xs">
                          <div className="inline-flex p-4 bg-[#EAF4EC] text-[#075618] border border-[#BFD8C5] rounded-full">
                            <CheckCircle2 size={24} />
                          </div>
                          <div>
                            <p className="text-[#1F2933] font-bold text-sm uppercase tracking-wider">Nenhum alerta ativo</p>
                            <p className="text-xs text-[#667085] mt-1.5 max-w-md mx-auto">
                              Todos os processos de IA monitorados estão em conformidade no momento.
                            </p>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-4">
                        {filtered.map((alert) => {
                          // Definir estilos de acordo com severidade
                          const containerStyle = 
                            alert.status === "Resolvido" 
                              ? "bg-[#F6F8F5]/60 hover:bg-[#F6F8F5] border-[#E3E8E1] opacity-80"
                              : alert.level === "CRÍTICO"
                                ? "bg-white hover:bg-[#FEF3F2]/30 border-[#E3E8E1] border-l-4 border-l-[#B42318]"
                                : alert.level === "ATENÇÃO"
                                  ? "bg-white hover:bg-[#FFF9EB]/30 border-[#E3E8E1] border-l-4 border-l-[#F59E0B]"
                                  : "bg-white hover:bg-[#EAF4EC]/20 border-[#E3E8E1] border-l-4 border-l-[#075618]";

                          const badgeStyle = 
                            alert.status === "Resolvido"
                              ? "bg-[#E3E8E1] text-[#667085]"
                              : alert.level === "CRÍTICO"
                                ? "bg-[#FEF3F2] text-[#B42318] border border-[#FECDCA]"
                                : alert.level === "ATENÇÃO"
                                  ? "bg-[#FFF9EB] text-[#F59E0B] border border-[#FEF08A]"
                                  : "bg-[#EAF4EC] text-[#075618] border border-[#BFD8C5]";

                          return (
                            <div 
                              key={alert.id} 
                              className={`p-5 rounded-2xl border ${containerStyle} flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all duration-150 hover:shadow-xs hover:translate-x-0.5`}
                            >
                              <div className="space-y-2 min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded tracking-wider ${badgeStyle}`}>
                                    {alert.level}
                                  </span>
                                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                                    • {alert.source}
                                  </span>
                                  {alert.status === "Lido" && alert.status !== "Resolvido" && (
                                    <span className="text-[9px] font-medium bg-[#E3E8E1] text-[#667085] px-1.5 py-0.5 rounded uppercase font-bold tracking-wide">
                                      Lido
                                    </span>
                                  )}
                                </div>
                                <h4 className="font-extrabold text-[#1F2933] text-sm tracking-tight uppercase">{alert.title}</h4>
                                <p className="text-xs leading-relaxed text-[#667085] font-medium">{alert.desc}</p>
                                <p className="text-[10px] text-slate-400 font-semibold">
                                  Gerado em: {new Date(alert.createdAt).toLocaleString("pt-BR")}
                                </p>
                              </div>

                              <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center flex-wrap">
                                {/* Botão Ação Principal (Ver IA ou Abrir perfil) */}
                                {alert.actionType === "open-ia" && alert.relatedRecordId && (
                                  <button
                                    onClick={() => {
                                      const matched = records.find(r => r.id === alert.relatedRecordId);
                                      if (matched) {
                                        setSelectedRecord(matched);
                                        setActiveTab("report");
                                      }
                                    }}
                                    className="px-3.5 py-2.5 bg-white hover:bg-[#F6F8F5] text-[#1F2933] border border-[#E3E8E1] rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-3xs flex items-center gap-1.5"
                                  >
                                    <Eye size={12} className="text-[#667085]" /> Abrir IA
                                  </button>
                                )}

                                {alert.actionType === "open-profile" && (
                                  <button
                                    onClick={() => setActiveTab("profile")}
                                    className="px-3.5 py-2.5 bg-white hover:bg-[#F6F8F5] text-[#1F2933] border border-[#E3E8E1] rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-3xs flex items-center gap-1.5"
                                  >
                                    <UserCircle size={12} className="text-[#667085]" /> Perfil
                                  </button>
                                )}

                                {/* Marcar como lido */}
                                {alert.status === "Ativo" && (
                                  <button
                                    onClick={() => {
                                      saveAlertInteraction(alert.id, "Lido");
                                      triggerAlertsRefresh();
                                    }}
                                    className="px-3.5 py-2.5 bg-[#EAF4EC] hover:bg-[#D5EAD9] text-[#075618] border border-[#BFD8C5] rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
                                    title="Marcar como lido"
                                  >
                                    Lido
                                  </button>
                                )}

                                {/* Marcar como resolvido */}
                                {alert.status !== "Resolvido" && (
                                  <button
                                    onClick={() => {
                                      saveAlertInteraction(alert.id, "Resolvido");
                                      triggerAlertsRefresh();
                                    }}
                                    className="px-3.5 py-2.5 bg-[#075618] hover:bg-[#003F1D] text-white border border-[#075618] rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-3xs flex items-center gap-1"
                                    title="Marcar como Resolvido"
                                  >
                                    <Check size={12} strokeWidth={3} /> Resolver
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}
              {activeTab === "new" && (
                <RegistrationForm 
                  initialData={selectedRecord} 
                  onSave={handleSave} 
                  onCancel={() => setActiveTab("inventory")} 
                  isAdmin={isCurrentUserAdmin}
                />
              )}
              {activeTab === "report" && (
                selectedRecord ? (
                  <ReportView 
                    record={selectedRecord} 
                    onBack={() => {
                      setSelectedRecord(null);
                      if (originTab && originTab !== "report") {
                        setActiveTab(originTab as any);
                      } else {
                        setActiveTab("inventory");
                      }
                    }} 
                    onEdit={handleEdit}
                    isAdmin={isCurrentUserAdmin}
                    workflows={workflows}
                    approvalConfig={approvalConfig}
                  />
                ) : (
                  <div className="space-y-8 pb-20">
                    <div className="glass p-12 rounded-[2.5rem] border border-[var(--border-lab)] relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-lab-blue/5 blur-3xl rounded-full pointer-events-none"></div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {records.map(record => (
                            <button
                              key={record.id}
                              onClick={() => setSelectedRecord(record)}
                              className="group flex flex-col p-6 bg-white/[0.02] border border-brand-green/20 rounded-3xl hover:bg-black/5 dark:hover:bg-white/5 hover:border-brand-green/50 transition-all text-left relative overflow-hidden shadow-lg shadow-brand-green/5"
                            >
                            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-lab-cyan/50 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>
                            <div className="flex justify-between items-start mb-6">
                              <span className="text-[10px] font-mono font-bold text-emerald-800 dark:text-brand-green bg-brand-green/20 px-2 py-1 rounded border border-brand-green/40 uppercase tracking-tight">{record.id}</span>
                              <div className="p-1.5 rounded-lg bg-black/5 dark:bg-white/5 text-slate-500 group-hover:text-lab-cyan group-hover:bg-lab-cyan/10 transition-all border border-transparent group-hover:border-lab-cyan/20">
                                <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                              </div>
                            </div>
                            <h4 className="font-bold text-[var(--text-bright)] text-lg tracking-tight mb-1 group-hover:text-lab-cyan transition-colors uppercase truncate">{record.nomeFerramenta}</h4>
                            <p className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-tight truncate w-full flex items-center gap-2">
                              <Users size={12} className="opacity-50" /> {record.unidadeSetor}
                            </p>
                            
                            <div className="mt-8 pt-6 border-t border-[var(--border-lab)] flex justify-between items-center">
                              <div className={`px-3 py-1 rounded-full border text-[10px] font-bold uppercase flex items-center gap-1.5 ${
                                record.statusUso === StatusUso.APROVADO 
                                  ? "bg-brand-green/10 text-brand-green border-brand-green/20" 
                                  : "bg-brand-orange/10 text-brand-orange border-brand-orange/20"
                              }`}>
                                <div className={`size-1.5 rounded-full ${record.statusUso === StatusUso.APROVADO ? "bg-brand-green" : "bg-brand-orange"}`}></div>
                                {record.statusUso}
                              </div>
                              <span className="text-[10px] font-mono text-[var(--text-muted)]">{record.dataRegistro}</span>
                            </div>
                          </button>
                        ))}
                      </div>

                      {records.length === 0 && (
                        <div className="py-32 text-center space-y-6">
                          <div className="inline-block p-6 bg-black/5 dark:bg-white/[0.02] rounded-full border border-[var(--border-lab)] relative">
                            <div className="absolute inset-0 bg-brand-green/5 blur-xl rounded-full"></div>
                            <ClipboardList className="text-[var(--text-muted)] relative z-10" size={40} />
                          </div>
                          <div className="space-y-2">
                            <p className="text-[var(--text-muted)] font-bold text-base uppercase tracking-wide">Nenhum dado encontrado para auditoria</p>
                            <p className="text-sm text-[var(--text-muted)]">Aguardando novos registros para gerar relatórios de conformidade.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {/* Removed redundant delete modal as it's handled by components */}
      </AnimatePresence>

      {/* Toast Notification Container */}
      <div className="fixed bottom-24 right-4 lg:bottom-6 lg:right-6 z-50 flex flex-col gap-3 w-[calc(100vw-2rem)] sm:w-[380px] pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => {
            // Configurações dinâmicas de estilo baseadas no tipo de notificação
            let accentColor = "bg-[#075618]";
            let barColor = "bg-[#075618]";
            let borderColor = "border-[#BFD8C5]";
            let glowColor = "shadow-[0_8px_30px_rgba(7,86,24,0.08)]";
            let IconComponent = Info;
            let iconColor = "text-[#075618]";
            let bgLight = "bg-emerald-50/40";
            let typeLabel = "Notificação";

            if (toast.type === "success") {
              accentColor = "bg-emerald-600";
              barColor = "bg-emerald-500";
              borderColor = "border-emerald-200";
              glowColor = "shadow-[0_8px_30px_rgba(16,185,129,0.12)]";
              IconComponent = CheckCircle2;
              iconColor = "text-emerald-600";
              bgLight = "bg-emerald-50/50";
              typeLabel = "Sucesso";
            } else if (toast.type === "warning") {
              accentColor = "bg-amber-500";
              barColor = "bg-amber-500";
              borderColor = "border-amber-250";
              glowColor = "shadow-[0_8px_30px_rgba(245,158,11,0.12)]";
              IconComponent = AlertTriangle;
              iconColor = "text-amber-600";
              bgLight = "bg-amber-50/50";
              typeLabel = "Aviso / Alerta";
            } else if (toast.type === "chat") {
              accentColor = "bg-[#075618]";
              barColor = "bg-emerald-600";
              borderColor = "border-[#BFD8C5]";
              glowColor = "shadow-[0_8px_30px_rgba(7,86,24,0.12)]";
              IconComponent = MessageSquare;
              iconColor = "text-[#075618]";
              bgLight = "bg-emerald-50/60";
              typeLabel = "Mensagem Chat";
            } else if (toast.type === "info") {
              accentColor = "bg-slate-600";
              barColor = "bg-slate-500";
              borderColor = "border-slate-200";
              glowColor = "shadow-[0_8px_30px_rgba(71,85,105,0.1)]";
              IconComponent = Info;
              iconColor = "text-slate-600";
              bgLight = "bg-slate-50/50";
              typeLabel = "Sistema";
            }

            return (
              <motion.div
                key={toast.id}
                initial={{ scale: 0.95, opacity: 0, y: 30 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.85, opacity: 0, x: 50 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className={`pointer-events-auto bg-white/95 backdrop-blur-md rounded-2xl border ${borderColor} p-4 ${glowColor} flex gap-3 relative overflow-hidden`}
              >
                {/* Linha vertical de destaque à esquerda */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${accentColor}`} />

                {/* Ícone Redondo com Background Light suave */}
                <div className={`flex-shrink-0 size-10 rounded-xl ${bgLight} flex items-center justify-center border border-transparent`}>
                  <IconComponent size={20} className={iconColor} />
                </div>
                
                <div className="flex-1 min-w-0 pr-1">
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="space-y-0.5">
                      <span className={`text-[9px] font-black uppercase tracking-wider ${iconColor}`}>
                        {typeLabel}
                      </span>
                      <h4 className="font-extrabold text-slate-900 text-sm tracking-tight leading-snug">
                        {toast.title}
                      </h4>
                    </div>
                    <button 
                      onClick={() => removeToast(toast.id)}
                      className="text-slate-450 hover:text-slate-800 p-1.5 hover:bg-slate-100 rounded-lg transition-all -mr-1 -mt-1 cursor-pointer"
                      title="Fechar"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <p className="text-slate-600 font-medium text-xs leading-relaxed mt-2.5 mb-3.5 whitespace-pre-wrap">
                    {toast.message}
                  </p>
                  
                  {toast.actionLabel && toast.onAction && (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          toast.onAction?.();
                          removeToast(toast.id);
                        }}
                        className="text-[10px] font-black uppercase text-emerald-800 bg-emerald-50 hover:bg-[#075618] hover:text-white py-1.5 px-4 rounded-xl transition-all tracking-wider border border-emerald-200 cursor-pointer shadow-2xs active:scale-95"
                      >
                        {toast.actionLabel}
                      </button>
                    </div>
                  )}
                </div>

                {/* Barra de Progresso Animada de Contagem Regressiva (6 segundos) */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100/50">
                  <motion.div 
                    initial={{ width: "100%" }} 
                    animate={{ width: "0%" }} 
                    transition={{ duration: 6, ease: "linear" }}
                    className={`h-full ${barColor}`} 
                  />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}