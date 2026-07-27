// One-off (but re-runnable in --dry-run mode) backfill: populates
// SignatureRequest.ledgerId for every existing row, by resolving each
// row's Deal to its corresponding Ledger. The original Deal->Folder+Ledger
// backfill (scripts/backfill-folders.mjs) created exactly one Ledger per
// Deal but stored no permanent Deal.id -> Ledger.id mapping column
// anywhere -- it copied Deal.name/documentType/formData/createdAt onto the
// new Ledger verbatim, so a Deal and its Ledger are re-identifiable by
// matching on that (name, documentType, createdAt) triple.
//
// Usage:
//   node scripts/backfill-signature-ledger-ids.mjs --dry-run
//   node scripts/backfill-signature-ledger-ids.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const requests = await prisma.signatureRequest.findMany({
    where: { ledgerId: null },
    include: { deal: true },
  });
  console.log(`Found ${requests.length} SignatureRequest row(s) needing ledgerId backfill.`);

  let resolved = 0;
  let ambiguous = 0;
  let unresolved = 0;

  for (const req of requests) {
    const deal = req.deal;
    if (!deal) {
      console.error(`ERROR: SignatureRequest ${req.id} has no Deal (dealId ${req.dealId} not found). Skipping -- needs manual investigation.`);
      unresolved++;
      continue;
    }
    const candidates = await prisma.ledger.findMany({
      where: {
        name: deal.name,
        documentType: deal.documentType,
        createdAt: deal.createdAt,
      },
      select: { id: true },
    });
    if (candidates.length === 0) {
      console.error(`ERROR: SignatureRequest ${req.id} / Deal ${deal.id} ("${deal.name}") has no matching Ledger candidate. Skipping -- needs manual investigation.`);
      unresolved++;
      continue;
    }
    if (candidates.length > 1) {
      console.error(`ERROR: SignatureRequest ${req.id} / Deal ${deal.id} ("${deal.name}") matches ${candidates.length} Ledger candidates -- ambiguous. Skipping -- needs manual investigation. Candidate ids: ${candidates.map((c) => c.id).join(", ")}`);
      ambiguous++;
      continue;
    }
    const ledgerId = candidates[0].id;
    if (DRY_RUN) {
      console.log(`[dry-run] Would set SignatureRequest ${req.id}.ledgerId = ${ledgerId} (Deal ${deal.id} "${deal.name}")`);
    } else {
      await prisma.signatureRequest.update({ where: { id: req.id }, data: { ledgerId } });
    }
    resolved++;
  }

  console.log(`\n${DRY_RUN ? "[dry-run] Would resolve" : "Resolved"}: ${resolved}. Ambiguous (skipped): ${ambiguous}. Unresolved (skipped): ${unresolved}.`);
  if (ambiguous > 0 || unresolved > 0) {
    console.error(`\n${ambiguous + unresolved} row(s) could not be automatically resolved. Do NOT proceed to Task 1 Step 7 (dropping dealId / adding NOT NULL) until every row is resolved -- investigate and manually fix these rows first (a manual SQL UPDATE after confirming the correct Ledger by hand is acceptable for a small number of edge cases).`);
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
