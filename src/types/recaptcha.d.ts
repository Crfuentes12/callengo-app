// Type declarations for Google reCAPTCHA v3
interface ReCaptchaV3 {
  ready(callback: () => void): void;
  execute(siteKey: string, options: { action: string }): Promise<string>;
}

interface Window {
  grecaptcha: ReCaptchaV3;
}
