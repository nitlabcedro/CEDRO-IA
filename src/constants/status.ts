/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type InternalStatus = 'pending' | 'in_review' | 'approved' | 'rejected' | 'not_evaluated';

export const STATUS_MAP: Record<InternalStatus, string> = {
  pending: "Pendente",
  in_review: "Em Avaliação",
  approved: "Aprovado",
  rejected: "Negado",
  not_evaluated: "Não Avaliado"
};

/**
 * Normalizes any status input string into an InternalStatus
 */
export function getInternalStatus(status?: string): InternalStatus {
  if (!status) return 'pending';
  const clean = status.trim().toLowerCase();
  
  if (clean === 'pendente' || clean === 'pending') {
    return 'pending';
  }
  if (clean === 'em avaliação' || clean === 'em avaliacao' || clean === 'em_avaliacao' || clean === 'em-avaliacao' || clean === 'in_review') {
    return 'in_review';
  }
  if (clean === 'aprovado' || clean === 'approved') {
    return 'approved';
  }
  if (clean === 'negado' || clean === 'rejected' || clean === 'indeferido') {
    return 'rejected';
  }
  return 'not_evaluated';
}

/**
 * Returns the formatted Portuguese status display string for any status
 */
export function formatStatusDisplay(status?: string | InternalStatus): string {
  const internal = getInternalStatus(status);
  return STATUS_MAP[internal];
}

/**
 * Returns the tailwind class for status badges
 */
export function getStatusBadgeClass(status?: string | InternalStatus): string {
  const internal = getInternalStatus(status);
  switch (internal) {
    case 'approved':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'rejected':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'in_review':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'pending':
    default:
      return 'bg-amber-50 text-amber-705 border-amber-200';
  }
}
