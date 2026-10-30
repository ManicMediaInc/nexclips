function stripeClientReference(ref, user) {
  function slug(value) {
    return String(value || "").trim().replace(/[^A-Za-z0-9_-]/g, "_");
  }
  var r = slug(ref);
  var u = slug(user);
  var id = "";
  if (r && u) id = "ref-" + r + "_u-" + u;
  else if (r) id = "ref-" + r;
  else if (u) id = "u-" + u;
  if (id.length > 200) id = id.slice(0, 200);
  return id;
}

(function () {
  var cfg = window.NEX_CONFIG || {};
  var siteUrl = String(cfg.siteUrl || "").replace(/\/+$/, "");
  var nexpartyUrl = String(cfg.nexpartyUrl || "").replace(/\/+$/, "");
  var code = String(cfg.goatcounter || "").trim();
  var contactEmail = String(cfg.contactEmail || "").trim();
  var KEY = "nexclips.attribution";
  var MAX_AGE = 30 * 24 * 60 * 60 * 1000;
  var MAX_LEN = 96;

  function clean(value) {
    return String(value || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, MAX_LEN);
  }

  function setHref(id, href) {
    var node = document.getElementById(id);
    if (node && href) node.href = href;
  }

  setHref("link-nexparty", nexpartyUrl);
  setHref("link-privacy", nexpartyUrl ? nexpartyUrl + "/privacy" : "");
  setHref("link-terms", nexpartyUrl ? nexpartyUrl + "/terms" : "");

  if (siteUrl) {
    var canonical = document.createElement("link");
    canonical.rel = "canonical";
    canonical.href = siteUrl + "/";
    document.head.appendChild(canonical);
  }

  function readStored() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return { ref: "", u: "" };
      var data = JSON.parse(raw);
      if (!data || typeof data.savedAt !== "number" || Date.now() - data.savedAt > MAX_AGE) {
        localStorage.removeItem(KEY);
        return { ref: "", u: "" };
      }
      return { ref: clean(data.ref), u: clean(data.u) };
    } catch (err) {
      return { ref: "", u: "" };
    }
  }

  var params = new URLSearchParams(window.location.search);
  var stored = readStored();
  var ref = stored.ref;
  var user = stored.u;
  var fromQuery = false;
  if (params.has("ref")) {
    var nextRef = clean(params.get("ref"));
    if (nextRef) {
      ref = nextRef;
      fromQuery = true;
    }
  }
  if (params.has("u")) {
    var nextUser = clean(params.get("u"));
    if (nextUser) {
      user = nextUser;
      fromQuery = true;
    }
  }
  if (fromQuery) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ ref: ref, u: user, savedAt: Date.now() }));
    } catch (err) {}
  }

  var refInput = document.querySelector('#order-form input[name="ref"]');
  var userInput = document.querySelector('#order-form input[name="u"]');
  if (refInput) refInput.value = ref;
  if (userInput) userInput.value = user;

  var lines = ["VOD link:", ""];
  if (ref) lines.push("ref: " + ref);
  if (user) lines.push("u: " + user);
  var body = lines.join("\n");
  var mailtos = document.querySelectorAll('a[href^="mailto:"]');
  for (var i = 0; i < mailtos.length; i++) {
    var link = mailtos[i];
    var email = contactEmail || link.getAttribute("href").replace(/^mailto:/i, "").split("?")[0];
    if (contactEmail && link.hasAttribute("data-contact")) link.textContent = contactEmail;
    var subject = link.getAttribute("data-subject") || "NexClips";
    link.href = "mailto:" + email + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  }

  var stripeId = stripeClientReference(ref, user);
  if (stripeId && !/^[A-Za-z0-9_-]{1,200}$/.test(stripeId)) stripeId = "";
  if (stripeId) {
    var stripeLinks = document.querySelectorAll("a[data-stripe]");
    for (var s = 0; s < stripeLinks.length; s++) {
      var url = new URL(stripeLinks[s].href);
      url.searchParams.set("client_reference_id", stripeId);
      stripeLinks[s].href = url.toString();
    }
  }

  var pending = [];
  function track(name) {
    if (!code) return;
    if (window.goatcounter && typeof window.goatcounter.count === "function") {
      window.goatcounter.count({ path: name, event: true });
    } else {
      pending.push(name);
    }
  }

  document.addEventListener("click", function (event) {
    var el = event.target;
    if (el && el.nodeType !== 1) el = el.parentElement;
    var node = el && el.closest ? el.closest("[data-track]") : null;
    if (!node) return;
    track(node.getAttribute("data-track"));
  });

  var form = document.getElementById("order-form");
  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      track("order-submit");
    });
  }

  if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,62}$/.test(code)) return;

  var script = document.createElement("script");
  script.async = true;
  script.src = "https://gc.zgo.at/count.js";
  script.dataset.goatcounter = "https://" + code + ".goatcounter.com/count";
  script.addEventListener("load", function () {
    pending.forEach(function (name) {
      window.goatcounter.count({ path: name, event: true });
    });
  });
  document.head.appendChild(script);
})();
