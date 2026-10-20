var FREE_RESULTS = 10;
var TEASER_ROWS = 5;

function finiteCount(value) {
  var n = Number(value);
  if (!isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function matchUnlockCopy(shown, remaining) {
  var shownCount = finiteCount(shown);
  var remainingCount = finiteCount(remaining);
  var total = shownCount + remainingCount;
  var top = shownCount < FREE_RESULTS ? shownCount : FREE_RESULTS;
  var totalLabel = total.toLocaleString("en-CA");
  var topLabel = top.toLocaleString("en-CA");
  return {
    total: total,
    heading: totalLabel + " jobs match your resume. You're seeing the top " + topLabel + ".",
    text:
      "Become a member to see all " +
      totalLabel +
      ", ranked by how well they fit you, and run a new match anytime.",
    button: "See all " + totalLabel + " matches",
    note: "From CA$14.99/month plus GST/HST. Cancel anytime.",
    href: "/pricing/",
  };
}

function renderLocked(doc, locked) {
  // Placeholder rows only. The server sends a count, never the hidden jobs.
  var list = doc.getElementById("locked-list");
  if (!list) {
    list = doc.createElement("ol");
    list.id = "locked-list";
    list.className = "results locked-results";
    list.setAttribute("aria-hidden", "true");
    var unlockEl = doc.getElementById("unlock");
    unlockEl.parentNode.insertBefore(list, unlockEl);
  }
  list.replaceChildren();
  for (var i = 0; i < Math.min(locked, TEASER_ROWS); i++) {
    var li = doc.createElement("li");
    var title = doc.createElement("span");
    title.className = "locked-title";
    title.textContent = "Member-only match";
    var meta = doc.createElement("p");
    meta.className = "meta locked-text";
    meta.textContent = "Public-sector employer · Toronto";
    var why = doc.createElement("p");
    why.className = "why locked-text";
    why.textContent = "Why this job fits your experience, shown with a membership.";
    li.appendChild(title);
    li.appendChild(meta);
    li.appendChild(why);
    list.appendChild(li);
  }
  list.hidden = locked === 0;
}

function renderMatchUnlock(doc, shown, remaining) {
  var el = doc.getElementById("unlock");
  el.replaceChildren();
  var locked = finiteCount(remaining);
  renderLocked(doc, locked);
  if (!locked) {
    el.hidden = true;
    return;
  }
  var copy = matchUnlockCopy(shown, locked);
  var heading = doc.createElement("h2");
  heading.textContent = copy.heading;
  var text = doc.createElement("p");
  text.textContent = copy.text;
  var actions = doc.createElement("p");
  actions.className = "unlock-actions";
  var link = doc.createElement("a");
  link.className = "apply-btn";
  link.href = copy.href;
  link.textContent = copy.button;
  actions.appendChild(link);
  var note = doc.createElement("p");
  note.className = "apply-note";
  note.textContent = copy.note;
  el.appendChild(heading);
  el.appendChild(text);
  el.appendChild(actions);
  el.appendChild(note);
  el.hidden = false;
}

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
  function setStatus(msg, isError, links) {
    statusEl.replaceChildren();
    if (msg) statusEl.appendChild(document.createTextNode(msg));
    (links || []).forEach(function (item) {
      statusEl.appendChild(document.createTextNode(" "));
      var link = document.createElement("a");
      link.href = item.href;
      link.textContent = item.label;
      statusEl.appendChild(link);
    });
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
  var inFlight = false;
  function newRunId() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    } catch (ignore) {
      /* fall through */
    }
    return "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  }
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
  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    // One request at a time, even if the event fires again before the button is disabled.
    if (inFlight) return;
    var consent = document.getElementById("consent").checked;
    var emailEl = document.getElementById("email");
    var email = emailEl ? emailEl.value.trim() : "";
    if (emailEl && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus("Enter a valid email address.", true);
      emailEl.focus();
      return;
    }
    var resume = (textArea.value.trim() || fileText).slice(0, MAX);
    if (resume.length < 80) {
      setStatus("Add your resume. Upload a PDF or Word file, or paste the text.", true);
      return;
    }
    inFlight = true;
    btn.disabled = true;
    btn.textContent = "Checking jobs...";
    // Same id for any resent copy of this submit, so the server counts it once.
    var runId = newRunId();
    setStatus("Comparing your resume with current openings. This takes about 30 to 60 seconds. Please keep this page open. Matches are suggestions and can be wrong.", false);
    try {
      var res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          email: email,
          run_id: runId,
          casl_consent: consent ? "yes" : "",
          resume_text: resume,
          _gotcha: document.getElementById("gotcha").value,
        }),
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok || !data.ok) {
        var links = [];
        if (data.upgrade) links.push({ href: data.upgrade, label: "See membership" });
        if (data.login) links.push({ href: data.login, label: data.upgrade ? "or sign in" : "Sign in" });
        setStatus(data.error || "Something went wrong. Please try again.", true, links);
        if (data.code === "free_used" && emailEl) btn.hidden = true;
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
      var shown = typeof data.shown === "number" ? data.shown : (data.strong || []).length + (data.maybe || []).length;
      renderMatchUnlock(document, shown, data.locked || 0);
      document.getElementById("results").hidden = false;
      if (data.guest) {
        // One free run per browser: hide the button so a second click does not look like it should work.
        btn.hidden = true;
      }
      try {
        if (typeof window.pjTrackMeta === "function") window.pjTrackMeta("trackCustom", "MatchComplete");
      } catch (ignore) {
        /* pixel missing or consent denied */
      }
      document.getElementById("results-title").focus();
    } catch (err) {
      setStatus("Something went wrong. Please check your connection and try again.", true);
    } finally {
      inFlight = false;
      btn.disabled = false;
      btn.textContent = "Find my jobs";
    }
  });
})();
