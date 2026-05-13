"use client";
import type { ReactNode } from "react";

import { useRouter } from "next/navigation";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { RegistrationDetailTab } from "@/lib/admin/event-registration-detail-tab";
import { buildRegistrationDetailPath } from "@/lib/admin/event-registration-detail-tab";

type Props = {
  eventId: string;
  registrationId: string;
  tab: RegistrationDetailTab;
  showOperasiBadge: boolean;
  panels: {
    ringkasan: ReactNode;
    verifikasi: ReactNode;
    operasi: ReactNode;
  };
};

export function RegistrationDetailTabs({
  eventId,
  registrationId,
  tab,
  showOperasiBadge,
  panels,
}: Props) {
  const router = useRouter();

  return (
    <Tabs
      value={tab}
      onValueChange={(next) => {
        router.replace(
          buildRegistrationDetailPath(
            eventId,
            registrationId,
            next as RegistrationDetailTab,
          ),
        );
      }}
      className="gap-0 w-full"
    >
      <TabsList className="sticky z-10 border-b border-border/60 bg-background/95  backdrop-blur supports-backdrop-filter:bg-background/80 top-0 w-full h-10! overflow-x-auto">
        <TabsTrigger value="ringkasan" className=" shrink-0">
          Ringkasan
        </TabsTrigger>
        <TabsTrigger value="verifikasi" className=" shrink-0">
          Verifikasi
        </TabsTrigger>
        <TabsTrigger value="operasi" className=" shrink-0">
          Operasi
          {showOperasiBadge ? (
            <span
              className="absolute right-0.5 top-0.5 size-2 rounded-full bg-destructive"
              aria-hidden
            />
          ) : null}
        </TabsTrigger>
      </TabsList>
      <TabsContent
        value="ringkasan"
        className="mt-4 w-full max-w-6xl self-center"
      >
        {panels.ringkasan}
      </TabsContent>
      <TabsContent
        value="verifikasi"
        className="mt-4 w-full max-w-6xl self-center"
      >
        {panels.verifikasi}
      </TabsContent>
      <TabsContent
        value="operasi"
        className="mt-4 w-full max-w-6xl self-center"
      >
        {panels.operasi}
      </TabsContent>
    </Tabs>
  );
}
