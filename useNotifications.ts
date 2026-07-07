import express from "express";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

// Lazy-initialized Supabase clients to prevent startup crashes if keys are not set
let supabaseClient: any = null;
let supabaseAdminClient: any = null;

function getSupabase() {
  if (!supabaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase URL or Anon Key is missing in server environment");
    }
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabaseClient;
}

function getSupabaseAdmin() {
  if (!supabaseAdminClient) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase URL or Service Role Key is missing in admin server environment");
    }
    supabaseAdminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return supabaseAdminClient;
}

// API Routes
const router = express.Router();

router.post("/admin/update-role", async (req, res) => {
  const { userId, newRole } = req.body;
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const token = authHeader.replace("Bearer ", "");
    
    // Lazy initialized supabase client
    const supabase = getSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const { data: requesterProfile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || requesterProfile?.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: You are not an admin" });
    }

    // Lazy initialized supabase admin client
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    return res.json({ success: true, profile: data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
});

router.post("/avatar/upload", async (req, res) => {
  const { fileBase64, fileName, fileType } = req.body;
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const token = authHeader.replace("Bearer ", "");
    const supabase = getSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    if (!fileBase64) {
      return res.status(400).json({ error: "Missing file data" });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Ensure 'avatars' bucket exists and is public
    try {
      const { data: buckets } = await supabaseAdmin.storage.listBuckets();
      const hasBucket = buckets?.some((b: any) => b.name === "avatars");
      if (!hasBucket) {
        await supabaseAdmin.storage.createBucket("avatars", {
          public: true,
          fileSizeLimit: 10485760, // 10MB
          allowedMimeTypes: ["image/*"]
        });
      }
    } catch (bucketErr) {
      console.warn("Error checking/creating 'avatars' bucket:", bucketErr);
    }

    // 2. Decode the Base64 file string into a Buffer
    const buffer = Buffer.from(fileBase64, "base64");

    // 3. Generate file path
    const fileExt = fileName ? fileName.split(".").pop() : "jpg";
    const filePath = `${user.id}/avatar-${Date.now()}.${fileExt}`;

    // 4. Upload using admin client to bypass any user RLS policies
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from("avatars")
      .upload(filePath, buffer, {
        contentType: fileType || "image/jpeg",
        cacheControl: "3600",
        upsert: true
      });

    if (uploadError) {
      throw uploadError;
    }

    // 5. Get the public URL
    const { data: publicUrlData } = supabaseAdmin.storage
      .from("avatars")
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData.publicUrl;

    // 6. Update profiles database table
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        avatar_url: publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq("id", user.id);

    if (updateError) {
      throw updateError;
    }

    return res.json({ success: true, publicUrl });
  } catch (err: any) {
    console.error("Error in avatar upload proxy:", err);
    return res.status(500).json({ error: err.message || "Internal upload error" });
  }
});

router.post("/admin/delete-user", async (req, res) => {
  const { userId } = req.body;
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const token = authHeader.replace("Bearer ", "");
    const supabase = getSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) return res.status(401).json({ error: "Invalid token" });

    const { data: requester } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (requester?.role !== "admin") return res.status(403).json({ error: "Forbidden" });

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Limpar mensagens vinculadas
    await supabaseAdmin.from("messages").delete().eq("sender_id", userId);
    await supabaseAdmin.from("messages").delete().eq("recipient_id", userId);

    // 2. Limpar referências
    await supabaseAdmin.from("ia_records").update({ authorized_by: null }).eq("authorized_by", userId);
    await supabaseAdmin.from("ia_records").update({ owner_id: null }).eq("owner_id", userId);
    await supabaseAdmin.from("profiles").update({ authorized_by: null }).eq("authorized_by", userId);

    // 3. Storage
    try {
      await supabaseAdmin.rpc("delete_user_storage_objects", { user_id: userId });
    } catch (e) {
      // @ts-ignore
      await supabaseAdmin.from("storage.objects").delete().eq("owner", userId).catch(() => {});
    }

    // 4. Deletar perfil
    const { error: profileDeleteError } = await supabaseAdmin.from("profiles").delete().eq("id", userId);
    if (profileDeleteError) {
      return res.status(500).json({ error: `Erro ao apagar perfil: ${profileDeleteError.message}` });
    }

    // 5. Deletar do Auth
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authDeleteError) {
       return res.status(500).json({ 
         error: `Erro ao apagar conta no Auth: ${authDeleteError.message}`
       });
    }

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// obter todas as configurações de aprovação via admin client para evitar RLS
router.get("/workflow/config", async (req, res) => {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data: configData, error } = await supabaseAdmin
      .from("approval_config")
      .select("*")
      .order("step_number");
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.json(configData || []);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// obter todos os workflows ativos e suas etapas correspondentes via admin client para evitar RLS
router.get("/workflow/list", async (req, res) => {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data: wfData, error } = await supabaseAdmin
      .from("approval_workflows")
      .select(`*, steps:approval_steps(*)`);
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.json(wfData || []);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// Inicializar um fluxo de aprovação de forma consistente com a configuração do Administrador
router.post("/workflow/init", async (req, res) => {
  const { recordId } = req.body;
  const authHeader = req.headers.authorization;

  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  try {
    const token = authHeader.replace("Bearer ", "");
    const supabase = getSupabase();
    const supabaseAdmin = getSupabaseAdmin();

    // 1. Verificar quem está fazendo a requisição
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Token inválido" });

    // 2. Buscar workflow da IA
    let wfData = null;
    const { data: existingWf } = await supabaseAdmin
      .from("approval_workflows")
      .select("id, current_step, final_status")
      .eq("ia_record_id", recordId)
      .maybeSingle();

    if (existingWf) {
      wfData = existingWf;
      // 3. Se já existe o workflow, verificar se existem etapas no approval_steps
      const { data: existingSteps } = await supabaseAdmin
        .from("approval_steps")
        .select("id")
        .eq("workflow_id", existingWf.id);

      if (existingSteps && existingSteps.length > 0) {
        // Já possui etapas criadas, não duplicar e não alterar os responsáveis automaticamente (Regra 1 e 3)
        return res.json({ success: true, alreadyExists: true, workflowId: existingWf.id });
      }
    } else {
      // Criar entrada no approval_workflows
      const { data: newWf, error: newWfErr } = await supabaseAdmin
        .from("approval_workflows")
        .insert({
          ia_record_id: recordId,
          current_step: 1,
          final_status: "pendente",
        })
        .select("id, current_step, final_status")
        .single();

      if (newWfErr || !newWf) {
        return res.status(500).json({ error: `Não foi possível inicializar o fluxo de aprovação para esta IA: ${newWfErr?.message || "Erro desconhecido"}` });
      }
      wfData = newWf;
    }

    // 4. Buscar configuração atual salva pelo administrador na tela "Configurar Fluxo"
    const { data: configRows } = await supabaseAdmin
      .from("approval_config")
      .select("*")
      .order("step_number");

    // Etapas padrão caso as configurações de fluxo estejam vazias
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
          workflow_id: wfData.id,
          ia_record_id: recordId,
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
          workflow_id: wfData.id,
          ia_record_id: recordId,
          step_number: s.step_number,
          role_name: s.role_name,
          assigned_user_id: null,
          assigned_user_name: null,
          status: "aguardando",
          comment: null,
          is_opinion_only: s.is_opinion_only,
          decided_at: null,
        }));

    const { error: stepsInsertErr } = await supabaseAdmin
      .from("approval_steps")
      .insert(stepsToInsert);

    if (stepsInsertErr) {
      console.error("Erro ao inserir etapas do fluxo:", stepsInsertErr);
      return res.status(500).json({ error: `Erro ao salvar as etapas do fluxo: ${stepsInsertErr.message}` });
    }

    // 5. Atualizar status_uso da IA para "Em avaliação" no início do workflow
    const { data: iaRecord } = await supabaseAdmin
      .from("ia_records")
      .select("data")
      .eq("id", recordId)
      .single();

    if (iaRecord?.data) {
      const recordData = iaRecord.data as any;
      const updatedData = {
        ...recordData,
        statusUso: "Em avaliação",
      };

      await supabaseAdmin
        .from("ia_records")
        .update({
          data: updatedData,
          status_uso: "Em avaliação",
          updated_at: new Date().toISOString()
        })
        .eq("id", recordId);
    }

    return res.json({ success: true, workflowId: wfData.id });

  } catch (err: any) {
    console.error("Erro no workflow/init:", err);
    return res.status(500).json({ error: err.message || "Erro interno" });
  }
});

// Rota de aprovação/negação de IA com validação de fluxo
router.post("/workflow/decide", async (req, res) => {
  const { recordId, decision, comment, coordinatorData } = req.body;
  const authHeader = req.headers.authorization;

  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
  if (!["aprovado", "negado"].includes(decision)) {
    return res.status(400).json({ error: "Decisão inválida. Use: aprovado ou negado" });
  }

  try {
    const token = authHeader.replace("Bearer ", "");
    const supabase = getSupabase();
    const supabaseAdmin = getSupabaseAdmin();

    // 1. Verificar quem está fazendo a requisição
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Token inválido" });

    // 2. Obter perfil do solicitante
    const { data: requesterProfile } = await supabaseAdmin
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .single();

    const role = requesterProfile?.role?.toLowerCase().trim() || "user";
    const fullName = requesterProfile?.full_name || user.email || "Avaliador";

    // 3. Buscar workflow da IA
    let wfData = null;
    const { data: existingWf } = await supabaseAdmin
      .from("approval_workflows")
      .select("id, current_step, final_status")
      .eq("ia_record_id", recordId)
      .maybeSingle();

    if (existingWf) {
      wfData = existingWf;

      // Autocorreção preventiva se o workflow existir mas as etapas estiverem vazias
      const { data: existingSteps } = await supabaseAdmin
        .from("approval_steps")
        .select("id")
        .eq("workflow_id", existingWf.id);

      if (!existingSteps || existingSteps.length === 0) {
        console.log(`Workflow ${existingWf.id} encontrado sem etapas. Criando etapas automáticas...`);
        const { data: configRows } = await supabaseAdmin
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
              workflow_id: existingWf.id,
              ia_record_id: recordId,
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
              workflow_id: existingWf.id,
              ia_record_id: recordId,
              step_number: s.step_number,
              role_name: s.role_name,
              assigned_user_id: null,
              assigned_user_name: null,
              status: "aguardando",
              comment: null,
              is_opinion_only: s.is_opinion_only,
              decided_at: null,
            }));

        await supabaseAdmin.from("approval_steps").insert(stepsToInsert);
      }
    } else {
      console.log(`Workflow não encontrado para a IA ${recordId}. Inicializando on-the-fly...`);
      // Buscar configuração atual das etapas de aprovação
      const { data: configRows } = await supabaseAdmin
        .from("approval_config")
        .select("*")
        .order("step_number");

      // Criar entrada no approval_workflows
      const { data: newWf, error: newWfErr } = await supabaseAdmin
        .from("approval_workflows")
        .insert({
          ia_record_id: recordId,
          current_step: 1,
          final_status: "pendente",
        })
        .select("id, current_step, final_status")
        .single();

      if (newWfErr || !newWf) {
        return res.status(500).json({ error: `Não foi possível inicializar o fluxo de aprovação para esta IA: ${newWfErr?.message || "Erro desconhecido"}` });
      }

      wfData = newWf;

      // Montar e inserir as etapas do workflow no approval_steps
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
            workflow_id: newWf.id,
            ia_record_id: recordId,
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
            workflow_id: newWf.id,
            ia_record_id: recordId,
            step_number: s.step_number,
            role_name: s.role_name,
            assigned_user_id: null,
            assigned_user_name: null,
            status: "aguardando",
            comment: null,
            is_opinion_only: s.is_opinion_only,
            decided_at: null,
          }));

      const { error: stepsInsertErr } = await supabaseAdmin
        .from("approval_steps")
        .insert(stepsToInsert);

      if (stepsInsertErr) {
        console.error("Erro ao inserir etapas automáticas:", stepsInsertErr);
      }
    }

    if (wfData.final_status !== "pendente") {
      return res.status(400).json({ error: "Esta IA já teve seu fluxo encerrado" });
    }

    // 4. Verificar se o usuário é o responsável pela etapa atual
    const { data: currentStepData } = await supabaseAdmin
      .from("approval_steps")
      .select("id, is_opinion_only, assigned_user_id")
      .eq("workflow_id", wfData.id)
      .eq("step_number", wfData.current_step)
      .maybeSingle();

    if (!currentStepData) {
      return res.status(404).json({ error: "Etapa atual não encontrada no workflow" });
    }

    if (!currentStepData.assigned_user_id) {
      return res.status(403).json({
        error: "Esta etapa ainda não possui responsável definido. Configure o fluxo antes de aprovar ou negar."
      });
    }

    const isAssignedToMe = currentStepData.assigned_user_id === user.id;

    if (!isAssignedToMe) {
      return res.status(403).json({ 
        error: "Apenas o responsável designado para esta etapa pode aprovar ou negar." 
      });
    }

    // 5. Registrar decisão (Regra 4)
    // Atualizar status da etapa correspondente para 'aprovado' ou 'negado'
    const decisionStatus = decision === "aprovado" ? "aprovado" : "negado";

    await supabaseAdmin
      .from("approval_steps")
      .update({
        status: decisionStatus,
        comment: comment || null,
        decided_at: new Date().toISOString(),
        assigned_user_id: currentStepData.assigned_user_id || user.id,
        assigned_user_name: currentStepData.assigned_user_name || fullName,
      })
      .eq("id", currentStepData.id);

    // 6. Contar total de etapas e calcular regras de fluxo dinamicamente
    const { data: allSteps } = await supabaseAdmin
      .from("approval_steps")
      .select("step_number")
      .eq("workflow_id", wfData.id);

    const stepNumbers = (allSteps || []).map((step: any) => Number(step.step_number));
    const maxStep = stepNumbers.length > 0 ? Math.max(...stepNumbers) : 6;

    const currentStepNumber = Number(wfData.current_step);
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

    await supabaseAdmin
      .from("approval_workflows")
      .update(workflowUpdatePayload)
      .eq("id", wfData.id);

    // 7. Atualizar o registro da IA no banco
    const { data: iaRecord } = await supabaseAdmin
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
        ...(coordinatorData || {}),
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

      const currentDateStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

      if (decision === "negado" && isFinancialStep) {
        updatePayload.status_uso = "Aprovado";
        updatedData.statusUso = "Aprovado";
        updatedData.statusAuditoria = "Aprovado";
        updatePayload.observacoes_gerais = comment || "Direção Financeira: parecer desfavorável. Fluxo concluído com aprovação da Presidência.";
      } else if (decision === "negado") {
        updatePayload.status_uso = "Não aprovado";
        updatePayload.parecer_tecnico = "IA indeferida no fluxo de aprovação.";
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

      await supabaseAdmin
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

    return res.json({ 
      success: true, 
      finalStatus,
      nextStep: finalStatus === "pendente" ? nextStep : null,
      message: responseMessage
    });

  } catch (err: any) {
    console.error("Erro no workflow/decide:", err);
    return res.status(500).json({ error: err.message || "Erro interno" });
  }
});

// Reset status endpoint for administrators
router.post("/workflow/reset-status", async (req, res) => {
  const { recordId, reason } = req.body;
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Não autorizado: token ausente" });
  }

  try {
    const token = authHeader.replace("Bearer ", "");
    const supabase = getSupabase();
    const supabaseAdmin = getSupabaseAdmin();

    // 1. Validar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: "Token inválido ou expirado" });
    }

    // 2. Validar se o usuário é admin
    const { data: profileRow, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .single();

    if (profileErr || profileRow?.role !== "admin") {
      return res.status(403).json({ error: "Acesso proibido: Apenas administradores podem redefinir o status de uma IA." });
    }

    const adminFullName = profileRow?.full_name || user.email || "Administrador";

    // 3. Localizar ia_record
    const { data: iaRecord, error: iaErr } = await supabaseAdmin
      .from("ia_records")
      .select("*")
      .eq("id", recordId)
      .single();

    if (iaErr || !iaRecord) {
      return res.status(404).json({ error: "Registro de IA não encontrado" });
    }

    // 4. Localizar approval_workflow
    const { data: workflow, error: wfErr } = await supabaseAdmin
      .from("approval_workflows")
      .select("*")
      .eq("ia_record_id", recordId)
      .maybeSingle();

    if (workflow) {
      // Reiniciar approval_workflow
      const { error: wfUpdateErr } = await supabaseAdmin
        .from("approval_workflows")
        .update({
          current_step: 1,
          final_status: "pendente",
          completed_at: null
        })
        .eq("id", workflow.id);

      if (wfUpdateErr) {
        return res.status(500).json({ error: `Erro ao reiniciar o workflow: ${wfUpdateErr.message}` });
      }

      // Reiniciar approval_steps para aguardando
      const { error: stepsUpdateErr } = await supabaseAdmin
        .from("approval_steps")
        .update({
          status: "aguardando",
          comment: null,
          decided_at: null
        })
        .eq("workflow_id", workflow.id);

      if (stepsUpdateErr) {
        return res.status(500).json({ error: `Erro ao redefinir as etapas de aprovação: ${stepsUpdateErr.message}` });
      }
    }

    // 5. Atualizar ia_records para status de nova avaliação e registrar histórico
    const recordData = iaRecord.data ? { ...iaRecord.data } : {};
    const oldStatus = iaRecord.status || recordData.statusAuditoria || "Não avaliado";

    const now = new Date();
    const pad = (num: number) => String(num).padStart(2, "0");
    const formattedDate = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const infoMessage = `O status desta IA foi redefinido por um administrador em ${formattedDate} e ela retornou para análise no início do fluxo de aprovação.${reason ? ` Motivo: ${reason}` : ""}`;

    const newHistoryEntry = {
      date: now.toISOString(),
      user: adminFullName,
      action: "Status redefinido por administrador",
      message: infoMessage
    };

    recordData.statusAuditoria = "Pendente";
    recordData.statusUso = "Em avaliação";
    recordData.dataAprovacao = null;
    recordData.parecerTecnico = "";
    recordData.historico = [newHistoryEntry, ...(recordData.historico || [])];

    let iaUpdateErr: any = null;
    try {
      const { error } = await supabaseAdmin
        .from("ia_records")
        .update({
          data: recordData,
          status: "Pendente",
          status_uso: "Em avaliação",
          parecer_tecnico: "",
          data_aprovacao: null
        })
        .eq("id", recordId);
      iaUpdateErr = error;
    } catch (e: any) {
      iaUpdateErr = e;
    }

    if (iaUpdateErr) {
      const errMsg = (iaUpdateErr.message || "").toLowerCase();
      const isMissingColumn = 
        iaUpdateErr.code === "PGRST204" || 
        iaUpdateErr.code === "42703" || 
        errMsg.includes("status") || 
        errMsg.includes("schema cache");

      if (isMissingColumn) {
        console.warn("⚠️ Coluna 'status' ou similar não existe em ia_records. Tentando fallback sem a coluna 'status'...");
        const { error: retryError } = await supabaseAdmin
          .from("ia_records")
          .update({
            data: recordData,
            status_uso: "Em avaliação"
          })
          .eq("id", recordId);
        iaUpdateErr = retryError;
      }
    }

    if (iaUpdateErr) {
      return res.status(500).json({ error: `Erro ao atualizar a ficha da IA: ${iaUpdateErr.message}` });
    }

    return res.json({
      success: true,
      message: "Status e fluxo de aprovação reiniciados com sucesso!",
      recordId
    });

  } catch (err: any) {
    console.error("Erro no workflow/reset-status:", err);
    return res.status(500).json({ error: err.message || "Erro interno do servidor" });
  }
});

// Routing mapping
app.use("/api", router);
app.use("/.netlify/functions/api", router);

export { app };