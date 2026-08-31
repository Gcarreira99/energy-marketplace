import { BaseError } from "viem";

const USER_REJECTED_CODE = 4001;

function isUserRejection(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === USER_REJECTED_CODE;
}

/**
 * Turns a wagmi/viem write or connect error into a short, user-facing message.
 * Walks the viem BaseError cause chain to special-case a rejected wallet prompt,
 * otherwise falls back to viem's shortMessage or the raw error message.
 */
export function toFriendlyErrorMessage(error: unknown, maxLength = 160): string {
  if (!error) return "";

  if (error instanceof BaseError) {
    const rejection = error.walk((cause) => isUserRejection(cause));
    if (rejection) return "Request rejected in wallet.";

    const shortMessage = error.shortMessage;
    if (shortMessage) return shortMessage.slice(0, maxLength);
  }

  if (isUserRejection(error)) return "Request rejected in wallet.";

  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, maxLength);
}
