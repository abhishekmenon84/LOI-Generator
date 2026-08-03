import { prisma } from "./prisma";
import { loadAccessibleFolder } from "./folderAccess";

// Resolves a user's access to one specific Ledger, combining folder-level
// access (loadAccessibleFolder -- org admin, folder creator, or
// FolderParticipant) with any document-level LedgerParticipant grant. The
// two are additive: a LedgerParticipant grant can give someone access to
// a document in a folder they otherwise can't see at all (e.g. a lender
// with no FolderParticipant row, only a LedgerParticipant one on a single
// financing document), but it never narrows down write access someone
// already has via the folder. Returns null if neither grants any access
// -- same "don't distinguish not-found from no-access" convention as
// loadAccessibleFolder.
//
// Returned shape: { ...ledger, _writeAccess, _viewOnly, _accessReason }.
// _viewOnly is true only when the user's ONLY grant is a LedgerParticipant
// "view" row with no folder-level access at all -- callers that show
// export/download/audit-trail controls should hide them when _viewOnly is
// true, per the product decision that a "view" grant is read-only (no
// export, no audit trail), distinct from _writeAccess (which already
// existed and gates edit/archive/duplicate/send-for-signature).
export async function loadAccessibleLedger(ledgerId, userId) {
  const ledger = await prisma.ledger.findUnique({ where: { id: ledgerId } });
  if (!ledger) return null;

  const folder = await loadAccessibleFolder(ledger.folderId, userId);
  const ledgerParticipant = await prisma.ledgerParticipant.findUnique({
    where: { ledgerId_userId: { ledgerId, userId } },
  });

  if (!folder && !ledgerParticipant) return null;

  if (folder) {
    return {
      ...ledger,
      _writeAccess: folder._writeAccess || ledgerParticipant?.permission === "write",
      _viewOnly: false,
      _accessReason: folder._accessReason,
    };
  }

  // Folder grants nothing -- access comes entirely from the
  // LedgerParticipant row on this one document.
  return {
    ...ledger,
    _writeAccess: ledgerParticipant.permission === "write",
    _viewOnly: ledgerParticipant.permission === "view",
    _accessReason: "ledger_participant",
  };
}
