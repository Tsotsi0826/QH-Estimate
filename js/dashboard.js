// js/dashboard.js
// Slimmed down version: Debug panel functions moved to js/debug-panel.js

// --- Global Variables ---
// These need to remain accessible by other modules for now
let appData = {
    modules: [] // Holds the structure/definitions of all available modules
};
let globalDraggedItem = null; // Used for drag-and-drop
let headerCollapseState = {}; // Stores collapsed state for sidebar headers { headerId: true/false }

// --- Utility / Helper Functions ---

/**
 * Sets up the search input listener to filter modules in the sidebar.
 */
function setupModuleSearch() {
    const searchInput = document.getElementById('module-search-input');
    const container = document.getElementById('modules-container');
    if (!searchInput || !container) {
        console.error("[Dashboard] Search input or module container not found.");
        return;
    }

    let debounceTimer;

    // Debounce function to limit how often filtering runs during typing
    const debounceFilter = (func, delay) => {
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => func.apply(context, args), delay);
        };
    };

    // Filters modules based on search term
    const filterModules = () => {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const allModuleElements = container.querySelectorAll('.module-item');
        const visibleModuleIds = new Set(); // Keep track of modules (and their parents) that should be visible

        // If search is empty, show all modules
        if (searchTerm === '') {
            allModuleElements.forEach(moduleEl => {
                moduleEl.style.display = 'flex'; // Use 'flex' as per CSS
            });
            // Also ensure headers are correctly expanded/collapsed based on state
            renderModuleList(appData.modules); // Re-render to respect collapse state
            return;
        }

        // Find matching modules and their ancestors
        appData.modules.forEach(module => {
            const moduleName = module.name.toLowerCase();
            const isMatch = moduleName.includes(searchTerm);

            if (isMatch) {
                visibleModuleIds.add(module.id);
                // Add all parent headers to ensure the hierarchy is visible
                let currentParentId = module.parentId;
                while (currentParentId && currentParentId !== 'null') {
                    visibleModuleIds.add(currentParentId);
                    const parentModule = appData.modules.find(m => m.id === currentParentId);
                    currentParentId = parentModule ? parentModule.parentId : null;
                }
            }
        });

        // Show/hide modules based on whether they are in the visible set
        allModuleElements.forEach(moduleEl => { // Corrected typo from user code
            const moduleId = moduleEl.dataset.moduleId;
            if (visibleModuleIds.has(moduleId)) {
                moduleEl.style.display = 'flex';
                // Ensure parent headers are expanded if a child is visible
                const parentId = moduleEl.dataset.parentId;
                if (parentId && parentId !== 'null') {
                    const parentEl = container.querySelector(`.module-item[data-module-id="${parentId}"]`);
                    if (parentEl && parentEl.classList.contains('collapsed')) {
                        // Temporarily override collapse state for search visibility
                    }
                }
            } else {
                moduleEl.style.display = 'none';
            }
        });
    };

    // Attach the debounced filter function to the input event
    searchInput.addEventListener('input', debounceFilter(filterModules, 250));
}

// --- Initialization ---

/**
 * Main entry point when the DOM is ready.
 * Loads modules, initializes client state, sets up UI listeners.
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log("DEBUG: DOMContentLoaded event fired");
    console.log("[Dashboard] DOM loaded, initializing app");

    // Call setup for the debug panel (function is now in debug-panel.js)
    // Ensure DebugPanel object is available
    if (window.ConstructionApp?.DebugPanel?.setup) {
         window.ConstructionApp.DebugPanel.setup();
    } else {
         console.warn("[Dashboard] DebugPanel setup function not found.");
    }


    console.log("DEBUG: Calling loadAndRenderModules...");
    loadAndRenderModules().then(() => {
        console.log("DEBUG: loadAndRenderModules COMPLETE.");

        // --- FIX: Assign the callback BEFORE initApp is called ---
        if (window.ConstructionApp && window.ConstructionApp.ClientManager) {
            console.log("DEBUG: Setting ClientManager.onClientChanged callback to updateDashboard.");
            window.ConstructionApp.ClientManager.onClientChanged = updateDashboard; // Assign callback HERE
        } else {
            console.error("[Dashboard] ClientManager not available! Cannot set callback.");
        }
        // --- END FIX ---

        console.log("DEBUG: Calling initApp...");
        initApp(); // Determine initial client state (will now trigger the callback if ClientManager calls it)
        console.log("DEBUG: initApp COMPLETE.");

        // Setup other UI elements *after* initial state is set
        setupDropdownMenus();
        setupClientManagement();
        setupAddModuleButton();
        setupModuleSearch();
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
        order: -1, // Ensure it appears first or early
    };
    loadedModules.unshift(notesModuleData);

    // Add 'Reports' module definition if missing
    const reportsModuleExists = loadedModules.some(m => m.id === 'reports');
    if (!reportsModuleExists) {
        console.log("[Dashboard] Adding 'Reports' module definition.");
        const reportsModuleData = {
            id: 'reports', name: 'Reports', requiresClient: false, // Allows access without client
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
    // Make appData global if it needs to be accessed by debug-panel.js
    // window.appData = { modules: [] }; // Or attach to ConstructionApp namespace
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
    renderModuleList(appData.modules);
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
 */
function renderModuleList(modules) {
    const container = document.getElementById('modules-container');
    if (!container) { console.error("[Dashboard] Sidebar modules container not found."); return; }
    container.innerHTML = '';
    const sortedModules = [...modules].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.name.localeCompare(b.name));
    function renderLevel(parentId, level) {
        sortedModules.filter(m => m.parentId === parentId).forEach(module => {
            const moduleElement = createModuleElement(module, level);
            container.appendChild(moduleElement);
            const isHeader = module.type === 'header';
            const isCollapsed = headerCollapseState[module.id] === true;
            if (!isHeader || !isCollapsed) { renderLevel(module.id, level + 1); }
        });
    }
    renderLevel(null, 0);
    setupDragAndDrop();
}

/**
 * Creates a single module list item element for the sidebar.
 */
function createModuleElement(moduleData, level = 0) {
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
    if (icon) { icon.addEventListener('click', (e) => { e.stopPropagation(); const dropdown = icon.querySelector('.dropdown-menu'); if (dropdown) { const isVisible = dropdown.style.display === 'block'; closeAllDropdowns(); if (!isVisible) dropdown.style.display = 'block'; } }); }
    const editBtn = moduleElement.querySelector('.edit-module');
    if (editBtn) { editBtn.addEventListener('click', (e) => { e.stopPropagation(); editModule(moduleElement); closeAllDropdowns(); }); }
    const deleteBtn = moduleElement.querySelector('.delete-module');
    if (deleteBtn) { deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteModule(moduleElement); closeAllDropdowns(); }); }
    const nameSpan = moduleElement.querySelector('.module-name');
    if (nameSpan) { nameSpan.addEventListener('click', () => { if (window.ConstructionApp?.ModuleUtils) window.ConstructionApp.ModuleUtils.navigateToModule(moduleData.id); else console.error("ModuleUtils not found!"); }); }
    return moduleElement;
}

// --- Module Creation --- (No changes needed here)
function setupAddModuleButton() {
    const addModuleBtn = document.getElementById('add-module-btn'); const modalOverlay = document.getElementById('add-module-modal-overlay'); const moduleTypeSelect = document.getElementById('new-module-type'); const parentHeaderGroup = document.getElementById('parent-header-group'); const parentHeaderSelect = document.getElementById('parent-header-select'); const saveNewModuleBtn = document.getElementById('save-new-module-btn'); const modalCloseBtns = modalOverlay?.querySelectorAll('.modal-close, .btn-cancel');
    if (!addModuleBtn || !modalOverlay || !moduleTypeSelect || !parentHeaderGroup || !parentHeaderSelect || !saveNewModuleBtn || !modalCloseBtns) { console.warn("! Add Module modal elements missing."); return; }
    addModuleBtn.addEventListener('click', () => { parentHeaderSelect.innerHTML = '<option value="null">(Top Level)</option>'; appData.modules.filter(m => m.type === 'header').sort((a, b) => a.name.localeCompare(b.name)).forEach(h => { const opt = document.createElement('option'); opt.value = h.id; opt.textContent = h.name; parentHeaderSelect.appendChild(opt); }); E('new-module-name').value = ''; moduleTypeSelect.value = 'regular'; parentHeaderGroup.style.display = 'block'; parentHeaderSelect.value = 'null'; E('new-module-requires-client').checked = true; modalOverlay.style.display = 'flex'; });
    moduleTypeSelect.addEventListener('change', function() { parentHeaderGroup.style.display = this.value === 'regular' ? 'block' : 'none'; if (this.value === 'header') parentHeaderSelect.value = 'null'; });
    modalCloseBtns.forEach(btn => { const newBtn = btn.cloneNode(true); btn.parentNode.replaceChild(newBtn, btn); newBtn.addEventListener('click', () => modalOverlay.style.display = 'none'); });
    modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) modalOverlay.style.display = 'none'; });
    const newSaveBtn = saveNewModuleBtn.cloneNode(true); saveNewModuleBtn.parentNode.replaceChild(newSaveBtn, saveNewModuleBtn); newSaveBtn.addEventListener('click', addNewModule);
}
function addNewModule() { const nameInput = E('new-module-name'), typeSelect = E('new-module-type'), parentSelect = E('parent-header-select'), reqClient = E('new-module-requires-client'); const name = nameInput.value.trim(), type = typeSelect.value, parentId = type === 'header' ? null : (parentSelect.value === 'null' ? null : parentSelect.value), requiresClient = reqClient.checked; if (!name) { alert("Name required."); nameInput.focus(); return; } const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''); if (!id) { alert("Invalid ID."); return; } if (appData.modules.some(m => m.id === id)) { alert(`ID "${id}" exists.`); return; } let order = 0; const siblings = appData.modules.filter(m => m.parentId === parentId); if (siblings.length > 0) order = Math.max(...siblings.map(m => m.order ?? -1)) + 1; const newMod = { id: id, name: name, requiresClient: requiresClient, type: type, parentId: parentId, order: order, renderTemplate: function(c){return `<h3>${name}</h3>`;}, saveData: function(){return {};} }; console.log("Adding:", newMod); appData.modules.push(newMod); renderModuleList(appData.modules); saveModuleStructure(); E('add-module-modal-overlay').style.display = 'none'; alert(`Module "${name}" created.`); } // Shortened E = getElementById

// --- Module Structure Saving --- (No changes needed here)
function saveModuleStructure() { console.log("Saving structure"); const modules = appData.modules.map(m => ({ id: m.id, name: m.name, requiresClient: m.requiresClient, type: m.type || 'regular', parentId: m.parentId, order: m.order ?? 0 })); if (window.ConstructionApp?.Firebase) window.ConstructionApp.Firebase.saveModules(modules).then(s => console.log(s ? "Structure saved." : "Save failed.")).catch(e => console.error("Save error:", e)).finally(() => { try { sessionStorage.setItem('moduleOrder', JSON.stringify(modules)); console.log("Backup saved."); } catch (se) { console.error("Backup error:", se); } }); else { console.warn("Firebase unavailable."); try { sessionStorage.setItem('moduleOrder', JSON.stringify(modules)); } catch (se) { console.error("Backup error:", se); } } }
function restoreModuleOrderFromBackup() { const saved = sessionStorage.getItem('moduleOrder'); if (saved) { try { const data = JSON.parse(saved); if (!Array.isArray(data)) throw new Error("Not array."); console.log("Restoring backup:", data.length); return data.map(m => ({ ...m, type: m.type || 'regular', parentId: (m.parentId === undefined || m.parentId === 'null') ? null : m.parentId, order: m.order ?? 0 })); } catch (e) { console.error("Backup parse error:", e); sessionStorage.removeItem('moduleOrder'); } } else console.warn("No backup found."); return null; }

// --- Drag and Drop (Sidebar Modules) --- (No changes needed here)
let dragOverElement = null; let dropIndicator = null;
function setupDragAndDrop() { const c = E('modules-container'); if (!c) return; c.removeEventListener('dragstart', handleDragStart); c.addEventListener('dragstart', handleDragStart); c.removeEventListener('dragover', handleDragOver); c.addEventListener('dragover', handleDragOver); c.removeEventListener('dragleave', handleDragLeave); c.addEventListener('dragleave', handleDragLeave); c.removeEventListener('drop', handleDrop); c.addEventListener('drop', handleDrop); c.removeEventListener('dragend', handleDragEnd); c.addEventListener('dragend', handleDragEnd); } function handleDragStart(e) { const t = e.target.closest('.module-item'); if (!t || !t.draggable) { e.preventDefault(); return; } globalDraggedItem = t; e.dataTransfer.setData('text/plain', t.dataset.moduleId); e.dataTransfer.effectAllowed = 'move'; setTimeout(() => { if (globalDraggedItem) globalDraggedItem.classList.add('dragging'); }, 0); } function handleDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; const t = e.target.closest('.module-item'); if (!t || t === globalDraggedItem) { clearDropIndicators(); dragOverElement = null; dropIndicator = null; return; } if (t !== dragOverElement) { clearDropIndicators(); dragOverElement = t; } const r = t.getBoundingClientRect(), y = e.clientY - r.top, h = r.height; const isH = t.dataset.moduleType === 'header', dType = globalDraggedItem?.dataset?.moduleType; const canDrop = isH && dType !== 'header'; const topT = h * 0.3, botT = h * 0.7; let cur = null; if (canDrop && y > topT && y < botT) cur = 'middle'; else if (y <= topT) cur = 'top'; else cur = 'bottom'; if (cur !== dropIndicator) { t.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-middle'); dropIndicator = cur; if (cur === 'middle') t.classList.add('drag-over-middle'); else if (cur === 'top') t.classList.add('drag-over-top'); else if (cur === 'bottom') t.classList.add('drag-over-bottom'); } } function handleDragLeave(e) { const t = e.target.closest('.module-item'); if (!t) return; const rel = e.relatedTarget ? e.relatedTarget.closest('.module-item') : null; if (t === dragOverElement && rel !== dragOverElement) if (!t.contains(e.relatedTarget)) { clearDropIndicators(t); dragOverElement = null; dropIndicator = null; } } function handleDrop(e) { e.preventDefault(); clearDropIndicators(); if (!globalDraggedItem || !dragOverElement || globalDraggedItem === dragOverElement || !dropIndicator) { if (globalDraggedItem) globalDraggedItem.classList.remove('dragging'); globalDraggedItem = null; dragOverElement = null; dropIndicator = null; return; } const dId = globalDraggedItem.dataset.moduleId, tId = dragOverElement.dataset.moduleId; const dIdx = appData.modules.findIndex(m => m.id === dId), tIdx = appData.modules.findIndex(m => m.id === tId); if (dIdx === -1 || tIdx === -1) { console.error("DnD Error"); if (globalDraggedItem) globalDraggedItem.classList.remove('dragging'); globalDraggedItem = null; dragOverElement = null; dropIndicator = null; return; } const dMod = appData.modules[dIdx], tMod = appData.modules[tIdx]; let newPId = null, pos = -1; if (dropIndicator === 'middle' && tMod.type === 'header') { newPId = tMod.id; const kids = appData.modules.filter(m => m.parentId === newPId); if (kids.length > 0) { const last = kids.sort((a,b) => (a.order ?? 0) - (b.order ?? 0)).pop(); const lastIdx = appData.modules.findIndex(m => m.id === last.id); pos = lastIdx + 1; } else pos = tIdx + 1; } else if (dropIndicator === 'bottom') { newPId = tMod.parentId; pos = tIdx + 1; } else { newPId = tMod.parentId; pos = tIdx; } dMod.parentId = newPId; appData.modules.splice(dIdx, 1); if (dIdx < pos) pos--; appData.modules.splice(pos, 0, dMod); recalculateModuleOrder(); renderModuleList(appData.modules); saveModuleStructure(); globalDraggedItem = null; dragOverElement = null; dropIndicator = null; } function handleDragEnd(e) { if (globalDraggedItem) globalDraggedItem.classList.remove('dragging'); clearDropIndicators(); globalDraggedItem = null; dragOverElement = null; dropIndicator = null; } function clearDropIndicators(el) { const sel = '.module-item.drag-over-top, .module-item.drag-over-bottom, .module-item.drag-over-middle'; const els = el ? [el] : document.querySelectorAll(sel); els.forEach(e => { if (e) e.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-middle'); }); } function recalculateModuleOrder() { const groups = {}; appData.modules.forEach(m => { const key = m.parentId === null ? 'null' : m.parentId; if (!groups[key]) groups[key] = []; groups[key].push(m); }); Object.values(groups).forEach(g => g.forEach((m, i) => m.order = i)); }

// --- Other UI Functions --- (No changes needed here)
function setupDropdownMenus() { document.removeEventListener('click', handleGlobalClickForDropdowns); document.addEventListener('click', handleGlobalClickForDropdowns); const c = E('modules-container'); if (c) { c.removeEventListener('click', handleMaybeCollapseToggle); c.addEventListener('click', handleMaybeCollapseToggle); } } function handleMaybeCollapseToggle(e) { const i = e.target.closest('.collapse-icon'), h = e.target.closest('.module-item.header-item'); if (h && (i || (!e.target.closest('.module-drag-handle') && !e.target.closest('.module-icon')))) { e.stopPropagation(); const id = h.dataset.moduleId; if (id) handleCollapseToggle(id); } } function handleCollapseToggle(id) { console.log("Toggling:", id); headerCollapseState[id] = !(headerCollapseState[id] === true); renderModuleList(appData.modules); } function handleGlobalClickForDropdowns(e) { if (!e.target.closest('.module-icon') && !e.target.closest('.dropdown-menu')) closeAllDropdowns(); } function closeAllDropdowns() { document.querySelectorAll('#modules-container .dropdown-menu').forEach(m => { if (m.style.display === 'block') m.style.display = 'none'; }); } function editModule(el) { const id = el?.dataset?.moduleId; if (!id) { alert("Error: No ID."); return; } const idx = appData.modules.findIndex(m => m.id === id); if (idx === -1) { alert(`Error: Not found.`); return; } const mod = appData.modules[idx], name = mod.name; const newName = prompt(`Edit name:`, name); if (newName && newName.trim() !== '' && newName.trim() !== name) { const final = newName.trim(); mod.name = final; const span = el.querySelector('.module-name'); if (span) span.textContent = final; else renderModuleList(appData.modules); saveModuleStructure(); alert(`Renamed to "${final}"`); } } function deleteModule(el) { const id = el?.dataset?.moduleId; if (!id || id === 'notes') { if(id==='notes') alert('Cannot delete.'); else alert("Error: No ID."); return; } const idx = appData.modules.findIndex(m => m.id === id); if (idx === -1) { alert(`Error: Not found.`); return; } const mod = appData.modules[idx], name = mod.name, isH = mod.type === 'header'; const kids = appData.modules.filter(m => m.parentId === id); let msg = `Delete "${name}"?`; if (isH && kids.length > 0) msg += `\n\nWARNING: Deletes ${kids.length} sub-modules.`; msg += `\n\nCannot undo.`; if (confirm(msg)) { const toDel = new Set([id]), q = [id]; while (q.length > 0) { const pId = q.shift(); appData.modules.forEach(m => { if (m.parentId === pId && !toDel.has(m.id)) { toDel.add(m.id); q.push(m.id); } }); } appData.modules = appData.modules.filter(m => !toDel.has(m.id)); recalculateModuleOrder(); renderModuleList(appData.modules); saveModuleStructure(); alert(`"${name}" ${toDel.size > 1 ? 'and descendants ' : ''}deleted.`); } }

// --- Client Management & Dashboard Update --- (No changes needed here)
const E = (id) => document.getElementById(id); // Define E globally or pass it around if needed
const Q = (sel) => document.querySelector(sel);
function setupClientManagement() { const n = E('new-client-btn'), o = E('open-client-btn'); let ov = E('client-modal-overlay'); if (!ov) { ov = document.createElement('div'); ov.className = 'modal-overlay'; ov.id = 'client-modal-overlay'; ov.style.display = 'none'; document.body.appendChild(ov); ov.addEventListener('click', (e) => { if (e.target === ov) ov.style.display = 'none'; }); } if (n) n.addEventListener('click', () => { const m = createClientModal('new'); ov.innerHTML = ''; ov.appendChild(m); ov.style.display = 'flex'; }); if (o) o.addEventListener('click', () => { const m = createClientModal('open'); ov.innerHTML = ''; ov.appendChild(m); ov.style.display = 'flex'; }); } function createClientModal(t) { const m = document.createElement('div'); m.className = 'modal'; const ovId = 'client-modal-overlay'; if (t === 'new') { m.innerHTML = `<div class="modal-header"><h2 class="modal-title">New Client</h2><span class="modal-close" data-modal-id="${ovId}">×</span></div><div class="modal-body"><div class="form-group"><label for="client-name">Name:</label><input type="text" id="client-name" class="form-control" required></div><div class="form-group"><label for="client-address">Address:</label><input type="text" id="client-address" class="form-control"></div></div><div class="modal-footer"><button class="btn btn-cancel" data-modal-id="${ovId}">Cancel</button><button class="btn btn-save" id="save-new-client-btn">Save</button></div>`; setTimeout(() => { setupModalCloseButtons(m, ovId); const s = m.querySelector('#save-new-client-btn'); if (s) s.addEventListener('click', () => { const nI = m.querySelector('#client-name'), aI = m.querySelector('#client-address'); const n = nI.value.trim(), a = aI.value.trim(); if (!n) { alert('Name required.'); nI.focus(); return; } const d = { name: n, address: a, moduleData: {} }; if (window.ConstructionApp?.ClientManager) window.ConstructionApp.ClientManager.addClient(d, (ok, r) => { if (ok) { window.ConstructionApp.ClientManager.setCurrentClient(r); updateDebugPanel(); alert(`Client "${n}" created.`); E(ovId).style.display = 'none'; } else alert(`Error: ${r||'Unknown'}`); }); else alert("Error: ClientManager unavailable."); }); }, 0); } else if (t === 'open') { const cs = window.ConstructionApp?.ClientManager?.getAllClients() || []; let list = ''; if (cs.length > 0) { cs.sort((a, b) => a.name.localeCompare(b.name)); list = cs.map(c => `<div class="client-list-item" data-client-id="${c.id}">${c.name}</div>`).join(''); } else list = '<div style="padding:15px; text-align:center; color:#666;">No clients.</div>'; m.innerHTML = `<div class="modal-header"><h2 class="modal-title">Open Client</h2><span class="modal-close" data-modal-id="${ovId}">×</span></div><div class="modal-body"><div class="form-group"><label for="client-search">Search:</label><input type="text" id="client-search" class="form-control" placeholder="Filter..."></div><div class="client-list">${list}</div></div><div class="modal-footer"><button class="btn btn-cancel" data-modal-id="${ovId}">Cancel</button></div>`; setTimeout(() => { setupModalCloseButtons(m, ovId); setupClientListSelection(m); setupClientSearch(m); }, 0); } return m; } function setupModalCloseButtons(m, ovId) { const b = m.querySelectorAll(`.modal-close[data-modal-id="${ovId}"], .btn-cancel[data-modal-id="${ovId}"]`); b.forEach(btn => { const n = btn.cloneNode(true); btn.parentNode.replaceChild(n, btn); n.addEventListener('click', () => { const ov = E(ovId); if (ov) ov.style.display = 'none'; }); }); } function setupClientSearch(m) { const i = m.querySelector('#client-search'), l = m.querySelector('.client-list'); if (i && l) i.addEventListener('input', () => { const s = i.value.toLowerCase().trim(); const items = l.querySelectorAll('.client-list-item'); items.forEach(it => { if (it.dataset.clientId) { const n = it.textContent.toLowerCase(); it.style.display = (s === '' || n.includes(s)) ? 'block' : 'none'; } }); }); } function setupClientListSelection(m) { const l = m.querySelector('.client-list'); if (!l) return; l.addEventListener('click', (e) => { const li = e.target.closest('.client-list-item'); if (li && li.dataset.clientId) { const id = li.dataset.clientId; const cs = window.ConstructionApp?.ClientManager?.getAllClients() || []; const sel = cs.find(c => c.id === id); if (sel) { if (window.ConstructionApp?.ClientManager) { window.ConstructionApp.ClientManager.setCurrentClient(sel); updateDebugPanel(); const ov = m.closest('.modal-overlay'); if (ov) ov.style.display = 'none'; alert(`Client "${sel.name}" selected.`); } else alert("Error: ClientManager unavailable."); } else alert("Error: Client data not found."); } }); }

// --- Dashboard Rendering & Update --- (Using "Show All Tiles" Approach)
function renderDashboardContent(client) { console.log("DEBUG: renderDashboardContent START. Client:", client ? client.name : 'None'); const cont = E('module-content'); if (!cont) { console.error("! #module-content not found"); return; } let tiles = ''; let any = false; if (appData.modules?.length > 0) { appData.modules.forEach(mod => { if (mod.type === 'header') return; any = true; const id = mod.id, name = mod.name; let modData = null, has = false; if (client?.moduleData) { const v = client.moduleData[id]; modData = v?.data ?? v ?? null; if (modData !== null) has = true; } let cost = 0; if (has) { if (modData.totalCost !== undefined) cost = parseFloat(modData.totalCost) || 0; else if (modData.items?.length > 0) cost = window.ConstructionApp?.ModuleUtils?.calculateModuleTotal(modData.items) ?? 0; else if (id === 'notes') cost = 0; } const fmtCost = window.ConstructionApp?.ModuleUtils?.formatCurrency(cost) ?? `R${cost.toFixed(2)}`; const clear = (has && id !== 'notes') ? `<button class="clear-module-btn" title="Clear">×</button>` : ''; const dis = (!client && mod.requiresClient) ? 'disabled title="Select client"' : ''; const open = `<button class="btn module-open-btn" style="margin-top:10px;" ${dis}>Open</button>`; let costHtml = ''; if (id === 'notes') costHtml = '<p style="font-size:0.9em;color:#666;margin-top:10px;">(No cost)</p>'; else { const noData = !has ? ' <small style="opacity:0.7;">(No data)</small>' : ''; costHtml = `<p class="module-tile-cost">${fmtCost}${noData}</p>`; } tiles += `<div class="module-tile ${!has ? 'no-client-data' : ''}" data-module-id="${id}">${clear}<h5>${name}</h5>${costHtml}${open}</div>`; }); } let wrap = `<div style="background-color:#f8f9fa; padding:15px; border-radius:5px; margin-bottom:10px;"><h4 style="margin-bottom:15px;">Modules</h4><div id="module-tiles">`; if (any) wrap += tiles; else wrap += `<div style="grid-column:1/-1; text-align:center; color:#666;"><p>No modules.</p></div>`; wrap += `</div></div>`; console.log("DEBUG: Updating #module-content..."); cont.innerHTML += wrap; console.log("DEBUG: #module-content update COMPLETE."); setupDashboardTileListeners(); console.log("DEBUG: renderDashboardContent COMPLETE."); }
function updateDashboard(client) { console.log("DEBUG: updateDashboard START - Client:", client ? client.name : 'None'); const logout = E('logout-btn'), content = E('module-content'), nameDisp = E('client-name-display'), desc = Q('.dashboard-description'), total = E('total-project-cost'); console.log(`DEBUG: Elements: logout=${!!logout}, content=${!!content}, name=${!!nameDisp}, desc=${!!desc}, total=${!!total}`); if (!content || !nameDisp || !desc || !logout || !total) { console.error("! Dashboard elements missing."); console.log("DEBUG: updateDashboard EXITING."); return; } if (client) { console.log("DEBUG: Client present."); nameDisp.textContent = `Client: ${client.name}`; desc.textContent = `${client.address || 'No address'}`; logout.style.display = 'inline-block'; const newOut = logout.cloneNode(true); logout.parentNode.replaceChild(newOut, logout); newOut.addEventListener('click', () => window.ConstructionApp?.ModuleUtils?.logoutClient()); content.innerHTML = ''; console.log("DEBUG: Cleared #module-content."); console.log("DEBUG: Calling renderDashboardContent(client)..."); renderDashboardContent(client); console.log("DEBUG: Calling updateTotalProjectCost()..."); updateTotalProjectCost(); } else { console.log("DEBUG: No client."); nameDisp.textContent = ''; total.textContent = 'Total Project Cost: R0.00'; desc.textContent = 'Overview'; logout.style.display = 'none'; content.innerHTML = `<div class="no-client-notification" style="margin-bottom:20px;"><h2>No Client Selected</h2><p>Select or create client.</p></div>`; console.log("DEBUG: Set 'No Client' notification."); console.log("DEBUG: Calling renderDashboardContent(null)..."); renderDashboardContent(null); } updateDebugPanel(); console.log("DEBUG: updateDashboard COMPLETE."); }
function setupDashboardTileListeners() { const c = E('module-tiles'); if (!c) return; c.removeEventListener('click', handleTileClick); c.addEventListener('click', handleTileClick); } function handleTileClick(e) { const o = e.target.closest('.module-open-btn'), c = e.target.closest('.clear-module-btn'), t = e.target.closest('.module-tile'); if (!t) return; const id = t.dataset.moduleId; if (!id) return; if (o && !o.disabled) window.ConstructionApp?.ModuleUtils?.navigateToModule(id); else if (c) { const info = appData.modules.find(m => m.id === id); const n = info ? info.name : id; if (confirm(`Clear data for "${n}"?`)) clearModuleData(id); } } function clearModuleData(id) { const cli = window.ConstructionApp?.ClientManager?.getCurrentClient(); if (!cli) { window.ConstructionApp?.ModuleUtils?.showErrorMessage("No client."); return; } if (cli.moduleData?.[id]) { console.log(`Clearing ${id}`); window.ConstructionApp.ClientManager.saveModuleData(id, null, (ok, err) => { if (ok) { console.log("Cleared."); if (cli.moduleData) { delete cli.moduleData[id]; window.ConstructionApp.ClientManager.setCurrentClient({ ...cli }); } window.ConstructionApp?.ModuleUtils?.showSuccessMessage(`Cleared.`); } else { console.error(`Err: ${err}`); window.ConstructionApp?.ModuleUtils?.showErrorMessage(`Err: ${err}`); } }); } else window.ConstructionApp?.ModuleUtils?.showSuccessMessage(`No data.`); } function updateTotalProjectCost() { let tot = 0; const cli = window.ConstructionApp?.ClientManager?.getCurrentClient(); if (cli?.moduleData) { Object.values(cli.moduleData).forEach(v => { const d = v?.data ?? v ?? {}; if (!d) return; let c = 0; if (d.totalCost !== undefined) c = parseFloat(d.totalCost) || 0; else if (d.items?.length > 0) c = window.ConstructionApp?.ModuleUtils?.calculateModuleTotal(d.items) ?? 0; tot += c; }); } const fmt = window.ConstructionApp?.ModuleUtils?.formatCurrency(tot) ?? `R${tot.toFixed(2)}`; const el = E('total-project-cost'); if (el) el.textContent = `Total: ${fmt}`; }

// --- Debug Panel ---
function setupDebugPanel() { const dp = E('debug-panel'); let btn = E('debug-toggle-btn'); if (!dp) return; if (!btn) { btn = document.createElement('button'); btn.textContent = 'Debug'; btn.id = 'debug-toggle-btn'; btn.style.cssText = `position:fixed; bottom:10px; right:10px; z-index:10000; padding:5px 10px; background:#333; color:white; border:none; border-radius:3px; cursor:pointer; opacity:0.8; font-size:12px;`; document.body.appendChild(btn); } btn.style.display = 'block'; btn.removeEventListener('click', toggleDebugPanel); btn.addEventListener('click', toggleDebugPanel); } function toggleDebugPanel() { const dp = E('debug-panel'), btn = E('debug-toggle-btn'); if (!dp || !btn) return; const vis = dp.style.display === 'block'; dp.style.display = vis ? 'none' : 'block'; btn.textContent = vis ? 'Debug' : 'Hide Debug'; if (!vis) updateDebugPanel(); } function updateDebugPanel() { const dp = E('debug-panel'); if (!dp || dp.style.display !== 'block') return; const nav = sessionStorage.getItem('navigationState'); const cli = window.ConstructionApp?.ClientManager?.getCurrentClient(); const sess = sessionStorage.getItem('currentClient'); const ord = sessionStorage.getItem('moduleOrder'); let sessP = null; try { sessP = JSON.parse(sess || 'null'); } catch(e){} let info = `<strong>Nav:</strong> ${nav||'N/A'}<br><strong>Client(Mgr):</strong> ${cli?cli.name:'N/A'}<br><strong>Client(Sess):</strong> ${sessP?'Yes':'No'}<br><hr><strong>Mods:</strong> ${appData.modules?.length||0}<br><strong>Backup:</strong> ${ord?'Yes':'No'}<br><strong>Collapse:</strong> ${JSON.stringify(headerCollapseState)}<hr>`; if (cli?.moduleData) { info += '<strong>Costs:</strong><br>'; let tot = 0; Object.entries(cli.moduleData).forEach(([id, v]) => { const d = v?.data ?? v ?? {}; let c = 0; if (d.totalCost !== undefined) c = d.totalCost; else if (d.items) c = window.ConstructionApp?.ModuleUtils?.calculateModuleTotal(d.items) ?? 0; tot += parseFloat(c) || 0; info += `- ${id}: ${window.ConstructionApp?.ModuleUtils?.formatCurrency(c) ?? 'N/A'}<br>`; }); info += `<strong>Total:</strong> ${window.ConstructionApp?.ModuleUtils?.formatCurrency(tot) ?? 'N/A'}<hr>`; } info += '<strong>Struct(Top 5):</strong><br><pre style="max-height:100px; overflow-y:auto; border:1px solid #555; padding:3px; font-size:10px;">'; info += JSON.stringify(appData.modules?.slice(0, 5).map(m => ({id:m.id, n:m.name, t:m.type, p:m.parentId, o:m.order})) || [], null, 1); info += '</pre>'; dp.innerHTML = info
