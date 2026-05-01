import Link from "next/link";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function CommitteeSettingsPlaceholder(props: {
  title: string;
  description: string;
  phaseNote: string;
}) {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        <Link href="/admin/settings" className="underline underline-offset-4">
          Pengaturan
        </Link>
        {" / "}
        <span>{props.title}</span>
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">{props.title}</h1>
      <p className="text-muted-foreground text-sm leading-relaxed">{props.description}</p>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Menyusul</CardTitle>
          <CardDescription>{props.phaseNote}</CardDescription>
        </CardHeader>
        <div className="border-t px-6 py-8">
          <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            Modul ini menyusul — belum ada penyimpanan data pada fase ini.
          </div>
        </div>
      </Card>
    </div>
  );
}
