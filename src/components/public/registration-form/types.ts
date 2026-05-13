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

export type ManagementCodeGateState =
  | { status: "empty" }
  | { status: "checking"; forTrim: string }
  | {
      status: "ready";
      forTrim: string;
      found: true;
      fullName: string;
    }
  | {
      status: "ready";
      forTrim: string;
      found: false;
      reason: "not_found" | "not_assigned";
    };

/** Validasi async nomor member opsional pada tiket partner (selaras pola gate identitas utama). */
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
