/**
 * ============================================================================
 * OLÉ DIFERENTE — L'ATELIER DE NOËL (Haute Parfumerie Holiday Engine)
 * Motor de decoración navideña Awwwards para Escritorio y Móvil con
 * activación en tiempo real desde el Panel de Administración (Supabase).
 * ============================================================================
 */

(function () {
    // Si alguna vez se desea forzar por código sin depender del panel admin, cambiar a 1, 2 o 3.
    const FORCE_LIVE_MODE = 0;

    class OleChristmasExperience {
        constructor() {
            const isSubPage = window.location.pathname.includes('/productos/') ||
                              window.location.pathname.split('/').slice(-2)[0] === 'productos';
            this.basePath = isSubPage ? '../' : '';
            this.activeMode = 0; // 0: Off, 1: Atelier Completo, 2: Golden Whisper, 3: Gala Nochebuena
            this.isPreviewOnly = false;
            this.liveModeFromDB = 0;
            this.snowPaused = localStorage.getItem('ole_xmas_snow_paused') === '1';

            // Canvas & Animation state
            this.canvas = null;
            this.ctx = null;
            this.particles = [];
            this.animFrameId = null;
            this.isRunning = false;
            this.mouseX = 0;
            this.windTarget = 0;
            this.windCurrent = 0;
            this.originalMarqueeHTML = null;

            this.checkUrlParams();
            this.bootstrapImmediateState();
        }

        /**
         * Permite activar/desactivar la vista previa mediante ?navidad=1, ?navidad=2, ?navidad=3 o ?navidad=off
         */
        checkUrlParams() {
            try {
                const params = new URLSearchParams(window.location.search);
                if (params.has('navidad')) {
                    const val = (params.get('navidad') || '').toLowerCase();
                    if (val === '0' || val === 'off' || val === 'false') {
                        localStorage.removeItem('ole_xmas_preview_mode');
                    } else if (val === '2') {
                        localStorage.setItem('ole_xmas_preview_mode', '2');
                    } else if (val === '3') {
                        localStorage.setItem('ole_xmas_preview_mode', '3');
                    } else {
                        localStorage.setItem('ole_xmas_preview_mode', '1');
                    }
                }
            } catch (e) {
                console.warn('Error leyendo parámetros de URL para modo navidad:', e);
            }
        }

        /**
         * Aplica instantáneamente el estado en caché o vista previa local para evitar parpadeos al navegar
         */
        bootstrapImmediateState() {
            const cachedLive = parseInt(sessionStorage.getItem('ole_xmas_live_mode') || '0', 10) || 0;
            const localPreview = parseInt(localStorage.getItem('ole_xmas_preview_mode') || '0', 10) || 0;

            const effectiveLive = FORCE_LIVE_MODE > 0 ? FORCE_LIVE_MODE : cachedLive;
            if (effectiveLive > 0) {
                this.applyMode(effectiveLive, false);
            } else if (localPreview > 0) {
                this.applyMode(localPreview, true);
            }
        }

        /**
         * Llamado por WebComponents cuando Supabase devuelve el valor en vivo de __CONFIG_NAVIDAD__
         */
        syncFromSupabase(dbStockValue) {
            const liveMode = Math.max(0, parseInt(dbStockValue, 10) || 0);
            this.liveModeFromDB = liveMode;
            sessionStorage.setItem('ole_xmas_live_mode', String(liveMode));

            const localPreview = parseInt(localStorage.getItem('ole_xmas_preview_mode') || '0', 10) || 0;
            const effectiveLive = FORCE_LIVE_MODE > 0 ? FORCE_LIVE_MODE : liveMode;

            if (effectiveLive > 0) {
                this.applyMode(effectiveLive, false);
            } else if (localPreview > 0) {
                this.applyMode(localPreview, true);
            } else {
                this.teardown();
            }
        }

        /**
         * Activa o actualiza la decoración navideña con el modo indicado (1, 2 o 3)
         */
        applyMode(mode, isPreviewOnly = false) {
            if (!document.body) {
                document.addEventListener('DOMContentLoaded', () => this.applyMode(mode, isPreviewOnly), { once: true });
                return;
            }

            const prevMode = this.activeMode;
            this.activeMode = mode;
            this.isPreviewOnly = isPreviewOnly;

            document.body.classList.add('ole-xmas-active');
            document.body.classList.remove('ole-xmas-mode-1', 'ole-xmas-mode-2', 'ole-xmas-mode-3');
            document.body.classList.add(`ole-xmas-mode-${mode}`);

            if (this.snowPaused) {
                document.body.classList.add('ole-xmas-snow-paused');
            } else {
                document.body.classList.remove('ole-xmas-snow-paused');
            }

            this.injectCrownAndOrnaments();
            this.injectLogoBadge();
            this.upgradeMarqueeBanner();
            this.injectHeroEditorialCrest();
            this.injectTiendaBoutiqueBanner();
            this.injectProductCardCorners();
            this.injectQuizRibbon();
            this.injectFloatingController();

            if (!this.canvas || prevMode !== mode) {
                this.initSnowAndGoldCanvas();
            }
        }

        /**
         * Desactiva y limpia toda la decoración navideña en tiempo real
         */
        teardown() {
            this.activeMode = 0;
            this.isPreviewOnly = false;
            if (!document.body) return;

            document.body.classList.remove(
                'ole-xmas-active',
                'ole-xmas-mode-1',
                'ole-xmas-mode-2',
                'ole-xmas-mode-3',
                'ole-xmas-snow-paused'
            );

            // Detener canvas
            if (this.animFrameId) {
                cancelAnimationFrame(this.animFrameId);
                this.animFrameId = null;
            }
            this.isRunning = false;

            const toRemove = [
                '#ole-xmas-canvas',
                '.ole-xmas-crown',
                '.ole-xmas-logo-badge',
                '.ole-xmas-hero-crest',
                '.ole-xmas-boutique-banner',
                '.ole-xmas-quiz-ribbon',
                '.ole-xmas-Dock'
            ];
            toRemove.forEach(sel => {
                document.querySelectorAll(sel).forEach(el => el.remove());
            });
            document.querySelectorAll('.ole-xmas-card-corner').forEach(el => el.remove());
            this.canvas = null;

            // Restaurar marquee original si fue modificado
            if (this.originalMarqueeHTML) {
                const track = document.querySelector('.marquee-track');
                if (track) track.innerHTML = this.originalMarqueeHTML;
            }
        }

        /**
         * 1. Corona Arquitectónica Superior y Orfebrería Colgante SVG
         */
        injectCrownAndOrnaments() {
            if (document.querySelector('.ole-xmas-crown')) return;

            const crown = document.createElement('div');
            crown.className = 'ole-xmas-crown';
            crown.setAttribute('aria-hidden', 'true');

            crown.innerHTML = `
                <div class="ole-xmas-top-filigree"></div>

                <!-- Colgantes Izquierdos: Frasco de Perfume Imperial & Estrella Polar -->
                <div class="ole-xmas-pendants-left">
                    <!-- Colgante 1: Frasco de Perfume Alta Costura -->
                    <svg class="ole-xmas-pendant pendant-1" width="66" height="175" viewBox="0 0 66 175" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <linearGradient id="xmasGold1" x1="0" y1="0" x2="66" y2="175" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stop-color="#FFEFA6"/>
                                <stop offset="45%" stop-color="#D4AF37"/>
                                <stop offset="100%" stop-color="#8B6914"/>
                            </linearGradient>
                            <linearGradient id="xmasCrimson1" x1="15" y1="90" x2="51" y2="155" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stop-color="#8B1524"/>
                                <stop offset="50%" stop-color="#4F0912"/>
                                <stop offset="100%" stop-color="#240307"/>
                            </linearGradient>
                        </defs>
                        <!-- Hilo de oro -->
                        <line x1="33" y1="0" x2="33" y2="74" stroke="url(#xmasGold1)" stroke-width="1" stroke-dasharray="2 1"/>
                        <!-- Ramita de pino superior -->
                        <path d="M33 14 C23 22, 16 18, 12 24 M33 14 C43 22, 50 18, 54 24" stroke="#1E4631" stroke-width="1.6" stroke-linecap="round"/>
                        <path d="M33 14 C25 20, 20 16, 15 21 M33 14 C41 20, 46 16, 51 21" stroke="url(#xmasGold1)" stroke-width="0.9" stroke-linecap="round"/>
                        <!-- Lazo de terciopelo carmesí y oro -->
                        <path d="M33 74 C22 65, 16 73, 24 80 C29 83, 33 77, 33 74 Z" fill="#7A1321" stroke="url(#xmasGold1)" stroke-width="1"/>
                        <path d="M33 74 C44 65, 50 73, 42 80 C37 83, 33 77, 33 74 Z" fill="#7A1321" stroke="url(#xmasGold1)" stroke-width="1"/>
                        <circle cx="33" cy="75" r="3" fill="url(#xmasGold1)"/>
                        <!-- Tapón facetado del perfume -->
                        <polygon points="28,82 38,82 40,91 26,91" fill="url(#xmasGold1)"/>
                        <rect x="29" y="91" width="8" height="5" fill="#997510"/>
                        <!-- Cuerpo del Frasco Joya -->
                        <polygon points="21,96 45,96 52,110 52,146 43,157 23,157 14,146 14,110" fill="url(#xmasCrimson1)" stroke="url(#xmasGold1)" stroke-width="1.6"/>
                        <polygon points="24,101 42,101 47,112 47,143 40,152 26,152 19,143 19,112" fill="none" stroke="url(#xmasGold1)" stroke-width="0.7" stroke-opacity="0.65"/>
                        <!-- Estrella central grabada en el frasco -->
                        <path class="ole-xmas-star-pulse" d="M33 113 L35.5 123.5 L46 126 L35.5 128.5 L33 139 L30.5 128.5 L20 126 L30.5 123.5 Z" fill="url(#xmasGold1)"/>
                        <!-- Borla inferior dorada -->
                        <line x1="33" y1="157" x2="33" y2="169" stroke="url(#xmasGold1)" stroke-width="1.2"/>
                        <circle cx="33" cy="171" r="2.5" fill="#FFEFA6"/>
                    </svg>

                    <!-- Colgante 2: Estrella Polar de 8 Puntas -->
                    <svg class="ole-xmas-pendant pendant-2" width="54" height="135" viewBox="0 0 54 135" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <line x1="27" y1="0" x2="27" y2="54" stroke="url(#xmasGold1)" stroke-width="0.9"/>
                        <circle cx="27" cy="30" r="2" fill="#FFEFA6"/>
                        <g class="ole-xmas-star-pulse">
                            <path d="M27 56 L30.5 76.5 L51 80 L30.5 83.5 L27 104 L23.5 83.5 L3 80 L23.5 76.5 Z" fill="url(#xmasGold1)"/>
                            <path d="M27 65 L29 78 L42 80 L29 82 L27 95 L25 82 L12 80 L25 78 Z" fill="#FFF8DC"/>
                            <line x1="15" y1="68" x2="39" y2="92" stroke="url(#xmasGold1)" stroke-width="1.1"/>
                            <line x1="39" y1="68" x2="15" y2="92" stroke="url(#xmasGold1)" stroke-width="1.1"/>
                        </g>
                        <circle cx="27" cy="114" r="2" fill="url(#xmasGold1)"/>
                    </svg>
                </div>

                <!-- Colgantes Derechos: Esfera Imperial Tallada & Gota de Esencia -->
                <div class="ole-xmas-pendants-right">
                    <!-- Colgante 4: Gota de Esencia Dorada -->
                    <svg class="ole-xmas-pendant pendant-4" width="50" height="140" viewBox="0 0 50 140" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <line x1="25" y1="0" x2="25" y2="62" stroke="url(#xmasGold1)" stroke-width="0.9"/>
                        <circle cx="25" cy="40" r="1.8" fill="#FFEFA6"/>
                        <!-- Gota de fragancia -->
                        <path d="M25 64 C25 64, 40 86, 40 99 C40 108, 33.2 115, 25 115 C16.8 115, 10 108, 10 99 C10 86, 25 64, 25 64 Z" fill="url(#xmasCrimson1)" stroke="url(#xmasGold1)" stroke-width="1.5"/>
                        <path class="ole-xmas-star-pulse" d="M25 83 L27 93 L37 95 L27 97 L25 107 L23 97 L13 95 L23 93 Z" fill="url(#xmasGold1)"/>
                        <circle cx="25" cy="123" r="2.2" fill="#FFEFA6"/>
                    </svg>

                    <!-- Colgante 3: Esfera Imperial de Filigrana -->
                    <svg class="ole-xmas-pendant pendant-3" width="64" height="165" viewBox="0 0 64 165" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <line x1="32" y1="0" x2="32" y2="66" stroke="url(#xmasGold1)" stroke-width="1"/>
                        <!-- Corona de la esfera -->
                        <rect x="27" y="66" width="10" height="6" rx="1.5" fill="url(#xmasGold1)"/>
                        <!-- Esfera joya -->
                        <circle cx="32" cy="98" r="26" fill="url(#xmasCrimson1)" stroke="url(#xmasGold1)" stroke-width="1.6"/>
                        <ellipse cx="32" cy="98" rx="14" ry="26" fill="none" stroke="url(#xmasGold1)" stroke-width="0.8" stroke-opacity="0.65"/>
                        <line x1="6" y1="98" x2="58" y2="98" stroke="url(#xmasGold1)" stroke-width="0.8" stroke-opacity="0.65"/>
                        <path class="ole-xmas-star-pulse" d="M32 84 L34.5 95.5 L46 98 L34.5 100.5 L32 112 L29.5 100.5 L18 98 L29.5 95.5 Z" fill="url(#xmasGold1)"/>
                        <!-- Borla imperial -->
                        <line x1="32" y1="124" x2="32" y2="142" stroke="url(#xmasGold1)" stroke-width="1.3"/>
                        <polygon points="32,142 36,150 32,158 28,150" fill="url(#xmasGold1)"/>
                    </svg>
                </div>
            `;

            document.body.appendChild(crown);
        }

        /**
         * 2. Emblema Estelar en el Logo del Header
         */
        injectLogoBadge() {
            const logoContainer = document.querySelector('header .logo');
            if (!logoContainer || logoContainer.querySelector('.ole-xmas-logo-badge')) return;

            const badge = document.createElement('div');
            badge.className = 'ole-xmas-logo-badge';
            badge.setAttribute('aria-hidden', 'true');
            badge.innerHTML = `
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path class="ole-xmas-star-pulse" d="M14 1 L16.4 11.6 L27 14 L16.4 16.4 L14 27 L11.6 16.4 L1 14 L11.6 11.6 Z" fill="#D4AF37"/>
                    <circle cx="14" cy="14" r="2.2" fill="#FFF8DC"/>
                </svg>
            `;
            logoContainer.appendChild(badge);
        }

        /**
         * 3. Marquee Festivo de Alta Perfumería
         */
        upgradeMarqueeBanner() {
            const track = document.querySelector('.marquee-track');
            if (!track) return;

            if (!this.originalMarqueeHTML) {
                this.originalMarqueeHTML = track.innerHTML;
            }

            const holidayMsg = this.activeMode === 3
                ? `✦ FELIZ NAVIDAD TE DESEA OLÉ DIFERENTE &nbsp; • &nbsp; L'ART D'OFFRIR: REGALÁ ALTA PERFUMERÍA &nbsp; • &nbsp; ENVÍOS GRATIS EN COMPRAS SUPERIORES A $150.000 &nbsp; • &nbsp; `
                : `✦ EDICIÓN FESTIVA DE NAVIDAD • REGALÁ FRAGANCIAS INOLVIDABLES &nbsp; • &nbsp; ENVÍOS GRATIS EN COMPRAS SUPERIORES A $150.000 &nbsp; • &nbsp; DESCUBRÍ EL REGALO IDEAL EN NUESTRO QUIZ OLFATIVO &nbsp; • &nbsp; `;

            track.innerHTML = `
                <div class="marquee-content">${holidayMsg}${holidayMsg}</div>
                <div class="marquee-content" aria-hidden="true">${holidayMsg}${holidayMsg}</div>
            `;
        }

        /**
         * 4. Medallón Editorial en el Hero Slider (index.html)
         */
        injectHeroEditorialCrest() {
            const heroSlider = document.getElementById('hero-slider');
            if (!heroSlider || heroSlider.querySelector('.ole-xmas-hero-crest')) return;

            const crest = document.createElement('a');
            crest.className = 'ole-xmas-hero-crest';
            crest.href = '#quiz-perfume';
            crest.setAttribute('aria-label', 'Explorar Guía de Regalos de Navidad');

            const labelText = this.activeMode === 3
                ? "NOCHEBUENA & NAVIDAD • EDICIÓN DE GALA"
                : "L'ATELIER DE NOËL • COLECCIÓN FESTIVA";

            crest.innerHTML = `
                <div class="ole-xmas-hero-pill">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M12 1L14.5 9.5L23 12L14.5 14.5L12 23L9.5 14.5L1 12L9.5 9.5L12 1Z" fill="#FFEFA6"/>
                    </svg>
                    <span class="ole-xmas-hero-pill-text">${labelText}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M12 1L14.5 9.5L23 12L14.5 14.5L12 23L9.5 14.5L1 12L9.5 9.5L12 1Z" fill="#FFEFA6"/>
                    </svg>
                </div>
                <span class="ole-xmas-hero-sub">El arte de regalar una huella inolvidable</span>
            `;

            heroSlider.appendChild(crest);
        }

        /**
         * 5. Banner Boutique de Regalos en Tienda (tienda.html)
         */
        injectTiendaBoutiqueBanner() {
            const catalogControls = document.querySelector('.catalog-controls');
            if (!catalogControls || document.querySelector('.ole-xmas-boutique-banner')) return;

            const banner = document.createElement('div');
            banner.className = 'ole-xmas-boutique-banner';
            banner.innerHTML = `
                <div class="ole-xmas-boutique-left">
                    <div class="ole-xmas-boutique-icon" aria-hidden="true">
                        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                            <path d="M14 2L16.8 11.2L26 14L16.8 16.8L14 26L11.2 16.8L2 14L11.2 11.2L14 2Z" fill="#FFEFA6"/>
                        </svg>
                    </div>
                    <div class="ole-xmas-boutique-copy">
                        <span class="ole-xmas-boutique-tag">✦ L'Atelier de Noël • Holiday Gift Boutique</span>
                        <h2>El Regalo de una Fragancia Inolvidable</h2>
                        <p>Seleccioná perfumes originales de sello árabe y diseñador o descubrí la fragancia perfecta para regalar en estas fiestas.</p>
                    </div>
                </div>
                <a href="${this.basePath}index.html#quiz-perfume" class="ole-xmas-boutique-cta">
                    <span>Asesor de Regalos Olfativo</span>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                </a>
            `;

            catalogControls.parentNode.insertBefore(banner, catalogControls);
        }

        /**
         * 6. Filigrana Dorada en las Esquinas de las Tarjetas de Producto
         */
        injectProductCardCorners() {
            if (this.activeMode === 2) {
                document.querySelectorAll('.ole-xmas-card-corner').forEach(el => el.remove());
                return;
            }

            const cards = document.querySelectorAll('.product-card');
            cards.forEach(card => {
                const imgContainer = card.querySelector('.product-image-container');
                if (!imgContainer || imgContainer.querySelector('.ole-xmas-card-corner')) return;

                const corner = document.createElement('div');
                corner.className = 'ole-xmas-card-corner';
                corner.setAttribute('aria-hidden', 'true');
                corner.innerHTML = `
                    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2 2 H24 C28.4 2, 32 5.6, 32 10 V32" stroke="#D4AF37" stroke-width="1.2" stroke-opacity="0.75"/>
                        <path d="M25 9 L26.5 13.5 L31 15 L26.5 16.5 L25 21 L23.5 16.5 L19 15 L23.5 13.5 Z" fill="#FFEFA6"/>
                    </svg>
                `;
                imgContainer.appendChild(corner);
            });
        }

        /**
         * 7. Cinta Especial en el Quiz Olfativo (#quiz-header)
         */
        injectQuizRibbon() {
            const quizHeader = document.getElementById('quiz-header');
            if (!quizHeader || quizHeader.querySelector('.ole-xmas-quiz-ribbon')) return;

            const ribbon = document.createElement('div');
            ribbon.className = 'ole-xmas-quiz-ribbon';
            ribbon.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M12 1L14.5 9.5L23 12L14.5 14.5L12 23L9.5 14.5L1 12L9.5 9.5L12 1Z" fill="#FFEFA6"/>
                </svg>
                <span>Edición Especial Regalos de Navidad</span>
            `;
            quizHeader.insertBefore(ribbon, quizHeader.firstChild);
        }

        /**
         * 8. Controlador Ambiental Flotante Glassmorphism + Indicador de Vista Previa
         */
        injectFloatingController() {
            let dock = document.querySelector('.ole-xmas-Dock');
            if (dock) dock.remove();

            dock = document.createElement('div');
            dock.className = 'ole-xmas-Dock';

            const statusLabel = this.snowPaused ? 'Polvo de Oro: Pausado' : 'Polvo de Oro: Activo ✨';

            let previewBadgeHTML = '';
            if (this.isPreviewOnly) {
                previewBadgeHTML = `
                    <a href="${this.basePath}admin.html" class="ole-xmas-preview-banner" title="Solo visible en tu navegador. Hacé clic para ir al Panel Admin y lanzarlo en vivo.">
                        <span>👁️ MODO VISTA PREVIA (Ir al Admin para Lanzar en Vivo)</span>
                    </a>
                `;
            }

            dock.innerHTML = `
                ${previewBadgeHTML}
                <div class="ole-xmas-pill-ctrl">
                    <button type="button" class="ole-xmas-ctrl-toggle" id="ole-xmas-toggle-snow" aria-label="Alternar nieve dorada" title="Pausar / Reanudar nieve dorada">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M12 1L14.5 9.5L23 12L14.5 14.5L12 23L9.5 14.5L1 12L9.5 9.5L12 1Z" fill="#FFEFA6"/>
                        </svg>
                    </button>
                    <div class="ole-xmas-ctrl-info">
                        <span class="ole-xmas-ctrl-title">L'Atelier de Noël</span>
                        <span class="ole-xmas-ctrl-status" id="ole-xmas-snow-label">${statusLabel}</span>
                    </div>
                </div>
            `;

            document.body.appendChild(dock);

            const toggleSnow = () => {
                this.snowPaused = !this.snowPaused;
                localStorage.setItem('ole_xmas_snow_paused', this.snowPaused ? '1' : '0');
                document.body.classList.toggle('ole-xmas-snow-paused', this.snowPaused);
                const lbl = document.getElementById('ole-xmas-snow-label');
                if (lbl) {
                    lbl.textContent = this.snowPaused ? 'Polvo de Oro: Pausado' : 'Polvo de Oro: Activo ✨';
                }
            };

            dock.querySelector('#ole-xmas-toggle-snow')?.addEventListener('click', toggleSnow);
            dock.querySelector('#ole-xmas-snow-label')?.addEventListener('click', toggleSnow);
        }

        /**
         * 9. Motor Canvas 60FPS: Nieve Cristalina, Polvo de Oro Bokeh & Estrellas de 4 Puntas
         */
        initSnowAndGoldCanvas() {
            if (this.animFrameId) {
                cancelAnimationFrame(this.animFrameId);
                this.animFrameId = null;
            }

            if (!this.canvas) {
                this.canvas = document.createElement('canvas');
                this.canvas.id = 'ole-xmas-canvas';
                this.canvas.setAttribute('aria-hidden', 'true');
                document.body.appendChild(this.canvas);
                this.ctx = this.canvas.getContext('2d');

                window.addEventListener('resize', () => this.resizeCanvas(), { passive: true });
                window.addEventListener('mousemove', (e) => {
                    const normX = (e.clientX / window.innerWidth) - 0.5;
                    this.windTarget = normX * 0.45;
                }, { passive: true });
            }

            this.resizeCanvas();
            this.createParticles();

            if (!this.isRunning) {
                this.isRunning = true;
                this.animateCanvas();
            }
        }

        resizeCanvas() {
            if (!this.canvas) return;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            this.canvas.width = window.innerWidth * dpr;
            this.canvas.height = window.innerHeight * dpr;
            if (this.ctx) {
                this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            }
        }

        createParticles() {
            const isMobile = window.innerWidth <= 768;
            // Cantidad calibrada para 60fps estables tanto en escritorio como en móvil
            let count = isMobile ? 24 : 52;
            if (this.activeMode === 2) count = isMobile ? 16 : 32;
            if (this.activeMode === 3) count = isMobile ? 30 : 68;

            this.particles = [];
            const w = window.innerWidth;
            const h = window.innerHeight;

            for (let i = 0; i < count; i++) {
                const rand = Math.random();
                // 3 tipos de partículas: 'gold-bokeh' (45%), 'pearl-snow' (40%), 'diamond-star' (15%)
                let type = 'gold-bokeh';
                if (rand > 0.84 || (this.activeMode === 3 && rand > 0.72)) {
                    type = 'diamond-star';
                } else if (rand > 0.45) {
                    type = 'pearl-snow';
                }

                this.particles.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    type: type,
                    radius: type === 'gold-bokeh'
                        ? (Math.random() * 5.5 + 2.5)
                        : (type === 'diamond-star' ? (Math.random() * 4.5 + 3.5) : (Math.random() * 2.4 + 1.2)),
                    speedY: type === 'gold-bokeh'
                        ? (Math.random() * 0.45 + 0.2)
                        : (Math.random() * 0.7 + 0.3),
                    speedX: (Math.random() - 0.5) * 0.35,
                    swayAmp: Math.random() * 0.6 + 0.2,
                    swayFreq: Math.random() * 0.015 + 0.005,
                    phase: Math.random() * Math.PI * 2,
                    alpha: Math.random() * 0.55 + 0.25,
                    twinkleSpeed: Math.random() * 0.025 + 0.01
                });
            }
        }

        drawFourPointStar(ctx, x, y, size, alpha) {
            ctx.save();
            ctx.translate(x, y);
            ctx.beginPath();
            const inner = size * 0.28;
            ctx.moveTo(0, -size);
            ctx.lineTo(inner, -inner);
            ctx.lineTo(size, 0);
            ctx.lineTo(inner, inner);
            ctx.lineTo(0, size);
            ctx.lineTo(-inner, inner);
            ctx.lineTo(-size, 0);
            ctx.lineTo(-inner, -inner);
            ctx.closePath();
            ctx.fillStyle = `rgba(255, 239, 166, ${alpha})`;
            ctx.shadowColor = 'rgba(212, 175, 55, 0.8)';
            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.restore();
        }

        animateCanvas() {
            if (!this.isRunning || !this.ctx || !this.canvas) return;

            if (!document.hidden && !this.snowPaused) {
                const w = window.innerWidth;
                const h = window.innerHeight;
                const ctx = this.ctx;

                ctx.clearRect(0, 0, w, h);
                this.windCurrent += (this.windTarget - this.windCurrent) * 0.05;

                const isLight = document.documentElement.getAttribute('data-theme') === 'light';

                for (let i = 0; i < this.particles.length; i++) {
                    const p = this.particles[i];
                    p.phase += p.swayFreq;
                    p.y += p.speedY;
                    p.x += p.speedX + Math.sin(p.phase) * p.swayAmp + this.windCurrent;

                    // Reciclar partículas al salir de pantalla
                    if (p.y > h + 15) {
                        p.y = -12;
                        p.x = Math.random() * w;
                    }
                    if (p.x > w + 15) p.x = -12;
                    if (p.x < -15) p.x = w + 12;

                    const currentAlpha = Math.max(0.15, Math.min(0.95, p.alpha + Math.sin(p.phase * 2) * 0.2));

                    if (p.type === 'diamond-star') {
                        this.drawFourPointStar(ctx, p.x, p.y, p.radius, currentAlpha);
                    } else if (p.type === 'gold-bokeh') {
                        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
                        if (isLight) {
                            grad.addColorStop(0, `rgba(185, 138, 28, ${currentAlpha * 0.9})`);
                            grad.addColorStop(0.5, `rgba(212, 175, 55, ${currentAlpha * 0.45})`);
                            grad.addColorStop(1, 'rgba(212, 175, 55, 0)');
                        } else {
                            grad.addColorStop(0, `rgba(255, 243, 184, ${currentAlpha})`);
                            grad.addColorStop(0.5, `rgba(212, 175, 55, ${currentAlpha * 0.5})`);
                            grad.addColorStop(1, 'rgba(212, 175, 55, 0)');
                        }
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                        ctx.fillStyle = grad;
                        ctx.fill();
                    } else {
                        // pearl-snow
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                        ctx.fillStyle = isLight
                            ? `rgba(160, 120, 30, ${currentAlpha * 0.65})`
                            : `rgba(249, 246, 238, ${currentAlpha * 0.85})`;
                        ctx.fill();
                    }
                }
            }

            this.animFrameId = requestAnimationFrame(() => this.animateCanvas());
        }
    }

    // Instancia global accesible desde WebComponents y AdminPanel
    window.OleChristmas = new OleChristmasExperience();
})();
