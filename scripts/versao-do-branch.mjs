// Usa o nome do branch de distribuição (ex.: 0.0.1) como número da versão do build, para que
// cada branch gere os instaladores com o próprio número mesmo trazendo o código mais novo da main.
// Uso: node scripts/versao-do-branch.mjs <versão>
import { readFileSync, writeFileSync } from "node:fs";

const v = process.argv[2] ?? "";
if (!/^\d+\.\d+\.\d+$/.test(v)) {
  console.log(`"${v}" não é um número de versão: mantém o dos arquivos.`);
  process.exit(0);
}
for (const f of ["package.json", "src-tauri/tauri.conf.json"]) {
  const j = JSON.parse(readFileSync(f, "utf8"));
  j.version = v;
  writeFileSync(f, JSON.stringify(j, null, 2) + "\n");
}
// Cargo.toml: só a versão do pacote (a primeira linha "version = ...")
const toml = readFileSync("src-tauri/Cargo.toml", "utf8");
writeFileSync("src-tauri/Cargo.toml", toml.replace(/^version = ".*"$/m, `version = "${v}"`));
console.log(`Versão do build: ${v}`);
