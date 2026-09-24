/** Linked from the paywall and Settings. Keep in sync with App Store Connect metadata. */
export const LEGAL_URLS = {
  privacyPolicy: 'https://scratch-legal.vercel.app/privacy',
  /** Apple's standard EULA; swap only if a custom EULA is set in App Store Connect. */
  termsOfUse: 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/',
} as const;
