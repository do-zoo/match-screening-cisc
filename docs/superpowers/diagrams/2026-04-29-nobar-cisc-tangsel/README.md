# Nobar CISC Tangsel — Mermaid Diagrams

Source spec: `docs/superpowers/specs/2026-04-29-nobar-cisc-tangsel-design.md`

## 1) Conceptual Data Model (ERD)

```mermaid
%% This file is also available as: ./erd.mmd
%% If your renderer supports include, prefer the .mmd file directly.
erDiagram
    EVENT ||--o{ REGISTRATION : has
    REGISTRATION ||--|{ TICKET : contains
    MASTER_MEMBER ||--o{ REGISTRATION : validates_for
    MASTER_MEMBER ||--o{ PIC_BANK_ACCOUNT : owns
    MASTER_MEMBER ||--o{ EVENT : pic_master_for
    EVENT }o--o{ MASTER_MEMBER : pic_helpers
    REGISTRATION ||--o{ INVOICE_ADJUSTMENT : may_have

    EVENT {
      string id PK
      string slug
      string title
      datetime startAt
      string venueName
      string venueAddress
      string status "draft|active|finished"
      decimal ticketMemberPrice
      decimal ticketNonMemberPrice
      string pricingSource "global_default|overridden"
      string menuMode "PRESELECT|VOUCHER"
      string menuSelection "SINGLE|MULTI"
      decimal voucherPrice "VOUCHER only"
      string picMasterMemberId FK
      string bankAccountId FK
    }

    MASTER_MEMBER {
      string id PK
      string memberNumber UK
      string fullName
      boolean isActive
      boolean isPengurus
      boolean canBePIC
    }

    PIC_BANK_ACCOUNT {
      string id PK
      string ownerMemberId FK
      string bankName
      string accountNumber
      string accountName
      boolean isActive
    }

    REGISTRATION {
      string id PK
      string eventId FK
      datetime createdAt
      string contactName
      string contactWhatsapp
      string claimedMemberNumber "optional"
      string memberCardPhoto "required only if claiming member"
      string memberValidation "unknown|valid|invalid|overridden"
      string memberId "optional FK"
      string transferProof "required"
      decimal computedTotalAtSubmit
      decimal ticketMemberPriceApplied
      decimal ticketNonMemberPriceApplied
      decimal voucherPriceApplied "voucher mode only"
      string status "submitted|pending_review|payment_issue|approved|rejected|cancelled|refunded"
      string attendanceStatus "unknown|attended|no_show"
      string rejectionReason
      string paymentIssueReason
    }

    TICKET {
      string id PK
      string registrationId FK
      string role "primary|partner"
      string fullName
      string whatsapp "optional for partner"
      string memberNumber "optional"
      string ticketPriceType "member|non_member|privilege_partner_member_price"
      string menuEntitlement "PRESELECT selectedMenuItemIds[] OR VOUCHER redemption"
    }

    INVOICE_ADJUSTMENT {
      string id PK
      string registrationId FK
      string type "underpayment|other_adjustment"
      decimal amount
      string status "unpaid|paid"
      string paymentProof
      datetime paidAt
    }
```

## 2) Registration + Attendance Status Machine

```mermaid
stateDiagram-v2
%% See: ./registration-status.state.mmd
  [*] --> submitted
  submitted --> pending_review: system\n(post-submit)

  pending_review --> approved: admin approve
  pending_review --> payment_issue: admin flags issue
  pending_review --> rejected: admin reject (reason)
  pending_review --> cancelled: admin cancel

  payment_issue --> pending_review: participant/admin resolves\n(new proof / adjustment)
  payment_issue --> rejected: admin reject
  payment_issue --> cancelled: admin cancel

  approved --> cancelled: admin cancel
  approved --> refunded: refund processed

  %% Attendance is tracked separately but meaningful mainly for approved
  state "attendanceStatus" as AS {
    [*] --> unknown
    unknown --> attended: set after event day
    unknown --> no_show: set after event day
  }
```

## 3) Participant Journey (Front Office)

```mermaid
flowchart TD
  A([Browse active events]) --> B{Select event}
  B --> C[Open registration form]
  C --> D[Fill contact + WhatsApp]
  D --> E{Claim member?}
  E -->|No| F[Skip member card photo]
  E -->|Yes| G[Enter member number + upload member card photo]

  G --> H{"Committee privilege?\n(primary isPengurus after validation/override)"}
  H -->|No/Unknown| I[Partner qty = 0]
  H -->|Yes| J[Partner qty = 0 or 1]
  J -->|1| K["Enter partner name\n(optional WA, optional member number)"]
  J -->|0| I

  F --> L[Upload transfer proof]
  I --> L
  K --> L

  L --> M{Menu mode}
  M -->|PRESELECT| N["Select menu item(s)\nSINGLE/MULTI"]
  M -->|VOUCHER| O["No menu selection now\nVoucher entitlement recorded"]

  N --> P["Show total breakdown\n(lock snapshot)"]
  O --> P
  P --> Q[Submit registration]
  Q --> R[Status: submitted -> pending_review]
  R --> S["Show payment instructions\n(event bank account)"]
```

## 4) Admin Verification + Underpayment Adjustments

```mermaid
sequenceDiagram
    actor P as Participant
    participant FO as Front Office
    participant Admin as Admin Panel
    participant DB as Database

    P->>FO: Submit registration and uploads
    FO->>DB: Create REGISTRATION and TICKETs
    Note over FO,DB: Includes snapshot pricing
    DB-->>FO: OK
    FO->>DB: Set status to pending_review

    Admin->>Admin: Open Inbox per Event
    Admin->>DB: Load data and proofs
    DB-->>Admin: Data

    alt Member claim exists
        Admin->>DB: Validate Member Number
        DB-->>Admin: Result valid or invalid
        alt Invalid and override to non-member
            Admin->>Admin: Compute price delta
            Admin->>DB: Create INVOICE_ADJUSTMENT
        else Override to member
            Admin->>DB: Set status overridden
        end
    else No claim
        Admin->>DB: Set status unknown
    end

    alt Data and Payment OK
        Admin->>DB: Set status approved
    else Data issue or Underpayment
        Admin->>DB: Set status payment_issue
    end

    Admin->>Admin: Click WhatsApp Template
```

## 5) Permissions (Hybrid: Global Role + PIC Helper Grant)

```mermaid
flowchart LR
    A[Admin user] --> B{"Global role?"}

    B -->|Owner| O["Full access\n(all events + master data)"]
    B -->|Verifier| V["Verifier access\n(all events operations)"]
    B -->|Viewer| W["Read-only\n(all events)"]

    W --> C{"Assigned as\nPIC Helper for Event X?"}
    C -->|No| W1["Viewer (Event X)\nno verification actions"]
    C -->|Yes| Vx["Verifier-like for Event X\nonly"]

    O --> E1["Can manage admins,\nmaster members,\nPIC bank accounts,\nWA templates,\npricing defaults"]
    V --> E2["Can verify registrations,\ncreate adjustments,\nattendance,\ncancel/refund"]
    Vx --> E3["Same as Verifier\nbut scoped to Event X"]
```
