import assert from "node:assert/strict";
import { isFrench } from "../web/lib/language.ts";

const tfo = "ontario-french-language-educational-communications-authority-tfo";

assert.equal(isFrench({ title: "696 FR - Analyste (principal(e)) des risques, ERGP", employer_slug: "edc" }), true);
assert.equal(isFrench({ title: "Administrateur(trice) IA, Plateforme M365 Copilot - FR 328", employer_slug: "edc" }), true);
assert.equal(isFrench({ title: "Associé(e) de recherche - 613 FR", employer_slug: "edc" }), true);
assert.equal(isFrench({ title: "Journaliste", employer_slug: tfo }), true);
assert.equal(isFrench({ title: "Infrastructure Officer", employer_slug: "city-of-toronto" }), false);
assert.equal(isFrench({ title: "Offer of employment", employer_slug: "city-of-toronto" }), false);
assert.equal(isFrench({ title: "Seasonal Labourer - Parks", employer_slug: "city-of-richmond-hill" }), false);

console.log("language ok");
