// ==========================================================================
// Anime Vault — Core (dados, schema e fonte única de verdade)
//
// Todo número que aparece na interface (episódios vistos, porcentagem,
// horas, "assistido por último", temporada) sai daqui. Cards, ficha,
// estatísticas e calendário chamam as MESMAS funções — por isso não divergem.
//
// Acesso: customJS.AnimeVaultCore
// ==========================================================================

class AnimeVaultCore {

	constructor() {
		this.VERSION = "1.0.0";

		this.folders = {
			anime: "Animes", lists: "Lists", genres: "Genres", studios: "Studios", franchises: "Franchises",
			dashboard: "Dashboard", covers: "Assets/Covers", banners: "Assets/Banners", cache: ".animevault"
		};

		// status canônicos (os mesmos do AniList, em português na tela)
		this.statusDefs = {
			Watching:   { label: "Assistindo",     tone: "orange", order: 0, icon: "play" },
			Rewatching: { label: "Reassistindo",   tone: "orange", order: 1, icon: "repeat" },
			Paused:     { label: "Pausado",        tone: "amber",  order: 2, icon: "pause" },
			Planning:   { label: "Quero assistir", tone: "muted",  order: 3, icon: "bookmark" },
			Completed:  { label: "Concluído",      tone: "green",  order: 4, icon: "check" },
			Dropped:    { label: "Abandonado",     tone: "red",    order: 5, icon: "x" }
		};
		this.statusAliases = {
			watching: "Watching", current: "Watching", assistindo: "Watching", playing: "Watching",
			rewatching: "Rewatching", repeating: "Rewatching", reassistindo: "Rewatching",
			paused: "Paused", pausado: "Paused", "on hold": "Paused", onhold: "Paused",
			planning: "Planning", "plan to watch": "Planning", plantowatch: "Planning", ptw: "Planning",
			"quero assistir": "Planning", backlog: "Planning", watchlist: "Planning",
			completed: "Completed", concluido: "Completed", "concluído": "Completed", finished: "Completed", visto: "Completed",
			dropped: "Dropped", abandonado: "Dropped"
		};

		this.formatDefs = {
			TV: { label: "Série", short: "TV" }, TV_SHORT: { label: "Série curta", short: "TV curta" },
			MOVIE: { label: "Filme", short: "Filme" }, OVA: { label: "OVA", short: "OVA" }, ONA: { label: "ONA", short: "ONA" },
			SPECIAL: { label: "Especial", short: "Especial" }, MUSIC: { label: "Clipe musical", short: "Clipe" }
		};
		this.formatAliases = { tv: "TV", serie: "TV", "série": "TV", series: "TV", "tv short": "TV_SHORT", tv_short: "TV_SHORT", movie: "MOVIE", filme: "MOVIE", film: "MOVIE", ova: "OVA", ona: "ONA", special: "SPECIAL", especial: "SPECIAL", music: "MUSIC" };

		this.airingDefs = {
			FINISHED: { label: "Finalizado", tone: "muted" }, RELEASING: { label: "Em lançamento", tone: "orange" },
			NOT_YET_RELEASED: { label: "Em breve", tone: "blue" }, HIATUS: { label: "Em hiato", tone: "amber" }, CANCELLED: { label: "Cancelado", tone: "red" }
		};
		this.airingAliases = { finished: "FINISHED", finalizado: "FINISHED", releasing: "RELEASING", airing: "RELEASING", "em lançamento": "RELEASING", "em lancamento": "RELEASING", "not_yet_released": "NOT_YET_RELEASED", "em breve": "NOT_YET_RELEASED", upcoming: "NOT_YET_RELEASED", hiatus: "HIATUS", cancelled: "CANCELLED", canceled: "CANCELLED" };

		this.seasonDefs = {
			WINTER: { label: "Inverno", order: 0, months: [1, 2, 3], icon: "snowflake" },
			SPRING: { label: "Primavera", order: 1, months: [4, 5, 6], icon: "flower" },
			SUMMER: { label: "Verão", order: 2, months: [7, 8, 9], icon: "sun" },
			FALL:   { label: "Outono", order: 3, months: [10, 11, 12], icon: "leaf" }
		};
		this.seasonAliases = { winter: "WINTER", inverno: "WINTER", spring: "SPRING", primavera: "SPRING", summer: "SUMMER", verao: "SUMMER", "verão": "SUMMER", fall: "FALL", autumn: "FALL", outono: "FALL" };

		this.weekdays = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

		// tradução dos gêneros que vêm do AniList (o nome original continua aceito)
		this.genreNames = {
			"Action": "Ação", "Adventure": "Aventura", "Comedy": "Comédia", "Drama": "Drama", "Ecchi": "Ecchi",
			"Fantasy": "Fantasia", "Horror": "Terror", "Mahou Shoujo": "Mahou Shoujo", "Mecha": "Mecha", "Music": "Música",
			"Mystery": "Mistério", "Psychological": "Psicológico", "Romance": "Romance", "Sci-Fi": "Ficção científica",
			"Slice of Life": "Slice of Life", "Sports": "Esportes", "Supernatural": "Sobrenatural", "Thriller": "Suspense", "Hentai": "Hentai"
		};

		// revisão do vault: sobe a cada mudança de metadado. O modelo inteiro é
		// recalculado uma vez por revisão, não uma vez por bloco/card/aba.
		if (typeof window.__avRev !== "number") window.__avRev = 0;
		if (!window.__avRevBound && typeof app !== "undefined" && app?.metadataCache?.on) {
			window.__avRevBound = true;
			const bump = () => { window.__avRev++; };
			app.metadataCache.on("changed", bump);
			app.vault.on("delete", bump);
			app.vault.on("rename", bump);
			app.vault.on("create", bump);
		}
	}

	// ------------------------------------------------------------ primitivos
	str(v) {
		if (v === null || v === undefined) return "";
		if (typeof v === "object" && typeof v.toFormat === "function") return this.iso(v);
		if (typeof v === "object" && v.path) return String(v.path);
		const s = String(v).trim();
		return (s === "undefined" || s === "null" || s === "NaN" || s === "[object Object]") ? "" : s;
	}

	num(v) {
		if (v === null || v === undefined) return null;
		if (typeof v === "string" && v.trim() === "") return null;
		const n = Number(v);
		return Number.isFinite(n) ? n : null;
	}

	arr(v) {
		if (v === null || v === undefined || v === "") return [];
		if (Array.isArray(v)) return v.filter(x => x !== null && x !== undefined && x !== "");
		if (typeof v.array === "function") return v.array();
		return [v];
	}

	strList(v) { return this.arr(v).map(x => this.str(x)).filter(Boolean); }

	bool(v) { return v === true || v === "true"; }

	// qualquer representação de data (string, Luxon do Dataview, Date) → "YYYY-MM-DD"
	iso(v) {
		if (!v) return "";
		if (typeof v === "object" && typeof v.toISODate === "function") return v.toISODate() || "";
		if (v instanceof Date) return isNaN(v) ? "" : this.isoOf(v);
		const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v).trim());
		return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
	}

	isoDateTime(v) {
		if (!v) return "";
		if (typeof v === "object" && typeof v.toISO === "function") return v.toISO() || "";
		const s = String(v).trim();
		return /^\d{4}-\d{2}-\d{2}/.test(s) ? s : "";
	}

	isoOf(d) {
		const p = n => String(n).padStart(2, "0");
		return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
	}

	today() { return this.isoOf(new Date()); }

	addDays(iso, n) { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return this.isoOf(d); }

	maxIso(...dates) { return dates.filter(Boolean).sort().pop() || ""; }

	daysBetween(a, b) {
		if (!a || !b) return null;
		return Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
	}

	normalizeKey(s) {
		return String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
			.replace(/[^a-z0-9]+/g, " ").trim();
	}

	slug(s) { return this.normalizeKey(s).replace(/ /g, "-"); }

	yamlEscape(s) {
		return String(s ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n|\r/g, "\\n").replace(/\t/g, "\\t")
			.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u2028\u2029]/g, "");
	}

	// ================================================== guardas (segurança)
	// Nome de arquivo a partir de texto qualquer (inclusive remoto): sem
	// separadores, caracteres proibidos, ponto no início ou nomes reservados.
	safeFileName(str, fallback = "Sem nome") {
		let s = String(str ?? "").normalize("NFC").replace(/[\\/:*?"<>|#^[\]\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();
		s = s.replace(/^[.\s]+/, "").replace(/[.\s]+$/, "");
		if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(s)) s = `${s}_`;
		s = s.slice(0, 120).trim();
		return s || fallback;
	}

	// URL segura: só http(s) e, se informado, só os hosts permitidos
	safeUrl(url, { hosts = null, protocols = ["https:", "http:"] } = {}) {
		try {
			const s = String(url ?? "").trim();
			if (!s || s.length > 2048) return "";
			const u = new URL(s);
			if (!protocols.includes(u.protocol)) return "";
			if (u.username || u.password) return "";
			if (hosts && !hosts.some(h => u.hostname === h || u.hostname.endsWith(`.${h}`))) return "";
			return u.href;
		} catch (_) { return ""; }
	}

	// texto remoto com tamanho máximo e sem caracteres de controle
	clip(v, max = 300) {
		const s = this.str(v).replace(/[\u0000-\u001F\u007F\u2028\u2029]+/g, " ").replace(/\s{2,}/g, " ").trim();
		return s.length > max ? s.slice(0, max).replace(/\s+\S*$/, "") + "…" : s;
	}

	// descrição do AniList vem com <br>, <i>, entidades: vira texto puro
	plainText(html, max = 1400) {
		const s = String(html ?? "")
			.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "")
			.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ")
			.replace(/\(Source:[^)]*\)/gi, "").replace(/\[Written by[^\]]*\]/gi, "")
			.replace(/\n{3,}/g, "\n\n").trim();
		const flat = s.replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ");
		return flat.length > max ? flat.slice(0, max).replace(/\s+\S*$/, "") + "…" : flat;
	}

	hashHue(s) {
		let h = 0;
		for (const ch of String(s ?? "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
		return h % 360;
	}

	linkPath(v) {
		if (!v) return "";
		if (typeof v === "object" && v.path) return v.path;
		const m = /\[\[([^\]|#]+)/.exec(String(v));
		return m ? m[1].trim() : String(v).trim();
	}

	// ---------------------------------------------------------------- imagens
	// devolve "" quando o arquivo NÃO existe: o card cai no fallback gerado
	resolveImage(val) {
		const v = this.str(val);
		if (!v) return "";
		if (/^(https?:|data:|app:|capacitor:|blob:)/i.test(v)) return v;
		if (typeof app === "undefined") return "";
		const clean = v.replace(/^\.?\//, "").replace(/^\[\[|\]\]$/g, "");
		const file = app.vault.getAbstractFileByPath(clean) || app.metadataCache.getFirstLinkpathDest?.(clean, "");
		return file ? app.vault.getResourcePath(file) : "";
	}

	// ------------------------------------------------------------- semântica
	normalizeStatus(v) {
		const raw = this.str(v);
		if (this.statusDefs[raw]) return raw;
		return this.statusAliases[raw.toLowerCase()] || "Planning";
	}
	statusLabel(k) { return this.statusDefs[k]?.label || k; }

	normalizeFormat(v) {
		const raw = this.str(v);
		if (this.formatDefs[raw]) return raw;
		return this.formatAliases[raw.toLowerCase()] || (raw ? raw.toUpperCase() : "TV");
	}
	formatLabel(k) { return this.formatDefs[k]?.label || k || "Série"; }
	isMovie(a) { return a.format === "MOVIE"; }

	normalizeAiring(v) {
		const raw = this.str(v);
		if (this.airingDefs[raw]) return raw;
		return this.airingAliases[raw.toLowerCase()] || "";
	}
	airingLabel(k) { return this.airingDefs[k]?.label || ""; }

	normalizeSeason(v) {
		const raw = this.str(v);
		if (this.seasonDefs[raw]) return raw;
		return this.seasonAliases[raw.toLowerCase()] || "";
	}
	seasonLabel(season, year) {
		const s = this.seasonDefs[season]?.label || "";
		return [s, year || ""].filter(Boolean).join(" ");
	}
	// temporada de uma data (meses do AniList: jan–mar inverno, abr–jun primavera…)
	seasonOf(iso = this.today()) {
		const m = Number(String(iso).slice(5, 7)) || 1, y = Number(String(iso).slice(0, 4)) || new Date().getFullYear();
		const season = Object.keys(this.seasonDefs).find(k => this.seasonDefs[k].months.includes(m));
		return { season, year: y };
	}
	seasonKey(season, year) { return `${year}-${this.seasonDefs[season]?.order ?? 0}`; }
	shiftSeason(season, year, n) {
		const keys = Object.keys(this.seasonDefs);
		let i = keys.indexOf(season) + n, y = year;
		while (i < 0) { i += 4; y--; }
		while (i > 3) { i -= 4; y++; }
		return { season: keys[i], year: y };
	}

	genreLabel(g) { return this.genreNames[g] || g; }

	normalizeWeekday(v) {
		const k = this.normalizeKey(v).split(" ")[0];
		if (!k) return null;
		const map = { domingo: 0, dom: 0, sunday: 0, sun: 0, segunda: 1, seg: 1, monday: 1, mon: 1, terca: 2, ter: 2, tuesday: 2, tue: 2, quarta: 3, qua: 3, wednesday: 3, wed: 3, quinta: 4, qui: 4, thursday: 4, thu: 4, sexta: 5, sex: 5, friday: 5, fri: 5, sabado: 6, sab: 6, saturday: 6, sat: 6 };
		return map[k] ?? null;
	}

	// ============================================================ o modelo
	model(dv) {
		const rev = window.__avRev || 0;
		const cached = window.__avModelCache;
		if (cached && cached.rev === rev && typeof app !== "undefined") return cached.model;
		const model = this._buildModel(dv);
		window.__avModelCache = { rev, model };
		return model;
	}

	invalidate() { window.__avRev = (window.__avRev || 0) + 1; }

	_buildModel(dv) {
		const all = dv.pages();
		const pages = all.array ? all.array() : all;
		const notTemplate = p => !String(p.file?.path || "").includes("/_Templates/");
		const animePages = pages.filter(p => p.type === "anime" && notTemplate(p));
		const anime = animePages.map(p => this._buildAnime(p));
		const animeByPath = new Map(anime.map(a => [a.path, a]));
		const animeByName = new Map(anime.map(a => [a.name.toLowerCase(), a]));
		const resolveLink = raw => {
			const lp = this.linkPath(raw).replace(/\.md$/, "");
			if (!lp) return null;
			return animeByPath.get(lp + ".md") || animeByPath.get(lp) || animeByName.get(lp.split("/").pop().toLowerCase()) || null;
		};

		const lists = pages.filter(p => p.type === "list" && notTemplate(p)).map(p => {
			const declared = this.arr(p.anime);
			const items = [], missing = [];
			for (const l of declared) {
				const a = resolveLink(l);
				if (a) { if (!items.includes(a)) items.push(a); } else missing.push(this.linkPath(l));
			}
			return {
				path: p.file.path, name: p.file.name, page: p,
				title: this.str(p.title) || p.file.name,
				description: this.str(p.description),
				accent: /^#[0-9a-f]{3,8}$/i.test(this.str(p.accent)) ? this.str(p.accent) : "",
				icon: this.str(p.icon), cover: this.resolveImage(p.cover),
				pinned: this.bool(p.pinned), items, missing,
				updated: this.maxIso(this.iso(p.updated), this._mtime(p))
			};
		});
		const listsByAnime = new Map();
		for (const l of lists) for (const a of l.items) {
			if (!listsByAnime.has(a.path)) listsByAnime.set(a.path, []);
			listsByAnime.get(a.path).push(l);
		}

		const entity = type => pages.filter(p => p.type === type && notTemplate(p)).map(p => ({
			path: p.file.path, name: p.file.name, page: p, kind: type,
			title: this.str(p.title) || p.file.name,
			description: this.str(p.description), cover: this.resolveImage(p.cover),
			accent: /^#[0-9a-f]{3,8}$/i.test(this.str(p.accent)) ? this.str(p.accent) : "",
			icon: this.str(p.icon)
		}));

		const model = {
			anime, animeByPath, lists, listsByAnime,
			genres: entity("genre"), studios: entity("studio"), franchises: entity("franchise"),
			builtAt: Date.now()
		};
		model.stats = this.libraryStats(model);
		return model;
	}

	_mtime(p) {
		try {
			const m = p.file?.mtime;
			const ms = typeof m === "number" ? m : (m?.ts ?? m?.toMillis?.() ?? (m ? Date.parse(m) : 0)) || 0;
			return ms ? this.isoOf(new Date(ms)) : "";
		} catch (_) { return ""; }
	}

	// ============================================================ o anime
	_buildAnime(p) {
		const format = this.normalizeFormat(p.format);
		const status = this.normalizeStatus(p.status);
		const al = (p.anilist && typeof p.anilist === "object") ? p.anilist : {};
		const na = (p.nextAiring && typeof p.nextAiring === "object") ? p.nextAiring : {};
		const a = {
			path: p.file.path, name: p.file.name, page: p,
			title: this.str(p.title) || p.file.name,
			titleRomaji: this.str(p.titleRomaji), titleEnglish: this.str(p.titleEnglish), titleNative: this.str(p.titleNative),
			format, formatLabel: this.formatLabel(format),
			status, statusRaw: this.str(p.status),
			favorite: this.bool(p.favorite),
			rating: this.num(p.rating) || 0,
			tier: this.str(p.tier).toUpperCase(), tierOrder: this.num(p.tierOrder),
			franchise: this.str(p.franchise), franchiseOrder: this.num(p.franchiseOrder),
			genres: this.strList(p.genre), tags: this.strList(p.tags).filter(t => t !== "anime"),
			studios: this.strList(p.studio),
			audio: this.strList(p.audio), streaming: this.strList(p.streaming),
			summary: this.str(p.summary),
			episodes: this.num(p.episodes),
			watched: Math.max(0, this.num(p.episodesWatched) || 0),
			duration: this.num(p.duration) || (format === "MOVIE" ? 100 : 24),
			season: this.normalizeSeason(p.season), seasonYear: this.num(p.seasonYear),
			year: this.num(p.year) || this.num(p.seasonYear) || this.num(String(this.iso(p.airedFrom)).slice(0, 4)),
			airing: this.normalizeAiring(p.airingStatus),
			airedFrom: this.iso(p.airedFrom), airedTo: this.iso(p.airedTo),
			airingDay: this.normalizeWeekday(p.airingDay), airingTime: this.str(p.airingTime),
			nextAiring: { episode: this.num(na.episode), at: this.isoDateTime(na.at) },
			anilistId: this.str(p.anilistId), malId: this.str(p.malId),
			score: this.num(p.averageScore),
			anilist: { lastSync: this.isoDateTime(al.lastSync), status: this.str(al.syncStatus), error: this.str(al.syncError) },
			dateAdded: this.iso(p.dateAdded), startDate: this.iso(p.startDate), completionDate: this.iso(p.completionDate),
			lastWatchedField: this.iso(p.lastWatched),
			rewatches: Math.max(0, this.num(p.rewatches) || 0),
			log: this.arr(p.log).filter(x => x && typeof x === "object").map(x => ({
				date: this.iso(x.date), from: this.num(x.from), to: this.num(x.to), note: this.str(x.note)
			})).filter(x => x.date),
			review: this.str(p.review), pros: this.strList(p.pros), cons: this.strList(p.cons),
			recommend: p.recommend === true || p.recommend === "true" ? true : p.recommend === false || p.recommend === "false" ? false : null,
			notes: this.arr(p.notes).filter(Boolean),
			featuredOnHome: this.bool(p.featuredOnHome),
			link: this.str(p.link)
		};
		a.images = {
			cover: this.resolveImage(p.cover),
			banner: this.resolveImage(p.banner),
			logo: p.showLogo === false || p.showLogo === "false" ? "" : this.resolveImage(p.logo)
		};
		const clamp = (n, lo, hi, d) => { const v = this.num(n); return v === null ? d : Math.min(hi, Math.max(lo, v)); };
		a.framing = { x: clamp(p.bgPosX, 0, 100, 50), y: clamp(p.bgPosY, 0, 100, 30) };
		a.accent = /^#[0-9a-f]{3,8}$/i.test(this.str(p.accent)) ? this.str(p.accent) : "";
		a.hue = this.hashHue(a.title);
		if (!a.season && a.airedFrom) Object.assign(a, (({ season, year }) => ({ season, seasonYear: a.seasonYear || year }))(this.seasonOf(a.airedFrom)));

		a.progress = this.progress(a);
		a.minutes = this.minutesWatched(a);
		a.hours = Math.round((a.minutes / 60) * 10) / 10;
		a.lastWatched = this.maxIso(...a.log.map(x => x.date), a.lastWatchedField);
		a.notStarted = !a.watched && !a.log.length && !a.startDate && a.status === "Planning";
		a.audioLabel = this.audioLabel(a.audio);
		return a;
	}

	// ------------------------------------------------ FONTE ÚNICA: progresso
	progress(a) {
		const total = a.episodes && a.episodes > 0 ? a.episodes : null;
		const watched = total ? Math.min(a.watched, total) : a.watched;
		const done = a.status === "Completed" || (total !== null && watched >= total);
		const pct = total ? Math.floor((watched / total) * 1000) / 10 : done ? 100 : null;
		// último episódio que já saiu (para "novo episódio" em lançamento)
		const aired = a.airing === "RELEASING" && a.nextAiring.episode ? a.nextAiring.episode - 1 : total;
		const next = done && a.status !== "Rewatching" ? null : total !== null && watched >= total ? null : watched + 1;
		return {
			watched, total, pct, pctRound: pct === null ? null : Math.floor(pct), done, next,
			left: total !== null ? Math.max(0, total - watched) : null,
			aired, behind: aired ? Math.max(0, aired - watched) : 0,
			newEpisode: a.airing === "RELEASING" && aired !== null && aired > watched && ["Watching", "Rewatching"].includes(a.status)
		};
	}

	minutesWatched(a) {
		const total = a.episodes || a.watched || (a.format === "MOVIE" ? 1 : 0);
		const eps = a.status === "Rewatching" ? (1 + a.rewatches) * total + a.watched : a.watched + a.rewatches * total;
		return Math.max(0, eps) * (a.duration || 24);
	}

	audioLabel(list) {
		const k = list.map(x => this.normalizeKey(x));
		const sub = k.some(x => /leg|sub/.test(x)), dub = k.some(x => /dub/.test(x));
		return sub && dub ? "Legendado | Dublado" : dub ? "Dublado" : sub ? "Legendado" : "";
	}

	// ============================================================ agregados
	libraryStats(model) {
		const list = model.anime;
		const sum = (l, f) => l.reduce((s, x) => s + (f(x) || 0), 0);
		const byStatus = {};
		for (const k of Object.keys(this.statusDefs)) byStatus[k] = 0;
		for (const a of list) byStatus[a.status] = (byStatus[a.status] || 0) + 1;
		const rated = list.filter(a => a.rating > 0);
		const minutes = sum(list, a => a.minutes);
		return {
			anime: list.length, byStatus,
			episodes: sum(list, a => a.status === "Rewatching" ? a.watched + (1 + a.rewatches) * (a.episodes || 0) : a.watched + a.rewatches * (a.episodes || a.watched)),
			minutes, hours: Math.round((minutes / 60) * 10) / 10, days: Math.round((minutes / 1440) * 10) / 10,
			completed: byStatus.Completed, watching: byStatus.Watching + byStatus.Rewatching,
			favorites: list.filter(a => a.favorite).length,
			movies: list.filter(a => a.format === "MOVIE").length,
			avgRating: rated.length ? Math.round((sum(rated, a => a.rating) / rated.length) * 10) / 10 : null
		};
	}

	groupBy(list, keyFn) {
		const m = new Map();
		for (const a of list) for (const k of [].concat(keyFn(a)).filter(Boolean)) {
			if (!m.has(k)) m.set(k, []);
			m.get(k).push(a);
		}
		return m;
	}

	groupStats(list) {
		const minutes = list.reduce((s, a) => s + a.minutes, 0);
		const rated = list.filter(a => a.rating);
		return {
			count: list.length,
			hours: Math.round((minutes / 60) * 10) / 10,
			episodes: list.reduce((s, a) => s + a.watched, 0),
			completed: list.filter(a => a.status === "Completed").length,
			avgRating: rated.length ? Math.round((rated.reduce((s, a) => s + a.rating, 0) / rated.length) * 10) / 10 : null,
			completionPct: list.length ? Math.round((list.filter(a => a.status === "Completed").length / list.length) * 100) : 0
		};
	}

	// ------------------------------------------------------------ atividade
	// Somente eventos com data real no vault. Nada é inventado.
	activity(model, { limit = 60, anime = null } = {}) {
		const ev = [];
		for (const a of anime ? [anime] : model.anime) {
			if (a.dateAdded) ev.push({ type: "added", date: a.dateAdded, anime: a });
			if (a.startDate) ev.push({ type: "started", date: a.startDate, anime: a });
			if (a.completionDate) ev.push({ type: "completed", date: a.completionDate, anime: a });
			for (const l of a.log) ev.push({ type: "episodes", date: l.date, anime: a, from: l.from, to: l.to, count: this.logCount(l), note: l.note });
		}
		const rank = { completed: 0, episodes: 1, started: 2, added: 3 };
		ev.sort((x, y) => y.date.localeCompare(x.date) || rank[x.type] - rank[y.type]);
		return ev.slice(0, limit);
	}

	logCount(l) {
		if (l.from === null && l.to === null) return 1;
		if (l.from === null || l.to === null) return 1;
		return Math.max(1, l.to - l.from + 1);
	}

	// episódios e minutos por dia (estatísticas, semana, calendário de atividade)
	dailyEpisodes(model) {
		if (model.__avDaily) return model.__avDaily;
		const days = new Map();
		for (const a of model.anime) for (const l of a.log) {
			const n = this.logCount(l);
			const d = days.get(l.date) || { episodes: 0, minutes: 0, anime: new Set() };
			d.episodes += n; d.minutes += n * a.duration; d.anime.add(a);
			days.set(l.date, d);
		}
		model.__avDaily = days;
		return days;
	}

	streak(model) {
		const days = this.dailyEpisodes(model);
		let d = this.today(), n = 0;
		if (!days.has(d)) d = this.addDays(d, -1);
		while (days.has(d)) { n++; d = this.addDays(d, -1); }
		return n;
	}

	// --------------------------------------------------------- seleções
	continueWatching(model, n = 14) {
		const score = a => this.maxIso(a.lastWatched, a.startDate, a.dateAdded);
		return model.anime
			.filter(a => ["Watching", "Rewatching", "Paused"].includes(a.status) && a.progress.next !== null)
			.sort((x, y) => ((y.status !== "Paused") - (x.status !== "Paused")) || (y.progress.newEpisode - x.progress.newEpisode) || score(y).localeCompare(score(x)))
			.slice(0, n);
	}

	featured(model, max = 6) {
		const list = model.anime;
		if (!list.length) return [];
		const recent = (x, y) => y.lastWatched.localeCompare(x.lastWatched) || y.rating - x.rating;
		const pinned = list.filter(a => a.featuredOnHome).sort(recent);
		if (pinned.length) return pinned.slice(0, max);
		const art = a => !!(a.images.banner || a.images.cover);
		const watching = list.filter(a => ["Watching", "Rewatching"].includes(a.status)).sort(recent);
		const favs = list.filter(a => a.favorite && !watching.includes(a) && art(a)).sort((x, y) => y.rating - x.rating);
		const rest = list.filter(a => art(a) && !watching.includes(a) && !favs.includes(a)).sort((x, y) => y.rating - x.rating || recent(x, y));
		const out = [...watching, ...favs, ...rest];
		return (out.length ? out : list).slice(0, Math.min(max, 5));
	}

	// próximos episódios (calendário): nextAiring do AniList ou o dia fixo da nota
	schedule(model, { days = 7 } = {}) {
		const now = Date.now(), until = now + days * 86400000;
		const out = [];
		for (const a of model.anime) {
			if (["Dropped", "Completed"].includes(a.status) && a.airing !== "RELEASING") continue;
			const at = a.nextAiring.at ? Date.parse(a.nextAiring.at) : NaN;
			if (Number.isFinite(at) && at >= now - 86400000 && at <= until) {
				out.push({ anime: a, at: new Date(at), episode: a.nextAiring.episode, source: "anilist" });
			} else if (a.airingDay !== null && (a.airing === "RELEASING" || (!a.airing && a.status === "Watching"))) {
				const d = new Date(); d.setHours(0, 0, 0, 0);
				const delta = (a.airingDay - d.getDay() + 7) % 7;
				d.setDate(d.getDate() + delta);
				const [hh, mm] = (a.airingTime || "").split(":").map(Number);
				if (Number.isFinite(hh)) d.setHours(hh, Number.isFinite(mm) ? mm : 0);
				out.push({ anime: a, at: d, episode: null, source: "manual" });
			}
		}
		return out.sort((x, y) => x.at - y.at);
	}

	// ======================================================== schema da nota
	bootLine(kind) { return `await dv.view("Assets/animevault-boot", { page: "${kind}" });`; }
	noteBody(kind) { return ["```dataviewjs", this.bootLine(kind), "```", ""].join("\n"); }

	animeSchema() {
		return [
			["title", ""], ["type", "anime"], ["titleRomaji", ""], ["titleEnglish", ""], ["titleNative", ""],
			["format", "TV"], ["status", "Planning"], ["favorite", false], ["rating", 0],
			["episodes", ""], ["episodesWatched", 0], ["duration", 24],
			["season", ""], ["seasonYear", ""], ["airingStatus", ""], ["airedFrom", ""], ["airedTo", ""], ["airingDay", ""], ["airingTime", ""],
			["genre", []], ["studio", []], ["tags", ["anime"]], ["audio", []], ["streaming", []],
			["franchise", ""], ["franchiseOrder", ""], ["tier", ""], ["tierOrder", ""],
			["summary", ""], ["cover", ""], ["banner", ""], ["bgPosX", 50], ["bgPosY", 30], ["accent", ""], ["featuredOnHome", false],
			["anilistId", ""], ["malId", ""], ["averageScore", ""], ["link", ""],
			["dateAdded", "__TODAY__"], ["startDate", ""], ["completionDate", ""], ["lastWatched", ""], ["rewatches", 0],
			["log", []], ["review", ""], ["pros", []], ["cons", []], ["notes", []],
			["cssclasses", ["animevault", "av-anime"]]
		];
	}

	_yamlValue(v) {
		if (Array.isArray(v)) return v.length ? `[${v.map(x => typeof x === "number" ? x : `"${this.yamlEscape(x)}"`).join(", ")}]` : "[]";
		if (typeof v === "boolean" || typeof v === "number") return String(v);
		if (v === "" || v === null || v === undefined) return '""';
		return `"${this.yamlEscape(v)}"`;
	}

	buildAnimeNote(values = {}) {
		const lines = ["---"];
		for (const [key, def] of this.animeSchema()) {
			let v = key in values ? values[key] : def;
			if (v === "__TODAY__") v = this.today();
			if (key === "type") { lines.push("type: anime"); continue; }
			if (key === "status") { lines.push(`status: ${this.normalizeStatus(v)}`); continue; }
			if (key === "nextAiring") continue;
			lines.push(`${key}: ${this._yamlValue(v)}`);
		}
		if (values.nextAiring && values.nextAiring.at) {
			lines.push("nextAiring:", `  episode: ${Number(values.nextAiring.episode) || 0}`, `  at: "${this.yamlEscape(values.nextAiring.at)}"`);
		}
		lines.push("---", "", this.noteBody("anime"));
		return lines.join("\n");
	}

	async ensureFolder(path) {
		const parts = path.split("/");
		for (let i = 1; i <= parts.length; i++) {
			const p = parts.slice(0, i).join("/");
			if (p && !app.vault.getAbstractFileByPath(p)) await app.vault.createFolder(p).catch(() => {});
		}
	}

	async createAnimeNote(values) {
		await this.ensureFolder(this.folders.anime);
		const base = this.safeFileName(values.title, "Novo anime");
		let path = `${this.folders.anime}/${base}.md`, n = 2;
		while (app.vault.getAbstractFileByPath(path)) path = `${this.folders.anime}/${base} ${n++}.md`;
		const file = await app.vault.create(path, this.buildAnimeNote(values));
		this.invalidate();
		return file;
	}

	categoryFolder(kind) { return { genre: this.folders.genres, studio: this.folders.studios, franchise: this.folders.franchises }[kind] || this.folders.genres; }

	buildCategoryNote(kind, title) {
		return ["---", `title: "${this.yamlEscape(title)}"`, `type: ${kind}`, 'description: ""', 'accent: ""', 'icon: ""', 'cover: ""',
			"cssclasses:", '  - "animevault"', `  - "av-${kind}"`, "---", "", this.noteBody(kind)].join("\n");
	}

	// devolve a página da categoria (cria se não existir). Nunca duplica.
	async ensureCategoryNote(kind, title) {
		const key = this.normalizeKey(title);
		const found = app.vault.getMarkdownFiles().find(f => {
			const fm = app.metadataCache.getFileCache(f)?.frontmatter;
			return fm?.type === kind && this.normalizeKey(fm.title || f.basename) === key;
		});
		if (found) return found;
		const folder = this.categoryFolder(kind);
		await this.ensureFolder(folder);
		const safe = this.safeFileName(title, "Sem nome");
		let path = `${folder}/${safe}.md`, n = 2;
		while (app.vault.getAbstractFileByPath(path)) path = `${folder}/${safe} ${n++}.md`;
		return await app.vault.create(path, this.buildCategoryNote(kind, title));
	}

	buildListNote(title, { description = "", icon = "", accent = "" } = {}) {
		return ["---", `title: "${this.yamlEscape(title)}"`, "type: list", `description: "${this.yamlEscape(description)}"`,
			`icon: "${this.yamlEscape(icon)}"`, `accent: "${this.yamlEscape(accent)}"`, 'cover: ""', "pinned: false", "anime: []", `updated: ${this.today()}`,
			"cssclasses:", '  - "animevault"', '  - "av-list"', "---", "", this.noteBody("list")].join("\n");
	}

	async createListNote(title, opts) {
		await this.ensureFolder(this.folders.lists);
		const safe = this.safeFileName(title, "Nova lista");
		let path = `${this.folders.lists}/${safe}.md`, n = 2;
		while (app.vault.getAbstractFileByPath(path)) path = `${this.folders.lists}/${safe} ${n++}.md`;
		return await app.vault.create(path, this.buildListNote(title, opts));
	}

	// ====================================================== escrita: progresso
	// Marca até o episódio `target`. Avançar grava uma linha no diário
	// (data, de, até), juntando com a de hoje quando é a continuação dela.
	// Voltar apara o diário. Status e datas acompanham sozinhos.
	async setProgress(file, target, { note = "", date = "" } = {}) {
		const today = date || this.today();
		let result = null;
		await app.fileManager.processFrontMatter(file, fm => {
			const total = this.num(fm.episodes);
			const old = Math.max(0, this.num(fm.episodesWatched) || 0);
			let t = Math.max(0, Math.round(Number(target) || 0));
			if (total) t = Math.min(t, total);
			const status = this.normalizeStatus(fm.status);
			const log = Array.isArray(fm.log) ? fm.log.filter(x => x && typeof x === "object") : [];
			if (t > old) {
				const last = log[log.length - 1];
				if (last && this.iso(last.date) === today && Number(last.to) === old && !note && !this.str(last.note)) last.to = t;
				else log.push(note ? { date: today, from: old + 1, to: t, note } : { date: today, from: old + 1, to: t });
				fm.lastWatched = today;
				if (!this.iso(fm.startDate)) fm.startDate = today;
				if (["Planning", "Paused", "Dropped"].includes(status)) fm.status = "Watching";
			} else if (t < old) {
				for (let i = log.length - 1; i >= 0; i--) {
					const l = log[i];
					if (Number(l.from) > t) log.splice(i, 1);
					else if (Number(l.to) > t) l.to = t;
				}
			}
			fm.log = log;
			fm.episodesWatched = t;
			let completed = false;
			if (total && t >= total && t > old) {
				if (status === "Rewatching") fm.rewatches = (this.num(fm.rewatches) || 0) + 1;
				fm.status = "Completed";
				if (!this.iso(fm.completionDate) || status === "Rewatching") fm.completionDate = today;
				completed = true;
			} else if (total && t < total && this.normalizeStatus(fm.status) === "Completed" && t < old) {
				fm.status = "Watching";
			}
			result = { old, now: t, total, completed };
		});
		this.invalidate();
		return result;
	}

	async setStatus(file, status) {
		const today = this.today();
		await app.fileManager.processFrontMatter(file, fm => {
			const old = this.normalizeStatus(fm.status);
			fm.status = status;
			if (status === "Watching" && !this.iso(fm.startDate)) fm.startDate = today;
			if (status === "Completed") {
				if (!this.iso(fm.completionDate)) fm.completionDate = today;
				const total = this.num(fm.episodes);
				const w = this.num(fm.episodesWatched) || 0;
				if (total && w < total) {
					const log = Array.isArray(fm.log) ? fm.log : [];
					log.push({ date: today, from: w + 1, to: total });
					fm.log = log;
					fm.episodesWatched = total;
					fm.lastWatched = today;
				}
			}
			if (status === "Rewatching" && old !== "Rewatching") fm.episodesWatched = 0;
		});
		this.invalidate();
	}

	// ============================================================ diagnóstico
	audit(model) {
		const issues = [];
		const add = (level, area, message, path = "") => issues.push({ level, area, message, path });
		for (const a of model.anime) {
			const p = a.page;
			if (p.cover && !a.images.cover) add("warn", "Imagens", `Capa não encontrada: ${p.cover}`, a.path);
			if (p.banner && !a.images.banner) add("warn", "Imagens", `Banner não encontrado: ${p.banner}`, a.path);
			if (!a.images.cover && !p.cover) add("info", "Imagens", "Sem capa (use Atualizar do AniList ou Editar)", a.path);
			if (a.episodes && a.watched > a.episodes) add("warn", "Progresso", `episodesWatched (${a.watched}) maior que episodes (${a.episodes})`, a.path);
			if (a.status === "Completed" && !a.completionDate) add("info", "Datas", "Concluído sem data de conclusão", a.path);
			if (a.statusRaw && !this.statusDefs[a.statusRaw] && !this.statusAliases[a.statusRaw.toLowerCase()]) add("warn", "Status", `Status desconhecido: ${a.statusRaw}`, a.path);
			if (a.anilist.status && a.anilist.status !== "ok") add("warn", "AniList", `Última atualização falhou: ${a.anilist.error || a.anilist.status}`, a.path);
		}
		for (const l of model.lists) for (const m of l.missing) add("error", "Listas", `Link para anime inexistente em “${l.title}”: ${m}`, l.path);
		return issues;
	}
}
