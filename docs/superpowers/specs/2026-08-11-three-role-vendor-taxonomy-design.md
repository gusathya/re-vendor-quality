# Three-Role Architecture, Vendor Taxonomy & Push/Approval Workflow
**Date:** 2026-08-11  
**Status:** Approved — implementation in progress

---

## Context

The system currently has two roles (admin, vendor) and one vendor (Unique Platers). This spec adds:
- A third role: **Customer (Royal Enfield)**
- **6 commodity categories** organising ~700 vendors
- **Vendor codes** (e.g. `UP-001`)
- A **push-gated visibility model**: vendor data is private until the vendor explicitly pushes it to the customer
- **Batch approve/reject** by the customer, with draft rejection emails
- **Draft SOP communication emails** (no sending — copy/paste only)

---

## 1. Data Model

### New table: `vendor_categories`

| column | type | notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| name | TEXT NOT NULL UNIQUE | Display name |
| slug | TEXT NOT NULL UNIQUE | kebab-case identifier |

**Seeded rows (6):**

| slug | name |
|------|------|
| `sheet-metal-fabrication` | Sheet Metal & Fabrication |
| `casting-machining` | Casting & Machining |
| `forging-machining` | Forging & Machining |
| `non-metallic` | Non-Metallic |
| `mechanical-proprietary` | Mechanical Proprietary |
| `electrical-proprietary` | Electrical Proprietary |

### Changes to `vendors`
- Add `category_id TEXT REFERENCES vendor_categories(id)` (nullable — existing vendors have no category until set)
- Add `vendor_code TEXT UNIQUE` (e.g. `UP-001`; nullable for existing rows)

### Changes to `load_reports`
Add push/approval state machine columns:

| column | type | notes |
|--------|------|-------|
| `push_status` | TEXT | `'draft'` \| `'pending'` \| `'approved'` \| `'rejected'` — DEFAULT `'draft'` |
| `pushed_at` | TEXT | ISO datetime, set when vendor pushes |
| `reviewed_at` | TEXT | ISO datetime, set when customer acts |
| `reviewed_by` | TEXT | FK → users.id |
| `review_note` | TEXT | Rejection reason entered by customer |

### Changes to `users`
- Extend role CHECK to `('admin', 'vendor', 'customer')`
- Customer users have `vendor_id = NULL` (same as admin)

---

## 2. Push-Status State Machine

```
[draft] ──push──▶ [pending] ──approve──▶ [approved]
                      │
                   reject
                      │
                      ▼
                 [rejected] ──re-push──▶ [pending]
```

- **draft**: uploaded by vendor, visible to vendor + admin only
- **pending**: vendor pushed, visible to customer + admin
- **approved**: customer approved, locked (no further push/reject)
- **rejected**: customer rejected; vendor sees rejection note + draft email; vendor can correct and re-push (→ pending)

---

## 3. Role Experiences

### Vendor
- Existing dashboard unchanged
- Load list gains a `push_status` chip per batch:
  - `draft` → **Push to RE** button
  - `pending` → grey "Pending Review" chip
  - `approved` → green "Approved" chip
  - `rejected` → red "Rejected" chip + "View Rejection" link → shows draft email body to copy
- Vendor can only see their own data; customer never sees draft batches

### Customer (Royal Enfield)
- Route: `/customer`
- Sees only batches with `push_status IN ('pending', 'approved', 'rejected')`
- Table: Vendor Code, Vendor Name, Load#, Pushed At, Status, Actions
- **Approve** button: sets status → `approved`
- **Reject** button: opens modal with note field → sets status → `rejected` → shows draft rejection email
- No access to: SOPs, load upload, inspections, settings, admin dashboard

### Admin
- `/admin` Overview tab: vendor cards grouped by commodity category
- Category header shows aggregate pass rate + vendor count for that category
- Load reports table gains `push_status` column; draft rows shown muted/italic
- SOP page: "Draft SOP Email" button → draft email modal (new SOP or change request)

---

## 4. Draft Email Templates

All emails are displayed in a modal as copyable plain text. The app never sends email.

### A — New SOP Published
```
To: [vendor email]
Subject: [RE Quality] New SOP Effective – [Vendor Name] ([Vendor Code])

Dear [Vendor Name] team,

A new Standard Operating Procedure has been published for your process:

  Vendor Code : [VENDOR_CODE]
  Process     : [PROCESS_NAME]
  SOP ID      : [SOP_ID]
  Effective   : [DATE]

Please review and ensure compliance before your next production run.

Regards,
Royal Enfield Quality Team
```

### B — SOP Change Request
```
To: [vendor email]
Subject: [RE Quality] SOP Change Request – [Vendor Name] ([Vendor Code])

Dear [Vendor Name] team,

A change request has been raised for your current SOP:

  Vendor Code  : [VENDOR_CODE]
  Parameter    : [PARAMETER_NAME]
  Current limit: [CURRENT_VALUE]
  Requested    : [REQUESTED_VALUE]
  Reason       : [REASON]

Please acknowledge and update your process accordingly.

Regards,
Royal Enfield Quality Team
```

### C — Batch Rejected
```
To: [vendor email]
Subject: [RE Quality] Batch Rejected – Load [LOAD_NUMBER] ([Vendor Code])

Dear [Vendor Name] team,

The following batch has been rejected during quality review:

  Vendor Code : [VENDOR_CODE]
  Load Number : [LOAD_NUMBER]
  Rejected On : [DATE]
  Reason      : [REVIEW_NOTE]

Please review the readings, correct any out-of-limit parameters,
and re-submit the batch for approval.

Regards,
Royal Enfield Quality Team
```

---

## 5. Implementation Phases

### Phase 1 — Taxonomy (vendor categories + codes)
- `vendor_categories` table + seed (6 rows)
- Migrations: add `category_id`, `vendor_code` to vendors
- Admin UI: assign category + code to a vendor on Settings page
- Admin dashboard: group vendor cards by category

### Phase 2 — Customer role + push/approve/reject workflow
- DB migrations: `push_status` + review columns on `load_reports`
- Extend auth role CHECK
- Seed: one Customer user (`customer@royalenfield.local` / `Customer@123`)
- Vendor load list: Push button + status chips
- `/customer` portal: pending/approved/rejected batches + Approve/Reject
- Rejection draft email modal

### Phase 3 — SOP draft email generation
- "Draft SOP Email" button on admin SOP pages
- Two templates: New SOP, Change Request
- Pre-filled mailto modal with copy button
