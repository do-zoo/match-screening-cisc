"use client";

import { Suspense, useMemo, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createAuthClient } from "better-auth/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { z } from "zod";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const authClient = createAuthClient();

const AdminSignInSchema = z.object({
  email: z.string().email("Email tidak valid."),
  password: z.string().min(1, "Password wajib diisi."),
});

type AdminSignInInput = z.infer<typeof AdminSignInSchema>;

type AdminSignInUiErrors = AdminSignInInput;

const adminSignInResolver = zodResolver(AdminSignInSchema as never) as Resolver<AdminSignInUiErrors>;

function AdminSignInForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = useMemo(() => search.get("next") ?? "/admin", [search]);

  const [isPending, startTransition] = useTransition();

  const form = useForm<AdminSignInUiErrors>({
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

      <Form {...form}>
        <form
          className="mt-8 space-y-4"
          onSubmit={form.handleSubmit((values) => {
            form.clearErrors("root");
            startTransition(async () => {
              const res = await authClient.signIn.email({
                email: values.email,
                password: values.password,
              });
              if (res.error) {
                form.setError("root", {
                  message: res.error.message ?? "Sign in failed.",
                });
                return;
              }
              router.push(next);
            });
          })}
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {form.formState.errors.root?.message ? (
            <p className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {form.formState.errors.root.message}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </Form>
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
