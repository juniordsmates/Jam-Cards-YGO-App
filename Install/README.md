# Instalar o Cartas

Escolha a versão e baixe o instalador do seu sistema: abra o arquivo e clique em **Download** (ícone ⬇ no canto direito).

| Versão | Windows | macOS (Apple Silicon e Intel) |
| --- | --- | --- |
| **0.0.1** (mais recente) | [Cartas_0.0.1_x64-setup.exe](0.0.1/Cartas_0.0.1_x64-setup.exe) (1.9 MB) | [Cartas_0.0.1_universal.dmg](0.0.1/Cartas_0.0.1_universal.dmg) (5.3 MB) |

Os mesmos arquivos ficam na página de [Releases](https://github.com/juniordsmates/Cartas-App/releases). Esta pasta é atualizada automaticamente a cada versão publicada.

## Windows

1. Baixe o arquivo `.exe` e execute.
2. Se aparecer **"O Windows protegeu o computador"**, clique em **Mais informações** → **Executar assim mesmo**. O app não tem assinatura digital.
3. O instalador não pede administrador: instala na sua conta de usuário. Se o Cartas já estiver instalado, ele só atualiza e mantém seus dados.

**Recurso necessário:** Microsoft Edge WebView2, que já vem no Windows 10 e no Windows 11 atualizados. Se faltar, o instalador baixa sozinho. Sem internet, instale antes o [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/).

## macOS

1. Baixe o arquivo `.dmg`, abra e arraste o **Cartas** para **Aplicativos**.
2. Na primeira vez, se o macOS bloquear, vá em **Ajustes do Sistema → Privacidade e Segurança** e clique em **Abrir Mesmo Assim**. O app não é assinado pela Apple.
3. Se aparecer **"está danificado"**, abra o Terminal, rode o comando abaixo e abra o app de novo:

   ```sh
   xattr -cr /Applications/Cartas.app
   ```

**Requisito:** macOS 10.13 (High Sierra) ou mais recente.

## Primeiro acesso

Na primeira abertura, o app baixa a base de cartas uma vez. Leva alguns minutos e precisa de internet. Depois, a base fica salva no computador.
