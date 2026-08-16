/* global process, URL, console, Buffer */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const port = Number(process.env.PORT ?? 8080);
const token = process.env.RCC_WORKSPACE_TOKEN ?? "";
const dataDirectory = path.resolve(process.env.RCC_WORKSPACE_DATA ?? "./workspace-data");
if (token.length < 24) throw new Error("Set RCC_WORKSPACE_TOKEN to a random value of at least 24 characters");
await fs.mkdir(dataDirectory, { recursive: true });

http.createServer(async (request, response) => {
  const match = new URL(request.url ?? "/", "http://localhost").pathname.match(/^\/workspaces\/([a-zA-Z0-9._-]{1,80})$/);
  if (!match) return json(response, 404, { error: "Not found" });
  if (!authorized(request.headers.authorization)) return json(response, 401, { error: "Unauthorized" });
  const file = path.join(dataDirectory, `${match[1]}.json`);
  if (request.method === "HEAD") { response.writeHead(204); return response.end(); }
  if (request.method === "GET") { try { return json(response, 200, JSON.parse(await fs.readFile(file, "utf8"))); } catch { return json(response, 404, { error: "Workspace not found" }); } }
  if (request.method === "PUT") {
    try { const body = await readBody(request, 2 * 1024 * 1024); const parsed = JSON.parse(body); const temporary = `${file}.tmp`; await fs.writeFile(temporary, JSON.stringify(parsed), { mode: 0o600 }); await fs.rename(temporary, file); return json(response, 200, { saved: true }); }
    catch { return json(response, 400, { error: "Invalid workspace payload" }); }
  }
  return json(response, 405, { error: "Method not allowed" });
}).listen(port, "0.0.0.0", () => console.log(`RCC shared workspace service listening on ${port}`));

function authorized(header) { const provided = Buffer.from((header ?? "").replace(/^Bearer\s+/i, "")); const expected = Buffer.from(token); return provided.length === expected.length && crypto.timingSafeEqual(provided, expected); }
function json(response, status, value) { response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" }); response.end(JSON.stringify(value)); }
function readBody(request, limit) { return new Promise((resolve, reject) => { let body = ""; request.setEncoding("utf8"); request.on("data", (chunk) => { body += chunk; if (body.length > limit) { request.destroy(); reject(new Error("Too large")); } }); request.on("end", () => resolve(body)); request.on("error", reject); }); }
