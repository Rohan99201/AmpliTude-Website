/* Demo configuration.
   Leave tealium.account empty to run in SIMULATION mode: the exact Custom Container tag code
   (tealium/amplitude-custom-container.js) runs locally, so events still reach Amplitude.
   Fill account/profile/env to load your real Tealium iQ profile instead. */
window.SITE_CONFIG = {
  tealium: { account: "", profile: "", env: "dev" },
  site: { language: "en", country: "AE", currency: "AED", environment: "dev" }
};
