// js/dashboard.js - Refactored: Sidebar logic moved to sidebar-manager.js

// --- Global Variables ---
// Keep appData here for now, as module loading/saving is still here
let appData = {
    modules: [] // Holds the structure/definitions of all available modules
};
// Sidebar-specific globals (globalDraggedItem, headerCollapseState, etc.) are MOVED to sidebar-manager.js

// Ensure the main app namespace exists
window.ConstructionApp = window.ConstructionApp || {};


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

        // Assign the client change callback
        if (window.ConstructionApp && window.ConstructionApp.ClientManager) {
            console.log("DEBUG: Setting ClientManager.onClientChanged callback to updateDashboard.");
            window.ConstructionApp.ClientManager.onClientChanged = updateDashboard;
        } else {
            console.error("[Dashboard] ClientManager not available! Cannot set callback.");
        }

        console.log("DEBUG: Calling initApp...");
        initApp(); // Determine initial client state (will trigger updateDashboard if client changes)
        console.log("DEBUG: initApp COMPLETE.");

        // Initialize the Sidebar Manager, passing the loaded module data
        if (window.ConstructionApp.SidebarManager) {
             console.log("DEBUG: Initializing SidebarManager...");
             // Pass the modules array from appData
             window.ConstructionApp.SidebarManager.init(appData.modules);
        } else {
             console.error("[Dashboard] SidebarManager not found! Sidebar will not function correctly.");
        }

        // Setup other UI elements NOT related to the sidebar list itself
        setupClientManagement();    // Client selection modals
        setupAddModuleButton();     // Add Module button (might move later)

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

    // Logic to determine the client based on navigation state and storage
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
        // Attempt to restore on fresh load or unknown state
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

    // Set the client using ClientManager - this will trigger the onClientChanged callback (updateDashboard)
    if (window.ConstructionApp && window.ConstructionApp.ClientManager) {
        console.log("DEBUG: Calling ClientManager.setCurrentClient with client:", clientToSet ? clientToSet.name : 'None');
        window.ConstructionApp.ClientManager.setCurrentClient(clientToSet);
        console.log("DEBUG: ClientManager.setCurrentClient call complete.");
    } else {
        console.error("[Dashboard] ClientManager not available during initApp!");
        // Fallback: Manually update dashboard if ClientManager failed (less ideal)
        updateDashboard(clientToSet);
    }

    // Clear the navigation state flag after processing it
    sessionStorage.removeItem('navigationState');
    console.log("[Dashboard] Cleared navigation state.");

    updateDebugPanel(); // Update debug info
}

// --- Module Loading and Definition Management (Still in dashboard.js for now) ---

/**
 * Loads module definitions from Firebase, with fallbacks to sessionStorage backup or defaults.
 * Stores the result in appData.modules.
 */
async function loadAndRenderModules() {
    console.log("[Dashboard] Loading modules structure");
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

    // --- Ensure 'Notes' module exists and is first ---
    const notesModuleIndex = loadedModules.findIndex(m => m.id === 'notes');
    let notesModuleData = notesModuleIndex > -1 ? loadedModules.splice(notesModuleIndex, 1)[0] : {};
    // Ensure required properties exist
    notesModuleData = {
        id: 'notes',
        name: notesModuleData.name || 'Notes',
        requiresClient: notesModuleData.requiresClient !== undefined ? notesModuleData.requiresClient : true,
        type: notesModuleData.type || 'regular',
        parentId: notesModuleData.parentId !== undefined ? notesModuleData.parentId : null,
        order: -1, // Ensure it comes first visually if sort uses order
    };
    // Add notes to the beginning
    loadedModules.unshift(notesModuleData);
    // --- End Notes Handling ---


    // Store the final processed list in appData
    // Ensure basic properties and null parentId are handled correctly
    appData.modules = loadedModules.map((mod, index) => ({
        ...mod,
        parentId: (mod.parentId === 'null' || mod.parentId === undefined) ? null : mod.parentId,
        // Assign order based on final array position if 'order' is missing or inconsistent after notes handling
        order: mod.order ?? index,
        // Keep placeholders for render/save if they existed, otherwise add defaults
        renderTemplate: mod.renderTemplate || function(client) { /* Default template */ return `<h3>${mod.name}</h3><p>Default Content</p>`; },
        saveData: mod.saveData || function() { /* Default save */ return {}; }
    }));

     // Re-sort based on final order property
     appData.modules.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));


    console.log("[Dashboard] Module structure processed.");
    // NOTE: Rendering the list is now handled by SidebarManager.init() called after this promise resolves.
}

/**
 * Returns a default set of module definitions if none are loaded.
 */
function getDefaultModules() {
    console.log("[Dashboard] Providing default module set.");
    // Added 'notes' to the default set
    return [
        { id: 'notes', name: 'Notes', requiresClient: true, type: 'regular', parentId: null, order: 0 },
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
 * Saves the current module structure (order, hierarchy, basic info)
 * to Firebase and creates a backup in sessionStorage.
 * NOTE: This needs to be accessible by sidebar-manager.js
 */
function saveModuleStructure() {
    console.log("[Dashboard] Saving module structure");

    // Use appData.modules which should be up-to-date
    const modulesToSave = appData.modules.map(module => ({
        id: module.id,
        name: module.name,
        requiresClient: module.requiresClient,
        type: module.type || 'regular',
        parentId: module.parentId,
        order: module.order ?? 0
    }));

    console.log("[Dashboard] Modules prepared for saving:", modulesToSave.length);

    // Save to Firebase
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
                // Always try to save backup to sessionStorage
                try {
                    sessionStorage.setItem('moduleOrder', JSON.stringify(modulesToSave));
                    console.log("[Dashboard] Module structure backup saved to sessionStorage.");
                } catch (storageError) {
                    console.error("[Dashboard] Error saving structure backup to sessionStorage:", storageError);
                }
            });
    } else {
        // Fallback if Firebase is not available
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
            // Ensure basic properties exist on restore
            return orderData.map(mod => ({
                ...mod,
                type: mod.type || 'regular',
                parentId: (mod.parentId === undefined || mod.parentId === 'null') ? null : mod.parentId,
                order: mod.order ?? 0
            }));
        } catch (error) {
            console.error("[Dashboard] Error parsing module structure backup:", error);
            sessionStorage.removeItem('moduleOrder'); // Clear corrupted backup
        }
    } else {
        console.warn("[Dashboard] No module structure backup found in sessionStorage.");
    }
    return null; // Return null if no valid backup
}


// --- Module Creation (Modal Setup - Still in dashboard.js for now) ---

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

    // Show Modal and Populate Parent Headers
    addModuleBtn.addEventListener('click', () => {
        // Populate parent select options dynamically based on current headers
        parentHeaderSelect.innerHTML = '<option value="null">(Top Level / No Parent)</option>'; // Reset
        appData.modules // Use current appData
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
        moduleTypeSelect.value = 'regular';
        parentHeaderGroup.style.display = 'block'; // Show parent select by default
        parentHeaderSelect.value = 'null'; // Default to top level
        document.getElementById('new-module-requires-client').checked = true; // Default to requiring client

        // Show the modal
        modalOverlay.style.display = 'flex';
    });

    // Toggle Parent Header visibility based on Type selection
    moduleTypeSelect.addEventListener('change', function() {
        parentHeaderGroup.style.display = this.value === 'regular' ? 'block' : 'none';
        // If type is header, parent must be null
        if (this.value === 'header') {
            parentHeaderSelect.value = 'null';
        }
    });

    // Setup Close Buttons (using helper function)
    setupModalCloseButtons(modalOverlay, 'add-module-modal-overlay');


    // Setup Save Button Listener (clone to ensure no duplicate listeners)
    const newSaveBtn = saveNewModuleBtn.cloneNode(true);
    saveNewModuleBtn.parentNode.replaceChild(newSaveBtn, saveNewModuleBtn);
    newSaveBtn.addEventListener('click', addNewModule); // Call the add logic
}

/**
 * Handles the creation of a new module based on modal input.
 * NOTE: This function interacts with appData and triggers sidebar rendering.
 */
function addNewModule() {
    const moduleNameInput = document.getElementById('new-module-name');
    const moduleTypeSelect = document.getElementById('new-module-type');
    const parentHeaderSelect = document.getElementById('parent-header-select');
    const requiresClientCheckbox = document.getElementById('new-module-requires-client');

    const moduleName = moduleNameInput.value.trim();
    const moduleType = moduleTypeSelect.value;
    // Determine parentId based on type
    const parentId = moduleType === 'header' ? null : (parentHeaderSelect.value === 'null' ? null : parentHeaderSelect.value);
    const requiresClient = requiresClientCheckbox.checked;

    // --- Validation ---
    if (!moduleName) {
        alert("Module name is required.");
        moduleNameInput.focus();
        return;
    }

    // Generate a simple ID (consider more robust generation later if needed)
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
    // --- End Validation ---

    // Calculate order (append to the end of its parent group)
    let order = 0;
    const siblings = appData.modules.filter(m => m.parentId === parentId);
    if (siblings.length > 0) {
        order = Math.max(...siblings.map(m => m.order ?? -1)) + 1;
    }

    // Create the new module object
    const newModuleData = {
        id: moduleId,
        name: moduleName,
        requiresClient: requiresClient,
        type: moduleType,
        parentId: parentId,
        order: order,
        // Add default render/save placeholders
        renderTemplate: function(client) { return `<h3>${moduleName}</h3><p>Default content.</p>`; },
        saveData: function() { return {}; }
    };

    console.log("[Dashboard] Adding new module:", newModuleData);

    // Add to the main data array
    appData.modules.push(newModuleData);

    // If it's a header, initialize its collapse state (optional, SidebarManager might do this too)
    // if (moduleType === 'header') {
    //     headerCollapseState[moduleId] = true; // New headers start collapsed
    // }

    // Trigger a re-render of the sidebar list via SidebarManager
    if (window.ConstructionApp.SidebarManager) {
         window.ConstructionApp.SidebarManager.renderModuleList(appData.modules);
    }

    // Save the updated structure
    saveModuleStructure();

    // Close the modal and notify user
    document.getElementById('add-module-modal-overlay').style.display = 'none';
    alert(`Module "${moduleName}" created successfully.`);
}


// --- Client Management UI (Still in dashboard.js for now) ---

/**
 * Sets up listeners for New/Open client buttons and manages the client modal overlay.
 */
function setupClientManagement() {
    const newClientBtn = document.getElementById('new-client-btn');
    const openClientBtn = document.getElementById('open-client-btn');
    let clientModalOverlay = document.getElementById('client-modal-overlay');

    // Ensure overlay exists and has close-on-click-outside behavior
    if (!clientModalOverlay) {
        console.warn("[Dashboard] Client modal overlay not found, creating it.");
        clientModalOverlay = document.createElement('div');
        clientModalOverlay.className = 'modal-overlay';
        clientModalOverlay.id = 'client-modal-overlay';
        clientModalOverlay.style.display = 'none';
        document.body.appendChild(clientModalOverlay);
        // Add click outside to close listener
        clientModalOverlay.addEventListener('click', (event) => {
            if (event.target === clientModalOverlay) { // Only if clicking the overlay itself
                clientModalOverlay.style.display = 'none';
            }
        });
    }

    // New Client Button
    if (newClientBtn) {
        newClientBtn.addEventListener('click', () => {
            const clientModal = createClientModal('new'); // Get modal HTML
            clientModalOverlay.innerHTML = ''; // Clear previous content
            clientModalOverlay.appendChild(clientModal); // Add new content
            clientModalOverlay.style.display = 'flex'; // Show overlay
        });
    } else {
         console.warn("[Dashboard] New Client button not found.");
    }

    // Open Client Button
    if (openClientBtn) {
        openClientBtn.addEventListener('click', () => {
            const clientModal = createClientModal('open'); // Get modal HTML
            clientModalOverlay.innerHTML = ''; // Clear previous content
            clientModalOverlay.appendChild(clientModal); // Add new content
            clientModalOverlay.style.display = 'flex'; // Show overlay
        });
    } else {
         console.warn("[Dashboard] Open Client button not found.");
    }
     console.log("[Dashboard] Client management buttons setup.");
}

/**
 * Creates the HTML content for the client modal (New or Open).
 * @param {'new' | 'open'} type - The type of modal to create.
 * @returns {HTMLElement} The modal div element.
 */
function createClientModal(type) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    const overlayId = 'client-modal-overlay'; // ID of the overlay for close buttons

    if (type === 'new') {
        // HTML for the New Client form
        modal.innerHTML = `
            <div class="modal-header">
                <h2 class="modal-title">New Client</h2>
                <span class="modal-close" data-modal-id="${overlayId}">×</span>
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

        // Attach listeners AFTER appending to DOM (using setTimeout to ensure elements exist)
        setTimeout(() => {
            setupModalCloseButtons(modal, overlayId); // Setup close/cancel buttons

            // Setup Save button listener
            const saveBtn = modal.querySelector('#save-new-client-btn');
            if (saveBtn) {
                saveBtn.addEventListener('click', () => {
                    const nameInput = modal.querySelector('#client-name');
                    const addressInput = modal.querySelector('#client-address');
                    const name = nameInput.value.trim();
                    const address = addressInput.value.trim();

                    if (!name) { // Basic validation
                        alert('Client name is required.');
                        nameInput.focus();
                        return;
                    }

                    // Prepare client data
                    const newClientData = { name: name, address: address, moduleData: {} };

                    // Use ClientManager to add and set the client
                    if (window.ConstructionApp && window.ConstructionApp.ClientManager) {
                        window.ConstructionApp.ClientManager.addClient(newClientData, (success, result) => {
                            if (success) {
                                const addedClient = result; // addClient callback returns the client object
                                // Set the newly added client as current
                                window.ConstructionApp.ClientManager.setCurrentClient(addedClient);
                                updateDebugPanel(); // Update debug info
                                alert(`Client "${name}" created and selected.`);
                                document.getElementById(overlayId).style.display = 'none'; // Close modal
                            } else {
                                alert(`Error creating client: ${result || 'Unknown error'}`);
                            }
                        });
                    } else {
                        alert("Error: ClientManager is not available.");
                    }
                });
            }
        }, 0);

    } else if (type === 'open') {
        // HTML for the Open Client list
        const clients = window.ConstructionApp?.ClientManager?.getAllClients() || [];
        let clientListHTML = '';

        if (clients.length > 0) {
            // Sort clients alphabetically
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
                <span class="modal-close" data-modal-id="${overlayId}">×</span>
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

        // Attach listeners AFTER appending to DOM
        setTimeout(() => {
            setupModalCloseButtons(modal, overlayId); // Setup close/cancel buttons
            setupClientListSelection(modal); // Setup clicks on client list items
            setupClientSearch(modal); // Setup search input filtering
        }, 0);
    }

    return modal; // Return the created modal element
}

/**
 * Adds event listeners to close buttons within a modal.
 * @param {HTMLElement} modal - The modal element containing the buttons.
 * @param {string} overlayId - The ID of the overlay to hide.
 */
function setupModalCloseButtons(modal, overlayId) {
    const closeBtns = modal.querySelectorAll(`.modal-close[data-modal-id="${overlayId}"], .btn-cancel[data-modal-id="${overlayId}"]`);
    closeBtns.forEach(btn => {
        // Clone and replace to ensure no duplicate listeners from previous modal openings
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        // Add listener to the new button
        newBtn.addEventListener('click', () => {
            const overlay = document.getElementById(overlayId);
            if (overlay) overlay.style.display = 'none';
        });
    });
}

/**
 * Sets up filtering for the client list in the 'Open Client' modal.
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
                // Check if it's a valid client item before accessing textContent
                if (item.dataset.clientId) {
                    const clientName = item.textContent.toLowerCase();
                    // Show/hide based on search term match
                    item.style.display = (searchTerm === '' || clientName.includes(searchTerm)) ? 'block' : 'none';
                }
            });
        });
         console.log("[Dashboard] Client search input setup.");
    }
}

/**
 * Sets up click listener for selecting a client from the list.
 * @param {HTMLElement} modal - The modal element containing the client list.
 */
function setupClientListSelection(modal) {
    const clientListContainer = modal.querySelector('.client-list');
    if (!clientListContainer) return;

    // Use event delegation on the container
    clientListContainer.addEventListener('click', (event) => {
        const listItem = event.target.closest('.client-list-item');

        // Check if a valid client item was clicked
        if (listItem && listItem.dataset.clientId) {
            const clientId = listItem.dataset.clientId;
            const clients = window.ConstructionApp?.ClientManager?.getAllClients() || [];
            const selectedClient = clients.find(c => c.id === clientId);

            if (selectedClient) {
                // Use ClientManager to set the current client
                if (window.ConstructionApp && window.ConstructionApp.ClientManager) {
                    window.ConstructionApp.ClientManager.setCurrentClient(selectedClient);
                    updateDebugPanel(); // Update debug info
                    const overlay = modal.closest('.modal-overlay'); // Find the parent overlay
                    if (overlay) overlay.style.display = 'none'; // Close the modal
                    alert(`Client "${selectedClient.name}" selected.`);
                } else {
                    alert("Error: ClientManager not available.");
                }
            } else {
                alert("Error: Could not find the selected client's data.");
            }
        }
    });
     console.log("[Dashboard] Client list selection setup.");
}


// --- Dashboard Content Rendering (Tiles - Still in dashboard.js for now) ---

/**
 * Update the dashboard UI based on the current client.
 * This is the primary callback for ClientManager.onClientChanged.
 * @param {object|null} client - The new client object, or null if logged out.
 */
function updateDashboard(client) {
    console.log("DEBUG: updateDashboard START - Client:", client ? client.name : 'None');

    // Get references to UI elements
    const logoutBtn = document.getElementById('logout-btn');
    const dashboardContent = document.getElementById('module-content');
    const clientNameDisplay = document.getElementById('client-name-display');
    const dashboardDesc = document.querySelector('.dashboard-description');
    const totalProjectCostDisplay = document.getElementById('total-project-cost');

    // Check if essential elements exist
    if (!dashboardContent || !clientNameDisplay || !dashboardDesc || !logoutBtn || !totalProjectCostDisplay) {
        console.error("[Dashboard] One or more essential dashboard UI elements missing, cannot update.");
        return;
    }

    // Update UI based on whether a client is selected
    if (client) {
        // --- Client Selected View ---
        console.log("DEBUG: updateDashboard - Client is present. Updating UI.");
        clientNameDisplay.textContent = `Client: ${client.name}`;
        dashboardDesc.textContent = `${client.address || 'No address provided'}`;
        logoutBtn.style.display = 'inline-block';

        // Re-attach logout listener (clone/replace to avoid duplicates)
        const newLogoutBtn = logoutBtn.cloneNode(true);
        logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
        newLogoutBtn.addEventListener('click', () => {
            if (window.ConstructionApp && window.ConstructionApp.ModuleUtils) {
                window.ConstructionApp.ModuleUtils.logoutClient();
            } else { console.error("Cannot logout: ModuleUtils not available."); }
        });

        // Clear previous content and render tiles for the client
        dashboardContent.innerHTML = ''; // Clear placeholder or previous tiles
        console.log("DEBUG: Cleared #module-content for client view.");
        renderDashboardContent(client); // Render tiles based on client data
        updateTotalProjectCost(); // Update total cost display

    } else {
        // --- No Client Selected View ---
        console.log("DEBUG: updateDashboard - No client. Clearing client-specific UI.");
        clientNameDisplay.textContent = ''; // Clear name
        totalProjectCostDisplay.textContent = 'Total Project Cost: R0.00'; // Reset cost
        dashboardDesc.textContent = 'Overview of project data.'; // Reset description
        logoutBtn.style.display = 'none'; // Hide logout button

        // Show "No Client" notification AND render disabled tiles
        dashboardContent.innerHTML = `<div class="no-client-notification" style="margin-bottom: 20px;"><h2>No Client Selected</h2><p>Please select an existing client or create a new client using the sidebar.</p></div>`;
        renderDashboardContent(null); // Render tiles in disabled/no-data state
    }

    updateDebugPanel(); // Update debug info regardless
    console.log("DEBUG: updateDashboard COMPLETE.");
}


/**
 * Render dashboard content (module tiles). Shows tiles for all non-header modules.
 * Styles tiles based on whether the client has data for that module.
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
    let hasAnyRenderableModules = false; // Track if there are any non-header modules

    if (appData.modules && Array.isArray(appData.modules)) {
        // Sort modules by order before rendering tiles
        const sortedModules = [...appData.modules].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));

        sortedModules.forEach(module => {
            // Skip headers when rendering tiles
            if (module.type === 'header') {
                return;
            }
            hasAnyRenderableModules = true; // Found at least one module to render as a tile

            const moduleId = module.id;
            const moduleName = module.name;

            // Check if the client has data for this module
            let clientModuleData = null;
            let hasData = false;
            if (client && client.moduleData) {
                // Access data potentially nested under a 'data' property (from firebase-config structure)
                 const clientModuleVersionedData = client.moduleData[moduleId];
                 // Handle both direct data and nested { data: ... } structure
                 clientModuleData = clientModuleVersionedData?.data ?? clientModuleVersionedData ?? null;

                // Consider data present if it's not null/undefined
                if (clientModuleData !== null && clientModuleData !== undefined) {
                    // More robust check: is it an empty object? (Might indicate presence but no actual data)
                    if (typeof clientModuleData !== 'object' || Object.keys(clientModuleData).length > 0 || Array.isArray(clientModuleData)) {
                         hasData = true;
                    }
                }
            }

            // Calculate cost for this module
            let moduleCost = 0;
            if (hasData) {
                // Prioritize totalCost if explicitly stored
                if (clientModuleData.totalCost !== undefined) {
                    moduleCost = parseFloat(clientModuleData.totalCost) || 0;
                }
                // Fallback to calculating from items if available
                else if (clientModuleData.items && Array.isArray(clientModuleData.items)) {
                    if (window.ConstructionApp && window.ConstructionApp.ModuleUtils) {
                        moduleCost = window.ConstructionApp.ModuleUtils.calculateModuleTotal(clientModuleData.items);
                    }
                }
                // Notes module has no cost
                else if (moduleId === 'notes') {
                    moduleCost = 0;
                }
            }

            // Format cost using utility function
            const formattedCost = window.ConstructionApp?.ModuleUtils?.formatCurrency(moduleCost) ?? `R${moduleCost.toFixed(2)}`;

            // Add clear button only if there's data and it's not the notes module
            const clearButtonHtml = (hasData && moduleId !== 'notes') ? `<button class="clear-module-btn" title="Clear module data for this client">×</button>` : '';

            // Disable open button if the module requires a client but none is selected
            const openButtonDisabled = (!client && module.requiresClient) ? 'disabled title="Select a client first"' : '';
            const openButtonHtml = `<button class="btn module-open-btn" style="margin-top: 10px;" ${openButtonDisabled}>Open Module</button>`;

            // Display cost or "No cost" for Notes
            let costHtml = '';
            if (moduleId === 'notes') {
                costHtml = '<p style="font-size: 0.9em; color: #666; margin-top: 10px;">(No cost associated)</p>';
            } else {
                const noDataAnnotation = !hasData ? ' <small style="opacity: 0.7;"> (No data)</small>' : '';
                costHtml = `<p class="module-tile-cost">${formattedCost}${noDataAnnotation}</p>`;
            }

            // Add the 'no-client-data' class if the client doesn't have data for this module
            tilesHTML += `
                <div class="module-tile ${!hasData ? 'no-client-data' : ''}" data-module-id="${moduleId}">
                    ${clearButtonHtml}
                    <h5>${moduleName}</h5>
                    ${costHtml}
                    ${openButtonHtml}
                </div>`;
        });
    }

    // Check if the tiles container already exists from a previous render
     let tilesContainer = contentElement.querySelector('#module-tiles');
     if (!tilesContainer) {
         // If not, create the wrapper and container
         const tilesWrapper = document.createElement('div');
         tilesWrapper.style.backgroundColor = '#f8f9fa';
         tilesWrapper.style.padding = '15px';
         tilesWrapper.style.borderRadius = '5px';
         tilesWrapper.style.marginBottom = '10px'; // Add some space below tiles
         tilesWrapper.innerHTML = `<h4 style="margin-bottom: 15px;">Module Summaries</h4><div id="module-tiles"></div>`;
         contentElement.appendChild(tilesWrapper); // Append wrapper to main content
         tilesContainer = tilesWrapper.querySelector('#module-tiles'); // Get reference to the new container
     }


    // Populate the tiles container
    if (hasAnyRenderableModules) {
        tilesContainer.innerHTML = tilesHTML; // Add the generated tiles
    } else {
        // Show message if no modules are defined (other than potential headers)
        tilesContainer.innerHTML = `<div style="background-color: white; padding: 15px; border-radius: 5px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); grid-column: 1 / -1; text-align: center; color: #666;"><p>No modules defined in the system.</p><p style="margin-top: 5px;"><small>Add modules using the sidebar.</small></p></div>`;
    }

    // Attach listeners for buttons within the tiles
    setupDashboardTileListeners();
    console.log("DEBUG: renderDashboardContent COMPLETE.");
}


/**
 * Sets up delegated event listener for clicks within the module tiles container.
 */
function setupDashboardTileListeners() {
    const tilesContainer = document.getElementById('module-tiles');
    if (!tilesContainer) {
        console.warn("[Dashboard] Module tiles container #module-tiles not found for listener setup.");
        return;
    }
    // Remove first to prevent duplicates if called multiple times
    tilesContainer.removeEventListener('click', handleTileClick);
    // Add the listener
    tilesContainer.addEventListener('click', handleTileClick);
     console.log("[Dashboard] Tile listeners setup.");
}

/**
 * Handles clicks on buttons within module tiles (Open, Clear).
 * Uses event delegation.
 * @param {Event} e - The click event object.
 */
function handleTileClick(e) {
    const openBtn = e.target.closest('.module-open-btn');
    const clearBtn = e.target.closest('.clear-module-btn');
    const tile = e.target.closest('.module-tile');

    if (!tile) return; // Click wasn't inside a tile

    const moduleId = tile.dataset.moduleId;
    if (!moduleId) return; // Tile doesn't have a module ID

    // Handle Open Button Click
    if (openBtn && !openBtn.disabled) {
        console.log("[Dashboard] Open button clicked for module:", moduleId);
        triggerNavigation(moduleId); // Use navigation helper
    }
    // Handle Clear Button Click
    else if (clearBtn) {
        console.log("[Dashboard] Clear button clicked for module:", moduleId);
        const moduleInfo = appData.modules.find(m => m.id === moduleId);
        const moduleName = moduleInfo ? moduleInfo.name : moduleId; // Get name for confirmation dialog

        if (confirm(`Are you sure you want to clear all data entered for "${moduleName}" for the current client? This cannot be undone.`)) {
            clearModuleData(moduleId); // Call the function to clear data
        }
    }
}

/**
 * Clears the data for a specific module for the current client using ClientManager.
 * @param {string} moduleId - The ID of the module to clear data for.
 */
function clearModuleData(moduleId) {
    const client = window.ConstructionApp?.ClientManager?.getCurrentClient();
    if (!client) {
        window.ConstructionApp?.ModuleUtils?.showErrorMessage("No client selected.");
        return;
    }

    // Check if data actually exists before attempting to clear
    if (client.moduleData && client.moduleData.hasOwnProperty(moduleId)) {
        console.log(`[Dashboard] Clearing module data for: ${moduleId} for client ${client.name}`);

        // Use ClientManager to save null data for this module
        window.ConstructionApp.ClientManager.saveModuleData(moduleId, null, (success, error) => {
            if (success) {
                console.log("[Dashboard] Module data cleared successfully via ClientManager.");

                // IMPORTANT: Update the local client state in ClientManager as well
                // This ensures the UI reflects the change immediately without needing a full reload
                if (client.moduleData) {
                     delete client.moduleData[moduleId]; // Remove from local object
                     // Create a *new* object reference to ensure change detection if needed elsewhere
                     const updatedClient = { ...client };
                     // Update the client in ClientManager (this will trigger updateDashboard again)
                     window.ConstructionApp.ClientManager.setCurrentClient(updatedClient);
                     console.log("[Dashboard] Updated client session after clearing module.");
                }

                window.ConstructionApp?.ModuleUtils?.showSuccessMessage(`Data for "${moduleId}" cleared.`);
                // updateDashboard will be called automatically by setCurrentClient, re-rendering tiles

            } else {
                console.error(`[Dashboard] Error clearing module data via ClientManager: ${error || 'Unknown'}`);
                window.ConstructionApp?.ModuleUtils?.showErrorMessage(`Error clearing data: ${error || 'Unknown'}`);
            }
        });
    } else {
        // No data existed, just inform the user
        window.ConstructionApp?.ModuleUtils?.showSuccessMessage(`No data to clear for "${moduleId}".`);
         console.log(`[Dashboard] No data found to clear for module ${moduleId}`);
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
             // Handle potential { data: ... } nesting
             const moduleData = moduleVersionedData?.data ?? moduleVersionedData ?? null;
            if (!moduleData) return; // Skip if no data

            let costForThisModule = 0;
            // Prioritize totalCost if available
            if (moduleData.totalCost !== undefined) {
                costForThisModule = parseFloat(moduleData.totalCost) || 0;
            }
            // Fallback to calculating from items
            else if (moduleData.items && Array.isArray(moduleData.items)) {
                if (window.ConstructionApp && window.ConstructionApp.ModuleUtils) {
                    costForThisModule = window.ConstructionApp.ModuleUtils.calculateModuleTotal(moduleData.items);
                }
            }
            // Add to total (exclude notes or others if needed)
            if (moduleId !== 'notes') { // Example: Exclude notes module cost
                 totalCost += costForThisModule;
            }
        });
    }

    // Format and display the total cost
    const formattedTotal = window.ConstructionApp?.ModuleUtils?.formatCurrency(totalCost) ?? `R${totalCost.toFixed(2)}`;
    const totalCostElement = document.getElementById('total-project-cost');
    if (totalCostElement) {
        totalCostElement.textContent = `Total Project Cost: ${formattedTotal}`;
    } else {
        console.warn("[Dashboard] Total project cost display element not found.");
    }
     console.log("[Dashboard] Total project cost updated:", formattedTotal);
}


// --- Debug Panel (Still in dashboard.js for now) ---

function setupDebugPanel() {
    const debugPanel = document.getElementById('debug-panel');
    let toggleBtn = document.getElementById('debug-toggle-btn');

    // Create button if it doesn't exist
    if (!toggleBtn && debugPanel) { // Only create if panel exists
        toggleBtn = document.createElement('button');
        toggleBtn.textContent = 'Debug';
        toggleBtn.id = 'debug-toggle-btn';
        // Apply necessary styles for positioning and appearance
        toggleBtn.style.cssText = `position: fixed; bottom: 10px; right: 10px; z-index: 10000; padding: 5px 10px; background: #333; color: white; border: none; border-radius: 3px; cursor: pointer; opacity: 0.8; font-size: 12px;`;
        document.body.appendChild(toggleBtn);
    }

    // Add listener if button exists
    if (toggleBtn) {
        toggleBtn.style.display = 'block'; // Ensure it's visible
        toggleBtn.removeEventListener('click', toggleDebugPanel); // Prevent duplicates
        toggleBtn.addEventListener('click', toggleDebugPanel);
         console.log("[Dashboard] Debug panel toggle setup.");
    }
}

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

function updateDebugPanel() {
    const debugPanel = document.getElementById('debug-panel');
    if (!debugPanel || debugPanel.style.display !== 'block') return; // Only update if visible

    // Gather state information
    const navigationState = sessionStorage.getItem('navigationState');
    const currentClient = window.ConstructionApp?.ClientManager?.getCurrentClient();
    const storedClientStr = sessionStorage.getItem('currentClient');
    const moduleOrderStr = sessionStorage.getItem('moduleOrder');
    let storedClientParsed = null;
    try { storedClientParsed = JSON.parse(storedClientStr || 'null'); } catch(e){}

    // Build HTML string for debug info
    let debugInfo = `<strong>Nav State:</strong> ${navigationState || 'None'}<br>
                     <strong>Current Client (Mgr):</strong> ${currentClient ? currentClient.name : 'None'} (ID: ${currentClient?.id || 'N/A'})<br>
                     <strong>Client in sessionStorage:</strong> ${storedClientParsed ? 'Present' : 'None'} (ID: ${storedClientParsed?.id || 'N/A'})<br>
                     <hr>
                     <strong>Modules in appData:</strong> ${appData.modules?.length || 0}<br>
                     <strong>Module Order Backup:</strong> ${moduleOrderStr ? 'Present' : 'None'}<br>
                     <hr>`; // Removed headerCollapseState as it's now in SidebarManager

    // Add client module data summary if client exists
    if (currentClient && currentClient.moduleData) {
        debugInfo += '<strong>Client Module Data (Costs):</strong><br>';
        let calculatedTotal = 0;
        Object.entries(currentClient.moduleData).forEach(([moduleId, moduleVData]) => {
            const moduleData = moduleVData?.data ?? moduleVData ?? {};
            let moduleCost = 0;
            if (moduleData?.totalCost !== undefined) moduleCost = moduleData.totalCost;
            else if (moduleData?.items) moduleCost = window.ConstructionApp?.ModuleUtils?.calculateModuleTotal(moduleData.items) ?? 0;

            if (moduleId !== 'notes') { // Exclude notes from total cost calculation for debug display consistency
                 calculatedTotal += parseFloat(moduleCost) || 0;
            }
            debugInfo += `- ${moduleId}: Cost: ${window.ConstructionApp?.ModuleUtils?.formatCurrency(moduleCost) ?? 'N/A'}<br>`;
        });
        debugInfo += `<strong>Calculated Total Cost (Excl. Notes):</strong> ${window.ConstructionApp?.ModuleUtils?.formatCurrency(calculatedTotal) ?? 'N/A'}<br><hr>`;
    } else if (currentClient) {
        debugInfo += '<strong>Client Module Data:</strong> None<br><hr>';
    }

    // Add module structure preview
    debugInfo += '<strong>Module Structure (appData - Top 5):</strong><br><pre style="max-height: 150px; overflow-y: auto; border: 1px solid #555; padding: 5px; font-size: 11px;">';
    debugInfo += JSON.stringify(appData.modules?.slice(0, 5).map(m => ({id: m.id, name: m.name, type: m.type, parentId: m.parentId, order: m.order})) || [], null, 1);
    debugInfo += '</pre>';

    // Update the panel content
    debugPanel.innerHTML = debugInfo;
}


// --- Expose necessary functions for other modules ---
// SidebarManager needs to trigger saveModuleStructure
window.ConstructionApp.Dashboard = {
    saveModuleStructure: saveModuleStructure
    // Expose appData if other modules need direct access (less ideal)
    // getAppData: () => appData
};
