// Plain-language labels for the audit trail shown on an invoice.

export const ACTION_LABELS: Record<string, string> = {
  create: "Draft created",
  update: "Details changed",
  reference: "My reference changed",
  line_add: "Line added",
  line_update: "Line changed",
  line_remove: "Line removed",
  attachment_add: "Receipt attached",
  attachment_remove: "Receipt removed",
  submit: "Submitted",
  resubmit: "Resubmitted",
  recall: "Recalled to draft",
  review_start: "Review started",
  approve: "Approved",
  reject: "Rejected",
  mark_paid: "Marked paid",
  payment_confirm: "Payment confirmed against Wise",
};

/** Who did it, from the invoice owner's point of view. */
export function actorLabel(actorId: string | null, viewerId: string, ownerId: string) {
  if (actorId === null) return "System";
  if (actorId === viewerId) return "You";
  if (actorId === ownerId) return "Employee";
  return "CEO";
}
