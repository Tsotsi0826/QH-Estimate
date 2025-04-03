// js/dashboard.js
// Refactored: Sidebar search functions moved to js/sidebar-search.js
// Debug panel functions moved to js/debug-panel.js
// Exposes renderModuleList globally for sidebar search.

// --- Global Variables ---
// These need to remain accessible by other modules for now
let appData = {
    modules: [] // Holds the structure/definitions of all available modules
};
let globalDraggedItem = null; // Used for drag-and-drop
let headerCollapseState = {}; // Stores collapsed state for sidebar headers { headerId: true/false }

// --- Global Namespace Setup ---
window.ConstructionApp = window.ConstructionApp || {};
window.ConstructionApp.DashboardUtils = window.ConstructionApp.DashboardUtils || {}; // Namespace for shared dashboard functions

// --- Utility / Helper Functions ---
// (setupModuleSearch function REMOVED - moved to sidebar-search.js)

// --- Initialization ---

/**
 * Main entry point when the DOM is ready.
 * Loads modules, initializes client state, sets up UI listeners.
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log("DEBUG: DOMContentLoaded event fired");
    console.log("[Dashboard] DOM loaded, initializing app");

    // Call setup for the debug panel
    if (window.ConstructionApp?.DebugPanel?.setup) {
         window.ConstructionApp.DebugPanel.setup();
    } else {
         console.warn("[Dashboard] DebugPanel setup function not found.");
    }

    console.log("DEBUG: Calling loadAndRenderModules...");
    loadAndRenderModules().then(() => {
        console.log("DEBUG: loadAndRenderModules COMPLETE.");

        // Assign the client change callback
        if (window.ConstructionApp && window.ConstructionApp.ClientManager) {
            console.log("DEBUG: Setting ClientManager.onClientChanged callback to updateDashboard.");
            window.ConstructionApp.ClientManager.onClientChanged = updateDashboard;
        } else {
            console.error("[Dashboard] ClientManager not available! Cannot set callback.");
        }

        console.log("DEBUG: Calling initApp...");
        initApp();
        console.log("DEBUG: initApp COMPLETE.");

        // Setup other UI components by calling their setup functions
        setupDropdownMenus();
        setupClientManagement();
        setupAddModuleButton();
        // Call setup for sidebar search (function is now in sidebar-search.js)
        if (window.ConstructionApp?.SidebarSearch?.setup) {
             window.ConstructionApp.SidebarSearch.setup();
        } else {
             console.warn("[Dashboard] SidebarSearch setup function not found.");
        }
        setupDragAndDrop();

        // Load client list asynchronously
        if (window.ConstructionApp && window.ConstructionApp.ClientManager) {
            window.ConstructionApp.ClientManager.loadClients().then(() => {
                console.log("[Dashboard] Client list loaded");
            }).catch(error => {
                console.error("[Dashboard] Error loading client list:", error);
            });
        }
    }).catch(error => {
        console.error("DEBUG: loadAndRenderModules FAILED.", error);
        console.error("[Dashboard] Critical error during module loading:", error);
        const contentElement = document.getElementById('module-content');
        if (contentElement) {
            contentElement.innerHTML = `<div class="no-client-notification" style="background-color: #f8d7da; color: #721c24; border-color: #f5c6cb;"><h2>Error Loading Modules</h2><p>Could not load module definitions. Please check the console (F12) for details or contact support.</p><p>Error: ${error.message || 'Unknown error'}</p></div>`;
        }
    });
});

/**
 * Initializes the application state, particularly the current client,
 * based on navigation history and sessionStorage.
 */
function initApp() {
    console.log("[Dashboard] Initializing app state");
    const navigationState = sessionStorage.getItem('navigationState');
    const storedClientStr = sessionStorage.getItem('currentClient');
    let clientToSet = null;

    console.log(`[Dashboard] Init: NavState='${navigationState}', StoredClient='${storedClientStr ? 'Exists' : 'None'}'`);

    if (navigationState === 'returningToDashboard' && storedClientStr) {
        try {
            clientToSet = JSON.parse(storedClientStr);
            console.log("[Dashboard] Restoring client from sessionStorage (returning):", clientToSet?.name || 'Unknown');
        } catch (error) {
            console.error("[Dashboard] Error parsing stored client on return:", error);
            sessionStorage.removeItem('currentClient');
        }
    } else if (navigationState === 'manualLogout' || navigationState === 'invalidAccess') {
        console.log("[Dashboard] Manual logout or invalid access detected, ensuring no client is set.");
        clientToSet = null;
        sessionStorage.removeItem('currentClient');
    } else if (storedClientStr) {
        try {
            clientToSet = JSON.parse(storedClientStr);
            console.log("[Dashboard] Restoring client from sessionStorage (fresh load/unknown):", clientToSet?.name || 'Unknown');
        } catch (error) {
            console.error("[Dashboard] Error parsing stored client on fresh load:", error);
            sessionStorage.removeItem('currentClient');
        }
    } else {
        console.log("[Dashboard] No client found in sessionStorage, starting fresh.");
    }

    if (window.ConstructionApp && window.ConstructionApp.ClientManager) {
        console.log("DEBUG: Calling ClientManager.setCurrentClient with client:", clientToSet ? clientToSet.name : 'None');
        window.ConstructionApp.ClientManager.setCurrentClient(clientToSet);
        console.log("DEBUG: ClientManager.setCurrentClient call complete (callback should have been triggered).");
    } else {
        console.error("[Dashboard] ClientManager not available during initApp!");
        updateDashboard(clientToSet); // Attempt manual update as fallback
    }

    sessionStorage.removeItem('navigationState');
    console.log("[Dashboard] Cleared navigation state.");

    // Update debug panel using the exposed function
    window.ConstructionApp?.DebugPanel?.update();
}

// --- Module Loading and Rendering (Sidebar) ---

/**
 * Loads module definitions from Firebase, with fallbacks to sessionStorage backup or defaults.
 * Renders the initial module list in the sidebar.
 */
async function loadAndRenderModules() {
    console.log("[Dashboard] Loading and rendering modules structure");
    let loadedModules = [];

    try {
        if (!window.ConstructionApp?.Firebase) throw new Error("Firebase module not available");
        loadedModules = await window.ConstructionApp.Firebase.loadModules();
        console.log("[Dashboard] Loaded modules from Firebase:", loadedModules?.length || 0);

        if (!Array.isArray(loadedModules)) {
            console.warn("[Dashboard] Firebase loadModules did not return an array. Using backup/defaults.");
            loadedModules = [];
        }

        if (loadedModules.length === 0) {
            console.warn("[Dashboard] No modules in Firebase or invalid data, trying backup.");
            loadedModules = restoreModuleOrderFromBackup() || [];
            if (loadedModules.length > 0) {
                console.log("[Dashboard] Restored from backup:", loadedModules.length);
            } else {
                console.warn("[Dashboard] Backup empty or failed. Using defaults.");
                loadedModules = getDefaultModules();
                await window.ConstructionApp.Firebase.saveModules(loadedModules);
                console.log("[Dashboard] Saved default modules to Firebase.");
            }
        }
    } catch (error) {
        console.error("[Dashboard] Error loading from Firebase, trying backup:", error);
        loadedModules = restoreModuleOrderFromBackup() || [];
        if (loadedModules.length > 0) {
            console.log("[Dashboard] Restored from backup after Firebase error:", loadedModules.length);
        } else {
            console.warn("[Dashboard] Backup failed/empty after Firebase error. Using defaults.");
            loadedModules = getDefaultModules();
            try {
                if (window.ConstructionApp?.Firebase) {
                    await window.ConstructionApp.Firebase.saveModules(loadedModules);
                    console.log("[Dashboard] Saved default modules to Firebase after initial load error.");
                }
            } catch (saveError) {
                console.error("[Dashboard] Failed to save default modules after Firebase load error:", saveError);
            }
        }
    }

    // Ensure the special 'Notes' module is always present and first
    const notesModuleIndex = loadedModules.findIndex(m => m.id === 'notes');
    let notesModuleData = notesModuleIndex > -1 ? loadedModules.splice(notesModuleIndex, 1)[0] : {};
    notesModuleData = {
        id: 'notes',
        name: notesModuleData.name || 'Notes',
        requiresClient: notesModuleData.requiresClient !== undefined ? notesModuleData.requiresClient : true,
        type: notesModuleData.type || 'regular',
        parentId: notesModuleData.parentId !== undefined ? notesModuleData.parentId : null,
        order: -1,
    };
    loadedModules.unshift(notesModuleData);

    // Add 'Reports' module definition if missing
    const reportsModuleExists = loadedModules.some(m => m.id === 'reports');
    if (!reportsModuleExists) {
        console.log("[Dashboard] Adding 'Reports' module definition.");
        const reportsModuleData = {
            id: 'reports', name: 'Reports', requiresClient: false,
            type: 'regular', parentId: null, order: 99
        };
        loadedModules.push(reportsModuleData);
    } else {
         const reportIndex = loadedModules.findIndex(m => m.id === 'reports');
         if (reportIndex > -1 && loadedModules[reportIndex].requiresClient !== false) {
              console.warn("[Dashboard] Overriding requiresClient for existing 'Reports' module to false.");
              loadedModules[reportIndex].requiresClient = false;
         }
    }

    // Store the final module list in the global appData
    appData.modules = loadedModules.map(mod => ({
        ...mod,
        parentId: (mod.parentId === 'null' || mod.parentId === undefined) ? null : mod.parentId,
        order: mod.order ?? 0,
        renderTemplate: mod.renderTemplate || function(client) {
            const moduleData = client?.moduleData?.[mod.id]?.data || {};
            return `<h3>${mod.name}</h3><p>Default Content</p><pre>${JSON.stringify(moduleData, null, 2)}</pre>`;
        },
        saveData: mod.saveData || function() { return {}; }
    }));

    // Render the sidebar list
    renderModuleList(appData.modules); // This function needs to be defined below
    console.log("[Dashboard] Module structure processed and sidebar rendered.");
}

/**
 * Returns a default set of module definitions if none are loaded.
 */
function getDefaultModules() {
    console.log("[Dashboard] Providing default module set.");
    return [
        { id: 'p-and-gs', name: 'P&G\'s', requiresClient: true, type: 'regular', parentId: null, order: 1 },
        { id: 'foundations', name: 'Foundations', requiresClient: false, type: 'header', parentId: null, order: 2 },
        { id: 'earthworks', name: 'Earthworks', requiresClient: true, type: 'regular', parentId: 'foundations', order: 0 },
        { id: 'concrete', name: 'Concrete', requiresClient: true, type: 'regular', parentId: 'foundations', order: 1 },
        { id: 'steel', name: 'Steel', requiresClient: true, type: 'regular', parentId: 'foundations', order: 2 },
        { id: 'structure', name: 'Structure', requiresClient: false, type: 'header', parentId: null, order: 3 },
        { id: 'brickwork', name: 'Brickwork', requiresClient: true, type: 'regular', parentId: 'structure', order: 0 },
        { id: 'demolish', name: 'Demolish', requiresClient: true, type: 'regular', parentId: null, order: 4 },
        { id: 'ceilings', name: 'Ceilings', requiresClient: true, type: 'regular', parentId: null, order: 5 },
    ];
}

/**
 * Renders the hierarchical list of modules in the sidebar.
 * @param {Array} modules - The array of module objects from appData.
 */
function renderModuleList(modules) { // Keep this function in dashboard.js for now
    const container = document.getElementById('modules-container');
    if (!container) { console.error("[Dashboard] Sidebar modules container not found."); return; }
    container.innerHTML = '';
    const sortedModules = [...modules].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.name.localeCompare(b.name));
    function renderLevel(parentId, level) {
        sortedModules.filter(m => m.parentId === parentId).forEach(module => {
            const moduleElement = createModuleElement(module, level); // Needs createModuleElement
            container.appendChild(moduleElement);
            const isHeader = module.type === 'header';
            const isCollapsed = headerCollapseState[module.id] === true;
            if (!isHeader || !isCollapsed) { renderLevel(module.id, level + 1); }
        });
    }
    renderLevel(null, 0);
    setupDragAndDrop(); // Needs setupDragAndDrop
}
// Expose renderModuleList for sidebar-search.js
window.ConstructionApp.DashboardUtils.renderModuleList = renderModuleList;


/**
 * Creates a single module list item element for the sidebar.
 */
function createModuleElement(moduleData, level = 0) { // Keep this function in dashboard.js for now
    const moduleElement = document.createElement('div');
    moduleElement.className = 'module-item';
    moduleElement.draggable = true;
    moduleElement.setAttribute('data-module-id', moduleData.id);
    moduleElement.setAttribute('data-requires-client', moduleData.requiresClient ? 'true' : 'false');
    moduleElement.setAttribute('data-module-type', moduleData.type || 'regular');
    moduleElement.setAttribute('data-parent-id', moduleData.parentId || 'null');
    moduleElement.setAttribute('data-level', level);
    moduleElement.style.paddingLeft = `${20 + level * 15}px`;
    let collapseIconHTML = '';
    if (moduleData.type === 'header') {
        moduleElement.classList.add('header-item');
        const isCollapsed = headerCollapseState[moduleData.id] === true;
        if (isCollapsed) { moduleElement.classList.add('collapsed'); }
        collapseIconHTML = `<span class="collapse-icon" title="Expand/Collapse">${isCollapsed ? '▶' : '▼'}</span>`;
    }
    const configIcon = !moduleData.requiresClient ? ' <span title="Admin/Config Module" style="opacity: 0.7; margin-left: 5px;">⚙️</span>' : '';
    moduleElement.innerHTML = `
        <div class="module-drag-handle" title="Drag to reorder">≡</div>
        ${collapseIconHTML}
        <div class="module-icon" title="Actions">...<div class="dropdown-menu"><div class="dropdown-item edit-module">Edit</div><div class="dropdown-item delete-module">Delete</div></div></div>
        <span class="module-name">${moduleData.name}</span>
        ${configIcon}
    `;
    const icon = moduleElement.querySelector('.module-icon');
    if (icon) { icon.addEventListener('click', (e) => { e.stopPropagation(); const dropdown = icon.querySelector('.dropdown-menu'); if (dropdown) { const isVisible = dropdown.style.display === 'block'; closeAllDropdowns(); if (!isVisible) dropdown.style.display = 'block'; } }); } // Needs closeAllDropdowns
    const editBtn = moduleElement.querySelector('.edit-module');
    if (editBtn) { editBtn.addEventListener('click', (e) => { e.stopPropagation(); editModule(moduleElement); closeAllDropdowns(); }); } // Needs editModule, closeAllDropdowns
    const deleteBtn = moduleElement.querySelector('.delete-module');
    if (deleteBtn) { deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteModule(moduleElement); closeAllDropdowns(); }); } // Needs deleteModule, closeAllDropdowns
    const nameSpan = moduleElement.querySelector('.module-name');
    if (nameSpan) { nameSpan.addEventListener('click', () => { if (window.ConstructionApp?.ModuleUtils) window.ConstructionApp.ModuleUtils.navigateToModule(moduleData.id); else console.error("ModuleUtils not found!"); }); }
    return moduleElement;
}

// --- Module Creation --- (Keep functions called by createModuleElement here for now)
function setupAddModuleButton() { /* ... Keep original ... */ }
function addNewModule() { /* ... Keep original ... */ }
function saveModuleStructure() { /* ... Keep original ... */ }
function restoreModuleOrderFromBackup() { /* ... Keep original ... */ }

// --- Drag and Drop (Sidebar Modules) --- (Keep functions called by renderModuleList here for now)
let dragOverElement = null; let dropIndicator = null;
function setupDragAndDrop() { /* ... Keep original ... */ }
function handleDragStart(e) { /* ... Keep original ... */ }
function handleDragOver(e) { /* ... Keep original ... */ }
function handleDragLeave(e) { /* ... Keep original ... */ }
function handleDrop(e) { /* ... Keep original ... */ }
function handleDragEnd(e) { /* ... Keep original ... */ }
function clearDropIndicators(element) { /* ... Keep original ... */ }
function recalculateModuleOrder() { /* ... Keep original ... */ }

// --- Other UI Functions --- (Keep functions called by createModuleElement here for now)
function setupDropdownMenus() { /* ... Keep original ... */ }
function handleMaybeCollapseToggle(e) { /* ... Keep original ... */ }
function handleCollapseToggle(headerModuleId) { /* ... Keep original ... */ }
function handleGlobalClickForDropdowns(e) { /* ... Keep original ... */ }
function closeAllDropdowns() { /* ... Keep original ... */ }
function editModule(moduleElement) { /* ... Keep original ... */ }
function deleteModule(moduleElement) { /* ... Keep original ... */ }

// --- Client Management & Dashboard Update --- (Keep functions called by event listeners here for now)
const E = (id) => document.getElementById(id); // Define E globally or pass it around if needed
const Q = (sel) => document.querySelector(sel);
function setupClientManagement() { /* ... Keep original ... */ }
function createClientModal(type) { /* ... Keep original ... */ }
function setupModalCloseButtons(modal, overlayId) { /* ... Keep original ... */ }
function setupClientSearch(modal) { /* ... Keep original ... */ }
function setupClientListSelection(modal) { /* ... Keep original ... */ }

// --- Dashboard Rendering & Update --- (Keep core update logic here)
function renderDashboardContent(client) { console.log("DEBUG: renderDashboardContent START. Client:", client ? client.name : 'None'); const cont = E('module-content'); if (!cont) { console.error("! #module-content not found"); return; } let tiles = ''; let any = false; if (appData.modules?.length > 0) { appData.modules.forEach(mod => { if (mod.type === 'header') return; any = true; const id = mod.id, name = mod.name; let modData = null, has = false; if (client?.moduleData) { const v = client.moduleData[id]; modData = v?.data ?? v ?? null; if (modData !== null) has = true; } let cost = 0; if (has) { if (modData.totalCost !== undefined) cost = parseFloat(modData.totalCost) || 0; else if (modData.items?.length > 0) cost = window.ConstructionApp?.ModuleUtils?.calculateModuleTotal(modData.items) ?? 0; else if (id === 'notes') cost = 0; } const fmtCost = window.ConstructionApp?.ModuleUtils?.formatCurrency(cost) ?? `R${cost.toFixed(2)}`; const clear = (has && id !== 'notes') ? `<button class="clear-module-btn" title="Clear">×</button>` : ''; const dis = (!client && mod.requiresClient) ? 'disabled title="Select client"' : ''; const open = `<button class="btn module-open-btn" style="margin-top:10px;" ${dis}>Open Module</button>`; let costHtml = ''; if (id === 'notes') costHtml = '<p style="font-size:0.9em;color:#666;margin-top:10px;">(No cost)</p>'; else { const noData = !has ? ' <small style="opacity:0.7;">(No data)</small>' : ''; costHtml = `<p class="module-tile-cost">${fmtCost}${noData}</p>`; } tiles += `<div class="module-tile ${!has ? 'no-client-data' : ''}" data-module-id="${id}">${clear}<h5>${name}</h5>${costHtml}${open}</div>`; }); } let wrap = `<div style="background-color:#f8f9fa; padding:15px; border-radius:5px; margin-bottom:10px;"><h4 style="margin-bottom:15px;">Module Summaries</h4><div id="module-tiles">`; if (any) wrap += tiles; else wrap += `<div style="grid-column:1/-1; text-align:center; color:#666;"><p>No modules defined.</p></div>`; wrap += `</div></div>`; console.log("DEBUG: Updating #module-content..."); cont.innerHTML += wrap; console.log("DEBUG: #module-content update COMPLETE."); setupDashboardTileListeners(); console.log("DEBUG: renderDashboardContent COMPLETE."); } // Needs setupDashboardTileListeners
function updateDashboard(client) { console.log("DEBUG: updateDashboard START - Client:", client ? client.name : 'None'); const logout = E('logout-btn'), content = E('module-content'), nameDisp = E('client-name-display'), desc = Q('.dashboard-description'), total = E('total-project-cost'); console.log(`DEBUG: Elements: logout=${!!logout}, content=${!!content}, name=${!!nameDisp}, desc=${!!desc}, total=${!!total}`); if (!content || !nameDisp || !desc || !logout || !total) { console.error("! Dashboard elements missing."); console.log("DEBUG: updateDashboard EXITING."); return; } if (client) { console.log("DEBUG: Client present."); nameDisp.textContent = `Client: ${client.name}`; desc.textContent = `${client.address || 'No address'}`; logout.style.display = 'inline-block'; const newLogout = logout.cloneNode(true); logout.parentNode.replaceChild(newLogout, logout); newLogout.addEventListener('click', () => window.ConstructionApp?.ModuleUtils?.logoutClient()); content.innerHTML = ''; console.log("DEBUG: Cleared #module-content."); console.log("DEBUG: Calling renderDashboardContent(client)..."); renderDashboardContent(client); console.log("DEBUG: Calling updateTotalProjectCost()..."); updateTotalProjectCost(); } else { console.log("DEBUG: No client."); nameDisp.textContent = ''; total.textContent = 'Total Project Cost: R0.00'; desc.textContent = 'Overview'; logout.style.display = 'none'; content.innerHTML = `<div class="no-client-notification" style="margin-bottom:20px;"><h2>No Client Selected</h2><p>Select or create client.</p></div>`; console.log("DEBUG: Set 'No Client' notification."); console.log("DEBUG: Calling renderDashboardContent(null)..."); renderDashboardContent(null); } window.ConstructionApp?.DebugPanel?.update(); console.log("DEBUG: updateDashboard COMPLETE."); } // Needs renderDashboardContent, updateTotalProjectCost, DebugPanel.update
function setupDashboardTileListeners() { const c = E('module-tiles'); if (!c) return; c.removeEventListener('click', handleTileClick); c.addEventListener('click', handleTileClick); } // Needs handleTileClick
function handleTileClick(e) { const o = e.target.closest('.module-open-btn'), c = e.target.closest('.clear-module-btn'), t = e.target.closest('.module-tile'); if (!t) return; const id = t.dataset.moduleId; if (!id) return; if (o && !o.disabled) window.ConstructionApp?.ModuleUtils?.navigateToModule(id); else if (c) { const info = appData.modules.find(m => m.id === id); const n = info ? info.name : id; if (confirm(`Clear data for "${n}"?`)) clearModuleData(id); } } // Needs clearModuleData
function clearModuleData(id) { const cli = window.ConstructionApp?.ClientManager?.getCurrentClient(); if (!cli) { window.ConstructionApp?.ModuleUtils?.showErrorMessage("No client."); return; } if (cli.moduleData?.[id]) { console.log(`Clearing ${id}`); window.ConstructionApp.ClientManager.saveModuleData(id, null, (ok, err) => { if (ok) { console.log("Cleared."); if (cli.moduleData) { delete cli.moduleData[id]; window.ConstructionApp.ClientManager.setCurrentClient({ ...cli }); } window.ConstructionApp?.ModuleUtils?.showSuccessMessage(`Cleared.`); } else { console.error(`Err: ${err}`); window.ConstructionApp?.ModuleUtils?.showErrorMessage(`Err: ${err}`); } }); } else window.ConstructionApp?.ModuleUtils?.showSuccessMessage(`No data.`); }
function updateTotalProjectCost() { let tot = 0; const cli = window.ConstructionApp?.ClientManager?.getCurrentClient(); if (cli?.moduleData) { Object.values(cli.moduleData).forEach(v => { const d = v?.data ?? v ?? {}; if (!d) return; let c = 0; if (d.totalCost !== undefined) c = parseFloat(d.totalCost) || 0; else if (d.items?.length > 0) c = window.ConstructionApp?.ModuleUtils?.calculateModuleTotal(d.items) ?? 0; tot += c; }); } const fmt = window.ConstructionApp?.ModuleUtils?.formatCurrency(tot) ?? `R${tot.toFixed(2)}`; const el = E('total-project-cost'); if (el) el.textContent = `Total: ${fmt}`; }

// --- Debug Panel --- (Functions REMOVED - moved to debug-panel.js)
// setupDebugPanel() -> MOVED
// toggleDebugPanel() -> MOVED
// updateDebugPanel() -> MOVED (but called by initApp and updateDashboard)
