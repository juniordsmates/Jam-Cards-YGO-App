import type { ProvedorId } from "../db/ia";

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
  `Crie uma conta (ou entre) em ${site}.`,
  `Abra ${onde} e crie uma chave de API nova.`,
  "Copie a chave (ela só aparece inteira uma vez) e cole no campo Chave abaixo.",
];

export const GUIAS: Record<ProvedorId, GuiaIA> = {
  anthropic: {
    intuito: "Combo Search com pesquisa na web: lê guias e listas da comunidade e confere o texto das cartas no app. É a IA com o melhor resultado nas buscas de combo.",
    tutorial: [...passosChave("console.anthropic.com", "Settings → API Keys"), "Adicione créditos em Settings → Billing.", "Escolha o modelo: Opus 5.5 (melhor resultado) ou Sonnet 5.5 (mais barato)."],
    custo: "pago por uso, na sua conta da Anthropic",
  },
  gemini: {
    intuito:
      "Combo Search (sem pesquisa na web) e, em caráter experimental, Importar combo de vídeo do YouTube: o Gemini é a única IA aqui que assiste vídeos (só vídeos públicos).",
    tutorial: [
      ...passosChave("aistudio.google.com com a sua conta Google", "Get API key → Create API key"),
      "No Modelo, use um modelo com vídeo, como gemini-2.5-flash (veja os nomes atuais na lista de modelos do AI Studio).",
      "O endereço da API já vem preenchido: não precisa mudar.",
    ],
    custo: "tem uso gratuito com limites diários; acima disso, pago por uso",
  },
  openai: {
    intuito: "Combo Search sem pesquisa na web: a IA usa o texto das cartas e os combos registrados no app, mais o próprio conhecimento.",
    tutorial: [...passosChave("platform.openai.com", "API keys"), "Adicione créditos em Billing.", "No Modelo, digite o nome que aparece no painel (ex.: gpt-5)."],
    custo: "pago por uso, na sua conta da OpenAI",
  },
  openrouter: {
    intuito: "Combo Search com vários modelos numa conta só. Com ':online' no fim do modelo, o próprio OpenRouter pesquisa na web.",
    tutorial: [...passosChave("openrouter.ai", "Keys"), "Adicione créditos em Credits.", "No Modelo, copie o nome da página do modelo (ex.: openai/gpt-5:online)."],
    custo: "pago por uso; alguns modelos são gratuitos",
  },
  deepseek: {
    intuito: "Combo Search sem pesquisa na web, com custo baixo.",
    tutorial: [...passosChave("platform.deepseek.com", "API keys"), "Adicione créditos em Top up.", "No Modelo, use deepseek-chat."],
    custo: "pago por uso, barato",
  },
  groq: {
    intuito: "Combo Search sem pesquisa na web, com respostas muito rápidas (modelos abertos).",
    tutorial: [...passosChave("console.groq.com", "API Keys"), "No Modelo, use um da lista do console (ex.: llama-3.3-70b-versatile)."],
    custo: "tem uso gratuito com limites",
  },
  mistral: {
    intuito: "Combo Search sem pesquisa na web, com os modelos da Mistral.",
    tutorial: [...passosChave("console.mistral.ai", "API Keys"), "No Modelo, use mistral-large-latest."],
    custo: "pago por uso; há plano de testes",
  },
  xai: {
    intuito: "Combo Search sem pesquisa na web, com o Grok.",
    tutorial: [...passosChave("console.x.ai", "API Keys"), "Adicione créditos.", "No Modelo, use o nome do painel (ex.: grok-4)."],
    custo: "pago por uso",
  },
  ollama: {
    intuito: "Combo Search com uma IA rodando no seu computador, sem custo e sem enviar nada para fora. A qualidade depende do modelo baixado.",
    tutorial: [
      "Instale o Ollama (ollama.com) e abra o programa.",
      "No Terminal, baixe um modelo: ollama pull llama3.1",
      "No Modelo, digite o mesmo nome (llama3.1). A chave não é necessária.",
      "Deixe o Ollama aberto enquanto usa o Combo Search.",
    ],
    custo: "gratuito (usa o seu computador)",
  },
  lmstudio: {
    intuito: "Combo Search com uma IA rodando no seu computador pelo LM Studio, sem custo.",
    tutorial: [
      "Instale o LM Studio (lmstudio.ai) e baixe um modelo pela busca do programa.",
      "Na aba Developer, carregue o modelo e ligue o servidor (Start Server).",
      "No Modelo, digite o nome do modelo carregado. A chave não é necessária.",
    ],
    custo: "gratuito (usa o seu computador)",
  },
  outro: {
    intuito: "Combo Search com qualquer serviço compatível com a API da OpenAI (/chat/completions).",
    tutorial: [
      "Pegue no painel do serviço o endereço da API (termina em /v1) e uma chave.",
      "Cole o endereço, o nome do modelo e a chave nos campos abaixo.",
    ],
    custo: "depende do serviço",
  },
};
