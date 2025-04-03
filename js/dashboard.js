// js/dashboard.js
// Refactored: Client Modal functions moved to js/client-modals.js
// Sidebar search functions moved to js/sidebar-search.js
// Debug panel functions moved to js/debug-panel.js
// Exposes renderModuleList, createModuleElement, setupDragAndDrop globally.

// --- Global Variables ---
let appData = {
    modules: []
};
let globalDraggedItem = null;
let headerCollapseState = {};

// --- Global Namespace Setup ---
window.ConstructionApp = window.ConstructionApp || {};
window.ConstructionApp.DashboardUtils = window.ConstructionApp.DashboardUtils || {}; // Namespace for shared dashboard functions

// --- Initialization ---
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
        if (window.ConstructionApp?.ClientManager) {
            console.log("DEBUG: Setting ClientManager.onClientChanged callback to updateDashboard.");
            window.ConstructionApp.ClientManager.onClientChanged = updateDashboard;
        } else {
            console.error("[Dashboard] ClientManager not available! Cannot set callback.");
        }

        console.log("DEBUG: Calling initApp...");
        initApp();
        console.log("DEBUG: initApp COMPLETE.");

        // Setup other UI components by calling their setup functions
        setupDropdownMenus(); // Setup module item dropdowns/collapse

        // Call setup for client modals (function is now in client-modals.js)
        if (window.ConstructionApp?.ClientModals?.setup) {
             console.log("DEBUG: Calling ClientModals.setup...");
             window.ConstructionApp.ClientModals.setup(); // UPDATED CALL
        } else {
             console.warn("[Dashboard] ClientModals setup function not found.");
        }

        setupAddModuleButton(); // Setup add module button/modal

        // Call setup for sidebar search
        if (window.ConstructionApp?.SidebarSearch?.setup) {
             console.log("DEBUG: Calling SidebarSearch.setup...");
             window.ConstructionApp.SidebarSearch.setup();
        } else {
             console.warn("[Dashboard] SidebarSearch setup function not found.");
        }
        setupDragAndDrop(); // Setup sidebar drag/drop

        // Load client list asynchronously
        if (window.ConstructionApp?.ClientManager) {
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
            contentElement.innerHTML = `<div class="no-client-notification error"><h2>Error Loading Modules</h2><p>${error.message || 'Unknown error'}</p></div>`;
        }
    });
});

function initApp() {
    console.log("[Dashboard] Initializing app state");
    const navigationState = sessionStorage.getItem('navigationState');
    const storedClientStr = sessionStorage.getItem('currentClient');
    let clientToSet = null;
    console.log(`[Dashboard] Init: NavState='${navigationState}', StoredClient='${storedClientStr ? 'Exists' : 'None'}'`);
    if (navigationState === 'returningToDashboard' && storedClientStr) {
        try { clientToSet = JSON.parse(storedClientStr); console.log("[Dashboard] Restoring client (returning):", clientToSet?.name); }
        catch (e) { console.error("Error parsing stored client:", e); sessionStorage.removeItem('currentClient'); }
    } else if (navigationState === 'manualLogout' || navigationState === 'invalidAccess') {
        console.log("[Dashboard] Manual logout/invalid access."); clientToSet = null; sessionStorage.removeItem('currentClient');
    } else if (storedClientStr) {
        try { clientToSet = JSON.parse(storedClientStr); console.log("[Dashboard] Restoring client (fresh):", clientToSet?.name); }
        catch (e) { console.error("Error parsing stored client:", e); sessionStorage.removeItem('currentClient'); }
    } else { console.log("[Dashboard] No client in session."); }

    if (window.ConstructionApp?.ClientManager) {
        console.log("DEBUG: Calling ClientManager.setCurrentClient with client:", clientToSet ? clientToSet.name : 'None');
        window.ConstructionApp.ClientManager.setCurrentClient(clientToSet); // This triggers updateDashboard via callback
        console.log("DEBUG: ClientManager.setCurrentClient call complete.");
    } else { console.error("ClientManager unavailable!"); updateDashboard(clientToSet); }
    sessionStorage.removeItem('navigationState');
    window.ConstructionApp?.DebugPanel?.update();
}

// --- Module Loading and Rendering (Sidebar) ---
async function loadAndRenderModules() { /* ... Keep original (including adding Notes/Reports)... */
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
        id: 'notes', name: notesModuleData.name || 'Notes', requiresClient: notesModuleData.requiresClient !== undefined ? notesModuleData.requiresClient : true,
        type: notesModuleData.type || 'regular', parentId: notesModuleData.parentId !== undefined ? notesModuleData.parentId : null, order: -1,
    };
    loadedModules.unshift(notesModuleData);

    // Add 'Reports' module definition if missing
    const reportsModuleExists = loadedModules.some(m => m.id === 'reports');
    if (!reportsModuleExists) {
        console.log("[Dashboard] Adding 'Reports' module definition.");
        const reportsModuleData = { id: 'reports', name: 'Reports', requiresClient: false, type: 'regular', parentId: null, order: 99 };
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
        ...mod, parentId: (mod.parentId === 'null' || mod.parentId === undefined) ? null : mod.parentId, order: mod.order ?? 0,
        renderTemplate: mod.renderTemplate || function(client) { const d = client?.moduleData?.[mod.id]?.data || {}; return `<h3>${mod.name}</h3><pre>${JSON.stringify(d, null, 2)}</pre>`; },
        saveData: mod.saveData || function() { return {}; }
    }));

    // Render the sidebar list
    renderModuleList(appData.modules); // This function needs to be defined below
    console.log("[Dashboard] Module structure processed and sidebar rendered.");
}
function getDefaultModules() { /* ... Keep original ... */
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
function renderModuleList(modules) { /* ... Keep original ... */
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
window.ConstructionApp.DashboardUtils.renderModuleList = renderModuleList; // EXPOSE
function createModuleElement(moduleData, level = 0) { /* ... Keep original ... */
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
window.ConstructionApp.DashboardUtils.createModuleElement = createModuleElement; // EXPOSE

// --- Module Creation --- (Keep functions called by createModuleElement here for now)
function setupAddModuleButton() { /* ... Keep original ... */ }
function addNewModule() { /* ... Keep original ... */ }
function saveModuleStructure() { /* ... Keep original ... */ }
function restoreModuleOrderFromBackup() { /* ... Keep original ... */ }

// --- Drag and Drop (Sidebar Modules) --- (Keep functions called by renderModuleList here for now)
let dragOverElement = null; let dropIndicator = null;
function setupDragAndDrop() { /* ... Keep original ... */ }
window.ConstructionApp.DashboardUtils.setupDragAndDrop = setupDragAndDrop; // EXPOSE
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

// --- Client Management & Dashboard Update ---
const E = (id) => document.getElementById(id);
const Q = (sel) => document.querySelector(sel);
// (setupClientManagement function REMOVED - moved to client-modals.js)
// (createClientModal function REMOVED - moved to client-modals.js)
// (setupModalCloseButtons function REMOVED - moved to client-modals.js)
// (setupClientSearch function REMOVED - moved to client-modals.js)
// (setupClientListSelection function REMOVED - moved to client-modals.js)

// --- Dashboard Rendering & Update ---
function renderDashboardContent(client) { /* ... Keep original ... */ }
function updateDashboard(client) { /* ... Keep original ... */ }
function setupDashboardTileListeners() { /* ... Keep original ... */ }
function handleTileClick(e) { /* ... Keep original ... */ }
function clearModuleData(id) { /* ... Keep original ... */ }
function updateTotalProjectCost() { /* ... Keep original ... */ }

// --- Debug Panel --- (Functions REMOVED - moved to debug-panel.js)

