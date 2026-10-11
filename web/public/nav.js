(function () {
  "use strict";

  var wrap = document.querySelector(".nav-more");
  var btn = document.getElementById("nav-more-btn");
  var panel = document.getElementById("nav-more-panel");
  if (!wrap || !btn || !panel) return;

  function setOpen(open, returnFocus) {
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    panel.hidden = !open;
    if (!open && returnFocus) btn.focus();
  }

  btn.addEventListener("click", function () {
    setOpen(btn.getAttribute("aria-expanded") !== "true", false);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape" || panel.hidden) return;
    event.preventDefault();
    setOpen(false, true);
  });

  document.addEventListener("click", function (event) {
    if (panel.hidden || wrap.contains(event.target)) return;
    setOpen(false, false);
  });

  wrap.addEventListener("focusout", function (event) {
    if (panel.hidden) return;
    if (event.relatedTarget && wrap.contains(event.relatedTarget)) return;
    if (!event.relatedTarget) return;
    setOpen(false, false);
  });
})();
