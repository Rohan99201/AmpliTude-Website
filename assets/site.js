/* Storefront UI. Every tracked interaction goes through dlTrack() after it succeeds. */
(function () {
  var page = document.documentElement.getAttribute("data-page");
  var params = new URLSearchParams(location.search);
  var CUR = window.SITE_CONFIG.site.currency;
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function money(n) { return CUR + " " + (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, ""); }
  function el(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }

  /* ---------- shell ---------- */
  function header() {
    var count = Store.cartTotals().items, cust = Store.customer();
    var cat = params.get("category");
    function nav(slug, label) { return '<a href="index.html?category=' + slug + '"' + (cat === slug ? ' aria-current="page"' : "") + ">" + label + "</a>"; }
    return el(
      '<header class="top"><div class="wrap top-inner">' +
        '<a class="brand" href="index.html"><span class="brand-mark" aria-hidden="true"></span>Harra Roastery</a>' +
        '<nav class="nav" aria-label="Shop">' + nav("single-origin", "Single origin") + nav("blends", "Blends") + nav("brewing-gear", "Brewing gear") + "</nav>" +
        '<form class="search" action="index.html" role="search"><label class="sr" for="q">Search coffee</label>' +
          '<input id="q" name="q" type="search" placeholder="Search coffee" value="' + esc(params.get("q") || "") + '"></form>' +
        '<div class="top-actions"><a href="account.html">' + (cust ? "Account" : "Log in") + '</a>' +
          '<a class="cart-link" href="cart.html">Cart<span class="count" aria-label="' + count + ' items">' + count + "</span></a></div>" +
      "</div></header>"
    );
  }
  function footer() {
    var f = el(
      '<footer class="foot"><div class="wrap foot-inner">' +
        '<div><p class="foot-title">Roasted in Al Quoz every Tuesday</p><p class="muted">Demo storefront for the Amplitude via Tealium iQ data layer. No real orders are placed.</p></div>' +
        '<form class="news" id="news" novalidate><label for="news-email">Get the weekly roast list</label>' +
          '<div class="news-row"><input id="news-email" type="email" required placeholder="you@example.com" autocomplete="email"><button class="btn">Subscribe</button></div>' +
          '<p class="news-msg muted" role="status"></p></form>' +
      "</div></footer>"
    );
    $("#news", f).addEventListener("submit", function (e) {
      e.preventDefault();
      var input = $("#news-email", f), msg = $(".news-msg", f);
      if (!input.checkValidity()) { msg.textContent = "Enter an email address like name@example.com."; return; }
      msg.textContent = "Subscribed. The next roast list goes out Tuesday.";
      input.value = "";
      dlTrack("email_signup", { signup_location: "footer" }); // the email itself never enters the data layer
    });
    return f;
  }
  function refreshCartCount() { var c = $(".cart-link .count"); if (c) c.textContent = Store.cartTotals().items; }

  /* ---------- pages ---------- */
  function productRow(p) {
    return '<li class="roast-row"><a href="product.html?id=' + p.id + '">' +
      '<span class="r-name">' + esc(p.name) + "</span>" +
      '<span class="r-origin">' + esc(p.origin) + "</span>" +
      '<span class="r-notes">' + esc(p.notes) + "</span>" +
      '<span class="r-price">' + money(p.price) + "</span></a></li>";
  }
  function renderIndex(main) {
    var d = window.utag_data, list = CATALOG, heading, sub;
    if (d.page_type === "search") {
      var q = d.search_keyword;
      list = CATALOG.filter(function (p) { return (p.name + " " + p.notes + " " + p.origin + " " + p.category).toLowerCase().indexOf(q) > -1; });
      heading = list.length ? list.length + " result" + (list.length === 1 ? "" : "s") + " for \u201c" + esc(q) + "\u201d" : "Nothing matches \u201c" + esc(q) + "\u201d";
      sub = list.length ? "" : "Try an origin like Ethiopia or a note like chocolate.";
    } else if (d.page_type === "category") {
      list = CATALOG.filter(function (p) { return p.category === d.category_name; });
      heading = d.category_name.charAt(0).toUpperCase() + d.category_name.slice(1);
    }
    if (d.page_type === "home") {
      main.appendChild(el(
        '<section class="hero wrap"><p class="hero-date">This week\u2019s roast</p>' +
        '<h1>Six coffees, roasted Tuesday, at your door in Dubai by Thursday.</h1>' +
        '<p class="lead">Every bag carries its roast date. We never sell a coffee older than three weeks.</p></section>'
      ));
      heading = "The roast sheet";
    }
    main.appendChild(el(
      '<section class="wrap sheet"><h2>' + heading + "</h2>" + (sub ? '<p class="muted">' + sub + "</p>" : "") +
      (list.length ? '<ol class="roast-list">' + list.map(productRow).join("") + "</ol>" : "") + "</section>"
    ));
  }
  function renderProduct(main) {
    var p = Store.product(params.get("id") || "") || CATALOG[0];
    document.title = p.name + " \u2013 Harra Roastery";
    var grindField = p.gear ? "" :
      '<fieldset class="grind"><legend>Grind</legend>' + GRINDS.map(function (g, i) {
        return '<label><input type="radio" name="grind" value="' + g + '"' + (i === 0 ? " checked" : "") + "> " + g + "</label>";
      }).join("") + "</fieldset>";
    main.appendChild(el(
      '<section class="wrap pdp"><div class="pdp-art" aria-hidden="true"><span>' + esc(p.name.split(" ")[0]) + '</span></div>' +
      '<div class="pdp-info"><p class="muted"><a href="index.html?category=' + p.category.replace(/ /g, "-") + '">' + esc(p.category) + "</a></p>" +
      "<h1>" + esc(p.name) + '</h1><p class="pdp-price">' + money(p.price) + (p.gear ? "" : ' <span class="muted">/ 250 g</span>') + "</p>" +
      '<dl class="specs"><dt>' + (p.gear ? "Material" : "Origin") + "</dt><dd>" + esc(p.origin) + "</dd><dt>" + (p.gear ? "Build" : "Process") + "</dt><dd>" + esc(p.process) +
      "</dd><dt>" + (p.gear ? "Size" : "Altitude") + "</dt><dd>" + esc(p.altitude) + "</dd><dt>" + (p.gear ? "Good for" : "Tastes like") + "</dt><dd>" + esc(p.notes) + "</dd></dl>" +
      '<form id="add">' + grindField +
      '<div class="buy-row"><label class="qty">Quantity <input id="qty" type="number" min="1" max="10" value="1" inputmode="numeric"></label>' +
      '<button class="btn btn-main" type="submit">Add to cart</button></div><p class="add-msg" role="status"></p></form></div></section>'
    ));
    $("#add").addEventListener("submit", function (e) {
      e.preventDefault();
      var qty = Math.max(1, Math.min(10, parseInt($("#qty").value, 10) || 1));
      var grind = $('input[name="grind"]:checked'), variant = Store.variantFor(p, grind && grind.value);
      var cart = Store.addToCart(p.id, variant, qty), t = Store.cartTotals(cart);
      refreshCartCount();
      $(".add-msg").innerHTML = "Added " + qty + " \u00d7 " + esc(p.name) + '. <a href="cart.html">View cart</a>';
      dlTrack("cart_add", Object.assign(productArrays([{ id: p.id, variant: variant, qty: qty }]), { cart_total_items: t.items, cart_total_value: t.value }));
    });
  }
  function renderCart(main) {
    var cart = Store.cart();
    var sec = el('<section class="wrap cart"><h1>Your cart</h1><div class="cart-body"></div></section>');
    main.appendChild(sec);
    function draw() {
      cart = Store.cart();
      var body = $(".cart-body", sec), t = Store.cartTotals(cart);
      if (!cart.length) { body.innerHTML = '<p>Your cart is empty. <a href="index.html">Browse this week\u2019s roast</a>.</p>'; return; }
      body.innerHTML = '<ul class="lines">' + cart.map(function (l, i) {
        var p = Store.product(l.id);
        return '<li class="line"><div><a class="line-name" href="product.html?id=' + p.id + '">' + esc(p.name) + '</a><span class="muted">' + esc(l.variant) + " \u00d7 " + l.qty + "</span></div>" +
          '<span class="line-price">' + money(p.price * l.qty) + '</span><button class="link-btn" data-i="' + i + '">Remove</button></li>';
      }).join("") + '</ul><div class="cart-foot"><p class="total">Subtotal <strong>' + money(t.value) + "</strong></p>" +
        '<button class="btn btn-main" id="go-checkout">Check out</button></div>';
      body.querySelectorAll("[data-i]").forEach(function (b) {
        b.addEventListener("click", function () {
          var removed = Store.removeLine(parseInt(b.getAttribute("data-i"), 10)), nt = Store.cartTotals();
          refreshCartCount();
          dlTrack("cart_remove", Object.assign(productArrays([removed]), { cart_total_items: nt.items, cart_total_value: nt.value }));
          draw();
        });
      });
      $("#go-checkout", body).addEventListener("click", function () {
        var c = Store.cart(), ct = Store.cartTotals(c);
        dlTrack("checkout", Object.assign(productArrays(c), { cart_total_items: ct.items, cart_total_value: ct.value, checkout_step: 1 }));
        // Short pause so the event is handed to the SDK before navigation.
        setTimeout(function () { location.href = "checkout.html"; }, 300);
      });
    }
    draw();
  }
  function renderCheckout(main) {
    var cart = Store.cart();
    if (!cart.length) { main.appendChild(el('<section class="wrap"><h1>Checkout</h1><p>Your cart is empty. <a href="index.html">Browse this week\u2019s roast</a>.</p></section>')); return; }
    var sec = el(
      '<section class="wrap checkout"><h1>Checkout</h1><div class="co-grid">' +
      '<form id="co" novalidate><fieldset><legend>Delivery</legend>' +
        '<label>Full name<input name="fullname" required autocomplete="name"></label>' +
        '<label>Email<input name="email" type="email" required autocomplete="email"></label>' +
        '<label>Area, Dubai<input name="area" required autocomplete="address-level2" placeholder="Al Barsha"></label></fieldset>' +
      '<fieldset><legend>Payment</legend>' +
        '<label class="radio"><input type="radio" name="pay" value="card" checked> Card</label>' +
        '<label class="radio"><input type="radio" name="pay" value="apple_pay"> Apple Pay</label>' +
        '<label class="radio"><input type="radio" name="pay" value="cash_on_delivery"> Cash on delivery</label></fieldset>' +
      '<label>Coupon code<input name="coupon" placeholder="WELCOME10" autocomplete="off"></label>' +
      '<p class="co-error" role="alert"></p><button class="btn btn-main" type="submit">Place order</button></form>' +
      '<aside class="summary" aria-label="Order summary"></aside></div></section>'
    );
    main.appendChild(sec);
    var form = $("#co", sec);
    function summary() {
      var coupon = (form.coupon.value || "").trim().toUpperCase(), qv = Store.quote(cart, coupon);
      $(".summary", sec).innerHTML = "<h2>Summary</h2><dl>" +
        "<dt>Subtotal</dt><dd>" + money(qv.subtotal) + "</dd>" +
        (qv.discount ? "<dt>WELCOME10</dt><dd>\u2212" + money(qv.discount) + "</dd>" : "") +
        "<dt>Delivery</dt><dd>" + (qv.shipping ? money(qv.shipping) : "Free") + "</dd>" +
        "<dt>VAT 5%</dt><dd>" + money(qv.tax) + '</dd><dt class="grand">Total</dt><dd class="grand">' + money(qv.total) + "</dd></dl>" +
        '<p class="muted">Free delivery over ' + money(200) + ". Try WELCOME10 for 10% off.</p>";
      return { coupon: qv.discount ? coupon : "", q: qv };
    }
    form.coupon.addEventListener("input", summary);
    summary();
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var bad = ["fullname", "email", "area"].filter(function (n) { return !form[n].checkValidity(); });
      if (bad.length) { $(".co-error", sec).textContent = "Fill in your " + bad.join(", ") + " to place the order."; form[bad[0]].focus(); return; }
      var s = summary(), now = new Date();
      var id = "HR-" + now.toISOString().slice(0, 10).replace(/-/g, "") + "-" + String(Math.floor(Math.random() * 9000) + 1000);
      Store.savePendingOrder({ id: id, lines: cart, subtotal: s.q.subtotal, discount: s.q.discount, shipping: s.q.shipping, tax: s.q.tax, total: s.q.total,
        payment: form.pay.value, coupon: s.coupon, tracked: false });
      try { localStorage.setItem("hr_has_ordered", "true"); } catch (err) {}
      Store.saveCart([]);
      location.href = "confirmation.html";
    });
  }
  function renderConfirmation(main) {
    var o = Store.pendingOrder();
    if (!o) { main.appendChild(el('<section class="wrap"><h1>No recent order</h1><p><a href="index.html">Browse this week\u2019s roast</a>.</p></section>')); return; }
    main.appendChild(el(
      '<section class="wrap confirm"><p class="hero-date">Order ' + esc(o.id) + "</p><h1>Thanks. Your coffee roasts on Tuesday.</h1>" +
      '<p class="lead">' + o.lines.reduce(function (n, l) { return n + l.qty; }, 0) + " items, " + money(o.total) + " paid by " + esc(o.payment.replace(/_/g, " ")) + ".</p>" +
      '<p class="muted">Refresh this page: the data layer switches to a plain page view, so the purchase is counted once.</p>' +
      '<p><a class="btn" href="index.html">Back to the roast sheet</a></p></section>'
    ));
  }
  function renderAccount(main) {
    var sec = el('<section class="wrap account"></section>');
    main.appendChild(sec);
    function draw() {
      var c = Store.customer();
      if (c) {
        sec.innerHTML = "<h1>Your account</h1><p>Signed in as customer <strong>" + esc(c.id) + '</strong>. This ID becomes the Amplitude user ID; the email never enters the data layer.</p><button class="btn" id="logout">Log out</button>';
        $("#logout", sec).addEventListener("click", function () {
          Store.setCustomer(null);
          delete utag_data.customer_id; utag_data.customer_login_status = "guest";
          dlTrack("user_logout", {});
          draw();
        });
        return;
      }
      sec.innerHTML = '<h1>Log in or create an account</h1><div class="auth-grid">' +
        authForm("login", "Log in", "Log in") + authForm("register", "New here?", "Create account") + "</div>";
      ["login", "register"].forEach(function (kind) {
        var f = $("#" + kind, sec);
        f.addEventListener("submit", function (e) {
          e.preventDefault();
          if (!f.email.checkValidity() || f.password.value.length < 6) { $(".auth-msg", f).textContent = "Enter a valid email and a password of 6+ characters."; return; }
          var id = Store.customerIdFor(f.email.value.trim().toLowerCase());
          Store.setCustomer({ id: id });
          utag_data.customer_id = id; utag_data.customer_login_status = "logged_in";
          dlTrack(kind === "login" ? "user_login" : "user_register", { customer_id: id, auth_method: "email" });
          draw();
        });
      });
    }
    function authForm(id, title, cta) {
      return '<form id="' + id + '" class="auth" novalidate><h2>' + title + "</h2>" +
        '<label>Email<input name="email" type="email" required autocomplete="email"></label>' +
        '<label>Password<input name="password" type="password" required minlength="6" autocomplete="' + (id === "login" ? "current-password" : "new-password") + '"></label>' +
        '<button class="btn btn-main" type="submit">' + cta + '</button><p class="auth-msg" role="alert"></p></form>';
    }
    draw();
  }

  /* ---------- inspector ---------- */
  function inspector() {
    var box = el(
      '<aside class="insp" aria-label="Data layer inspector"><button class="insp-toggle" aria-expanded="false">Data layer <span class="insp-n">0</span></button>' +
      '<div class="insp-panel" hidden><div class="insp-head"><p class="insp-mode"></p><button class="link-btn" id="insp-reset">Reset demo</button></div>' +
      '<details open><summary>utag_data on this page</summary><pre class="insp-udo"></pre></details>' +
      '<h3>Events, newest first</h3><ol class="insp-log"></ol></div></aside>'
    );
    var n = 0, logEl = $(".insp-log", box);
    $(".insp-mode", box).innerHTML = window.__dlMode === "live"
      ? "<strong>Live Tealium</strong><br>" + esc(window.__dlSource)
      : "<strong>Simulation</strong><br>Tealium not configured. The Custom Container code runs locally and sends to Amplitude EU.";
    $(".insp-udo", box).textContent = JSON.stringify(window.utag_data, null, 2);
    function add(entry) {
      n++; $(".insp-n", box).textContent = n;
      var li = el('<li class="k-' + entry.kind + '"><details><summary></summary><pre></pre></details></li>');
      $("summary", li).textContent = entry.time.toTimeString().slice(0, 8) + "  " + entry.title;
      $("pre", li).textContent = JSON.stringify(entry.data, null, 2);
      logEl.insertBefore(li, logEl.firstChild);
      $(".insp-udo", box).textContent = JSON.stringify(window.utag_data, null, 2);
    }
    window.__dlLog.forEach(add);
    window.addEventListener("dl-log", function (e) { add(e.detail); });
    $(".insp-toggle", box).addEventListener("click", function () {
      var panel = $(".insp-panel", box), open = panel.hidden;
      panel.hidden = !open; this.setAttribute("aria-expanded", String(open));
    });
    $("#insp-reset", box).addEventListener("click", function () { Store.reset(); location.href = "index.html"; });
    return box;
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.body.insertBefore(header(), document.body.firstChild);
    var main = $("main");
    ({ index: renderIndex, product: renderProduct, cart: renderCart, checkout: renderCheckout, confirmation: renderConfirmation, account: renderAccount })[page](main);
    document.body.appendChild(footer());
    document.body.appendChild(inspector());
  });
})();
