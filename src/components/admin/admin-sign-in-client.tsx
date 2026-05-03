"use client";

import { Suspense, useMemo, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { adminAuthClient } from "@/lib/auth/admin-auth-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { z } from "zod";

import { Logo } from "@/components/branding/logo";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

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
      <div className="mb-8 flex justify-center">
        <Logo height={52} priority />
      </div>
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
                router.push(
                  `/admin/sign-in/magic-link-sent?email=${encodeURIComponent(values.email.trim())}`,
                );
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
