"use client";

import { Suspense, useMemo, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createAuthClient } from "better-auth/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const authClient = createAuthClient();

const AdminSignInSchema = z.object({
  email: z.string().email("Email tidak valid."),
  password: z.string().min(1, "Password wajib diisi."),
});

type AdminSignInInput = z.infer<typeof AdminSignInSchema>;

/** RHF paths including `root.server` for Better Auth errors (not in Zod schema). */
type AdminSignInFormValues = AdminSignInInput & {
  root?: { server?: { message?: string } };
};

const adminSignInResolver = zodResolver(
  AdminSignInSchema as never,
) as Resolver<AdminSignInFormValues>;

function AdminSignInForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = useMemo(() => search.get("next") ?? "/admin", [search]);

  const [isPending, startTransition] = useTransition();

  const form = useForm<AdminSignInFormValues>({
    resolver: adminSignInResolver,
    defaultValues: {
      email: "",
      password: "",
    },
    shouldFocusError: true,
  });

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Admin sign in</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Use email + password. Magic link will be enabled later.
      </p>

      <form
        className="mt-8 space-y-4"
        onSubmit={form.handleSubmit((values) => {
          form.clearErrors("root.server");
          startTransition(async () => {
            const res = await authClient.signIn.email({
              email: values.email,
              password: values.password,
            });
            if (res.error) {
              form.setError("root.server", {
                message: res.error.message ?? "Sign in failed.",
              });
              return;
            }
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
    </main>
  );
}

export default function AdminSignInPage() {
  return (
    <Suspense>
      <AdminSignInForm />
    </Suspense>
  );
}
