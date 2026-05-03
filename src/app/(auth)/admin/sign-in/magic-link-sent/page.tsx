import Link from "next/link";

export default async function MagicLinkSentPage({
  searchParams,
}: {
  searchParams?: Promise<{ email?: string | string[] }>;
}) {
  await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Cek email Anda</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Kami sudah mengirim link masuk ke email Anda. Link berlaku selama 5 menit.
      </p>
      <p className="mt-6 text-xs text-muted-foreground">
        Tidak menerima email? Periksa folder spam atau{" "}
        <Link href="/admin/sign-in" className="underline underline-offset-4 hover:text-foreground">
          kembali dan coba lagi
        </Link>
        .
      </p>
    </main>
  );
}
