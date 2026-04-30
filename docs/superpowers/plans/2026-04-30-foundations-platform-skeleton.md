# Foundations / Platform Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the MVP “platform skeleton” for `match-screening`: admin-only Better Auth + hybrid permissions (role + PIC helper), Prisma schema (entities/enums/constraints), Blob upload pipeline (WebP conversion + retry + recovery), and a strict RHF+shadcn+Zod form/validation contract usable by both public and admin flows.

**Architecture:** Single Next.js App Router app with `lib/*` modules for auth/db/permissions/uploads/forms. Defense-in-depth authorization: middleware gates `/admin/**` for authenticated admin sessions; every sensitive Server Action re-validates input with Zod and authorizes with role + per-event PIC helper grant.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Better Auth (admin-only), Postgres (Neon), Prisma, Vercel Blob, Sharp (image conversion), Zod, React Hook Form, shadcn/ui, Vitest.

---

## File structure (locked)

**Create:**
- `components/ui/button.tsx` — shadcn Button primitive
- `components/ui/input.tsx` — shadcn Input primitive
- `components/ui/label.tsx` — shadcn Label primitive
- `components/ui/form.tsx` — shadcn Form primitives (RHF bridge)
- `lib/db/prisma.ts` — Prisma client singleton
- `prisma/schema.prisma` — domain schema (events/registrations/tickets/uploads/admin profile, enums, constraints)
- `lib/auth/auth.ts` — Better Auth server instance (admin-only)
- `lib/auth/session.ts` — session helpers (`requireAdminSession`, `getAdminSession`)
- `lib/permissions/roles.ts` — role enums + role utilities
- `lib/permissions/guards.ts` — guards for Server Actions (role + PIC helper)
- `middleware.ts` — `/admin/**` authentication presence gate
- `app/api/auth/[...all]/route.ts` — Better Auth route handler
- `app/(auth)/admin/sign-in/page.tsx` — minimal admin sign-in page
- `app/admin/page.tsx` — minimal admin landing (requires auth)
- `lib/forms/action-result.ts` — shared Server Action result types (ok + field/root errors)
- `lib/forms/zod.ts` — Zod error mapping helpers (server → client)
- `lib/uploads/errors.ts` — typed upload errors (recoverable/non-recoverable)
- `lib/uploads/retry.ts` — retry helper (used by uploads)
- `lib/uploads/images.ts` — WebP conversion + validation
- `lib/uploads/blob.ts` — Blob put + metadata normalization
- `lib/uploads/save-upload.ts` — persist upload metadata to DB
- `lib/uploads/upload-image.ts` — orchestrated upload pipeline (validate → convert → put → persist)
- `tests/vitest.setup.ts` — test setup (optional)
- `tests/unit/retry.test.ts` — retry behavior tests
- `tests/unit/zod-error-mapping.test.ts` — Zod error mapping tests
- `tests/unit/permissions.test.ts` — permission guard tests (pure functions)

**Modify:**
- `package.json` — add deps + scripts
- `app/layout.tsx` — fonts + theme tokens alignment (minimal; no design polish yet)
- `app/globals.css` — shadcn-compatible CSS vars baseline + focus ring

---

### Task 1: Add test runner + core dependencies (Vitest, Zod, RHF, Prisma, Blob, Sharp)

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `tests/vitest.setup.ts`

- [ ] **Step 1: Update `package.json` scripts**

Replace scripts with (keep `dev/build/start/lint`, add `test`):

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:

```bash
npm i better-auth pg @prisma/client prisma @vercel/blob sharp zod react-hook-form @hookform/resolvers
npm i -D vitest @types/pg
```

Expected: install completes, `package-lock.json` updated.

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/vitest.setup.ts"],
  },
});
```

- [ ] **Step 4: Create `tests/vitest.setup.ts`**

```ts
import { afterEach } from "vitest";

afterEach(() => {
  // Keep as a hook point for later (e.g. resetting mocks).
});
```

- [ ] **Step 5: Run tests (should be empty but succeed)**

Run: `npm test`  
Expected: `No test files found` OR success exit (Vitest depends on version; either is acceptable as long as exit code is 0).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tests/vitest.setup.ts
git commit -m "chore: add vitest and core dependencies"
```

---

### Task 2: shadcn form primitives + CSS token baseline (to enforce RHF+shadcn rules)

**Files:**
- Modify: `app/globals.css`
- Create: `components/ui/button.tsx`
- Create: `components/ui/input.tsx`
- Create: `components/ui/label.tsx`
- Create: `components/ui/form.tsx`

- [ ] **Step 1: Update `app/globals.css` to include shadcn tokens**

Replace file content with:

```css
@import "tailwindcss";

:root {
  /* Brand-ish neutrals (foundation). Design system plan will refine later. */
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;

  --card: 0 0% 100%;
  --card-foreground: 240 10% 3.9%;

  --popover: 0 0% 100%;
  --popover-foreground: 240 10% 3.9%;

  --primary: 240 5.9% 10%;
  --primary-foreground: 0 0% 98%;

  --secondary: 240 4.8% 95.9%;
  --secondary-foreground: 240 5.9% 10%;

  --muted: 240 4.8% 95.9%;
  --muted-foreground: 240 3.8% 46.1%;

  --accent: 240 4.8% 95.9%;
  --accent-foreground: 240 5.9% 10%;

  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 0 0% 98%;

  --border: 240 5.9% 90%;
  --input: 240 5.9% 90%;
  --ring: 240 5% 64.9%;

  --radius: 0.75rem;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;

    --card: 240 10% 3.9%;
    --card-foreground: 0 0% 98%;

    --popover: 240 10% 3.9%;
    --popover-foreground: 0 0% 98%;

    --primary: 0 0% 98%;
    --primary-foreground: 240 5.9% 10%;

    --secondary: 240 3.7% 15.9%;
    --secondary-foreground: 0 0% 98%;

    --muted: 240 3.7% 15.9%;
    --muted-foreground: 240 5% 64.9%;

    --accent: 240 3.7% 15.9%;
    --accent-foreground: 0 0% 98%;

    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;

    --border: 240 3.7% 15.9%;
    --input: 240 3.7% 15.9%;
    --ring: 240 4.9% 83.9%;
  }
}

@theme inline {
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
}

body {
  background: hsl(var(--background));
  color: hsl(var(--foreground));
}
```

- [ ] **Step 2: Create `components/ui/button.tsx`**

```tsx
import * as React from "react";

import { cn } from "@/lib/utils/cn";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "secondary" | "destructive" | "ghost";
  size?: "default" | "sm" | "lg";
};

export function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium",
        "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))]",
        "disabled:pointer-events-none disabled:opacity-50",
        variant === "default" &&
          "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90",
        variant === "secondary" &&
          "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:opacity-90",
        variant === "destructive" &&
          "bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] hover:opacity-90",
        variant === "ghost" && "hover:bg-[hsl(var(--accent))]",
        size === "default" && "h-10 px-4 py-2",
        size === "sm" && "h-9 px-3",
        size === "lg" && "h-11 px-8",
        className,
      )}
      {...props}
    />
  );
}
```

- [ ] **Step 3: Create `components/ui/input.tsx`**

```tsx
import * as React from "react";

import { cn } from "@/lib/utils/cn";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
```

- [ ] **Step 4: Create `components/ui/label.tsx`**

```tsx
import * as React from "react";

import { cn } from "@/lib/utils/cn";

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn("text-sm font-medium leading-none", className)}
    {...props}
  />
));
Label.displayName = "Label";
```

- [ ] **Step 5: Create `components/ui/form.tsx` (RHF + shadcn composition primitives)**

```tsx
"use client";

import * as React from "react";
import {
  Controller,
  FormProvider,
  useFormContext,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";

import { cn } from "@/lib/utils/cn";

const Form = FormProvider;

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name: TName;
};

const FormFieldContext = React.createContext<FormFieldContextValue>(
  {} as FormFieldContextValue,
);

function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>(props: ControllerProps<TFieldValues, TName>) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
}

const FormItemContext = React.createContext<{ id: string }>({ id: "" });

function FormItem({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const id = React.useId();
  return (
    <FormItemContext.Provider value={{ id }}>
      <div className={cn("space-y-2", className)} {...props} />
    </FormItemContext.Provider>
  );
}

function useFormField() {
  const fieldContext = React.useContext(FormFieldContext);
  const itemContext = React.useContext(FormItemContext);
  const { getFieldState, formState } = useFormContext();

  const fieldState = getFieldState(fieldContext.name, formState);

  const id = itemContext.id;
  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  };
}

function FormLabel({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  const { formItemId } = useFormField();
  return <label className={cn("text-sm font-medium", className)} htmlFor={formItemId} {...props} />;
}

function FormControl({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { formItemId, formDescriptionId, formMessageId, error } = useFormField();
  return (
    <div
      id={formItemId}
      aria-describedby={error ? `${formDescriptionId} ${formMessageId}` : formDescriptionId}
      aria-invalid={!!error}
      className={cn(className)}
      {...props}
    />
  );
}

function FormDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  const { formDescriptionId } = useFormField();
  return (
    <p
      id={formDescriptionId}
      className={cn("text-sm text-[hsl(var(--muted-foreground))]", className)}
      {...props}
    />
  );
}

function FormMessage({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  const { error, formMessageId } = useFormField();
  const body = error ? String(error.message ?? "") : children;
  if (!body) return null;
  return (
    <p
      id={formMessageId}
      className={cn("text-sm font-medium text-[hsl(var(--destructive))]", className)}
      {...props}
    >
      {body}
    </p>
  );
}

export { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage, useFormField };
```

- [ ] **Step 6: Create `lib/utils/cn.ts` (tiny classnames helper)**

Create `lib/utils/cn.ts`:

```ts
export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}
```

- [ ] **Step 7: Run typecheck via build**

Run: `npm run build`  
Expected: Next build succeeds.

- [ ] **Step 8: Commit**

```bash
git add app/globals.css components/ui lib/utils/cn.ts
git commit -m "feat(ui): add minimal shadcn-style form primitives and tokens"
```

---

### Task 3: Prisma schema (domain + constraints + enums) + Prisma client

**Files:**
- Create: `prisma/schema.prisma`
- Create: `lib/db/prisma.ts`

- [ ] **Step 1: Create `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ---------- Enums ----------

enum EventStatus {
  draft
  active
  finished
}

enum PricingSource {
  global_default
  overridden
}

enum MenuMode {
  PRESELECT
  VOUCHER
}

enum MenuSelection {
  SINGLE
  MULTI
}

enum RegistrationStatus {
  submitted
  pending_review
  payment_issue
  approved
  rejected
  cancelled
  refunded
}

enum AttendanceStatus {
  unknown
  attended
  no_show
}

enum MemberValidation {
  unknown
  valid
  invalid
  overridden
}

enum TicketRole {
  primary
  partner
}

enum TicketPriceType {
  member
  non_member
  privilege_partner_member_price
}

enum InvoiceAdjustmentType {
  underpayment
  other_adjustment
}

enum InvoiceAdjustmentStatus {
  unpaid
  paid
}

enum UploadPurpose {
  transfer_proof
  member_card_photo
  invoice_adjustment_proof
}

enum AdminRole {
  Owner
  Verifier
  Viewer
}

// ---------- Models ----------

model MasterMember {
  id           String  @id @default(cuid())
  memberNumber String  @unique
  fullName     String
  isActive     Boolean @default(true)

  isPengurus Boolean @default(false)
  canBePIC    Boolean @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  bankAccounts PicBankAccount[]
  eventsAsPicMaster Event[] @relation("EventPicMaster")
  eventsAsHelper    EventPicHelper[]
}

model PicBankAccount {
  id            String @id @default(cuid())
  ownerMemberId String
  ownerMember   MasterMember @relation(fields: [ownerMemberId], references: [id], onDelete: Restrict)

  bankName      String
  accountNumber String
  accountName   String
  isActive      Boolean @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  events Event[]

  @@index([ownerMemberId])
}

model Event {
  id           String @id @default(cuid())
  slug         String @unique
  title        String
  startAt      DateTime
  venueName    String
  venueAddress String

  status EventStatus @default(draft)

  ticketMemberPrice    Int
  ticketNonMemberPrice Int
  pricingSource PricingSource @default(global_default)

  menuMode      MenuMode
  menuSelection MenuSelection
  voucherPrice  Int?

  picMasterMemberId String
  picMasterMember   MasterMember @relation("EventPicMaster", fields: [picMasterMemberId], references: [id], onDelete: Restrict)

  bankAccountId String
  bankAccount   PicBankAccount @relation(fields: [bankAccountId], references: [id], onDelete: Restrict)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  helpers EventPicHelper[]
  registrations Registration[]

  @@index([status])
  @@index([picMasterMemberId])
  @@index([bankAccountId])
}

model EventPicHelper {
  eventId  String
  memberId String

  event  Event @relation(fields: [eventId], references: [id], onDelete: Cascade)
  member MasterMember @relation(fields: [memberId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@id([eventId, memberId])
  @@index([memberId])
}

model Registration {
  id      String @id @default(cuid())
  eventId String
  event   Event @relation(fields: [eventId], references: [id], onDelete: Restrict)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  contactName     String
  contactWhatsapp String

  claimedMemberNumber String?
  memberValidation    MemberValidation @default(unknown)
  memberId            String?
  member              MasterMember? @relation(fields: [memberId], references: [id], onDelete: SetNull)

  // Snapshot pricing (locked at submission)
  ticketMemberPriceApplied    Int
  ticketNonMemberPriceApplied Int
  voucherPriceApplied         Int?
  computedTotalAtSubmit       Int

  status           RegistrationStatus @default(submitted)
  attendanceStatus AttendanceStatus   @default(unknown)

  rejectionReason    String?
  paymentIssueReason String?

  tickets      Ticket[]
  uploads      Upload[]
  adjustments  InvoiceAdjustment[]

  @@index([eventId, createdAt])
  @@index([status])
  @@index([attendanceStatus])
}

model Ticket {
  id             String @id @default(cuid())
  registrationId String
  registration   Registration @relation(fields: [registrationId], references: [id], onDelete: Cascade)

  role TicketRole

  fullName  String
  whatsapp  String?
  memberNumber String?

  ticketPriceType TicketPriceType

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Business rule: one ticket per member per event.
  // Implemented as (eventId, memberNumber) unique via denormalized eventId.
  eventId String

  @@index([registrationId])
  @@index([eventId])
  @@unique([eventId, memberNumber])
  @@unique([registrationId, role])
}

model InvoiceAdjustment {
  id             String @id @default(cuid())
  registrationId String
  registration   Registration @relation(fields: [registrationId], references: [id], onDelete: Cascade)

  type   InvoiceAdjustmentType
  amount Int
  status InvoiceAdjustmentStatus @default(unpaid)

  paidAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  uploads Upload[]

  @@index([registrationId])
  @@index([status])
}

model Upload {
  id String @id @default(cuid())

  purpose UploadPurpose

  blobUrl     String
  blobPath    String
  contentType String
  bytes       Int
  sha256      String

  width  Int?
  height Int?

  originalFilename String?

  createdAt DateTime @default(now())

  registrationId String?
  registration   Registration? @relation(fields: [registrationId], references: [id], onDelete: Cascade)

  invoiceAdjustmentId String?
  invoiceAdjustment   InvoiceAdjustment? @relation(fields: [invoiceAdjustmentId], references: [id], onDelete: Cascade)

  @@index([purpose, createdAt])
  @@index([registrationId])
  @@index([invoiceAdjustmentId])
}

model AdminProfile {
  id String @id @default(cuid())

  // Better Auth user id (string). We keep Better Auth tables outside Prisma by using pg.Pool adapter.
  authUserId String @unique

  role AdminRole @default(Viewer)

  // Optional: link to a MasterMember so PIC helper checks are possible.
  memberId String?
  member   MasterMember? @relation(fields: [memberId], references: [id], onDelete: SetNull)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([role])
  @@index([memberId])
}
```

- [ ] **Step 2: Create `lib/db/prisma.ts`**

```ts
import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__prisma__ ??
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalThis.__prisma__ = prisma;
```

- [ ] **Step 3: Add `.env.example`**

Create `/.env.example`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB?sslmode=require"

BETTER_AUTH_SECRET="change-me-min-32-chars"
BETTER_AUTH_URL="http://localhost:3000"

BLOB_READ_WRITE_TOKEN="vercel_blob_rw_token_here"
```

- [ ] **Step 4: Create first migration**

Run:

```bash
npx prisma migrate dev --name init_domain
```

Expected: migration created under `prisma/migrations/*` and Prisma client generated.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/db/prisma.ts .env.example
git commit -m "feat(db): add prisma domain schema with core constraints"
```

---

### Task 4: Better Auth (admin-only) + route handler + `/admin/**` middleware gate

**Files:**
- Create: `lib/auth/auth.ts`
- Create: `lib/auth/session.ts`
- Create: `app/api/auth/[...all]/route.ts`
- Create: `middleware.ts`
- Create: `app/(auth)/admin/sign-in/page.tsx`
- Create: `app/admin/page.tsx`

- [ ] **Step 1: Create `lib/auth/auth.ts`**

```ts
import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const auth = betterAuth({
  appName: "match-screening",
  database: pool,
  plugins: [
    nextCookies(),
    magicLink({
      // For foundations: keep email sending as a no-op.
      // In later plans, replace with Resend and real templates.
      sendMagicLink: async ({ email, url }) => {
        console.log("[magicLink]", { email, url });
      },
    }),
  ],
  emailAndPassword: {
    enabled: true,
  },
});

export type AuthSession = typeof auth.$Infer.Session;
```

- [ ] **Step 2: Create `app/api/auth/[...all]/route.ts`**

```ts
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth/auth";

export const { GET, POST } = toNextJsHandler(auth);
```

- [ ] **Step 3: Create `lib/auth/session.ts`**

```ts
import { headers } from "next/headers";
import { auth, type AuthSession } from "@/lib/auth/auth";

export async function getAdminSession(): Promise<AuthSession | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session ?? null;
}

export async function requireAdminSession(): Promise<AuthSession> {
  const session = await getAdminSession();
  if (!session) {
    throw new Error("UNAUTHENTICATED");
  }
  return session;
}
```

- [ ] **Step 4: Create `middleware.ts` (coarse `/admin/**` gate)**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/admin")) return NextResponse.next();

  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session) {
    const url = new URL("/admin/sign-in", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
```

- [ ] **Step 5: Create minimal sign-in page `app/(auth)/admin/sign-in/page.tsx`**

```tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createAuthClient } from "better-auth/react";

const authClient = createAuthClient();

export default function AdminSignInPage() {
  const router = useRouter();
  const search = useSearchParams();
  const next = useMemo(() => search.get("next") ?? "/admin", [search]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Admin sign in</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Use email + password. Magic link will be enabled later.
      </p>

      <form
        className="mt-8 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            const res = await authClient.signIn.email({
              email,
              password,
            });
            if (res.error) {
              setError(res.error.message ?? "Sign in failed.");
              return;
            }
            router.push(next);
          });
        }}
      >
        <label className="block space-y-1">
          <span className="text-sm font-medium">Email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Password</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-zinc-400"
            required
          />
        </label>

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-60"
        >
          {isPending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 6: Create minimal admin page `app/admin/page.tsx`**

```tsx
import { getAdminSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export default async function AdminHomePage() {
  const session = await getAdminSession();
  const authUserId = session?.user?.id ?? null;

  const admin =
    authUserId
      ? await prisma.adminProfile.findUnique({ where: { authUserId } })
      : null;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Authenticated as <span className="font-mono">{session?.user?.email}</span>
      </p>
      <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-4">
        <div className="text-sm">
          <div>
            <span className="text-zinc-500">Role:</span>{" "}
            <span className="font-mono">{admin?.role ?? "UNKNOWN (no AdminProfile)"}</span>
          </div>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 7: Run Better Auth migrations**

Run:

```bash
npx @better-auth/cli@latest migrate
```

Expected: tables for Better Auth created in Postgres (CLI output confirms).

- [ ] **Step 8: Smoke-check auth endpoint**

Run dev server: `npm run dev`  
Then open: `GET /api/auth/ok`  
Expected: JSON `{ "status": "ok" }`

- [ ] **Step 9: Commit**

```bash
git add lib/auth app/api/auth middleware.ts app/admin app/\(auth\) .env.example
git commit -m "feat(auth): add admin-only better-auth with /admin middleware gate"
```

---

### Task 5: Permissions model (roles + PIC helper) for Server Actions

**Files:**
- Create: `lib/permissions/roles.ts`
- Create: `lib/permissions/guards.ts`
- Test: `tests/unit/permissions.test.ts`

- [ ] **Step 1: Write failing tests `tests/unit/permissions.test.ts`**

```ts
import { describe, expect, test } from "vitest";
import { canVerifyEvent, type AdminContext } from "@/lib/permissions/guards";

const base: AdminContext = {
  role: "Viewer",
  helperEventIds: [],
};

describe("permissions: canVerifyEvent", () => {
  test("Owner can verify any event", () => {
    expect(canVerifyEvent({ ...base, role: "Owner" }, "e1")).toBe(true);
  });

  test("Verifier can verify any event", () => {
    expect(canVerifyEvent({ ...base, role: "Verifier" }, "e1")).toBe(true);
  });

  test("Viewer cannot verify without PIC helper grant", () => {
    expect(canVerifyEvent({ ...base, role: "Viewer" }, "e1")).toBe(false);
  });

  test("Viewer can verify for assigned event only", () => {
    expect(
      canVerifyEvent({ ...base, role: "Viewer", helperEventIds: ["e1"] }, "e1"),
    ).toBe(true);
    expect(
      canVerifyEvent({ ...base, role: "Viewer", helperEventIds: ["e1"] }, "e2"),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test`  
Expected: FAIL with module import error (guards not implemented yet).

- [ ] **Step 3: Implement `lib/permissions/roles.ts`**

```ts
export type AdminRole = "Owner" | "Verifier" | "Viewer";
```

- [ ] **Step 4: Implement `lib/permissions/guards.ts`**

```ts
import type { AdminRole } from "@/lib/permissions/roles";

export type AdminContext = {
  role: AdminRole;
  helperEventIds: string[];
};

export function canVerifyEvent(ctx: AdminContext, eventId: string): boolean {
  if (ctx.role === "Owner") return true;
  if (ctx.role === "Verifier") return true;
  return ctx.helperEventIds.includes(eventId);
}
```

- [ ] **Step 5: Run tests to verify GREEN**

Run: `npm test`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/permissions tests/unit/permissions.test.ts
git commit -m "feat(permissions): add role + PIC helper guard primitives"
```

---

### Task 6: Upload pipeline foundations (validate → WebP convert → Blob put → metadata DB) with retry + recovery

**Files:**
- Create: `lib/uploads/errors.ts`
- Create: `lib/uploads/retry.ts`
- Create: `lib/uploads/images.ts`
- Create: `lib/uploads/blob.ts`
- Create: `lib/uploads/save-upload.ts`
- Create: `lib/uploads/upload-image.ts`
- Test: `tests/unit/retry.test.ts`

- [ ] **Step 1: Write failing tests for retry `tests/unit/retry.test.ts`**

```ts
import { describe, expect, test } from "vitest";
import { retry } from "@/lib/uploads/retry";

describe("uploads: retry", () => {
  test("retries until success", async () => {
    let attempts = 0;
    const result = await retry(
      async () => {
        attempts++;
        if (attempts < 3) throw new Error("fail");
        return "ok";
      },
      { maxAttempts: 3 },
    );

    expect(result).toBe("ok");
    expect(attempts).toBe(3);
  });

  test("throws last error after max attempts", async () => {
    let attempts = 0;
    await expect(
      retry(
        async () => {
          attempts++;
          throw new Error("nope");
        },
        { maxAttempts: 2 },
      ),
    ).rejects.toThrow("nope");
    expect(attempts).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test`  
Expected: FAIL (missing `retry`).

- [ ] **Step 3: Implement `lib/uploads/retry.ts`**

```ts
export async function retry<T>(
  fn: () => Promise<T>,
  opts: { maxAttempts: number; delayMs?: number },
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < opts.maxAttempts && opts.delayMs) {
        await new Promise((r) => setTimeout(r, opts.delayMs));
      }
    }
  }
  throw lastError;
}
```

- [ ] **Step 4: Implement typed errors `lib/uploads/errors.ts`**

```ts
export class UploadError extends Error {
  readonly code: string;
  readonly recoverable: boolean;

  constructor(message: string, opts: { code: string; recoverable: boolean }) {
    super(message);
    this.code = opts.code;
    this.recoverable = opts.recoverable;
  }
}

export function isUploadError(err: unknown): err is UploadError {
  return err instanceof UploadError;
}
```

- [ ] **Step 5: Implement WebP conversion `lib/uploads/images.ts`**

```ts
import sharp from "sharp";
import { UploadError } from "@/lib/uploads/errors";

export type WebpOutput = {
  bytes: Buffer;
  width: number;
  height: number;
  sha256: string;
};

async function sha256Hex(buf: Buffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function toWebp(input: Buffer, opts: { maxDim: number; quality: number }): Promise<WebpOutput> {
  try {
    const image = sharp(input, { failOn: "none" });
    const meta = await image.metadata();
    if (!meta.width || !meta.height) {
      throw new UploadError("File is not a valid image.", {
        code: "invalid_image",
        recoverable: true,
      });
    }

    const resized = image.resize({
      width: opts.maxDim,
      height: opts.maxDim,
      fit: "inside",
      withoutEnlargement: true,
    });

    const bytes = await resized.webp({ quality: opts.quality }).toBuffer();
    const outMeta = await sharp(bytes).metadata();

    return {
      bytes,
      width: outMeta.width ?? meta.width,
      height: outMeta.height ?? meta.height,
      sha256: await sha256Hex(bytes),
    };
  } catch (err) {
    if (err instanceof UploadError) throw err;
    throw new UploadError("Failed to process image.", {
      code: "image_processing_failed",
      recoverable: true,
    });
  }
}
```

- [ ] **Step 6: Implement Blob put `lib/uploads/blob.ts`**

```ts
import { put } from "@vercel/blob";
import { UploadError } from "@/lib/uploads/errors";

export async function putWebpToBlob(opts: {
  path: string;
  bytes: Buffer;
}): Promise<{ url: string; pathname: string }> {
  try {
    const res = await put(opts.path, opts.bytes, {
      access: "public",
      contentType: "image/webp",
      addRandomSuffix: false,
    });
    return { url: res.url, pathname: res.pathname };
  } catch {
    throw new UploadError("Upload failed. Please retry.", {
      code: "blob_put_failed",
      recoverable: true,
    });
  }
}
```

- [ ] **Step 7: Implement metadata persistence `lib/uploads/save-upload.ts`**

```ts
import type { UploadPurpose } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export async function saveUploadMetadata(input: {
  purpose: UploadPurpose;
  blobUrl: string;
  blobPath: string;
  contentType: string;
  bytes: number;
  sha256: string;
  width?: number;
  height?: number;
  originalFilename?: string;
  registrationId?: string;
  invoiceAdjustmentId?: string;
}) {
  return prisma.upload.create({
    data: {
      purpose: input.purpose,
      blobUrl: input.blobUrl,
      blobPath: input.blobPath,
      contentType: input.contentType,
      bytes: input.bytes,
      sha256: input.sha256,
      width: input.width,
      height: input.height,
      originalFilename: input.originalFilename,
      registrationId: input.registrationId,
      invoiceAdjustmentId: input.invoiceAdjustmentId,
    },
  });
}
```

- [ ] **Step 8: Orchestrate pipeline `lib/uploads/upload-image.ts`**

```ts
import type { UploadPurpose } from "@prisma/client";
import { retry } from "@/lib/uploads/retry";
import { toWebp } from "@/lib/uploads/images";
import { putWebpToBlob } from "@/lib/uploads/blob";
import { saveUploadMetadata } from "@/lib/uploads/save-upload";
import { UploadError } from "@/lib/uploads/errors";

export async function uploadImageForRegistration(input: {
  purpose: Extract<UploadPurpose, "transfer_proof" | "member_card_photo">;
  registrationId: string;
  file: File;
}): Promise<{ uploadId: string; url: string }> {
  if (!input.file.type.startsWith("image/")) {
    throw new UploadError("File must be an image.", {
      code: "invalid_content_type",
      recoverable: true,
    });
  }

  const raw = Buffer.from(await input.file.arrayBuffer());
  const webp = await toWebp(raw, { maxDim: 1600, quality: 80 });

  const blobPath = `registrations/${input.registrationId}/${input.purpose}.webp`;
  const putRes = await retry(
    () => putWebpToBlob({ path: blobPath, bytes: webp.bytes }),
    { maxAttempts: 3, delayMs: 250 },
  );

  const row = await saveUploadMetadata({
    purpose: input.purpose,
    registrationId: input.registrationId,
    blobUrl: putRes.url,
    blobPath: putRes.pathname,
    contentType: "image/webp",
    bytes: webp.bytes.length,
    sha256: webp.sha256,
    width: webp.width,
    height: webp.height,
    originalFilename: input.file.name,
  });

  return { uploadId: row.id, url: row.blobUrl };
}
```

- [ ] **Step 9: Run tests to verify GREEN**

Run: `npm test`  
Expected: PASS (only retry tests exist in this task).

- [ ] **Step 10: Commit**

```bash
git add lib/uploads tests/unit/retry.test.ts
git commit -m "feat(uploads): add webp+blob upload pipeline primitives with retry"
```

---

### Task 7: Form + validation contract foundations (RHF + shadcn + Zod; server error mapping)

**Files:**
- Create: `lib/forms/action-result.ts`
- Create: `lib/forms/zod.ts`
- Test: `tests/unit/zod-error-mapping.test.ts`

- [ ] **Step 1: Write failing test `tests/unit/zod-error-mapping.test.ts`**

```ts
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { zodToFieldErrors } from "@/lib/forms/zod";

describe("forms: zodToFieldErrors", () => {
  test("maps nested zod issues to dot-path keys", () => {
    const S = z.object({
      contact: z.object({
        name: z.string().min(1, "Required"),
      }),
    });

    const res = S.safeParse({ contact: { name: "" } });
    if (res.success) throw new Error("expected failure");

    expect(zodToFieldErrors(res.error)).toEqual({
      "contact.name": "Required",
    });
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test`  
Expected: FAIL (missing `zodToFieldErrors`).

- [ ] **Step 3: Implement `lib/forms/action-result.ts`**

```ts
export type FieldErrors = Record<string, string>;

export type ActionOk<T> = { ok: true; data: T };
export type ActionErr = { ok: false; fieldErrors?: FieldErrors; rootError?: string };

export type ActionResult<T> = ActionOk<T> | ActionErr;

export function ok<T>(data: T): ActionOk<T> {
  return { ok: true, data };
}

export function fieldError(fieldErrors: FieldErrors, rootError?: string): ActionErr {
  return { ok: false, fieldErrors, rootError };
}

export function rootError(rootError: string): ActionErr {
  return { ok: false, rootError };
}
```

- [ ] **Step 4: Implement `lib/forms/zod.ts`**

```ts
import type { ZodError } from "zod";

export function zodToFieldErrors(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".");
    if (!key) continue;
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
```

- [ ] **Step 5: Run tests to verify GREEN**

Run: `npm test`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/forms tests/unit/zod-error-mapping.test.ts
git commit -m "feat(forms): add server action result + zod error mapping helpers"
```

---

### Task 8: Glue step — align `Ticket.eventId` denormalization + keep it correct on create

**Why:** The schema enforces “one ticket per member per event” via `Ticket(eventId, memberNumber)` unique, which requires `eventId` to always match the parent registration’s event. This task adds a minimal helper that must be used whenever tickets are created.

**Files:**
- Create: `lib/db/tickets.ts`
- Test: `tests/unit/tickets-eventid.test.ts`

- [ ] **Step 1: Write failing test `tests/unit/tickets-eventid.test.ts`**

```ts
import { describe, expect, test } from "vitest";
import { buildTicketCreateData } from "@/lib/db/tickets";

describe("db: buildTicketCreateData", () => {
  test("sets ticket.eventId from registration.eventId", () => {
    const data = buildTicketCreateData({
      registrationId: "r1",
      eventId: "e1",
      role: "primary",
      fullName: "A",
      whatsapp: "628123",
      memberNumber: "123",
      ticketPriceType: "member",
    });
    expect(data.eventId).toBe("e1");
    expect(data.registrationId).toBe("r1");
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test`  
Expected: FAIL (missing helper).

- [ ] **Step 3: Implement `lib/db/tickets.ts`**

```ts
import type { Prisma, TicketPriceType, TicketRole } from "@prisma/client";

export function buildTicketCreateData(input: {
  registrationId: string;
  eventId: string;
  role: TicketRole;
  fullName: string;
  whatsapp?: string;
  memberNumber?: string;
  ticketPriceType: TicketPriceType;
}): Prisma.TicketCreateInput {
  return {
    registration: { connect: { id: input.registrationId } },
    registrationId: input.registrationId,
    eventId: input.eventId,
    role: input.role,
    fullName: input.fullName,
    whatsapp: input.whatsapp,
    memberNumber: input.memberNumber,
    ticketPriceType: input.ticketPriceType,
  };
}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm test`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/db/tickets.ts tests/unit/tickets-eventid.test.ts
git commit -m "feat(db): add helper to keep ticket.eventId consistent"
```

---

## Self-review against spec

- **Auth + permissions**
  - Middleware gates `/admin/**`: Task 4.
  - Per-action role + PIC helper grant: Task 5 introduces primitives; later feature plans must use them inside Server Actions.
  - Admin-only Better Auth: Task 4 (no participant accounts).

- **Prisma schema + enums + constraints**
  - Entities: Event/Registration/Ticket/MasterMember/PIC Bank Account/Invoice Adjustment/Upload/AdminProfile: Task 3.
  - Status machine enums: `RegistrationStatus`, `AttendanceStatus`, reasons: Task 3.
  - “One ticket per member per event”: Task 3 `@@unique([eventId, memberNumber])` + Task 8 glue helper.

- **Upload pipeline**
  - Blob storage + metadata DB only: Task 6.
  - WebP conversion: Task 6 (`sharp` → `.webp`).
  - Retry + recoverable error: Task 6 (`retry`, `UploadError`).

- **Form + validation contract**
  - shadcn primitives + RHF composition: Task 2.
  - Shared schema + server re-validation + structured error mapping: Task 7 introduces the cross-surface foundation (`ActionResult`, `zodToFieldErrors`).

**Placeholder scan:** No “TBD/TODO/implement later” steps; every file includes full code to create. (Magic link uses console logging intentionally; that is a deliberate no-email-provider foundation constraint, not a placeholder.)

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-30-foundations-platform-skeleton.md`. Two execution options:

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration  
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?

