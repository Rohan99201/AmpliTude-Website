/* Product catalog + tiny local store (cart, customer, orders). Demo only. */
window.CATALOG = [
  { id: "ETH-GUJI-250", slug: "ethiopia-guji", name: "Ethiopia Guji", category: "single origin", brand: "Harra Roastery", price: 68,
    origin: "Guji zone, Oromia", process: "Natural", altitude: "1,900–2,200 m", notes: "Blueberry, jasmine, cocoa nib" },
  { id: "YEM-HARAZ-250", slug: "yemen-haraz", name: "Yemen Haraz", category: "single origin", brand: "Harra Roastery", price: 120,
    origin: "Haraz mountains, Sana'a", process: "Dried in the cherry", altitude: "2,000–2,400 m", notes: "Dried fig, cardamom, raisin" },
  { id: "COL-HUILA-250", slug: "colombia-huila", name: "Colombia Huila", category: "single origin", brand: "Harra Roastery", price: 62,
    origin: "Pitalito, Huila", process: "Washed", altitude: "1,600–1,800 m", notes: "Red apple, panela, orange peel" },
  { id: "KEN-NYERI-250", slug: "kenya-nyeri", name: "Kenya Nyeri", category: "single origin", brand: "Harra Roastery", price: 74,
    origin: "Nyeri county", process: "Washed", altitude: "1,700–1,900 m", notes: "Blackcurrant, grapefruit, tomato leaf" },
  { id: "BLD-QAHWA-250", slug: "qahwa-house-blend", name: "Qahwa House Blend", category: "blends", brand: "Harra Roastery", price: 48,
    origin: "Ethiopia + Brazil", process: "Light roast, cardamom-friendly", altitude: "Blend", notes: "Honey, toasted almond, saffron" },
  { id: "BLD-SOUQ-250", slug: "souq-espresso", name: "Souq Espresso", category: "blends", brand: "Harra Roastery", price: 55,
    origin: "Brazil + Colombia", process: "Medium roast", altitude: "Blend", notes: "Dark chocolate, hazelnut, molasses" },
  { id: "GEAR-DRIP-01", slug: "ceramic-dripper", name: "Ceramic Dripper", category: "brewing gear", brand: "Harra Tools", price: 85,
    origin: "Glazed stoneware", process: "Cone, single hole", altitude: "1–2 cups", notes: "Holds heat, forgiving pour", gear: true },
  { id: "GEAR-GRIND-01", slug: "hand-grinder", name: "Hand Grinder", category: "brewing gear", brand: "Harra Tools", price: 320,
    origin: "Steel conical burrs", process: "Stepless adjustment", altitude: "25 g hopper", notes: "Espresso to cold brew", gear: true }
];
window.GRINDS = ["whole bean", "filter grind", "espresso grind"];

window.Store = (function () {
  function read(store, key, fallback) { try { var v = store.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } }
  function write(store, key, val) { try { store.setItem(key, JSON.stringify(val)); } catch (e) {} }
  function round(n) { return Math.round(n * 100) / 100; }
  var api = {
    product: function (idOrSlug) { return CATALOG.filter(function (p) { return p.id === idOrSlug || p.slug === idOrSlug; })[0]; },
    variantFor: function (p, grind) { return p.gear ? "standard" : "250g " + (grind || "whole bean"); },
    cart: function () { return read(localStorage, "hr_cart", []); },
    saveCart: function (c) { write(localStorage, "hr_cart", c); },
    addToCart: function (id, variant, qty) {
      var c = api.cart(), line = c.filter(function (l) { return l.id === id && l.variant === variant; })[0];
      if (line) line.qty += qty; else c.push({ id: id, variant: variant, qty: qty });
      api.saveCart(c); return c;
    },
    removeLine: function (index) { var c = api.cart(), removed = c.splice(index, 1)[0]; api.saveCart(c); return removed; },
    cartTotals: function (c) {
      c = c || api.cart(); var items = 0, value = 0;
      c.forEach(function (l) { var p = api.product(l.id); if (p) { items += l.qty; value += p.price * l.qty; } });
      return { items: items, value: round(value) };
    },
    customer: function () { return read(localStorage, "hr_customer", null); },
    setCustomer: function (c) { if (c) write(localStorage, "hr_customer", c); else localStorage.removeItem("hr_customer"); },
    hasOrdered: function () { return read(localStorage, "hr_has_ordered", false); },
    customerIdFor: function (email) {
      var h = 0; for (var i = 0; i < email.length; i++) { h = (h * 31 + email.charCodeAt(i)) | 0; }
      return "C-" + String(Math.abs(h) % 1000000).padStart(6, "0");
    },
    quote: function (c, coupon) {
      var subtotal = api.cartTotals(c).value;
      var discount = coupon === "WELCOME10" ? round(subtotal * 0.1) : 0;
      var shipping = subtotal - discount >= 200 || subtotal === 0 ? 0 : 15;
      var tax = round((subtotal - discount + shipping) * 0.05);
      return { subtotal: subtotal, discount: discount, shipping: shipping, tax: tax, total: round(subtotal - discount + shipping + tax) };
    },
    pendingOrder: function () { return read(sessionStorage, "hr_order", null); },
    savePendingOrder: function (o) { write(sessionStorage, "hr_order", o); },
    reset: function () {
      ["hr_cart", "hr_customer", "hr_has_ordered", "amp_tealium_orders"].forEach(function (k) { localStorage.removeItem(k); });
      ["hr_order", "amp_tealium_identify"].forEach(function (k) { sessionStorage.removeItem(k); });
    },
    round: round
  };
  return api;
})();
