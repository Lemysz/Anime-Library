// ==========================================================================
// Anime Vault — ponto de entrada (facade)
//
// Toda nota do Anime Vault tem um único bloco:
//
//   ```dataviewjs
//   await dv.view("Assets/animevault-boot", { page: "home" });
//   ```
//
// O boot mostra a tela de carregamento, espera o CustomJS e chama
// customJS.AnimeVault.render(dv, "home").
//
// Este módulo roteia para a página certa, aplica o app shell (barra
// superior, navegação do celular) e cuida de tudo o que é comum:
// navegação, busca, menus, janelas, avisos, favoritos e progresso.
//
// Módulos (um arquivo por classe, pasta Scripts/, plugin CustomJS):
//   AnimeVaultCore      modelo de dados, fonte única dos números
//   AnimeVaultUI        componentes do design system
//   AnimeVaultPages     Início, Biblioteca, ficha do anime, Histórico
//   AnimeVaultBrowse    Listas, Gêneros, Estúdios, Franquias, Temporadas
//   AnimeVaultInsights  Calendário, Estatísticas, Tier List, Configurações
//   AnimeVaultEditor    formulários (adicionar, editar, diário, análise…)
//   AnimeVaultAniList   busca, artes, personagens e sync público do AniList
//   AnimeVaultMAL       estatísticas e Top do MyAnimeList, XML, Integrações
// ==========================================================================

class AnimeVault {

	constructor() {
		this.routes = {
			home: ["P", "home"], library: ["P", "library"], anime: ["P", "anime"], history: ["P", "history"],
			lists: ["B", "lists"], list: ["B", "list"],
			genres: ["B", "genres"], genre: ["B", "genre"], studios: ["B", "studios"], studio: ["B", "studio"],
			franchises: ["B", "franchises"], franchise: ["B", "franchise"], seasons: ["B", "seasons"],
			calendar: ["I", "calendar"], statistics: ["I", "statistics"], tierlist: ["I", "tierlist"], settings: ["I", "settings"],
			anilist: ["AL", "page"], integrations: ["MAL", "integrations"],
			profile: ["I", "profile"], ranking: ["I", "ranking"]
		};
		if (!window.__avHosts) window.__avHosts = new Set();
		this._bindGlobalKeys();
	}

	// ------------------------------------------------------------ módulos
	get _required() { return ["C", "U", "P", "B", "I", "E"]; }

	bootState() {
		const M = this.mods();
		if (this._required.some(k => !M[k])) return "none";
		return Object.values(M).every(Boolean) ? "all" : "core";
	}

	mods() {
		const j = typeof customJS !== "undefined" ? customJS : {};
		return {
			C: j.AnimeVaultCore, U: j.AnimeVaultUI, P: j.AnimeVaultPages, B: j.AnimeVaultBrowse,
			I: j.AnimeVaultInsights, E: j.AnimeVaultEditor, AL: j.AnimeVaultAniList, MAL: j.AnimeVaultMAL
		};
	}

	// =============================================================== render
	async render(dv, page = "home") {
		const host = dv.container;
		let M = this.mods();
		let missing = this._required.filter(k => !M[k]);
		for (let t = 0; missing.length && t < 400 && host.isConnected; t++) {
			await new Promise(r => setTimeout(r, 100));
			M = this.mods(); missing = this._required.filter(k => !M[k]);
		}
		if (missing.length) {
			host.classList.add("av-host");
			host.innerHTML = `<div class="av-fatal"><strong>Anime Vault não carregou</strong><p>Verifique se o plugin CustomJS está ativo e aponta para a pasta <code>Scripts/</code>. Módulos ausentes: ${missing.join(", ")}.</p></div>`;
			return;
		}
		host.__avRender = { dv, page };
		window.__avHosts.add(host);

		const current = dv.current?.() || null;
		const model = M.C.model(dv);
		const ctx = { dv, ...M, V: this, model, current, page };

		let res;
		try {
			const route = this.routes[page];
			if (!route) throw new Error(`Página desconhecida: ${page}`);
			if (!M[route[0]]) throw new Error(`O módulo desta tela não foi carregado (${({ AL: "AnimeVaultAniList.js", MAL: "AnimeVaultMAL.js" })[route[0]] || route[0]})`);
			res = await M[route[0]][route[1]](ctx);
		} catch (err) {
			console.error("Anime Vault: falha ao montar a página", page, err);
			res = { active: "", html: `<div class="av-page av-pad">${M.U.empty({ icon: "alert", title: "Não foi possível montar esta tela", text: String(err?.message || err) })}</div>` };
		}

		const surface = this._surface(host);
		const preScroller = surface.scroller || host.parentElement;
		const preW = this._viewWidth(surface.layer ? surface.el.clientWidth : preScroller?.clientWidth);
		surface.el.innerHTML = M.U.shell({ active: res.active, content: res.html, C: M.C, cfg: M.AL ? M.AL.getConfig() : null });
		const root = surface.el.querySelector(".av-app");
		root.dataset.page = page;
		root.classList.add("av-instant");
		this._presetSize(root, preW);
		const renderKey = `${page}:${current?.file?.path || ""}`;
		const isRefresh = surface.el.__avKey === renderKey;
		surface.el.__avKey = renderKey;
		root.classList.toggle("is-refresh", isRefresh);
		host.__avSurface = surface;
		this._markLeaf(host);
		this._observeSize(host, surface);
		this._applyPrefs();
		this._wire(root, ctx);
		try { res.wire?.(root, ctx); } catch (err) { console.error("Anime Vault: falha ao ligar a página", page, err); }
		this._wireImages(root);
		this._restoreScroll(host, surface, page, current);
		this._wireMotion(root, surface, isRefresh);
		try { this._wireHeroCarousel(root, surface); } catch (err) { console.warn("Anime Vault: carrossel", err); }
		this._wireGestures(root, surface, ctx);
		requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("av-instant")));
		if (document.body.classList.contains("av-app-paused")) document.body.classList.remove("av-app-paused");
		this._markScreen();
		host.__avApply?.();
		M.AL?.maybeAutoSync?.(ctx);
	}

	// ------------------------------------------------------ superfície
	// Na aba principal, o app é desenhado numa CAMADA própria que cobre a
	// área de conteúdo da aba (.view-content), com rolagem própria. Assim o
	// editor, o modo leitura e o tema não conseguem estreitar ou deslocar a
	// tela. A nota guarda só um marcador vazio. Em notas incorporadas e
	// pré-visualizações, o app continua dentro da nota.
	_surface(host) {
		const inline = host.closest(".markdown-embed, .hover-popover, .popover, .canvas-node, .internal-embed");
		const leafContent = host.closest(".workspace-leaf-content");
		const viewContent = leafContent?.querySelector(":scope > .view-content");
		if (inline || !viewContent) {
			host.classList.add("av-host");
			return { el: host, scroller: host.closest(".markdown-preview-view, .cm-scroller"), layer: false };
		}
		let layer = viewContent.querySelector(":scope > .av-layer");
		if (!layer) {
			layer = document.createElement("div");
			layer.className = "av-host av-layer";
			viewContent.appendChild(layer);
		}
		viewContent.classList.add("av-has-layer");
		layer.__avAnchor = host;
		layer.__avMiss = 0;
		layer.classList.remove("is-locked");
		host.classList.remove("av-host");
		host.classList.add("av-anchor");
		host.textContent = "";
		this._watchLayers();
		return { el: layer, scroller: layer, layer: true, viewContent, leafContent };
	}

	// Áreas seguras do aparelho (barra de status em cima, barra de gestos embaixo)
	_insets() {
		const now = Date.now();
		if (!window.__avInsetsBound) {
			window.__avInsetsBound = true;
			const clear = () => { window.__avInsets = null; };
			window.addEventListener("resize", clear, { passive: true });
			window.addEventListener("orientationchange", clear, { passive: true });
		}
		if (window.__avInsets && now - window.__avInsets.at < 30000) return window.__avInsets;
		let envT = 0, envB = 0;
		try {
			const pr = document.createElement("div");
			pr.style.cssText = "position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)";
			document.body.appendChild(pr);
			const cs = getComputedStyle(pr);
			envT = parseFloat(cs.paddingTop) || 0; envB = parseFloat(cs.paddingBottom) || 0;
			pr.remove();
		} catch (_) {}
		const bs = getComputedStyle(document.body);
		const v = n => parseFloat(bs.getPropertyValue(n)) || 0;
		let top = Math.max(envT, v("--safe-area-inset-top")), bottom = Math.max(envB, v("--safe-area-inset-bottom"));
		// teclado aberto (Android edge-to-edge) não é barra de gestos
		if (bottom > 56) bottom = window.__avGestureInset ?? 0;
		else if (bottom > 0) window.__avGestureInset = bottom;
		if (top > 80) top = window.__avTopInset ?? 0;
		else if (top > 0) window.__avTopInset = top;
		const b = document.body.classList;
		if (b.contains("is-mobile") && b.contains("is-android") && (!top || !bottom)) {
			const sh = window.screen?.height || 0;
			if (sh > 0 && Math.abs(sh - window.innerHeight) < 8) { if (!top) top = 32; if (!bottom) bottom = 18; }
		}
		window.__avInsets = { top: Math.round(top), bottom: Math.round(bottom), at: now };
		return window.__avInsets;
	}

	_setVar(el, name, val) { if (el.style.getPropertyValue(name) !== val) el.style.setProperty(name, val); }
	_setCls(el, cls, on) { if (el.classList.contains(cls) !== !!on) el.classList.toggle(cls, !!on); }
	_rememberSize(cls, vars) {
		const st = window.__avSizeState || (window.__avSizeState = { cls: {}, vars: {} });
		Object.assign(st.cls, cls || {}); Object.assign(st.vars, vars || {});
	}
	_presetSize(root, w) {
		const st = window.__avSizeState;
		if (st) {
			for (const [k, on] of Object.entries(st.cls)) if (on) root.classList.add(k);
			for (const [n, v] of Object.entries(st.vars)) root.style.setProperty(n, v);
		}
		for (const [k, max] of this._bps) root.classList.toggle(`av-bp-${k}`, w < max);
	}
	get _bps() { return [["lg", 1180], ["md", 1000], ["sm", 760], ["xs", 440]]; }
	_viewWidth(own) {
		const cands = [own, window.innerWidth, document.documentElement.clientWidth, window.visualViewport?.width].filter(v => Number.isFinite(v) && v > 0);
		return cands.length ? Math.min(...cands) : 1200;
	}

	_fitLayer(surface) {
		if (!surface?.layer) return;
		const { el, viewContent, leafContent } = surface;
		const vc = viewContent.getBoundingClientRect();
		if (!vc.height) return;
		let top = 0, bottom = 0;
		const header = leafContent.querySelector(":scope > .view-header");
		if (header && header.getClientRects().length) {
			const hr = header.getBoundingClientRect();
			if (hr.bottom > vc.top + 1 && hr.top <= vc.top + 8) top = Math.round(hr.bottom - vc.top);
		}
		for (const nav of document.querySelectorAll(".mobile-navbar")) {
			if (!nav.getClientRects().length) continue;
			const nr = nav.getBoundingClientRect();
			if (nr.top < vc.bottom - 1 && nr.bottom >= vc.bottom - 48 && nr.height < 160) bottom = Math.max(bottom, Math.round(vc.bottom - nr.top));
		}
		const topVal = top ? `${top}px` : "";
		if (el.style.top !== topVal) el.style.top = topVal;
		this._setVar(el, "--av-safe-bottom", `${bottom}px`);
		const ins = this._insets();
		const lr = el.getBoundingClientRect();
		const safeTop = Math.max(0, Math.round(ins.top - lr.top));
		const safeBottom = Math.max(0, Math.round(lr.bottom - (window.innerHeight - ins.bottom)));
		const app_ = el.querySelector(".av-app");
		if (app_) {
			this._setVar(app_, "--av-safe-top", `${safeTop}px`);
			this._setVar(app_, "--av-safe-bottom-inset", `${safeBottom}px`);
		}
		this._rememberSize(null, { "--av-safe-top": `${safeTop}px`, "--av-safe-bottom-inset": `${safeBottom}px` });
	}

	// remove a camada quando a aba passa a mostrar outra nota
	_watchLayers() {
		if (window.__avLayerWatch) return;
		const isVaultFile = layer => {
			try {
				const leafEl = layer.closest(".workspace-leaf-content");
				const leaf = app.workspace.getLeavesOfType("markdown").find(l => l.view?.containerEl === leafEl);
				const fm = leaf?.view?.file ? app.metadataCache.getFileCache(leaf.view.file)?.frontmatter : null;
				const cls = [].concat(fm?.cssclasses || fm?.cssclass || []).map(String);
				return { known: !!leaf, av: cls.includes("animevault") };
			} catch (_) { return { known: false, av: false }; }
		};
		const check = () => {
			for (const layer of document.querySelectorAll(".av-layer")) {
				try {
					if (layer.__avAnchor?.isConnected) { layer.__avMiss = 0; continue; }
					const st = isVaultFile(layer);
					layer.__avMiss = (layer.__avMiss || 0) + 1;
					if ((st.known && !st.av) || layer.__avMiss >= 3) {
						layer.parentElement?.classList.remove("av-has-layer");
						layer.closest(".workspace-leaf-content")?.classList.remove("av-leaf");
						layer.remove();
						customJS.AnimeVault?._markScreen?.();
					}
				} catch (err) { console.warn("Anime Vault: verificação da camada", err); }
			}
			if (!document.querySelector(".av-layer")) { clearInterval(window.__avLayerWatch); window.__avLayerWatch = null; }
		};
		window.__avLayerWatch = setInterval(check, 600);
		if (!window.__avLayerEvents) {
			window.__avLayerEvents = true;
			try {
				app.workspace.on("file-open", () => setTimeout(check, 80));
				app.workspace.on("layout-change", () => setTimeout(check, 80));
			} catch (_) {}
		}
	}

	// re-desenha só as telas deste tipo
	_rerender(page) {
		for (const host of [...window.__avHosts]) {
			if (!host.isConnected) { window.__avHosts.delete(host); continue; }
			const r = host.__avRender;
			if (r && (!page || r.page === page)) this.render(r.dv, r.page).catch(err => console.warn("Anime Vault: re-render falhou", err));
		}
	}

	refresh() {
		this.mods().C?.invalidate();
		this._rerender(null);
	}

	_markLeaf(host) {
		const view = host.closest(".markdown-reading-view, .markdown-source-view, .markdown-preview-view");
		view?.classList.add("av-view");
		host.closest(".workspace-leaf-content")?.classList.add("av-leaf");
	}

	// classes de largura a partir da largura REAL da área da nota
	_observeSize(host, surface) {
		const scroller = surface.scroller || host.parentElement;
		const apply = () => {
			const app_ = surface.el.querySelector(".av-app");
			if (!app_) return;
			if (surface.layer) {
				this._fitLayer(surface);
				const d = app_.querySelector(".av-drawer:not([hidden])");
				if (d) { d.style.top = `${surface.el.scrollTop}px`; d.style.height = `${surface.el.clientHeight}px`; }
			} else if (scroller && scroller.clientWidth > 0) {
				const sr = scroller.getBoundingClientRect();
				const hr = surface.el.getBoundingClientRect();
				const shift = Math.round(hr.left - (sr.left + scroller.clientLeft));
				app_.style.width = `${scroller.clientWidth}px`;
				app_.style.maxWidth = "none";
				app_.style.marginLeft = shift ? `${-shift}px` : "";
			}
			const own = surface.layer ? surface.el.clientWidth : scroller?.clientWidth;
			const w = this._viewWidth(own);
			const touch = document.body.classList.contains("is-mobile") || matchMedia("(hover: none)").matches;
			const h = (surface.layer ? surface.el.clientHeight : scroller?.clientHeight) || window.innerHeight;
			const cls = { "is-touch": touch };
			for (const [k, max] of this._bps) cls[`av-bp-${k}`] = w < max;
			for (const [k, on] of Object.entries(cls)) this._setCls(app_, k, on);
			const bn = app_.querySelector(".av-bottomnav");
			cls["has-bottomnav"] = !!bn && getComputedStyle(bn).display !== "none";
			this._setCls(app_, "has-bottomnav", cls["has-bottomnav"]);
			const vars = { "--av-view-w": `${Math.round(w)}px` };
			if (h) vars["--av-view-h"] = `${h}px`;
			for (const [n, v] of Object.entries(vars)) this._setVar(app_, n, v);
			this._rememberSize(cls, vars);
			requestAnimationFrame(() => app_.querySelectorAll(".av-tabs, .av-shelf").forEach(t => t.dispatchEvent(new Event("av-measure"))));
		};
		apply();
		setTimeout(apply, 350); setTimeout(apply, 1200);
		host.__avApply = apply;
		host.__avResize?.disconnect();
		if (typeof ResizeObserver === "function") {
			let raf = 0;
			const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(apply); });
			ro.observe(surface.el);
			if (surface.viewContent) ro.observe(surface.viewContent);
			else if (scroller) ro.observe(scroller);
			host.__avResize = ro;
		} else {
			window.addEventListener("resize", apply);
		}
	}

	_applyPrefs() {
		const U = this.mods().U;
		document.body.classList.toggle("av-reduced-motion", U._store("reducedMotion") === "1");
		document.body.classList.toggle("av-no-haptics", U._store("haptics") === "0");
		document.body.classList.toggle("av-no-hover-sum", U._store("hoverSummary") === "0");
	}

	// posição de rolagem sobrevive ao re-render automático do Dataview
	_restoreScroll(host, surface, page, current) {
		const scroller = surface.scroller;
		if (!scroller) return;
		const app_ = surface.el.querySelector(".av-app");
		const key = `${page}:${current?.file?.path || ""}`;
		const saved = window.__avScroll?.[key];
		if (surface.layer && !saved) scroller.scrollTop = 0;
		if (saved) requestAnimationFrame(() => { scroller.scrollTop = saved; });
		scroller.__avKey = key;
		const mark = () => { if (app_?.isConnected) this._setCls(app_, "is-scrolled", scroller.scrollTop > 24); };
		scroller.__avMark = mark;
		mark();
		if (!scroller.__avScrollBound) {
			scroller.__avScrollBound = true;
			let frame = 0, idle = 0;
			scroller.addEventListener("scroll", () => {
				if (!frame) frame = requestAnimationFrame(() => { frame = 0; scroller.__avMark?.(); });
				clearTimeout(idle);
				idle = setTimeout(() => {
					if (scroller.scrollLeft) scroller.scrollLeft = 0;
					window.__avScroll = window.__avScroll || {};
					if (scroller.__avKey) window.__avScroll[scroller.__avKey] = scroller.scrollTop;
				}, 140);
			}, { passive: true });
		}
	}

	// ============================================================ wiring
	_wire(root, ctx) {
		root.addEventListener("click", e => this._onClick(e, root, ctx));
		root.addEventListener("keydown", e => { if (e.key === "Escape") { this._closeMenus(root); this._closeDrawer(root); } });
		this._wireSearch(root, ctx);
		this._wireShelves(root);
		this._wireTabs(root);
		this._wireHorizontalScrollers(root);
		this._wireCardMenu(root, ctx);
	}

	_onClick(e, root, ctx) {
		const actionEl = e.target.closest("[data-action]");
		const openEl = e.target.closest("[data-open]");
		if (actionEl && root.contains(actionEl) && this._handles(actionEl.dataset.action)) {
			e.preventDefault(); e.stopPropagation();
			this._action(actionEl.dataset.action, actionEl, root, ctx, e);
			return;
		}
		if (openEl && root.contains(openEl)) {
			e.preventDefault();
			this._closeDrawer(root);
			this._closeMenus(root);
			this.open(openEl.dataset.open, ctx, e.ctrlKey || e.metaKey || e.button === 1);
		}
	}

	_handles(a) {
		return ["toggle-sidebar", "open-drawer", "close-drawer", "shelf-prev", "shelf-next", "menu", "search-open", "search-close", "obs",
			"favorite", "ep-next", "ep-set", "ep-log", "quick", "status", "rewatch", "edit", "review", "rate", "feature-toggle", "delete-anime",
			"add-anime", "random", "open-category", "identity-edit", "list-new", "list-edit", "list-toggle",
			"anilist-connect", "anilist-sync", "anilist-refresh", "anilist-refresh-all", "anilist-art", "anilist-import", "anilist-import-all", "anilist-disconnect",
			"mal-refresh", "mal-refresh-all", "mal-import", "mal-export"].includes(a);
	}

	open(path, ctx, newTab = false) {
		if (!path) return;
		const src = ctx?.current?.file?.path || "";
		app.workspace.openLinkText(String(path).replace(/\.md$/, ""), src, newTab ? "tab" : false);
	}

	_file(path) {
		const f = path ? app.vault.getAbstractFileByPath(path) : null;
		if (!f) this.toast("Anime não encontrado", { tone: "error" });
		return f;
	}

	async _action(action, el, root, ctx, e) {
		const { C, U, E, AL, model } = ctx;
		const path = el.dataset.path;
		switch (action) {
			case "open-drawer": return this._openDrawer(root);
			case "close-drawer": return this._closeDrawer(root);
			case "shelf-prev": case "shelf-next": {
				const track = el.closest(".av-shelf")?.querySelector(".av-shelf-track");
				if (track) track.scrollBy({ left: (action === "shelf-next" ? 1 : -1) * track.clientWidth * 0.85, behavior: this._smooth() });
				return;
			}
			case "menu": {
				const menu = el.closest(".av-menu-wrap")?.querySelector(".av-menu");
				if (!menu) return;
				const open = menu.hidden;
				this._closeMenus(root);
				menu.hidden = !open;
				el.setAttribute("aria-expanded", String(open));
				if (open && e && e.detail === 0) menu.querySelector("button, a")?.focus();
				return;
			}
			case "search-open": return this._openSearch(root);
			case "search-close": return this._closeSearch(root);
			case "obs": this._closeDrawer(root); return this._obsidian(el.dataset.cmd);
			case "favorite": return this._toggleFavorite(el, path, root);
			case "ep-next": this._closeMenus(root); return this.nextEpisode(ctx, path);
			case "ep-set": return this.setEpisode(ctx, path, Number(el.dataset.ep));
			case "ep-log": this._closeMenus(root); return E.logEpisodes(ctx, path);
			case "quick": return this.quickMenu(ctx, path);
			case "status": {
				this._closeMenus(root);
				const f = this._file(path); if (!f) return;
				await C.setStatus(f, el.dataset.status);
				this.toast(`Status: ${C.statusLabel(el.dataset.status)}`, { tone: "ok", icon: C.statusDefs[el.dataset.status]?.icon });
				return this.refresh();
			}
			case "rewatch": {
				this._closeMenus(root);
				const f = this._file(path); if (!f) return;
				await C.setStatus(f, "Rewatching");
				this.toast("Reassistindo do episódio 1", { tone: "ok", icon: "repeat" });
				return this.refresh();
			}
			case "edit": this._closeMenus(root); return E.editAnime(ctx, path);
			case "review": this._closeMenus(root); return E.editReview(ctx, path);
			case "rate": return E.rate(ctx, path);
			case "feature-toggle": this._closeMenus(root); return this._toggleFeatured(el, path);
			case "delete-anime": this._closeMenus(root); return this.deleteAnime(ctx, path);
			case "add-anime": return E.addAnime(ctx, { query: el.dataset.query || "", status: el.dataset.status || "" });
			case "random": return E.picker ? E.picker(ctx) : this.randomAnime(ctx);
			case "open-category": {
				const kind = ["studio", "franchise"].includes(el.dataset.kind) ? el.dataset.kind : "genre";
				const name = el.dataset.name || "";
				try {
					const file = await C.ensureCategoryNote(kind, name);
					this.open(file.path, ctx, e?.ctrlKey || e?.metaKey);
				} catch (err) { this.toast(`Não foi possível abrir “${name}”: ${err.message}`, { tone: "error" }); }
				return;
			}
			case "identity-edit": return E.editIdentity(ctx, el.dataset.kind, el.dataset.name || "", el.dataset.path || "");
			case "list-new": return E.newList(ctx, path ? [path] : []);
			case "list-edit": return E.listPicker(ctx, path);
			case "list-toggle": return E.toggleInList(ctx, el.dataset.list, path);
			case "anilist-connect": this._closeMenus(root); return AL ? AL.openConnect(ctx) : this._noAniList();
			case "anilist-sync": this._closeMenus(root); return AL ? AL.syncProfile(ctx) : this._noAniList();
			case "anilist-refresh": this._closeMenus(root); return AL ? AL.refreshMany(ctx, [path]) : this._noAniList();
			case "anilist-refresh-all": return AL ? AL.refreshMany(ctx, null, { onlyAiring: el.dataset.scope === "airing", el }) : this._noAniList();
			case "anilist-art": this._closeMenus(root); return AL ? AL.downloadArt(ctx, path ? [path] : null, el) : this._noAniList();
			case "anilist-import": return AL ? AL.importEntries(ctx, [el.dataset.id], el) : this._noAniList();
			case "anilist-import-all": return AL ? AL.importEntries(ctx, null, el) : this._noAniList();
			case "mal-refresh": this._closeMenus(root); return ctx.MAL ? ctx.MAL.refresh(ctx, [path], el) : this._noMal();
			case "mal-refresh-all": return ctx.MAL ? ctx.MAL.refresh(ctx, null, el) : this._noMal();
			case "mal-import": return ctx.MAL ? ctx.MAL.openImport(ctx) : this._noMal();
			case "mal-export": return ctx.MAL ? ctx.MAL.exportXml(ctx) : this._noMal();
			case "anilist-disconnect": {
				if (!AL) return;
				const ok = await this.confirm({ title: "Desconectar o AniList?", text: "Remove o usuário e o cache do perfil deste dispositivo. Os animes e o progresso já gravados nas notas continuam.", confirm: "Desconectar", danger: true });
				if (!ok) return;
				await AL.disconnect();
				this.toast("AniList desconectado", { tone: "ok" });
				return this.refresh();
			}
		}
		void model; void U;
	}

	_noMal() { this.toast("O módulo AnimeVaultMAL.js não foi carregado", { tone: "warn" }); }
	_noAniList() { this.toast("O módulo AnimeVaultAniList.js não foi carregado", { tone: "warn" }); }

	// ------------------------------------------------------- progresso
	// "Continuar": marca o próximo episódio. No fim, oferece a nota.
	async nextEpisode(ctx, path) {
		const { C, model, U } = ctx;
		const a = model.animeByPath.get(path);
		const f = this._file(path);
		if (!a || !f) return;
		if (a.progress.next === null) {
			const ok = await this.confirm({ title: `Reassistir ${a.title}?`, text: "O progresso volta ao episódio 1. O histórico da primeira vez continua no diário e conta nas estatísticas.", confirm: "Reassistir" });
			if (!ok) return;
			await C.setStatus(f, "Rewatching");
			this.toast("Reassistindo do episódio 1", { tone: "ok", icon: "repeat" });
			return this.refresh();
		}
		const r = await C.setProgress(f, a.watched + 1);
		this._haptic(10);
		if (r.completed) {
			this.toast(`${a.title} concluído!`, { tone: "ok", icon: "trophy", action: a.rating ? null : { label: "Dar nota", run: () => ctx.E.rate(ctx, path) } });
		} else {
			const label = C.isMovie(a) ? "Filme assistido" : `E${r.now} assistido`;
			this.toast(r.total ? `${label} · ${U.plural(r.total - r.now, "episódio restante", "episódios restantes")}` : label, {
				tone: "ok", icon: "check",
				action: { label: "Desfazer", run: async () => { await C.setProgress(f, r.old); this.refresh(); } }
			});
		}
		this.refresh();
	}

	async setEpisode(ctx, path, ep) {
		const { C, model } = ctx;
		const a = model.animeByPath.get(path);
		const f = this._file(path);
		if (!a || !f || !Number.isFinite(ep)) return;
		// tocar no último assistido desmarca só ele; nos outros, marca até ali
		const target = ep <= a.watched ? (ep === a.watched ? ep - 1 : ep) : ep;
		if (target === a.watched) return;
		const r = await C.setProgress(f, target);
		this._haptic(8);
		this.toast(target > r.old ? (target - r.old > 1 ? `Episódios ${r.old + 1}–${target} assistidos` : `E${target} assistido`) : `Progresso: ${target} de ${r.total || "?"}`, {
			tone: "ok", icon: "check", action: { label: "Desfazer", run: async () => { await C.setProgress(f, r.old); this.refresh(); } }
		});
		if (r.completed) setTimeout(() => this.toast(`${a.title} concluído!`, { tone: "ok", icon: "trophy" }), 400);
		this.refresh();
	}

	async deleteAnime(ctx, path) {
		const a = ctx.model.animeByPath.get(path);
		const f = this._file(path);
		if (!f) return;
		const ok = await this.confirm({ title: `Excluir ${a?.title || f.basename}?`, text: "A nota vai para a lixeira do Obsidian (dá para recuperar). Capas e banners baixados continuam em Assets.", confirm: "Excluir", danger: true });
		if (!ok) return;
		await app.vault.trash(f, false).catch(() => app.vault.delete(f));
		this.toast("Anime excluído", { tone: "ok", icon: "trash" });
		this.open("Dashboard/Biblioteca", ctx);
	}

	randomAnime(ctx) {
		const pool = ctx.model.anime.filter(a => a.status === "Planning" || a.status === "Paused");
		const list = pool.length ? pool : ctx.model.anime;
		if (!list.length) return this.toast("A biblioteca está vazia", { tone: "warn" });
		const a = list[Math.floor(Math.random() * list.length)];
		this.toast(`Que tal ${a.title}?`, { icon: "dice" });
		this.open(a.path, ctx);
	}

	// menu rápido de um anime (botão + do card, toque longo, botão direito)
	quickMenu(ctx, path) {
		const { C, U, model } = ctx;
		const a = model.animeByPath.get(path);
		if (!a) return;
		const inList = new Set((model.listsByAnime.get(a.path) || []).map(l => l.path));
		const body = document.createElement("div");
		body.className = "av-host av-sheet";
		body.innerHTML = `<div class="av-qm-head">${U.cover(a)}<div><strong>${U.esc(a.title)}</strong><span>${U.esc([a.formatLabel, a.year, a.progress.total ? `${a.watched}/${a.progress.total} ep.` : ""].filter(Boolean).join(" · "))}</span></div></div>
			<div class="av-qm-actions">
				${a.progress.next !== null ? `<button type="button" class="av-qm-act is-primary" data-qm="next">${U.icon("play")}<span>${C.isMovie(a) ? "Marcar como assistido" : `Assisti o E${a.progress.next}`}</span></button>` : `<button type="button" class="av-qm-act" data-qm="rewatch">${U.icon("repeat")}<span>Reassistir</span></button>`}
				<button type="button" class="av-qm-act" data-qm="log">${U.icon("notebook")}<span>Registrar no diário</span></button>
				<button type="button" class="av-qm-act${a.favorite ? " is-on" : ""}" data-qm="fav">${U.icon(a.favorite ? "bookmarkFill" : "bookmark")}<span>${a.favorite ? "Nos favoritos" : "Favoritar"}</span></button>
				<button type="button" class="av-qm-act" data-qm="open">${U.icon("eye")}<span>Abrir ficha</span></button>
			</div>
			<section class="av-fgroup"><h4>Status</h4><div class="av-fchips">${Object.keys(C.statusDefs).map(k => `<button type="button" class="av-fchip${a.status === k ? " is-active" : ""}" data-qm-status="${k}"><i class="av-dot av-tone-${C.statusDefs[k].tone}"></i>${U.esc(C.statusLabel(k))}</button>`).join("")}</div></section>
			<section class="av-fgroup"><h4>Listas</h4><div class="av-qm-lists">${model.lists.map(l => `<button type="button" class="av-qm-list${inList.has(l.path) ? " is-on" : ""}" data-qm-list="${U.attr(l.path)}" aria-pressed="${inList.has(l.path)}">${U.icon(l.icon || "layers")}<span>${U.esc(l.title)}</span><span class="av-qm-check">${U.icon("check")}</span></button>`).join("")}<button type="button" class="av-qm-list is-new" data-qm="newlist">${U.icon("plus")}<span>Nova lista</span></button></div></section>`;
		const m = this.modal({ title: "Ações rápidas", size: "sm", body });
		body.addEventListener("click", async e => {
			const t = e.target;
			const q = t.closest("[data-qm]")?.dataset.qm;
			if (q) {
				m.close();
				if (q === "next" || q === "rewatch") return this.nextEpisode(ctx, path);
				if (q === "log") return ctx.E.logEpisodes(ctx, path);
				if (q === "fav") { await app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(path), fm => { fm.favorite = !a.favorite; }); this.toast(a.favorite ? "Removido dos favoritos" : "Adicionado aos favoritos", { icon: "bookmark", tone: "ok" }); return; }
				if (q === "open") return this.open(path, ctx);
				if (q === "newlist") return ctx.E.newList(ctx, [path]);
			}
			const s = t.closest("[data-qm-status]");
			if (s) { m.close(); if (s.dataset.qmStatus !== a.status) { await C.setStatus(app.vault.getAbstractFileByPath(path), s.dataset.qmStatus); this.toast(`Status: ${C.statusLabel(s.dataset.qmStatus)}`, { tone: "ok" }); this.refresh(); } return; }
			const l = t.closest("[data-qm-list]");
			if (l) {
				const on = !l.classList.contains("is-on");
				l.classList.toggle("is-on", on); l.setAttribute("aria-pressed", String(on));
				await ctx.E.toggleInList(ctx, l.dataset.qmList, path, on);
			}
		});
	}

	// toque longo / botão direito num card abre o menu rápido
	_wireCardMenu(root, ctx) {
		let timer = null, start = null, fired = 0;
		const target = e => e.target.closest?.(".av-card[data-anime], .av-wide[data-anime], .av-row[data-anime]");
		const open = el => { fired = Date.now(); this._haptic(16); this.quickMenu(ctx, el.dataset.anime); };
		root.addEventListener("pointerdown", e => {
			if (e.pointerType === "mouse") return;
			const el = target(e); if (!el || root.querySelector(".av-library.is-selecting")) return;
			start = { x: e.clientX, y: e.clientY };
			clearTimeout(timer);
			timer = setTimeout(() => { timer = null; open(el); }, 480);
		}, { passive: true });
		const cancel = () => { clearTimeout(timer); timer = null; };
		root.addEventListener("pointermove", e => { if (timer && start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8) cancel(); }, { passive: true });
		root.addEventListener("pointerup", cancel, { passive: true });
		root.addEventListener("pointercancel", cancel, { passive: true });
		root.addEventListener("contextmenu", e => {
			const el = target(e); if (!el) return;
			e.preventDefault();
			if (Date.now() - fired < 800) return;
			cancel(); open(el);
		});
		root.addEventListener("click", e => { if (Date.now() - fired < 700 && target(e)) { e.preventDefault(); e.stopPropagation(); } }, true);
	}

	// ----------------------------------------------------------- busca
	_openSearch(root) {
		this._closeMenus(root);
		root.classList.add("is-search-open");
		const input = root.querySelector(".av-search-input");
		requestAnimationFrame(() => input?.focus());
	}

	_closeSearch(root) {
		root.classList.remove("is-search-open");
		const input = root.querySelector(".av-search-input");
		const box = root.querySelector(".av-search-results");
		if (input) { input.value = ""; input.blur(); }
		if (box) { box.hidden = true; box.innerHTML = ""; }
	}

	_searchIndex(ctx) {
		const { model, C } = ctx;
		if (window.__avSearchIndex?.built === model.builtAt) return window.__avSearchIndex.items;
		const items = [];
		for (const a of model.anime) items.push({ kind: "anime", label: a.title, sub: [a.formatLabel, a.year, a.studios[0]].filter(Boolean).join(" · "), path: a.path, key: C.normalizeKey(`${a.title} ${a.titleRomaji} ${a.titleEnglish} ${a.franchise}`), a });
		for (const l of model.lists) items.push({ kind: "list", label: l.title, sub: `${l.items.length} animes`, path: l.path, key: C.normalizeKey(l.title) });
		const cats = (kind, names, pages) => {
			const seen = new Set();
			for (const p of pages) { seen.add(C.normalizeKey(p.title)); items.push({ kind, label: p.title, sub: "", path: p.path, key: C.normalizeKey(p.title) }); }
			for (const n of names) if (!seen.has(C.normalizeKey(n))) { seen.add(C.normalizeKey(n)); items.push({ kind, label: n, sub: "", cat: true, key: C.normalizeKey(n) }); }
		};
		cats("genre", model.anime.flatMap(a => a.genres), model.genres);
		cats("studio", model.anime.flatMap(a => a.studios), model.studios);
		cats("franchise", model.anime.map(a => a.franchise).filter(Boolean), model.franchises);
		window.__avSearchIndex = { built: model.builtAt, items };
		return items;
	}

	_wireSearch(root, ctx) {
		const { U, C } = ctx;
		const input = root.querySelector(".av-search-input");
		const box = root.querySelector(".av-search-results");
		if (!input || !box) return;
		let sel = -1, results = [];
		const kinds = { anime: ["Animes", "tv"], list: ["Listas", "layers"], genre: ["Gêneros", "masks"], studio: ["Estúdios", "building"], franchise: ["Franquias", "film"] };
		const attrsOf = it => it.cat ? `data-action="open-category" data-kind="${it.kind}" data-name="${U.attr(it.label)}" href="#"` : U.openAttrs(it.path);
		const draw = () => {
			const q = C.normalizeKey(input.value);
			if (!q) { box.hidden = true; box.innerHTML = ""; results = []; return; }
			const scored = [];
			for (const it of this._searchIndex(ctx)) {
				const i = it.key.indexOf(q);
				if (i < 0) continue;
				scored.push({ it, s: (i === 0 ? 0 : 1) + it.key.length / 200 });
			}
			scored.sort((a, b) => a.s - b.s);
			const byKind = {};
			for (const { it } of scored) { (byKind[it.kind] ||= []); if (byKind[it.kind].length < (it.kind === "anime" ? 7 : 4)) byKind[it.kind].push(it); }
			results = Object.keys(kinds).flatMap(k => byKind[k] || []);
			sel = results.length ? 0 : -1;
			let n = -1;
			box.innerHTML = (results.length ? Object.keys(kinds).filter(k => byKind[k]?.length).map(k => `<div class="av-search-group"><span class="av-search-label">${kinds[k][0]}</span>${byKind[k].map(it => {
				n++;
				const thumb = it.kind === "anime" ? U.cover(it.a, { cls: "av-cover--xs" }) : `<span class="av-search-ico">${U.icon(kinds[k][1])}</span>`;
				return `<a class="av-search-item${n === 0 ? " is-sel" : ""}" role="option" data-i="${n}" ${attrsOf(it)}>${thumb}<span><b>${U.esc(it.label)}</b>${it.sub ? `<small>${U.esc(it.sub)}</small>` : ""}</span></a>`;
			}).join("")}</div>`).join("") : `<div class="av-search-empty">${U.icon("search")}<span>Nada no vault para “${U.esc(input.value)}”</span></div>`)
				+ `<button type="button" class="av-search-add" data-action="add-anime" data-query="${U.attr(input.value)}">${U.icon("plus")}<span>Buscar “${U.esc(input.value)}” no AniList e adicionar</span></button>`;
			this._wireImages(box);
			box.hidden = false;
		};
		const mark = () => box.querySelectorAll(".av-search-item").forEach(a => { const on = Number(a.dataset.i) === sel; a.classList.toggle("is-sel", on); if (on) a.scrollIntoView({ block: "nearest" }); });
		input.addEventListener("input", draw);
		input.addEventListener("focus", () => { if (input.value) draw(); });
		input.addEventListener("keydown", e => {
			if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(results.length - 1, sel + 1); mark(); }
			else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); mark(); }
			else if (e.key === "Enter") {
				e.preventDefault();
				const el = box.querySelector(`.av-search-item[data-i="${sel}"]`);
				if (el) el.click();
				else if (input.value.trim()) ctx.E.addAnime(ctx, { query: input.value.trim() });
			}
			else if (e.key === "Escape") this._closeSearch(root);
		});
		input.addEventListener("blur", () => setTimeout(() => {
			if (box.contains(document.activeElement)) return;
			box.hidden = true;
			if (!input.value && root.classList.contains("is-search-open") && document.activeElement !== input) root.classList.remove("is-search-open");
		}, 180));
	}

	// "/" ou Ctrl/Cmd+K focam a busca da tela ativa — um listener só
	_bindGlobalKeys() {
		if (window.__avKeysBound) return;
		window.__avKeysBound = true;
		const reapply = () => {
			for (const h of [...(window.__avHosts || [])]) {
				if (!h.isConnected) { window.__avHosts.delete(h); continue; }
				h.__avApply?.();
			}
		};
		const later = () => { this._markScreen(); reapply(); setTimeout(() => { this._markScreen(); reapply(); }, 400); };
		window.addEventListener("resize", later, { passive: true });
		window.addEventListener("orientationchange", later, { passive: true });
		document.addEventListener("visibilitychange", () => { if (!document.hidden) later(); });
		try {
			app.workspace.on("resize", later);
			app.workspace.on("layout-change", later);
			app.workspace.on("active-leaf-change", later);
		} catch (_) {}
		// teclado virtual: a parte da tela coberta vira --av-kb
		const vv = window.visualViewport;
		const isField = el => el?.matches?.("input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]), textarea, select");
		const kbUpdate = () => {
			const covered = vv ? Math.round(window.innerHeight - vv.height - vv.offsetTop) : 0;
			const kb = covered > 80 ? covered : 0;
			document.documentElement.style.setProperty("--av-kb", `${kb}px`);
			document.body.classList.toggle("av-kb-open", kb > 0);
			window.__avInsets = null;
			reapply();
		};
		vv?.addEventListener("resize", kbUpdate, { passive: true });
		document.addEventListener("focusin", e => {
			const el = e.target;
			if (!isField(el) || !el.closest(".av-modal-root, .av-host")) return;
			setTimeout(() => { kbUpdate(); if (document.activeElement === el) el.scrollIntoView({ block: "center", behavior: "smooth" }); }, 320);
		});
		document.addEventListener("focusout", e => { if (isField(e.target)) setTimeout(() => { if (!isField(document.activeElement)) kbUpdate(); }, 400); });
		document.addEventListener("touchstart", () => {}, { passive: true });
		// menus abertos fecham ao clicar fora
		document.addEventListener("click", e => {
			if (e.target.closest?.(".av-menu-wrap")) return;
			document.querySelectorAll(".av-app .av-menu:not([hidden])").forEach(m => { m.hidden = true; });
		}, true);
		document.addEventListener("keydown", e => {
			const t = e.target;
			const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
			const isK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k";
			if (!isK && (e.key !== "/" || typing)) return;
			const input = document.querySelector(".workspace-leaf.mod-active .av-search-input") || document.querySelector(".av-search-input");
			if (!input || document.querySelector(".av-modal-root")) return;
			e.preventDefault(); e.stopPropagation();
			input.closest(".av-app")?.classList.add("is-search-open");
			requestAnimationFrame(() => { input.focus(); input.select(); });
		}, true);
	}

	// ------------------------------------------------- Obsidian mobile
	// Marca no <body> se a aba ativa é uma tela do Anime Vault: o CSS usa
	// isso para o modo aplicativo (some a barra do Obsidian só aqui).
	_markScreen() {
		const on = !!document.querySelector(".workspace-leaf.mod-active .av-layer, .workspace-leaf.mod-active .av-app")
			|| (!document.querySelector(".workspace-leaf.mod-active") && !!document.querySelector(".av-layer"));
		const b = document.body.classList;
		if (b.contains("av-on-screen") !== on) b.toggle("av-on-screen", on);
		if (!on && b.contains("av-app-paused")) b.remove("av-app-paused");
	}

	_obsidian(cmd) {
		const run = (...ids) => {
			for (const id of ids) { try { if (app.commands?.executeCommandById?.(id)) return true; } catch (_) {} }
			return false;
		};
		switch (cmd) {
			case "back": return run("app:go-back");
			case "forward": return run("app:go-forward");
			case "search": return run("global-search:open", "switcher:open");
			case "sidebar":
				try { const L = app.workspace.leftSplit; if (L?.collapsed === false) L.collapse?.(); else if (L?.expand) L.expand(); else run("app:toggle-left-sidebar"); }
				catch (_) { run("app:toggle-left-sidebar"); }
				return;
			case "navbar":
				document.body.classList.add("av-app-paused");
				requestAnimationFrame(() => { for (const h of window.__avHosts || []) h.__avApply?.(); });
				this.toast("Controles do Obsidian visíveis até você trocar de tela", { icon: "rows" });
				return;
			case "edit": return run("markdown:toggle-preview");
		}
	}

	// --------------------------------------------- carrossel do topo
	// Trilha [cópia do último] [1 … n] [cópia do primeiro], movida por
	// transform. Troca a cada 7 s; pausa com o ponteiro em cima, durante o
	// arraste ou com a aba oculta; não roda com "Reduzir animações".
	_wireHeroCarousel(root, surface) {
		const car = root.querySelector("[data-herocar]");
		if (!car) return;
		const track = car.querySelector("[data-herocar-track]");
		const slides = [...track.children];
		const n = slides.length - 2;
		if (n < 2) return;
		const DELAY = 7000, DUR = 650;
		const dots = [...car.querySelectorAll("[data-herocar-dot]")];
		const motion = this._motionOn();
		let pos = 1 + ((window.__avHeroIdx ?? 0) % n), w = car.clientWidth || 1, timer = 0, hover = false, dragging = false;
		const real = () => (pos - 1 + n) % n;
		const place = (animate, dx = 0) => {
			track.style.transition = animate && motion ? `transform ${DUR}ms cubic-bezier(.22,.8,.26,1)` : "none";
			track.style.transform = `translate3d(${-pos * w + dx}px, 0, 0)`;
		};
		const mark = () => {
			const i = real();
			window.__avHeroIdx = i;
			dots.forEach((d, k) => { const on = k === i; d.classList.toggle("is-active", on); d.setAttribute("aria-selected", String(on)); });
			slides.forEach((s, k) => { const on = k === pos; s.classList.toggle("is-current", on); if (!s.hasAttribute("data-clone")) { s.toggleAttribute("inert", !on); s.setAttribute("aria-hidden", String(!on)); } });
			car.style.setProperty("--av-herocar-cycle", `${DELAY}ms`);
			car.classList.toggle("is-alt");
		};
		const settle = () => {
			if (pos === 0) { pos = n; place(false); }
			else if (pos === n + 1) { pos = 1; place(false); }
			mark();
			car.classList.remove("is-moving");
		};
		const go = (to, animate = true) => {
			if (animate && motion) car.classList.add("is-moving");
			pos = to; place(animate); mark();
			if (!(animate && motion)) settle();
			else setTimeout(settle, DUR + 60);
			schedule();
		};
		const schedule = () => {
			clearTimeout(timer); timer = 0;
			if (!car.isConnected) return;
			if (motion && !hover && !dragging && !document.hidden) timer = setTimeout(() => go(pos + 1), DELAY);
			car.classList.toggle("is-ticking", !!timer);
		};
		car.querySelector("[data-herocar-prev]")?.addEventListener("click", () => go(pos - 1));
		car.querySelector("[data-herocar-next]")?.addEventListener("click", () => go(pos + 1));
		dots.forEach((d, k) => d.addEventListener("click", () => go(k + 1)));
		car.addEventListener("keydown", e => {
			if (e.key === "ArrowRight") { e.preventDefault(); go(pos + 1); }
			else if (e.key === "ArrowLeft") { e.preventDefault(); go(pos - 1); }
		});
		car.addEventListener("pointerenter", e => { if (e.pointerType === "mouse") { hover = true; schedule(); } });
		car.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") { hover = false; schedule(); } });
		let x0 = 0, y0 = 0, t0 = 0, dx = 0, axis = null, pid = null, moved = false;
		track.addEventListener("pointerdown", e => {
			if (e.button !== 0 || pid !== null) return;
			if (e.target.closest("button, input, .av-menu")) return;
			const left = (surface?.el || root).getBoundingClientRect().left;
			if (e.pointerType !== "mouse" && e.clientX - left <= 20) return;
			pid = e.pointerId; x0 = e.clientX; y0 = e.clientY; t0 = performance.now(); dx = 0; axis = null; moved = false;
			if (pos === 0 || pos === n + 1) settle();
		});
		track.addEventListener("pointermove", e => {
			if (e.pointerId !== pid) return;
			const mx = e.clientX - x0, my = e.clientY - y0;
			if (!axis) {
				if (Math.abs(mx) < 6 && Math.abs(my) < 6) return;
				axis = Math.abs(mx) > Math.abs(my) ? "x" : "y";
				if (axis === "y") { pid = null; return; }
				dragging = true; moved = true; schedule();
				car.classList.add("is-moving", "is-dragging");
				try { track.setPointerCapture(pid); } catch (_) {}
			}
			dx = Math.abs(mx) > w ? Math.sign(mx) * (w + (Math.abs(mx) - w) * 0.25) : mx;
			place(false, dx);
		});
		const release = e => {
			if (e.pointerId !== pid) return;
			pid = null;
			if (!dragging) return;
			dragging = false; car.classList.remove("is-dragging");
			const v = dx / Math.max(1, performance.now() - t0);
			const step = Math.abs(dx) > w * 0.18 || Math.abs(v) > 0.45 ? (dx < 0 ? 1 : -1) : 0;
			if (step) this._haptic(8);
			go(pos + step);
		};
		track.addEventListener("pointerup", release);
		track.addEventListener("pointercancel", release);
		car.addEventListener("click", e => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
		track.addEventListener("dragstart", e => e.preventDefault());
		if (typeof ResizeObserver === "function") {
			const ro = new ResizeObserver(() => { if (!car.isConnected) return ro.disconnect(); const nw = car.clientWidth; if (nw && nw !== w) { w = nw; place(false); } });
			ro.observe(car);
		}
		document.addEventListener("visibilitychange", () => schedule());
		place(false); mark(); schedule();
	}

	_motionOn() {
		return !document.body.classList.contains("av-reduced-motion") && !matchMedia("(prefers-reduced-motion: reduce)").matches;
	}

	// seções e cards entram suavemente ao aparecer (uma vez, só na navegação)
	_wireMotion(root, surface, refresh) {
		surface.el.__avIO?.disconnect();
		if (refresh || !this._motionOn() || typeof IntersectionObserver !== "function") return;
		const els = [...root.querySelectorAll(".av-content .av-shelf, .av-content .av-block, .av-grid > .av-card, .av-content .av-tiles > *, .av-content .av-eplist > *")];
		if (!els.length) return;
		root.classList.add("av-motion");
		els.forEach(el => el.classList.add("av-reveal"));
		const io = new IntersectionObserver(entries => {
			let n = 0;
			for (const en of entries) {
				if (!en.isIntersecting) continue;
				io.unobserve(en.target);
				const d = Math.min(n++, 8) * 45;
				en.target.style.setProperty("--av-d", `${d}ms`);
				en.target.classList.add("is-inview");
				setTimeout(() => en.target.classList.remove("av-reveal", "is-inview"), 800 + d);
			}
		}, { root: surface.layer ? surface.el : null, rootMargin: "0px 0px -4% 0px" });
		els.forEach(el => io.observe(el));
		surface.el.__avIO = io;
		setTimeout(() => { root.querySelectorAll(".av-reveal:not(.is-inview)").forEach(el => { const r = el.getBoundingClientRect(); if (r.top < window.innerHeight) { el.classList.remove("av-reveal"); io.unobserve(el); } }); }, 2500);
	}

	// --------------------------------------------------------- toque
	_haptic(ms = 8) {
		const b = document.body.classList;
		if (b.contains("av-no-haptics") || !(b.contains("is-mobile") || matchMedia("(hover: none)").matches)) return;
		try {
			const H = window.Capacitor?.Plugins?.Haptics;
			if (H?.impact) { H.impact({ style: ms > 12 ? "MEDIUM" : "LIGHT" }).catch?.(() => {}); return; }
			navigator.vibrate?.(ms);
		} catch (_) {}
	}

	// arrastar para dispensar (janelas de baixo, menu lateral, avisos)
	_swipe(handle, el, { axis = "y", sign = 1, limit = 90, onDismiss, onMove = null }) {
		let sx = 0, sy = 0, t0 = 0, d = 0, active = null;
		const reset = () => { el.style.transition = ""; el.style.transform = ""; onMove?.(0); };
		handle.addEventListener("touchstart", e => {
			if (e.touches.length !== 1 || e.target.closest("input, textarea, select, .av-shelf-track, .av-tabs, .av-fchips")) { active = false; return; }
			const t = e.touches[0]; sx = t.clientX; sy = t.clientY; t0 = performance.now(); d = 0; active = null;
		}, { passive: true });
		handle.addEventListener("touchmove", e => {
			if (active === false) return;
			const t = e.touches[0], dx = t.clientX - sx, dy = t.clientY - sy;
			const main = axis === "y" ? dy : dx, cross = axis === "y" ? dx : dy;
			if (active === null) {
				if (Math.abs(main) < 8 && Math.abs(cross) < 8) return;
				active = Math.abs(main) > Math.abs(cross) && main * sign > 0;
				if (!active) return;
				el.style.transition = "none";
			}
			d = Math.max(0, main * sign);
			el.style.transform = axis === "y" ? `translateY(${d}px)` : `translateX(${d * sign}px)`;
			onMove?.(d);
		}, { passive: true });
		const end = () => {
			if (!active) { active = null; return; }
			active = null;
			const v = d / Math.max(1, performance.now() - t0);
			if (d > limit || (v > 0.6 && d > 24)) {
				this._haptic();
				el.style.transition = "";
				requestAnimationFrame(() => { el.style.transform = ""; onDismiss(); });
			} else reset();
		};
		handle.addEventListener("touchend", end, { passive: true });
		handle.addEventListener("touchcancel", end, { passive: true });
	}

	// Celular: puxar o topo para baixo atualiza (Início sincroniza o AniList);
	// deslizar a partir da borda esquerda volta.
	_wireGestures(root, surface, ctx) {
		if (!surface.layer) return;
		const layer = surface.el;
		layer.__avScreen = { root, ctx };
		if (layer.__avGestures) return;
		layer.__avGestures = true;
		const PULL = 70, EDGE = 20, BACK = 90;
		let mode = null, x0 = 0, y0 = 0, d = 0, armed = false, busy = false;
		const cur = () => layer.__avScreen;
		const touchOk = () => { const r = cur()?.root; return r?.isConnected && r.classList.contains("is-touch") && r.querySelector(".av-drawer")?.hidden !== false && !document.querySelector(".av-modal-root"); };
		const indicator = cls => {
			const r = cur().root;
			let el = r.querySelector(`:scope > .${cls}`);
			if (!el) { el = document.createElement("div"); el.className = cls; el.innerHTML = this.mods().U.icon(cls === "av-ptr" ? "refresh" : "chevronLeft"); r.appendChild(el); }
			return el;
		};
		const pullAction = () => {
			const { root: r, ctx: c } = cur();
			if (r.dataset.page === "home" && c.AL?.getConfig().user) return c.AL.syncProfile(c);
			if (r.dataset.page === "calendar" && c.AL) return c.AL.refreshMany(c, null, { onlyAiring: true });
			this.refresh();
			this.toast("Tela atualizada", { icon: "refresh", tone: "ok" });
			return Promise.resolve();
		};
		layer.addEventListener("touchstart", e => {
			mode = null; armed = false; d = 0;
			if (e.touches.length !== 1 || !touchOk()) return;
			const t = e.touches[0], lr = layer.getBoundingClientRect();
			x0 = t.clientX; y0 = t.clientY;
			if (x0 - lr.left <= EDGE) { mode = "edge?"; e.stopPropagation(); return; }
			if (!busy && layer.scrollTop <= 0 && !e.target.closest(".av-search, input, textarea, select, [data-herocar]")) mode = "pull?";
		}, { passive: true, capture: true });
		layer.addEventListener("touchmove", e => {
			if (!mode) return;
			const t = e.touches[0], dx = t.clientX - x0, dy = t.clientY - y0;
			if (mode === "edge?") {
				if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
				mode = dx > 0 && Math.abs(dx) > Math.abs(dy) ? "edge" : null;
				if (!mode) return;
			}
			if (mode === "pull?") {
				if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
				mode = dy > 0 && Math.abs(dy) > Math.abs(dx) && layer.scrollTop <= 0 ? "pull" : null;
				if (!mode) return;
			}
			e.stopPropagation();
			if (mode === "edge") {
				d = Math.max(0, dx);
				const el = indicator("av-back"), p = Math.min(1, d / BACK);
				el.style.transform = `translate3d(${Math.min(d * 0.6, 64) - 48}px, -50%, 0) scale(${0.7 + p * 0.3})`;
				el.style.opacity = String(Math.min(1, p * 1.4));
				if (!armed && d >= BACK) { armed = true; el.classList.add("is-armed"); this._haptic(); }
				else if (armed && d < BACK) { armed = false; el.classList.remove("is-armed"); }
			} else {
				if (layer.scrollTop > 0) return;
				d = Math.max(0, dy) * 0.5;
				const el = indicator("av-ptr");
				el.style.transform = `translate3d(-50%, ${Math.min(d, 96) - 56}px, 0) rotate(${d * 3}deg)`;
				el.style.opacity = String(Math.min(1, d / PULL));
				if (!armed && d >= PULL) { armed = true; el.classList.add("is-armed"); this._haptic(); }
				else if (armed && d < PULL) { armed = false; el.classList.remove("is-armed"); }
			}
		}, { passive: true, capture: true });
		const end = () => {
			const m = mode; mode = null;
			if (m === "edge") {
				const el = cur()?.root?.querySelector(":scope > .av-back");
				if (el) { el.style.transform = ""; el.style.opacity = ""; el.classList.remove("is-armed"); }
				if (armed) this._goBack(cur());
			} else if (m === "pull") {
				const el = cur()?.root?.querySelector(":scope > .av-ptr");
				if (!el) return;
				if (!armed) { el.style.transform = ""; el.style.opacity = ""; return; }
				busy = true;
				el.classList.remove("is-armed"); el.classList.add("is-busy");
				el.style.transform = "translate3d(-50%, 18px, 0)"; el.style.opacity = "1";
				Promise.resolve(pullAction()).catch(() => {}).finally(() => { busy = false; el.classList.remove("is-busy"); el.style.transform = ""; el.style.opacity = ""; });
			}
			armed = false;
		};
		layer.addEventListener("touchend", end, { passive: true, capture: true });
		layer.addEventListener("touchcancel", end, { passive: true, capture: true });
		// arrasto vertical dentro do app é rolagem: não chega aos gestos do
		// Obsidian (puxar para baixo abre a paleta de comandos)
		let gx = 0, gy = 0, vertical = null;
		layer.addEventListener("touchstart", e => { vertical = null; if (e.touches.length === 1) { gx = e.touches[0].clientX; gy = e.touches[0].clientY; } }, { passive: true, capture: true });
		layer.addEventListener("touchmove", e => {
			if (e.touches.length !== 1) return;
			if (vertical === null) {
				const dx = Math.abs(e.touches[0].clientX - gx), dy = Math.abs(e.touches[0].clientY - gy);
				if (Math.max(dx, dy) < 6) return e.stopPropagation();
				vertical = dy >= dx;
				if (!vertical) return;
			}
			if (vertical) e.stopPropagation();
		}, { passive: true });
		layer.addEventListener("touchend", e => { if (vertical) e.stopPropagation(); vertical = null; }, { passive: true });
	}

	_goBack(screen) {
		const leaf = app.workspace.getMostRecentLeaf?.() || app.workspace.activeLeaf;
		const back = leaf?.history?.backHistory;
		if (Array.isArray(back) && !back.length) {
			if (screen?.root?.dataset.page !== "home") this.open("Dashboard/Home", screen?.ctx);
			return;
		}
		this._obsidian("back");
	}

	_smooth() { return this._motionOn() ? "smooth" : "auto"; }

	_closeMenus(root) {
		root.querySelectorAll(".av-menu:not([hidden])").forEach(m => {
			m.hidden = true;
			m.closest(".av-menu-wrap")?.querySelector('[data-action="menu"]')?.setAttribute("aria-expanded", "false");
		});
	}

	_openDrawer(root) {
		const d = root.querySelector(".av-drawer");
		if (!d) return;
		const layer = root.closest(".av-layer");
		if (layer) {
			d.style.top = `${layer.scrollTop}px`;
			d.style.height = `${layer.clientHeight}px`;
			d.style.bottom = "auto";
			layer.classList.add("is-locked");
		}
		d.hidden = false;
		requestAnimationFrame(() => d.classList.add("is-open"));
		this._haptic();
		const panel = d.querySelector(".av-drawer-panel"), back = d.querySelector(".av-drawer-backdrop");
		if (panel && !d.__avSwipe) {
			d.__avSwipe = true;
			this._swipe(panel, panel, {
				axis: "x", sign: -1, limit: 80,
				onMove: px => { if (back) back.style.opacity = px ? String(Math.max(0, 1 - px / panel.offsetWidth)) : ""; },
				onDismiss: () => { if (back) back.style.opacity = ""; this._closeDrawer(root); }
			});
		}
	}

	_closeDrawer(root) {
		const d = root.querySelector(".av-drawer");
		if (!d || d.hidden) return;
		d.classList.remove("is-open");
		root.closest(".av-layer")?.classList.remove("is-locked");
		setTimeout(() => { if (!d.isConnected) return; d.hidden = true; d.style.top = d.style.height = d.style.bottom = ""; }, 220);
	}

	// abas que rolam para o lado: trazem a ativa para a vista
	_wireTabs(root) {
		root.querySelectorAll(".av-tabs").forEach(tabs => {
			const update = () => {
				const max = tabs.scrollWidth - tabs.clientWidth;
				tabs.classList.toggle("has-more-right", max > 2 && tabs.scrollLeft < max - 2);
				tabs.classList.toggle("has-more-left", max > 2 && tabs.scrollLeft > 2);
			};
			tabs.addEventListener("scroll", update, { passive: true });
			tabs.addEventListener("av-measure", update);
			requestAnimationFrame(() => {
				const t = tabs.querySelector(".av-tab.is-active");
				if (t) {
					const tr = tabs.getBoundingClientRect(), r = t.getBoundingClientRect();
					if (r.right > tr.right) tabs.scrollLeft += r.right - tr.right + 16;
					else if (r.left < tr.left) tabs.scrollLeft -= tr.left - r.left + 16;
				}
				update();
			});
		});
	}

	// faixas horizontais ficam com o arrasto lateral (não abre as barras do Obsidian)
	_wireHorizontalScrollers(root) {
		root.querySelectorAll(".av-tabs, .av-shelf-track, .av-hscroll, .av-fchips--scroll, [data-herocar]").forEach(el => {
			let sx = 0, sy = 0, horizontal = null;
			el.addEventListener("touchstart", e => {
				const t = e.touches[0]; sx = t.clientX; sy = t.clientY; horizontal = null;
				if (el.scrollWidth > el.clientWidth + 1 || el.matches("[data-herocar]")) e.stopPropagation();
			}, { passive: true });
			el.addEventListener("touchmove", e => {
				if (el.scrollWidth <= el.clientWidth + 1 && !el.matches("[data-herocar]")) return;
				const t = e.touches[0];
				if (horizontal === null) horizontal = Math.abs(t.clientX - sx) > Math.abs(t.clientY - sy);
				if (horizontal) e.stopPropagation();
			}, { passive: true });
			el.addEventListener("touchend", e => { if (horizontal) e.stopPropagation(); }, { passive: true });
		});
	}

	_wireShelves(root) {
		root.querySelectorAll(".av-shelf").forEach(shelf => {
			const track = shelf.querySelector(".av-shelf-track");
			if (!track) return;
			const state = () => {
				const max = track.scrollWidth - track.clientWidth - 2;
				shelf.classList.toggle("is-scrollable", max > 0);
				shelf.classList.toggle("at-start", track.scrollLeft <= 2);
				shelf.classList.toggle("at-end", track.scrollLeft >= max);
			};
			track.addEventListener("scroll", state, { passive: true });
			shelf.addEventListener("av-measure", state);
			requestAnimationFrame(state);
		});
	}

	// fade-in quando a imagem carrega; imagem quebrada some e deixa o fallback
	_wireImages(root) {
		root.querySelectorAll("img[data-av-img]").forEach(img => {
			const done = () => img.classList.add("is-loaded");
			const fail = () => { img.classList.add("is-broken"); img.closest(".av-cover")?.classList.add("is-missing"); };
			if (img.complete && img.naturalWidth) done();
			else { img.addEventListener("load", done, { once: true }); img.addEventListener("error", fail, { once: true }); }
		});
	}

	// ------------------------------------------------------------ favorito
	async _toggleFeatured(el, path) {
		const file = path && app.vault.getAbstractFileByPath(path);
		if (!file) return;
		const on = !el.dataset.on;
		try {
			await app.fileManager.processFrontMatter(file, fm => { fm.featuredOnHome = on; });
			this.toast(on ? "Em destaque no Início" : "Removido dos destaques do Início", { icon: "sparkles", tone: on ? "ok" : "" });
		} catch (err) { this.toast(`Não foi possível salvar: ${err.message}`, { tone: "error" }); }
	}

	async _toggleFavorite(el, path, root) {
		const file = app.vault.getAbstractFileByPath(path);
		if (!file) return;
		const on = !(el.getAttribute("aria-pressed") === "true");
		const U = this.mods().U;
		root.querySelectorAll(`[data-action="favorite"][data-path="${CSS.escape(path)}"]`).forEach(b => {
			b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", String(on));
			b.title = on ? "Remover dos favoritos" : "Favoritar";
			const svg = b.querySelector("svg");
			if (svg) svg.outerHTML = U.icon(on ? "bookmarkFill" : "bookmark");
			const label = b.querySelector("span");
			if (label && b.classList.contains("av-btn")) label.textContent = on ? "Nos favoritos" : "Favoritar";
			if (on && this._motionOn()) { b.classList.remove("is-pop"); void b.offsetWidth; b.classList.add("is-pop"); setTimeout(() => b.classList.remove("is-pop"), 600); }
		});
		if (on) this._haptic(14);
		try {
			await app.fileManager.processFrontMatter(file, fm => { fm.favorite = on; });
			this.toast(on ? "Adicionado aos favoritos" : "Removido dos favoritos", { icon: on ? "bookmarkFill" : "bookmark", tone: on ? "ok" : "" });
		} catch (err) { this.toast(`Não foi possível salvar: ${err.message}`, { tone: "error" }); }
	}

	// ============================================================== avisos
	toast(message, { tone = "", icon = "", sticky = false, progress = null, action = null } = {}) {
		const U = this.mods().U;
		let stack = document.querySelector(".av-toasts");
		if (!stack) { stack = document.createElement("div"); stack.className = "av-toasts av-host animevault"; stack.setAttribute("role", "status"); stack.setAttribute("aria-live", "polite"); document.body.appendChild(stack); }
		const el = document.createElement("div");
		const ic = icon || ({ ok: "check", error: "alert", warn: "alert" })[tone] || "info";
		let act = action;
		const paint = (msg, t, p) => {
			el.className = `av-toast${t ? ` av-toast--${t}` : ""}`;
			el.innerHTML = `<span class="av-toast-icon">${U.icon(ic)}</span><span class="av-toast-text">${U.esc(msg)}</span>${act ? `<button type="button" class="av-toast-action">${U.esc(act.label)}</button>` : ""}${p !== null && p !== undefined ? `<span class="av-toast-progress"><span style="width:${Math.max(0, Math.min(100, p))}%"></span></span>` : ""}`;
			el.querySelector(".av-toast-action")?.addEventListener("click", () => { const run = act?.run; act = null; api.close(0); run?.(); });
		};
		let timer = null;
		const api = {
			el,
			update: (msg, { tone: t = tone, progress: p = null } = {}) => { paint(msg, t, p); el.classList.add("is-in"); },
			close: (ms = 0) => { clearTimeout(timer); timer = setTimeout(() => { el.classList.remove("is-in"); setTimeout(() => el.remove(), 250); }, ms); }
		};
		paint(message, tone, progress);
		stack.appendChild(el);
		requestAnimationFrame(() => el.classList.add("is-in"));
		if (!sticky) api.close(tone === "error" ? 7000 : action ? 5500 : 3200);
		for (const sign of [1, -1]) this._swipe(el, el, { axis: "x", sign, limit: 70, onDismiss: () => { el.style.transform = `translateX(${sign * 120}%)`; el.style.opacity = "0"; api.close(0); } });
		return api;
	}

	// ============================================================== janela
	// Painel próprio: fundo, cabeçalho, corpo, ações; Esc fecha; foco preso
	// dentro. No celular vira painel de baixo (arrastar o topo fecha).
	modal({ title, sub = "", body = "", actions = "", size = "md", onClose = null, cls = "" } = {}) {
		const U = this.mods().U;
		const opener = document.activeElement;
		const wrap = document.createElement("div");
		wrap.className = "av-modal-root av-host animevault";
		const id = `av-modal-${Date.now()}`;
		wrap.innerHTML = `<div class="av-modal-backdrop" data-close></div>
			<div class="av-modal av-modal--${size} ${cls}" role="dialog" aria-modal="true" aria-labelledby="${id}">
				<header class="av-modal-head"><div><h2 id="${id}">${U.esc(title)}</h2>${sub ? `<p>${U.esc(sub)}</p>` : ""}</div>
					<button type="button" class="av-btn av-btn--ghost av-btn--icon" data-close aria-label="Fechar">${U.icon("x")}</button></header>
				<div class="av-modal-body"></div>
				${actions ? `<footer class="av-modal-foot">${actions}</footer>` : ""}
			</div>`;
		const bodyEl = wrap.querySelector(".av-modal-body");
		const sheet = wrap.querySelector(".av-modal");
		if (typeof body === "string") bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);
		document.body.appendChild(wrap);
		this._wireImages(wrap);
		requestAnimationFrame(() => wrap.classList.add("is-open"));
		let closed = false;
		const close = () => {
			if (closed) return; closed = true;
			wrap.classList.remove("is-open");
			document.removeEventListener("keydown", onKey, true);
			setTimeout(() => wrap.remove(), 220);
			onClose?.();
			opener?.focus?.({ preventScroll: true });
		};
		const focusables = () => [...wrap.querySelectorAll('button, [href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])')].filter(el => !el.disabled && el.offsetParent !== null);
		const onKey = e => {
			if (e.key === "Escape") { e.stopPropagation(); close(); }
			else if (e.key === "Tab") {
				const f = focusables(); if (!f.length) return;
				if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
				else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
			}
		};
		document.addEventListener("keydown", onKey, true);
		wrap.addEventListener("click", e => { if (e.target.closest("[data-close]")) close(); });
		if (size !== "full" && (document.body.classList.contains("is-mobile") || matchMedia("(max-width: 760px)").matches)) {
			sheet.classList.add("is-sheet");
			const backdrop = wrap.querySelector(".av-modal-backdrop");
			this._swipe(wrap.querySelector(".av-modal-head"), sheet, {
				axis: "y", sign: 1, limit: 100,
				onMove: px => { backdrop.style.opacity = px ? String(Math.max(0.2, 1 - px / 400)) : ""; },
				onDismiss: () => { backdrop.style.opacity = ""; close(); }
			});
		}
		const touch = document.body.classList.contains("is-mobile") || matchMedia("(hover: none)").matches;
		sheet.setAttribute("tabindex", "-1");
		setTimeout(() => {
			if (touch) sheet.focus({ preventScroll: true });
			else (wrap.querySelector("[autofocus]") || focusables().find(el => !el.hasAttribute("data-close")) || focusables()[0])?.focus();
		}, 60);
		return { el: wrap, body: bodyEl, close };
	}

	confirm({ title, text = "", confirm = "Confirmar", danger = false }) {
		const U = this.mods().U;
		return new Promise(resolve => {
			let answered = false;
			const m = this.modal({
				title, size: "sm", body: text ? `<p class="av-modal-text">${U.esc(text)}</p>` : "",
				actions: `${U.btn("Cancelar", { kind: "ghost", attrs: "data-close" })}${U.btn(confirm, { kind: danger ? "danger" : "primary", attrs: "data-ok" })}`,
				onClose: () => { if (!answered) resolve(false); }
			});
			m.el.querySelector("[data-ok]").addEventListener("click", () => { answered = true; resolve(true); m.close(); });
		});
	}
}
