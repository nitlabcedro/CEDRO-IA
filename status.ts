/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from "./lib/supabase";
import {
  IARecord,
  StatusAuditoria,
  StatusUso,
  Criticidade,
  ClassificacaoRisco,
  TiposIA,
  ObjetivosIA,
  EtapaProcesso,
  NaturezaUso,
  GrauAutonomia,
  RiscoResidual,
  UserProfile
} from "./types";

const STORAGE_KEY = "cedro_ia_inventory";

export const getProfiles = async (): Promise<UserProfile[]> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching profiles:', error);
    return [];
  }
};

export const getGlobalRecords = async (): Promise<IARecord[]> => {
  try {
    console.log('🌐 Buscando todos os registros públicos no Supabase (ID de Protocolo Global)...');
    const { data, error } = await supabase
      .from('ia_records')
      .select('*')
      .order('id', { ascending: true });

    if (error) throw error;
    
    if (data && data.length > 0) {
      return data
        .filter(item => item.id !== 'METADATA-SECTORS')
        .map(item => {
          let record: IARecord;
          if (item.data) {
            record = item.data as IARecord;
            record.id = item.id;
            record.unidadeSetor = item.unidade_setor || record.unidadeSetor || '';
            record.ownerId = item.owner_id || record.ownerId || '';
          } else {
            record = {
              id: item.id,
              unidadeSetor: item.unidade_setor || '',
              ownerId: item.owner_id || '',
              nomeFerramenta: item.nome_ferramenta || '',
            } as any as IARecord;
          }

          // Force sync with database columns to prevent stale client JSON state
          if (item.status) {
            record.statusAuditoria = item.status as StatusAuditoria;
          }
          if (item.status_uso) {
            record.statusUso = item.status_uso === "Negado" ? StatusUso.NAO_APROVADO : (item.status_uso as StatusUso);
          }
          return record;
        });
    }
    return [];
  } catch (error) {
    console.error('💥 Erro ao buscar registros globais:', error);
    return [];
  }
};

export const getRecords = async (userId?: string, isAdmin?: boolean, userSector?: string): Promise<IARecord[]> => {
  let finalIsAdmin = isAdmin;
  try {
    // Clear old fallback localStorage keys related to records/inventory to avoid showing stale mock data
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem("cedro_custom_sectors");
      const keysToRemove = ["records", "inventory", "ia_records", "workflows", "approvals"];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !key.startsWith("sb-") && keysToRemove.some(prefix => key.includes(prefix))) {
          localStorage.removeItem(key);
        }
      }
    } catch (e) {
      console.warn("Erro ao limpar localStorage de fallbacks:", e);
    }

    if (userId && !finalIsAdmin && isValidUUID(userId)) {
      try {
        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .single();
        if (!profErr && prof && prof.role?.toLowerCase().trim() === 'admin') {
          console.log('👑 Role admin verificada diretamente no banco!');
          finalIsAdmin = true;
        }
      } catch (e) {
        console.warn('Erro ao checar admin no banco em getRecords:', e);
      }
    }

    console.log('🔍 Buscando registros no Supabase...', { userId, isAdmin: finalIsAdmin, userSector });

    let query = supabase
      .from('ia_records')
      .select('*');

    if (!finalIsAdmin) {
      console.log('🛡️ Aplicando filtros de segurança para usuário comum (Setor OU Propriedade)');
      const sectors = (userSector || '')
        .split(';')
        .map(s => s.trim())
        .filter(Boolean);
      
      if (sectors.length > 0) {
        const sectorConditions = sectors.map(s => `unidade_setor.ilike."${s}"`);
        if (userId) {
          sectorConditions.push(`owner_id.eq.${userId}`);
        }
        query = query.or(sectorConditions.join(','));
      } else if (userId) {
        query = query.eq('owner_id', userId);
      } else {
        query = query.eq('unidade_setor', '---SECTOR-BLANK-NO-ACCESS---');
      }
    }

    let result = await query.order('id', { ascending: true });
    let data = result.data;
    let error = result.error;
    let status = result.status;

    // Se falhar por falta da coluna 'owner_id', fazemos fallback seguro buscando todos e filtrando em memória
    if (error && (error.code === '42703' || error.message?.includes('owner_id') || status === 400 || error.code === 'PGRST100')) {
      console.warn('⚠️ Coluna owner_id não existe. Buscando todos os registros públicos e filtrando na memória...');
      const fallbackResult = await supabase
        .from('ia_records')
        .select('*')
        .order('id', { ascending: true });
      data = fallbackResult.data;
      error = fallbackResult.error;
      status = fallbackResult.status;
    }

    if (error) {
      console.error('❌ Erro ao buscar no Supabase:', error, 'Status:', status);
      throw error;
    }

    let resultRecords: IARecord[] = [];

    if (data && data.length > 0) {
      console.log(`✅ ${data.length} registros encontrados no Supabase.`);
      const filteredData = data.filter(item => item.id !== 'METADATA-SECTORS');
      resultRecords = filteredData.map(item => {
        let record: IARecord;
        
        if (item.data) {
          record = item.data as IARecord;
          record.id = item.id; // Sync ID
          // Ensure unity sector is populated from raw database column fallback
          record.unidadeSetor = item.unidade_setor || record.unidadeSetor || (record as any).unidade_setor || '';
          record.ownerId = item.owner_id || record.ownerId || (record as any).owner_id || '';
        } else {
          record = {
            id: item.id,
            unidadeSetor: item.unidade_setor || '',
            responsavelPreenchimento: item.responsavel_preenchimento || '',
            cargo: item.cargo || '',
            dataRegistro: item.data_registro || new Date().toISOString().split('T')[0],
            utilizaIA: item.utiliza_ia || 'Sim',
            nomeFerramenta: item.nome_ferramenta || 'IA sem nome',
            fornecedor: item.fornecedor || 'Desconhecido',
            statusUso: item.status_uso === "Negado" ? StatusUso.NAO_APROVADO : ((item.status_uso as StatusUso) || StatusUso.EM_AVALIACAO),
            createdAt: item.created_at || new Date().toISOString(),
            updatedAt: item.updated_at || new Date().toISOString(),
            ownerId: item.owner_id || '',
            historico: []
          } as any as IARecord;
        }

        // Force sync with database columns to prevent stale client JSON state
        if (item.status) {
          record.statusAuditoria = item.status as StatusAuditoria;
        }
        if (item.status_uso) {
          record.statusUso = item.status_uso === "Negado" ? StatusUso.NAO_APROVADO : (item.status_uso as StatusUso);
        }

        // Ensure statusAuditoria is never undefined for filtering purposes
        if (!record.statusAuditoria) {
          record.statusAuditoria = StatusAuditoria.PENDENTE;
        }

        return record;
      });
    } else {
      console.log('ℹ️ Supabase retornou 0 registros.');
      resultRecords = [];
    }

    if (!finalIsAdmin) {
      const activeSectors = (userSector || '')
        .split(';')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);
      console.log(`🛡️ Filtrando registros para os setores do usuário: ${activeSectors.join(', ')} ou criados pelo próprio usuário`);
      resultRecords = resultRecords.filter(r => {
        const rSector = (r.unidadeSetor || (r as any).unidade_setor || '').trim().toLowerCase();
        const rOwner = r.ownerId || (r as any).owner_id || '';
        const isOwner = userId && String(rOwner) === String(userId);
        const matchesSector = activeSectors.includes(rSector);
        return matchesSector || isOwner;
      });
    }

    return resultRecords;
  } catch (error) {
    console.error('💥 Erro crítico no getRecords:', error);
    return [];
  }
};

const isValidUUID = (id: any): boolean => {
  if (typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
};

export const addRecord = async (record: IARecord, userId?: string, isAdmin?: boolean) => {
  let finalIsAdmin = isAdmin;
  try {
    if (userId && !finalIsAdmin && isValidUUID(userId)) {
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .single();
        if (prof?.role?.toLowerCase().trim() === 'admin') {
          finalIsAdmin = true;
        }
      } catch (e) {}
    }

    console.log('☁️ Tentando salvar registro no Supabase com resiliência total:', record.id, { isAdmin: finalIsAdmin });
    
    // Determinando o status final: 
    // Pendente, Aprovado ou Negado
    const finalStatus = record.statusAuditoria || (finalIsAdmin ? StatusAuditoria.APROVADO : StatusAuditoria.PENDENTE);
    
    // Validar UUID do owner_id para evitar violação de tipo ou restrição de chave estrangeira
    let resolvedOwnerId: string | null = null;
    if (userId && isValidUUID(userId)) {
      resolvedOwnerId = userId;
    } else {
      const candidateOwnerId = record.ownerId || (record as any).owner_id;
      if (candidateOwnerId && isValidUUID(candidateOwnerId)) {
        resolvedOwnerId = candidateOwnerId;
      }
    }

    // Se o profile para o resolvedOwnerId não existe, vamos criar um perfil básico para garantir que a chave estrangeira ia_records_owner_id_fkey não seja violada
    if (resolvedOwnerId) {
      try {
        const { data: profileCheck } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', resolvedOwnerId)
          .maybeSingle();

        if (!profileCheck) {
          console.log(`👤 Profile para o owner ${resolvedOwnerId} não existe. Criando perfil básico para evitar violação de chave estrangeira...`);
          await supabase
            .from('profiles')
            .insert({
              id: resolvedOwnerId,
              full_name: record.responsavelPreenchimento || 'Membro Cedro',
              setor: record.unidadeSetor || '',
              cargo: record.cargo || '',
              role: 'user',
              updated_at: new Date().toISOString()
            });
        }
      } catch (profileErr) {
        console.warn('Erro ao garantir existência do perfil para o owner:', profileErr);
      }
    }

    const recordWithStatus = { 
      ...record, 
      statusAuditoria: finalStatus,
      ownerId: resolvedOwnerId 
    };

    const payload: any = { 
      id: record.id, 
      data: recordWithStatus,
      updated_at: new Date().toISOString(),
      unidade_setor: record.unidadeSetor || '',
      responsavel_preenchimento: record.responsavelPreenchimento || '',
      nome_ferramenta: record.nomeFerramenta || '',
      status: record.statusAuditoria || finalStatus,
      status_uso: record.statusUso || 'Em avaliação',
      owner_id: resolvedOwnerId
    };

    // Função interna para limpar mensagens de erro e extrair nome da coluna faltante
    const getMissingColumnName = (message: string): string | null => {
      let match = message.match(/column "([^"]+)" does not exist/i);
      if (match) return match[1];
      
      match = message.match(/column ([a-zA-Z0-9_-]+) does not exist/i);
      if (match) return match[1];

      match = message.match(/could not find the column ([a-zA-Z0-9_-]+)/i);
      if (match) return match[1];

      return null;
    };

    let currentPayload = { ...payload };
    let attempts = 0;
    const maxAttempts = 12;
    let lastError: any = null;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const { error } = await supabase
          .from('ia_records')
          .upsert(currentPayload);
        
        if (!error) {
          console.log(`✅ Registro ${record.id} salvo com sucesso no Supabase na tentativa ${attempts}!`);
          lastError = null;
          break;
        }
        
        lastError = error;
        const errMsg = error.message || '';
        const errCode = error.code || '';
        
        // Verifica se é erro de coluna inexistente
        const isMissingColumn = errCode === '42703' || 
                               errCode === 'PGRST204' || 
                               errMsg.toLowerCase().includes('column') || 
                               errMsg.toLowerCase().includes('does not exist');
        
        if (isMissingColumn) {
          const missingCol = getMissingColumnName(errMsg);
          if (missingCol && missingCol in currentPayload) {
            console.warn(`⚠️ Coluna [${missingCol}] inexistente no banco. Removendo do payload de upsert e tentando novamente...`);
            delete currentPayload[missingCol];
            continue; // Tenta novamente com o payload limpo
          } else {
            // Se não conseguimos extrair o nome da coluna mas o erro diz que alguma coluna não existe,
            // podemos tentar remover colunas opcionais conhecidas uma a uma na ordem inversa de importância
            const fallbackRemovals = ['owner_id', 'status_uso', 'status', 'unidade_setor', 'responsavel_preenchimento', 'nome_ferramenta', 'updated_at'];
            let removedSomething = false;
            for (const col of fallbackRemovals) {
              if (col in currentPayload) {
                console.warn(`⚠️ Erro de coluna não identificada. Tentando remover fallback [${col}] do payload de upsert...`);
                delete currentPayload[col];
                removedSomething = true;
                break; // Remove uma e tenta de novo
              }
            }
            if (removedSomething) {
              continue;
            }
          }
        }
        
        // Se for outro tipo de erro (ex: violação de chave estrangeira com profiles), vamos tratar de forma robusta:
        if (errMsg.toLowerCase().includes('violates foreign key constraint') && errMsg.toLowerCase().includes('owner_id')) {
          console.warn('⚠️ Violação de chave estrangeira em owner_id. Removendo owner_id do payload e tentando novamente...');
          delete currentPayload['owner_id'];
          continue;
        }

        // Se o erro for outro que não conseguimos tratar, paramos o loop e lançamos
        break;
      } catch (e: any) {
        lastError = e;
        break;
      }
    }

    if (lastError) {
      console.error('❌ Erro definitivo ao salvar no Supabase:', lastError);
      throw lastError;
    }
  } catch (error: any) {
    console.error('Error adding to Supabase:', error);
    throw error; 
  }
  
  // Local fallback
  try {
    const localData = localStorage.getItem(STORAGE_KEY);
    const records: IARecord[] = localData ? JSON.parse(localData) : [];
    const index = records.findIndex(r => r.id === record.id);
    const finalStatus = record.statusAuditoria || (finalIsAdmin ? StatusAuditoria.APROVADO : StatusAuditoria.PENDENTE);
    
    let resolvedOwnerId: string | null = null;
    if (userId && isValidUUID(userId)) {
      resolvedOwnerId = userId;
    } else {
      const candidateOwnerId = record.ownerId || (record as any).owner_id;
      if (candidateOwnerId && isValidUUID(candidateOwnerId)) {
        resolvedOwnerId = candidateOwnerId;
      }
    }

    const recordWithStatus = { 
      ...record, 
      statusAuditoria: finalStatus,
      ownerId: resolvedOwnerId
    };
    
    if (index === -1) records.push(recordWithStatus);
    else records[index] = recordWithStatus;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Local sync failed:', e);
  }
};

export const saveRecordsToSupabase = async (records: IARecord[], userId?: string, isAdmin?: boolean) => {
  console.log(`Syncing ${records.length} records to Supabase...`);
  for (const record of records) {
    await addRecord(record, userId, isAdmin);
  }
};

export const updateRecord = async (record: IARecord, userId?: string, isAdmin?: boolean) => {
  return addRecord(record, userId, isAdmin); // Upsert handles update
};

export const addOrUpdateRecord = async (record: IARecord, userId?: string, isAdmin?: boolean) => {
  return addRecord(record, userId, isAdmin);
};

export const deleteRecord = async (id: string) => {
  try {
    console.log(`🗑️ Iniciando exclusão em cascata do registro ${id} no Supabase...`);
    
    // 1. Obter os IDs de workflow vinculados a este registro de IA
    const { data: workflows, error: wfErr } = await supabase
      .from('approval_workflows')
      .select('id')
      .eq('ia_record_id', id);

    if (wfErr) {
      console.warn("Aviso ao buscar workflows associados para exclusão:", wfErr);
    }

    if (workflows && workflows.length > 0) {
      const workflowIds = workflows.map(w => w.id);
      
      // 2. Deletar etapas de aprovação correspondentes a estes workflows
      const { error: stepsErr } = await supabase
        .from('approval_steps')
        .delete()
        .in('workflow_id', workflowIds);
      
      if (stepsErr) {
        console.error("Erro ao realizar exclusão das etapas de aprovação (approval_steps):", stepsErr);
      }

      // 3. Deletar os fluxos da tabela de workflows
      const { error: wfDelErr } = await supabase
        .from('approval_workflows')
        .delete()
        .in('id', workflowIds);

      if (wfDelErr) {
        console.error("Erro ao realizar exclusão dos fluxos de aprovação (approval_workflows):", wfDelErr);
      }
    }

    // 4. Deletar o registro de IA
    const { error } = await supabase
      .from('ia_records')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    console.log(`✅ Registro ${id} e todas as suas dependências foram removidos com sucesso do Supabase!`);
  } catch (error) {
    console.error('Error deleting from Supabase:', error);
    // If Supabase failed, we still try local delete but we should probably inform the UI
    // if it was specifically a network/auth error. 
    // However, we'll throw here to let App.tsx know if it should rollback the optimistic update
    throw error;
  }

  // Local sync
  try {
    const localData = localStorage.getItem(STORAGE_KEY);
    if (localData) {
      const records = JSON.parse(localData);
      const filtered = records.filter((r: any) => r.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    }
  } catch (e) {
    console.error('Error updating localStorage:', e);
  }
};

export const checkSupabaseStatus = async (): Promise<boolean> => {
  try {
    const { error } = await supabase.from('ia_records').select('id').limit(1);
    return !error;
  } catch (e) {
    return false;
  }
};

export const updateUserProfile = async (profileId: string, updates: Partial<UserProfile>): Promise<UserProfile | null> => {
  try {
    console.log(`📡 Enviando atualização para perfil ${profileId}:`, updates);
    
    // Sanitize updates to only include valid database columns
    const allowedKeys = ['id', 'updated_at', 'full_name', 'avatar_url', 'cargo', 'setor', 'contato', 'role', 'last_seen', 'sector_locked'];
    const sanitizedUpdates: any = {};
    for (const key of allowedKeys) {
      if (updates[key as keyof UserProfile] !== undefined) {
        sanitizedUpdates[key] = updates[key as keyof UserProfile];
      }
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(sanitizedUpdates)
      .eq('id', profileId)
      .select();

    if (error) {
      // Ignore schema cache errors and missing column errors for last_seen specifically for a smoother onboarding
      const isLastSeenError = updates.hasOwnProperty('last_seen') && (
        error.code === 'PGRST204' || 
        error.code === '42703' || 
        (error.message && (
          error.message.includes('last_seen') || 
          error.message.includes('column') || 
          error.message.includes('does not exist')
        ))
      );

      if (isLastSeenError) {
        console.warn('⚠️ Coluna "last_seen" não encontrada no Supabase. Execute o SQL em SUPABASE_SETUP.md para habilitar status online dos usuários.');
        return null;
      }
      console.error('❌ Erro Supabase ao atualizar perfil:', error);
      throw error;
    }
    
    if (!data || data.length === 0) {
      console.warn('⚠️ Nenhuma linha foi atualizada. Verifique se o ID existe e se você tem permissão RLS.');
      return null;
    }

    console.log('✅ Perfil atualizado com sucesso:', data[0]);
    return data[0] as UserProfile;
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};

export const generateId = (records: IARecord[]): string => {
  if (records.length === 0) return "IA-CEDRO-0001";
  
  // Extrair números dos IDs existentes e pegar o maior
  const ids = records.map(r => {
    const match = r.id.match(/\d+$/);
    return match ? parseInt(match[0], 10) : 0;
  });
  
  const maxId = Math.max(...ids);
  return `IA-CEDRO-${(maxId + 1).toString().padStart(4, "0")}`;
};

export const DEFAULT_SECTORS = [
  "NIT",
  "TI",
  "Marketing",
  "Administrativo",
  "Jurídico",
  "Direção Técnica",
  "Qualidade",
  "Atendimento / Recepção",
  "Laboratório de Patologia",
  "Laboratório Central"
];

const SECTORS_STORAGE_KEY = "cedro_custom_sectors";

export const getSectors = async (): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('sectors')
      .select('name')
      .order('name', { ascending: true });

    if (!error && data && data.length > 0) {
      const dbSectors = data.map((row: any) => row.name);
      localStorage.setItem(SECTORS_STORAGE_KEY, JSON.stringify(dbSectors));
      return dbSectors;
    }
  } catch (error) {
    console.error('Erro ao buscar setores do Supabase:', error);
  }

  // Fallback 1: LocalStorage
  try {
    const local = localStorage.getItem(SECTORS_STORAGE_KEY);
    if (local) {
      return JSON.parse(local);
    }
  } catch (e) {
    console.error('Erro ao ler setores do localStorage:', e);
  }

  // Fallback 2: Padrão
  return DEFAULT_SECTORS;
};

export const saveSectors = async (sectors: string[]): Promise<boolean> => {
  try {
    localStorage.setItem(SECTORS_STORAGE_KEY, JSON.stringify(sectors));
  } catch (e) {
    console.error(e);
  }

  try {
    // 1. Fetch current sectors in "sectors" table to prevent overwriting existing details
    const { data: existingData, error: fetchError } = await supabase
      .from('sectors')
      .select('name');

    if (!fetchError) {
      const existingNames = (existingData || []).map((row: any) => row.name);
      const missingNames = sectors.filter(name => !existingNames.includes(name));

      if (missingNames.length > 0) {
        const newRows = missingNames.map(name => ({
          name,
          description: "Setor de saúde e governança corporativa.",
          responsible: "Não especificado",
          status: "Ativo",
          cargos: ["Colaborador"],
          updated_at: new Date().toISOString()
        }));

        await supabase.from('sectors').insert(newRows);
      }
    }

    // 2. Backward compatibility: update METADATA-SECTORS configuration
    const payload = {
      id: "METADATA-SECTORS",
      unidade_setor: "METADATA",
      nome_ferramenta: "Configuração de Setores",
      responsavel_preenchimento: "ADMIN",
      data_registro: new Date().toISOString().split('T')[0],
      utiliza_ia: "Não",
      status_uso: "Em uso",
      data: {
        sectors: sectors
      },
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('ia_records')
      .upsert(payload);

    if (error) {
      console.error("Erro ao salvar config de setores no Supabase:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Erro crítico ao salvar setores:", err);
    return false;
  }
};

function getExampleRecords(): IARecord[] {
  return [];
}
