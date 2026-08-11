// Draft email templates — app generates copyable text only, never sends email.

export interface NewSopEmailParams {
  vendorEmail: string;
  vendorName: string;
  vendorCode: string;
  processName: string;
  sopId: string;
  effectiveDate: string;
}

export function draftNewSopEmail(p: NewSopEmailParams): string {
  return `To: ${p.vendorEmail}
Subject: [RE Quality] New SOP Effective – ${p.vendorName} (${p.vendorCode})

Dear ${p.vendorName} team,

A new Standard Operating Procedure has been published for your process:

  Vendor Code : ${p.vendorCode}
  Process     : ${p.processName}
  SOP ID      : ${p.sopId}
  Effective   : ${p.effectiveDate}

Please review and ensure compliance before your next production run.

Regards,
Royal Enfield Quality Team`;
}

export interface SopChangeRequestEmailParams {
  vendorEmail: string;
  vendorName: string;
  vendorCode: string;
  parameterName: string;
  currentValue: string;
  requestedValue: string;
  reason: string;
}

export function draftSopChangeRequestEmail(p: SopChangeRequestEmailParams): string {
  return `To: ${p.vendorEmail}
Subject: [RE Quality] SOP Change Request – ${p.vendorName} (${p.vendorCode})

Dear ${p.vendorName} team,

A change request has been raised for your current SOP:

  Vendor Code   : ${p.vendorCode}
  Parameter     : ${p.parameterName}
  Current limit : ${p.currentValue}
  Requested     : ${p.requestedValue}
  Reason        : ${p.reason}

Please acknowledge and update your process accordingly.

Regards,
Royal Enfield Quality Team`;
}

export interface BatchRejectedEmailParams {
  vendorEmail: string;
  vendorName: string;
  vendorCode: string;
  loadNumber: string;
  rejectedOn: string;
  reviewNote: string;
}

export function draftBatchRejectedEmail(p: BatchRejectedEmailParams): string {
  return `To: ${p.vendorEmail}
Subject: [RE Quality] Batch Rejected – Load ${p.loadNumber} (${p.vendorCode})

Dear ${p.vendorName} team,

The following batch has been rejected during quality review:

  Vendor Code : ${p.vendorCode}
  Load Number : ${p.loadNumber}
  Rejected On : ${p.rejectedOn}
  Reason      : ${p.reviewNote}

Please review the readings, correct any out-of-limit parameters,
and re-submit the batch for approval.

Regards,
Royal Enfield Quality Team`;
}
