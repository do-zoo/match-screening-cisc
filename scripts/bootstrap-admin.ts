import { applyEnvProfile } from "./load-env-profile";

type Args = {
  email: string;
  password: string;
  name: string;
  role: "Owner" | "Admin" | "Verifier" | "Viewer";
};

function readArg(flag: string) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  const value = process.argv[idx + 1];
  if (!value || value.startsWith("--")) return null;
  return value;
}

function usage() {
  return [
    "Usage:",
    "  pnpm bootstrap:admin -- --email you@example.com --password 'password1234' --name 'PIC' [--role Owner|Admin|Verifier|Viewer]",
    "",
    "Or via env:",
    "  BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD, BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_ROLE",
  ].join("\n");
}

async function main() {
  applyEnvProfile();

  const [{ auth }, { prisma }] = await Promise.all([
    import("@/lib/auth/auth"),
    import("@/lib/db/prisma"),
  ]);

  const email = readArg("--email") ?? process.env.BOOTSTRAP_ADMIN_EMAIL ?? "";
  const password = readArg("--password") ?? process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "";
  const name = readArg("--name") ?? process.env.BOOTSTRAP_ADMIN_NAME ?? "Admin";
  const role = (readArg("--role") ??
    process.env.BOOTSTRAP_ADMIN_ROLE ??
    "Owner") as Args["role"];

  if (!email || !password) {
    console.error(usage());
    process.exit(2);
  }

  let userId: string | null = null;

  try {
    const data = await auth.api.signUpEmail({
      body: {
        name,
        email,
        password,
      },
    });
    userId = data?.user?.id ?? null;
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null) {
      const err = e as { code?: string; message?: string };
      if (err.code === "42P01" && err.message?.includes('relation "user" does not exist')) {
        console.error(
          [
            'Better Auth tables are missing (relation "user" does not exist).',
            "",
            "Run the Better Auth migration first:",
            "  pnpm auth:migrate   # dev (.env.local) or:",
            "  pnpm auth:migrate:prod   # MATCH_DB_PROFILE=production (.env.prod)",
            "",
            "Then re-run this bootstrap command.",
          ].join("\n"),
        );
        process.exit(1);
      }
    }

    // If the user already exists, sign in to retrieve the user id.
    // (signUpEmail typically throws 422 in that case with default settings)
    const status = (() => {
      if (typeof e !== "object" || e === null) return null;
      const err = e as { status?: number; response?: { status?: number } };
      return err.status ?? err.response?.status ?? null;
    })();
    if (status !== 422) throw e;

    const data = await auth.api.signInEmail({
      body: {
        email,
        password,
      },
    });
    userId = data?.user?.id ?? null;
  }

  if (!userId) {
    throw new Error("Could not determine Better Auth user id.");
  }

  const admin = await prisma.adminProfile.upsert({
    where: { authUserId: userId },
    update: { role },
    create: { authUserId: userId, role },
  });

  const { appendClubAuditLog } = await import(
    "@/lib/audit/append-club-audit-log"
  );
  const { CLUB_AUDIT_ACTION } = await import("@/lib/audit/club-audit-actions");

  await appendClubAuditLog(prisma, {
    actorProfileId: admin.id,
    actorAuthUserId: userId,
    action: CLUB_AUDIT_ACTION.ADMIN_PROFILE_BOOTSTRAP_UPSERT,
    targetType: "admin_profile",
    targetId: admin.id,
    metadata: { email, role },
  });

  console.log("Bootstrap OK:", {
    email,
    userId,
    adminProfileId: admin.id,
    role: admin.role,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

