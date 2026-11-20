class AdminPanel {
    constructor() {
        this.container = document.getElementById('orders-container');
        this.ordersContainer = document.getElementById('orders-container');
        this.messagesContainer = document.getElementById('messages-container');
        this.pageTitle = document.getElementById('admin-page-title');
        this.catalogContainer = document.getElementById('catalog-container');
        this.christmasContainer = document.getElementById('christmas-container');
        this.inventoryList = [];
        this.christmasLiveMode = 0;
        this.selectedChristmasPreset = 1;
        this.init();
    }

    async init() {
        try {
            await this.checkAuth();
            await Promise.all([
                this.loadOrders(),
                this.loadMessages(),
                this.loadCatalog()
            ]);
        } catch (err) {
            console.error('Init error:', err);
            if (this.container && this.container.innerHTML.includes('Cargando')) {
                this.container.innerHTML = `<p style="text-align: center; color: #eb5757;">Error de conexión. Asegurate de tener sesión iniciada.</p>`;
            }
        }
    }

    switchTab(tabName, element) {
        // Desactivar todos los botones de pestañas
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        // Activar el seleccionado
        element.classList.add('active');

        // Ocultar todas las secciones
        document.querySelectorAll('.admin-section').forEach(sec => sec.classList.remove('active'));
        // Mostrar la seleccionada
        document.getElementById(`${tabName}-section`)?.classList.add('active');

        // Actualizar título
        if (this.pageTitle) {
            const titles = {
                orders: 'Pedidos Recientes',
                messages: 'Mensajes de Contacto',
                catalog: 'Catálogo y Precios',
                christmas: 'L\'Atelier de Noël — Edición Navidad'
            };
            this.pageTitle.textContent = titles[tabName] || 'Panel de Administración';
        }
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    async checkAuth() {
        if (!window.supabase) throw new Error('Supabase no cargado');
        
        let session = null;
        try {
            const { data } = await window.supabase.auth.getSession();
            session = data?.session;
        } catch (err) {
            console.error('Error getting session:', err);
        }
        
        // Check if logged in and email matches the admin email
        if (!session || session.user.email !== 'olediferente@gmail.com') {
            const ordersSection = document.getElementById('orders-section');
            if (ordersSection) {
                ordersSection.innerHTML = `
                    <div style="text-align: center; padding: 50px;">
                        <i data-lucide="lock" style="width: 48px; height: 48px; margin-bottom: 15px; color: #eb5757;"></i>
                        <h2 style="color: #eb5757; margin-bottom: 10px;">Acceso Denegado</h2>
                        <p style="color: var(--text-secondary);">Esta página es exclusiva para el administrador. Por favor, inicia sesión con el correo de la empresa (olediferente@gmail.com).</p>
                        <button class="btn-auth" style="margin-top: 20px; width: auto;" onclick="window.location.href='cuenta.html'">Ir a Iniciar Sesión</button>
                    </div>
                `;
            }
            if (typeof lucide !== 'undefined') lucide.createIcons();
            throw new Error('No autorizado');
        }
    }

    async loadOrders() {
        try {
            // Fetch pending and up to 10 processed orders
            const { data: orders, error } = await window.supabase
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50); // Get recent 50 to ensure we have pending ones + some history

            if (error) throw error;
            
            // Filter: keep all 'pendiente', and only max 10 of others
            const pending = orders.filter(o => o.status === 'pendiente');
            const processed = orders.filter(o => o.status !== 'pendiente').slice(0, 10);
            
            const displayOrders = [...pending, ...processed].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            this.renderOrders(displayOrders);
        } catch (err) {
            console.error('Error loading orders:', err);
            this.container.innerHTML = '<p style="text-align: center; color: #eb5757;">Error al cargar pedidos.</p>';
        }
    }

    renderOrders(orders) {
        if (!orders || orders.length === 0) {
            this.container.innerHTML = `
                <div style="text-align: center; padding: 50px; color: var(--text-secondary);">
                    <i data-lucide="check-circle" style="width: 48px; height: 48px; margin-bottom: 15px; opacity: 0.3;"></i>
                    <p>No hay pedidos recientes.</p>
                </div>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        this.container.innerHTML = '';

        orders.forEach(order => {
            const date = new Date(order.created_at).toLocaleString('es-AR');
            
            let itemsHTML = '';
            order.items.forEach(item => {
                itemsHTML += `
                    <div class="order-item">
                        <span>${item.quantity}x ${item.name} (${item.variant})</span>
                        <span>$${item.price.toLocaleString('es-AR')}</span>
                    </div>
                `;
            });

            const isPending = order.status === 'pendiente';
            const opacityStyle = isPending ? '' : 'opacity: 0.5; filter: grayscale(100%); pointer-events: none;';
            
            let actionButtons = '';
            if (isPending) {
                actionButtons = `
                    <button class="btn-approve" onclick="adminPanel.approveOrder('${order.id}')">Aprobar y Descontar Stock</button>
                    <button class="btn-reject" onclick="adminPanel.rejectOrder('${order.id}')">Rechazar</button>
                `;
            } else {
                const statusColor = order.status === 'aprobado' ? '#27ae60' : '#eb5757';
                actionButtons = `
                    <span style="color: ${statusColor}; font-weight: bold; border: 1px solid ${statusColor}; padding: 5px 15px; border-radius: 8px;">
                        ${order.status.toUpperCase()}
                    </span>
                `;
            }

            const cardHTML = `
                <div class="order-card" id="order-${order.id}" style="${opacityStyle}">
                    <div class="order-header">
                        <div>
                            <span class="order-id">Pedido #${order.id.slice(0,8)}</span>
                            <div class="order-date">${date}</div>
                        </div>
                    </div>
                    <div class="order-items">
                        ${itemsHTML}
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">
                        <div>
                            ${actionButtons}
                        </div>
                        <div class="order-total">
                            Total: $${order.total.toLocaleString('es-AR')}
                        </div>
                    </div>
                </div>
            `;
            this.container.insertAdjacentHTML('beforeend', cardHTML);
        });
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    async approveOrder(orderId) {
        if (!confirm('¿Estás seguro de aprobar este pedido? Se descontará el stock de los productos correspondientes.')) return;

        try {
            // 1. Get the order details to know what items to deduct
            const { data: order, error: orderError } = await window.supabase
                .from('orders')
                .select('items')
                .eq('id', orderId)
                .single();
                
            if (orderError) throw orderError;

            // 2. Deduct stock for each item (only for full bottles, ignoring decants for now if needed, but let's deduct 1 for simplicity if it matches the name)
            for (const item of order.items) {
                // Fetch current stock
                const { data: inventory, error: invError } = await window.supabase
                    .from('inventory')
                    .select('stock')
                    .eq('name', item.name)
                    .single();
                    
                if (invError) {
                    console.warn('Producto no encontrado en inventario:', item.name);
                    continue;
                }
                
                // If variant is 100 ml / Estándar, deduct 1
                if (item.variant.includes('100') || item.variant === 'Estándar') {
                    const newStock = Math.max(0, inventory.stock - item.quantity);
                    
                    const { error: updateError } = await window.supabase
                        .from('inventory')
                        .update({ stock: newStock })
                        .eq('name', item.name);
                        
                    if (updateError) throw updateError;
                }
            }

            // 3. Mark order as approved
            const { error: statusError } = await window.supabase
                .from('orders')
                .update({ status: 'aprobado' })
                .eq('id', orderId);

            if (statusError) throw statusError;

            alert('Pedido aprobado y stock descontado exitosamente.');
            this.loadOrders();
            if (window.WebComponentsInstance && typeof window.WebComponentsInstance.updateAdminNotificationsBadge === 'function') {
                window.WebComponentsInstance.updateAdminNotificationsBadge();
            }

        } catch (err) {
            console.error('Error approving order:', err);
            alert('Error al aprobar el pedido.');
        }
    }

    async rejectOrder(orderId) {
        if (!confirm('¿Rechazar este pedido? (No descontará stock)')) return;

        try {
            const { error } = await window.supabase
                .from('orders')
                .update({ status: 'rechazado' })
                .eq('id', orderId);

            if (error) throw error;
            
            this.loadOrders();
            if (window.WebComponentsInstance && typeof window.WebComponentsInstance.updateAdminNotificationsBadge === 'function') {
                window.WebComponentsInstance.updateAdminNotificationsBadge();
            }
        } catch (err) {
            console.error('Error rejecting order:', err);
            alert('Error al rechazar el pedido.');
        }
    }

    async loadMessages() {
        try {
            if (!this.messagesContainer) return;
            
            const { data: messages, error } = await window.supabase
                .from('contact_messages')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.renderMessages(messages);
        } catch (err) {
            console.error('Error loading messages:', err);
            if (this.messagesContainer) {
                this.messagesContainer.innerHTML = '<p style="text-align: center; color: #eb5757;">Error al cargar los mensajes.</p>';
            }
        }
    }

    renderMessages(messages) {
        if (!this.messagesContainer) return;

        if (!messages || messages.length === 0) {
            this.messagesContainer.innerHTML = `
                <div style="text-align: center; padding: 50px; color: var(--text-secondary);">
                    <i data-lucide="mail-open" style="width: 48px; height: 48px; margin-bottom: 15px; opacity: 0.3;"></i>
                    <p>No tenés mensajes de contacto recibidos.</p>
                </div>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        this.messagesContainer.innerHTML = '';

        messages.forEach(msg => {
            const date = new Date(msg.created_at).toLocaleString('es-AR');
            
            let asuntoAmigable = 'Consulta General';
            if (msg.asunto === 'perfumes') asuntoAmigable = 'Consulta sobre Perfumes';
            else if (msg.asunto === 'decants') asuntoAmigable = 'Información sobre Decants';
            else if (msg.asunto === 'pedido') asuntoAmigable = 'Estado de Pedido / Envíos';
            else if (msg.asunto === 'mayorista') asuntoAmigable = 'Ventas por Mayor / Otros';

            const isUnread = !msg.leido;
            const cardClass = isUnread ? 'message-card unread' : 'message-card';
            const unreadBadge = isUnread ? '<span class="unread-badge">Nuevo</span>' : '';
            const readBtnText = isUnread ? 'Marcar como leído' : 'Marcar como no leído';
            const readBtnIcon = isUnread ? 'check-square' : 'mail';

            // WhatsApp Reply text
            let waButton = '';
            if (msg.whatsapp) {
                // Normalize whatsapp number (remove spaces, symbols)
                let cleanPhone = msg.whatsapp.replace(/[^0-9]/g, '');
                // Add country code if not present (Argentina is 54)
                if (cleanPhone.length === 10 && (cleanPhone.startsWith('11') || cleanPhone.startsWith('15') || cleanPhone.startsWith('2') || cleanPhone.startsWith('3'))) {
                    cleanPhone = '549' + cleanPhone;
                } else if (cleanPhone.length === 11 && cleanPhone.startsWith('9')) {
                    cleanPhone = '54' + cleanPhone;
                }
                const waText = encodeURIComponent(`Hola ${msg.nombre}, te contactamos de Olé Diferente por tu consulta sobre "${asuntoAmigable}": `);
                const waUrl = `https://wa.me/${cleanPhone}?text=${waText}`;
                waButton = `
                    <a href="${waUrl}" target="_blank" class="btn-action btn-reply-wa">
                        <i data-lucide="message-circle"></i>
                        <span>WhatsApp</span>
                    </a>
                `;
            }

            const mailText = encodeURIComponent(`\n\n---\nConsulta original de ${msg.nombre}:\n"${msg.mensaje}"`);
            const mailUrl = `mailto:${msg.email}?subject=${encodeURIComponent('RE: Olé Diferente - ' + asuntoAmigable)}&body=${mailText}`;

            const cardHTML = `
                <div class="${cardClass}" id="message-${msg.id}">
                    <div class="message-header">
                        <div class="message-meta">
                            <h3>${msg.nombre} ${unreadBadge}</h3>
                            <div class="message-info">
                                <a href="mailto:${msg.email}">
                                    <i data-lucide="mail" style="width: 14px; height: 14px;"></i>
                                    <span>${msg.email}</span>
                                </a>
                                ${msg.whatsapp ? `
                                    <a href="tel:${msg.whatsapp}">
                                        <i data-lucide="phone" style="width: 14px; height: 14px;"></i>
                                        <span>${msg.whatsapp}</span>
                                    </a>
                                ` : ''}
                            </div>
                        </div>
                        <div class="message-date">${date}</div>
                    </div>
                    <span class="message-subject">${asuntoAmigable}</span>
                    <div class="message-body">${msg.mensaje}</div>
                    <div class="message-actions">
                        ${waButton}
                        <a href="${mailUrl}" class="btn-action">
                            <i data-lucide="mail"></i>
                            <span>Responder por Email</span>
                        </a>
                        <button class="btn-action read-toggle" onclick="adminPanel.toggleMessageRead('${msg.id}', ${msg.leido})">
                            <i data-lucide="${readBtnIcon}"></i>
                            <span>${readBtnText}</span>
                        </button>
                        <button class="btn-action btn-delete" onclick="adminPanel.deleteMessage('${msg.id}')">
                            <i data-lucide="trash-2"></i>
                            <span>Eliminar</span>
                        </button>
                    </div>
                </div>
            `;
            this.messagesContainer.insertAdjacentHTML('beforeend', cardHTML);
        });

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    async toggleMessageRead(messageId, currentLeido) {
        try {
            const { error } = await window.supabase
                .from('contact_messages')
                .update({ leido: !currentLeido })
                .eq('id', messageId);

            if (error) throw error;
            this.loadMessages();
            if (window.WebComponentsInstance && typeof window.WebComponentsInstance.updateAdminNotificationsBadge === 'function') {
                window.WebComponentsInstance.updateAdminNotificationsBadge();
            }
        } catch (err) {
            console.error('Error updating read status:', err);
            alert('Error al actualizar el estado del mensaje.');
        }
    }

    async deleteMessage(messageId) {
        if (!confirm('¿Estás seguro de eliminar este mensaje permanentemente?')) return;

        try {
            const { error } = await window.supabase
                .from('contact_messages')
                .delete()
                .eq('id', messageId);

            if (error) throw error;
            this.loadMessages();
            if (window.WebComponentsInstance && typeof window.WebComponentsInstance.updateAdminNotificationsBadge === 'function') {
                window.WebComponentsInstance.updateAdminNotificationsBadge();
            }
        } catch (err) {
            console.error('Error deleting message:', err);
            alert('Error al eliminar el mensaje.');
        }
    }

    async loadCatalog() {
        if (!this.catalogContainer) return;
        try {
            const { data: inventory, error } = await window.supabase
                .from('inventory')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;
            const rawList = inventory || [];
            const xmasRow = rawList.find(i => i.name === '__CONFIG_NAVIDAD__');
            this.christmasLiveMode = xmasRow ? Math.max(0, parseInt(xmasRow.stock, 10) || 0) : 0;
            if (this.christmasLiveMode > 0) {
                this.selectedChristmasPreset = this.christmasLiveMode;
            }

            this.inventoryList = rawList.filter(i => !String(i.name).startsWith('__CONFIG_'));
            this.renderCatalogView();
            this.renderChristmasView();
        } catch (err) {
            console.error('Error loading inventory:', err);
            this.catalogContainer.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #eb5757;">
                    <i data-lucide="alert-circle" style="width: 40px; height: 40px; margin-bottom: 10px;"></i>
                    <p>No se pudo cargar el inventario: ${err.message}</p>
                </div>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }

    renderCatalogView() {
        const total = this.inventoryList.length;
        const inStock = this.inventoryList.filter(i => i.stock > 0).length;
        const preorder = this.inventoryList.filter(i => i.stock === -1).length;
        const outOfStock = this.inventoryList.filter(i => i.stock === 0).length;

        this.catalogContainer.innerHTML = `
            <!-- Fila de Tarjetas de Gestión -->
            <div class="catalog-grid">
                <div class="catalog-card">
                    <div>
                        <div class="catalog-card-header">
                            <i data-lucide="file-spreadsheet"></i>
                            <h3>Planilla en Google Drive</h3>
                        </div>
                        <p class="catalog-card-desc">
                            Planilla maestra de precios y stock. Cualquier cambio que hagas en la planilla se sincronizará automáticamente con la web en vivo.
                        </p>
                    </div>
                    <div>
                        <a href="https://docs.google.com/spreadsheets/d/1kCtWIFHFelvT4d2mkFMvU22VP94ke61R/edit?usp=sharing" target="_blank" rel="noopener noreferrer" class="btn-drive-link">
                            <i data-lucide="external-link"></i>
                            <span>Abrir Planilla en Google Drive</span>
                        </a>
                    </div>
                </div>

                <div class="catalog-card">
                    <div>
                        <div class="catalog-card-header">
                            <i data-lucide="refresh-cw"></i>
                            <h3>Sincronización en la Nube</h3>
                        </div>
                        <p class="catalog-card-desc">
                            La web se sincroniza automáticamente cada 2 horas en la nube (GitHub Actions). Si acabas de editar precios y quieres forzar la actualización inmediata, puedes iniciarla con un clic.
                        </p>
                    </div>
                    <div>
                        <a href="https://github.com/gonzapetreigne/Ol-diferente-/actions/workflows/sync-catalog.yml" target="_blank" rel="noopener noreferrer" class="btn-sync-action">
                            <i data-lucide="play"></i>
                            <span>Ejecutar Sincronización en la Nube</span>
                        </a>
                    </div>
                </div>
            </div>

            <!-- Fila de Estadísticas -->
            <div class="catalog-stats-row">
                <div class="stat-pill">
                    <span class="stat-pill-label">Total Perfumes</span>
                    <span class="stat-pill-value gold">${total}</span>
                </div>
                <div class="stat-pill">
                    <span class="stat-pill-label">En Stock Inmediato</span>
                    <span class="stat-pill-value green">${inStock}</span>
                </div>
                <div class="stat-pill">
                    <span class="stat-pill-label">Por Encargue</span>
                    <span class="stat-pill-value orange">${preorder}</span>
                </div>
                <div class="stat-pill">
                    <span class="stat-pill-label">Sin Stock</span>
                    <span class="stat-pill-value red">${outOfStock}</span>
                </div>
            </div>

            <!-- Buscador de Inventario -->
            <div class="inventory-search-wrap">
                <i data-lucide="search" class="inventory-search-icon"></i>
                <input type="text" id="inventory-search" class="inventory-search-input" placeholder="Buscar perfume por nombre..." oninput="adminPanel.filterInventory(this.value)">
            </div>

            <!-- Tabla de Inventario en Vivo -->
            <div class="inventory-table-container">
                <table class="inventory-table">
                    <thead>
                        <tr>
                            <th>Perfume</th>
                            <th>Estado / Disponibilidad</th>
                            <th>Unidades</th>
                            <th style="text-align: right;">Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="inventory-tbody">
                        ${this.generateInventoryRows(this.inventoryList)}
                    </tbody>
                </table>
            </div>
        `;

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    generateInventoryRows(list) {
        if (!list || list.length === 0) {
            return `<tr><td colspan="4" style="text-align: center; color: var(--text-secondary); padding: 30px;">No se encontraron perfumes.</td></tr>`;
        }
        return list.map(item => {
            let statusBadge = '';
            let unitsText = '';
            if (item.stock > 0) {
                statusBadge = `<span class="badge-status instock"><i data-lucide="check-circle" style="width: 14px; height: 14px;"></i> En Stock</span>`;
                unitsText = `${item.stock} u.`;
            } else if (item.stock === -1) {
                statusBadge = `<span class="badge-status preorder"><i data-lucide="clock" style="width: 14px; height: 14px;"></i> Por Encargue</span>`;
                unitsText = 'Bajo pedido';
            } else {
                statusBadge = `<span class="badge-status outofstock"><i data-lucide="x-circle" style="width: 14px; height: 14px;"></i> Agotado</span>`;
                unitsText = '0 u.';
            }

            return `
                <tr>
                    <td style="font-weight: 600;">${item.name}</td>
                    <td>${statusBadge}</td>
                    <td style="color: var(--text-secondary);">${unitsText}</td>
                    <td style="text-align: right;">
                        <a href="tienda.html" target="_blank" style="color: var(--accent-color); text-decoration: none; font-size: 0.85rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                            <span>Ver en tienda</span>
                            <i data-lucide="external-link" style="width: 14px; height: 14px;"></i>
                        </a>
                    </td>
                </tr>
            `;
        }).join('');
    }

    filterInventory(query) {
        const tbody = document.getElementById('inventory-tbody');
        if (!tbody) return;
        const q = (query || '').toLowerCase().trim();
        const filtered = this.inventoryList.filter(item => item.name.toLowerCase().includes(q));
        tbody.innerHTML = this.generateInventoryRows(filtered);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    renderChristmasView() {
        if (!this.christmasContainer) return;

        const isLive = this.christmasLiveMode > 0;
        const localPreview = parseInt(localStorage.getItem('ole_xmas_preview_mode') || '0', 10) || 0;
        const modeNames = {
            1: "Estilo 1: Navidad Clásica",
            2: "Estilo 2: Minimalista",
            3: "Estilo 3: Nochebuena"
        };

        const statusBadge = isLive
            ? `<div class="xmas-status-pill live"><i data-lucide="radio" style="width:16px;height:16px;"></i> ACTIVO EN VIVO PARA TODOS LOS VISITANTES (${modeNames[this.christmasLiveMode] || 'Modo 1'})</div>`
            : `<div class="xmas-status-pill standby"><i data-lucide="clock" style="width:16px;height:16px;"></i> EN ESPERA (OCULTO AL PÚBLICO — LISTO PARA LANZAR)</div>`;

        this.christmasContainer.innerHTML = `
            <div class="xmas-admin-hero">
                ${statusBadge}
                <h2 style="font-family: 'Playfair Display', serif; font-size: 2rem; color: #FFEFA6; margin: 0 0 10px 0;">
                    Edición Navidad — Control de Lanzamiento en Vivo
                </h2>
                <p style="color: var(--text-secondary); font-size: 0.95rem; line-height: 1.6; max-width: 780px; margin: 0 0 24px 0;">
                    Activá o desactivá la decoración navideña en tiempo real para todos los dispositivos (Escritorio y Móviles). Podés previsualizar cada estilo solo en tu navegador antes de lanzarlo al público.
                </p>

                <!-- Selector de 3 Estilos / Intensidades -->
                <div class="xmas-mode-cards">
                    <div class="xmas-mode-card ${this.selectedChristmasPreset === 1 ? 'selected' : ''}" onclick="adminPanel.selectChristmasPreset(1)">
                        <div>
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                <span style="font-size:0.75rem; font-weight:700; color:var(--accent-color); letter-spacing:1.5px; text-transform:uppercase;">★ Recomendado</span>
                                ${this.selectedChristmasPreset === 1 ? '<i data-lucide="check-circle-2" style="color:#D4AF37; width:18px; height:18px;"></i>' : ''}
                            </div>
                            <h4>1. Navidad Clásica (Completo)</h4>
                            <p>Guirnalda de pino con moños rojos y bolas de árbol, gorro de Papá Noel en el logo, trineo de Santa cruzando la pantalla cada ~40 seg, nieve con polvo de oro, banner de regalos en Tienda y ramitas de acebo en los productos.</p>
                        </div>
                        <span style="font-size:0.8rem; color:#FFEFA6; font-weight:600;">Seleccionar Estilo 1</span>
                    </div>

                    <div class="xmas-mode-card ${this.selectedChristmasPreset === 2 ? 'selected' : ''}" onclick="adminPanel.selectChristmasPreset(2)">
                        <div>
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                <span style="font-size:0.75rem; font-weight:700; color:var(--text-secondary); letter-spacing:1.5px; text-transform:uppercase;">Sutil</span>
                                ${this.selectedChristmasPreset === 2 ? '<i data-lucide="check-circle-2" style="color:#D4AF37; width:18px; height:18px;"></i>' : ''}
                            </div>
                            <h4>2. Navidad Dorada (Minimalista)</h4>
                            <p>Sin pino verde: guirnalda de hilos de oro con estrellas colgantes, gorro de Papá Noel en el logo, lluvia de estrellas doradas, cinta Champagne Gold y trineo de Santa.</p>
                        </div>
                        <span style="font-size:0.8rem; color:#FFEFA6; font-weight:600;">Seleccionar Estilo 2</span>
                    </div>

                    <div class="xmas-mode-card ${this.selectedChristmasPreset === 3 ? 'selected' : ''}" onclick="adminPanel.selectChristmasPreset(3)">
                        <div>
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                <span style="font-size:0.75rem; font-weight:700; color:#eb5757; letter-spacing:1.5px; text-transform:uppercase;">24 & 25 de Diciembre</span>
                                ${this.selectedChristmasPreset === 3 ? '<i data-lucide="check-circle-2" style="color:#D4AF37; width:18px; height:18px;"></i>' : ''}
                            </div>
                            <h4>3. Nochebuena Mágica (Máximo)</h4>
                            <p>Todo el Estilo 1 + luces multicolores titilando en la guirnalda, Árbol de Navidad iluminado con regalos en la esquina, copos de nieve cristalinos (❄) y trineo de Santa más seguido.</p>
                        </div>
                        <span style="font-size:0.8rem; color:#FFEFA6; font-weight:600;">Seleccionar Estilo 3</span>
                    </div>
                </div>

                <!-- Botones de Lanzamiento en Vivo -->
                <div style="display: flex; flex-wrap: wrap; gap: 15px; align-items: center; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <button class="btn-launch-live" onclick="adminPanel.setChristmasLiveMode(${this.selectedChristmasPreset})">
                        <i data-lucide="rocket"></i>
                        <span>${isLive ? `ACTUALIZAR EN VIVO AL ESTILO ${this.selectedChristmasPreset}` : `LANZAR DECORACIÓN EN VIVO (ESTILO ${this.selectedChristmasPreset})`}</span>
                    </button>

                    ${isLive ? `
                        <button class="btn-stop-live" onclick="adminPanel.setChristmasLiveMode(0)">
                            <i data-lucide="power-off"></i>
                            <span>Desactivar Decoración en Vivo (Volver a Web Normal)</span>
                        </button>
                    ` : ''}
                </div>
            </div>

            <!-- Tarjeta de Vista Previa Privada (Sin afectar al público) -->
            <div class="catalog-card">
                <div class="catalog-card-header">
                    <i data-lucide="eye"></i>
                    <h3>Laboratorio de Vista Previa Privada (Solo en tu dispositivo)</h3>
                </div>
                <p class="catalog-card-desc">
                    ¿Querés inspeccionar cómo luce la decoración en Inicio, Tienda o en tu celular antes de lanzarla al público? Activá la Vista Previa Local o usá los enlaces directos de prueba:
                </p>
                <div style="display: flex; flex-wrap: wrap; gap: 12px; align-items: center;">
                    <button class="btn-preview-local" onclick="adminPanel.toggleLocalPreview(${this.selectedChristmasPreset})">
                        <i data-lucide="${localPreview > 0 ? 'eye-off' : 'sparkles'}"></i>
                        <span>${localPreview > 0 ? 'Salir de Vista Previa Local' : `Probar Estilo ${this.selectedChristmasPreset} Aquí Mismo`}</span>
                    </button>
                    <a href="index.html?navidad=${this.selectedChristmasPreset}" target="_blank" class="btn-preview-local">
                        <i data-lucide="external-link"></i>
                        <span>Abrir Portada (Inicio) con Navidad</span>
                    </a>
                    <a href="tienda.html?navidad=${this.selectedChristmasPreset}" target="_blank" class="btn-preview-local">
                        <i data-lucide="shopping-bag"></i>
                        <span>Abrir Tienda con Navidad</span>
                    </a>
                </div>
            </div>
        `;

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    selectChristmasPreset(preset) {
        this.selectedChristmasPreset = preset;
        this.renderChristmasView();
        // Si tiene activa la vista previa local, actualizarla al instante para que vea el cambio de estilo en vivo
        const localPreview = parseInt(localStorage.getItem('ole_xmas_preview_mode') || '0', 10) || 0;
        if (localPreview > 0 && this.christmasLiveMode === 0) {
            localStorage.setItem('ole_xmas_preview_mode', String(preset));
            if (window.OleChristmas) window.OleChristmas.applyMode(preset, true);
        }
    }

    toggleLocalPreview(preset) {
        const current = parseInt(localStorage.getItem('ole_xmas_preview_mode') || '0', 10) || 0;
        if (current > 0) {
            localStorage.removeItem('ole_xmas_preview_mode');
            if (window.OleChristmas) window.OleChristmas.syncFromSupabase(this.christmasLiveMode);
        } else {
            const modeToPreview = preset || this.selectedChristmasPreset || 1;
            localStorage.setItem('ole_xmas_preview_mode', String(modeToPreview));
            if (window.OleChristmas) window.OleChristmas.applyMode(modeToPreview, this.christmasLiveMode === 0);
        }
        this.renderChristmasView();
    }

    async setChristmasLiveMode(mode) {
        const confirmMsg = mode > 0
            ? `¿Confirmás LANZAR EN VIVO la decoración navideña (Estilo ${mode}) para todos los visitantes en Escritorio y Móviles?`
            : `¿Confirmás DESACTIVAR la decoración navideña en vivo y volver al diseño habitual?`;

        if (!confirm(confirmMsg)) return;

        try {
            // Verificar si ya existe la fila __CONFIG_NAVIDAD__
            const { data: existing } = await window.supabase
                .from('inventory')
                .select('id')
                .eq('name', '__CONFIG_NAVIDAD__')
                .maybeSingle();

            let error = null;
            if (existing) {
                const res = await window.supabase
                    .from('inventory')
                    .update({ stock: mode })
                    .eq('name', '__CONFIG_NAVIDAD__');
                error = res.error;
            } else {
                const res = await window.supabase
                    .from('inventory')
                    .insert([{ name: '__CONFIG_NAVIDAD__', stock: mode }]);
                error = res.error;
            }

            if (error) throw error;

            this.christmasLiveMode = mode;
            if (mode > 0) {
                this.selectedChristmasPreset = mode;
                localStorage.removeItem('ole_xmas_preview_mode');
            }

            if (window.OleChristmas) {
                window.OleChristmas.syncFromSupabase(mode);
            }

            this.renderChristmasView();
            alert(mode > 0
                ? '🎄 ¡Decoración Navideña LANZADA EN VIVO con éxito para todos los usuarios!'
                : '✅ Decoración Navideña desactivada en vivo.');
        } catch (err) {
            console.error('Error actualizando modo navidad en Supabase:', err);
            alert('Error al guardar el estado en vivo: ' + (err.message || err));
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.adminPanel = new AdminPanel();
});
