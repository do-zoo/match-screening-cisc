"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";

import { ThemePreferenceField } from "@/components/admin/theme-preference-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeAdminDisplayName } from "@/lib/admin/normalize-admin-display-name";
import { updateAdminDisplayName } from "@/lib/actions/update-admin-display-name";

type FormValues = { name: string };

export function AdminAccountPageClient({
  initialName,
  email,
}: {
  initialName: string;
  email: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    defaultValues: { name: initialName },
  });

  const rootErr = form.formState.errors.root?.message;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-8 px-6 py-8 lg:py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Akun</h1>
        <p className="text-sm text-muted-foreground">
          Nama tampilan dan tampilan antarmuka. Email dikelola lewat akun masuk Anda.
        </p>
      </header>

      <section className="flex flex-col gap-4 rounded-lg border bg-card p-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={email} readOnly className="bg-muted/50" />
        </div>

        <form
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit((values) => {
            startTransition(async () => {
              form.clearErrors("root");
              form.clearErrors("name");
              const fd = new FormData();
              fd.set("name", values.name);
              const res = await updateAdminDisplayName(fd);
              if (!res.ok) {
                if (res.fieldErrors?.name) {
                  form.setError("name", { message: res.fieldErrors.name });
                }
                if (res.rootError) {
                  form.setError("root", { message: res.rootError });
                }
                return;
              }
              router.refresh();
            });
          })}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Nama tampilan</Label>
            <Input
              id="name"
              {...form.register("name", {
                validate: (value) => {
                  const r = normalizeAdminDisplayName(value);
                  return r.ok ? true : r.message;
                },
              })}
              disabled={pending}
              aria-invalid={!!form.formState.errors.name}
            />
            {form.formState.errors.name?.message ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>
          {rootErr ? (
            <p className="text-sm text-destructive">{rootErr}</p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Menyimpan…" : "Simpan nama"}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground">
          <Link href="/admin?tab=active" className="text-primary underline-offset-4 hover:underline">
            Kembali ke beranda admin
          </Link>
        </p>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border bg-card p-6">
        <ThemePreferenceField />
      </section>
    </div>
  );
}
