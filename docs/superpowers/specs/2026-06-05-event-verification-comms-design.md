# Verifikasi peserta: keputusan + komunikasi terpadu

**Tanggal:** 2026-06-05  
**Status:** Approved (brainstorming)  
**Lingkup:** Tab **Verifikasi & Komunikasi** dan alur notifikasi pasca-aksi di tab **Operasi** pada halaman detail registrasi (`/admin/events/[eventId]/registrants/[registrationId]`).

## Latar belakang

Hari ini tab Verifikasi memisahkan **Keputusan verifikasi** (Approve / Reject / Payment issue) dari **Komunikasi (WhatsApp)** (chip `wa.me` di bawah). Admin harus mengubah status lalu scroll untuk mengirim pesan yang sesuai. Chip sudah difilter menurut status, tetapi tidak terhubung dengan aksi keputusan.

Verifier ingin satu alur: setelah keputusan tersimpan, opsi mengirim WhatsApp lewat dialog (preview + Buka WA / Lewati). Komunikasi operasional lain (tagihan kekurangan) tetap di tab Operasi dengan email dulu, lalu reminder WA.

## Keputusan produk (ringkas)

| Topik | Keputusan |
| ----- | --------- |
| Timing dialog WA (keputusan verifikasi) | **Setelah** server action sukses |
| Section Komunikasi terpisah | **Dihapus** — WA status-aware masuk blok Keputusan |
| Penerimaan pendaftaran (`receipt`) | **Dihapus sementara** (belum ada template email; WA system belum dipakai) |
| Tagihan kekurangan | **Hanya tab Operasi**: kirim email → dialog WA reminder |
| Kirim WA otomatis (API) | **Non-goal** — tetap `wa.me` manual |

## Tujuan

1. Menggabungkan keputusan verifikasi dengan opsi notifikasi WA yang **sesuai status/aksi**.
2. Dialog seragam: pratinjau pesan, **Buka WhatsApp**, **Lewati** — admin boleh tidak mengirim.
3. Pola yang sama untuk follow-up di Operasi (email tagihan, cancel, refund).
4. Tidak mengubah aturan transisi status di server (`verify-registration.ts`, `cancel-refund.ts`).

## Non-goal

- Template email **penerimaan pendaftaran** dan tombol kirim penerimaan di admin.
- Pengiriman WhatsApp via API / WA Business / logging pengiriman WA.
- Mengubah `ALLOWED_TRANSITION_STATUSES` atau menambah transisi baru (mis. approve dari `payment_issue`).
- Memindahkan panel Kehadiran / penyesuaian invoice ke tab Verifikasi.

---

## Arsitektur informasi

### Tab Verifikasi & Komunikasi

Satu `Card`, **dua** section (bukan tiga):

1. **Keputusan verifikasi** — status, aksi ubah status, komunikasi WA status-aware (tanpa heading “Komunikasi” terpisah).
2. **Bukti pendukung** — tidak berubah (`EvidenceSection`).

`CommunicationSection` dihapus; logika chip dipindah ke blok keputusan + dialog.

### Tab Operasi

- **Penyesuaian invoice** — setelah **Kirim invoice via email** sukses → dialog WA reminder (ringkasan “cek email”).
- **Batalkan / refund** — setelah cancel/refund sukses → dialog WA `cancelled` / `refunded` (sama pola dialog).

Chip WA tagihan kekurangan **tidak** lagi di tab Verifikasi.

---

## Alur: keputusan verifikasi

### Langkah

1. Admin memakai UI yang ada: Approve langsung; Reject / Payment issue → isi alasan → konfirmasi.
2. Server action (`approveRegistration` / `rejectRegistration` / `markPaymentIssue`) sukses → toast CUD seperti sekarang.
3. Client membuka **`RegistrationNotifyDialog`** dengan `kind` yang sesuai aksi.
4. Dialog menampilkan:
   - Judul kontekstual (Bahasa Indonesia), mis. “Pendaftaran disetujui”
   - Pratinjau pesan **read-only** (textarea atau `pre` dengan `whitespace-pre-wrap`)
   - **Buka WhatsApp** → `waMeLink(contactWhatsapp, message)` di tab baru
   - **Lewati** → tutup dialog; tidak ada side effect tambahan

Dialog dibuka dari state klien setelah `result.ok` (tidak menunggu navigasi RSC), agar tidak hilang saat `revalidatePath`.

### Status terminal & kirim ulang

Untuk `approved`, `rejected`, `payment_issue`, `cancelled`, `refunded` (bila relevan di Verifikasi):

- Tetap ringkasan + **Ubah keputusan** seperti sekarang.
- Tambah tombol sekunder **Kirim ulang notifikasi** (hanya membuka dialog WA, **tanpa** server mutation).
- Tampilkan hanya jika pesan dapat di-render (mis. `rejected` / `payment_issue` butuh alasan terisi).

Setelah **Ubah keputusan** dan simpan ulang → dialog WA sesuai status **baru** (pola pasca-simpan sama).

### Matriks `kind` ↔ template WA

| `NotifyKind` | Pemicu | `WaTemplateKey` / render |
| ------------ | ------ | -------------------------- |
| `approved` | Approve sukses; kirim ulang saat `approved` | `approved` |
| `rejected` | Reject sukses; kirim ulang saat `rejected` + alasan | `rejected` |
| `payment_issue` | Payment issue sukses; kirim ulang | `payment_issue` |

`receipt`, `underpayment_invoice` (full), `cancelled`, `refunded` **tidak** ditawarkan di blok Keputusan v1 (kecuali kirim ulang tidak berlaku untuk cancelled/refund — aksi hanya di Operasi).

---

## Alur: Operasi

### Tagihan kekurangan (email + reminder WA)

1. Admin menekan **Kirim invoice via email** (`sendInvoiceEmailToRegistration`) di panel penyesuaian — perilaku server tidak berubah.
2. Jika sukses → toast + buka dialog WA **reminder**:
   - Pesan ringkas: nama pendaftar/acara, nominal kekurangan, instruksi cek email (bukan salinan penuh body email).
   - v1: string terstruktur di kode **atau** template WA baru `email_reminder` (keputusan di implementation plan; jika template baru, tambah ke enum + panel template Owner).
3. Jika email gagal → tidak buka dialog WA.
4. Beberapa adjustment `unpaid`: satu dialog per kirim email sukses (adjustment yang dikirim).

### Batalkan / refund

Setelah `cancelRegistration` / `refundRegistration` sukses (dialog konfirmasi yang ada tetap):

- Buka `RegistrationNotifyDialog` dengan `kind` `cancelled` / `refunded`.
- Preview dari `renderCancelledMessage` / `renderRefundedMessage`.

---

## Komponen & modul

### UI baru / diubah

| Komponen | Tanggung jawab |
| -------- | -------------- |
| `RegistrationNotifyDialog` | Dialog terkontrol: title, preview, href, disabled WA, Lewati / Buka WA |
| `DecisionSection` | Sematkan dialog + tombol kirim ulang; terima `waBodies` + `registration` |
| `RegistrationActions` | Prop `onNotifyRequest(kind, ctx?)` dipanggil setelah `ok` |
| `verification-tab.tsx` | Hapus `CommunicationSection`; pass props ke `DecisionSection` |
| `SendInvoiceEmailButton` | Prop opsional `onSuccess` → parent buka dialog reminder |
| `CancelRefundPanel` | Setelah sukses → `onNotifyRequest` |

### Library

| Modul | Tanggung jawab |
| ----- | -------------- |
| `lib/wa-templates/build-registration-notify.ts` | `buildRegistrationWaNotify({ kind, registration, waBodies, reason? })` → `{ titleId, preview, href, canOpen }` |

Satu sumber untuk preview dan `href` (hindari duplikasi dengan `communication-section.tsx` yang dihapus).

### Pola Dialog

Ikuti `@base-ui/react` Dialog proyek: `render` pada trigger; `disabled` pada `DialogTrigger` bila `isPending`.

---

## Perilaku edge case

| Kasus | Perilaku |
| ----- | -------- |
| Nomor WA kosong / tidak valid | Dialog tampil; **Buka WhatsApp** disabled; teks penjelasan |
| Reject tanpa alasan di DB | Tombol kirim ulang `rejected` disembunyikan |
| `contactEmail` kosong | Tombol kirim email tagihan tetap tidak eligible (logika existing) |
| User menutup dialog dengan overlay / Esc | Sama dengan **Lewati** |
| Server action gagal | Tidak buka dialog notifikasi |

---

## Pengujian

- Unit: `buildRegistrationWaNotify` untuk tiap `kind` (placeholder terisi, href non-empty bila `canOpen`).
- Unit: reminder underpayment — ringkasan memuat nominal & judul acara.
- Komponen (opsional): `RegistrationNotifyDialog` — Lewati menutup; Buka WA memakai `href` yang diharapkan.

Tidak wajib E2E browser di v1.

---

## Dokumentasi

Saat implementasi, perbarui `CLAUDE.md`:

- Tab Verifikasi: keputusan + dialog WA pasca-simpan; hapus referensi section Komunikasi terpisah.
- Tab Operasi: email tagihan → dialog reminder WA; cancel/refund → dialog WA.
- Modul `build-registration-notify.ts` di Key library modules.

---

## Rencana implementasi

Setelah spec ini disetujui untuk coding, gunakan skill **writing-plans** → `docs/superpowers/plans/2026-06-05-event-verification-comms-implementation.md`.
