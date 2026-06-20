import { FirebaseError } from "firebase/app";

const EXPECTED_AUTH_CODES = new Set([
  "auth/invalid-email",
  "auth/user-disabled",
  "auth/user-not-found",
  "auth/wrong-password",
  "auth/invalid-credential",
  "auth/network-request-failed",
  "auth/too-many-requests"
]);

export function isExpectedAuthError(err: unknown): boolean {
  return err instanceof FirebaseError && EXPECTED_AUTH_CODES.has(err.code);
}

export function friendlyAuthMessage(err: unknown): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case "auth/invalid-email":
        return "Invalid email";
      case "auth/user-disabled":
        return "This account has been disabled.";
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "Invalid email or password";
      case "auth/network-request-failed":
        return "Unable to connect. Please try again.";
      case "auth/too-many-requests":
        return "Too many attempts. Please wait and try again.";
      default:
        return err.message || "Sign-in failed.";
    }
  }
  if (err instanceof Error) return err.message;
  return "Login failed.";
}
