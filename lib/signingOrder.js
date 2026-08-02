// Sequential signing: signer slots are unlocked strictly in ascending
// `order` (ties sign concurrently). A slot is "unlocked" once every signer
// slot with a strictly lower order has either signed or is notify_only
// (notify_only never blocks -- it's not part of the signing chain at all).
export function isSlotUnlocked(targetSlot, allSlots) {
  if (targetSlot.kind !== "signer") return true;
  const earlierSigners = allSlots.filter((s) => s.kind === "signer" && s.order < targetSlot.order);
  return earlierSigners.every((s) => !!s.tokenUsedAt);
}

// Returns the signer slots that should be emailed right now: every
// not-yet-signed signer slot at the lowest order that still has any
// un-signed signer. Used both at creation (who gets the first email) and
// after each signature (who to unlock next).
export function nextSlotsToNotify(allSlots) {
  const pendingSigners = allSlots.filter((s) => s.kind === "signer" && !s.tokenUsedAt);
  if (pendingSigners.length === 0) return [];
  const lowestOrder = Math.min(...pendingSigners.map((s) => s.order));
  return pendingSigners.filter((s) => s.order === lowestOrder);
}
