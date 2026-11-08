# NATIVA — Protótipo atualizado

## Como executar

1. Instale o Node.js 20 ou superior.
2. Na pasta do projeto, execute `npm install`.
3. Execute `npm run dev` e abra o endereço indicado (normalmente `http://localhost:5173`).

O projeto usa o Vite para resolver pacotes (fontes, ícones, detecção de dispositivo), portanto um servidor estático simples como `python -m http.server` não é suficiente. Para o backend local, veja `docs/AMBIENTE_SUPABASE_LOCAL.md`.

Outros comandos: `npm test` (testes), `npm run lint`, `npm run build` (gera `dist/`, usado pelo `Dockerfile`), `npm run preview` (serve o build) e `NVIDIA_API_KEY=... npm run assets` (gera as imagens de `scripts/asset-prompts.json`).

## Arquivos

- `index.html`: estrutura das telas.
- `css/style.css`: identidade visual e responsividade.
- `js/app.js`: criação, bestiário, fotos, progressão e arena.
- `js/data.js`: grupos biológicos, linhagens, biomas, afinidades e arquétipos.
- `js/techniques.js`: catálogo de técnicas fornecido pelo usuário, mantido como fonte oficial do protótipo.
- `js/progression.js`: XP, níveis e XPA.
- `js/essences.js`: regras e validação das essências.

## Dados e compatibilidade

- Mantém a chave `localStorage` `nativa.prototype.v1` para preservar fichas existentes.
- Fotos são armazenadas no IndexedDB do navegador, separadas dos dados textuais.
- Os dados não são enviados a um servidor e não sincronizam entre dispositivos.

## O que está implementado

- Criação com grupo biológico → linhagem → espécie.
- Perfil biológico com exemplos, descrição e especialidades por linhagem.
- Seleção de até seis técnicas iniciais, usando o catálogo recebido.
- Bestiário com foto, atributos, técnicas e progressão.
- XP, níveis, XPA, melhoria de atributos e absorção das duas primeiras essências.
- Arena local 1 contra 1 com iniciativa, precisão, MP, dano, HP, recarga e registro de combate.

## Limitações conhecidas

- A arena é uma simulação local para duas fichas no mesmo navegador; ainda não é multiplayer online.
- Efeitos textuais de suporte/condição são registrados no histórico, mas não são todos aplicados automaticamente.
- A batalha atual não restaura MP nem HP automaticamente entre partidas; inicie uma nova simulação para testar fichas novamente.
- A terceira essência permanece desativada, conforme as regras atuais.
