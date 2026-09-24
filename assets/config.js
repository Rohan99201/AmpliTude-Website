/* Demo configuration.
   Leave tealium.account empty to run in SIMULATION mode: the exact Custom Container tag code
   (tealium/amplitude-custom-container.js) runs locally, so events still reach Amplitude.
   Fill account/profile/env to load your real Tealium iQ profile instead. */
window.SITE_CONFIG = {
  tealium: { account: "nabler-sandbox", profile: "rohan.c", env: "prod" },
  site: { language: "en", country: "AE", currency: "AED", environment: "prod" }
};
