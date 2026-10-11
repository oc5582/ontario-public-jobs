import assert from "node:assert/strict";
import { displayLocation } from "../web/lib/display-location.ts";

const richmond = [
  {
    "@type": "Place",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Richmond Hill",
      addressRegion: "ON",
      addressCountry: "CA",
    },
  },
];

assert.equal(displayLocation("Richmond Hill", richmond), "Richmond Hill, ON");
assert.equal(
  displayLocation("Toronto; milton", [
    { address: { addressLocality: "Toronto", addressRegion: "ON" } },
    { address: { addressLocality: "Milton", addressRegion: "ON" } },
  ]),
  "Toronto, ON; Milton, ON",
);
assert.equal(displayLocation("TORONT", [{ address: { addressLocality: "Toronto", addressRegion: "ON" } }]), "Toronto, ON");
assert.equal(displayLocation("Somewhere the parser missed", []), "Somewhere the parser missed");
assert.equal(displayLocation("milton", null), "milton");
assert.equal(displayLocation("  ", [{ address: {} }]), "  ");

console.log("display location ok");
