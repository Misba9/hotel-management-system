import {
  TABLES_COLLECTION,
  useTables as useTablesShared,
  type FloorTable,
  type TableStatus,
  type UseTablesResult
} from "@shared/hooks/useTables";
import { staffDb } from "../lib/firebase";

export type { FloorTable, TableStatus, UseTablesResult };
export { TABLES_COLLECTION, parseFloorTableDoc } from "@shared/hooks/useTables";

/**
 * Real-time listener for `tables` — delegates to shared {@link useTablesShared} with staff Firestore.
 */
export function useTables(enabled = true): UseTablesResult {
  return useTablesShared(staffDb, { enabled });
}
