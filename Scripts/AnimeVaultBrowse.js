// ==========================================================================
// Anime Vault — Browse
// Listas (como as Crunchylists), Gêneros, Estúdios, Franquias e Temporadas.
// Cada categoria tem identidade própria (cor e ícone) editável na página.
//
// Acesso: customJS.AnimeVaultBrowse
// ==========================================================================

class AnimeVaultBrowse {

	// --------------------------------------------------------- identidade
	genreDefaults(name) {
		const k = customJS.AnimeVaultCore.normalizeKey(name);
		const t = [
			[/^(acao|action)/, "#f47521", "flame"], [/^(aventura|adventure)/, "#2bb673", "compass"], [/^(comedia|comedy)/, "#f7c325", "smile"],
			[/^drama/, "#a970ff", "masks"], [/^(fantasia|fantasy)/, "#7b6cff", "wand"], [/^(terror|horror)/, "#e5484d", "skull"],
			[/^(misterio|mystery)/, "#4f9dff", "eye"], [/^(psicologico|psychological)/, "#c06cff", "brain"], [/^romance/, "#ff5c9a", "heart"],
			[/^(ficcao cientifica|sci fi|scifi|ficcao)/, "#22b8e6", "rocket"], [/^slice of life/, "#6fcf97", "coffee"], [/^(esportes|sports|esporte)/, "#ff8a3d", "ball"],
			[/^(sobrenatural|supernatural)/, "#9b8cff", "ghost"], [/^(suspense|thriller)/, "#ff5a5a", "bolt"], [/^mecha/, "#8fa3b8", "robot"],
			[/^(musica|music)/, "#ff7ad9", "music"], [/^mahou shoujo/, "#ff9ad5", "sparkles"], [/^ecchi/, "#ff6f91", "flame"],
			[/^(shounen|shonen)/, "#f47521", "swords"], [/^seinen/, "#5f7fa8", "moon"], [/^isekai/, "#33c3a0", "castle"], [/^(escolar|school)/, "#4fb3ff", "school"]
		];
		for (const [re, color, icon] of t) if (re.test(k)) return { color, icon };
		return null;
	}

	ident(ctx, kind, name, page = undefined) {
		const { C, model } = ctx;
		const list = kind === "genre" ? model.genres : kind === "studio" ? model.studios : model.franchises;
		const p = page !== undefined ? page : list.find(x => C.normalizeKey(x.title) === C.normalizeKey(name)) || null;
		const def = kind === "genre" ? this.genreDefaults(name) : null;
		const hue = C.hashHue(name);
		return {
			color: p?.accent || def?.color || `hsl(${hue} 70% 58%)`,
			icon: p?.icon || def?.icon || (kind === "studio" ? "building" : kind === "franchise" ? "film" : "masks"),
			page: p
		};
	}

	iconChoices() {
		return ["flame", "compass", "smile", "masks", "wand", "skull", "eye", "brain", "heart", "rocket", "coffee", "ball", "ghost", "bolt", "robot", "music", "sparkles", "swords", "moon", "castle", "school", "crown", "gem", "medal", "star", "trophy", "film", "tv", "building", "layers", "bookmark", "flower", "leaf", "sun", "snowflake", "puzzle", "globe", "target"];
	}

	// --------------------------------------------------------- utilidades
	mosaic(ctx, list, n = 4) {
		const { U } = ctx;
		const items = list.filter(a => a.images.cover).slice(0, n);
		if (!items.length) return `<div class="av-mosaic is-empty"></div>`;
		return `<div class="av-mosaic av-mosaic--${items.length}">${items.map(a => `<img src="${U.attr(a.images.cover)}" alt="" loading="lazy" data-av-img>`).join("")}</div>`;
	}

	// topo das páginas de categoria: arte do anime mais bem avaliado,
	// tingida pela cor da categoria
	entityHero(ctx, { kicker, title, description = "", list, color = "", icon = "", cover = "", actions = "", stats = [] }) {
		const { U } = ctx;
		const top = [...list].sort((x, y) => (y.images.banner ? 1 : 0) - (x.images.banner ? 1 : 0) || y.rating - x.rating)[0];
		const art = cover || top?.images.banner || top?.images.cover || "";
		return `<section class="av-ehero" style="--av-id:${U.attr(color || "var(--av-orange)")}">
			${art ? `<img class="av-ehero-art" src="${U.attr(art)}" alt="" data-av-img>` : ""}
			<div class="av-ehero-shade"></div>
			<div class="av-ehero-inner">
				<span class="av-ehero-kicker">${icon ? U.icon(icon) : ""}${U.esc(kicker)}</span>
				<h1>${U.esc(title)}</h1>
				${description ? `<p>${U.esc(description)}</p>` : ""}
				${stats.length ? `<ul class="av-ehero-stats">${stats.filter(Boolean).map(s => `<li><b>${U.esc(s[0])}</b><span>${U.esc(s[1])}</span></li>`).join("")}</ul>` : ""}
				${actions ? `<div class="av-ehero-actions">${actions}</div>` : ""}
			</div>
		</section>`;
	}

	statsFor(ctx, list) {
		const { C, U } = ctx;
		const s = C.groupStats(list);
		return [
			[U.fmtNum(s.count), s.count === 1 ? "anime" : "animes"],
			s.episodes ? [U.fmtNum(s.episodes), "episódios vistos"] : null,
			s.hours ? [U.fmtHours(s.hours), "assistidas"] : null,
			s.avgRating ? [U.fmtNum(s.avgRating, 1), "nota média"] : null
		];
	}

	sortedGrid(ctx, list, { id = "cat" } = {}) {
		const { C, U } = ctx;
		const sorts = { rating: "Nota", recent: "Atividade", title: "A–Z", year: "Lançamento" };
		const saved = U._store(`sort:${id}`) || "rating";
		const cmp = {
			rating: (x, y) => y.rating - x.rating || x.title.localeCompare(y.title),
			recent: (x, y) => C.maxIso(y.lastWatched, y.dateAdded).localeCompare(C.maxIso(x.lastWatched, x.dateAdded)),
			title: (x, y) => x.title.localeCompare(y.title),
			year: (x, y) => (y.year || 0) - (x.year || 0) || x.title.localeCompare(y.title)
		};
		const sorted = [...list].sort(cmp[saved] || cmp.rating);
		return `<section class="av-block" data-sortgrid="${U.attr(id)}">
			${U.sectionHead("Todos", { count: list.length, action: `<div class="av-segmented" role="radiogroup">${Object.entries(sorts).map(([k, v]) => `<button type="button" data-sort="${k}" class="${k === saved ? "is-active" : ""}">${U.esc(v)}</button>`).join("")}</div>` })}
			${U.grid(sorted.map(a => U.animeCard(a, C).replace('<article class="av-card', `<article data-k-rating="${a.rating}" data-k-recent="${U.attr(C.maxIso(a.lastWatched, a.dateAdded))}" data-k-title="${U.attr(a.title.toLowerCase())}" data-k-year="${a.year || 0}" class="av-card`)))}
		</section>`;
	}

	wireSortedGrid(root, ctx) {
		root.querySelectorAll("[data-sortgrid]").forEach(sec => {
			const grid = sec.querySelector(".av-grid");
			sec.querySelectorAll("[data-sort]").forEach(b => b.addEventListener("click", () => {
				const k = b.dataset.sort;
				ctx.U._store(`sort:${sec.dataset.sortgrid}`, k);
				sec.querySelectorAll("[data-sort]").forEach(x => x.classList.toggle("is-active", x === b));
				const cards = [...grid.children];
				const v = c => c.dataset[`k${k[0].toUpperCase()}${k.slice(1)}`] || "";
				cards.sort((x, y) => k === "title" ? v(x).localeCompare(v(y)) : k === "recent" ? v(y).localeCompare(v(x)) : Number(v(y)) - Number(v(x)));
				cards.forEach(c => grid.appendChild(c));
			}));
		});
	}

	identityBtn(ctx, kind, name, page) {
		return ctx.U.btn("Editar identidade", { icon: "edit", kind: "ghost", size: "sm", action: "identity-edit", attrs: `data-kind="${kind}" data-name="${ctx.U.attr(name)}" data-path="${ctx.U.attr(page?.path || "")}"` });
	}

	// =============================================================== LISTAS
	listCard(ctx, l) {
		const { U } = ctx;
		const mins = l.items.reduce((s, a) => s + (a.episodes || 1) * a.duration, 0);
		return `<a class="av-listcard" ${U.openAttrs(l.path)} style="--av-id:${U.attr(l.accent || "var(--av-orange)")}">
			<div class="av-listcard-art">${l.cover ? `<img src="${U.attr(l.cover)}" alt="" loading="lazy" data-av-img>` : this.mosaic(ctx, l.items, 4)}<span class="av-listcard-count">${U.icon("layers")}${l.items.length}</span>${l.pinned ? `<span class="av-listcard-pin">${U.icon("pin")}</span>` : ""}</div>
			<span class="av-listcard-title">${U.icon(l.icon || "layers")}${U.esc(l.title)}</span>
			<span class="av-listcard-meta">${U.esc(l.description || `${U.plural(l.items.length, "anime", "animes")} · ${U.fmtMinutes(mins)}`)}</span>
		</a>`;
	}

	lists(ctx) {
		const { U, C, model } = ctx;
		const lists = [...model.lists].sort((x, y) => (y.pinned - x.pinned) || y.updated.localeCompare(x.updated) || x.title.localeCompare(y.title));
		const auto = this.autoLists(ctx).filter(x => x.items.length);
		const html = `<div class="av-page av-pad">
			${U.pageHead("Listas", { sub: "Suas listas personalizadas e as automáticas do Vault", actions: U.btn("Nova lista", { icon: "plus", kind: "primary", action: "list-new" }) })}
			${lists.length ? `<div class="av-listgrid">${lists.map(l => this.listCard(ctx, l)).join("")}</div>`
				: U.empty({ icon: "layers", title: "Nenhuma lista ainda", text: "Crie listas como “Para ver com amigos”, “Clássicos” ou “Maratona do fim de semana”.", action: U.btn("Criar lista", { icon: "plus", kind: "primary", action: "list-new" }) })}
			${auto.length ? `<section class="av-block">${U.sectionHead("Listas automáticas", { sub: "Montadas a partir dos seus dados" })}${auto.map(x => U.shelf(x.title, x.items.map(a => U.animeCard(a, C)), { count: x.items.length, sub: x.sub })).join("")}</section>` : ""}
		</div>`;
		return { active: "lists", html };
	}

	autoLists(ctx) {
		const { C, model } = ctx;
		const today = C.today();
		return [
			{ title: "Quase terminando", sub: "Faltam 3 episódios ou menos", items: model.anime.filter(a => a.progress.left !== null && a.progress.left > 0 && a.progress.left <= 3 && a.watched > 0) },
			{ title: "Parados há mais de 2 meses", sub: "Em andamento, sem episódio novo assistido", items: model.anime.filter(a => ["Watching", "Paused"].includes(a.status) && (!a.lastWatched || C.daysBetween(a.lastWatched, today) > 60)) },
			{ title: "Filmes para uma noite", sub: "Na sua lista", items: model.anime.filter(a => C.isMovie(a) && a.status === "Planning") },
			{ title: "Curtinhos (até 13 episódios)", sub: "Dá para maratonar no fim de semana", items: model.anime.filter(a => a.status === "Planning" && a.episodes && a.episodes <= 13 && !C.isMovie(a)) },
			{ title: "Nota máxima", sub: "5 estrelas", items: model.anime.filter(a => a.rating >= 5) }
		];
	}

	list(ctx) {
		const { U, C, model, current } = ctx;
		const l = model.lists.find(x => x.path === current.file.path);
		if (!l) return { active: "lists", html: `<div class="av-page av-pad">${U.empty({ icon: "alert", title: "Lista não encontrada", text: "Confira se o frontmatter tem type: list." })}</div>` };
		const mins = l.items.reduce((s, a) => s + (a.episodes || 1) * a.duration, 0);
		const seen = l.items.filter(a => a.status === "Completed").length;
		const html = `<div class="av-page av-page--list">
			${this.entityHero(ctx, {
				kicker: "Lista", title: l.title, description: l.description, list: l.items, color: l.accent, icon: l.icon || "layers", cover: l.cover,
				stats: [[U.fmtNum(l.items.length), l.items.length === 1 ? "anime" : "animes"], [U.fmtMinutes(mins), "no total"], [`${seen}/${l.items.length}`, "concluídos"]],
				actions: `${U.btn("Escolher animes", { icon: "plus", kind: "primary", attrs: "data-list-pick" })}${U.btn("Editar", { icon: "edit", kind: "ghost", action: "identity-edit", attrs: `data-kind="list" data-path="${U.attr(l.path)}" data-name="${U.attr(l.title)}"` })}${U.btn("", { icon: "trash", kind: "ghost", title: "Excluir lista", attrs: "data-list-del" })}`
			})}
			<div class="av-pad">
				${l.missing.length ? `<p class="av-fineprint">${U.icon("alert")}${U.plural(l.missing.length, "link aponta", "links apontam")} para anime inexistente: ${l.missing.map(x => U.esc(x)).join(", ")}.</p>` : ""}
				${l.items.length ? `<ol class="av-ordered" data-ordered>${l.items.map((a, i) => `<li class="av-ordered-item" data-anime="${U.attr(a.path)}">
					<span class="av-ordered-n">${i + 1}</span>
					<a class="av-ordered-art" ${U.openAttrs(a.path)}>${U.cover(a, { banner: true })}</a>
					<div class="av-ordered-body"><a class="av-ordered-title" ${U.openAttrs(a.path)}>${U.esc(a.title)}</a><span>${U.esc([a.formatLabel, a.year, a.episodes ? U.plural(a.episodes, "episódio", "episódios") : ""].filter(Boolean).join(" · "))}</span>${U.statusTag(a, C)}</div>
					<div class="av-ordered-acts">
						<button type="button" class="av-iconbtn" data-move="-1" aria-label="Subir"${i === 0 ? " disabled" : ""}>${U.icon("chevronUp")}</button>
						<button type="button" class="av-iconbtn" data-move="1" aria-label="Descer"${i === l.items.length - 1 ? " disabled" : ""}>${U.icon("chevronDown")}</button>
						<button type="button" class="av-iconbtn" data-remove aria-label="Tirar da lista">${U.icon("x")}</button>
					</div>
				</li>`).join("")}</ol>` : U.empty({ icon: "layers", title: "Lista vazia", text: "Escolha os animes que entram nesta lista.", action: U.btn("Escolher animes", { icon: "plus", kind: "primary", attrs: "data-list-pick" }) })}
			</div>
		</div>`;
		return {
			active: "list", html, wire: root => {
				root.querySelectorAll("[data-list-pick]").forEach(b => b.addEventListener("click", () => ctx.E.listItemsPicker(ctx, l.path)));
				root.querySelector("[data-list-del]")?.addEventListener("click", async () => {
					const ok = await ctx.V.confirm({ title: `Excluir a lista “${l.title}”?`, text: "Só a lista vai para a lixeira. Os animes continuam na biblioteca.", confirm: "Excluir", danger: true });
					if (!ok) return;
					const f = app.vault.getAbstractFileByPath(l.path);
					if (f) await app.vault.trash(f, false).catch(() => app.vault.delete(f));
					ctx.V.open("Dashboard/Listas", ctx);
				});
				const write = async order => {
					const f = app.vault.getAbstractFileByPath(l.path);
					if (!f) return;
					await app.fileManager.processFrontMatter(f, fm => { fm.anime = order.map(p => `[[${p.replace(/\.md$/, "")}]]`); fm.updated = C.today(); });
				};
				root.querySelector("[data-ordered]")?.addEventListener("click", async e => {
					const it = e.target.closest(".av-ordered-item");
					if (!it) return;
					const paths = l.items.map(a => a.path);
					const i = paths.indexOf(it.dataset.anime);
					const mv = e.target.closest("[data-move]");
					if (mv) { const j = i + Number(mv.dataset.move); if (j < 0 || j >= paths.length) return; [paths[i], paths[j]] = [paths[j], paths[i]]; await write(paths); return; }
					if (e.target.closest("[data-remove]")) { paths.splice(i, 1); await write(paths); ctx.V.toast("Tirado da lista", { tone: "ok" }); }
				});
			}
		};
	}

	// =============================================================== GÊNEROS
	// hub no estilo "Navegar": um bloco por gênero com as capas e a cor dele
	genres(ctx) {
		const { C, U, model } = ctx;
		const groups = C.groupBy(model.anime, a => a.genres);
		for (const p of model.genres) if (![...groups.keys()].some(k => C.normalizeKey(k) === C.normalizeKey(p.title))) groups.set(p.title, []);
		const rows = [...groups].map(([name, list]) => ({ name, list, s: C.groupStats(list), id: this.ident(ctx, "genre", name) })).sort((x, y) => y.list.length - x.list.length || x.name.localeCompare(y.name));
		const html = `<div class="av-page av-pad">
			${U.pageHead("Navegar por gênero", { sub: `${U.plural(rows.length, "gênero", "gêneros")} na sua biblioteca` })}
			${this.browseTabs(ctx, "genres")}
			${rows.length ? `<div class="av-tiles">${rows.map(r => this.tile(ctx, "genre", r.name, r.list, r.id, [`${U.plural(r.list.length, "anime", "animes")}`, r.s.avgRating ? `★ ${U.fmtNum(r.s.avgRating, 1)}` : ""].filter(Boolean).join(" · "), C.genreLabel(r.name))).join("")}</div>` : U.empty({ icon: "masks", title: "Nenhum gênero ainda", text: "Os gêneros vêm do AniList ao adicionar um anime, ou do campo genre da nota." })}
			${this._affinity(ctx, rows)}
		</div>`;
		return { active: "genres", html };
	}

	browseTabs(ctx, active) {
		const { U } = ctx;
		const t = [["genres", "Gêneros", "Dashboard/Gêneros"], ["studios", "Estúdios", "Dashboard/Estúdios"], ["franchises", "Franquias", "Dashboard/Franquias"], ["seasons", "Temporadas", "Dashboard/Temporadas"]];
		return `<nav class="av-tabs av-tabs--links" aria-label="Navegar">${t.map(([id, label, path]) => `<a class="av-tab${id === active ? " is-active" : ""}" ${U.openAttrs(path)}>${U.esc(label)}</a>`).join("")}</nav>`;
	}

	tile(ctx, kind, name, list, id, sub, label = name) {
		const { U } = ctx;
		const covers = list.filter(a => a.images.cover).sort((x, y) => y.rating - x.rating).slice(0, 3);
		return `<a class="av-tile" ${U.catAttrs(kind, name, id.page)} style="--av-id:${U.attr(id.color)}">
			<span class="av-tile-covers">${covers.map(a => `<img src="${U.attr(a.images.cover)}" alt="" loading="lazy" data-av-img>`).join("")}</span>
			<span class="av-tile-shade"></span>
			<span class="av-tile-icon">${U.icon(id.icon)}</span>
			<span class="av-tile-text"><b>${U.esc(label)}</b><small>${U.esc(sub)}</small></span>
		</a>`;
	}

	_affinity(ctx, rows) {
		const { U } = ctx;
		const rated = rows.filter(r => r.list.length >= 1 && (r.s.hours || r.s.avgRating)).map(r => ({ ...r, v: r.s.hours + (r.s.avgRating || 0) * 3 })).sort((x, y) => y.v - x.v).slice(0, 8);
		if (rated.length < 2) return "";
		return `<section class="av-block">${U.sectionHead("Sua afinidade", { sub: "Tempo assistido e notas por gênero" })}
			<div class="av-surface">${U.bars(rated.map(r => ({ label: ctx.C.genreLabel(r.name), value: r.s.hours, display: `${U.fmtHours(r.s.hours)}${r.s.avgRating ? ` · ★ ${U.fmtNum(r.s.avgRating, 1)}` : ""}`, color: r.id.color, attrs: U.catAttrs("genre", r.name, r.id.page) })))}</div>
		</section>`;
	}

	categoryPage(ctx, kind) {
		const { C, U, model, current } = ctx;
		const pages = kind === "genre" ? model.genres : kind === "studio" ? model.studios : model.franchises;
		const page = pages.find(p => p.path === current.file.path);
		const name = page?.title || current.file.name;
		const pick = kind === "genre" ? a => a.genres : kind === "studio" ? a => a.studios : a => [a.franchise];
		const list = model.anime.filter(a => pick(a).some(x => C.normalizeKey(x) === C.normalizeKey(name)));
		const id = this.ident(ctx, kind, name, page || null);
		const label = kind === "genre" ? C.genreLabel(name) : name;
		const kicker = { genre: "Gênero", studio: "Estúdio", franchise: "Franquia" }[kind];
		const watching = list.filter(a => ["Watching", "Rewatching"].includes(a.status));
		const planning = list.filter(a => a.status === "Planning");
		let body = "";
		if (kind === "franchise") body = this._saga(ctx, list);
		const html = `<div class="av-page">
			${this.entityHero(ctx, { kicker, title: label, description: page?.description || "", list, color: id.color, icon: id.icon, cover: page?.cover || "", stats: this.statsFor(ctx, list), actions: this.identityBtn(ctx, kind, name, page) })}
			<div class="av-pad">
				${body}
				${U.shelf("Assistindo agora", watching.map(a => U.wideCard(a, C)), { variant: "wide" })}
				${kind !== "franchise" ? U.shelf("Na sua lista", planning.map(a => U.animeCard(a, C)), { count: planning.length }) : ""}
				${list.length ? this.sortedGrid(ctx, list, { id: kind }) : U.empty({ icon: id.icon, title: `Nenhum anime com ${kind === "studio" ? "este estúdio" : kind === "franchise" ? "esta franquia" : "este gênero"}`, text: "Ele aparece aqui quando estiver no campo da nota do anime." })}
			</div>
		</div>`;
		return { active: kind, html, wire: root => this.wireSortedGrid(root, ctx) };
	}

	genre(ctx) { return this.categoryPage(ctx, "genre"); }
	studio(ctx) { return this.categoryPage(ctx, "studio"); }
	franchise(ctx) { return this.categoryPage(ctx, "franchise"); }

	// ordem para assistir (campo franchiseOrder; sem ele, o ano)
	_saga(ctx, list) {
		const { C, U } = ctx;
		const order = [...list].sort((x, y) => (x.franchiseOrder ?? 999) - (y.franchiseOrder ?? 999) || (x.year || 0) - (y.year || 0) || x.title.localeCompare(y.title));
		if (!order.length) return "";
		const done = order.filter(a => a.status === "Completed").length;
		const next = order.find(a => a.status !== "Completed" && a.status !== "Dropped");
		return `<section class="av-block">
			${U.sectionHead("Ordem para assistir", { sub: `${done} de ${order.length} concluídos${next ? ` · próximo: ${next.title}` : ""}` })}
			<ol class="av-saga">${order.map((a, i) => `<li class="av-saga-item${a.status === "Completed" ? " is-done" : ""}${a === next ? " is-next" : ""}">
				<span class="av-saga-n">${a.status === "Completed" ? U.icon("check") : i + 1}</span>
				<a class="av-saga-card" ${U.openAttrs(a.path)}>${U.cover(a)}<span><b>${U.esc(a.title)}</b><small>${U.esc([a.formatLabel, a.year].filter(Boolean).join(" · "))}</small>${a.progress.total ? U.progressBar(a.progress.pct, { thin: true, tone: a.progress.done ? "green" : "" }) : ""}</span></a>
			</li>`).join("")}</ol>
		</section>`;
	}

	// ============================================================== ESTÚDIOS
	studios(ctx) {
		const { C, U, model } = ctx;
		const groups = C.groupBy(model.anime, a => a.studios);
		for (const p of model.studios) if (![...groups.keys()].some(k => C.normalizeKey(k) === C.normalizeKey(p.title))) groups.set(p.title, []);
		const rows = [...groups].map(([name, list]) => ({ name, list, s: C.groupStats(list), id: this.ident(ctx, "studio", name) })).sort((x, y) => y.list.length - x.list.length || (y.s.avgRating || 0) - (x.s.avgRating || 0) || x.name.localeCompare(y.name));
		const html = `<div class="av-page av-pad">
			${U.pageHead("Estúdios", { sub: `${U.plural(rows.length, "estúdio", "estúdios")} por trás dos seus animes` })}
			${this.browseTabs(ctx, "studios")}
			${rows.length ? `<div class="av-studios">${rows.map(r => `<a class="av-studio" ${U.catAttrs("studio", r.name, r.id.page)} style="--av-id:${U.attr(r.id.color)}">
				<span class="av-studio-fan">${r.list.filter(a => a.images.cover).slice(0, 4).map(a => `<img src="${U.attr(a.images.cover)}" alt="" loading="lazy" data-av-img>`).join("") || `<span class="av-studio-ph">${U.icon(r.id.icon)}</span>`}</span>
				<span class="av-studio-text"><b>${U.esc(r.name)}</b><small>${U.esc([U.plural(r.list.length, "anime", "animes"), r.s.avgRating ? `★ ${U.fmtNum(r.s.avgRating, 1)}` : "", r.s.hours ? U.fmtHours(r.s.hours) : ""].filter(Boolean).join(" · "))}</small><span class="av-studio-titles">${r.list.slice(0, 3).map(a => U.esc(a.title)).join(", ")}</span></span>
			</a>`).join("")}</div>` : U.empty({ icon: "building", title: "Nenhum estúdio ainda", text: "Os estúdios vêm do AniList ou do campo studio da nota." })}
		</div>`;
		return { active: "studios", html };
	}

	// ============================================================ FRANQUIAS
	franchises(ctx) {
		const { C, U, model } = ctx;
		const groups = C.groupBy(model.anime, a => a.franchise ? [a.franchise] : []);
		for (const p of model.franchises) if (![...groups.keys()].some(k => C.normalizeKey(k) === C.normalizeKey(p.title))) groups.set(p.title, []);
		const rows = [...groups].map(([name, list]) => ({ name, list, s: C.groupStats(list), id: this.ident(ctx, "franchise", name) })).sort((x, y) => y.list.length - x.list.length || x.name.localeCompare(y.name));
		const html = `<div class="av-page av-pad">
			${U.pageHead("Franquias", { sub: "Temporadas, filmes e derivados de uma mesma história, na ordem certa" })}
			${this.browseTabs(ctx, "franchises")}
			${rows.length ? `<div class="av-tiles av-tiles--wide">${rows.map(r => this.tile(ctx, "franchise", r.name, r.list, r.id, `${r.s.completed}/${r.list.length} concluídos${r.s.hours ? ` · ${U.fmtHours(r.s.hours)}` : ""}`)).join("")}</div>`
				: U.empty({ icon: "film", title: "Nenhuma franquia ainda", text: "Preencha o campo franchise (e franchiseOrder para a ordem) nas notas que fazem parte da mesma história." })}
		</div>`;
		return { active: "franchises", html };
	}

	// ============================================================ TEMPORADAS
	// como a página Simulcast: escolha a temporada e veja o que tem nela
	seasons(ctx) {
		const { C, U, model } = ctx;
		const now = C.seasonOf();
		const asked = window.__avSeason;
		window.__avSeason = null;
		let saved = null;
		try { saved = JSON.parse(U._store("season") || "null"); } catch (_) { saved = null; }
		const cur = asked?.season ? { season: asked.season, year: asked.year || now.year } : saved?.season ? saved : now;
		const have = C.groupBy(model.anime.filter(a => a.season && a.seasonYear), a => C.seasonKey(a.season, a.seasonYear));
		const keys = new Set([...have.keys(), C.seasonKey(now.season, now.year), C.seasonKey(cur.season, cur.year)]);
		const options = [...keys].sort().reverse().map(k => { const [y, o] = k.split("-").map(Number); const s = Object.keys(C.seasonDefs).find(x => C.seasonDefs[x].order === o); return { season: s, year: y, n: have.get(k)?.length || 0 }; });
		const list = have.get(C.seasonKey(cur.season, cur.year)) || [];
		const prev = C.shiftSeason(cur.season, cur.year, -1), next = C.shiftSeason(cur.season, cur.year, 1);
		const isNow = cur.season === now.season && cur.year === now.year;
		const html = `<div class="av-page av-pad av-seasonpage">
			${U.pageHead(C.seasonLabel(cur.season, cur.year), { kicker: isNow ? "Temporada atual" : "Temporada", sub: `${U.plural(list.length, "anime", "animes")} desta temporada na sua biblioteca` })}
			${this.browseTabs(ctx, "seasons")}
			<div class="av-seasonbar">
				<button type="button" class="av-iconbtn" data-season-go="${prev.season}:${prev.year}" aria-label="Temporada anterior">${U.icon("chevronLeft")}</button>
				<label class="av-select-wrap">${U.icon(C.seasonDefs[cur.season].icon)}<select class="av-select" data-season-pick aria-label="Escolher temporada">${options.map(o => `<option value="${o.season}:${o.year}"${o.season === cur.season && o.year === cur.year ? " selected" : ""}>${U.esc(C.seasonLabel(o.season, o.year))}${o.n ? ` (${o.n})` : ""}</option>`).join("")}</select></label>
				<button type="button" class="av-iconbtn" data-season-go="${next.season}:${next.year}" aria-label="Próxima temporada">${U.icon("chevronRight")}</button>
				${isNow ? "" : `<button type="button" class="av-ovlink" data-season-go="${now.season}:${now.year}">${U.icon("calendar")}<span>Ir para a atual</span></button>`}
			</div>
			${list.length ? U.grid([...list].sort((x, y) => (["Watching", "Rewatching"].includes(y.status) - ["Watching", "Rewatching"].includes(x.status)) || y.rating - x.rating || x.title.localeCompare(y.title)).map(a => U.animeCard(a, C))) : U.empty({ icon: C.seasonDefs[cur.season].icon, title: "Nenhum anime desta temporada no vault", text: ctx.AL ? "Use as setas para ver outras temporadas. Com internet, o que está em alta no AniList aparece logo abaixo para adicionar com um toque." : "Adicione animes com season e seasonYear para vê-los aqui.", compact: true })}
			<div data-season-remote></div>
			${options.filter(o => o.n).length > 1 ? `<section class="av-block">${U.sectionHead("Por temporada", { sub: "Quantos animes de cada temporada estão na sua biblioteca" })}<div class="av-fchips av-fchips--wrap">${options.filter(o => o.n).map(o => `<button type="button" class="av-fchip${o.season === cur.season && o.year === cur.year ? " is-active" : ""}" data-season-go="${o.season}:${o.year}">${U.icon(C.seasonDefs[o.season].icon)}${U.esc(C.seasonLabel(o.season, o.year))}<span>${o.n}</span></button>`).join("")}</div></section>` : ""}
		</div>`;
		return {
			active: "seasons", html, wire: root => {
				const go = v => { const [s, y] = v.split(":"); U._store("season", JSON.stringify({ season: s, year: Number(y) })); ctx.V._rerender("seasons"); };
				root.querySelectorAll("[data-season-go]").forEach(b => b.addEventListener("click", () => go(b.dataset.seasonGo)));
				root.querySelector("[data-season-pick]")?.addEventListener("change", e => go(e.target.value));
				const slot = root.querySelector("[data-season-remote]");
				if (slot && ctx.AL?.seasonShelf) ctx.AL.seasonShelf(ctx, slot, cur.season, cur.year).catch(() => {});
			}
		};
	}
}
