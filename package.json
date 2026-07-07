/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from "react";
import { IARecord } from "../types";
import { getRecords } from "../storage";

export function useIARecords(
  userId?: string, 
  isAdmin?: boolean, 
  userSector?: string
) {
  const [records, setRecords] = useState<IARecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getRecords(userId, isAdmin, userSector);
      setRecords(data);
    } catch (err) {
      console.error("Erro ao carregar registros de IA no hook:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, isAdmin, userSector]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  return {
    records,
    loading,
    setRecords,
    refresh: fetchRecords
  };
}
