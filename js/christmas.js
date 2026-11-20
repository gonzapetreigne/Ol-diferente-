/**
 * ============================================================================
 * OLÉ DIFERENTE — EDICIÓN NAVIDAD (3 Diseños Diferenciados)
 * Activación en vivo desde el Panel Admin (Supabase: __CONFIG_NAVIDAD__)
 *
 * Modos:
 *   1 = Navidad Clásica  -> Guirnalda de pino + bolas rojas/doradas + gorro Santa
 *                           + trineo de Santa cada ~35s + nieve + acebo en tarjetas.
 *   2 = Navidad Dorada   -> Guirnalda de hilos de oro y estrellas colgantes (sin pino verde)
 *       (Minimalista)       + gorro Santa + lluvia de estrellas doradas + trineo.
 *   3 = Nochebuena       -> Guirnalda de pino con luces multicolores titilantes + más bolas
 *       (Máximo)            + Árbol de Navidad iluminado con regalos en la esquina
 *                           + copos de nieve cristalinos (❄) + trineo cada ~22s.
 * ============================================================================
 */
(function () {
    const FORCE_LIVE_MODE = 0;   // 0 = controlado desde el Panel Admin (Supabase)
    const DEFAULT_LIVE_MODE = 3; // Modo inicial por defecto (Opción 3 activa en vivo)

    const MODES = {
        1: { garland: 'pine', lights: false, baubles: 'classic', cornerTree: false, snowflakes: false, sleigh: 'interval', every: 35000, holly: true,  crest: true, snow: 48 },
        2: { garland: 'gold', lights: false, baubles: false,     cornerTree: false, snowflakes: false, sleigh: 'interval', every: 45000, holly: false, crest: true, snow: 34 },
        3: { garland: 'pine', lights: true,  baubles: 'festive', cornerTree: true,  snowflakes: true,  sleigh: 'interval', every: 22000, holly: true,  crest: true, snow: 64 }
    };

    const TREE_ICON = `<svg width="15" height="17" viewBox="0 0 16 18" fill="none" aria-hidden="true">
        <path d="M8 1 L12 6 H10 L13.5 10 H11 L15 15 H1 L5 10 H2.5 L6 6 H4 Z" fill="#FFEFA6"/>
        <rect x="7" y="15" width="2" height="2.5" fill="#D4AF37"/></svg>`;

    class OleChristmasExperience {
        constructor() {
            const isSubPage = window.location.pathname.includes('/productos/');
            this.basePath = isSubPage ? '../' : '';
            this.activeMode = 0;
            this.isPreviewOnly = false;
            this.paused = localStorage.getItem('ole_xmas_paused') === '1';
            this.reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

            this.canvas = null;
            this.ctx = null;
            this.particles = [];
            this.trail = [];
            this.isRunning = false;
            this.windTarget = 0;
            this.windCurrent = 0;
            this.sleighTimer = null;
            this.sleighEl = null;
            this.originalMarqueeHTML = null;
            this.resizeTimer = null;

            this.checkUrlParams();
            this.bootstrapImmediateState();
        }

        /* ---------------------------------------------------------------- */
        /* Estado / activación                                               */
        /* ---------------------------------------------------------------- */
        checkUrlParams() {
            try {
                const params = new URLSearchParams(window.location.search);
                if (!params.has('navidad')) return;
                const val = (params.get('navidad') || '').toLowerCase();
                if (['0', 'off', 'false', 'no'].includes(val)) {
                    localStorage.removeItem('ole_xmas_preview_mode');
                } else {
                    localStorage.setItem('ole_xmas_preview_mode', ['2', '3'].includes(val) ? val : '1');
                }
            } catch (e) { /* noop */ }
        }

        getPreview() {
            return parseInt(localStorage.getItem('ole_xmas_preview_mode') || '0', 10) || 0;
        }

        bootstrapImmediateState() {
            const rawSession = sessionStorage.getItem('ole_xmas_live_mode');
            const cachedLive = rawSession !== null ? (parseInt(rawSession, 10) || 0) : DEFAULT_LIVE_MODE;
            const live = FORCE_LIVE_MODE || cachedLive;
            const hasUrlParam = new URLSearchParams(window.location.search).has('navidad');
            if (live > 0 && !hasUrlParam) {
                localStorage.removeItem('ole_xmas_preview_mode');
            }
            const preview = this.getPreview();
            if (preview > 0 && hasUrlParam) this.applyMode(preview, live === 0);
            else if (live > 0) this.applyMode(live, false);
            else if (preview > 0) this.applyMode(preview, true);
        }

        syncFromSupabase(dbValue) {
            const live = Math.max(0, parseInt(dbValue, 10) || 0);
            sessionStorage.setItem('ole_xmas_live_mode', String(live));
            const effectiveLive = FORCE_LIVE_MODE || live;
            const hasUrlParam = new URLSearchParams(window.location.search).has('navidad');
            if (effectiveLive > 0 && !hasUrlParam) {
                localStorage.removeItem('ole_xmas_preview_mode');
            }
            const preview = this.getPreview();

            if (preview > 0 && hasUrlParam) this.applyMode(preview, effectiveLive === 0);
            else if (effectiveLive > 0) this.applyMode(effectiveLive, false);
            else if (preview > 0) this.applyMode(preview, true);
            else this.teardown();
        }

        /** Llamado por components.js después de renderizar el header */
        refresh() {
            if (this.activeMode > 0) this.injectAll();
        }

        applyMode(mode, isPreviewOnly = false) {
            mode = MODES[mode] ? mode : 1;
            if (!document.body) {
                document.addEventListener('DOMContentLoaded', () => this.applyMode(mode, isPreviewOnly), { once: true });
                return;
            }

            const changed = this.activeMode !== mode;
            if (changed && this.activeMode > 0) this.removeDecor();

            this.activeMode = mode;
            this.isPreviewOnly = isPreviewOnly;
            this.cfg = MODES[mode];

            document.body.classList.add('ole-xmas-active');
            document.body.classList.remove('ole-xmas-mode-1', 'ole-xmas-mode-2', 'ole-xmas-mode-3');
            document.body.classList.add(`ole-xmas-mode-${mode}`);
            document.body.classList.toggle('ole-xmas-paused', this.paused);

            this.injectAll();
            this.initCanvas(changed);
            if (changed) this.startSleighSchedule();
        }

        injectAll() {
            this.injectGarland();
            this.injectSantaHat();
            this.injectCornerTree();
            this.upgradeMarquee();
            this.injectHeroCrest();
            this.injectTiendaBanner();
            this.injectHolly();
            this.injectQuizRibbon();
            this.injectDock();
        }

        removeDecor() {
            ['.ole-xmas-garland', '.ole-xmas-hat', '.ole-xmas-corner-tree', '.ole-xmas-hero-crest',
             '.ole-xmas-boutique-banner', '.ole-xmas-quiz-ribbon', '.ole-xmas-dock', '.ole-xmas-holly', '.ole-xmas-sleigh']
                .forEach(sel => document.querySelectorAll(sel).forEach(el => el.remove()));
            this.sleighEl = null;
            if (this.sleighTimer) { clearTimeout(this.sleighTimer); this.sleighTimer = null; }
            if (this.originalMarqueeHTML) {
                const track = document.querySelector('.marquee-track');
                if (track) track.innerHTML = this.originalMarqueeHTML;
            }
        }

        teardown() {
            if (!this.activeMode) return;
            this.removeDecor();
            this.activeMode = 0;
            this.isRunning = false;
            if (this.canvas) { this.canvas.remove(); this.canvas = null; }
            document.body.classList.remove('ole-xmas-active', 'ole-xmas-mode-1', 'ole-xmas-mode-2', 'ole-xmas-mode-3', 'ole-xmas-paused');
        }

        /* ---------------------------------------------------------------- */
        /* 1. Guirnalda superior (Pino en Modos 1 y 3 / Hilos de Oro Modo 2) */
        /* ---------------------------------------------------------------- */
        injectGarland() {
            const header = document.querySelector('header');
            if (!this.cfg.garland || !header || !header.querySelector('.logo')) return;

            let wrap = header.querySelector('.ole-xmas-garland');
            if (!wrap) {
                wrap = document.createElement('div');
                wrap.className = 'ole-xmas-garland';
                wrap.setAttribute('aria-hidden', 'true');
                header.insertBefore(wrap, header.firstChild);

                if (!this._resizeBound) {
                    this._resizeBound = true;
                    window.addEventListener('resize', () => {
                        clearTimeout(this.resizeTimer);
                        this.resizeTimer = setTimeout(() => {
                            const g = document.querySelector('.ole-xmas-garland');
                            if (g && this.activeMode > 0) {
                                g.innerHTML = this.cfg.garland === 'gold'
                                    ? this.buildGoldGarlandSVG(g.offsetWidth || window.innerWidth)
                                    : this.buildPineGarlandSVG(g.offsetWidth || window.innerWidth);
                            }
                        }, 200);
                    }, { passive: true });
                }
            }

            const width = wrap.offsetWidth || window.innerWidth;
            wrap.innerHTML = this.cfg.garland === 'gold'
                ? this.buildGoldGarlandSVG(width)
                : this.buildPineGarlandSVG(width);
        }

        /** Guirnalda minimalista de hilos de oro y estrellas colgantes (Modo 2) */
        buildGoldGarlandSVG(W) {
            W = Math.max(320, Math.round(W));
            const isMobile = W <= 768;
            const n = Math.max(3, Math.round(W / (isMobile ? 130 : 210)));
            const sw = W / n;
            const top = 2;
            const sag = isMobile ? 12 : 17;

            let d1 = `M0 ${top}`;
            let d2 = `M0 ${top}`;
            let stars = '';

            for (let i = 0; i < n; i++) {
                const x0 = i * sw;
                const xm = x0 + sw / 2;
                const x1 = x0 + sw;
                d1 += ` Q${xm.toFixed(1)} ${top + 2 * sag} ${x1.toFixed(1)} ${top}`;
                d2 += ` Q${xm.toFixed(1)} ${top + 2.7 * sag} ${x1.toFixed(1)} ${top}`;

                // Estrella colgante en cada unión (excepto sobre el logo/menú móvil)
                if (i > 0) {
                    const len = (i % 2 === 0) ? 20 : 13;
                    const sy = top + len;
                    stars += `<g class="ole-xmas-bauble b${(i % 3) + 1}" style="transform-origin:${x0.toFixed(1)}px ${top}px">
                        <line x1="${x0.toFixed(1)}" y1="${top}" x2="${x0.toFixed(1)}" y2="${sy}" stroke="#FFEFA6" stroke-width="0.8" stroke-dasharray="2 1"/>
                        <path d="M${x0.toFixed(1)} ${sy} l2.2 5.3 l5.8 0.5 l-4.4 3.8 l1.3 5.6 l-4.9 -3 l-4.9 3 l1.3 -5.6 l-4.4 -3.8 l5.8 -0.5 Z" fill="#FFEFA6" stroke="#D4AF37" stroke-width="0.6"/>
                    </g>`;
                }
            }

            return `<svg width="${W}" height="80" viewBox="0 0 ${W} 80" xmlns="http://www.w3.org/2000/svg">
                <path d="${d1}" stroke="#D4AF37" stroke-width="1.3" fill="none" stroke-dasharray="3 3" opacity="0.9"/>
                <path d="${d2}" stroke="#FFEFA6" stroke-width="0.9" fill="none" opacity="0.65"/>
                ${stars}
            </svg>`;
        }

        /** Guirnalda clásica de pino con moños, bolas y luces (Modos 1 y 3) */
        buildPineGarlandSVG(W) {
            W = Math.max(320, Math.round(W));
            const isMobile = W <= 768;
            const top = 3;
            const sag = isMobile ? 12 : 18;
            const n = Math.max(2, Math.round(W / (isMobile ? 150 : 230)));
            const sw = W / n;
            const yAt = (x) => {
                const t = ((x % sw) + sw) % sw / sw;
                return top + 4 * sag * t * (1 - t);
            };

            let seed = 7;
            const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

            let base = `M0 ${top}`;
            for (let i = 0; i < n; i++) {
                const x0 = i * sw;
                base += ` Q${(x0 + sw / 2).toFixed(1)} ${top + 2 * sag} ${(x0 + sw).toFixed(1)} ${top}`;
            }

            const greens = ['#143826', '#1E4D33', '#2A6142', '#0F2A1C'];
            let needles = '';
            const step = isMobile ? 6 : 5;
            for (let x = 0; x <= W; x += step) {
                const y = yAt(x);
                const t = ((x % sw) / sw);
                const slope = (4 * sag * (1 - 2 * t)) / sw;
                const ang = Math.atan(slope);
                for (let k = 0; k < 3; k++) {
                    const side = k % 2 === 0 ? 1 : -1;
                    const a = ang + side * (0.9 + rnd() * 0.6) + (k === 2 ? Math.PI / 2 * (rnd() - 0.5) : 0);
                    const len = 6 + rnd() * 6;
                    const x2 = x + Math.cos(a) * len * (k === 2 ? 0.5 : 1);
                    const y2 = y + Math.sin(a) * len;
                    needles += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${greens[Math.floor(rnd() * greens.length)]}"/>`;
                }
            }

            let bows = '';
            for (let i = 1; i < n; i++) {
                const x = i * sw;
                bows += `<g transform="translate(${x.toFixed(1)} ${top + 3})">
                    <path d="M0 0 C-10 -8 -15 2 -9 6 C-5 8 -2 4 0 0 Z" fill="url(#oxRed)" stroke="#D4AF37" stroke-width="0.6"/>
                    <path d="M0 0 C10 -8 15 2 9 6 C5 8 2 4 0 0 Z" fill="url(#oxRed)" stroke="#D4AF37" stroke-width="0.6"/>
                    <path d="M-1 1 L-5 14 L-2 12 L0 15 Z M1 1 L5 14 L2 12 L0 15 Z" fill="#7A1321"/>
                    <circle r="2.4" fill="#D4AF37"/></g>`;
            }

            // Luces multicolores titilantes (Modo 3: Nochebuena)
            let lights = '';
            if (this.cfg.lights) {
                const colors = ['#FF4D4D', '#FFE066', '#4DFF88', '#5CE1E6', '#FFF5CC'];
                let idx = 0;
                for (let i = 0; i < n; i++) {
                    [0.16, 0.36, 0.58, 0.80].forEach(t => {
                        const x = i * sw + sw * t;
                        const y = yAt(x) + 4;
                        const c = colors[idx % colors.length];
                        lights += `<g class="ole-xmas-light" style="animation-delay:${(-(idx * 0.33) % 1.6).toFixed(2)}s">
                            <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="${c}" opacity="0.38"/>
                            <ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="2.2" ry="3.2" fill="${c}"/></g>`;
                        idx++;
                    });
                }
            }

            // Bolas de árbol: ubicadas en extremos seguros (en móvil x=12 y x=W-12 para no tocar jamás el botón ≡ ni el logo)
            let baubles = '';
            if (this.cfg.baubles) {
                const list = isMobile
                    ? [
                        { x: 12,     len: 16, r: 8.5, color: 'red',  cls: 'b1' },
                        { x: W - 12, len: 22, r: 9,   color: 'gold', cls: 'b2' }
                    ]
                    : [
                        { x: 28,     len: 26, r: 13, color: 'red',  cls: 'b1' },
                        { x: W - 28, len: 38, r: 14, color: 'gold', cls: 'b2' }
                    ];

                // En Modo 3 (Nochebuena) en escritorio sumamos 2 bolas extra en espacios libres
                if (this.cfg.baubles === 'festive' && !isMobile && W >= 1150) {
                    list.push(
                        { x: 245,     len: 18, r: 10.5, color: 'green', cls: 'desktop-only b3' },
                        { x: W - 210, len: 20, r: 10.5, color: 'red',   cls: 'desktop-only b1' }
                    );
                }

                list.forEach(b => { baubles += this.baubleSVG(b.x, yAt(b.x) + 2, b.len, b.r, b.color, b.cls); });
            }

            const H = 110;
            return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <radialGradient id="oxRed" cx="35%" cy="30%" r="75%">
                        <stop offset="0%" stop-color="#E0384F"/><stop offset="55%" stop-color="#9E1B2B"/><stop offset="100%" stop-color="#4A0710"/>
                    </radialGradient>
                    <radialGradient id="oxGold" cx="35%" cy="30%" r="75%">
                        <stop offset="0%" stop-color="#FFF4C4"/><stop offset="50%" stop-color="#D4AF37"/><stop offset="100%" stop-color="#7A5A0E"/>
                    </radialGradient>
                    <radialGradient id="oxGreen" cx="35%" cy="30%" r="75%">
                        <stop offset="0%" stop-color="#4E9B6E"/><stop offset="55%" stop-color="#1E5A3A"/><stop offset="100%" stop-color="#0B2417"/>
                    </radialGradient>
                    <linearGradient id="oxCap" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stop-color="#8B6914"/><stop offset="50%" stop-color="#FFEFA6"/><stop offset="100%" stop-color="#8B6914"/>
                    </linearGradient>
                </defs>
                ${baubles}
                <path d="${base}" stroke="#0F2A1C" stroke-width="9" fill="none" stroke-linecap="round"/>
                <g stroke-width="1.6" stroke-linecap="round">${needles}</g>
                <path d="${base}" stroke="#E8C766" stroke-width="1.8" fill="none" stroke-dasharray="0.1 9" stroke-linecap="round" opacity="0.9"/>
                ${lights}
                ${bows}
            </svg>`;
        }

        baubleSVG(x, y, len, r, color, cls) {
            const fill = color === 'gold' ? 'url(#oxGold)' : (color === 'green' ? 'url(#oxGreen)' : 'url(#oxRed)');
            const band = color === 'gold' ? '#9E1B2B' : '#E8C766';
            const cy = y + len + 4 + r;
            return `<g class="ole-xmas-bauble ${cls}" style="transform-origin:${x.toFixed(1)}px ${y.toFixed(1)}px">
                <line x1="${x}" y1="${y}" x2="${x}" y2="${y + len}" stroke="#D4AF37" stroke-width="0.9"/>
                <rect x="${x - r * 0.32}" y="${y + len}" width="${r * 0.64}" height="5" rx="1" fill="url(#oxCap)"/>
                <circle cx="${x}" cy="${cy}" r="${r}" fill="${fill}"/>
                <path d="M${x - r * 0.92} ${cy + r * 0.12} Q${x} ${cy + r * 0.5} ${x + r * 0.92} ${cy + r * 0.12}" stroke="${band}" stroke-width="1.1" fill="none" opacity="0.85"/>
                <path d="M${x - r * 0.95} ${cy - r * 0.15} Q${x} ${cy + r * 0.22} ${x + r * 0.95} ${cy - r * 0.15}" stroke="${band}" stroke-width="0.6" fill="none" opacity="0.6"/>
                <ellipse cx="${x - r * 0.35}" cy="${cy - r * 0.4}" rx="${r * 0.28}" ry="${r * 0.18}" fill="#fff" opacity="0.45" transform="rotate(-30 ${x - r * 0.35} ${cy - r * 0.4})"/>
            </g>`;
        }

        /* ---------------------------------------------------------------- */
        /* 2. Gorro de Papá Noel sobre la "Ó" del logo                       */
        /* ---------------------------------------------------------------- */
        injectSantaHat() {
            const logo = document.querySelector('header .logo');
            if (!logo || logo.querySelector('.ole-xmas-hat')) return;

            const hat = document.createElement('div');
            hat.className = 'ole-xmas-hat';
            hat.setAttribute('aria-hidden', 'true');
            hat.innerHTML = `
                <svg viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="oxHatRed" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stop-color="#D42A40"/><stop offset="55%" stop-color="#9E1B2B"/><stop offset="100%" stop-color="#5A0812"/>
                        </linearGradient>
                        <linearGradient id="oxFur" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#FFFFFF"/><stop offset="100%" stop-color="#DCD5C6"/>
                        </linearGradient>
                        <radialGradient id="oxPom" cx="40%" cy="35%" r="70%">
                            <stop offset="0%" stop-color="#FFFFFF"/><stop offset="100%" stop-color="#D8D1C2"/>
                        </radialGradient>
                    </defs>
                    <path d="M14 78 Q24 34 62 16 Q92 4 106 28 Q113 42 106 58 Q98 42 86 38 Q68 34 62 50 Q56 64 54 78 Z" fill="url(#oxHatRed)"/>
                    <path d="M30 70 Q40 40 66 24" stroke="#FF6B7D" stroke-width="2" fill="none" opacity="0.35" stroke-linecap="round"/>
                    <rect x="6" y="70" width="70" height="18" rx="9" fill="url(#oxFur)" stroke="#D4AF37" stroke-width="0.8"/>
                    <circle cx="105" cy="63" r="10" fill="url(#oxPom)" stroke="#D4AF37" stroke-width="0.6"/>
                </svg>`;
            logo.appendChild(hat);
        }

        /* ---------------------------------------------------------------- */
        /* 3. Árbol de Navidad decorado en esquina inferior (Modo 3)         */
        /* ---------------------------------------------------------------- */
        injectCornerTree() {
            if (!this.cfg.cornerTree || document.querySelector('.ole-xmas-corner-tree')) return;

            const tree = document.createElement('div');
            tree.className = 'ole-xmas-corner-tree';
            tree.setAttribute('aria-hidden', 'true');
            tree.innerHTML = `
                <svg viewBox="0 0 120 158" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="oxTreeG" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stop-color="#276B45"/><stop offset="50%" stop-color="#17492D"/><stop offset="100%" stop-color="#0B2617"/>
                        </linearGradient>
                    </defs>
                    <!-- Tronco -->
                    <rect x="52" y="130" width="16" height="20" rx="2" fill="#5D3A1A" stroke="#D4AF37" stroke-width="0.8"/>
                    <!-- Capas del pino -->
                    <path d="M60 18 L86 54 H73 L96 86 H81 L108 130 H12 L39 86 H24 L47 54 H34 Z" fill="url(#oxTreeG)" stroke="#D4AF37" stroke-width="1.2" stroke-linejoin="round"/>
                    <!-- Guirnaldas doradas sobre el árbol -->
                    <path d="M40 50 Q60 62 80 48 M30 82 Q60 98 90 80 M20 116 Q60 134 100 114" stroke="#FFEFA6" stroke-width="1.5" fill="none" stroke-dasharray="2 3"/>
                    <!-- Estrella superior -->
                    <path class="ole-xmas-light" d="M60 2 L63.5 11.5 L73.5 12 L65.5 18 L68.2 27.5 L60 22 L51.8 27.5 L54.5 18 L46.5 12 L56.5 11.5 Z" fill="#FFEFA6" stroke="#D4AF37" stroke-width="0.8"/>
                    <!-- Bolas y luces del árbol -->
                    <circle class="ole-xmas-light" cx="55" cy="42" r="3.6" fill="#E0384F"/>
                    <circle class="ole-xmas-light" style="animation-delay:-0.5s" cx="68" cy="58" r="3.8" fill="#FFE066"/>
                    <circle class="ole-xmas-light" style="animation-delay:-1.1s" cx="46" cy="70" r="3.8" fill="#5CE1E6"/>
                    <circle class="ole-xmas-light" style="animation-delay:-0.3s" cx="74" cy="84" r="4" fill="#E0384F"/>
                    <circle class="ole-xmas-light" style="animation-delay:-0.8s" cx="56" cy="96" r="3.6" fill="#4DFF88"/>
                    <circle class="ole-xmas-light" style="animation-delay:-1.4s" cx="38" cy="108" r="4.2" fill="#E0384F"/>
                    <circle class="ole-xmas-light" style="animation-delay:-0.6s" cx="82" cy="112" r="4.2" fill="#FFE066"/>
                    <circle class="ole-xmas-light" style="animation-delay:-1.0s" cx="62" cy="120" r="3.8" fill="#E0384F"/>
                    <!-- Cajas de regalo al pie del árbol -->
                    <rect x="24" y="134" width="22" height="18" rx="2" fill="#9E1B2B" stroke="#FFEFA6" stroke-width="1"/>
                    <line x1="35" y1="134" x2="35" y2="152" stroke="#FFEFA6" stroke-width="2.2"/>
                    <line x1="24" y1="143" x2="46" y2="143" stroke="#FFEFA6" stroke-width="2"/>
                    <rect x="72" y="137" width="20" height="15" rx="2" fill="#D4AF37" stroke="#9E1B2B" stroke-width="1"/>
                    <line x1="82" y1="137" x2="82" y2="152" stroke="#9E1B2B" stroke-width="2"/>
                    <line x1="72" y1="144.5" x2="92" y2="144.5" stroke="#9E1B2B" stroke-width="1.8"/>
                </svg>`;
            document.body.appendChild(tree);
        }

        /* ---------------------------------------------------------------- */
        /* 4. Trineo Victoriano de Papá Noel con 3 Renos Castaños Detallados */
        /* ---------------------------------------------------------------- */
        sleighSVG() {
            const reindeer = (cls, tx, ty, scale, rudolph) => `
                <g transform="translate(${tx} ${ty}) scale(${scale})">
                    <g class="ole-xmas-reindeer ${cls}">
                        <!-- Patas traseras y delanteras lejanas (sombra 3D) -->
                        <path d="M26 60 L14 73 L5 71 L3 74 L16 77 L31 63 Z" fill="#5A3214"/>
                        <path d="M32 62 L24 78 L18 81 L18 84 L28 81 L37 64 Z" fill="#5A3214"/>
                        <path d="M72 58 L84 68 L92 64 L94 67 L84 73 L68 61 Z" fill="#5A3214"/>
                        <path d="M67 61 L75 76 L71 83 L74 85 L80 76 L72 62 Z" fill="#5A3214"/>

                        <!-- Astas ramificadas (asta lejana) -->
                        <path d="M84 18 C80 9 72 4 64 2 M76 11 C76 5 79 1 82 -1 M70 6 C69 1 71 -3 74 -4" stroke="#8C6239" stroke-width="2.2" stroke-linecap="round" fill="none"/>

                        <!-- Oreja lejana -->
                        <path d="M80 19 C75 15 71 17 73 21 C75 23 79 22 80 19 Z" fill="#6E3F19"/>

                        <!-- Cola -->
                        <path d="M19 49 C12 45 9 49 13 54 C16 56 20 54 21 51 Z" fill="url(#oxDeerFur)"/>
                        <path d="M13 52 C14 55 18 55 20 52" stroke="#F3E1C8" stroke-width="1.5" stroke-linecap="round" fill="none"/>

                        <!-- Patas cercanas (con pezuñas oscuras) -->
                        <path d="M23 58 C17 66 10 72 3 75 L1 79 L8 78 C15 74 23 68 29 60 Z" fill="url(#oxDeerFur)"/>
                        <polygon points="1,79 8,78 6,75 2,75" fill="#231207"/>
                        <path d="M70 57 C79 62 87 62 95 57 L98 60 L92 64 C84 67 75 65 66 60 Z" fill="url(#oxDeerFur)"/>
                        <polygon points="95,57 98,60 93,63 91,60" fill="#231207"/>

                        <!-- Cuerpo y Cuello esbelto del Reno -->
                        <path d="M19 53 C18 44 28 41 42 43 C54 44 63 43 68 37 C73 30 76 21 80 17 C84 14 90 16 90 22 C89 29 84 42 79 52 C75 60 66 63 54 62 C39 61 21 61 19 53 Z" fill="url(#oxDeerFur)"/>

                        <!-- Pecho y Vientre crema claro (estilo 3D referencia) -->
                        <path d="M25 58 C38 61 54 61 67 59 C74 56 79 47 83 35 C85 28 86 24 85 22 C83 27 79 38 73 48 C66 55 44 56 25 58 Z" fill="url(#oxDeerCream)" opacity="0.92"/>

                        <!-- Cabeza y Hocico -->
                        <path d="M78 19 C81 13 89 13 95 17 C100 20 105 21 107 24 C108 27 104 30 98 29 C92 29 84 28 80 24 Z" fill="url(#oxDeerFur)"/>
                        <!-- Mejilla suave -->
                        <ellipse cx="89" cy="24" rx="6" ry="3.5" fill="#C68853" opacity="0.55"/>

                        <!-- Oreja cercana con interior claro -->
                        <path d="M81 20 C75 15 69 18 72 23 C75 26 80 24 81 20 Z" fill="url(#oxDeerFur)"/>
                        <path d="M79 20.5 C75 17.5 72 19 74 22 C76 23.5 78.5 22.5 79 20.5 Z" fill="#F0D7B8"/>

                        <!-- Ojo expresivo con brillo blanco -->
                        <circle cx="90.5" cy="19.5" r="2.1" fill="#1F1006"/>
                        <circle cx="91.2" cy="18.8" r="0.75" fill="#FFFFFF"/>

                        <!-- Astas ramificadas principales (asta cercana iluminada) -->
                        <path d="M85 16 C82 6 73 0 62 -2 M78 9 C79 2 83 -2 87 -4 M72 3 C72 -3 75 -7 79 -8 M67 0 C65 -5 67 -8 70 -10" stroke="url(#oxAntler)" stroke-width="2.5" stroke-linecap="round" fill="none"/>

                        <!-- Arnés Navideño Rojo y Dorado con Cascabeles -->
                        <path d="M66 39 C71 45 77 50 81 51" stroke="#B51B2E" stroke-width="4.5" stroke-linecap="round" fill="none"/>
                        <path d="M66 39 C71 45 77 50 81 51" stroke="#FFEFA6" stroke-width="1.2" stroke-dasharray="2 2" stroke-linecap="round" fill="none"/>
                        <path d="M46 43 C47 51 47 57 46 62" stroke="#B51B2E" stroke-width="4" stroke-linecap="round" fill="none"/>
                        <path d="M46 43 C47 51 47 57 46 62" stroke="#D4AF37" stroke-width="1" fill="none"/>
                        <path d="M46 51 C57 52 68 49 75 47" stroke="#B51B2E" stroke-width="3.2" fill="none"/>
                        <!-- Cabezada roja en el hocico -->
                        <path d="M97 18 C98 22 97 26 95 29 M83 25 L96 27" stroke="#B51B2E" stroke-width="1.8" stroke-linecap="round" fill="none"/>
                        <circle cx="95" cy="27" r="1.6" fill="#FFEFA6"/>

                        <!-- Cascabeles dorados en el pecho -->
                        <circle cx="71" cy="46" r="2.6" fill="url(#oxSlGold)" stroke="#7A520A" stroke-width="0.5"/>
                        <circle cx="76" cy="50" r="2.8" fill="url(#oxSlGold)" stroke="#7A520A" stroke-width="0.5"/>
                        <circle cx="81" cy="53" r="2.5" fill="url(#oxSlGold)" stroke="#7A520A" stroke-width="0.5"/>

                        <!-- Nariz (oscura o roja brillante en Rodolfo) -->
                        ${rudolph
                            ? `<circle class="ole-xmas-rudolph-nose" cx="107" cy="24" r="3.4" fill="#FF2233"/>
                               <circle class="ole-xmas-rudolph-nose" cx="107" cy="24" r="7.5" fill="#FF2233" opacity="0.35"/>
                               <circle cx="106.2" cy="23" r="1.1" fill="#FFF" opacity="0.85"/>`
                            : `<ellipse cx="106.5" cy="24.2" rx="2.2" ry="1.8" fill="#231207"/>
                               <circle cx="106" cy="23.6" r="0.6" fill="#FFF" opacity="0.5"/>`
                        }
                    </g>
                </g>`;

            return `
                <svg viewBox="0 0 520 165" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="oxSlGold" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stop-color="#FFF5C0"/>
                            <stop offset="45%" stop-color="#D4AF37"/>
                            <stop offset="100%" stop-color="#7D5A0E"/>
                        </linearGradient>
                        <linearGradient id="oxSlRed" x1="0" y1="0" x2="0.2" y2="1">
                            <stop offset="0%" stop-color="#D9263E"/>
                            <stop offset="55%" stop-color="#9B1122"/>
                            <stop offset="100%" stop-color="#4A040C"/>
                        </linearGradient>
                        <linearGradient id="oxSlRedDark" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#7A0C1A"/>
                            <stop offset="100%" stop-color="#360208"/>
                        </linearGradient>
                        <linearGradient id="oxDeerFur" x1="0.2" y1="0" x2="0.8" y2="1">
                            <stop offset="0%" stop-color="#C27D44"/>
                            <stop offset="55%" stop-color="#8C5122"/>
                            <stop offset="100%" stop-color="#522C0E"/>
                        </linearGradient>
                        <linearGradient id="oxDeerCream" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#F7E7CE"/>
                            <stop offset="100%" stop-color="#CFAF86"/>
                        </linearGradient>
                        <linearGradient id="oxAntler" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#E6C99E"/>
                            <stop offset="100%" stop-color="#8A6336"/>
                        </linearGradient>
                        <linearGradient id="oxSack" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stop-color="#B07D4F"/>
                            <stop offset="60%" stop-color="#7D522B"/>
                            <stop offset="100%" stop-color="#4A2E14"/>
                        </linearGradient>
                    </defs>

                    <!-- Riendas dobles doradas (tras los renos) -->
                    <path d="M138 78 Q210 92 276 72 Q345 55 376 54 Q442 40 478 36" stroke="#D4AF37" stroke-width="1.2" fill="none" opacity="0.85"/>

                    <!-- 3 Renos Castaños en formación de vuelo escalonada -->
                    ${reindeer('r1', 194, 48, 0.96, false)}
                    ${reindeer('r2', 292, 30, 0.96, false)}
                    ${reindeer('r3', 390, 12, 0.98, true)}

                    <!-- Riendas principales doradas (frente) -->
                    <path d="M136 81 Q205 98 265 82 Q335 66 364 64 Q432 48 468 44" stroke="url(#oxSlGold)" stroke-width="1.5" fill="none"/>

                    <!-- ==================== TRINEO VICTORIANO & PAPÁ NOEL ==================== -->
                    <g transform="translate(8, 16)">
                        <!-- Patines dorados inferiores con volutas en S (estilo referencia 1 y 2) -->
                        <g stroke="url(#oxSlGold)" fill="none" stroke-linecap="round">
                            <!-- Soportes verticales y arabescos en S -->
                            <path d="M36 106 L30 126 M78 108 L76 126 M124 106 L128 126" stroke-width="3"/>
                            <path d="M18 116 C12 110 22 102 30 110 C36 116 28 126 20 125" stroke-width="2.2"/>
                            <path d="M48 125 C44 114 64 114 60 125" stroke-width="2.2"/>
                            <path d="M92 125 C88 114 108 114 104 125" stroke-width="2.2"/>
                            <path d="M140 104 C152 104 160 118 148 124" stroke-width="2.4"/>
                            <!-- Hoja principal del patín con rizo frontal -->
                            <path d="M6 120 C4 126 12 127 24 127 L142 127 C164 127 178 112 175 96 C173 87 162 89 164 97 C165 102 171 100 170 95" stroke-width="3.4"/>
                        </g>

                        <!-- Regalos y Corona Navideña detrás del saco -->
                        <rect x="18" y="42" width="18" height="16" rx="2" transform="rotate(-12 18 42)" fill="#1E5A3A" stroke="#FFEFA6" stroke-width="1"/>
                        <line x1="27" y1="40" x2="24" y2="56" stroke="#E0384F" stroke-width="2.5"/>
                        <rect x="34" y="34" width="17" height="15" rx="2" transform="rotate(6 34 34)" fill="#1E62A8" stroke="#FFEFA6" stroke-width="1"/>
                        <line x1="42" y1="34" x2="41" y2="49" stroke="#FFEFA6" stroke-width="2.2"/>
                        <rect x="24" y="28" width="16" height="14" rx="2" transform="rotate(-6 24 28)" fill="#D9263E" stroke="#FFEFA6" stroke-width="1"/>
                        <!-- Corona de pino junto al saco -->
                        <circle cx="17" cy="56" r="11" fill="#184A2E" stroke="#296E47" stroke-width="2.5" stroke-dasharray="3 2"/>
                        <circle cx="12" cy="51" r="1.8" fill="#E0384F"/>
                        <circle cx="22" cy="50" r="1.8" fill="#FFE066"/>
                        <circle cx="15" cy="62" r="1.8" fill="#E0384F"/>
                        <path d="M17 46 C13 42 10 47 15 49 C17 49 17 47 17 46 Z M17 46 C21 42 24 47 19 49 C17 49 17 47 17 46 Z" fill="#D9263E"/>

                        <!-- Saco de Yute lleno de Regalos -->
                        <path d="M22 86 C14 70 18 50 32 45 C42 42 56 46 60 58 C64 70 60 86 48 88 Z" fill="url(#oxSack)" stroke="#3D240E" stroke-width="1"/>
                        <!-- Cuello fruncido y cuerda dorada del saco -->
                        <path d="M27 46 C35 49 47 49 54 45" stroke="#D4AF37" stroke-width="2.2" stroke-linecap="round" fill="none"/>
                        <path d="M32 54 C36 62 34 72 30 78 M46 52 C49 62 48 72 45 80" stroke="#5A391B" stroke-width="1" opacity="0.5" fill="none"/>

                        <!-- Interior oscuro del trineo -->
                        <path d="M48 64 L132 66 L128 96 L48 96 Z" fill="url(#oxSlRedDark)"/>

                        <!-- ==================== PAPÁ NOEL DETALLADO ==================== -->
                        <g>
                            <!-- Piernas y botas -->
                            <path d="M92 80 L118 82 L126 98 L112 100 L104 88 L88 88 Z" fill="#9B1122"/>
                            <rect x="109" y="88" width="16" height="6" rx="3" transform="rotate(-12 109 88)" fill="#FFFFFF"/>

                            <!-- Brazo izquierdo con campanita dorada en alto -->
                            <path d="M92 50 C102 44 112 36 116 28" stroke="#B8192D" stroke-width="10" stroke-linecap="round" fill="none"/>
                            <circle cx="115" cy="30" r="5.5" fill="#FFFFFF"/>
                            <circle cx="118" cy="25" r="4.2" fill="#2A1B12"/>
                            <!-- Campanita dorada -->
                            <g transform="translate(120, 14) rotate(18)">
                                <path d="M0 10 L10 10 L8 2 C7 0 3 0 2 2 Z" fill="url(#oxSlGold)" stroke="#7A520A" stroke-width="0.7"/>
                                <circle cx="5" cy="11" r="1.8" fill="#7A520A"/>
                            </g>

                            <!-- Torso con traje rojo y borde de piel blanca -->
                            <path d="M62 86 C60 64 66 46 82 44 C98 44 106 58 106 84 Z" fill="url(#oxSlRed)"/>
                            <!-- Cinturón negro con hebilla dorada -->
                            <path d="M63 73 Q85 76 105 72" stroke="#1E1410" stroke-width="6" fill="none"/>
                            <rect x="92" y="68.5" width="8" height="9" rx="1.5" fill="none" stroke="url(#oxSlGold)" stroke-width="2.2"/>
                            <!-- Borde vertical de piel blanca del abrigo -->
                            <path d="M88 46 Q94 66 93 84" stroke="#FFFFFF" stroke-width="5.5" stroke-linecap="round" fill="none"/>

                            <!-- Rostro de Papá Noel (mejillas rosadas, ojos, nariz) -->
                            <circle cx="84" cy="34" r="11" fill="#F6C6A4"/>
                            <circle cx="90" cy="36" r="3.2" fill="#E88078" opacity="0.65"/>
                            <circle cx="93.5" cy="33.5" r="2.2" fill="#E5726A"/>
                            <!-- Ojo y ceja blanca -->
                            <circle cx="88.5" cy="31" r="1.4" fill="#1F1209"/>
                            <circle cx="89" cy="30.5" r="0.5" fill="#FFFFFF"/>
                            <path d="M86 28.5 Q89 27 91.5 28.5" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" fill="none"/>

                            <!-- Barba blanca frondosa y bigote esculpido -->
                            <path d="M73 35 C71 46 78 58 90 59 C100 59 106 50 103 40 C99 36 93 36 86 36 C80 36 75 34 73 35 Z" fill="#FFFFFF"/>
                            <path d="M76 46 C82 54 94 55 100 47" stroke="#DCD5C7" stroke-width="1.2" fill="none"/>
                            <!-- Bigote -->
                            <path d="M85 37 C89 35 96 36 99 39 C95 41 89 40 85 37 Z M86 37 C82 36 77 38 76 41 C80 42 84 40 86 37 Z" fill="#F7F4EE" stroke="#DCD5C7" stroke-width="0.6"/>

                            <!-- Gorro clásico de Papá Noel -->
                            <path d="M71 29 C72 15 86 10 98 15 C106 18 110 26 107 33 C101 25 91 22 71 29 Z" fill="url(#oxSlRed)"/>
                            <!-- Banda de piel blanca del gorro -->
                            <path d="M70 29 Q83 24 96 28" stroke="#FFFFFF" stroke-width="6.5" stroke-linecap="round" fill="none"/>
                            <!-- Pompón blanco -->
                            <circle cx="67" cy="28" r="5" fill="#FFFFFF" stroke="#E0D9CC" stroke-width="0.8"/>

                            <!-- Brazo derecho sosteniendo las riendas -->
                            <path d="M78 54 C88 60 102 64 116 63" stroke="url(#oxSlRed)" stroke-width="9.5" stroke-linecap="round" fill="none"/>
                            <circle cx="116" cy="63" r="5.5" fill="#FFFFFF"/>
                            <circle cx="122" cy="63" r="4.2" fill="#2A1B12"/>
                        </g>

                        <!-- Carrocería lateral del Trineo Victoriano con bordes y arabescos de oro -->
                        <path d="M10 56 C18 54 26 62 32 76 C38 88 48 92 62 92 L92 92 C98 92 102 74 108 72 C115 70 120 77 117 85 C113 94 118 102 128 102 C139 102 146 92 144 82 C142 74 148 68 155 72 C162 76 158 92 146 102 C136 109 122 110 104 110 L46 110 C28 110 18 98 14 80 C11 67 6 58 10 56 Z" fill="url(#oxSlRed)" stroke="url(#oxSlGold)" stroke-width="2.4"/>

                        <!-- Arabescos de filigrana dorada sobre el lateral del trineo (como imagen 2) -->
                        <path d="M24 72 C28 88 40 98 58 99 C70 100 76 92 70 87 C65 83 58 89 63 94" stroke="url(#oxSlGold)" stroke-width="1.5" fill="none" stroke-linecap="round"/>
                        <path d="M34 86 C30 92 34 100 42 98 M82 99 C94 99 104 92 108 82" stroke="url(#oxSlGold)" stroke-width="1.3" fill="none" stroke-linecap="round"/>
                        <circle cx="112" cy="77" r="2.8" fill="url(#oxSlGold)"/>
                        <circle cx="151" cy="76" r="2.5" fill="url(#oxSlGold)"/>
                        <circle cx="13" cy="59" r="2.6" fill="url(#oxSlGold)"/>
                    </g>
                </svg>`;
        }

        startSleighSchedule() {
            if (this.sleighTimer) { clearTimeout(this.sleighTimer); this.sleighTimer = null; }
            if (this.reducedMotion || !this.cfg || !this.cfg.sleigh) return;
            this.sleighTimer = setTimeout(() => this.flySleigh(), 3000);
        }

        flySleigh() {
            if (!this.activeMode) return;
            if (document.hidden || this.paused) {
                this.sleighTimer = setTimeout(() => this.flySleigh(), 5000);
                return;
            }
            if (!this.sleighEl) {
                this.sleighEl = document.createElement('div');
                this.sleighEl.className = 'ole-xmas-sleigh';
                this.sleighEl.setAttribute('aria-hidden', 'true');
                this.sleighEl.innerHTML = this.sleighSVG();
                document.body.appendChild(this.sleighEl);
                this.sleighEl.addEventListener('animationend', (e) => {
                    if (e.target !== this.sleighEl) return;
                    this.sleighEl.classList.remove('flying');
                    if (this.cfg && this.cfg.sleigh === 'interval') {
                        this.sleighTimer = setTimeout(() => this.flySleigh(), this.cfg.every);
                    }
                });
            }
            this.sleighEl.classList.remove('flying');
            void this.sleighEl.offsetWidth;
            this.sleighEl.classList.add('flying');
        }

        /* ---------------------------------------------------------------- */
        /* 5. Marquee, Hero, Tienda, Tarjetas, Quiz                          */
        /* ---------------------------------------------------------------- */
        upgradeMarquee() {
            const track = document.querySelector('.marquee-track');
            if (!track) return;
            if (!this.originalMarqueeHTML) this.originalMarqueeHTML = track.innerHTML;

            let msg = `🎄 ESTA NAVIDAD REGALÁ UN PERFUME ORIGINAL &nbsp; • &nbsp; ENVÍOS GRATIS EN COMPRAS SUPERIORES A $150.000 &nbsp; • &nbsp; `;
            if (this.activeMode === 2) {
                msg = `✨ EDICIÓN DORADA DE NAVIDAD • PERFUMES ORIGINALES &nbsp; • &nbsp; ENVÍOS GRATIS EN COMPRAS SUPERIORES A $150.000 &nbsp; • &nbsp; `;
            } else if (this.activeMode === 3) {
                msg = `🎅 ¡FELIZ NAVIDAD TE DESEA OLÉ DIFERENTE! &nbsp; • &nbsp; ENVÍOS GRATIS EN COMPRAS SUPERIORES A $150.000 &nbsp; • &nbsp; `;
            }
            const html = msg.repeat(3);
            track.innerHTML = `<div class="marquee-content">${html}</div><div class="marquee-content" aria-hidden="true">${html}</div>`;
        }

        injectHeroCrest() {
            const slider = document.getElementById('hero-slider');
            if (!this.cfg.crest || !slider || slider.querySelector('.ole-xmas-hero-crest')) return;

            const crest = document.createElement('a');
            crest.className = 'ole-xmas-hero-crest';
            crest.href = '#quiz-perfume';
            const titles = {
                1: 'Edición Navidad • Olé Diferente',
                2: 'Golden Christmas • Olé Diferente',
                3: '¡Feliz Navidad! • Olé Diferente'
            };
            crest.innerHTML = `
                <div class="ole-xmas-hero-pill">${TREE_ICON}<span class="ole-xmas-hero-pill-text">${titles[this.activeMode]}</span>${TREE_ICON}</div>
                <span class="ole-xmas-hero-sub">Encontrá el regalo perfecto en nuestro quiz olfativo</span>`;
            slider.appendChild(crest);
        }

        injectTiendaBanner() {
            const controls = document.querySelector('.catalog-controls');
            if (!controls || document.querySelector('.ole-xmas-boutique-banner')) return;

            const banner = document.createElement('div');
            banner.className = 'ole-xmas-boutique-banner';
            banner.innerHTML = `
                <div class="ole-xmas-boutique-left">
                    <svg class="ole-xmas-boutique-icon" viewBox="0 0 56 64" aria-hidden="true">
                        <path d="M28 6 L40 22 H34 L45 36 H38 L50 52 H6 L18 36 H11 L22 22 H16 Z" fill="#1E5A3A" stroke="#D4AF37" stroke-width="1"/>
                        <path d="M28 1 L29.6 4.6 L33.5 5 L30.5 7.5 L31.4 11.3 L28 9.3 L24.6 11.3 L25.5 7.5 L22.5 5 L26.4 4.6 Z" fill="#FFEFA6"/>
                        <circle cx="24" cy="26" r="2.4" fill="#E0384F"/><circle cx="33" cy="33" r="2.4" fill="#D4AF37"/>
                        <circle cx="19" cy="42" r="2.6" fill="#D4AF37"/><circle cx="37" cy="46" r="2.6" fill="#E0384F"/>
                        <circle cx="28" cy="40" r="2.2" fill="#FFF8E7"/>
                        <rect x="24" y="52" width="8" height="8" fill="#7A5A0E"/>
                    </svg>
                    <div class="ole-xmas-boutique-copy">
                        <span class="ole-xmas-boutique-tag">🎁 Especial Regalos de Navidad</span>
                        <h2>Esta Navidad, regalá una fragancia inolvidable</h2>
                        <p>Perfumes originales árabes y de diseñador. ¿No sabés cuál elegir? Nuestro quiz te ayuda a encontrar el regalo ideal.</p>
                    </div>
                </div>
                <a href="${this.basePath}index.html#quiz-perfume" class="ole-xmas-boutique-cta">
                    <span>Encontrar el regalo ideal</span>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </a>`;
            controls.parentNode.insertBefore(banner, controls);
        }

        injectHolly() {
            if (!this.cfg.holly) return;
            document.querySelectorAll('.product-card .product-image-container').forEach(box => {
                if (box.querySelector('.ole-xmas-holly')) return;
                const h = document.createElement('div');
                h.className = 'ole-xmas-holly';
                h.setAttribute('aria-hidden', 'true');
                h.innerHTML = `
                    <svg viewBox="0 0 40 34" width="100%" height="100%">
                        <path d="M20 18 C14 10 6 12 2 6 C6 6 8 3 8 1 C12 5 16 4 18 8 C17 11 19 14 20 18 Z" fill="#1E5A3A" stroke="#0F2A1C" stroke-width="0.6"/>
                        <path d="M20 18 C26 10 34 12 38 6 C34 6 32 3 32 1 C28 5 24 4 22 8 C23 11 21 14 20 18 Z" fill="#2A6142" stroke="#0F2A1C" stroke-width="0.6"/>
                        <path d="M20 18 L8 4 M20 18 L32 4" stroke="#0F2A1C" stroke-width="0.5" opacity="0.6"/>
                        <circle cx="17" cy="21" r="4" fill="#C8243A"/><circle cx="23.5" cy="21.5" r="4" fill="#9E1B2B"/><circle cx="20" cy="26.5" r="4" fill="#B01E33"/>
                        <circle cx="15.8" cy="19.8" r="1.1" fill="#fff" opacity="0.6"/><circle cx="22.3" cy="20.3" r="1.1" fill="#fff" opacity="0.6"/><circle cx="18.8" cy="25.3" r="1.1" fill="#fff" opacity="0.6"/>
                    </svg>`;
                box.appendChild(h);
            });
        }

        injectQuizRibbon() {
            const qh = document.getElementById('quiz-header');
            if (!qh || qh.querySelector('.ole-xmas-quiz-ribbon')) return;
            const r = document.createElement('div');
            r.className = 'ole-xmas-quiz-ribbon';
            r.innerHTML = `${TREE_ICON}<span>Buscador de regalos de Navidad</span>`;
            qh.insertBefore(r, qh.firstChild);
        }

        injectDock() {
            document.querySelector('.ole-xmas-dock')?.remove();
            const dock = document.createElement('div');
            dock.className = 'ole-xmas-dock';
            const preview = this.isPreviewOnly
                ? `<a href="${this.basePath}admin.html" class="ole-xmas-preview-banner" title="Solo vos ves esto. Lanzalo en vivo desde el Panel Admin.">👁️ Vista Previa (Estilo ${this.activeMode})</a>`
                : '';
            dock.innerHTML = `${preview}
                <div class="ole-xmas-pill-ctrl" role="button" tabindex="0" aria-label="Pausar o reanudar animaciones navideñas" title="Pausar o reanudar animaciones navideñas">
                    <span class="ole-xmas-ctrl-icon">${TREE_ICON}</span>
                    <span class="ole-xmas-ctrl-info">
                        <span class="ole-xmas-ctrl-title">Feliz Navidad</span>
                        <span class="ole-xmas-ctrl-status">${this.paused ? 'Animaciones: pausadas' : 'Animaciones: activas ❄'}</span>
                    </span>
                </div>`;
            document.body.appendChild(dock);

            const ctrl = dock.querySelector('.ole-xmas-pill-ctrl');
            const toggle = () => {
                this.paused = !this.paused;
                localStorage.setItem('ole_xmas_paused', this.paused ? '1' : '0');
                document.body.classList.toggle('ole-xmas-paused', this.paused);
                const st = dock.querySelector('.ole-xmas-ctrl-status');
                if (st) st.textContent = this.paused ? 'Animaciones: pausadas' : 'Animaciones: activas ❄';
                if (this.paused && this.sleighEl) this.sleighEl.classList.remove('flying');
                if (!this.paused && this.cfg.sleigh === 'interval') this.startSleighSchedule();
            };
            ctrl.addEventListener('click', toggle);
            ctrl.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
        }

        /* ---------------------------------------------------------------- */
        /* 6. Canvas: nieve + polvo de oro + copos ❄ + estela del trineo     */
        /* ---------------------------------------------------------------- */
        initCanvas(rebuild) {
            if (!this.canvas) {
                this.canvas = document.createElement('canvas');
                this.canvas.id = 'ole-xmas-canvas';
                this.canvas.setAttribute('aria-hidden', 'true');
                document.body.appendChild(this.canvas);
                this.ctx = this.canvas.getContext('2d');
                if (!this._canvasBound) {
                    this._canvasBound = true;
                    window.addEventListener('resize', () => this.resizeCanvas(), { passive: true });
                    window.addEventListener('mousemove', (e) => {
                        this.windTarget = ((e.clientX / window.innerWidth) - 0.5) * 0.4;
                    }, { passive: true });
                }
                rebuild = true;
            }
            this.resizeCanvas();
            if (rebuild) this.createParticles();
            if (!this.isRunning) {
                this.isRunning = true;
                requestAnimationFrame(() => this.animate());
            }
        }

        resizeCanvas() {
            if (!this.canvas) return;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            this.canvas.width = window.innerWidth * dpr;
            this.canvas.height = window.innerHeight * dpr;
            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        createParticles() {
            const isMobile = window.innerWidth <= 768;
            const count = Math.round(this.cfg.snow * (isMobile ? 0.52 : 1));
            const w = window.innerWidth, h = window.innerHeight;
            this.particles = [];
            for (let i = 0; i < count; i++) {
                let kind = 'snow';
                if (this.activeMode === 2) {
                    kind = Math.random() < 0.45 ? 'star' : (Math.random() < 0.7 ? 'gold' : 'snow');
                } else if (this.cfg.snowflakes && Math.random() < 0.32) {
                    kind = 'flake';
                } else if (Math.random() < 0.35) {
                    kind = 'gold';
                }

                this.particles.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    kind,
                    r: kind === 'flake' ? (Math.random() * 4.5 + 4.5) : (kind === 'star' ? (Math.random() * 3.5 + 3) : (kind === 'gold' ? Math.random() * 2.8 + 1.5 : Math.random() * 2.2 + 1.1)),
                    vy: Math.random() * 0.65 + 0.3,
                    vx: (Math.random() - 0.5) * 0.3,
                    sway: Math.random() * 0.5 + 0.2,
                    freq: Math.random() * 0.015 + 0.005,
                    phase: Math.random() * Math.PI * 2,
                    a: Math.random() * 0.5 + 0.38
                });
            }
        }

        drawSnowflake(ctx, x, y, r, alpha, rot) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rot);
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.lineWidth = 1.1;
            ctx.lineCap = 'round';
            for (let i = 0; i < 6; i++) {
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(0, -r);
                ctx.moveTo(0, -r * 0.55);
                ctx.lineTo(-r * 0.28, -r * 0.78);
                ctx.moveTo(0, -r * 0.55);
                ctx.lineTo(r * 0.28, -r * 0.78);
                ctx.stroke();
                ctx.rotate(Math.PI / 3);
            }
            ctx.restore();
        }

        drawStar(ctx, x, y, r, alpha) {
            ctx.save();
            ctx.translate(x, y);
            ctx.beginPath();
            const inn = r * 0.3;
            ctx.moveTo(0, -r); ctx.lineTo(inn, -inn);
            ctx.lineTo(r, 0);  ctx.lineTo(inn, inn);
            ctx.lineTo(0, r);  ctx.lineTo(-inn, inn);
            ctx.lineTo(-r, 0); ctx.lineTo(-inn, -inn);
            ctx.closePath();
            ctx.fillStyle = `rgba(255, 239, 166, ${alpha})`;
            ctx.fill();
            ctx.restore();
        }

        animate() {
            if (!this.isRunning || !this.ctx) return;

            if (!document.hidden && !this.paused) {
                const w = window.innerWidth, h = window.innerHeight, ctx = this.ctx;
                ctx.clearRect(0, 0, w, h);
                this.windCurrent += (this.windTarget - this.windCurrent) * 0.05;
                const light = document.documentElement.getAttribute('data-theme') === 'light';

                for (const p of this.particles) {
                    p.phase += p.freq;
                    p.y += p.vy;
                    p.x += p.vx + Math.sin(p.phase) * p.sway + this.windCurrent;
                    if (p.y > h + 12) { p.y = -12; p.x = Math.random() * w; }
                    if (p.x > w + 12) p.x = -12;
                    if (p.x < -12) p.x = w + 12;

                    if (p.kind === 'flake') {
                        this.drawSnowflake(ctx, p.x, p.y, p.r, p.a * 0.9, p.phase * 0.5);
                    } else if (p.kind === 'star') {
                        this.drawStar(ctx, p.x, p.y, p.r, p.a);
                    } else {
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                        if (p.kind === 'gold') {
                            ctx.fillStyle = light ? `rgba(180,135,30,${p.a})` : `rgba(240,210,120,${p.a})`;
                        } else {
                            ctx.fillStyle = light ? `rgba(150,160,180,${p.a * 0.8})` : `rgba(255,255,255,${p.a * 0.85})`;
                        }
                        ctx.fill();
                    }
                }

                // Estela mágica natural (tipo cola de cometa) bajo los patines del trineo y renos
                if (this.sleighEl && this.sleighEl.classList.contains('flying')) {
                    const rect = this.sleighEl.getBoundingClientRect();
                    if (rect.right > -40 && rect.left < w + 40) {
                        for (let k = 0; k < 4; k++) {
                            // 80% nacen a lo largo de toda la curva de los patines del trineo, 20% bajo las pezuñas de los 3 renos
                            const fromReindeer = Math.random() < 0.22;
                            const u = fromReindeer
                                ? (0.40 + Math.random() * 0.52)
                                : (0.02 + Math.pow(Math.random(), 1.15) * 0.32);

                            // Curva natural siguiendo la inclinación del trineo y los renos
                            const baseLineY = fromReindeer
                                ? (0.64 - (u - 0.40) * 0.42)
                                : (0.87 - u * 0.12);

                            // Distribución Gaussiana suave (más densa en el centro del patín y difuminada hacia los bordes)
                            const gauss = (Math.random() + Math.random() + Math.random() - 1.5) * (fromReindeer ? 7 : 10);

                            const randType = Math.random();
                            const pType = randType < 0.16 ? 'glow' : (randType < 0.44 ? 'star' : 'dust');

                            // Vida muy variada con cola larga exponencial para que nunca se corte en línea recta
                            const maxLife = pType === 'glow'
                                ? (45 + Math.random() * 65)
                                : (32 + Math.pow(Math.random(), 1.85) * 165);

                            this.trail.push({
                                x: rect.left + rect.width * u + (Math.random() - 0.5) * 12,
                                y: rect.top + rect.height * baseLineY + gauss,
                                vx: -(Math.random() * 1.15 + 0.15),
                                vy: (Math.random() - 0.32) * 0.55,
                                gravity: (Math.random() - 0.38) * 0.012,
                                age: 0,
                                maxLife: maxLife,
                                freq: Math.random() * 0.08 + 0.03,
                                seed: Math.random() * Math.PI * 2,
                                type: pType,
                                isWhite: Math.random() < 0.35,
                                baseAlpha: pType === 'glow' ? (Math.random() * 0.12 + 0.08) : (Math.random() * 0.5 + 0.45),
                                r: pType === 'glow'
                                    ? (Math.random() * 9 + 8)
                                    : (pType === 'star' ? (Math.random() * 2.8 + 2.2) : (Math.random() * 1.7 + 0.6))
                            });
                        }
                    }
                }

                for (let i = this.trail.length - 1; i >= 0; i--) {
                    const t = this.trail[i];
                    t.age++;
                    if (t.age >= t.maxLife) {
                        this.trail.splice(i, 1);
                        continue;
                    }

                    const progress = t.age / t.maxLife;
                    // Dispersión orgánica progresiva (se abre suavemente como polvo estelar en el aire)
                    t.vy += t.gravity;
                    t.vx *= 0.992;
                    t.x += t.vx;
                    t.y += t.vy + Math.sin(t.age * t.freq + t.seed) * (0.18 + progress * 0.55);

                    // Fade-in suave al nacer + Fade-out cúbico con titileo estelar
                    const fadeIn = Math.min(1, t.age / 7);
                    const fadeOut = Math.pow(1 - progress, 2.2);
                    const twinkle = t.type === 'glow' ? 1 : (0.75 + 0.25 * Math.sin(t.age * 0.25 + t.seed));
                    const alpha = t.baseAlpha * fadeIn * fadeOut * twinkle;
                    if (alpha <= 0.005) continue;

                    const curR = t.type === 'glow'
                        ? t.r * (0.8 + progress * 0.7)
                        : t.r * (0.35 + 0.65 * (1 - progress));

                    if (t.type === 'glow') {
                        const g = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, curR);
                        g.addColorStop(0, `rgba(255, 238, 165, ${alpha})`);
                        g.addColorStop(0.5, `rgba(212, 175, 55, ${alpha * 0.45})`);
                        g.addColorStop(1, 'rgba(212, 175, 55, 0)');
                        ctx.beginPath();
                        ctx.arc(t.x, t.y, curR, 0, Math.PI * 2);
                        ctx.fillStyle = g;
                        ctx.fill();
                    } else if (t.type === 'star') {
                        this.drawStar(ctx, t.x, t.y, curR, alpha);
                    } else {
                        ctx.beginPath();
                        ctx.arc(t.x, t.y, curR, 0, Math.PI * 2);
                        ctx.fillStyle = t.isWhite
                            ? `rgba(255, 252, 240, ${alpha})`
                            : `rgba(255, 228, 135, ${alpha})`;
                        ctx.fill();
                    }
                }
            }

            requestAnimationFrame(() => this.animate());
        }
    }

    window.OleChristmas = new OleChristmasExperience();
})();
