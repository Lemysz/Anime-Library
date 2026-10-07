// ==========================================================================
// Anime Vault — AniList (API GraphQL pública)
//
// O que faz:
//   · busca animes para adicionar (capa, banner, episódios, estúdio…)
//   · atualiza os metadados das notas ligadas pelo anilistId (em lotes de 50)
//   · lê o perfil PÚBLICO de um usuário (só o nome; sem senha, login ou
//     token) e traz o progresso para as notas, sem nunca apagar nada
//   · "Em alta nesta temporada" na tela Temporadas
//
// Rede: requestUrl do Obsidian, só para graphql.anilist.co (dados) e para
// as CDNs de imagem. Uma requisição por vez, intervalo mínimo entre elas,
// pausa automática se o AniList limitar (HTTP 429).
// Cache (perfil, episódios, temporadas): .animevault/ — fora das notas.
//
// Acesso: customJS.AnimeVaultAniList
// ==========================================================================

class AnimeVaultAniList {

	constructor() {
		this.endpoint = "https://graphql.anilist.co";
		this.minIntervalMs = 800;
		this.timeoutMs = 20000;
		this.cacheDir = ".animevault";
		if (!window.__avAlQueue) window.__avAlQueue = { chain: Promise.resolve(), last: 0 };
		this.statusMap = { CURRENT: "Watching", PLANNING: "Planning", COMPLETED: "Completed", DROPPED: "Dropped", PAUSED: "Paused", REPEATING: "Rewatching" };
	}

	get C() { return customJS.AnimeVaultCore; }
	get U() { return customJS.AnimeVaultUI; }

	// ======================================================== configuração
	// Fica no armazenamento local do Obsidian (por dispositivo). Não há
	// segredo nenhum: só o nome público do usuário e preferências.
	_store(key, value) {
		const k = `animevault:anilist:${key}`;
		try {
			if (value === undefined) return typeof app?.loadLocalStorage === "function" ? app.loadLocalStorage(k) : localStorage.getItem(k);
			if (typeof app?.saveLocalStorage === "function") app.saveLocalStorage(k, value); else localStorage.setItem(k, value);
		} catch (_) { return null; }
	}

	getConfig() {
		let c = {};
		try { c = JSON.parse(this._store("config") || "{}") || {}; } catch (_) { c = {}; }
		return { user: c.user || "", userId: c.userId || null, avatar: c.avatar || "", banner: c.banner || "", lastSync: c.lastSync || "", autoSync: c.autoSync !== false, titleLang: c.titleLang || "english", syncStatus: c.syncStatus || "" };
	}

	async saveConfig(patch) {
		const c = { ...this.getConfig(), ...patch };
		this._store("config", JSON.stringify(c));
		return c;
	}

	async disconnect() {
		this._store("config", JSON.stringify({ autoSync: true }));
		try { if (await app.vault.adapter.exists(`${this.cacheDir}/profile.json`)) await app.vault.adapter.remove(`${this.cacheDir}/profile.json`); } catch (_) {}
	}

	message(err) {
		const code = err?.code || "";
		return ({
			network: "Sem conexão com o AniList agora",
			rate_limited: "O AniList pediu uma pausa (limite de consultas). Tente de novo em um minuto",
			not_found: "Não encontrado no AniList",
			private: "Esse perfil ou lista é privado no AniList",
			bad_response: "O AniList respondeu algo inesperado",
			no_request: "requestUrl do Obsidian indisponível"
		})[code] || String(err?.message || err || "Erro desconhecido");
	}

	_err(code, msg = "") { const e = new Error(msg || code); e.code = code; return e; }

	// ================================================================ rede
	_sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

	_requestFn() {
		const fn = globalThis?.customJS?.obsidian?.requestUrl || globalThis?.requestUrl || globalThis?.app?.requestUrl;
		if (typeof fn !== "function") throw this._err("no_request");
		return fn;
	}

	_enqueue(task) {
		const q = window.__avAlQueue;
		const run = async () => {
			const wait = q.last + this.minIntervalMs - Date.now();
			if (wait > 0) await this._sleep(wait);
			try { return await task(); } finally { q.last = Date.now(); }
		};
		const p = q.chain.then(run, run);
		q.chain = p.catch(() => {});
		return p;
	}

	async gql(query, variables = {}, { retries = 1 } = {}) {
		const pause = Number(this._store("pauseUntil") || 0);
		if (pause > Date.now()) throw this._err("rate_limited");
		const request = this._requestFn();
		for (let attempt = 0; ; attempt++) {
			let res;
			try {
				res = await this._enqueue(() => Promise.race([
					request({ url: this.endpoint, method: "POST", contentType: "application/json", headers: { Accept: "application/json" }, body: JSON.stringify({ query, variables }), throw: false }),
					new Promise((_, rej) => setTimeout(() => rej(this._err("network", "timeout")), this.timeoutMs))
				]));
			} catch (err) {
				if (attempt < retries) { await this._sleep(1500); continue; }
				throw err.code ? err : this._err("network", err.message);
			}
			if (res.status === 429) {
				const ra = Number(res.headers?.["retry-after"] || res.headers?.["Retry-After"] || 60);
				if (attempt < retries && ra <= 65) { await this._sleep((ra + 1) * 1000); continue; }
				this._store("pauseUntil", String(Date.now() + Math.min(ra, 300) * 1000));
				throw this._err("rate_limited");
			}
			let json = null;
			try { json = res.json ?? JSON.parse(res.text); } catch (_) { json = null; }
			if (!json || typeof json !== "object") {
				if (res.status >= 500 && attempt < retries) { await this._sleep(2000); continue; }
				throw this._err(res.status >= 500 ? "network" : "bad_response", `HTTP ${res.status}`);
			}
			if (json.errors?.length) {
				const msg = String(json.errors[0]?.message || "");
				if (/private/i.test(msg)) throw this._err("private", msg);
				if (/not found/i.test(msg) || json.errors[0]?.status === 404) throw this._err("not_found", msg);
				if (!json.data) throw this._err("bad_response", msg);
			}
			return json.data || {};
		}
	}

	// imagem das CDNs do AniList → bytes (nunca outro host)
	async _download(url) {
		const safe = this.C.safeUrl(url, { hosts: ["anilist.co"], protocols: ["https:"] });
		if (!safe) return null;
		const request = this._requestFn();
		const res = await Promise.race([
			request({ url: safe, method: "GET", throw: false }),
			new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), this.timeoutMs))
		]).catch(() => null);
		const type = String(res?.headers?.["content-type"] || res?.headers?.["Content-Type"] || "");
		if (!res || res.status !== 200 || !res.arrayBuffer || res.arrayBuffer.byteLength < 1500 || (type && !/^image\//i.test(type))) return null;
		const ext = /png/i.test(type) || /\.png(\?|$)/i.test(safe) ? "png" : /webp/i.test(type) ? "webp" : /gif/i.test(type) ? "gif" : "jpg";
		return { buf: res.arrayBuffer, ext };
	}

	async _saveImage(url, folder, base) {
		const img = await this._download(url);
		if (!img) return "";
		const C = this.C;
		await C.ensureFolder(folder);
		const safe = C.safeFileName(base, "anime");
		const path = `${folder}/${safe}.${img.ext}`;
		const existing = app.vault.getAbstractFileByPath(path);
		if (existing) await app.vault.modifyBinary(existing, img.buf);
		else await app.vault.createBinary(path, img.buf);
		return path;
	}

	// ================================================================ cache
	async readCache(name) {
		try {
			const path = `${this.cacheDir}/${name}.json`;
			if (!(await app.vault.adapter.exists(path))) return null;
			return JSON.parse(await app.vault.adapter.read(path));
		} catch (_) { return null; }
	}

	async writeCache(name, data) {
		try {
			if (!(await app.vault.adapter.exists(this.cacheDir))) await app.vault.adapter.mkdir(this.cacheDir);
			await app.vault.adapter.write(`${this.cacheDir}/${name}.json`, JSON.stringify(data));
		} catch (err) { console.warn("Anime Vault: cache não gravado", name, err); }
	}

	// títulos e miniaturas dos episódios (vêm de streamingEpisodes)
	async _episodeCache() {
		if (!window.__avEpCache) window.__avEpCache = this.readCache("episodes").then(x => x || {});
		return window.__avEpCache;
	}

	async episodeInfo(a) {
		if (!a?.anilistId) return null;
		const cache = await this._episodeCache();
		return cache[a.anilistId] || null;
	}

	async _storeEpisodes(list) {
		const cache = await this._episodeCache();
		let changed = false;
		for (const m of list) {
			const eps = this._episodes(m);
			if (eps.length) { cache[m.id] = eps; changed = true; }
		}
		if (changed) await this.writeCache("episodes", cache);
	}

	_episodes(m) {
		const out = new Map();
		for (const e of m.streamingEpisodes || []) {
			const t = this.C.clip(e.title, 160);
			const mm = /episode\s*(\d+)\s*[-–:]\s*(.*)$/i.exec(t) || /^(?:ep\.?|e)\s*(\d+)\s*[-–:]?\s*(.*)$/i.exec(t);
			if (!mm) continue;
			const n = Number(mm[1]);
			if (!n || out.has(n)) continue;
			out.set(n, { n, title: mm[2] || "", thumb: this.C.safeUrl(e.thumbnail, { protocols: ["https:"] }) });
		}
		return [...out.values()].sort((x, y) => x.n - y.n);
	}

	// ============================================================ consultas
	get mediaFields() {
		return `id idMal title { romaji english native } format status episodes duration season seasonYear
			startDate { year month day } endDate { year month day } genres synonyms isAdult
			tags { name rank isMediaSpoiler } studios(isMain: true) { nodes { name } }
			description(asHtml: false) averageScore popularity
			coverImage { extraLarge large color } bannerImage nextAiringEpisode { episode airingAt }
			streamingEpisodes { title thumbnail site }
			externalLinks { site url type }
			relations { edges { relationType node { id type } } }`;
	}

	async search(q) {
		const d = await this.gql(`query ($q: String) { Page(perPage: 14) { media(search: $q, type: ANIME, sort: SEARCH_MATCH, isAdult: false) {
			id title { romaji english native } format episodes seasonYear startDate { year } coverImage { large } genres studios(isMain: true) { nodes { name } } } } }`, { q });
		const cfg = this.getConfig();
		return (d.Page?.media || []).map(m => ({
			id: m.id, title: this._title(m, cfg), titleNative: this.C.clip(m.title?.native, 120), format: m.format, episodes: m.episodes,
			year: m.seasonYear || m.startDate?.year || null, cover: this.C.safeUrl(m.coverImage?.large, { hosts: ["anilist.co"] }),
			genres: (m.genres || []).slice(0, 6), studio: this.C.clip(m.studios?.nodes?.[0]?.name, 80)
		}));
	}

	async media(id) {
		const d = await this.gql(`query ($id: Int) { Media(id: $id, type: ANIME) { ${this.mediaFields} } }`, { id: Number(id) });
		if (!d.Media) throw this._err("not_found");
		return d.Media;
	}

	async mediaMany(ids) {
		const out = [];
		const list = [...new Set(ids.map(Number).filter(Boolean))];
		for (let i = 0; i < list.length; i += 50) {
			const d = await this.gql(`query ($ids: [Int]) { Page(perPage: 50) { media(id_in: $ids, type: ANIME) { ${this.mediaFields} } } }`, { ids: list.slice(i, i + 50) });
			out.push(...(d.Page?.media || []));
		}
		return out;
	}

	_title(m, cfg = this.getConfig()) {
		const t = m.title || {};
		const pick = cfg.titleLang === "romaji" ? (t.romaji || t.english) : cfg.titleLang === "native" ? (t.native || t.romaji) : (t.english || t.romaji);
		return this.C.clip(pick || t.native || `Anime ${m.id}`, 140);
	}

	_date(d) {
		if (!d?.year) return "";
		return `${d.year}-${String(d.month || 1).padStart(2, "0")}-${String(d.day || 1).padStart(2, "0")}`;
	}

	// mídia do AniList → valores do schema da nota (metadados; nada de progresso)
	toValues(m) {
		const C = this.C;
		const cfg = this.getConfig();
		const streaming = (m.externalLinks || []).filter(l => l.type === "STREAMING" && l.site).map(l => C.clip(l.site, 40));
		const preferred = (m.externalLinks || []).filter(l => l.type === "STREAMING").sort((x, y) => (/crunchyroll/i.test(y.site) ? 1 : 0) - (/crunchyroll/i.test(x.site) ? 1 : 0))[0];
		const na = m.nextAiringEpisode;
		return {
			title: this._title(m, cfg),
			titleRomaji: C.clip(m.title?.romaji, 160), titleEnglish: C.clip(m.title?.english, 160), titleNative: C.clip(m.title?.native, 160),
			format: m.format || "TV", episodes: Number(m.episodes) || "", duration: Number(m.duration) || (m.format === "MOVIE" ? 100 : 24),
			season: m.season || "", seasonYear: Number(m.seasonYear) || "",
			airingStatus: m.status || "", airedFrom: this._date(m.startDate), airedTo: this._date(m.endDate),
			genre: (m.genres || []).map(g => C.genreLabel(g)).slice(0, 8),
			studio: (m.studios?.nodes || []).map(s => C.clip(s.name, 80)).filter(Boolean).slice(0, 3),
			tags: ["anime", ...(m.tags || []).filter(t => !t.isMediaSpoiler && t.rank >= 70).slice(0, 5).map(t => C.clip(t.name, 40))],
			streaming: [...new Set(streaming)].slice(0, 6),
			link: preferred ? C.safeUrl(preferred.url) : "",
			summary: C.plainText(m.description, 1400),
			averageScore: Number(m.averageScore) || "",
			anilistId: String(m.id), malId: m.idMal ? String(m.idMal) : "",
			nextAiring: na?.airingAt ? { episode: na.episode, at: new Date(na.airingAt * 1000).toISOString() } : null
		};
	}

	// franquia: herda a de um prequel/sequel que já esteja no vault
	_franchiseFor(ctx, m) {
		const rel = (m.relations?.edges || []).filter(e => ["PREQUEL", "SEQUEL", "PARENT", "SIDE_STORY", "SPIN_OFF", "ALTERNATIVE"].includes(e.relationType) && e.node?.type === "ANIME").map(e => String(e.node.id));
		if (!rel.length) return "";
		const model = this.C.model(ctx.dv);
		const hit = model.anime.find(a => rel.includes(String(a.anilistId)) && a.franchise);
		return hit?.franchise || "";
	}

	async _art(m, title, { cover = true, banner = true } = {}) {
		const C = this.C;
		const out = {};
		if (cover && m.coverImage) {
			const url = m.coverImage.extraLarge || m.coverImage.large;
			out.cover = (await this._saveImage(url, C.folders.covers, title).catch(() => "")) || C.safeUrl(url, { hosts: ["anilist.co"] });
		}
		if (banner && m.bannerImage) out.banner = (await this._saveImage(m.bannerImage, C.folders.banners, `${title}-banner`).catch(() => "")) || C.safeUrl(m.bannerImage, { hosts: ["anilist.co"] });
		return out;
	}

	async createFromId(ctx, id, overrides = {}) {
		const m = await this.media(id);
		return this.createFromMedia(ctx, m, overrides);
	}

	async createFromMedia(ctx, m, { status = "Planning", watched = null, rating = 0, startDate = "", completionDate = "", rewatches = 0 } = {}) {
		const C = this.C;
		const v = this.toValues(m);
		const art = await this._art(m, v.title);
		const eps = Number(m.episodes) || 0;
		const w = watched !== null ? watched : status === "Completed" ? (eps || (m.format === "MOVIE" ? 1 : 0)) : 0;
		const file = await C.createAnimeNote({
			...v, ...art, status, franchise: this._franchiseFor(ctx, m),
			episodesWatched: eps ? Math.min(w, eps) : w, rating, startDate, completionDate, rewatches
		});
		await app.fileManager.processFrontMatter(file, fm => { fm.anilist = { lastSync: new Date().toISOString(), syncStatus: "ok" }; });
		this._storeEpisodes([m]).catch(() => {});
		return file;
	}

	// ============================================ atualizar metadados (lote)
	// Só metadados. Título, status, progresso, nota e análise são seus e
	// nunca mudam aqui. Campos de organização só são preenchidos se vazios.
	async refreshMany(ctx, paths = null, { onlyAiring = false, el = null } = {}) {
		const { V, U, C } = ctx;
		const model = C.model(ctx.dv);
		let list = paths ? paths.map(p => model.animeByPath.get(p)).filter(Boolean) : model.anime.filter(a => a.anilistId);
		if (onlyAiring) list = list.filter(a => a.anilistId && (["RELEASING", "NOT_YET_RELEASED", "HIATUS"].includes(a.airing) || (!a.airing && a.status === "Watching")));
		// um anime sem ID, pedido sozinho: tenta ligar pelo título
		if (paths?.length === 1 && list[0] && !list[0].anilistId) {
			const a = list[0];
			const t = V.toast(`Procurando ${a.title} no AniList…`, { sticky: true, icon: "b-anilist" });
			try {
				const found = (await this.search(a.titleRomaji || a.title))[0];
				if (!found) { t.update("Não encontrei no AniList. Informe o ID em Editar detalhes.", { tone: "warn" }); t.close(4500); return; }
				await app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(a.path), fm => { fm.anilistId = String(found.id); });
				a.anilistId = String(found.id);
				t.update(`Ligado a “${found.title}”`, { tone: "ok" }); t.close(2000);
			} catch (err) { t.update(this.message(err), { tone: "error" }); t.close(5000); return; }
		}
		list = list.filter(a => a.anilistId);
		if (!list.length) return V.toast(onlyAiring ? "Nenhum anime em lançamento ligado ao AniList" : "Nenhum anime ligado ao AniList (falta o anilistId)", { tone: "warn" });
		if (el) el.disabled = true;
		const t = V.toast(`AniList: atualizando ${U.plural(list.length, "anime", "animes")}…`, { sticky: true, icon: "refresh", progress: 5 });
		let done = 0, failed = 0, art = 0;
		try {
			const media = await this.mediaMany(list.map(a => a.anilistId));
			const byId = new Map(media.map(m => [String(m.id), m]));
			for (let i = 0; i < list.length; i++) {
				const a = list[i];
				const m = byId.get(String(a.anilistId));
				const f = app.vault.getAbstractFileByPath(a.path);
				t.update(`AniList: ${a.title} (${i + 1}/${list.length})`, { progress: ((i + 1) / list.length) * 100 });
				if (!m || !f) {
					failed++;
					if (f) await app.fileManager.processFrontMatter(f, fm => { fm.anilist = { ...(fm.anilist || {}), lastAttempt: new Date().toISOString(), syncStatus: "not_found", syncError: "ID não encontrado no AniList" }; });
					continue;
				}
				const v = this.toValues(m);
				const need = { cover: !a.images.cover || /^https?:/.test(a.page.cover || ""), banner: !a.images.banner || /^https?:/.test(a.page.banner || "") };
				const imgs = need.cover || need.banner ? await this._art(m, a.title, need) : {};
				if (imgs.cover || imgs.banner) art++;
				await app.fileManager.processFrontMatter(f, fm => {
					const empty = k => fm[k] === undefined || fm[k] === null || fm[k] === "" || (Array.isArray(fm[k]) && !fm[k].length);
					for (const k of ["titleRomaji", "titleEnglish", "titleNative", "format", "duration", "season", "seasonYear", "airingStatus", "airedFrom", "airedTo", "averageScore", "malId"]) if (v[k] !== "" && v[k] !== undefined) fm[k] = v[k];
					if (v.episodes) fm.episodes = v.episodes;
					if (v.nextAiring) fm.nextAiring = v.nextAiring; else delete fm.nextAiring;
					for (const k of ["genre", "studio", "streaming", "summary", "link"]) if (empty(k) && v[k] && (!Array.isArray(v[k]) || v[k].length)) fm[k] = v[k];
					if (!Array.isArray(fm.tags) || fm.tags.filter(x => x !== "anime").length === 0) fm.tags = v.tags;
					if (imgs.cover) fm.cover = imgs.cover;
					if (imgs.banner) fm.banner = imgs.banner;
					if (empty("franchise")) { const fr = this._franchiseFor(ctx, m); if (fr) fm.franchise = fr; }
					fm.anilist = { lastSync: new Date().toISOString(), syncStatus: "ok" };
				});
				done++;
			}
			await this._storeEpisodes(media);
			t.update(`AniList: ${U.plural(done, "anime atualizado", "animes atualizados")}${art ? `, artes em ${art}` : ""}${failed ? `, ${failed} não encontrados` : ""}`, { tone: failed ? "warn" : "ok" });
		} catch (err) {
			t.update(`AniList: ${this.message(err)}`, { tone: err.code === "rate_limited" ? "warn" : "error" });
		}
		t.close(4500);
		if (el) el.disabled = false;
		V.refresh();
	}

	async downloadArt(ctx, paths = null, el = null) {
		const { V, C } = ctx;
		const model = C.model(ctx.dv);
		const list = (paths ? paths.map(p => model.animeByPath.get(p)).filter(Boolean) : model.anime.filter(a => !a.images.cover || !a.images.banner || /^https?:/.test(a.page.cover || "") || /^https?:/.test(a.page.banner || "")))
			.filter(a => a.anilistId);
		if (!list.length) return V.toast(paths ? "Ligue este anime ao AniList primeiro (anilistId)" : "Todos os animes ligados ao AniList já têm capa e banner", { tone: "ok", icon: "image" });
		if (el) el.disabled = true;
		const t = V.toast("Baixando capas e banners…", { sticky: true, icon: "download", progress: 5 });
		let saved = 0;
		try {
			const media = await this.mediaMany(list.map(a => a.anilistId));
			const byId = new Map(media.map(m => [String(m.id), m]));
			for (let i = 0; i < list.length; i++) {
				const a = list[i], m = byId.get(String(a.anilistId));
				t.update(`Artes: ${a.title} (${i + 1}/${list.length})`, { progress: ((i + 1) / list.length) * 100 });
				if (!m) continue;
				const imgs = await this._art(m, a.title, paths ? {} : { cover: !a.images.cover || /^https?:/.test(a.page.cover || ""), banner: !a.images.banner || /^https?:/.test(a.page.banner || "") });
				if (!imgs.cover && !imgs.banner) continue;
				await app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(a.path), fm => { if (imgs.cover) fm.cover = imgs.cover; if (imgs.banner) fm.banner = imgs.banner; });
				saved++;
			}
			t.update(saved ? `Artes salvas em ${this.U.plural(saved, "anime", "animes")}` : "O AniList não tem artes novas para estes animes", { tone: saved ? "ok" : "warn" });
		} catch (err) { t.update(this.message(err), { tone: "error" }); }
		t.close(4000);
		if (el) el.disabled = false;
		V.refresh();
	}

	// ================================================= perfil público (sync)
	openConnect(ctx) {
		const { U, V } = ctx;
		const cfg = this.getConfig();
		const body = `<div class="av-form">
			<p class="av-modal-text">Informe seu nome de usuário do AniList. O Vault lê a sua lista <b>pública</b> e traz progresso, status, notas e datas para as notas dos animes. Nada é enviado ao AniList.</p>
			<label class="av-formfield"><span class="av-label">Usuário do AniList</span><input class="av-input av-input--lg" data-al-user value="${U.attr(cfg.user)}" placeholder="seu-usuario (de anilist.co/user/…)" autocomplete="off" autocapitalize="off" spellcheck="false" autofocus></label>
			<label class="av-formfield"><span class="av-label">Títulos dos animes novos</span><select class="av-select" data-al-lang><option value="english"${cfg.titleLang === "english" ? " selected" : ""}>Inglês (ex.: Attack on Titan)</option><option value="romaji"${cfg.titleLang === "romaji" ? " selected" : ""}>Romaji (ex.: Shingeki no Kyojin)</option><option value="native"${cfg.titleLang === "native" ? " selected" : ""}>Japonês (進撃の巨人)</option></select></label>
			<label class="av-switch"><input type="checkbox" data-al-auto${cfg.autoSync ? " checked" : ""}><span></span><span class="av-switch-text"><b>Sincronizar ao abrir</b><small>No máximo uma vez a cada 6 horas</small></span></label>
			<p class="av-formmsg" data-msg></p>
			<ul class="av-privacy">
				<li>${U.icon("lock")}<span>Sem senha, login ou token. Só o nome, guardado neste dispositivo.</span></li>
				<li>${U.icon("eye")}<span>Só o que o perfil mostra publicamente (a lista precisa ser pública).</span></li>
				<li>${U.icon("refresh")}<span>O sync nunca apaga nem diminui o progresso das notas.</span></li>
			</ul>
		</div>`;
		const m = V.modal({ title: "Conectar AniList", size: "md", body, actions: `${cfg.user ? U.btn("Desconectar", { kind: "ghost", attrs: "data-disc" }) : ""}${U.btn("Cancelar", { kind: "ghost", attrs: "data-close" })}${U.btn("Verificar e salvar", { kind: "primary", attrs: "data-save" })}` });
		const msg = m.el.querySelector("[data-msg]");
		m.el.querySelector("[data-disc]")?.addEventListener("click", async () => { m.close(); await this.disconnect(); V.toast("AniList desconectado", { tone: "ok" }); V.refresh(); });
		const go = async () => {
			const name = m.el.querySelector("[data-al-user]").value.trim().replace(/^https?:\/\/anilist\.co\/user\//i, "").replace(/\/.*$/, "");
			if (!/^[A-Za-z0-9_-]{2,32}$/.test(name)) { msg.className = "av-formmsg is-error"; msg.textContent = "Nome de usuário inválido"; return; }
			msg.className = "av-formmsg"; msg.textContent = "Consultando o AniList…";
			try {
				const d = await this.gql(`query ($name: String) { User(name: $name) { id name avatar { large } bannerImage } }`, { name });
				if (!d.User) throw this._err("not_found");
				await this.saveConfig({ user: d.User.name, userId: d.User.id, avatar: this.C.safeUrl(d.User.avatar?.large, { hosts: ["anilist.co"] }), banner: this.C.safeUrl(d.User.bannerImage, { hosts: ["anilist.co"] }), autoSync: m.el.querySelector("[data-al-auto]").checked, titleLang: m.el.querySelector("[data-al-lang]").value });
				m.close();
				V.toast(`Conectado a ${d.User.name}`, { tone: "ok", icon: "b-anilist" });
				this.syncProfile(ctx);
			} catch (err) { msg.className = "av-formmsg is-error"; msg.textContent = err.code === "not_found" ? "Usuário não encontrado no AniList" : this.message(err); }
		};
		m.el.querySelector("[data-save]").addEventListener("click", go);
		m.el.querySelector("[data-al-user]").addEventListener("keydown", e => { if (e.key === "Enter") go(); });
	}

	async fetchProfile(name) {
		const d = await this.gql(`query ($name: String) {
			User(name: $name) { id name avatar { large } bannerImage statistics { anime { count episodesWatched minutesWatched meanScore } } }
			MediaListCollection(userName: $name, type: ANIME) { lists { entries {
				status progress score(format: POINT_100) repeat updatedAt
				startedAt { year month day } completedAt { year month day }
				media { id title { romaji english native } format episodes coverImage { large } seasonYear status }
			} } } }`, { name });
		if (!d.User) throw this._err("not_found");
		const entries = [];
		const seen = new Set();
		for (const l of d.MediaListCollection?.lists || []) for (const e of l.entries || []) {
			if (!e.media?.id || seen.has(e.media.id)) continue;
			seen.add(e.media.id);
			entries.push({
				id: String(e.media.id), status: this.statusMap[e.status] || "Planning", progress: Number(e.progress) || 0,
				score: Math.round(((Number(e.score) || 0) / 20) * 2) / 2, repeat: Number(e.repeat) || 0,
				updated: e.updatedAt ? this.C.isoOf(new Date(e.updatedAt * 1000)) : "",
				started: this._date(e.startedAt), completed: this._date(e.completedAt),
				title: this._title(e.media), format: e.media.format, episodes: e.media.episodes || null, year: e.media.seasonYear || null,
				cover: this.C.safeUrl(e.media.coverImage?.large, { hosts: ["anilist.co"] }), airing: e.media.status || ""
			});
		}
		const s = d.User.statistics?.anime || {};
		return {
			user: { id: d.User.id, name: d.User.name, avatar: this.C.safeUrl(d.User.avatar?.large, { hosts: ["anilist.co"] }), banner: this.C.safeUrl(d.User.bannerImage, { hosts: ["anilist.co"] }) },
			stats: { count: s.count || 0, episodes: s.episodesWatched || 0, minutes: s.minutesWatched || 0, meanScore: s.meanScore || 0 },
			entries, at: new Date().toISOString()
		};
	}

	// AniList → notas, sem nunca diminuir ou apagar:
	//   progresso: vale o maior (a diferença entra no diário, com a data
	//   da última atualização no AniList e source: anilist)
	//   status: segue o AniList quando o progresso de lá andou ou quando a
	//   nota ainda está em "Quero assistir"; datas e nota só se vazias
	async syncProfile(ctx, { silent = false } = {}) {
		const { V, U, C } = ctx;
		const cfg = this.getConfig();
		if (!cfg.user) return this.openConnect(ctx);
		if (window.__avAlSync) return V.toast("Já existe uma sincronização do AniList em andamento", { tone: "warn" });
		window.__avAlSync = true;
		const t = silent ? null : V.toast(`Lendo a lista pública de ${cfg.user}…`, { sticky: true, icon: "b-anilist", progress: 5 });
		let updated = 0, linked = 0;
		try {
			const prof = await this.fetchProfile(cfg.user);
			await this.writeCache("profile", prof);
			await this.saveConfig({ avatar: prof.user.avatar, banner: prof.user.banner, userId: prof.user.id, user: prof.user.name, lastSync: prof.at, syncStatus: "ok" });
			const model = C.model(ctx.dv);
			const byId = new Map(model.anime.filter(a => a.anilistId).map(a => [String(a.anilistId), a]));
			// liga pelo título os animes sem ID
			const unlinked = model.anime.filter(a => !a.anilistId);
			if (unlinked.length) {
				const key = s => C.normalizeKey(s);
				for (const e of prof.entries) {
					if (byId.has(e.id)) continue;
					const a = unlinked.find(x => [x.title, x.titleRomaji, x.titleEnglish].filter(Boolean).some(n => key(n) === key(e.title)));
					if (!a) continue;
					await app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(a.path), fm => { fm.anilistId = e.id; });
					byId.set(e.id, a); linked++;
				}
			}
			const hits = prof.entries.filter(e => byId.has(e.id));
			for (let i = 0; i < hits.length; i++) {
				const e = hits[i], a = byId.get(e.id);
				t?.update(`AniList: ${a.title} (${i + 1}/${hits.length})`, { progress: ((i + 1) / hits.length) * 100 });
				const f = app.vault.getAbstractFileByPath(a.path);
				if (!f) continue;
				let changed = false;
				await app.fileManager.processFrontMatter(f, fm => {
					const local = Math.max(0, Number(fm.episodesWatched) || 0);
					const total = Number(fm.episodes) || e.episodes || 0;
					const status = C.normalizeStatus(fm.status);
					const remote = total ? Math.min(e.progress, total) : e.progress;
					const sameRun = !(status === "Rewatching" && e.status !== "Rewatching");
					const ahead = sameRun && remote > local;
					if (ahead) {
						const log = Array.isArray(fm.log) ? fm.log : [];
						log.push({ date: e.updated || C.today(), from: local + 1, to: remote, source: "anilist" });
						fm.log = log;
						fm.episodesWatched = remote;
						if (!C.iso(fm.lastWatched) || (e.updated && e.updated > C.iso(fm.lastWatched))) fm.lastWatched = e.updated || C.today();
						changed = true;
					}
					if (e.status !== status && (ahead || status === "Planning" || (e.status === "Completed" && status !== "Completed" && remote >= local))) { fm.status = e.status; changed = true; }
					if (e.started && !C.iso(fm.startDate)) { fm.startDate = e.started; changed = true; }
					if (e.completed && !C.iso(fm.completionDate) && C.normalizeStatus(fm.status) === "Completed") { fm.completionDate = e.completed; changed = true; }
					if (e.score && !(Number(fm.rating) > 0)) { fm.rating = e.score; changed = true; }
					if (e.repeat > (Number(fm.rewatches) || 0)) { fm.rewatches = e.repeat; changed = true; }
					if (changed) fm.anilist = { ...(typeof fm.anilist === "object" && fm.anilist ? fm.anilist : {}), lastSync: new Date().toISOString(), syncStatus: "ok" };
				});
				if (changed) updated++;
			}
			const missing = prof.entries.filter(e => !byId.has(e.id));
			t?.update(`AniList: ${U.plural(hits.length, "anime ligado", "animes ligados")}${updated ? `, ${U.plural(updated, "nota atualizada", "notas atualizadas")}` : ""}${linked ? `, ${linked} ligados pelo título` : ""}${missing.length ? ` · ${missing.length} fora do vault` : ""}`, { tone: "ok" });
		} catch (err) {
			await this.saveConfig({ syncStatus: err.code || "error" });
			t?.update(`AniList: ${this.message(err)}`, { tone: err.code === "rate_limited" ? "warn" : "error" });
		} finally { window.__avAlSync = false; }
		t?.close(5000);
		V.refresh();
	}

	maybeAutoSync(ctx) {
		const cfg = this.getConfig();
		if (!cfg.user || !cfg.autoSync || window.__avAlAutoDone) return;
		window.__avAlAutoDone = true;
		const last = cfg.lastSync ? Date.parse(cfg.lastSync) : 0;
		if (Date.now() - last < 6 * 3600 * 1000) return;
		setTimeout(() => this.syncProfile(ctx, { silent: true }).catch(() => {}), 3500);
	}

	async importEntries(ctx, ids = null, el = null) {
		const { V, U } = ctx;
		const prof = await this.readCache("profile");
		if (!prof) return V.toast("Sincronize o AniList primeiro", { tone: "warn" });
		const model = this.C.model(ctx.dv);
		const have = new Set(model.anime.map(a => String(a.anilistId)).filter(Boolean));
		const list = prof.entries.filter(e => !have.has(e.id) && (ids ? ids.includes(e.id) : e.status !== "Planning"));
		if (!list.length) return V.toast("Nada para adicionar", { tone: "warn" });
		if (list.length > 1) {
			const ok = await V.confirm({ title: `Adicionar ${list.length} animes?`, text: "Cada um vira uma nota com capa, banner e metadados do AniList, já com o seu progresso, status, nota e datas. Pode levar alguns minutos (o AniList é consultado com calma).", confirm: "Adicionar" });
			if (!ok) return;
		}
		if (el) el.disabled = true;
		const t = V.toast("AniList: criando notas…", { sticky: true, icon: "b-anilist", progress: 3 });
		let done = 0, failed = 0, last = null;
		try {
			const media = await this.mediaMany(list.map(e => e.id));
			const byId = new Map(media.map(m => [String(m.id), m]));
			for (let i = 0; i < list.length; i++) {
				const e = list[i], m = byId.get(e.id);
				t.update(`AniList: ${e.title} (${i + 1}/${list.length})`, { progress: ((i + 1) / list.length) * 100 });
				if (!m) { failed++; continue; }
				try {
					last = await this.createFromMedia(ctx, m, { status: e.status, watched: e.progress, rating: e.score, startDate: e.started, completionDate: e.completed, rewatches: e.repeat });
					done++;
				} catch (err) { failed++; console.warn("Anime Vault: importação", e.title, err); }
			}
			t.update(`AniList: ${U.plural(done, "anime adicionado", "animes adicionados")}${failed ? `, ${failed} com falha` : ""}`, { tone: failed ? "warn" : "ok" });
		} catch (err) { t.update(this.message(err), { tone: "error" }); }
		t.close(5000);
		if (el) el.disabled = false;
		if (list.length === 1 && last) setTimeout(() => V.open(last.path, ctx), 300);
		else V.refresh();
	}

	// ======================================================= tela AniList
	async page(ctx) {
		const { U, C, model } = ctx;
		const cfg = this.getConfig();
		if (!cfg.user) {
			return { active: "anilist", html: `<div class="av-page av-pad">
				<section class="av-welcome">
					<span class="av-welcome-mark is-al">${U.icon("b-anilist")}</span>
					<h1>Conecte seu AniList</h1>
					<p>Traga sua lista pública: progresso, status, notas e datas entram nas notas dos animes. Os que ainda não estão no vault aparecem aqui para adicionar com capa e banner.</p>
					<div class="av-welcome-actions">${U.btn("Conectar perfil", { icon: "link", kind: "primary", size: "lg", action: "anilist-connect" })}</div>
					<ul class="av-privacy av-privacy--center"><li>${U.icon("lock")}<span>Sem senha, login ou token</span></li><li>${U.icon("eye")}<span>Só a lista pública</span></li><li>${U.icon("refresh")}<span>Nunca apaga nem diminui progresso</span></li></ul>
				</section>
				${this._unlinkedBlock(ctx)}
			</div>` };
		}
		const prof = await this.readCache("profile");
		const have = new Set(model.anime.map(a => String(a.anilistId)).filter(Boolean));
		const missing = (prof?.entries || []).filter(e => !have.has(e.id));
		const order = ["Watching", "Rewatching", "Paused", "Completed", "Planning", "Dropped"];
		missing.sort((x, y) => order.indexOf(x.status) - order.indexOf(y.status) || x.title.localeCompare(y.title));
		const linked = (prof?.entries || []).filter(e => have.has(e.id)).length;
		const s = prof?.stats;
		const card = e => `<div class="av-card av-card--remote" style="--av-hue:${C.hashHue(e.title)}">
			<div class="av-card-art"><div class="av-cover">${`<div class="av-cover-fallback" style="--av-hue:${C.hashHue(e.title)}"><span class="av-cover-fallback-title">${U.esc(e.title)}</span></div>`}${e.cover ? `<img src="${U.attr(e.cover)}" alt="" loading="lazy" data-av-img>` : ""}</div>${e.episodes && e.progress ? `<div class="av-card-bar"><span style="width:${Math.min(100, (e.progress / e.episodes) * 100)}%"></span></div>` : ""}</div>
			<div class="av-card-body"><h4 class="av-card-title">${U.esc(e.title)}</h4><p class="av-card-meta">${U.esc(C.statusLabel(e.status))}${e.progress ? ` · ${e.progress}${e.episodes ? `/${e.episodes}` : ""} ep.` : ""}${e.score ? ` · ★ ${U.fmtNum(e.score, 1)}` : ""}</p></div>
			<button type="button" class="av-card-add" data-action="anilist-import" data-id="${U.attr(e.id)}">${U.icon("plus")}<span>Adicionar</span></button>
		</div>`;
		const html = `<div class="av-page">
			<section class="av-ehero av-ehero--al" style="--av-id:#3db4f2">
				${cfg.banner ? `<img class="av-ehero-art" src="${U.attr(cfg.banner)}" alt="" data-av-img>` : ""}
				<div class="av-ehero-shade"></div>
				<div class="av-ehero-inner av-ehero-inner--profile">
					<span class="av-alavatar">${cfg.avatar ? `<img src="${U.attr(cfg.avatar)}" alt="" data-av-img>` : U.icon("user")}</span>
					<div>
						<span class="av-ehero-kicker">${U.icon("b-anilist")}AniList</span>
						<h1>${U.esc(cfg.user)}</h1>
						<p>${cfg.lastSync ? `Sincronizado ${U.esc(U.relDate(cfg.lastSync.slice(0, 10)))}` : "Ainda não sincronizado"}${cfg.syncStatus && cfg.syncStatus !== "ok" ? ` · último sync falhou (${U.esc(this.message({ code: cfg.syncStatus }))})` : ""}</p>
						${s ? `<ul class="av-ehero-stats"><li><b>${U.fmtNum(s.count)}</b><span>animes</span></li><li><b>${U.fmtNum(s.episodes)}</b><span>episódios</span></li><li><b>${U.fmtNum(s.minutes / 1440, 1)}</b><span>dias</span></li>${s.meanScore ? `<li><b>${U.fmtNum(s.meanScore, 1)}</b><span>nota média</span></li>` : ""}</ul>` : ""}
						<div class="av-ehero-actions">${U.btn("Sincronizar", { icon: "refresh", kind: "primary", action: "anilist-sync" })}<a class="av-btn av-btn--ghost" href="https://anilist.co/user/${U.attr(encodeURIComponent(cfg.user))}">${U.icon("external")}<span>Perfil</span></a>${U.btn("", { icon: "gear", kind: "ghost", action: "anilist-connect", title: "Configurar" })}</div>
					</div>
				</div>
			</section>
			<div class="av-pad">
				${prof ? U.figures([
					{ label: "Na sua lista do AniList", value: U.fmtNum(prof.entries.length) },
					{ label: "Ligados ao vault", value: U.fmtNum(linked) },
					{ label: "Fora do vault", value: U.fmtNum(missing.length) }
				]) : U.empty({ icon: "refresh", title: "Sincronize para ver sua lista", compact: true, action: U.btn("Sincronizar", { icon: "refresh", kind: "primary", action: "anilist-sync" }) })}
				${missing.length ? `<section class="av-block">${U.sectionHead("No seu AniList, fora do vault", { count: missing.length, sub: "Adicione com capa, banner e o seu progresso", action: missing.some(e => e.status !== "Planning") ? U.btn("Adicionar todos (menos “Quero assistir”)", { icon: "plus", kind: "outline", size: "sm", action: "anilist-import-all" }) : "" })}
					<div class="av-grid">${missing.slice(0, 120).map(card).join("")}</div>
					${missing.length > 120 ? `<p class="av-fineprint">Mostrando 120 de ${missing.length}. Os demais entram no “Adicionar todos”.</p>` : ""}</section>` : ""}
				${this._unlinkedBlock(ctx)}
			</div>
		</div>`;
		return { active: "anilist", html };
	}

	_unlinkedBlock(ctx) {
		const { U, C, model } = ctx;
		const list = model.anime.filter(a => !a.anilistId);
		if (!list.length) return "";
		return `<section class="av-block">${U.sectionHead("No vault, sem AniList", { count: list.length, sub: "Sem anilistId, ficam de fora das atualizações. Abra o menu ⋮ da ficha e use “Ligar ao AniList”." })}
			<div class="av-chiplinks">${list.map(a => `<a class="av-chiplink" ${U.openAttrs(a.path)}>${U.icon("link")}${U.esc(a.title)}</a>`).join("")}</div></section>`;
	}

	// ======================================= em alta na temporada (Temporadas)
	async seasonShelf(ctx, slot, season, year) {
		const { U, C, V } = ctx;
		const key = `season-${year}-${season}`;
		const mem = (window.__avSeasonMem ||= {});
		let data = mem[key];
		if (!data) {
			const cached = await this.readCache(key);
			if (cached && Date.now() - Date.parse(cached.at) < 12 * 3600 * 1000) data = cached;
		}
		if (!data) {
			slot.innerHTML = `<p class="av-add-hint is-busy">${U.icon("refresh")}Carregando o que está em alta no AniList…</p>`;
			try {
				const d = await this.gql(`query ($s: MediaSeason, $y: Int) { Page(perPage: 30) { media(season: $s, seasonYear: $y, type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
					id title { romaji english native } format episodes averageScore genres coverImage { large } status } } }`, { s: season, y: Number(year) });
				data = { at: new Date().toISOString(), list: (d.Page?.media || []).map(m => ({ id: String(m.id), title: this._title(m), format: m.format, episodes: m.episodes, score: m.averageScore, genres: (m.genres || []).slice(0, 3), cover: C.safeUrl(m.coverImage?.large, { hosts: ["anilist.co"] }), airing: m.status })) };
				await this.writeCache(key, data);
			} catch (err) {
				slot.innerHTML = "";
				return;
			}
		}
		mem[key] = data;
		if (!slot.isConnected) return;
		const have = new Set(C.model(ctx.dv).anime.map(a => String(a.anilistId)));
		const list = data.list.filter(x => !have.has(x.id));
		if (!list.length) { slot.innerHTML = ""; return; }
		slot.innerHTML = U.shelf("Em alta nesta temporada no AniList", list.map(x => `<div class="av-card av-card--remote" style="--av-hue:${C.hashHue(x.title)}">
			<div class="av-card-art"><div class="av-cover"><div class="av-cover-fallback" style="--av-hue:${C.hashHue(x.title)}"><span class="av-cover-fallback-title">${U.esc(x.title)}</span></div>${x.cover ? `<img src="${U.attr(x.cover)}" alt="" loading="lazy" data-av-img>` : ""}</div>${x.score ? `<span class="av-card-badge">${x.score}%</span>` : ""}</div>
			<div class="av-card-body"><h4 class="av-card-title">${U.esc(x.title)}</h4><p class="av-card-meta">${U.esc([C.formatLabel(x.format), x.genres.map(g => C.genreLabel(g)).join(", ")].filter(Boolean).join(" · "))}</p></div>
			<button type="button" class="av-card-add" data-season-add="${U.attr(x.id)}">${U.icon("plus")}<span>Quero assistir</span></button>
		</div>`), { sub: "Toque para adicionar à sua lista (com capa e banner)" });
		V._wireImages(slot);
		V._wireShelves(slot);
		slot.addEventListener("click", async e => {
			const b = e.target.closest("[data-season-add]");
			if (!b) return;
			b.disabled = true; b.querySelector("span").textContent = "Adicionando…";
			try {
				const f = await this.createFromId(ctx, b.dataset.seasonAdd, { status: "Planning" });
				b.querySelector("span").textContent = "Na sua lista";
				b.classList.add("is-done");
				V.toast(`${f.basename} na sua lista`, { tone: "ok", icon: "bookmark" });
			} catch (err) { b.disabled = false; b.querySelector("span").textContent = "Quero assistir"; V.toast(this.message(err), { tone: "error" }); }
		});
	}
}
