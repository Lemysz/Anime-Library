// ==========================================================================
// Anime Vault — Editor
// Todos os formulários, montados dentro das janelas do AnimeVault.modal():
// adicionar (AniList ou manual), editar detalhes, diário de episódios,
// análise e nota, listas, identidade das categorias e o sorteio.
// Toda escrita passa por app.fileManager.processFrontMatter (a nota é a
// fonte da verdade; o Dataview re-renderiza sozinho).
//
// Acesso: customJS.AnimeVaultEditor
// ==========================================================================

class AnimeVaultEditor {

	// ------------------------------------------------------------ campos
	_field(label, input, hint = "", cls = "") {
		return `<label class="av-formfield${cls ? ` ${cls}` : ""}"><span class="av-label">${label}</span>${input}${hint ? `<small class="av-hint">${hint}</small>` : ""}</label>`;
	}
	_text(name, value, { placeholder = "", type = "text", attrs = "" } = {}) {
		const U = customJS.AnimeVaultUI;
		return `<input class="av-input" type="${type}" name="${name}" value="${U.attr(value ?? "")}" placeholder="${U.attr(placeholder)}" autocomplete="off" spellcheck="false" ${attrs}>`;
	}
	_select(name, options, value) {
		const U = customJS.AnimeVaultUI;
		return `<select class="av-select" name="${name}">${options.map(([v, l]) => `<option value="${U.attr(v)}"${String(v) === String(value ?? "") ? " selected" : ""}>${U.esc(l)}</option>`).join("")}</select>`;
	}
	_area(name, value, { rows = 4, placeholder = "" } = {}) {
		const U = customJS.AnimeVaultUI;
		return `<textarea class="av-input av-textarea" name="${name}" rows="${rows}" placeholder="${U.attr(placeholder)}">${U.esc(value ?? "")}</textarea>`;
	}
	_read(form) {
		const out = {};
		form.querySelectorAll("[name]").forEach(el => {
			if (el.type === "checkbox") { if (el.dataset.group) { (out[el.dataset.group] ||= []); if (el.checked) out[el.dataset.group].push(el.value); } else out[el.name] = el.checked; }
			else out[el.name] = el.value.trim();
		});
		return out;
	}
	_list(s) { return String(s || "").split(/[,;\n]/).map(x => x.trim()).filter(Boolean); }
	_num(s) { const n = Number(String(s ?? "").replace(",", ".")); return String(s ?? "").trim() !== "" && Number.isFinite(n) ? n : ""; }

	// imagem do aparelho → Assets/<pasta>/<nome>.<ext>
	async _saveImage(file, folder, base) {
		const C = customJS.AnimeVaultCore;
		const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
		if (!["jpg", "jpeg", "png", "webp", "gif", "avif"].includes(ext)) throw new Error("Formato de imagem não suportado");
		await C.ensureFolder(folder);
		const safe = C.safeFileName(base, "imagem");
		let path = `${folder}/${safe}.${ext}`, n = 2;
		while (app.vault.getAbstractFileByPath(path)) path = `${folder}/${safe} ${n++}.${ext}`;
		await app.vault.createBinary(path, await file.arrayBuffer());
		return path;
	}

	_pickers(form, ctx, title) {
		const { C } = ctx;
		form.querySelectorAll("[data-upload]").forEach(inp => inp.addEventListener("change", async () => {
			const f = inp.files?.[0];
			if (!f) return;
			const kind = inp.dataset.upload;
			try {
				const path = await this._saveImage(f, kind === "banner" ? C.folders.banners : C.folders.covers, `${title() || "anime"}${kind === "banner" ? "-banner" : ""}`);
				form.querySelector(`[name="${kind}"]`).value = path;
				ctx.V.toast("Imagem salva no vault", { tone: "ok", icon: "image" });
			} catch (err) { ctx.V.toast(`Não foi possível salvar a imagem: ${err.message}`, { tone: "error" }); }
		}));
	}

	// ======================================================= ADICIONAR
	// Busca no AniList (capa, banner, episódios, estúdio, gêneros) com a
	// escolha do status; ou o formulário manual, sem rede.
	addAnime(ctx, { query = "", status = "" } = {}) {
		const { U, C, V, AL, model } = ctx;
		const body = document.createElement("div");
		body.className = "av-host av-add";
		const st = status && C.statusDefs[status] ? status : "Planning";
		body.innerHTML = `<div class="av-add-search">
				<label class="av-field av-field--search av-field--lg">${U.icon("search")}<input type="search" class="av-input" data-add-q placeholder="Nome do anime (romaji, inglês ou japonês)" value="${U.attr(query)}" autocomplete="off" spellcheck="false" autofocus></label>
			</div>
			<div class="av-add-status"><span>Adicionar como</span><div class="av-segmented" role="radiogroup">${["Planning", "Watching", "Completed"].map(k => `<button type="button" data-add-status="${k}" class="${k === st ? "is-active" : ""}">${U.esc(C.statusLabel(k))}</button>`).join("")}</div></div>
			<div class="av-add-results" data-add-results>${AL ? `<p class="av-add-hint">${U.icon("b-anilist")}Digite para buscar no AniList.</p>` : `<p class="av-add-hint">${U.icon("info")}O módulo do AniList não está carregado. Use o formulário manual.</p>`}</div>
			<button type="button" class="av-ovlink av-add-manual" data-add-manual>${U.icon("edit")}<span>Adicionar sem AniList (manual)</span></button>`;
		const m = V.modal({ title: "Adicionar anime", sub: "Os dados vêm do AniList; o progresso fica na sua nota", size: "lg", body });
		let status_ = st, timer = 0, seq = 0;
		const inVault = new Map(model.anime.filter(a => a.anilistId).map(a => [String(a.anilistId), a]));
		const results = body.querySelector("[data-add-results]");
		const input = body.querySelector("[data-add-q]");
		body.querySelectorAll("[data-add-status]").forEach(b => b.addEventListener("click", () => {
			status_ = b.dataset.addStatus;
			body.querySelectorAll("[data-add-status]").forEach(x => x.classList.toggle("is-active", x === b));
		}));
		body.querySelector("[data-add-manual]").addEventListener("click", () => { m.close(); this.manualAnime(ctx, { title: input.value.trim(), status: status_ }); });
		const draw = list => {
			if (!list.length) { results.innerHTML = `<p class="av-add-hint">${U.icon("search")}Nada encontrado no AniList para “${U.esc(input.value)}”.</p>`; return; }
			results.innerHTML = list.map(r => {
				const have = inVault.get(String(r.id));
				return `<div class="av-addres${have ? " is-have" : ""}">
					<span class="av-addres-cover">${r.cover ? `<img src="${U.attr(r.cover)}" alt="" loading="lazy" data-av-img>` : U.icon("tv")}</span>
					<span class="av-addres-body"><b>${U.esc(r.title)}</b><small>${U.esc([C.formatLabel(r.format), r.year, r.episodes ? U.plural(r.episodes, "episódio", "episódios") : "", r.studio].filter(Boolean).join(" · "))}</small><span class="av-addres-genres">${r.genres.slice(0, 4).map(g => `<i>${U.esc(C.genreLabel(g))}</i>`).join("")}</span>${r.titleNative ? `<small class="av-addres-native">${U.esc(r.titleNative)}</small>` : ""}</span>
					${have ? `<a class="av-btn av-btn--ghost av-btn--sm" ${U.openAttrs(have.path)} data-close>${U.icon("eye")}<span>Na biblioteca</span></a>` : `<button type="button" class="av-btn av-btn--primary av-btn--sm" data-add-id="${r.id}">${U.icon("plus")}<span>Adicionar</span></button>`}
				</div>`;
			}).join("");
			V._wireImages(results);
		};
		const run = async () => {
			const q = input.value.trim();
			if (!AL || q.length < 2) return;
			const my = ++seq;
			results.innerHTML = `<p class="av-add-hint is-busy">${U.icon("refresh")}Buscando no AniList…</p>`;
			try {
				const list = await AL.search(q);
				if (my !== seq) return;
				draw(list);
			} catch (err) {
				if (my !== seq) return;
				results.innerHTML = `<p class="av-add-hint is-error">${U.icon("cloudOff")}${U.esc(AL.message(err))} <button type="button" class="av-ovlink" data-add-manual2>Adicionar manualmente</button></p>`;
				results.querySelector("[data-add-manual2]")?.addEventListener("click", () => { m.close(); this.manualAnime(ctx, { title: q, status: status_ }); });
			}
		};
		input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(run, 420); });
		input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); clearTimeout(timer); run(); } });
		results.addEventListener("click", async e => {
			const b = e.target.closest("[data-add-id]");
			if (b) {
				b.disabled = true;
				b.querySelector("span").textContent = "Adicionando…";
				try {
					const file = await AL.createFromId(ctx, b.dataset.addId, { status: status_ });
					m.close();
					V.toast(`${file.basename} adicionado`, { tone: "ok", icon: "plus" });
					setTimeout(() => V.open(file.path, ctx), 250);
				} catch (err) {
					b.disabled = false; b.querySelector("span").textContent = "Adicionar";
					V.toast(`Não foi possível adicionar: ${AL.message(err)}`, { tone: "error" });
				}
				return;
			}
			if (e.target.closest("[data-open]")) { e.preventDefault(); m.close(); V.open(e.target.closest("[data-open]").dataset.open, ctx); }
		});
		if (query) run();
	}

	manualAnime(ctx, { title = "", status = "Planning" } = {}) {
		const { U, C, V } = ctx;
		const form = document.createElement("form");
		form.className = "av-host av-form";
		form.innerHTML = `<div class="av-formgrid">
			${this._field("Título", this._text("title", title, { placeholder: "Ex.: Frieren", attrs: "required autofocus" }), "", "is-wide")}
			${this._field("Formato", this._select("format", Object.entries(C.formatDefs).map(([k, v]) => [k, v.label]), "TV"))}
			${this._field("Status", this._select("status", Object.entries(C.statusDefs).map(([k, v]) => [k, v.label]), status))}
			${this._field("Episódios", this._text("episodes", "", { type: "number", attrs: 'min="0" inputmode="numeric"' }))}
			${this._field("Duração (min)", this._text("duration", "24", { type: "number", attrs: 'min="1" inputmode="numeric"' }))}
			${this._field("Temporada", this._select("season", [["", "—"], ...Object.entries(C.seasonDefs).map(([k, v]) => [k, v.label])], ""))}
			${this._field("Ano", this._text("seasonYear", "", { type: "number", attrs: 'min="1900" max="2100" inputmode="numeric"' }))}
			${this._field("Estúdio", this._text("studio", "", { placeholder: "Separe por vírgula" }))}
			${this._field("Gêneros", this._text("genre", "", { placeholder: "Ação, Fantasia…" }))}
			${this._field("Sinopse", this._area("summary", "", { rows: 3 }), "", "is-wide")}
			${this._field("Capa", `<div class="av-fileline">${this._text("cover", "", { placeholder: "Assets/Covers/… ou https://…" })}<label class="av-btn av-btn--ghost av-btn--sm">${U.icon("upload")}<span>Do aparelho</span><input type="file" accept="image/*" data-upload="cover" hidden></label></div>`, "", "is-wide")}
		</div>`;
		const m = V.modal({ title: "Adicionar manualmente", sub: "Dá para ligar ao AniList depois, em Editar detalhes", size: "md", body: form, actions: `${U.btn("Cancelar", { kind: "ghost", attrs: "data-close" })}${U.btn("Criar", { kind: "primary", icon: "plus", attrs: "data-save" })}` });
		this._pickers(form, ctx, () => form.querySelector('[name="title"]').value);
		const save = async () => {
			const v = this._read(form);
			if (!v.title) { form.querySelector('[name="title"]').focus(); return V.toast("Informe o título", { tone: "warn" }); }
			try {
				const file = await C.createAnimeNote({
					title: v.title, format: v.format, status: v.status, episodes: this._num(v.episodes), duration: this._num(v.duration) || 24,
					season: v.season, seasonYear: this._num(v.seasonYear), studio: this._list(v.studio), genre: this._list(v.genre), summary: v.summary, cover: v.cover,
					startDate: ["Watching", "Completed"].includes(v.status) ? C.today() : "", completionDate: v.status === "Completed" ? C.today() : "",
					episodesWatched: v.status === "Completed" && this._num(v.episodes) ? this._num(v.episodes) : 0
				});
				m.close();
				V.toast(`${file.basename} criado`, { tone: "ok" });
				setTimeout(() => V.open(file.path, ctx), 250);
			} catch (err) { V.toast(`Não foi possível criar: ${err.message}`, { tone: "error" }); }
		};
		m.el.querySelector("[data-save]").addEventListener("click", save);
		form.addEventListener("submit", e => { e.preventDefault(); save(); });
	}

	// ======================================================= EDITAR
	editAnime(ctx, path) {
		const { U, C, V, model } = ctx;
		const a = model.animeByPath.get(path);
		const file = app.vault.getAbstractFileByPath(path);
		if (!a || !file) return V.toast("Anime não encontrado", { tone: "error" });
		const p = a.page;
		const genres = [...new Set([...model.anime.flatMap(x => x.genres), ...Object.values(C.genreNames)])].sort((x, y) => x.localeCompare(y));
		const audio = a.audio.map(x => C.normalizeKey(x));
		const form = document.createElement("form");
		form.className = "av-host av-form";
		form.innerHTML = `<datalist id="av-genres">${genres.map(g => `<option value="${U.attr(g)}">`).join("")}</datalist>
			<fieldset class="av-fieldset"><legend>Identificação</legend><div class="av-formgrid">
				${this._field("Título", this._text("title", a.title), "", "is-wide")}
				${this._field("Romaji", this._text("titleRomaji", a.titleRomaji))}
				${this._field("Inglês", this._text("titleEnglish", a.titleEnglish))}
				${this._field("Japonês", this._text("titleNative", a.titleNative))}
				${this._field("Formato", this._select("format", Object.entries(C.formatDefs).map(([k, v]) => [k, v.label]), a.format))}
				${this._field("AniList ID", this._text("anilistId", a.anilistId, { placeholder: "número de anilist.co/anime/…", attrs: 'inputmode="numeric" data-f-anilist' }), "Com o ID, Atualizar do AniList preenche o resto")}
				${this._field("MyAnimeList ID", this._text("malId", a.malId, { attrs: 'inputmode="numeric"' }))}
			</div></fieldset>
			<fieldset class="av-fieldset"><legend>Progresso</legend><div class="av-formgrid">
				${this._field("Status", this._select("status", Object.entries(C.statusDefs).map(([k, v]) => [k, v.label]), a.status))}
				${this._field("Episódios assistidos", this._text("episodesWatched", a.watched, { type: "number", attrs: 'min="0" inputmode="numeric"' }), "Mudar aqui não grava no diário")}
				${this._field("Total de episódios", this._text("episodes", a.episodes ?? "", { type: "number", attrs: 'min="0" inputmode="numeric"' }))}
				${this._field("Duração (min)", this._text("duration", p.duration ?? a.duration, { type: "number", attrs: 'min="1" inputmode="numeric"' }))}
				${this._field("Começou", this._text("startDate", a.startDate, { type: "date" }))}
				${this._field("Concluiu", this._text("completionDate", a.completionDate, { type: "date" }))}
				${this._field("Reassistido (vezes)", this._text("rewatches", a.rewatches, { type: "number", attrs: 'min="0" inputmode="numeric"' }))}
				${C.scale() === 10 ? this._field("Nota (1–10)", `<select class="av-select" name="rating10">${[["0", "—"], ...[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(n => [String(n), `(${n}) ${C.malScores[n]}`])].map(([v, l]) => `<option value="${v}"${String(C.score10(a.rating)) === v ? " selected" : ""}>${U.esc(l)}</option>`).join("")}</select>`) : this._field("Nota (0–5)", this._text("rating", a.rating || "", { type: "number", attrs: 'min="0" max="5" step="0.5" inputmode="decimal"' }))}
				${this._field("Fonte", this._text("source", a.source, { placeholder: "Mangá, Light novel, Original…" }))}
				${this._field("Demografia", this._text("demographic", a.demographic.join(", "), { placeholder: "Shounen, Seinen…" }))}
			</div></fieldset>
			<fieldset class="av-fieldset"><legend>Exibição</legend><div class="av-formgrid">
				${this._field("Temporada", this._select("season", [["", "—"], ...Object.entries(C.seasonDefs).map(([k, v]) => [k, v.label])], a.season))}
				${this._field("Ano", this._text("seasonYear", a.seasonYear ?? "", { type: "number", attrs: 'min="1900" max="2100" inputmode="numeric"' }))}
				${this._field("Situação", this._select("airingStatus", [["", "—"], ...Object.entries(C.airingDefs).map(([k, v]) => [k, v.label])], a.airing))}
				${this._field("Dia dos episódios", this._select("airingDay", [["", "—"], ...C.weekdays.map(d => [d, d])], a.airingDay !== null ? C.weekdays[a.airingDay] : ""), "Para o calendário sem AniList")}
				${this._field("Horário", this._text("airingTime", a.airingTime, { type: "time" }))}
				${this._field("Estreia", this._text("airedFrom", a.airedFrom, { type: "date" }))}
			</div></fieldset>
			<fieldset class="av-fieldset"><legend>Organização</legend><div class="av-formgrid">
				${this._field("Gêneros", this._text("genre", a.genres.join(", "), { attrs: 'list="av-genres"' }), "Separe por vírgula", "is-wide")}
				${this._field("Estúdio", this._text("studio", a.studios.join(", ")))}
				${this._field("Tags", this._text("tags", a.tags.join(", ")))}
				${this._field("Franquia", this._text("franchise", a.franchise))}
				${this._field("Ordem na franquia", this._text("franchiseOrder", a.franchiseOrder ?? "", { type: "number", attrs: 'step="0.1" inputmode="decimal"' }))}
				${this._field("Áudio", `<div class="av-checks"><label><input type="checkbox" data-group="audio" name="audio-leg" value="Legendado"${audio.some(x => /leg|sub/.test(x)) ? " checked" : ""}>Legendado</label><label><input type="checkbox" data-group="audio" name="audio-dub" value="Dublado"${audio.some(x => /dub/.test(x)) ? " checked" : ""}>Dublado</label></div>`)}
				${this._field("Onde assistir", this._text("streaming", a.streaming.join(", "), { placeholder: "Crunchyroll, Netflix…" }))}
				${this._field("Link para assistir", this._text("link", a.link, { type: "url", placeholder: "https://…" }), "", "is-wide")}
			</div></fieldset>
			<fieldset class="av-fieldset"><legend>Sinopse e arte</legend><div class="av-formgrid">
				${this._field("Sinopse", this._area("summary", a.summary, { rows: 5 }), "", "is-wide")}
				${this._field("Capa (2:3)", `<div class="av-fileline">${this._text("cover", p.cover || "", { placeholder: "Assets/Covers/… ou https://…" })}<label class="av-btn av-btn--ghost av-btn--sm">${U.icon("upload")}<span>Do aparelho</span><input type="file" accept="image/*" data-upload="cover" hidden></label></div>`, "", "is-wide")}
				${this._field("Banner (largo)", `<div class="av-fileline">${this._text("banner", p.banner || "", { placeholder: "Assets/Banners/… ou https://…" })}<label class="av-btn av-btn--ghost av-btn--sm">${U.icon("upload")}<span>Do aparelho</span><input type="file" accept="image/*" data-upload="banner" hidden></label></div>`, "", "is-wide")}
				${this._field("Enquadramento vertical do banner", `<input class="av-range" type="range" name="bgPosY" min="0" max="100" value="${a.framing.y}">`, "0 = topo da imagem, 100 = base", "is-wide")}
			</div></fieldset>`;
		const m = V.modal({ title: "Editar detalhes", sub: a.title, size: "lg", body: form, actions: `${U.btn("Cancelar", { kind: "ghost", attrs: "data-close" })}${U.btn("Salvar", { kind: "primary", icon: "check", attrs: "data-save" })}` });
		this._pickers(form, ctx, () => form.querySelector('[name="title"]').value);
		setTimeout(() => form.querySelector("[data-f-anilist]")?.closest(".av-formfield")?.classList.add("is-hl"), 60);
		const save = async () => {
			const v = this._read(form);
			try {
				await app.fileManager.processFrontMatter(file, fm => {
					const set = (k, val) => { fm[k] = val; };
					set("title", v.title || a.title); set("titleRomaji", v.titleRomaji); set("titleEnglish", v.titleEnglish); set("titleNative", v.titleNative);
					set("format", v.format); set("status", v.status); set("anilistId", v.anilistId.replace(/\D/g, "")); set("malId", v.malId.replace(/\D/g, ""));
					set("episodesWatched", this._num(v.episodesWatched) || 0); set("episodes", this._num(v.episodes)); set("duration", this._num(v.duration) || 24);
					set("startDate", v.startDate); set("completionDate", v.completionDate); set("rewatches", this._num(v.rewatches) || 0);
					set("rating", v.rating10 !== undefined ? C.fromScore10(v.rating10) : Math.max(0, Math.min(5, this._num(v.rating) || 0)));
					set("source", v.source); set("demographic", this._list(v.demographic));
					set("season", v.season); set("seasonYear", this._num(v.seasonYear)); set("airingStatus", v.airingStatus); set("airingDay", v.airingDay); set("airingTime", v.airingTime); set("airedFrom", v.airedFrom);
					set("genre", this._list(v.genre)); set("studio", this._list(v.studio));
					set("tags", ["anime", ...this._list(v.tags).filter(t => t !== "anime")]);
					set("franchise", v.franchise); set("franchiseOrder", this._num(v.franchiseOrder));
					set("audio", v.audio || []); set("streaming", this._list(v.streaming)); set("link", C.safeUrl(v.link) || "");
					set("summary", v.summary); set("cover", v.cover); set("banner", v.banner); set("bgPosY", this._num(v.bgPosY) ?? 30);
				});
				m.close();
				V.toast("Detalhes salvos", { tone: "ok" });
				if (v.title && v.title !== a.title) {
					const target = `${file.parent?.path ? file.parent.path + "/" : ""}${C.safeFileName(v.title)}.md`;
					if (!app.vault.getAbstractFileByPath(target)) await app.fileManager.renameFile(file, target).catch(() => {});
				}
			} catch (err) { V.toast(`Não foi possível salvar: ${err.message}`, { tone: "error" }); }
		};
		m.el.querySelector("[data-save]").addEventListener("click", save);
		form.addEventListener("submit", e => { e.preventDefault(); save(); });
	}

	// ======================================================= DIÁRIO
	logEpisodes(ctx, path) {
		const { U, C, V, model } = ctx;
		const a = model.animeByPath.get(path);
		const file = app.vault.getAbstractFileByPath(path);
		if (!a || !file) return V.toast("Anime não encontrado", { tone: "error" });
		const p = a.progress;
		const next = p.next || (a.watched || 1);
		const form = document.createElement("form");
		form.className = "av-host av-form";
		const log = [...a.log].map((l, i) => ({ ...l, i })).reverse();
		form.innerHTML = `<div class="av-formgrid">
				${this._field("Data", this._text("date", C.today(), { type: "date" }))}
				${this._field("Do episódio", this._text("from", next, { type: "number", attrs: `min="1"${p.total ? ` max="${p.total}"` : ""} inputmode="numeric"` }))}
				${this._field("Até o episódio", this._text("to", next, { type: "number", attrs: `min="1"${p.total ? ` max="${p.total}"` : ""} inputmode="numeric"` }))}
				<div class="av-formfield is-wide"><span class="av-label">Atalhos</span><div class="av-fchips"><button type="button" class="av-fchip" data-plus="1">+1</button><button type="button" class="av-fchip" data-plus="3">+3</button><button type="button" class="av-fchip" data-plus="6">+6</button>${p.total ? `<button type="button" class="av-fchip" data-plus="all">Até o fim (${p.total})</button>` : ""}</div></div>
				${this._field("Nota (opcional)", this._area("note", "", { rows: 2, placeholder: "Onde parou, o que achou do episódio…" }), "", "is-wide")}
			</div>
			<p class="av-hint">Avançar além do episódio ${a.watched} atualiza o progresso. Registrar episódios já vistos só entra no diário.</p>
			${log.length ? `<section class="av-fgroup"><h4>Últimos registros</h4><ul class="av-loglist">${log.slice(0, 12).map(l => `<li><span><b>${U.esc(U.fmtDate(l.date))}</b> · ${l.from !== null && l.to !== null ? (l.from === l.to ? `E${l.from}` : `E${l.from}–E${l.to}`) : "—"}${l.note ? ` · “${U.esc(l.note)}”` : ""}</span><button type="button" class="av-iconbtn" data-del="${l.i}" aria-label="Apagar registro">${U.icon("trash")}</button></li>`).join("")}</ul></section>` : ""}`;
		const m = V.modal({ title: "Registrar episódios", sub: a.title, size: "md", body: form, actions: `${U.btn("Cancelar", { kind: "ghost", attrs: "data-close" })}${U.btn("Registrar", { kind: "primary", icon: "check", attrs: "data-save" })}` });
		form.addEventListener("click", async e => {
			const plus = e.target.closest("[data-plus]");
			if (plus) {
				const from = Number(form.querySelector('[name="from"]').value) || next;
				const to = plus.dataset.plus === "all" ? p.total : from + Number(plus.dataset.plus) - 1;
				form.querySelector('[name="to"]').value = p.total ? Math.min(p.total, to) : to;
				return;
			}
			const del = e.target.closest("[data-del]");
			if (del) {
				const i = Number(del.dataset.del);
				await app.fileManager.processFrontMatter(file, fm => { if (Array.isArray(fm.log)) fm.log.splice(i, 1); });
				del.closest("li").remove();
				V.toast("Registro apagado (o progresso não muda)", { tone: "ok" });
			}
		});
		const save = async () => {
			const v = this._read(form);
			const from = Math.max(1, Number(v.from) || next), to = Math.max(from, Number(v.to) || from);
			const date = C.iso(v.date) || C.today();
			try {
				if (to > a.watched) {
					if (from > a.watched + 1) {
						await app.fileManager.processFrontMatter(file, fm => { fm.episodesWatched = from - 1; });
					}
					await C.setProgress(file, to, { note: v.note, date });
				} else {
					await app.fileManager.processFrontMatter(file, fm => {
						const log = Array.isArray(fm.log) ? fm.log : [];
						log.push(v.note ? { date, from, to, note: v.note } : { date, from, to });
						log.sort((x, y) => String(C.iso(x.date)).localeCompare(String(C.iso(y.date))));
						fm.log = log;
					});
				}
				m.close();
				V.toast(from === to ? `E${from} registrado` : `Episódios ${from}–${to} registrados`, { tone: "ok", icon: "notebook" });
				V.refresh();
			} catch (err) { V.toast(`Não foi possível salvar: ${err.message}`, { tone: "error" }); }
		};
		m.el.querySelector("[data-save]").addEventListener("click", save);
		form.addEventListener("submit", e => { e.preventDefault(); save(); });
	}

	// ======================================================= ANÁLISE E NOTA
	_starInput(host, initial, onChange) {
		const U = customJS.AnimeVaultUI, C = customJS.AnimeVaultCore;
		let v = initial;
		// escala do MyAnimeList: seletor (10) Obra-prima … (1) Péssimo
		if (C.scale() === 10) {
			host.innerHTML = U.scoreSelect(v, "data-score-pick");
			host.querySelector("select").addEventListener("change", e => { v = C.fromScore10(e.target.value); onChange(v); });
			return;
		}
		const paint = () => { host.innerHTML = `${U.stars(v, { input: true })}<b>${v ? U.fmtNum(v, 1) : "Sem nota"}</b>${v ? `<button type="button" class="av-ovlink" data-clear>Limpar</button>` : ""}`; };
		host.addEventListener("click", e => {
			if (e.target.closest("[data-clear]")) { v = 0; paint(); onChange(v); return; }
			const b = e.target.closest("[data-star]");
			if (!b) return;
			const r = b.getBoundingClientRect();
			const half = e.clientX && e.clientX < r.left + r.width / 2;
			v = Number(b.dataset.star) - (half ? 0.5 : 0);
			paint(); onChange(v);
		});
		paint();
	}

	rate(ctx, path) {
		const { U, V, model } = ctx;
		const a = model.animeByPath.get(path);
		const file = app.vault.getAbstractFileByPath(path);
		if (!a || !file) return;
		let v = a.rating;
		const body = document.createElement("div");
		body.className = "av-host av-rate";
		body.innerHTML = `<div class="av-rate-head">${U.cover(a)}<div><strong>${U.esc(a.title)}</strong><span>${customJS.AnimeVaultCore.scale() === 10 ? "Escala do MyAnimeList (1 a 10)" : "Toque na metade esquerda da estrela para meia nota"}</span></div></div><div class="av-rate-stars" data-stars></div>`;
		const m = V.modal({ title: "Sua nota", size: "sm", body, actions: `${U.btn("Escrever análise", { kind: "ghost", attrs: "data-review" })}${U.btn("Salvar", { kind: "primary", attrs: "data-save" })}` });
		this._starInput(body.querySelector("[data-stars]"), v, x => { v = x; });
		m.el.querySelector("[data-save]").addEventListener("click", async () => { await app.fileManager.processFrontMatter(file, fm => { fm.rating = v; }); m.close(); V.toast(v ? `Nota ${U.scoreText(v)}` : "Nota removida", { tone: "ok", icon: "starFill" }); });
		m.el.querySelector("[data-review]").addEventListener("click", async () => { await app.fileManager.processFrontMatter(file, fm => { fm.rating = v; }); m.close(); this.editReview(ctx, path); });
	}

	editReview(ctx, path) {
		const { U, V, model } = ctx;
		const a = model.animeByPath.get(path);
		const file = app.vault.getAbstractFileByPath(path);
		if (!a || !file) return;
		let rating = a.rating, rec = a.recommend;
		const form = document.createElement("form");
		form.className = "av-host av-form";
		form.innerHTML = `<div class="av-formfield"><span class="av-label">Sua nota</span><div class="av-rate-stars" data-stars></div></div>
			<div class="av-formfield"><span class="av-label">Recomenda?</span><div class="av-segmented" role="radiogroup">${[["yes", "Recomendo"], ["", "Sem opinião"], ["no", "Não recomendo"]].map(([k, l]) => `<button type="button" data-rec="${k}" class="${(rec === true && k === "yes") || (rec === false && k === "no") || (rec === null && !k) ? "is-active" : ""}">${U.esc(l)}</button>`).join("")}</div></div>
			${this._field("Opinião", this._area("review", a.review, { rows: 5, placeholder: "O que você achou?" }))}
			<div class="av-formgrid">
				${this._field("Pontos fortes", this._area("pros", a.pros.join("\n"), { rows: 4, placeholder: "Um por linha" }))}
				${this._field("Pontos fracos", this._area("cons", a.cons.join("\n"), { rows: 4, placeholder: "Um por linha" }))}
			</div>`;
		const m = V.modal({ title: "Minha análise", sub: a.title, size: "md", body: form, actions: `${U.btn("Cancelar", { kind: "ghost", attrs: "data-close" })}${U.btn("Salvar", { kind: "primary", icon: "check", attrs: "data-save" })}` });
		this._starInput(form.querySelector("[data-stars]"), rating, x => { rating = x; });
		form.querySelectorAll("[data-rec]").forEach(b => b.addEventListener("click", () => { rec = b.dataset.rec === "yes" ? true : b.dataset.rec === "no" ? false : null; form.querySelectorAll("[data-rec]").forEach(x => x.classList.toggle("is-active", x === b)); }));
		m.el.querySelector("[data-save]").addEventListener("click", async () => {
			const v = this._read(form);
			await app.fileManager.processFrontMatter(file, fm => {
				fm.rating = rating; fm.review = v.review;
				fm.pros = v.pros.split("\n").map(x => x.trim()).filter(Boolean);
				fm.cons = v.cons.split("\n").map(x => x.trim()).filter(Boolean);
				if (rec === null) delete fm.recommend; else fm.recommend = rec;
			});
			m.close();
			V.toast("Análise salva", { tone: "ok", icon: "starFill" });
		});
	}

	// ======================================================= IDENTIDADE
	async editIdentity(ctx, kind, name, path) {
		const { U, C, V, B } = ctx;
		let file = path ? app.vault.getAbstractFileByPath(path) : null;
		if (!file && kind !== "list") {
			try { file = await C.ensureCategoryNote(kind, name); } catch (err) { return V.toast(`Não foi possível criar a página: ${err.message}`, { tone: "error" }); }
		}
		if (!file) return;
		const fm0 = app.metadataCache.getFileCache(file)?.frontmatter || {};
		const id = kind === "list" ? { color: fm0.accent || "#f47521", icon: fm0.icon || "layers" } : B.ident(ctx, kind, name);
		const swatches = ["#f47521", "#ff5c9a", "#a970ff", "#7b6cff", "#4f9dff", "#22b8e6", "#2bb673", "#6fcf97", "#f7c325", "#ff8a3d", "#e5484d", "#8fa3b8"];
		const form = document.createElement("form");
		form.className = "av-host av-form";
		form.innerHTML = `${kind === "list" ? this._field("Nome", this._text("title", fm0.title || name)) : ""}
			${this._field("Descrição", this._area("description", fm0.description || "", { rows: 2 }))}
			<div class="av-formfield"><span class="av-label">Cor</span><div class="av-swatches">${swatches.map(c => `<button type="button" class="av-swatch${(fm0.accent || "").toLowerCase() === c ? " is-active" : ""}" data-color="${c}" style="--c:${c}" aria-label="${c}"></button>`).join("")}<input class="av-input av-input--sm" name="accent" value="${U.attr(fm0.accent || "")}" placeholder="${U.attr(id.color)}"></div></div>
			<div class="av-formfield"><span class="av-label">Ícone</span><div class="av-iconpick">${B.iconChoices().map(i => `<button type="button" class="av-iconpick-btn${(fm0.icon || id.icon) === i ? " is-active" : ""}" data-icon="${i}" title="${i}">${U.icon(i)}</button>`).join("")}</div><input type="hidden" name="icon" value="${U.attr(fm0.icon || "")}"></div>
			${this._field("Arte do topo", `<div class="av-fileline">${this._text("cover", fm0.cover || "", { placeholder: "Vazio = arte do anime mais bem avaliado" })}<label class="av-btn av-btn--ghost av-btn--sm">${U.icon("upload")}<span>Do aparelho</span><input type="file" accept="image/*" data-upload="cover" hidden></label></div>`)}
			${kind === "list" ? `<label class="av-switch"><input type="checkbox" name="pinned"${fm0.pinned === true ? " checked" : ""}><span></span><span class="av-switch-text"><b>Fixar no topo</b><small>Aparece primeiro em Listas e no Início</small></span></label>` : ""}`;
		const m = V.modal({ title: kind === "list" ? "Editar lista" : "Editar identidade", sub: kind === "genre" ? C.genreLabel(name) : name, size: "md", body: form, actions: `${U.btn("Cancelar", { kind: "ghost", attrs: "data-close" })}${U.btn("Salvar", { kind: "primary", icon: "check", attrs: "data-save" })}` });
		this._pickers(form, ctx, () => name);
		form.addEventListener("click", e => {
			const sw = e.target.closest("[data-color]");
			if (sw) { form.querySelector('[name="accent"]').value = sw.dataset.color; form.querySelectorAll("[data-color]").forEach(x => x.classList.toggle("is-active", x === sw)); return; }
			const ic = e.target.closest("[data-icon]");
			if (ic) { form.querySelector('[name="icon"]').value = ic.dataset.icon; form.querySelectorAll("[data-icon]").forEach(x => x.classList.toggle("is-active", x === ic)); }
		});
		m.el.querySelector("[data-save]").addEventListener("click", async () => {
			const v = this._read(form);
			await app.fileManager.processFrontMatter(file, fm => {
				if (kind === "list") { fm.title = v.title || fm.title; fm.pinned = !!v.pinned; fm.updated = C.today(); }
				fm.description = v.description; fm.accent = /^#[0-9a-f]{3,8}$/i.test(v.accent) ? v.accent : ""; fm.icon = v.icon; fm.cover = v.cover;
			});
			m.close();
			V.toast("Salvo", { tone: "ok" });
		});
	}

	// ======================================================= LISTAS
	newList(ctx, paths = []) {
		const { U, C, V } = ctx;
		const form = document.createElement("form");
		form.className = "av-host av-form";
		form.innerHTML = `${this._field("Nome da lista", this._text("title", "", { placeholder: "Ex.: Para ver com amigos", attrs: "autofocus" }))}${this._field("Descrição (opcional)", this._text("description", ""))}`;
		const m = V.modal({ title: "Nova lista", sub: paths.length ? `Com ${U.plural(paths.length, "anime", "animes")}` : "", size: "sm", body: form, actions: `${U.btn("Cancelar", { kind: "ghost", attrs: "data-close" })}${U.btn("Criar", { kind: "primary", icon: "plus", attrs: "data-save" })}` });
		const save = async () => {
			const v = this._read(form);
			if (!v.title) return V.toast("Dê um nome à lista", { tone: "warn" });
			const f = await C.createListNote(v.title, { description: v.description });
			if (paths.length) await app.fileManager.processFrontMatter(f, fm => { fm.anime = paths.map(p => `[[${p.replace(/\.md$/, "")}]]`); });
			m.close();
			V.toast(`Lista “${v.title}” criada`, { tone: "ok", icon: "layers" });
			if (!paths.length) setTimeout(() => V.open(f.path, ctx), 250);
		};
		m.el.querySelector("[data-save]").addEventListener("click", save);
		form.addEventListener("submit", e => { e.preventDefault(); save(); });
	}

	async toggleInList(ctx, listPath, animePath, on = null) {
		const { C, V, model } = ctx;
		const f = app.vault.getAbstractFileByPath(listPath);
		if (!f) return;
		const base = animePath.replace(/\.md$/, "");
		const same = e => { const lp = C.linkPath(e).replace(/\.md$/, ""); return lp === base || lp.split("/").pop().toLowerCase() === base.split("/").pop().toLowerCase(); };
		let added = false;
		await app.fileManager.processFrontMatter(f, fm => {
			const cur = Array.isArray(fm.anime) ? fm.anime : fm.anime ? [fm.anime] : [];
			const has = cur.some(same);
			const want = on === null ? !has : on;
			fm.anime = want ? (has ? cur : [...cur, `[[${base}]]`]) : cur.filter(e => !same(e));
			fm.updated = C.today();
			added = want;
		});
		const l = model.lists.find(x => x.path === listPath);
		V.toast(`${added ? "Na lista" : "Fora da lista"} “${l?.title || f.basename}”`, { tone: "ok", icon: "layers" });
	}

	listPicker(ctx, animePath) {
		const { U, V, model } = ctx;
		const a = model.animeByPath.get(animePath);
		const inList = new Set((model.listsByAnime.get(animePath) || []).map(l => l.path));
		const body = document.createElement("div");
		body.className = "av-host av-sheet";
		body.innerHTML = `<div class="av-qm-lists">${model.lists.map(l => `<button type="button" class="av-qm-list${inList.has(l.path) ? " is-on" : ""}" data-list="${U.attr(l.path)}" aria-pressed="${inList.has(l.path)}">${U.icon(l.icon || "layers")}<span>${U.esc(l.title)}<small>${U.plural(l.items.length, "anime", "animes")}</small></span><span class="av-qm-check">${U.icon("check")}</span></button>`).join("")}<button type="button" class="av-qm-list is-new" data-newlist>${U.icon("plus")}<span>Nova lista</span></button></div>`;
		const m = V.modal({ title: "Adicionar a uma lista", sub: a?.title || "", size: "sm", body, actions: U.btn("Pronto", { kind: "primary", attrs: "data-close" }) });
		body.addEventListener("click", async e => {
			if (e.target.closest("[data-newlist]")) { m.close(); return this.newList(ctx, [animePath]); }
			const b = e.target.closest("[data-list]");
			if (!b) return;
			const on = !b.classList.contains("is-on");
			b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", String(on));
			await this.toggleInList(ctx, b.dataset.list, animePath, on);
		});
	}

	listItemsPicker(ctx, listPath) {
		const { U, C, V, model } = ctx;
		const l = model.lists.find(x => x.path === listPath);
		const f = app.vault.getAbstractFileByPath(listPath);
		if (!l || !f) return;
		const chosen = new Set(l.items.map(a => a.path));
		const all = [...model.anime].sort((x, y) => x.title.localeCompare(y.title));
		const body = document.createElement("div");
		body.className = "av-host av-picker";
		body.innerHTML = `<label class="av-field av-field--search">${U.icon("search")}<input type="search" class="av-input" data-q placeholder="Filtrar animes" aria-label="Filtrar"></label>
			<p class="av-picker-count" data-count></p>
			<div class="av-picker-list">${all.map(a => `<label class="av-picker-item" data-k="${U.attr(C.normalizeKey(a.title))}"><input type="checkbox" value="${U.attr(a.path)}"${chosen.has(a.path) ? " checked" : ""}>${U.cover(a, { cls: "av-cover--xs" })}<span><b>${U.esc(a.title)}</b><small>${U.esc([a.formatLabel, a.year].filter(Boolean).join(" · "))}</small></span><span class="av-picker-check">${U.icon("check")}</span></label>`).join("")}</div>`;
		const m = V.modal({ title: "Animes da lista", sub: l.title, size: "md", body, actions: `${U.btn("Cancelar", { kind: "ghost", attrs: "data-close" })}${U.btn("Salvar", { kind: "primary", attrs: "data-save" })}` });
		const count = () => { body.querySelector("[data-count]").textContent = U.plural(body.querySelectorAll("input:checked").length, "selecionado", "selecionados"); };
		count();
		body.addEventListener("change", count);
		body.querySelector("[data-q]").addEventListener("input", e => { const q = C.normalizeKey(e.target.value); body.querySelectorAll(".av-picker-item").forEach(it => { it.hidden = q && !it.dataset.k.includes(q); }); });
		m.el.querySelector("[data-save]").addEventListener("click", async () => {
			const picked = new Set([...body.querySelectorAll("input:checked")].map(i => i.value));
			const order = [...l.items.map(a => a.path).filter(p => picked.has(p)), ...[...picked].filter(p => !chosen.has(p))];
			await app.fileManager.processFrontMatter(f, fm => { fm.anime = order.map(p => `[[${p.replace(/\.md$/, "")}]]`); fm.updated = C.today(); });
			m.close();
			V.toast("Lista atualizada", { tone: "ok", icon: "layers" });
		});
	}

	// ======================================================= SURPREENDA-ME
	picker(ctx) {
		const { U, C, V, model } = ctx;
		const genres = [...C.groupBy(model.anime.filter(a => a.status === "Planning"), a => a.genres)].sort((x, y) => y[1].length - x[1].length).slice(0, 10).map(([g]) => g);
		const st = { time: "any", genre: "", source: "planning" };
		const times = { any: "Qualquer", ep: "Um episódio", night: "Uma noite (até 3 h)", weekend: "Um fim de semana", long: "Projeto longo" };
		const body = document.createElement("div");
		body.className = "av-host av-pick";
		body.innerHTML = `<section class="av-fgroup"><h4>Quanto tempo você tem?</h4><div class="av-fchips">${Object.entries(times).map(([k, v]) => `<button type="button" class="av-fchip${k === st.time ? " is-active" : ""}" data-k="time" data-v="${k}">${U.esc(v)}</button>`).join("")}</div></section>
			${genres.length ? `<section class="av-fgroup"><h4>Clima</h4><div class="av-fchips"><button type="button" class="av-fchip is-active" data-k="genre" data-v="">Qualquer</button>${genres.map(g => `<button type="button" class="av-fchip" data-k="genre" data-v="${U.attr(g)}">${U.esc(C.genreLabel(g))}</button>`).join("")}</div></section>` : ""}
			<section class="av-fgroup"><h4>De onde</h4><div class="av-fchips">${[["planning", "Quero assistir"], ["progress", "Em andamento"], ["both", "Os dois"]].map(([k, v]) => `<button type="button" class="av-fchip${k === st.source ? " is-active" : ""}" data-k="source" data-v="${k}">${U.esc(v)}</button>`).join("")}</div></section>
			<div class="av-pick-result" data-result></div>`;
		const m = V.modal({ title: "Surpreenda-me", sub: "Escolha o tempo e o clima; o Vault sorteia", size: "md", body, actions: `${U.btn("Sortear", { kind: "primary", icon: "dice", attrs: "data-roll" })}` });
		const pool = () => model.anime.filter(a => {
			const src = st.source === "planning" ? a.status === "Planning" : st.source === "progress" ? ["Watching", "Paused", "Rewatching"].includes(a.status) && a.progress.next !== null : ["Planning", "Watching", "Paused"].includes(a.status);
			if (!src) return false;
			if (st.genre && !a.genres.includes(st.genre)) return false;
			const left = (a.progress.left ?? (a.episodes || 12)) * a.duration;
			switch (st.time) {
				case "ep": return !C.isMovie(a) && a.duration <= 30;
				case "night": return left <= 180;
				case "weekend": return left > 120 && left <= 720;
				case "long": return left > 720;
				default: return true;
			}
		});
		let last = null;
		const roll = () => {
			const list = pool();
			const box = body.querySelector("[data-result]");
			if (!list.length) { box.innerHTML = `<p class="av-add-hint">${U.icon("search")}Nada na sua lista com esses filtros.</p>`; return; }
			let a = list[Math.floor(Math.random() * list.length)];
			if (list.length > 1 && a === last) a = list.find(x => x !== last);
			last = a;
			const left = (a.progress.left ?? a.episodes ?? 0) * a.duration;
			box.innerHTML = `<div class="av-pick-card" style="--av-hue:${a.hue}">
				${U.cover(a)}
				<div><span class="av-kicker">${U.icon("dice")}Que tal…</span><strong>${U.esc(a.title)}</strong><small>${U.esc([a.formatLabel, a.year, a.genres.slice(0, 2).map(g => C.genreLabel(g)).join(", ")].filter(Boolean).join(" · "))}</small>
				<p>${left ? `${a.progress.watched ? `Faltam ${U.fmtMinutes(left)}` : `${U.fmtMinutes(left)} no total`}` : ""}${a.summary ? ` · ${U.esc(customJS.AnimeVaultCore.clip(a.summary, 140))}` : ""}</p>
				<div class="av-pick-acts">${U.btn(a.progress.watched ? `Continuar E${a.progress.next}` : "Abrir", { kind: "primary", icon: "play", attrs: `data-go="${U.attr(a.path)}"` })}</div></div>
			</div>`;
			V._wireImages(box);
			box.querySelector("[data-go]")?.addEventListener("click", () => { m.close(); V.open(a.path, ctx); });
			V._haptic(12);
		};
		body.addEventListener("click", e => {
			const b = e.target.closest(".av-fchip[data-k]");
			if (!b) return;
			st[b.dataset.k] = b.dataset.v;
			body.querySelectorAll(`.av-fchip[data-k="${b.dataset.k}"]`).forEach(x => x.classList.toggle("is-active", x === b));
		});
		m.el.querySelector("[data-roll]").addEventListener("click", roll);
		roll();
	}
}
