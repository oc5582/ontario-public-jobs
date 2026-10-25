(function () {
  var MAX = 15000;
  var saveForm = document.getElementById("weekly-resume-form");
  if (!saveForm || saveForm.getAttribute("data-bound") === "1") return;
  saveForm.setAttribute("data-bound", "1");

  var root = document.getElementById("weekly-matches");
  var fileInput = document.getElementById("weekly-resume-file");
  var fileStatus = document.getElementById("weekly-file-status");
  var textArea = document.getElementById("weekly-resume-text");
  var statusEl = document.getElementById("weekly-status");
  var saveBtn = document.getElementById("weekly-save-btn");
  var replaceBtn = document.getElementById("weekly-replace-btn");
  var removeBtn = document.getElementById("weekly-remove-btn");
  var removeConfirm = document.getElementById("weekly-remove-confirm");
  var removeYes = document.getElementById("weekly-remove-yes");
  var removeNo = document.getElementById("weekly-remove-no");
  var cancelBtn = document.getElementById("weekly-replace-cancel");
  var savedState = document.getElementById("weekly-saved-state");
  var savedLabel = document.getElementById("weekly-saved-label");
  var savedFlash = document.getElementById("weekly-saved-flash");
  var emailForm = document.getElementById("weekly-email-form");
  var optIn = document.getElementById("weekly-opt-in");
  var emailFlash = document.getElementById("weekly-email-flash");
  var emailHint = document.getElementById("weekly-email-hint");
  var gotcha = document.getElementById("weekly-gotcha");
  var fileText = "";
  var fileSource = "";
  var fileName = "";
  var emailSeq = 0;

  function isSample() {
    return saveForm.getAttribute("data-sample") === "1" || (emailForm && emailForm.getAttribute("data-sample") === "1");
  }

  function featureReady() {
    return !root || root.getAttribute("data-ready") !== "0";
  }

  function setStatus(msg, isError) {
    if (!statusEl) return;
    statusEl.textContent = msg || "";
    statusEl.className = "status" + (isError ? " err" : " ok");
    statusEl.hidden = !msg;
  }

  function setFileStatus(msg) {
    if (!fileStatus) return;
    fileStatus.textContent = msg || "";
    fileStatus.hidden = !msg;
  }

  function flash(el, text) {
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
    if (el._timer) clearTimeout(el._timer);
    el._timer = setTimeout(function () {
      el.hidden = true;
      el.textContent = "";
    }, 2000);
  }

  function torontoSavedDate(date) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Toronto",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(date);
  }

  function setSavedLabel(when) {
    if (!savedLabel) return;
    savedLabel.textContent = when ? "\u2713 Saved " + when : "\u2713 Saved";
  }

  function hideConfirm() {
    if (removeConfirm) removeConfirm.hidden = true;
    if (replaceBtn) replaceBtn.hidden = false;
    if (removeBtn) removeBtn.hidden = false;
  }

  function resetEditor() {
    fileText = "";
    fileSource = "";
    fileName = "";
    if (textArea) textArea.value = "";
    if (fileInput) fileInput.value = "";
    setFileStatus("");
  }

  function setEmailEnabled(hasResume) {
    var on = featureReady() && hasResume;
    if (optIn) {
      optIn.disabled = !on;
      if (!on) optIn.checked = false;
    }
    if (emailHint) emailHint.hidden = hasResume;
  }

  function showSaved() {
    if (savedState) savedState.hidden = false;
    saveForm.hidden = true;
    if (cancelBtn) cancelBtn.hidden = true;
    hideConfirm();
  }

  function showEditor(replacing) {
    if (savedState) savedState.hidden = true;
    saveForm.hidden = false;
    if (cancelBtn) cancelBtn.hidden = !replacing;
    hideConfirm();
    resetEditor();
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      s.integrity = "sha384-/cXAMbzovUIKbBERjPmR3SnPTh8siWr5lsvFYj1Uq4XP0yaJUZJmsh0YXyGv5P0y";
      s.crossOrigin = "anonymous";
      document.head.appendChild(s);
    });
  }

  async function pdfText(buf) {
    var pdfjs = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
    var doc = await pdfjs.getDocument({ data: buf }).promise;
    var out = [];
    for (var i = 1; i <= Math.min(doc.numPages, 10); i++) {
      var page = await doc.getPage(i);
      var c = await page.getTextContent();
      out.push(c.items.map(function (it) { return it.str + (it.hasEOL ? "\n" : " "); }).join(""));
    }
    return out.join("\n");
  }

  async function docxText(buf) {
    if (!window.mammoth) await loadScript("https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js");
    var r = await window.mammoth.extractRawText({ arrayBuffer: buf });
    return r.value;
  }

  if (fileInput) {
    fileInput.addEventListener("change", async function () {
      fileText = "";
      fileSource = "";
      fileName = "";
      var f = fileInput.files && fileInput.files[0];
      if (!f) {
        setFileStatus("");
        return;
      }
      if (f.size > 10 * 1024 * 1024) {
        setFileStatus("That file is too large. Use a file under 10 MB, or paste the text.");
        return;
      }
      setFileStatus("Reading your file...");
      try {
        var buf = await f.arrayBuffer();
        var name = f.name.toLowerCase();
        if (name.endsWith(".pdf")) {
          fileText = await pdfText(buf);
          fileSource = "pdf";
        } else if (name.endsWith(".docx")) {
          fileText = await docxText(buf);
          fileSource = "docx";
        } else {
          setFileStatus("Use a PDF or Word (.docx) file, or paste the text.");
          return;
        }
        fileText = fileText.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
        if (fileText.length < 80) {
          setFileStatus("We could not read text from this file. It may be a scanned image. Please paste the text instead.");
          fileText = "";
          fileSource = "";
          return;
        }
        fileName = f.name;
        setFileStatus("");
      } catch (e) {
        fileText = "";
        fileSource = "";
        setFileStatus("We could not read this file. Please paste the text instead.");
      }
    });
  }

  async function post(url, body, method) {
    var res = await fetch(url, {
      method: method || "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    var data = {};
    try { data = await res.json(); } catch (ignore) { data = {}; }
    return { ok: res.ok && data.ok !== false, status: res.status, data: data };
  }

  function markSaved() {
    setSavedLabel(torontoSavedDate(new Date()));
    showSaved();
    setEmailEnabled(true);
    setStatus("", false);
    flash(savedFlash, "Resume saved \u2713");
    if (saveBtn) saveBtn.disabled = !featureReady();
  }

  saveForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    var pasted = (textArea && textArea.value.trim()) || "";
    var resume = (pasted || fileText).slice(0, MAX);
    var source = pasted ? "paste" : fileSource;
    if (resume.length < 80 || !source) {
      setStatus("Add your resume. Upload a PDF or Word file, or paste the text.", true);
      return;
    }
    if (isSample()) {
      markSaved();
      return;
    }
    if (saveBtn) saveBtn.disabled = true;
    setStatus("Saving your resume...", false);
    try {
      var result = await post("/api/account/resume/", {
        resume_text: resume,
        source: source,
        filename: source === "paste" ? "" : fileName,
        _gotcha: gotcha ? gotcha.value : "",
      });
      if (!result.ok) {
        setStatus((result.data && result.data.error) || "Something went wrong. Please try again.", true);
        if (saveBtn) saveBtn.disabled = false;
        return;
      }
      markSaved();
    } catch (e) {
      setStatus("Something went wrong. Please try again.", true);
      if (saveBtn) saveBtn.disabled = false;
    }
  });

  if (replaceBtn) {
    replaceBtn.addEventListener("click", function () {
      showEditor(true);
      if (fileInput) fileInput.focus();
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", function () {
      showSaved();
      if (replaceBtn) replaceBtn.focus();
    });
  }

  if (removeBtn && removeConfirm) {
    removeBtn.addEventListener("click", function () {
      removeConfirm.hidden = false;
      replaceBtn.hidden = true;
      removeBtn.hidden = true;
      if (removeNo) removeNo.focus();
    });
  }

  if (removeNo) {
    removeNo.addEventListener("click", function () {
      hideConfirm();
      if (removeBtn) removeBtn.focus();
    });
  }

  if (removeYes) {
    removeYes.addEventListener("click", async function () {
      removeYes.disabled = true;
      if (isSample()) {
        showEditor(false);
        setEmailEnabled(false);
        setStatus("", false);
        removeYes.disabled = false;
        return;
      }
      setStatus("Removing your resume...", false);
      try {
        var result = await post("/api/account/resume/", null, "DELETE");
        if (!result.ok) {
          setStatus((result.data && result.data.error) || "Something went wrong. Please try again.", true);
          removeYes.disabled = false;
          return;
        }
        showEditor(false);
        setEmailEnabled(false);
        setStatus("", false);
        removeYes.disabled = false;
      } catch (e) {
        setStatus("Something went wrong. Please try again.", true);
        removeYes.disabled = false;
      }
    });
  }

  if (emailForm) {
    emailForm.addEventListener("submit", function (event) {
      event.preventDefault();
    });
  }

  if (optIn) {
    optIn.addEventListener("change", async function () {
      var want = optIn.checked;
      var seq = ++emailSeq;
      if (isSample()) {
        flash(emailFlash, "Saved \u2713");
        return;
      }
      try {
        var result = await post("/api/account/weekly-email/", {
          opted_in: want,
          _gotcha: gotcha ? gotcha.value : "",
        });
        if (seq !== emailSeq) return;
        if (!result.ok) {
          optIn.checked = !want;
          setStatus((result.data && result.data.error) || "Something went wrong. Please try again.", true);
          return;
        }
        setStatus("", false);
        flash(emailFlash, "Saved \u2713");
      } catch (e) {
        if (seq !== emailSeq) return;
        optIn.checked = !want;
        setStatus("Something went wrong. Please try again.", true);
      }
    });
  }
})();
