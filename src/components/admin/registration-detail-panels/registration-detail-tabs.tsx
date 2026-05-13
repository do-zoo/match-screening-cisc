import type { ReactNode } from "react";

import { useRouter } from "next/navigation";

import type { RegistrationDetailTab } from "@/lib/admin/event-registration-detail-tab";
import { buildRegistrationDetailPath } from "@/lib/admin/event-registration-detail-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

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
      className="gap-0"
    >
      <div
        className={cn(
          "sticky z-10 -mx-6 border-b border-border/60 bg-background/95 px-6 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80",
          "top-0",
        )}
      >
        <TabsList
          variant="line"
          className="h-auto w-full min-w-0 flex-nowrap justify-start gap-1 overflow-x-auto bg-transparent p-0"
        >
          <TabsTrigger value="ringkasan">Ringkasan</TabsTrigger>
          <TabsTrigger value="verifikasi">Verifikasi & Komunikasi</TabsTrigger>
          <TabsTrigger value="operasi" className="relative pr-3">
            Operasi
            {showOperasiBadge ? (
              <span
                className="absolute right-0.5 top-0.5 size-2 rounded-full bg-destructive"
                aria-hidden
              />
            ) : null}
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="ringkasan" className="mt-4 w-full max-w-3xl self-center">
        {panels.ringkasan}
      </TabsContent>
      <TabsContent value="verifikasi" className="mt-4 w-full max-w-3xl self-center">
        {panels.verifikasi}
      </TabsContent>
      <TabsContent value="operasi" className="mt-4 w-full max-w-3xl self-center">
        {panels.operasi}
      </TabsContent>
    </Tabs>
  );
}
