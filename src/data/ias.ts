import type { ProvedorId } from "../db/ia";
import { t } from "../i18n";

// Para que serve cada IA no app e o passo a passo do cadastro (tela "Minha conta" → IAs).

export interface GuiaIA {
  /** o que a IA faz no app, em uma ou duas frases */
  intuito: string;
  /** passo a passo do cadastro */
  tutorial: string[];
  /** custo, em poucas palavras */
  custo: string;
}

const passosChave = (site: string, onde: string) => [
  t("Crie uma conta (ou entre) em {0}.", [site]),
  t("Abra {0} e crie uma chave de API nova.", [onde]),
  t("Copie a chave (ela só aparece inteira uma vez) e cole no campo Chave abaixo."),
];

export const GUIAS: Record<ProvedorId, GuiaIA> = {
  anthropic: {
    intuito: t("Combo Search com pesquisa na web: lê guias e listas da comunidade e confere o texto das cartas no app. É a IA com o melhor resultado nas buscas de combo."),
    tutorial: [...passosChave("console.anthropic.com", t("Settings → API Keys")), t("Adicione créditos em Settings → Billing."), t("Escolha o modelo: Opus 5.5 (melhor resultado) ou Sonnet 5.5 (mais barato).")],
    custo: t("pago por uso, na sua conta da Anthropic"),
  },
  gemini: {
    intuito:
      t("Combo Search (sem pesquisa na web) e, em caráter experimental, Importar combo de vídeo do YouTube: o Gemini é a única IA aqui que assiste vídeos (só vídeos públicos)."),
    tutorial: [
      ...passosChave(t("aistudio.google.com com a sua conta Google"), t("Get API key → Create API key")),
      t("No Modelo, use um modelo com vídeo, como gemini-2.5-flash (veja os nomes atuais na lista de modelos do AI Studio)."),
      t("O endereço da API já vem preenchido: não precisa mudar."),
    ],
    custo: t("tem uso gratuito com limites diários; acima disso, pago por uso"),
  },
  openai: {
    intuito: t("Combo Search sem pesquisa na web: a IA usa o texto das cartas e os combos registrados no app, mais o próprio conhecimento."),
    tutorial: [...passosChave("platform.openai.com", t("API keys")), t("Adicione créditos em Billing."), t("No Modelo, digite o nome que aparece no painel (ex.: gpt-5).")],
    custo: t("pago por uso, na sua conta da OpenAI"),
  },
  openrouter: {
    intuito: t("Combo Search com vários modelos numa conta só. Com ':online' no fim do modelo, o próprio OpenRouter pesquisa na web."),
    tutorial: [...passosChave("openrouter.ai", "Keys"), t("Adicione créditos em Credits."), t("No Modelo, copie o nome da página do modelo (ex.: openai/gpt-5:online).")],
    custo: t("pago por uso; alguns modelos são gratuitos"),
  },
  deepseek: {
    intuito: t("Combo Search sem pesquisa na web, com custo baixo."),
    tutorial: [...passosChave("platform.deepseek.com", t("API keys")), t("Adicione créditos em Top up."), t("No Modelo, use deepseek-chat.")],
    custo: t("pago por uso, barato"),
  },
  groq: {
    intuito: t("Combo Search sem pesquisa na web, com respostas muito rápidas (modelos abertos)."),
    tutorial: [...passosChave("console.groq.com", t("API Keys")), t("No Modelo, use um da lista do console (ex.: llama-3.3-70b-versatile).")],
    custo: t("tem uso gratuito com limites"),
  },
  mistral: {
    intuito: t("Combo Search sem pesquisa na web, com os modelos da Mistral."),
    tutorial: [...passosChave("console.mistral.ai", t("API Keys")), t("No Modelo, use mistral-large-latest.")],
    custo: t("pago por uso; há plano de testes"),
  },
  xai: {
    intuito: t("Combo Search sem pesquisa na web, com o Grok."),
    tutorial: [...passosChave("console.x.ai", t("API Keys")), t("Adicione créditos."), t("No Modelo, use o nome do painel (ex.: grok-4).")],
    custo: t("pago por uso"),
  },
  ollama: {
    intuito: t("Combo Search com uma IA rodando no seu computador, sem custo e sem enviar nada para fora. A qualidade depende do modelo baixado."),
    tutorial: [
      t("Instale o Ollama (ollama.com) e abra o programa."),
      t("No Terminal, baixe um modelo: ollama pull llama3.1"),
      t("No Modelo, digite o mesmo nome (llama3.1). A chave não é necessária."),
      t("Deixe o Ollama aberto enquanto usa o Combo Search."),
    ],
    custo: t("gratuito (usa o seu computador)"),
  },
  lmstudio: {
    intuito: t("Combo Search com uma IA rodando no seu computador pelo LM Studio, sem custo."),
    tutorial: [
      t("Instale o LM Studio (lmstudio.ai) e baixe um modelo pela busca do programa."),
      t("Na aba Developer, carregue o modelo e ligue o servidor (Start Server)."),
      t("No Modelo, digite o nome do modelo carregado. A chave não é necessária."),
    ],
    custo: t("gratuito (usa o seu computador)"),
  },
  outro: {
    intuito: t("Combo Search com qualquer serviço compatível com a API da OpenAI (/chat/completions)."),
    tutorial: [
      t("Pegue no painel do serviço o endereço da API (termina em /v1) e uma chave."),
      t("Cole o endereço, o nome do modelo e a chave nos campos abaixo."),
    ],
    custo: t("depende do serviço"),
  },
};
