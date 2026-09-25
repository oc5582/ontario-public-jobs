/**
 * Local stand-in for the signup Worker. It does not call Resend.
 * Run: node worker/dev-server.mjs
 * Then set window.SIGNUP_ENDPOINT in signup.config.js to http://127.0.0.1:8787
 */
import { handleSignup } from "./signup.js";

const calls = [];

globalThis.fetch = async function mockFetch(url, options = {}) {
  calls.push({ url: String(url), method: options.method || "GET", body: options.body || "" });
  const path = String(url);
  if (path.endsWith("/contacts") && (options.method || "GET") === "POST") {
    return new Response(JSON.stringify({ object: "contact", id: "local-test" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response("not found", { status: 404 });
};

const server = (await import("node:http")).createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  const request = new Request("http://127.0.0.1:8787" + (req.url || "/"), {
    method: req.method,
    headers: req.headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
  });
  const response = await handleSignup(request, { RESEND_API_KEY: "local-dev-not-a-real-key" });
  const text = await response.text();
  const headers = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  res.writeHead(response.status, headers);
  res.end(text);
  const last = calls[calls.length - 1];
  if (last && String(last.url).includes("api.resend.com")) {
    console.log("Would save contact:", last.method, last.url);
    console.log(last.body);
  }
});

server.listen(8787, "127.0.0.1", () => {
  console.log("Local signup endpoint at http://127.0.0.1:8787");
});
