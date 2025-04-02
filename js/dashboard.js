// js/dashboard.js
// Fixed timing issue: Assign onClientChanged callback *before* calling initApp.
// Removed most extra debug logs, kept key ones for confirmation.

// --- Global Variables ---
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
        allModuleElements.forEach(moduleEl => {
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
    // console.log("[Dashboard] Module search listener attached."); // Less verbose
}


// --- Initialization ---

/**
 * Main entry point when the DOM is ready.
 * Loads modules, initializes client state, sets up UI listeners.
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log("DEBUG: DOMContentLoaded event fired");
    console.log("[Dashboard] DOM loaded, initializing app");
    setupDebugPanel(); // Setup debug panel first

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
            // Callback is already set above
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

    // Determine the client based on how the user arrived at the dashboard
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

    // Set the current client in the ClientManager
    // This should now trigger the onClientChanged callback (updateDashboard) because it was assigned earlier
    if (window.ConstructionApp && window.ConstructionApp.ClientManager) {
        console.log("DEBUG: Calling ClientManager.setCurrentClient with client:", clientToSet ? clientToSet.name : 'None');
        window.ConstructionApp.ClientManager.setCurrentClient(clientToSet);
        console.log("DEBUG: ClientManager.setCurrentClient call complete (callback should have been triggered).");
    } else {
         console.error("[Dashboard] ClientManager not available during initApp!");
         updateDashboard(clientToSet); // Attempt manual update as fallback
    }

    // Clean up navigation state flag after using it
    sessionStorage.removeItem('navigationState');
    console.log("[Dashboard] Cleared navigation state.");

    updateDebugPanel(); // Update debug info
}


// --- Module Loading and Rendering (Sidebar) ---

/**
 * Loads module definitions from Firebase, with fallbacks to sessionStorage backup or defaults.
 * Renders the initial module list in the sidebar.
 */
async function loadAndRenderModules() {
    console.log("[Dashboard] Loading and rendering modules structure");
    let loadedModules = [];

    // Try loading from Firebase first
    try {
        if (!window.ConstructionApp?.Firebase) throw new Error("Firebase module not available");
        loadedModules = await window.ConstructionApp.Firebase.loadModules();
        console.log("[Dashboard] Loaded modules from Firebase:", loadedModules?.length || 0);

        // Basic validation of loaded data
        if (!Array.isArray(loadedModules)) {
             console.warn("[Dashboard] Firebase loadModules did not return an array. Using backup/defaults.");
             loadedModules = []; // Reset to empty array
        }

        // If Firebase is empty or returned invalid data, try backup
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

    // Initialize all headers to be collapsed by default
    appData.modules.forEach(module => {
        if (module.type === 'header') {
            headerCollapseState[module.id] = true; // true means collapsed
        }
    });
    console.log("[Dashboard] Headers initialized to collapsed state:", headerCollapseState);

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
 * @param {Array} modules - The array of module objects from appData.
 */
function renderModuleList(modules) {
    const container = document.getElementById('modules-container');
    if (!container) {
        console.error("[Dashboard] Sidebar modules container not found.");
        return;
    }
    container.innerHTML = ''; // Clear existing list

    const sortedModules = [...modules].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.name.localeCompare(b.name));

    function renderLevel(parentId, level) {
        sortedModules
            .filter(m => m.parentId === parentId)
            .forEach(module => {
                const moduleElement = createModuleElement(module, level);
                container.appendChild(moduleElement);
                const isHeader = module.type === 'header';
                const isCollapsed = headerCollapseState[module.id] === true;
                if (!isHeader || !isCollapsed) {
                    renderLevel(module.id, level + 1);
                }
            });
    }
    renderLevel(null, 0);
    setupDragAndDrop();
}

/**
 * Creates a single module list item element for the sidebar.
 * @param {object} moduleData - The module object.
 * @param {number} level - The nesting level (0 for top-level).
 * @returns {HTMLElement} The created div element for the module item.
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
        if (isCollapsed) {
            moduleElement.classList.add('collapsed');
        }
        collapseIconHTML = `<span class="collapse-icon" title="Expand/Collapse">▼</span>`;
    }

    const configIcon = !moduleData.requiresClient ? ' <span title="Configuration Module" style="opacity: 0.7; margin-left: 5px;">⚙️</span>' : '';

    moduleElement.innerHTML = `
        <div class="module-drag-handle" title="Drag to reorder">≡</div>
        ${collapseIconHTML}
        <div class="module-icon" title="Actions">
            ...
            <div class="dropdown-menu">
                <div class="dropdown-item edit-module">Edit</div>
                <div class="dropdown-item delete-module">Delete</div>
            </div>
        </div>
        <span class="module-name">${moduleData.name}</span>
        ${configIcon}
    `;

    const icon = moduleElement.querySelector('.module-icon');
    if (icon) {
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = icon.querySelector('.dropdown-menu');
            if (dropdown) {
                const isVisible = dropdown.style.display === 'block';
                closeAllDropdowns();
                if (!isVisible) {
                    dropdown.style.display = 'block';
                }
            }
        });
    }

    const editBtn = moduleElement.querySelector('.edit-module');
    if (editBtn) {
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            editModule(moduleElement);
            closeAllDropdowns();
        });
    }

    const deleteBtn = moduleElement.querySelector('.delete-module');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteModule(moduleElement);
            closeAllDropdowns();
        });
    }

    const nameSpan = moduleElement.querySelector('.module-name');
    if (nameSpan) {
        nameSpan.addEventListener('click', () => {
            if (window.ConstructionApp && window.ConstructionApp.ModuleUtils) {
                window.ConstructionApp.ModuleUtils.navigateToModule(moduleData.id);
            } else {
                console.error("ModuleUtils not available for navigation!");
            }
        });
    }

    return moduleElement;
}


// --- Module Creation ---

/**
 * Sets up the "Add New Module" button and the associated modal dialog.
 */
function setupAddModuleButton() {
    const addModuleBtn = document.getElementById('add-module-btn');
    const modalOverlay = document.getElementById('add-module-modal-overlay');
    const moduleTypeSelect = document.getElementById('new-module-type');
    const parentHeaderGroup = document.getElementById('parent-header-group');
    const parentHeaderSelect = document.getElementById('parent-header-select');
    const saveNewModuleBtn = document.getElementById('save-new-module-btn');
    const modalCloseBtns = modalOverlay?.querySelectorAll('.modal-close, .btn-cancel');

    if (!addModuleBtn || !modalOverlay || !moduleTypeSelect || !parentHeaderGroup || !parentHeaderSelect || !saveNewModuleBtn || !modalCloseBtns) {
        console.warn("[Dashboard] One or more elements for 'Add Module' modal not found.");
        return;
    }

    addModuleBtn.addEventListener('click', () => {
        parentHeaderSelect.innerHTML = '<option value="null">(Top Level / No Parent)</option>';
        appData.modules
            .filter(m => m.type === 'header')
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(header => {
                const option = document.createElement('option');
                option.value = header.id;
                option.textContent = header.name;
                parentHeaderSelect.appendChild(option);
            });
        document.getElementById('new-module-name').value = '';
        moduleTypeSelect.value = 'regular';
        parentHeaderGroup.style.display = 'block';
        parentHeaderSelect.value = 'null';
        document.getElementById('new-module-requires-client').checked = true;
        modalOverlay.style.display = 'flex';
    });

    moduleTypeSelect.addEventListener('change', function() {
        parentHeaderGroup.style.display = this.value === 'regular' ? 'block' : 'none';
        if (this.value === 'header') {
             parentHeaderSelect.value = 'null';
        }
    });

    modalCloseBtns.forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', () => modalOverlay.style.display = 'none');
    });

    modalOverlay.addEventListener('click', (event) => {
        if (event.target === modalOverlay) {
            modalOverlay.style.display = 'none';
        }
    });

    const newSaveBtn = saveNewModuleBtn.cloneNode(true);
    saveNewModuleBtn.parentNode.replaceChild(newSaveBtn, saveNewModuleBtn);
    newSaveBtn.addEventListener('click', addNewModule);

    // console.log("[Dashboard] 'Add Module' button and modal setup complete."); // Less verbose
}

/**
 * Handles the creation of a new module based on modal input.
 */
function addNewModule() {
    const moduleNameInput = document.getElementById('new-module-name');
    const moduleTypeSelect = document.getElementById('new-module-type');
    const parentHeaderSelect = document.getElementById('parent-header-select');
    const requiresClientCheckbox = document.getElementById('new-module-requires-client');

    const moduleName = moduleNameInput.value.trim();
    const moduleType = moduleTypeSelect.value;
    const parentId = moduleType === 'header' ? null : (parentHeaderSelect.value === 'null' ? null : parentHeaderSelect.value);
    const requiresClient = requiresClientCheckbox.checked;

    if (!moduleName) {
        alert("Module name is required.");
        moduleNameInput.focus();
        return;
    }

    const moduleId = moduleName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!moduleId) {
         alert("Could not generate a valid ID from the module name.");
         return;
    }

    if (appData.modules.some(m => m.id === moduleId)) {
        alert(`Module ID "${moduleId}" already exists or is invalid. Please choose a different name.`);
        return;
    }

    let order = 0;
    const siblings = appData.modules.filter(m => m.parentId === parentId);
    if (siblings.length > 0) {
        order = Math.max(...siblings.map(m => m.order ?? -1)) + 1;
    }

    const newModuleData = {
        id: moduleId,
        name: moduleName,
        requiresClient: requiresClient,
        type: moduleType,
        parentId: parentId,
        order: order,
        renderTemplate: function(client) { return `<h3>${moduleName}</h3><p>Default content.</p>`; },
        saveData: function() { return {}; }
    };

    console.log("[Dashboard] Adding new module:", newModuleData);

    appData.modules.push(newModuleData);
    
    // If it's a header, set it to be collapsed by default
    if (moduleType === 'header') {
        headerCollapseState[moduleId] = true;
    }
    
    renderModuleList(appData.modules);
    saveModuleStructure();

    document.getElementById('add-module-modal-overlay').style.display = 'none';
    alert(`Module "${moduleName}" created successfully.`);
}


// --- Module Structure Saving ---

/**
 * Saves the current module structure (order, hierarchy, basic info)
 * to Firebase and creates a backup in sessionStorage.
 */
function saveModuleStructure() {
    console.log("[Dashboard] Saving module structure");

    const modulesToSave = appData.modules.map(module => ({
        id: module.id,
        name: module.name,
        requiresClient: module.requiresClient,
        type: module.type || 'regular',
        parentId: module.parentId,
        order: module.order ?? 0
    }));

    console.log("[Dashboard] Modules prepared for saving:", modulesToSave.length);

    if (window.ConstructionApp && window.ConstructionApp.Firebase) {
        window.ConstructionApp.Firebase.saveModules(modulesToSave)
            .then(success => {
                if (success) {
                    console.log("[Dashboard] Module structure saved to Firebase.");
                } else {
                    console.warn("[Dashboard] Firebase.saveModules reported failure (but promise resolved).");
                }
            })
            .catch(error => {
                console.error("[Dashboard] Error saving module structure to Firebase:", error);
            })
            .finally(() => {
                 try {
                     sessionStorage.setItem('moduleOrder', JSON.stringify(modulesToSave));
                     console.log("[Dashboard] Module structure backup saved to sessionStorage.");
                 } catch (storageError) {
                      console.error("[Dashboard] Error saving structure backup to sessionStorage:", storageError);
                 }
            });
    } else {
        console.warn("[Dashboard] Firebase not available, saving structure to sessionStorage only");
         try {
             sessionStorage.setItem('moduleOrder', JSON.stringify(modulesToSave));
         } catch (storageError) {
              console.error("[Dashboard] Error saving structure backup to sessionStorage:", storageError);
         }
    }
}

/**
 * Restores the module structure from the sessionStorage backup.
 * @returns {Array|null} The restored module array or null if backup is invalid/missing.
 */
function restoreModuleOrderFromBackup() {
    const savedOrder = sessionStorage.getItem('moduleOrder');
    if (savedOrder) {
        try {
            const orderData = JSON.parse(savedOrder);
            if (!Array.isArray(orderData)) {
                 throw new Error("Backup data is not an array.");
            }
            console.log("[Dashboard] Restoring structure from backup:", orderData.length, "modules");
            return orderData.map(mod => ({
                ...mod,
                type: mod.type || 'regular',
                parentId: (mod.parentId === undefined || mod.parentId === 'null') ? null : mod.parentId,
                order: mod.order ?? 0
            }));
        } catch (error) {
            console.error("[Dashboard] Error parsing module structure backup:", error);
            sessionStorage.removeItem('moduleOrder');
        }
    } else {
        console.warn("[Dashboard] No module structure backup found in sessionStorage.");
    }
    return null;
}


// --- Drag and Drop (Sidebar Modules) ---

let dragOverElement = null;
let dropIndicator = null;

function setupDragAndDrop() {
    const container = document.getElementById('modules-container');
    if (!container) return;
    container.removeEventListener('dragstart', handleDragStart);
    container.removeEventListener('dragover', handleDragOver);
    container.removeEventListener('dragleave', handleDragLeave);
    container.removeEventListener('drop', handleDrop);
    container.removeEventListener('dragend', handleDragEnd);
    container.addEventListener('dragstart', handleDragStart);
    container.addEventListener('dragover', handleDragOver);
    container.addEventListener('dragleave', handleDragLeave);
    container.addEventListener('drop', handleDrop);
    container.addEventListener('dragend', handleDragEnd);
}

function handleDragStart(e) {
    const target = e.target.closest('.module-item');
    if (!target || !target.draggable) {
        e.preventDefault();
        return;
    }
    globalDraggedItem = target;
    e.dataTransfer.setData('text/plain', target.dataset.moduleId);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
        if (globalDraggedItem) globalDraggedItem.classList.add('dragging');
    }, 0);
    // console.log("[Dashboard] Drag Start:", target.dataset.moduleId); // Less verbose
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const targetElement = e.target.closest('.module-item');
    if (!targetElement || targetElement === globalDraggedItem) {
        clearDropIndicators();
        dragOverElement = null;
        dropIndicator = null;
        return;
    }
    if (targetElement !== dragOverElement) {
        clearDropIndicators();
        dragOverElement = targetElement;
    }
    const rect = targetElement.getBoundingClientRect();
    const yOffset = e.clientY - rect.top;
    const dropZoneHeight = rect.height;
    const targetIsHeader = targetElement.dataset.moduleType === 'header';
    const draggedItemType = globalDraggedItem?.dataset?.moduleType;
    const canDropOnHeader = targetIsHeader && draggedItemType !== 'header';
    const topThreshold = dropZoneHeight * 0.3;
    const bottomThreshold = dropZoneHeight * 0.7;
    let currentIndicator = null;
    if (canDropOnHeader && yOffset > topThreshold && yOffset < bottomThreshold) {
        currentIndicator = 'middle';
    } else if (yOffset <= topThreshold) {
        currentIndicator = 'top';
    } else {
        currentIndicator = 'bottom';
    }
    if (currentIndicator !== dropIndicator) {
        targetElement.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-middle');
        dropIndicator = currentIndicator;
        if (dropIndicator === 'middle') targetElement.
