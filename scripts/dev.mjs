import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const DEV_PORT = 5173;
const BUILTIN_PHP_PORT = 8000;

const children = [];

function readApiProxyTarget() {
  try {
    const envPath = path.join(process.cwd(), ".env.development");
    const content = fs.readFileSync(envPath, "utf8");
    const match = content.match(/^VITE_API_PROXY_TARGET=(.+)$/m);
    return match?.[1]?.trim() || `http://127.0.0.1:${BUILTIN_PHP_PORT}`;
  } catch {
    return `http://127.0.0.1:${BUILTIN_PHP_PORT}`;
  }
}

function freePort(port) {
  if (process.platform !== "win32") {
    return;
  }

  try {
    const output = execSync(`netstat -ano | findstr ":${port}"`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });

    const pids = new Set();
    for (const line of output.split(/\r?\n/)) {
      if (!line.includes("LISTENING")) {
        continue;
      }
      const pid = line.trim().split(/\s+/).at(-1);
      if (pid && pid !== "0") {
        pids.add(pid);
      }
    }

    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
        console.log(`[dev] Porta ${port} liberada (PID ${pid})`);
      } catch {
        // processo já encerrado
      }
    }
  } catch {
    // nenhum processo na porta
  }
}

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
  process.exit(code);
}

function run(command, args) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      return;
    }
    shutdown(code ?? 0);
  });

  children.push(child);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

freePort(DEV_PORT);
freePort(BUILTIN_PHP_PORT);

const apiProxyTarget = readApiProxyTarget();

console.log(`[dev] API PHP  http://127.0.0.1:${BUILTIN_PHP_PORT}/api/health.php`);
console.log(`[dev] Frontend http://127.0.0.1:${DEV_PORT}`);
console.log(`[dev] Proxy /api → ${apiProxyTarget}`);
console.log("[dev] Ctrl+C encerra a API e o frontend");
console.log("");

run("php", ["-S", `127.0.0.1:${BUILTIN_PHP_PORT}`, "-t", "."]);
run("npx", ["vite"]);
