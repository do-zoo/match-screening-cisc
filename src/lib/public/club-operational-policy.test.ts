import { describe, expect, it } from "vitest";

import {
  DEFAULT_GLOBAL_REGISTRATION_CLOSED,
  effectiveMaintenanceBanner,
  mergeGlobalRegistrationClosure,
} from "./club-operational-policy";

describe("mergeGlobalRegistrationClosure", () => {
  it("meneruskan event terbuka bila penutupan global tidak aktif", () => {
    expect(
      mergeGlobalRegistrationClosure({
        registrationOpen: true,
        registrationClosedMessage: null,
        registrationGloballyDisabled: false,
        globalRegistrationClosedMessage: null,
      }),
    ).toEqual({ registrationOpen: true, registrationClosedMessage: null });
  });

  it("memaksa tutup ketika penutupan global aktif walau event terbuka", () => {
    expect(
      mergeGlobalRegistrationClosure({
        registrationOpen: true,
        registrationClosedMessage: null,
        registrationGloballyDisabled: true,
        globalRegistrationClosedMessage: "Libur kolektif.",
      }),
    ).toEqual({
      registrationOpen: false,
      registrationClosedMessage: "Libur kolektif.",
    });
  });

  it("memakai salinan DEFAULT jika pesan global kosong tetapi penutupan aktif", () => {
    expect(
      mergeGlobalRegistrationClosure({
        registrationOpen: true,
        registrationClosedMessage: null,
        registrationGloballyDisabled: true,
        globalRegistrationClosedMessage: "   ",
      }).registrationClosedMessage,
    ).toBe(DEFAULT_GLOBAL_REGISTRATION_CLOSED);
  });

  it("tetap menutup bila event sudah tertutup sebelumnya", () => {
    expect(
      mergeGlobalRegistrationClosure({
        registrationOpen: false,
        registrationClosedMessage: "Kuota habis.",
        registrationGloballyDisabled: true,
        globalRegistrationClosedMessage: null,
      }),
    ).toEqual({
      registrationOpen: false,
      registrationClosedMessage: DEFAULT_GLOBAL_REGISTRATION_CLOSED,
    });
  });
});

describe("effectiveMaintenanceBanner", () => {
  it("menghasilkan null untuk null atau hanya whitespace", () => {
    expect(effectiveMaintenanceBanner(null)).toBeNull();
    expect(effectiveMaintenanceBanner("  ")).toBeNull();
  });

  it("mempertahankan teks tidak kosong ter-trim", () => {
    expect(effectiveMaintenanceBanner("  Peringatan tes  ")).toBe("Peringatan tes");
  });
});
