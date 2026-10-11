// Tell Google and IndexNow about job URLs the importer changed.
//
//   node --experimental-strip-types scripts/notify_indexing.ts /tmp/pj-index.json
//
// The JSON file is { "updated": ["https://..."], "deleted": ["https://..."] },
// written by scripts/import_listings.py --notify-out.
//
// GOOGLE_INDEXING_SA_JSON  service account JSON, or a path to that file.
//                          Scope used: https://www.googleapis.com/auth/indexing
// INDEXNOW_KEY             8–128 letters, digits, or hyphens. Also served at
//                          /indexnow.txt/ (the app adds a trailing slash).
//
// If both are unset, this exits 0 and does nothing. The Next.js build does
// not need either variable.

import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const INDEXNOW_KEY_RE = /^[A-Za-z0-9-]{8,128}$/;

export type Notice = { updated: string[]; deleted: string[] };

type ServiceAccount = { client_email: string; private_key: string };

export function loadServiceAccount(raw: string): ServiceAccount {
  const trimmed = raw.trim();
  const text = trimmed.startsWith("{") ? trimmed : readFileSync(trimmed, "utf8");
  const parsed = JSON.parse(text) as { client_email?: string; private_key?: string };
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("GOOGLE_INDEXING_SA_JSON needs client_email and private_key");
  }
  return { client_email: parsed.client_email, private_key: parsed.private_key };
}

export function indexNowBody(siteUrl: string, key: string, urls: string[]): Record<string, unknown> {
  const origin = siteUrl.replace(/\/$/, "");
  const host = new URL(origin).host;
  return {
    host,
    key,
    keyLocation: `${origin}/indexnow.txt/`,
    urlList: urls,
  };
}

function base64url(value: string | Buffer): string {
  const buffer = typeof value === "string" ? Buffer.from(value) : value;
  return buffer.toString("base64url");
}

async function googleAccessToken(account: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/indexing",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const jwt = `${unsigned}.${signer.sign(account.private_key).toString("base64url")}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const body = (await response.json()) as { access_token?: string; error?: string };
  if (!response.ok || !body.access_token) {
    throw new Error(`Google token request failed (${response.status}): ${body.error || "no access_token"}`);
  }
  return body.access_token;
}

async function publishGoogle(token: string, url: string, type: "URL_UPDATED" | "URL_DELETED"): Promise<number> {
  const response = await fetch("https://indexing.googleapis.com/v3/urlNotifications:publish", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, type }),
  });
  return response.status;
}

async function publishIndexNow(siteUrl: string, key: string, urls: string[]): Promise<void> {
  for (let start = 0; start < urls.length; start += 10000) {
    const chunk = urls.slice(start, start + 10000);
    const response = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(indexNowBody(siteUrl, key, chunk)),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`IndexNow failed (${response.status}): ${text.slice(0, 300)}`);
    }
  }
}

function readNotice(path: string | undefined): Notice {
  const raw = path ? readFileSync(path, "utf8") : "";
  if (!raw.trim()) return { updated: [], deleted: [] };
  const parsed = JSON.parse(raw) as { updated?: unknown; deleted?: unknown };
  const urls = (value: unknown) => (Array.isArray(value) ? value.filter((item) => typeof item === "string") : []);
  return { updated: urls(parsed.updated), deleted: urls(parsed.deleted) };
}

async function main(): Promise<void> {
  const googleRaw = (process.env.GOOGLE_INDEXING_SA_JSON || "").trim();
  const indexNowKey = (process.env.INDEXNOW_KEY || "").trim();
  if (!googleRaw && !indexNowKey) {
    console.log("Indexing notify skipped: GOOGLE_INDEXING_SA_JSON and INDEXNOW_KEY are unset.");
    return;
  }
  if (indexNowKey && !INDEXNOW_KEY_RE.test(indexNowKey)) {
    throw new Error("INDEXNOW_KEY must be 8–128 characters of letters, digits, or hyphens.");
  }
  const notice = readNotice(process.argv[2]);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://publicjobs.ca").replace(/\/$/, "");

  if (googleRaw) {
    const account = loadServiceAccount(googleRaw);
    const token = await googleAccessToken(account);
    const queue: { url: string; type: "URL_UPDATED" | "URL_DELETED" }[] = [
      ...notice.updated.map((url) => ({ url, type: "URL_UPDATED" as const })),
      ...notice.deleted.map((url) => ({ url, type: "URL_DELETED" as const })),
    ];
    let sent = 0;
    for (const item of queue) {
      const status = await publishGoogle(token, item.url, item.type);
      if (status === 429) {
        console.warn(
          `Google Indexing API quota reached after ${sent} of ${queue.length}. ` +
            "The default quota is about 200 URLs a day. Run this script again with the same manifest tomorrow.",
        );
        break;
      }
      if (status < 200 || status >= 300) {
        throw new Error(`Google Indexing API returned ${status} for ${item.type} ${item.url}`);
      }
      sent += 1;
    }
    if (sent === queue.length) console.log(`Google Indexing API: ${sent} notification(s).`);
  }

  if (indexNowKey) {
    const urls = [...notice.updated, ...notice.deleted];
    if (urls.length) {
      await publishIndexNow(siteUrl, indexNowKey, urls);
      console.log(`IndexNow: ${urls.length} URL(s).`);
    } else {
      console.log("IndexNow: no URLs.");
    }
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
