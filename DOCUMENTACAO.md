# Anime Vault: documentação

Detalhes técnicos e de uso. A apresentação está no [README](README.md).

## Estrutura

```
Dashboard/            telas do app (uma nota = uma tela)
Animes/               uma nota por anime (frontmatter = dados)
Lists/                listas personalizadas (campo `anime`)
Genres/, Studios/, Franchises/   páginas de categoria (criadas no primeiro toque)
Assets/Covers, Assets/Banners    artes baixadas do AniList ou escolhidas do aparelho
Assets/animevault-boot.js        tela de carregamento e chamada do app
Scripts/              código (CustomJS)
.obsidian/snippets/animevault.css   visual
.animevault/          cache do AniList (perfil, episódios, temporadas) — fora do git
```

Toda nota tem um único bloco:

````
```dataviewjs
await dv.view("Assets/animevault-boot", { page: "anime" });
```
````

O boot mostra a tela de carregamento enquanto o CustomJS não terminou de carregar e então chama `customJS.AnimeVault.render(dv, "anime")`. Na aba principal, o app é desenhado numa camada própria sobre a nota (como no Steam Vault), então fica igual no modo leitura e no modo edição. Para editar o texto da nota, use o modo código-fonte.

Telas: `home`, `library`, `anime`, `history`, `lists`, `list`, `genres`, `genre`, `studios`, `studio`, `franchises`, `franchise`, `seasons`, `ranking`, `calendar`, `statistics`, `tierlist`, `profile`, `integrations`, `settings`, `anilist`.

## Scripts

| Arquivo | Papel |
|---|---|
| `AnimeVault.js` | Entrada: roteamento, camada sobre a nota, tamanhos de tela, busca, menus, carrossel, gestos, avisos, janelas, progresso |
| `AnimeVaultCore.js` | Modelo de dados e **fonte única** dos números (progresso, minutos, temporada, atividade, calendário) e escrita do progresso |
| `AnimeVaultUI.js` | Componentes visuais (ícones, cards, miniaturas, fileiras, cabeçalho e navegação) |
| `AnimeVaultPages.js` | Início, Minha biblioteca, ficha do anime, Histórico |
| `AnimeVaultBrowse.js` | Listas, Gêneros, Estúdios, Franquias, Temporadas |
| `AnimeVaultInsights.js` | Calendário, Estatísticas, Tier List, Configurações |
| `AnimeVaultEditor.js` | Formulários: adicionar, editar, diário, análise e nota, listas, identidade, Surpreenda-me |
| `AnimeVaultAniList.js` | API pública do AniList: busca, metadados, artes, personagens, relações, recomendações, sync do perfil, em alta na temporada |
| `AnimeVaultMAL.js` | MyAnimeList: estatísticas e ficha pela Jikan, Top do MAL, importar/exportar XML, tela Integrações |

## Schema do anime

| Campo | Uso |
|---|---|
| `title`, `titleRomaji`, `titleEnglish`, `titleNative` | Título exibido e alternativos (a busca procura em todos) |
| `format` | `TV`, `TV_SHORT`, `MOVIE`, `OVA`, `ONA`, `SPECIAL`, `MUSIC` |
| `status` | `Watching` (Assistindo), `Rewatching` (Reassistindo), `Paused`, `Planning` (Quero assistir), `Completed`, `Dropped`. Também aceita os nomes em português |
| `episodes`, `episodesWatched`, `duration` | Total, quantos você viu, minutos por episódio. O tempo assistido sai daqui |
| `log` | Diário: lista de `{ date, from, to, note }`. Cada "Assisti o E5" grava uma linha (juntando com a do dia) |
| `season`, `seasonYear` | `WINTER`, `SPRING`, `SUMMER`, `FALL` + ano. Sem eles, a temporada sai de `airedFrom` |
| `airingStatus`, `airedFrom`, `airedTo` | `RELEASING`, `FINISHED`, `NOT_YET_RELEASED`, `HIATUS`, `CANCELLED` |
| `nextAiring` | `{ episode, at }`, escrito pelo AniList; alimenta o calendário e o selo "Novo episódio" |
| `airingDay`, `airingTime` | Dia (ex.: `Sábado`) e hora fixos, para o calendário sem AniList |
| `genre`, `studio`, `tags`, `franchise`, `franchiseOrder` | Organização. `franchiseOrder` define a ordem para assistir |
| `audio`, `streaming`, `link` | `Legendado`/`Dublado`, onde assistir e o link (aparece no menu ⋮) |
| `rating`, `tier`, `tierOrder`, `favorite` | Sua nota (0–5, meias estrelas), faixa da Tier List, favorito |
| `review`, `pros`, `cons`, `recommend` | Minha análise |
| `cover`, `banner`, `bgPosX`, `bgPosY` | Artes e enquadramento do banner. Sem arte, o app gera um fundo próprio |
| `featuredOnHome` | `true` coloca no carrossel do Início. Sem nenhum marcado, o Vault escolhe (assistindo, favoritos, com arte) |
| `anilistId`, `malId`, `averageScore` | Ligação com AniList/MyAnimeList; `averageScore` é a nota média do AniList (0–100) |
| `source`, `demographic`, `themes`, `producers`, `ageRating`, `broadcast` | Ficha no estilo MAL: fonte (Mangá, Light novel…), demografia (Shounen…), temas, produtoras, classificação, transmissão |
| `mal` | Estatísticas do MyAnimeList (nota, votos, ranking, popularidade, membros, favoritos), escritas pelo app |
| `dateAdded`, `startDate`, `completionDate`, `lastWatched`, `rewatches` | Datas e quantas vezes você reassistiu |
| `anilist` | Cache do último sync (não edite) |

Listas: `anime: ["[[Animes/Frieren …]]", …]`, mais `title`, `description`, `icon`, `accent`, `cover`, `pinned`. A ordem do campo é a ordem da lista (↑ ↓ na página regravam).

## Progresso e diário

- **Assisti o E5** (ficha, card, menu rápido): marca o próximo episódio, grava no diário e oferece **Desfazer**.
- **Tocar num episódio** da grade marca até ele; tocar no último assistido desmarca só ele.
- Começar a assistir muda `Quero assistir`/`Pausado` para `Assistindo` e grava `startDate`. O último episódio conclui (`Completed` + `completionDate`) e oferece a nota.
- **Reassistir** volta ao episódio 1 com status `Reassistindo`; o histórico da primeira vez continua contando.
- **Registrar no diário** (menu ⋮ ou aba Diário): data, intervalo e uma nota. Registrar episódios já vistos só entra no diário, sem mudar o progresso.

## AniList

Tudo pela API pública (`graphql.anilist.co`), uma consulta por vez, com pausa automática se o AniList limitar. Nenhuma senha, login ou token.

- **Adicionar anime:** busca por nome; o anime nasce com título, formato, episódios, duração, temporada, estúdio, gêneros (em português), sinopse, nota média, links de streaming, capa e banner baixados para `Assets/`. Dá para escolher o status na hora. Sem internet, use o formulário manual.
- **Atualizar do AniList** (menu ⋮ ou Configurações): só metadados (episódios, situação, próximo episódio, artes que faltam). Título, status, progresso, nota e análise são seus e nunca mudam. Gêneros, estúdio e sinopse só são preenchidos se estiverem vazios. Um anime sem `anilistId` é ligado pelo título.
- **Sync do perfil público** (Configurações ou menu da conta): informe o usuário. Para os animes ligados:
  - progresso: vale o maior; a diferença entra no diário com a data da última atualização no AniList (`source: anilist`);
  - status: segue o AniList quando o progresso de lá andou ou quando a nota está em "Quero assistir";
  - datas, nota e reassistidas: só se estiverem vazias na nota.
- **Tela AniList:** a sua lista, o que está fora do vault (Adicionar / Adicionar todos, já com progresso e nota) e os animes do vault sem `anilistId`.
- **Temporadas:** "Em alta nesta temporada no AniList" (cache de 12 h), com um toque para adicionar em "Quero assistir".
- **Episódios:** quando o AniList tem a lista de episódios de streaming, a grade mostra os títulos e miniaturas reais.

## MyAnimeList

- **Escala de notas** (Integrações ou Configurações): *5 estrelas* (com meia) ou *1–10* como no MAL, com os rótulos do MAL ("(10) Obra-prima", "(9) Ótimo"…). A nota fica guardada igual em `rating` (0–5 em meias = 0–10), então trocar a escala não muda nada nas notas.
- **Lista em tabela** (Minha biblioteca › terceiro botão de visualização): como a Anime List do MAL, com a barra colorida de cada status (verde assistindo, azul concluído, amarelo em espera, vermelho abandonado, cinza planejo assistir), seções por status em "Todos" e o **+** ao lado do progresso.
- **Ficha › Detalhes**: o bloco de nota (nota do MAL, ranking, popularidade, membros) e, na lateral, *Títulos alternativos*, *Informações*, *Estatísticas*, *Seu histórico* e *Links*.
- **Atualizar do MyAnimeList** (menu ⋮ ou Integrações): lê na Jikan a nota, os votos, o ranking, a popularidade, os membros e os favoritos, e preenche, se estiverem vazios, fonte, demografia, temas, produtoras, classificação e transmissão. Precisa do `malId` (o AniList preenche sozinho).
- **Personagens** (aba da ficha): personagens com os dubladores japoneses, pelo AniList. **Relacionados**: obras ligadas com o tipo da relação (sequência, prequel, história paralela, obra original…) e recomendações da comunidade, cada uma com *Adicionar*. Ficam em cache em `.animevault/media.json`.
- **Perfil**: "Estatísticas de anime" como no MAL (dias, nota média, barra de status, total, reassistidos, episódios), últimas atualizações, distribuição das notas, gêneros e favoritos.
- **Ranking**: o seu top (por nota, nota do MAL, popularidade ou tempo assistido) e o **Top do MyAnimeList** (geral, em lançamento, mais populares, em breve), com *Quero assistir* para adicionar.
- **Temporadas › Por formato (MAL)**: TV (novos), TV (continuando), ONA, OVA, Filmes e Especiais.
- **Importar XML do MAL** (Integrações): no MAL, *Perfil › Export* (lista de anime). Escolha o `.xml` ou o `.xml.gz`. A prévia mostra quantos são novos e quantos já estão no vault. Os existentes seguem as mesmas regras do sync do AniList (progresso maior vence, a diferença entra no diário com `source: myanimelist`, nota e datas só se vazias). Os novos nascem com capa, banner e metadados do AniList (pelo id do MAL).
- **Exportar XML para o MAL**: gera `Exports/animelist-AAAA-MM-DD.xml` no formato do MAL, para importar em myanimelist.net/import.php (entram os animes com `malId`).

## Aparência

Identidade inspirada na Crunchyroll: palco escuro, laranja `#f47521` como cor de ação, fonte Lato, hover que revela sinopse e ações. O app é sempre escuro, como os apps de streaming. Há dois visuais, em *Configurações › Preferências › Visual*:

- **Premium** (padrão, 1.2.0):
  - Cabeçalho de vidro que flutua transparente sobre o destaque e ganha desfoque ao rolar.
  - Títulos em Plus Jakarta Sans e cantos arredondados.
  - Botões laranja com degradê e brilho, gêneros e botões secundários em vidro.
  - Arte do destaque com zoom lento (some com *Reduzir animações*) e grão de filme leve.
  - Cards que sobem no hover com um brilho na cor da arte.
  - Brilho ambiente na ficha do anime.
  - Menus, janelas e avisos em vidro fosco.
  - Gráficos com colunas arredondadas.
- **Clássico**: o visual da 1.1, com cantos retos, cabeçalho grafite sólido e botões chapados.

Os dois visuais têm ainda:

- **Obra-prima**: nota máxima (5 estrelas ou 10) ganha uma coroa dourada no card e o selo *Obra-prima* no destaque.
- **Ranking**: os três primeiros aparecem em dourado.
- **Cartão de membro** (Perfil): mostra o seu nível de fã pelas horas assistidas. Os níveis são Iniciante, Bronze (25 h), Prata (100 h), Ouro (300 h), Platina (750 h) e Diamante (1.500 h). O cartão traz dias, episódios, o ano em que você começou e quanto falta para o próximo nível. O nível também aparece no menu da conta.

Em *Style Settings › Anime Vault*: cor de ação (o degradê e o brilho acompanham), largura das capas nas fileiras, modo aplicativo e barra de rolagem. Em *Configurações* do app: visual, reduzir animações, sinopse no hover e vibração.

## Celular

- Cabeçalho compacto (logo, busca, conta) e barra inferior: Início, Biblioteca, Navegar, Calendário e Mais.
- **Modo aplicativo** (Style Settings, ligado por padrão): nas telas do Anime Vault some o cabeçalho e a barra do Obsidian; o menu **Mais** traz os atalhos do Obsidian.
- O topo das fichas usa a capa em pé, com o botão laranja em largura total, como no app da Crunchyroll.
- Gestos: puxar o Início para baixo sincroniza o AniList; deslizar da borda esquerda volta; arrastar o topo de uma janela para baixo fecha; toque longo num card abre as ações rápidas.

Atalhos: `/` ou `Ctrl/Cmd + K` para buscar (Enter sem resultado busca no AniList); `Esc` fecha menus e janelas.

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| "Anime Vault não carregou" | CustomJS desligado ou pasta de scripts diferente de `Scripts/` |
| Bloco de código em vez da tela | Dataview sem *Enable JavaScript Queries*, ou nota em modo código-fonte |
| Tela sem estilo | Snippet `animevault` desativado em *Aparência* |
| Títulos com outra fonte | Sem internet, a Plus Jakarta Sans não carrega e os títulos usam a Lato |
| Sem capas | Use *Configurações › Baixar capas e banners que faltam* (precisa de `anilistId`) |
| "Esse perfil ou lista é privado" | A lista do AniList precisa ser pública para o sync |
| "Nota MAL" em N/A | Falta `malId` ou ainda não foi atualizado: menu ⋮ › Atualizar do MyAnimeList |
| Importação do MAL recusa o arquivo | Use a exportação da lista de **anime** (não a de mangá); `.xml` ou `.xml.gz` |
| Calendário vazio | Atualize os horários pelo AniList ou preencha `airingDay`/`airingTime` |
| Números estranhos | *Configurações › Diagnóstico* lista o que corrigir nas notas |
