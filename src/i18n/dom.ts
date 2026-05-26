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
 */
export function installLangMenu(opts: LangMenuOpts): (() => void) | undefined {
    const btn = document.getElementById('btn-lang');
    const menu = document.getElementById('lang-menu');
    if (!btn || !menu) return undefined;
    const badge = document.createElement('span');
    badge.className = 'gp-badge';
    badge.id = 'btn-lang-badge';
    btn.appendChild(badge);
    const LANG = opts.getLang();
    menu.querySelectorAll('button[data-lang]').forEach((b) => {
        if (b.getAttribute('data-lang') === LANG) b.classList.add('active');
    });
    function updateBtnState() {
        btn!.style.display = opts.canSwitch() ? 'flex' : 'none';
        if (!opts.canSwitch()) menu!.classList.remove('open');
    }
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!opts.canSwitch()) {
            opts.showEffect('⏸ ' + opts.t('hint.langPauseFirst'));
            return;
        }
        menu.classList.toggle('open');
    });
    menu.addEventListener('click', (e) => {
        const target = (e.target as HTMLElement).closest('button[data-lang]');
        if (!target) return;
        e.preventDefault();
        e.stopPropagation();
        const lang = target.getAttribute('data-lang');
        if (lang) opts.setLang(lang);
        menu.classList.remove('open');
    });
    document.addEventListener('click', (e) => {
        if (!menu.classList.contains('open')) return;
        if (e.target === btn || menu.contains(e.target as Node)) return;
        menu.classList.remove('open');
    });
    updateBtnState();
    setInterval(updateBtnState, 250);
    return updateBtnState;
}
