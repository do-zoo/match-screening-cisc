"use client";

import { Suspense, useMemo, useRef, useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { adminAuthClient } from "@/lib/auth/admin-auth-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/** Partially hide local part for on-screen confirmation (not security-critical). */
function maskEmailForDisplay(email: string): string {
  const [local, domain] = email.trim().split("@");
  if (!domain || local === undefined) return email;
  if (local.length <= 1) return `*@${domain}`;
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  return `${local.slice(0, 2)}•••@${domain}`;
}

const AdminSignInSchema = z.object({
  email: z.string().email("Email tidak valid."),
  password: z.string().min(1, "Password wajib diisi."),
});

type AdminSignInInput = z.infer<typeof AdminSignInSchema>;

type AdminSignInFormValues = AdminSignInInput & {
  root?: { server?: { message?: string } };
};

const adminSignInResolver = zodResolver(
  AdminSignInSchema as never,
) as Resolver<AdminSignInFormValues>;

const MagicLinkEmailSchema = z.object({
  email: z.string().email("Email tidak valid."),
});

type MagicLinkInput = z.infer<typeof MagicLinkEmailSchema>;
type MagicLinkFormValues = MagicLinkInput & {
  root?: { server?: { message?: string } };
};

function AdminSignInFormInner({ magicLinkEnabled }: { magicLinkEnabled: boolean }) {
  const router = useRouter();
  const search = useSearchParams();
  const next = useMemo(() => search.get("next") ?? "/admin", [search]);

  const [isPending, startTransition] = useTransition();
  const [isMagicPending, startMagicTransition] = useTransition();
  const [magicLinkSentTo, setMagicLinkSentTo] = useState<string | null>(null);
  const magicLinkSuccessRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (magicLinkSentTo && magicLinkSuccessRef.current) {
      magicLinkSuccessRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [magicLinkSentTo]);

  const form = useForm<AdminSignInFormValues>({
    resolver: adminSignInResolver,
    defaultValues: { email: "", password: "" },
    shouldFocusError: true,
  });

  const magicForm = useForm<MagicLinkFormValues>({
    resolver: zodResolver(MagicLinkEmailSchema as never) as Resolver<MagicLinkFormValues>,
    defaultValues: { email: "" },
    shouldFocusError: true,
  });

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Admin sign in</h1>
      <p className="mt-2 text-sm text-zinc-600">Masuk menggunakan email dan password.</p>

      <form
        className="mt-8 space-y-4"
        onSubmit={form.handleSubmit((values) => {
          form.clearErrors("root.server");
          startTransition(async () => {
            const res = await adminAuthClient.signIn.email({
              email: values.email,
              password: values.password,
            });
            if (res.error) {
              form.setError("root.server", {
                message: res.error.message ?? "Sign in failed.",
              });
              return;
            }
            const data = res.data as { twoFactorRedirect?: boolean } | undefined;
            if (data?.twoFactorRedirect) return;
            router.push(next);
          });
        })}
      >
        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="ms-admin-signin-email">Email</FieldLabel>
              <Input
                {...field}
                id="ms-admin-signin-email"
                type="email"
                aria-invalid={fieldState.invalid}
                autoComplete="email"
                placeholder="you@example.com"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="ms-admin-signin-password">Password</FieldLabel>
              <Input
                {...field}
                id="ms-admin-signin-password"
                type="password"
                aria-invalid={fieldState.invalid}
                autoComplete="current-password"
                placeholder="••••••••"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        {form.formState.errors.root?.server ? (
          <FieldError errors={[form.formState.errors.root.server]} />
        ) : null}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {magicLinkEnabled ? (
        <>
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">atau</span>
            </div>
          </div>

          {magicLinkSentTo ? (
            <div
              ref={magicLinkSuccessRef}
              className="space-y-4"
              role="status"
              aria-live="polite"
            >
              <Alert className="border-emerald-500/40 bg-emerald-50/80 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-50">
                <AlertTitle>Periksa email Anda</AlertTitle>
                <AlertDescription className="space-y-2 text-emerald-900/90 dark:text-emerald-100/90">
                  <p>
                    Link masuk sudah dikirim ke{" "}
                    <span className="font-medium tabular-nums">{maskEmailForDisplay(magicLinkSentTo)}</span>.
                    Buka tautan di email—berlaku sekitar 5 menit.
                  </p>
                  <p className="text-sm">
                    Tidak ada di kotak masuk? Periksa folder spam atau promosi.
                  </p>
                </AlertDescription>
              </Alert>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={isMagicPending}
                  onClick={() => {
                    magicForm.clearErrors("root.server");
                    startMagicTransition(async () => {
                      const path = next.startsWith("/") ? next : `/${next}`;
                      const callbackURL =
                        typeof window !== "undefined"
                          ? `${window.location.origin}${path}`
                          : path;
                      const res = await adminAuthClient.signIn.magicLink({
                        email: magicLinkSentTo,
                        callbackURL,
                      });
                      if (res.error) {
                        const prev = magicLinkSentTo;
                        setMagicLinkSentTo(null);
                        magicForm.reset({ email: prev ?? "" });
                        magicForm.setError("root.server", {
                          message: res.error.message ?? "Gagal mengirim ulang.",
                        });
                        return;
                      }
                    });
                  }}
                >
                  {isMagicPending ? "Mengirim…" : "Kirim ulang link"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1"
                  onClick={() => {
                    setMagicLinkSentTo(null);
                    magicForm.reset({ email: "" });
                    magicForm.clearErrors("root.server");
                  }}
                >
                  Alamat email lain
                </Button>
              </div>
              {magicForm.formState.errors.root?.server ? (
                <FieldError errors={[magicForm.formState.errors.root.server]} />
              ) : null}
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={magicForm.handleSubmit((values) => {
                magicForm.clearErrors("root.server");
                startMagicTransition(async () => {
                  const path = next.startsWith("/") ? next : `/${next}`;
                  const callbackURL =
                    typeof window !== "undefined"
                      ? `${window.location.origin}${path}`
                      : path;
                  const res = await adminAuthClient.signIn.magicLink({
                    email: values.email,
                    callbackURL,
                  });
                  if (res.error) {
                    magicForm.setError("root.server", {
                      message: res.error.message ?? "Gagal mengirim magic link.",
                    });
                    return;
                  }
                  setMagicLinkSentTo(values.email.trim());
                });
              })}
            >
              <p className="text-sm font-medium">Masuk dengan magic link</p>
              <Controller
                control={magicForm.control}
                name="email"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="ms-admin-magic-email">Email</FieldLabel>
                    <Input
                      {...field}
                      id="ms-admin-magic-email"
                      type="email"
                      aria-invalid={fieldState.invalid}
                      autoComplete="email"
                      placeholder="you@example.com"
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />

              {magicForm.formState.errors.root?.server ? (
                <FieldError errors={[magicForm.formState.errors.root.server]} />
              ) : null}

              <Button
                type="submit"
                variant="outline"
                className="w-full"
                disabled={isMagicPending}
              >
                {isMagicPending ? "Mengirim…" : "Kirim magic link"}
              </Button>
            </form>
          )}
        </>
      ) : null}
    </main>
  );
}

export function AdminSignInClient({ magicLinkEnabled }: { magicLinkEnabled: boolean }) {
  return (
    <Suspense>
      <AdminSignInFormInner magicLinkEnabled={magicLinkEnabled} />
    </Suspense>
  );
}
