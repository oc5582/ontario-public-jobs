(function () {
  "use strict";

  const C = window.COPY;
  const PAY_KEY = "opj_soft_pay";

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function fillSelect(select, options, placeholder) {
    if (!select) return;
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
    if (!C) return;

    const casl = $("#casl-label");
    if (casl && !casl.textContent.trim()) casl.textContent = C.caslConsent;
    const payAsk = $("#soft-pay-ask");
    if (payAsk && !payAsk.textContent.trim()) payAsk.textContent = C.softPayAsk;
    const emailLabel = $("#email-label");
    if (emailLabel) emailLabel.textContent = C.form.emailLabel;
    const regionLabel = $("#region-label");
    if (regionLabel) regionLabel.textContent = C.form.regionLabel;
    const employerLabel = $("#employer-type-label");
    if (employerLabel) employerLabel.textContent = C.form.employerTypeLabel;
    const keywordLabel = $("#keyword-label");
    if (keywordLabel) keywordLabel.textContent = C.form.keywordLabel;
    const keyword = $("#keyword");
    if (keyword) keyword.placeholder = C.form.keywordPlaceholder;
    const submit = $("#submit-btn");
    if (submit) submit.textContent = C.form.submit;

    fillSelect($("#region"), C.regionOptions, C.form.selectPlaceholder);
    fillSelect(
      $("#employer_type"),
      C.employerTypeOptions,
      C.form.selectPlaceholder
    );

    const payBox = $("#pay-options");
    if (!payBox) return;
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

    const payload = {
      email: email,
      region: region,
      employer_type: employer_type,
      keyword: keyword,
    };

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
    const form = $("#signup-form");
    if (form) form.addEventListener("submit", onSubmit);
  });
})();
