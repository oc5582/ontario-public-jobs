/**
 * First-party ad attribution for every page.
 * Stores the first landing touch for about 90 days and refreshes the last touch.
 * Does not call any third party. Keep the rules aligned with web/lib/attribution.ts.
 */
(function (window) {
  var document = window.document;
  var location = window.location;
  var localStorage = window.localStorage;
  var KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid"];
  var FIRST = "pj_attr_first";
  var LAST = "pj_attr_last";
  var TTL = 90 * 24 * 60 * 60 * 1000;
  var MAX = 200;
  var SKEW = 24 * 60 * 60 * 1000;

  function clean(value) {
    if (value === null || value === undefined) return "";
    return String(value).replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, MAX);
  }

  function touchFrom(params) {
    var touch = {};
    for (var i = 0; i < KEYS.length; i++) {
      var value = clean(params.get(KEYS[i]));
      if (value) touch[KEYS[i]] = value;
    }
    return touch;
  }

  function has(touch) {
    for (var i = 0; i < KEYS.length; i++) if (touch[KEYS[i]]) return true;
    return false;
  }

  function same(a, b) {
    for (var i = 0; i < KEYS.length; i++) {
      if ((a[KEYS[i]] || "") !== (b[KEYS[i]] || "")) return false;
    }
    return true;
  }

  function encode(record) {
    var params = new URLSearchParams();
    params.set("at", String(record.at));
    for (var i = 0; i < KEYS.length; i++) {
      if (record.touch[KEYS[i]]) params.set(KEYS[i], record.touch[KEYS[i]]);
    }
    return params.toString();
  }

  function decode(raw, now) {
    if (!raw) return null;
    var text = raw;
    if (text.indexOf("=") === -1) {
      try {
        text = decodeURIComponent(raw);
      } catch (error) {
        return null;
      }
    }
    var params = new URLSearchParams(text);
    var at = Number(params.get("at"));
    if (!isFinite(at) || at <= 0 || now - at > TTL || at > now + SKEW) return null;
    var touch = touchFrom(params);
    if (!has(touch)) return null;
    return { at: at, touch: touch };
  }

  function maxAge(at, now) {
    var ttlSec = TTL / 1000;
    var remaining = Math.floor((at + TTL - now) / 1000);
    if (remaining <= 0) return 0;
    return remaining < ttlSec ? remaining : ttlSec;
  }

  function cookieGet(name) {
    var parts = document.cookie ? document.cookie.split(";") : [];
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i].replace(/^\s+/, "");
      var eq = part.indexOf("=");
      if (eq === -1) continue;
      if (part.slice(0, eq) === name) return part.slice(eq + 1);
    }
    return "";
  }

  function cookieSet(name, value, age) {
    if (age <= 0) return;
    var secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = name + "=" + value + "; Path=/; Max-Age=" + age + "; SameSite=Lax" + secure;
  }

  function lsGet(name) {
    try {
      return localStorage.getItem(name) || "";
    } catch (error) {
      return "";
    }
  }

  function lsSet(name, value) {
    try {
      localStorage.setItem(name, value);
    } catch (error) {
      /* storage blocked */
    }
  }

  function readSlot(name, now) {
    return { ls: decode(lsGet(name), now), ck: decode(cookieGet(name), now) };
  }

  function pickOlder(a, b) {
    if (!a) return b;
    if (!b) return a;
    return a.at <= b.at ? a : b;
  }

  function pickNewer(a, b) {
    if (!a) return b;
    if (!b) return a;
    return a.at >= b.at ? a : b;
  }

  function needsWrite(record, slots) {
    if (!record) return false;
    if (!slots.ls || !slots.ck) return true;
    return slots.ls.at !== record.at || slots.ck.at !== record.at || !same(slots.ls.touch, record.touch) || !same(slots.ck.touch, record.touch);
  }

  function write(name, record, now) {
    var age = maxAge(record.at, now);
    if (age <= 0) return;
    var encoded = encode(record);
    cookieSet(name, encoded, age);
    lsSet(name, encoded);
  }

  function capture(search) {
    var now = Date.now();
    var raw = search || "";
    var params = new URLSearchParams(raw.charAt(0) === "?" ? raw.slice(1) : raw);
    var incoming = touchFrom(params);
    var firstSlots = readSlot(FIRST, now);
    var lastSlots = readSlot(LAST, now);
    var existingFirst = pickOlder(firstSlots.ls, firstSlots.ck);
    var existingLast = pickNewer(lastSlots.ls, lastSlots.ck);
    var nextFirst = existingFirst;
    var nextLast = existingLast;
    if (has(incoming)) {
      nextFirst = existingFirst || { at: now, touch: incoming };
      nextLast = existingLast && same(existingLast.touch, incoming) ? existingLast : { at: now, touch: incoming };
    }
    if (needsWrite(nextFirst, firstSlots)) write(FIRST, nextFirst, now);
    if (needsWrite(nextLast, lastSlots)) write(LAST, nextLast, now);
  }

  function read() {
    var now = Date.now();
    var first = pickOlder(readSlot(FIRST, now).ls, readSlot(FIRST, now).ck);
    var last = pickNewer(readSlot(LAST, now).ls, readSlot(LAST, now).ck);
    return { first: first ? first.touch : {}, last: last ? last.touch : {} };
  }

  window.pjCaptureAttribution = capture;
  window.pjReadAttribution = read;
  try {
    capture(location.search || "");
  } catch (error) {
    /* leave checkout able to run without attribution */
  }
})(window);
