// One-off (but re-runnable and idempotent-checked) backfill: creates a
// Folder + Ledger pair for every existing Deal, preserving parentDealId
// nesting as Folder nesting, and a FolderParticipant per DealShare.
// Never modifies or deletes any Deal/DealShare/SignatureRequest row.
//
// Usage:
//   node scripts/backfill-folders.mjs --dry-run   (report only, writes nothing)
//   node scripts/backfill-folders.mjs             (actually writes)
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const deals = await prisma.deal.findMany({ orderBy: { createdAt: "asc" } });
  const shares = await prisma.dealShare.findMany();

  // Idempotency guard: if ANY Folder already exists, refuse to run again
  // blindly — this script is meant to run exactly once per environment
  // (plus as many --dry-run inspections as needed beforehand).
  const existingFolderCount = await prisma.folder.count();
  if (existingFolderCount > 0 && !DRY_RUN) {
    console.error(`Refusing to run: ${existingFolderCount} Folder row(s) already exist. This script is meant to run once. Aborting without writing.`);
    process.exit(1);
  }

  console.log(`Found ${deals.length} Deal row(s), ${shares.length} DealShare row(s).`);

  // Process top-level deals first (parentDealId null), so their new Folder
  // ids exist before we process their children.
  const topLevel = deals.filter((d) => !d.parentDealId);
  const children = deals.filter((d) => d.parentDealId);

  const dealIdToFolderId = new Map();
  let foldersCreated = 0;
  let ledgersCreated = 0;
  let participantsCreated = 0;

  async function createFolderForDeal(deal, parentFolderId) {
    if (DRY_RUN) {
      console.log(`[dry-run] Would create Folder for Deal ${deal.id} ("${deal.name}")${parentFolderId ? ` under Folder ${parentFolderId}` : " (top-level)"}`);
      const fakeFolderId = `dryrun-folder-${deal.id}`;
      dealIdToFolderId.set(deal.id, fakeFolderId);
      foldersCreated++;
      console.log(`[dry-run] Would create Ledger for Deal ${deal.id} inside Folder ${fakeFolderId}`);
      ledgersCreated++;
      return fakeFolderId;
    }
    const folder = await prisma.folder.create({
      data: {
        orgId: deal.orgId,
        createdByUserId: deal.createdByUserId,
        name: deal.name,
        stage: deal.stage,
        priority: deal.priority,
        archivedAt: deal.archivedAt,
        deletedAt: deal.deletedAt,
        parentFolderId: parentFolderId || null,
        createdAt: deal.createdAt,
        updatedAt: deal.updatedAt,
      },
    });
    foldersCreated++;
    dealIdToFolderId.set(deal.id, folder.id);

    await prisma.ledger.create({
      data: {
        folderId: folder.id,
        createdByUserId: deal.createdByUserId,
        name: deal.name,
        documentType: deal.documentType,
        formData: deal.formData,
        locked: deal.locked,
        createdAt: deal.createdAt,
        updatedAt: deal.updatedAt,
      },
    });
    ledgersCreated++;
    return folder.id;
  }

  for (const deal of topLevel) {
    await createFolderForDeal(deal, null);
  }
  // Children may themselves reference a parent that was also a child in the
  // old 2-level model — the org-deal-lifecycle round enforced max 2 levels,
  // so a single second pass is sufficient; no recursive resolution needed.
  for (const deal of children) {
    const parentFolderId = dealIdToFolderId.get(deal.parentDealId);
    if (!parentFolderId) {
      console.error(`ERROR: Deal ${deal.id} references parentDealId ${deal.parentDealId}, which was not found as an already-processed top-level deal. Skipping.`);
      continue;
    }
    await createFolderForDeal(deal, parentFolderId);
  }

  for (const share of shares) {
    const folderId = dealIdToFolderId.get(share.dealId);
    if (!folderId) {
      console.error(`ERROR: DealShare ${share.id} references dealId ${share.dealId}, which has no corresponding Folder. Skipping.`);
      continue;
    }
    if (DRY_RUN) {
      console.log(`[dry-run] Would create FolderParticipant on Folder ${folderId} for user ${share.grantedToUserId} (permission: ${share.permission})`);
      participantsCreated++;
      continue;
    }
    await prisma.folderParticipant.create({
      data: {
        folderId,
        userId: share.grantedToUserId,
        permission: share.permission,
        addedByUserId: share.grantedByUserId,
        createdAt: share.createdAt,
      },
    });
    participantsCreated++;
  }

  console.log(`\n${DRY_RUN ? "[dry-run] Would create" : "Created"}: ${foldersCreated} Folder(s), ${ledgersCreated} Ledger(s), ${participantsCreated} FolderParticipant(s).`);
  console.log(`Expected: ${deals.length} Folder(s) (1 per Deal), ${deals.length} Ledger(s) (1 per Deal), ${shares.length} FolderParticipant(s) (1 per DealShare, minus any skipped due to errors above).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
