#!/usr/bin/env node
/**
 * Verify MCP servers defined in mcp.local.json (or mcp.json fallback).
 * Tests HTTP servers with initialize handshake; stdio servers via subprocess.
 */

import { readFileSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CONFIG_PATH = existsSync(resolve(ROOT, "mcp.local.json"))
  ? resolve(ROOT, "mcp.local.json")
  : resolve(ROOT, "mcp.json");

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(ROOT, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq);
      let val = trimmed.slice(eq + 1);
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const INIT_REQUEST = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "premortem-mcp-verify", version: "1.0.0" },
  },
};

function authVariantsFor(name) {
  const variants = [{ label: "none", headers: {} }];

  if (name === "GitLab" && process.env.GITLAB_TOKEN) {
    variants.push({
      label: "Private-Token",
      headers: { "Private-Token": process.env.GITLAB_TOKEN },
    });
    variants.push({
      label: "Bearer",
      headers: { Authorization: `Bearer ${process.env.GITLAB_TOKEN}` },
    });
  }

  if (
    name.startsWith("Cloudflare") &&
    name !== "Cloudflare Docs" &&
    name !== "Cloudflare Agents Docs" &&
    process.env.CLOUDFLARE_API_TOKEN
  ) {
    variants.push({
      label: "Bearer",
      headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` },
    });
  }

  return variants;
}

function parseMcpPayload(bodyText) {
  let parsed = null;
  const jsonLine = bodyText
    .split("\n")
    .map((l) => l.replace(/^data:\s*/, "").trim())
    .find((l) => l.startsWith("{"));
  if (jsonLine) {
    try {
      parsed = JSON.parse(jsonLine);
    } catch {
      /* ignore */
    }
  }
  if (!parsed && bodyText.trim().startsWith("{")) {
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      /* ignore */
    }
  }
  return parsed;
}

async function postHttpMessage(url, headers, body, sessionId) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...(sessionId ? { "mcp-session-id": sessionId } : {}),
        ...headers,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const bodyText = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      contentType: res.headers.get("content-type") ?? "",
      sessionId: res.headers.get("mcp-session-id") ?? sessionId ?? null,
      parsed: parseMcpPayload(bodyText),
      bodyText,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function collectHttpCapabilities(url, headers, sessionId) {
  const methods = [
    ["tools/list", "tools"],
    ["resources/list", "resources"],
    ["prompts/list", "prompts"],
  ];
  const capabilitySummary = {};

  await postHttpMessage(
    url,
    headers,
    { jsonrpc: "2.0", method: "notifications/initialized", params: {} },
    sessionId
  ).catch(() => null);

  for (const [method, key] of methods) {
    try {
      const response = await postHttpMessage(
        url,
        headers,
        { jsonrpc: "2.0", id: `${key}-1`, method, params: {} },
        sessionId
      );
      const result = response.parsed?.result ?? null;
      const values =
        result?.[key] ??
        result?.items ??
        result?.results ??
        [];
      capabilitySummary[key] = {
        status: response.ok && result ? "OK" : response.status === 401 || response.status === 403 ? "AUTH_REQUIRED" : "UNAVAILABLE",
        count: Array.isArray(values) ? values.length : 0,
      };
    } catch (err) {
      capabilitySummary[key] = {
        status: err?.name === "AbortError" ? "TIMEOUT" : "FAIL",
        count: 0,
      };
    }
  }

  return capabilitySummary;
}

async function verifyHttpOnce(url, headers) {
  try {
    const res = await postHttpMessage(url, headers, INIT_REQUEST);
    const sessionId = res.sessionId;
    const contentType = res.contentType;
    const bodyText = res.bodyText;
    const parsed = res.parsed;
    const hasInitResult =
      parsed?.result?.serverInfo || parsed?.result?.protocolVersion;
    const isAuthError = res.status === 401 || res.status === 403;
    const isReachable = res.status < 500;

    let status;
    if (hasInitResult) status = "OK";
    else if (isAuthError) status = "AUTH_REQUIRED";
    else if (isReachable) status = "REACHABLE";
    else status = "FAIL";

    const capabilities =
      status === "OK" && sessionId
        ? await collectHttpCapabilities(url, headers, sessionId)
        : null;

    return {
      status,
      httpStatus: res.status,
      sessionId: sessionId ?? null,
      contentType,
      serverInfo: parsed?.result?.serverInfo ?? null,
      error: parsed?.error ?? null,
      capabilities,
      bodyPreview: bodyText.slice(0, 200).replace(/\s+/g, " "),
    };
  } catch (err) {
    return {
      status: "FAIL",
      error: err.name === "AbortError" ? "timeout (15s)" : String(err.message ?? err),
    };
  }
}

async function verifyHttp(name, config) {
  const url = config.url;
  const baseHeaders = config.headers ?? {};
  const variants = authVariantsFor(name);
  let best = null;

  for (const variant of variants) {
    const attempt = await verifyHttpOnce(url, { ...baseHeaders, ...variant.headers });
    attempt.auth = variant.label;
    if (attempt.status === "OK") return attempt;
    if (!best || rank(attempt.status) > rank(best.status)) best = attempt;
  }

  return best;
}

function rank(status) {
  return { OK: 4, REACHABLE: 3, AUTH_REQUIRED: 2, CONFIG_MISSING: 1, FAIL: 0, SKIP: 0 }[
    status
  ];
}

function verifyStdio(name, config) {
  return new Promise((resolvePromise) => {
    const cmd = config.command;
    const args = (config.args ?? []).map((a) =>
      a.startsWith("./") ? resolve(ROOT, a.slice(2)) : a
    );
    const cwd = config.cwd ? resolve(ROOT, config.cwd) : ROOT;

    const child = spawn(cmd, args, {
      cwd,
      env: { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    let initializeComplete = false;
    const capabilitySummary = {
      tools: { status: "UNAVAILABLE", count: 0 },
      resources: { status: "UNAVAILABLE", count: 0 },
      prompts: { status: "UNAVAILABLE", count: 0 },
    };
    const seenIds = new Set();

    const finish = (result) => {
      if (settled) return;
      settled = true;
      try {
        child.kill("SIGTERM");
      } catch {
        /* ignore */
      }
      resolvePromise(result);
    };

    const timer = setTimeout(() => {
      finish({ status: "FAIL", error: "timeout (20s)", stderr: stderr.slice(0, 300) });
    }, 20000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      const lines = stdout
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("{"));

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          const responseId = parsed.id ?? null;
          if (responseId && seenIds.has(responseId)) continue;
          if (responseId) seenIds.add(responseId);

          if (!initializeComplete && (parsed.result?.serverInfo || parsed.result?.protocolVersion)) {
            initializeComplete = true;
            child.stdin.write(
              JSON.stringify({
                jsonrpc: "2.0",
                method: "notifications/initialized",
                params: {},
              }) + "\n"
            );
            child.stdin.write(
              JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }) +
                "\n"
            );
            child.stdin.write(
              JSON.stringify({ jsonrpc: "2.0", id: 3, method: "resources/list", params: {} }) +
                "\n"
            );
            child.stdin.write(
              JSON.stringify({ jsonrpc: "2.0", id: 4, method: "prompts/list", params: {} }) +
                "\n"
            );
            continue;
          }

          if (responseId === 2) {
            capabilitySummary.tools = {
              status: parsed.result ? "OK" : parsed.error ? "UNAVAILABLE" : "FAIL",
              count: Array.isArray(parsed.result?.tools) ? parsed.result.tools.length : 0,
            };
          }
          if (responseId === 3) {
            capabilitySummary.resources = {
              status: parsed.result ? "OK" : parsed.error ? "UNAVAILABLE" : "FAIL",
              count: Array.isArray(parsed.result?.resources)
                ? parsed.result.resources.length
                : 0,
            };
          }
          if (responseId === 4) {
            capabilitySummary.prompts = {
              status: parsed.result ? "OK" : parsed.error ? "UNAVAILABLE" : "FAIL",
              count: Array.isArray(parsed.result?.prompts) ? parsed.result.prompts.length : 0,
            };
          }

          if (
            initializeComplete &&
            seenIds.has(2) &&
            seenIds.has(3) &&
            seenIds.has(4)
          ) {
            clearTimeout(timer);
            finish({
              status: "OK",
              serverInfo: parsed.result?.serverInfo ?? null,
              capabilities: capabilitySummary,
              stderr: stderr.slice(0, 200) || null,
            });
            return;
          }
        } catch {
          /* wait for more data */
        }
      }
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      finish({ status: "FAIL", error: String(err.message ?? err) });
    });

    child.on("exit", (code) => {
      if (settled) return;
      clearTimeout(timer);
      if (stderr.includes("DATABASE_URL") || stderr.includes("POSTGRES")) {
        finish({ status: "CONFIG_MISSING", error: stderr.trim().slice(0, 300) });
        return;
      }
      finish({
        status: "FAIL",
        error: `exit code ${code}`,
        stderr: stderr.slice(0, 300) || null,
        stdout: stdout.slice(0, 200) || null,
      });
    });

    child.stdin.write(JSON.stringify(INIT_REQUEST) + "\n");
  });
}

async function main() {
  loadEnv();
  const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  const servers = config.mcpServers ?? {};

  console.log(`Config: ${CONFIG_PATH}`);
  console.log(`Servers: ${Object.keys(servers).length}`);
  console.log(
    `Env: GITLAB_TOKEN=${process.env.GITLAB_TOKEN ? "set" : "missing"}, CLOUDFLARE_API_TOKEN=${process.env.CLOUDFLARE_API_TOKEN ? "set" : "missing"}, DATABASE_URL=${process.env.DATABASE_URL ? "set" : "missing"}\n`
  );

  const results = [];

  for (const [name, serverConfig] of Object.entries(servers)) {
    process.stdout.write(`Checking ${name}... `);
    let result;
    if (serverConfig.url) {
      result = await verifyHttp(name, serverConfig);
    } else if (serverConfig.command) {
      result = await verifyStdio(name, serverConfig);
    } else {
      result = { status: "SKIP", error: "unknown transport" };
    }
    results.push({ name, ...result });
    console.log(result.status);
  }

  console.log("\n=== MCP Verification Report ===\n");

  for (const r of results) {
    const icon =
      r.status === "OK"
        ? "✅"
        : r.status === "AUTH_REQUIRED"
          ? "🔐"
          : r.status === "REACHABLE"
            ? "🟡"
            : r.status === "CONFIG_MISSING"
              ? "⚙️"
              : "❌";
    console.log(`${icon} ${r.name}: ${r.status}`);
    if (r.auth) console.log(`   Auth tried: ${r.auth}`);
    if (r.httpStatus) console.log(`   HTTP ${r.httpStatus}`);
    if (r.serverInfo)
      console.log(
        `   Server: ${r.serverInfo.name ?? "?"} ${r.serverInfo.version ?? ""}`.trim()
      );
    if (r.capabilities) {
      for (const [capabilityName, capability] of Object.entries(r.capabilities)) {
        console.log(
          `   ${capabilityName}: ${capability.status}${typeof capability.count === "number" ? ` (${capability.count})` : ""}`
        );
      }
    }
    if (r.sessionId) console.log(`   Session: ${r.sessionId.slice(0, 20)}...`);
    if (r.error) {
      const errStr =
        typeof r.error === "object"
          ? JSON.stringify(r.error).slice(0, 200)
          : String(r.error).slice(0, 200);
      console.log(`   Detail: ${errStr}`);
    }
    if (r.bodyPreview && r.status !== "OK")
      console.log(`   Body: ${r.bodyPreview}`);
    if (r.stderr) console.log(`   stderr: ${r.stderr}`);
    console.log();
  }

  const ok = results.filter((r) => r.status === "OK").length;
  const partial = results.filter((r) =>
    ["AUTH_REQUIRED", "REACHABLE", "CONFIG_MISSING"].includes(r.status)
  ).length;
  const fail = results.filter((r) => r.status === "FAIL" || r.status === "SKIP").length;

  console.log(`Summary: ${ok} working, ${partial} partial/config, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
