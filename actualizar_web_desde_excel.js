/**
 * ==============================================================================
 * OLÉ DIFERENTE - Sincronizador Automático Catálogo Excel/Drive -> Web & Supabase
 * ==============================================================================
 * Este script lee 'Catalogo_Perfumes_Ole_Diferente.xlsx' (o lo descarga desde Google Drive)
 * y actualiza en segundos:
 * 1. La tienda principal (tienda.html) - precios, stock y badges de 'Por Encargue'.
 * 2. Las páginas individuales de producto (productos/*.html).
 * 3. La base de datos en tiempo real de Supabase (tabla 'inventory').
 * 
 * Uso:
 *   node actualizar_web_desde_excel.js          (Usa el archivo Excel local)
 *   node actualizar_web_desde_excel.js --drive  (Descarga la versión más reciente de Google Drive y sincroniza)
 * ==============================================================================
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const GOOGLE_DRIVE_SHEET_ID = '1kCtWIFHFelvT4d2mkFMvU22VP94ke61R';

// Leer variables de entorno de Supabase
const dotenv = fs.readFileSync('.env', 'utf8');
const env = Object.fromEntries(
    dotenv.split('\n')
        .filter(l => l.includes('='))
        .map(l => {
            const idx = l.indexOf('=');
            return [l.substring(0, idx).trim(), l.substring(idx + 1).trim()];
        })
);

// Formateador de moneda en pesos argentinos: 74000 -> "74.000"
function formatPrice(num) {
    if (typeof num !== 'number') {
        num = parseFloat(String(num).replace(/[^0-9.-]+/g, '')) || 0;
    }
    return num.toLocaleString('es-AR');
}

// Mapa de alias/sinónimos para tolerancia de nombres entre Excel y Web
const ALIASES = {
    'maison alhambra salvo edp': 'salvo eau de parfum',
    'salvo edp': 'salvo eau de parfum',
    'salvo eau de parfum': 'salvo eau de parfum',
    'shaeen gold': 'lattafa pride shaheen gold',
    'shaheen gold': 'lattafa pride shaheen gold',
    'amalia': 'risala amalia',
    'the kindoom': 'lattafa the kingdom',
    'the kingdom': 'lattafa the kingdom'
};

async function downloadFromGoogleDrive(fileId) {
    console.log('📥 Descargando catálogo directamente desde Google Drive...');
    const url = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=xlsx`;
    try {
        const res = await fetch(url, { redirect: 'follow' });
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length < 1000) {
            throw new Error('El archivo descargado es demasiado pequeño o requiere permisos.');
        }
        fs.writeFileSync('Catalogo_Perfumes_Ole_Diferente.xlsx', buffer);
        console.log(`✅ Archivo descargado exitosamente (${buffer.length} bytes) y guardado en Catalogo_Perfumes_Ole_Diferente.xlsx\n`);
        return true;
    } catch (err) {
        console.error('❌ Error al descargar de Google Drive:', err.message);
        console.log('Se utilizará el archivo local existente si está disponible.\n');
        return false;
    }
}

async function syncCatalog() {
    console.log('====================================================');
    console.log('🔄 INICIANDO SINCRONIZACIÓN DE CATÁLOGO');
    console.log('====================================================\n');

    const args = process.argv.slice(2);
    if (args.includes('--drive')) {
        await downloadFromGoogleDrive(GOOGLE_DRIVE_SHEET_ID);
    }

    const excelFile = 'Catalogo_Perfumes_Ole_Diferente.xlsx';
    if (!fs.existsSync(excelFile)) {
        console.error(`❌ Error: No se encontró el archivo ${excelFile}`);
        return;
    }

    console.log(`📄 Leyendo planilla: ${excelFile}...`);
    const workbook = XLSX.readFile(excelFile);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    console.log(`✅ ${rows.length} productos cargados desde el Excel.\n`);

    // Mapear filas por nombre normalizado
    const excelMap = new Map();
    rows.forEach(r => {
        const name = (r['Nombre'] || r['Nombre del Perfume'] || '').trim();
        if (!name) return;

        let price = r['Precio ($ ARS)'] || r['Precio'] || 0;
        if (typeof price === 'string') {
            price = parseFloat(price.replace(/[^0-9.-]+/g, '')) || 0;
        }

        let stock = r['Cant en stock'] || r['Stock'] || 0;
        if (typeof stock === 'string') {
            stock = parseInt(stock, 10) || 0;
        }

        let porEncargueStr = String(r['Por encargue'] || r['Por Encargue'] || '').trim().toLowerCase();
        let isPreorder = (porEncargueStr === 'sí' || porEncargueStr === 'si' || porEncargueStr === 'yes' || porEncargueStr === 'true');

        const itemData = {
            name,
            priceNum: price,
            priceStr: formatPrice(price),
            stock,
            isPreorder,
            category: r['Categoría'] || ''
        };

        const lowerKey = name.toLowerCase();
        excelMap.set(lowerKey, itemData);

        if (ALIASES[lowerKey]) {
            excelMap.set(ALIASES[lowerKey], itemData);
        }
    });

    // 1. ACTUALIZAR tienda.html DE FORMA MODULAR Y SEGURA
    console.log('🌐 Actualizando tienda.html...');
    const html = fs.readFileSync('tienda.html', 'utf8');
    const lines = html.split(/\r?\n/);

    const prefixLines = [];
    const cardBlocks = [];
    const suffixLines = [];

    let currentCard = null;
    let foundFirstCard = false;
    let inSuffix = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (inSuffix) {
            suffixLines.push(line);
        } else if (line.includes('<!-- Footer -->') || line.includes('<footer>')) {
            if (currentCard) {
                cardBlocks.push(currentCard);
                currentCard = null;
            }
            inSuffix = true;
            suffixLines.push(line);
        } else if (line.includes('class="product-card')) {
            foundFirstCard = true;
            if (currentCard) {
                cardBlocks.push(currentCard);
            }
            currentCard = {
                lines: [line]
            };
        } else if (foundFirstCard) {
            if (line.includes('</div>') && lines.slice(i, i + 5).some(l => l.includes('<!-- Footer -->') || l.includes('<footer>'))) {
                if (currentCard) {
                    cardBlocks.push(currentCard);
                    currentCard = null;
                }
                inSuffix = true;
                suffixLines.push(line);
            } else if (currentCard) {
                currentCard.lines.push(line);
            } else {
                suffixLines.push(line);
            }
        } else {
            prefixLines.push(line);
        }
    }
    if (currentCard) cardBlocks.push(currentCard);

    // Asegurar que Salvo Eau de Parfum esté presente en las tarjetas
    const hasSalvoEDP = cardBlocks.some(b => b.lines.some(l => l.includes('Salvo Eau de Parfum')));
    if (!hasSalvoEDP) {
        const salvoIntenseIdx = cardBlocks.findIndex(b => b.lines.some(l => l.includes('Salvo Intense')));
        const salvoEDPBlock = {
            lines: [
                '            <!-- Product: Salvo Eau de Parfum -->',
                '            <div class="product-card reveal" data-category="masculinas" data-price="72000" data-name="Salvo Eau de Parfum">',
                '                <a href="productos/salvo-edp.html" style="text-decoration: none; color: inherit;">',
                '                    <div class="product-image-container">',
                '                        <img loading="lazy" src="img/fragancias/Salvo Eau de Parfum - Maison Alhambra - 100ml.jpg" alt="Salvo Eau de Parfum" class="product-image" decoding="async">',
                '                    </div>',
                '                </a>',
                '                <div class="product-info">',
                '                    <span class="product-category">Fragancia Masculina</span>',
                '                    <a href="productos/salvo-edp.html" style="text-decoration: none; color: inherit;">',
                '                        <h3 class="product-title">Salvo Eau de Parfum</h3>',
                '                    </a>',
                '                    <div class="size-selectors">',
                '                        <div class="selector-group main-options">',
                '                            <button class="size-btn active" data-type="full" data-price="72.000">100 ml</button>',
                '                            <button class="size-btn" data-type="decant">Decant</button>',
                '                        </div>',
                '                        <div class="selector-group decant-options">',
                '                            <button class="size-btn" data-price="0">10 ml</button>',
                '                            <button class="size-btn active" data-price="0">5 ml</button>',
                '                        </div>',
                '                    </div>',
                '                    <div class="product-price">$72.000</div>',
                '                    <div class="purchase-controls">',
                '                        <input type="number" class="quantity-selector" value="1" min="1" aria-label="Cantidad">',
                '                        <button class="add-to-cart-btn">Agregar al carrito</button>',
                '                    </div>',
                '                </div>',
                '            </div>'
            ]
        };
        if (salvoIntenseIdx !== -1) {
            cardBlocks.splice(salvoIntenseIdx + 1, 0, salvoEDPBlock);
        } else {
            cardBlocks.push(salvoEDPBlock);
        }
    }

    let tiendaUpdatedCount = 0;
    const detailPagesToUpdate = [];

    cardBlocks.forEach(block => {
        const fullText = block.lines.join('\n');
        const nameMatch = fullText.match(/data-name="([^"]+)"/);
        const linkMatch = fullText.match(/<a href="([^"]+)"/);

        if (nameMatch) {
            const cardName = nameMatch[1].trim();
            const lowerCardName = cardName.toLowerCase();
            const data = excelMap.get(lowerCardName) || (ALIASES[lowerCardName] ? excelMap.get(ALIASES[lowerCardName]) : null);

            if (data) {
                tiendaUpdatedCount++;

                block.lines = block.lines.map(line => {
                    if (line.includes('class="product-card')) {
                        let updated = line.replace(/data-price="[^"]*"/, `data-price="${data.priceNum}"`);
                        updated = updated.replace(/class="product-card\s*([^"]*)"/, (m, cls) => {
                            let classList = cls.split(/\s+/).filter(c => c && c !== 'is-preorder' && c !== 'out-of-stock');
                            if (data.isPreorder) {
                                classList.push('is-preorder');
                            } else if (data.stock === 0) {
                                classList.push('out-of-stock');
                            }
                            return `class="product-card ${classList.join(' ')}"`;
                        });
                        return updated;
                    }
                    if (line.includes('data-type="full"')) {
                        let updated = line.replace(/(data-price=")[^"]*"/, `$1${data.priceStr}"`);
                        return updated;
                    }
                    if (line.includes('class="product-price"')) {
                        return line.replace(/(<div class="product-price">)[^<]*(<\/div>)/, `$1$${data.priceStr}$2`);
                    }
                    return line;
                });

                if (linkMatch && linkMatch[1]) {
                    detailPagesToUpdate.push({
                        file: linkMatch[1],
                        data: data
                    });
                }
            } else {
                console.warn(`⚠️ Perfume en tienda sin coincidencia en Excel: ${cardName}`);
            }
        }
    });

    const finalLines = [...prefixLines, ...cardBlocks.flatMap(b => b.lines), ...suffixLines];
    fs.writeFileSync('tienda.html', finalLines.join('\n'), 'utf8');
    console.log(`✅ tienda.html actualizado: ${tiendaUpdatedCount} de ${cardBlocks.length} tarjetas sincronizadas.`);

    // 2. ACTUALIZAR PÁGINAS DE DETALLE (productos/*.html)
    console.log('\n📦 Actualizando páginas de detalle de productos...');
    let detailUpdatedCount = 0;
    detailPagesToUpdate.forEach(item => {
        let filePath = item.file;
        if (filePath.startsWith('/')) filePath = filePath.substring(1);
        if (fs.existsSync(filePath)) {
            let detailHtml = fs.readFileSync(filePath, 'utf8');
            const priceRegex = /(<span class="detail-price"[^>]*>)([^<]*)(<\/span>)/i;
            if (detailHtml.match(priceRegex)) {
                detailHtml = detailHtml.replace(priceRegex, `$1$${item.data.priceStr}$3`);
                fs.writeFileSync(filePath, detailHtml, 'utf8');
                detailUpdatedCount++;
            }
        }
    });
    console.log(`✅ Páginas de producto actualizadas: ${detailUpdatedCount} archivos.`);

    // 3. ACTUALIZAR BASE DE DATOS SUPABASE (tabla inventory)
    console.log('\n☁️  Sincronizando inventario con Supabase...');
    const supaKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
    const inventoryUpdates = [];
    const seenNames = new Set();

    excelMap.forEach((item) => {
        if (seenNames.has(item.name.toLowerCase())) return;
        seenNames.add(item.name.toLowerCase());

        let finalStock = item.stock;
        if (item.isPreorder) {
            finalStock = -1; // -1 indica "Por Encargue" en la plataforma
        } else if (item.stock === 0) {
            finalStock = 0;  // 0 indica "Sin Stock"
        } else if (item.stock > 0) {
            finalStock = item.stock;
        }

        inventoryUpdates.push({
            name: item.name,
            stock: finalStock
        });
    });

    try {
        const res = await fetch(`${env.SUPABASE_URL}/rest/v1/inventory?on_conflict=name`, {
            method: 'POST',
            headers: {
                'apikey': supaKey,
                'Authorization': `Bearer ${supaKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify(inventoryUpdates)
        });

        if (res.ok) {
            console.log(`✅ Supabase sincronizado exitosamente: ${inventoryUpdates.length} perfumes en la tabla 'inventory'.`);
        } else {
            console.error(`❌ Error en Supabase (${res.status}):`, await res.text());
        }
    } catch (supaErr) {
        console.error('❌ Error de red al conectar con Supabase:', supaErr.message);
    }

    console.log('\n====================================================');
    console.log('🎉 SINCRONIZACIÓN COMPLETADA CON ÉXITO');
    console.log('====================================================');
}

// Ejecutar sincronización
syncCatalog();
