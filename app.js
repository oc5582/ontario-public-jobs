(function () {
  "use strict";

  const C = window.COPY;
  const PAY_KEY = "opj_soft_pay";

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function initCopy() {
    if (!C) return;

    const heading = $("#signup-heading");
    if (heading && C.signup && C.signup.heading) heading.textContent = C.signup.heading;
    const lead = $("#signup-lead");
    if (lead && C.signup && C.signup.lead) lead.textContent = C.signup.lead;

    const casl = $("#casl-label");
    if (casl && C.caslConsent) casl.textContent = C.caslConsent;
    const payAsk = $("#soft-pay-ask");
    if (payAsk && C.softPayAsk) payAsk.textContent = C.softPayAsk;
    const emailLabel = $("#email-label");
    if (emailLabel) emailLabel.textContent = C.form.emailLabel;
    const submit = $("#submit-btn");
    if (submit) submit.textContent = C.form.submit;

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

  function isEmail(value) {
    if (value.length < 3 || value.length > 254) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function getSignupEndpoint() {
    const fromWindow =
      typeof window.SIGNUP_ENDPOINT === "string" ? window.SIGNUP_ENDPOINT.trim() : "";
    if (fromWindow) return fromWindow;
    const meta = document.querySelector('meta[name="signup-endpoint"]');
    if (meta && meta.content) return meta.content.trim();
    return "";
  }

  function onSubmit(e) {
    e.preventDefault();
    const status = $("#signup-status");
    const email = $("#email").value.trim().toLowerCase();
    const consent = $("#consent").checked;
    const honeypot = $("#gotcha");
    const btn = $("#submit-btn");

    if (honeypot && honeypot.value.trim()) {
      showStatus(status, C.signup.successSent, true);
      return;
    }

    if (!isEmail(email) || !consent) {
      showStatus(status, C.signup.validation, false);
      return;
    }

    const pay = document.querySelector('input[name="soft_pay"]:checked');
    try {
      if (pay) localStorage.setItem(PAY_KEY, pay.value);
    } catch (_) {}

    const endpoint = getSignupEndpoint();
    if (!endpoint) {
      showStatus(status, C.signup.notConfigured, false);
      return;
    }

    const payload = {
      email: email,
      casl_consent: "yes",
      _gotcha: "",
    };
    if (pay && /^(yes|maybe|no)$/.test(pay.value)) payload.soft_pay = pay.value;

    const form = $("#signup-form");
    form.action = endpoint;
    form.method = "post";
    btn.disabled = true;

    fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      mode: "cors",
      credentials: "omit",
    })
      .then(function (r) {
        return r
          .json()
          .catch(function () {
            return {};
          })
          .then(function (data) {
            if (!r.ok) throw new Error(data.error || "fail");
            showStatus(status, C.signup.successSent, true);
            $("#email").value = "";
            $("#consent").checked = false;
          });
      })
      .catch(function (err) {
        const known = err && err.message && err.message.indexOf("agree") !== -1;
        showStatus(status, known ? err.message : C.signup.error, false);
      })
      .finally(function () {
        btn.disabled = false;
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initCopy();
    const form = $("#signup-form");
    const endpoint = getSignupEndpoint();
    if (form && endpoint) {
      form.action = endpoint;
      form.method = "post";
    }
    if (form) form.addEventListener("submit", onSubmit);
  });
})();
