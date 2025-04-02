// js/dashboard.js
// Revised dashboard logic with enhanced logging and state handling.

// --- Global Variables ---
let appData = {
    modules: [] // Holds the structure {id, name, requiresClient, type, parentId, order}
};
let globalDraggedItem = null;
let headerCollapseState = {}; // Stores collapsed state { headerId: true/false }

// --- Utility / Helper Functions (Define Search Function Early) ---

/**
 * Sets up the module search input to filter the sidebar list.
 */
function setupModuleSearch() {
    const searchInput = document.getElementById('module-search-input');
    const container = document.getElementById('modules-container');
    if (!searchInput || !container) {
        console.error("[Dashboard] Search input or module container not found.");
        return;
    }

    // Debounce function to limit how often filtering runs
    let debounceTimer;
    const debounceFilter = (func, delay) => {
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => func.apply(context, args), delay);
        };
    };

    const filterModules = () => {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const allModuleElements = container.querySelectorAll('.module-item'); // Get currently rendered elements
        const visibleModuleIds = new Set(); // Track IDs that should be visible based on search

        // If search term is empty, show all modules respecting collapse state
        if (searchTerm === '') {
            renderModuleList(appData.modules); // Re-render to reset visibility based on collapse state
            return;
        }

        // Find matches and their ancestors using the current appData state
        appData.modules.forEach(module => {
            const moduleName = module.name.toLowerCase();
            const isMatch = moduleName.includes(searchTerm);

            if (isMatch) {
                // If a module matches, mark it and all its ancestors for visibility
                visibleModuleIds.add(module.id);
                let currentParentId = module.parentId;
                while (currentParentId && currentParentId !== 'null') {
                    visibleModuleIds.add(currentParentId);
                    const parentModule = appData.modules.find(m => m.id === currentParentId);
                    currentParentId = parentModule ? parentModule.parentId : null;
                }
            }
        });

        // Set visibility based on the collected IDs
        allModuleElements.forEach(moduleEl => {
            const moduleId = moduleEl.dataset.moduleId;
            const isHeader = moduleEl.dataset.moduleType === 'header';
            const isParentCollapsed = () => {
                 let parentEl = moduleEl.previousElementSibling;
                 let currentLevel = parseInt(moduleEl.dataset.level || '0');
                 while(parentEl && parseInt(parentEl.dataset.level || '-1') >= currentLevel -1) {
                      if(parseInt(parentEl.dataset.level || '-1') === currentLevel - 1 && parentEl.classList.contains('collapsed')) {
                           return true; // Hidden by collapsed parent
                      }
                      parentEl = parentEl.previousElementSibling;
                 }
                 return false;
            };


            if (visibleModuleIds.has(moduleId)) {
                 // Show if it matches or is an ancestor of a match,
                 // UNLESS it's hidden by a collapsed parent (which search shouldn't override)
                 if (!isParentCollapsed()) {
                    moduleEl.style.display = 'flex';
                 } else {
                    moduleEl.style.display = 'none';
                 }

                 // If it's a header that should be visible, ensure it's expanded
                 // This prevents finding a child but not seeing the parent header
                 if (isHeader) {
                      moduleEl.classList.remove('collapsed'); // Expand headers in search results
                      // Note: This doesn't persist the expanded state after search clears
                 }

            } else {
                moduleEl.style.display = 'none'; // Hide non-matching items
            }
        });
    };

    // Attach the debounced filter function to the input event
    searchInput.addEventListener('input', debounceFilter(filterModules, 300)); // Debounce slightly longer
    console.log("[Dashboard] Module search listener attached.");
}


// --- Initialization ---
document.addEventListener('DOMContentLoaded', function() {
    console.log("[Dashboard] DOM loaded, initializing app...");
    setupDebugPanel(); // Set up early for logging

    // Load module structure first, as it's needed for client checks etc.
    loadAndRenderModules().then(() => {
        console.log("[Dashboard] Modules loaded/rendered. Proceeding with app init.");
        initApp(); // Initialize client state AFTER modules are known
        setupDropdownMenus(); // Sets up global close listener AND collapse listener
        setupClientManagement();
        setupAddModuleButton();
        setupModuleSearch(); // Setup search after modules are loaded

        // Load client list (doesn't block UI)
        window.ConstructionApp.ClientManager.loadClients().then((clients) => {
            console.log("[Dashboard] Client list loaded in background:", clients.length);
            // Optionally update client selection modal if already open
        });

        // Set the callback for when the client changes
        window.ConstructionApp.ClientManager.onClientChanged = updateDashboard;

        // Setup initial DnD for the rendered module list
        setupDragAndDrop();

        console.log("[Dashboard] Initialization complete.");

    }).catch(error => {
         console.error("[Dashboard] CRITICAL ERROR during initial module load/render:", error);
         // Display error to user?
         document.getElementById('modules-container').innerHTML = '<p style="color: red; padding: 10px;">Error loading modules. Please refresh.</p>';
    });
});

/**
 * Initializes the application state, particularly the current client,
 * based on navigation state stored in sessionStorage.
 */
function initApp() {
    console.log("[Dashboard:initApp] Initializing application state...");
    const navigationState = sessionStorage.getItem('navigationState');
    const storedClientStr = sessionStorage.getItem('currentClient');
    let clientToSet = null;

    console.log(`[Dashboard:initApp] Retrieved navigationState: ${navigationState}`);
    console.log(`[Dashboard:initApp] Retrieved storedClientStr: ${storedClientStr ? storedClientStr.substring(0, 100) + '...' : 'None'}`); // Log first part

    if (navigationState === 'returningToDashboard' && storedClientStr) {
        console.log("[Dashboard:initApp] Detected 'returningToDashboard' state with stored client data.");
        try {
            clientToSet = JSON.parse(storedClientStr);
            console.log("[Dashboard:initApp] Successfully parsed client from sessionStorage:", clientToSet?.name);
        } catch (error) {
            console.error("[Dashboard:initApp] Error parsing stored client:", error);
            console.error("[Dashboard:initApp] Failing storedClientStr:", storedClientStr); // Log the problematic string
            sessionStorage.removeItem('currentClient'); // Remove invalid data
            clientToSet = null;
            alert("Error loading client session. Please select the client again."); // Inform user
        }
    } else if (navigationState === 'manualLogout' || navigationState === 'invalidAccess') {
        console.log("[Dashboard:initApp] Detected 'manualLogout' or 'invalidAccess' state. Ensuring client is cleared.");
        // Client should already be cleared by the action triggering these states, but ensure it here.
        clientToSet = null;
        sessionStorage.removeItem('currentClient'); // Make sure it's removed
    } else if (!navigationState && storedClientStr) {
        // Fresh page load (or reload) but client data exists in session storage
        console.log("[Dashboard:initApp] Detected fresh load with existing client data in sessionStorage.");
        try {
            clientToSet = JSON.parse(storedClientStr);
            console.log("[Dashboard:initApp] Successfully parsed client from sessionStorage on fresh load:", clientToSet?.name);
        } catch (error) {
            console.error("[Dashboard:initApp] Error parsing stored client on fresh load:", error);
            console.error("[Dashboard:initApp] Failing storedClientStr:", storedClientStr);
            sessionStorage.removeItem('currentClient');
            clientToSet = null;
            alert("Error loading previous client session. Please select the client again.");
        }
    } else {
        // No specific navigation state, and no client in session storage
        console.log("[Dashboard:initApp] No specific navigation state and no client in sessionStorage. Starting fresh.");
        clientToSet = null;
    }

    console.log("[Dashboard:initApp] Setting client via ClientManager:", clientToSet ? clientToSet.name : "None");
    // Set the client using ClientManager (this will also trigger onClientChanged -> updateDashboard)
    window.ConstructionApp.ClientManager.setCurrentClient(clientToSet);

    // Clear the navigation state flag *after* processing it
    // Avoids issues if page reloads before processing is complete
    console.log("[Dashboard:initApp] Removing navigationState from sessionStorage.");
    sessionStorage.removeItem('navigationState');

    // Update total cost based on the potentially restored client
    updateTotalProjectCost();
    updateDebugPanel(); // Update debug panel with initial state
}


// --- Module Loading and Rendering ---
/**
 * Loads module structure from Firebase (with fallback) and renders the list.
 * Ensures 'notes' module exists.
 */
async function loadAndRenderModules() {
    console.log("[Dashboard] Loading and rendering modules...");
    let loadedModules = [];

    try {
        // Attempt to load from Firebase first
        loadedModules = await window.ConstructionApp.Firebase.loadModules();
        console.log("[Dashboard] Loaded modules from Firebase:", loadedModules.length);

        if (!loadedModules || loadedModules.length === 0) {
            console.warn("[Dashboard] No modules in Firebase or empty array returned, trying backup.");
            loadedModules = restoreModuleOrderFromBackup() || []; // Get from sessionStorage backup

            if (loadedModules.length === 0) {
                console.warn("[Dashboard] Backup empty or failed. Using default modules.");
                loadedModules = getDefaultModules();
                // Attempt to save defaults back to Firebase
                await window.ConstructionApp.Firebase.saveModules(loadedModules);
                console.log("[Dashboard] Saved default modules to Firebase.");
            }
        }
    } catch (error) {
        console.error("[Dashboard] Error loading modules from Firebase, trying backup:", error);
        loadedModules = restoreModuleOrderFromBackup() || []; // Get from sessionStorage backup

        if (loadedModules.length === 0) {
            console.warn("[Dashboard] Backup failed/empty after Firebase error. Using default modules.");
            loadedModules = getDefaultModules();
             // Attempt to save defaults back to Firebase even after error
             try {
                await window.ConstructionApp.Firebase.saveModules(loadedModules);
                console.log("[Dashboard] Saved default modules to Firebase after initial load error.");
             } catch (saveError) {
                 console.error("[Dashboard] Failed to save default modules after load error:", saveError);
             }
        }
    }

    // --- Ensure 'notes' module exists ---
    const notesModuleIndex = loadedModules.findIndex(m => m.id === 'notes');
    let notesModuleData;
    if (notesModuleIndex > -1) {
        // Get existing notes module data
        notesModuleData = loadedModules.splice(notesModuleIndex, 1)[0];
    } else {
        // Create default notes module data if not found
        console.log("[Dashboard] 'notes' module not found, creating default.");
        notesModuleData = { id: 'notes', name: 'Notes', requiresClient: true, type: 'regular', parentId: null, order: -1 };
        // We will add this back at the beginning
    }
    // Ensure required properties are set (merging defaults with loaded data)
    notesModuleData = {
        id: 'notes',
        name: notesModuleData.name || 'Notes',
        requiresClient: notesModuleData.requiresClient !== undefined ? notesModuleData.requiresClient : true,
        type: notesModuleData.type || 'regular',
        parentId: notesModuleData.parentId !== undefined ? notesModuleData.parentId : null,
        order: notesModuleData.order !== undefined ? notesModuleData.order : -1 // Keep original order or default to -1
    };
    // Add/Re-add notes module to the beginning of the list
    loadedModules.unshift(notesModuleData);
    // --- End 'notes' module handling ---


    // Assign default render/save functions (can be overridden by specific module JS)
    appData.modules = loadedModules.map(mod => ({
        ...mod, // Spread existing properties
        // Default render template (can be replaced by specific module logic)
        renderTemplate: function(client) {
            const moduleData = client?.moduleData?.[mod.id] || {}; // Get client-specific data
            if (mod.id === 'notes') {
                const notesText = typeof moduleData === 'string' ? moduleData : (moduleData.notes || ''); // Handle old string format and new object format
                return `
                    <div class="module-content-box">
                        <h3>Project Notes</h3>
                        <textarea id="project-notes" rows="15" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; margin-top: 10px;" placeholder="Enter project notes here...">${notesText}</textarea>
                        <div class="module-controls" style="margin-top: 15px; text-align: right;">
                             <span id="save-status-notes" class="save-status"></span>
                             <button class="btn module-save-btn" data-module="notes">Save Notes</button>
                        </div>
                    </div>`;
            }
            // Default for other modules if no specific HTML/JS exists
            return `
                 <div class="module-content-box">
                    <h3>${mod.name}</h3>
                    <p>Data for this module:</p>
                    <pre style="background-color: #f5f5f5; border: 1px solid #ddd; padding: 10px; border-radius: 4px; max-height: 300px; overflow: auto;">${JSON.stringify(moduleData, null, 2)}</pre>
                    <p style="margin-top: 15px;"><small><i>To customize this view, create a corresponding <code>${mod.id}.html</code> page and potentially a <code>${mod.id}.js</code> file.</i></small></p>
                     <div class="module-controls" style="margin-top: 15px; text-align: right;">
                         <span id="save-status-${mod.id}" class="save-status"></span>
                         <button class="btn module-save-btn" data-module="${mod.id}" disabled title="Default view cannot save">Save (Default)</button>
                     </div>
                 </div>`;
        },
        // Default save data function (can be replaced by specific module logic)
        saveData: function() {
            if (mod.id === 'notes') {
                const notes = document.getElementById('project-notes')?.value || '';
                // Save as an object for consistency, even though it's just one field
                return { notes: notes };
            }
            // Default modules have no data saving logic here
            console.warn(`[Dashboard] Default saveData called for module ${mod.id}. No data saved.`);
            return {}; // Return empty object for non-notes default modules
        }
    }));

    // Initial render of the module list sidebar
    renderModuleList(appData.modules);
}

/**
 * Gets default module definitions if none are loaded.
 */
function getDefaultModules() {
    console.log("[Dashboard] Getting default module definitions.");
    // Note: 'notes' is handled separately in loadAndRenderModules
    return [
        { id: 'p-and-gs', name: 'P&G\'s', requiresClient: true, type: 'regular', parentId: null, order: 1 },
        { id: 'foundations-header', name: 'Foundations', requiresClient: false, type: 'header', parentId: null, order: 2 }, // Renamed ID to avoid conflict if a 'foundations' module page exists
        { id: 'earthworks', name: 'Earthworks', requiresClient: true, type: 'regular', parentId: 'foundations-header', order: 0 },
        { id: 'concrete', name: 'Concrete', requiresClient: true, type: 'regular', parentId: 'foundations-header', order: 1 },
        { id: 'steel', name: 'Steel', requiresClient: true, type: 'regular', parentId: 'foundations-header', order: 2 },
        { id: 'structure-header', name: 'Structure', requiresClient: false, type: 'header', parentId: null, order: 3 }, // Renamed ID
        { id: 'brickwork', name: 'Brickwork', requiresClient: true, type: 'regular', parentId: 'structure-header', order: 0 },
        { id: 'demolish', name: 'Demolish', requiresClient: true, type: 'regular', parentId: null, order: 4 },
    ];
}

/**
 * Renders the module list hierarchically in the sidebar, respecting collapse state.
 * @param {Array} modules - The complete list of module objects from appData.
 */
function renderModuleList(modules) {
    const container = document.getElementById('modules-container');
    if (!container) {
        console.error("[Dashboard] Module container not found for rendering.");
        return;
    }
    container.innerHTML = ''; // Clear previous list
    // Sort modules primarily by order, then by name for consistent ordering
    const sortedModules = [...modules].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.name.localeCompare(b.name));

    // Function to recursively render modules
    function renderLevel(parentId, level) {
        sortedModules
            .filter(m => m.parentId === parentId) // Get children of the current parent
            .forEach(module => {
                // Create the element
                const moduleElement = createModuleElement(module, level);
                container.appendChild(moduleElement);

                // Check collapse state before rendering children
                const isHeader = module.type === 'header';
                const isCollapsed = headerCollapseState[module.id] === true; // Check state

                // Only render children if it's not a collapsed header
                if (!isHeader || !isCollapsed) {
                    renderLevel(module.id, level + 1); // Recursive call for children
                }
            });
    }
    renderLevel(null, 0); // Start rendering top-level modules (parentId is null)
    setupDragAndDrop(); // Re-attach DnD listeners after re-render
    updateDebugPanel(); // Update debug info after render
}


/**
 * Creates a DOM element for a single module AND attaches its specific listeners.
 * Adds collapse icon and state class for headers.
 * @param {object} moduleData - The module data object from appData.modules.
 * @param {number} level - The hierarchy level (for indentation).
 * @returns {HTMLElement} The created module element.
 */
function createModuleElement(moduleData, level = 0) {
    const moduleElement = document.createElement('div');
    moduleElement.className = 'module-item';
    moduleElement.draggable = true; // Make draggable
    moduleElement.setAttribute('data-module-id', moduleData.id);
    moduleElement.setAttribute('data-requires-client', moduleData.requiresClient ? 'true' : 'false');
    moduleElement.setAttribute('data-module-type', moduleData.type || 'regular');
    moduleElement.setAttribute('data-parent-id', moduleData.parentId || 'null');
    moduleElement.setAttribute('data-level', level);
    // Adjust padding based on level for visual hierarchy
    moduleElement.style.paddingLeft = `${20 + level * 15}px`;

    let collapseIconHTML = '';
    const isHeader = moduleData.type === 'header';
    if (isHeader) {
        moduleElement.classList.add('header-item');
        const isCollapsed = headerCollapseState[moduleData.id] === true;
        if (isCollapsed) {
            moduleElement.classList.add('collapsed');
        }
        // Use a more common icon for collapse/expand
        collapseIconHTML = `<span class="collapse-icon" title="Expand/Collapse">${isCollapsed ? '►' : '▼'}</span>`; // Right arrow for collapsed, down for expanded
    }

    // Determine icon based on type (example)
    let moduleTypeIcon = '📄'; // Default icon (document)
    if (isHeader) moduleTypeIcon = '📁'; // Folder for header
    if (moduleData.id === 'notes') moduleTypeIcon = '📝'; // Notes icon
    if (!moduleData.requiresClient) moduleTypeIcon += ' <span title="Global Module (No Client Needed)">⚙️</span>'; // Gear for global/config modules

    // Module element HTML structure
    moduleElement.innerHTML = `
        <div class="module-drag-handle" title="Drag to reorder">≡</div>
        ${collapseIconHTML}
        <div class="module-icon" title="Type: ${isHeader ? 'Header' : 'Module'}">
             ${moduleTypeIcon}
             <div class="dropdown-menu">
                 <div class="dropdown-item edit-module">Edit Name</div>
                 <div class="dropdown-item delete-module">Delete</div>
             </div>
        </div>
        <span class="module-name">${moduleData.name}</span>
    `;

    // --- Attach Direct Event Listeners ---
    const editBtn = moduleElement.querySelector('.edit-module');
    const deleteBtn = moduleElement.querySelector('.delete-module');
    const icon = moduleElement.querySelector('.module-icon'); // The '...' icon container
    const nameSpan = moduleElement.querySelector('.module-name'); // The clickable name

    // Edit button listener
    if (editBtn) {
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering other clicks (like name navigation)
            console.log("Edit button clicked for:", moduleElement.dataset.moduleId);
            editModule(moduleElement);
            closeAllDropdowns();
        });
    } else { console.warn("Could not find edit button for module:", moduleData.id); }

    // Delete button listener
    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log("Delete button clicked for:", moduleElement.dataset.moduleId);
            deleteModule(moduleElement);
            closeAllDropdowns();
        });
    } else { console.warn("Could not find delete button for module:", moduleData.id); }

    // Listener for the icon itself to toggle the dropdown
    if (icon) {
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = icon.querySelector('.dropdown-menu');
            if (dropdown) {
                const isVisible = dropdown.style.display === 'block';
                closeAllDropdowns(); // Close others before opening/closing this one
                if (!isVisible) {
                    dropdown.style.display = 'block';
                    // Position dropdown relative to icon if needed (can be complex)
                }
            }
        });
    }

    // Listener for the module name to navigate
    if (nameSpan) {
        nameSpan.addEventListener('click', (e) => {
             // Prevent navigation if clicking on a header (headers might not have pages)
             // Or allow navigation if headers *do* have summary pages
             // Current assumption: only navigate for non-header modules
            if (moduleData.type !== 'header') {
                const moduleId = moduleElement.getAttribute('data-module-id');
                console.log("Module name clicked, navigating to:", moduleId);
                window.ConstructionApp.ModuleUtils.navigateToModule(moduleId);
            } else {
                 console.log("Header name clicked, toggling collapse instead of navigating:", moduleData.id);
                 // Optionally toggle collapse when header name is clicked
                 handleCollapseToggle(moduleData.id);
            }
        });
    }

    return moduleElement;
}


// --- Module Creation ---
/**
 * Sets up the 'Add New Module' button and modal interactions.
 */
function setupAddModuleButton() {
    const addModuleBtn = document.getElementById('add-module-btn');
    const modalOverlay = document.getElementById('add-module-modal-overlay');
    const moduleTypeSelect = document.getElementById('new-module-type');
    const parentHeaderGroup = document.getElementById('parent-header-group');
    const parentHeaderSelect = document.getElementById('parent-header-select');
    const saveNewModuleBtn = document.getElementById('save-new-module-btn');
    const modalCloseBtns = modalOverlay?.querySelectorAll('.modal-close, .btn-cancel'); // Use optional chaining

    if (!modalOverlay || !addModuleBtn || !moduleTypeSelect || !parentHeaderGroup || !parentHeaderSelect || !saveNewModuleBtn || !modalCloseBtns) {
        console.error("[Dashboard] One or more elements for 'Add Module' modal not found. Aborting setup.");
        return;
    }

    // Show modal when 'Add Module' button is clicked
    addModuleBtn.addEventListener('click', () => {
        // Populate parent header dropdown
        parentHeaderSelect.innerHTML = '<option value="null">(Top Level / No Parent)</option>'; // Reset
        appData.modules
            .filter(m => m.type === 'header') // Only list headers
            .sort((a, b) => a.name.localeCompare(b.name)) // Sort alphabetically
            .forEach(header => {
                const option = document.createElement('option');
                option.value = header.id;
                option.textContent = header.name;
                parentHeaderSelect.appendChild(option);
            });

        // Reset form fields
        document.getElementById('new-module-name').value = '';
        moduleTypeSelect.value = 'regular'; // Default to regular module
        parentHeaderGroup.style.display = 'block'; // Show parent select by default
        parentHeaderSelect.value = 'null'; // Default to top level
        document.getElementById('new-module-requires-client').checked = true; // Default to requiring client

        // Show the modal
        modalOverlay.style.display = 'flex';
    });

    // Toggle parent selection visibility based on module type
    moduleTypeSelect.addEventListener('change', function() {
        parentHeaderGroup.style.display = this.value === 'regular' ? 'block' : 'none';
        if (this.value === 'header') {
             parentHeaderSelect.value = 'null'; // Headers cannot have parents in this structure
        }
    });

    // Close modal listeners (buttons and overlay click)
    modalCloseBtns.forEach(btn => {
        // Clone and replace to remove potential old listeners
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', () => modalOverlay.style.display = 'none');
    });
    modalOverlay.addEventListener('click', (event) => {
        // Close if clicking on the overlay itself, not the modal content
        if (event.target === modalOverlay) {
            modalOverlay.style.display = 'none';
        }
    });

    // Save button listener (clone and replace)
    const newSaveBtn = saveNewModuleBtn.cloneNode(true);
    saveNewModuleBtn.parentNode.replaceChild(newSaveBtn, saveNewModuleBtn);
    newSaveBtn.addEventListener('click', addNewModule); // Attach the add function
    console.log("[Dashboard] 'Add Module' button and modal setup complete.");
}

/**
 * Handles adding a new module based on modal form input.
 */
function addNewModule() {
    const moduleNameInput = document.getElementById('new-module-name');
    const moduleTypeSelect = document.getElementById('new-module-type');
    const parentHeaderSelect = document.getElementById('parent-header-select');
    const requiresClientCheckbox = document.getElementById('new-module-requires-client');

    const moduleName = moduleNameInput.value.trim();
    const moduleType = moduleTypeSelect.value;
    // Headers are always top-level (parentId=null). Regular modules can have a parent or be top-level.
    const parentId = moduleType === 'header' ? null : (parentHeaderSelect.value === 'null' ? null : parentHeaderSelect.value);
    const requiresClient = requiresClientCheckbox.checked;

    // --- Validation ---
    if (!moduleName) {
        alert("Module name is required.");
        moduleNameInput.focus();
        return;
    }
    // Basic sanitization for ID - allow letters, numbers, hyphen, underscore
    const moduleId = moduleName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');
    if (!moduleId) {
         alert("Invalid module name (results in empty ID). Use letters, numbers, spaces, hyphens, underscores.");
         moduleNameInput.focus();
         return;
    }
    if (appData.modules.some(m => m.id === moduleId)) {
        alert(`A module or header with the ID "${moduleId}" already exists. Please choose a different name.`);
        moduleNameInput.focus();
        return;
    }
    // --- End Validation ---

    // Determine the order for the new module
    let order = 0;
    const siblings = appData.modules.filter(m => m.parentId === parentId);
    if (siblings.length > 0) {
        // Place it after the last sibling
        order = Math.max(...siblings.map(m => m.order ?? -1)) + 1;
    } // Otherwise, order remains 0 (first item at its level)

    // Create the new module data object
    const newModuleData = {
        id: moduleId,
        name: moduleName,
        requiresClient: requiresClient,
        type: moduleType,
        parentId: parentId,
        order: order,
        // Add default render/save functions (will be overwritten if specific JS exists)
        renderTemplate: function(client) { return `<h3>${moduleName}</h3><p>Default content for new module.</p>`; },
        saveData: function() { return {}; }
    };

    console.log("[Dashboard] Adding new module:", newModuleData);
    appData.modules.push(newModuleData); // Add to the local state

    renderModuleList(appData.modules); // Re-render the sidebar
    saveModuleStructure(); // Save the updated structure to Firebase/backup

    document.getElementById('add-module-modal-overlay').style.display = 'none'; // Close modal
    window.ConstructionApp.ModuleUtils.showSuccessMessage(`Module "${moduleName}" created successfully.`);
}


// --- Module Structure Saving ---
/**
 * Saves the current module structure (order, hierarchy, names) to Firebase and sessionStorage backup.
 */
function saveModuleStructure() {
    console.log("[Dashboard] Saving module structure...");
    // Prepare modules for saving - only include necessary properties
    const modulesToSave = appData.modules.map(module => ({
        id: module.id,
        name: module.name,
        requiresClient: module.requiresClient,
        type: module.type || 'regular', // Ensure type is saved
        parentId: module.parentId,
        order: module.order ?? 0 // Ensure order is saved
    }));

    // Optional: Sort before saving for consistency in the database (though order property is primary)
    // modulesToSave.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || (a.parentId ?? '').localeCompare(b.parentId ?? '') || a.name.localeCompare(b.name));

    console.log("[Dashboard] Modules prepared for saving:", modulesToSave.length);
    updateDebugPanel(); // Show structure being saved

    // Save to Firebase
    if (window.ConstructionApp.Firebase) {
        window.ConstructionApp.Firebase.saveModules(modulesToSave)
            .then(success => {
                if (success) {
                    console.log("[Dashboard] Module structure successfully saved to Firebase.");
                    // Backup to sessionStorage AFTER successful Firebase save
                    try {
                         sessionStorage.setItem('moduleOrder', JSON.stringify(modulesToSave));
                         console.log("[Dashboard] Module structure backup saved to sessionStorage.");
                    } catch (e) {
                         console.error("[Dashboard] Error saving module structure backup to sessionStorage (Quota?):", e);
                    }
                } else {
                    console.warn("[Dashboard] Firebase.saveModules reported failure (but no error thrown). Structure might not be saved.");
                     // Still save backup even if Firebase reported failure? Maybe.
                     try {
                          sessionStorage.setItem('moduleOrder', JSON.stringify(modulesToSave));
                          console.warn("[Dashboard] Saved structure backup to sessionStorage despite potential Firebase issue.");
                     } catch (e) {
                          console.error("[Dashboard] Error saving module structure backup to sessionStorage (Quota?):", e);
                     }
                }
            })
            .catch(error => {
                console.error("[Dashboard] Error saving module structure to Firebase:", error);
                // Save backup to sessionStorage as a fallback
                 try {
                    sessionStorage.setItem('moduleOrder', JSON.stringify(modulesToSave));
                    console.warn("[Dashboard] Saved structure to sessionStorage backup due to Firebase save error.");
                 } catch (e) {
                     console.error("[Dashboard] Error saving module structure backup to sessionStorage (Quota?):", e);
                 }
            });
    } else {
        // Firebase not available, save only to backup
        console.warn("[Dashboard] Firebase not available, saving structure to sessionStorage backup only.");
         try {
            sessionStorage.setItem('moduleOrder', JSON.stringify(modulesToSave));
         } catch (e) {
             console.error("[Dashboard] Error saving module structure backup to sessionStorage (Quota?):", e);
         }
    }
}

/**
 * Restores module structure from sessionStorage backup if Firebase fails.
 * @returns {Array|null} Array of module objects or null if no backup.
 */
function restoreModuleOrderFromBackup() {
    const savedOrder = sessionStorage.getItem('moduleOrder');
    if (savedOrder) {
        try {
            const orderData = JSON.parse(savedOrder);
            console.log("[Dashboard] Restoring structure from sessionStorage backup:", orderData.length, "modules");
            // Ensure basic structure integrity
            if (Array.isArray(orderData)) {
                // Map to ensure required fields exist, providing defaults if necessary
                return orderData.map(mod => ({
                    id: mod.id || `missing-id-${Date.now()}`, // Add fallback ID
                    name: mod.name || 'Unnamed Module',
                    requiresClient: mod.requiresClient !== undefined ? mod.requiresClient : true,
                    type: mod.type || 'regular',
                    parentId: (mod.parentId === undefined || mod.parentId === 'null') ? null : mod.parentId,
                    order: mod.order ?? 0
                }));
            } else {
                 console.error("[Dashboard] Backup data is not an array.");
                 sessionStorage.removeItem('moduleOrder'); // Remove invalid backup
                 return null;
            }
        } catch (error) {
            console.error("[Dashboard] Error parsing module structure backup:", error);
            sessionStorage.removeItem('moduleOrder'); // Remove corrupted backup
        }
    } else {
        console.warn("[Dashboard] No module structure backup found in sessionStorage.");
    }
    return null;
}


// --- Drag and Drop ---
let dragOverElement = null; // Element being dragged over
let dropIndicator = null; // 'top', 'bottom', or 'middle'

/**
 * Sets up main drag and drop event listeners on the modules container.
 */
function setupDragAndDrop() {
    const container = document.getElementById('modules-container');
    if (!container) return;

    // Remove old listeners before adding new ones (important after re-renders)
    container.removeEventListener('dragstart', handleDragStart);
    container.addEventListener('dragstart', handleDragStart);

    container.removeEventListener('dragover', handleDragOver);
    container.addEventListener('dragover', handleDragOver);

    container.removeEventListener('dragleave', handleDragLeave);
    container.addEventListener('dragleave', handleDragLeave);

    container.removeEventListener('drop', handleDrop);
    container.addEventListener('drop', handleDrop);

    container.removeEventListener('dragend', handleDragEnd);
    container.addEventListener('dragend', handleDragEnd);
    // console.log("[Dashboard] Drag and Drop listeners attached/re-attached.");
}

/**
 * Handles the start of a drag operation.
 */
function handleDragStart(e) {
    // Ensure we're dragging a module item by checking the target or its parent
    const target = e.target.closest('.module-item');
    // Only allow dragging if the target is draggable (might be disabled for some items)
    if (!target || !target.draggable) {
        e.preventDefault();
        return;
    }

    globalDraggedItem = target; // Store the element being dragged
    e.dataTransfer.setData('text/plain', target.dataset.moduleId); // Set data for transfer
    e.dataTransfer.effectAllowed = 'move'; // Indicate the type of operation

    // Add dragging class slightly later for visual feedback
    setTimeout(() => {
        if (globalDraggedItem) globalDraggedItem.classList.add('dragging');
    }, 0);
    console.log("[DnD] Drag Start:", target.dataset.moduleId);
}

/**
 * Handles dragging over a potential drop target.
 */
function handleDragOver(e) {
    e.preventDefault(); // Necessary to allow dropping
    e.dataTransfer.dropEffect = 'move'; // Visual cue

    const targetElement = e.target.closest('.module-item');

    // Ignore if dragging over itself or not over a valid module item
    if (!targetElement || targetElement === globalDraggedItem) {
        clearDropIndicators();
        dragOverElement = null;
        dropIndicator = null;
        return;
    }

    // Update visual indicators only if the target element changes
    if (targetElement !== dragOverElement) {
        clearDropIndicators(); // Clear indicators from previous target
        dragOverElement = targetElement;
    }

    // Determine drop zone (top, bottom, middle for headers)
    const rect = targetElement.getBoundingClientRect();
    const yOffset = e.clientY - rect.top; // Vertical position within the target
    const dropZoneHeight = rect.height;
    const targetIsHeader = targetElement.dataset.moduleType === 'header';
    // Allow dropping *onto* a header only if dragging a non-header
    const canDropOnHeader = targetIsHeader && globalDraggedItem?.dataset.moduleType !== 'header';

    // Define thresholds for top/bottom/middle zones
    const topThreshold = dropZoneHeight * 0.3;
    const bottomThreshold = dropZoneHeight * 0.7;

    let currentIndicator = null;
    // Determine indicator based on position and type
    if (canDropOnHeader && yOffset > topThreshold && yOffset < bottomThreshold) {
        currentIndicator = 'middle'; // Drop onto header
    } else if (yOffset <= topThreshold) {
        currentIndicator = 'top'; // Drop above target
    } else {
        currentIndicator = 'bottom'; // Drop below target
    }

    // Apply visual indicator class if it changed
    if (currentIndicator !== dropIndicator) {
        targetElement.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-middle'); // Clear previous
        dropIndicator = currentIndicator; // Store current indicator type
        if (dropIndicator === 'middle') targetElement.classList.add('drag-over-middle');
        else if (dropIndicator === 'top') targetElement.classList.add('drag-over-top');
        else if (dropIndicator === 'bottom') targetElement.classList.add('drag-over-bottom');
    }
}

/**
 * Handles leaving a potential drop target area.
 */
function handleDragLeave(e) {
    const targetElement = e.target.closest('.module-item');
    if (!targetElement) return;

    // Check if the mouse is truly leaving the element or just moving over a child
    const relatedTarget = e.relatedTarget ? e.relatedTarget.closest('.module-item') : null;
    if (targetElement === dragOverElement && relatedTarget !== dragOverElement) {
         // If leaving the current dragOverElement, clear its indicators
         if (!targetElement.contains(e.relatedTarget)) {
            clearDropIndicators(targetElement);
            dragOverElement = null;
            dropIndicator = null;
         }
    }
}

/**
 * Handles the drop action.
 */
function handleDrop(e) {
    e.preventDefault(); // Prevent default browser action
    // Ensure drop is valid (dragged item exists, dropped on a different valid element, indicator set)
    if (!globalDraggedItem || !dragOverElement || globalDraggedItem === dragOverElement || !dropIndicator) {
        clearDropIndicators(); // Clear any lingering indicators
        return;
    }

    console.log(`[DnD] Drop: ${globalDraggedItem.dataset.moduleId} onto ${dragOverElement.dataset.moduleId}, indicator: ${dropIndicator}`);

    const draggedId = globalDraggedItem.dataset.moduleId;
    const targetId = dragOverElement.dataset.moduleId;

    // Find module data in appData
    const draggedModuleIndex = appData.modules.findIndex(m => m.id === draggedId);
    const targetModuleIndex = appData.modules.findIndex(m => m.id === targetId);

    if (draggedModuleIndex === -1 || targetModuleIndex === -1) {
        console.error("[DnD] Error: Dragged or target module not found in appData.");
        clearDropIndicators();
        return;
    }

    const draggedModule = appData.modules[draggedModuleIndex];
    const targetModule = appData.modules[targetModuleIndex];

    let newParentId = null;
    let targetPositionIndex = -1; // Index in the appData.modules array where the dragged item should be inserted

    // Determine new parent and position based on drop indicator
    if (dropIndicator === 'middle' && targetModule.type === 'header') {
        // Dropping onto a header
        newParentId = targetModule.id;
        // Insert as the first child of the header (visually)
        // Find index of first item *after* the header that is NOT its child
        targetPositionIndex = targetModuleIndex + 1; // Start looking after the header
        while(targetPositionIndex < appData.modules.length && appData.modules[targetPositionIndex].parentId === targetModule.id) {
             targetPositionIndex++;
        }
        console.log(`[DnD] Setting parent of ${draggedId} to Header ${newParentId}. Insert index: ${targetPositionIndex}`);

    } else if (dropIndicator === 'bottom') {
        // Dropping below the target item
        newParentId = targetModule.parentId; // Same parent as target
        targetPositionIndex = targetModuleIndex + 1; // Insert after target
         console.log(`[DnD] Inserting ${draggedId} AFTER ${targetId} (parent: ${newParentId}). Insert index: ${targetPositionIndex}`);
    } else { // dropIndicator === 'top'
        // Dropping above the target item
        newParentId = targetModule.parentId; // Same parent as target
        targetPositionIndex = targetModuleIndex; // Insert before target
         console.log(`[DnD] Inserting ${draggedId} BEFORE ${targetId} (parent: ${newParentId}). Insert index: ${targetPositionIndex}`);
    }

    // Update the dragged module's parentId
    draggedModule.parentId = newParentId;

    // Move the module in the appData.modules array
    // 1. Remove from original position
    appData.modules.splice(draggedModuleIndex, 1);
    // 2. Adjust target index if removal affected it
    if (draggedModuleIndex < targetPositionIndex) {
        targetPositionIndex--;
    }
    // 3. Insert at the new position
    appData.modules.splice(targetPositionIndex, 0, draggedModule);

    // Recalculate 'order' property for all modules based on new array positions
    recalculateModuleOrder();

    // Re-render the list with updated structure and order
    renderModuleList(appData.modules);

    // Save the new structure to Firebase/backup
    saveModuleStructure();

    // Clean up
    clearDropIndicators();
}


/**
 * Handles the end of a drag operation (cleanup).
 */
function handleDragEnd(e) {
    // Remove dragging class from the item
    if (globalDraggedItem) {
        globalDraggedItem.classList.remove('dragging');
    }
    // Clear any visual indicators
    clearDropIndicators();
    // Reset global variables
    globalDraggedItem = null;
    dragOverElement = null;
    dropIndicator = null;
    console.log("[DnD] Drag End");
}

/**
 * Clears visual drop indicator classes from elements.
 * @param {HTMLElement} [element] - Specific element to clear, or clears all if omitted.
 */
function clearDropIndicators(element) {
    const selector = '.module-item.drag-over-top, .module-item.drag-over-bottom, .module-item.drag-over-middle';
    const elementsToClear = element ? [element] : document.querySelectorAll(selector);
    elementsToClear.forEach(el => {
        if (el) el.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-middle');
    });
}

/**
 * Recalculates the 'order' property for all modules based on their current
 * position within their parent group in the appData.modules array.
 */
function recalculateModuleOrder() {
    console.log("[Dashboard] Recalculating module order...");
    const orderCounters = {}; // Keep track of order within each parent { parentId: count }

    appData.modules.forEach(module => {
        const parentKey = module.parentId === null ? 'null' : module.parentId; // Use 'null' string as key for top level
        // Initialize counter for this parent if it doesn't exist
        if (orderCounters[parentKey] === undefined) {
            orderCounters[parentKey] = 0;
        }
        // Assign the current order and increment the counter for this parent
        module.order = orderCounters[parentKey]++;
    });
    console.log("[Dashboard] Order recalculation complete.");
    updateDebugPanel(); // Show new order in debug
}


// --- Other UI Functions ---
/**
 * Sets up global click listener to close dropdowns and delegated listener for collapse toggles.
 */
function setupDropdownMenus() {
    // Global listener to close dropdowns when clicking outside
    document.removeEventListener('click', handleGlobalClickForDropdowns); // Remove old listener first
    document.addEventListener('click', handleGlobalClickForDropdowns);
    console.log("[Dashboard] Global dropdown close listener attached.");

    // Use event delegation for collapse toggles on the modules container
    const container = document.getElementById('modules-container');
    if(container) {
        container.removeEventListener('click', handleMaybeCollapseToggle); // Remove old listener first
        container.addEventListener('click', handleMaybeCollapseToggle);
        console.log("[Dashboard] Collapse toggle listener attached via delegation.");
    } else {
         console.error("[Dashboard] Cannot attach collapse toggle listener - container not found.");
    }
}

/**
 * Handles clicks within the modules container to potentially toggle collapse state.
 * Uses event delegation.
 */
function handleMaybeCollapseToggle(e) {
    // Check if click was on the collapse icon OR the header item itself
    const collapseIcon = e.target.closest('.collapse-icon');
    const headerItem = e.target.closest('.module-item.header-item');

    // Proceed if we clicked a header item...
    if (headerItem) {
        // ...and the click was directly on the collapse icon OR
        // the click was somewhere else on the header item *except* specific interactive elements
        // (like drag handle or the main icon which opens dropdown)
        if (collapseIcon || (!e.target.closest('.module-drag-handle') && !e.target.closest('.module-icon'))) {
            e.stopPropagation(); // Prevent navigation if name span was clicked
            const moduleId = headerItem.dataset.moduleId;
            if (moduleId) {
                handleCollapseToggle(moduleId); // Toggle the state
            }
        }
    }
}


/**
 * Toggles the collapse state for a given header module ID and re-renders the list.
 * @param {string} headerModuleId - The ID of the header module to toggle.
 */
function handleCollapseToggle(headerModuleId) {
    console.log("[Dashboard] Toggling collapse for header:", headerModuleId);
    // Toggle the state (if undefined/false, set to true; if true, set to false)
    headerCollapseState[headerModuleId] = !(headerCollapseState[headerModuleId] === true);
    console.log("[Dashboard] New collapse state:", headerCollapseState);
    // Re-render the entire list to show/hide children based on the new state
    renderModuleList(appData.modules);
    // Optional: Save collapse state to sessionStorage/localStorage for persistence across sessions
    // try {
    //     sessionStorage.setItem('headerCollapseState', JSON.stringify(headerCollapseState));
    // } catch (e) { console.error("Error saving collapse state:", e); }
}

/**
 * Global click handler to close any open dropdown menus.
 */
function handleGlobalClickForDropdowns(e) {
    // If the click was outside any module icon (which opens dropdown) or the dropdown menu itself
    if (!e.target.closest('.module-icon') && !e.target.closest('.dropdown-menu')) {
        closeAllDropdowns();
    }
}

/**
 * Closes all open dropdown menus in the module list.
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
 */
function editModule(moduleElement) {
    const moduleId = moduleElement?.dataset?.moduleId;
    if (!moduleId) { console.error("Edit Error: Could not get module ID from element."); return; }

    const moduleIndex = appData.modules.findIndex(m => m.id === moduleId);
    if (moduleIndex === -1) { console.error("Edit Error: Module not found in appData:", moduleId); return; }

    const currentModule = appData.modules[moduleIndex];
    const currentName = currentModule.name;

    console.log("[Dashboard] Editing module:", currentModule);
    const newName = prompt(`Edit name for "${currentName}":`, currentName);

    // Check if user provided a new name and it's different
    if (newName && newName.trim() !== '' && newName.trim() !== currentName) {
        const finalNewName = newName.trim();
        console.log("[Dashboard] New name accepted:", finalNewName);
        currentModule.name = finalNewName; // Update name in local state

        // Update the name displayed in the sidebar
        const nameSpan = moduleElement.querySelector('.module-name');
        if (nameSpan) {
            nameSpan.textContent = finalNewName;
            console.log("[Dashboard] DOM name updated.");
        } else { console.warn("[Dashboard] Could not find name span to update."); }

        saveModuleStructure(); // Save changes to Firebase/backup
        window.ConstructionApp.ModuleUtils.showSuccessMessage(`Module renamed to "${finalNewName}"`);
    } else {
        console.log("[Dashboard] Edit cancelled or name unchanged.");
    }
}

/**
 * Handles deleting a module (and its descendants if it's a header).
 */
function deleteModule(moduleElement) {
    const moduleId = moduleElement?.dataset?.moduleId;
    if (!moduleId) { console.error("Delete Error: Could not get module ID."); return; }

    const moduleIndex = appData.modules.findIndex(m => m.id === moduleId);
    if (moduleIndex === -1) { console.error("Delete Error: Module not found in appData:", moduleId); return; }

    const moduleToDelete = appData.modules[moduleIndex];
    const moduleName = moduleToDelete.name;
    console.log("[Dashboard] Attempting to delete module:", moduleToDelete);

    // Prevent deleting the essential 'notes' module
    if (moduleId === 'notes') {
        alert('The Notes module cannot be deleted.');
        console.log("[Dashboard] Delete cancelled: Notes module is protected.");
        return;
    }

    // Find direct children to warn about descendants
    const children = appData.modules.filter(m => m.parentId === moduleId);
    let confirmMessage = `Are you sure you want to delete the "${moduleName}" module?`;
    if (moduleToDelete.type === 'header' && children.length > 0) {
        confirmMessage += `\n\nWARNING: This is a header containing other modules. Deleting it will also delete ALL modules inside it. This cannot be undone.`;
    } else {
        confirmMessage += `\nThis cannot be undone.`;
    }

    // Show confirmation dialog
    const confirmed = confirm(confirmMessage);

    if (confirmed) {
        console.log("[Dashboard] Deletion confirmed for:", moduleId);
        // Find all descendant IDs to delete recursively
        const idsToDelete = new Set([moduleId]);
        const queue = [moduleId]; // Start with the initial module ID
        while (queue.length > 0) {
            const currentParentId = queue.shift();
            // Find modules whose parent is the current one
            appData.modules.forEach(module => {
                if (module.parentId === currentParentId) {
                    if (!idsToDelete.has(module.id)) { // Avoid infinite loops (though unlikely with tree structure)
                        idsToDelete.add(module.id);
                        queue.push(module.id); // Add child's ID to the queue to find its children
                    }
                }
            });
        }
        console.log("[Dashboard] IDs to delete (including descendants):", Array.from(idsToDelete));

        // Filter out the modules to be deleted from appData
        appData.modules = appData.modules.filter(module => !idsToDelete.has(module.id));
        console.log("[Dashboard] appData filtered. Remaining modules:", appData.modules.length);

        // Recalculate order for remaining modules (might not be strictly necessary but good practice)
        recalculateModuleOrder();
        // Re-render the list
        renderModuleList(appData.modules);
        // Save the updated structure
        saveModuleStructure();
        window.ConstructionApp.ModuleUtils.showSuccessMessage(`Module "${moduleName}" ${idsToDelete.size > 1 ? 'and its contents ' : ''}deleted.`);
    } else {
        console.log("[Dashboard] Deletion cancelled by user.");
    }
}


// --- Client Management & Dashboard Update ---
/**
 * Sets up listeners for 'New Client' and 'Open Client' buttons.
 */
function setupClientManagement() {
    console.log("[Dashboard] Setting up client management buttons...");
    const newClientBtn = document.getElementById('new-client-btn');
    const openClientBtn = document.getElementById('open-client-btn');
    let clientModalOverlay = document.getElementById('client-modal-overlay'); // The overlay container

    // Ensure the overlay exists (it's defined in index.html)
    if (!clientModalOverlay) {
         console.error("[Dashboard] Client modal overlay container not found!");
         // Optionally create it dynamically, but it should exist in the HTML
         // clientModalOverlay = document.createElement('div');
         // clientModalOverlay.className = 'modal-overlay';
         // clientModalOverlay.id = 'client-modal-overlay';
         // document.body.appendChild(clientModalOverlay);
         // // Add close-on-click listener if created dynamically
         // clientModalOverlay.addEventListener('click', (event) => {
         //     if (event.target === clientModalOverlay) clientModalOverlay.style.display = 'none';
         // });
         return; // Stop setup if overlay missing
    } else {
         // Ensure close-on-click listener is attached
         clientModalOverlay.removeEventListener('click', handleOverlayClick); // Remove old first
         clientModalOverlay.addEventListener('click', handleOverlayClick);
    }


    if (newClientBtn) {
        newClientBtn.addEventListener('click', () => {
            console.log("[Dashboard] 'New Client' button clicked.");
            const clientModal = createClientModal('new'); // Create the modal content
            clientModalOverlay.innerHTML = ''; // Clear previous content
            clientModalOverlay.appendChild(clientModal); // Add new content
            clientModalOverlay.style.display = 'flex'; // Show the overlay
        });
    } else { console.error("[Dashboard] 'New Client' button not found."); }

    if (openClientBtn) {
        openClientBtn.addEventListener('click', () => {
            console.log("[Dashboard] 'Open Client' button clicked.");
            const clientModal = createClientModal('open'); // Create the modal content
            clientModalOverlay.innerHTML = ''; // Clear previous content
            clientModalOverlay.appendChild(clientModal); // Add new content
            clientModalOverlay.style.display = 'flex'; // Show the overlay
        });
    } else { console.error("[Dashboard] 'Open Client' button not found."); }
}

// Close modal if overlay is clicked
function handleOverlayClick(event) {
     if (event.target.id === 'client-modal-overlay') {
          event.target.style.display = 'none';
     }
}


/**
 * Creates the HTML content for the 'New Client' or 'Open Client' modal.
 * @param {string} type - 'new' or 'open'.
 * @returns {HTMLElement} The modal content element.
 */
function createClientModal(type) {
    const modal = document.createElement('div');
    modal.className = 'modal'; // Use existing modal styles
    const overlayId = 'client-modal-overlay'; // ID of the parent overlay

    if (type === 'new') {
        modal.innerHTML = `
            <div class="modal-header">
                <h2 class="modal-title">New Client</h2>
                <span class="modal-close" data-modal-id="${overlayId}" title="Close">&times;</span>
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

        // Attach listeners after innerHTML is processed
        setTimeout(() => {
            setupModalCloseButtons(modal, overlayId); // Setup close/cancel buttons
            const saveBtn = modal.querySelector('#save-new-client-btn');
            if (saveBtn) {
                 // Use click listener directly
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

                    const newClientData = { name: name, address: address, moduleData: {} };
                    console.log("[Dashboard] Creating new client:", newClientData);

                    // Add client using ClientManager (handles saving to Firebase/local)
                    window.ConstructionApp.ClientManager.addClient(newClientData, (success, result) => {
                         if (success) {
                              const addedClient = result; // The callback returns the added client object
                              console.log("[Dashboard] Client added successfully:", addedClient.name);
                              // Set the new client as current
                              window.ConstructionApp.ClientManager.setCurrentClient(addedClient);
                              updateDebugPanel(); // Update debug info
                              window.ConstructionApp.ModuleUtils.showSuccessMessage(`Client "${name}" created and selected.`);
                              document.getElementById(overlayId).style.display = 'none'; // Close modal
                         } else {
                              console.error("[Dashboard] Failed to add client:", result);
                              alert(`Error creating client: ${result || 'Unknown error'}`);
                         }
                    });
                 });
            }
        }, 0);

    } else if (type === 'open') {
        // Load clients (synchronously for simplicity here, but ideally async)
        const clients = window.ConstructionApp.ClientManager.getAllClients();
        let clientListHTML = '';
        if (clients && clients.length > 0) {
            // Sort clients alphabetically by name
            clients.sort((a, b) => a.name.localeCompare(b.name));
            clientListHTML = clients.map(client =>
                `<div class="client-list-item" data-client-id="${client.id}" title="Address: ${client.address || 'N/A'}">${client.name}</div>`
            ).join('');
        } else {
            clientListHTML = '<div style="padding: 15px; text-align: center; color: #666;">No clients found. Create a new client.</div>';
        }

        modal.innerHTML = `
            <div class="modal-header">
                <h2 class="modal-title">Open Client</h2>
                <span class="modal-close" data-modal-id="${overlayId}" title="Close">&times;</span>
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

        // Attach listeners after innerHTML is processed
        setTimeout(() => {
            setupModalCloseButtons(modal, overlayId); // Setup close/cancel buttons
            setupClientListSelection(modal); // Setup clicking on a client
            setupClientSearch(modal); // Setup the search filter
        }, 0);
    }
    return modal;
}

/**
 * Attaches close listeners to buttons within a modal.
 */
function setupModalCloseButtons(modal, overlayId) {
    const closeBtns = modal.querySelectorAll(`.modal-close[data-modal-id="${overlayId}"], .btn-cancel[data-modal-id="${overlayId}"]`);
    closeBtns.forEach(btn => {
        // Clone and replace to ensure no duplicate listeners accumulate
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', () => {
            const overlay = document.getElementById(overlayId);
            if (overlay) overlay.style.display = 'none';
            else console.error("Overlay not found to close:", overlayId);
        });
    });
}

/**
 * Sets up the client search filter functionality within the 'Open Client' modal.
 */
function setupClientSearch(modal) {
    const searchInput = modal.querySelector('#client-search');
    const clientListContainer = modal.querySelector('.client-list');
    if (searchInput && clientListContainer) {
        searchInput.addEventListener('input', () => {
            const searchTerm = searchInput.value.toLowerCase().trim();
            const clientItems = clientListContainer.querySelectorAll('.client-list-item');
            clientItems.forEach(item => {
                // Check if the item represents a client (has data-client-id)
                if (item.dataset.clientId) {
                    const clientName = item.textContent.toLowerCase();
                    // Show item if search term is empty or name includes the term
                    item.style.display = (searchTerm === '' || clientName.includes(searchTerm)) ? 'block' : 'none';
                }
            });
        });
    }
}

/**
 * Sets up the click listener for selecting a client from the list in the 'Open Client' modal.
 */
function setupClientListSelection(modal) {
    const clientListContainer = modal.querySelector('.client-list');
    if (!clientListContainer) return;

    // Use event delegation on the container
    clientListContainer.addEventListener('click', (event) => {
        const listItem = event.target.closest('.client-list-item');
        // Check if a valid list item with a client ID was clicked
        if (listItem && listItem.dataset.clientId) {
            const clientId = listItem.dataset.clientId;
            const clients = window.ConstructionApp.ClientManager.getAllClients();
            const selectedClient = clients.find(c => c.id === clientId);

            if (selectedClient) {
                console.log("[Dashboard] Selecting client via modal:", selectedClient.name);
                // Set the selected client as current using ClientManager
                window.ConstructionApp.ClientManager.setCurrentClient(selectedClient);
                updateDebugPanel(); // Update debug info
                // Close the modal overlay
                const overlay = modal.closest('.modal-overlay');
                if (overlay) overlay.style.display = 'none';
                window.ConstructionApp.ModuleUtils.showSuccessMessage(`Client "${selectedClient.name}" selected.`);
            } else {
                console.error("[Dashboard] Selected client ID not found in ClientManager list:", clientId);
                alert("Error: Could not find the selected client data.");
            }
        }
    });
}

/**
 * Updates the main dashboard UI based on the provided client object.
 * This is typically called by ClientManager.onClientChanged.
 * @param {object | null} client - The current client object, or null if none selected.
 */
function updateDashboard(client) {
    console.log("[Dashboard] Updating dashboard UI for client:", client?.name || "None");
    const logoutBtn = document.getElementById('logout-btn');
    const dashboardContent = document.getElementById('module-content'); // Area for tiles or welcome message
    const clientNameDisplay = document.getElementById('client-name-display');
    const dashboardDesc = document.getElementById('dashboard-description'); // Changed selector
    const totalCostDisplay = document.getElementById('total-project-cost');

    if (!logoutBtn || !dashboardContent || !clientNameDisplay || !dashboardDesc || !totalCostDisplay) {
         console.error("[Dashboard:updateDashboard] Critical UI element missing. Aborting update.");
         return;
    }


    if (client) {
        // --- Client Selected View ---
        clientNameDisplay.textContent = `Client: ${client.name || 'Unnamed'}`;
        dashboardDesc.textContent = `Address: ${client.address || 'No address provided'}`;
        totalCostDisplay.style.display = 'block'; // Show total cost
        logoutBtn.style.display = 'inline-block'; // Show logout button

        // Re-attach logout listener (clone/replace)
        const newLogoutBtn = logoutBtn.cloneNode(true);
        logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
        newLogoutBtn.addEventListener('click', () => {
             console.log("[Dashboard] Logout button clicked.");
             window.ConstructionApp.ModuleUtils.logoutClient();
        });

        updateTotalProjectCost(); // Calculate and display total cost for this client
        renderDashboardContent(client); // Render the module summary tiles

    } else {
        // --- No Client Selected View ---
        clientNameDisplay.textContent = ''; // Clear name
        dashboardDesc.textContent = 'Select or create a client to begin.'; // Update description
        totalCostDisplay.textContent = 'Total Project Cost: R0.00'; // Reset total cost display
        totalCostDisplay.style.display = 'none'; // Hide total cost display
        logoutBtn.style.display = 'none'; // Hide logout button

        // Display the "No Client" notification
        dashboardContent.innerHTML = `
            <div class="no-client-notification">
                <h2>No Client Selected</h2>
                <p>Please select an existing client or create a new client to start working.</p>
                <div class="no-client-buttons">
                    <button id="prompt-new-client" class="btn no-client-button">Create New Client</button>
                    <button id="prompt-open-client" class="btn no-client-button">Open Existing Client</button>
                </div>
            </div>`;

        // Attach listeners to the buttons within the notification
        setTimeout(() => {
            const newClientBtnPrompt = document.getElementById('prompt-new-client');
            const openClientBtnPrompt = document.getElementById('prompt-open-client');
            // Trigger the main sidebar buttons when these are clicked
            if (newClientBtnPrompt) newClientBtnPrompt.addEventListener('click', () => document.getElementById('new-client-btn')?.click());
            if (openClientBtnPrompt) openClientBtnPrompt.addEventListener('click', () => document.getElementById('open-client-btn')?.click());
        }, 0);
    }
    updateDebugPanel(); // Update debug info based on new state
}

/**
 * Renders the summary tiles for modules with data in the main dashboard area.
 * @param {object} client - The currently selected client object.
 */
function renderDashboardContent(client) {
    const contentElement = document.getElementById('module-content');
    contentElement.innerHTML = ''; // Clear previous content

    let tilesHTML = '';
    let hasModuleDataToShow = false;
    // Ensure client and moduleData exist before trying to iterate
    const moduleDataEntries = (client && client.moduleData) ? Object.entries(client.moduleData) : [];

    console.log("[Dashboard] Rendering dashboard tiles. Client module data keys:", Object.keys(client?.moduleData || {}));

    if (moduleDataEntries.length > 0) {
        moduleDataEntries.forEach(([moduleId, moduleData]) => {
             // Skip if moduleData is null/undefined (e.g., after clearing)
             if (!moduleData) {
                  console.log(`[Dashboard] Skipping tile for ${moduleId} - data is null/undefined.`);
                  return;
             }

             // Find corresponding module info from appData (for name etc.)
            const moduleInfo = appData.modules.find(m => m.id === moduleId);
            // Use module name from appData if found, otherwise use the ID
            const moduleName = moduleInfo ? moduleInfo.name : moduleId;

            // Calculate cost for this module
            let moduleCost = 0;
            if (moduleData.totalCost !== undefined) { // Check if module saved its own total
                moduleCost = parseFloat(moduleData.totalCost) || 0;
            } else if (moduleData.items && Array.isArray(moduleData.items)) { // Check for item list (like P&Gs)
                moduleCost = window.ConstructionApp.ModuleUtils.calculateModuleTotal(moduleData.items);
            } else if (moduleId === 'notes') { // Notes module has no cost
                moduleCost = 0;
            } else {
                 // Attempt calculation even if structure unknown (might work for simple cost objects)
                 moduleCost = window.ConstructionApp.ModuleUtils.calculateModuleTotal([moduleData]);
            }


            // Only create a tile if there's a cost OR it's the notes module
            // Or if moduleData exists but cost is 0 (show tile with R0.00)
            if (moduleData && (moduleCost > 0 || moduleId === 'notes' || moduleCost === 0)) {
                hasModuleDataToShow = true;
                const formattedCost = window.ConstructionApp.ModuleUtils.formatCurrency(moduleCost);
                tilesHTML += `
                    <div class="module-tile" data-module-id="${moduleId}">
                        ${moduleId !== 'notes' ? `<button class="clear-module-btn" title="Clear data for ${moduleName}">×</button>` : ''}
                        <h5>${moduleName}</h5>
                        ${moduleId !== 'notes' ? `<p class="module-tile-cost">${formattedCost}</p>` : '<p style="font-size: 0.9em; color: #666; margin-top: 10px;">(No cost associated)</p>'}
                        <button class="btn module-open-btn" style="margin-top: 10px;">Open Module</button>
                    </div>`;
            } else {
                 console.log(`[Dashboard] Skipping tile for ${moduleId} - moduleData missing or cost is zero (and not notes). Cost calculated: ${moduleCost}`);
            }
        });
    }

    // Construct the final HTML for the content area
    let finalContent = `
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 10px;">
            <h4 style="margin-bottom: 15px;">Module Summaries</h4>
            <div id="module-tiles" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 15px;">`;

    if (hasModuleDataToShow) {
        finalContent += tilesHTML; // Add the generated tiles
    } else {
        // Show message if no modules have data yet
        finalContent += `
            <div style="background-color: white; padding: 15px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); grid-column: 1 / -1; text-align: center; color: #666;">
                <p>No module data entered for this client yet.</p>
                <p style="margin-top: 5px;"><small>Click a module in the sidebar to begin.</small></p>
            </div>`;
    }
    finalContent += `</div></div>`; // Close grid and container div
    contentElement.innerHTML = finalContent; // Set the content

    // Attach listeners to the newly created tiles
    setupDashboardTileListeners();
}

/**
 * Sets up event listeners for buttons within the dashboard module tiles.
 */
function setupDashboardTileListeners() {
    const tilesContainer = document.getElementById('module-tiles');
    if (!tilesContainer) return;

    // Use event delegation on the container
    tilesContainer.removeEventListener('click', handleTileClick); // Remove old listener first
    tilesContainer.addEventListener('click', handleTileClick);
}

/**
 * Handles clicks on buttons within module tiles (Open, Clear).
 * Uses event delegation.
 */
function handleTileClick(e) {
    const openBtn = e.target.closest('.module-open-btn');
    const clearBtn = e.target.closest('.clear-module-btn');
    const tile = e.target.closest('.module-tile');

    if (!tile) return; // Click wasn't inside a tile

    const moduleId = tile.dataset.moduleId;
    if (!moduleId) return; // Tile missing module ID

    if (openBtn) {
        // Navigate to the specific module page
        console.log("[Dashboard] Open button clicked for tile:", moduleId);
        window.ConstructionApp.ModuleUtils.navigateToModule(moduleId);
    } else if (clearBtn) {
        // Clear data for this module for the current client
        console.log("[Dashboard] Clear button clicked for tile:", moduleId);
        const moduleInfo = appData.modules.find(m => m.id === moduleId);
        const moduleName = moduleInfo ? moduleInfo.name : moduleId;
        // Confirm before clearing
        if (confirm(`Are you sure you want to clear all saved data for the "${moduleName}" module for this client? This cannot be undone.`)) {
            clearModuleData(moduleId);
        }
    }
}

/**
 * Clears the data for a specific module for the current client.
 * @param {string} moduleId - The ID of the module to clear.
 */
function clearModuleData(moduleId) {
    const client = window.ConstructionApp.ClientManager.getCurrentClient();
    // Check if client exists and has data for this module
    if (client && client.moduleData && client.moduleData.hasOwnProperty(moduleId)) {
        console.log(`[Dashboard] Clearing module data for: ${moduleId}`);
        // Save 'null' as the data for this module via ClientManager
        window.ConstructionApp.ClientManager.saveModuleData(moduleId, null, (success, error) => {
            if (success) {
                 // ClientManager.saveModuleData should have updated the client object and sessionStorage
                 // Re-render the dashboard content to reflect the change
                 const updatedClient = window.ConstructionApp.ClientManager.getCurrentClient(); // Get potentially updated client object
                 renderDashboardContent(updatedClient);
                 updateTotalProjectCost(); // Recalculate total cost
                 window.ConstructionApp.ModuleUtils.showSuccessMessage(`Module data for "${moduleId}" cleared.`);
                 updateDebugPanel();
            } else {
                console.error(`[Dashboard] Error clearing module data for ${moduleId}:`, error);
                window.ConstructionApp.ModuleUtils.showErrorMessage(`Error clearing data: ${error || 'Unknown error'}`);
            }
        });
    } else {
        console.warn(`[Dashboard] No data found for module ${moduleId} to clear, or no client selected.`);
        // Optionally show a message if needed
        // window.ConstructionApp.ModuleUtils.showErrorMessage(`No data found for "${moduleId}" to clear.`);
    }
}

/**
 * Calculates the total project cost based on all module data for the current client
 * and updates the display in the header.
 */
function updateTotalProjectCost() {
    let totalCost = 0;
    const client = window.ConstructionApp.ClientManager.getCurrentClient();

    if (client && client.moduleData) {
        Object.entries(client.moduleData).forEach(([moduleId, moduleData]) => {
             // Skip if module data is null/undefined
             if (!moduleData) return;

             let costForThisModule = 0;
             // Check various structures for cost information
             if (moduleData.totalCost !== undefined) {
                 costForThisModule = parseFloat(moduleData.totalCost) || 0;
             } else if (moduleData.items && Array.isArray(moduleData.items)) {
                 costForThisModule = window.ConstructionApp.ModuleUtils.calculateModuleTotal(moduleData.items);
             } else if (moduleId !== 'notes') {
                  // Attempt calculation even for unknown structures (might be simple {cost: X})
                  costForThisModule = window.ConstructionApp.ModuleUtils.calculateModuleTotal([moduleData]);
             }
             totalCost += costForThisModule;
        });
    }

    const formattedTotal = window.ConstructionApp.ModuleUtils.formatCurrency(totalCost);
    const totalCostDisplay = document.getElementById('total-project-cost');
     if (totalCostDisplay) {
         totalCostDisplay.textContent = `Total Project Cost: ${formattedTotal}`;
     }
    console.log("[Dashboard] Updated total project cost display:", formattedTotal);
    updateDebugPanel(); // Update debug panel as cost changes
}


// --- Debug Panel ---
/**
 * Sets up the debug panel toggle button.
 */
function setupDebugPanel() {
    const debugPanel = document.getElementById('debug-panel');
    if (!debugPanel) {
         console.warn("[Dashboard] Debug panel element not found.");
         return; // Don't create toggle if panel doesn't exist
    }
    // Avoid creating multiple toggle buttons
    if (document.getElementById('debug-toggle-btn')) return;

    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = 'Debug';
    toggleBtn.id = 'debug-toggle-btn';
    // Apply styles via JS (consider moving to CSS if preferred)
    toggleBtn.style.cssText = 'position: fixed; bottom: 10px; right: 10px; z-index: 10000; padding: 5px 10px; background: #555; color: white; border: none; border-radius: 3px; cursor: pointer; opacity: 0.7; font-size: 12px;';
    document.body.appendChild(toggleBtn);

    toggleBtn.addEventListener('click', function() {
        const isVisible = debugPanel.style.display === 'block';
        debugPanel.style.display = isVisible ? 'none' : 'block';
        if (!isVisible) {
            updateDebugPanel(); // Update content when showing
        }
        toggleBtn.style.opacity = isVisible ? '0.7' : '1'; // Change opacity when open/closed
    });
    console.log("[Dashboard] Debug panel toggle button created.");
}

/**
 * Updates the content of the debug panel with current state information.
 */
function updateDebugPanel() {
    const debugPanel = document.getElementById('debug-panel');
    // Only update if the panel exists and is visible
    if (!debugPanel || debugPanel.style.display !== 'block') return;

    const navigationState = sessionStorage.getItem('navigationState');
    const currentClient = window.ConstructionApp.ClientManager.getCurrentClient(); // Use getter
    const storedClientStr = sessionStorage.getItem('currentClient');
    const moduleOrderStr = sessionStorage.getItem('moduleOrder');
    const collapseStateStr = sessionStorage.getItem('headerCollapseState'); // If persisting collapse state

    let debugInfo = `<strong>--- Debug Panel ---</strong><br>`;
    debugInfo += `<strong>Nav State:</strong> ${navigationState || 'None'}<br>`;
    debugInfo += `<strong>Current Client (in memory):</strong> ${currentClient ? currentClient.name : 'None'} (ID: ${currentClient?.id || 'N/A'})<br>`;
    debugInfo += `<strong>Client in sessionStorage:</strong> ${storedClientStr ? 'Present (' + (storedClientStr.length / 1024).toFixed(1) + ' KB)' : 'None'}<br>`;
    debugInfo += `<strong>Modules in appData:</strong> ${appData.modules.length}<br>`;
    debugInfo += `<strong>Module Order Backup:</strong> ${moduleOrderStr ? 'Present' : 'None'}<br>`;
    debugInfo += `<strong>Collapse State (Session):</strong> ${collapseStateStr ? 'Present' : 'None'}<br>`;
    debugInfo += `<hr>`;

    if (currentClient && currentClient.moduleData) {
        debugInfo += '<strong>Client Module Data Keys:</strong><br>';
        debugInfo += `<ul>`;
        Object.keys(currentClient.moduleData).forEach(moduleId => {
             const data = currentClient.moduleData[moduleId];
             debugInfo += `<li>${moduleId}: ${data ? 'Exists' : 'NULL'}</li>`;
        });
        debugInfo += `</ul><hr>`;
    }

    debugInfo += '<strong>Module Structure (appData):</strong><br><pre style="max-height: 150px; overflow-y: auto; border: 1px solid #555; padding: 5px; font-size: 11px; background: #eee; color: #333;">';
    // Stringify only essential structure info for readability
    debugInfo += JSON.stringify(appData.modules.map(m => ({ id: m.id, name: m.name, type: m.type, parentId: m.parentId, order: m.order })), null, 1);
    debugInfo += '</pre>';

    debugPanel.innerHTML = debugInfo;
}

// --- Helper Functions (Example - could be in module-utils if used elsewhere) ---
// Example: setupModuleClickHandler - This seems redundant if createModuleElement handles clicks
// function setupModuleClickHandler(moduleElement) {
//     const moduleText = moduleElement.querySelector('.module-name');
//     if (moduleText) {
//         // Clone/replace to avoid duplicate listeners (though direct attachment in createModuleElement is better)
//         const newModuleText = moduleText.cloneNode(true);
//         moduleText.parentNode.replaceChild(newModuleText, moduleText);
//         newModuleText.addEventListener('click', function() {
//             const moduleId = moduleElement.getAttribute('data-module-id');
//             window.ConstructionApp.ModuleUtils.navigateToModule(moduleId);
//         });
//     }
// }
