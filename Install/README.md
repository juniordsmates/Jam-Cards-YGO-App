# Instalar o Jam Cards - YGO!

Escolha a versão e baixe o instalador do seu sistema: abra o arquivo e clique em **Download** (ícone ⬇ no canto direito).

| Versão | Windows | macOS (Apple Silicon e Intel) |
| --- | --- | --- |
| **1.0.2** (mais recente) | [Jam.Cards.-.YGO._1.0.2_x64-setup.exe](1.0.2/Jam.Cards.-.YGO._1.0.2_x64-setup.exe) (3.4 MB) | [Jam.Cards.-.YGO._1.0.2_universal.dmg](1.0.2/Jam.Cards.-.YGO._1.0.2_universal.dmg) (8.2 MB) |
| **1.0.1** | [Jam.Cards.-.YGO._1.0.1_x64-setup.exe](1.0.1/Jam.Cards.-.YGO._1.0.1_x64-setup.exe) (3.0 MB) | [Jam.Cards.-.YGO._1.0.1_universal.dmg](1.0.1/Jam.Cards.-.YGO._1.0.1_universal.dmg) (7.5 MB) |
| **1.0.0** | [Cartas_1.0.0_x64-setup.exe](1.0.0/Cartas_1.0.0_x64-setup.exe) (2.1 MB) | [Cartas_1.0.0_universal.dmg](1.0.0/Cartas_1.0.0_universal.dmg) (5.6 MB) |

Os mesmos arquivos ficam na página de [Releases](https://github.com/juniordsmates/Jam-Cards-YGO-App/releases). Esta pasta é atualizada automaticamente a cada versão publicada.

## Windows

1. Baixe o arquivo `.exe` e execute.
2. Se aparecer **"O Windows protegeu o computador"**, clique em **Mais informações** → **Executar assim mesmo**. O app não tem assinatura digital.
3. O instalador não pede administrador: instala na sua conta de usuário. Se o Jam Cards - YGO! já estiver instalado, ele só atualiza e mantém seus dados.

**Recurso necessário:** Microsoft Edge WebView2, que já vem no Windows 10 e no Windows 11 atualizados. Se faltar, o instalador baixa sozinho. Sem internet, instale antes o [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/).

## macOS

1. Baixe o arquivo `.dmg`, abra e arraste o **Jam Cards - YGO!** para **Aplicativos**.
2. Na primeira vez, se o macOS bloquear, vá em **Ajustes do Sistema → Privacidade e Segurança** e clique em **Abrir Mesmo Assim**. O app não é assinado pela Apple.
3. Se aparecer **"está danificado"**, abra o Terminal, rode o comando abaixo e abra o app de novo:

   ```sh
   xattr -cr '/Applications/Jam Cards - YGO!.app'
   ```

**Requisito:** macOS 10.13 (High Sierra) ou mais recente.

## Primeiro acesso

Na primeira abertura, o app baixa a base de cartas uma vez. Leva alguns minutos e precisa de internet. Depois, a base fica salva no computador.
