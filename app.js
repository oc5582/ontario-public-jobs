(function () {
  "use strict";

  const C = window.COPY;
  const PAY_KEY = "opj_soft_pay";

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function fillSelect(select, options, placeholder) {
    select.innerHTML = "";
    const ph = document.createElement("option");
    ph.value = "";
    ph.textContent = placeholder;
    ph.disabled = true;
    ph.selected = true;
    select.appendChild(ph);
    options.forEach(function (opt) {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      select.appendChild(o);
    });
  }

  function initCopy() {
    $("#product-name").textContent = C.productName;
    document.title = C.productName;
    $("#who-its-for").textContent = C.whoItsFor;
    $("#promise").textContent = C.promise;
    $("#casl-label").textContent = C.caslConsent;
    $("#soft-pay-ask").textContent = C.softPayAsk;
    $("#email-label").textContent = C.form.emailLabel;
    $("#region-label").textContent = C.form.regionLabel;
    $("#employer-type-label").textContent = C.form.employerTypeLabel;
    $("#keyword-label").textContent = C.form.keywordLabel;
    $("#keyword").placeholder = C.form.keywordPlaceholder;
    $("#submit-btn").textContent = C.form.submit;
    $("#listings-heading").textContent = C.listings.heading;

    fillSelect($("#region"), C.regionOptions, C.form.selectPlaceholder);
    fillSelect(
      $("#employer_type"),
      C.employerTypeOptions,
      C.form.selectPlaceholder
    );

    const payBox = $("#pay-options");
    payBox.innerHTML = "";
    C.softPayOptions.forEach(function (opt) {
      const id = "pay-" + opt.value;
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "soft_pay";
      input.value = opt.value;
      input.id = id;
      label.htmlFor = id;
      label.appendChild(input);
      label.appendChild(document.createTextNode(" " + opt.label));
      payBox.appendChild(label);
    });

    try {
      const saved = localStorage.getItem(PAY_KEY);
      if (saved) {
        const el = document.querySelector(
          'input[name="soft_pay"][value="' + saved + '"]'
        );
        if (el) el.checked = true;
      }
    } catch (_) {}
  }

  function showStatus(el, msg, ok) {
    el.hidden = false;
    el.textContent = msg;
    el.className = "status " + (ok ? "ok" : "err");
  }

  function parseClosingDate(s) {
    if (!s || !String(s).trim()) return null;
    const t = Date.parse(s);
    return Number.isNaN(t) ? null : t;
  }

  function sortListings(items) {
    return items.slice().sort(function (a, b) {
      const da = parseClosingDate(a.closing_date);
      const db = parseClosingDate(b.closing_date);
      if (da === null && db === null) return 0;
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    });
  }

  function renderListings(items) {
    const meta = $("#listings-meta");
    const tbody = $("#listings-body");
    const sorted = sortListings(items);
    meta.textContent = C.listings.count(sorted.length);
    tbody.innerHTML = "";

    if (!sorted.length) {
      meta.textContent = C.listings.empty;
      return;
    }

    sorted.forEach(function (row) {
      const tr = document.createElement("tr");

      const tdTitle = document.createElement("td");
      if (row.apply_url) {
        const a = document.createElement("a");
        a.href = row.apply_url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = row.title || "Untitled";
        tdTitle.appendChild(a);
      } else {
        tdTitle.textContent = row.title || "Untitled";
      }
      tr.appendChild(tdTitle);

      const tdEmp = document.createElement("td");
      tdEmp.textContent = row.employer || "";
      tr.appendChild(tdEmp);

      const tdLoc = document.createElement("td");
      tdLoc.textContent = row.location || "";
      tr.appendChild(tdLoc);

      const tdClose = document.createElement("td");
      const close = (row.closing_date || "").trim();
      if (close) {
        tdClose.textContent = close;
      } else {
        tdClose.textContent = "";
        tdClose.setAttribute("aria-hidden", "true");
      }
      tr.appendChild(tdClose);

      tbody.appendChild(tr);
    });
  }

  function loadListings() {
    const meta = $("#listings-meta");
    meta.textContent = C.listings.loading;
    fetch("./data/listings.json")
      .then(function (r) {
        if (!r.ok) throw new Error("bad status");
        return r.json();
      })
      .then(function (data) {
        const items = Array.isArray(data) ? data : [];
        renderListings(items);
      })
      .catch(function () {
        meta.textContent = C.listings.error;
      });
  }

  function getSignupEndpoint() {
    if (typeof window.__SIGNUP_ENDPOINT__ === "string" && window.__SIGNUP_ENDPOINT__) {
      return window.__SIGNUP_ENDPOINT__;
    }
    if (typeof window.SIGNUP_ENDPOINT === "string" && window.SIGNUP_ENDPOINT) {
      return window.SIGNUP_ENDPOINT;
    }
    const meta = document.querySelector('meta[name="signup-endpoint"]');
    if (meta && meta.content) return meta.content;
    return null;
  }

  function onSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const status = $("#signup-status");
    const email = $("#email").value.trim();
    const region = $("#region").value;
    const employer_type = $("#employer_type").value;
    const keyword = $("#keyword").value.trim();
    const consent = $("#consent").checked;

    if (!email || !region || !employer_type || !consent) {
      showStatus(status, C.signup.validation, false);
      return;
    }

    const pay = document.querySelector('input[name="soft_pay"]:checked');
    try {
      if (pay) localStorage.setItem(PAY_KEY, pay.value);
    } catch (_) {}

    const payload = { email: email, region: region, employer_type: employer_type, keyword: keyword };

    const endpoint = getSignupEndpoint();
    const btn = $("#submit-btn");
    btn.disabled = true;

    if (!endpoint) {
      showStatus(status, C.signup.successPreview, true);
      btn.disabled = false;
      return;
    }

    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (r) {
        if (!r.ok) throw new Error("fail");
        showStatus(status, C.signup.successSent, true);
      })
      .catch(function () {
        showStatus(status, C.signup.error, false);
      })
      .finally(function () {
        btn.disabled = false;
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initCopy();
    $("#signup-form").addEventListener("submit", onSubmit);
    loadListings();
  });
})();
