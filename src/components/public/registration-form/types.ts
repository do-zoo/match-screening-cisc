import type { SerializedEventForRegistration } from "@/components/public/event-serialization";

export type RegistrationFormProps = {
  event: SerializedEventForRegistration;
};

export type PartnerGateState =
  | { status: "empty" }
  | { status: "checking"; forTrim: string }
  | {
      status: "ready";
      forTrim: string;
      found: false;
      isManagementMember: false;
    }
  | {
      status: "ready";
      forTrim: string;
      found: true;
      isManagementMember: boolean;
      seatForEvent: "available" | "taken";
    };

/** Validasi async nomor member opsional pada tiket partner (selaras pola `usePartnerGate`). */
export type PartnerMemberNumberGateState =
  | { status: "empty" }
  | { status: "checking"; forTrim: string }
  | {
      status: "ready";
      forTrim: string;
      found: false;
    }
  | {
      status: "ready";
      forTrim: string;
      found: true;
      seatForEvent: "available" | "taken";
    };
