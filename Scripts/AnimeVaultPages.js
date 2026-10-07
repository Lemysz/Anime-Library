// ==========================================================================
// Anime Vault — Pages
// Cada página devolve { active, html, wire(root, ctx) }. O shell (barra
// superior, navegação do celular) é aplicado pelo AnimeVault.render().
//
// Acesso: customJS.AnimeVaultPages
// ==========================================================================

class AnimeVaultPages {

	// ================================================================ HOME
	home(ctx) {
		const { C, U, model } = ctx;
		if (!model.anime.length) {
			return { active: "home", html: `<div class="av-page av-pad">${this._welcome(ctx)}</div>` };
		}
		const featured = C.featured(model);
		const shown = new Set();
		const take = (list, n) => list.filter(a => !shown.has(a)).slice(0, n);
		const cont = C.continueWatching(model, 16);
		cont.forEach(a => shown.add(a));
		const newEps = model.anime.filter(a => a.progress.newEpisode);
		const { season, year } = C.seasonOf();
		const thisSeason = model.anime.filter(a => a.season === season && a.seasonYear === year);
		const planning = model.anime.filter(a => a.status === "Planning").sort((x, y) => y.dateAdded.localeCompare(x.dateAdded));
		const favorites = model.anime.filter(a => a.favorite).sort((x, y) => y.rating - x.rating || x.title.localeCompare(y.title));
		const done = model.anime.filter(a => a.status === "Completed" && a.completionDate).sort((x, y) => y.completionDate.localeCompare(x.completionDate));
		const recent = [...model.anime].sort((x, y) => y.dateAdded.localeCompare(x.dateAdded));
		const top = model.anime.filter(a => a.rating >= 4).sort((x, y) => y.rating - x.rating || y.hours - x.hours);
		const because = this._because(ctx);
		const card = a => U.animeCard(a, C);

		const html = `<div class="av-page av-page--home">
			${featured.length > 1 ? this.heroCarousel(ctx, featured) : this.animeHero(ctx, featured[0], { variant: "home" })}
			<div class="av-pad av-homebody">
				${U.shelf("Continuar assistindo", cont.map(a => U.wideCard(a, C, { note: a.log.filter(l => l.note).pop()?.note || "" })), { variant: "wide", action: U.seeAll("Dashboard/Histórico", "Ver histórico") })}
				${U.shelf("Novos episódios", newEps.map(card), { sub: "Já saíram e você ainda não viu" })}
				${this._weekStrip(ctx)}
				${U.shelf(`Temporada de ${C.seasonLabel(season, year)}`, thisSeason.map(card), { action: U.seeAll("Dashboard/Temporadas"), count: thisSeason.length })}
				${U.shelf("Quero assistir", take(planning, 20).map(card), { action: U.seeAll("Dashboard/Biblioteca", "Ver lista"), count: planning.length })}
				${this._pickBanner(ctx)}
				${because ? U.shelf(because.title, because.list.map(card), { sub: because.sub }) : ""}
				${U.shelf("Favoritos", favorites.map(card), { count: favorites.length })}
				${U.shelf("Suas notas mais altas", top.slice(0, 20).map((a, i) => U.animeCard(a, C, { rank: i + 1 })), { variant: "rank" })}
				${this._homeLists(ctx)}
				${U.shelf("Concluídos recentemente", done.slice(0, 16).map(card))}
				${U.shelf("Adicionados recentemente", recent.slice(0, 16).map(card))}
			</div>
		</div>`;
		return { active: "home", html };
	}

	_welcome(ctx) {
		const { U } = ctx;
		return `<section class="av-welcome">
			<span class="av-welcome-mark">${U.icon("mark")}</span>
			<h1>Sua biblioteca de animes começa aqui</h1>
			<p>Adicione um anime buscando no AniList: capa, banner, episódios, estúdio e gêneros entram sozinhos. O progresso fica nas suas notas.</p>
			<div class="av-welcome-actions">${U.btn("Adicionar anime", { icon: "plus", kind: "primary", size: "lg", action: "add-anime" })}${U.btn("Conectar AniList", { icon: "b-anilist", kind: "outline", size: "lg", action: "anilist-connect" })}</div>
		</section>`;
	}

	// "Porque você gosta de X": o gênero com mais tempo e notas altas →
	// o que está na sua lista e ainda não começou
	_because(ctx) {
		const { C, model } = ctx;
		const score = new Map();
		for (const a of model.anime) if (a.status !== "Planning") for (const g of a.genres) score.set(g, (score.get(g) || 0) + a.hours + a.rating * 4);
		const best = [...score].sort((x, y) => y[1] - x[1]);
		for (const [g] of best.slice(0, 3)) {
			const list = model.anime.filter(a => a.genres.includes(g) && a.status === "Planning");
			if (list.length >= 2) return { title: `Porque você gosta de ${C.genreLabel(g)}`, sub: "Na sua lista, ainda sem começar", list };
		}
		return null;
	}

	// faixa promocional no meio da Home (como os banners da Crunchyroll)
	_pickBanner(ctx) {
		const { U, model } = ctx;
		const pool = model.anime.filter(a => a.status === "Planning");
		if (pool.length < 2) return "";
		const art = pool.find(a => a.images.banner) || pool[0];
		return `<section class="av-promo" style="--av-hue:${art.hue}">
			${art.images.banner ? `<img class="av-promo-art" src="${U.attr(art.images.banner)}" alt="" loading="lazy" data-av-img>` : ""}
			<div class="av-promo-body">
				<span class="av-kicker">${U.icon("dice")}Surpreenda-me</span>
				<h3>Não sabe o que assistir hoje?</h3>
				<p>${U.plural(pool.length, "anime espera", "animes esperam")} na sua lista. Escolha o tempo que você tem e o clima: o Vault sugere.</p>
				${U.btn("Sortear um anime", { icon: "dice", kind: "primary", action: "random" })}
			</div>
		</section>`;
	}

	_homeLists(ctx) {
		const { U, model } = ctx;
		const lists = [...model.lists].filter(l => l.items.length).sort((x, y) => (y.pinned - x.pinned) || y.updated.localeCompare(x.updated));
		if (!lists.length || !ctx.B?.listCard) return "";
		return U.shelf("Suas listas", lists.map(l => ctx.B.listCard(ctx, l)), { variant: "lists", action: U.seeAll("Dashboard/Listas") });
	}

	// sua semana: episódios por dia, tempo e sequência
	_weekStrip(ctx) {
		const { C, U, model } = ctx;
		const days = C.dailyEpisodes(model);
		const today = C.today();
		const list = [];
		for (let i = 6; i >= 0; i--) { const d = C.addDays(today, -i); list.push({ d, ...(days.get(d) || { episodes: 0, minutes: 0 }) }); }
		const eps = list.reduce((s, x) => s + x.episodes, 0);
		const min = list.reduce((s, x) => s + x.minutes, 0);
		if (!eps && !model.anime.some(a => a.log.length)) return "";
		const max = Math.max(1, ...list.map(x => x.episodes));
		const streak = C.streak(model);
		const wd = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
		return `<section class="av-block av-week">
			${U.sectionHead("Sua semana", { action: U.seeAll("Dashboard/Estatísticas", "Estatísticas") })}
			<div class="av-week-card">
				<div class="av-week-bars" role="img" aria-label="Episódios por dia nos últimos 7 dias">${list.map(x => `<div class="av-week-day${x.d === today ? " is-today" : ""}" title="${U.attr(U.fmtDate(x.d))}: ${U.plural(x.episodes, "episódio", "episódios")}"><span class="av-week-val">${x.episodes || ""}</span><span class="av-week-bar"><i style="height:${x.episodes ? Math.max(8, (x.episodes / max) * 100) : 0}%"></i></span><small>${wd[new Date(x.d + "T00:00:00").getDay()]}</small></div>`).join("")}</div>
				<ul class="av-week-stats">
					<li><b>${U.fmtNum(eps)}</b><span>${eps === 1 ? "episódio" : "episódios"}</span></li>
					<li><b>${U.esc(U.fmtMinutes(min))}</b><span>assistidos</span></li>
					<li><b>${U.fmtNum(streak)}</b><span>${streak === 1 ? "dia seguido" : "dias seguidos"}</span></li>
				</ul>
			</div>
		</section>`;
	}

	// ==================================================== CARROSSEL (HOME)
	heroCarousel(ctx, list) {
		const { U } = ctx;
		const n = list.length;
		const slide = (a, i, clone = false) => `<div class="av-herocar-slide"${clone ? ' aria-hidden="true" inert data-clone' : ` data-i="${i}"`} role="group" aria-roledescription="slide" aria-label="${i + 1} de ${n}">${this.animeHero(ctx, a, { variant: "home" })}</div>`;
		return `<section class="av-herocar" data-herocar aria-roledescription="carousel" aria-label="Em destaque">
			<div class="av-herocar-track" data-herocar-track>${slide(list[n - 1], n - 1, true)}${list.map((a, i) => slide(a, i)).join("")}${slide(list[0], 0, true)}</div>
			<button type="button" class="av-herocar-nav is-prev" data-herocar-prev aria-label="Anterior">${U.icon("chevronLeft")}</button>
			<button type="button" class="av-herocar-nav is-next" data-herocar-next aria-label="Próximo">${U.icon("chevronRight")}</button>
			<div class="av-herocar-dots" role="tablist" aria-label="Escolher destaque">${list.map((a, i) => `<button type="button" role="tab" data-herocar-dot="${i}" aria-label="${U.attr(a.title)}"><i></i></button>`).join("")}</div>
		</section>`;
	}

	// =============================================================== HERO
	// Arte larga ocupando a largura toda, escurecida da esquerda para a
	// direita; título forte, linha de metadados, sinopse e o botão laranja.
	animeHero(ctx, a, { variant = "page" } = {}) {
		const { C, U, model } = ctx;
		if (!a) return "";
		const p = a.progress;
		const art = a.images.banner || a.images.cover;
		const artIsCover = !a.images.banner && !!a.images.cover;
		const meta = [a.audioLabel, a.formatLabel, a.year, a.episodes ? U.plural(a.episodes, "episódio", "episódios") : C.isMovie(a) ? U.fmtMinutes(a.duration) : ""].filter(Boolean);
		const genreLinks = a.genres.slice(0, 4).map(g => `<a class="av-hero-genre" ${U.catAttrs("genre", g, model.genres.find(x => C.normalizeKey(x.title) === C.normalizeKey(g)))}>${U.esc(C.genreLabel(g))}</a>`).join("");
		const nextLabel = C.isMovie(a) ? (p.done ? "Assistir de novo" : "Marcar como assistido")
			: p.next === null ? "Reassistir" : p.watched === 0 ? `Começar a assistir E1` : `${variant === "home" ? "Continuar" : "Assisti o"} E${p.next}`;
		const primary = variant === "home"
			? `<a class="av-btn av-btn--primary av-btn--lg" ${U.openAttrs(a.path)}>${U.icon("play")}<span>${U.esc(p.next === null && !C.isMovie(a) ? "Ver ficha" : nextLabel)}</span></a>`
			: U.btn(nextLabel, { icon: p.next === null && !C.isMovie(a) ? "repeat" : "play", kind: "primary", size: "lg", action: "ep-next", attrs: `data-path="${U.attr(a.path)}"` });
		const fav = `<button type="button" class="av-btn av-btn--outline av-btn--lg av-btn--icon av-fav${a.favorite ? " is-on" : ""}" data-action="favorite" data-path="${U.attr(a.path)}" aria-pressed="${a.favorite}" title="${a.favorite ? "Remover dos favoritos" : "Favoritar"}" aria-label="${a.favorite ? "Remover dos favoritos" : "Favoritar"}">${U.icon(a.favorite ? "bookmarkFill" : "bookmark")}</button>`;
		const menu = variant === "page" ? `<div class="av-menu-wrap"><button type="button" class="av-btn av-btn--ghost av-btn--lg av-btn--icon" data-action="menu" aria-haspopup="true" title="Mais ações" aria-label="Mais ações">${U.icon("moreV")}</button>
			<div class="av-menu" role="menu" hidden>
				<button role="menuitem" data-action="ep-log" data-path="${U.attr(a.path)}">${U.icon("notebook")}Registrar no diário</button>
				<button role="menuitem" data-action="edit" data-path="${U.attr(a.path)}">${U.icon("edit")}Editar detalhes</button>
				<button role="menuitem" data-action="review" data-path="${U.attr(a.path)}">${U.icon("star")}Minha análise</button>
				<button role="menuitem" data-action="list-edit" data-path="${U.attr(a.path)}">${U.icon("layers")}Adicionar a uma lista</button>
				<button role="menuitem" data-action="feature-toggle" data-path="${U.attr(a.path)}" data-on="${a.featuredOnHome ? "1" : ""}">${U.icon("sparkles")}${a.featuredOnHome ? "Tirar do destaque do Início" : "Destacar no Início"}</button>
				${a.status !== "Rewatching" && (a.status === "Completed" || p.done) ? `<button role="menuitem" data-action="rewatch" data-path="${U.attr(a.path)}">${U.icon("repeat")}Reassistir</button>` : ""}
				<div class="av-menu-sep"></div>
				${a.anilistId ? `<button role="menuitem" data-action="anilist-refresh" data-path="${U.attr(a.path)}">${U.icon("refresh")}Atualizar do AniList</button><button role="menuitem" data-action="anilist-art" data-path="${U.attr(a.path)}">${U.icon("download")}Baixar capa e banner</button><a role="menuitem" href="https://anilist.co/anime/${U.attr(a.anilistId)}">${U.icon("external")}Página no AniList</a>` : `<button role="menuitem" data-action="edit" data-path="${U.attr(a.path)}" data-focus="anilist">${U.icon("link")}Ligar ao AniList</button>`}
				${a.malId ? `${ctx.MAL ? `<button role="menuitem" data-action="mal-refresh" data-path="${U.attr(a.path)}">${U.icon("b-mal")}Atualizar do MyAnimeList</button>` : ""}<a role="menuitem" href="https://myanimelist.net/anime/${U.attr(a.malId)}">${U.icon("external")}Página no MyAnimeList</a>` : ""}
				${U.safeUrl(a.link) ? `<a role="menuitem" href="${U.attr(U.safeUrl(a.link))}">${U.icon("play")}Onde assistir</a>` : ""}
				<div class="av-menu-sep"></div>
				<button role="menuitem" class="is-danger" data-action="delete-anime" data-path="${U.attr(a.path)}">${U.icon("trash")}Excluir</button>
			</div></div>` : "";
		const progressLine = !C.isMovie(a) && p.total ? `<div class="av-hero-progress"><div class="av-progress av-progress--thin"><span style="width:${p.pct || 0}%"></span></div><span>${p.done ? `Concluído${a.rewatches ? ` · visto ${a.rewatches + 1}×` : ""}` : p.watched ? `E${p.watched} de ${p.total} · faltam ${U.fmtMinutes(p.left * a.duration)}` : `${p.total} episódios · ${U.fmtMinutes(p.total * a.duration)}`}</span></div>` : "";
		return `<section class="av-hero av-hero--${variant}${art ? "" : " is-noart"}${artIsCover ? " is-coverart" : ""}" style="--av-hue:${a.hue};--av-bg-x:${a.framing.x}%;--av-bg-y:${a.framing.y}%" data-anime="${U.attr(a.path)}">
			<div class="av-hero-art" aria-hidden="true">
				${art ? `<img class="av-hero-img" src="${U.attr(art)}" alt="" decoding="async" ${variant === "home" ? 'loading="lazy"' : 'fetchpriority="high"'} data-av-img>` : `<div class="av-hero-texture"></div>`}
				${a.images.cover ? `<img class="av-hero-img av-hero-img--m" src="${U.attr(a.images.cover)}" alt="" decoding="async" loading="lazy" data-av-img>` : ""}
			</div>
			<div class="av-hero-shade"></div>
			<div class="av-hero-inner">
				${variant === "page" ? `<div class="av-hero-poster">${U.cover(a, { eager: true })}</div>` : ""}
				<div class="av-hero-info">
					${variant === "home" ? `<span class="av-hero-kicker">${p.newEpisode ? "Novo episódio" : ["Watching", "Rewatching"].includes(a.status) ? "Continue de onde parou" : a.featuredOnHome ? "Em destaque" : a.status === "Planning" ? "Na sua lista" : "Da sua biblioteca"}</span>` : a.franchise ? `<a class="av-hero-kicker" ${U.catAttrs("franchise", a.franchise, model.franchises.find(x => C.normalizeKey(x.title) === C.normalizeKey(a.franchise)))}>${U.esc(a.franchise)}</a>` : ""}
					<h1 class="av-hero-title">${variant === "home" ? `<a ${U.openAttrs(a.path)}>${U.esc(a.title)}</a>` : U.esc(a.title)}</h1>
					${variant === "page" && (a.titleNative || (a.titleRomaji && a.titleRomaji !== a.title)) ? `<p class="av-hero-alt">${U.esc([a.titleRomaji !== a.title ? a.titleRomaji : "", a.titleNative].filter(Boolean).join(" · "))}</p>` : ""}
					<div class="av-hero-meta">${C.isMasterpiece(a) ? `<span class="av-hero-gold">${U.icon("crown")}Obra-prima</span>` : ""}${a.rating ? `<span class="av-hero-rate">${U.score(a.rating)}${C.scale() === 10 ? "" : `<b>${U.fmtNum(a.rating, 1)}</b>`}</span>` : ""}${a.mal.score ? `<span class="av-hero-mal" title="Nota no MyAnimeList">MAL ${U.fmtNum(a.mal.score, 2)}</span>` : ""}${meta.map(m => `<span>${U.esc(m)}</span>`).join("")}${a.airing === "RELEASING" ? `<span class="av-hero-live">Em lançamento</span>` : ""}</div>
					${a.summary ? `<p class="av-hero-sum">${U.esc(a.summary)}</p>` : ""}
					${genreLinks ? `<div class="av-hero-genres">${genreLinks}</div>` : ""}
					<div class="av-hero-actions">${primary}${fav}${variant === "page" ? `<button type="button" class="av-btn av-btn--ghost av-btn--lg av-btn--icon" data-action="list-edit" data-path="${U.attr(a.path)}" title="Adicionar a uma lista" aria-label="Adicionar a uma lista">${U.icon("plus")}</button>` : ""}${menu}</div>
					${variant === "page" ? progressLine : ""}
				</div>
			</div>
		</section>`;
	}

	// ========================================================= BIBLIOTECA
	library(ctx) {
		const { C, U, model } = ctx;
		const list = [...model.anime].sort((x, y) => x.title.localeCompare(y.title));
		const st = this._libState(ctx);
		const counts = { all: list.length, fav: list.filter(a => a.favorite).length };
		for (const k of Object.keys(C.statusDefs)) counts[k] = list.filter(a => a.status === k).length;
		const tabs = [
			{ id: "all", label: "Todos", count: counts.all },
			{ id: "Watching", label: "Assistindo", count: counts.Watching + counts.Rewatching },
			{ id: "Planning", label: "Quero assistir", count: counts.Planning },
			{ id: "Completed", label: "Concluídos", count: counts.Completed },
			{ id: "Paused", label: "Pausados", count: counts.Paused },
			{ id: "Dropped", label: "Abandonados", count: counts.Dropped },
			{ id: "fav", label: "Favoritos", count: counts.fav }
		].filter(t => t.id === "all" || t.count);
		if (!tabs.some(t => t.id === st.tab)) st.tab = "all";
		const s = model.stats;
		const html = `<div class="av-page av-pad av-libpage">
			${U.pageHead("Minha biblioteca", {
				sub: `${U.plural(s.anime, "anime", "animes")} · ${U.plural(s.episodes, "episódio assistido", "episódios assistidos")} · ${U.fmtHours(s.hours)}`,
				actions: `${U.btn("Adicionar anime", { icon: "plus", kind: "primary", action: "add-anime" })}${U.btn("", { icon: "dice", kind: "ghost", action: "random", title: "Surpreenda-me" })}`
			})}
			${U.tabs(tabs, st.tab, { cls: "av-tabs--lib" })}
			${list.length ? `<div class="av-libbar" role="toolbar" aria-label="Filtrar">
				<label class="av-field av-field--search">${U.icon("search")}<input type="search" class="av-input" data-lib-q placeholder="Buscar na biblioteca" aria-label="Buscar por título, estúdio, gênero ou franquia"></label>
				<label class="av-select-wrap">${U.icon("sort")}<select class="av-select" data-lib-sort aria-label="Ordenar">${Object.entries(this._libSorts()).map(([k, v]) => `<option value="${k}"${st.sort === k ? " selected" : ""}>${U.esc(v)}</option>`).join("")}</select></label>
				<button type="button" class="av-libbtn" data-lib-filters>${U.icon("filter")}<span>Filtros</span><b class="av-libbtn-badge" hidden>0</b></button>
				<div class="av-viewtoggle" role="radiogroup" aria-label="Visualização"><button type="button" data-view="grid" title="Grade" aria-label="Grade">${U.icon("grid")}</button><button type="button" data-view="list" title="Lista" aria-label="Lista">${U.icon("list")}</button><button type="button" data-view="mal" title="Tabela (estilo MyAnimeList)" aria-label="Tabela estilo MyAnimeList">${U.icon("table")}</button></div>
			</div>
			<div class="av-chips" data-lib-chips hidden></div>` : ""}
			<div class="av-library" data-view="${U.attr(st.view)}">
				<div class="av-grid">${list.map(a => U.animeCard(a, C).replace('<article class="av-card', `<article ${this._libAttrs(ctx, a)} class="av-card`)).join("")}</div>
				<div class="av-maltable" hidden>${list.length ? `<div class="av-malrow av-malrow--head"><span>#</span><span>Imagem</span><span>Título</span><span>Nota</span><span>Tipo</span><span>Progresso</span></div>` : ""}${list.map((a, i) => U.malRow(a, C, i + 1)).join("")}</div>
				<div class="av-list" hidden>${list.length ? `<div class="av-row av-row--head"><span></span><span>Título</span><span>Status</span><span>Progresso</span><span>Tempo</span><span>Nota</span></div>` : ""}${list.map(a => U.animeRow(a, C)).join("")}</div>
				${list.length ? "" : U.empty({ icon: "bookmark", title: "Nenhum anime ainda", text: "Busque no AniList e adicione: capa, episódios e gêneros chegam sozinhos.", action: U.btn("Adicionar anime", { icon: "plus", kind: "primary", action: "add-anime" }) })}
				<div class="av-noresults" hidden>${U.empty({ icon: "search", title: "Nada encontrado", text: "Tente outro termo, outra aba ou limpe os filtros.", action: U.btn("Limpar filtros", { attrs: "data-lib-clear" }) })}</div>
			</div>
		</div>`;
		return { active: "library", html, wire: root => this._wireLibrary(root, ctx, list) };
	}

	_libSorts() {
		return { recent: "Atividade recente", added: "Adicionados recentemente", title: "Título (A–Z)", rating: "Sua nota", progress: "Progresso", year: "Lançamento", time: "Mais tempo assistido" };
	}

	_libState(ctx) {
		const def = { tab: "all", sort: "recent", view: "grid", genre: [], format: [], studio: [], airing: "" };
		let saved = {};
		try { saved = JSON.parse(ctx.U._store("library") || "{}") || {}; } catch (_) { saved = {}; }
		const s = { ...def, ...saved, q: "" };
		for (const k of ["genre", "format", "studio"]) if (!Array.isArray(s[k])) s[k] = [];
		if (window.__avLibTab) { s.tab = window.__avLibTab; window.__avLibTab = ""; }
		if (!this._libSorts()[s.sort]) s.sort = "recent";
		return s;
	}

	_libAttrs(ctx, a) {
		const { C, U } = ctx;
		return [
			["f-status", a.status], ["f-fav", a.favorite], ["f-format", a.format], ["f-airing", a.airing],
			["f-genres", `|${a.genres.map(x => C.normalizeKey(x)).join("|")}|`], ["f-studios", `|${a.studios.map(x => C.normalizeKey(x)).join("|")}|`],
			["f-text", C.normalizeKey(`${a.title} ${a.titleRomaji} ${a.titleEnglish} ${a.franchise} ${a.studios.join(" ")} ${a.genres.map(g => C.genreLabel(g)).join(" ")}`)],
			["s-title", a.title.toLowerCase()], ["s-recent", C.maxIso(a.lastWatched, a.startDate, a.dateAdded)], ["s-added", a.dateAdded],
			["s-rating", a.rating], ["s-progress", a.progress.pct ?? -1], ["s-year", a.year || 0], ["s-time", a.minutes]
		].map(([k, v]) => `data-${k}="${U.attr(String(v))}"`).join(" ");
	}

	_wireLibrary(root, ctx, list) {
		const { C, U, V } = ctx;
		const page = root.querySelector(".av-libpage");
		const lib = root.querySelector(".av-library");
		if (!lib) return;
		const grid = lib.querySelector(".av-grid"), rowsBox = lib.querySelector(".av-list"), none = lib.querySelector(".av-noresults");
		const cards = [...grid.querySelectorAll(".av-card")];
		const rowOf = new Map([...rowsBox.querySelectorAll(".av-row[data-anime]")].map(r => [r.dataset.anime, r]));
		const malBox = lib.querySelector(".av-maltable");
		const malOf = new Map([...malBox.querySelectorAll(".av-malrow[data-anime]")].map(r => [r.dataset.anime, r]));
		const statusOf = new Map(list.map(a => [a.path, a.status]));
		const st = this._libState(ctx);
		const save = () => { const { q, ...rest } = st; U._store("library", JSON.stringify(rest)); };
		const genreLabel = new Map(), studioLabel = new Map();
		for (const a of list) { for (const g of a.genres) genreLabel.set(C.normalizeKey(g), C.genreLabel(g)); for (const s of a.studios) studioLabel.set(C.normalizeKey(s), s); }
		const tabOk = d => st.tab === "all" || (st.tab === "fav" ? d.fFav === "true" : st.tab === "Watching" ? ["Watching", "Rewatching"].includes(d.fStatus) : d.fStatus === st.tab);
		const matches = d => tabOk(d)
			&& (!st.q || d.fText.includes(st.q))
			&& (!st.genre.length || st.genre.every(g => d.fGenres.includes(`|${g}|`)))
			&& (!st.studio.length || st.studio.some(s => d.fStudios.includes(`|${s}|`)))
			&& (!st.format.length || st.format.includes(d.fFormat))
			&& (!st.airing || d.fAiring === st.airing);
		const cmp = (a, b) => {
			const x = a.dataset, y = b.dataset;
			switch (st.sort) {
				case "title": return x.sTitle.localeCompare(y.sTitle);
				case "added": return y.sAdded.localeCompare(x.sAdded) || x.sTitle.localeCompare(y.sTitle);
				case "rating": return Number(y.sRating) - Number(x.sRating) || x.sTitle.localeCompare(y.sTitle);
				case "progress": return Number(y.sProgress) - Number(x.sProgress) || x.sTitle.localeCompare(y.sTitle);
				case "year": return Number(y.sYear) - Number(x.sYear) || x.sTitle.localeCompare(y.sTitle);
				case "time": return Number(y.sTime) - Number(x.sTime) || x.sTitle.localeCompare(y.sTitle);
				default: return y.sRecent.localeCompare(x.sRecent) || x.sTitle.localeCompare(y.sTitle);
			}
		};
		const chipsBox = page.querySelector("[data-lib-chips]");
		const badge = page.querySelector(".av-libbtn-badge");
		const paintChips = n => {
			const chips = [
				...st.genre.map(g => ["genre", g, genreLabel.get(g) || g]),
				...st.studio.map(s => ["studio", s, studioLabel.get(s) || s]),
				...st.format.map(f => ["format", f, C.formatLabel(f)]),
				...(st.airing ? [["airing", st.airing, C.airingLabel(st.airing)]] : [])
			];
			if (badge) { badge.hidden = !chips.length; badge.textContent = String(chips.length); }
			if (!chipsBox) return;
			chipsBox.hidden = !chips.length && !st.q;
			chipsBox.innerHTML = chips.map(([k, v, l]) => `<button type="button" class="av-chip" data-rm="${k}" data-v="${U.attr(v)}">${U.esc(l)}${U.icon("x")}</button>`).join("") + (chips.length > 1 ? `<button type="button" class="av-chip av-chip--clear" data-lib-clear>Limpar tudo</button>` : "") + `<span class="av-chips-count">${U.plural(n, "anime", "animes")}</span>`;
		};
		const apply = () => {
			const vis = [], hid = [];
			for (const c of cards) (matches(c.dataset) ? vis : hid).push(c);
			vis.sort(cmp);
			const gf = document.createDocumentFragment(), rf = document.createDocumentFragment();
			for (const c of vis) { c.hidden = false; gf.appendChild(c); const r = rowOf.get(c.dataset.anime); if (r) { r.hidden = false; rf.appendChild(r); } }
			for (const c of hid) { c.hidden = true; gf.appendChild(c); const r = rowOf.get(c.dataset.anime); if (r) { r.hidden = true; rf.appendChild(r); } }
			grid.appendChild(gf); rowsBox.appendChild(rf);
			// tabela do MAL: em "Todos", seções por status com a cor de cada um
			malBox.querySelectorAll(".av-malgroup").forEach(x => x.remove());
			const mf = document.createDocumentFragment();
			const order = ["Watching", "Rewatching", "Completed", "Paused", "Dropped", "Planning"];
			const groups = st.tab === "all" ? order.map(k => [k, vis.filter(c => statusOf.get(c.dataset.anime) === k)]).filter(([, l]) => l.length) : [["", vis]];
			for (const [k, items] of groups) {
				if (k) { const h = document.createElement("div"); h.className = "av-malgroup"; h.style.setProperty("--av-ms", C.malStatus[k].color); h.innerHTML = `<span>${U.esc(C.statusLabel(k))}</span><small>${items.length}</small>`; mf.appendChild(h); }
				items.forEach((c, i) => { const r = malOf.get(c.dataset.anime); if (r) { r.hidden = false; r.querySelector(".av-malrow-n").textContent = String(i + 1); mf.appendChild(r); } });
			}
			for (const c of hid) { const r = malOf.get(c.dataset.anime); if (r) { r.hidden = true; mf.appendChild(r); } }
			malBox.appendChild(mf);
			none.hidden = vis.length > 0 || !cards.length;
			paintChips(vis.length);
			save();
		};
		const setView = v => {
			st.view = ["list", "mal"].includes(v) ? v : "grid";
			lib.dataset.view = st.view;
			grid.hidden = st.view !== "grid"; rowsBox.hidden = st.view !== "list"; malBox.hidden = st.view !== "mal";
			page.querySelectorAll(".av-viewtoggle [data-view]").forEach(b => { const on = b.dataset.view === st.view; b.classList.toggle("is-active", on); b.setAttribute("aria-checked", String(on)); });
			save();
		};
		const clearAll = () => { Object.assign(st, { genre: [], studio: [], format: [], airing: "", q: "" }); const q = page.querySelector("[data-lib-q]"); if (q) q.value = ""; apply(); };
		page.querySelectorAll(".av-tabs--lib .av-tab").forEach(t => t.addEventListener("click", () => {
			st.tab = t.dataset.tab;
			page.querySelectorAll(".av-tabs--lib .av-tab").forEach(x => { const on = x === t; x.classList.toggle("is-active", on); x.setAttribute("aria-selected", String(on)); });
			V._haptic(6);
			apply();
		}));
		const q = page.querySelector("[data-lib-q]");
		q?.addEventListener("input", () => { st.q = C.normalizeKey(q.value); apply(); });
		page.querySelector("[data-lib-sort]")?.addEventListener("change", e => { st.sort = e.target.value; apply(); });
		page.addEventListener("click", e => {
			const t = e.target;
			const vb = t.closest(".av-viewtoggle [data-view]");
			if (vb) return setView(vb.dataset.view);
			if (t.closest("[data-lib-clear]")) return clearAll();
			const rm = t.closest("[data-rm]");
			if (rm) { const k = rm.dataset.rm; if (Array.isArray(st[k])) st[k] = st[k].filter(x => x !== rm.dataset.v); else st[k] = ""; return apply(); }
			if (t.closest("[data-lib-filters]")) return this._libFilters(ctx, { list, st, apply, clearAll, genreLabel, studioLabel, count: () => cards.filter(c => !c.hidden).length });
		});
		setView(st.view);
		apply();
	}

	_libFilters(ctx, { list, st, apply, clearAll, genreLabel, studioLabel, count }) {
		const { C, U, V } = ctx;
		const tally = fn => { const m = new Map(); for (const a of list) for (const k of [].concat(fn(a)).filter(Boolean)) m.set(k, (m.get(k) || 0) + 1); return m; };
		const gN = tally(a => a.genres.map(x => C.normalizeKey(x))), sN = tally(a => a.studios.map(x => C.normalizeKey(x)));
		const fN = tally(a => a.format), aN = tally(a => a.airing);
		const chip = (k, v, label, n) => `<button type="button" class="av-fchip" data-k="${k}" data-v="${U.attr(v)}">${label}<span>${n}</span></button>`;
		const group = (title, inner) => inner ? `<section class="av-fgroup"><h4>${U.esc(title)}</h4><div class="av-fchips">${inner}</div></section>` : "";
		const sorted = m => [...m].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
		const body = document.createElement("div");
		body.className = "av-host av-sheet";
		body.innerHTML = `${group("Gêneros (todos os escolhidos)", sorted(gN).map(([k, n]) => chip("genre", k, U.esc(genreLabel.get(k) || k), n)).join(""))}
			${group("Formato", sorted(fN).map(([k, n]) => chip("format", k, U.esc(C.formatLabel(k)), n)).join(""))}
			${aN.size ? group("Exibição", sorted(aN).map(([k, n]) => chip("airing", k, U.esc(C.airingLabel(k)), n)).join("")) : ""}
			${sN.size > 1 ? group("Estúdio", sorted(sN).map(([k, n]) => chip("studio", k, U.esc(studioLabel.get(k) || k), n)).join("")) : ""}`;
		const m = V.modal({ title: "Filtros", sub: "Os resultados mudam na hora", size: "md", body, actions: `${U.btn("Limpar", { kind: "ghost", attrs: "data-f-clear" })}${U.btn("Ver animes", { kind: "primary", attrs: "data-close data-f-done" })}` });
		const paint = () => {
			body.querySelectorAll(".av-fchip").forEach(b => {
				const k = b.dataset.k, v = b.dataset.v;
				const on = Array.isArray(st[k]) ? st[k].includes(v) : st[k] === v;
				b.classList.toggle("is-active", on); b.setAttribute("aria-pressed", String(on));
			});
			const done = m.el.querySelector("[data-f-done] span");
			if (done) done.textContent = count() ? `Ver ${U.plural(count(), "anime", "animes")}` : "Nenhum anime";
		};
		body.addEventListener("click", e => {
			const b = e.target.closest(".av-fchip");
			if (!b) return;
			const k = b.dataset.k, v = b.dataset.v;
			if (Array.isArray(st[k])) st[k] = st[k].includes(v) ? st[k].filter(x => x !== v) : [...st[k], v];
			else st[k] = st[k] === v ? "" : v;
			apply(); paint();
		});
		m.el.querySelector("[data-f-clear]")?.addEventListener("click", () => { clearAll(); paint(); });
		paint();
	}

	// =========================================================== FICHA
	anime(ctx) {
		const { C, U, model, current } = ctx;
		const a = model.animeByPath.get(current.file.path);
		if (!a) return { active: "library", html: `<div class="av-page av-pad">${U.empty({ icon: "alert", title: "Anime não encontrado no índice", text: "Confira se o frontmatter tem type: anime." })}</div>` };
		const related = this._related(ctx, a);
		const tabs = [
			{ id: "episodes", label: C.isMovie(a) ? "Filme" : "Episódios", count: C.isMovie(a) ? null : a.episodes },
			{ id: "details", label: "Detalhes" },
			a.anilistId ? { id: "characters", label: "Personagens" } : null,
			{ id: "diary", label: "Diário", count: a.log.length || null },
			related.count || related.remote ? { id: "related", label: "Relacionados", count: related.count || null } : null
		].filter(Boolean);
		const html = `<div class="av-page av-page--anime" data-anime="${U.attr(a.path)}" style="--av-hue:${a.hue}">
			${this.animeHero(ctx, a)}
			<div class="av-animenav">${U.tabs(tabs, "episodes", { cls: "av-tabs--anime" })}</div>
			<div class="av-pad av-animebody">
				<div class="av-panel" data-panel="episodes">${this._episodes(ctx, a)}</div>
				<div class="av-panel" data-panel="details" hidden>${this._details(ctx, a)}</div>
				${a.anilistId ? `<div class="av-panel" data-panel="characters" hidden>${this._characters(ctx, a)}</div>` : ""}
				<div class="av-panel" data-panel="diary" hidden>${this._diary(ctx, a)}</div>
				${related.count || related.remote ? `<div class="av-panel" data-panel="related" hidden>${related.html}</div>` : ""}
			</div>
		</div>`;
		return {
			active: "anime", html, wire: root => {
				const show = id => {
					root.querySelectorAll(".av-tabs--anime .av-tab").forEach(t => { const on = t.dataset.tab === id; t.classList.toggle("is-active", on); t.setAttribute("aria-selected", String(on)); });
					root.querySelectorAll(".av-panel").forEach(p => { p.hidden = p.dataset.panel !== id; });
					window.__avAnimeTab = { path: a.path, id };
					if ((id === "characters" || id === "related") && !root.__avExtra) { root.__avExtra = true; ctx.AL?.fillExtras?.(ctx, root, a).catch(() => {}); }
				};
				root.querySelectorAll(".av-tabs--anime .av-tab").forEach(t => t.addEventListener("click", () => { show(t.dataset.tab); ctx.V._haptic(6); }));
				root.querySelectorAll("[data-goto-tab]").forEach(b => b.addEventListener("click", () => { show(b.dataset.gotoTab); root.querySelector(".av-animenav")?.scrollIntoView({ block: "start", behavior: ctx.V._smooth() }); }));
				if (window.__avAnimeTab?.path === a.path) show(window.__avAnimeTab.id);
				this._wireEpisodes(root, ctx, a);
				this._wireDetails(root, ctx, a);
			}
		};
	}

	// ---- episódios: grade de miniaturas 16:9, como na Crunchyroll
	_episodes(ctx, a) {
		const { C, U } = ctx;
		const p = a.progress;
		if (C.isMovie(a)) {
			const seen = p.done || a.watched > 0;
			const when = a.log[a.log.length - 1]?.date || a.completionDate;
			return `<div class="av-eplist av-eplist--movie">${this._epTile(ctx, a, 1, { seen, current: !seen, title: a.title, when, movie: true })}</div>
				${this._epSummary(ctx, a)}`;
		}
		const total = p.total || Math.max(a.watched + 1, p.aired || 0, 1);
		const PAGE = 50;
		const ranges = [];
		for (let i = 1; i <= total; i += PAGE) ranges.push([i, Math.min(total, i + PAGE - 1)]);
		const curRange = Math.max(0, ranges.findIndex(([s, e]) => (p.next || a.watched || 1) >= s && (p.next || a.watched || 1) <= e));
		const whenOf = this._epDates(a);
		const tiles = [];
		for (let n = 1; n <= total; n++) {
			const r = Math.floor((n - 1) / PAGE);
			const notAired = a.airing === "RELEASING" && p.aired !== null && n > p.aired;
			tiles.push(this._epTile(ctx, a, n, { seen: n <= a.watched, current: n === p.next, notAired, when: whenOf.get(n) || "", range: r, hidden: r !== curRange }));
		}
		return `${this._epSummary(ctx, a)}
			<div class="av-eptools">
				${ranges.length > 1 ? `<div class="av-fchips av-fchips--scroll av-epranges" role="tablist" aria-label="Episódios">${ranges.map(([s, e], i) => `<button type="button" class="av-fchip${i === curRange ? " is-active" : ""}" data-range="${i}">${s}–${e}</button>`).join("")}</div>` : `<span class="av-eptools-label">${U.plural(total, "episódio", "episódios")}${p.total ? "" : " até agora"}</span>`}
				<div class="av-eptools-acts">
					<button type="button" class="av-ovlink" data-ep-sort title="Inverter a ordem">${U.icon("sort")}<span>Mais antigos</span></button>
					<button type="button" class="av-ovlink" data-action="ep-log" data-path="${U.attr(a.path)}">${U.icon("notebook")}<span>Registrar</span></button>
				</div>
			</div>
			<div class="av-eplist" data-eplist>${tiles.join("")}</div>
			${!p.total ? `<p class="av-fineprint">${U.icon("info")}O total de episódios não está na nota. ${a.anilistId ? "Atualize do AniList ou informe" : "Informe"} em Editar detalhes.</p>` : ""}`;
	}

	// data em que cada episódio entrou no diário
	_epDates(a) {
		const m = new Map();
		for (const l of a.log) {
			if (l.from === null || l.to === null) continue;
			for (let n = l.from; n <= l.to && n - l.from < 2000; n++) if (!m.has(n) || m.get(n) < l.date) m.set(n, l.date);
		}
		return m;
	}

	_epTile(ctx, a, n, { seen, current, notAired = false, when = "", range = 0, hidden = false, title = "", movie = false }) {
		const { U } = ctx;
		const art = a.images.banner || a.images.cover;
		// cada episódio recorta a arte num ponto diferente: a grade não vira um bloco igual
		const pos = `${(n * 37) % 100}% ${30 + ((n * 23) % 40)}%`;
		const label = movie ? U.fmtMinutes(a.duration) : `${a.duration}m`;
		return `<button type="button" class="av-ep${seen ? " is-seen" : ""}${current ? " is-current" : ""}${notAired ? " is-soon" : ""}" data-ep="${n}" data-range="${range}"${hidden ? " hidden" : ""} ${notAired ? "disabled" : `data-action="ep-set" data-path="${U.attr(a.path)}"`} aria-pressed="${seen}" aria-label="${movie ? U.attr(a.title) : `Episódio ${n}`}${seen ? ", assistido" : ""}">
			<span class="av-ep-art" style="--av-hue:${(a.hue + n * 11) % 360}">
				${art ? `<img src="${U.attr(art)}" alt="" loading="lazy" decoding="async" data-av-img style="object-position:${pos}" data-ep-thumb>` : ""}
				<span class="av-ep-num">${movie ? U.icon("film") : n}</span>
				<span class="av-ep-play">${U.icon(seen ? "check" : "play")}</span>
				<span class="av-ep-dur">${notAired ? "Em breve" : U.esc(label)}</span>
				${seen ? `<span class="av-ep-bar"><i></i></span>` : ""}
				${current ? `<span class="av-ep-next">Próximo</span>` : ""}
			</span>
			<span class="av-ep-body">
				<span class="av-ep-title" data-ep-title>${movie ? U.esc(title || a.title) : `E${n} - Episódio ${n}`}</span>
				<span class="av-ep-meta">${seen ? `${U.icon("check")}Assistido${when ? ` ${U.esc(U.relDate(when))}` : ""}` : notAired ? "Ainda não exibido" : current ? "Toque ao terminar de assistir" : U.esc(a.audioLabel || "Não assistido")}</span>
			</span>
		</button>`;
	}

	_epSummary(ctx, a) {
		const { C, U } = ctx;
		const p = a.progress;
		const left = p.left !== null ? p.left * a.duration : null;
		return `<section class="av-epsum">
			<div class="av-epsum-ring">${U.ring(p.pct ?? (p.done ? 100 : 0), { size: 64, stroke: 5, done: p.done })}<b>${p.pct === null ? (p.done ? "100%" : "—") : U.fmtPct(p.pctRound)}</b></div>
			<div class="av-epsum-text">
				<strong>${p.done ? (a.status === "Completed" ? "Você concluiu este anime" : "Todos os episódios assistidos") : p.watched ? (C.isMovie(a) ? "Em andamento" : `Você parou no episódio ${p.watched}`) : C.isMovie(a) ? "Você ainda não viu este filme" : "Você ainda não começou"}</strong>
				<span>${[
					p.total && !C.isMovie(a) ? `${p.watched} de ${p.total} episódios` : "",
					!p.done && left ? `faltam ${U.fmtMinutes(left)}` : "",
					a.minutes ? `${U.fmtMinutes(a.minutes)} assistidos` : "",
					a.rewatches ? `visto ${a.rewatches + 1} vezes` : "",
					p.newEpisode ? `${U.plural(p.behind, "episódio novo", "episódios novos")}` : ""
				].filter(Boolean).map(x => U.esc(x)).join(" · ")}</span>
				${a.airing === "RELEASING" && a.nextAiring.at ? `<span class="av-epsum-air">${U.icon("bell")}E${a.nextAiring.episode} sai ${U.esc(this.airLabel(ctx, a.nextAiring.at))}</span>` : a.airingDay !== null && a.airing !== "FINISHED" ? `<span class="av-epsum-air">${U.icon("calendar")}Novos episódios às ${U.esc(C.weekdays[a.airingDay].toLowerCase())}s${a.airingTime ? `, ${U.esc(a.airingTime)}` : ""}</span>` : ""}
			</div>
			<div class="av-epsum-acts">
				${p.next !== null ? U.btn(C.isMovie(a) ? "Marcar como assistido" : `Assisti o E${p.next}`, { icon: "play", kind: "primary", action: "ep-next", attrs: `data-path="${U.attr(a.path)}"` }) : U.btn("Reassistir", { icon: "repeat", kind: "outline", action: "rewatch", attrs: `data-path="${U.attr(a.path)}"` })}
				${!a.rating && (p.done || a.watched >= 3) ? U.btn("Dar nota", { icon: "star", kind: "ghost", action: "rate", attrs: `data-path="${U.attr(a.path)}"` }) : ""}
			</div>
		</section>`;
	}

	airLabel(ctx, at) {
		const { U, C } = ctx;
		const d = new Date(at);
		if (isNaN(d)) return "";
		const iso = C.isoOf(d);
		const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
		const rel = U.relDate(iso);
		const days = C.daysBetween(C.today(), iso);
		return days > 1 && days < 7 ? `${C.weekdays[d.getDay()].toLowerCase()} às ${time}` : `${rel} às ${time}`;
	}

	_wireEpisodes(root, ctx, a) {
		const panel = root.querySelector('.av-panel[data-panel="episodes"]');
		if (!panel) return;
		const list = panel.querySelector("[data-eplist]");
		panel.querySelectorAll(".av-epranges [data-range]").forEach(b => b.addEventListener("click", () => {
			const r = b.dataset.range;
			panel.querySelectorAll(".av-epranges [data-range]").forEach(x => x.classList.toggle("is-active", x === b));
			list?.querySelectorAll(".av-ep").forEach(ep => { ep.hidden = ep.dataset.range !== r; });
		}));
		const sortBtn = panel.querySelector("[data-ep-sort]");
		sortBtn?.addEventListener("click", () => {
			if (!list) return;
			const rev = !list.classList.toggle("is-rev") ? false : true;
			[...list.children].reverse().forEach(el => list.appendChild(el));
			sortBtn.querySelector("span").textContent = rev ? "Mais recentes" : "Mais antigos";
		});
		// títulos e miniaturas reais dos episódios (cache do AniList), se houver
		ctx.AL?.episodeInfo?.(a).then(info => {
			if (!info?.length || !list?.isConnected) return;
			const by = new Map(info.map(x => [x.n, x]));
			list.querySelectorAll(".av-ep[data-ep]").forEach(el => {
				const x = by.get(Number(el.dataset.ep));
				if (!x) return;
				if (x.title) el.querySelector("[data-ep-title]").textContent = `E${x.n} - ${x.title}`;
				const img = el.querySelector("[data-ep-thumb]");
				if (x.thumb && img) { img.classList.remove("is-loaded"); img.style.objectPosition = "50% 50%"; img.src = x.thumb; img.addEventListener("load", () => img.classList.add("is-loaded"), { once: true }); }
			});
		}).catch(() => {});
	}

	// ---- detalhes: barra de notas e "Informações / Estatísticas" do MyAnimeList,
	// sinopse, análise e a história com o anime
	_details(ctx, a) {
		const { C, U, model } = ctx;
		const find = (list, name) => list.find(x => C.normalizeKey(x.title) === C.normalizeKey(name)) || null;
		const chip = (kind, name, list, label = name) => `<a class="av-inline-link" ${U.catAttrs(kind, name, find(list, name))}>${U.esc(label)}</a>`;
		const joinLinks = arr => arr.join(", ");
		const m = a.mal;
		const premiered = a.season ? `<a class="av-inline-link" data-season="${U.attr(a.season)}" data-year="${U.attr(a.seasonYear || "")}" href="#">${U.esc(C.seasonLabel(a.season, a.seasonYear))}</a>` : "";
		const aired = [a.airedFrom ? U.fmtDate(a.airedFrom) : "", a.airedTo && a.airedTo !== a.airedFrom ? U.fmtDate(a.airedTo) : a.airing === "RELEASING" ? "?" : ""].filter(Boolean).join(" até ");
		const broadcast = a.broadcast || (a.airingDay !== null ? `${C.weekdays[a.airingDay]}s${a.airingTime ? ` às ${a.airingTime}` : ""}` : "");
		const info = [
			["Tipo", U.esc(a.formatLabel)],
			!C.isMovie(a) && ["Episódios", a.episodes ? String(a.episodes) : "Desconhecido"],
			a.airing && ["Status", U.esc(C.airingLabel(a.airing))],
			aired && ["Exibido", U.esc(aired)],
			premiered && ["Estreia", premiered],
			broadcast && ["Transmissão", U.esc(broadcast)],
			a.producers.length && ["Produtoras", U.esc(a.producers.join(", "))],
			a.studios.length && ["Estúdios", joinLinks(a.studios.map(s => chip("studio", s, model.studios)))],
			a.source && ["Fonte", U.esc(C.sourceLabel(a.source))],
			a.genres.length && ["Gêneros", joinLinks(a.genres.map(g => chip("genre", g, model.genres, C.genreLabel(g))))],
			a.themes.length && ["Temas", U.esc(a.themes.join(", "))],
			a.demographic.length && ["Demografia", U.esc(a.demographic.join(", "))],
			["Duração", C.isMovie(a) ? U.esc(U.fmtMinutes(a.duration)) : `${a.duration} min por ep.`],
			a.ageRating && ["Classificação", U.esc(a.ageRating)],
			a.audioLabel && ["Áudio", U.esc(a.audioLabel)],
			a.streaming.length && ["Onde assistir", U.esc(a.streaming.join(", "))]
		].filter(Boolean);
		const alt = [["Inglês", a.titleEnglish], ["Romaji", a.titleRomaji], ["Japonês", a.titleNative]].filter(([, v]) => v && v !== a.title);
		const stats = [
			m.score && ["Nota MAL", `${U.fmtNum(m.score, 2)}${m.scoredBy ? ` <small>(${U.fmtNum(m.scoredBy)} votos)</small>` : ""}`],
			m.rank && ["Ranking MAL", `#${U.fmtNum(m.rank)}`],
			m.popularity && ["Popularidade MAL", `#${U.fmtNum(m.popularity)}`],
			m.members && ["Membros MAL", U.fmtNum(m.members)],
			m.favorites && ["Favoritos MAL", U.fmtNum(m.favorites)],
			a.score && ["Nota AniList", `${a.score}%`],
			a.anilist.rank && ["Ranking AniList", `#${U.fmtNum(a.anilist.rank)}`],
			a.anilist.popularity && ["Usuários AniList", U.fmtNum(a.anilist.popularity)]
		].filter(Boolean);
		const lists = model.listsByAnime.get(a.path) || [];
		const dates = [["Adicionado", a.dateAdded], ["Começou", a.startDate], ["Concluiu", a.completionDate], ["Última vez", a.lastWatched]].filter(([, v]) => v);
		const tiers = { S: "Obra-prima", A: "Excelente", B: "Muito bom", C: "Bom", D: "Esquecível" };
		const ten = C.scale() === 10;
		const scoreBox = `<div class="av-scorebox">
			<div class="av-scorebox-main"><span class="av-scorebox-label">${m.score ? "Nota MAL" : a.score ? "AniList" : "Sua nota"}</span><b>${m.score ? U.fmtNum(m.score, 2) : a.score ? `${a.score}%` : a.rating ? U.esc(U.scoreText(a.rating)) : "N/A"}</b><small>${m.scoredBy ? `${U.fmtNum(m.scoredBy)} votos` : m.score ? "" : a.score ? "média dos usuários" : ""}</small></div>
			<ul class="av-scorebox-stats">
				<li><span>Ranking</span><b>${m.rank ? `#${U.fmtNum(m.rank)}` : a.anilist.rank ? `#${U.fmtNum(a.anilist.rank)}` : "N/A"}</b></li>
				<li><span>Popularidade</span><b>${m.popularity ? `#${U.fmtNum(m.popularity)}` : a.anilist.popularRank ? `#${U.fmtNum(a.anilist.popularRank)}` : "N/A"}</b></li>
				<li><span>Membros</span><b>${m.members ? U.fmtNum(m.members) : a.anilist.popularity ? U.fmtNum(a.anilist.popularity) : "N/A"}</b></li>
			</ul>
			<div class="av-scorebox-tags">${a.season ? `<span>${U.esc(C.seasonLabel(a.season, a.seasonYear))}</span>` : ""}<span>${U.esc(a.formatLabel)}</span>${a.studios[0] ? `<span>${U.esc(a.studios[0])}</span>` : ""}</div>
			${!m.score && a.malId && ctx.MAL ? `<button type="button" class="av-ovlink" data-action="mal-refresh" data-path="${U.attr(a.path)}">${U.icon("b-mal")}<span>Buscar nota no MAL</span></button>` : ""}
		</div>`;
		return `<div class="av-details">
			<aside class="av-details-side">
				<section class="av-surface av-myscore">
					<h3 class="av-h3">Sua nota</h3>
					${ten ? `<div class="av-rateline">${U.scoreSelect(a.rating, `data-score10 data-path="${U.attr(a.path)}"`)}</div>` : `<div class="av-rateline" data-rate-inline data-path="${U.attr(a.path)}">${U.stars(a.rating, { input: true })}<b>${a.rating ? U.fmtNum(a.rating, 1) : "—"}</b></div>`}
					${tiers[a.tier] ? `<a class="av-tierchip av-tier--${a.tier.toLowerCase()}" ${U.openAttrs("Dashboard/Tier List")}><b>${U.esc(a.tier)}</b><span>${U.esc(tiers[a.tier])}</span></a>` : ""}
					<div class="av-statuspick" role="group" aria-label="Mudar status">${Object.keys(C.statusDefs).map(k => `<button type="button" class="av-statuspick-btn${a.status === k ? " is-active" : ""}" data-action="status" data-status="${k}" data-path="${U.attr(a.path)}" style="--av-ms:${C.malStatus[k].color}"><i class="av-dot"></i>${U.esc(C.statusLabel(k))}</button>`).join("")}</div>
					<div class="av-epline"><span>Episódios</span><b>${a.progress.watched}</b><span>/ ${a.progress.total || "?"}</span>${a.progress.next !== null && !C.isMovie(a) ? `<button type="button" class="av-malrow-plus" data-action="ep-next" data-path="${U.attr(a.path)}" title="Assisti o E${a.progress.next}">${U.icon("plus")}</button>` : ""}</div>
				</section>
				${alt.length ? `<section class="av-malbox"><h3>Títulos alternativos</h3><dl>${alt.map(([k, v]) => `<div><dt>${U.esc(k)}:</dt><dd>${U.esc(v)}</dd></div>`).join("")}</dl></section>` : ""}
				<section class="av-malbox"><h3>Informações</h3><dl>${info.map(([k, v]) => `<div><dt>${U.esc(k)}:</dt><dd>${v}</dd></div>`).join("")}</dl></section>
				<section class="av-malbox"><h3>Estatísticas</h3>${stats.length ? `<dl>${stats.map(([k, v]) => `<div><dt>${U.esc(k)}:</dt><dd>${v}</dd></div>`).join("")}</dl>` : `<p class="av-muted">${a.malId || a.anilistId ? "Atualize pelo MyAnimeList ou AniList (menu ⋮)." : "Ligue ao MyAnimeList/AniList para ver nota, ranking e popularidade."}</p>`}</section>
				<section class="av-malbox"><h3>Seu histórico</h3><dl>
					<div><dt>Tempo assistido:</dt><dd>${a.minutes ? U.esc(U.fmtMinutes(a.minutes)) : "—"}</dd></div>
					${dates.map(([k, v]) => `<div><dt>${U.esc(k)}:</dt><dd>${U.esc(U.fmtDate(v))}</dd></div>`).join("")}
					${a.rewatches ? `<div><dt>Reassistido:</dt><dd>${a.rewatches}×</dd></div>` : ""}
				</dl></section>
				<section class="av-malbox"><h3>Nas suas listas</h3>
					${lists.length ? `<div class="av-chiplinks">${lists.map(l => `<a class="av-chiplink" ${U.openAttrs(l.path)}>${U.icon(l.icon || "layers")}${U.esc(l.title)}</a>`).join("")}</div>` : `<p class="av-muted">Ainda em nenhuma lista.</p>`}
					<button type="button" class="av-ovlink" data-action="list-edit" data-path="${U.attr(a.path)}">${U.icon("plus")}<span>Adicionar a uma lista</span></button>
				</section>
				<section class="av-malbox av-extlinks"><h3>Links</h3>
					${a.anilistId ? `<a href="https://anilist.co/anime/${U.attr(a.anilistId)}">${U.icon("b-anilist")}AniList</a>` : ""}
					${a.malId ? `<a href="https://myanimelist.net/anime/${U.attr(a.malId)}">${U.icon("b-mal")}MyAnimeList</a>` : ""}
					${U.safeUrl(a.link) ? `<a href="${U.attr(U.safeUrl(a.link))}">${U.icon("play")}Onde assistir</a>` : ""}
					${!a.anilistId && !a.malId ? `<p class="av-muted">Sem ligação. Use Editar detalhes para informar os IDs.</p>` : ""}
				</section>
			</aside>
			<div class="av-details-main">
				${scoreBox}
				${a.summary ? `<section class="av-block"><h3 class="av-h3 av-h3--line">Sinopse</h3><p class="av-synopsis">${U.esc(a.summary)}</p></section>` : U.empty({ icon: "notebook", title: "Sem sinopse", text: a.anilistId ? "Use Atualizar do AniList no menu ⋮." : "Escreva uma em Editar detalhes.", compact: true })}
				${a.tags.length ? `<div class="av-taglist">${a.tags.map(t => `<span class="av-tag">${U.esc(t)}</span>`).join("")}</div>` : ""}
				${this._review(ctx, a)}
				${this._timeline(ctx, a)}
			</div>
		</div>`;
	}

	_review(ctx, a) {
		const { U } = ctx;
		const has = a.review || a.pros.length || a.cons.length || a.recommend !== null;
		const edit = `<button type="button" class="av-ovlink" data-action="review" data-path="${U.attr(a.path)}">${U.icon(has ? "edit" : "plus")}<span>${has ? "Editar" : "Escrever minha análise"}</span></button>`;
		if (!has) return a.watched || a.status === "Completed" ? `<section class="av-review is-empty">${U.icon("star")}<div><b>Minha análise</b><span>O que você achou? Opinião, pontos fortes e fracos.</span></div>${edit}</section>` : "";
		const rec = a.recommend === true ? `<span class="av-rec is-yes">${U.icon("check")}Recomendo</span>` : a.recommend === false ? `<span class="av-rec is-no">${U.icon("x")}Não recomendo</span>` : "";
		return `<section class="av-review">
			<header><h3 class="av-h3">Minha análise</h3>${rec}${a.rating ? `<span class="av-review-score">${U.score(a.rating)}</span>` : ""}${edit}</header>
			${a.review ? `<blockquote>${U.esc(a.review)}</blockquote>` : ""}
			${a.pros.length || a.cons.length ? `<div class="av-proscons">
				${a.pros.length ? `<ul class="is-pro">${a.pros.map(x => `<li>${U.icon("plus")}${U.esc(x)}</li>`).join("")}</ul>` : ""}
				${a.cons.length ? `<ul class="is-con">${a.cons.map(x => `<li>${U.icon("minus")}${U.esc(x)}</li>`).join("")}</ul>` : ""}
			</div>` : ""}
		</section>`;
	}

	_timeline(ctx, a) {
		const { U, C } = ctx;
		const ev = [];
		const add = (date, icon, title, sub = "", tone = "") => { if (date) ev.push({ date, icon, title, sub, tone }); };
		add(a.dateAdded, "plus", "Entrou na biblioteca");
		add(a.startDate, "play", "Começou a assistir", "", "orange");
		const big = [...a.log].sort((x, y) => C.logCount(y) - C.logCount(x))[0];
		if (big && C.logCount(big) >= 4) add(big.date, "flame", `Maratona de ${C.logCount(big)} episódios`, big.note, "amber");
		add(a.completionDate, "check", a.rewatches ? "Concluiu (de novo)" : "Concluiu", a.startDate && a.completionDate ? `em ${this._span(C.daysBetween(a.startDate, a.completionDate))}` : "", "green");
		if (ev.length < 2) return "";
		ev.sort((x, y) => x.date.localeCompare(y.date));
		return `<section class="av-block av-tl">
			<h3 class="av-h3 av-h3--line">Sua história com o anime</h3>
			<ol class="av-tl-list">${ev.map(e => `<li class="av-tl-item${e.tone ? ` is-${e.tone}` : ""}"><span class="av-tl-dot">${U.icon(e.icon)}</span><div><time>${U.esc(U.fmtDate(e.date))}</time><b>${U.esc(e.title)}</b>${e.sub ? `<small>${U.esc(e.sub)}</small>` : ""}</div></li>`).join("")}</ol>
		</section>`;
	}

	_span(days) {
		if (days === null || days <= 0) return "um dia";
		if (days < 60) return `${days} ${days === 1 ? "dia" : "dias"}`;
		const m = Math.round(days / 30.4);
		return m < 24 ? `${m} meses` : `${Math.round(days / 365)} anos`;
	}

	_wireDetails(root, ctx, a) {
		const save = async v => {
			const f = app.vault.getAbstractFileByPath(a.path);
			if (!f) return;
			await app.fileManager.processFrontMatter(f, fm => { fm.rating = v; });
			ctx.V.toast(v ? `Nota ${ctx.U.scoreText(v)}` : "Nota removida", { tone: "ok", icon: "starFill" });
		};
		const line = root.querySelector("[data-rate-inline]");
		line?.querySelectorAll("[data-star]").forEach(b => b.addEventListener("click", e => {
			const r = b.getBoundingClientRect();
			const half = e.clientX && e.clientX < r.left + r.width / 2;
			const v = Number(b.dataset.star) - (half ? 0.5 : 0);
			save(v === a.rating ? 0 : v);
		}));
		root.querySelector("[data-score10]")?.addEventListener("change", e => save(ctx.C.fromScore10(e.target.value)));
		root.querySelectorAll("[data-season]").forEach(el => el.addEventListener("click", e => {
			e.preventDefault(); e.stopPropagation();
			window.__avSeason = { season: el.dataset.season, year: Number(el.dataset.year) || null };
			ctx.V.open("Dashboard/Temporadas", ctx);
		}));
	}

	// ---- personagens e dubladores (AniList, carregados ao abrir a aba)
	_characters(ctx, a) {
		const { U } = ctx;
		if (!a.anilistId) return U.empty({ icon: "users", title: "Personagens indisponíveis", text: "Ligue este anime ao AniList (anilistId) para ver personagens e dubladores.", compact: true });
		return `<div data-chars><p class="av-add-hint is-busy">${U.icon("refresh")}Carregando personagens…</p></div>`;
	}

	// ---- diário de episódios
	_diary(ctx, a) {
		const { C, U } = ctx;
		const log = [...a.log].map((l, i) => ({ ...l, i })).sort((x, y) => y.date.localeCompare(x.date) || y.i - x.i);
		const head = `<div class="av-diary-head"><p class="av-muted">${a.log.length ? `${U.plural(a.log.reduce((s, l) => s + C.logCount(l), 0), "episódio registrado", "episódios registrados")} em ${U.plural(new Set(a.log.map(l => l.date)).size, "dia", "dias")}` : "Cada episódio marcado entra aqui com a data. Você também pode registrar à mão, com uma nota."}</p>${U.btn("Registrar episódios", { icon: "plus", kind: "primary", size: "sm", action: "ep-log", attrs: `data-path="${U.attr(a.path)}"` })}</div>`;
		if (!log.length) return head + U.empty({ icon: "notebook", title: "Diário vazio", text: "Marque um episódio como assistido para começar.", compact: true });
		const byDay = new Map();
		for (const l of log) { if (!byDay.has(l.date)) byDay.set(l.date, []); byDay.get(l.date).push(l); }
		return `${head}
			${ctx.I?.heatmap ? ctx.I.heatmap(ctx, new Map(a.log.map(l => [l.date, { episodes: C.logCount(l) }]).reduce((m, [d, v]) => m.set(d, { episodes: (m.get(d)?.episodes || 0) + v.episodes }), new Map())), { weeks: 26, label: "Últimos 6 meses" }) : ""}
			<ol class="av-diary">${[...byDay].map(([d, items]) => `<li class="av-diary-day"><time>${U.esc(U.fmtDate(d))}<small>${U.esc(U.relDate(d))}</small></time><ul>${items.map(l => {
				const n = C.logCount(l);
				const range = l.from !== null && l.to !== null ? (l.from === l.to ? `E${l.from}` : `E${l.from}–E${l.to}`) : "Episódio";
				return `<li class="av-diary-item"><span class="av-diary-ep">${U.esc(C.isMovie(a) ? "Filme" : range)}</span><span class="av-diary-body"><b>${U.plural(n, "episódio", "episódios")} · ${U.esc(U.fmtMinutes(n * a.duration))}</b>${l.note ? `<span>“${U.esc(l.note)}”</span>` : ""}</span></li>`;
			}).join("")}</ul></li>`).join("")}</ol>`;
	}

	// ---- relacionados: obras ligadas (com o tipo, como no MAL), franquia,
	// recomendações do AniList e parecidos da sua biblioteca
	_related(ctx, a) {
		const { C, U, model } = ctx;
		const fr = a.franchise ? model.anime.filter(x => x !== a && C.normalizeKey(x.franchise) === C.normalizeKey(a.franchise)).sort((x, y) => (x.franchiseOrder ?? 999) - (y.franchiseOrder ?? 999) || (x.year || 0) - (y.year || 0)) : [];
		const gs = new Set(a.genres.map(g => C.normalizeKey(g)));
		const sim = model.anime.filter(x => x !== a && !fr.includes(x)).map(x => ({ x, s: x.genres.filter(g => gs.has(C.normalizeKey(g))).length + (x.studios.some(s => a.studios.includes(s)) ? 0.5 : 0) }))
			.filter(o => o.s >= 1).sort((p, q) => q.s - p.s || q.x.rating - p.x.rating).slice(0, 18).map(o => o.x);
		const html = `${a.anilistId ? `<div data-al-related></div>` : ""}
			${fr.length ? `<section class="av-block">${U.sectionHead(`Mais de ${a.franchise}`, { count: fr.length })}${U.grid(fr.map(x => U.animeCard(x, C)))}</section>` : ""}
			${a.anilistId ? `<div data-al-recs></div>` : ""}
			${sim.length ? `<section class="av-block">${U.sectionHead("Mais como este na sua biblioteca", { sub: "Pelos gêneros e estúdios em comum" })}${U.grid(sim.map(x => U.animeCard(x, C)))}</section>` : ""}`;
		return { count: fr.length + sim.length, html, remote: !!a.anilistId };
	}

	// ========================================================== HISTÓRICO
	history(ctx) {
		const { C, U, model } = ctx;
		const ev = C.activity(model, { limit: 400 });
		const days = C.dailyEpisodes(model);
		const month = C.today().slice(0, 7);
		const inMonth = [...days].filter(([d]) => d.startsWith(month));
		const s = model.stats;
		const byDay = new Map();
		for (const e of ev) { if (!byDay.has(e.date)) byDay.set(e.date, []); byDay.get(e.date).push(e); }
		const line = e => {
			const a = e.anime;
			switch (e.type) {
				case "episodes": return { icon: "play", tone: "orange", text: C.isMovie(a) ? "Assistiu o filme" : e.count === 1 ? `Assistiu o E${e.to ?? ""}` : `Assistiu ${e.count} episódios <small>(E${e.from}–E${e.to})</small>`, sub: e.note };
				case "completed": return { icon: "check", tone: "green", text: "Concluiu" };
				case "started": return { icon: "flag", tone: "blue", text: "Começou a assistir" };
				default: return { icon: "plus", tone: "muted", text: "Adicionou à biblioteca" };
			}
		};
		const html = `<div class="av-page av-pad">
			${U.pageHead("Histórico", { sub: "Tudo o que você assistiu, dia a dia" })}
			${U.figures([
				{ label: "Episódios", value: U.fmtNum(s.episodes) },
				{ label: "Tempo total", value: U.fmtHours(s.hours), sub: s.days >= 1 ? `${U.fmtNum(s.days, 1)} dias` : "" },
				{ label: "Este mês", value: U.fmtNum(inMonth.reduce((t, [, v]) => t + v.episodes, 0)), sub: "episódios" },
				{ label: "Sequência", value: U.fmtNum(C.streak(model)), sub: "dias seguidos" }
			])}
			${ctx.I?.heatmap ? `<section class="av-block">${ctx.I.heatmap(ctx, days, { weeks: 53, label: "Últimos 12 meses" })}</section>` : ""}
			${ev.length ? `<ol class="av-history">${[...byDay].map(([d, list], di) => `<li class="av-history-day"${di >= 20 ? " hidden data-more" : ""}><h3>${U.esc(U.relDate(d) === U.fmtDate(d) ? U.fmtDate(d) : `${U.relDate(d)[0].toUpperCase()}${U.relDate(d).slice(1)} · ${U.fmtDate(d, { year: false })}`)}</h3>
				<ul>${list.map(e => { const l = line(e); return `<li class="av-hitem"><a class="av-hitem-art" ${U.openAttrs(e.anime.path)}>${U.cover(e.anime, { banner: true })}<span class="av-hitem-icon av-tone-${l.tone}">${U.icon(l.icon)}</span></a><div class="av-hitem-body"><a class="av-hitem-title" ${U.openAttrs(e.anime.path)}>${U.esc(e.anime.title)}</a><span>${l.text}</span>${l.sub ? `<small>“${U.esc(l.sub)}”</small>` : ""}</div>${e.type === "episodes" ? `<span class="av-hitem-time">${U.esc(U.fmtMinutes(e.count * e.anime.duration))}</span>` : ""}</li>`; }).join("")}</ul></li>`).join("")}</ol>${byDay.size > 20 ? `<button type="button" class="av-btn av-btn--outline av-history-more" data-history-more>${U.icon("chevronDown")}<span>Mostrar dias anteriores</span></button>` : ""}`
				: U.empty({ icon: "history", title: "Nada por aqui ainda", text: "Marque episódios como assistidos e eles aparecem aqui, com a data." })}
		</div>`;
		return { active: "history", html, wire: root => {
			root.querySelector("[data-history-more]")?.addEventListener("click", e => {
				const hidden = [...root.querySelectorAll(".av-history-day[data-more][hidden]")];
				hidden.slice(0, 20).forEach(li => { li.hidden = false; });
				if (hidden.length <= 20) e.currentTarget.remove();
			});
		} };
	}
}
