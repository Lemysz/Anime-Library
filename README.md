<p align="center">
  <img src=".github/readme/desktop-home.jpg" alt="Anime Vault: Início com destaque, Continuar assistindo e fileiras" width="100%">
</p>

<h1 align="center">Anime Vault</h1>

<p align="center">
  <img alt="Versão" src="https://img.shields.io/badge/vers%C3%A3o-1.0.0-f47521?style=for-the-badge&labelColor=000000">
  <img alt="Obsidian" src="https://img.shields.io/badge/Obsidian-desktop%20%C2%B7%20celular-7c3aed?style=for-the-badge&logo=obsidian&logoColor=white&labelColor=000000">
  <img alt="AniList" src="https://img.shields.io/badge/AniList-sem%20senha-3db4f2?style=for-the-badge&labelColor=000000">
  <img alt="Idioma" src="https://img.shields.io/badge/idioma-portugu%C3%AAs-e9bd52?style=for-the-badge&labelColor=000000">
</p>

<p align="center">
  <b>Sua biblioteca de animes no Obsidian, com cara de app de streaming.</b><br>
  Mesma base do Steam Vault 3.19.0, com visual inspirado na Crunchyroll: palco preto, laranja, capas retas e fileiras.<br>
  <sub>Episódios, diário, temporadas, calendário de lançamentos, listas, estatísticas e sync público do AniList, em notas Markdown que continuam suas.</sub>
</p>

<p align="center">
  <a href="#-destaques">Destaques</a> ·
  <a href="#-instalação">Instalação</a> ·
  <a href="#-como-o-vault-é-organizado">Organização</a> ·
  <a href="DOCUMENTACAO.md">Documentação</a>
</p>

## ✨ Destaques

<table>
  <tr>
    <td width="33%" valign="top">▶️ <b>Ficha de cada anime</b><br><sub>Banner, capa, grade de episódios em miniatura, "Assisti o E5" com um toque, desfazer, detalhes, análise e relacionados.</sub></td>
    <td width="33%" valign="top">🏠 <b>Início estilo streaming</b><br><sub>Carrossel de destaques, Continuar assistindo, Novos episódios, Temporada atual, Quero assistir, sua semana e mais.</sub></td>
    <td width="33%" valign="top">📚 <b>Minha biblioteca</b><br><sub>Abas por status, busca, filtros (gênero, formato, estúdio), ordem, grade ou lista. Hover com sinopse, como na Crunchyroll.</sub></td>
  </tr>
  <tr>
    <td valign="top">📅 <b>Calendário de lançamentos</b><br><sub>Os próximos episódios da semana (AniList ou o dia que você informar na nota).</sub></td>
    <td valign="top">🍂 <b>Temporadas</b><br><sub>Como a página Simulcast: escolha a temporada, veja o que você tem e o que está em alta no AniList.</sub></td>
    <td valign="top">🗂️ <b>Gêneros, estúdios e franquias</b><br><sub>Cada um com página própria, cor e ícone. Franquias com a ordem para assistir.</sub></td>
  </tr>
  <tr>
    <td valign="top">📓 <b>Diário e histórico</b><br><sub>Cada episódio marcado entra com a data. Mapa de atividade, sequência de dias e maratonas.</sub></td>
    <td valign="top">📊 <b>Estatísticas e Tier List</b><br><sub>Por período: episódios, tempo, gêneros, estúdios, notas, dia da semana. Tier List com arrastar e soltar.</sub></td>
    <td valign="top">🔗 <b>AniList sem senha</b><br><sub>Busca com capa e banner, atualização de metadados e sync da sua lista pública (só o nome de usuário).</sub></td>
  </tr>
</table>

<p align="center">
  <img src=".github/readme/mobile.jpg" alt="Anime Vault no celular: Início, ficha, biblioteca e gêneros" width="100%">
</p>

<p align="center">
  <img src=".github/readme/desktop-anime.jpg" alt="Ficha do anime com a grade de episódios" width="49%">
  <img src=".github/readme/desktop-stats.jpg" alt="Estatísticas" width="49%">
</p>
<p align="center"><sub>Prévias geradas com capas ilustrativas. No seu vault, capas e banners vêm do AniList.</sub></p>

## 🚀 Instalação

1. Baixe o projeto (**Code › Download ZIP**) e abra a pasta como vault no [Obsidian](https://obsidian.md).
2. Quando o Obsidian perguntar, confie no vault e ative os plugins da comunidade. [Dataview](https://github.com/blacksmithgu/obsidian-dataview), [CustomJS](https://github.com/saml-dev/obsidian-custom-js) e Style Settings já vêm configurados, com o visual (`animevault.css`) ligado.
3. Abra `Dashboard/Home`.

> [!TIP]
> Os 16 animes de exemplo já têm `anilistId`. Em **Configurações › Baixar capas e banners que faltam**, as artes chegam do AniList. Para começar do zero, apague as notas de `Animes/` e `Lists/`.

> [!NOTE]
> O AniList é acessado só pela API pública. Não há senha, login nem token: para o sync, basta o seu nome de usuário, guardado neste dispositivo. O sync nunca apaga nem diminui o progresso das notas.

## 🧭 Como o vault é organizado

```text
Dashboard/      as telas (Início, Biblioteca, Temporadas, Calendário…)
Animes/         uma nota por anime (os dados ficam no frontmatter)
Lists/          suas listas personalizadas
Genres/  Studios/  Franchises/   páginas de cada categoria
Assets/         capas, banners e o boot das telas
Scripts/        o código (CustomJS)
```

Cada anime é uma nota Markdown. Dá para editar à mão, versionar e levar para onde quiser.

## 📖 Mais

- [Documentação](DOCUMENTACAO.md): campos, telas, AniList e solução de problemas.

<p align="center"><sub>Feito com Obsidian, Dataview e CustomJS, sobre a arquitetura do Steam Vault. Visual inspirado em serviços de streaming de anime; o Anime Vault não é afiliado à Crunchyroll nem ao AniList.</sub></p>
