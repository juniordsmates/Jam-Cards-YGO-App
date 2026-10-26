// Gera Install/README.md: uma linha por versão de distribuição (pastas Install/<versão>/),
// com os instaladores do Windows e do macOS e as instruções de instalação.
// Uso: node scripts/install-readme.mjs (rodado pela Action depois de copiar os instaladores).
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "Install";
const semver = (v) => v.split(".").map(Number);
const newer = (a, b) => {
  const [x, y] = [semver(a), semver(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return y[i] - x[i];
  return 0;
};

const versions = readdirSync(DIR)
  .filter((d) => /^\d+\.\d+\.\d+$/.test(d) && statSync(join(DIR, d)).isDirectory())
  .sort(newer);

const mb = (f) => `${(statSync(f).size / 1e6).toFixed(1)} MB`;
const link = (v, ext) => {
  const file = readdirSync(join(DIR, v)).find((f) => f.endsWith(ext));
  return file ? `[${file}](${encodeURI(`${v}/${file}`)}) (${mb(join(DIR, v, file))})` : "—";
};

const rows = versions.map((v, i) => `| **${v}**${i === 0 ? " (mais recente)" : ""} | ${link(v, ".exe")} | ${link(v, ".dmg")} |`);

const text = `# Instalar o Cartas

Escolha a versão e baixe o instalador do seu sistema: abra o arquivo e clique em **Download** (ícone ⬇ no canto direito).

| Versão | Windows | macOS (Apple Silicon e Intel) |
| --- | --- | --- |
${rows.join("\n")}

Os mesmos arquivos ficam na página de [Releases](https://github.com/juniordsmates/Cartas-App/releases). Esta pasta é atualizada automaticamente a cada versão publicada.

## Windows

1. Baixe o arquivo \`.exe\` e execute.
2. Se aparecer **"O Windows protegeu o computador"**, clique em **Mais informações** → **Executar assim mesmo**. O app não tem assinatura digital.
3. O instalador não pede administrador: instala na sua conta de usuário. Se o Cartas já estiver instalado, ele só atualiza e mantém seus dados.

**Recurso necessário:** Microsoft Edge WebView2, que já vem no Windows 10 e no Windows 11 atualizados. Se faltar, o instalador baixa sozinho. Sem internet, instale antes o [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/).

## macOS

1. Baixe o arquivo \`.dmg\`, abra e arraste o **Cartas** para **Aplicativos**.
2. Na primeira vez, se o macOS bloquear, vá em **Ajustes do Sistema → Privacidade e Segurança** e clique em **Abrir Mesmo Assim**. O app não é assinado pela Apple.
3. Se aparecer **"está danificado"**, abra o Terminal, rode o comando abaixo e abra o app de novo:

   \`\`\`sh
   xattr -cr /Applications/Cartas.app
   \`\`\`

**Requisito:** macOS 10.13 (High Sierra) ou mais recente.

## Primeiro acesso

Na primeira abertura, o app baixa a base de cartas uma vez. Leva alguns minutos e precisa de internet. Depois, a base fica salva no computador.
`;

writeFileSync(join(DIR, "README.md"), text);
console.log(`Install/README.md: ${versions.length} versão(ões)`);
