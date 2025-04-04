// js/sidebar-manager.js - Debugging D&D and Dropdown issues
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
    function triggerSaveStructure() { /* ... same as before ... */ }
    function triggerNavigation(moduleId) { /* ... same as before ... */ }

    // --- Sidebar Rendering ---
    function renderModuleList(moduleData) { /* ... same as before ... */ }
    function createModuleElement(moduleData, level = 0) { /* ... same as before ... */ }

    // --- Search ---
    function setupModuleSearch() { /* ... same as before ... */ }

    // --- Collapse / Expand ---
    function handleCollapseToggle(headerModuleId) { /* ... same as before ... */ }

    // --- Drag and Drop ---

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
        console.log("DEBUG DND: handleDragStart Fired"); // <-- DND Log
        const handle = e.target.closest('.module-drag-handle');
        const target = e.target.closest('.module-item');
        if (!target || !target.draggable || (handle && e.target !== handle && !target.contains(e.target))) {
             console.log("DEBUG DND: DragStart prevented (invalid target or not handle)"); // <-- DND Log
             e.preventDefault(); return;
        }
        globalDraggedItem = target;
        try {
             e.dataTransfer.setData('text/plain', target.dataset.moduleId);
             e.dataTransfer.effectAllowed = 'move';
        } catch (err) {
             console.error("DEBUG DND: Error setting dataTransfer:", err); // <-- DND Log
        }
        setTimeout(() => { if (globalDraggedItem) globalDraggedItem.classList.add('dragging'); }, 0);
        console.log("DEBUG DND: DragStart:", target.dataset.moduleId); // <-- DND Log
    }

    function handleDragOver(e) {
        // console.log("DEBUG DND: handleDragOver Fired"); // <-- DND Log (Can be very noisy)
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const targetElement = e.target.closest('.module-item');
        if (!targetElement || targetElement === globalDraggedItem) {
            // Only clear if over a different element or outside valid targets
            if (dragOverElement && (!targetElement || targetElement !== dragOverElement)) {
                 clearDropIndicators();
                 dragOverElement = null;
                 dropIndicator = null;
            }
            return;
        }
        if (targetElement !== dragOverElement) {
            clearDropIndicators(); dragOverElement = targetElement;
        }
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
        // console.log("DEBUG DND: handleDragLeave Fired"); // <-- DND Log (Can be noisy)
        const targetElement = e.target.closest('.module-item');
        if (!targetElement) return;
        const relatedTarget = e.relatedTarget ? e.relatedTarget.closest('.module-item') : null;
        if (targetElement === dragOverElement && relatedTarget !== dragOverElement && !targetElement.contains(e.relatedTarget)) {
            clearDropIndicators(targetElement); dragOverElement = null; dropIndicator = null;
        }
    }

    function handleDrop(e) {
        console.log("DEBUG DND: handleDrop Fired"); // <-- DND Log
        e.preventDefault();
        if (!globalDraggedItem || !dragOverElement || globalDraggedItem === dragOverElement || !dropIndicator) {
            console.log("DEBUG DND: Drop cancelled: Invalid state.");
            clearDropIndicators(); handleDragEnd(); return;
        }
        clearDropIndicators(); // Clear visual cues immediately

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
        if (dropIndicator === 'middle' && targetModule.type === 'header') { /* ... */ newParentId = targetId; /* ... */ }
        else if (dropIndicator === 'bottom') { /* ... */ newParentId = targetModule.parentId; targetPositionInArray = targetModuleIndex + 1; }
        else { /* dropIndicator === 'top' */ /* ... */ newParentId = targetModule.parentId; targetPositionInArray = targetModuleIndex; }

        console.log(`DEBUG DND: Drop - Moving ${draggedId} to parent ${newParentId} at index ${targetPositionInArray}`);

        // Update local 'modules' array
        draggedModule.parentId = newParentId;
        modules.splice(draggedModuleIndex, 1);
        if (draggedModuleIndex < targetPositionInArray) targetPositionInArray--;
        modules.splice(targetPositionInArray, 0, draggedModule);

        renderModuleList(modules); // Re-render sidebar
        triggerSaveStructure(); // Trigger save
        console.log("[SidebarManager] Triggering dashboard render after drop.");
        const currentClient = window.ConstructionApp.ClientManager?.getCurrentClient();
        window.ConstructionApp.DashboardRenderer?.render(currentClient); // Trigger dashboard render
        handleDragEnd();
    }

    function handleDragEnd(e) {
        console.log("DEBUG DND: handleDragEnd Fired"); // <-- DND Log
        try { if (globalDraggedItem) { globalDraggedItem.classList.remove('dragging'); } }
        catch (error) { console.warn("[SidebarManager] Error removing dragging class on dragend:", error); }
        clearDropIndicators();
        globalDraggedItem = null;
        dragOverElement = null;
        dropIndicator = null;
    }

    function clearDropIndicators(element) { /* ... same as before ... */ }


    // --- Dropdown Menus & Actions ---

    function setupDropdownMenus() {
        document.removeEventListener('click', handleGlobalClickForDropdowns);
        document.addEventListener('click', handleGlobalClickForDropdowns);
        // Add Escape key listener
        document.removeEventListener('keydown', handleEscapeKey);
        document.addEventListener('keydown', handleEscapeKey);
        console.log("[SidebarManager] Dropdown menu listeners setup (Click & Escape).");
    }

    /**
     * Closes dropdowns if a click occurs outside of them.
     * @param {Event} e - The click event.
     */
    function handleGlobalClickForDropdowns(e) {
        console.log("DEBUG Dropdown: Global click detected."); // <-- Dropdown Log
        // If the click is not on an action icon trigger AND not inside an open dropdown menu
        if (!e.target.closest('.module-icon') && !e.target.closest('.dropdown-menu')) {
            console.log("DEBUG Dropdown: Click was outside, closing menus."); // <-- Dropdown Log
            closeAllDropdowns();
        } else {
            console.log("DEBUG Dropdown: Click was inside icon or menu, not closing."); // <-- Dropdown Log
        }
    }

    /**
     * Closes dropdowns if the Escape key is pressed.
     * @param {KeyboardEvent} e - The keydown event.
     */
    function handleEscapeKey(e) {
        if (e.key === 'Escape') {
            console.log("DEBUG Dropdown: Escape key pressed, closing menus."); // <-- Dropdown Log
            closeAllDropdowns();
        }
    }

    /**
     * Closes all open dropdown menus in the sidebar.
     */
    function closeAllDropdowns() {
        const menus = document.querySelectorAll('#modules-container .dropdown-menu');
        let closedAny = false;
        menus.forEach(menu => {
            if (menu.style.display === 'block') {
                menu.style.display = 'none';
                closedAny = true;
            }
        });
        if (closedAny) {
             console.log("DEBUG Dropdown: closeAllDropdowns executed and closed at least one menu."); // <-- Dropdown Log
        }
    }


    // --- Initialization Function ---
    function init(modulesData) {
        console.log("[SidebarManager] Initializing...");
        modules = modulesData || [];
        const container = document.getElementById('modules-container');
        if (!container) { /* ... error ... */ return; }
        headerCollapseState = {};
         modules.forEach(module => { if (module.type === 'header') { if (headerCollapseState[module.id] === undefined) headerCollapseState[module.id] = true; } });
        renderModuleList(modules);
        setupModuleSearch();
        // setupDragAndDrop(); // Called after renderModuleList now
        setupDropdownMenus(); // Setup click outside and Escape key listeners
        console.log("[SidebarManager] Initialization complete.");
    }

    // --- Expose Public Interface ---
    window.ConstructionApp.SidebarManager = {
        init: init,
        renderModuleList: renderModuleList
    };

})();
