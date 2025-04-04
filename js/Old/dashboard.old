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
        if (dropIndicator === 'middle') targetElement.classList.add('drag-over-middle');
        else if (dropIndicator === 'top') targetElement.classList.add('drag-over-top');
        else if (dropIndicator === 'bottom') targetElement.classList.add('drag-over-bottom');
    }
}

function handleDragLeave(e) {
    const targetElement = e.target.closest('.module-item');
    if (!targetElement) return;
    const relatedTarget = e.relatedTarget ? e.relatedTarget.closest('.module-item') : null;
    if (targetElement === dragOverElement && relatedTarget !== dragOverElement) {
        if (!targetElement.contains(e.relatedTarget)) {
             clearDropIndicators(targetElement);
             dragOverElement = null;
             dropIndicator = null;
        }
    }
}

function handleDrop(e) {
    e.preventDefault();
    clearDropIndicators();
    if (!globalDraggedItem || !dragOverElement || globalDraggedItem === dragOverElement || !dropIndicator) {
        if (globalDraggedItem) globalDraggedItem.classList.remove('dragging');
        globalDraggedItem = null;
        dragOverElement = null;
        dropIndicator = null;
        return;
    }
    // console.log(`[Dashboard] Drop: ${globalDraggedItem.dataset.moduleId} onto ${dragOverElement.dataset.moduleId}, Indicator: ${dropIndicator}`); // Less verbose
    const draggedId = globalDraggedItem.dataset.moduleId;
    const targetId = dragOverElement.dataset.moduleId;
    const draggedModuleIndex = appData.modules.findIndex(m => m.id === draggedId);
    const targetModuleIndex = appData.modules.findIndex(m => m.id === targetId);
    if (draggedModuleIndex === -1 || targetModuleIndex === -1) {
        console.error("[Dashboard] DnD Error: Dragged or target module not found in appData.");
        if (globalDraggedItem) globalDraggedItem.classList.remove('dragging');
        globalDraggedItem = null;
        dragOverElement = null;
        dropIndicator = null;
        return;
    }
    const draggedModule = appData.modules[draggedModuleIndex];
    const targetModule = appData.modules[targetModuleIndex];
    let newParentId = null;
    let targetPositionInArray = -1;
    if (dropIndicator === 'middle' && targetModule.type === 'header') {
        newParentId = targetModule.id;
         const children = appData.modules.filter(m => m.parentId === newParentId);
         if (children.length > 0) {
              const lastChild = children.sort((a,b) => (a.order ?? 0) - (b.order ?? 0)).pop();
              const lastChildIndex = appData.modules.findIndex(m => m.id === lastChild.id);
              targetPositionInArray = lastChildIndex + 1;
         } else {
              targetPositionInArray = targetModuleIndex + 1;
         }
    } else if (dropIndicator === 'bottom') {
        newParentId = targetModule.parentId;
        targetPositionInArray = targetModuleIndex + 1;
    } else { // dropIndicator === 'top'
        newParentId = targetModule.parentId;
        targetPositionInArray = targetModuleIndex;
    }
    draggedModule.parentId = newParentId;
    appData.modules.splice(draggedModuleIndex, 1);
    if (draggedModuleIndex < targetPositionInArray) {
        targetPositionInArray--;
    }
    appData.modules.splice(targetPositionInArray, 0, draggedModule);
    recalculateModuleOrder();
    renderModuleList(appData.modules);
    saveModuleStructure();
    globalDraggedItem = null;
    dragOverElement = null;
    dropIndicator = null;
}

function handleDragEnd(e) {
    if (globalDraggedItem) {
        globalDraggedItem.classList.remove('dragging');
    }
    clearDropIndicators();
    globalDraggedItem = null;
    dragOverElement = null;
    dropIndicator = null;
    // console.log("[Dashboard] Drag End"); // Less verbose
}

function clearDropIndicators(element) {
    const selector = '.module-item.drag-over-top, .module-item.drag-over-bottom, .module-item.drag-over-middle';
    const elementsToClear = element ? [element] : document.querySelectorAll(selector);
    elementsToClear.forEach(el => {
        if (el) {
            el.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-middle');
        }
    });
}

function recalculateModuleOrder() {
    // console.log("[Dashboard] Recalculating module order..."); // Less verbose
    const modulesByParent = {};
    appData.modules.forEach(module => {
        const parentKey = module.parentId === null ? 'null' : module.parentId;
        if (!modulesByParent[parentKey]) {
            modulesByParent[parentKey] = [];
        }
        modulesByParent[parentKey].push(module);
    });
    Object.values(modulesByParent).forEach(group => {
        group.forEach((module, index) => {
            module.order = index;
        });
    });
    // console.log("[Dashboard] Order recalculation complete."); // Less verbose
}


// --- Other UI Functions ---

function setupDropdownMenus() {
    document.removeEventListener('click', handleGlobalClickForDropdowns);
    document.addEventListener('click', handleGlobalClickForDropdowns);
    // console.log("[Dashboard] Global dropdown close listener attached."); // Less verbose
    const container = document.getElementById('modules-container');
     if (container) {
          container.removeEventListener('click', handleMaybeCollapseToggle);
          container.addEventListener('click', handleMaybeCollapseToggle);
          // console.log("[Dashboard] Collapse toggle listener attached via delegation."); // Less verbose
     }
}

function handleMaybeCollapseToggle(e) {
    const collapseIcon = e.target.closest('.collapse-icon');
    const headerItem = e.target.closest('.module-item.header-item');
    if (headerItem && (collapseIcon || (!e.target.closest('.module-drag-handle') && !e.target.closest('.module-icon')))) {
        e.stopPropagation();
        const moduleId = headerItem.dataset.moduleId;
        if (moduleId) {
            handleCollapseToggle(moduleId);
        }
    }
}

function handleCollapseToggle(headerModuleId) {
    console.log("[Dashboard] Toggling collapse for header:", headerModuleId);
    headerCollapseState[headerModuleId] = !(headerCollapseState[headerModuleId] === true);
    renderModuleList(appData.modules);
}

function handleGlobalClickForDropdowns(e) {
    if (!e.target.closest('.module-icon') && !e.target.closest('.dropdown-menu')) {
        closeAllDropdowns();
    }
}

function closeAllDropdowns() {
    document.querySelectorAll('#modules-container .dropdown-menu').forEach(menu => {
        if (menu.style.display === 'block') {
            menu.style.display = 'none';
        }
    });
}

function editModule(moduleElement) {
    const moduleId = moduleElement?.dataset?.moduleId;
    if (!moduleId) {
        console.error("[Dashboard] Edit Error: Could not get module ID from element.");
        alert("Error: Could not identify the module to edit.");
        return;
    }
    const moduleIndex = appData.modules.findIndex(m => m.id === moduleId);
    if (moduleIndex === -1) {
        console.error("[Dashboard] Edit Error: Module not found in appData:", moduleId);
        alert(`Error: Module "${moduleId}" not found.`);
        return;
    }
    const currentModule = appData.modules[moduleIndex];
    const currentName = currentModule.name;
    const newName = prompt(`Edit module name:`, currentName);
    if (newName && newName.trim() !== '' && newName.trim() !== currentName) {
        const finalNewName = newName.trim();
        console.log(`[Dashboard] Renaming module ${moduleId} to "${finalNewName}"`);
        currentModule.name = finalNewName;
        const nameSpan = moduleElement.querySelector('.module-name');
        if (nameSpan) {
            nameSpan.textContent = finalNewName;
        } else {
             renderModuleList(appData.modules); // Re-render if UI update fails
        }
        saveModuleStructure();
        alert(`Module renamed to "${finalNewName}"`);
    } else {
        // console.log("[Dashboard] Module rename cancelled or name unchanged."); // Less verbose
    }
}

function deleteModule(moduleElement) {
    const moduleId = moduleElement?.dataset?.moduleId;
    if (!moduleId || moduleId === 'notes') {
        if (moduleId === 'notes') alert('The Notes module cannot be deleted.');
        else alert("Error: Could not identify the module to delete.");
        return;
    }
    const moduleIndex = appData.modules.findIndex(m => m.id === moduleId);
    if (moduleIndex === -1) {
        alert(`Error: Module "${moduleId}" not found.`);
        return;
    }
    const moduleToDelete = appData.modules[moduleIndex];
    const moduleName = moduleToDelete.name;
    const isHeader = moduleToDelete.type === 'header';
    const directChildren = appData.modules.filter(m => m.parentId === moduleId);
    let confirmMessage = `Are you sure you want to delete the "${moduleName}" module?`;
    if (isHeader && directChildren.length > 0) {
        confirmMessage += `\n\nWARNING: This is a header with ${directChildren.length} direct sub-module(s). Deleting it will also delete ALL descendants.`;
    }
    confirmMessage += `\n\nThis action cannot be undone.`;
    const confirmed = confirm(confirmMessage);
    if (confirmed) {
        console.log(`[Dashboard] Deleting module ${moduleId} (${moduleName}) and descendants.`);
        const idsToDelete = new Set([moduleId]);
        const queue = [moduleId];
        while (queue.length > 0) {
            const currentParentId = queue.shift();
            appData.modules.forEach(module => {
                if (module.parentId === currentParentId && !idsToDelete.has(module.id)) {
                    idsToDelete.add(module.id);
                    queue.push(module.id);
                }
            });
        }
        appData.modules = appData.modules.filter(module => !idsToDelete.has(module.id));
        console.log("[Dashboard] Modules filtered. Remaining:", appData.modules.length);
        recalculateModuleOrder();
        renderModuleList(appData.modules);
        saveModuleStructure();
        alert(`Module "${moduleName}" ${idsToDelete.size > 1 ? 'and its descendants ' : ''}deleted successfully.`);
    } else {
        // console.log("[Dashboard] Module deletion cancelled."); // Less verbose
    }
}


// --- Client Management & Dashboard Update ---

function setupClientManagement() {
    // console.log("[Dashboard] Setting up client management buttons"); // Less verbose
    const newClientBtn = document.getElementById('new-client-btn');
    const openClientBtn = document.getElementById('open-client-btn');
    let clientModalOverlay = document.getElementById('client-modal-overlay');
    if (!clientModalOverlay) {
        console.warn("[Dashboard] Client modal overlay not found, creating it.");
        clientModalOverlay = document.createElement('div');
        clientModalOverlay.className = 'modal-overlay';
        clientModalOverlay.id = 'client-modal-overlay';
        clientModalOverlay.style.display = 'none';
        document.body.appendChild(clientModalOverlay);
        clientModalOverlay.addEventListener('click', (event) => {
            if (event.target === clientModalOverlay) {
                clientModalOverlay.style.display = 'none';
            }
        });
    }
    if (newClientBtn) {
        newClientBtn.addEventListener('click', () => {
            const clientModal = createClientModal('new');
            clientModalOverlay.innerHTML = '';
            clientModalOverlay.appendChild(clientModal);
            clientModalOverlay.style.display = 'flex';
        });
    }
    if (openClientBtn) {
        openClientBtn.addEventListener('click', () => {
            const clientModal = createClientModal('open');
            clientModalOverlay.innerHTML = '';
            clientModalOverlay.appendChild(clientModal);
            clientModalOverlay.style.display = 'flex';
        });
    }
}

function createClientModal(type) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    const overlayId = 'client-modal-overlay';
    if (type === 'new') {
        modal.innerHTML = `
            <div class="modal-header"><h2 class="modal-title">New Client</h2><span class="modal-close" data-modal-id="${overlayId}">&times;</span></div>
            <div class="modal-body">
                <div class="form-group"><label for="client-name">Client Name:</label><input type="text" id="client-name" class="form-control" required></div>
                <div class="form-group"><label for="client-address">Client Address:</label><input type="text" id="client-address" class="form-control"></div>
            </div>
            <div class="modal-footer"><button class="btn btn-cancel" data-modal-id="${overlayId}">Cancel</button><button class="btn btn-save" id="save-new-client-btn">Save Client</button></div>`;
        setTimeout(() => {
            setupModalCloseButtons(modal, overlayId);
            const saveBtn = modal.querySelector('#save-new-client-btn');
            if (saveBtn) {
                saveBtn.addEventListener('click', () => {
                    const nameInput = modal.querySelector('#client-name');
                    const addressInput = modal.querySelector('#client-address');
                    const name = nameInput.value.trim();
                    const address = addressInput.value.trim();
                    if (!name) { alert('Client name is required.'); nameInput.focus(); return; }
                    const newClientData = { name: name, address: address, moduleData: {} };
                    if (window.ConstructionApp && window.ConstructionApp.ClientManager) {
                        window.ConstructionApp.ClientManager.addClient(newClientData, (success, result) => {
                             if (success) {
                                  const addedClient = result;
                                  window.ConstructionApp.ClientManager.setCurrentClient(addedClient);
                                  updateDebugPanel();
                                  alert(`Client "${name}" created and selected.`);
                                  document.getElementById(overlayId).style.display = 'none';
                             } else {
                                  alert(`Error creating client: ${result || 'Unknown error'}`);
                             }
                        });
                    } else { alert("Error: ClientManager is not available."); }
                });
            }
        }, 0);
    } else if (type === 'open') {
        const clients = window.ConstructionApp?.ClientManager?.getAllClients() || [];
        let clientListHTML = '';
        if (clients.length > 0) {
            clients.sort((a, b) => a.name.localeCompare(b.name));
            clientListHTML = clients.map(client => `<div class="client-list-item" data-client-id="${client.id}">${client.name}</div>`).join('');
        } else {
            clientListHTML = '<div style="padding: 15px; text-align: center; color: #666;">No existing clients found.</div>';
        }
        modal.innerHTML = `
            <div class="modal-header"><h2 class="modal-title">Open Client</h2><span class="modal-close" data-modal-id="${overlayId}">&times;</span></div>
            <div class="modal-body">
                <div class="form-group"><label for="client-search">Search Clients:</label><input type="text" id="client-search" class="form-control" placeholder="Type to filter..."></div>
                <div class="client-list">${clientListHTML}</div>
            </div>
            <div class="modal-footer"><button class="btn btn-cancel" data-modal-id="${overlayId}">Cancel</button></div>`;
        setTimeout(() => {
            setupModalCloseButtons(modal, overlayId);
            setupClientListSelection(modal);
            setupClientSearch(modal);
        }, 0);
    }
    return modal;
}

function setupModalCloseButtons(modal, overlayId) {
    const closeBtns = modal.querySelectorAll(`.modal-close[data-modal-id="${overlayId}"], .btn-cancel[data-modal-id="${overlayId}"]`);
    closeBtns.forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', () => {
            const overlay = document.getElementById(overlayId);
            if (overlay) overlay.style.display = 'none';
        });
    });
}

function setupClientSearch(modal) {
    const searchInput = modal.querySelector('#client-search');
    const clientListContainer = modal.querySelector('.client-list');
    if (searchInput && clientListContainer) {
        searchInput.addEventListener('input', () => {
            const searchTerm = searchInput.value.toLowerCase().trim();
            const clientItems = clientListContainer.querySelectorAll('.client-list-item');
            clientItems.forEach(item => {
                if (item.dataset.clientId) {
                    const clientName = item.textContent.toLowerCase();
                    item.style.display = (searchTerm === '' || clientName.includes(searchTerm)) ? 'block' : 'none';
                }
            });
        });
    }
}

function setupClientListSelection(modal) {
    const clientListContainer = modal.querySelector('.client-list');
    if (!clientListContainer) return;
    clientListContainer.addEventListener('click', (event) => {
        const listItem = event.target.closest('.client-list-item');
        if (listItem && listItem.dataset.clientId) {
            const clientId = listItem.dataset.clientId;
            const clients = window.ConstructionApp?.ClientManager?.getAllClients() || [];
            const selectedClient = clients.find(c => c.id === clientId);
            if (selectedClient) {
                 if (window.ConstructionApp && window.ConstructionApp.ClientManager) {
                      window.ConstructionApp.ClientManager.setCurrentClient(selectedClient);
                      updateDebugPanel();
                      const overlay = modal.closest('.modal-overlay');
                      if (overlay) overlay.style.display = 'none';
                      alert(`Client "${selectedClient.name}" selected.`);
                 } else { alert("Error: ClientManager not available."); }
            } else { alert("Error: Could not find the selected client's data."); }
        }
    });
}


// =========================================================================
// == DASHBOARD CONTENT RENDERING & UPDATE (Using "Show All Tiles" Approach) ==
// =========================================================================

/**
 * Render dashboard content (module tiles) - Shows tiles for all non-header modules.
 * @param {object|null} client - The current client object, or null if no client is selected.
 */
function renderDashboardContent(client) {
    console.log("DEBUG: renderDashboardContent START. Client:", client ? client.name : 'None');
    const contentElement = document.getElementById('module-content');
    if (!contentElement) {
        console.error("[Dashboard] Main content element #module-content not found!");
        return;
    }

    let tilesHTML = '';
    let hasAnyTiles = false;

    if (appData.modules && Array.isArray(appData.modules) && appData.modules.length > 0) {
        appData.modules.forEach(module => {
            if (module.type === 'header') {
                return;
            }
            hasAnyTiles = true;
            const moduleId = module.id;
            const moduleName = module.name;
            let clientModuleData = null;
            let hasData = false;
            if (client && client.moduleData) {
                 const clientModuleVersionedData = client.moduleData[moduleId];
                 clientModuleData = clientModuleVersionedData?.data ?? clientModuleVersionedData ?? null;
                 if (clientModuleData !== null) {
                      hasData = true;
                 }
            }
            let moduleCost = 0;
            if (hasData) {
                if (clientModuleData.totalCost !== undefined) {
                    moduleCost = parseFloat(clientModuleData.totalCost) || 0;
                } else if (clientModuleData.items && Array.isArray(clientModuleData.items)) {
                    if (window.ConstructionApp && window.ConstructionApp.ModuleUtils) {
                        moduleCost = window.ConstructionApp.ModuleUtils.calculateModuleTotal(clientModuleData.items);
                    }
                } else if (moduleId === 'notes') {
                    moduleCost = 0;
                }
            }
            const formattedCost = window.ConstructionApp?.ModuleUtils?.formatCurrency(moduleCost) ?? `R${moduleCost.toFixed(2)}`;
            const clearButtonHtml = (hasData && moduleId !== 'notes') ? `<button class="clear-module-btn" title="Clear module data">×</button>` : '';
            const openButtonDisabled = (!client && module.requiresClient) ? 'disabled title="Select a client first"' : '';
            const openButtonHtml = `<button class="btn module-open-btn" style="margin-top: 10px;" ${openButtonDisabled}>Open Module</button>`;
            let costHtml = '';
            if (moduleId === 'notes') {
                 costHtml = '<p style="font-size: 0.9em; color: #666; margin-top: 10px;">(No cost associated)</p>';
            } else {
                 const noDataAnnotation = !hasData ? ' <small style="opacity: 0.7;"> (No data)</small>' : '';
                 costHtml = `<p class="module-tile-cost">${formattedCost}${noDataAnnotation}</p>`;
            }
            tilesHTML += `
                <div class="module-tile ${!hasData ? 'no-client-data' : ''}" data-module-id="${moduleId}">
                    ${clearButtonHtml}
                    <h5>${moduleName}</h5>
                    ${costHtml}
                    ${openButtonHtml}
                </div>`;
        });
    }

    let tilesWrapperHtml = `<div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 10px;">
                              <h4 style="margin-bottom: 15px;">Module Summaries</h4>
                              <div id="module-tiles">`;
    if (hasAnyTiles) {
        tilesWrapperHtml += tilesHTML;
    } else {
        tilesWrapperHtml += `<div style="background-color: white; padding: 15px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); grid-column: 1 / -1; text-align: center; color: #666;"><p>No modules defined in the system.</p><p style="margin-top: 5px;"><small>Add modules using the sidebar.</small></p></div>`;
    }
    tilesWrapperHtml += `</div></div>`;

    console.log("DEBUG: Attempting to update #module-content innerHTML (appending tiles wrapper)...");
    // Append tiles wrapper after any existing notification (handled by updateDashboard)
    contentElement.innerHTML += tilesWrapperHtml;
    console.log("DEBUG: #module-content innerHTML update COMPLETE.");

    setupDashboardTileListeners();
    console.log("DEBUG: renderDashboardContent COMPLETE.");
}


/**
 * Update the dashboard UI based on the current client - Handles timing fix.
 * @param {object|null} client - The new client object, or null if logged out.
 */
function updateDashboard(client) {
    console.log("DEBUG: updateDashboard START - Client:", client ? client.name : 'None');

    const logoutBtn = document.getElementById('logout-btn');
    const dashboardContent = document.getElementById('module-content');
    const clientNameDisplay = document.getElementById('client-name-display');
    const dashboardDesc = document.querySelector('.dashboard-description');
    const totalProjectCostDisplay = document.getElementById('total-project-cost');

    console.log(`DEBUG: Checking elements: logoutBtn=${!!logoutBtn}, dashboardContent=${!!dashboardContent}, clientNameDisplay=${!!clientNameDisplay}, dashboardDesc=${!!dashboardDesc}, totalProjectCostDisplay=${!!totalProjectCostDisplay}`);

    if (!dashboardContent || !clientNameDisplay || !dashboardDesc || !logoutBtn || !totalProjectCostDisplay) {
        console.error("[Dashboard] One or more essential dashboard UI elements missing, cannot update.");
        console.log("DEBUG: updateDashboard EXITING due to missing elements.");
        return;
    }

    if (client) {
        console.log("DEBUG: updateDashboard - Client is present. Updating UI.");
        clientNameDisplay.textContent = `Client: ${client.name}`;
        dashboardDesc.textContent = `${client.address || 'No address provided'}`;
        logoutBtn.style.display = 'inline-block';
        const newLogoutBtn = logoutBtn.cloneNode(true);
        logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
        newLogoutBtn.addEventListener('click', () => {
            if (window.ConstructionApp && window.ConstructionApp.ModuleUtils) {
                window.ConstructionApp.ModuleUtils.logoutClient();
            } else { console.error("Cannot logout: ModuleUtils not available."); }
        });

        // Clear the content area entirely before rendering tiles for a client
        dashboardContent.innerHTML = ''; // Clear previous content (loading/no-client message)
        console.log("DEBUG: Cleared #module-content for client view.");
        console.log("DEBUG: Calling renderDashboardContent(client)...");
        renderDashboardContent(client); // Render tiles for the client
        console.log("DEBUG: Calling updateTotalProjectCost()...");
        updateTotalProjectCost(); // Update total project cost

    } else {
        console.log("DEBUG: updateDashboard - No client. Clearing client-specific UI and rendering empty tiles.");
        clientNameDisplay.textContent = '';
        totalProjectCostDisplay.textContent = 'Total Project Cost: R0.00';
        dashboardDesc.textContent = 'Overview of project data.';
        logoutBtn.style.display = 'none';

        // Display the "No Client" notification message *first*
        dashboardContent.innerHTML = `<div class="no-client-notification" style="margin-bottom: 20px;"><h2>No Client Selected</h2><p>Please select an existing client or create a new client using the sidebar.</p></div>`;
        console.log("DEBUG: Set #module-content to 'No Client' notification.");
        console.log("DEBUG: Calling renderDashboardContent(null)...");
        // Render the module tiles WITHOUT client data (will append after notification)
        renderDashboardContent(null);
    }

    updateDebugPanel();
    console.log("DEBUG: updateDashboard COMPLETE.");
}
// =========================================================================
// == END OF DASHBOARD CONTENT RENDERING & UPDATE ==
// =========================================================================


/**
 * Sets up delegated event listener for clicks within the module tiles container.
 */
function setupDashboardTileListeners() {
    const tilesContainer = document.getElementById('module-tiles');
    if (!tilesContainer) {
         return;
    }
    tilesContainer.removeEventListener('click', handleTileClick);
    tilesContainer.addEventListener('click', handleTileClick);
}

/**
 * Handles clicks on buttons within module tiles (Open, Clear).
 * @param {Event} e - The click event object.
 */
function handleTileClick(e) {
    const openBtn = e.target.closest('.module-open-btn');
    const clearBtn = e.target.closest('.clear-module-btn');
    const tile = e.target.closest('.module-tile');
    if (!tile) return;
    const moduleId = tile.dataset.moduleId;
    if (!moduleId) return;
    if (openBtn && !openBtn.disabled) {
         if (window.ConstructionApp && window.ConstructionApp.ModuleUtils) {
              window.ConstructionApp.ModuleUtils.navigateToModule(moduleId);
         } else { console.error("ModuleUtils not available for navigation!"); }
    } else if (clearBtn) {
        const moduleInfo = appData.modules.find(m => m.id === moduleId);
        const moduleName = moduleInfo ? moduleInfo.name : moduleId;
        if (confirm(`Are you sure you want to clear all data entered for "${moduleName}" for the current client? This cannot be undone.`)) {
            clearModuleData(moduleId);
        }
    }
}

/**
 * Clears the data for a specific module for the current client.
 * @param {string} moduleId - The ID of the module to clear data for.
 */
function clearModuleData(moduleId) {
    const client = window.ConstructionApp?.ClientManager?.getCurrentClient();
    if (!client) {
         window.ConstructionApp?.ModuleUtils?.showErrorMessage("No client selected.");
         return;
    }
    if (client.moduleData && client.moduleData.hasOwnProperty(moduleId)) {
        console.log(`[Dashboard] Clearing module data for: ${moduleId} for client ${client.name}`);
        window.ConstructionApp.ClientManager.saveModuleData(moduleId, null, (success, error) => {
            if (success) {
                 console.log("[Dashboard] Module data cleared successfully via ClientManager.");
                if (client.moduleData) {
                    delete client.moduleData[moduleId];
                     const updatedClient = { ...client };
                     window.ConstructionApp.ClientManager.setCurrentClient(updatedClient); // Trigger update
                     console.log("[Dashboard] Updated client session after clearing module.");
                }
                window.ConstructionApp?.ModuleUtils?.showSuccessMessage(`Data for "${moduleId}" cleared.`);
                // UI should re-render automatically via the setCurrentClient call triggering updateDashboard
                // renderDashboardContent(client); // No longer needed here
                // updateTotalProjectCost(); // No longer needed here
            } else {
                 console.error(`[Dashboard] Error clearing module data via ClientManager: ${error || 'Unknown'}`);
                 window.ConstructionApp?.ModuleUtils?.showErrorMessage(`Error clearing data: ${error || 'Unknown'}`);
            }
        });
    } else {
        window.ConstructionApp?.ModuleUtils?.showSuccessMessage(`No data to clear for "${moduleId}".`);
    }
}


/**
 * Update total project cost display in the header.
 * Reads data from the current client managed by ClientManager.
 */
function updateTotalProjectCost() {
    let totalCost = 0;
    const client = window.ConstructionApp?.ClientManager?.getCurrentClient();
    if (client && client.moduleData) {
        Object.entries(client.moduleData).forEach(([moduleId, moduleVersionedData]) => {
            const moduleData = moduleVersionedData?.data ?? moduleVersionedData ?? null;
            if (!moduleData) return;
            let costForThisModule = 0;
            if (moduleData.totalCost !== undefined) {
                costForThisModule = parseFloat(moduleData.totalCost) || 0;
            } else if (moduleData.items && Array.isArray(moduleData.items)) {
                 if (window.ConstructionApp && window.ConstructionApp.ModuleUtils) {
                      costForThisModule = window.ConstructionApp.ModuleUtils.calculateModuleTotal(moduleData.items);
                 }
            }
            totalCost += costForThisModule;
        });
    }
    const formattedTotal = window.ConstructionApp?.ModuleUtils?.formatCurrency(totalCost) ?? `R${totalCost.toFixed(2)}`;
    const totalCostElement = document.getElementById('total-project-cost');
    if (totalCostElement) {
        totalCostElement.textContent = `Total Project Cost: ${formattedTotal}`;
    } else {
         console.warn("[Dashboard] Total project cost display element not found.");
    }
}


// --- Debug Panel ---

function setupDebugPanel() {
    const debugPanel = document.getElementById('debug-panel');
    let toggleBtn = document.getElementById('debug-toggle-btn');
    if (!debugPanel) return;
    if (!toggleBtn) {
        toggleBtn = document.createElement('button');
        toggleBtn.textContent = 'Debug';
        toggleBtn.id = 'debug-toggle-btn';
        toggleBtn.style.cssText = `position: fixed; bottom: 10px; right: 10px; z-index: 10000; padding: 5px 10px; background: #333; color: white; border: none; border-radius: 3px; cursor: pointer; opacity: 0.8; font-size: 12px;`;
        document.body.appendChild(toggleBtn);
    }
     toggleBtn.style.display = 'block';
     toggleBtn.removeEventListener('click', toggleDebugPanel);
     toggleBtn.addEventListener('click', toggleDebugPanel);
     // console.log("[Dashboard] Debug panel setup complete."); // Less verbose
}

function toggleDebugPanel() {
     const debugPanel = document.getElementById('debug-panel');
     const toggleBtn = document.getElementById('debug-toggle-btn');
     if (!debugPanel || !toggleBtn) return;
     const isVisible = debugPanel.style.display === 'block';
     debugPanel.style.display = isVisible ? 'none' : 'block';
     toggleBtn.textContent = isVisible ? 'Debug' : 'Hide Debug';
     if (!isVisible) {
         updateDebugPanel();
     }
}

function updateDebugPanel() {
    const debugPanel = document.getElementById('debug-panel');
    if (!debugPanel || debugPanel.style.display !== 'block') return;
    const navigationState = sessionStorage.getItem('navigationState');
    const currentClient = window.ConstructionApp?.ClientManager?.getCurrentClient();
    const storedClientStr = sessionStorage.getItem('currentClient');
    const moduleOrderStr = sessionStorage.getItem('moduleOrder');
    let storedClientParsed = null;
    try { storedClientParsed = JSON.parse(storedClientStr || 'null'); } catch(e){}
    let debugInfo = `<strong>Nav State:</strong> ${navigationState || 'None'}<br>
                     <strong>Current Client (Mgr):</strong> ${currentClient ? currentClient.name : 'None'} (ID: ${currentClient?.id || 'N/A'})<br>
                     <strong>Client in sessionStorage:</strong> ${storedClientParsed ? 'Present' : 'None'} (ID: ${storedClientParsed?.id || 'N/A'})<br>
                     <hr>
                     <strong>Modules in appData:</strong> ${appData.modules?.length || 0}<br>
                     <strong>Module Order Backup:</strong> ${moduleOrderStr ? 'Present' : 'None'}<br>
                     <strong>Header Collapse State:</strong> ${JSON.stringify(headerCollapseState)}<br>
                     <hr>`;
    if (currentClient && currentClient.moduleData) {
        debugInfo += '<strong>Client Module Data (Costs):</strong><br>';
        let calculatedTotal = 0;
        Object.entries(currentClient.moduleData).forEach(([moduleId, moduleVData]) => {
            const moduleData = moduleVData?.data ?? moduleVData ?? {};
            let moduleCost = 0;
            if (moduleData?.totalCost !== undefined) moduleCost = moduleData.totalCost;
            else if (moduleData?.items) moduleCost = window.ConstructionApp?.ModuleUtils?.calculateModuleTotal(moduleData.items) ?? 0;
            calculatedTotal += parseFloat(moduleCost) || 0;
            debugInfo += `- ${moduleId}: Cost: ${window.ConstructionApp?.ModuleUtils?.formatCurrency(moduleCost) ?? 'N/A'}<br>`;
        });
        debugInfo += `<strong>Calculated Total Cost:</strong> ${window.ConstructionApp?.ModuleUtils?.formatCurrency(calculatedTotal) ?? 'N/A'}<br><hr>`;
    } else if (currentClient) {
         debugInfo += '<strong>Client Module Data:</strong> None<br><hr>';
    }
    debugInfo += '<strong>Module Structure (appData - Top 5):</strong><br><pre style="max-height: 150px; overflow-y: auto; border: 1px solid #555; padding: 5px; font-size: 11px;">';
    debugInfo += JSON.stringify(appData.modules?.slice(0, 5).map(m => ({id: m.id, name: m.name, type: m.type, parentId: m.parentId, order: m.order})) || [], null, 1);
    debugInfo += '</pre>';
    debugPanel.innerHTML = debugInfo;
}
