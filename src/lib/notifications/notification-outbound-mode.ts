import type { NotificationOutboundMode } from "@prisma/client";

export type OutboundNotifyBehaviour = {
  shouldLogToConsole: boolean;
  shouldAttemptProviderSend: boolean;
};

export function resolveOutboundNotifyBehaviour(
  mode: NotificationOutboundMode,
): OutboundNotifyBehaviour {
  switch (mode) {
    case "off":
      return { shouldLogToConsole: false, shouldAttemptProviderSend: false };
    case "live":
      return { shouldLogToConsole: true, shouldAttemptProviderSend: true };
    case "log_only":
    default:
      return { shouldLogToConsole: true, shouldAttemptProviderSend: false };
  }
}
