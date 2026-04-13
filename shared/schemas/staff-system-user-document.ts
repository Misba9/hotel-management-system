import { z, ZodIssueCode } from "zod";
import { USER_DIRECTORY_ROLE_IDS, type UserDirectoryRoleId } from "../constants/users-directory-roles";

/**
 * Canonical staff profile shape under `users/{uid}` for the staff system.
 * Document path id is the Firebase Auth UID; optional field `uid` (if present) must match it.
 *
 * @see USER_DIRECTORY_ROLE_IDS — same role strings as the admin user directory.
 * Legacy rows may use claim-mirror strings (e.g. `kitchen_staff`); map those to `kitchen` / `delivery`
 * before calling {@link parseStaffSystemUserDocument} if you enforce this shape strictly.
 */
export type StaffSystemUserDocumentCore = {
  name: string;
  email: string;
  role: UserDirectoryRoleId;
  approved: boolean;
  /** Firestore `Timestamp`, or wire shapes from Admin/client SDKs */
  createdAt: unknown;
  /** If set, must equal the document id (`users/{documentId}`). */
  uid?: string;
};

const roleEnum = z.enum(USER_DIRECTORY_ROLE_IDS as unknown as [UserDirectoryRoleId, ...UserDirectoryRoleId[]]);

/** Accepts `Date`, Firestore-style `{ seconds, nanoseconds }`, or `{ _seconds, _nanoseconds }` (JSON). */
export const firestoreTimestampLikeSchema = z.union([
  z.date(),
  z.object({ seconds: z.number(), nanoseconds: z.number() }),
  z.object({ _seconds: z.number(), _nanoseconds: z.number() })
]);

/**
 * Validates the **core** staff fields; unknown extra fields are preserved (`passthrough`).
 * Use in API routes or scripts before writes.
 */
export const staffSystemUserDocumentCoreSchema = z
  .object({
    name: z.string().min(1).max(200),
    email: z.string().email().max(320),
    role: roleEnum,
    approved: z.boolean(),
    createdAt: firestoreTimestampLikeSchema,
    uid: z.string().min(1).optional()
  })
  .passthrough();

export type StaffSystemUserDocumentParsed = z.infer<typeof staffSystemUserDocumentCoreSchema>;

export class StaffUserDocumentUidMismatchError extends Error {
  constructor(
    readonly documentId: string,
    readonly uidField: string
  ) {
    super(`users document uid mismatch: path id "${documentId}" !== data.uid "${uidField}"`);
    this.name = "StaffUserDocumentUidMismatchError";
  }
}

/**
 * Ensures `data.uid` (if provided) equals Firestore document id. The path `users/{documentId}` is the source of truth.
 */
export function assertUidMatchesDocumentId(documentId: string, data: { uid?: unknown }): void {
  if (data.uid === undefined || data.uid === null) return;
  if (typeof data.uid !== "string" || !data.uid.trim()) {
    throw new StaffUserDocumentUidMismatchError(documentId, String(data.uid));
  }
  if (data.uid.trim() !== documentId) {
    throw new StaffUserDocumentUidMismatchError(documentId, data.uid.trim());
  }
}

/**
 * Full validation: Zod parse of core shape + uid vs document id.
 * @returns Parsed object (including any extra keys the doc had).
 */
export function parseStaffSystemUserDocument(documentId: string, data: unknown): StaffSystemUserDocumentParsed {
  const parsed = staffSystemUserDocumentCoreSchema.parse(data);
  assertUidMatchesDocumentId(documentId, parsed);
  return parsed;
}

export function safeParseStaffSystemUserDocument(
  documentId: string,
  data: unknown
): z.SafeParseReturnType<unknown, StaffSystemUserDocumentParsed> {
  const result = staffSystemUserDocumentCoreSchema.safeParse(data);
  if (!result.success) return result;
  try {
    assertUidMatchesDocumentId(documentId, result.data);
  } catch (e) {
    if (e instanceof StaffUserDocumentUidMismatchError) {
      return {
        success: false,
        error: new z.ZodError([
          {
            code: ZodIssueCode.custom,
            message: e.message,
            path: ["uid"]
          }
        ])
      };
    }
    throw e;
  }
  return result;
}

/**
 * Example **wire-style** document (e.g. tests or docs). In production, `createdAt` is usually a Firestore `Timestamp`.
 */
export const STAFF_SYSTEM_USER_DOCUMENT_EXAMPLE: StaffSystemUserDocumentCore & { phone?: string } = {
  name: "Priya Nair",
  email: "priya.nair@fruit-hotel.example",
  role: "waiter",
  approved: true,
  createdAt: { seconds: 1_704_067_200, nanoseconds: 0 },
  uid: "firebaseAuthUidMustMatchPathId"
};
