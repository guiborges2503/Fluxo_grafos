import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "dist");
const apiSrc = path.join(root, "api");
const apiDest = path.join(distDir, "api");
const dataSrc = path.join(root, "database", "data");
const dataDest = path.join(distDir, "database", "data");

const excludedPaths = new Set([".env", "tests", "logs"]);

function isExcluded(relativePath) {
  const normalized = relativePath.replace(/\\/g, "/");
  if (excludedPaths.has(normalized)) {
    return true;
  }
  return [...excludedPaths].some(
    (entry) => normalized.startsWith(`${entry}/`) || normalized === entry
  );
}

function copyDirectory(source, destination, relativeBase = "") {
  fs.mkdirSync(destination, { recursive: true });

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const relativePath = relativeBase ? `${relativeBase}/${entry.name}` : entry.name;
    if (isExcluded(relativePath)) {
      continue;
    }

    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(from, to, relativePath);
      continue;
    }

    fs.copyFileSync(from, to);
  }
}

if (!fs.existsSync(distDir)) {
  console.error("[ERRO] Pasta dist/ não encontrada. Execute: npm run build");
  process.exit(1);
}

if (!fs.existsSync(apiSrc)) {
  console.error("[ERRO] Pasta api/ não encontrada.");
  process.exit(1);
}

if (fs.existsSync(apiDest)) {
  fs.rmSync(apiDest, { recursive: true, force: true });
}

copyDirectory(apiSrc, apiDest);

if (fs.existsSync(dataSrc)) {
  copyDirectory(dataSrc, dataDest);
}

console.log("[OK] dist/api/ e dist/database/data/ incluídos no pacote.");
console.log("[OK] Após publicar, teste: /api/health.php");
