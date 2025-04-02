// js/dashboard.js
// Added specific debug logs at the start of updateDashboard

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
                         // Note: This doesn't change headerCollapseState permanently
                         // We might need a more sophisticated state management if search+collapse needs persistence
                     }
                }

            } else {
                moduleEl.style.display = 'none';
            }
        });
    };

    // Attach the debounced filter function to the input event
    searchInput.addEventListener('input', debounceFilter(filterModules, 250));
    console.log("[Dashboard] Module search listener attached.");
}


// --- Initialization ---

/**
 * Main entry point when the DOM is ready.
 * Loads modules, initializes client state, sets up UI listeners.
 */
document.addEventListener('DOMContentLoaded', function() {
    // --- ADDED LOG ---
    console.log("DEBUG: DOMContentLoaded event fired");
    // --- END LOG ---
    console.log("[Dashboard] DOM loaded, initializing app");
    setupDebugPanel(); // Setup debug panel first

    // Load module definitions (structure)
    // --- ADDED LOG ---
    console.log("DEBUG: Calling loadAndRenderModules...");
    // --- END LOG ---
    loadAndRenderModules().then(() => {
        // --- ADDED LOG ---
        console.log("DEBUG: loadAndRenderModules COMPLETE.");
        console.log("DEBUG: Calling initApp...");
        // --- END LOG ---
        // Once modules are loaded, initialize the rest of the app
        initApp(); // Determine initial client state
        // --- ADDED LOG ---
        console.log("DEBUG: initApp COMPLETE.");
        // --- END LOG ---
        setupDropdownMenus(); // Sidebar module dropdowns
        setupClientManagement(); // Client modal buttons
        setupAddModuleButton(); // Add module button/modal
        setupModuleSearch(); // Sidebar search
        setupDragAndDrop(); // Sidebar drag/drop

        // Load client list asynchronously (doesn't block UI)
        if (window.ConstructionApp && window.ConstructionApp.ClientManager) {
            // --- ADDED LOG ---
            console.log("DEBUG: Setting ClientManager.onClientChanged callback to updateDashboard.");
            // --- END LOG ---
            // Set the callback for when the client changes
            window.ConstructionApp.ClientManager.onClientChanged = updateDashboard;

            window.ConstructionApp.ClientManager.loadClients().then(() => {
                console.log("[Dashboard] Client list loaded");
                // Potentially refresh client selection UI if needed after load
            }).catch(error => {
                 console.error("[Dashboard] Error loading client list:", error);
            });

        } else {
             console.error("[Dashboard] ClientManager not available!");
        }

    }).catch(error => {
        // --- ADDED LOG ---
        console.error("DEBUG: loadAndRenderModules FAILED.", error);
        // --- END LOG ---
        console.error("[Dashboard] Critical error during module loading:", error);
        // Display an error message to the user?
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
        // User came back from a module page
        try {
            clientToSet = JSON.parse(storedClientStr);
            console.log("[Dashboard] Restoring client from sessionStorage (returning):", clientToSet?.name || 'Unknown');
        } catch (error) {
            console.error("[Dashboard] Error parsing stored client on return:", error);
            sessionStorage.removeItem('currentClient'); // Clear corrupted data
        }
    } else if (navigationState === 'manualLogout' || navigationState === 'invalidAccess') {
        // User explicitly logged out or tried invalid access
        console.log("[Dashboard] Manual logout or invalid access detected, ensuring no client is set.");
        clientToSet = null; // Ensure no client is active
        sessionStorage.removeItem('currentClient'); // Clear any lingering client data
    } else if (storedClientStr) {
        // Fresh page load or unknown state, but client data exists in session
        try {
            clientToSet = JSON.parse(storedClientStr);
            console.log("[Dashboard] Restoring client from sessionStorage (fresh load/unknown):", clientToSet?.name || 'Unknown');
        } catch (error) {
            console.error("[Dashboard] Error parsing stored client on fresh load:", error);
            sessionStorage.removeItem('currentClient'); // Clear corrupted data
        }
    } else {
        // No client data in session, no specific navigation state
        console.log("[Dashboard] No client found in sessionStorage, starting fresh.");
    }

    // Set the current client in the ClientManager (this triggers onClientChanged -> updateDashboard)
    if (window.ConstructionApp && window.ConstructionApp.ClientManager) {
        // IMPORTANT: setCurrentClient triggers the onClientChanged callback, which calls updateDashboard
        // --- ADDED LOG ---
        console.log("DEBUG: Calling ClientManager.setCurrentClient with client:", clientToSet ? clientToSet.name : 'None');
        // --- END LOG ---
        window.ConstructionApp.ClientManager.setCurrentClient(clientToSet);
        // --- ADDED LOG ---
        console.log("DEBUG: ClientManager.setCurrentClient call complete.");
        // --- END LOG ---
    } else {
         console.error("[Dashboard] ClientManager not available during initApp!");
         // Manually update dashboard if ClientManager is missing? Risky.
         updateDashboard(clientToSet); // Attempt manual update as fallback
    }

    // Clean up navigation state flag after using it
    sessionStorage.removeItem('navigationState');
    console.log("[Dashboard] Cleared navigation state.");

    // Log final client state after init (might be slightly delayed if ClientManager is async)
    // const finalClient = window.ConstructionApp?.ClientManager?.getCurrentClient();
    // console.log("[Dashboard] Current client immediately after setting:", finalClient ? finalClient.name : "None");
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
                 // Optional: Save the restored backup back to Firebase?
                 // await window.ConstructionApp.Firebase.saveModules(loadedModules);
            } else {
                console.warn("[Dashboard] Backup empty or failed. Using defaults.");
                loadedModules = getDefaultModules();
                // Save defaults to Firebase if loaded initially
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
            // Attempt to save defaults even if Firebase load failed initially (might fail again)
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
    // Define default structure for notes module
    notesModuleData = {
        id: 'notes',
        name: notesModuleData.name || 'Notes',
        requiresClient: notesModuleData.requiresClient !== undefined ? notesModuleData.requiresClient : true, // Notes require a client
        type: notesModuleData.type || 'regular', // Notes is a regular module
        parentId: notesModuleData.parentId !== undefined ? notesModuleData.parentId : null, // Notes usually top-level
        order: -1, // Ensure notes is always first visually (will be sorted later if needed)
        // Add render/save functions specific to the notes module if needed elsewhere
        // renderTemplate: function(...) { ... },
        // saveData: function(...) { ... }
    };
    loadedModules.unshift(notesModuleData); // Add notes module to the beginning

    // Store the final module list in the global appData
    // Add placeholder render/save functions if they might be called generically
    appData.modules = loadedModules.map(mod => ({
        ...mod,
        parentId: (mod.parentId === 'null' || mod.parentId === undefined) ? null : mod.parentId, // Normalize parentId
        order: mod.order ?? 0, // Ensure order is a number
        // Add placeholders if needed, specific modules might override these later
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
        // Notes module is handled separately in loadAndRenderModules
        { id: 'p-and-gs', name: 'P&G\'s', requiresClient: true, type: 'regular', parentId: null, order: 1 },
        { id: 'foundations', name: 'Foundations', requiresClient: false, type: 'header', parentId: null, order: 2 },
        { id: 'earthworks', name: 'Earthworks', requiresClient: true, type: 'regular', parentId: 'foundations', order: 0 },
        { id: 'concrete', name: 'Concrete', requiresClient: true, type: 'regular', parentId: 'foundations', order: 1 },
        { id: 'steel', name: 'Steel', requiresClient: true, type: 'regular', parentId: 'foundations', order: 2 },
        { id: 'structure', name: 'Structure', requiresClient: false, type: 'header', parentId: null, order: 3 },
        { id: 'brickwork', name: 'Brickwork', requiresClient: true, type: 'regular', parentId: 'structure', order: 0 },
        { id: 'demolish', name: 'Demolish', requiresClient: true, type: 'regular', parentId: null, order: 4 },
        // Add other default modules as needed
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

    // Sort modules primarily by order, then potentially by name for tie-breaking
    const sortedModules = [...modules].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.name.localeCompare(b.name));

    // Recursive function to render modules at a specific level
    function renderLevel(parentId, level) {
        sortedModules
            .filter(m => m.parentId === parentId)
            .forEach(module => {
                const moduleElement = createModuleElement(module, level);
                container.appendChild(moduleElement);

                // If the module is a header and it's not collapsed, render its children
                const isHeader = module.type === 'header';
                const isCollapsed = headerCollapseState[module.id] === true;

                if (!isHeader || !isCollapsed) {
                    renderLevel(module.id, level + 1);
                }
            });
    }

    // Start rendering from the top level (parentId = null)
    renderLevel(null, 0);

    // Re-attach drag and drop listeners after re-rendering
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
    moduleElement.draggable = true; // Make it draggable
    moduleElement.setAttribute('data-module-id', moduleData.id);
    moduleElement.setAttribute('data-requires-client', moduleData.requiresClient ? 'true' : 'false');
    moduleElement.setAttribute('data-module-type', moduleData.type || 'regular');
    moduleElement.setAttribute('data-parent-id', moduleData.parentId || 'null');
    moduleElement.setAttribute('data-level', level);

    // Indentation based on level
    moduleElement.style.paddingLeft = `${20 + level * 15}px`;

    // Add collapse icon and class for headers
    let collapseIconHTML = '';
    if (moduleData.type === 'header') {
        moduleElement.classList.add('header-item');
        const isCollapsed = headerCollapseState[moduleData.id] === true;
        if (isCollapsed) {
            moduleElement.classList.add('collapsed');
        }
        // Use a simple text arrow for collapse icon
        collapseIconHTML = `<span class="collapse-icon" title="Expand/Collapse">▼</span>`;
    }

    // Add gear icon for non-client-required modules
    const configIcon = !moduleData.requiresClient ? ' <span title="Configuration Module" style="opacity: 0.7; margin-left: 5px;">⚙️</span>' : '';


    // Structure of the module item
    moduleElement.innerHTML = `
        <div class="module-drag-handle" title="Drag to reorder">≡</div>
        ${collapseIconHTML}
        <div class="module-icon" title="Actions">
            ... <div class="dropdown-menu">
                <div class="dropdown-item edit-module">Edit</div>
                <div class="dropdown-item delete-module">Delete</div>
            </div>
        </div>
        <span class="module-name">${moduleData.name}</span>
        ${configIcon}
    `;

    // --- Attach Event Listeners Directly ---

    // Dropdown Menu Toggle
    const icon = moduleElement.querySelector('.module-icon');
    if (icon) {
        icon.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering module navigation
            const dropdown = icon.querySelector('.dropdown-menu');
            if (dropdown) {
                const isVisible = dropdown.style.display === 'block';
                closeAllDropdowns(); // Close others first
                if (!isVisible) {
                    dropdown.style.display = 'block';
                }
            }
        });
    }

    // Edit Action
    const editBtn = moduleElement.querySelector('.edit-module');
    if (editBtn) {
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent dropdown closing immediately
            console.log("Edit action clicked for:", moduleData.id);
            editModule(moduleElement); // Pass the element to the edit function
            closeAllDropdowns();
        });
    }

    // Delete Action
    const deleteBtn = moduleElement.querySelector('.delete-module');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log("Delete action clicked for:", moduleData.id);
            deleteModule(moduleElement); // Pass the element to the delete function
            closeAllDropdowns();
        });
    }

    // Module Navigation (Click on Name)
    const nameSpan = moduleElement.querySelector('.module-name');
    if (nameSpan) {
        nameSpan.addEventListener('click', () => {
            // Use ModuleUtils for navigation logic (checks client, unsaved changes etc.)
            if (window.ConstructionApp && window.ConstructionApp.ModuleUtils) {
                window.ConstructionApp.ModuleUtils.navigateToModule(moduleData.id);
            } else {
                console.error("ModuleUtils not available for navigation!");
                // Fallback? Simple navigation without checks?
                // window.location.href = moduleData.id + '.html';
            }
        });
    }

     // Collapse/Expand (Click on Header Item or Icon) - Added in setupDropdownMenus via delegation

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
    const modalCloseBtns = modalOverlay?.querySelectorAll('.modal-close, .btn-cancel'); // Use optional chaining

    if (!addModuleBtn || !modalOverlay || !moduleTypeSelect || !parentHeaderGroup || !parentHeaderSelect || !saveNewModuleBtn || !modalCloseBtns) {
        console.warn("[Dashboard] One or more elements for 'Add Module' modal not found.");
        return;
    }

    // Show Modal & Populate Parent Headers
    addModuleBtn.addEventListener('click', () => {
        // Clear previous options and add default
        parentHeaderSelect.innerHTML = '<option value="null">(Top Level / No Parent)</option>';
        // Populate with current header modules
        appData.modules
            .filter(m => m.type === 'header')
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(header => {
                const option = document.createElement('option');
                option.value = header.id;
                option.textContent = header.name;
                parentHeaderSelect.appendChild(option);
            });

        // Reset form fields
        document.getElementById('new-module-name').value = '';
        moduleTypeSelect.value = 'regular'; // Default to regular module
        parentHeaderGroup.style.display = 'block'; // Show parent select initially
        parentHeaderSelect.value = 'null'; // Default to top level
        document.getElementById('new-module-requires-client').checked = true; // Default to requiring client

        // Show the modal
        modalOverlay.style.display = 'flex';
    });

    // Toggle Parent Select based on Module Type
    moduleTypeSelect.addEventListener('change', function() {
        parentHeaderGroup.style.display = this.value === 'regular' ? 'block' : 'none';
        if (this.value === 'header') {
             parentHeaderSelect.value = 'null'; // Headers cannot have parents in this structure
        }
    });

    // Close Modal Buttons (Cancel, X) - Re-attach listeners to prevent duplicates
    modalCloseBtns.forEach(btn => {
        // Clone and replace to ensure only one listener
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', () => modalOverlay.style.display = 'none');
    });

    // Close Modal on Overlay Click
    modalOverlay.addEventListener('click', (event) => {
        if (event.target === modalOverlay) { // Only close if clicking the overlay itself
            modalOverlay.style.display = 'none';
        }
    });

    // Save New Module Button - Re-attach listener
    const newSaveBtn = saveNewModuleBtn.cloneNode(true);
    saveNewModuleBtn.parentNode.replaceChild(newSaveBtn, saveNewModuleBtn);
    newSaveBtn.addEventListener('click', addNewModule);

    console.log("[Dashboard] 'Add Module' button and modal setup complete.");
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
    // Headers always have parentId null, regular modules use the select value
    const parentId = moduleType === 'header' ? null : (parentHeaderSelect.value === 'null' ? null : parentHeaderSelect.value);
    const requiresClient = requiresClientCheckbox.checked;

    // --- Validation ---
    if (!moduleName) {
        alert("Module name is required.");
        moduleNameInput.focus();
        return;
    }

    // Generate a simple ID (consider more robust generation if needed)
    const moduleId = moduleName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!moduleId) {
         alert("Could not generate a valid ID from the module name.");
         return;
    }

    // Check for duplicate ID
    if (appData.modules.some(m => m.id === moduleId)) {
        alert(`Module ID "${moduleId}" already exists or is invalid. Please choose a different name.`);
        return;
    }

    // --- Determine Order ---
    // Place new item at the end of its parent group
    let order = 0;
    const siblings = appData.modules.filter(m => m.parentId === parentId);
    if (siblings.length > 0) {
        // Find the maximum order among siblings and add 1
        order = Math.max(...siblings.map(m => m.order ?? -1)) + 1;
    }

    // --- Create Module Object ---
    const newModuleData = {
        id: moduleId,
        name: moduleName,
        requiresClient: requiresClient,
        type: moduleType,
        parentId: parentId,
        order: order,
        // Add placeholder render/save functions
        renderTemplate: function(client) { return `<h3>${moduleName}</h3><p>Default content.</p>`; },
        saveData: function() { return {}; }
    };

    console.log("[Dashboard] Adding new module:", newModuleData);

    // --- Update State and UI ---
    appData.modules.push(newModuleData); // Add to global list
    renderModuleList(appData.modules); // Re-render the sidebar
    saveModuleStructure(); // Save the updated structure to Firebase/backup

    // Close the modal
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

    // Prepare modules for saving (extract relevant data, remove functions)
    const modulesToSave = appData.modules.map(module => ({
        id: module.id,
        name: module.name,
        requiresClient: module.requiresClient,
        type: module.type || 'regular',
        parentId: module.parentId, // Already normalized to null or string ID
        order: module.order ?? 0 // Ensure order is a number
    }));

    // Optional: Sort before saving? Might not be necessary if order is maintained correctly.
    // modulesToSave.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || (a.parentId ?? '').localeCompare(b.parentId ?? '') || a.name.localeCompare(b.name));

    console.log("[Dashboard] Modules prepared for saving:", modulesToSave.length);

    // Attempt to save to Firebase
    if (window.ConstructionApp && window.ConstructionApp.Firebase) {
        window.ConstructionApp.Firebase.saveModules(modulesToSave)
            .then(success => {
                if (success) {
                    console.log("[Dashboard] Module structure saved to Firebase.");
                    // Save backup ONLY after successful Firebase save? Or always? Let's save always for safety.
                    // sessionStorage.setItem('moduleOrder', JSON.stringify(modulesToSave));
                    // console.log("[Dashboard] Module structure backup saved to sessionStorage.");
                } else {
                    console.warn("[Dashboard] Firebase.saveModules reported failure (but promise resolved).");
                    // Still save backup even if Firebase reported logical failure
                    // sessionStorage.setItem('moduleOrder', JSON.stringify(modulesToSave));
                    // console.warn("[Dashboard] Saved structure to sessionStorage backup despite potential Firebase issue.");
                }
            })
            .catch(error => {
                console.error("[Dashboard] Error saving module structure to Firebase:", error);
                // Save backup if Firebase save fails
                // sessionStorage.setItem('moduleOrder', JSON.stringify(modulesToSave));
                // console.warn("[Dashboard] Saved structure to sessionStorage backup due to Firebase error.");
            })
            .finally(() => {
                 // Save backup regardless of Firebase outcome for robustness
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
            // Basic validation
            if (!Array.isArray(orderData)) {
                 throw new Error("Backup data is not an array.");
            }
            console.log("[Dashboard] Restoring structure from backup:", orderData.length, "modules");
            // Normalize data on restore
            return orderData.map(mod => ({
                ...mod,
                type: mod.type || 'regular', // Ensure type exists
                parentId: (mod.parentId === undefined || mod.parentId === 'null') ? null : mod.parentId, // Normalize parentId
                order: mod.order ?? 0 // Ensure order exists and is a number
            }));
        } catch (error) {
            console.error("[Dashboard] Error parsing module structure backup:", error);
            sessionStorage.removeItem('moduleOrder'); // Remove corrupted backup
        }
    } else {
        console.warn("[Dashboard] No module structure backup found in sessionStorage.");
    }
    return null; // Return null if no valid backup found
}


// --- Drag and Drop (Sidebar Modules) ---

let dragOverElement = null; // Element being dragged over
let dropIndicator = null; // 'top', 'bottom', or 'middle'

/**
 * Sets up event listeners for drag and drop functionality on the modules container.
 */
function setupDragAndDrop() {
    const container = document.getElementById('modules-container');
    if (!container) return;

    // Remove existing listeners before adding new ones to prevent duplicates
    container.removeEventListener('dragstart', handleDragStart);
    container.removeEventListener('dragover', handleDragOver);
    container.removeEventListener('dragleave', handleDragLeave);
    container.removeEventListener('drop', handleDrop);
    container.removeEventListener('dragend', handleDragEnd);

    // Add new listeners
    container.addEventListener('dragstart', handleDragStart);
    container.addEventListener('dragover', handleDragOver);
    container.addEventListener('dragleave', handleDragLeave);
    container.addEventListener('drop', handleDrop);
    container.addEventListener('dragend', handleDragEnd);
     // console.log("[Dashboard] Drag and drop listeners attached."); // Can be noisy
}

/**
 * Handles the start of a drag operation.
 */
function handleDragStart(e) {
    // Ensure we are dragging a module item by checking the target or its closest ancestor
    const target = e.target.closest('.module-item');
    if (!target || !target.draggable) {
        e.preventDefault(); // Prevent dragging if not a draggable module item
        return;
    }

    // Only allow dragging via the handle? Or whole item? Current: whole item
    // if (!e.target.classList.contains('module-drag-handle')) {
    //      e.preventDefault();
    //      return;
    // }

    globalDraggedItem = target; // Store the element being dragged
    e.dataTransfer.setData('text/plain', target.dataset.moduleId); // Set data for drop event
    e.dataTransfer.effectAllowed = 'move'; // Indicate the type of operation

    // Add dragging class after a short delay for visual feedback
    setTimeout(() => {
        if (globalDraggedItem) globalDraggedItem.classList.add('dragging');
    }, 0);
    console.log("[Dashboard] Drag Start:", target.dataset.moduleId);
}

/**
 * Handles the drag over event to provide visual feedback (drop indicators).
 */
function handleDragOver(e) {
    e.preventDefault(); // Necessary to allow dropping
    e.dataTransfer.dropEffect = 'move'; // Visual cue for the cursor

    const targetElement = e.target.closest('.module-item');

    // Ignore dragging over self or outside a module item
    if (!targetElement || targetElement === globalDraggedItem) {
        clearDropIndicators();
        dragOverElement = null;
        dropIndicator = null;
        return;
    }

    // Update visual indicators only if the target element changes
    if (targetElement !== dragOverElement) {
        clearDropIndicators(); // Clear previous indicators
        dragOverElement = targetElement;
    }

    // Determine drop zone (top, middle, bottom) based on cursor position
    const rect = targetElement.getBoundingClientRect();
    const yOffset = e.clientY - rect.top;
    const dropZoneHeight = rect.height;
    const targetIsHeader = targetElement.dataset.moduleType === 'header';
    // Allow dropping ONTO a header (middle) only if dragging a non-header
    const draggedItemType = globalDraggedItem?.dataset?.moduleType;
    const canDropOnHeader = targetIsHeader && draggedItemType !== 'header';

    // Define thresholds for drop zones
    const topThreshold = dropZoneHeight * 0.3;
    const bottomThreshold = dropZoneHeight * 0.7;

    let currentIndicator = null;
    if (canDropOnHeader && yOffset > topThreshold && yOffset < bottomThreshold) {
        // Drop into header (middle)
        currentIndicator = 'middle';
    } else if (yOffset <= topThreshold) {
        // Drop above target (top)
        currentIndicator = 'top';
    } else {
        // Drop below target (bottom)
        currentIndicator = 'bottom';
    }

    // Apply visual indicator class if it changed
    if (currentIndicator !== dropIndicator) {
        targetElement.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-middle');
        dropIndicator = currentIndicator; // Store the current indicator type
        if (dropIndicator === 'middle') targetElement.classList.add('drag-over-middle');
        else if (dropIndicator === 'top') targetElement.classList.add('drag-over-top');
        else if (dropIndicator === 'bottom') targetElement.classList.add('drag-over-bottom');
    }
}

/**
 * Handles the drag leave event to clear visual indicators.
 */
function handleDragLeave(e) {
    const targetElement = e.target.closest('.module-item');
    if (!targetElement) return; // Ignore if leaving non-module area

    // Check if the mouse is leaving the current dragOverElement entirely
    // relatedTarget is where the mouse is entering
    const relatedTarget = e.relatedTarget ? e.relatedTarget.closest('.module-item') : null;

    if (targetElement === dragOverElement && relatedTarget !== dragOverElement) {
         // If leaving the element we were over, and not entering another part of it
        if (!targetElement.contains(e.relatedTarget)) {
             clearDropIndicators(targetElement);
             dragOverElement = null;
             dropIndicator = null;
        }
    }
}

/**
 * Handles the drop event to update the module order and hierarchy.
 */
function handleDrop(e) {
    e.preventDefault(); // Prevent default browser drop behavior
    clearDropIndicators(); // Clear visual indicators immediately

    // --- Validation ---
    if (!globalDraggedItem || !dragOverElement || globalDraggedItem === dragOverElement || !dropIndicator) {
        console.log("[Dashboard] Drop cancelled: Invalid state (no item, target, indicator, or dropping on self).");
        // Ensure dragging class is removed on cancel/invalid drop
        if (globalDraggedItem) globalDraggedItem.classList.remove('dragging');
        globalDraggedItem = null;
        dragOverElement = null;
        dropIndicator = null;
        return;
    }

    console.log(`[Dashboard] Drop: ${globalDraggedItem.dataset.moduleId} onto ${dragOverElement.dataset.moduleId}, Indicator: ${dropIndicator}`);

    const draggedId = globalDraggedItem.dataset.moduleId;
    const targetId = dragOverElement.dataset.moduleId;

    // Find modules in our data array
    const draggedModuleIndex = appData.modules.findIndex(m => m.id === draggedId);
    const targetModuleIndex = appData.modules.findIndex(m => m.id === targetId);

    if (draggedModuleIndex === -1 || targetModuleIndex === -1) {
        console.error("[Dashboard] DnD Error: Dragged or target module not found in appData.");
        // Clean up visual state
        if (globalDraggedItem) globalDraggedItem.classList.remove('dragging');
        globalDraggedItem = null;
        dragOverElement = null;
        dropIndicator = null;
        return;
    }

    const draggedModule = appData.modules[draggedModuleIndex];
    const targetModule = appData.modules[targetModuleIndex];

    // --- Determine New Parent and Position ---
    let newParentId = null;
    let targetPositionInArray = -1; // Index where the dragged item should be inserted

    if (dropIndicator === 'middle' && targetModule.type === 'header') {
        // Dropping INTO a header
        newParentId = targetModule.id;
        // Position: Find the last child of this header or place right after header if no children
         const children = appData.modules.filter(m => m.parentId === newParentId);
         if (children.length > 0) {
              const lastChild = children.sort((a,b) => (a.order ?? 0) - (b.order ?? 0)).pop();
              const lastChildIndex = appData.modules.findIndex(m => m.id === lastChild.id);
              targetPositionInArray = lastChildIndex + 1;
         } else {
              targetPositionInArray = targetModuleIndex + 1;
         }
        console.log(`[Dashboard] Setting parent of ${draggedId} to ${newParentId}`);

    } else if (dropIndicator === 'bottom') {
        // Dropping BELOW the target
        newParentId = targetModule.parentId; // Same parent as target
        targetPositionInArray = targetModuleIndex + 1; // Insert after target
        console.log(`[Dashboard] Inserting ${draggedId} after ${targetId} (parent: ${newParentId})`);

    } else { // dropIndicator === 'top'
        // Dropping ABOVE the target
        newParentId = targetModule.parentId; // Same parent as target
        targetPositionInArray = targetModuleIndex; // Insert before target
        console.log(`[Dashboard] Inserting ${draggedId} before ${targetId} (parent: ${newParentId})`);
    }

    // --- Update Data Array ---
    // 1. Update the dragged module's parentId
    draggedModule.parentId = newParentId;

    // 2. Remove the dragged module from its original position
    appData.modules.splice(draggedModuleIndex, 1);

    // 3. Adjust targetPositionInArray if the removal shifted indices
    if (draggedModuleIndex < targetPositionInArray) {
        targetPositionInArray--;
    }

    // 4. Insert the dragged module at the new position
    appData.modules.splice(targetPositionInArray, 0, draggedModule);

    // --- Final Steps ---
    recalculateModuleOrder(); // Update 'order' property based on new array positions
    renderModuleList(appData.modules); // Re-render the sidebar with updated structure
    saveModuleStructure(); // Persist the changes

    // Clean up state variables (redundant due to handleDragEnd, but safe)
    globalDraggedItem = null;
    dragOverElement = null;
    dropIndicator = null;
}

/**
 * Handles the end of a drag operation (whether dropped successfully or cancelled).
 */
function handleDragEnd(e) {
    // Clean up visual styles and state variables
    if (globalDraggedItem) {
        globalDraggedItem.classList.remove('dragging');
    }
    clearDropIndicators(); // Ensure all indicators are removed
    globalDraggedItem = null;
    dragOverElement = null;
    dropIndicator = null;
    console.log("[Dashboard] Drag End");
}

/**
 * Removes all drag-over visual indicator classes from module items.
 * @param {HTMLElement} [element] - Optional specific element to clear indicators from.
 */
function clearDropIndicators(element) {
    const selector = '.module-item.drag-over-top, .module-item.drag-over-bottom, .module-item.drag-over-middle';
    // If an element is provided, clear only that one, otherwise clear all
    const elementsToClear = element ? [element] : document.querySelectorAll(selector);
    elementsToClear.forEach(el => {
        if (el) { // Check if element exists
            el.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-middle');
        }
    });
}

/**
 * Recalculates the 'order' property for all modules based on their
 * current position within their parent group in the appData.modules array.
 */
function recalculateModuleOrder() {
    console.log("[Dashboard] Recalculating module order...");
    const modulesByParent = {};

    // Group modules by parentId
    appData.modules.forEach(module => {
        const parentKey = module.parentId === null ? 'null' : module.parentId;
        if (!modulesByParent[parentKey]) {
            modulesByParent[parentKey] = [];
        }
        modulesByParent[parentKey].push(module);
    });

    // Assign order within each group based on current array index
    Object.values(modulesByParent).forEach(group => {
        group.forEach((module, index) => {
            module.order = index;
        });
    });

    console.log("[Dashboard] Order recalculation complete.");
}


// --- Other UI Functions ---

/**
 * Sets up global click listener to close dropdowns and delegates
 * collapse/expand clicks for header items.
 */
function setupDropdownMenus() {
    // Close dropdowns on outside click
    document.removeEventListener('click', handleGlobalClickForDropdowns); // Prevent duplicates
    document.addEventListener('click', handleGlobalClickForDropdowns);
    console.log("[Dashboard] Global dropdown close listener attached.");

    // Handle collapse/expand using event delegation on the container
    const container = document.getElementById('modules-container');
     if (container) {
          container.removeEventListener('click', handleMaybeCollapseToggle); // Prevent duplicates
          container.addEventListener('click', handleMaybeCollapseToggle);
          console.log("[Dashboard] Collapse toggle listener attached via delegation.");
     }
}

/**
* Handles clicks within the modules container to potentially toggle collapse state.
* Uses event delegation.
*/
function handleMaybeCollapseToggle(e) {
    const collapseIcon = e.target.closest('.collapse-icon');
    const headerItem = e.target.closest('.module-item.header-item');

    // Toggle if:
    // 1. Clicked directly on the collapse icon OR
    // 2. Clicked within the header item BUT NOT on the drag handle or action icon
    if (headerItem && (collapseIcon || (!e.target.closest('.module-drag-handle') && !e.target.closest('.module-icon')))) {
        e.stopPropagation(); // Prevent triggering module navigation
        const moduleId = headerItem.dataset.moduleId;
        if (moduleId) {
            handleCollapseToggle(moduleId);
        }
    }
}


/**
 * Toggles the collapsed state for a header module and re-renders the list.
 * @param {string} headerModuleId - The ID of the header module to toggle.
 */
function handleCollapseToggle(headerModuleId) {
    console.log("[Dashboard] Toggling collapse for header:", headerModuleId);
    // Toggle the state in the global state object
    headerCollapseState[headerModuleId] = !(headerCollapseState[headerModuleId] === true);
    console.log("[Dashboard] New collapse state:", headerCollapseState);
    // Re-render the module list to reflect the change
    renderModuleList(appData.modules);
}


/**
 * Global click listener to close any open dropdown menus.
 */
function handleGlobalClickForDropdowns(e) {
    // If the click was not inside a module icon or its dropdown, close all dropdowns
    if (!e.target.closest('.module-icon') && !e.target.closest('.dropdown-menu')) {
        closeAllDropdowns();
    }
}

/**
 * Closes all open dropdown menus in the sidebar.
 */
function closeAllDropdowns() {
    document.querySelectorAll('#modules-container .dropdown-menu').forEach(menu => {
        if (menu.style.display === 'block') {
            menu.style.display = 'none';
        }
    });
}

/**
 * Handles editing a module's name via a prompt.
 * @param {HTMLElement} moduleElement - The module item element.
 */
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

    // Use prompt for simple name editing
    const newName = prompt(`Edit module name:`, currentName);

    // Check if user cancelled or entered empty/same name
    if (newName && newName.trim() !== '' && newName.trim() !== currentName) {
        const finalNewName = newName.trim();
        console.log(`[Dashboard] Renaming module ${moduleId} to "${finalNewName}"`);

        // Update the name in the data
        currentModule.name = finalNewName;

        // Update the name in the UI
        const nameSpan = moduleElement.querySelector('.module-name');
        if (nameSpan) {
            nameSpan.textContent = finalNewName;
        } else {
             console.warn("[Dashboard] Could not find name span to update UI for:", moduleId);
             // Re-render might be needed if UI update fails
             // renderModuleList(appData.modules);
        }

        // Save the structure changes
        saveModuleStructure();
        alert(`Module renamed to "${finalNewName}"`);
    } else {
        console.log("[Dashboard] Module rename cancelled or name unchanged.");
    }
}

/**
 * Handles deleting a module (and its descendants) after confirmation.
 * @param {HTMLElement} moduleElement - The module item element.
 */
function deleteModule(moduleElement) {
    const moduleId = moduleElement?.dataset?.moduleId;
    if (!moduleId) {
        console.error("[Dashboard] Delete Error: Could not get module ID from element.");
        alert("Error: Could not identify the module to delete.");
        return;
    }

    // Prevent deleting the essential 'Notes' module
    if (moduleId === 'notes') {
        alert('The Notes module cannot be deleted.');
        return;
    }

    const moduleIndex = appData.modules.findIndex(m => m.id === moduleId);
    if (moduleIndex === -1) {
        console.error("[Dashboard] Delete Error: Module not found in appData:", moduleId);
        alert(`Error: Module "${moduleId}" not found.`);
        return;
    }

    const moduleToDelete = appData.modules[moduleIndex];
    const moduleName = moduleToDelete.name;
    const isHeader = moduleToDelete.type === 'header';

    // Find direct children (for warning message)
    const directChildren = appData.modules.filter(m => m.parentId === moduleId);

    // Confirmation message
    let confirmMessage = `Are you sure you want to delete the "${moduleName}" module?`;
    if (isHeader && directChildren.length > 0) {
        confirmMessage += `\n\nWARNING: This is a header with ${directChildren.length} direct sub-module(s). Deleting it will also delete ALL descendants.`;
    }
    confirmMessage += `\n\nThis action cannot be undone.`;

    // Show confirmation dialog
    const confirmed = confirm(confirmMessage);

    if (confirmed) {
        console.log(`[Dashboard] Deleting module ${moduleId} (${moduleName}) and descendants.`);

        // Find all descendant IDs recursively
        const idsToDelete = new Set([moduleId]);
        const queue = [moduleId]; // Start with the module itself
        while (queue.length > 0) {
            const currentParentId = queue.shift();
            appData.modules.forEach(module => {
                // If module's parent is the one we're processing and it's not already marked for deletion
                if (module.parentId === currentParentId && !idsToDelete.has(module.id)) {
                    idsToDelete.add(module.id);
                    queue.push(module.id); // Add child to the queue to find its children
                }
            });
        }

        console.log("[Dashboard] IDs to delete:", Array.from(idsToDelete));

        // Filter out the modules to be deleted
        appData.modules = appData.modules.filter(module => !idsToDelete.has(module.id));

        console.log("[Dashboard] Modules filtered. Remaining:", appData.modules.length);

        // Update UI and save changes
        recalculateModuleOrder(); // Recalculate order for remaining items
        renderModuleList(appData.modules); // Re-render the sidebar
        saveModuleStructure(); // Persist the deletion

        alert(`Module "${moduleName}" ${idsToDelete.size > 1 ? 'and its descendants ' : ''}deleted successfully.`);

        // If the currently viewed module in the main panel was deleted, redirect?
        // (Need context of which module is active in main panel - not available here)

    } else {
        console.log("[Dashboard] Module deletion cancelled.");
    }
}


// --- Client Management & Dashboard Update ---

/**
 * Sets up listeners for the "New Client" and "Open Client" buttons.
 */
function setupClientManagement() {
    console.log("[Dashboard] Setting up client management buttons");
    const newClientBtn = document.getElementById('new-client-btn');
    const openClientBtn = document.getElementById('open-client-btn');
    let clientModalOverlay = document.getElementById('client-modal-overlay');

    // Ensure the modal overlay exists in the DOM
    if (!clientModalOverlay) {
        console.warn("[Dashboard] Client modal overlay not found, creating it.");
        clientModalOverlay = document.createElement('div');
        clientModalOverlay.className = 'modal-overlay';
        clientModalOverlay.id = 'client-modal-overlay';
        clientModalOverlay.style.display = 'none'; // Start hidden
        document.body.appendChild(clientModalOverlay);
        // Add listener to close on overlay click
        clientModalOverlay.addEventListener('click', (event) => {
            if (event.target === clientModalOverlay) {
                clientModalOverlay.style.display = 'none';
            }
        });
    }

    // New Client Button
    if (newClientBtn) {
        newClientBtn.addEventListener('click', () => {
            const clientModal = createClientModal('new'); // Generate modal content
            clientModalOverlay.innerHTML = ''; // Clear previous content
            clientModalOverlay.appendChild(clientModal); // Add new modal
            clientModalOverlay.style.display = 'flex'; // Show overlay
        });
    } else {
         console.warn("[Dashboard] 'New Client' button not found.");
    }

    // Open Client Button
    if (openClientBtn) {
        openClientBtn.addEventListener('click', () => {
            const clientModal = createClientModal('open'); // Generate modal content
            clientModalOverlay.innerHTML = ''; // Clear previous content
            clientModalOverlay.appendChild(clientModal); // Add new modal
            clientModalOverlay.style.display = 'flex'; // Show overlay
        });
    } else {
         console.warn("[Dashboard] 'Open Client' button not found.");
    }
}

/**
 * Creates the HTML content for the client modal (New or Open).
 * @param {string} type - 'new' or 'open'.
 * @returns {HTMLElement} The modal div element.
 */
function createClientModal(type) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    const overlayId = 'client-modal-overlay'; // ID of the overlay to close

    if (type === 'new') {
        // HTML for the New Client modal
        modal.innerHTML = `
            <div class="modal-header">
                <h2 class="modal-title">New Client</h2>
                <span class="modal-close" data-modal-id="${overlayId}">&times;</span>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label for="client-name">Client Name:</label>
                    <input type="text" id="client-name" class="form-control" required>
                </div>
                <div class="form-group">
                    <label for="client-address">Client Address:</label>
                    <input type="text" id="client-address" class="form-control">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-cancel" data-modal-id="${overlayId}">Cancel</button>
                <button class="btn btn-save" id="save-new-client-btn">Save Client</button>
            </div>`;

        // Attach listeners after a brief delay to ensure elements are in DOM
        setTimeout(() => {
            setupModalCloseButtons(modal, overlayId); // Setup Cancel and X buttons
            const saveBtn = modal.querySelector('#save-new-client-btn');
            if (saveBtn) {
                saveBtn.addEventListener('click', () => {
                    const nameInput = modal.querySelector('#client-name');
                    const addressInput = modal.querySelector('#client-address');
                    const name = nameInput.value.trim();
                    const address = addressInput.value.trim();

                    if (!name) {
                        alert('Client name is required.');
                        nameInput.focus();
                        return;
                    }

                    // Prepare new client data
                    const newClientData = {
                        name: name,
                        address: address,
                        moduleData: {} // Initialize with empty module data
                        // ID will be generated by ClientManager.addClient if not provided
                    };

                    console.log("[Dashboard] Creating new client:", name);

                    // Use ClientManager to add and set the new client
                    if (window.ConstructionApp && window.ConstructionApp.ClientManager) {
                        window.ConstructionApp.ClientManager.addClient(newClientData, (success, result) => {
                             if (success) {
                                  const addedClient = result; // The callback returns the added client object
                                  window.ConstructionApp.ClientManager.setCurrentClient(addedClient); // Set as current
                                  updateDebugPanel(); // Update debug info
                                  alert(`Client "${name}" created and selected.`);
                                  document.getElementById(overlayId).style.display = 'none'; // Close modal
                             } else {
                                  console.error("[Dashboard] Error adding client via ClientManager:", result);
                                  alert(`Error creating client: ${result || 'Unknown error'}`);
                             }
                        });
                    } else {
                         alert("Error: ClientManager is not available to save the client.");
                    }
                });
            }
        }, 0);

    } else if (type === 'open') {
        // HTML for the Open Client modal
        const clients = window.ConstructionApp?.ClientManager?.getAllClients() || [];
        let clientListHTML = '';

        if (clients.length > 0) {
            // Sort clients alphabetically by name
            clients.sort((a, b) => a.name.localeCompare(b.name));
            // Create list items
            clientListHTML = clients.map(client =>
                `<div class="client-list-item" data-client-id="${client.id}">${client.name}</div>`
            ).join('');
        } else {
            clientListHTML = '<div style="padding: 15px; text-align: center; color: #666;">No existing clients found.</div>';
        }

        modal.innerHTML = `
            <div class="modal-header">
                <h2 class="modal-title">Open Client</h2>
                <span class="modal-close" data-modal-id="${overlayId}">&times;</span>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label for="client-search">Search Clients:</label>
                    <input type="text" id="client-search" class="form-control" placeholder="Type to filter...">
                </div>
                <div class="client-list">${clientListHTML}</div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-cancel" data-modal-id="${overlayId}">Cancel</button>
                </div>`;

        // Attach listeners after a brief delay
        setTimeout(() => {
            setupModalCloseButtons(modal, overlayId); // Setup Cancel and X buttons
            setupClientListSelection(modal); // Handle clicking on a client item
            setupClientSearch(modal); // Handle filtering the list
        }, 0);
    }

    return modal; // Return the created modal element
}

/**
 * Attaches close listeners to Cancel and X buttons within a modal.
 * Clones buttons to prevent duplicate listeners.
 * @param {HTMLElement} modal - The modal element.
 * @param {string} overlayId - The ID of the overlay element to hide.
 */
function setupModalCloseButtons(modal, overlayId) {
    const closeBtns = modal.querySelectorAll(`.modal-close[data-modal-id="${overlayId}"], .btn-cancel[data-modal-id="${overlayId}"]`);
    closeBtns.forEach(btn => {
        // Clone and replace to ensure only one listener is attached
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', () => {
            const overlay = document.getElementById(overlayId);
            if (overlay) {
                overlay.style.display = 'none';
            } else {
                console.error("[Dashboard] Overlay not found:", overlayId);
            }
        });
    });
}

/**
 * Sets up the search functionality for the client list in the "Open Client" modal.
 * @param {HTMLElement} modal - The modal element containing the list and search input.
 */
function setupClientSearch(modal) {
    const searchInput = modal.querySelector('#client-search');
    const clientListContainer = modal.querySelector('.client-list');

    if (searchInput && clientListContainer) {
        searchInput.addEventListener('input', () => {
            const searchTerm = searchInput.value.toLowerCase().trim();
            const clientItems = clientListContainer.querySelectorAll('.client-list-item');
            clientItems.forEach(item => {
                // Check if item represents a client (has data-client-id)
                if (item.dataset.clientId) {
                    const clientName = item.textContent.toLowerCase();
                    // Show item if search term is empty or matches client name
                    item.style.display = (searchTerm === '' || clientName.includes(searchTerm)) ? 'block' : 'none';
                }
            });
        });
    }
}

/**
 * Sets up the click listener for selecting a client from the list in the "Open Client" modal.
 * @param {HTMLElement} modal - The modal element containing the client list.
 */
function setupClientListSelection(modal) {
    const clientListContainer = modal.querySelector('.client-list');
    if (!clientListContainer) return;

    clientListContainer.addEventListener('click', (event) => {
        const listItem = event.target.closest('.client-list-item');
        // Ensure a valid client item was clicked
        if (listItem && listItem.dataset.clientId) {
            const clientId = listItem.dataset.clientId;
            const clients = window.ConstructionApp?.ClientManager?.getAllClients() || [];
            const selectedClient = clients.find(c => c.id === clientId);

            if (selectedClient) {
                console.log("[Dashboard] Selecting client:", selectedClient.name);
                // Set the selected client as current using ClientManager
                 if (window.ConstructionApp && window.ConstructionApp.ClientManager) {
                      window.ConstructionApp.ClientManager.setCurrentClient(selectedClient);
                      updateDebugPanel(); // Update debug info
                      const overlay = modal.closest('.modal-overlay');
                      if (overlay) overlay.style.display = 'none'; // Close modal
                      alert(`Client "${selectedClient.name}" selected.`);
                 } else {
                      alert("Error: ClientManager not available to set the client.");
                 }
            } else {
                console.error("[Dashboard] Selected client ID not found in ClientManager list:", clientId);
                alert("Error: Could not find the selected client's data.");
            }
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
    // --- ADDED LOG ---
    console.log("DEBUG: renderDashboardContent START. Client:", client ? client.name : 'None');
    // --- END LOG ---
    const contentElement = document.getElementById('module-content');
    if (!contentElement) {
        console.error("[Dashboard] Main content element #module-content not found!");
        return;
    }

    // Preserve notification if it exists, otherwise clear
    const notificationElement = contentElement.querySelector('.no-client-notification');
    const notificationHtml = notificationElement ? notificationElement.outerHTML : '';
    // Let updateDashboard handle placing the notification correctly

    let tilesHTML = '';
    let hasAnyTiles = false; // Flag to check if we have any modules to display

    // Ensure appData.modules is available and is an array
    if (appData.modules && Array.isArray(appData.modules) && appData.modules.length > 0) {
        // Iterate through ALL defined modules in appData
        appData.modules.forEach(module => {
            // Skip rendering tiles for header-type modules in the main dashboard area
            if (module.type === 'header') {
                // --- ADDED LOG ---
                // console.log(`DEBUG: Skipping header module: ${module.name}`);
                // --- END LOG ---
                return; // Skip to the next module
            }

            hasAnyTiles = true; // Mark that we have at least one tile to show
            const moduleId = module.id;
            const moduleName = module.name;

            // --- Get Data Specific to this Module & Client ---
            let clientModuleData = null;
            let hasData = false; // Does this client have *any* data stored for this module?
            if (client && client.moduleData) {
                 const clientModuleVersionedData = client.moduleData[moduleId];
                 // Handle both old {data: ..., version: ...} structure and potentially direct data
                 clientModuleData = clientModuleVersionedData?.data ?? clientModuleVersionedData ?? null;
                 if (clientModuleData !== null) {
                      hasData = true;
                 }
            }

            // --- Calculate Cost ---
            let moduleCost = 0;
            if (hasData) {
                // Use totalCost property if available
                if (clientModuleData.totalCost !== undefined) {
                    moduleCost = parseFloat(clientModuleData.totalCost) || 0;
                }
                // Otherwise, try calculating from items array
                else if (clientModuleData.items && Array.isArray(clientModuleData.items)) {
                    if (window.ConstructionApp && window.ConstructionApp.ModuleUtils) {
                        moduleCost = window.ConstructionApp.ModuleUtils.calculateModuleTotal(clientModuleData.items);
                    } else {
                        console.warn(`[Dashboard] ModuleUtils not available for cost calculation on module ${moduleId}`);
                        // Fallback or error handling if ModuleUtils missing
                    }
                } else if (moduleId === 'notes') {
                    moduleCost = 0; // Notes module explicitly has no cost
                }
                 // else cost remains 0 if data exists but has no cost/items structure
            }
             // Cost is also 0 if !hasData (no client or no data for this module)

            // ** NEW LOG **
            // console.log(`DEBUG: Processing tile for ${moduleId} (${moduleName}). HasData: ${hasData}, Calculated Cost: ${moduleCost}`); // Can be noisy

            // --- Format & Prepare HTML ---
            const formattedCost = window.ConstructionApp?.ModuleUtils?.formatCurrency(moduleCost) ?? `R${moduleCost.toFixed(2)}`;

            // Show clear button only if there is data and it's not the notes module
            const clearButtonHtml = (hasData && moduleId !== 'notes') ? `<button class="clear-module-btn" title="Clear module data">×</button>` : '';

            // Disable open button if module requires client but none is selected
            const openButtonDisabled = (!client && module.requiresClient) ? 'disabled title="Select a client first"' : '';
            const openButtonHtml = `<button class="btn module-open-btn" style="margin-top: 10px;" ${openButtonDisabled}>Open Module</button>`;

            // Create cost display HTML, adding annotation if no data
            let costHtml = '';
            if (moduleId === 'notes') {
                 costHtml = '<p style="font-size: 0.9em; color: #666; margin-top: 10px;">(No cost associated)</p>';
            } else {
                 const noDataAnnotation = !hasData ? ' <small style="opacity: 0.7;"> (No data)</small>' : '';
                 costHtml = `<p class="module-tile-cost">${formattedCost}${noDataAnnotation}</p>`;
            }

            // Add tile HTML to the string
            tilesHTML += `
                <div class="module-tile ${!hasData ? 'no-client-data' : ''}" data-module-id="${moduleId}">
                    ${clearButtonHtml}
                    <h5>${moduleName}</h5>
                    ${costHtml}
                    ${openButtonHtml}
                </div>`;
        });
    }

    // --- Assemble Final Content ---
    // The notificationHtml is now handled by updateDashboard directly

    // Add wrapper for tiles section
    let tilesWrapperHtml = `<div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 10px;">
                              <h4 style="margin-bottom: 15px;">Module Summaries</h4>
                              <div id="module-tiles">`; // Grid styles applied via CSS

    if (hasAnyTiles) {
        tilesWrapperHtml += tilesHTML; // Add the generated tiles
        // --- ADDED LOG ---
        // console.log("DEBUG: Rendering module tiles container with tiles."); // Can be noisy
        // --- END LOG ---
    } else {
        // Message if no modules are defined at all
        tilesWrapperHtml += `<div style="background-color: white; padding: 15px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); grid-column: 1 / -1; text-align: center; color: #666;"><p>No modules defined in the system.</p><p style="margin-top: 5px;"><small>Add modules using the sidebar.</small></p></div>`;
        console.log("DEBUG: No module definitions found, showing 'No modules defined' message.");
    }
    tilesWrapperHtml += `</div></div>`; // Close #module-tiles and wrapper div

    // Append the tiles wrapper to the content element (after the notification, if any)
    // --- ADDED LOG ---
    console.log("DEBUG: Attempting to update #module-content innerHTML (appending tiles wrapper)...");
    // --- END LOG ---
    contentElement.innerHTML += tilesWrapperHtml;
    // --- ADDED LOG ---
    console.log("DEBUG: #module-content innerHTML update COMPLETE.");
    // --- END LOG ---


    // Re-attach listeners for the newly created tile buttons
    setupDashboardTileListeners();
    // --- ADDED LOG ---
    console.log("DEBUG: renderDashboardContent COMPLETE.");
    // --- END LOG ---
}


/**
 * Update the dashboard UI based on the current client - MODIFIED for new rendering.
 * This function is typically called by ClientManager.onClientChanged.
 * @param {object|null} client - The new client object, or null if logged out.
 */
function updateDashboard(client) {
    // --- ADDED LOG ---
    console.log("DEBUG: updateDashboard START - Client:", client ? client.name : 'None');
    // --- END LOG ---

    // Get references to UI elements
    const logoutBtn = document.getElementById('logout-btn');
    const dashboardContent = document.getElementById('module-content');
    const clientNameDisplay = document.getElementById('client-name-display');
    const dashboardDesc = document.querySelector('.dashboard-description'); // Header description area
    const totalProjectCostDisplay = document.getElementById('total-project-cost'); // Header total cost

    // --- ADDED LOG ---
    // Check if elements exist right at the start
    console.log(`DEBUG: Checking elements: logoutBtn=${!!logoutBtn}, dashboardContent=${!!dashboardContent}, clientNameDisplay=${!!clientNameDisplay}, dashboardDesc=${!!dashboardDesc}, totalProjectCostDisplay=${!!totalProjectCostDisplay}`);
    // --- END LOG ---

    // Ensure essential elements exist
    if (!dashboardContent || !clientNameDisplay || !dashboardDesc || !logoutBtn || !totalProjectCostDisplay) {
        console.error("[Dashboard] One or more essential dashboard UI elements missing, cannot update.");
        // --- ADDED LOG ---
        console.log("DEBUG: updateDashboard EXITING due to missing elements.");
        // --- END LOG ---
        return; // Stop execution if critical elements are missing
    }

    // --- Update UI based on whether a client is selected ---
    if (client) {
        // --- Client is Selected ---
        console.log("DEBUG: updateDashboard - Client is present. Updating UI.");
        clientNameDisplay.textContent = `Client: ${client.name}`;
        dashboardDesc.textContent = `${client.address || 'No address provided'}`;
        logoutBtn.style.display = 'inline-block';

        // Ensure logout button has the correct listener attached (clone/replace)
        const newLogoutBtn = logoutBtn.cloneNode(true);
        logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
        newLogoutBtn.addEventListener('click', () => {
            if (window.ConstructionApp && window.ConstructionApp.ModuleUtils) {
                window.ConstructionApp.ModuleUtils.logoutClient();
            } else {
                 console.error("Cannot logout: ModuleUtils not available.");
            }
        });

        // Clear the content area entirely before rendering tiles for a client
        dashboardContent.innerHTML = '';
        // --- ADDED LOG ---
        console.log("DEBUG: Cleared #module-content for client view.");
        console.log("DEBUG: Calling renderDashboardContent(client)...");
        // --- END LOG ---

        // Render the module tiles WITH the client's data
        renderDashboardContent(client);
        // --- ADDED LOG ---
        console.log("DEBUG: Calling updateTotalProjectCost()...");
        // --- END LOG ---
        // Update total project cost based on the client's data
        updateTotalProjectCost(); // This function should read from the current client internally

    } else {
        // --- No Client Selected ---
        console.log("DEBUG: updateDashboard - No client. Clearing client-specific UI and rendering empty tiles.");
        clientNameDisplay.textContent = ''; // Clear client name display
        totalProjectCostDisplay.textContent = 'Total Project Cost: R0.00'; // Reset total cost display
        dashboardDesc.textContent = 'Overview of project data.'; // Reset description
        logoutBtn.style.display = 'none'; // Hide logout button

        // Display the "No Client" notification message *first* by setting innerHTML
        dashboardContent.innerHTML = `<div class="no-client-notification" style="margin-bottom: 20px;"><h2>No Client Selected</h2><p>Please select an existing client or create a new client using the sidebar.</p></div>`;
        // --- ADDED LOG ---
        console.log("DEBUG: Set #module-content to 'No Client' notification.");
        console.log("DEBUG: Calling renderDashboardContent(null)...");
        // --- END LOG ---

        // Render the module tiles WITHOUT client data (will show defaults/empty states)
        // This will append the tiles container after the notification message
        renderDashboardContent(null);
    }

    // Update debug panel regardless of client state
    updateDebugPanel();
    // --- ADDED LOG ---
    console.log("DEBUG: updateDashboard COMPLETE.");
    // --- END LOG ---
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
         // This might happen temporarily if called before tiles are rendered
         // console.warn("[Dashboard] Module tiles container #module-tiles not found for attaching listeners.");
         return;
    }

    // Use event delegation on the container
    tilesContainer.removeEventListener('click', handleTileClick); // Prevent duplicates
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

    if (!tile) return; // Click wasn't inside a tile

    const moduleId = tile.dataset.moduleId;
    if (!moduleId) return; // Tile missing module ID

    if (openBtn && !openBtn.disabled) {
        // Navigate using ModuleUtils
         if (window.ConstructionApp && window.ConstructionApp.ModuleUtils) {
              window.ConstructionApp.ModuleUtils.navigateToModule(moduleId);
         } else {
              console.error("ModuleUtils not available for navigation!");
         }
    } else if (clearBtn) {
        // Find module name for confirmation message
        const moduleInfo = appData.modules.find(m => m.id === moduleId);
        const moduleName = moduleInfo ? moduleInfo.name : moduleId;
        // Confirm before clearing data
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
         console.warn(`[Dashboard] Cannot clear data: No client selected.`);
         window.ConstructionApp?.ModuleUtils?.showErrorMessage("No client selected.");
         return;
    }

    // Check if data actually exists for this module
    if (client.moduleData && client.moduleData.hasOwnProperty(moduleId)) {
        console.log(`[Dashboard] Clearing module data for: ${moduleId} for client ${client.name}`);

        // Use ClientManager to save null data for the module
        window.ConstructionApp.ClientManager.saveModuleData(moduleId, null, (success, error) => {
            if (success) {
                 console.log("[Dashboard] Module data cleared successfully via ClientManager.");
                // Manually update the client object in memory/sessionStorage AFTER successful save
                // to reflect the change immediately in the UI render
                if (client.moduleData) {
                    delete client.moduleData[moduleId]; // Remove the key
                     // Update the client object stored by ClientManager (which updates sessionStorage)
                     // Create a shallow copy to ensure change detection if ClientManager relies on object reference change
                     const updatedClient = { ...client };
                     window.ConstructionApp.ClientManager.setCurrentClient(updatedClient);
                     console.log("[Dashboard] Updated client session after clearing module.");
                }

                // Show success message
                window.ConstructionApp?.ModuleUtils?.showSuccessMessage(`Data for "${moduleId}" cleared.`);

                // Re-render the dashboard content to reflect the cleared tile
                // updateDashboard should handle re-rendering correctly now
                // renderDashboardContent(client); // Re-render with the updated client object
                // Recalculate the total project cost
                updateTotalProjectCost();

            } else {
                 console.error(`[Dashboard] Error clearing module data via ClientManager: ${error || 'Unknown'}`);
                 window.ConstructionApp?.ModuleUtils?.showErrorMessage(`Error clearing data: ${error || 'Unknown'}`);
            }
        });
    } else {
        console.warn(`[Dashboard] No data found for module ${moduleId} to clear.`);
        window.ConstructionApp?.ModuleUtils?.showSuccessMessage(`No data to clear for "${moduleId}".`); // Inform user
    }
}


/**
 * Update total project cost display in the header.
 * Reads data from the current client managed by ClientManager.
 */
function updateTotalProjectCost() {
    let totalCost = 0;
    const client = window.ConstructionApp?.ClientManager?.getCurrentClient();

    // ** NEW LOG **
    // console.log(`DEBUG: updateTotalProjectCost called. Client: ${client ? client.name : 'None'}`); // Can be noisy

    if (client && client.moduleData) {
        // console.log("DEBUG: Calculating total project cost. Module data keys:", Object.keys(client.moduleData)); // Log keys

        Object.entries(client.moduleData).forEach(([moduleId, moduleVersionedData]) => {
            // Handle both versioned {data: ...} and direct data storage
            const moduleData = moduleVersionedData?.data ?? moduleVersionedData ?? null;

            if (!moduleData) return; // Skip if no data for this module

            let costForThisModule = 0;
            // Check for totalCost property first
            if (moduleData.totalCost !== undefined) {
                costForThisModule = parseFloat(moduleData.totalCost) || 0;
            }
            // Otherwise, check for items array and calculate
            else if (moduleData.items && Array.isArray(moduleData.items)) {
                 if (window.ConstructionApp && window.ConstructionApp.ModuleUtils) {
                      costForThisModule = window.ConstructionApp.ModuleUtils.calculateModuleTotal(moduleData.items);
                 } else {
                      // console.warn(`[Dashboard] ModuleUtils not available for total cost calculation on module ${moduleId}`); // Can be noisy
                 }
            }
            // else cost remains 0

            // ** NEW LOG **
            // console.log(`DEBUG: Cost for ${moduleId}: ${costForThisModule}`); // Can be noisy
            totalCost += costForThisModule;
        });
    } else {
         // console.log("DEBUG: No client or moduleData found for total project cost calculation."); // Can be noisy
    }

    // Update the display element
    const formattedTotal = window.ConstructionApp?.ModuleUtils?.formatCurrency(totalCost) ?? `R${totalCost.toFixed(2)}`;
    const totalCostElement = document.getElementById('total-project-cost');

    // ** NEW LOG **
    // console.log(`DEBUG: Final calculated total project cost: ${totalCost}, Formatted: ${formattedTotal}`); // Can be noisy

    if (totalCostElement) {
        totalCostElement.textContent = `Total Project Cost: ${formattedTotal}`;
        // console.log("[Dashboard] Updated total project cost display in UI."); // Can be noisy
    } else {
         console.warn("[Dashboard] Total project cost display element not found.");
    }
}


// --- Debug Panel ---

/**
 * Sets up the debug panel toggle button.
 */
function setupDebugPanel() {
    const debugPanel = document.getElementById('debug-panel');
    let toggleBtn = document.getElementById('debug-toggle-btn');

    // Only proceed if the debug panel exists
    if (!debugPanel) {
         // console.log("[Dashboard] Debug panel element not found, skipping setup.");
         return;
    }

    // Create toggle button if it doesn't exist
    if (!toggleBtn) {
        console.log("[Dashboard] Debug toggle button not found, creating it.");
        toggleBtn = document.createElement('button');
        toggleBtn.textContent = 'Debug';
        toggleBtn.id = 'debug-toggle-btn';
        // Apply necessary styles directly
        toggleBtn.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            z-index: 10000;
            padding: 5px 10px;
            background: #333;
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            opacity: 0.8;
            font-size: 12px;
        `;
        document.body.appendChild(toggleBtn);
    }

     // Ensure button is visible (might be hidden by default CSS)
     toggleBtn.style.display = 'block';


    // Add click listener to toggle the debug panel visibility
    toggleBtn.removeEventListener('click', toggleDebugPanel); // Prevent duplicates
    toggleBtn.addEventListener('click', toggleDebugPanel);
    console.log("[Dashboard] Debug panel setup complete.");
}

/**
* Toggles the visibility of the debug panel.
*/
function toggleDebugPanel() {
     const debugPanel = document.getElementById('debug-panel');
     const toggleBtn = document.getElementById('debug-toggle-btn');
     if (!debugPanel || !toggleBtn) return;

     const isVisible = debugPanel.style.display === 'block';
     debugPanel.style.display = isVisible ? 'none' : 'block';
     toggleBtn.textContent = isVisible ? 'Debug' : 'Hide Debug';
     // Update content only when showing
     if (!isVisible) {
         updateDebugPanel();
     }
}


/**
 * Updates the content of the debug panel with current state information.
 */
function updateDebugPanel() {
    const debugPanel = document.getElementById('debug-panel');
    // Only update if the panel exists and is visible
    if (!debugPanel || debugPanel.style.display !== 'block') {
        return;
    }

    // Gather debug information
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

    // Add client module data summary if client exists
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

    // Add module structure summary
    debugInfo += '<strong>Module Structure (appData - Top 5):</strong><br><pre style="max-height: 150px; overflow-y: auto; border: 1px solid #555; padding: 5px; font-size: 11px;">';
    debugInfo += JSON.stringify(appData.modules?.slice(0, 5).map(m => ({id: m.id, name: m.name, type: m.type, parentId: m.parentId, order: m.order})) || [], null, 1);
    debugInfo += '</pre>';

    // Update the panel's content
    debugPanel.innerHTML = debugInfo;
}

// --- Helper Functions --- (Keep if used, e.g., setupModuleClickHandler if needed)
// Example:
// function setupModuleClickHandler(moduleElement) { /* ... */ }
