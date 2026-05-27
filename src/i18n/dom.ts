export type TFn = (key: string, vars?: Record<string, unknown>) => string;

/**
 * Apply data-i18n / data-i18n-title attributes against the current
 * translator. Also flips `body.i18n-ready` so critical CSS can reveal
 * any nodes hidden until the first translation pass.
 */
export function applyI18nDOM(t: TFn): void {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
        const k = el.getAttribute('data-i18n');
        if (k) el.textContent = t(k);
    });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
        const k = el.getAttribute('data-i18n-title');
        if (k) (el as HTMLElement).title = t(k);
    });
    // Sync the document title with the localized game name. Browsers update
    // the tab title; the Tauri webview does NOT auto-mirror document.title to
    // the OS window, so we also call the window API when available.
    const localized = t('title');
    document.title = localized;
    if (typeof (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== 'undefined') {
        import('@tauri-apps/api/window').then((m) => m.getCurrentWindow().setTitle(localized)).catch(() => {});
    }
    document.body.classList.add('i18n-ready');
}

export interface LangMenuOpts {
    getLang: () => string;
    setLang: (lang: string) => void;
    t: TFn;
    /** Show the lang menu button only when the game is in a paused / pre-start state. */
    canSwitch: () => boolean;
    /** Called after the button calls showEffect on a forbidden click (e.g. mid-run). */
    showEffect: (text: string) => void;
}

/**
 * Wire the #btn-lang dropdown menu (#lang-menu). Returns the
 * updateBtnState fn used to refresh the visible-state on a tick so that
 * mid-run → paused transitions show/hide the button correctly.
 *
 * Idempotent: a previous interval bound to the same #btn-lang element is
 * cleared before a new one is started, so dev-server HMR or accidental
 * double-install cannot stack multiple intervals.
 */
export function installLangMenu(opts: LangMenuOpts): (() => void) | undefined {
    const btn = document.getElementById('btn-lang') as (HTMLElement & { __langMenuCleanup?: () => void }) | null;
    const menu = document.getElementById('lang-menu');
    if (!btn || !menu) return undefined;
    // Idempotent: tear down any previous install on the same #btn-lang
    // (HMR, accidental double-call) — interval, listeners, and badge.
    if (btn.__langMenuCleanup) btn.__langMenuCleanup();
    const badge = document.createElement('span');
    badge.className = 'gp-badge';
    badge.id = 'btn-lang-badge';
    // Decorative gamepad-hint glyph; hide from screen readers.
    badge.setAttribute('aria-hidden', 'true');
    badge.setAttribute('role', 'presentation');
    btn.appendChild(badge);
    const LANG = opts.getLang();
    menu.querySelectorAll('button[data-lang]').forEach((b) => {
        b.classList.toggle('active', b.getAttribute('data-lang') === LANG);
    });
    let lastVisible: boolean | null = null;
    function updateBtnState() {
        const visible = opts.canSwitch();
        if (visible !== lastVisible) {
            btn!.style.display = visible ? 'flex' : 'none';
            lastVisible = visible;
        }
        if (!visible) menu!.classList.remove('open');
    }
    const onBtnClick = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        if (!opts.canSwitch()) {
            opts.showEffect('⏸ ' + opts.t('hint.langPauseFirst'));
            return;
        }
        menu.classList.toggle('open');
    };
    const onMenuClick = (e: Event) => {
        const target = (e.target as HTMLElement).closest('button[data-lang]');
        if (!target) return;
        e.preventDefault();
        e.stopPropagation();
        const lang = target.getAttribute('data-lang');
        if (lang) opts.setLang(lang);
        menu.classList.remove('open');
    };
    const onDocClick = (e: Event) => {
        if (!menu.classList.contains('open')) return;
        if (e.target === btn || menu.contains(e.target as Node)) return;
        menu.classList.remove('open');
    };
    btn.addEventListener('click', onBtnClick);
    menu.addEventListener('click', onMenuClick);
    document.addEventListener('click', onDocClick);
    updateBtnState();
    // Event-driven refresh: `body.playing` is toggled by the main loop on
    // every paused/gameOver transition, so a MutationObserver on it is the
    // cheapest way to keep the lang button in sync without a second 60fps
    // rAF parallel to the game loop.
    const bodyObserver = new MutationObserver(updateBtnState);
    bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    btn.__langMenuCleanup = () => {
        bodyObserver.disconnect();
        btn.removeEventListener('click', onBtnClick);
        menu.removeEventListener('click', onMenuClick);
        document.removeEventListener('click', onDocClick);
        const oldBadge = btn.querySelector('#btn-lang-badge');
        if (oldBadge) oldBadge.remove();
    };
    return updateBtnState;
}
