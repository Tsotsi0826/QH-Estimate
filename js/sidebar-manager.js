// js/sidebar-manager.js - Updated: Calls DashboardRenderer after drop
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

    /**
     * Saves the module structure by calling ModuleDefinitionManager.
     */
    function triggerSaveStructure() {
        const ModuleDefManager = window.ConstructionApp.ModuleDefinitionManager;
        if (ModuleDefManager) {
            // D&D already updated the local 'modules' array order.
            // Recalculate the .order property based on the new array order.
            // Ensure recalculate function exists before calling
            if (typeof ModuleDefManager.recalculateModuleOrder === 'function') {
                ModuleDefManager.recalculateModuleOrder();
            } else {
                 console.warn("[SidebarManager] Cannot recalculate order: ModuleDefinitionManager.recalculateModuleOrder not found.");
            }

            // Ensure save function exists before calling
            if (typeof ModuleDefManager.saveModuleStructure === 'function') {
                console.log("[SidebarManager] Triggering saveModuleStructure via ModuleDefinitionManager...");
                ModuleDefManager.saveModuleStructure();
            } else {
                 console.error("[SidebarManager] Cannot save structure: saveModuleStructure function not found on ModuleDefinitionManager.");
            }
        } else {
            console.error("[SidebarManager] Cannot save structure: ModuleDefinitionManager not found.");
        }
    }

    /**
     * Navigates to a module page using ModuleUtils.
     */
     function triggerNavigation(moduleId) {
         if (window.ConstructionApp.ModuleUtils && typeof window.ConstructionApp.ModuleUtils.navigateToModule === 'function') {
             window.ConstructionApp.ModuleUtils.navigateToModule(moduleId);
         } else {
             console.error("[SidebarManager] Cannot navigate: navigateToModule function not found on ModuleUtils.");
         }
     }

    // --- Sidebar Rendering ---

    /**
     * Renders the hierarchical list of modules in the sidebar.
     * This function is now also exposed and called by ModuleDefinitionManager.
     * @param {Array} moduleData - The array of module objects to render (passed from caller).
     */
    function renderModuleList(moduleData) {
        const container = document.getElementById('modules-container');
        if (!container) {
            console.error("[SidebarManager] Sidebar modules container #modules-container not found during render.");
            return;
        }
        // Update local reference if needed (though ModuleDefManager should pass the latest)
        modules = moduleData || []; // Ensure modules is an array

        container.innerHTML = ''; // Clear existing list
        console.log(`[SidebarManager] Rendering module list with ${modules.length} modules.`);

        // Ensure modules is an array before sorting
        if (!Array.isArray(modules)) {
            console.error("[SidebarManager] Invalid module data received for rendering.");
            return;
        }

        const sortedModules = [...modules].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.name.localeCompare(b.name));

        function renderLevel(parentId, level) {
            sortedModules
                .filter(m => m.parentId === parentId)
                .forEach(module => {
                    const moduleElement = createModuleElement(module, level);
                    if (moduleElement) { // Check if element creation was successful
                        container.appendChild(moduleElement);
                        const isHeader = module.type === 'header';
                        // Use the sidebar-manager's headerCollapseState
                        const isCollapsed = headerCollapseState[module.id] === true;

                        // Only render children if the header is not collapsed
                        if (!isHeader || !isCollapsed) {
                            renderLevel(module.id, level + 1);
                        }
                    }
                });
        }
        renderLevel(null, 0); // Start rendering from top level (parentId = null)
        setupDragAndDrop(); // Re-attach D&D listeners after re-rendering
    }

    /**
     * Creates a single module list item element for the sidebar.
     * @param {object} moduleData - The module object.
     * @param {number} level - The nesting level (0 for top-level).
     * @returns {HTMLElement|null} The created div element or null if data is invalid.
     */
    function createModuleElement(moduleData, level = 0) {
        if (!moduleData || !moduleData.id || !moduleData.name) {
             console.warn("[SidebarManager] Invalid moduleData passed to createModuleElement:", moduleData);
             return null; // Don't create element for invalid data
        }

        const moduleElement = document.createElement('div');
        moduleElement.className = 'module-item';
        moduleElement.draggable = true; // Make it draggable
        moduleElement.setAttribute('data-module-id', moduleData.id);
        moduleElement.setAttribute('data-requires-client', moduleData.requiresClient ? 'true' : 'false');
        moduleElement.setAttribute('data-module-type', moduleData.type || 'regular');
        moduleElement.setAttribute('data-parent-id', moduleData.parentId || 'null');
        moduleElement.setAttribute('data-level', level);

        let collapseIconHTML = '';
        if (moduleData.type === 'header') {
            moduleElement.classList.add('header-item');
            // Use the sidebar-manager's headerCollapseState
            const isCollapsed = headerCollapseState[moduleData.id] === true;
            if (isCollapsed) {
                moduleElement.classList.add('collapsed');
            }
             collapseIconHTML = `<span class="collapse-icon" title="Expand/Collapse">${isCollapsed ? '▶' : '▼'}</span>`;
        }

        const configIcon = !moduleData.requiresClient ? ' <span title="Configuration Module" style="opacity: 0.7; margin-left: 5px;">⚙️</span>' : '';

        // Ensure moduleData.name is treated as text content to prevent potential XSS if names could contain HTML
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
        // Insert the text-based span safely
        const iconElement = moduleElement.querySelector('.module-icon');
        if (iconElement) {
             iconElement.after(moduleNameSpan);
        } else {
             // Fallback if icon not found (shouldn't happen)
             moduleElement.insertBefore(moduleNameSpan, moduleElement.querySelector('.config-icon'));
        }


        // --- Attach Event Listeners Directly ---

        // Dropdown Action Menu
        const icon = moduleElement.querySelector('.module-icon');
        if (icon) {
            icon.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent triggering collapse/navigation
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

        // Edit Button Listener - Calls ModuleDefinitionManager
        const editBtn = moduleElement.querySelector('.edit-module');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                closeAllDropdowns();
                const moduleId = moduleElement.dataset.moduleId;
                const currentModule = modules.find(m => m.id === moduleId); // Find in local array
                if (!currentModule) {
                     alert("Error: Cannot find module data to edit.");
                     return;
                }
                const currentName = currentModule.name;
                const newName = prompt(`Edit module name:`, currentName);

                if (newName && newName.trim() !== '' && newName.trim() !== currentName) {
                    const finalNewName = newName.trim();
                    // Call the definition manager to handle the edit
                    if (window.ConstructionApp.ModuleDefinitionManager) {
                         const success = window.ConstructionApp.ModuleDefinitionManager.editModuleDefinition(moduleId, { name: finalNewName });
                         if (success) {
                             alert(`Module renamed to "${finalNewName}"`);
                             // SidebarManager's renderModuleList will be called by ModuleDefinitionManager
                         } else {
                             alert(`Failed to rename module.`); // Manager might have already alerted
                         }
                    } else {
                         alert("Error: Module Definition Manager not available.");
                    }
                }
            });
        }

        // Delete Button Listener - Calls ModuleDefinitionManager
        const deleteBtn = moduleElement.querySelector('.delete-module');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                closeAllDropdowns();
                const moduleId = moduleElement.dataset.moduleId;
                const currentModule = modules.find(m => m.id === moduleId); // Find in local array
                if (!currentModule) {
                     alert("Error: Cannot find module data to delete.");
                     return;
                }
                const moduleName = currentModule.name;
                const isHeader = currentModule.type === 'header';
                const directChildren = modules.filter(m => m.parentId === moduleId);

                let confirmMessage = `Are you sure you want to delete the "${moduleName}" module?`;
                 if (isHeader && directChildren.length > 0) {
                     confirmMessage += `\n\nWARNING: This is a header with ${directChildren.length} direct sub-module(s). Deleting it will also delete ALL descendants.`;
                 }
                 confirmMessage += `\n\nThis action cannot be undone.`;

                 const confirmed = confirm(confirmMessage);

                 if (confirmed) {
                     // Call the definition manager to handle the delete
                     if (window.ConstructionApp.ModuleDefinitionManager) {
                          const success = window.ConstructionApp.ModuleDefinitionManager.deleteModuleDefinition(moduleId);
                          if (success) {
                              alert(`Module "${moduleName}" ${directChildren.length > 0 && isHeader ? 'and its descendants ' : ''}deleted successfully.`);
                              // SidebarManager's renderModuleList will be called by ModuleDefinitionManager
                          } else {
                              alert(`Failed to delete module "${moduleName}". It might be protected (like 'Notes') or already deleted.`);
                          }
                     } else {
                          alert("Error: Module Definition Manager not available.");
                     }
                 }
            });
        }

        // Navigate on Name Click (if not header)
        if (moduleNameSpan && moduleData.type !== 'header') {
            moduleNameSpan.addEventListener('click', () => {
                 triggerNavigation(moduleData.id); // Use helper to navigate
            });
        }
         // Click on header item (or its name/icon) to toggle collapse
         if (moduleData.type === 'header') {
             const collapseTarget = moduleElement.querySelector('.collapse-icon') || moduleNameSpan || moduleElement; // Click area
             collapseTarget.addEventListener('click', (e) => {
                 // Prevent navigation if clicking the name part of a header
                 if (e.target.classList.contains('module-name')) {
                      e.stopPropagation();
                 }
                 // Avoid toggling if clicking the action icon or drag handle
                 if (!e.target.closest('.module-icon') && !e.target.closest('.module-drag-handle')) {
                     handleCollapseToggle(moduleData.id);
                 }
             });
         }


        return moduleElement;
    }


    // --- Search ---
    function setupModuleSearch() {
        const searchInput = document.getElementById('module-search-input');
        const container = document.getElementById('modules-container');
        if (!searchInput || !container) { /* ... error ... */ return; }
        let debounceTimer;
        const debounceFilter = (func, delay) => { /* ... debounce ... */ return func; };
         searchInput.addEventListener('input', debounceFilter(() => {
             const searchTerm = searchInput.value.toLowerCase().trim();
             const allModuleElements = container.querySelectorAll('.module-item');
             if (searchTerm === '') {
                 renderModuleList(modules); return;
             }
             const visibleModuleIds = new Set();
             modules.forEach(module => { /* ... find matches and ancestors ... */ });
             allModuleElements.forEach(moduleEl => { /* ... show/hide elements ... */ });
         }, 250));
        console.log("[SidebarManager] Module search setup complete.");
    }


    // --- Collapse / Expand ---
    function handleCollapseToggle(headerModuleId) {
        console.log("[SidebarManager] Toggling collapse for header:", headerModuleId);
        headerCollapseState[headerModuleId] = !(headerCollapseState[headerModuleId] === true);
        renderModuleList(modules); // Re-render the list
    }


    // --- Drag and Drop ---
    function setupDragAndDrop() { /* ... same as before ... */ }
    function handleDragStart(e) { /* ... same as before ... */ }
    function handleDragOver(e) { /* ... same as before ... */ }
    function handleDragLeave(e) { /* ... same as before ... */ }
    function handleDrop(e) {
        e.preventDefault();
        clearDropIndicators();
        if (!globalDraggedItem || !dragOverElement || globalDraggedItem === dragOverElement || !dropIndicator) { /* ... */ handleDragEnd(); return; }
        const draggedId = globalDraggedItem.dataset.moduleId;
        const targetId = dragOverElement.dataset.moduleId;
        const draggedModuleIndex = modules.findIndex(m => m.id === draggedId);
        const targetModuleIndex = modules.findIndex(m => m.id === targetId);
        if (draggedModuleIndex === -1 || targetModuleIndex === -1) { /* ... */ handleDragEnd(); return; }
        const draggedModule = modules[draggedModuleIndex];
        const targetModule = modules[targetModuleIndex];
        let newParentId = null;
        let targetPositionInArray = -1;
        if (dropIndicator === 'middle' && targetModule.type === 'header') { /* ... */ }
        else if (dropIndicator === 'bottom') { /* ... */ }
        else { /* dropIndicator === 'top' */ /* ... */ }
        console.log(`[SidebarManager] Drop: Moving ${draggedId} to parent ${newParentId} at index ${targetPositionInArray}`);
        // --- Update local 'modules' array directly ---
        draggedModule.parentId = newParentId;
        modules.splice(draggedModuleIndex, 1);
        if (draggedModuleIndex < targetPositionInArray) targetPositionInArray--;
        modules.splice(targetPositionInArray, 0, draggedModule);
        // --- End local update ---
        renderModuleList(modules); // Re-render sidebar
        triggerSaveStructure(); // Trigger save (which recalculates order)
        console.log("[SidebarManager] Triggering dashboard render after drop.");
        const currentClient = window.ConstructionApp.ClientManager?.getCurrentClient();
        window.ConstructionApp.DashboardRenderer?.render(currentClient); // Trigger dashboard render
        handleDragEnd();
    }
    function handleDragEnd(e) { /* ... same as before ... */ }
    function clearDropIndicators(element) { /* ... same as before ... */ }


    // --- Dropdown Menus & Actions ---
    function setupDropdownMenus() {
        document.removeEventListener('click', handleGlobalClickForDropdowns);
        document.addEventListener('click', handleGlobalClickForDropdowns);
        console.log("[SidebarManager] Dropdown menu global listener setup.");
    }
    function handleGlobalClickForDropdowns(e) { /* ... same as before ... */ }
    function closeAllDropdowns() { /* ... same as before ... */ }
    // editModule and deleteModule logic is MOVED


    // --- Initialization Function ---
    function init(modulesData) {
        console.log("[SidebarManager] Initializing..."); // Restored log
        modules = modulesData || []; // Store initial reference, ensure it's an array
        const container = document.getElementById('modules-container');
        if (!container) {
            console.error("[SidebarManager] Sidebar container #modules-container not found!"); return;
        }
        // Initialize header collapse state based on loaded modules
        headerCollapseState = {}; // Reset first
         modules.forEach(module => {
             if (module.type === 'header') {
                 if (headerCollapseState[module.id] === undefined) headerCollapseState[module.id] = true; // Default collapsed
             }
         });
        // Call the actual setup functions
        renderModuleList(modules);      // Initial render
        setupModuleSearch();            // Setup search input
        setupDragAndDrop();             // Setup drag & drop listeners
        setupDropdownMenus();           // Setup global click listener for dropdowns
        console.log("[SidebarManager] Initialization complete."); // Restored log
    }

    // --- Expose Public Interface ---
    window.ConstructionApp.SidebarManager = {
        init: init,
        renderModuleList: renderModuleList
    };

})();
