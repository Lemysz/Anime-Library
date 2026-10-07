// ==========================================================================
// Anime Vault — Insights
// Calendário de lançamentos, Estatísticas, Tier List e Configurações.
//
// Acesso: customJS.AnimeVaultInsights
// ==========================================================================

class AnimeVaultInsights {

	// ============================================================ CALENDÁRIO
	// semana a partir de hoje: o que sai em cada dia, como o calendário de
	// lançamentos da Crunchyroll. Fonte: nextAiring (AniList) ou airingDay.
	calendar(ctx) {
		const { C, U, model } = ctx;
		const items = C.schedule(model, { days: 7 });
		const today = C.today();
		const days = [];
		for (let i = 0; i < 7; i++) {
			const d = C.addDays(today, i);
			days.push({ d, items: items.filter(x => C.isoOf(x.at) === d) });
		}
		const releasing = model.anime.filter(a => a.airing === "RELEASING" && !["Dropped"].includes(a.status));
		const unknown = releasing.filter(a => !items.some(x => x.anime === a));
		const soon = model.anime.filter(a => a.airing === "NOT_YET_RELEASED");
		const wd = C.weekdays;
		const saved = Number(U._store("calDay") || 0);
		const active = Math.min(6, Math.max(0, Number.isFinite(saved) && window.__avCalKeep ? saved : 0));
		const time = at => `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
		const entry = x => {
			const a = x.anime;
			const aired = x.at.getTime() <= Date.now();
			return `<a class="av-calitem${aired ? " is-aired" : ""}${["Watching", "Rewatching"].includes(a.status) ? " is-mine" : ""}" ${U.openAttrs(a.path)}>
				<span class="av-calitem-time">${x.source === "manual" && !a.airingTime ? "—" : time(x.at)}</span>
				<span class="av-calitem-art">${U.cover(a, { banner: true })}</span>
				<span class="av-calitem-body"><b>${U.esc(a.title)}</b><small>${x.episode ? `Episódio ${x.episode}` : "Novo episódio"}${a.progress.total ? ` de ${a.progress.total}` : ""}${aired ? " · já saiu" : ""}</small><span class="av-calitem-tags">${U.statusTag(a, C)}${a.audioLabel ? `<span class="av-tag">${U.esc(a.audioLabel)}</span>` : ""}</span></span>
			</a>`;
		};
		const html = `<div class="av-page av-pad av-calpage">
			${U.pageHead("Calendário de lançamentos", { sub: "Os próximos episódios dos animes em lançamento na sua biblioteca", actions: ctx.AL ? U.btn("Atualizar horários", { icon: "refresh", kind: "ghost", action: "anilist-refresh-all", attrs: 'data-scope="airing"' }) : "" })}
			<div class="av-caldays" role="tablist">${days.map((x, i) => { const dt = new Date(x.d + "T00:00:00"); return `<button type="button" role="tab" class="av-calday${i === active ? " is-active" : ""}${i === 0 ? " is-today" : ""}" data-calday="${i}" aria-selected="${i === active}"><span>${i === 0 ? "Hoje" : i === 1 ? "Amanhã" : wd[dt.getDay()]}</span><b>${dt.getDate()}</b>${x.items.length ? `<i>${x.items.length}</i>` : ""}</button>`; }).join("")}</div>
			<div class="av-calweek">${days.map((x, i) => { const dt = new Date(x.d + "T00:00:00"); return `<section class="av-calcol${i === active ? " is-active" : ""}" data-calcol="${i}"><h3><span>${i === 0 ? "Hoje" : wd[dt.getDay()]}</span><small>${U.esc(U.fmtDate(x.d, { year: false }))}</small></h3>${x.items.length ? x.items.map(entry).join("") : `<p class="av-calempty">Nada neste dia</p>`}</section>`; }).join("")}</div>
			${!items.length ? U.empty({ icon: "calendar", title: "Nenhum episódio previsto nesta semana", text: releasing.length ? "Atualize os horários pelo AniList ou informe o dia (airingDay) na nota." : "Quando um anime em lançamento estiver na biblioteca, os próximos episódios aparecem aqui. Sem AniList, preencha airingDay (ex.: Sábado) e airingTime na nota.", compact: true }) : ""}
			${unknown.length ? `<section class="av-block">${U.sectionHead("Em lançamento, sem horário", { sub: "Atualize pelo AniList para saber quando sai o próximo" })}${U.grid(unknown.map(a => U.animeCard(a, C)))}</section>` : ""}
			${soon.length ? U.shelf("Em breve", soon.map(a => U.animeCard(a, C)), { sub: "Ainda não estrearam" }) : ""}
		</div>`;
		return {
			active: "calendar", html, wire: root => {
				root.querySelectorAll("[data-calday]").forEach(b => b.addEventListener("click", () => {
					const i = b.dataset.calday;
					U._store("calDay", i); window.__avCalKeep = true;
					root.querySelectorAll("[data-calday]").forEach(x => { const on = x === b; x.classList.toggle("is-active", on); x.setAttribute("aria-selected", String(on)); });
					root.querySelectorAll("[data-calcol]").forEach(c => c.classList.toggle("is-active", c.dataset.calcol === i));
					ctx.V._haptic(6);
				}));
			}
		};
	}

	// mapa de calor (dias × episódios)
	heatmap(ctx, days, { weeks = 53, label = "" } = {}) {
		const { C, U } = ctx;
		const today = C.today();
		const end = new Date(today + "T00:00:00");
		const start = new Date(end); start.setDate(start.getDate() - (weeks * 7 - 1) - (6 - end.getDay()));
		let max = 1;
		for (const v of days.values()) max = Math.max(max, v.episodes || 0);
		const cells = [];
		let total = 0, active = 0;
		for (let i = 0; i < weeks * 7; i++) {
			const dt = new Date(start); dt.setDate(start.getDate() + i);
			const iso = C.isoOf(dt);
			const n = days.get(iso)?.episodes || 0;
			if (iso <= today) { total += n; if (n) active++; }
			const lvl = !n ? 0 : n / max > 0.75 ? 4 : n / max > 0.5 ? 3 : n / max > 0.25 ? 2 : 1;
			cells.push(`<i class="l${lvl}${iso > today ? " is-future" : ""}" title="${U.attr(U.fmtDate(iso))}${n ? ` · ${U.plural(n, "episódio", "episódios")}` : ""}"></i>`);
		}
		return `<div class="av-heat">
			<div class="av-heat-head"><span>${U.esc(label)}</span><small>${U.plural(total, "episódio", "episódios")} em ${U.plural(active, "dia", "dias")}</small></div>
			<div class="av-heat-wrap av-hscroll"><div class="av-heat-grid" style="--weeks:${weeks}">${cells.join("")}</div></div>
			<div class="av-heat-legend"><span>Menos</span><i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i><span>Mais</span></div>
		</div>`;
	}

	// ========================================================== ESTATÍSTICAS
	_periods() { return { all: "Tudo", year: "Este ano", d90: "90 dias", d30: "30 dias" }; }

	_range(C, period) {
		const today = C.today();
		if (period === "year") return [`${today.slice(0, 4)}-01-01`, today];
		if (period === "d90") return [C.addDays(today, -89), today];
		if (period === "d30") return [C.addDays(today, -29), today];
		return ["", today];
	}

	statistics(ctx) {
		const { C, U, model } = ctx;
		const period = this._periods()[U._store("statPeriod")] ? U._store("statPeriod") : "all";
		const [from, to] = this._range(C, period);
		const inR = d => d && (!from || d >= from) && d <= to;
		const all = period === "all";
		// episódios e minutos: no "Tudo", o total de cada anime; nos períodos, o diário
		const perAnime = new Map();
		for (const a of model.anime) {
			if (all) { perAnime.set(a, { eps: C.libraryStats({ anime: [a] }).episodes, min: a.minutes }); continue; }
			let eps = 0;
			for (const l of a.log) if (inR(l.date)) eps += C.logCount(l);
			if (eps) perAnime.set(a, { eps, min: eps * a.duration });
		}
		const watchedList = [...perAnime].filter(([, v]) => v.eps > 0);
		const eps = watchedList.reduce((s, [, v]) => s + v.eps, 0);
		const min = watchedList.reduce((s, [, v]) => s + v.min, 0);
		const completed = model.anime.filter(a => a.status === "Completed" && (all || inR(a.completionDate)));
		const started = model.anime.filter(a => all ? a.startDate : inR(a.startDate));
		const rated = model.anime.filter(a => a.rating && (all || perAnime.has(a)));
		const avg = rated.length ? rated.reduce((s, a) => s + a.rating, 0) / rated.length : null;
		const days = C.dailyEpisodes(model);
		const best = [...days].filter(([d]) => all || inR(d)).sort((x, y) => y[1].episodes - x[1].episodes)[0];
		const tabs = Object.entries(this._periods()).map(([k, v]) => `<button type="button" data-period="${k}" class="${k === period ? "is-active" : ""}">${U.esc(v)}</button>`).join("");

		// por mês (12 meses)
		const months = [];
		const t = new Date(C.today() + "T00:00:00");
		for (let i = 11; i >= 0; i--) { const d = new Date(t.getFullYear(), t.getMonth() - i, 1); months.push(C.isoOf(d).slice(0, 7)); }
		const byMonth = new Map(months.map(m => [m, 0]));
		for (const [d, v] of days) { const m = d.slice(0, 7); if (byMonth.has(m)) byMonth.set(m, byMonth.get(m) + v.episodes); }
		const mMax = Math.max(1, ...byMonth.values());
		const monthChart = `<div class="av-cols" role="img" aria-label="Episódios por mês">${months.map(m => { const v = byMonth.get(m); return `<div class="av-col" title="${U.attr(U.months[Number(m.slice(5)) - 1])} ${m.slice(0, 4)}: ${U.plural(v, "episódio", "episódios")}"><span class="av-col-v">${v || ""}</span><span class="av-col-bar"><i style="height:${v ? Math.max(4, (v / mMax) * 100) : 0}%"></i></span><small>${U.months[Number(m.slice(5)) - 1]}</small></div>`; }).join("")}</div>`;

		// gêneros por tempo
		const g = new Map();
		for (const [a, v] of watchedList) for (const x of a.genres) g.set(x, (g.get(x) || 0) + v.min);
		const genres = [...g].sort((x, y) => y[1] - x[1]).slice(0, 8);
		// estúdios
		const st = new Map();
		for (const [a, v] of watchedList) for (const x of a.studios) st.set(x, (st.get(x) || 0) + v.eps);
		const studios = [...st].sort((x, y) => y[1] - x[1]).slice(0, 6);
		// status (biblioteca inteira)
		const statusSegs = Object.keys(C.statusDefs).map(k => ({ k, n: model.stats.byStatus[k] || 0 })).filter(x => x.n);
		// notas
		const ten = C.scale() === 10;
		const dist = [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5].map(r => ({ r, n: model.anime.filter(a => a.rating === r).length }));
		const dMax = Math.max(1, ...dist.map(x => x.n));
		// formatos
		const fm = C.groupBy(model.anime, a => a.format);
		// dia da semana
		const wdN = [0, 0, 0, 0, 0, 0, 0];
		for (const [d, v] of days) if (all || inR(d)) wdN[new Date(d + "T00:00:00").getDay()] += v.episodes;
		const wdMax = Math.max(1, ...wdN);
		// anos de lançamento (décadas)
		const dec = C.groupBy(model.anime.filter(a => a.year), a => `${Math.floor(a.year / 10) * 10}s`);
		const top = watchedList.sort((x, y) => y[1].min - x[1].min).slice(0, 8);

		const card = (title, body, sub = "", cls = "") => `<section class="av-statcard${cls ? ` ${cls}` : ""}"><header><h3>${U.esc(title)}</h3>${sub ? `<p>${U.esc(sub)}</p>` : ""}</header>${body}</section>`;
		const html = `<div class="av-page av-pad av-statpage">
			${U.pageHead("Estatísticas", { sub: all ? "Sua biblioteca inteira" : `De ${U.fmtDate(from)} até hoje (pelo diário de episódios)`, actions: `<div class="av-segmented" role="radiogroup" aria-label="Período">${tabs}</div>` })}
			<div class="av-kpis">
				${[
					["Episódios", U.fmtNum(eps), "play"],
					["Tempo assistido", U.fmtMinutes(min), "clock", min >= 1440 ? `${U.fmtNum(min / 1440, 1)} dias` : ""],
					["Concluídos", U.fmtNum(completed.length), "check"],
					["Começados", U.fmtNum(started.length), "flag"],
					["Nota média", avg ? (ten ? U.fmtNum(avg * 2, 2) : U.fmtNum(avg, 1)) : "—", "starFill"],
					["Maior maratona", best ? U.plural(best[1].episodes, "ep.", "ep.") : "—", "flame", best ? U.fmtDate(best[0]) : ""]
				].map(([l, v, i, s]) => `<div class="av-kpi">${U.icon(i)}<b>${U.esc(v)}</b><span>${U.esc(l)}</span>${s ? `<small>${U.esc(s)}</small>` : ""}</div>`).join("")}
			</div>
			<div class="av-statgrid">
				${card("Episódios por mês", monthChart, "Últimos 12 meses, pelo diário", "is-wide")}
				${card("Atividade no último ano", this.heatmap(ctx, days, { weeks: 53, label: "" }), "Episódios por dia", "is-wide")}
				${card("Gêneros", genres.length ? U.bars(genres.map(([k, v]) => ({ label: C.genreLabel(k), value: v, display: U.fmtMinutes(v), color: ctx.B?.ident(ctx, "genre", k).color }))) : `<p class="av-muted">Sem dados no período.</p>`, "Por tempo assistido")}
				${card("Status da biblioteca", `<div class="av-stack">${statusSegs.map(x => `<span class="av-tone-${C.statusDefs[x.k].tone}" style="flex:${x.n}" title="${U.attr(C.statusLabel(x.k))}: ${x.n}"></span>`).join("")}</div><ul class="av-legend">${statusSegs.map(x => `<li><i class="av-dot av-tone-${C.statusDefs[x.k].tone}"></i><span>${U.esc(C.statusLabel(x.k))}</span><b>${x.n}</b></li>`).join("")}</ul>`)}
				${card("Suas notas", `<div class="av-dist">${dist.map(x => `<div class="av-dist-row"><span>${ten ? `${C.score10(x.r)}` : `${U.fmtNum(x.r, 1)} ${U.icon("starFill")}`}</span><span class="av-dist-bar"><i style="width:${(x.n / dMax) * 100}%"></i></span><b>${x.n || ""}</b></div>`).join("")}</div>`, rated.length ? `${rated.length} avaliados` : "Nenhum anime avaliado")}
				${card("Estúdios", studios.length ? U.bars(studios.map(([k, v]) => ({ label: k, value: v, display: U.plural(v, "ep.", "ep."), attrs: `data-action="open-category" data-kind="studio" data-name="${U.attr(k)}" href="#"` }))) : `<p class="av-muted">Sem dados no período.</p>`, "Por episódios assistidos")}
				${card("Dia da semana", `<div class="av-cols av-cols--wd">${wdN.map((v, i) => `<div class="av-col" title="${U.attr(C.weekdays[i])}: ${v}"><span class="av-col-v">${v || ""}</span><span class="av-col-bar"><i style="height:${v ? Math.max(4, (v / wdMax) * 100) : 0}%"></i></span><small>${C.weekdays[i].slice(0, 3).toLowerCase()}</small></div>`).join("")}</div>`, "Quando você mais assiste")}
				${card("Formatos e décadas", `${U.bars([...fm].sort((x, y) => y[1].length - x[1].length).map(([k, l]) => ({ label: C.formatLabel(k), value: l.length, display: String(l.length) })))}<div class="av-fchips av-fchips--wrap av-decades">${[...dec].sort().map(([k, l]) => `<span class="av-fchip">${U.esc(k)}<span>${l.length}</span></span>`).join("")}</div>`)}
				${card("Mais assistidos", top.length ? `<ol class="av-toplist">${top.map(([a, v], i) => `<li><span class="av-toplist-n">${i + 1}</span><a ${U.openAttrs(a.path)}>${U.cover(a, { cls: "av-cover--xs" })}<span><b>${U.esc(a.title)}</b><small>${U.plural(v.eps, "episódio", "episódios")}</small></span></a><b class="av-num">${U.esc(U.fmtMinutes(v.min))}</b></li>`).join("")}</ol>` : `<p class="av-muted">Sem dados no período.</p>`, "", "is-wide")}
			</div>
		</div>`;
		return {
			active: "statistics", html, wire: root => {
				root.querySelectorAll("[data-period]").forEach(b => b.addEventListener("click", () => { U._store("statPeriod", b.dataset.period); ctx.V._rerender("statistics"); }));
			}
		};
	}

	// ============================================================= TIER LIST
	tierlist(ctx) {
		const { C, U, model } = ctx;
		const tiers = [["S", "Obra-prima"], ["A", "Excelente"], ["B", "Muito bom"], ["C", "Bom"], ["D", "Esquecível"]];
		const by = t => model.anime.filter(a => a.tier === t).sort((x, y) => (x.tierOrder ?? 999) - (y.tierOrder ?? 999) || y.rating - x.rating);
		const pool = model.anime.filter(a => !tiers.some(([t]) => t === a.tier) && a.status !== "Planning").sort((x, y) => y.rating - x.rating || x.title.localeCompare(y.title));
		const tile = a => `<div class="av-tiertile" draggable="true" data-anime="${U.attr(a.path)}" title="${U.attr(a.title)}">${U.cover(a)}<span>${U.esc(a.title)}</span></div>`;
		const html = `<div class="av-page av-pad av-tierpage">
			${U.pageHead("Tier List", { sub: "Arraste as capas para as faixas. No celular: toque numa capa e depois na faixa." })}
			<div class="av-tiers">${tiers.map(([t, label]) => `<section class="av-tier av-tier--${t.toLowerCase()}" data-tier="${t}">
				<div class="av-tier-label"><b>${t}</b><small>${U.esc(label)}</small></div>
				<div class="av-tier-zone" data-zone="${t}">${by(t).map(tile).join("")}</div>
			</section>`).join("")}</div>
			<section class="av-block">${U.sectionHead("Sem tier", { count: pool.length, sub: "Assistidos ou em andamento, ainda sem faixa" })}
				<div class="av-tier-zone av-tier-pool" data-zone="">${pool.map(tile).join("")}</div>
			</section>
		</div>`;
		return { active: "tierlist", html, wire: root => this._wireTier(root, ctx) };
	}

	_wireTier(root, ctx) {
		const { V } = ctx;
		let picked = null, drag = null;
		const save = async zone => {
			const t = zone.dataset.zone;
			const paths = [...zone.querySelectorAll(".av-tiertile")].map(el => el.dataset.anime);
			for (let i = 0; i < paths.length; i++) {
				const f = app.vault.getAbstractFileByPath(paths[i]);
				if (f) await app.fileManager.processFrontMatter(f, fm => { fm.tier = t; fm.tierOrder = t ? i + 1 : ""; });
			}
		};
		const place = async (el, zone, before = null) => {
			const from = el.parentElement;
			if (before && before !== el) zone.insertBefore(el, before); else if (!before) zone.appendChild(el);
			el.classList.remove("is-picked");
			el.classList.add("is-placed"); setTimeout(() => el.classList.remove("is-placed"), 450);
			root.querySelector(".av-tiers")?.classList.remove("is-picking");
			V._haptic(10);
			await save(zone);
			if (from && from !== zone) await save(from);
		};
		root.addEventListener("click", e => {
			const tile = e.target.closest(".av-tiertile");
			const zone = e.target.closest("[data-zone]");
			if (tile && !picked) { picked = tile; tile.classList.add("is-picked"); root.querySelector(".av-tiers")?.classList.add("is-picking"); V._haptic(6); return; }
			if (tile && picked === tile) { picked.classList.remove("is-picked"); picked = null; root.querySelector(".av-tiers")?.classList.remove("is-picking"); return V.open(tile.dataset.anime, ctx); }
			if (picked && zone) { const p = picked; picked = null; place(p, zone, tile && tile !== p ? tile : null); }
		});
		root.addEventListener("dragstart", e => { const t = e.target.closest(".av-tiertile"); if (!t) return; drag = t; t.classList.add("is-dragging"); e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", t.dataset.anime); } catch (_) {} });
		root.addEventListener("dragend", () => { drag?.classList.remove("is-dragging"); drag = null; root.querySelectorAll(".is-over").forEach(z => z.classList.remove("is-over")); });
		root.addEventListener("dragover", e => { const z = e.target.closest("[data-zone]"); if (!z || !drag) return; e.preventDefault(); root.querySelectorAll(".is-over").forEach(x => x !== z && x.classList.remove("is-over")); z.classList.add("is-over"); });
		root.addEventListener("drop", e => {
			const z = e.target.closest("[data-zone]");
			if (!z || !drag) return;
			e.preventDefault();
			z.classList.remove("is-over");
			const before = e.target.closest(".av-tiertile");
			place(drag, z, before && before !== drag ? before : null);
		});
	}

	// ================================================================ PERFIL
	// como o perfil do MyAnimeList: "Anime Stats" (dias, nota média, barra de
	// status com as cores do MAL), últimas atualizações, favoritos e notas
	profile(ctx) {
		const { C, U, model, AL } = ctx;
		const s = model.stats;
		const cfg = AL ? AL.getConfig() : null;
		const name = cfg?.user || "Você";
		const order = ["Watching", "Completed", "Paused", "Dropped", "Planning"];
		const count = k => k === "Watching" ? s.byStatus.Watching + s.byStatus.Rewatching : s.byStatus[k] || 0;
		const total = Math.max(1, s.anime);
		const recent = [...model.anime].filter(a => a.lastWatched || a.dateAdded).sort((x, y) => C.maxIso(y.lastWatched, y.dateAdded).localeCompare(C.maxIso(x.lastWatched, x.dateAdded))).slice(0, 6);
		const favs = model.anime.filter(a => a.favorite).sort((x, y) => y.rating - x.rating);
		const ten = C.scale() === 10;
		const rated = model.anime.filter(a => a.rating);
		const dist = ten ? [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(n => ({ k: n, n: rated.filter(a => C.score10(a.rating) === n).length }))
			: [5, 4, 3, 2, 1].map(n => ({ k: n, n: rated.filter(a => Math.ceil(a.rating) === n).length }));
		const dMax = Math.max(1, ...dist.map(x => x.n));
		const genres = [...C.groupBy(model.anime.filter(a => a.status !== "Planning"), a => a.genres)].sort((x, y) => y[1].length - x[1].length).slice(0, 10);
		const html = `<div class="av-page av-profile">
			<section class="av-profhero">
				${cfg?.banner ? `<img class="av-profhero-art" src="${U.attr(cfg.banner)}" alt="" data-av-img>` : ""}
				<div class="av-profhero-inner av-pad">
					<span class="av-profavatar">${cfg?.avatar ? `<img src="${U.attr(cfg.avatar)}" alt="" data-av-img>` : `<b>${U.esc(name[0].toUpperCase())}</b>`}</span>
					<div><span class="av-kicker">Perfil</span><h1>${U.esc(name)}</h1><p>${s.firstAdded ? `Na biblioteca desde ${U.esc(U.fmtDate(s.firstAdded))}` : "Biblioteca nova"} · ${U.plural(s.anime, "anime", "animes")}</p></div>
					<div class="av-profhero-acts"><a class="av-btn av-btn--outline av-btn--sm" ${U.openAttrs("Dashboard/Integrações")}>${U.icon("link")}<span>Integrações</span></a></div>
				</div>
			</section>
			<div class="av-pad av-profbody">
				<section class="av-malbox av-animestats">
					<h3>Estatísticas de anime</h3>
					<div class="av-animestats-top"><span>Dias: <b>${U.fmtNum(s.days, 1)}</b></span><span>Nota média: <b>${s.avgRating ? (ten ? U.fmtNum(s.avgRating * 2, 2) : U.fmtNum(s.avgRating, 2)) : "—"}</b></span></div>
					<div class="av-msbar">${order.map(k => count(k) ? `<span style="flex:${count(k)};background:${C.malStatus[k].color}" title="${U.attr(C.malStatus[k].label)}: ${count(k)}"></span>` : "").join("")}</div>
					<div class="av-animestats-cols">
						<ul class="av-mslegend">${order.map(k => `<li><a ${U.openAttrs("Dashboard/Biblioteca")} data-lib-tab="${k}"><i style="background:${C.malStatus[k].color}"></i>${U.esc(C.malStatus[k].label)}</a><b>${U.fmtNum(count(k))}</b></li>`).join("")}</ul>
						<ul class="av-mslegend">
							<li><span>Total de entradas</span><b>${U.fmtNum(s.anime)}</b></li>
							<li><span>Reassistidos</span><b>${U.fmtNum(s.rewatched)}</b></li>
							<li><span>Episódios</span><b>${U.fmtNum(s.episodes)}</b></li>
							<li><span>Tempo</span><b>${U.esc(U.fmtHours(s.hours))}</b></li>
							<li><span>Favoritos</span><b>${U.fmtNum(s.favorites)}</b></li>
						</ul>
					</div>
				</section>
				<section class="av-malbox">
					<h3>Últimas atualizações</h3>
					${recent.length ? `<ul class="av-updates">${recent.map(a => {
						const ms = C.malStatusOf(a.status);
						const p = a.progress;
						return `<li><a class="av-updates-art" ${U.openAttrs(a.path)}>${U.cover(a, { cls: "av-cover--sm" })}</a><div><a class="av-updates-title" ${U.openAttrs(a.path)}>${U.esc(a.title)}</a>
							<div class="av-updates-bar"><span style="width:${p.pct ?? (p.done ? 100 : 0)}%;background:${ms.color}"></span></div>
							<small><b style="color:${ms.color}">${U.esc(ms.label)}</b> ${p.watched}/${p.total || "?"}${a.rating ? ` · Nota ${U.esc(U.scoreText(a.rating))}` : ""} · ${U.esc(U.relDate(C.maxIso(a.lastWatched, a.dateAdded)))}</small></div></li>`;
					}).join("")}</ul>` : `<p class="av-muted">Nada ainda.</p>`}
				</section>
				<section class="av-malbox">
					<h3>Distribuição das suas notas</h3>
					${rated.length ? `<div class="av-dist">${dist.map(x => `<div class="av-dist-row"><span>${x.k}${ten ? "" : ` ${U.icon("starFill")}`}</span><span class="av-dist-bar"><i style="width:${(x.n / dMax) * 100}%"></i></span><b>${x.n || ""}</b></div>`).join("")}</div>` : `<p class="av-muted">Nenhum anime avaliado.</p>`}
				</section>
				<section class="av-malbox">
					<h3>Gêneros que você mais assiste</h3>
					${genres.length ? `<div class="av-chiplinks">${genres.map(([g, l]) => `<a class="av-chiplink" data-action="open-category" data-kind="genre" data-name="${U.attr(g)}" href="#">${U.esc(C.genreLabel(g))}<span class="av-chiplink-n">${l.length}</span></a>`).join("")}</div>` : `<p class="av-muted">—</p>`}
				</section>
				${U.shelf("Favoritos", favs.map(a => U.animeCard(a, C)), { count: favs.length })}
			</div>
		</div>`;
		return {
			active: "profile", html, wire: root => {
				root.querySelectorAll("[data-lib-tab]").forEach(a => a.addEventListener("click", () => { window.__avLibTab = a.dataset.libTab; }, true));
			}
		};
	}

	// =============================================================== RANKING
	// como o Top Anime do MyAnimeList: o seu ranking (por nota, nota do MAL,
	// popularidade ou tempo) e o Top do MAL para descobrir e adicionar
	ranking(ctx) {
		const { C, U, model } = ctx;
		const sorts = { mine: "Sua nota", mal: "Nota do MAL", popular: "Popularidade", time: "Mais assistidos" };
		const sort = sorts[U._store("rankSort")] ? U._store("rankSort") : "mine";
		const key = {
			mine: a => a.rating * 100 + (a.mal.score || 0),
			mal: a => a.mal.score || (a.score ? a.score / 10 : 0),
			popular: a => a.mal.members || a.anilist.popularity || 0,
			time: a => a.minutes
		}[sort];
		const list = model.anime.filter(a => key(a) > 0).sort((x, y) => key(y) - key(x) || x.title.localeCompare(y.title));
		const tops = { all: "Geral", airing: "Em lançamento", popular: "Mais populares", upcoming: "Em breve" };
		const topKind = tops[U._store("malTop")] ? U._store("malTop") : "all";
		const range = a => [a.airedFrom ? U.fmtDate(a.airedFrom).replace(/^\d+ /, "") : "", a.airedTo && a.airedTo !== a.airedFrom ? U.fmtDate(a.airedTo).replace(/^\d+ /, "") : ""].filter(Boolean).join(" – ");
		const html = `<div class="av-page av-pad av-rankpage">
			${U.pageHead("Ranking", { sub: "Seu top e o top do MyAnimeList", kicker: "Top anime" })}
			${ctx.B?.browseTabs ? ctx.B.browseTabs(ctx, "ranking") : ""}
			<section class="av-block">
				${U.sectionHead("Seu ranking", { count: list.length, action: `<div class="av-segmented" role="radiogroup">${Object.entries(sorts).map(([k, v]) => `<button type="button" data-rank-sort="${k}" class="${k === sort ? "is-active" : ""}">${U.esc(v)}</button>`).join("")}</div>` })}
				${list.length ? `<div class="av-ranklist"><div class="av-rankrow av-rankrow--head"><span>Rank</span><span>Título</span><span>Nota MAL</span><span>Sua nota</span><span>Status</span></div>${list.slice(0, 100).map((a, i) => `<div class="av-rankrow${i < 3 ? ` is-top is-top${i + 1}` : ""}">
					<span class="av-rankrow-n">${i + 1}</span>
					<span class="av-rankrow-title"><a class="av-rankrow-art" ${U.openAttrs(a.path)}>${U.cover(a, { cls: "av-cover--sm" })}</a><span><a ${U.openAttrs(a.path)}><b>${U.esc(a.title)}</b></a><small>${U.esc(`${a.formatLabel}${a.episodes && !C.isMovie(a) ? ` (${a.episodes} eps)` : ""}`)}</small><small>${U.esc(range(a))}</small><small>${a.mal.members ? `${U.fmtNum(a.mal.members)} membros` : a.anilist.popularity ? `${U.fmtNum(a.anilist.popularity)} usuários no AniList` : sort === "time" ? U.fmtMinutes(a.minutes) : ""}</small></span></span>
					<span class="av-rankrow-score">${a.mal.score ? `${U.icon("starFill")}<b>${U.fmtNum(a.mal.score, 2)}</b>` : a.score ? `<b>${a.score}%</b><small>AniList</small>` : `<span class="av-muted">N/A</span>`}</span>
					<span class="av-rankrow-mine">${a.rating ? U.score(a.rating) : `<span class="av-muted">—</span>`}</span>
					<span class="av-rankrow-status">${U.statusTag(a, C)}</span>
				</div>`).join("")}</div>` : U.empty({ icon: "trophy", title: "Nada para ranquear ainda", text: sort === "mine" ? "Dê notas aos seus animes." : "Atualize os animes pelo MyAnimeList ou AniList (Integrações).", compact: true })}
			</section>
			${ctx.MAL ? `<section class="av-block">
				${U.sectionHead("Top do MyAnimeList", { sub: "Pela Jikan (API pública do MAL). Toque para adicionar à sua lista.", action: `<div class="av-segmented" role="radiogroup">${Object.entries(tops).map(([k, v]) => `<button type="button" data-mal-top="${k}" class="${k === topKind ? "is-active" : ""}">${U.esc(v)}</button>`).join("")}</div>` })}
				<div data-mal-topslot><p class="av-add-hint is-busy">${U.icon("refresh")}Carregando o Top do MyAnimeList…</p></div>
			</section>` : ""}
		</div>`;
		return {
			active: "ranking", html, wire: root => {
				root.querySelectorAll("[data-rank-sort]").forEach(b => b.addEventListener("click", () => { U._store("rankSort", b.dataset.rankSort); ctx.V._rerender("ranking"); }));
				const slot = root.querySelector("[data-mal-topslot]");
				const load = async kind => {
					if (!slot) return;
					slot.innerHTML = `<p class="av-add-hint is-busy">${U.icon("refresh")}Carregando o Top do MyAnimeList…</p>`;
					try {
						const top = await ctx.MAL.top(kind);
						if (!slot.isConnected) return;
						const mine = C.model(ctx.dv).anime;
						const have = new Map(mine.filter(a => a.malId).map(a => [String(a.malId), a]));
						const byTitle = new Map(mine.flatMap(a => [a.title, a.titleRomaji, a.titleEnglish].filter(Boolean).map(t => [C.normalizeKey(t), a])));
						slot.innerHTML = `<div class="av-ranklist">${top.map(x => { const h = have.get(x.malId) || byTitle.get(C.normalizeKey(x.title)) || byTitle.get(C.normalizeKey(x.titleRomaji)); return `<div class="av-rankrow">
							<span class="av-rankrow-n">${x.rank || "—"}</span>
							<span class="av-rankrow-title"><span class="av-rankrow-art"><span class="av-cover av-cover--sm"><span class="av-cover-fallback" style="--av-hue:${C.hashHue(x.title)}"></span>${x.cover ? `<img src="${U.attr(x.cover)}" alt="" loading="lazy" data-av-img>` : ""}</span></span><span>${h ? `<a ${U.openAttrs(h.path)}><b>${U.esc(x.title)}</b></a>` : `<b>${U.esc(x.title)}</b>`}<small>${U.esc(`${x.type}${x.episodes ? ` (${x.episodes} eps)` : ""}`)}</small><small>${U.esc([x.season ? C.seasonLabel(x.season.toUpperCase(), x.year) : x.year].filter(Boolean).join(""))}</small><small>${x.members ? `${U.fmtNum(x.members)} membros` : ""}</small></span></span>
							<span class="av-rankrow-score">${x.score ? `${U.icon("starFill")}<b>${U.fmtNum(x.score, 2)}</b>` : `<span class="av-muted">N/A</span>`}</span>
							<span class="av-rankrow-mine">${h?.rating ? U.score(h.rating) : ""}</span>
							<span class="av-rankrow-status">${h ? U.statusTag(h, C) : `<button type="button" class="av-relcard-add" data-mal-add="${U.attr(x.malId)}">${U.icon("plus")}<span>Quero assistir</span></button>`}</span>
						</div>`; }).join("")}</div>`;
						ctx.V._wireImages(slot);
					} catch (err) {
						slot.innerHTML = U.empty({ icon: "cloudOff", title: "Top do MyAnimeList indisponível", text: `${ctx.MAL.message(err)}. Ele aparece aqui quando houver conexão.`, compact: true });
					}
				};
				root.querySelectorAll("[data-mal-top]").forEach(b => b.addEventListener("click", () => {
					U._store("malTop", b.dataset.malTop);
					root.querySelectorAll("[data-mal-top]").forEach(x => x.classList.toggle("is-active", x === b));
					load(b.dataset.malTop);
				}));
				slot?.addEventListener("click", async e => {
					const b = e.target.closest("[data-mal-add]");
					if (!b) return;
					b.disabled = true; b.querySelector("span").textContent = "Adicionando…";
					try {
						const f = await ctx.MAL.addByMal(ctx, b.dataset.malAdd, { status: "Planning" });
						b.querySelector("span").textContent = "Na sua lista"; b.classList.add("is-done");
						ctx.V.toast(`${f.basename} em Quero assistir`, { tone: "ok", icon: "bookmark" });
					} catch (err) { b.disabled = false; b.querySelector("span").textContent = "Quero assistir"; ctx.V.toast(ctx.MAL.message(err), { tone: "error" }); }
				});
				load(topKind);
			}
		};
	}

	// ========================================================= CONFIGURAÇÕES
	settings(ctx) {
		const { C, U, model, AL } = ctx;
		const cfg = AL ? AL.getConfig() : null;
		const issues = C.audit(model);
		const sw = (key, label, hint, on) => `<label class="av-switch"><input type="checkbox" data-pref="${key}"${on ? " checked" : ""}><span></span><span class="av-switch-text"><b>${U.esc(label)}</b><small>${U.esc(hint)}</small></span></label>`;
		const html = `<div class="av-page av-pad av-settings">
			${U.pageHead("Configurações", { sub: `Anime Vault ${C.VERSION}` })}
			<section class="av-setcard">
				<header>${U.icon("b-anilist")}<div><h3>AniList</h3><p>Busca, capas, banners, episódios e o sync do seu perfil público. Sem senha e sem token: só o nome de usuário.</p></div></header>
				${!AL ? `<p class="av-muted">O módulo AnimeVaultAniList.js não foi carregado.</p>` : cfg.user ? `
					<div class="av-setrow"><span>Conta</span><b>${U.esc(cfg.user)}</b></div>
					<div class="av-setrow"><span>Último sync</span><b>${cfg.lastSync ? U.esc(U.relDate(cfg.lastSync.slice(0, 10))) : "Nunca"}</b></div>
					${sw("alAuto", "Sincronizar ao abrir", "No máximo uma vez a cada 6 horas", cfg.autoSync)}
					<div class="av-setacts">${U.btn("Sincronizar agora", { icon: "refresh", kind: "primary", action: "anilist-sync" })}${U.btn("Abrir perfil", { icon: "b-anilist", kind: "ghost", attrs: `data-open="Dashboard/AniList" href="Dashboard/AniList"` })}${U.btn("Desconectar", { kind: "ghost", action: "anilist-disconnect" })}</div>`
					: `<div class="av-setacts">${U.btn("Conectar perfil", { icon: "link", kind: "primary", action: "anilist-connect" })}</div>`}
				${AL ? `<div class="av-setacts av-setacts--sub">${U.btn("Atualizar todos do AniList", { icon: "refresh", kind: "ghost", action: "anilist-refresh-all" })}${U.btn("Baixar capas e banners que faltam", { icon: "download", kind: "ghost", action: "anilist-art" })}</div>` : ""}
			</section>
			<section class="av-setcard">
				<header>${U.icon("b-mal")}<div><h3>MyAnimeList</h3><p>Nota, ranking e popularidade do MAL, importação e exportação da lista pelo XML oficial.</p></div></header>
				<div class="av-setacts">${U.btn("Atualizar do MAL", { icon: "refresh", kind: "primary", action: "mal-refresh-all" })}${U.btn("Importar XML do MAL", { icon: "upload", kind: "ghost", action: "mal-import" })}${U.btn("Exportar XML", { icon: "download", kind: "ghost", action: "mal-export" })}<a class="av-btn av-btn--ghost" ${U.openAttrs("Dashboard/Integrações")}>${U.icon("link")}<span>Integrações</span></a></div>
			</section>
			<section class="av-setcard">
				<header>${U.icon("gear")}<div><h3>Preferências</h3><p>Valem só neste dispositivo.</p></div></header>
				<div class="av-setrow av-setrow--scale"><span>Escala de notas</span><div class="av-segmented" role="radiogroup"><button type="button" data-scale="5" class="${C.scale() === 10 ? "" : "is-active"}">★ 5 estrelas</button><button type="button" data-scale="10" class="${C.scale() === 10 ? "is-active" : ""}">1–10 (MAL)</button></div></div>
				${sw("reducedMotion", "Reduzir animações", "Desliga entradas, carrossel automático e transições", U._store("reducedMotion") === "1")}
				${sw("hoverSummary", "Sinopse ao passar o mouse", "Os cards mostram título, nota e sinopse no hover", U._store("hoverSummary") !== "0")}
				${sw("haptics", "Vibração leve ao tocar", "Celular: ao marcar episódio, favoritar e trocar de aba", U._store("haptics") !== "0")}
			</section>
			<section class="av-setcard">
				<header>${U.icon("info")}<div><h3>Como funciona</h3><p>Cada anime é uma nota em <code>Animes/</code>; os dados ficam no frontmatter. Capas em <code>Assets/Covers</code>, banners em <code>Assets/Banners</code>.</p></div></header>
				<ul class="av-setlist">
					<li>${U.icon("play")}<span><b>Assisti o episódio</b> grava o progresso (<code>episodesWatched</code>) e uma linha no diário (<code>log</code>) com a data.</span></li>
					<li>${U.icon("search")}<span><b>/</b> ou <b>Ctrl/Cmd + K</b> abrem a busca; Enter sem resultado busca no AniList.</span></li>
					<li>${U.icon("menu")}<span>Toque longo (ou botão direito) num card abre as ações rápidas.</span></li>
					<li>${U.icon("refresh")}<span>No celular, puxe o Início para baixo para sincronizar.</span></li>
				</ul>
			</section>
			<section class="av-setcard">
				<header>${U.icon("alert")}<div><h3>Diagnóstico</h3><p>${issues.length ? `${U.plural(issues.length, "ponto para revisar", "pontos para revisar")} nas notas` : "Tudo certo com as notas"}</p></div></header>
				${issues.length ? `<ul class="av-issues">${issues.slice(0, 60).map(i => `<li class="is-${i.level}"><span class="av-issue-area">${U.esc(i.area)}</span><span>${U.esc(i.message)}</span>${i.path ? `<a class="av-link" ${U.openAttrs(i.path)}>${U.esc(i.path.split("/").pop().replace(/\.md$/, ""))}</a>` : ""}</li>`).join("")}</ul>` : ""}
			</section>
		</div>`;
		return {
			active: "settings", html, wire: root => {
				root.querySelectorAll("[data-scale]").forEach(b => b.addEventListener("click", () => { U._store("scale", b.dataset.scale); ctx.V.toast(b.dataset.scale === "10" ? "Notas de 1 a 10 (MyAnimeList)" : "Notas em 5 estrelas", { tone: "ok" }); ctx.V.refresh(); }));
				root.querySelectorAll("[data-pref]").forEach(cb => cb.addEventListener("change", async () => {
					const k = cb.dataset.pref;
					if (k === "alAuto") { await AL?.saveConfig({ autoSync: cb.checked }); return ctx.V.toast(cb.checked ? "Sync ao abrir ligado" : "Sync ao abrir desligado", { tone: "ok" }); }
					if (k === "reducedMotion") U._store(k, cb.checked ? "1" : "0");
					else U._store(k, cb.checked ? "1" : "0");
					ctx.V._applyPrefs();
					ctx.V.toast("Preferência salva", { tone: "ok" });
				}));
			}
		};
	}
}
