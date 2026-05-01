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
      isPengurus: false;
    }
  | {
      status: "ready";
      forTrim: string;
      found: true;
      isPengurus: boolean;
      seatForEvent: "available" | "taken";
    };
