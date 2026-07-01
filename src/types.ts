/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum TiposIA {
  CHATBOT = "Chatbot / assistente virtual",
  IA_GENERATIVA = "IA generativa",
  AUTOMACAO = "Automação",
  ANALISE_DADOS = "Análise de dados",
  ANALISE_IMAGENS = "Análise de imagens",
  MACHINE_LEARNING = "Machine Learning",
  APOIO_DECISAO = "Apoio à decisão",
  EQUIPAMENTO_IA_EMBARCADA = "Equipamento com IA embarcada",
  OUTRO = "Outro"
}

export enum ObjetivosIA {
  APOIO_TECNICO = "Apoio técnico",
  AUTOMACAO = "Automação",
  REDUCAO_ERROS = "Redução de erros",
  PRODUTIVIDADE = "Produtividade",
  APOIO_DECISAO = "Apoio à decisão",
  TRIAGEM_PRIORIZACAO = "Triagem ou priorização",
  COMUNICACAO_PACIENTE_MEDICO = "Comunicação com paciente ou médico",
  ANALISE_IMAGENS = "Análise de imagens",
  GESTAO_ADMINISTRATIVA = "Gestão administrativa",
  OUTRO = "Outro"
}

export enum EtapaProcesso {
  PRE_ANALITICA = "Pré-analítica",
  ANALITICA = "Analítica",
  POS_ANALITICA = "Pós-analítica",
  ATENDIMENTO = "Atendimento",
  COMERCIAL = "Comercial",
  FINANCEIRO = "Financeiro",
  FATURAMENTO = "Faturamento",
  QUALIDADE = "Qualidade",
  TI = "TI",
  GESTAO = "Gestão",
  OUTRO = "Outro"
}

export enum RiscoResidual {
  BAIXO = "Baixo",
  MEDIO = "Médio",
  ALTO = "Alto",
  NAO_AVALIADO = "Não avaliado"
}

export enum Criticidade {
  BAIXA = "Baixa: apoio administrativo",
  MEDIA = "Média: apoio técnico sem impacto direto em resultados",
  ALTA = "Alta: impacto direto em laudos/resultados"
}

export enum NaturezaUso {
  ADMINISTRATIVO = "Administrativo",
  OPERACIONAL = "Operacional",
  TECNICO = "Técnico",
  ASSISTENCIAL = "Assistencial",
  DIAGNOSTICO = "Diagnóstico",
  ESTRATEGICO = "Estratégico"
}

export enum GrauAutonomia {
  BAIXO = "Baixo: apenas apoio ou sugestão",
  MEDIO = "Médio: recomenda ação, mas exige validação humana",
  ALTO = "Alto: executa ou decide automaticamente"
}

export enum ClassificacaoRisco {
  BAIXO = "Baixo risco",
  MEDIO = "Médio risco",
  ALTO = "Alto risco",
  CRITICO = "Risco crítico"
}

export enum StatusUso {
  EM_AVALIACAO = "Em avaliação",
  APROVADO = "Aprovado",
  APROVADO_COM_RESTRICOES = "Aprovado com restrições",
  NAO_APROVADO = "Não aprovado",
  SUSPENSO = "Suspenso",
  EM_TESTE_PILOTO = "Em teste/piloto",
  CANCELADA = "Cancelada pelo solicitante"
}

export enum StatusAuditoria {
  PENDENTE = "Pendente",
  APROVADO = "Aprovado",
  NEGADO = "Negado"
}

export interface IARecord {
  statusAuditoria?: StatusAuditoria;
  id: string; // Generated automatically like IA-CEDRO-0001
  ownerId?: string;
  createdAt: string;
  updatedAt: string;

  // 1. IDENTIFICAÇÃO
  unidadeSetor: string;
  responsavelPreenchimento: string;
  cargo: string;
  dataRegistro: string;
  contato?: string;

  // 2. IDENTIFICAÇÃO DO USO DE IA
  utilizaIA: "Sim" | "Não";
  nomeFerramenta: string;
  fornecedor: string;
  versao: string;
  tipoIA: TiposIA[];
  tipoIAOutro?: string;

  // 3. FINALIDADE
  descricaoAtividade: string;
  objetivos: ObjetivosIA[];
  objetivoOutro?: string;
  etapaProcesso: EtapaProcesso;
  etapaOutro?: string;
  beneficiosEsperados: string;

  // 4. DADOS
  usaDadosPessoais: "Sim" | "Não";
  usaDadosSensiveis: "Sim" | "Não";
  quaisDados: string;
  dadosAnonimizados: "Sim" | "Não" | "Parcial";
  envioFornecedorExterno: "Sim" | "Não" | "Não sei";
  dadosTreinamentoModelo: "Sim" | "Não" | "Não sei";
  obsProtecaoDados: string;

  // 5. PROCESSO E INTEGRAÇÃO
  integradaSistemaInterno: "Sim" | "Não";
  qualSistema?: string;
  impactoResultadosLaboratoriais: "Sim" | "Não";
  validacaoHumana: "Sim" | "Não";
  quemValida?: string;
  registroLogDecisao: "Sim" | "Não" | "Não sei";
  ambienteHomologacao: "Sim" | "Não" | "Não sei";
  obsIntegracao: string;

  // 6. RISCOS E CONTROLES
  riscosIdentificados: "Sim" | "Não";
  quaisRiscos: string;
  controlesImplementados: "Sim" | "Não";
  quaisControles: string[];
  controleOutro?: string;
  riscoResidual: RiscoResidual;
  responsavelRisco: string;
  frequenciaReavaliacao: string;
  obsRiscosControles: string;

  // 7. CONFORMIDADE E SEGURANÇA
  alinhadoLGPD: "Sim" | "Não" | "Em avaliação";
  politicaInterna: "Sim" | "Não";
  treinamentoColaboradores: "Sim" | "Não";
  documentacaoTecnica: "Sim" | "Não" | "Não se aplica";
  contratoProtecaoDados: "Sim" | "Não" | "Em avaliação" | "Não se aplica";
  controleAcessoPerfil: "Sim" | "Não" | "Não sei";
  trilhaAuditoria: "Sim" | "Não" | "Não sei";
  procedimentoIncidente: "Sim" | "Não";
  obsConformidade: string;

  // 8. CLASSIFICAÇÃO
  criticidade: Criticidade;
  naturezaUso: NaturezaUso;
  grauAutonomia: GrauAutonomia;
  classificacaoRiscoAutomatico: ClassificacaoRisco;
  classificacaoRiscoManual: ClassificacaoRisco;
  justificativaAlteracaoRisco?: string;

  // 9. APROVAÇÃO
  areaAvaliadora: string[];
  areaAvaliadoraOutra?: string;
  statusUso: StatusUso;
  necessitaPlanoAcao: "Sim" | "Não";
  descricaoPlanoAcao?: string;
  responsavelPlanoAcao?: string;
  prazoPlanoAcao?: string;
  parecerTecnico: string;
  dataAprovacao?: string;
  proximaRevisao?: string;

  // 10. OBSERVAÇÕES
  observacoesGerais: string;
  observacoesGeraisOriginais?: string;
  anexos: string;
  documentoUrl?: string;
  documentoNome?: string;
  documentoTamanho?: number;
  documentoTipo?: string;
  historico: Array<{ date: string; action: string; user?: string; message?: string }>;
}

export interface UserProfile {
  id: string;
  full_name: string;
  avatar_url?: string;
  cargo?: string;
  setor?: string;
  contato?: string;
  role?: "admin" | "moderator" | "user";
  status: "Pendente" | "Autorizado" | "Rejeitado";
  last_seen?: string;
  authorized_by?: string;
  authorized_at?: string;
  updated_at?: string;
}

export interface ChatMessage {
  id: string;
  created_at: string;
  sender_id: string;
  content: string;
  is_private: boolean;
  recipient_id?: string;
  sender_profile?: UserProfile;
  attachment_url?: string;
  attachment_name?: string;
  attachment_type?: string;
  attachment_size?: number;
  status?: "sending" | "error";
}

// ============================================================
// SISTEMA DE APROVAÇÃO EM ETAPAS
// ============================================================

export interface ApprovalStep {
  stepNumber: number;        // 1-5
  roleName: string;          // "Coordenador NIT", "Gerente NIT", etc
  assignedUserId?: string;   // ID do usuário responsável por esta etapa
  assignedUserName?: string; // Nome para exibição
  status: "aguardando" | "aprovado" | "negado" | "opiniao";
  comment?: string;
  decidedAt?: string;
  isOpinionOnly?: boolean;   // true para etapa 5 (Direção Financeira)
}

export interface ApprovalWorkflow {
  iaRecordId: string;
  currentStep: number;       // 1-5, 0 = concluído
  steps: ApprovalStep[];
  finalStatus?: "aprovado" | "negado" | "pendente" | "cancelado";
  completedAt?: string;
}

export interface ApprovalConfig {
  steps: {
    stepNumber: number;
    roleName: string;
    userId?: string;       // ID do usuário responsável (admin ou moderador)
    userName?: string;     // Nome para exibição
    isOpinionOnly?: boolean;
  }[];
}

// Papéis do sistema
export type UserRole = "admin" | "moderator" | "user";

// Verificação de permissão de aprovação
export function canUserApprove(
  userId: string,
  workflow: ApprovalWorkflow,
  config: ApprovalConfig
): boolean {
  if (!workflow || workflow.finalStatus !== "pendente") return false;
  const currentStepConfig = config.steps.find(s => s.stepNumber === workflow.currentStep);
  return currentStepConfig?.userId === userId;
}
