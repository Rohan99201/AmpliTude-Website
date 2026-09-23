/* =====================================================================
   Data layer for Tealium iQ
   1. Builds window.utag_data for the current page BEFORE utag.js loads.
   2. window.dlTrack(tealium_event, data) -> utag.link with page context.
   3. Loads the real utag.js, or (no account configured) simulates Tealium
      by running tealium/amplitude-custom-container.js locally.
   ===================================================================== */
(function () {
  var cfg = window.SITE_CONFIG, site = cfg.site;
  var params = new URLSearchParams(location.search);
  var page = document.documentElement.getAttribute("data-page");

  /* ---------- debug log for the on-page inspector ---------- */
  window.__dlLog = [];
  function log(kind, title, data) {
    var entry = { kind: kind, title: title, data: data, time: new Date() };
    window.__dlLog.push(entry);
    try { window.dispatchEvent(new CustomEvent("dl-log", { detail: entry })); } catch (e) {}
  }
  window.dlLog = log;
  window.addEventListener("amplitude-tealium", function (e) {
    log("amplitude", e.detail.kind + ": " + e.detail.name, e.detail.data);
  });

  /* ---------- helpers ---------- */
  function productArrays(lines) {
    var out = { product_id: [], product_name: [], product_category: [], product_brand: [], product_variant: [], product_unit_price: [], product_quantity: [] };
    lines.forEach(function (l) {
      var p = Store.product(l.id); if (!p) return;
      out.product_id.push(p.id); out.product_name.push(p.name); out.product_category.push(p.category);
      out.product_brand.push(p.brand); out.product_variant.push(l.variant); out.product_unit_price.push(p.price);
      out.product_quantity.push(l.qty);
    });
    return out;
  }
  window.productArrays = productArrays;
  function assign(t, s) { for (var k in s) t[k] = s[k]; return t; }

  /* ---------- 1. page-level data layer ---------- */
  var customer = Store.customer();
  var d = {
    tealium_event: "page_view",
    site_section: "coffee",
    site_language: site.language,
    site_country: site.country,
    site_currency: site.currency,
    site_environment: site.environment,
    customer_login_status: customer ? "logged_in" : "guest",
    customer_type: Store.hasOrdered() ? "returning" : "new"
  };
  if (customer) d.customer_id = customer.id;

  if (page === "index") {
    var q = (params.get("q") || "").trim().toLowerCase();
    var cat = params.get("category");
    if (q) {
      var results = CATALOG.filter(function (p) { return (p.name + " " + p.notes + " " + p.origin + " " + p.category).toLowerCase().indexOf(q) > -1; });
      assign(d, { tealium_event: "search", page_type: "search", page_name: "search", search_keyword: q, search_results: results.length });
    } else if (cat) {
      var catName = cat.replace(/-/g, " ");
      assign(d, { tealium_event: "category_view", page_type: "category", page_name: "category:" + cat, category_name: catName, site_section: catName === "brewing gear" ? "gear" : "coffee" });
    } else {
      assign(d, { page_type: "home", page_name: "home" });
    }
  } else if (page === "product") {
    var p = Store.product(params.get("id") || "") || CATALOG[0];
    assign(d, { tealium_event: "product_view", page_type: "product", page_name: "product:" + p.slug, category_name: p.category, site_section: p.gear ? "gear" : "coffee" });
    assign(d, productArrays([{ id: p.id, variant: Store.variantFor(p), qty: 1 }]));
  } else if (page === "cart") {
    var cart = Store.cart(), t = Store.cartTotals(cart);
    assign(d, { page_type: "cart", page_name: "cart", cart_total_items: t.items, cart_total_value: t.value });
    if (cart.length) assign(d, productArrays(cart));
  } else if (page === "checkout") {
    var cc = Store.cart(), ct = Store.cartTotals(cc);
    assign(d, { page_type: "checkout", page_name: "checkout:details", checkout_step: 1, cart_total_items: ct.items, cart_total_value: ct.value });
    if (cc.length) assign(d, productArrays(cc));
  } else if (page === "confirmation") {
    assign(d, { page_type: "order_confirmation", page_name: "order_confirmation" });
    var order = Store.pendingOrder();
    if (order && !order.tracked) {
      // First render only: a refresh sends a plain page_view, so the purchase is never counted twice.
      assign(d, {
        tealium_event: "purchase",
        order_id: order.id, order_subtotal: order.subtotal, order_shipping: order.shipping, order_tax: order.tax,
        order_discount: order.discount, order_total: order.total, order_currency: site.currency, order_payment_type: order.payment
      });
      if (order.coupon) d.order_coupon_code = order.coupon;
      assign(d, productArrays(order.lines));
      order.tracked = true; Store.savePendingOrder(order);
    }
  } else if (page === "account") {
    assign(d, { page_type: "account", page_name: customer ? "account:overview" : "account:login" });
  }
  window.utag_data = d;

  /* ---------- 2. event helper ---------- */
  window.dlTrack = function (tealiumEvent, data) {
    var ctx = window.utag_data || {};
    var payload = {
      tealium_event: tealiumEvent,
      page_type: ctx.page_type, page_name: ctx.page_name,
      site_language: ctx.site_language, site_country: ctx.site_country, site_currency: ctx.site_currency,
      customer_login_status: ctx.customer_login_status
    };
    if (ctx.customer_id) payload.customer_id = ctx.customer_id;
    assign(payload, data || {});
    if (window.utag && typeof window.utag.link === "function") { log("link", "utag.link: " + tealiumEvent, payload); window.utag.link(payload); }
    else { log("link", "queued: " + tealiumEvent, payload); (window.__dlQueue = window.__dlQueue || []).push(payload); }
  };
  window.dlFlush = function () {
    var q = window.__dlQueue || [];
    while (q.length) { var p = q.shift(); log("link", "utag.link: " + p.tealium_event, p); window.utag.link(p); }
  };

  /* ---------- 3. Tealium loader, or local simulation ---------- */
  function inject(src, onload) {
    var s = document.createElement("script"); s.src = src; s.async = true; s.onload = onload;
    var first = document.getElementsByTagName("script")[0]; first.parentNode.insertBefore(s, first);
  }
  var tl = cfg.tealium;
  if (tl.account && tl.profile) {
    window.__dlMode = "live";
    var url = "https://tags.tiqcdn.com/utag/" + tl.account + "/" + tl.profile + "/" + tl.env + "/utag.js";
    window.__dlSource = url;
    log("view", "utag_data (page load)", d);
    inject(url, function () { window.dlFlush(); });
  } else {
    window.__dlMode = "simulation";
    window.__dlSource = "tealium/amplitude-custom-container.js";
    var base = document.currentScript && document.currentScript.src ? document.currentScript.src.replace(/assets\/datalayer\.js.*$/, "") : "";
    inject(base + "tealium/amplitude-custom-container.js", function () {
      // Minimal stand-in for utag.js: same (a, b) contract the Custom Container receives.
      window.utag = {
        data: window.utag_data,
        view: function (data) { var b = assign({ "ut.env": tl.env }, data); window.ampTealiumSend("view", b); },
        link: function (data) { var b = assign({ "ut.env": tl.env }, data); window.ampTealiumSend("link", b); }
      };
      log("view", "utag.view (page load)", d);
      window.utag.view(window.utag_data);
      window.dlFlush();
    });
  }
})();
