// js/sidebar-manager.js
(function() {
    'use strict'; // Helps catch common coding mistakes

    // Ensure the main app namespace exists, same as in other files
    window.ConstructionApp = window.ConstructionApp || {};

    // --- Sidebar-Specific Variables ---
    let headerCollapseState = {}; // Stores { headerId: true/false } for collapsed sections
    let globalDraggedItem = null; // Tracks the item being dragged
    let dragOverElement = null;   // Tracks the element being dragged over
    let dropIndicator = null;     // Tracks where the drop indicator line should appear ('top', 'bottom', 'middle')

    // Stores a reference to the main module list passed during initialization
    let modules = [];

    // --- Helper Functions ---

    /**
     * Saves the module structure by calling the function exposed by the main dashboard script.
     * NOTE: Assumes saveModuleStructure is exposed via window.ConstructionApp.Dashboard
     */
    function triggerSaveStructure() {
        if (window.ConstructionApp.Dashboard && typeof window.ConstructionApp.Dashboard.saveModuleStructure === 'function') {
            console.log("[SidebarManager] Triggering saveModuleStructure...");
            window.ConstructionApp.Dashboard.saveModuleStructure();
        } else {
            console.error("[SidebarManager] Cannot save structure: saveModuleStructure function not found on window.ConstructionApp.Dashboard.");
        }
    }

    /**
     * Navigates to a module page.
     * NOTE: Assumes navigateToModule is exposed via window.ConstructionApp.ModuleUtils
     */
     function triggerNavigation(moduleId) {
        if (window.ConstructionApp.ModuleUtils && typeof window.ConstructionApp.ModuleUtils.navigateToModule === 'function') {
            window.ConstructionApp.ModuleUtils.navigateToModule(moduleId);
        } else {
            console.error("[SidebarManager] Cannot navigate: navigateToModule function not found on window.ConstructionApp.ModuleUtils.");
        }
    }

    // --- Sidebar Rendering ---

    /**
     * Renders the hierarchical list of modules in the sidebar.
     * @param {Array} moduleData - The array of module objects to render.
     */
    function renderModuleList(moduleData) {
        const container = document.getElementById('modules-container');
        if (!container) {
            console.error("[SidebarManager] Sidebar modules container #modules-container not found during render.");
            return;
        }
        container.innerHTML = ''; // Clear existing list
        console.log("[SidebarManager] Rendering module list with", moduleData.length, "modules.");

        // Use the modules reference stored during init
        const sortedModules = [...moduleData].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.name.localeCompare(b.name));

        function renderLevel(parentId, level) {
            sortedModules
                .filter(m => m.parentId === parentId)
                .forEach(module => {
                    const moduleElement = createModuleElement(module, level);
                    container.appendChild(moduleElement);
                    const isHeader = module.type === 'header';
                    // Use the sidebar-manager's headerCollapseState
                    const isCollapsed = headerCollapseState[module.id] === true;

                    // Only render children if the header is not collapsed
                    if (!isHeader || !isCollapsed) {
                        renderLevel(module.id, level + 1);
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
        // moduleElement.style.paddingLeft = `${20 + level * 15}px`; // Use CSS rules instead if possible

        let collapseIconHTML = '';
        if (moduleData.type === 'header') {
            moduleElement.classList.add('header-item');
            // Use the sidebar-manager's headerCollapseState
            const isCollapsed = headerCollapseState[moduleData.id] === true;
            if (isCollapsed) {
                moduleElement.classList.add('collapsed');
            }
            // Use CSS pseudo-elements for icons if possible, otherwise:
             collapseIconHTML = `<span class="collapse-icon" title="Expand/Collapse">${isCollapsed ? '▶' : '▼'}</span>`;
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

        // Edit Button
        const editBtn = moduleElement.querySelector('.edit-module');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                editModule(moduleElement); // Call edit function (moved below)
                closeAllDropdowns();
            });
        }

        // Delete Button
        const deleteBtn = moduleElement.querySelector('.delete-module');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteModule(moduleElement); // Call delete function (moved below)
                closeAllDropdowns();
            });
        }

        // Navigate on Name Click (if not header)
        const nameSpan = moduleElement.querySelector('.module-name');
        if (nameSpan && moduleData.type !== 'header') {
            nameSpan.addEventListener('click', () => {
                 triggerNavigation(moduleData.id); // Use helper to navigate
            });
        }
         // Click on header item (or its name/icon) to toggle collapse
         if (moduleData.type === 'header') {
             const collapseTarget = moduleElement.querySelector('.collapse-icon') || nameSpan || moduleElement; // Click area
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

    /**
     * Sets up the search input listener to filter modules in the sidebar.
     */
    function setupModuleSearch() {
        const searchInput = document.getElementById('module-search-input');
        const container = document.getElementById('modules-container');
        if (!searchInput || !container) {
            console.error("[SidebarManager] Search input or module container not found.");
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

            // If search is empty, show all modules and respect collapse state
            if (searchTerm === '') {
                renderModuleList(modules); // Re-render to respect current collapse state
                return;
            }

            // Find matching modules and their ancestors
            modules.forEach(module => {
                const moduleName = module.name.toLowerCase();
                const isMatch = moduleName.includes(searchTerm);

                if (isMatch) {
                    visibleModuleIds.add(module.id);
                    // Add all parent headers to ensure the hierarchy is visible
                    let currentParentId = module.parentId;
                    while (currentParentId && currentParentId !== 'null') {
                        visibleModuleIds.add(currentParentId);
                        const parentModule = modules.find(m => m.id === currentParentId);
                        currentParentId = parentModule ? parentModule.parentId : null;
                    }
                }
            });

            // Show/hide modules based on whether they are in the visible set
            // Also ensure headers containing matches are shown (but not necessarily expanded)
            allModuleElements.forEach(moduleEl => {
                const moduleId = moduleEl.dataset.moduleId;
                if (visibleModuleIds.has(moduleId)) {
                    moduleEl.style.display = 'flex'; // Use 'flex' as per CSS
                } else {
                    moduleEl.style.display = 'none';
                }
            });
        };

        // Attach the debounced filter function to the input event
        searchInput.addEventListener('input', debounceFilter(filterModules, 250));
        console.log("[SidebarManager] Module search setup complete.");
    }

    // --- Collapse / Expand ---

    /**
     * Handles toggling the collapsed state of a header module.
     * @param {string} headerModuleId - The ID of the header module to toggle.
     */
    function handleCollapseToggle(headerModuleId) {
        console.log("[SidebarManager] Toggling collapse for header:", headerModuleId);
        // Use the sidebar-manager's headerCollapseState
        headerCollapseState[headerModuleId] = !(headerCollapseState[headerModuleId] === true);
        // Re-render the list to show/hide children
        renderModuleList(modules);
    }

    // --- Drag and Drop ---

    /**
     * Sets up delegated drag and drop event listeners on the sidebar container.
     */
    function setupDragAndDrop() {
        const container = document.getElementById('modules-container');
        if (!container) return;

        // Remove potentially old listeners before adding new ones (important after re-renders)
        container.removeEventListener('dragstart', handleDragStart);
        container.removeEventListener('dragover', handleDragOver);
        container.removeEventListener('dragleave', handleDragLeave);
        container.removeEventListener('drop', handleDrop);
        container.removeEventListener('dragend', handleDragEnd);

        // Add fresh listeners
        container.addEventListener('dragstart', handleDragStart);
        container.addEventListener('dragover', handleDragOver);
        container.addEventListener('dragleave', handleDragLeave);
        container.addEventListener('drop', handleDrop);
        container.addEventListener('dragend', handleDragEnd);
        console.log("[SidebarManager] Drag and drop listeners setup.");
    }

    function handleDragStart(e) {
        // Only allow dragging from the handle or the item itself if no handle exists
        const handle = e.target.closest('.module-drag-handle');
        const target = e.target.closest('.module-item');

        if (!target || !target.draggable || (handle && e.target !== handle)) {
             if (!handle && target === e.target) {
                 // Allow dragging item if handle isn't the specific target
             } else {
                e.preventDefault();
                return;
             }
        }

        globalDraggedItem = target;
        e.dataTransfer.setData('text/plain', target.dataset.moduleId);
        e.dataTransfer.effectAllowed = 'move';

        // Add dragging class slightly later to ensure it takes effect
        setTimeout(() => {
            if (globalDraggedItem) globalDraggedItem.classList.add('dragging');
        }, 0);
         console.log("[SidebarManager] DragStart:", target.dataset.moduleId);
    }

    function handleDragOver(e) {
        e.preventDefault(); // Necessary to allow dropping
        e.dataTransfer.dropEffect = 'move';

        const targetElement = e.target.closest('.module-item');

        // Prevent dropping on itself or outside a module item
        if (!targetElement || targetElement === globalDraggedItem) {
            clearDropIndicators();
            dragOverElement = null;
            dropIndicator = null;
            return;
        }

        // Update element being dragged over if it changed
        if (targetElement !== dragOverElement) {
            clearDropIndicators(); // Clear previous indicators
            dragOverElement = targetElement;
        }

        // Determine drop position (top, bottom, or middle for headers)
        const rect = targetElement.getBoundingClientRect();
        const yOffset = e.clientY - rect.top;
        const dropZoneHeight = rect.height;
        const targetIsHeader = targetElement.dataset.moduleType === 'header';
        const draggedItemType = globalDraggedItem?.dataset?.moduleType;

        // Can only drop non-headers into headers (middle)
        const canDropOnHeaderMiddle = targetIsHeader && draggedItemType !== 'header';

        // Thresholds for top/bottom/middle
        const topThreshold = dropZoneHeight * 0.3;
        const bottomThreshold = dropZoneHeight * 0.7;

        let currentIndicator = null;

        if (canDropOnHeaderMiddle && yOffset > topThreshold && yOffset < bottomThreshold) {
            currentIndicator = 'middle'; // Drop into header
        } else if (yOffset <= topThreshold) {
            currentIndicator = 'top'; // Drop above target
        } else {
            currentIndicator = 'bottom'; // Drop below target
        }

        // Apply visual indicator if it changed
        if (currentIndicator !== dropIndicator) {
            targetElement.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-middle'); // Clear existing on target
            dropIndicator = currentIndicator; // Update state

            if (dropIndicator === 'middle') targetElement.classList.add('drag-over-middle');
            else if (dropIndicator === 'top') targetElement.classList.add('drag-over-top');
            else if (dropIndicator === 'bottom') targetElement.classList.add('drag-over-bottom');
        }
    }

    function handleDragLeave(e) {
        const targetElement = e.target.closest('.module-item');
        if (!targetElement) return;

        // Check if the mouse truly left the element vs moving over a child
         const relatedTarget = e.relatedTarget ? e.relatedTarget.closest('.module-item') : null;

         // If leaving the current dragOverElement and not entering a child of it
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
        clearDropIndicators(); // Clear visual cues immediately

        if (!globalDraggedItem || !dragOverElement || globalDraggedItem === dragOverElement || !dropIndicator) {
            console.log("[SidebarManager] Drop cancelled: Invalid state.");
            handleDragEnd(); // Ensure cleanup
            return;
        }

        const draggedId = globalDraggedItem.dataset.moduleId;
        const targetId = dragOverElement.dataset.moduleId;

        // Find modules in our local 'modules' array
        const draggedModuleIndex = modules.findIndex(m => m.id === draggedId);
        const targetModuleIndex = modules.findIndex(m => m.id === targetId);

        if (draggedModuleIndex === -1 || targetModuleIndex === -1) {
            console.error("[SidebarManager] DnD Error: Dragged or target module not found in local modules array.");
            handleDragEnd();
            return;
        }

        const draggedModule = modules[draggedModuleIndex];
        const targetModule = modules[targetModuleIndex];

        let newParentId = null;
        let targetPositionInArray = -1; // Index where the dragged item should be inserted

        if (dropIndicator === 'middle' && targetModule.type === 'header') {
            // Dropping INTO a header
            newParentId = targetModule.id;
            // Find where to insert within the children (or just after header if no children)
             const children = modules.filter(m => m.parentId === newParentId);
             if (children.length > 0) {
                 // Find the index of the last child in the main array
                 const lastChild = children.sort((a,b) => (a.order ?? 0) - (b.order ?? 0)).pop();
                 const lastChildIndex = modules.findIndex(m => m.id === lastChild.id);
                 targetPositionInArray = lastChildIndex + 1;
             } else {
                 // Insert right after the header
                 targetPositionInArray = targetModuleIndex + 1;
             }

        } else if (dropIndicator === 'bottom') {
            // Dropping BELOW the target item (same parent)
            newParentId = targetModule.parentId;
            targetPositionInArray = targetModuleIndex + 1;
        } else { // dropIndicator === 'top'
            // Dropping ABOVE the target item (same parent)
            newParentId = targetModule.parentId;
            targetPositionInArray = targetModuleIndex;
        }

        console.log(`[SidebarManager] Drop: Moving ${draggedId} to parent ${newParentId} at index ${targetPositionInArray}`);

        // Update parentId
        draggedModule.parentId = newParentId;

        // Remove from old position
        modules.splice(draggedModuleIndex, 1);

        // Adjust target index if necessary after removal
        if (draggedModuleIndex < targetPositionInArray) {
            targetPositionInArray--;
        }

        // Insert into new position
        modules.splice(targetPositionInArray, 0, draggedModule);

        // Recalculate 'order' property for all modules
        recalculateModuleOrder();

        // Re-render the list with new structure
        renderModuleList(modules);

        // Save the new structure
        triggerSaveStructure();

        // Clean up D&D state
        handleDragEnd();
    }

    function handleDragEnd(e) {
        if (globalDraggedItem) {
            globalDraggedItem.classList.remove('dragging');
        }
        clearDropIndicators(); // Clear all indicators just in case
        globalDraggedItem = null;
        dragOverElement = null;
        dropIndicator = null;
        // console.log("[SidebarManager] DragEnd");
    }

    /**
     * Clears all visual drop indicators from sidebar items.
     * @param {HTMLElement} [element] - Optional specific element to clear indicators from.
     */
    function clearDropIndicators(element) {
        const selector = '.module-item.drag-over-top, .module-item.drag-over-bottom, .module-item.drag-over-middle';
        const elementsToClear = element ? [element] : document.querySelectorAll(selector);
        elementsToClear.forEach(el => {
            if (el) {
                el.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-middle');
            }
        });
    }

    /**
     * Recalculates the 'order' property for all modules based on their position
     * within their parent group in the 'modules' array.
     */
    function recalculateModuleOrder() {
        const modulesByParent = {};

        // Group modules by parentId
        modules.forEach(module => {
            const parentKey = module.parentId === null ? 'null' : module.parentId;
            if (!modulesByParent[parentKey]) {
                modulesByParent[parentKey] = [];
            }
            // Add based on current array order
            modulesByParent[parentKey].push(module);
        });

        // Assign order within each group
        Object.values(modulesByParent).forEach(group => {
            group.forEach((module, index) => {
                module.order = index;
            });
        });
         console.log("[SidebarManager] Module order recalculated.");
    }


    // --- Dropdown Menus & Actions ---

    /**
     * Sets up global click listener to close dropdowns.
     */
    function setupDropdownMenus() {
        // Use event delegation on the document to close dropdowns
        document.removeEventListener('click', handleGlobalClickForDropdowns); // Remove first
        document.addEventListener('click', handleGlobalClickForDropdowns);
        console.log("[SidebarManager] Dropdown menu global listener setup.");
    }

    /**
     * Closes dropdowns if a click occurs outside of them.
     * @param {Event} e - The click event.
     */
    function handleGlobalClickForDropdowns(e) {
        // If the click is not on an action icon and not inside an open dropdown
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
     * Handles editing a module's name (via prompt).
     * @param {HTMLElement} moduleElement - The sidebar element of the module being edited.
     */
    function editModule(moduleElement) {
        const moduleId = moduleElement?.dataset?.moduleId;
        if (!moduleId) {
            console.error("[SidebarManager] Edit Error: Could not get module ID from element.");
            alert("Error: Could not identify the module to edit.");
            return;
        }

        // Find the module in our local 'modules' array
        const moduleIndex = modules.findIndex(m => m.id === moduleId);
        if (moduleIndex === -1) {
            console.error("[SidebarManager] Edit Error: Module not found in local modules array:", moduleId);
            alert(`Error: Module "${moduleId}" not found.`);
            return;
        }

        const currentModule = modules[moduleIndex];
        const currentName = currentModule.name;
        const newName = prompt(`Edit module name:`, currentName);

        if (newName && newName.trim() !== '' && newName.trim() !== currentName) {
            const finalNewName = newName.trim();
            console.log(`[SidebarManager] Renaming module ${moduleId} to "${finalNewName}"`);
            currentModule.name = finalNewName; // Update local data

            // Update the displayed name directly
            const nameSpan = moduleElement.querySelector('.module-name');
            if (nameSpan) {
                nameSpan.textContent = finalNewName;
            } else {
                // Fallback to re-rendering if span not found (shouldn't happen)
                renderModuleList(modules);
            }

            // Save the updated structure
            triggerSaveStructure();
            alert(`Module renamed to "${finalNewName}"`);
        }
    }

    /**
     * Handles deleting a module (and its descendants).
     * @param {HTMLElement} moduleElement - The sidebar element of the module being deleted.
     */
    function deleteModule(moduleElement) {
        const moduleId = moduleElement?.dataset?.moduleId;

        // Prevent deleting the essential 'notes' module
        if (!moduleId || moduleId === 'notes') {
            if (moduleId === 'notes') alert('The Notes module cannot be deleted.');
            else alert("Error: Could not identify the module to delete.");
            return;
        }

        // Find the module in our local 'modules' array
        const moduleIndex = modules.findIndex(m => m.id === moduleId);
        if (moduleIndex === -1) {
            alert(`Error: Module "${moduleId}" not found.`);
            return;
        }

        const moduleToDelete = modules[moduleIndex];
        const moduleName = moduleToDelete.name;
        const isHeader = moduleToDelete.type === 'header';

        // Find direct children to warn user if deleting a header with children
        const directChildren = modules.filter(m => m.parentId === moduleId);

        let confirmMessage = `Are you sure you want to delete the "${moduleName}" module?`;
        if (isHeader && directChildren.length > 0) {
            confirmMessage += `\n\nWARNING: This is a header with ${directChildren.length} direct sub-module(s). Deleting it will also delete ALL descendants.`;
        }
        confirmMessage += `\n\nThis action cannot be undone.`;

        const confirmed = confirm(confirmMessage);

        if (confirmed) {
            console.log(`[SidebarManager] Deleting module ${moduleId} (${moduleName}) and descendants.`);

            // Find all IDs to delete (the module itself and all descendants)
            const idsToDelete = new Set([moduleId]);
            const queue = [moduleId]; // Start with the module to delete

            while (queue.length > 0) {
                const currentParentId = queue.shift();
                // Find children of the current parent
                modules.forEach(module => {
                    if (module.parentId === currentParentId && !idsToDelete.has(module.id)) {
                        idsToDelete.add(module.id);
                        queue.push(module.id); // Add child to the queue to find its descendants
                    }
                });
            }

            // Filter the local 'modules' array, keeping only those NOT in idsToDelete
            modules = modules.filter(module => !idsToDelete.has(module.id));

            console.log("[SidebarManager] Modules filtered. Remaining:", modules.length);

            // Recalculate order and re-render
            recalculateModuleOrder();
            renderModuleList(modules);

            // Save the modified structure
            triggerSaveStructure();

            alert(`Module "${moduleName}" ${idsToDelete.size > 1 ? 'and its descendants ' : ''}deleted successfully.`);
        }
    }


    // --- Initialization Function ---
    // This is the main function dashboard.js will call to start the sidebar
    function init(modulesData) {
        console.log("[SidebarManager] Initializing...");

        // Store the module data passed from the main script
        modules = modulesData; // Store the reference

        // Find the sidebar container element
        const container = document.getElementById('modules-container');
        if (!container) {
            console.error("[SidebarManager] Sidebar container #modules-container not found!");
            return;
        }

        // Initialize header collapse state based on loaded modules
        headerCollapseState = {}; // Reset first
         modules.forEach(module => {
             if (module.type === 'header') {
                 // Default to collapsed, unless state was somehow preserved (e.g., via sessionStorage - not implemented here)
                 if (headerCollapseState[module.id] === undefined) {
                     headerCollapseState[module.id] = true;
                 }
             }
         });

        // Call the actual setup functions
        renderModuleList(modules);      // Initial render
        setupModuleSearch();            // Setup search input
        setupDragAndDrop();             // Setup drag & drop listeners
        setupDropdownMenus();           // Setup global click listener for dropdowns
        // Collapse listeners are now added directly in createModuleElement

        console.log("[SidebarManager] Initialization complete.");
    }

    // --- Expose Public Interface ---
    // Make the 'init' function available for dashboard.js to call
    window.ConstructionApp.SidebarManager = {
        init: init,
        // Expose render function in case other parts need to trigger a re-render
        // (e.g., after module definitions are added/deleted if that logic moves elsewhere)
        renderModuleList: renderModuleList
    };

})(); // Immediately invoke the function to set everything up
