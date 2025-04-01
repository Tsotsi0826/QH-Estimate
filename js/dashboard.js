// js/dashboard.js
// Contains the primary JavaScript logic for the Construction Estimator dashboard (index.html)

// --- Global Variables ---
// Application data structure (will be populated from loaded modules)
let appData = {
    modules: [] // Holds { id, name, requiresClient, type, parentId, order, renderTemplate, saveData }
};
let globalDraggedItem = null; // Reference to the item being dragged

// --- Initialization ---
document.addEventListener('DOMContentLoaded', function() {
    console.log("[Dashboard] DOM loaded, initializing app");

    // Enable debug panel during development
    setupDebugPanel();

    // Load modules with hierarchy and order preservation
    loadAndRenderModules().then(() => {
        // Initialize app state (client, etc.)
        initApp();

        // Setup UI elements after modules are loaded
        setupDropdownMenus(); // Setup for existing static modules like Notes
        setupClientManagement();
        setupAddModuleButton(); // Setup button to open the modal
        setupModuleSearch();

        // Load clients using the shared client manager
        window.ConstructionApp.ClientManager.loadClients().then(() => {
            console.log("[Dashboard] Clients loaded");
        });

        // Set up client change handler
        window.ConstructionApp.ClientManager.onClientChanged = updateDashboard;

        // Set up drag and drop for the loaded modules
        setupDragAndDrop(); // Setup for dynamically loaded modules
    });
});

// Initialize app state (client handling, etc.) - UPDATED VERSION
function initApp() {
    console.log("[Dashboard] Initializing app state");

    const navigationState = sessionStorage.getItem('navigationState');
    console.log("[Dashboard] Navigation state:", navigationState);
    const storedClientStr = sessionStorage.getItem('currentClient');
    console.log("[Dashboard] Client in sessionStorage:", storedClientStr ? "Present" : "None");

    let clientToSet = null;

    // Restore client based on navigation state or session storage
    if (navigationState === 'returningToDashboard' && storedClientStr) {
        try {
            clientToSet = JSON.parse(storedClientStr);
            console.log("[Dashboard] Restoring client from sessionStorage:", clientToSet.name);
        } catch (error) {
            console.error("[Dashboard] Error parsing stored client:", error);
            sessionStorage.removeItem('currentClient');
        }
    } else if (navigationState === 'manualLogout' || navigationState === 'invalidAccess') {
         console.log("[Dashboard] Manual logout or invalid access detected, clearing client");
         clientToSet = null; // Ensure client is cleared
         sessionStorage.removeItem('currentClient'); // Clear storage too
    } else if (!navigationState && storedClientStr) { // Fresh load with stored client
        try {
            clientToSet = JSON.parse(storedClientStr);
            console.log("[Dashboard] Fresh load with stored client:", clientToSet.name);
        } catch (error) {
            console.error("[Dashboard] Error parsing stored client on fresh load:", error);
            sessionStorage.removeItem('currentClient');
        }
    } else { // Fresh load, no stored client
         console.log("[Dashboard] Fresh load with no client");
    }

    // Set the client in the manager (this triggers UI updates via onClientChanged)
    window.ConstructionApp.ClientManager.setCurrentClient(clientToSet);

    // Update total project cost explicitly after client is set
    updateTotalProjectCost();

    // Clear the navigation state after handling it
    sessionStorage.removeItem('navigationState');

    // Log final client state and update debug panel
    const currentClient = window.ConstructionApp.ClientManager.getCurrentClient();
    console.log("[Dashboard] Current client after initialization:", currentClient ? currentClient.name : "None");
    updateDebugPanel();
}

// --- Module Loading and Rendering ---

/**
 * Loads modules from Firebase (or backup) and renders them hierarchically.
 */
async function loadAndRenderModules() {
    console.log("[Dashboard] Loading and rendering modules");
    let loadedModules = [];
    try {
        // Attempt to load from Firebase first
        loadedModules = await window.ConstructionApp.Firebase.loadModules();
        console.log("[Dashboard] Loaded modules from Firebase:", loadedModules.length);

        if (!loadedModules || loadedModules.length === 0) {
             console.warn("[Dashboard] No modules found in Firebase, attempting backup restore.");
             loadedModules = restoreModuleOrderFromBackup(); // Try backup
             if (!loadedModules || loadedModules.length === 0) {
                 console.warn("[Dashboard] Backup restore failed or empty. Using hardcoded defaults.");
                 // Fallback to hardcoded default modules if both fail
                 loadedModules = getDefaultModules();
                 // Attempt to save these defaults back to Firebase
                 await window.ConstructionApp.Firebase.saveModules(loadedModules);
             }
        }
    } catch (error) {
        console.error("[Dashboard] Error loading modules from Firebase, trying backup:", error);
        loadedModules = restoreModuleOrderFromBackup(); // Try backup
         if (!loadedModules || loadedModules.length === 0) {
             console.warn("[Dashboard] Backup restore failed or empty. Using hardcoded defaults.");
             loadedModules = getDefaultModules();
             // Attempt to save these defaults back to Firebase
             await window.ConstructionApp.Firebase.saveModules(loadedModules);
         }
    }

    // Ensure Notes module is always present and first (if possible)
    const notesModuleIndex = loadedModules.findIndex(m => m.id === 'notes');
    let notesModuleData;
    if (notesModuleIndex > -1) {
        notesModuleData = loadedModules.splice(notesModuleIndex, 1)[0];
    } else {
        // Create default Notes module if missing
        notesModuleData = {
            id: 'notes', name: 'Notes', requiresClient: true, type: 'regular', parentId: null, order: -1 // Ensure it comes first
        };
    }
    // Ensure essential fields are present
    notesModuleData.type = notesModuleData.type || 'regular';
    notesModuleData.parentId = notesModuleData.parentId !== undefined ? notesModuleData.parentId : null;
    notesModuleData.order = notesModuleData.order !== undefined ? notesModuleData.order : -1;

    // Add Notes module back at the beginning
    loadedModules.unshift(notesModuleData);


    // --- Populate appData.modules with loaded data and functions ---
    appData.modules = loadedModules.map(mod => ({
        ...mod, // Spread loaded data (id, name, requiresClient, type, parentId, order)
        // Add default render/save functions (can be overridden later if needed)
        renderTemplate: function(client) {
            // Default render for modules without specific logic
            const moduleData = client?.moduleData?.[mod.id]?.data || {};
            let content = `<h3>${mod.name}</h3>`;
            if (mod.id !== 'notes') { // Don't show placeholder for notes
                 content += `<p>Data for this module:</p><pre>${JSON.stringify(moduleData, null, 2)}</pre>`;
                 content += `<p><small>Create ${mod.id}.html for custom functionality.</small></p>`;
            } else {
                 // Specific render for Notes
                 const notesText = moduleData.notes || '';
                 content = `
                     <h3>Project Notes</h3>
                     <textarea id="project-notes" rows="10" style="width: 100%; padding: 10px;" placeholder="Enter project notes here...">${notesText}</textarea>
                     <button class="btn module-save-btn" data-module="notes" style="margin-top: 10px;">Save Notes</button>
                 `;
            }
            return content;
        },
        saveData: function() {
             // Default save (empty) - Notes overrides this
             if (mod.id === 'notes') {
                 const notes = document.getElementById('project-notes')?.value || '';
                 return { notes: notes };
             }
            return {};
        }
    }));

    // Render the hierarchical list
    renderModuleList(appData.modules);

    // Save the potentially updated list (with Notes added/defaulted) back to storage
    saveModuleStructure(); // Save the structure to Firebase/backup
}

/**
 * Gets default modules if loading fails.
 */
function getDefaultModules() {
     // Define default modules if loading fails completely
     return [
         // Notes is handled separately now
         { id: 'p-and-gs', name: 'P&G\'s', requiresClient: true, type: 'regular', parentId: null, order: 1 },
         { id: 'foundations', name: 'Foundations', requiresClient: false, type: 'header', parentId: null, order: 2 },
         { id: 'earthworks', name: 'Earthworks', requiresClient: true, type: 'regular', parentId: 'foundations', order: 0 },
         { id: 'concrete', name: 'Concrete', requiresClient: true, type: 'regular', parentId: 'foundations', order: 1 },
         { id: 'steel', name: 'Steel', requiresClient: true, type: 'regular', parentId: 'foundations', order: 2 },
         { id: 'structure', name: 'Structure', requiresClient: false, type: 'header', parentId: null, order: 3 },
         { id: 'brickwork', name: 'Brickwork', requiresClient: true, type: 'regular', parentId: 'structure', order: 0 },
         { id: 'demolish', name: 'Demolish', requiresClient: true, type: 'regular', parentId: null, order: 4 }, // Example standalone
         // Add other known modules here with type and parentId
     ];
}


/**
 * Renders the module list hierarchically.
 * @param {Array} modules - The complete list of module objects.
 */
function renderModuleList(modules) {
    const container = document.getElementById('modules-container');
    container.innerHTML = ''; // Clear existing list

    // Sort modules primarily by order, then alphabetically for stability if order is missing
    const sortedModules = [...modules].sort((a, b) => {
         const orderA = a.order ?? Infinity;
         const orderB = b.order ?? Infinity;
         if (orderA !== orderB) {
             return orderA - orderB;
         }
         return a.name.localeCompare(b.name);
     });


    // Function to recursively render modules
    function renderLevel(parentId, level) {
        sortedModules
            .filter(m => m.parentId === parentId)
            .forEach(module => {
                const moduleElement = createModuleElement(module, level);
                container.appendChild(moduleElement);
                // Recursively render children
                renderLevel(module.id, level + 1);
            });
    }

    // Start rendering top-level modules (parentId is null)
    renderLevel(null, 0);

    // Re-attach event listeners (dropdowns, clicks) to the new elements
    setupModuleElementEventListeners();
    // Re-setup drag and drop for the newly rendered elements
    // NOTE: Drag and drop setup might need adjustments if elements are frequently re-rendered.
    // Consider if DnD listeners should also use event delegation on the container.
    setupDragAndDrop(); // Re-attaching listeners after full render
}

/**
 * Creates a DOM element for a single module.
 * @param {object} moduleData - The module data object.
 * @param {number} level - The hierarchy level (for indentation).
 * @returns {HTMLElement} The created module element.
 */
function createModuleElement(moduleData, level = 0) {
    const moduleElement = document.createElement('div');
    moduleElement.className = 'module-item';
    moduleElement.draggable = true;
    moduleElement.setAttribute('data-module-id', moduleData.id);
    moduleElement.setAttribute('data-requires-client', moduleData.requiresClient ? 'true' : 'false');
    moduleElement.setAttribute('data-module-type', moduleData.type || 'regular'); // Default to regular
    moduleElement.setAttribute('data-parent-id', moduleData.parentId || 'null');
    moduleElement.setAttribute('data-level', level); // Store level for styling/logic

    // Apply indentation dynamically using inline style
    moduleElement.style.paddingLeft = `${20 + level * 15}px`; // Base padding + indent per level

    moduleElement.innerHTML = `
        <div class="module-drag-handle">≡</div>
        <div class="module-icon">
            ...
            <div class="dropdown-menu">
                <div class="dropdown-item edit-module">Edit</div>
                <div class="dropdown-item delete-module">Delete</div>
            </div>
        </div>
        <span class="module-name">${moduleData.name}</span>
    `;

    return moduleElement;
}

/**
 * Attaches event listeners (click, dropdown) to all module items currently in the DOM.
 * Uses a flag to prevent adding duplicate listeners if called multiple times on the same elements.
 */
function setupModuleElementEventListeners() {
     document.querySelectorAll('.module-item').forEach(moduleElement => {
         // Prevent duplicate listeners if called multiple times
         if (moduleElement.dataset.listenersAttached === 'true') return;

         setupModuleClickHandler(moduleElement);
         setupDropdownForModule(moduleElement); // Note: Dropdown actions are mostly handled by delegation now
         moduleElement.dataset.listenersAttached = 'true'; // Mark as attached
     });
}


// --- Module Creation ---

// Setup the "Add New Module" button to open the modal
function setupAddModuleButton() {
    const addModuleBtn = document.getElementById('add-module-btn');
    const modalOverlay = document.getElementById('add-module-modal-overlay');
    const moduleTypeSelect = document.getElementById('new-module-type');
    const parentHeaderGroup = document.getElementById('parent-header-group');
    const parentHeaderSelect = document.getElementById('parent-header-select');
    const saveNewModuleBtn = document.getElementById('save-new-module-btn');
    // Get all close/cancel buttons for this specific modal
    const modalCloseBtns = modalOverlay.querySelectorAll('.modal-close, .btn-cancel');

    if (addModuleBtn) {
        addModuleBtn.addEventListener('click', () => {
            // Populate parent header dropdown
            parentHeaderSelect.innerHTML = '<option value="null">(Top Level)</option>'; // Reset
            appData.modules
                .filter(m => m.type === 'header')
                .sort((a,b) => a.name.localeCompare(b.name)) // Sort headers alphabetically
                .forEach(header => {
                    const option = document.createElement('option');
                    option.value = header.id;
                    option.textContent = header.name;
                    parentHeaderSelect.appendChild(option);
                });

            // Reset form
            document.getElementById('new-module-name').value = '';
            moduleTypeSelect.value = 'regular';
            parentHeaderGroup.style.display = 'block'; // Show parent select by default for regular
            parentHeaderSelect.value = 'null';
            document.getElementById('new-module-requires-client').checked = true;

            modalOverlay.style.display = 'flex';
        });
    }

     // Show/hide parent selection based on type
     if (moduleTypeSelect) {
         moduleTypeSelect.addEventListener('change', function() {
             // Show parent selection only for 'regular' type
             parentHeaderGroup.style.display = this.value === 'regular' ? 'block' : 'none';
         });
     }

    // Handle modal close/cancel buttons
    modalCloseBtns.forEach(btn => {
        // Ensure listener isn't added multiple times if setupAddModuleButton is called again
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', function() {
            modalOverlay.style.display = 'none'; // Close the specific modal overlay
        });
    });

     // Close modal if clicking outside the modal content
     modalOverlay.addEventListener('click', function(event) {
         if (event.target === modalOverlay) {
             modalOverlay.style.display = 'none';
         }
     });


    // Handle saving the new module
    if (saveNewModuleBtn) {
        // Ensure listener isn't added multiple times
        const newSaveBtn = saveNewModuleBtn.cloneNode(true);
        saveNewModuleBtn.parentNode.replaceChild(newSaveBtn, saveNewModuleBtn);
        newSaveBtn.addEventListener('click', addNewModule);
    }
}

// Add a new module (called from modal save button)
function addNewModule() {
    const moduleNameInput = document.getElementById('new-module-name');
    const moduleTypeSelect = document.getElementById('new-module-type');
    const parentHeaderSelect = document.getElementById('parent-header-select');
    const requiresClientCheckbox = document.getElementById('new-module-requires-client');

    const moduleName = moduleNameInput.value.trim();
    const moduleType = moduleTypeSelect.value;
    // Parent ID is null if type is header OR if (Top Level) is selected for regular
    const parentId = moduleType === 'header' ? null : (parentHeaderSelect.value === 'null' ? null : parentHeaderSelect.value);
    const requiresClient = requiresClientCheckbox.checked;

    if (!moduleName) {
        alert("Module name is required.");
        moduleNameInput.focus();
        return;
    }

    // Generate a module ID (simple version for now, consider more robust generation later)
    const moduleId = moduleName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // Check if module ID already exists
    if (appData.modules.some(m => m.id === moduleId)) {
        alert(`A module with the ID "${moduleId}" already exists. Please choose a different name.`);
        return;
    }

     // Determine the order - place new items at the end of their level/parent
     let order = 0;
     const siblings = appData.modules.filter(m => m.parentId === parentId);
     if (siblings.length > 0) {
         // Find the maximum order among siblings and add 1
         order = Math.max(...siblings.map(m => m.order ?? -1)) + 1;
     }


    // Create the module data object
    const newModuleData = {
        id: moduleId,
        name: moduleName,
        requiresClient: requiresClient,
        type: moduleType,
        parentId: parentId,
        order: order,
        // Add default render/save functions
        renderTemplate: function(client) { /* ... default render ... */ return `<h3>${moduleName}</h3><p>Default content for new module.</p>`; },
        saveData: function() { /* ... default save ... */ return {}; }
    };

    console.log("Adding new module:", newModuleData);

    // Add to appData array
    appData.modules.push(newModuleData);

    // Re-render the list to include the new module in its correct place
    renderModuleList(appData.modules);

    // Save the updated structure to Firebase/backup
    saveModuleStructure();

    // Close the modal
    document.getElementById('add-module-modal-overlay').style.display = 'none';

    // Notify user
    alert(`Module "${moduleName}" created successfully.`);
}


// --- Module Structure Saving ---

/**
 * Saves the current module structure (order, hierarchy) from appData to Firebase and backup.
 */
function saveModuleStructure() {
    console.log("[Dashboard] Saving module structure");

     // Generate the array of modules from appData to save
     // Ensure we only save the necessary data, not functions
     const modulesToSave = appData.modules.map(module => ({
         id: module.id,
         name: module.name,
         requiresClient: module.requiresClient,
         type: module.type || 'regular',
         parentId: module.parentId, // Already stored as null or ID string
         order: module.order ?? 0 // Default order to 0 if missing
     }));

     // Sorting might not be strictly necessary here if `recalculateModuleOrder` is reliable,
     // but it ensures consistency in the stored data.
     modulesToSave.sort((a, b) => {
         const orderA = a.order ?? Infinity;
         const orderB = b.order ?? Infinity;
         if (orderA !== orderB) return orderA - orderB;
         // Secondary sort by parent, then name for stability
         const parentA = a.parentId ?? ''; // Use empty string for null to sort consistently
         const parentB = b.parentId ?? '';
         if (parentA !== parentB) return parentA.localeCompare(parentB);
         return a.name.localeCompare(b.name);
     });

    console.log("[Dashboard] Modules prepared for saving:", modulesToSave);

    // Save to Firebase
    if (window.ConstructionApp.Firebase) {
        window.ConstructionApp.Firebase.saveModules(modulesToSave)
            .then(success => {
                if (success) {
                    console.log("[Dashboard] Module structure saved to Firebase.");
                    // Save to sessionStorage as backup ONLY on successful Firebase save
                    sessionStorage.setItem('moduleOrder', JSON.stringify(modulesToSave));
                    console.log("[Dashboard] Module structure saved to sessionStorage backup.");
                } else {
                    // Error handled within saveModules, but log here too
                    console.warn("[Dashboard] Firebase.saveModules reported failure. Backup not updated via this path.");
                }
            })
            .catch(error => {
                // This catch block handles errors in the promise chain itself,
                // like network issues before saveModules even runs properly.
                console.error("[Dashboard] Error in saveModules promise chain:", error);
                 // Fallback: Save to sessionStorage even if Firebase promise fails
                 sessionStorage.setItem('moduleOrder', JSON.stringify(modulesToSave));
                 console.warn("[Dashboard] Saved module structure to sessionStorage backup due to Firebase promise error.");
            });
    } else {
        console.warn("[Dashboard] Firebase not available, saving structure to sessionStorage only");
        sessionStorage.setItem('moduleOrder', JSON.stringify(modulesToSave));
    }
}

/**
 * Restores module order/structure from sessionStorage backup.
 * @returns {Array|null} The restored module array or null.
 */
function restoreModuleOrderFromBackup() {
    const savedOrder = sessionStorage.getItem('moduleOrder');
    if (savedOrder) {
        try {
            const orderData = JSON.parse(savedOrder);
            console.log("[Dashboard] Restoring module structure from backup:", orderData.length, "modules");
             // Add basic validation/defaults for hierarchy fields if missing from older backups
             return orderData.map(mod => ({
                 ...mod,
                 type: mod.type || 'regular',
                 // Ensure parentId is explicitly null if missing or 'null' string from older saves
                 parentId: (mod.parentId === undefined || mod.parentId === 'null') ? null : mod.parentId,
                 order: mod.order ?? 0
             }));
        } catch (error) {
            console.error("[Dashboard] Error parsing saved module order backup:", error);
            sessionStorage.removeItem('moduleOrder'); // Clear corrupted data
        }
    } else {
        console.warn("[Dashboard] No saved module order found in backup");
    }
    return null; // Indicate failure or no backup
}


// --- Drag and Drop (Hierarchy Aware) ---

let dragOverElement = null; // Track the element being dragged over
let dropIndicator = null; // 'top', 'bottom', or 'middle' (for dropping onto headers)

function setupDragAndDrop() {
    const container = document.getElementById('modules-container');

    // Remove previous listeners if setup is called again (important after re-renders)
    container.removeEventListener('dragstart', handleDragStart);
    container.removeEventListener('dragover', handleDragOver);
    container.removeEventListener('dragleave', handleDragLeave);
    container.removeEventListener('drop', handleDrop);
    container.removeEventListener('dragend', handleDragEnd);

    // Add listeners using event delegation on the container
    container.addEventListener('dragstart', handleDragStart);
    container.addEventListener('dragover', handleDragOver);
    container.addEventListener('dragleave', handleDragLeave);
    container.addEventListener('drop', handleDrop);
    container.addEventListener('dragend', handleDragEnd);
    console.log("[Dashboard] Drag and Drop listeners attached.");
}

function handleDragStart(e) {
     // Ensure the event target is a draggable module item or its handle
     const target = e.target.closest('.module-item');
     if (!target || !target.draggable) {
         e.preventDefault(); // Prevent dragging non-module items
         return;
     }

     // Check if drag started specifically on the handle (optional, improves UX)
     // const handle = e.target.closest('.module-drag-handle');
     // if (!handle) {
     //      e.preventDefault(); // Only allow dragging via handle
     //      return;
     // }

     globalDraggedItem = target;
     // Use a minimal data transfer (module ID is enough)
     e.dataTransfer.setData('text/plain', target.dataset.moduleId);
     e.dataTransfer.effectAllowed = 'move';

     // Add dragging class after a short delay to allow browser to capture drag image
     setTimeout(() => {
         if (globalDraggedItem) globalDraggedItem.classList.add('dragging');
     }, 0);
     console.log("Drag Start:", target.dataset.moduleId);
}

function handleDragOver(e) {
     e.preventDefault(); // Necessary to allow dropping
     e.dataTransfer.dropEffect = 'move';

     const targetElement = e.target.closest('.module-item');

     // If not over a valid module item or over the item being dragged, clear indicators
     if (!targetElement || targetElement === globalDraggedItem) {
         clearDropIndicators();
         dragOverElement = null;
         dropIndicator = null;
         return;
     }

     // If moved to a new target element, clear previous indicators
     if (targetElement !== dragOverElement) {
         clearDropIndicators();
         dragOverElement = targetElement;
     }

     // Determine drop position (top, bottom, or middle for headers)
     const rect = targetElement.getBoundingClientRect();
     const yOffset = e.clientY - rect.top; // Vertical position within the target element
     const dropZoneHeight = rect.height;

     const targetIsHeader = targetElement.dataset.moduleType === 'header';
     // Allow dropping regular items onto headers, prevent headers onto headers
     const canDropOnHeader = targetIsHeader && globalDraggedItem?.dataset.moduleType !== 'header';

     // Define thresholds for drop zones (e.g., top 30%, middle 40%, bottom 30%)
     const topThreshold = dropZoneHeight * 0.3;
     const bottomThreshold = dropZoneHeight * 0.7;

     let currentIndicator = null;

     // Check for dropping ONTO a header first (middle zone)
     if (canDropOnHeader && yOffset > topThreshold && yOffset < bottomThreshold) {
         currentIndicator = 'middle';
     }
     // Check for dropping ABOVE (top zone)
     else if (yOffset <= topThreshold) {
         currentIndicator = 'top';
     }
     // Check for dropping BELOW (bottom zone)
     else {
         currentIndicator = 'bottom';
     }

     // Update indicators only if the indicator type changes
     if (currentIndicator !== dropIndicator) {
         targetElement.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-middle');
         dropIndicator = currentIndicator; // Store the current indicator type

         if (dropIndicator === 'middle') {
             targetElement.classList.add('drag-over-middle');
         } else if (dropIndicator === 'top') {
             targetElement.classList.add('drag-over-top');
         } else if (dropIndicator === 'bottom') {
             targetElement.classList.add('drag-over-bottom');
         }
     }
}


function handleDragLeave(e) {
     // Check if the mouse is truly leaving the element or just moving over child elements
     const targetElement = e.target.closest('.module-item');
     if (!targetElement) return;

     // Get the element the mouse is moving to
     const relatedTarget = e.relatedTarget ? e.relatedTarget.closest('.module-item') : null;

     // If leaving the current dragOverElement entirely (not moving to another module item within it)
     if (targetElement === dragOverElement && relatedTarget !== dragOverElement) {
          clearDropIndicators(targetElement); // Clear indicators for this specific element
          // Only reset dragOverElement if we are truly leaving it
          if (!targetElement.contains(e.relatedTarget)) {
               dragOverElement = null;
               dropIndicator = null;
          }
     }
}

function handleDrop(e) {
    e.preventDefault(); // Prevent default drop behavior
    if (!globalDraggedItem || !dragOverElement || globalDraggedItem === dragOverElement || !dropIndicator) {
         // Invalid drop scenario
         clearDropIndicators();
         // dragEnd will handle resetting globalDraggedItem etc.
         return;
    }

    console.log(`Drop ${globalDraggedItem.dataset.moduleId} onto ${dragOverElement.dataset.moduleId}, indicator: ${dropIndicator}`);

    const draggedId = globalDraggedItem.dataset.moduleId;
    const targetId = dragOverElement.dataset.moduleId;

    // Find module data in appData using the IDs
    const draggedModuleIndex = appData.modules.findIndex(m => m.id === draggedId);
    const targetModuleIndex = appData.modules.findIndex(m => m.id === targetId);

    if (draggedModuleIndex === -1 || targetModuleIndex === -1) {
         console.error("Could not find dragged or target module in appData during drop.");
         clearDropIndicators(); // Clean up UI
         // dragEnd will handle resetting globalDraggedItem etc.
         return;
    }

    const draggedModule = appData.modules[draggedModuleIndex];
    const targetModule = appData.modules[targetModuleIndex];

    let newParentId = null;
    let targetPositionIndex = -1; // Index in the appData array where the item should be inserted

    // Determine the new parent and target position based on the drop indicator
    if (dropIndicator === 'middle' && targetModule.type === 'header') {
         // Dropping onto a header: Make dragged item a child of the target header
         newParentId = targetModule.id;
         // Find the index right after the target header to insert the new child logically
         targetPositionIndex = targetModuleIndex + 1;
         console.log(`Setting parent of ${draggedId} to ${newParentId}`);
    } else if (dropIndicator === 'bottom') {
         // Dropping below the target: Make dragged item a sibling, placed after the target
         newParentId = targetModule.parentId; // Same parent as target
         // Find the index after the target module
         targetPositionIndex = targetModuleIndex + 1;
         console.log(`Inserting ${draggedId} after ${targetId} (parent: ${newParentId})`);
    } else { // dropIndicator === 'top'
         // Dropping above the target: Make dragged item a sibling, placed before the target
         newParentId = targetModule.parentId; // Same parent as target
         // Target index is the index before the target module
         targetPositionIndex = targetModuleIndex;
         console.log(`Inserting ${draggedId} before ${targetId} (parent: ${newParentId})`);
    }

    // --- Update appData ---
    // 1. Update the dragged module's parentId
    draggedModule.parentId = newParentId;

    // 2. Remove the dragged module from its original position in the array
    //    Do this *after* determining the target index relative to the original array state.
    appData.modules.splice(draggedModuleIndex, 1);

    // 3. Adjust the targetPositionIndex if the removal shifted the indices
    if (draggedModuleIndex < targetPositionIndex) {
        targetPositionIndex--;
    }

    // 4. Insert the dragged module at the calculated target position
    appData.modules.splice(targetPositionIndex, 0, draggedModule);

    // 5. Recalculate the 'order' property for all modules based on their new parent/sibling relationships
    recalculateModuleOrder();

    // --- Update DOM & Save ---
    // Re-render the entire list based on the updated and reordered appData
    renderModuleList(appData.modules);

    // Save the new structure to Firebase/backup
    saveModuleStructure();

    // Clean up UI indicators (dragEnd will also do this, but good practice here too)
    clearDropIndicators();
    // Note: globalDraggedItem is reset in dragEnd
}

function handleDragEnd(e) {
     // Clean up dragging styles regardless of drop success
     if (globalDraggedItem) {
         globalDraggedItem.classList.remove('dragging');
     }
     clearDropIndicators(); // Clear any lingering visual indicators
     globalDraggedItem = null; // Reset the global reference
     dragOverElement = null;
     dropIndicator = null;
     console.log("Drag End");
}

/**
 * Clears all drag-over visual indicators from module items.
 * @param {HTMLElement} [element] - Optional specific element to clear indicators from.
 */
function clearDropIndicators(element) {
     const selector = '.module-item.drag-over-top, .module-item.drag-over-bottom, .module-item.drag-over-middle';
     const elementsToClear = element ? [element] : document.querySelectorAll(selector);

     elementsToClear.forEach(el => {
          if (el) { // Check if element exists
               el.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-middle');
          }
     });
}


/**
 * Recalculates the 'order' property for all modules based on their
 * current position in the appData.modules array and their parentId.
 * Ensures sequential order within each parent group.
 */
function recalculateModuleOrder() {
    console.log("Recalculating module order...");
    const orderCounters = {}; // Stores the next order number for each parent { parentId: nextOrder }

    appData.modules.forEach(module => {
        const parentKey = module.parentId === null ? 'null' : module.parentId;

        // Initialize counter for this parent if it doesn't exist
        if (orderCounters[parentKey] === undefined) {
            orderCounters[parentKey] = 0;
        }

        // Assign the current order number and increment the counter for the parent
        module.order = orderCounters[parentKey];
        orderCounters[parentKey]++;
    });
     console.log("Order recalculation complete.");
     // Optionally log the new order for debugging:
     // console.log("New Order:", appData.modules.map(m => ({ id: m.id, parentId: m.parentId, order: m.order })));
}


// --- Other UI Functions ---

// Setup dropdown menus using event delegation
function setupDropdownMenus() {
     const container = document.getElementById('modules-container');

     // Remove previous listener to prevent duplicates if called again
     container.removeEventListener('click', handleDropdownClick);
     // Add a single listener for all dropdown interactions within the container
     container.addEventListener('click', handleDropdownClick);

     // Global click listener to close dropdowns when clicking outside
     document.removeEventListener('click', handleGlobalClickForDropdowns); // Remove previous
     document.addEventListener('click', handleGlobalClickForDropdowns);
     console.log("[Dashboard] Dropdown listeners attached.");
}

// Handler for clicks within the modules container (for dropdowns)
function handleDropdownClick(e) {
     const icon = e.target.closest('.module-icon');
     const editBtn = e.target.closest('.edit-module');
     const deleteBtn = e.target.closest('.delete-module');

     // Handle icon click to toggle dropdown
     if (icon) {
         e.stopPropagation(); // Prevent global click listener from closing it immediately
         const dropdown = icon.querySelector('.dropdown-menu');
         if (dropdown) {
             const isVisible = dropdown.style.display === 'block';
             // Close all other dropdowns first
             closeAllDropdowns();
             // Toggle this dropdown
             if (!isVisible) {
                 dropdown.style.display = 'block';
             }
         }
     }
     // Handle edit button click
     else if (editBtn) {
         e.stopPropagation(); // Prevent container click logic
         const moduleItem = editBtn.closest('.module-item');
         if (moduleItem) editModule(moduleItem);
         closeAllDropdowns(); // Close dropdown after action
     }
     // Handle delete button click
     else if (deleteBtn) {
         e.stopPropagation(); // Prevent container click logic
         const moduleItem = deleteBtn.closest('.module-item');
         if (moduleItem) deleteModule(moduleItem);
         closeAllDropdowns(); // Close dropdown after action
     }
     // If the click was inside the container but not on an interactive dropdown element,
     // it might implicitly close dropdowns via the global listener.
}

// Global click handler to close dropdowns
function handleGlobalClickForDropdowns(e) {
      // If the click was outside any module icon (which toggles the dropdown)
      if (!e.target.closest('.module-icon')) {
           closeAllDropdowns();
      }
}


function closeAllDropdowns() {
    document.querySelectorAll('#modules-container .dropdown-menu').forEach(menu => {
        menu.style.display = 'none';
    });
}

// Edit a module's name
function editModule(moduleElement) {
     const moduleId = moduleElement.dataset.moduleId;
     const moduleIndex = appData.modules.findIndex(m => m.id === moduleId);
     if (moduleIndex === -1) {
          console.error("Module not found in appData for editing:", moduleId);
          return;
     }

     const currentModule = appData.modules[moduleIndex];
     const currentName = currentModule.name;

    const newName = prompt(`Edit module name:`, currentName);

    // Proceed only if a new name was entered and it's different
    if (newName && newName.trim() !== '' && newName !== currentName) {
        // Update name in appData
        currentModule.name = newName.trim();

         // Update name in the DOM element directly for immediate feedback
         const nameSpan = moduleElement.querySelector('.module-name');
         if (nameSpan) nameSpan.textContent = newName.trim();

        // Save the updated structure (which includes the name change)
        saveModuleStructure();
        alert(`Module renamed to "${newName.trim()}"`);
    }
}

// Delete a module (and its children if it's a header)
function deleteModule(moduleElement) {
     const moduleId = moduleElement.dataset.moduleId;
     const moduleIndex = appData.modules.findIndex(m => m.id === moduleId);
     if (moduleIndex === -1) {
          console.error("Module not found in appData for deletion:", moduleId);
          return;
     }

     const moduleToDelete = appData.modules[moduleIndex];
     const moduleName = moduleToDelete.name;

     // Prevent deleting the essential Notes module
     if (moduleId === 'notes') {
         alert('The Notes module cannot be deleted.');
         return;
     }

     // Check if it's a header and find its direct children
     const children = appData.modules.filter(m => m.parentId === moduleId);
     let confirmMessage = `Are you sure you want to delete the "${moduleName}" module?`;

     // Add warning if deleting a header with children
     if (moduleToDelete.type === 'header' && children.length > 0) {
          confirmMessage += `\n\nWARNING: This is a header containing ${children.length} sub-module(s). Deleting it will also delete ALL its sub-modules recursively. This cannot be undone.`;
     } else {
          confirmMessage += `\nThis cannot be undone.`;
     }


    if (confirm(confirmMessage)) {
         // Find indices of the module and all its descendants (recursive)
         const idsToDelete = new Set([moduleId]);
         const queue = [moduleId]; // Start with the initial module ID

         while (queue.length > 0) {
              const currentParentId = queue.shift();
              // Find direct children of the current parent
              appData.modules.forEach(module => {
                  if (module.parentId === currentParentId) {
                      if (!idsToDelete.has(module.id)) { // Avoid infinite loops (though unlikely with tree structure)
                           idsToDelete.add(module.id);
                           queue.push(module.id); // Add child ID to queue to find its children
                      }
                  }
              });
         }

         console.log("Modules (and descendants) marked for deletion:", Array.from(idsToDelete));

         // Filter out the modules to be deleted from appData
         appData.modules = appData.modules.filter(module => !idsToDelete.has(module.id));

         // Recalculate order after deletion
         recalculateModuleOrder();

         // Re-render the list with the remaining modules
         renderModuleList(appData.modules);

        // Save the updated structure
        saveModuleStructure();
        alert(`Module "${moduleName}" ${idsToDelete.size > 1 ? 'and its sub-modules ' : ''}deleted successfully.`);
    }
}

// Setup module search/filter
function setupModuleSearch() {
     const searchInput = document.getElementById('module-search-input');
     const container = document.getElementById('modules-container');

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
         const allModuleElements = container.querySelectorAll('.module-item'); // Get current elements
         const visibleModuleIds = new Set(); // Track IDs that should be visible

         // If search term is empty, show all
         if (searchTerm === '') {
              allModuleElements.forEach(moduleEl => {
                   moduleEl.style.display = 'flex';
              });
              return;
         }

         // Find matches and their ancestors
         appData.modules.forEach(module => {
             const moduleName = module.name.toLowerCase();
             const isMatch = moduleName.includes(searchTerm);

             if (isMatch) {
                  // If a module matches, mark it and all its ancestors for visibility
                  visibleModuleIds.add(module.id);
                  let currentParentId = module.parentId;
                  while (currentParentId && currentParentId !== 'null') { // Check against 'null' string just in case
                       visibleModuleIds.add(currentParentId);
                       // Find the parent in appData to get its parentId
                       const parentModule = appData.modules.find(m => m.id === currentParentId);
                       currentParentId = parentModule ? parentModule.parentId : null;
                  }
             }
         });

         // Set visibility based on the collected IDs
         allModuleElements.forEach(moduleEl => {
              const moduleId = moduleEl.dataset.moduleId;
              if (visibleModuleIds.has(moduleId)) {
                   moduleEl.style.display = 'flex'; // Show matching items and their ancestors
              } else {
                   moduleEl.style.display = 'none'; // Hide non-matching items
              }
         });
     };

     // Attach the debounced filter function to the input event
     searchInput.addEventListener('input', debounceFilter(filterModules, 250)); // Debounce by 250ms
}


// --- Client Management & Dashboard Update ---

// Setup client management UI (modals, etc.)
function setupClientManagement() {
    console.log("[Dashboard] Setting up client management");
    const newClientBtn = document.getElementById('new-client-btn');
    const openClientBtn = document.getElementById('open-client-btn');

    // Find or create the specific overlay for client modals
    let clientModalOverlay = document.getElementById('client-modal-overlay');
    if (!clientModalOverlay) {
        clientModalOverlay = document.createElement('div');
        clientModalOverlay.className = 'modal-overlay'; // Generic overlay class
        clientModalOverlay.id = 'client-modal-overlay'; // Specific ID
        document.body.appendChild(clientModalOverlay);

         // Close modal when clicking the background overlay
         clientModalOverlay.addEventListener('click', (event) => {
             if (event.target === clientModalOverlay) {
                 clientModalOverlay.style.display = 'none';
             }
         });
    }


    // New client button event listener
    newClientBtn.addEventListener('click', () => {
        const clientModal = createClientModal('new');
        clientModalOverlay.innerHTML = ''; // Clear previous modal content
        clientModalOverlay.appendChild(clientModal);
        clientModalOverlay.style.display = 'flex';
    });

    // Open client button event listener
    openClientBtn.addEventListener('click', () => {
        const clientModal = createClientModal('open');
         clientModalOverlay.innerHTML = ''; // Clear previous modal content
        clientModalOverlay.appendChild(clientModal);
        clientModalOverlay.style.display = 'flex';
    });
}

 // Create client modal dialog (ensure it uses the correct overlay ID)
 function createClientModal(type) {
     const modal = document.createElement('div');
     modal.className = 'modal'; // Use the standard modal class
     const overlayId = 'client-modal-overlay'; // Define the target overlay ID

     if (type === 'new') {
         // New client modal content
         modal.innerHTML = `
             <div class="modal-header">
                 <h2 class="modal-title">New Client</h2>
                 <span class="modal-close" data-modal-id="${overlayId}">&times;</span>
             </div>
             <div class="modal-body">
                 <div class="form-group">
                     <label for="client-name">Client Name:</label>
                     <input type="text" id="client-name" class="form-control">
                 </div>
                 <div class="form-group">
                     <label for="client-address">Client Address:</label>
                     <input type="text" id="client-address" class="form-control">
                 </div>
             </div>
             <div class="modal-footer">
                 <button class="btn btn-cancel" data-modal-id="${overlayId}">Cancel</button>
                 <button class="btn btn-save">Save</button>
             </div>
         `;

         // Set up event handlers using setTimeout to ensure elements are in DOM
         setTimeout(() => {
             setupModalCloseButtons(modal, overlayId); // Pass overlay ID

             const saveBtn = modal.querySelector('.btn-save');
             saveBtn.addEventListener('click', () => {
                 const nameInput = modal.querySelector('#client-name');
                 const addressInput = modal.querySelector('#client-address');
                 const name = nameInput.value.trim();
                 const address = addressInput.value.trim();

                 if (!name) {
                     alert('Client name is required');
                     nameInput.focus();
                     return;
                 }

                 const newClient = { name: name, address: address, moduleData: {} };
                 console.log("[Dashboard] Creating new client:", name);

                 // Add client and set as current using ClientManager
                 const client = window.ConstructionApp.ClientManager.addClient(newClient);
                 window.ConstructionApp.ClientManager.setCurrentClient(client);
                 updateDebugPanel(); // Update debug info

                 alert(`Client "${name}" created and selected.`);
                 document.getElementById(overlayId).style.display = 'none'; // Close modal
             });
         }, 0);
     } else if (type === 'open') {
         const clients = window.ConstructionApp.ClientManager.getAllClients();
         let clientListHTML = '';
         if (clients.length > 0) {
             // Sort clients alphabetically for better usability
             clients.sort((a, b) => a.name.localeCompare(b.name));
             clientListHTML = clients.map((client, index) =>
                 // Use client ID for selection, more robust than index
                 `<div class="client-list-item" data-client-id="${client.id}">${client.name}</div>`
             ).join('');
         } else {
             clientListHTML = '<div style="padding: 10px; text-align: center; color: #666;">No clients found</div>';
         }

         // Open client modal content
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
                 <div class="client-list">
                     ${clientListHTML}
                 </div>
             </div>
             <div class="modal-footer">
                 <button class="btn btn-cancel" data-modal-id="${overlayId}">Cancel</button>
             </div>
         `;

         // Set up event handlers
         setTimeout(() => {
             setupModalCloseButtons(modal, overlayId); // Pass overlay ID
             setupClientListSelection(modal); // Setup click handlers for list items
             setupClientSearch(modal); // Setup search input filtering
         }, 0);
     }

     return modal;
 }

// Set up modal close/cancel buttons (accepts overlay ID)
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
                 console.error("Overlay not found for ID:", overlayId);
             }
         });
    });
}

// Set up client search filtering
function setupClientSearch(modal) {
    const searchInput = modal.querySelector('#client-search');
    const clientListContainer = modal.querySelector('.client-list');
    if (searchInput && clientListContainer) {
        searchInput.addEventListener('input', () => {
            const searchTerm = searchInput.value.toLowerCase().trim();
            const clientItems = clientListContainer.querySelectorAll('.client-list-item');
            clientItems.forEach(item => {
                // Check if the item has a client ID (ignore "No clients found" message)
                if (item.dataset.clientId) {
                     const clientName = item.textContent.toLowerCase();
                     // Show item if search term is empty or name includes the term
                     item.style.display = (searchTerm === '' || clientName.includes(searchTerm)) ? 'block' : 'none';
                }
            });
        });
    }
}

// Set up client list selection (uses client ID)
function setupClientListSelection(modal) {
    const clientListContainer = modal.querySelector('.client-list');
    if (!clientListContainer) return;

    // Use event delegation on the container
    clientListContainer.addEventListener('click', (event) => {
         const listItem = event.target.closest('.client-list-item');
         // Ensure the clicked item is a valid client item with an ID
         if (listItem && listItem.dataset.clientId) {
              const clientId = listItem.dataset.clientId;
              const clients = window.ConstructionApp.ClientManager.getAllClients();
              const selectedClient = clients.find(c => c.id === clientId);

              if (selectedClient) {
                  console.log("[Dashboard] Selecting client:", selectedClient.name);
                  window.ConstructionApp.ClientManager.setCurrentClient(selectedClient);
                  updateDebugPanel(); // Update debug info
                  // Close the specific modal overlay
                  const overlay = modal.closest('.modal-overlay');
                  if (overlay) overlay.style.display = 'none';
                  alert(`Client "${selectedClient.name}" selected.`);
              } else {
                   console.error("Selected client ID not found in ClientManager:", clientId);
              }
         }
    });
}


// Update the dashboard UI based on the current client
function updateDashboard(client) {
    console.log("[Dashboard] Updating dashboard for client:", client?.name);

    const logoutBtn = document.getElementById('logout-btn');
    const dashboardContent = document.getElementById('module-content');
    const clientNameDisplay = document.getElementById('client-name-display');
    const dashboardDesc = document.querySelector('.dashboard-description');

    if (client) {
        // Update client display and show logout button
        clientNameDisplay.textContent = `Client: ${client.name}`;
        dashboardDesc.textContent = `${client.address || 'No address provided'}`;
        logoutBtn.style.display = 'inline-block'; // Use inline-block or block as appropriate

        // Ensure logout listener is attached correctly (clone & replace)
         const newLogoutBtn = logoutBtn.cloneNode(true);
         logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
         newLogoutBtn.addEventListener('click', () => window.ConstructionApp.ModuleUtils.logoutClient());

        // Update total project cost
        updateTotalProjectCost();

        // Render the dashboard content (module tiles)
        renderDashboardContent(client);

    } else {
        // Clear client display and hide logout button
        clientNameDisplay.textContent = '';
        document.getElementById('total-project-cost').textContent = 'Total Project Cost: R0.00';
        dashboardDesc.textContent = 'Overview of project data.'; // Reset description
        logoutBtn.style.display = 'none';

        // Show the "No Client Selected" notification
        dashboardContent.innerHTML = `
            <div class="no-client-notification">
                <h2>No Client Selected</h2>
                <p>Please select an existing client or create a new client to start working.</p>
                <div class="no-client-buttons">
                    <button id="prompt-new-client" class="btn no-client-button">Create New Client</button>
                    <button id="prompt-open-client" class="btn no-client-button">Open Existing Client</button>
                </div>
            </div>
        `;

        // Add event listeners to the prompt buttons (use setTimeout to ensure elements exist)
        setTimeout(() => {
            const newClientBtn = document.getElementById('prompt-new-client');
            const openClientBtn = document.getElementById('prompt-open-client');
            // Add listeners only if elements are found
            if (newClientBtn) newClientBtn.addEventListener('click', () => document.getElementById('new-client-btn')?.click());
            if (openClientBtn) openClientBtn.addEventListener('click', () => document.getElementById('open-client-btn')?.click());
        }, 0);
    }
    // Update debug panel regardless of client state
    updateDebugPanel();
}

// Render dashboard content (module tiles) - Refined
function renderDashboardContent(client) {
    const contentElement = document.getElementById('module-content');
    contentElement.innerHTML = ''; // Clear existing content

    let tilesHTML = '';
    let hasModuleDataToShow = false; // Flag to check if any tiles will be rendered

    const moduleDataEntries = client?.moduleData ? Object.entries(client.moduleData) : [];

    console.log("[Dashboard] Rendering tiles. Client module data keys:", Object.keys(client?.moduleData || {}));

    if (moduleDataEntries.length > 0) {
         moduleDataEntries.forEach(([moduleId, moduleVersionedData]) => {
              // Extract the actual data, handling potential null or older formats
              const moduleData = moduleVersionedData?.data ?? moduleVersionedData ?? {};

              // Skip if moduleData is effectively empty (null or empty object)
              if (!moduleData || Object.keys(moduleData).length === 0) {
                   console.log(`[Dashboard] Skipping tile for ${moduleId} - data is null or empty.`);
                   return;
              }

              // Find module info from appData for name
              const moduleInfo = appData.modules.find(m => m.id === moduleId);
              // Use module name from appData if found, otherwise fallback to the ID
              const moduleName = moduleInfo ? moduleInfo.name : moduleId;

              // Calculate module cost (handle different structures)
              let moduleCost = 0;
              if (moduleData.totalCost !== undefined) {
                  moduleCost = parseFloat(moduleData.totalCost) || 0;
              } else if (moduleData.items && Array.isArray(moduleData.items)) {
                  // Use utility function for calculation based on 'allow' or 'quantity'
                  moduleCost = window.ConstructionApp.ModuleUtils.calculateModuleTotal(moduleData.items);
              } else if (moduleId === 'notes') {
                   // Notes module specifically has no cost
                   moduleCost = 0;
              }
              // Add more calculation logic here if other modules store cost differently

              // Render a tile if cost > 0 OR if it's the Notes module (always show Notes if data exists)
              if (moduleCost > 0 || moduleId === 'notes') {
                  hasModuleDataToShow = true; // Mark that we will show at least one tile
                  const formattedCost = window.ConstructionApp.ModuleUtils.formatCurrency(moduleCost);

                  tilesHTML += `
                      <div class="module-tile" data-module-id="${moduleId}">
                          ${moduleId !== 'notes' ? `<button class="clear-module-btn" title="Clear module data">×</button>` : ''}
                          <h5>${moduleName}</h5>
                           ${moduleId !== 'notes' ? `<p class="module-tile-cost">${formattedCost}</p>` : '<p style="font-size: 0.9em; color: #666; margin-top: 10px;">(No cost associated)</p>'}
                          <button class="btn module-open-btn" style="margin-top: 10px;">Open Module</button>
                      </div>
                  `;
              } else {
                   console.log(`[Dashboard] Skipping tile for ${moduleId} - cost is zero.`);
              }
         });
    }

    // Construct final content based on whether tiles were generated
    let finalContent = `
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 10px;">
            <h4 style="margin-bottom: 15px;">Module Summaries</h4>
            <div id="module-tiles" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 15px;">
    `;

    if (hasModuleDataToShow) {
        finalContent += tilesHTML; // Add the generated tiles
    } else {
        // Show message if no relevant module data was found for the client
        finalContent += `
            <div style="background-color: white; padding: 15px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); grid-column: 1 / -1; text-align: center; color: #666;">
                <p>No module data with costs entered yet for this client.</p>
                <p style="margin-top: 5px;"><small>Click a module in the sidebar to begin estimating.</small></p>
            </div>
        `;
    }

    finalContent += `
            </div>
        </div>
    `;

    contentElement.innerHTML = finalContent;

    // Add event listeners to the newly rendered tiles
    setupDashboardTileListeners();
}

// Setup listeners for dashboard tiles (Open, Clear) using event delegation
function setupDashboardTileListeners() {
     const tilesContainer = document.getElementById('module-tiles');
     if (!tilesContainer) return;

     // Remove previous listener to prevent duplicates
     tilesContainer.removeEventListener('click', handleTileClick);
     // Add single listener to the container
     tilesContainer.addEventListener('click', handleTileClick);
}

// Handler function for clicks within the tiles container
function handleTileClick(e) {
      const openBtn = e.target.closest('.module-open-btn');
      const clearBtn = e.target.closest('.clear-module-btn');
      const tile = e.target.closest('.module-tile');

      if (!tile) return; // Click wasn't inside a tile
      const moduleId = tile.dataset.moduleId;

      if (openBtn) {
           // Use navigateToModule utility
           window.ConstructionApp.ModuleUtils.navigateToModule(moduleId);
      } else if (clearBtn) {
           const moduleInfo = appData.modules.find(m => m.id === moduleId);
           const moduleName = moduleInfo ? moduleInfo.name : moduleId;
           if (confirm(`Are you sure you want to clear all data for the "${moduleName}" module? This cannot be undone.`)) {
               clearModuleData(moduleId);
           }
      }
 }


// Clear module data for the current client
function clearModuleData(moduleId) {
    const client = window.ConstructionApp.ClientManager.getCurrentClient();
    // Check if data actually exists for this module before attempting to clear
    if (client && client.moduleData && client.moduleData.hasOwnProperty(moduleId)) {
        console.log(`[Dashboard] Clearing module data for: ${moduleId}`);

        // Use ClientManager to save null, effectively deleting the entry via merge
        window.ConstructionApp.ClientManager.saveModuleData(moduleId, null, (success, error) => {
            if (success) {
                 // Manually update the local client object in memory and sessionStorage
                 // as saveModuleData callback doesn't guarantee the object is updated yet
                 if (client.moduleData) {
                      delete client.moduleData[moduleId]; // Remove from local object
                      sessionStorage.setItem('currentClient', JSON.stringify(client)); // Update storage
                      console.log("[Dashboard] Updated client in sessionStorage after clearing module.");
                 }
                 window.ConstructionApp.ModuleUtils.showSuccessMessage(`Module data cleared successfully`);
                 // Re-render the dashboard immediately to reflect the change
                 renderDashboardContent(client);
                 // Update total project cost
                 updateTotalProjectCost();
            } else {
                window.ConstructionApp.ModuleUtils.showErrorMessage(`Error clearing module data: ${error || 'Unknown error'}`);
                // Optionally, you might want to refresh the client data from Firebase here
                // if the local state might be inconsistent after a failed clear.
            }
        });
    } else {
         console.warn(`[Dashboard] No data found for module ${moduleId} to clear, or client/moduleData is missing.`);
         // Optionally show a message to the user
         // window.ConstructionApp.ModuleUtils.showErrorMessage(`No data found for module ${moduleId} to clear.`);
    }
}


// Update total project cost based on current client data
function updateTotalProjectCost() {
    let totalCost = 0;
    const client = window.ConstructionApp.ClientManager.getCurrentClient();

    if (client && client.moduleData) {
        console.log("[Dashboard] Recalculating total project cost for client:", client.name);
        Object.entries(client.moduleData).forEach(([moduleId, moduleVersionedData]) => {
             // Extract the actual data, handling potential null or older formats
             const moduleData = moduleVersionedData?.data ?? moduleVersionedData ?? {};

             if (!moduleData) return; // Skip if no data

             let costForThisModule = 0;
             // Check for totalCost property first
             if (moduleData.totalCost !== undefined) {
                 costForThisModule = parseFloat(moduleData.totalCost) || 0;
             }
             // Fallback to calculating from items array if totalCost is not present
             else if (moduleData.items && Array.isArray(moduleData.items)) {
                  costForThisModule = window.ConstructionApp.ModuleUtils.calculateModuleTotal(moduleData.items);
             }
             // Add cost for this module to the total
             totalCost += costForThisModule;
             // console.log(`[Dashboard] Cost for ${moduleId}: ${costForThisModule}`); // Uncomment for detailed debugging
        });
    }

    // Format and display the final total
    const formattedTotal = window.ConstructionApp.ModuleUtils.formatCurrency(totalCost);
    document.getElementById('total-project-cost').textContent = `Total Project Cost: ${formattedTotal}`;
    console.log("[Dashboard] Updated total project cost display:", formattedTotal);
}

// --- Debug Panel ---
function setupDebugPanel() {
     const debugPanel = document.getElementById('debug-panel');
     // Avoid creating multiple buttons if called again
     if (document.getElementById('debug-toggle-btn')) return;

     const toggleBtn = document.createElement('button');
     toggleBtn.textContent = 'Debug';
     toggleBtn.id = 'debug-toggle-btn'; // Give it an ID
     toggleBtn.style.cssText = 'position: fixed; bottom: 10px; right: 10px; z-index: 10000; padding: 5px 10px; background: #333; color: white; border: none; border-radius: 3px; cursor: pointer;';
     document.body.appendChild(toggleBtn);

     toggleBtn.addEventListener('click', function() {
         const isVisible = debugPanel.style.display === 'block';
         debugPanel.style.display = isVisible ? 'none' : 'block';
         if (!isVisible) updateDebugPanel(); // Update content when showing
     });
}

function updateDebugPanel() {
     const debugPanel = document.getElementById('debug-panel');
     // Don't update if panel isn't visible
     if (!debugPanel || debugPanel.style.display !== 'block') return;

     const navigationState = sessionStorage.getItem('navigationState');
     const currentClient = window.ConstructionApp.ClientManager.getCurrentClient();
     const storedClientStr = sessionStorage.getItem('currentClient');
     const moduleOrderStr = sessionStorage.getItem('moduleOrder');

     let debugInfo = `
         <strong>Nav State:</strong> ${navigationState || 'None'}<br>
         <strong>Current Client:</strong> ${currentClient ? currentClient.name : 'None'} (ID: ${currentClient?.id || 'N/A'})<br>
         <strong>Client in sessionStorage:</strong> ${storedClientStr ? 'Present' : 'None'}<br>
         <strong>Modules in appData:</strong> ${appData.modules.length}<br>
         <strong>Module Order in Backup:</strong> ${moduleOrderStr ? 'Present' : 'None'}<br>
         <hr>
     `;

     if (currentClient && currentClient.moduleData) {
         debugInfo += '<strong>Client Module Data (Costs):</strong><br>';
         let totalCost = 0;
         Object.entries(currentClient.moduleData).forEach(([moduleId, moduleVData]) => {
              const moduleData = moduleVData?.data ?? moduleVData ?? {};
              let moduleCost = 0;
              if (moduleData?.totalCost !== undefined) moduleCost = moduleData.totalCost;
              else if (moduleData?.items) moduleCost = window.ConstructionApp.ModuleUtils.calculateModuleTotal(moduleData.items);
              totalCost += parseFloat(moduleCost) || 0;
              debugInfo += `- ${moduleId}: Cost: ${window.ConstructionApp.ModuleUtils.formatCurrency(moduleCost)}<br>`;
         });
         debugInfo += `<strong>Calculated Total Cost:</strong> ${window.ConstructionApp.ModuleUtils.formatCurrency(totalCost)}<br><hr>`;
     }

     debugInfo += '<strong>Module Structure (appData):</strong><br><pre style="max-height: 150px; overflow-y: auto; border: 1px solid #555; padding: 5px; font-size: 11px;">';
     // Display structure relevant fields only
     debugInfo += JSON.stringify(appData.modules.map(m => ({id: m.id, name: m.name, type: m.type, parentId: m.parentId, order: m.order})), null, 1);
     debugInfo += '</pre>';

     debugPanel.innerHTML = debugInfo;
}

 // --- Helper Functions --- (Module Click/Dropdown Setup - kept minimal as delegation is primary) ---
 // Helper function to attach click handler to a module's name span
 function setupModuleClickHandler(moduleElement) {
     const moduleText = moduleElement.querySelector('.module-name');
     if (moduleText) {
         // Clone and replace to ensure only one listener is attached
         const newModuleText = moduleText.cloneNode(true);
         moduleText.parentNode.replaceChild(newModuleText, moduleText);

         newModuleText.addEventListener('click', function() {
             const moduleId = moduleElement.getAttribute('data-module-id');
             // Use navigateToModule utility which handles client checks etc.
             window.ConstructionApp.ModuleUtils.navigateToModule(moduleId);
         });
     }
 }

 // Setup dropdown for a single module (minimal, as delegation handles actions)
 function setupDropdownForModule(moduleElement) {
     // The core open/close logic is handled by delegation in setupDropdownMenus
     // This function remains as a placeholder if needed later
 }

