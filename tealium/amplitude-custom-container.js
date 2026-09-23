/* =====================================================================
   Amplitude Unified (Analytics + Session Replay) for Tealium iQ
   ---------------------------------------------------------------------
   WHERE TO PASTE
   Tealium iQ > Tags > + Add Tag > "Tealium Custom Container".
   Edit the template and paste this whole block inside u.send(a, b),
   between "Start Tag Scripting Code" and "End Tag Scripting Code".
   Also make sure the template has:  u.ev = {"view": 1, "link": 1};

   Inside Tealium, a = "view" | "link" and b = the Tealium data layer.
   The same file runs in the demo site's simulation mode.
   ===================================================================== */
var ampTealiumSend = window.ampTealiumSend = window.ampTealiumSend || (function () {

  // Amplitude ingestion keys per Tealium environment (b["ut.env"]) — public by design.
  // Point dev/qa at a separate Amplitude project when you have one.
  var API_KEYS = {
    prod: "8c41a708ec03281edaf9a34d0580f027",
    qa: "8c41a708ec03281edaf9a34d0580f027",
    dev: "8c41a708ec03281edaf9a34d0580f027"
  };

  // Official @amplitude/unified browser bundle, pinned. Bump deliberately after testing.
  var SDK_URL = "https://cdn.jsdelivr.net/npm/@amplitude/unified@1.1.35/lib/scripts/amplitude-min.umd.js";

  var state = { status: "idle", queue: [], initPromise: null }; // idle | loading | ready | failed

  /* ---------- helpers ---------- */
  function debug(kind, name, detail) {
    try { if (window.utag && typeof window.utag.DB === "function") window.utag.DB("[Amplitude] " + kind + " " + name); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent("amplitude-tealium", { detail: { kind: kind, name: name, data: detail } })); } catch (e) {}
  }
  function arr(v) { return v === undefined || v === null || v === "" ? [] : (Object.prototype.toString.call(v) === "[object Array]" ? v : [v]); }
  function num(v) { var n = typeof v === "number" ? v : parseFloat(v); return isNaN(n) ? undefined : n; }
  function clean(o) { var r = {}; for (var k in o) { if (o[k] !== undefined && o[k] !== null && o[k] !== "") r[k] = o[k]; } return r; }

  function products(b) {
    var ids = arr(b.product_id), out = [];
    for (var i = 0; i < ids.length; i++) {
      out.push(clean({
        product_id: String(ids[i]),
        product_name: arr(b.product_name)[i],
        product_category: arr(b.product_category)[i],
        product_brand: arr(b.product_brand)[i],
        product_variant: arr(b.product_variant)[i],
        price: num(arr(b.product_unit_price)[i]),
        quantity: num(arr(b.product_quantity)[i])
      }));
    }
    return out;
  }
  function context(b) {
    return clean({
      page_type: b.page_type,
      page_name: b.page_name,
      site_language: b.site_language,
      site_country: b.site_country,
      currency: b.order_currency || b.site_currency
    });
  }
  function cartProps(b) {
    return clean({ products: products(b), cart_total_items: num(b.cart_total_items), cart_total_value: num(b.cart_total_value) });
  }

  /* ---------- tealium_event -> Amplitude event ---------- */
  var EVENTS = {
    product_view: { name: "Viewed Product", props: function (b) { return clean({ products: products(b), category_name: b.category_name }); } },
    cart_add: { name: "Added to Cart", props: cartProps },
    cart_remove: { name: "Removed from Cart", props: cartProps },
    checkout: { name: "Started Checkout", props: function (b) { var p = cartProps(b); p.checkout_step = num(b.checkout_step); return clean(p); } },
    purchase: {
      name: "Completed Purchase",
      props: function (b) {
        var p = products(b), items = 0;
        for (var i = 0; i < p.length; i++) items += p[i].quantity || 0;
        return clean({
          order_id: b.order_id, order_subtotal: num(b.order_subtotal), order_shipping: num(b.order_shipping),
          order_tax: num(b.order_tax), order_discount: num(b.order_discount), order_total: num(b.order_total),
          order_payment_type: b.order_payment_type, order_coupon_code: b.order_coupon_code,
          item_count: items, products: p
        });
      },
      options: function (b) { var r = num(b.order_total); return r === undefined ? undefined : { revenue: r, revenueType: "purchase" }; }
    },
    search: { name: "Searched", props: function (b) { return clean({ search_keyword: b.search_keyword, search_results: num(b.search_results) }); } },
    user_register: { name: "Signed Up", props: function (b) { return clean({ auth_method: b.auth_method }); } },
    user_login: { name: "Logged In", props: function (b) { return clean({ auth_method: b.auth_method }); } },
    email_signup: { name: "Subscribed to Newsletter", props: function (b) { return clean({ signup_location: b.signup_location }); } }
  };

  /* ---------- purchase de-duplication (refresh / back button) ---------- */
  function seenOrder(id) {
    try {
      var list = JSON.parse(localStorage.getItem("amp_tealium_orders") || "[]");
      if (list.indexOf(id) > -1) return true;
      list.push(id);
      localStorage.setItem("amp_tealium_orders", JSON.stringify(list.slice(-20)));
    } catch (e) {}
    return false;
  }

  /* ---------- identity ---------- */
  function syncIdentity(amp, b, isView) {
    if (b.customer_id && amp.getUserId() !== String(b.customer_id)) amp.setUserId(String(b.customer_id));
    if (!isView) return;
    var keys = ["customer_login_status", "customer_type", "site_language", "site_country"], vals = {}, sig = "";
    for (var i = 0; i < keys.length; i++) { if (b[keys[i]]) { vals[keys[i]] = b[keys[i]]; sig += keys[i] + "=" + b[keys[i]] + ";"; } }
    if (!sig) return;
    try { if (sessionStorage.getItem("amp_tealium_identify") === sig) return; sessionStorage.setItem("amp_tealium_identify", sig); } catch (e) {}
    var id = new amp.Identify();
    for (var k in vals) id.set(k, vals[k]);
    amp.identify(id);
    debug("identify", "user properties", vals);
  }

  /* ---------- loading and init (once per page) ---------- */
  function start(key) {
    var amp = window.amplitude;
    if (!amp || typeof amp.initAll !== "function") { state.status = "failed"; console.warn("[Amplitude] SDK loaded but initAll is missing."); return; }
    if (!window.__ampTealiumInit) {
      window.__ampTealiumInit = true;
      state.initPromise = amp.initAll(key, {"serverZone":"EU","analytics":{"autocapture":true},"sessionReplay":{"sampleRate":1}});
      debug("init", "initAll", { serverZone: "EU" });
    }
    state.status = "ready";
    var q = state.queue; state.queue = [];
    for (var i = 0; i < q.length; i++) { try { q[i](amp); } catch (e) { console.warn("[Amplitude]", e); } }
  }
  function ensureLoaded(b) {
    if (state.status !== "idle") return;
    var key = API_KEYS[b["ut.env"]] || API_KEYS.prod;
    if (!key) { console.warn("Amplitude API key missing — analytics disabled"); state.status = "failed"; return; }
    if (window.amplitude && typeof window.amplitude.initAll !== "function") {
      console.warn("[Amplitude] Another Amplitude install owns window.amplitude — Tealium tag skipped to avoid double tracking.");
      state.status = "failed"; return;
    }
    if (window.amplitude) { start(key); return; }
    state.status = "loading";
    var s = document.createElement("script");
    s.src = SDK_URL; s.async = true;
    s.onload = function () { start(key); };
    s.onerror = function () { state.status = "failed"; state.queue = []; console.warn("[Amplitude] Could not load " + SDK_URL); };
    (document.head || document.getElementsByTagName("head")[0]).appendChild(s);
  }
  function withAmplitude(fn) {
    if (state.status === "ready") fn(window.amplitude);
    else if (state.status === "loading") state.queue.push(fn);
  }
  function track(amp, name, props, options) {
    if (options) amp.track(name, props, options); else amp.track(name, props);
    debug("track", name, options ? { event_properties: props, event_options: options } : props);
  }

  /* ---------- entry point: called for every utag.view / utag.link ---------- */
  return function (a, b) {
    b = b || {};
    ensureLoaded(b);
    withAmplitude(function (amp) {
      var ev = b.tealium_event;
      if (ev === "user_logout") {
        // Flush first so events already queued keep the logged-in user ID, then start a fresh anonymous identity.
        var done = function () { amp.reset(); debug("reset", "user_logout", {}); };
        try {
          Promise.resolve(state.initPromise)
            .then(function () { return amp.flush().promise; })
            .then(done, done);
        } catch (e) { done(); }
        return;
      }
      syncIdentity(amp, b, a === "view");

      if (a === "view" && b.page_type === "home") {
        amp.track('Viewed Home Page', { prompt_version: 'BA400.4' }); // helps improve this setup flow — safe to remove once you've verified the event lands
        debug("track", "Viewed Home Page", { prompt_version: "BA400.4" });
      }

      var m = EVENTS[ev];
      if (!m) return;
      if (ev === "purchase" && b.order_id && seenOrder(String(b.order_id))) { debug("skip", "duplicate purchase " + b.order_id, {}); return; }
      var props = m.props(b), ctx = context(b);
      for (var k in ctx) { if (props[k] === undefined) props[k] = ctx[k]; }
      track(amp, m.name, props, m.options ? m.options(b) : undefined);
    });
  };
})();

// Runs inside Tealium's u.send(a, b). Outside Tealium (demo simulation) a/b are undefined and this is skipped.
if (typeof a !== "undefined" && typeof b !== "undefined") { ampTealiumSend(a, b); }
