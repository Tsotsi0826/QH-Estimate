// js/dashboard.js
// Contains the primary JavaScript logic for the Construction Estimator dashboard (index.html)
// Added collapse/expand functionality for header modules.

// --- Global Variables ---
let appData = {
    modules: []
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
         console.error("Search input or module container not found.");
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
         const allModuleElements = container.querySelectorAll('.module-item'); // Get current elements
         const visibleModuleIds = new Set(); // Track IDs that should be visible

         // If search term is empty, show all
         if (searchTerm === '') {
              allModuleElements.forEach(moduleEl => {
                   moduleEl.style.display = 'flex';
              });
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
     console.log("[Dashboard] Module search listener attached.");
}


// --- Initialization ---
document.addEventListener('DOMContentLoaded', function() {
    console.log("[Dashboard] DOM loaded, initializing app");
    setupDebugPanel();
    loadAndRenderModules().then(() => {
        initApp();
        setupDropdownMenus(); // Sets up global close listener AND collapse listener
        setupClientManagement();
        setupAddModuleButton();
        setupModuleSearch(); // Call the function now that it's defined above
        window.ConstructionApp.ClientManager.loadClients().then(() => {
            console.log("[Dashboard] Clients loaded");
        });
        window.ConstructionApp.ClientManager.onClientChanged = updateDashboard;
        setupDragAndDrop(); // Setup initial DnD
    });
});

function initApp() { /* ... (no changes needed in this function) ... */ console.log("[Dashboard] Initializing app state"); const navigationState = sessionStorage.getItem('navigationState'); const storedClientStr = sessionStorage.getItem('currentClient'); let clientToSet = null; if (navigationState === 'returningToDashboard' && storedClientStr) { try { clientToSet = JSON.parse(storedClientStr); console.log("[Dashboard] Restoring client:", clientToSet.name); } catch (error) { console.error("[Dashboard] Error parsing stored client:", error); sessionStorage.removeItem('currentClient'); } } else if (navigationState === 'manualLogout' || navigationState === 'invalidAccess') { console.log("[Dashboard] Manual logout or invalid access detected, clearing client"); sessionStorage.removeItem('currentClient'); } else if (!navigationState && storedClientStr) { try { clientToSet = JSON.parse(storedClientStr); console.log("[Dashboard] Fresh load with stored client:", clientToSet.name); } catch (error) { console.error("[Dashboard] Error parsing stored client on fresh load:", error); sessionStorage.removeItem('currentClient'); } } else { console.log("[Dashboard] Fresh load with no client"); } window.ConstructionApp.ClientManager.setCurrentClient(clientToSet); updateTotalProjectCost(); sessionStorage.removeItem('navigationState'); const currentClient = window.ConstructionApp.ClientManager.getCurrentClient(); console.log("[Dashboard] Current client after initialization:", currentClient ? currentClient.name : "None"); updateDebugPanel(); }

// --- Module Loading and Rendering ---
async function loadAndRenderModules() { /* ... (no changes needed in this function) ... */ console.log("[Dashboard] Loading and rendering modules"); let loadedModules = []; try { loadedModules = await window.ConstructionApp.Firebase.loadModules(); console.log("[Dashboard] Loaded modules from Firebase:", loadedModules.length); if (!loadedModules || loadedModules.length === 0) { console.warn("[Dashboard] No modules in Firebase, trying backup."); loadedModules = restoreModuleOrderFromBackup() || []; if (loadedModules.length === 0) { console.warn("[Dashboard] Backup empty or failed. Using defaults."); loadedModules = getDefaultModules(); await window.ConstructionApp.Firebase.saveModules(loadedModules); } } } catch (error) { console.error("[Dashboard] Error loading from Firebase, trying backup:", error); loadedModules = restoreModuleOrderFromBackup() || []; if (loadedModules.length === 0) { console.warn("[Dashboard] Backup failed/empty after Firebase error. Using defaults."); loadedModules = getDefaultModules(); await window.ConstructionApp.Firebase.saveModules(loadedModules); } } const notesModuleIndex = loadedModules.findIndex(m => m.id === 'notes'); let notesModuleData = notesModuleIndex > -1 ? loadedModules.splice(notesModuleIndex, 1)[0] : {}; notesModuleData = { id: 'notes', name: notesModuleData.name || 'Notes', requiresClient: notesModuleData.requiresClient !== undefined ? notesModuleData.requiresClient : true, type: notesModuleData.type || 'regular', parentId: notesModuleData.parentId !== undefined ? notesModuleData.parentId : null, order: notesModuleData.order !== undefined ? notesModuleData.order : -1 }; loadedModules.unshift(notesModuleData); appData.modules = loadedModules.map(mod => ({ ...mod, renderTemplate: function(client) { const moduleData = client?.moduleData?.[mod.id]?.data || {}; if (mod.id === 'notes') { const notesText = moduleData.notes || ''; return `<h3>Project Notes</h3><textarea id="project-notes" rows="10" style="width: 100%; padding: 10px;" placeholder="Enter project notes here...">${notesText}</textarea><button class="btn module-save-btn" data-module="notes" style="margin-top: 10px;">Save Notes</button>`; } return `<h3>${mod.name}</h3><p>Data:</p><pre>${JSON.stringify(moduleData, null, 2)}</pre><p><small>Create ${mod.id}.html for custom view.</small></p>`; }, saveData: function() { if (mod.id === 'notes') { const notes = document.getElementById('project-notes')?.value || ''; return { notes: notes }; } return {}; } })); renderModuleList(appData.modules); }
function getDefaultModules() { /* ... (no changes needed in this function) ... */ return [ { id: 'p-and-gs', name: 'P&G\'s', requiresClient: true, type: 'regular', parentId: null, order: 1 }, { id: 'foundations', name: 'Foundations', requiresClient: false, type: 'header', parentId: null, order: 2 }, { id: 'earthworks', name: 'Earthworks', requiresClient: true, type: 'regular', parentId: 'foundations', order: 0 }, { id: 'concrete', name: 'Concrete', requiresClient: true, type: 'regular', parentId: 'foundations', order: 1 }, { id: 'steel', name: 'Steel', requiresClient: true, type: 'regular', parentId: 'foundations', order: 2 }, { id: 'structure', name: 'Structure', requiresClient: false, type: 'header', parentId: null, order: 3 }, { id: 'brickwork', name: 'Brickwork', requiresClient: true, type: 'regular', parentId: 'structure', order: 0 }, { id: 'demolish', name: 'Demolish', requiresClient: true, type: 'regular', parentId: null, order: 4 }, ]; }

/**
 * Renders the module list hierarchically, respecting collapse state.
 * @param {Array} modules - The complete list of module objects.
 */
function renderModuleList(modules) {
    const container = document.getElementById('modules-container');
    container.innerHTML = '';
    const sortedModules = [...modules].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.name.localeCompare(b.name));

    // Function to recursively render modules
    function renderLevel(parentId, level) {
        sortedModules
            .filter(m => m.parentId === parentId)
            .forEach(module => {
                // Create the element
                const moduleElement = createModuleElement(module, level);
                container.appendChild(moduleElement);

                // *** MODIFICATION: Check collapse state before rendering children ***
                const isHeader = module.type === 'header';
                const isCollapsed = headerCollapseState[module.id] === true; // Check state

                // Only render children if it's not a collapsed header
                if (!isHeader || !isCollapsed) {
                    renderLevel(module.id, level + 1);
                }
            });
    }
    renderLevel(null, 0); // Start rendering top-level
    setupDragAndDrop(); // Re-attach DnD listeners
}

/**
 * Creates a DOM element for a single module AND attaches its specific listeners.
 * Adds collapse icon and state class for headers.
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
    moduleElement.setAttribute('data-module-type', moduleData.type || 'regular');
    moduleElement.setAttribute('data-parent-id', moduleData.parentId || 'null');
    moduleElement.setAttribute('data-level', level);
    moduleElement.style.paddingLeft = `${20 + level * 15}px`;

    // *** MODIFICATION: Add collapse icon for headers ***
    let collapseIconHTML = '';
    if (moduleData.type === 'header') {
        moduleElement.classList.add('header-item'); // Add class for styling/targeting
        const isCollapsed = headerCollapseState[moduleData.id] === true;
        if (isCollapsed) {
            moduleElement.classList.add('collapsed'); // Add class if collapsed
        }
        // Use ▼ for expanded (default), CSS transform rotates it for collapsed state
        collapseIconHTML = `<span class="collapse-icon" title="Expand/Collapse">▼</span>`;
    }

    moduleElement.innerHTML = `
        <div class="module-drag-handle" title="Drag to reorder">≡</div>
        ${collapseIconHTML} {/* Insert the collapse icon */}
        <div class="module-icon">
            ...
            <div class="dropdown-menu">
                <div class="dropdown-item edit-module">Edit</div>
                <div class="dropdown-item delete-module">Delete</div>
            </div>
        </div>
        <span class="module-name">${moduleData.name}</span>
    `;

    // --- Attach Direct Event Listeners ---
    const editBtn = moduleElement.querySelector('.edit-module');
    const deleteBtn = moduleElement.querySelector('.delete-module');
    const icon = moduleElement.querySelector('.module-icon');
    const nameSpan = moduleElement.querySelector('.module-name');
    // ** Get collapse icon if it exists **
    const collapseIcon = moduleElement.querySelector('.collapse-icon');

    if (editBtn) { editBtn.addEventListener('click', (e) => { e.stopPropagation(); console.log("DEBUG: Direct Edit listener fired for:", moduleElement.dataset.moduleId); editModule(moduleElement); closeAllDropdowns(); }); }
    else { console.warn("Could not find edit button for module:", moduleData.id); }

    if (deleteBtn) { deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); console.log("DEBUG: Direct Delete listener fired for:", moduleElement.dataset.moduleId); deleteModule(moduleElement); closeAllDropdowns(); }); }
    else { console.warn("Could not find delete button for module:", moduleData.id); }

    if (icon) { icon.addEventListener('click', (e) => { e.stopPropagation(); const dropdown = icon.querySelector('.dropdown-menu'); if (dropdown) { const isVisible = dropdown.style.display === 'block'; closeAllDropdowns(); if (!isVisible) dropdown.style.display = 'block'; } }); }

    if (nameSpan) { nameSpan.addEventListener('click', () => { const moduleId = moduleElement.getAttribute('data-module-id'); window.ConstructionApp.ModuleUtils.navigateToModule(moduleId); }); }

    // ** Listener for the collapse icon is now handled by delegation in setupDropdownMenus **
    // ** Listener for the header item itself is now handled by delegation in setupDropdownMenus **

    return moduleElement;
}

// --- Module Creation --- (No changes needed here)
function setupAddModuleButton() { const addModuleBtn = document.getElementById('add-module-btn'); const modalOverlay = document.getElementById('add-module-modal-overlay'); const moduleTypeSelect = document.getElementById('new-module-type'); const parentHeaderGroup = document.getElementById('parent-header-group'); const parentHeaderSelect = document.getElementById('parent-header-select'); const saveNewModuleBtn = document.getElementById('save-new-module-btn'); const modalCloseBtns = modalOverlay.querySelectorAll('.modal-close, .btn-cancel'); if (addModuleBtn) { addModuleBtn.addEventListener('click', () => { parentHeaderSelect.innerHTML = '<option value="null">(Top Level / No Parent)</option>'; appData.modules.filter(m => m.type === 'header').sort((a,b) => a.name.localeCompare(b.name)) .forEach(header => { const option = document.createElement('option'); option.value = header.id; option.textContent = header.name; parentHeaderSelect.appendChild(option); }); document.getElementById('new-module-name').value = ''; moduleTypeSelect.value = 'regular'; parentHeaderGroup.style.display = 'block'; parentHeaderSelect.value = 'null'; document.getElementById('new-module-requires-client').checked = true; modalOverlay.style.display = 'flex'; }); } if (moduleTypeSelect) { moduleTypeSelect.addEventListener('change', function() { parentHeaderGroup.style.display = this.value === 'regular' ? 'block' : 'none'; }); } modalCloseBtns.forEach(btn => { const newBtn = btn.cloneNode(true); btn.parentNode.replaceChild(newBtn, btn); newBtn.addEventListener('click', () => modalOverlay.style.display = 'none'); }); modalOverlay.addEventListener('click', (event) => { if (event.target === modalOverlay) modalOverlay.style.display = 'none'; }); if (saveNewModuleBtn) { const newSaveBtn = saveNewModuleBtn.cloneNode(true); saveNewModuleBtn.parentNode.replaceChild(newSaveBtn, saveNewModuleBtn); newSaveBtn.addEventListener('click', addNewModule); } }
function addNewModule() { const moduleNameInput = document.getElementById('new-module-name'); const moduleTypeSelect = document.getElementById('new-module-type'); const parentHeaderSelect = document.getElementById('parent-header-select'); const requiresClientCheckbox = document.getElementById('new-module-requires-client'); const moduleName = moduleNameInput.value.trim(); const moduleType = moduleTypeSelect.value; const parentId = moduleType === 'header' ? null : (parentHeaderSelect.value === 'null' ? null : parentHeaderSelect.value); const requiresClient = requiresClientCheckbox.checked; if (!moduleName) { alert("Module name is required."); moduleNameInput.focus(); return; } const moduleId = moduleName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''); if (appData.modules.some(m => m.id === moduleId)) { alert(`Module ID "${moduleId}" already exists.`); return; } let order = 0; const siblings = appData.modules.filter(m => m.parentId === parentId); if (siblings.length > 0) order = Math.max(...siblings.map(m => m.order ?? -1)) + 1; const newModuleData = { id: moduleId, name: moduleName, requiresClient: requiresClient, type: moduleType, parentId: parentId, order: order, renderTemplate: function(client) { return `<h3>${moduleName}</h3><p>Default content.</p>`; }, saveData: function() { return {}; } }; console.log("Adding new module:", newModuleData); appData.modules.push(newModuleData); renderModuleList(appData.modules); saveModuleStructure(); document.getElementById('add-module-modal-overlay').style.display = 'none'; alert(`Module "${moduleName}" created.`); }

// --- Module Structure Saving --- (No changes needed here)
function saveModuleStructure() { console.log("[Dashboard] Saving module structure"); const modulesToSave = appData.modules.map(module => ({ id: module.id, name: module.name, requiresClient: module.requiresClient, type: module.type || 'regular', parentId: module.parentId, order: module.order ?? 0 })); modulesToSave.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || (a.parentId ?? '').localeCompare(b.parentId ?? '') || a.name.localeCompare(b.name)); console.log("[Dashboard] Modules prepared for saving:", modulesToSave); if (window.ConstructionApp.Firebase) { window.ConstructionApp.Firebase.saveModules(modulesToSave).then(success => { if (success) { console.log("[Dashboard] Module structure saved to Firebase."); sessionStorage.setItem('moduleOrder', JSON.stringify(modulesToSave)); console.log("[Dashboard] Module structure backup saved to sessionStorage."); } else { console.warn("[Dashboard] Firebase.saveModules reported failure."); } }).catch(error => { console.error("[Dashboard] Error in saveModules promise chain:", error); sessionStorage.setItem('moduleOrder', JSON.stringify(modulesToSave)); console.warn("[Dashboard] Saved structure to sessionStorage backup due to Firebase error."); }); } else { console.warn("[Dashboard] Firebase not available, saving structure to sessionStorage only"); sessionStorage.setItem('moduleOrder', JSON.stringify(modulesToSave)); } }
function restoreModuleOrderFromBackup() { const savedOrder = sessionStorage.getItem('moduleOrder'); if (savedOrder) { try { const orderData = JSON.parse(savedOrder); console.log("[Dashboard] Restoring structure from backup:", orderData.length, "modules"); return orderData.map(mod => ({ ...mod, type: mod.type || 'regular', parentId: (mod.parentId === undefined || mod.parentId === 'null') ? null : mod.parentId, order: mod.order ?? 0 })); } catch (error) { console.error("[Dashboard] Error parsing backup:", error); sessionStorage.removeItem('moduleOrder'); } } else { console.warn("[Dashboard] No backup found"); } return null; }

// --- Drag and Drop --- (No changes needed here)
let dragOverElement = null; let dropIndicator = null; function setupDragAndDrop() { const container = document.getElementById('modules-container'); container.removeEventListener('dragstart', handleDragStart); container.addEventListener('dragstart', handleDragStart); container.removeEventListener('dragover', handleDragOver); container.addEventListener('dragover', handleDragOver); container.removeEventListener('dragleave', handleDragLeave); container.addEventListener('dragleave', handleDragLeave); container.removeEventListener('drop', handleDrop); container.addEventListener('drop', handleDrop); container.removeEventListener('dragend', handleDragEnd); container.addEventListener('dragend', handleDragEnd); } function handleDragStart(e) { const target = e.target.closest('.module-item'); if (!target || !target.draggable) { e.preventDefault(); return; } globalDraggedItem = target; e.dataTransfer.setData('text/plain', target.dataset.moduleId); e.dataTransfer.effectAllowed = 'move'; setTimeout(() => { if (globalDraggedItem) globalDraggedItem.classList.add('dragging'); }, 0); console.log("Drag Start:", target.dataset.moduleId); } function handleDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; const targetElement = e.target.closest('.module-item'); if (!targetElement || targetElement === globalDraggedItem) { clearDropIndicators(); dragOverElement = null; dropIndicator = null; return; } if (targetElement !== dragOverElement) { clearDropIndicators(); dragOverElement = targetElement; } const rect = targetElement.getBoundingClientRect(); const yOffset = e.clientY - rect.top; const dropZoneHeight = rect.height; const targetIsHeader = targetElement.dataset.moduleType === 'header'; const canDropOnHeader = targetIsHeader && globalDraggedItem?.dataset.moduleType !== 'header'; const topThreshold = dropZoneHeight * 0.3; const bottomThreshold = dropZoneHeight * 0.7; let currentIndicator = null; if (canDropOnHeader && yOffset > topThreshold && yOffset < bottomThreshold) currentIndicator = 'middle'; else if (yOffset <= topThreshold) currentIndicator = 'top'; else currentIndicator = 'bottom'; if (currentIndicator !== dropIndicator) { targetElement.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-middle'); dropIndicator = currentIndicator; if (dropIndicator === 'middle') targetElement.classList.add('drag-over-middle'); else if (dropIndicator === 'top') targetElement.classList.add('drag-over-top'); else if (dropIndicator === 'bottom') targetElement.classList.add('drag-over-bottom'); } } function handleDragLeave(e) { const targetElement = e.target.closest('.module-item'); if (!targetElement) return; const relatedTarget = e.relatedTarget ? e.relatedTarget.closest('.module-item') : null; if (targetElement === dragOverElement && relatedTarget !== dragOverElement) { clearDropIndicators(targetElement); if (!targetElement.contains(e.relatedTarget)) { dragOverElement = null; dropIndicator = null; } } } function handleDrop(e) { e.preventDefault(); if (!globalDraggedItem || !dragOverElement || globalDraggedItem === dragOverElement || !dropIndicator) { clearDropIndicators(); return; } console.log(`Drop ${globalDraggedItem.dataset.moduleId} onto ${dragOverElement.dataset.moduleId}, indicator: ${dropIndicator}`); const draggedId = globalDraggedItem.dataset.moduleId; const targetId = dragOverElement.dataset.moduleId; const draggedModuleIndex = appData.modules.findIndex(m => m.id === draggedId); const targetModuleIndex = appData.modules.findIndex(m => m.id === targetId); if (draggedModuleIndex === -1 || targetModuleIndex === -1) { console.error("DnD Error: Module not found in appData."); clearDropIndicators(); return; } const draggedModule = appData.modules[draggedModuleIndex]; const targetModule = appData.modules[targetModuleIndex]; let newParentId = null; let targetPositionIndex = -1; if (dropIndicator === 'middle' && targetModule.type === 'header') { newParentId = targetModule.id; targetPositionIndex = targetModuleIndex + 1; console.log(`Setting parent of ${draggedId} to ${newParentId}`); } else if (dropIndicator === 'bottom') { newParentId = targetModule.parentId; targetPositionIndex = targetModuleIndex + 1; console.log(`Inserting ${draggedId} after ${targetId} (parent: ${newParentId})`); } else { newParentId = targetModule.parentId; targetPositionIndex = targetModuleIndex; console.log(`Inserting ${draggedId} before ${targetId} (parent: ${newParentId})`); } draggedModule.parentId = newParentId; appData.modules.splice(draggedModuleIndex, 1); if (draggedModuleIndex < targetPositionIndex) targetPositionIndex--; appData.modules.splice(targetPositionIndex, 0, draggedModule); recalculateModuleOrder(); renderModuleList(appData.modules); saveModuleStructure(); clearDropIndicators(); } function handleDragEnd(e) { if (globalDraggedItem) globalDraggedItem.classList.remove('dragging'); clearDropIndicators(); globalDraggedItem = null; dragOverElement = null; dropIndicator = null; console.log("Drag End"); } function clearDropIndicators(element) { const selector = '.module-item.drag-over-top, .module-item.drag-over-bottom, .module-item.drag-over-middle'; const elementsToClear = element ? [element] : document.querySelectorAll(selector); elementsToClear.forEach(el => { if (el) el.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-middle'); }); } function recalculateModuleOrder() { console.log("Recalculating module order..."); const orderCounters = {}; appData.modules.forEach(module => { const parentKey = module.parentId === null ? 'null' : module.parentId; if (orderCounters[parentKey] === undefined) orderCounters[parentKey] = 0; module.order = orderCounters[parentKey]++; }); console.log("Order recalculation complete."); }

// --- Other UI Functions ---
// Setup dropdown menus and NEW collapse listener using delegation
function setupDropdownMenus() {
     document.removeEventListener('click', handleGlobalClickForDropdowns);
     document.addEventListener('click', handleGlobalClickForDropdowns);
     console.log("[Dashboard] Global dropdown close listener attached.");

     // ** Use event delegation for collapse toggles **
     const container = document.getElementById('modules-container');
     // Remove potential old listener before adding
     container.removeEventListener('click', handleMaybeCollapseToggle);
     container.addEventListener('click', handleMaybeCollapseToggle);
     console.log("[Dashboard] Collapse toggle listener attached via delegation.");
}

// ** NEW: Handler specifically for collapse toggles (delegated) **
function handleMaybeCollapseToggle(e) {
    // Check if click was on the collapse icon OR the header item itself (but not drag handle or other icons)
    const collapseIcon = e.target.closest('.collapse-icon');
    const headerItem = e.target.closest('.module-item.header-item');

    // Proceed if we clicked a header item...
    if (headerItem) {
        // ...and the click was directly on the collapse icon OR
        // the click was somewhere else on the header item *except* the drag handle or the "..." icon
        if (collapseIcon || (!e.target.closest('.module-drag-handle') && !e.target.closest('.module-icon'))) {
             e.stopPropagation(); // Prevent navigation if name is clicked accidentally
             const moduleId = headerItem.dataset.moduleId;
             if (moduleId) {
                handleCollapseToggle(moduleId);
             }
        }
    }
}


// ** NEW: Function to toggle collapse state and re-render **
function handleCollapseToggle(headerModuleId) {
    console.log("Toggling collapse for header:", headerModuleId);
    // Toggle the state (if undefined, treat as expanded (false), so toggle to true)
    headerCollapseState[headerModuleId] = !(headerCollapseState[headerModuleId] === true);
    console.log("New collapse state:", headerCollapseState);
    // Re-render the entire list to show/hide children
    renderModuleList(appData.modules);
    // Optional: Save collapse state to sessionStorage/localStorage here if persistence is needed
    // e.g., sessionStorage.setItem('headerCollapseState', JSON.stringify(headerCollapseState));
    // And load it during initApp or loadAndRenderModules
}


function handleGlobalClickForDropdowns(e) {
      // If the click was outside any module icon or dropdown menu itself
      if (!e.target.closest('.module-icon') && !e.target.closest('.dropdown-menu')) {
           closeAllDropdowns();
      }
}

function closeAllDropdowns() {
    document.querySelectorAll('#modules-container .dropdown-menu').forEach(menu => {
        if (menu.style.display === 'block') menu.style.display = 'none';
    });
}

// Edit Module Function (No changes needed)
function editModule(moduleElement) { console.log("DEBUG: editModule function started."); const moduleId = moduleElement?.dataset?.moduleId; if (!moduleId) { console.error("Edit Error: Could not get module ID."); return; } const moduleIndex = appData.modules.findIndex(m => m.id === moduleId); if (moduleIndex === -1) { console.error("Edit Error: Module not found in appData:", moduleId); return; } const currentModule = appData.modules[moduleIndex]; const currentName = currentModule.name; console.log("DEBUG: Editing module:", currentModule); console.log("DEBUG: About to show prompt for new name..."); const newName = prompt(`Edit module name:`, currentName); console.log("DEBUG: Prompt returned:", newName); if (newName && newName.trim() !== '' && newName !== currentName) { const finalNewName = newName.trim(); console.log("DEBUG: New name accepted:", finalNewName); currentModule.name = finalNewName; const nameSpan = moduleElement.querySelector('.module-name'); if (nameSpan) { nameSpan.textContent = finalNewName; console.log("DEBUG: DOM name updated."); } else { console.log("DEBUG: Warning: Could not find name span."); } saveModuleStructure(); alert(`Module renamed to "${finalNewName}"`); } else { console.log("DEBUG: Edit cancelled or name unchanged."); } }
// Delete Module Function (No changes needed)
function deleteModule(moduleElement) { console.log("DEBUG: deleteModule function started."); const moduleId = moduleElement?.dataset?.moduleId; if (!moduleId) { console.error("Delete Error: Could not get module ID."); return; } const moduleIndex = appData.modules.findIndex(m => m.id === moduleId); if (moduleIndex === -1) { console.error("Delete Error: Module not found in appData:", moduleId); return; } const moduleToDelete = appData.modules[moduleIndex]; const moduleName = moduleToDelete.name; console.log("DEBUG: Attempting to delete module:", moduleToDelete); if (moduleId === 'notes') { alert('The Notes module cannot be deleted.'); console.log("DEBUG: Delete cancelled: Notes module."); return; } const children = appData.modules.filter(m => m.parentId === moduleId); let confirmMessage = `Are you sure you want to delete the "${moduleName}" module?`; if (moduleToDelete.type === 'header' && children.length > 0) { confirmMessage += `\n\nWARNING: This header has ${children.length} sub-module(s). Deleting it also deletes ALL descendants. This cannot be undone.`; } else { confirmMessage += `\nThis cannot be undone.`; } console.log("DEBUG: About to show confirm dialog..."); const confirmed = confirm(confirmMessage); console.log("DEBUG: Confirm dialog returned:", confirmed); if (confirmed) { console.log("DEBUG: Deletion confirmed."); const idsToDelete = new Set([moduleId]); const queue = [moduleId]; while (queue.length > 0) { const currentParentId = queue.shift(); appData.modules.forEach(module => { if (module.parentId === currentParentId && !idsToDelete.has(module.id)) { idsToDelete.add(module.id); queue.push(module.id); } }); } console.log("DEBUG: IDs to delete:", Array.from(idsToDelete)); appData.modules = appData.modules.filter(module => !idsToDelete.has(module.id)); console.log("DEBUG: appData filtered. Remaining:", appData.modules.length); recalculateModuleOrder(); renderModuleList(appData.modules); saveModuleStructure(); alert(`Module "${moduleName}" ${idsToDelete.size > 1 ? 'and descendants ' : ''}deleted.`); } else { console.log("DEBUG: Deletion cancelled."); } }

// --- Client Management & Dashboard Update --- (No changes needed here)
function setupClientManagement() { console.log("[Dashboard] Setting up client management"); const newClientBtn = document.getElementById('new-client-btn'); const openClientBtn = document.getElementById('open-client-btn'); let clientModalOverlay = document.getElementById('client-modal-overlay'); if (!clientModalOverlay) { clientModalOverlay = document.createElement('div'); clientModalOverlay.className = 'modal-overlay'; clientModalOverlay.id = 'client-modal-overlay'; document.body.appendChild(clientModalOverlay); clientModalOverlay.addEventListener('click', (event) => { if (event.target === clientModalOverlay) clientModalOverlay.style.display = 'none'; }); } newClientBtn.addEventListener('click', () => { const clientModal = createClientModal('new'); clientModalOverlay.innerHTML = ''; clientModalOverlay.appendChild(clientModal); clientModalOverlay.style.display = 'flex'; }); openClientBtn.addEventListener('click', () => { const clientModal = createClientModal('open'); clientModalOverlay.innerHTML = ''; clientModalOverlay.appendChild(clientModal); clientModalOverlay.style.display = 'flex'; }); }
function createClientModal(type) { const modal = document.createElement('div'); modal.className = 'modal'; const overlayId = 'client-modal-overlay'; if (type === 'new') { modal.innerHTML = `<div class="modal-header"><h2 class="modal-title">New Client</h2><span class="modal-close" data-modal-id="${overlayId}">&times;</span></div><div class="modal-body"><div class="form-group"><label for="client-name">Client Name:</label><input type="text" id="client-name" class="form-control"></div><div class="form-group"><label for="client-address">Client Address:</label><input type="text" id="client-address" class="form-control"></div></div><div class="modal-footer"><button class="btn btn-cancel" data-modal-id="${overlayId}">Cancel</button><button class="btn btn-save">Save</button></div>`; setTimeout(() => { setupModalCloseButtons(modal, overlayId); const saveBtn = modal.querySelector('.btn-save'); saveBtn.addEventListener('click', () => { const nameInput = modal.querySelector('#client-name'); const addressInput = modal.querySelector('#client-address'); const name = nameInput.value.trim(); const address = addressInput.value.trim(); if (!name) { alert('Client name is required'); nameInput.focus(); return; } const newClient = { name: name, address: address, moduleData: {} }; console.log("[Dashboard] Creating new client:", name); const client = window.ConstructionApp.ClientManager.addClient(newClient); window.ConstructionApp.ClientManager.setCurrentClient(client); updateDebugPanel(); alert(`Client "${name}" created and selected.`); document.getElementById(overlayId).style.display = 'none'; }); }, 0); } else if (type === 'open') { const clients = window.ConstructionApp.ClientManager.getAllClients(); let clientListHTML = ''; if (clients.length > 0) { clients.sort((a, b) => a.name.localeCompare(b.name)); clientListHTML = clients.map(client => `<div class="client-list-item" data-client-id="${client.id}">${client.name}</div>`).join(''); } else { clientListHTML = '<div style="padding: 10px; text-align: center; color: #666;">No clients found</div>'; } modal.innerHTML = `<div class="modal-header"><h2 class="modal-title">Open Client</h2><span class="modal-close" data-modal-id="${overlayId}">&times;</span></div><div class="modal-body"><div class="form-group"><label for="client-search">Search Clients:</label><input type="text" id="client-search" class="form-control" placeholder="Type to filter..."></div><div class="client-list">${clientListHTML}</div></div><div class="modal-footer"><button class="btn btn-cancel" data-modal-id="${overlayId}">Cancel</button></div>`; setTimeout(() => { setupModalCloseButtons(modal, overlayId); setupClientListSelection(modal); setupClientSearch(modal); }, 0); } return modal; }
function setupModalCloseButtons(modal, overlayId) { const closeBtns = modal.querySelectorAll(`.modal-close[data-modal-id="${overlayId}"], .btn-cancel[data-modal-id="${overlayId}"]`); closeBtns.forEach(btn => { const newBtn = btn.cloneNode(true); btn.parentNode.replaceChild(newBtn, btn); newBtn.addEventListener('click', () => { const overlay = document.getElementById(overlayId); if (overlay) overlay.style.display = 'none'; else console.error("Overlay not found:", overlayId); }); }); }
function setupClientSearch(modal) { const searchInput = modal.querySelector('#client-search'); const clientListContainer = modal.querySelector('.client-list'); if (searchInput && clientListContainer) { searchInput.addEventListener('input', () => { const searchTerm = searchInput.value.toLowerCase().trim(); const clientItems = clientListContainer.querySelectorAll('.client-list-item'); clientItems.forEach(item => { if (item.dataset.clientId) { const clientName = item.textContent.toLowerCase(); item.style.display = (searchTerm === '' || clientName.includes(searchTerm)) ? 'block' : 'none'; } }); }); } }
function setupClientListSelection(modal) { const clientListContainer = modal.querySelector('.client-list'); if (!clientListContainer) return; clientListContainer.addEventListener('click', (event) => { const listItem = event.target.closest('.client-list-item'); if (listItem && listItem.dataset.clientId) { const clientId = listItem.dataset.clientId; const clients = window.ConstructionApp.ClientManager.getAllClients(); const selectedClient = clients.find(c => c.id === clientId); if (selectedClient) { console.log("[Dashboard] Selecting client:", selectedClient.name); window.ConstructionApp.ClientManager.setCurrentClient(selectedClient); updateDebugPanel(); const overlay = modal.closest('.modal-overlay'); if (overlay) overlay.style.display = 'none'; alert(`Client "${selectedClient.name}" selected.`); } else { console.error("Selected client ID not found:", clientId); } } }); }
function updateDashboard(client) { console.log("[Dashboard] Updating dashboard for client:", client?.name); const logoutBtn = document.getElementById('logout-btn'); const dashboardContent = document.getElementById('module-content'); const clientNameDisplay = document.getElementById('client-name-display'); const dashboardDesc = document.querySelector('.dashboard-description'); if (client) { clientNameDisplay.textContent = `Client: ${client.name}`; dashboardDesc.textContent = `${client.address || 'No address provided'}`; logoutBtn.style.display = 'inline-block'; const newLogoutBtn = logoutBtn.cloneNode(true); logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn); newLogoutBtn.addEventListener('click', () => window.ConstructionApp.ModuleUtils.logoutClient()); updateTotalProjectCost(); renderDashboardContent(client); } else { clientNameDisplay.textContent = ''; document.getElementById('total-project-cost').textContent = 'Total Project Cost: R0.00'; dashboardDesc.textContent = 'Overview of project data.'; logoutBtn.style.display = 'none'; dashboardContent.innerHTML = `<div class="no-client-notification"><h2>No Client Selected</h2><p>Please select an existing client or create a new client to start working.</p><div class="no-client-buttons"><button id="prompt-new-client" class="btn no-client-button">Create New Client</button><button id="prompt-open-client" class="btn no-client-button">Open Existing Client</button></div></div>`; setTimeout(() => { const newClientBtn = document.getElementById('prompt-new-client'); const openClientBtn = document.getElementById('prompt-open-client'); if (newClientBtn) newClientBtn.addEventListener('click', () => document.getElementById('new-client-btn')?.click()); if (openClientBtn) openClientBtn.addEventListener('click', () => document.getElementById('open-client-btn')?.click()); }, 0); } updateDebugPanel(); }
function renderDashboardContent(client) { const contentElement = document.getElementById('module-content'); contentElement.innerHTML = ''; let tilesHTML = ''; let hasModuleDataToShow = false; const moduleDataEntries = client?.moduleData ? Object.entries(client.moduleData) : []; console.log("[Dashboard] Rendering tiles. Client module data keys:", Object.keys(client?.moduleData || {})); if (moduleDataEntries.length > 0) { moduleDataEntries.forEach(([moduleId, moduleVersionedData]) => { const moduleData = moduleVersionedData?.data ?? moduleVersionedData ?? {}; if (!moduleData || Object.keys(moduleData).length === 0) { /* console.log(`[Dashboard] Skipping tile for ${moduleId} - data null/empty.`); */ return; } const moduleInfo = appData.modules.find(m => m.id === moduleId); const moduleName = moduleInfo ? moduleInfo.name : moduleId; let moduleCost = 0; if (moduleData.totalCost !== undefined) moduleCost = parseFloat(moduleData.totalCost) || 0; else if (moduleData.items && Array.isArray(moduleData.items)) moduleCost = window.ConstructionApp.ModuleUtils.calculateModuleTotal(moduleData.items); else if (moduleId === 'notes') moduleCost = 0; if (moduleCost > 0 || moduleId === 'notes') { hasModuleDataToShow = true; const formattedCost = window.ConstructionApp.ModuleUtils.formatCurrency(moduleCost); tilesHTML += `<div class="module-tile" data-module-id="${moduleId}">${moduleId !== 'notes' ? `<button class="clear-module-btn" title="Clear module data">×</button>` : ''}<h5>${moduleName}</h5>${moduleId !== 'notes' ? `<p class="module-tile-cost">${formattedCost}</p>` : '<p style="font-size: 0.9em; color: #666; margin-top: 10px;">(No cost associated)</p>'}<button class="btn module-open-btn" style="margin-top: 10px;">Open Module</button></div>`; } else { /* console.log(`[Dashboard] Skipping tile for ${moduleId} - cost is zero.`); */ } }); } let finalContent = `<div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 10px;"><h4 style="margin-bottom: 15px;">Module Summaries</h4><div id="module-tiles" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 15px;">`; if (hasModuleDataToShow) finalContent += tilesHTML; else finalContent += `<div style="background-color: white; padding: 15px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); grid-column: 1 / -1; text-align: center; color: #666;"><p>No module data with costs entered yet.</p><p style="margin-top: 5px;"><small>Click a module in the sidebar to begin.</small></p></div>`; finalContent += `</div></div>`; contentElement.innerHTML = finalContent; setupDashboardTileListeners(); }
function setupDashboardTileListeners() { const tilesContainer = document.getElementById('module-tiles'); if (!tilesContainer) return; tilesContainer.removeEventListener('click', handleTileClick); tilesContainer.addEventListener('click', handleTileClick); }
function handleTileClick(e) { const openBtn = e.target.closest('.module-open-btn'); const clearBtn = e.target.closest('.clear-module-btn'); const tile = e.target.closest('.module-tile'); if (!tile) return; const moduleId = tile.dataset.moduleId; if (openBtn) window.ConstructionApp.ModuleUtils.navigateToModule(moduleId); else if (clearBtn) { const moduleInfo = appData.modules.find(m => m.id === moduleId); const moduleName = moduleInfo ? moduleInfo.name : moduleId; if (confirm(`Are you sure you want to clear all data for "${moduleName}"? This cannot be undone.`)) clearModuleData(moduleId); } }
function clearModuleData(moduleId) { const client = window.ConstructionApp.ClientManager.getCurrentClient(); if (client && client.moduleData && client.moduleData.hasOwnProperty(moduleId)) { console.log(`[Dashboard] Clearing module data for: ${moduleId}`); window.ConstructionApp.ClientManager.saveModuleData(moduleId, null, (success, error) => { if (success) { if (client.moduleData) { delete client.moduleData[moduleId]; sessionStorage.setItem('currentClient', JSON.stringify(client)); console.log("[Dashboard] Updated client session after clearing module."); } window.ConstructionApp.ModuleUtils.showSuccessMessage(`Module data cleared.`); renderDashboardContent(client); updateTotalProjectCost(); } else { window.ConstructionApp.ModuleUtils.showErrorMessage(`Error clearing data: ${error || 'Unknown'}`); } }); } else { console.warn(`[Dashboard] No data found for module ${moduleId} to clear.`); } }
function updateTotalProjectCost() { let totalCost = 0; const client = window.ConstructionApp.ClientManager.getCurrentClient(); if (client && client.moduleData) { Object.entries(client.moduleData).forEach(([moduleId, moduleVData]) => { const moduleData = moduleVData?.data ?? moduleVData ?? {}; if (!moduleData) return; let costForThisModule = 0; if (moduleData.totalCost !== undefined) costForThisModule = parseFloat(moduleData.totalCost) || 0; else if (moduleData.items && Array.isArray(moduleData.items)) costForThisModule = window.ConstructionApp.ModuleUtils.calculateModuleTotal(moduleData.items); totalCost += costForThisModule; }); } const formattedTotal = window.ConstructionApp.ModuleUtils.formatCurrency(totalCost); document.getElementById('total-project-cost').textContent = `Total Project Cost: ${formattedTotal}`; console.log("[Dashboard] Updated total cost display:", formattedTotal); }

// --- Debug Panel ---
function setupDebugPanel() { const debugPanel = document.getElementById('debug-panel'); if (document.getElementById('debug-toggle-btn')) return; const toggleBtn = document.createElement('button'); toggleBtn.textContent = 'Debug'; toggleBtn.id = 'debug-toggle-btn'; toggleBtn.style.cssText = 'position: fixed; bottom: 10px; right: 10px; z-index: 10000; padding: 5px 10px; background: #333; color: white; border: none; border-radius: 3px; cursor: pointer; opacity: 0.8;'; document.body.appendChild(toggleBtn); toggleBtn.addEventListener('click', function() { const isVisible = debugPanel.style.display === 'block'; debugPanel.style.display = isVisible ? 'none' : 'block'; if (!isVisible) updateDebugPanel(); }); }
function updateDebugPanel() { const debugPanel = document.getElementById('debug-panel'); if (!debugPanel || debugPanel.style.display !== 'block') return; const navigationState = sessionStorage.getItem('navigationState'); const currentClient = window.ConstructionApp.ClientManager.getCurrentClient(); const storedClientStr = sessionStorage.getItem('currentClient'); const moduleOrderStr = sessionStorage.getItem('moduleOrder'); let debugInfo = `<strong>Nav State:</strong> ${navigationState || 'None'}<br><strong>Current Client:</strong> ${currentClient ? currentClient.name : 'None'} (ID: ${currentClient?.id || 'N/A'})<br><strong>Client in sessionStorage:</strong> ${storedClientStr ? 'Present' : 'None'}<br><strong>Modules in appData:</strong> ${appData.modules.length}<br><strong>Module Order in Backup:</strong> ${moduleOrderStr ? 'Present' : 'None'}<br><hr>`; if (currentClient && currentClient.moduleData) { debugInfo += '<strong>Client Module Data (Costs):</strong><br>'; let totalCost = 0; Object.entries(currentClient.moduleData).forEach(([moduleId, moduleVData]) => { const moduleData = moduleVData?.data ?? moduleVData ?? {}; let moduleCost = 0; if (moduleData?.totalCost !== undefined) moduleCost = moduleData.totalCost; else if (moduleData?.items) moduleCost = window.ConstructionApp.ModuleUtils.calculateModuleTotal(moduleData.items); totalCost += parseFloat(moduleCost) || 0; debugInfo += `- ${moduleId}: Cost: ${window.ConstructionApp.ModuleUtils.formatCurrency(moduleCost)}<br>`; }); debugInfo += `<strong>Calculated Total Cost:</strong> ${window.ConstructionApp.ModuleUtils.formatCurrency(totalCost)}<br><hr>`; } debugInfo += '<strong>Module Structure (appData):</strong><br><pre style="max-height: 150px; overflow-y: auto; border: 1px solid #555; padding: 5px; font-size: 11px;">'; debugInfo += JSON.stringify(appData.modules.map(m => ({id: m.id, name: m.name, type: m.type, parentId: m.parentId, order: m.order})), null, 1); debugInfo += '</pre>'; debugPanel.innerHTML = debugInfo; }

 // --- Helper Functions ---
 function setupModuleClickHandler(moduleElement) { const moduleText = moduleElement.querySelector('.module-name'); if (moduleText) { const newModuleText = moduleText.cloneNode(true); moduleText.parentNode.replaceChild(newModuleText, moduleText); newModuleText.addEventListener('click', function() { const moduleId = moduleElement.getAttribute('data-module-id'); window.ConstructionApp.ModuleUtils.navigateToModule(moduleId); }); } }
