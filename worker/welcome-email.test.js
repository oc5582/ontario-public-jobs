import assert from "node:assert/strict";
import { test } from "node:test";
import { WELCOME_HTML, WELCOME_TEXT } from "./welcome-email.js";

const REMOVED =
  "Every job alert email includes a one-click unsubscribe link, so you can stop anytime. PublicJobs.ca is a free, independent job alert list for public employer postings and is not affiliated with any government.";

test("welcome email offers the broadcast unsubscribe link and drops the old paragraph", () => {
  assert.doesNotMatch(WELCOME_HTML, /Every job alert email includes/);
  assert.doesNotMatch(WELCOME_TEXT, /Every job alert email includes/);
  assert.equal(WELCOME_HTML.includes(REMOVED), false);
  assert.equal(WELCOME_TEXT.includes(REMOVED), false);

  const browse = WELCOME_HTML.indexOf("Browse openings anytime:");
  const button = WELCOME_HTML.indexOf("{{{RESEND_UNSUBSCRIBE_URL}}}");
  const address = WELCOME_HTML.indexOf("65 Thorncliffe Park Drive");
  assert.ok(browse > 0 && button > browse && address > button);
  assert.match(
    WELCOME_HTML,
    /<a href="\{\{\{RESEND_UNSUBSCRIBE_URL\}\}\}"[^>]*>Unsubscribe<\/a>/
  );
  assert.match(WELCOME_HTML, /border-color:#1F4E79/);

  const footerAt = WELCOME_HTML.indexOf("65 Thorncliffe Park Drive");
  const footerTag = WELCOME_HTML.lastIndexOf("<td", footerAt);
  const footer = WELCOME_HTML.slice(footerTag, WELCOME_HTML.indexOf("</td>", footerAt));
  assert.match(footer, /font-size:8px/);
  assert.match(footer, /color:#6b7280/);
  assert.match(footer, /mailto:hello@publicjobs\.ca/);
  assert.match(footer, /https:\/\/publicjobs\.ca\/privacy\//);

  const textBrowse = WELCOME_TEXT.indexOf("Browse openings anytime: https://publicjobs.ca");
  const textUnsub = WELCOME_TEXT.indexOf("Unsubscribe: {{{RESEND_UNSUBSCRIBE_URL}}}");
  const textAddress = WELCOME_TEXT.indexOf("65 Thorncliffe Park Drive");
  assert.ok(textBrowse > 0 && textUnsub > textBrowse && textAddress > textUnsub);
  assert.match(WELCOME_TEXT, /hello@publicjobs\.ca/);
  assert.match(WELCOME_TEXT, /https:\/\/publicjobs\.ca\/privacy\//);
});
