// Thin GA4 event wrapper. `window.gtag` only exists after the visitor accepts
// analytics (see Analytics.tsx) and never on localhost, so every call here is a
// no-op until consent is granted — no extra guarding needed at call sites.
//
// These are the conversion signals the CRO audit found missing: GA4 had zero
// custom/key events, so installs and GitHub hand-offs were unmeasurable. Mark
// `copy_install_command` and `click_github` as key events in the GA4 UI to turn
// them into conversions.

type Params = Record<string, string | number | boolean>;

declare global {
  interface Window {
    gtag?: (command: string, eventName: string, params?: Params) => void;
  }
}

export function track(event: string, params?: Params): void {
  if (typeof window === "undefined") return;
  window.gtag?.("event", event, params);
}
