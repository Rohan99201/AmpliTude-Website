# Harra Roastery – Amplitude via Tealium iQ demo

A static storefront that fires every data layer call from the implementation guide.

## Run it
Serve the folder over http (opening the files directly with file:// breaks cookies):

    npx serve .          # or: python3 -m http.server 8080

Open the site and click **Data layer** (bottom right) to watch `utag_data`, `utag.link` calls and the Amplitude events the tag sends.

## Two modes
- **Simulation (default):** `assets/config.js` has no Tealium account. The page runs `tealium/amplitude-custom-container.js`, the exact code you paste into Tealium, with a small `utag` stand-in. Events go to the Amplitude EU project.
- **Live Tealium:** fill `tealium.account`, `tealium.profile` and `tealium.env` in `assets/config.js`. The page loads your real `utag.js` and the Custom Container tag in your profile does the work.

## Files
- `tealium/amplitude-custom-container.js` – paste into a Tealium Custom Container tag (see the comment at the top)
- `assets/datalayer.js` – builds `utag_data` per page, `dlTrack()` helper, loader
- `assets/site.js` – storefront UI; every tracked action calls `dlTrack()` after it succeeds
- `datalayer-variables.csv` – variable list for Tealium's Data Layer tab
- **Reset demo** in the inspector clears cart, login and the purchase de-dup list.

Try: search "ethiopia", add two coffees, remove one, check out with WELCOME10, refresh the confirmation page (no second purchase), log in, subscribe, log out.
