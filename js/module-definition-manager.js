// js/module-definition-manager.js - Accept array for save/recalculate
(function() {
    'use strict';

    window.ConstructionApp = window.ConstructionApp || {};

    // --- Private Variables ---
    let modules = []; // Still holds the master list, updated by functions here

    // --- Private Functions (Moved or Internal Helpers) ---

    /**
     * Saves the provided module structure array to Firebase/backup.
     * @param {Array} modulesToSave - The array of module objects to save.
     */
    async function saveModuleStructure(modulesToSave) { // Accepts array argument
        console.log("[ModuleDefManager] Saving module structure");

        if (!Array.isArray(modulesToSave)) {
            console.error("[ModuleDefManager] Invalid array passed to saveModuleStructure.");
            return false;
        }

        // Update the internal master list *before* saving
        // This ensures subsequent calls to getModuleDefinitions have the latest
        modules = [...modulesToSave]; // Update internal array with a copy

        // Create simplified objects for saving
        const simplifiedModules = modules.map(module => ({
            id: module.id,
            name: module.name,
            requiresClient: module.requiresClient,
            type: module.type || 'regular',
            parentId: module.parentId,
            order: module.order ?? 0 // Ensure order is saved
        }));

        console.log("[ModuleDefManager] Modules prepared for saving:", simplifiedModules.length);

        let firebaseSuccess = false;
        // Save to Firebase
        if (window.ConstructionApp && window.ConstructionApp.Firebase) {
            try {
                // Pass the simplified array for saving
                firebaseSuccess = await window.ConstructionApp.Firebase.saveModules(simplifiedModules);
                if (firebaseSuccess) {
                    console.log("[ModuleDefManager] Module structure saved to Firebase.");
                } else {
                     console.warn("[ModuleDefManager] Firebase.saveModules reported failure.");
                }
            } catch (error) { /* ... error handling ... */ firebaseSuccess = false; }
        } else { console.warn("[ModuleDefManager] Firebase not available..."); }

        // Always try to save backup to sessionStorage
        try {
            sessionStorage.setItem('moduleOrder', JSON.stringify(simplifiedModules));
            console.log("[ModuleDefManager] Module structure backup saved to sessionStorage.");
        } catch (storageError) { /* ... error handling ... */ }

        return firebaseSuccess;
    }

    /** Gets the default set of modules. */
    function getDefaultModules() { /* ... same as before ... */ }

     /** Restores the module structure from sessionStorage backup. */
    function restoreModuleOrderFromBackup() { /* ... same as before ... */ }

    /** Triggers the SidebarManager to re-render its list. */
    function triggerSidebarRender() {
        setTimeout(() => {
            if (window.ConstructionApp.SidebarManager && typeof window.ConstructionApp.SidebarManager.renderModuleList === 'function') {
                console.log("[ModuleDefManager] Triggering sidebar re-render.");
                // Pass the current, updated internal 'modules' array
                window.ConstructionApp.SidebarManager.renderModuleList(modules);
            } else { /* ... warning ... */ }
        }, 0);
    }

    /**
     * Recalculates the 'order' property for modules within a given array,
     * grouped by parentId. Modifies the array in place.
     * @param {Array} moduleArray - The array of module objects to recalculate order for.
     */
    function recalculateModuleOrder(moduleArray) { // Accepts array argument
        if (!Array.isArray(moduleArray)) {
             console.error("[ModuleDefManager] Invalid array passed to recalculateModuleOrder.");
             return;
        }
        const modulesByParent = {};
        // Group modules by parentId based on the passed array's order
        moduleArray.forEach(module => {
            const parentKey = module.parentId === null ? 'null' : module.parentId;
            if (!modulesByParent[parentKey]) modulesByParent[parentKey] = [];
            modulesByParent[parentKey].push(module);
        });
        // Assign sequential order within each group *directly onto the passed array's objects*
        Object.values(modulesByParent).forEach(group => {
            group.forEach((module, index) => {
                module.order = index;
            });
        });
         console.log("[ModuleDefManager] Module order recalculated.");
         // Note: This modifies the array passed in by reference.
         // The internal 'modules' array is updated when saveModuleStructure is called.
    }


    // --- Public API Functions ---

    /** Loads module definitions... */
    async function loadModuleDefinitions() {
         // ... (Loading logic remains the same, eventually populating the internal 'modules' array) ...
         console.log("[ModuleDefManager] Loading modules structure");
         let loadedModules = []; let source = "Unknown";
         try {
            // ... try firebase ...
            loadedModules = await window.ConstructionApp.Firebase.loadModules();
            source = "Firebase";
            if (!Array.isArray(loadedModules) || loadedModules.length === 0) {
                // ... try backup ...
                loadedModules = restoreModuleOrderFromBackup() || [];
                source = loadedModules.length > 0 ? "Backup" : "Defaults";
                if (loadedModules.length === 0) {
                    loadedModules = getDefaultModules();
                    // Save defaults back (saveModuleStructure uses internal 'modules', so update it first)
                    modules = loadedModules; // Temporarily set internal modules
                    await saveModuleStructure(modules); // Pass the array
                }
            }
         } catch (error) {
             // ... try backup, then defaults ...
             loadedModules = restoreModuleOrderFromBackup() || [];
             source = loadedModules.length > 0 ? "Backup (after error)" : "Defaults (after error)";
             if (loadedModules.length === 0) {
                 loadedModules = getDefaultModules();
                 modules = loadedModules; // Temporarily set internal modules
                 try { await saveModuleStructure(modules); } catch(e){} // Pass the array
             }
         }
         // --- Process loaded modules ---
         // ... (notes handling, ensuring properties) ...
         const notesModuleIndex = loadedModules.findIndex(m => m.id === 'notes');
         let notesModuleData = notesModuleIndex > -1 ? loadedModules.splice(notesModuleIndex, 1)[0] : {};
         notesModuleData = { /* ... ensure notes properties ... */ };
         loadedModules.unshift(notesModuleData);
         // --- Store final list internally ---
         modules = loadedModules.map((mod, index) => ({ /* ... ensure properties ... */ }));
         recalculateModuleOrder(modules); // Recalculate on the final internal array
         modules.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
         console.log(`[ModuleDefManager] Module structure processed. Final count: ${modules.length}. Source: ${source}`);
         return modules; // Return the processed list
    }

    /** Adds a new module definition... */
    function addNewModuleDefinition(moduleInfo) {
         // ... (Validation logic remains the same) ...
         const moduleName = moduleInfo.name?.trim(); if (!moduleName) { alert("Module name is required."); return null; }
         const moduleId = moduleName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''); if (!moduleId) { alert("Could not generate valid ID."); return null; }
         if (modules.some(m => m.id === moduleId)) { alert(`Module ID "${moduleId}" already exists.`); return null; }
         const moduleType = moduleInfo.type || 'regular';
         const parentId = moduleType === 'header' ? null : (moduleInfo.parentId === 'null' ? null : moduleInfo.parentId);
         const requiresClient = moduleInfo.requiresClient !== undefined ? moduleInfo.requiresClient : true;
         let order = 0; const siblings = modules.filter(m => m.parentId === parentId); if (siblings.length > 0) order = Math.max(...siblings.map(m => m.order ?? -1)) + 1;
         const newModuleData = { /* ... create object ... */ };
         console.log("[ModuleDefManager] Adding new module:", newModuleData);
         // Add to the internal 'modules' array
         modules.push(newModuleData);
         // Recalculate order for the internal array
         recalculateModuleOrder(modules);
         modules.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
         // Save the updated internal array
         saveModuleStructure(modules); // Pass the array
         // Trigger sidebar re-render
         triggerSidebarRender();
         return newModuleData;
    }

     /** Edits an existing module definition... */
    function editModuleDefinition(moduleId, updatedInfo) {
         // ... (Validation logic remains the same) ...
         if (!moduleId || !updatedInfo || !updatedInfo.name) return false;
         const newName = updatedInfo.name.trim(); if (newName === '') { alert("Module name cannot be empty."); return false; }
         const moduleIndex = modules.findIndex(m => m.id === moduleId); if (moduleIndex === -1) { alert("Module to edit not found."); return false; }
         console.log(`[ModuleDefManager] Renaming module ${moduleId} to "${newName}"`);
         // Update the internal 'modules' array
         modules[moduleIndex].name = newName;
         // Save the updated internal array
         saveModuleStructure(modules); // Pass the array
         // Trigger sidebar re-render
         triggerSidebarRender();
         return true;
    }

    /** Deletes a module definition and its descendants... */
    function deleteModuleDefinition(moduleId) {
         // ... (Validation logic remains the same) ...
         if (!moduleId || moduleId === 'notes') { if (moduleId === 'notes') alert('Notes cannot be deleted.'); return false; }
         const moduleIndex = modules.findIndex(m => m.id === moduleId); if (moduleIndex === -1) { alert("Module to delete not found."); return false; }
         console.log(`[ModuleDefManager] Deleting module ${moduleId} and descendants.`);
         const idsToDelete = new Set([moduleId]); const queue = [moduleId];
         while (queue.length > 0) { /* ... find descendants in internal 'modules' ... */ }
         const initialLength = modules.length;
         // Update the internal 'modules' array
         modules = modules.filter(module => !idsToDelete.has(module.id));
         const deletedCount = initialLength - modules.length;
         if (deletedCount > 0) {
             console.log(`[ModuleDefManager] ${deletedCount} module(s) removed.`);
             // Recalculate order for the updated internal array
             recalculateModuleOrder(modules);
             // Save the updated internal array
             saveModuleStructure(modules); // Pass the array
             // Trigger sidebar re-render
             triggerSidebarRender();
             return true;
         } else { /* ... warning ... */ return false; }
    }

    /** Gets the current list of module definitions managed by this module. */
    function getModuleDefinitions() {
        // Return a copy to prevent accidental modification from outside
        return [...modules];
    }


    // --- Expose Public Interface ---
    window.ConstructionApp.ModuleDefinitionManager = {
        loadModuleDefinitions: loadModuleDefinitions,
        getModuleDefinitions: getModuleDefinitions,
        addNewModuleDefinition: addNewModuleDefinition,
        editModuleDefinition: editModuleDefinition,
        deleteModuleDefinition: deleteModuleDefinition,
        // Keep save/recalculate exposed if needed by Sidebar D&D directly
        saveModuleStructure: saveModuleStructure,
        recalculateModuleOrder: recalculateModuleOrder
    };

})();
