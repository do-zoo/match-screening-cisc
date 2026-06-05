# Modal komunikasi pendaftar: WA saja (hapus UI email otomatis)

**Tanggal:** 2026-06-05  
**Status:** Approved (brainstorming)  
**Lingkup:** `RegistrationCommsDialog` dan pemanggilnya di tab Verifikasi & Operasi.

## Latar belakang

`RegistrationCommsDialog` muncul setelah keputusan verifikasi (approve / reject / payment issue) atau operasi (cancel / refund / pengingat kekurangan). Modal ini menampilkan dua blok:

1. **WhatsApp** — pratinjau pesan + tombol Buka WhatsApp (inti alur).
2. **Email (otomatis)** — pratinjau subject/body, keterangan “dikirim otomatis ke …”, dan pesan fallback bila kontak email kosong.

Admin merasa blok email otomatis tidak perlu di modal. Email transaksional tetap dikirim di backend sesuai `ClubNotificationPreferences`; yang dihilangkan hanya UI informatif di dialog.

## Keputusan produk

| Topik | Keputusan |
| ----- | --------- |
| Blok email di modal | **Dihapus seluruhnya** (pratinjau + semua keterangan) |
| DialogDescription | Hanya menyebut WhatsApp; tidak menyebut email otomatis |
| Email otomatis di backend | **Tidak diubah** |
| `previewRegistrationCommsEmail` | **Dihapus** — tidak ada konsumen lain |
| Prop `contactEmail` di pemanggil | **Dihapus** |

## Perubahan UI

### `RegistrationCommsDialog`

**Dihapus:**

- Section label “Email (otomatis)” dan seluruh isinya (loading, error, subject, body preview).
- Teks fallback: “Email kontak kosong — tidak ada email otomatis.” dan “Email tagihan sudah dikirim dari panel penyesuaian…”
- State: `emailPreview`, `emailLoadError`, `previewPending`.
- `useEffect` yang memanggil `previewRegistrationCommsEmail`.
- Import `Loader2`, `previewRegistrationCommsEmail`, `useTransition` (jika tidak dipakai lagi).
- Prop `contactEmail`.

**Dipertahankan:**

- Judul (`wa.titleId`), pratinjau pesan WhatsApp, `wa.disabledReasonId`, tombol Lewati dan Buka WhatsApp.

**DialogDescription baru:**

> Kirim notifikasi ke pendaftar via WhatsApp. Pesan dapat diedit di aplikasi WhatsApp setelah dibuka.

### Pemanggil

- `decision-section.tsx` — hapus `contactEmail={contact.email}`.
- `operations-tab-client.tsx` — hapus `contactEmail={contact.email}`.

## Dead code cleanup

- Hapus file `src/lib/actions/admin-registration-lifecycle-email.ts` (satu-satunya export: `previewRegistrationCommsEmail`).
- Update `CLAUDE.md`:
  - Hapus baris modul `lib/actions/admin-registration-lifecycle-email.ts`.
  - Ubah deskripsi `registration-comms-dialog.tsx` dari “WA + pratinjau email otomatis” menjadi dialog WA saja.

## Non-goal

- Mengubah toggle email otomatis di Pengaturan → Notifikasi.
- Mengubah `maybeAutoSendRegistrationEmail` atau server actions verifikasi/operasi.
- Menambah pratinjau email di lokasi lain.

## Verifikasi manual

1. Tab Verifikasi: simpan approve/reject/payment issue → modal hanya menampilkan pratinjau WA, tanpa blok email.
2. Tab Operasi: cancel/refund / pengingat kekurangan → pola sama.
3. Email otomatis tetap terkirim bila pengaturan komite + kontak email memenuhi syarat (cek log / inbox uji).
