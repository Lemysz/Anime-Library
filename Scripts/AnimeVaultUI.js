// ==========================================================================
// Anime Vault — UI (componentes do design system)
// Funções puras que devolvem HTML. Nenhuma delas lê o vault: recebem os
// objetos já normalizados pelo AnimeVaultCore.
//
// Acesso: customJS.AnimeVaultUI
// ==========================================================================

class AnimeVaultUI {

	constructor() {
		// barra superior (computador)
		this.nav = [
			{ id: "home", label: "Início", icon: "home", path: "Dashboard/Home" },
			{ id: "library", label: "Minha biblioteca", short: "Biblioteca", icon: "bookmark", path: "Dashboard/Biblioteca" },
			{ id: "browse", label: "Navegar", icon: "grid", menu: ["genres", "studios", "franchises", "seasons", "ranking"] },
			{ id: "seasons", label: "Temporada", icon: "tv", path: "Dashboard/Temporadas" },
			{ id: "calendar", label: "Calendário", icon: "calendar", path: "Dashboard/Calendário" },
			{ id: "lists", label: "Listas", icon: "layers", path: "Dashboard/Listas" }
		];
		// todas as telas (menu "Mais", menu Navegar, menu da conta)
		this.pages = {
			home: { label: "Início", icon: "home", path: "Dashboard/Home" },
			library: { label: "Minha biblioteca", icon: "bookmark", path: "Dashboard/Biblioteca" },
			lists: { label: "Listas", icon: "layers", path: "Dashboard/Listas" },
			history: { label: "Histórico", icon: "history", path: "Dashboard/Histórico" },
			profile: { label: "Perfil", icon: "user", path: "Dashboard/Perfil" },
			ranking: { label: "Ranking", icon: "trophy", path: "Dashboard/Ranking" },
			integrations: { label: "Integrações", icon: "link", path: "Dashboard/Integrações" },
			genres: { label: "Gêneros", icon: "masks", path: "Dashboard/Gêneros" },
			studios: { label: "Estúdios", icon: "building", path: "Dashboard/Estúdios" },
			franchises: { label: "Franquias", icon: "film", path: "Dashboard/Franquias" },
			seasons: { label: "Temporadas", icon: "tv", path: "Dashboard/Temporadas" },
			calendar: { label: "Calendário", icon: "calendar", path: "Dashboard/Calendário" },
			statistics: { label: "Estatísticas", icon: "chart", path: "Dashboard/Estatísticas" },
			tierlist: { label: "Tier List", icon: "rows", path: "Dashboard/Tier List" },
			anilist: { label: "AniList", icon: "b-anilist", path: "Dashboard/AniList" },
			settings: { label: "Configurações", icon: "gear", path: "Dashboard/Configurações" }
		};
		this.drawerGroups = [
			["Anime Vault", ["home", "library", "lists", "history"]],
			["Navegar", ["genres", "studios", "franchises", "seasons", "ranking", "calendar"]],
			["Você", ["profile", "statistics", "tierlist", "integrations", "anilist", "settings"]]
		];
		this.mobileNav = ["home", "library", "genres", "calendar"];
		this.months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
	}

	// ---------------------------------------------------------- utilidades
	esc(v) {
		if (v === null || v === undefined) return "";
		const s = String(v);
		if (s === "undefined" || s === "null" || s === "NaN") return "";
		return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
	}
	attr(v) { return this.esc(v); }

	fmtNum(n, digits = 0) {
		if (n === null || n === undefined || !Number.isFinite(Number(n))) return "—";
		const f = (this.__nf ||= {})[digits] ||= new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
		return f.format(Number(n));
	}

	// minutos → "45 min", "3 h 20", "12,5 h"
	fmtMinutes(min) {
		const m = Math.round(Number(min) || 0);
		if (m <= 0) return "0 min";
		if (m < 60) return `${m} min`;
		const h = m / 60;
		if (h < 10) { const hh = Math.floor(h), mm = m - hh * 60; return mm ? `${hh} h ${String(mm).padStart(2, "0")}` : `${hh} h`; }
		return `${this.fmtNum(h, h < 100 ? 1 : 0)} h`;
	}
	fmtHours(h) { return this.fmtMinutes((Number(h) || 0) * 60); }
	fmtPct(p) { return p === null || p === undefined ? "—" : `${this.fmtNum(p, p % 1 ? 1 : 0)}%`; }

	fmtDate(iso, { year = true } = {}) {
		const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
		if (!m) return "";
		const s = `${Number(m[3])} ${this.months[Number(m[2]) - 1]}`;
		return year ? `${s} ${m[1]}` : s;
	}

	relDate(iso) {
		if (!iso) return "";
		const d = Math.round((new Date(new Date().toDateString()) - new Date(iso + "T00:00:00")) / 86400000);
		if (d < 0) return d === -1 ? "amanhã" : `em ${-d} dias`;
		if (d === 0) return "hoje";
		if (d === 1) return "ontem";
		if (d < 7) return `há ${d} dias`;
		if (d < 30) return `há ${Math.round(d / 7)} sem.`;
		if (d < 365) { const m = Math.max(1, Math.round(d / 30)); return `há ${m} ${m === 1 ? "mês" : "meses"}`; }
		return this.fmtDate(iso);
	}

	plural(n, one, many) { return `${this.fmtNum(n)} ${Number(n) === 1 ? one : many}`; }

	// ------------------------------------------------------------- ícones
	// traço 1.75, 24×24, currentColor — um só vocabulário visual
	get paths() {
		if (this._paths) return this._paths;
		this._paths = {
			home: `<path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z"/>`,
			grid: `<rect x="4" y="4" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1"/>`,
			list: `<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r=".9" fill="currentColor"/><circle cx="4.5" cy="12" r=".9" fill="currentColor"/><circle cx="4.5" cy="18" r=".9" fill="currentColor"/>`,
			rows: `<path d="M4 5h3v4H4zM4 10.5h3v4H4zM4 16h3v4H4z"/><path d="M10 7h10M10 12.5h7M10 18h4"/>`,
			layers: `<path d="M12 3.5 20.5 8 12 12.5 3.5 8z"/><path d="m3.5 12 8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5"/>`,
			masks: `<path d="M4 5.5c3 1 6 1 9 0v5a4.5 4.5 0 0 1-9 0z"/><path d="M13 9.5c2.3.8 4.7.8 7 0v4a4.5 4.5 0 0 1-8.2 2.6"/>`,
			building: `<path d="M4 20.5V6l8-3v17.5M12 9h7a1 1 0 0 1 1 1v10.5M2.5 20.5h19"/><path d="M7 8h2M7 11.5h2M7 15h2M15 13h2M15 16.5h2"/>`,
			film: `<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 7.5h4M3 12h18M3 16.5h4M17 7.5h4M17 16.5h4"/>`,
			tv: `<rect x="2.5" y="6.5" width="19" height="13" rx="2"/><path d="m8 2.5 4 4 4-4"/>`,
			calendar: `<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>`,
			clock: `<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>`,
			history: `<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5"/><path d="M3.5 4v4.5H8M12 7.5V12l3 2"/>`,
			star: `<path d="m12 3.3 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.6l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>`,
			starFill: `<path fill="currentColor" stroke="none" d="m12 3.3 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.6l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>`,
			heart: `<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>`,
			bookmark: `<path d="M6.5 3.5h11v17L12 16.5l-5.5 4z"/>`,
			bookmarkFill: `<path fill="currentColor" d="M6.5 3.5h11v17L12 16.5l-5.5 4z"/>`,
			play: `<path fill="currentColor" stroke="none" d="M7.5 4.6c0-.8.9-1.3 1.6-.9l11 6.9c.6.4.6 1.4 0 1.8l-11 6.9c-.7.4-1.6-.1-1.6-.9z"/>`,
			playLine: `<path d="M7.5 4.8v14.4L19 12z"/>`,
			pause: `<path d="M8 5v14M16 5v14"/>`,
			plus: `<path d="M12 5v14M5 12h14"/>`,
			minus: `<path d="M5 12h14"/>`,
			check: `<path d="m5 12.5 4.5 4.5L19 7"/>`,
			x: `<path d="M6 6l12 12M18 6 6 18"/>`,
			more: `<circle cx="5.5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="18.5" cy="12" r="1.2" fill="currentColor"/>`,
			moreV: `<circle cx="12" cy="5.5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="18.5" r="1.2" fill="currentColor"/>`,
			edit: `<path d="m16.5 3.5 4 4L8 20H4v-4z"/>`,
			image: `<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="9.5" r="1.6"/><path d="m20.5 15.5-5-5L5 19.5"/>`,
			download: `<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M4.5 19.5h15"/>`,
			upload: `<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M4.5 19.5h15"/>`,
			refresh: `<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 3.5V8h4.5M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 20.5V16h-4.5"/>`,
			repeat: `<path d="m17 3.5 3 3-3 3"/><path d="M4 11V9.5a3 3 0 0 1 3-3h13M7 20.5l-3-3 3-3"/><path d="M20 13v1.5a3 3 0 0 1-3 3H4"/>`,
			link: `<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>`,
			external: `<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>`,
			chevronLeft: `<path d="m14.5 5.5-6.5 6.5 6.5 6.5"/>`,
			chevronRight: `<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>`,
			chevronDown: `<path d="m6 9.5 6 6 6-6"/>`,
			chevronUp: `<path d="m6 14.5 6-6 6 6"/>`,
			menu: `<path d="M4 7h16M4 12h16M4 17h16"/>`,
			search: `<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/>`,
			user: `<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c.8-4 3.8-6 7.5-6s6.7 2 7.5 6"/>`,
			gear: `<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3"/>`,
			chart: `<path d="M4 20.5h16"/><rect x="5.5" y="12" width="3" height="6" rx=".5"/><rect x="10.5" y="7" width="3" height="11" rx=".5"/><rect x="15.5" y="10" width="3" height="8" rx=".5"/>`,
			info: `<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8h.01"/>`,
			alert: `<path d="M12 4 21 19.5H3z"/><path d="M12 10v4.5M12 17.2h.01"/>`,
			sort: `<path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5"/>`,
			filter: `<path d="M4 5.5h16l-6 7.5v5l-4 1.5v-6.5z"/>`,
			eye: `<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>`,
			trash: `<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>`,
			share: `<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1"/>`,
			sparkles: `<path d="m10 3.5 1.6 4.4L16 9.5l-4.4 1.6L10 15.5l-1.6-4.4L4 9.5l4.4-1.6z"/><path d="m17.5 14 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>`,
			flame: `<path d="M12 21c3.6 0 6-2.5 6-5.8 0-3.6-2.6-5.4-3.6-8.7-.6 1.6-1.4 2.6-2.6 3.3.1-2.5-.7-4.6-2.3-6.3-.3 3.9-3.5 6-3.5 10.9C6 18.5 8.4 21 12 21z"/>`,
			bell: `<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5l1.5-1.5zM10 20.5h4"/>`,
			dice: `<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="8.5" cy="8.5" r=".9" fill="currentColor"/><circle cx="15.5" cy="15.5" r=".9" fill="currentColor"/><circle cx="12" cy="12" r=".9" fill="currentColor"/><circle cx="15.5" cy="8.5" r=".9" fill="currentColor"/><circle cx="8.5" cy="15.5" r=".9" fill="currentColor"/>`,
			target: `<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.8" fill="currentColor"/>`,
			trophy: `<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M9.5 17h5"/>`,
			tag: `<path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3-8.7 8.7z"/><circle cx="8" cy="8" r="1.4"/>`,
			pin: `<path d="M9 4h6l-1 5 3 3v1.5H7V12l3-3-1-5zM12 13.5V20"/>`,
			notebook: `<rect x="5" y="3.5" width="14" height="17" rx="1.5"/><path d="M9 3.5v17M12 8h4M12 11.5h4"/>`,
			lock: `<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>`,
			cloud: `<path d="M7 18.5a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 8.4a4 4 0 0 1-.5 10.1z"/>`,
			cloudOff: `<path d="M7 18.5a4.5 4.5 0 0 1-.6-9M10 5.3A6 6 0 0 1 18 8.4a4 4 0 0 1 1.9 7.3M4 4l16 16"/>`,
			globe: `<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>`,
			cc: `<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M10.5 10.3a2.3 2.3 0 1 0 0 3.4M17 10.3a2.3 2.3 0 1 0 0 3.4"/>`,
			mic: `<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>`,
			sidebar: `<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M9 4.5v15"/>`,
			flag: `<path d="M5 21V4M5 4h12l-2.5 4.5L17 13H5"/>`,
			// temporadas
			snowflake: `<path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6M9.5 4.5 12 6.5l2.5-2M9.5 19.5l2.5-2 2.5 2"/>`,
			flower: `<circle cx="12" cy="12" r="2.4"/><path d="M12 9.6c-1.6-2.3-1.3-5 0-6.6 1.3 1.6 1.6 4.3 0 6.6zM14.3 11.3c2.6-1 5.2-.1 6.4 1.5-1.9.7-4.6.2-6.4-1.5zM13.4 14.2c1.5 2.4.9 5-.6 6.4-1.1-1.7-1-4.4.6-6.4zM10.6 14.2c-.2 2.8-2.2 4.6-4.3 4.8.2-2 2.1-4 4.3-4.8zM9.7 11.3c-2.7-.6-4.3-2.8-4.2-4.9 2 .2 4 2 4.2 4.9z"/>`,
			sun: `<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>`,
			leaf: `<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>`,
			// gêneros
			compass: `<circle cx="12" cy="12" r="9"/><path d="m15.8 8.2-1.7 5-5 1.7 1.7-5z"/>`,
			smile: `<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>`,
			wand: `<path d="m4 20 11-11M15 5.5V3M18.5 10H21M17 7l1.8-1.8M11.3 7.3 9.8 5.8M16.7 12.7l1.5 1.5"/><path d="m15 9-2-2"/>`,
			skull: `<circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><path d="M8 20v2h8v-2"/><path d="M16 20a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20"/>`,
			brain: `<path d="M12 5a3 3 0 0 0-5.6-1.5A3 3 0 0 0 4 7.5a3.5 3.5 0 0 0 .5 6.3A3 3 0 0 0 9 18.5a3 3 0 0 0 3 1.5zM12 5a3 3 0 0 1 5.6-1.5A3 3 0 0 1 20 7.5a3.5 3.5 0 0 1-.5 6.3A3 3 0 0 1 15 18.5a3 3 0 0 1-3 1.5"/>`,
			rocket: `<path d="M12 2.5c3 2 4.5 5.5 4.5 9.5l-2 3h-5l-2-3c0-4 1.5-7.5 4.5-9.5z"/><circle cx="12" cy="9" r="1.6"/><path d="M9.5 15 7 17.5V20l3-1.5M14.5 15l2.5 2.5V20l-3-1.5M12 18v3"/>`,
			coffee: `<path d="M4 9h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8 2.5c-.5 1 .5 2 0 3M12 2.5c-.5 1 .5 2 0 3"/>`,
			ball: `<circle cx="12" cy="12" r="9"/><path d="m12 7.5 3.8 2.8-1.4 4.5H9.6l-1.4-4.5z"/><path d="M12 3v4.5M15.8 10.3l4.6-1.5M14.4 14.8l2.6 4M9.6 14.8 7 18.8M8.2 10.3 3.6 8.8"/>`,
			ghost: `<path d="M9 10h.01M15 10h.01"/><path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"/>`,
			bolt: `<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>`,
			robot: `<rect x="5" y="8" width="14" height="11" rx="2"/><path d="M12 8V5"/><circle cx="12" cy="4" r="1"/><circle cx="9" cy="12.5" r="1.2"/><circle cx="15" cy="12.5" r="1.2"/><path d="M9.5 16h5M3 12v3M21 12v3"/>`,
			music: `<path d="M9 17.5v-12l11-2v12"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="15.5" r="2.5"/>`,
			swords: `<path d="M4 4l12 12M20 4 8 16"/><path d="M13.5 18.5l5-5M5.5 13.5l5 5M17.5 17.5 20.5 20.5M6.5 17.5 3.5 20.5"/>`,
			crown: `<path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zM5 20h14"/>`,
			moon: `<path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z"/>`,
			castle: `<path d="M3.5 21.5V8.5h3V11H9V8.5h6V11h2.5V8.5h3v13z"/><path d="M10 21.5V18a2 2 0 0 1 4 0v3.5M12 8.5V3l3 1.3L12 5.6"/>`,
			school: `<path d="M2.5 9 12 4.5 21.5 9 12 13.5z"/><path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5M21.5 9v5.5"/>`,
			puzzle: `<path d="M9 4.5a2 2 0 0 1 4 0V6h4a1 1 0 0 1 1 1v4h-1.5a2 2 0 0 0 0 4H18v4a1 1 0 0 1-1 1h-4v-1.5a2 2 0 0 0-4 0V20H5a1 1 0 0 1-1-1v-4h1.5a2 2 0 0 0 0-4H4V7a1 1 0 0 1 1-1h4z"/>`,
			gem: `<path d="M6 4h12l3.5 5L12 20.5 2.5 9z"/><path d="M2.5 9h19M9 4l3 16.5L15 4"/>`,
			medal: `<circle cx="12" cy="14.5" r="5.5"/><path d="M8.5 10 6 3.5h4l2 4 2-4h4L15.5 10"/>`,
			table: `<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M3.5 9.5h17M3.5 14.5h17M9 9.5v10"/>`,
			users: `<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M15.5 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c2 .7 3.2 2.4 3.5 5.2"/>`,
			trend: `<path d="M3.5 17 9 11.5l3.5 3.5 8-8"/><path d="M15 7h5.5v5.5"/>`,
			mic2: `<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>`,
			"b-mal": `<path d="M3 16.5v-9l3 4.5 3-4.5v9M11.5 16.5l2.4-9h1.2l2.4 9M12.4 13.2h3.2M19.5 7.5v9h2.5"/>`,
			// marca do app e do AniList
			mark: `<rect x="3" y="3" width="18" height="18" rx="5"/><path fill="currentColor" stroke="none" d="M10 8.2c0-.6.7-1 1.2-.7l5.2 3.5c.5.3.5 1.1 0 1.4l-5.2 3.5c-.5.3-1.2 0-1.2-.7z"/>`,
			"b-anilist": `<path d="M6.5 19.5 10.6 4.5h2.8l4.1 15"/><path d="M8.2 13.5h7.6"/><path d="M17.5 4.5h2v11.5"/>`
		};
		return this._paths;
	}

	icon(name, cls = "") {
		const d = this.paths[name];
		if (!d) return "";
		return `<svg class="av-i${cls ? " " + cls : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
	}

	// ----------------------------------------------------------- primitivos
	btn(label, { icon = "", kind = "secondary", action = "", attrs = "", size = "", title = "" } = {}) {
		const cls = `av-btn av-btn--${kind}${size ? ` av-btn--${size}` : ""}${!label ? " av-btn--icon" : ""}`;
		return `<button type="button" class="${cls}"${action ? ` data-action="${this.attr(action)}"` : ""}${title || !label ? ` title="${this.attr(title || label)}" aria-label="${this.attr(title || label)}"` : ""} ${attrs}>${icon ? this.icon(icon) : ""}${label ? `<span>${this.esc(label)}</span>` : ""}</button>`;
	}

	openAttrs(path) { return `data-open="${this.attr(path)}" href="${this.attr(path)}"`; }

	// categoria: abre a página; se ainda não existir, o toque cria e abre
	catAttrs(kind, name, page) {
		return page ? this.openAttrs(page.path) : `data-action="open-category" data-kind="${kind}" data-name="${this.attr(name)}" href="#" role="link"`;
	}

	safeUrl(url, opts) { return customJS.AnimeVaultCore.safeUrl(url, opts); }

	statusTag(a, C) {
		const def = C.statusDefs[a.status];
		return `<span class="av-status av-tone-${def?.tone || "muted"}"><i></i><span>${this.esc(C.statusLabel(a.status))}</span></span>`;
	}

	progressBar(pct, { tone = "", thin = false, label = "" } = {}) {
		const v = pct === null || pct === undefined ? 0 : Math.max(0, Math.min(100, pct));
		return `<div class="av-progress${thin ? " av-progress--thin" : ""}${tone ? ` av-tone-${tone}` : ""}" role="progressbar" aria-valuenow="${Math.round(v)}" aria-valuemin="0" aria-valuemax="100"${label ? ` aria-label="${this.attr(label)}"` : ""}><span style="width:${v}%"></span></div>`;
	}

	ring(pct, { size = 56, stroke = 4, done = false } = {}) {
		const r = (size - stroke) / 2, c = 2 * Math.PI * r;
		const v = pct === null ? 0 : Math.max(0, Math.min(100, pct));
		return `<svg class="av-ring${done ? " is-done" : ""}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
			<circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" class="av-ring-track"/>
			<circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" class="av-ring-fill" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - v / 100)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
		</svg>`;
	}

	stars(rating, { input = false } = {}) {
		const r = Math.max(0, Math.min(5, Number(rating) || 0));
		let out = "";
		for (let i = 1; i <= 5; i++) {
			const cls = r >= i ? " is-on" : r >= i - 0.5 ? " is-half" : "";
			out += input
				? `<button type="button" class="av-star${cls}" data-star="${i}" aria-label="${i} de 5">${this.icon("starFill")}</button>`
				: `<span class="av-star${cls}">${this.icon("starFill")}</span>`;
		}
		return `<span class="av-stars${input ? " av-stars--input" : ""}" ${input ? 'role="group" aria-label="Sua nota"' : `aria-label="${r} de 5"`}>${out}</span>`;
	}

	// nota na escala escolhida: estrelas (Crunchyroll) ou 1–10 (MyAnimeList)
	score(rating, { big = false } = {}) {
		const C = customJS.AnimeVaultCore;
		if (!rating) return `<span class="av-muted">—</span>`;
		if (C.scale() === 10) return `<span class="av-score10${big ? " is-big" : ""}" title="${this.attr(C.malScores[C.score10(rating)] || "")}"><b>${C.score10(rating)}</b><small>/10</small></span>`;
		return this.stars(rating);
	}
	scoreText(rating) {
		const C = customJS.AnimeVaultCore;
		if (!rating) return "";
		return C.scale() === 10 ? `${C.score10(rating)}/10` : this.fmtNum(rating, 1);
	}
	// seletor de nota do MyAnimeList: (10) Obra-prima … (1) Péssimo
	scoreSelect(rating, attrs = "") {
		const C = customJS.AnimeVaultCore;
		const cur = C.score10(rating);
		return `<select class="av-select av-select--score" ${attrs}><option value="0"${!cur ? " selected" : ""}>Selecionar</option>${[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(n => `<option value="${n}"${cur === n ? " selected" : ""}>(${n}) ${this.esc(C.malScores[n])}</option>`).join("")}</select>`;
	}

	// linha da lista em tabela, como a "Anime List" do MyAnimeList:
	// barra colorida do status, capa, título, nota, tipo e progresso com +1
	malRow(a, C, n) {
		const ms = C.malStatusOf(a.status);
		const p = a.progress;
		return `<div class="av-malrow" data-anime="${this.attr(a.path)}" style="--av-ms:${ms.color}">
			<span class="av-malrow-n">${n}</span>
			<a class="av-malrow-art" ${this.openAttrs(a.path)}>${this.cover(a)}</a>
			<span class="av-malrow-title"><a ${this.openAttrs(a.path)}>${this.esc(a.title)}</a>${a.airing === "RELEASING" ? `<small class="av-malrow-air">Em lançamento</small>` : ""}${a.franchise ? `<small>${this.esc(a.franchise)}</small>` : ""}</span>
			<span class="av-malrow-score">${a.rating ? (C.scale() === 10 ? `<b>${C.score10(a.rating)}</b>` : `<b>${this.fmtNum(a.rating, 1)}</b>${this.icon("starFill")}`) : `<span class="av-muted">-</span>`}</span>
			<span class="av-malrow-type">${this.esc(C.formatDefs[a.format]?.short || a.format)}</span>
			<span class="av-malrow-prog"><b>${p.watched || (p.done ? (p.total || 1) : "-")}</b><span>/ ${p.total || "-"}</span>${p.next !== null && !C.isMovie(a) ? `<button type="button" class="av-malrow-plus" data-action="ep-next" data-path="${this.attr(a.path)}" title="Assisti o E${p.next}" aria-label="Assisti o E${p.next}">${this.icon("plus")}</button>` : ""}</span>
		</div>`;
	}

	// capa com fallback gerado: nunca uma área vazia
	cover(a, { cls = "", eager = false, banner = false } = {}) {
		const src = banner ? (a.images.banner || a.images.cover) : a.images.cover;
		const style = `--av-hue:${a.hue}`;
		const fallback = `<div class="av-cover-fallback" style="${style}"><span class="av-cover-fallback-title">${this.esc(a.title)}</span><span class="av-cover-fallback-meta">${this.esc(a.formatLabel)}${a.year ? ` · ${a.year}` : ""}</span></div>`;
		if (!src) return `<div class="av-cover is-missing ${cls}" style="${style}">${fallback}</div>`;
		return `<div class="av-cover ${cls}" style="${style}">${fallback}<img src="${this.attr(src)}" alt="" ${eager ? "" : 'loading="lazy"'} decoding="async" data-av-img${banner && !a.images.banner ? ' class="is-cover-as-banner"' : ""}></div>`;
	}

	// linha "Legendado | Dublado" (como nos cards da Crunchyroll); sem áudio
	// informado, o formato e o ano
	cardMeta(a, C) {
		if (a.audioLabel) return a.audioLabel;
		const bits = [a.formatLabel, a.year || ""].filter(Boolean);
		return bits.join(" · ");
	}

	// ----------------------------------------------------------- anime card
	// capa 2:3 de cantos retos; ao passar o mouse, uma camada escura com
	// título, números e sinopse (como na Crunchyroll); ações no rodapé
	animeCard(a, C, { size = "", rank = 0 } = {}) {
		const p = a.progress;
		const showBar = ["Watching", "Rewatching", "Paused"].includes(a.status) && p.pct !== null && p.watched > 0;
		const eps = a.episodes ? `${this.plural(a.episodes, "episódio", "episódios")}` : C.isMovie(a) ? this.fmtMinutes(a.duration) : "";
		const badge = p.newEpisode ? `<span class="av-card-badge is-new">Novo E${p.aired}</span>`
			: a.airing === "RELEASING" ? `<span class="av-card-badge">Em lançamento</span>`
			: a.airing === "NOT_YET_RELEASED" ? `<span class="av-card-badge is-soon">Em breve</span>` : "";
		const nextLabel = p.next ? (C.isMovie(a) ? "Assistir" : `E${p.next}`) : "Reassistir";
		return `<article class="av-card${size ? ` av-card--${size}` : ""}${a.favorite ? " is-favorite" : ""}" data-anime="${this.attr(a.path)}" style="--av-hue:${a.hue}">
			<a class="av-card-link" ${this.openAttrs(a.path)} aria-label="${this.attr(a.title)}">
				<div class="av-card-art">
					${this.cover(a)}
					${badge}
					${rank ? `<span class="av-card-rank">${rank}</span>` : ""}
					${showBar ? `<div class="av-card-bar"><span style="width:${p.pct}%"></span></div>` : ""}
				</div>
				<div class="av-card-body">
					<h4 class="av-card-title">${this.esc(a.title)}</h4>
					<p class="av-card-meta">${this.esc(this.cardMeta(a, C))}</p>
				</div>
				<div class="av-card-hover" aria-hidden="true">
					<h4>${this.esc(a.title)}</h4>
					<p class="av-card-hstats">${a.rating ? `<span class="av-card-hrate">${this.esc(this.scoreText(a.rating))} ${this.icon("starFill")}</span>` : ""}${eps ? `<span>${this.esc(eps)}</span>` : ""}</p>
					<p class="av-card-hstatus">${this.esc(C.statusLabel(a.status))}${p.total && p.watched ? ` · ${p.watched}/${p.total}` : ""}</p>
					${a.summary ? `<p class="av-card-hsum">${this.esc(a.summary)}</p>` : ""}
				</div>
			</a>
			<div class="av-card-acts">
				<button type="button" class="av-card-act" data-action="ep-next" data-path="${this.attr(a.path)}" title="${p.next ? `Marcar ${this.attr(nextLabel)} como assistido` : "Reassistir"}" aria-label="${p.next ? `Marcar ${this.attr(nextLabel)} como assistido` : "Reassistir"}">${this.icon("play")}</button>
				<button type="button" class="av-card-act av-fav${a.favorite ? " is-on" : ""}" data-action="favorite" data-path="${this.attr(a.path)}" aria-pressed="${a.favorite}" title="${a.favorite ? "Remover dos favoritos" : "Favoritar"}" aria-label="${a.favorite ? "Remover dos favoritos" : "Favoritar"}">${this.icon(a.favorite ? "bookmarkFill" : "bookmark")}</button>
				<button type="button" class="av-card-act" data-action="quick" data-path="${this.attr(a.path)}" title="Mais ações" aria-label="Mais ações">${this.icon("plus")}</button>
			</div>
		</article>`;
	}

	// "Continuar assistindo": miniatura 16:9 com barra de progresso, série
	// em cima e o episódio em destaque (como na Crunchyroll)
	wideCard(a, C, { note = "" } = {}) {
		const p = a.progress;
		const next = p.next || p.watched || 1;
		const left = p.total ? p.total - p.watched : null;
		const epPct = p.total ? Math.max(4, (p.watched / p.total) * 100) : 0;
		return `<article class="av-wide" data-anime="${this.attr(a.path)}" style="--av-hue:${a.hue}">
			<a class="av-wide-link" ${this.openAttrs(a.path)} aria-label="${this.attr(a.title)}">
				<div class="av-wide-art">
					${this.cover(a, { banner: true })}
					<span class="av-wide-play">${this.icon("play")}</span>
					${p.newEpisode ? `<span class="av-card-badge is-new">Novo episódio</span>` : ""}
					<span class="av-wide-time">${left !== null ? (C.isMovie(a) ? this.fmtMinutes(a.duration) : `${left} ${left === 1 ? "restante" : "restantes"}`) : `${this.fmtMinutes(a.duration)}`}</span>
					<div class="av-wide-bar"><span style="width:${epPct}%"></span></div>
				</div>
				<div class="av-wide-body">
					<span class="av-wide-series">${this.esc(a.title)}</span>
					<strong class="av-wide-ep">${C.isMovie(a) ? this.esc(a.formatLabel) : `${a.status === "Rewatching" ? "Reassistindo · " : ""}E${next}${p.total ? ` de ${p.total}` : ""}`}</strong>
					${note ? `<span class="av-wide-note">“${this.esc(note)}”</span>` : `<span class="av-wide-meta">${this.esc(a.audioLabel || C.statusLabel(a.status))}${a.lastWatched ? ` · ${this.esc(this.relDate(a.lastWatched))}` : ""}</span>`}
				</div>
			</a>
			<button type="button" class="av-wide-next" data-action="ep-next" data-path="${this.attr(a.path)}" title="Marcar E${next} como assistido" aria-label="Marcar E${next} como assistido">${this.icon("check")}</button>
		</article>`;
	}

	// linha da biblioteca em lista
	animeRow(a, C) {
		const p = a.progress;
		return `<div class="av-row" data-anime="${this.attr(a.path)}">
			<a class="av-row-art" ${this.openAttrs(a.path)}>${this.cover(a)}</a>
			<a class="av-row-title" ${this.openAttrs(a.path)}><b>${this.esc(a.title)}</b><small>${this.esc([a.formatLabel, a.year, a.studios[0]].filter(Boolean).join(" · "))}</small></a>
			<span class="av-row-cell">${this.statusTag(a, C)}</span>
			<span class="av-row-cell av-row-prog">${p.total ? `${this.progressBar(p.pct, { thin: true, tone: p.done ? "green" : "" })}<span class="av-num">${p.watched}/${p.total}</span>` : `<span class="av-num">${p.watched || "—"}</span>`}</span>
			<span class="av-row-cell av-num">${a.minutes ? this.fmtMinutes(a.minutes) : `<span class="av-muted">—</span>`}</span>
			<span class="av-row-cell">${a.rating ? this.score(a.rating) : `<span class="av-muted">Sem nota</span>`}</span>
		</div>`;
	}

	// ----------------------------------------------------------- estrutura
	sectionHead(title, { count = null, action = "", sub = "", id = "" } = {}) {
		return `<header class="av-sechead"${id ? ` id="${this.attr(id)}"` : ""}>
			<div class="av-sechead-text"><h2>${this.esc(title)}${count !== null ? `<span class="av-count">${this.fmtNum(count)}</span>` : ""}</h2>${sub ? `<p>${this.esc(sub)}</p>` : ""}</div>
			${action ? `<div class="av-sechead-actions">${action}</div>` : ""}
		</header>`;
	}

	seeAll(path, label = "Ver tudo") { return `<a class="av-seeall" ${this.openAttrs(path)}>${this.esc(label)}${this.icon("chevronRight")}</a>`; }

	// fileira horizontal: setas sobre as pontas (computador), arrasto no celular
	shelf(title, itemsHtml, { count = null, action = "", id = "", variant = "", sub = "" } = {}) {
		if (!itemsHtml.length) return "";
		return `<section class="av-shelf${variant ? ` av-shelf--${variant}` : ""}"${id ? ` id="${this.attr(id)}"` : ""}>
			${this.sectionHead(title, { count, action, sub })}
			<div class="av-shelf-wrap">
				<button type="button" class="av-shelf-nav is-prev" data-action="shelf-prev" aria-label="Anterior">${this.icon("chevronLeft")}</button>
				<div class="av-shelf-track">${itemsHtml.join("")}</div>
				<button type="button" class="av-shelf-nav is-next" data-action="shelf-next" aria-label="Próximo">${this.icon("chevronRight")}</button>
			</div>
		</section>`;
	}

	grid(itemsHtml) { return `<div class="av-grid">${itemsHtml.join("")}</div>`; }

	empty({ icon = "info", title, text = "", action = "", compact = false }) {
		return `<div class="av-empty${compact ? " av-empty--compact" : ""}">
			<span class="av-empty-icon">${this.icon(icon)}</span>
			<div class="av-empty-text"><strong>${this.esc(title)}</strong>${text ? `<p>${this.esc(text)}</p>` : ""}</div>
			${action ? `<div class="av-empty-action">${action}</div>` : ""}
		</div>`;
	}

	figures(items) {
		return `<dl class="av-figures">${items.filter(Boolean).map(it => `<div class="av-figure${it.tone ? ` av-tone-${it.tone}` : ""}"><dt>${this.esc(it.label)}</dt><dd>${it.html ?? this.esc(it.value)}${it.sub ? `<small>${this.esc(it.sub)}</small>` : ""}</dd></div>`).join("")}</dl>`;
	}

	bars(rows, { unit = "", max = null } = {}) {
		const m = max ?? Math.max(1, ...rows.map(r => r.value));
		return `<div class="av-bars">${rows.map(r => `<div class="av-bar-row">
			<span class="av-bar-label">${r.href ? `<a ${this.openAttrs(r.href)}>${this.esc(r.label)}</a>` : r.attrs ? `<a ${r.attrs}>${this.esc(r.label)}</a>` : this.esc(r.label)}</span>
			<span class="av-bar-track"><span style="width:${(r.value / m) * 100}%${r.color ? `;background:${r.color}` : ""}"></span></span>
			<span class="av-bar-value av-num">${this.esc(r.display ?? `${this.fmtNum(r.value, 1)}${unit}`)}</span>
		</div>`).join("")}</div>`;
	}

	tabs(items, active, { cls = "" } = {}) {
		return `<nav class="av-tabs ${cls}" role="tablist">${items.map(t => `<button type="button" role="tab" class="av-tab${t.id === active ? " is-active" : ""}" data-tab="${this.attr(t.id)}" aria-selected="${t.id === active}">${this.esc(t.label)}${t.count !== undefined && t.count !== null ? `<span class="av-tab-count">${this.fmtNum(t.count)}</span>` : ""}</button>`).join("")}</nav>`;
	}

	pageHead(title, { sub = "", actions = "", kicker = "" } = {}) {
		return `<header class="av-pagehead">
			<div class="av-pagehead-text">${kicker ? `<span class="av-kicker">${this.esc(kicker)}</span>` : ""}<h1>${this.esc(title)}</h1>${sub ? `<p>${this.esc(sub)}</p>` : ""}</div>
			${actions ? `<div class="av-pagehead-actions">${actions}</div>` : ""}
		</header>`;
	}

	syncBadge(state, label, detail = "") {
		const icon = state === "ok" ? "cloud" : state === "busy" ? "refresh" : "cloudOff";
		return `<span class="av-sync av-sync--${this.attr(state)}" title="${this.attr(detail || label)}">${this.icon(icon)}<span>${this.esc(label)}</span></span>`;
	}

	// ----------------------------------------------------------- app shell
	// Barra superior preta (logo, navegação, busca, conta), como na
	// Crunchyroll. No celular: logo + busca + conta no topo e a barra de
	// navegação embaixo.
	shell({ active, content, C, cfg = null }) {
		const P = this.pages;
		const browseIds = ["genres", "studios", "franchises", "seasons"];
		const topActive = ["anime", "list"].includes(active) ? (active === "list" ? "lists" : "library")
			: ["genre", "studio", "franchise", "genres", "studios", "franchises", "ranking"].includes(active) ? "browse" : active;
		const navItem = it => {
			if (it.menu) {
				return `<div class="av-menu-wrap av-topnav-menu"><button type="button" class="av-topnav-item${topActive === it.id ? " is-active" : ""}" data-action="menu" aria-haspopup="true" aria-expanded="false">${this.esc(it.label)}${this.icon("chevronDown")}</button>
					<div class="av-menu av-menu--browse" role="menu" hidden>${it.menu.map(id => `<a role="menuitem" ${this.openAttrs(P[id].path)}${active === id ? ' class="is-active"' : ""}>${this.icon(P[id].icon)}${this.esc(P[id].label)}</a>`).join("")}</div></div>`;
			}
			return `<a class="av-topnav-item${topActive === it.id ? " is-active" : ""}" ${this.openAttrs(it.path)}${topActive === it.id ? ' aria-current="page"' : ""}>${this.esc(it.label)}</a>`;
		};
		const drawerItem = id => `<a class="av-nav-item${active === id || (id === "library" && topActive === "library") ? " is-active" : ""}" ${this.openAttrs(P[id].path)}>${this.icon(P[id].icon)}<span>${this.esc(P[id].label)}</span></a>`;
		const drawer = this.drawerGroups.map(([label, ids]) => `<div class="av-nav-group"><span class="av-nav-label">${this.esc(label)}</span>${ids.map(drawerItem).join("")}</div>`).join("");
		const bottomActive = this.mobileNav.includes(active) ? active
			: ["anime"].includes(active) ? "library"
			: [...browseIds, "genre", "studio", "franchise", "ranking"].includes(active) ? "genres" : active ? "more" : "";
		const connected = !!cfg?.user;
		const avatar = cfg?.avatar ? `<img src="${this.attr(cfg.avatar)}" alt="">` : this.icon("user");
		return `<div class="av-app" data-active="${this.attr(active)}">
			<header class="av-header">
				<button type="button" class="av-header-btn av-drawer-btn" data-action="open-drawer" aria-label="Menu">${this.icon("menu")}</button>
				<a class="av-logo" ${this.openAttrs(P.home.path)} aria-label="Anime Vault — início">${this.icon("mark")}<span>Anime<b>Vault</b></span></a>
				<nav class="av-topnav" aria-label="Navegação">${this.nav.map(navItem).join("")}</nav>
				<div class="av-header-actions">
					<div class="av-search" role="search">
						${this.icon("search")}
						<input type="search" class="av-search-input" placeholder="Buscar animes, gêneros, estúdios…" aria-label="Busca" autocomplete="off" spellcheck="false">
						<button type="button" class="av-search-close" data-action="search-close" aria-label="Fechar busca">${this.icon("x")}</button>
						<div class="av-search-results" role="listbox" hidden></div>
					</div>
					<button type="button" class="av-header-btn av-search-toggle" data-action="search-open" aria-label="Buscar" title="Buscar">${this.icon("search")}</button>
					<a class="av-header-btn av-hide-sm" ${this.openAttrs(P.library.path)} title="Minha biblioteca" aria-label="Minha biblioteca">${this.icon("bookmark")}</a>
					<div class="av-menu-wrap av-account">
						<button type="button" class="av-header-btn av-avatar" data-action="menu" aria-haspopup="true" aria-expanded="false" title="Conta">${avatar}</button>
						<div class="av-menu av-account-menu" role="menu" hidden>
							<div class="av-account-head"><span class="av-account-avatar">${avatar}</span><span class="av-account-id"><b>${this.esc(connected ? cfg.user : "Anime Vault")}</b><small class="av-account-state${connected ? " is-on" : ""}">${connected ? (cfg.lastSync ? `AniList · sync ${this.esc(this.relDate(String(cfg.lastSync).slice(0, 10)))}` : "AniList conectado") : "AniList não conectado"}</small></span></div>
							${connected ? `<button role="menuitem" data-action="anilist-sync">${this.icon("refresh")}Sincronizar AniList</button>` : `<button role="menuitem" data-action="anilist-connect">${this.icon("link")}Conectar AniList</button>`}
							<div class="av-menu-sep"></div>
							${["profile", "history", "statistics", "tierlist", "integrations", "settings"].map(id => `<a role="menuitem" ${this.openAttrs(P[id].path)}>${this.icon(P[id].icon)}${this.esc(P[id].label)}</a>`).join("")}
						</div>
					</div>
				</div>
			</header>
			<main class="av-content">${content}</main>
			<footer class="av-footer"><span>${this.icon("mark")}Anime Vault ${this.esc(C.VERSION)}</span><span>Suas notas, seus dados. Metadados do AniList.</span></footer>
			<nav class="av-bottomnav" aria-label="Navegação principal">
				${this.mobileNav.map(id => `<a class="av-bottomnav-item${id === bottomActive ? " is-active" : ""}" ${this.openAttrs(P[id].path)}>${this.icon(P[id].icon)}<span>${this.esc(id === "library" ? "Biblioteca" : id === "genres" ? "Navegar" : P[id].label)}</span></a>`).join("")}
				<button type="button" class="av-bottomnav-item${bottomActive === "more" ? " is-active" : ""}" data-action="open-drawer">${this.icon("menu")}<span>Mais</span></button>
			</nav>
			<div class="av-drawer" hidden><div class="av-drawer-backdrop" data-action="close-drawer"></div><div class="av-drawer-panel"><div class="av-drawer-head">${this.icon("mark")}<span>Anime<b>Vault</b></span></div>${drawer}${this.obsidianGroup()}</div></div>
		</div>`;
	}

	// atalhos do Obsidian no menu "Mais" (celular, modo aplicativo)
	obsidianGroup() {
		const it = (cmd, icon, label) => `<button type="button" class="av-nav-item" data-action="obs" data-cmd="${cmd}">${this.icon(icon)}<span>${label}</span></button>`;
		return `<div class="av-nav-group av-nav-group--obsidian"><span class="av-nav-label">Obsidian</span>
			${it("back", "chevronLeft", "Voltar")}${it("forward", "chevronRight", "Avançar")}${it("search", "search", "Buscar no vault")}
			${it("edit", "edit", "Editar nota")}${it("sidebar", "sidebar", "Menu lateral do Obsidian")}${it("navbar", "rows", "Mostrar controles do Obsidian")}</div>`;
	}

	_store(key, value) {
		const k = `animevault:ui:${key}`;
		try {
			if (value === undefined) return localStorage.getItem(k);
			localStorage.setItem(k, value);
		} catch (_) { return null; }
	}
}
