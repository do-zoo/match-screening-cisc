"use client";

import { useActionState } from "react";

import { acceptAdminInvitation } from "@/lib/actions/accept-admin-invitation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/forms/action-result";

export function AdminInviteAcceptForm(props: { token: string }) {
  const [state, dispatch, pending] = useActionState(
    acceptAdminInvitation,
    null as ActionResult<unknown> | null,
  );

  return (
    <form action={dispatch} className="mt-8 space-y-4">
      <input type="hidden" name="token" value={props.token} />
      {state?.ok === false && state.rootError ? (
        <Alert variant="destructive">
          <AlertTitle>Gagal</AlertTitle>
          <AlertDescription>{state.rootError}</AlertDescription>
        </Alert>
      ) : null}
      <Field>
        <FieldLabel htmlFor="invite-name">Nama tampilan</FieldLabel>
        <Input
          id="invite-name"
          name="name"
          autoComplete="name"
          required
          disabled={pending}
          maxLength={120}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="invite-password">Kata sandi</FieldLabel>
        <Input
          id="invite-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          disabled={pending}
        />
        <p className="text-muted-foreground mt-1 text-xs">Minimal 8 karakter.</p>
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Menyimpan…" : "Buat akun admin"}
      </Button>
    </form>
  );
}
