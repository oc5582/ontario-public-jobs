(function () {
  var MAX = 15000;
  var saveForm = document.getElementById("weekly-resume-form");
  if (!saveForm) return;
  if (saveForm.getAttribute("data-sample") === "1") {
    saveForm.addEventListener("submit", function (event) { event.preventDefault(); });
    var sampleEmail = document.getElementById("weekly-email-form");
    if (sampleEmail) sampleEmail.addEventListener("submit", function (event) { event.preventDefault(); });
    return;
  }

  var fileInput = document.getElementById("weekly-resume-file");
  var fileStatus = document.getElementById("weekly-file-status");
  var textArea = document.getElementById("weekly-resume-text");
  var statusEl = document.getElementById("weekly-status");
  var saveBtn = document.getElementById("weekly-save-btn");
  var removeBtn = document.getElementById("weekly-remove-btn");
  var emailForm = document.getElementById("weekly-email-form");
  var emailBtn = document.getElementById("weekly-email-btn");
  var optIn = document.getElementById("weekly-opt-in");
  var gotcha = document.getElementById("weekly-gotcha");
  var fileText = "";
  var fileSource = "";
  var fileName = "";

  function setStatus(msg, isError) {
    if (!statusEl) return;
    statusEl.textContent = msg || "";
    statusEl.className = "status" + (isError ? " err" : " ok");
    statusEl.hidden = !msg;
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
      if (!f) return;
      if (f.size > 10 * 1024 * 1024) {
        fileStatus.textContent = "That file is too large. Use a file under 10 MB, or paste the text.";
        return;
      }
      fileStatus.textContent = "Reading your file...";
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
          fileStatus.textContent = "Use a PDF or Word (.docx) file, or paste the text.";
          return;
        }
        fileText = fileText.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
        if (fileText.length < 80) {
          fileStatus.textContent = "We could not read text from this file. It may be a scanned image. Please paste the text instead.";
          fileText = "";
          fileSource = "";
          return;
        }
        fileName = f.name;
        fileStatus.textContent = "Read your file (" + Math.min(fileText.length, MAX).toLocaleString() + " characters). Your file stays on your device.";
      } catch (e) {
        fileText = "";
        fileSource = "";
        fileStatus.textContent = "We could not read this file. Please paste the text instead.";
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

  saveForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    var pasted = (textArea && textArea.value.trim()) || "";
    var resume = (pasted || fileText).slice(0, MAX);
    var source = pasted ? "paste" : fileSource;
    if (resume.length < 80 || !source) {
      setStatus("Add your resume. Upload a PDF or Word file, or paste the text.", true);
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
      window.location.reload();
    } catch (e) {
      setStatus("Something went wrong. Please try again.", true);
      if (saveBtn) saveBtn.disabled = false;
    }
  });

  if (removeBtn) {
    removeBtn.addEventListener("click", async function () {
      removeBtn.disabled = true;
      setStatus("Removing your resume...", false);
      try {
        var result = await post("/api/account/resume/", null, "DELETE");
        if (!result.ok) {
          setStatus((result.data && result.data.error) || "Something went wrong. Please try again.", true);
          removeBtn.disabled = false;
          return;
        }
        window.location.reload();
      } catch (e) {
        setStatus("Something went wrong. Please try again.", true);
        removeBtn.disabled = false;
      }
    });
  }

  if (emailForm) {
    emailForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (emailBtn) emailBtn.disabled = true;
      setStatus("Saving the email setting...", false);
      try {
        var result = await post("/api/account/weekly-email/", {
          opted_in: Boolean(optIn && optIn.checked),
          _gotcha: gotcha ? gotcha.value : "",
        });
        if (!result.ok) {
          setStatus((result.data && result.data.error) || "Something went wrong. Please try again.", true);
          if (emailBtn) emailBtn.disabled = false;
          return;
        }
        window.location.reload();
      } catch (e) {
        setStatus("Something went wrong. Please try again.", true);
        if (emailBtn) emailBtn.disabled = false;
      }
    });
  }
})();
