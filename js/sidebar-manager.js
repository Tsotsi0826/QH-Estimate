// js/sidebar-manager.js - Debugging render loop
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
                ModuleDefManager.recalculateModuleOrder();
            } else { console.warn("[SidebarManager] Cannot recalculate order..."); }
            if (typeof ModuleDefManager.saveModuleStructure === 'function') {
                console.log("[SidebarManager] Triggering saveModuleStructure via ModuleDefinitionManager...");
                ModuleDefManager.saveModuleStructure();
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
     * Renders the hierarchical list of modules in the sidebar.
     * @param {Array} moduleData - The array of module objects to render.
     */
    function renderModuleList(moduleData) {
        const container = document.getElementById('modules-container');
        if (!container) {
            console.error("[SidebarManager] FAILED - #modules-container not found!");
            return;
        }
        if (!Array.isArray(moduleData)) {
             console.error("[SidebarManager] FAILED - moduleData is not an array!", moduleData);
             return;
        }

        modules = moduleData || [];
        container.innerHTML = ''; // Clear existing list
        console.log(`[SidebarManager] Rendering module list with ${modules.length} modules. Container cleared.`);

        const sortedModules = [...modules].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.name.localeCompare(b.name));

        // --- Recursive function to render levels ---
        function renderLevel(parentId, level) {
            // console.log(`DEBUG SidebarRenderLoop: renderLevel called for parentId: ${parentId}, level: ${level}`); // Can be noisy
            const children = sortedModules.filter(m => m.parentId === parentId);
            // console.log(`DEBUG SidebarRenderLoop: Found ${children.length} children for parentId: ${parentId}`);

            children.forEach((module, index) => {
                // ***** START DEBUG LOG *****
                console.log(`DEBUG SidebarRenderLoop: Processing child ${index + 1}/${children.length} - ID: ${module.id}, Name: ${module.name}, Level: ${level}`);
                // ***** END DEBUG LOG *****

                const moduleElement = createModuleElement(module, level);

                if (moduleElement) {
                    container.appendChild(moduleElement);
                    // ***** START DEBUG LOG *****
                    console.log(`DEBUG SidebarRenderLoop: Appended element for ${module.id}`);
                    // ***** END DEBUG LOG *****

                    const isHeader = module.type === 'header';
                    const isCollapsed = headerCollapseState[module.id] === true;
                    if (!isHeader || !isCollapsed) {
                        renderLevel(module.id, level + 1); // Recursive call for children
                    }
                } else {
                     // ***** START DEBUG LOG *****
                     console.error(`DEBUG SidebarRenderLoop: createModuleElement returned null for module ID: ${module.id}`);
                     // ***** END DEBUG LOG *****
                }
            });
        }
        // --- End recursive function ---

        renderLevel(null, 0); // Start rendering from top level
        console.log("[SidebarManager] Finished rendering loop.");
        setupDragAndDrop(); // Re-attach D&D listeners after re-rendering
    }

    /**
     * Creates a single module list item element for the sidebar.
     * @param {object} moduleData - The module object.
     * @param {number} level - The nesting level.
     * @returns {HTMLElement|null} The created div element or null if data is invalid.
     */
    function createModuleElement(moduleData, level = 0) {
        // ***** START DEBUG CHECK *****
        if (!moduleData || !moduleData.id || typeof moduleData.name === 'undefined') { // Check name existence specifically
             console.error("DEBUG createModuleElement: Invalid moduleData received:", moduleData);
             return null; // Don't create element for invalid data
        }
        // ***** END DEBUG CHECK *****

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

        // Create span for name safely using textContent
        const moduleNameSpan = document.createElement('span');
        moduleNameSpan.className = 'module-name';
        moduleNameSpan.textContent = moduleData.name; // Use textContent

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
        // Insert the text-based span
        const iconElement = moduleElement.querySelector('.module-icon');
        if (iconElement) iconElement.after(moduleNameSpan);
        else moduleElement.insertBefore(moduleNameSpan, moduleElement.querySelector('.config-icon'));


        // --- Attach Event Listeners ---
        const icon = moduleElement.querySelector('.module-icon');
        if (icon) { icon.addEventListener('click', (e) => { /* ... show/hide dropdown ... */ }); }
        const editBtn = moduleElement.querySelector('.edit-module');
        if (editBtn) { editBtn.addEventListener('click', (e) => { /* ... call ModuleDefManager.edit ... */ }); }
        const deleteBtn = moduleElement.querySelector('.delete-module');
        if (deleteBtn) { deleteBtn.addEventListener('click', (e) => { /* ... call ModuleDefManager.delete ... */ }); }
        if (moduleNameSpan && moduleData.type !== 'header') { moduleNameSpan.addEventListener('click', () => { triggerNavigation(moduleData.id); }); }
        if (moduleData.type === 'header') {
             const collapseTarget = moduleElement.querySelector('.collapse-icon') || moduleNameSpan || moduleElement;
             collapseTarget.addEventListener('click', (e) => { if (!e.target.closest('.module-icon') && !e.target.closest('.module-drag-handle')) { handleCollapseToggle(moduleData.id); } });
         }

        return moduleElement;
    }

    // --- Search ---
    function setupModuleSearch() { /* ... same as before ... */ }
    function handleSearchInput() { /* ... same as before ... */ }

    // --- Collapse / Expand ---
    function handleCollapseToggle(headerModuleId) { /* ... same as before ... */ }

    // --- Drag and Drop (Keep Debug Logs) ---
    function setupDragAndDrop() { /* ... same as before ... */ }
    function handleDragStart(e) { /* ... same as before ... */ }
    function handleDragOver(e) { /* ... same as before ... */ }
    function handleDragLeave(e) { /* ... same as before ... */ }
    function handleDrop(e) { /* ... same as before ... */ }
    function handleDragEnd(e) { /* ... same as before ... */ }
    function clearDropIndicators(element) { /* ... same as before ... */ }

    // --- Dropdown Menus & Actions (Keep Debug Logs + Escape Handler) ---
    function setupDropdownMenus() { /* ... same as before ... */ }
    function handleGlobalClickForDropdowns(e) { /* ... same as before ... */ }
    function handleEscapeKey(e) { /* ... same as before ... */ }
    function closeAllDropdowns() { /* ... same as before ... */ }


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
