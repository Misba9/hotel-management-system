import type { RecaptchaVerifier } from "firebase/auth";

declare global {
  interface Window {
    /** Single phone-auth RecaptchaVerifier instance (invisible) — see `getOrCreatePhoneRecaptchaVerifier`. */
    recaptchaVerifier?: RecaptchaVerifier | null;
    /** Matches the DOM element id used to construct `recaptchaVerifier`. */
    __phoneRecaptchaContainerId?: string;
    /** Guards concurrent/verifier duplicate `.render()` attempts. */
    __phoneRecaptchaRenderPromise?: Promise<number>;
  }
}

export {};
