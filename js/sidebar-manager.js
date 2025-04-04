// js/sidebar-manager.js - Restore D&D, Edit, Delete Logic + Keep Debug Logs
(function() {
    'use strict';

    window.ConstructionApp = window.ConstructionApp || {};

    // --- Private Variables ---
    let headerCollapseState = {};
    let globalDraggedItem = null;
    let dragOverElement = null;
    let dropIndicator = null;
    let modules = [];

    // --- Helper Functions ---
    function triggerSaveStructure() {
        const ModuleDefManager = window.ConstructionApp.ModuleDefinitionManager;
        if (ModuleDefManager) {
            // D&D already updated the local 'modules' array order.
            // Recalculate the .order property based on the new array order.
            if (typeof ModuleDefManager.recalculateModuleOrder === 'function') {
                ModuleDefManager.recalculateModuleOrder(); // Assumes this modifies the shared 'modules' array reference
            } else { console.warn("[SidebarManager] Cannot recalculate order: ModuleDefinitionManager.recalculateModuleOrder not found."); }

            // Ensure save function exists before calling
            if (typeof ModuleDefManager.saveModuleStructure === 'function') {
                console.log("[SidebarManager] Triggering saveModuleStructure via ModuleDefinitionManager...");
                ModuleDefManager.saveModuleStructure();
            } else { console.error("[SidebarManager] Cannot save structure: save function not found on ModuleDefinitionManager."); }
        } else { console.error("[SidebarManager] Cannot save structure: ModuleDefinitionManager not found."); }
    }
    function triggerNavigation(moduleId) {
         if (window.ConstructionApp.ModuleUtils && typeof window.ConstructionApp.ModuleUtils.navigateToModule === 'function') {
             window.ConstructionApp.ModuleUtils.navigateToModule(moduleId);
         } else { console.error("[SidebarManager] Cannot navigate: navigateToModule function not found on ModuleUtils."); }
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
        console.log(`[SidebarManager] Rendering module list with ${modules.length} modules.`); // Added log

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
        console.log("[SidebarManager] Finished rendering loop."); // Added log
        setupDragAndDrop(); // Re-attach D&D listeners after re-rendering
    }

    /**
     * Creates a single module list item element for the sidebar.
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
             editBtn.addEventListener('click', (e) => {
                console.log(`DEBUG ActionClick: Edit clicked for ${moduleData.id}`);
                e.stopPropagation();
                closeAllDropdowns(); // Try closing first
                const moduleId = moduleElement.dataset.moduleId;
                const currentModule = modules.find(m => m.id === moduleId);
                if (!currentModule) { alert("Error: Cannot find module data to edit."); return; }
                const currentName = currentModule.name;
                const newName = prompt(`Edit module name:`, currentName); // Still using prompt
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
             deleteBtn.addEventListener('click', (e) => {
                console.log(`DEBUG ActionClick: Delete clicked for ${moduleData.id}`);
                e.stopPropagation();
                closeAllDropdowns(); // Try closing first
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
             moduleNameSpan.addEventListener('click', () => {
                 console.log(`DEBUG ActionClick: Name clicked for ${moduleData.id}`);
                 triggerNavigation(moduleData.id);
             });
        }

        if (moduleData.type === 'header') {
             const collapseTarget = moduleElement.querySelector('.collapse-icon') || moduleNameSpan || moduleElement;
             if (collapseTarget) {
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

    // --- Search ---
    function setupModuleSearch() {
        const searchInput = document.getElementById('module-search-input');
        const container = document.getElementById('modules-container');
        if (!searchInput || !container) { /* ... error ... */ return; }
        let debounceTimer;
        const debounceFilter = (func, delay) => { /* ... debounce ... */ return func; }; // Simplified
         searchInput.removeEventListener('input', handleSearchInput); // Remove previous listener first
         searchInput.addEventListener('input', handleSearchInput);
        console.log("[SidebarManager] Module search setup complete.");
    }
    function handleSearchInput() {
        const searchInput = document.getElementById('module-search-input'); // Re-find inside handler
        const container = document.getElementById('modules-container');
        if (!searchInput || !container) return;
        debounceFilter(() => { /* ... filter logic ... */ }, 250); // Apply debounce here
    }


    // --- Collapse / Expand ---
    function handleCollapseToggle(headerModuleId) {
        console.log("[SidebarManager] Toggling collapse for header:", headerModuleId);
        headerCollapseState[headerModuleId] = !(headerCollapseState[headerModuleId] === true);
        renderModuleList(modules); // Re-render the list
    }


    // --- Drag and Drop (Restored Logic + Debug Logs) ---
    function setupDragAndDrop() {
        const container = document.getElementById('modules-container');
        if (!container) return;
        container.removeEventListener('dragstart', handleDragStart);
        container.removeEventListener('dragover', handleDragOver);
        container.removeEventListener('dragleave', handleDragLeave);
        container.removeEventListener('drop', handleDrop);
        container.addEventListener('dragstart', handleDragStart);
        container.addEventListener('dragover', handleDragOver);
        container.addEventListener('dragleave', handleDragLeave);
        container.addEventListener('drop', handleDrop);
        document.removeEventListener('dragend', handleDragEnd); // Use document for dragend
        document.addEventListener('dragend', handleDragEnd);
        console.log("[SidebarManager] Drag and drop listeners setup.");
    }
    function handleDragStart(e) {
        console.log("DEBUG DND: handleDragStart Fired"); // Keep Log
        const handle = e.target.closest('.module-drag-handle');
        const target = e.target.closest('.module-item');
        if (!target || !target.draggable || (handle && e.target !== handle && !target.contains(e.target))) {
             console.log("DEBUG DND: DragStart prevented (invalid target or not handle)");
             e.preventDefault(); return;
        }
        globalDraggedItem = target;
        try {
             e.dataTransfer.setData('text/plain', target.dataset.moduleId);
             e.dataTransfer.effectAllowed = 'move';
        } catch (err) { console.error("DEBUG DND: Error setting dataTransfer:", err); }
        setTimeout(() => { if (globalDraggedItem) globalDraggedItem.classList.add('dragging'); }, 0);
        console.log("DEBUG DND: DragStart:", target.dataset.moduleId);
    }
    function handleDragOver(e) {
        // console.log("DEBUG DND: handleDragOver Fired"); // Still too noisy
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const targetElement = e.target.closest('.module-item');
        if (!targetElement || targetElement === globalDraggedItem) {
            if (dragOverElement && (!targetElement || targetElement !== dragOverElement)) {
                 clearDropIndicators(); dragOverElement = null; dropIndicator = null;
            } return;
        }
        if (targetElement !== dragOverElement) { clearDropIndicators(); dragOverElement = targetElement; }
        const rect = targetElement.getBoundingClientRect();
        const yOffset = e.clientY - rect.top;
        const dropZoneHeight = rect.height;
        const targetIsHeader = targetElement.dataset.moduleType === 'header';
        const draggedItemType = globalDraggedItem?.dataset?.moduleType;
        const canDropOnHeaderMiddle = targetIsHeader && draggedItemType !== 'header';
        const topThreshold = dropZoneHeight * 0.3;
        const bottomThreshold = dropZoneHeight * 0.7;
        let currentIndicator = null;
        if (canDropOnHeaderMiddle && yOffset > topThreshold && yOffset < bottomThreshold) currentIndicator = 'middle';
        else if (yOffset <= topThreshold) currentIndicator = 'top';
        else currentIndicator = 'bottom';
        if (currentIndicator !== dropIndicator) {
            targetElement.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-middle');
            dropIndicator = currentIndicator;
            if (dropIndicator === 'middle') targetElement.classList.add('drag-over-middle');
            else if (dropIndicator === 'top') targetElement.classList.add('drag-over-top');
            else if (dropIndicator === 'bottom') targetElement.classList.add('drag-over-bottom');
        }
    }
    function handleDragLeave(e) {
        // console.log("DEBUG DND: handleDragLeave Fired");
        const targetElement = e.target.closest('.module-item');
        if (!targetElement) return;
        const relatedTarget = e.relatedTarget ? e.relatedTarget.closest('.module-item') : null;
        if (targetElement === dragOverElement && relatedTarget !== dragOverElement && !targetElement.contains(e.relatedTarget)) {
            clearDropIndicators(targetElement); dragOverElement = null; dropIndicator = null;
        }
    }
    function handleDrop(e) {
        console.log("DEBUG DND: handleDrop Fired"); // Keep Log
        e.preventDefault();
        if (!globalDraggedItem || !dragOverElement || !dropIndicator) {
             console.log("DEBUG DND: Drop cancelled: Invalid state.");
             clearDropIndicators(); handleDragEnd(); return;
        }
        clearDropIndicators();

        const draggedId = globalDraggedItem.dataset.moduleId;
        const targetId = dragOverElement.dataset.moduleId;
        const draggedModuleIndex = modules.findIndex(m => m.id === draggedId);
        const targetModuleIndex = modules.findIndex(m => m.id === targetId);
        if (draggedModuleIndex === -1 || targetModuleIndex === -1) {
            console.error("DEBUG DND: Drop Error: Dragged or target module not found."); handleDragEnd(); return;
        }
        const draggedModule = modules[draggedModuleIndex];
        const targetModule = modules[targetModuleIndex];
        let newParentId = null;
        let targetPositionInArray = -1;
        // --- Determine new parent and position --- RESTORED
        if (dropIndicator === 'middle' && targetModule.type === 'header') {
            newParentId = targetModule.id;
            const children = modules.filter(m => m.parentId === newParentId);
            if (children.length > 0) {
                const lastChild = children.sort((a,b) => (a.order ?? 0) - (b.order ?? 0)).pop();
                const lastChildIndex = modules.findIndex(m => m.id === lastChild.id);
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
        // --- End determination ---
        console.log(`DEBUG DND: Drop - Moving ${draggedId} to parent ${newParentId} at index ${targetPositionInArray}`);

        // --- Update local 'modules' array directly --- RESTORED
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
    function handleDragEnd(e) {
        console.log("DEBUG DND: handleDragEnd Fired"); // Keep Log
        try { if (globalDraggedItem) { globalDraggedItem.classList.remove('dragging'); } }
        catch (error) { /* ... */ }
        clearDropIndicators();
        globalDraggedItem = null;
        dragOverElement = null;
        dropIndicator = null;
    }
    function clearDropIndicators(element) { /* ... same ... */ }


    // --- Dropdown Menus & Actions (Keep Debug Logs + Escape Handler) ---
    function setupDropdownMenus() {
        document.removeEventListener('click', handleGlobalClickForDropdowns);
        document.addEventListener('click', handleGlobalClickForDropdowns);
        document.removeEventListener('keydown', handleEscapeKey);
        document.addEventListener('keydown', handleEscapeKey);
        console.log("[SidebarManager] Dropdown menu listeners setup (Click & Escape).");
    }
    function handleGlobalClickForDropdowns(e) {
        console.log("DEBUG Dropdown: Global click detected."); // Keep Log
        if (!e.target.closest('.module-icon') && !e.target.closest('.dropdown-menu')) {
            console.log("DEBUG Dropdown: Click was outside, closing menus."); // Keep Log
            closeAllDropdowns();
        } else {
            console.log("DEBUG Dropdown: Click was inside icon or menu, not closing."); // Keep Log
        }
    }
    function handleEscapeKey(e) {
        if (e.key === 'Escape') {
            console.log("DEBUG Dropdown: Escape key pressed, closing menus."); // Keep Log
            closeAllDropdowns();
        }
    }
    function closeAllDropdowns() {
        const menus = document.querySelectorAll('#modules-container .dropdown-menu');
        let closedAny = false;
        menus.forEach(menu => { if (menu.style.display === 'block') { menu.style.display = 'none'; closedAny = true; } });
        if (closedAny) console.log("DEBUG Dropdown: closeAllDropdowns executed and closed at least one menu."); // Keep Log
        // else console.log("DEBUG Dropdown: closeAllDropdowns executed, no menus were open."); // Maybe remove this one
    }


    // --- Initialization Function ---
    function init(modulesData) {
        console.log("[SidebarManager] Initializing...");
        modules = modulesData || [];
        const container = document.getElementById('modules-container');
        if (!container) { console.error("[SidebarManager] Init FAILED - #modules-container not found!"); return; }
        headerCollapseState = {};
         modules.forEach(module => { if (module.type === 'header') { if (headerCollapseState[module.id] === undefined) headerCollapseState[module.id] = true; } });
        renderModuleList(modules);
        setupModuleSearch();
        setupDropdownMenus();
        console.log("[SidebarManager] Initialization complete.");
    }

    // --- Expose Public Interface ---
    window.ConstructionApp.SidebarManager = {
        init: init,
        renderModuleList: renderModuleList
    };

})();
