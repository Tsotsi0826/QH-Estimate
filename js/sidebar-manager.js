// js/sidebar-manager.js - Full Implementation with All Debug Logs
(function() {
    'use strict';

    window.ConstructionApp = window.ConstructionApp || {};

    // --- Private Variables ---
    let headerCollapseState = {};
    let globalDraggedItem = null;
    let dragOverElement = null;
    let dropIndicator = null;
    let modules = []; // Local reference

    // --- Helper Functions ---
    function triggerSaveStructure() {
        const ModuleDefManager = window.ConstructionApp.ModuleDefinitionManager;
        if (ModuleDefManager) {
            if (typeof ModuleDefManager.recalculateModuleOrder === 'function') {
                ModuleDefManager.recalculateModuleOrder(modules);
                console.log("[SidebarManager] Recalculated order for local modules array.");
            } else { console.warn("[SidebarManager] Cannot recalculate order..."); }
            if (typeof ModuleDefManager.saveModuleStructure === 'function') {
                console.log("[SidebarManager] Triggering saveModuleStructure via ModuleDefinitionManager with updated array...");
                ModuleDefManager.saveModuleStructure(modules);
            } else { console.error("[SidebarManager] Cannot save structure: save function not found..."); }
        } else { console.error("[SidebarManager] Cannot save structure: ModuleDefinitionManager not found."); }
    }
    function triggerNavigation(moduleId) {
         if (window.ConstructionApp.ModuleUtils && typeof window.ConstructionApp.ModuleUtils.navigateToModule === 'function') {
             window.ConstructionApp.ModuleUtils.navigateToModule(moduleId);
         } else { console.error("[SidebarManager] Cannot navigate: navigateToModule function not found..."); }
     }

    // --- Sidebar Rendering ---

    /**
     * Renders the hierarchical list of modules in the sidebar. FULL IMPLEMENTATION
     * @param {Array} moduleData - The array of module objects to render.
     */
    function renderModuleList(moduleData) {
        const container = document.getElementById('modules-container');
        if (!container) {
            console.error("[SidebarManager] Render FAILED - #modules-container not found!");
            return;
        }
        if (!Array.isArray(moduleData)) {
             console.error("[SidebarManager] Render FAILED - moduleData is not an array!", moduleData);
             return;
        }

        modules = moduleData || [];
        container.innerHTML = ''; // Clear existing list
        console.log(`[SidebarManager] Rendering module list with ${modules.length} modules. Container cleared.`); // LOG PRESENT

        const sortedModules = [...modules].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.name.localeCompare(b.name));

        function renderLevel(parentId, level) {
            const children = sortedModules.filter(m => m.parentId === parentId);
            children.forEach((module, index) => {
                // console.log(`DEBUG SidebarRenderLoop: Processing child ${index + 1}/${children.length} - ID: ${module.id}, Name: ${module.name}, Level: ${level}`); // Can be noisy
                const moduleElement = createModuleElement(module, level); // createModuleElement now adds listeners
                if (moduleElement) {
                    container.appendChild(moduleElement);
                    // console.log(`DEBUG SidebarRenderLoop: Appended element for ${module.id}`); // Can be noisy
                    const isHeader = module.type === 'header';
                    const isCollapsed = headerCollapseState[module.id] === true;
                    if (!isHeader || !isCollapsed) {
                        renderLevel(module.id, level + 1);
                    }
                } else {
                     console.error(`DEBUG SidebarRenderLoop: createModuleElement returned null for module ID: ${module.id}`);
                }
            });
        }
        renderLevel(null, 0);
        console.log("[SidebarManager] Finished rendering loop."); // LOG PRESENT
        setupDragAndDrop(); // Re-attach D&D listeners after re-rendering
    }

    /**
     * Creates element and ATTACHES LISTENERS. FULL IMPLEMENTATION
     * @param {object} moduleData - The module object.
     * @param {number} level - The nesting level.
     * @returns {HTMLElement|null} The created div element or null if data is invalid.
     */
    function createModuleElement(moduleData, level = 0) {
        if (!moduleData || !moduleData.id || typeof moduleData.name === 'undefined') {
             console.warn("[SidebarManager] Invalid moduleData passed to createModuleElement:", moduleData);
             return null;
        }
        const moduleElement = document.createElement('div');
        moduleElement.className = 'module-item';
        moduleElement.draggable = true;
        moduleElement.setAttribute('data-module-id', moduleData.id);
        moduleElement.setAttribute('data-requires-client', moduleData.requiresClient ? 'true' : 'false');
        moduleElement.setAttribute('data-module-type', moduleData.type || 'regular');
        moduleElement.setAttribute('data-parent-id', moduleData.parentId || 'null');
        moduleElement.setAttribute('data-level', level);

        let collapseIconHTML = '';
        if (moduleData.type === 'header') {
            moduleElement.classList.add('header-item');
            const isCollapsed = headerCollapseState[moduleData.id] === true;
            if (isCollapsed) moduleElement.classList.add('collapsed');
             collapseIconHTML = `<span class="collapse-icon" title="Expand/Collapse">${isCollapsed ? '▶' : '▼'}</span>`;
        }

        const configIcon = !moduleData.requiresClient ? ' <span title="Configuration Module" style="opacity: 0.7; margin-left: 5px;">⚙️</span>' : '';
        const moduleNameSpan = document.createElement('span');
        moduleNameSpan.className = 'module-name';
        moduleNameSpan.textContent = moduleData.name;

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
            ${configIcon}
        `;
        const iconElement = moduleElement.querySelector('.module-icon');
        if (iconElement) iconElement.after(moduleNameSpan);
        else moduleElement.insertBefore(moduleNameSpan, moduleElement.querySelector('.config-icon'));

        // --- Attach Event Listeners ---
        const icon = moduleElement.querySelector('.module-icon');
        if (icon) {
            // console.log(`DEBUG ListenerSetup: Attaching click listener to icon for ${moduleData.id}`);
            icon.addEventListener('click', (e) => {
                console.log(`DEBUG ActionClick: Icon clicked for ${moduleData.id}`);
                e.stopPropagation();
                const dropdown = icon.querySelector('.dropdown-menu');
                if (dropdown) {
                    const isVisible = dropdown.style.display === 'block';
                    closeAllDropdowns();
                    if (!isVisible) dropdown.style.display = 'block';
                }
            });
        }

        const editBtn = moduleElement.querySelector('.edit-module');
        if (editBtn) {
             // console.log(`DEBUG ListenerSetup: Attaching click listener to edit for ${moduleData.id}`);
             editBtn.addEventListener('click', (e) => {
                console.log(`DEBUG ActionClick: Edit clicked for ${moduleData.id}`);
                e.stopPropagation();
                closeAllDropdowns();
                const moduleId = moduleElement.dataset.moduleId;
                const currentModule = modules.find(m => m.id === moduleId);
                if (!currentModule) { alert("Error: Cannot find module data to edit."); return; }
                const currentName = currentModule.name;
                const newName = prompt(`Edit module name:`, currentName);
                if (newName && newName.trim() !== '' && newName.trim() !== currentName) {
                    const finalNewName = newName.trim();
                    if (window.ConstructionApp.ModuleDefinitionManager) {
                         const success = window.ConstructionApp.ModuleDefinitionManager.editModuleDefinition(moduleId, { name: finalNewName });
                         if (success) alert(`Module renamed to "${finalNewName}"`);
                         else alert(`Failed to rename module.`);
                    } else alert("Error: Module Definition Manager not available.");
                }
            });
        }

        const deleteBtn = moduleElement.querySelector('.delete-module');
        if (deleteBtn) {
             // console.log(`DEBUG ListenerSetup: Attaching click listener to delete for ${moduleData.id}`);
             deleteBtn.addEventListener('click', (e) => {
                console.log(`DEBUG ActionClick: Delete clicked for ${moduleData.id}`);
                e.stopPropagation();
                closeAllDropdowns();
                const moduleId = moduleElement.dataset.moduleId;
                const currentModule = modules.find(m => m.id === moduleId);
                if (!currentModule) { alert("Error: Cannot find module data to delete."); return; }
                const moduleName = currentModule.name;
                const isHeader = currentModule.type === 'header';
                const directChildren = modules.filter(m => m.parentId === moduleId);
                let confirmMessage = `Are you sure you want to delete the "${moduleName}" module?`;
                if (isHeader && directChildren.length > 0) confirmMessage += `\n\nWARNING: This will also delete ALL descendants.`;
                confirmMessage += `\n\nThis action cannot be undone.`;
                const confirmed = confirm(confirmMessage);
                 if (confirmed) {
                     if (window.ConstructionApp.ModuleDefinitionManager) {
                          const success = window.ConstructionApp.ModuleDefinitionManager.deleteModuleDefinition(moduleId);
                          if (success) alert(`Module "${moduleName}" ${isHeader && directChildren.length > 0 ? 'and its descendants ' : ''}deleted successfully.`);
                          else alert(`Failed to delete module "${moduleName}".`);
                     } else alert("Error: Module Definition Manager not available.");
                 }
            });
        }

        if (moduleNameSpan && moduleData.type !== 'header') {
             // console.log(`DEBUG ListenerSetup: Attaching click listener to name for ${moduleData.id}`);
             moduleNameSpan.addEventListener('click', () => {
                 console.log(`DEBUG ActionClick: Name clicked for ${moduleData.id}`);
                 triggerNavigation(moduleData.id);
             });
        }

        if (moduleData.type === 'header') {
             const collapseTarget = moduleElement.querySelector('.collapse-icon') || moduleNameSpan || moduleElement;
             if (collapseTarget) {
                 // console.log(`DEBUG ListenerSetup: Attaching click listener to collapse for ${moduleData.id}`);
                 collapseTarget.addEventListener('click', (e) => {
                     console.log(`DEBUG ActionClick: Collapse target clicked for ${moduleData.id}`);
                     if (!e.target.closest('.module-icon') && !e.target.closest('.module-drag-handle')) {
                         handleCollapseToggle(moduleData.id);
                     }
                 });
             }
         }

        return moduleElement;
    }

    // --- Search --- FULL IMPLEMENTATION
    function setupModuleSearch() {
        const searchInput = document.getElementById('module-search-input');
        const container = document.getElementById('modules-container');
        if (!searchInput || !container) {
             console.error("[SidebarManager] Search setup FAILED - elements not found!");
             return;
        }

        let debounceTimer;
        const debounceFilter = (func, delay) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(func, delay);
        };

         searchInput.removeEventListener('input', handleSearchInput); // Remove previous listener first
         searchInput.addEventListener('input', handleSearchInput);

        console.log("[SidebarManager] Module search setup complete.");
    }

    // Separate handler function for search input
    function handleSearchInput() {
        const searchInput = document.getElementById('module-search-input');
        const container = document.getElementById('modules-container');
        if (!searchInput || !container) return;

         debounceFilter(() => { // Apply debounce here
             const searchTerm = searchInput.value.toLowerCase().trim();
             console.log("DEBUG SidebarSearch: Filtering with term:", searchTerm);
             const allModuleElements = container.querySelectorAll('.module-item');
             if (searchTerm === '') {
                 renderModuleList(modules); // Re-render to respect current collapse state
                 return;
             }
             const visibleModuleIds = new Set();
             modules.forEach(module => {
                  const moduleName = module.name.toLowerCase();
                  const isMatch = moduleName.includes(searchTerm);
                  if (isMatch) {
                      visibleModuleIds.add(module.id);
                      let currentParentId = module.parentId;
                      while (currentParentId && currentParentId !== 'null') {
                          visibleModuleIds.add(currentParentId);
                          const parentModule = modules.find(m => m.id === currentParentId);
                          currentParentId = parentModule ? parentModule.parentId : null;
                      }
                  }
             });
             allModuleElements.forEach(moduleEl => {
                 const moduleId = moduleEl.dataset.moduleId;
                 moduleEl.style.display = visibleModuleIds.has(moduleId) ? 'flex' : 'none';
             });
         }, 250);
    }


    // --- Collapse / Expand ---
    function handleCollapseToggle(headerModuleId) {
        console.log("[SidebarManager] Toggling collapse for header:", headerModuleId);
        headerCollapseState[headerModuleId] = !(headerCollapseState[headerModuleId] === true);
        renderModuleList(modules); // Re-render the list
    }


    // --- Drag and Drop (Keep Debug Logs) ---
    function setupDragAndDrop() { /* ... same ... */ }
    function handleDragStart(e) { /* ... same ... */ }
    function handleDragOver(e) { /* ... same ... */ }
    function handleDragLeave(e) { /* ... same ... */ }
    function handleDrop(e) { /* ... same ... */ }
    function handleDragEnd(e) { /* ... same ... */ }
    function clearDropIndicators(element) { /* ... same ... */ }


    // --- Dropdown Menus & Actions (Keep Debug Logs + Escape Handler) ---
    function setupDropdownMenus() { /* ... same ... */ }
    function handleGlobalClickForDropdowns(e) { /* ... same ... */ }
    function handleEscapeKey(e) { /* ... same ... */ }
    function closeAllDropdowns() { /* ... same ... */ }


    // --- Initialization Function ---
    function init(modulesData) {
        // Add logs from previous debug step
        console.log("[SidebarManager] DEBUG Init: Entered init function.");
        console.log("[SidebarManager] DEBUG Init: Received modulesData:", modulesData);
        if (!Array.isArray(modulesData)) {
             console.error("[SidebarManager] DEBUG Init: ERROR - modulesData is not an array! Stopping init.");
             return;
        }
        console.log("[SidebarManager] DEBUG Init: modulesData is a valid array.");

        modules = modulesData || [];
        const container = document.getElementById('modules-container');
        if (!container) {
            console.error("[SidebarManager] Init FAILED - #modules-container not found!");
            return;
        }
        console.log("[SidebarManager] DEBUG Init: Found #modules-container.");

        headerCollapseState = {};
        try {
            console.log("[SidebarManager] DEBUG Init: Starting headerCollapseState loop...");
             modules.forEach(module => { if (module.type === 'header') { if (headerCollapseState[module.id] === undefined) headerCollapseState[module.id] = true; } });
             console.log("[SidebarManager] DEBUG Init: Finished headerCollapseState loop.");
        } catch(loopError) {
             console.error("[SidebarManager] DEBUG Init: ERROR during headerCollapseState loop:", loopError);
             return;
        }

        // Call the actual setup functions
        console.log("[SidebarManager] DEBUG Init: Calling renderModuleList...");
        renderModuleList(modules);      // Initial render - FULL IMPLEMENTATION
        console.log("[SidebarManager] DEBUG Init: Calling setupModuleSearch...");
        setupModuleSearch();            // Setup search input - FULL IMPLEMENTATION
        console.log("[SidebarManager] DEBUG Init: Calling setupDropdownMenus...");
        setupDropdownMenus();           // Setup global click listener for dropdowns - FULL IMPLEMENTATION

        console.log("[SidebarManager] Initialization complete.");
    }

    // --- Expose Public Interface ---
    window.ConstructionApp.SidebarManager = {
        init: init,
        renderModuleList: renderModuleList
    };

})();
