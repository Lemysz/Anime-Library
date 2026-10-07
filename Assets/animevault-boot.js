// Anime Vault — inicialização das telas.
// Cada nota chama: await dv.view("Assets/animevault-boot", { page: "home" })
// Ao abrir o Obsidian, o Dataview roda antes do CustomJS terminar de carregar
// os scripts de Scripts/. Em vez do erro "customJS is not defined", mostra a
// tela de carregamento até o Anime Vault ficar pronto e então monta a página.
return (async () => {
	const page = (input && input.page) || "home";
	let coreSince = 0;
	const ready = () => {
		const av = typeof window.customJS !== "undefined" && window.customJS ? window.customJS.AnimeVault : null;
		if (!av) return false;
		const st = typeof av.bootState === "function" ? av.bootState() : "all";
		if (st === "all") return true;
		if (st === "core") { coreSince = coreSince || Date.now(); return Date.now() - coreSince > 2000; }
		return false;
	};
	if (ready()) return window.customJS.AnimeVault.render(dv, page);

	const host = dv.container;
	const leaf = host.closest(".workspace-leaf-content");
	const view = leaf && !host.closest(".markdown-embed, .hover-popover, .popover, .canvas-node, .internal-embed") ? leaf.querySelector(":scope > .view-content") : null;
	const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
	const splash = document.createElement("div");
	splash.className = `av-boot is-full${reduce ? " is-still" : ""}`;
	splash.setAttribute("role", "status");
	splash.setAttribute("aria-live", "polite");
	splash.innerHTML = `<style>
		.av-boot { position: relative; min-height: 70vh; background: #000; color: #fff; font-family: Lato, "Helvetica Neue", -apple-system, "Segoe UI", Roboto, sans-serif; opacity: 1; transition: opacity .35s ease; }
		.av-boot.is-cover { position: absolute; inset: 0; z-index: 40; min-height: 0; }
		.av-boot.is-full { position: fixed; inset: 0; z-index: 9999; min-height: 0; }
		.av-boot.is-out { opacity: 0; pointer-events: none; }
		.av-boot-mark { position: absolute; left: calc(50% - 38px); top: calc(50% - 78px); width: 76px; height: 76px; display: grid; place-items: center; border-radius: 22px; background: #f47521; color: #000; box-shadow: 0 18px 44px -14px rgba(244, 117, 33, .8); animation: avBootFloat 2.4s ease-in-out infinite; }
		.av-boot-mark::after { content: ""; position: absolute; inset: -10px; border-radius: 30px; border: 2px solid rgba(244, 117, 33, .5); animation: avBootPulse 1.8s ease-out infinite; }
		.av-boot-mark svg { width: 40px; height: 40px; margin-left: 4px; }
		.av-boot-name { position: absolute; left: 0; right: 0; top: calc(50% + 52px); transform: translateY(-50%); text-align: center; font-size: 1.4rem; font-weight: 900; letter-spacing: .01em; }
		.av-boot-name b { color: #f47521; }
		.av-boot-sub { position: absolute; left: 24px; right: 24px; top: calc(50% + 80px); text-align: center; font-size: .92rem; opacity: .7; }
		.av-boot-bar { position: absolute; left: calc(50% - 74px); top: calc(50% + 92px); width: 148px; height: 3px; overflow: hidden; background: rgba(255, 255, 255, .14); }
		.av-boot-bar::after { content: ""; position: absolute; top: 0; bottom: 0; left: -40%; width: 40%; background: #f47521; animation: avBootBar 1.15s ease-in-out infinite; }
		.av-boot-help { position: absolute; left: calc(50% - 150px); top: calc(50% + 112px); width: 300px; text-align: center; font-size: .86rem; line-height: 1.45; opacity: .8; }
		.av-boot-help code { padding: 1px 5px; border-radius: 3px; background: rgba(255, 255, 255, .12); }
		.av-boot.is-still *, .av-boot.is-still *::after { animation: none !important; }
		@keyframes avBootFloat { 50% { transform: translateY(-5px); } }
		@keyframes avBootPulse { 0% { transform: scale(.9); opacity: .9; } 100% { transform: scale(1.25); opacity: 0; } }
		@keyframes avBootBar { 0% { left: -40%; } 100% { left: 100%; } }
	</style>
	<div class="av-boot-mark"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7.5 4.6c0-.8.9-1.3 1.6-.9l11 6.9c.6.4.6 1.4 0 1.8l-11 6.9c-.7.4-1.6-.1-1.6-.9z"/></svg></div>
	<div class="av-boot-name">Anime<b>Vault</b></div>
	<div class="av-boot-bar"></div>`;
	// várias notas abrindo juntas dividem uma tela só
	const shared = document.querySelector("body > .av-boot.is-full");
	if (shared) { shared.__avUsers = (shared.__avUsers || 1) + 1; splash.__avShared = shared; }
	else document.body.appendChild(splash);
	const screen = splash.__avShared || splash;
	const release = () => {
		screen.__avUsers = (screen.__avUsers || 1) - 1;
		if (screen.__avUsers > 0) return;
		screen.classList.add("is-out");
		setTimeout(() => screen.remove(), 400);
	};

	// espera o CustomJS (até ~40 s em aparelhos lentos)
	const t0 = Date.now();
	while (!ready() && Date.now() - t0 < 40000) {
		await new Promise(r => setTimeout(r, 60));
		if (!host.isConnected) return release();
	}
	if (!ready()) {
		const note = splash.cloneNode(true);
		release();
		note.classList.remove("is-full", "is-out");
		if (view) { note.classList.add("is-cover"); view.appendChild(note); } else host.appendChild(note);
		note.querySelector(".av-boot-bar")?.remove();
		const sub = document.createElement("div");
		sub.className = "av-boot-sub";
		sub.textContent = "O Anime Vault não carregou";
		note.appendChild(sub);
		const help = document.createElement("div");
		help.className = "av-boot-help";
		help.innerHTML = "Confira se o plugin <b>CustomJS</b> está ativo e aponta para a pasta <code>Scripts/</code>, e se o <b>Dataview</b> tem JavaScript ativado. Depois, reabra esta nota.";
		note.appendChild(help);
		return;
	}
	try {
		await window.customJS.AnimeVault.render(dv, page);
	} finally {
		requestAnimationFrame(() => requestAnimationFrame(release));
	}
})();
