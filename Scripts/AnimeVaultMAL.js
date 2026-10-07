// ==========================================================================
// Anime Vault — MyAnimeList
//
// O que faz:
//   · estatísticas públicas de cada anime (nota, ranking, popularidade,
//     membros, favoritos) e a ficha do MAL (fonte, demografia, temas,
//     produtoras, classificação, transmissão) pela Jikan, a API pública e
//     não oficial do MyAnimeList (sem conta, sem chave)
//   · Top do MyAnimeList na tela Ranking
//   · importar a lista do MAL pelo arquivo XML oficial (Perfil › Export)
//     e exportar a sua biblioteca no mesmo formato, para importar no MAL
//   · a tela Integrações (AniList + MyAnimeList)
//
// Rede: requestUrl do Obsidian, só para api.jikan.moe (dados) — uma
// requisição por vez, ~1,1 s de intervalo (limite da Jikan: 3/s e 60/min).
//
// Acesso: customJS.AnimeVaultMAL
// ==========================================================================

class AnimeVaultMAL {

	constructor() {
		this.base = "https://api.jikan.moe/v4";
		this.minIntervalMs = 1100;
		this.timeoutMs = 20000;
		if (!window.__avMalQueue) window.__avMalQueue = { chain: Promise.resolve(), last: 0 };
	}

	get C() { return customJS.AnimeVaultCore; }
	get U() { return customJS.AnimeVaultUI; }
	get AL() { return customJS.AnimeVaultAniList; }

	_err(code, msg = "") { const e = new Error(msg || code); e.code = code; return e; }
	message(err) {
		return ({ network: "Sem conexão com o MyAnimeList (Jikan) agora", rate_limited: "A Jikan pediu uma pausa. Tente de novo em um minuto", not_found: "Não encontrado no MyAnimeList", bad_file: "Arquivo inválido: use o XML exportado do MyAnimeList (Perfil › Export)" })[err?.code] || String(err?.message || err);
	}

	// ================================================================ rede
	_sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
	_requestFn() {
		const fn = globalThis?.customJS?.obsidian?.requestUrl || globalThis?.requestUrl || globalThis?.app?.requestUrl;
		if (typeof fn !== "function") throw this._err("network", "requestUrl do Obsidian indisponível");
		return fn;
	}
	_enqueue(task) {
		const q = window.__avMalQueue;
		const run = async () => {
			const wait = q.last + this.minIntervalMs - Date.now();
			if (wait > 0) await this._sleep(wait);
			try { return await task(); } finally { q.last = Date.now(); }
		};
		const p = q.chain.then(run, run);
		q.chain = p.catch(() => {});
		return p;
	}

	async get(path, { retries = 1 } = {}) {
		const url = `${this.base}${path}`;
		if (!this.C.safeUrl(url, { hosts: ["api.jikan.moe"], protocols: ["https:"] })) throw this._err("network", "host");
		const request = this._requestFn();
		for (let attempt = 0; ; attempt++) {
			let res;
			try {
				res = await this._enqueue(() => Promise.race([
					request({ url, method: "GET", headers: { Accept: "application/json" }, throw: false }),
					new Promise((_, rej) => setTimeout(() => rej(this._err("network", "timeout")), this.timeoutMs))
				]));
			} catch (err) {
				if (attempt < retries) { await this._sleep(1500); continue; }
				throw err.code ? err : this._err("network", err.message);
			}
			if (res.status === 429) { if (attempt < retries) { await this._sleep(2500); continue; } throw this._err("rate_limited"); }
			if (res.status === 404) throw this._err("not_found");
			if (res.status >= 500 && attempt < retries) { await this._sleep(2000); continue; }
			if (res.status !== 200) throw this._err("network", `HTTP ${res.status}`);
			try { return res.json ?? JSON.parse(res.text); } catch (_) { throw this._err("network", "resposta inválida"); }
		}
	}

	// ================================================== ficha e estatísticas
	_rating(r) {
		const s = String(r || "");
		if (/^G\b/.test(s)) return "Livre";
		if (/^PG-13/.test(s)) return "13+";
		if (/^PG\b/.test(s)) return "Infantil";
		if (/^R\+/.test(s)) return "17+ (nudez leve)";
		if (/^R\b/.test(s)) return "17+";
		if (/^Rx/.test(s)) return "18+";
		return this.C.clip(s, 40);
	}
	_broadcast(b) {
		const s = String(b?.string || "");
		if (!s || /unknown/i.test(s)) return "";
		const days = { Mondays: "Segundas", Tuesdays: "Terças", Wednesdays: "Quartas", Thursdays: "Quintas", Fridays: "Sextas", Saturdays: "Sábados", Sundays: "Domingos" };
		return this.C.clip(s.replace(/^(\w+)/, d => days[d] || d).replace(" at ", " às "), 60);
	}

	// dados do MAL → campos da nota (as estatísticas sempre; o resto só se vazio)
	_fields(d) {
		const C = this.C;
		return {
			mal: { score: d.score ?? "", scoredBy: d.scored_by ?? "", rank: d.rank ?? "", popularity: d.popularity ?? "", members: d.members ?? "", favorites: d.favorites ?? "", lastSync: new Date().toISOString(), syncStatus: "ok" },
			source: d.source && d.source !== "Unknown" ? C.sourceLabel(d.source) : "",
			ageRating: d.rating ? this._rating(d.rating) : "",
			demographic: (d.demographics || []).map(x => C.clip(x.name, 30)),
			themes: (d.themes || []).map(x => C.clip(x.name, 40)).slice(0, 8),
			producers: (d.producers || []).map(x => C.clip(x.name, 60)).slice(0, 8),
			broadcast: this._broadcast(d.broadcast),
			episodes: Number(d.episodes) || ""
		};
	}

	async refresh(ctx, paths = null, el = null) {
		const { V, U, C } = ctx;
		const model = C.model(ctx.dv);
		const list = (paths ? paths.map(p => model.animeByPath.get(p)).filter(Boolean) : model.anime).filter(a => a.malId);
		if (!list.length) return V.toast(paths ? "Este anime não tem malId (Atualizar do AniList preenche sozinho)" : "Nenhum anime com malId. Atualize do AniList para ligar ao MAL", { tone: "warn" });
		if (el) el.disabled = true;
		const t = V.toast(`MyAnimeList: ${U.plural(list.length, "anime", "animes")}…`, { sticky: true, icon: "b-mal", progress: 4 });
		let done = 0, failed = 0;
		for (let i = 0; i < list.length; i++) {
			const a = list[i];
			t.update(`MyAnimeList: ${a.title} (${i + 1}/${list.length})`, { progress: ((i + 1) / list.length) * 100 });
			const f = app.vault.getAbstractFileByPath(a.path);
			try {
				const res = await this.get(`/anime/${encodeURIComponent(a.malId)}`);
				const v = this._fields(res.data || {});
				await app.fileManager.processFrontMatter(f, fm => {
					const empty = k => fm[k] === undefined || fm[k] === null || fm[k] === "" || (Array.isArray(fm[k]) && !fm[k].length);
					fm.mal = v.mal;
					for (const k of ["source", "ageRating", "demographic", "themes", "producers", "broadcast", "episodes"]) if (empty(k) && v[k] && (!Array.isArray(v[k]) || v[k].length)) fm[k] = v[k];
				});
				done++;
			} catch (err) {
				failed++;
				if (err.code === "rate_limited" || err.code === "network") { t.update(`MyAnimeList: ${this.message(err)}`, { tone: "warn" }); break; }
				if (f) await app.fileManager.processFrontMatter(f, fm => { fm.mal = { ...(typeof fm.mal === "object" && fm.mal ? fm.mal : {}), syncStatus: err.code || "error" }; });
			}
		}
		if (done || !failed) t.update(`MyAnimeList: ${U.plural(done, "anime atualizado", "animes atualizados")}${failed ? `, ${failed} com falha` : ""}`, { tone: failed ? "warn" : "ok" });
		t.close(4500);
		if (el) el.disabled = false;
		V.refresh();
	}

	// ================================================================ Top
	async top(kind = "all") {
		const key = `mal-top-${kind}`;
		const mem = (window.__avMalTop ||= {});
		if (mem[key] && Date.now() - mem[key].at < 12 * 3600 * 1000) return mem[key].list;
		const cached = await this.AL.readCache(key);
		if (cached && Date.now() - Date.parse(cached.at) < 12 * 3600 * 1000) { mem[key] = { at: Date.parse(cached.at), list: cached.list }; return cached.list; }
		const filter = { airing: "&filter=airing", popular: "&filter=bypopularity", upcoming: "&filter=upcoming" }[kind] || "";
		const res = await this.get(`/top/anime?limit=25${filter}`);
		const C = this.C;
		const list = (res.data || []).map(d => ({
			malId: String(d.mal_id), title: C.clip(d.title_english || d.title, 140), titleRomaji: C.clip(d.title, 140), type: d.type || "", episodes: d.episodes || null,
			score: d.score ?? null, rank: d.rank ?? null, members: d.members ?? null, year: d.year || (d.aired?.from ? Number(String(d.aired.from).slice(0, 4)) : null),
			season: d.season || "", cover: C.safeUrl(d.images?.webp?.large_image_url || d.images?.jpg?.large_image_url, { hosts: ["myanimelist.net"] })
		}));
		await this.AL.writeCache(key, { at: new Date().toISOString(), list });
		mem[key] = { at: Date.now(), list };
		return list;
	}

	// adicionar pelo id do MAL: metadados e artes do AniList (idMal); sem
	// AniList, uma nota simples com o que o MAL informa
	async addByMal(ctx, malId, overrides = {}) {
		const d = await this.AL.gql(`query ($id: Int) { Media(idMal: $id, type: ANIME) { ${this.AL.mediaFields} ${this.AL.extraFields} } }`, { id: Number(malId) }).catch(() => null);
		if (d?.Media) return this.AL.createFromMedia(ctx, d.Media, overrides);
		const res = await this.get(`/anime/${encodeURIComponent(malId)}`);
		const x = res.data || {};
		const v = this._fields(x);
		return this.C.createAnimeNote({
			title: this.C.clip(x.title_english || x.title, 140), titleRomaji: this.C.clip(x.title, 140), titleNative: this.C.clip(x.title_japanese, 140),
			format: this.C.normalizeFormat(x.type), episodes: v.episodes, malId: String(malId), summary: this.C.plainText(x.synopsis, 1400),
			genre: (x.genres || []).map(g => this.C.genreLabel(g.name)), studio: (x.studios || []).map(s => s.name),
			cover: this.C.safeUrl(x.images?.jpg?.large_image_url, { hosts: ["myanimelist.net"] }),
			source: v.source, ageRating: v.ageRating, demographic: v.demographic, themes: v.themes, producers: v.producers, broadcast: v.broadcast,
			status: overrides.status || "Planning", episodesWatched: overrides.watched || 0, rating: overrides.rating || 0,
			startDate: overrides.startDate || "", completionDate: overrides.completionDate || "", rewatches: overrides.rewatches || 0
		});
	}

	// ================================================= importar XML do MAL
	// MyAnimeList › Perfil › Export (lista de anime) gera um .xml.gz. O
	// Vault lê o .xml ou o próprio .gz (descompactado no aparelho).
	async _readFile(file) {
		if (/\.gz$/i.test(file.name)) {
			if (typeof DecompressionStream !== "function") throw this._err("bad_file", "Descompacte o .gz antes (este aparelho não descompacta)");
			return await new Response(file.stream().pipeThrough(new DecompressionStream("gzip"))).text();
		}
		return await file.text();
	}

	parseXml(text) {
		const doc = new DOMParser().parseFromString(text, "application/xml");
		if (doc.querySelector("parsererror") || !doc.querySelector("myanimelist")) throw this._err("bad_file");
		const C = this.C;
		const val = (el, tag) => (el.getElementsByTagName(tag)[0]?.textContent || "").trim();
		const date = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !s.startsWith("0000") ? s.replace(/-00/g, "-01") : "";
		return [...doc.getElementsByTagName("anime")].map(el => ({
			malId: val(el, "series_animedb_id"), title: C.clip(val(el, "series_title"), 160), type: val(el, "series_type"),
			episodes: Number(val(el, "series_episodes")) || null, watched: Number(val(el, "my_watched_episodes")) || 0,
			start: date(val(el, "my_start_date")), finish: date(val(el, "my_finish_date")),
			score: Number(val(el, "my_score")) || 0, status: C.malStatusIn[val(el, "my_status").toLowerCase()] || "Planning",
			rewatches: Number(val(el, "my_times_watched")) || 0, rewatching: val(el, "my_rewatching") === "1"
		})).filter(e => /^\d+$/.test(e.malId));
	}

	openImport(ctx) {
		const { U, V, C } = ctx;
		const body = document.createElement("div");
		body.className = "av-host av-form";
		body.innerHTML = `<p class="av-modal-text">No MyAnimeList, abra <b>Perfil › Export</b>, escolha a lista de <b>anime</b> e baixe o arquivo. Depois, escolha aqui o <code>.xml</code> (ou o <code>.xml.gz</code> como veio).</p>
			<label class="av-dropzone">${U.icon("upload")}<span><b>Escolher arquivo do MAL</b><small>animelist_….xml ou .xml.gz</small></span><input type="file" accept=".xml,.gz,application/xml,text/xml,application/gzip" data-mal-file hidden></label>
			<div data-mal-preview></div>`;
		const m = V.modal({ title: "Importar do MyAnimeList", sub: "Progresso, status, notas e datas da sua lista do MAL", size: "md", body, actions: `${U.btn("Cancelar", { kind: "ghost", attrs: "data-close" })}${U.btn("Importar", { kind: "primary", icon: "download", attrs: "data-mal-go disabled" })}` });
		let entries = [];
		const go = m.el.querySelector("[data-mal-go]");
		body.querySelector("[data-mal-file]").addEventListener("change", async e => {
			const f = e.target.files?.[0];
			if (!f) return;
			const box = body.querySelector("[data-mal-preview]");
			try {
				entries = this.parseXml(await this._readFile(f));
				const model = C.model(ctx.dv);
				const byMal = new Map(model.anime.filter(a => a.malId).map(a => [String(a.malId), a]));
				const byTitle = new Map(model.anime.map(a => [C.normalizeKey(a.titleRomaji || a.title), a]));
				for (const x of entries) x.match = byMal.get(x.malId) || byTitle.get(C.normalizeKey(x.title)) || null;
				const news = entries.filter(x => !x.match), olds = entries.filter(x => x.match);
				const per = C.groupBy(entries, x => x.status);
				box.innerHTML = `<div class="av-malpreview">
					<div class="av-malpreview-stats">${Object.keys(C.malStatus).filter(k => per.get(k)?.length).map(k => `<span style="--av-ms:${C.malStatus[k].color}"><i></i>${U.esc(C.malStatus[k].label)} <b>${per.get(k).length}</b></span>`).join("")}</div>
					<p><b>${entries.length}</b> animes no arquivo · <b>${olds.length}</b> já no vault · <b>${news.length}</b> novos</p>
					<label class="av-switch"><input type="checkbox" data-opt="update" checked><span></span><span class="av-switch-text"><b>Atualizar os que já estão no vault</b><small>Progresso maior vence; status, datas e nota só quando fizer sentido. Nada é apagado.</small></span></label>
					<label class="av-switch"><input type="checkbox" data-opt="create" checked><span></span><span class="av-switch-text"><b>Criar notas para os novos</b><small>Com capa, banner e metadados do AniList (pelo id do MAL)</small></span></label>
					<label class="av-switch"><input type="checkbox" data-opt="plan"${news.filter(x => x.status === "Planning").length > 40 ? "" : " checked"}><span></span><span class="av-switch-text"><b>Incluir “Planejo assistir”</b><small>${news.filter(x => x.status === "Planning").length} novos nesse status</small></span></label>
				</div>`;
				go.disabled = !entries.length;
			} catch (err) {
				box.innerHTML = `<p class="av-formmsg is-error">${U.esc(this.message(err))}</p>`;
				go.disabled = true;
			}
		});
		go.addEventListener("click", async () => {
			const opt = k => body.querySelector(`[data-opt="${k}"]`)?.checked;
			const list = entries.filter(x => opt("plan") || x.status !== "Planning" || x.match);
			m.close();
			await this.importEntries(ctx, list, { update: opt("update"), create: opt("create") });
		});
	}

	async importEntries(ctx, entries, { update = true, create = true } = {}) {
		const { V, U, C } = ctx;
		const t = V.toast("MyAnimeList: importando…", { sticky: true, icon: "b-mal", progress: 3 });
		let updated = 0, created = 0, failed = 0;
		const olds = update ? entries.filter(x => x.match) : [];
		for (const x of olds) {
			const f = app.vault.getAbstractFileByPath(x.match.path);
			if (!f) continue;
			let changed = false;
			await app.fileManager.processFrontMatter(f, fm => {
				const local = Math.max(0, Number(fm.episodesWatched) || 0);
				const status = C.normalizeStatus(fm.status);
				const total = Number(fm.episodes) || x.episodes || 0;
				const remote = total ? Math.min(x.watched, total) : x.watched;
				if (!fm.malId) { fm.malId = x.malId; changed = true; }
				if (remote > local && status !== "Rewatching") {
					const log = Array.isArray(fm.log) ? fm.log : [];
					log.push({ date: x.finish || x.start || C.today(), from: local + 1, to: remote, source: "myanimelist" });
					fm.log = log; fm.episodesWatched = remote; changed = true;
				}
				const want = x.rewatching ? "Rewatching" : x.status;
				if (want !== status && (remote > local || status === "Planning" || (want === "Completed" && remote >= local))) { fm.status = want; changed = true; }
				if (x.start && !C.iso(fm.startDate)) { fm.startDate = x.start; changed = true; }
				if (x.finish && !C.iso(fm.completionDate) && C.normalizeStatus(fm.status) === "Completed") { fm.completionDate = x.finish; changed = true; }
				if (x.score && !(Number(fm.rating) > 0)) { fm.rating = C.fromScore10(x.score); changed = true; }
				if (x.rewatches > (Number(fm.rewatches) || 0)) { fm.rewatches = x.rewatches; changed = true; }
			});
			if (changed) updated++;
		}
		const news = create ? entries.filter(x => !x.match) : [];
		if (news.length) {
			// metadados do AniList em lotes de 50, pelo id do MAL
			const byMal = new Map();
			try {
				for (let i = 0; i < news.length; i += 50) {
					t.update(`AniList: buscando metadados (${Math.min(news.length, i + 50)}/${news.length})`, { progress: 5 + (i / news.length) * 30 });
					const d = await this.AL.gql(`query ($ids: [Int]) { Page(perPage: 50) { media(idMal_in: $ids, type: ANIME) { ${this.AL.mediaFields} ${this.AL.batchExtra} } } }`, { ids: news.slice(i, i + 50).map(x => Number(x.malId)) });
					for (const m of d.Page?.media || []) if (m.idMal) byMal.set(String(m.idMal), m);
				}
			} catch (err) { console.warn("Anime Vault: AniList indisponível na importação", err); }
			for (let i = 0; i < news.length; i++) {
				const x = news[i];
				t.update(`MyAnimeList: ${x.title} (${i + 1}/${news.length})`, { progress: 35 + ((i + 1) / news.length) * 65 });
				const ov = { status: x.rewatching ? "Rewatching" : x.status, watched: x.watched, rating: C.fromScore10(x.score), startDate: x.start, completionDate: x.status === "Completed" ? x.finish : "", rewatches: x.rewatches };
				try {
					const m = byMal.get(x.malId);
					if (m) await this.AL.createFromMedia(ctx, m, ov);
					else await C.createAnimeNote({ title: x.title, titleRomaji: x.title, format: C.normalizeFormat(x.type), episodes: x.episodes || "", malId: x.malId, status: ov.status, episodesWatched: x.watched, rating: ov.rating, startDate: x.start, completionDate: ov.completionDate, rewatches: x.rewatches });
					created++;
				} catch (err) { failed++; console.warn("Anime Vault: importação MAL", x.title, err); }
			}
		}
		t.update(`MyAnimeList: ${U.plural(created, "anime criado", "animes criados")}, ${U.plural(updated, "nota atualizada", "notas atualizadas")}${failed ? `, ${failed} com falha` : ""}`, { tone: failed ? "warn" : "ok" });
		t.close(6000);
		V.refresh();
	}

	// ================================================= exportar XML do MAL
	// Mesmo formato do export do MyAnimeList: dá para importar no MAL em
	// myanimelist.net/import.php (só entram os animes com malId).
	async exportXml(ctx) {
		const { V, U, C, model } = ctx;
		const list = model.anime.filter(a => a.malId);
		if (!list.length) return V.toast("Nenhum anime com malId para exportar (Atualizar do AniList preenche)", { tone: "warn" });
		const x = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
		const type = a => ({ TV: "TV", TV_SHORT: "TV", MOVIE: "Movie", OVA: "OVA", ONA: "ONA", SPECIAL: "Special", MUSIC: "Music" })[a.format] || "TV";
		const counts = s => list.filter(a => C.malStatusOf(a.status).mal === s).length;
		const xml = [`<?xml version="1.0" encoding="UTF-8" ?>`, "<myanimelist>", "\t<myinfo>", "\t\t<user_export_type>1</user_export_type>",
			`\t\t<user_total_anime>${list.length}</user_total_anime>`, `\t\t<user_total_watching>${counts("Watching")}</user_total_watching>`, `\t\t<user_total_completed>${counts("Completed")}</user_total_completed>`,
			`\t\t<user_total_onhold>${counts("On-Hold")}</user_total_onhold>`, `\t\t<user_total_dropped>${counts("Dropped")}</user_total_dropped>`, `\t\t<user_total_plantowatch>${counts("Plan to Watch")}</user_total_plantowatch>`, "\t</myinfo>",
			...list.map(a => ["\t<anime>", `\t\t<series_animedb_id>${x(a.malId)}</series_animedb_id>`, `\t\t<series_title><![CDATA[${String(a.titleRomaji || a.title).replace(/]]>/g, "")}]]></series_title>`,
				`\t\t<series_type>${type(a)}</series_type>`, `\t\t<series_episodes>${a.episodes || 0}</series_episodes>`, "\t\t<my_id>0</my_id>",
				`\t\t<my_watched_episodes>${a.progress.watched}</my_watched_episodes>`, `\t\t<my_start_date>${a.startDate || "0000-00-00"}</my_start_date>`, `\t\t<my_finish_date>${a.completionDate || "0000-00-00"}</my_finish_date>`,
				"\t\t<my_rated></my_rated>", `\t\t<my_score>${C.score10(a.rating)}</my_score>`, "\t\t<my_storage></my_storage>", "\t\t<my_storage_value>0.00</my_storage_value>",
				`\t\t<my_status>${C.malStatusOf(a.status).mal}</my_status>`, "\t\t<my_comments><![CDATA[]]></my_comments>", `\t\t<my_times_watched>${a.rewatches}</my_times_watched>`,
				"\t\t<my_rewatch_value></my_rewatch_value>", "\t\t<my_priority>LOW</my_priority>", "\t\t<my_tags><![CDATA[]]></my_tags>", `\t\t<my_rewatching>${a.status === "Rewatching" ? 1 : 0}</my_rewatching>`,
				"\t\t<my_rewatching_ep>0</my_rewatching_ep>", "\t\t<my_discuss>1</my_discuss>", "\t\t<my_sns>default</my_sns>", "\t\t<update_on_import>1</update_on_import>", "\t</anime>"].join("\n")),
			"</myanimelist>", ""].join("\n");
		await C.ensureFolder("Exports");
		const path = `Exports/animelist-${C.today()}.xml`;
		const f = app.vault.getAbstractFileByPath(path);
		if (f) await app.vault.modify(f, xml); else await app.vault.create(path, xml);
		V.toast(`${U.plural(list.length, "anime exportado", "animes exportados")} para ${path}`, { tone: "ok", icon: "download" });
	}

	// ======================================================= Integrações
	integrations(ctx) {
		const { U, C, model, AL } = ctx;
		const cfg = AL ? AL.getConfig() : null;
		const n = model.anime.length;
		const alN = model.anime.filter(a => a.anilistId).length, malN = model.anime.filter(a => a.malId).length;
		const malStats = model.anime.filter(a => a.mal.score).length;
		const ten = C.scale() === 10;
		const html = `<div class="av-page av-pad av-integrations">
			${U.pageHead("Integrações", { sub: "Os dados vêm de fora; o seu progresso fica nas suas notas" })}
			<div class="av-intgrid">
				<section class="av-intcard" style="--av-id:var(--av-anilist)">
					<header>${U.icon("b-anilist")}<div><h3>AniList</h3><p>Busca, capas, banners, episódios, personagens, relações, recomendações e o sync da sua lista pública.</p></div><span class="av-intstate${cfg?.user ? " is-on" : ""}">${cfg?.user ? `Conectado · ${U.esc(cfg.user)}` : "Sem conta (só busca)"}</span></header>
					${U.figures([{ label: "Ligados ao AniList", value: `${alN}/${n}` }, { label: "Último sync", value: cfg?.lastSync ? U.relDate(cfg.lastSync.slice(0, 10)) : "—" }])}
					<div class="av-setacts">${cfg?.user ? U.btn("Sincronizar lista", { icon: "refresh", kind: "primary", action: "anilist-sync" }) : U.btn("Conectar perfil", { icon: "link", kind: "primary", action: "anilist-connect" })}${U.btn("Atualizar metadados", { icon: "refresh", kind: "ghost", action: "anilist-refresh-all" })}${U.btn("Baixar artes", { icon: "download", kind: "ghost", action: "anilist-art" })}<a class="av-btn av-btn--ghost" ${U.openAttrs("Dashboard/AniList")}>${U.icon("eye")}<span>Ver perfil</span></a></div>
					<ul class="av-privacy"><li>${U.icon("lock")}<span>Sem senha nem token: só o nome de usuário, neste dispositivo.</span></li></ul>
				</section>
				<section class="av-intcard" style="--av-id:#2e51a2">
					<header>${U.icon("b-mal")}<div><h3>MyAnimeList</h3><p>Nota, ranking, popularidade e membros de cada anime, a ficha do MAL e o Top. Importe e exporte sua lista pelo XML oficial.</p></div><span class="av-intstate is-on">Sem conta</span></header>
					${U.figures([{ label: "Com malId", value: `${malN}/${n}` }, { label: "Com estatísticas do MAL", value: `${malStats}/${malN || 0}` }])}
					<div class="av-setacts">${U.btn("Atualizar do MAL", { icon: "refresh", kind: "primary", action: "mal-refresh-all" })}${U.btn("Importar XML do MAL", { icon: "upload", kind: "ghost", action: "mal-import" })}${U.btn("Exportar XML para o MAL", { icon: "download", kind: "ghost", action: "mal-export" })}</div>
					<ul class="av-privacy"><li>${U.icon("info")}<span>Estatísticas pela Jikan (API pública e não oficial do MAL). O XML exportado vai para <code>Exports/</code> e pode ser importado em myanimelist.net/import.php.</span></li></ul>
				</section>
			</div>
			<section class="av-setcard">
				<header>${U.icon("starFill")}<div><h3>Escala de notas</h3><p>Como as notas aparecem e são dadas em todo o Vault. A nota fica guardada igual (5 estrelas com meia = 10 pontos).</p></div></header>
				<div class="av-segmented" role="radiogroup"><button type="button" data-scale="5" class="${ten ? "" : "is-active"}">★ 5 estrelas (Crunchyroll)</button><button type="button" data-scale="10" class="${ten ? "is-active" : ""}">1–10 (MyAnimeList)</button></div>
			</section>
			<section class="av-setcard">
				<header>${U.icon("play")}<div><h3>Onde assistir</h3><p>O campo <code>link</code> de cada anime (Crunchyroll, Netflix…) aparece no menu ⋮ e na ficha. Ao adicionar pelo AniList, o link da Crunchyroll entra sozinho quando existe.</p></div></header>
			</section>
		</div>`;
		return {
			active: "integrations", html, wire: root => {
				root.querySelectorAll("[data-scale]").forEach(b => b.addEventListener("click", () => {
					ctx.U._store("scale", b.dataset.scale);
					ctx.V.toast(b.dataset.scale === "10" ? "Notas de 1 a 10 (MyAnimeList)" : "Notas em 5 estrelas", { tone: "ok", icon: "starFill" });
					ctx.V.refresh();
				}));
			}
		};
	}
}
