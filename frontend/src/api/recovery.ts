// Never put capabilities in URLs, logs or browser storage. A user can explicitly
// save their own recovery file from the UI; no automatic persistence occurs.
export type RecoveryCommand = {
  commandId: string;
  capability: string;
  subjectId?: string;
  identifier?: string;
  operationId?: string;
  mobile?: string;
  prepared?: {
    commandId?: string | null;
    expiresAt?: string | null;
    oldProofRequired?: boolean | null;
  };
};
export const recoveryCommands = new Map<string, RecoveryCommand>();
