(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (root.document) {
    api.init();
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  var PAGE_SIZE = 25;

  function norm(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function closingInfo(iso, now) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    if (!match) return { text: "", urgent: false };
    var close = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var diff = Math.round((close.getTime() - today.getTime()) / 86400000);
    if (diff === 0) return { text: "Closes today", urgent: true };
    if (diff === 1) return { text: "Closes in 1 day", urgent: true };
    if (diff > 1 && diff <= 7) return { text: "Closes in " + diff + " days", urgent: true };
    return {
      text: close.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
      urgent: false,
    };
  }

  function isStillOpen(job, now) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((job && job.closing) || "");
    if (!match) return true;
    var close = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return close.getTime() >= today.getTime();
  }

  function countLabel(total, filtering) {
    if (filtering) return total === 1 ? "matching opening" : "matching openings";
    return total === 1 ? "opening" : "openings";
  }

  function init() {
    var dataEl = document.getElementById("listings-data");
    var listEl = document.getElementById("job-list");
    var searchEl = document.getElementById("job-search");
    if (!dataEl || !listEl || !searchEl) return;

    var jobs = [];
    try {
      jobs = JSON.parse(dataEl.textContent || "[]");
    } catch (err) {
      return;
    }
    if (!Array.isArray(jobs)) return;

    var countEl = document.getElementById("listings-count");
    var labelEl = document.getElementById("listings-count-label");
    var emptyEl = document.getElementById("listings-empty");
    var pagerEl = document.getElementById("pager");
    var prevEl = document.getElementById("page-prev");
    var nextEl = document.getElementById("page-next");
    var statusEl = document.getElementById("page-status");
    var page = 0;
    var query = "";

    function filtered() {
      var q = norm(query);
      var now = new Date();
      return jobs.filter(function (job) {
        if (!isStillOpen(job, now)) return false;
        if (!q) return true;
        var hay = norm([job.title, job.employer, job.alias].filter(Boolean).join(" "));
        return hay.indexOf(q) !== -1;
      });
    }

    function el(tag, className, text) {
      var node = document.createElement(tag);
      if (className) node.className = className;
      if (text) node.textContent = text;
      return node;
    }

    function renderRow(job) {
      var li = document.createElement("li");
      var link = el("a", "job-row");
      link.href = job.href;

      var main = el("span", "job-main");
      main.appendChild(el("span", "job-title", job.title || "Untitled"));

      var employer = job.employer ? el("span", "job-employer", job.employer) : null;
      var pill = job.type ? el("span", "pill", job.type) : null;
      if (employer || pill) {
        var sub = el("span", "job-sub");
        if (employer) sub.appendChild(employer);
        if (pill) sub.appendChild(pill);
        main.appendChild(sub);
      }
      link.appendChild(main);

      var close = closingInfo(job.closing, new Date());
      if (job.location || close.text) {
        var side = el("span", "job-side");
        if (job.location) side.appendChild(el("span", "job-location", job.location));
        if (close.text) {
          var time = document.createElement("time");
          time.className = close.urgent ? "job-closing is-urgent" : "job-closing";
          if (job.closing) time.dateTime = job.closing;
          time.textContent = close.text;
          side.appendChild(time);
        }
        link.appendChild(side);
      }

      li.appendChild(link);
      return li;
    }

    function render(moveFocus) {
      var rows = filtered();
      var filtering = norm(query).length > 0;
      var pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE) || 1);
      if (page > pages - 1) page = pages - 1;
      if (page < 0) page = 0;
      var start = page * PAGE_SIZE;
      var slice = rows.slice(start, start + PAGE_SIZE);

      listEl.textContent = "";
      slice.forEach(function (job) {
        listEl.appendChild(renderRow(job));
      });

      if (countEl) countEl.textContent = String(rows.length);
      if (labelEl) labelEl.textContent = countLabel(rows.length, filtering);
      if (emptyEl) emptyEl.hidden = rows.length !== 0;
      listEl.hidden = rows.length === 0;

      var showPager = rows.length > PAGE_SIZE;
      if (pagerEl) pagerEl.hidden = !showPager;
      if (prevEl) prevEl.disabled = page === 0;
      if (nextEl) nextEl.disabled = page >= pages - 1;
      if (statusEl) statusEl.textContent = "Page " + (page + 1) + " of " + pages;

      if (moveFocus) listEl.focus();
    }

    searchEl.addEventListener("input", function () {
      query = searchEl.value;
      page = 0;
      render(false);
    });

    if (prevEl) {
      prevEl.addEventListener("click", function () {
        if (page > 0) {
          page -= 1;
          render(true);
        }
      });
    }
    if (nextEl) {
      nextEl.addEventListener("click", function () {
        page += 1;
        render(true);
      });
    }

    render(false);
  }

  return { closingInfo: closingInfo, countLabel: countLabel, init: init };
});
