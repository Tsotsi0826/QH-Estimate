// js/module-definition-manager.js
(function() {
    'use strict';

    // Ensure the main app namespace exists
    window.ConstructionApp = window.ConstructionApp || {};

    // --- Private Variables ---
    let modules = []; // Holds the master list of module definitions managed by this file

    // --- Private Functions (Moved or Internal Helpers) ---

    /**
     * Saves the current module structure (from the local 'modules' array)
     * to Firebase and sessionStorage backup.
     * (Code to be moved from dashboard.js)
     */
    async function saveModuleStructure() {
        console.warn("[ModuleDefManager] saveModuleStructure needs to be moved/implemented here.");
        // --- Placeholder ---
        console.log("[ModuleDefManager] Pretending to save structure for", modules.length, "modules.");
        // Actual logic will involve:
        // 1. Mapping 'modules' array to simplified objects for saving.
        // 2. Calling window.ConstructionApp.Firebase.saveModules(...).
        // 3. Saving backup to sessionStorage.
        return Promise.resolve(); // Placeholder return
    }

    /**
     * Gets the default set of modules.
     * (Code to be moved from dashboard.js)
     * @returns {Array} Default module definitions.
     */
    function getDefaultModules() {
        console.warn("[ModuleDefManager] getDefaultModules needs to be moved/implemented here.");
        // --- Placeholder ---
        return [
             { id: 'notes', name: 'Notes', requiresClient: true, type: 'regular', parentId: null, order: 0 },
             // ... other defaults
        ];
    }

     /**
      * Restores the module structure from sessionStorage backup.
      * (Code to be moved from dashboard.js)
      * @returns {Array|null} The restored module array or null.
      */
    function restoreModuleOrderFromBackup() {
        console.warn("[ModuleDefManager] restoreModuleOrderFromBackup needs to be moved/implemented here.");
        // --- Placeholder ---
        return null;
    }

    /**
     * Triggers the SidebarManager to re-render its list.
     */
    function triggerSidebarRender() {
        if (window.ConstructionApp.SidebarManager && typeof window.ConstructionApp.SidebarManager.renderModuleList === 'function') {
            console.log("[ModuleDefManager] Triggering sidebar re-render.");
            // Pass the current, updated 'modules' array from this manager
            window.ConstructionApp.SidebarManager.renderModuleList(modules);
        } else {
            console.warn("[ModuleDefManager] SidebarManager.renderModuleList not found. Cannot trigger re-render.");
        }
    }


    // --- Public API Functions ---

    /**
     * Loads module definitions from Firebase/backup/defaults, processes them,
     * stores them in the local 'modules' array, and returns them.
     * (Code to be moved from dashboard.js's loadAndRenderModules)
     * @returns {Promise<Array>} A promise that resolves with the loaded module definitions array.
     */
    async function loadModuleDefinitions() {
        console.warn("[ModuleDefManager] loadModuleDefinitions needs to be moved/implemented here.");
        // --- Placeholder ---
        // Actual logic will:
        // 1. Try Firebase.loadModules.
        // 2. If failed/empty, try restoreModuleOrderFromBackup.
        // 3. If failed/empty, use getDefaultModules and save them back.
        // 4. Process the loaded modules (handle 'notes', ensure properties, sort).
        // 5. Store the final list in the local 'modules' variable.
        modules = getDefaultModules(); // Use defaults as placeholder
        console.log("[ModuleDefManager] Loaded placeholder default modules.");
        return modules; // Return the loaded modules
    }

    /**
     * Adds a new module definition based on input info.
     * (Logic to be moved from dashboard.js's addNewModule)
     * @param {object} moduleInfo - Object containing name, type, parentId, requiresClient.
     * @returns {object|null} The newly created module object or null if failed.
     */
    function addNewModuleDefinition(moduleInfo) {
         console.warn("[ModuleDefManager] addNewModuleDefinition needs to be moved/implemented here.");
         // --- Placeholder ---
         // Actual logic will:
         // 1. Validate moduleInfo (name etc.).
         // 2. Generate ID, check for duplicates in 'modules' array.
         // 3. Calculate order based on siblings in 'modules' array.
         // 4. Create the full module object.
         // 5. Push to local 'modules' array.
         // 6. Call saveModuleStructure().
         // 7. Call triggerSidebarRender().
         // 8. Return the new module object (or null/throw error on failure).
         console.log("[ModuleDefManager] Pretending to add module:", moduleInfo.name);
         // Example placeholder addition:
         const tempId = moduleInfo.name.toLowerCase().replace(/\s+/g, '-');
         if (!modules.some(m => m.id === tempId)) {
            const newMod = { ...moduleInfo, id: tempId, order: modules.length };
            modules.push(newMod);
            saveModuleStructure();
            triggerSidebarRender();
            return newMod;
         }
         return null;
    }

     /**
      * Edits an existing module definition (e.g., renames).
      * (Logic to be moved from sidebar-manager.js's editModule)
      * @param {string} moduleId - The ID of the module to edit.
      * @param {object} updatedInfo - Object with properties to update (e.g., { name: "New Name" }).
      * @returns {boolean} True if successful, false otherwise.
      */
    function editModuleDefinition(moduleId, updatedInfo) {
         console.warn("[ModuleDefManager] editModuleDefinition needs to be moved/implemented here.");
         // --- Placeholder ---
         // Actual logic will:
         // 1. Find module by moduleId in local 'modules' array.
         // 2. If found, update its properties (e.g., module.name = updatedInfo.name).
         // 3. Call saveModuleStructure().
         // 4. Call triggerSidebarRender() (or rely on direct DOM update in sidebar if only name changes).
         // 5. Return true/false.
         const moduleIndex = modules.findIndex(m => m.id === moduleId);
         if (moduleIndex > -1 && updatedInfo.name) {
             console.log(`[ModuleDefManager] Pretending to rename ${moduleId} to ${updatedInfo.name}`);
             modules[moduleIndex].name = updatedInfo.name;
             saveModuleStructure();
             triggerSidebarRender(); // Re-render sidebar to show new name
             return true;
         }
         return false;
    }

    /**
     * Deletes a module definition and its descendants.
     * (Logic to be moved from sidebar-manager.js's deleteModule)
     * @param {string} moduleId - The ID of the module to delete.
     * @returns {boolean} True if successful, false otherwise.
     */
    function deleteModuleDefinition(moduleId) {
         console.warn("[ModuleDefManager] deleteModuleDefinition needs to be moved/implemented here.");
         // --- Placeholder ---
         // Actual logic will:
         // 1. Find module by moduleId. Check if it's 'notes'.
         // 2. Find all descendant IDs.
         // 3. Filter the local 'modules' array to remove them.
         // 4. Call saveModuleStructure().
         // 5. Call triggerSidebarRender().
         // 6. Return true/false.
         if (moduleId === 'notes') return false;
         const initialLength = modules.length;
         const idsToDelete = new Set([moduleId]);
         const queue = [moduleId];
         while (queue.length > 0) { /* Find descendants */ } // Simplified
         modules = modules.filter(m => !idsToDelete.has(m.id));
         if (modules.length < initialLength) {
             console.log(`[ModuleDefManager] Pretending to delete ${moduleId} and descendants.`);
             saveModuleStructure();
             triggerSidebarRender();
             return true;
         }
         return false;
    }

    /**
     * Gets the current list of module definitions managed by this module.
     * @returns {Array} The array of module definitions.
     */
    function getModuleDefinitions() {
        // Return a copy to prevent accidental modification from outside?
        // For now, return direct reference.
        return modules;
    }


    // --- Expose Public Interface ---
    window.ConstructionApp.ModuleDefinitionManager = {
        loadModuleDefinitions: loadModuleDefinitions,
        getModuleDefinitions: getModuleDefinitions,
        addNewModuleDefinition: addNewModuleDefinition,
        editModuleDefinition: editModuleDefinition,
        deleteModuleDefinition: deleteModuleDefinition,
        // Expose save function ONLY if it needs to be called externally (e.g., by D&D)
        // If D&D logic moves here too, save can become internal. For now, expose it.
        saveModuleStructure: saveModuleStructure
    };

})();
