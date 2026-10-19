// A local HTTPS server that answers for torob.com, digikala.com and emalls.ir.
// Chromium is started with --host-resolver-rules mapping those hosts to
// 127.0.0.1, so tabs opened by the extension load these pages.
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { captcha, digikalaSearchApi, digikalaShell, emallsSearch, torobProduct, torobSearch } from "./shops";

export const SHOP_HOSTS = ["torob.com", "api.torob.com", "www.digikala.com", "api.digikala.com", "emalls.ir"];

export type ShopServer = { close(): Promise<void>; opened: string[]; state: { emallsBlocked: boolean } };

export async function startShopServer(port = 443): Promise<ShopServer> {
  const dir = mkdtempSync(path.join(os.tmpdir(), "pk-cert-"));
  execSync(`openssl req -x509 -newkey rsa:2048 -nodes -keyout ${dir}/k.pem -out ${dir}/c.pem -days 1 -subj /CN=shops.test`, { stdio: "ignore" });
  const opened: string[] = [];
  const state = { emallsBlocked: false };
  const server = https.createServer({ key: readFileSync(`${dir}/k.pem`), cert: readFileSync(`${dir}/c.pem`) }, (req, res) => {
    const host = (req.headers.host ?? "").split(":")[0];
    const url = new URL(req.url ?? "/", `https://${host}`);
    const send = (body: string, type = "text/html; charset=utf-8", extra: Record<string, string> = {}) => {
      res.writeHead(200, { "Content-Type": type, ...extra });
      res.end(body);
    };
    if (host === "api.digikala.com") {
      return send(JSON.stringify(digikalaSearchApi), "application/json", {
        "Access-Control-Allow-Origin": "https://www.digikala.com",
        "Access-Control-Allow-Credentials": "true",
      });
    }
    if (url.pathname === "/favicon.ico") return send("");
    opened.push(url.href);
    if (host === "torob.com") return send(url.pathname.startsWith("/p/") ? torobProduct() : torobSearch(url.searchParams.get("query") ?? ""));
    if (host === "www.digikala.com") return send(digikalaShell());
    if (host === "emalls.ir") return send(state.emallsBlocked ? captcha() : emallsSearch());
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve, reject) => server.once("error", reject).listen(port, "127.0.0.1", resolve));
  return { opened, state, close: () => new Promise((r) => server.close(() => r())) };
}

export function chromiumArgs() {
  return [
    `--host-resolver-rules=${SHOP_HOSTS.map((h) => `MAP ${h} 127.0.0.1`).join(", ")}`,
    "--ignore-certificate-errors",
    "--no-proxy-server",
  ];
}
