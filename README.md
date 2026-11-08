# NATIVA — Protótipo atualizado

## Como executar

1. Extraia a pasta `NATIVA_Prototipo_Atualizado`.
2. Abra um terminal dentro dessa pasta.
3. Execute `python -m http.server 8000`.
4. Abra `http://localhost:8000` no navegador.

É necessário usar um servidor local porque o projeto utiliza módulos JavaScript (`import`/`export`). Não abra o `index.html` diretamente com duplo clique.

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
