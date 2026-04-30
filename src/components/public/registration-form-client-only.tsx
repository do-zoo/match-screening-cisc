"use client";

import dynamic from "next/dynamic";

import type { SerializedEventForRegistration } from "@/components/public/event-serialization";

const RegistrationForm = dynamic(
  () =>
    import("@/components/public/registration-form").then(
      (mod) => mod.RegistrationForm,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        className="mx-auto flex w-full max-w-2xl flex-col gap-4 py-2"
        aria-busy="true"
        aria-label="Memuat formulir pendaftaran"
      >
        <div className="h-7 w-2/3 animate-pulse rounded-md bg-muted" />
        <div className="h-40 animate-pulse rounded-lg border bg-card" />
        <div className="h-56 animate-pulse rounded-lg border bg-card" />
      </div>
    ),
  },
);

type Props = {
  event: SerializedEventForRegistration;
};

export function RegistrationFormClientOnly({ event }: Props) {
  return <RegistrationForm event={event} />;
}
