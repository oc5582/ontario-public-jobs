(function () {
  var ENDPOINT = "/api/match/";
  var MAX = 15000;
  var form = document.getElementById("match-form");
  if (!form) return;
  var fileInput = document.getElementById("resume-file");
  var fileStatus = document.getElementById("file-status");
  var textArea = document.getElementById("resume-text");
  var statusEl = document.getElementById("status");
  var btn = document.getElementById("submit-btn");
  var fileText = "";
  function setStatus(msg, isError, href, label) {
    statusEl.replaceChildren();
    if (msg) statusEl.appendChild(document.createTextNode(msg + (href ? " " : "")));
    if (href) {
      var link = document.createElement("a");
      link.href = href;
      link.textContent = label || "See membership";
      statusEl.appendChild(link);
    }
    statusEl.className = "status" + (isError ? " error" : "");
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
  fileInput.addEventListener("change", async function () {
    fileText = "";
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
      if (name.endsWith(".pdf")) fileText = await pdfText(buf);
      else if (name.endsWith(".docx")) fileText = await docxText(buf);
      else {
        fileStatus.textContent = "Use a PDF or Word (.docx) file, or paste the text.";
        return;
      }
      fileText = fileText.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
      if (fileText.length < 80) {
        fileStatus.textContent = "We could not read text from this file. It may be a scanned image. Please paste the text instead.";
        fileText = "";
        return;
      }
      fileStatus.textContent = "Read your file (" + Math.min(fileText.length, MAX).toLocaleString() + " characters). Your file stays on your device.";
    } catch (e) {
      fileText = "";
      fileStatus.textContent = "We could not read this file. Please paste the text instead.";
    }
  });
  var lastData = null;
  var appliedKeys = null;
  function jobKey(value) {
    var path = String(value || "").trim();
    try {
      if (path.indexOf("http://") === 0 || path.indexOf("https://") === 0) path = new URL(path).pathname;
    } catch (e) {
      return "";
    }
    path = path.split("?")[0].split("#")[0].replace(/^\/+|\/+$/g, "");
    return /^jobs\/[^/]+\/[^/]+$/.test(path) ? path : "";
  }
  function render(listId, wrapId, items) {
    var list = document.getElementById(listId);
    list.innerHTML = "";
    items.forEach(function (j) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = j.url;
      a.textContent = j.title;
      var meta = document.createElement("p");
      meta.className = "meta";
      var bits = [j.employer, j.location, j.closing_date ? "Closes " + j.closing_date : ""].filter(Boolean);
      meta.appendChild(document.createTextNode(bits.join(" · ")));
      var key = jobKey(j.url);
      if (key && appliedKeys && appliedKeys[key]) {
        if (bits.length) meta.appendChild(document.createTextNode(" "));
        var tag = document.createElement("span");
        tag.className = "pill";
        tag.textContent = "Applied";
        meta.appendChild(tag);
      }
      var why = document.createElement("p");
      why.className = "why";
      why.textContent = j.reason;
      li.appendChild(a);
      li.appendChild(meta);
      li.appendChild(why);
      list.appendChild(li);
    });
    document.getElementById(wrapId).hidden = items.length === 0;
  }
  function shownHits(items, hide) {
    if (!hide || !appliedKeys) return items;
    return items.filter(function (j) { return !appliedKeys[jobKey(j.url)]; });
  }
  function renderResults() {
    if (!lastData) return;
    var hideEl = document.getElementById("hide-applied");
    var hide = Boolean(hideEl && hideEl.checked);
    var strong = shownHits(lastData.strong || [], hide);
    var maybe = shownHits(lastData.maybe || [], hide);
    render("strong-list", "strong-wrap", strong);
    render("maybe-list", "maybe-wrap", maybe);
    var empty = document.getElementById("applied-empty");
    var had = (lastData.strong || []).length + (lastData.maybe || []).length;
    if (empty) empty.hidden = !(hide && had > 0 && strong.length === 0 && maybe.length === 0);
  }
  async function loadApplied() {
    if (!document.getElementById("hide-applied")) return;
    var res = await fetch("/api/applications/", { headers: { Accept: "application/json" } });
    if (!res.ok) return;
    var data = await res.json().catch(function () { return {}; });
    appliedKeys = {};
    (data.paths || []).forEach(function (path) { appliedKeys[path] = true; });
  }
  var hideApplied = document.getElementById("hide-applied");
  if (hideApplied) hideApplied.addEventListener("change", renderResults);
  function renderUnlock(locked) {
    var el = document.getElementById("unlock");
    el.replaceChildren();
    if (!locked) {
      el.hidden = true;
      return;
    }
    var heading = document.createElement("h2");
    heading.textContent = locked + " more " + (locked === 1 ? "match" : "matches");
    var copy = document.createElement("p");
    copy.textContent = "This match shows the top 5. The rest are part of a membership. Apply stays free on every job page.";
    var actions = document.createElement("p");
    actions.className = "unlock-actions";
    var link = document.createElement("a");
    link.className = "apply-btn";
    link.href = "/pricing/";
    link.textContent = "See membership";
    actions.appendChild(link);
    el.appendChild(heading);
    el.appendChild(copy);
    el.appendChild(actions);
    el.hidden = false;
  }
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var consent = document.getElementById("consent").checked;
    var resume = (textArea.value.trim() || fileText).slice(0, MAX);
    if (resume.length < 80) {
      setStatus("Add your resume. Upload a PDF or Word file, or paste the text.", true);
      return;
    }
    btn.disabled = true;
    btn.textContent = "Checking jobs...";
    setStatus("Comparing your resume with current openings. This takes about 30 to 60 seconds. Please keep this page open. Matches are suggestions and can be wrong.", false);
    try {
      var res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          casl_consent: consent ? "yes" : "",
          resume_text: resume,
          _gotcha: document.getElementById("gotcha").value,
        }),
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok || !data.ok) {
        var href = data.upgrade || data.login || "";
        var label = data.upgrade ? "See membership" : "Sign in";
        setStatus(data.error || "Something went wrong. Please try again.", true, href, label);
        return;
      }
      setStatus("", false);
      document.getElementById("results-summary").textContent = data.summary || "";
      lastData = data;
      try {
        await loadApplied();
      } catch (loadErr) {
        appliedKeys = null;
      }
      renderResults();
      renderUnlock(data.locked || 0);
      document.getElementById("results").hidden = false;
      document.getElementById("results-title").focus();
    } catch (err) {
      setStatus("Something went wrong. Please check your connection and try again.", true);
    } finally {
      btn.disabled = false;
      btn.textContent = "Find my jobs";
    }
  });
})();
