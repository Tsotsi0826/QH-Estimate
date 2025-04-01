/**
 * Module Grouping with Enhanced Drag and Drop
 * - Makes category module text green
 * - Indents child modules
 * - Allows any module to become a sub-module through drag and drop
 */

// Store parent-child relationships
let moduleRelationships = {
    // parentId: [childId1, childId2, ...] 
};

// Main parent categories
const mainCategories = [
    'foundations',
    'brickwork',
    'surfacebeds',
    'plaster', 
    'floor',
    'carpentry'
];

// Run when page loads
window.addEventListener('load', function() {
    console.log("Module grouping script running - v3.0");
    
    // Wait a moment for modules to load
    setTimeout(function() {
        // Initialize module relationships
        initializeRelationships();
        
        // Apply styling
        styleModules();
        
        // Enhance the drag and drop functionality
        enhanceDragAndDrop();
    }, 500);
});

// Initialize module relationships
function initializeRelationships() {
    // First try to load saved relationships
    const savedRelationships = sessionStorage.getItem('moduleRelationships');
    if (savedRelationships) {
        try {
            moduleRelationships = JSON.parse(savedRelationships);
            console.log("Loaded saved module relationships:", moduleRelationships);
            return;
        } catch (error) {
            console.error("Error loading saved relationships:", error);
        }
    }
    
    // If no saved relationships, detect them from module IDs
    console.log("No saved relationships found, auto-detecting...");
    moduleRelationships = {};
    
    // Initialize each main category as a parent
    mainCategories.forEach(category => {
        moduleRelationships[category] = [];
    });
    
    // Get all module elements
    const modules = document.querySelectorAll('.module-item');
    
    // Detect child modules based on ID patterns
    modules.forEach(function(module) {
        const moduleId = module.getAttribute('data-module-id');
        if (!moduleId) return;
        
        // Skip main categories (they can't be children)
        if (mainCategories.includes(moduleId)) return;
        
        // Check if this is a child module of a main category
        for (const category of mainCategories) {
            if (moduleId.startsWith(category + '-')) {
                // This module ID indicates it's a child (e.g., "foundations-concrete")
                moduleRelationships[category].push(moduleId);
                console.log(`Auto-detected ${moduleId} as child of ${category}`);
                break;
            }
        }
    });
    
    // Save the initial relationships
    saveModuleRelationships();
}

// Save relationships to storage
function saveModuleRelationships() {
    try {
        sessionStorage.setItem('moduleRelationships', JSON.stringify(moduleRelationships));
        console.log("Saved module relationships:", moduleRelationships);
    } catch (error) {
        console.error("Error saving module relationships:", error);
    }
}

// Find the parent of a module
function getParentModule(childId) {
    for (const parentId in moduleRelationships) {
        if (moduleRelationships[parentId].includes(childId)) {
            return parentId;
        }
    }
    return null;
}

// Apply styling based on relationships
function styleModules() {
    console.log("Applying module styling...");
    
    // Get all module items
    const modules = document.querySelectorAll('.module-item');
    console.log("Found " + modules.length + " modules");
    
    // Reset styling for all modules
    modules.forEach(function(module) {
        // Clear background color
        module.style.backgroundColor = '';
        // Reset padding
        module.style.paddingLeft = '';
        
        // Reset text color and weight
        const moduleText = module.querySelector('span');
        if (moduleText) {
            moduleText.style.color = '';
            moduleText.style.fontWeight = '';
        }
    });
    
    // Style parent modules
    for (const parentId in moduleRelationships) {
        const parentModule = document.querySelector(`.module-item[data-module-id="${parentId}"]`);
        if (parentModule) {
            const moduleText = parentModule.querySelector('span');
            if (moduleText) {
                moduleText.style.color = '#4eca8b';
                moduleText.style.fontWeight = 'bold';
            }
        }
    }
    
    // Style child modules
    modules.forEach(function(module) {
        const moduleId = module.getAttribute('data-module-id');
        if (!moduleId) return;
        
        // Check if this is a child module
        const parentId = getParentModule(moduleId);
        if (parentId) {
            // This is a child module - apply indentation
            module.style.paddingLeft = '40px';
        }
    });
    
    console.log("Module styling complete");
}

// Global reference for the module being dragged
let draggedModule = null;

// Enhance drag and drop functionality
function enhanceDragAndDrop() {
    // Add custom event listeners for drag operations
    const moduleItems = document.querySelectorAll('.module-item');
    
    moduleItems.forEach(function(module) {
        // ===== DRAG START =====
        module.addEventListener('dragstart', function(e) {
            console.log('Drag started', this.getAttribute('data-module-id'));
            
            // Store reference to dragged module
            draggedModule = this;
            
            // Add dragging class for styling
            setTimeout(() => {
                this.classList.add('dragging');
            }, 0);
            
            // Store module ID for Firefox
            e.dataTransfer.setData('text/plain', this.getAttribute('data-module-id'));
            e.dataTransfer.effectAllowed = 'move';
        });
        
        // ===== DRAG END =====
        module.addEventListener('dragend', function() {
            console.log('Drag ended');
            
            // Remove dragging class
            this.classList.remove('dragging');
            
            // Clear highlight from all modules
            document.querySelectorAll('.module-item').forEach(item => {
                item.style.borderTop = '';
                item.style.backgroundColor = '';
            });
            
            // Reset reference
            draggedModule = null;
        });
        
        // ===== DRAG OVER =====
        module.addEventListener('dragover', function(e) {
            // Required to allow drop
            e.preventDefault();
            
            // Skip if this is the module being dragged
            if (this === draggedModule) return;
            
            // Highlight drop zone
            this.style.borderTop = '2px solid #4eca8b';
        });
        
        // ===== DRAG LEAVE =====
        module.addEventListener('dragleave', function() {
            // Remove highlight
            this.style.borderTop = '';
        });
        
        // ===== DROP =====
        module.addEventListener('drop', function(e) {
            // Prevent default browser handling
            e.preventDefault();
            
            // Remove highlight
            this.style.borderTop = '';
            
            // Get dragged module ID
            const draggedId = e.dataTransfer.getData('text/plain') || 
                             draggedModule?.getAttribute('data-module-id');
            
            if (!draggedId) {
                console.log('Drop ignored - no dragged ID found');
                return;
            }
            
            // Get target module ID
            const targetId = this.getAttribute('data-module-id');
            
            // Skip if dropping onto self
            if (draggedId === targetId) {
                console.log('Drop ignored - same module');
                return;
            }
            
            console.log(`DROP: ${draggedId} onto ${targetId}`);
            
            // Handle the drop
            handleModuleDrop(draggedId, targetId);
        });
    });
    
    // Set up observer for dynamic modules
    setupObserver();
}

// Handle module drop - main logic for parent-child relationships
function handleModuleDrop(draggedId, targetId) {
    // Case 1: Dropping onto a parent module
    if (moduleRelationships.hasOwnProperty(targetId)) {
        console.log(`Adding ${draggedId} as child of ${targetId}`);
        
        // Add the dragged module as a child of the target
        addModuleAsChild(targetId, draggedId);
    }
    // Case 2: Dropping onto a child module
    else if (getParentModule(targetId)) {
        const targetParent = getParentModule(targetId);
        console.log(`Adding ${draggedId} as child of ${targetParent} (sibling of ${targetId})`);
        
        // Add the dragged module as a child of the same parent
        addModuleAsChild(targetParent, draggedId);
    }
    // Case 3: Dropping onto a regular module
    else {
        console.log(`Removing ${draggedId} from parent (if any)`);
        
        // If the dragged module is a child, remove it from its parent
        removeModuleFromParent(draggedId);
    }
    
    // Apply updated styling
    styleModules();
}

// Add a module as a child of a parent
function addModuleAsChild(parentId, childId) {
    // First remove from any existing parent
    removeModuleFromParent(childId);
    
    // Make sure parent exists in relationships
    if (!moduleRelationships[parentId]) {
        moduleRelationships[parentId] = [];
    }
    
    // Add child if not already present
    if (!moduleRelationships[parentId].includes(childId)) {
        moduleRelationships[parentId].push(childId);
    }
    
    // Save updated relationships
    saveModuleRelationships();
}

// Remove a module from its parent
function removeModuleFromParent(childId) {
    // Find current parent, if any
    for (const parentId in moduleRelationships) {
        const index = moduleRelationships[parentId].indexOf(childId);
        if (index !== -1) {
            // Remove from parent
            moduleRelationships[parentId].splice(index, 1);
            
            // Save updated relationships
            saveModuleRelationships();
            return true;
        }
    }
    return false;
}

// Make a module a parent
function makeModuleParent(moduleId) {
    // Only if not already a parent
    if (!moduleRelationships[moduleId]) {
        moduleRelationships[moduleId] = [];
        saveModuleRelationships();
        return true;
    }
    return false;
}

// Set up observer for dynamic module changes
function setupObserver() {
    const observer = new MutationObserver(function(mutations) {
        let modulesChanged = false;
        
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList') {
                // Check if modules were added or removed
                const addedModules = Array.from(mutation.addedNodes).filter(
                    node => node.nodeType === 1 && node.classList.contains('module-item')
                );
                
                const removedModules = Array.from(mutation.removedNodes).filter(
                    node => node.nodeType === 1 && node.classList.contains('module-item')
                );
                
                if (addedModules.length > 0 || removedModules.length > 0) {
                    modulesChanged = true;
                }
            }
        });
        
        if (modulesChanged) {
            console.log("Modules changed - updating relationships and styling");
            
            // Clean up relationships for removed modules
            cleanupRemovedModules();
            
            // Set up new modules
            const newModules = document.querySelectorAll('.module-item:not([data-grouping-initialized])');
            if (newModules.length > 0) {
                console.log(`Setting up ${newModules.length} new modules`);
                
                newModules.forEach(module => {
                    // Mark as initialized
                    module.setAttribute('data-grouping-initialized', 'true');
                    
                    // Add drag and drop handlers
                    setupModuleDragAndDrop(module);
                });
            }
            
            // Reapply styling
            styleModules();
        }
    });
    
    // Start observing the modules container
    const modulesContainer = document.getElementById('modules-container');
    if (modulesContainer) {
        observer.observe(modulesContainer, { childList: true, subtree: true });
        console.log("Module observer set up");
    }
}

// Set up drag and drop for a single module
function setupModuleDragAndDrop(module) {
    // DRAG START
    module.addEventListener('dragstart', function(e) {
        console.log('Drag started (new)', this.getAttribute('data-module-id'));
        draggedModule = this;
        setTimeout(() => this.classList.add('dragging'), 0);
        e.dataTransfer.setData('text/plain', this.getAttribute('data-module-id'));
        e.dataTransfer.effectAllowed = 'move';
    });
    
    // DRAG END
    module.addEventListener('dragend', function() {
        console.log('Drag ended (new)');
        this.classList.remove('dragging');
        document.querySelectorAll('.module-item').forEach(item => {
            item.style.borderTop = '';
            item.style.backgroundColor = '';
        });
        draggedModule = null;
    });
    
    // DRAG OVER
    module.addEventListener('dragover', function(e) {
        e.preventDefault();
        if (this !== draggedModule) {
            this.style.borderTop = '2px solid #4eca8b';
        }
    });
    
    // DRAG LEAVE
    module.addEventListener('dragleave', function() {
        this.style.borderTop = '';
    });
    
    // DROP
    module.addEventListener('drop', function(e) {
        e.preventDefault();
        this.style.borderTop = '';
        
        const draggedId = e.dataTransfer.getData('text/plain') || 
                         draggedModule?.getAttribute('data-module-id');
        
        if (!draggedId) return;
        
        const targetId = this.getAttribute('data-module-id');
        
        if (draggedId === targetId) return;
        
        console.log(`DROP (new): ${draggedId} onto ${targetId}`);
        
        handleModuleDrop(draggedId, targetId);
    });
}

// Clean up relationships for modules that no longer exist
function cleanupRemovedModules() {
    // Get all current module IDs
    const existingModuleIds = new Set();
    document.querySelectorAll('.module-item').forEach(function(module) {
        const id = module.getAttribute('data-module-id');
        if (id) existingModuleIds.add(id);
    });
    
    // Clean up parents that no longer exist
    for (const parentId in moduleRelationships) {
        if (!existingModuleIds.has(parentId)) {
            console.log(`Removing non-existent parent: ${parentId}`);
            delete moduleRelationships[parentId];
        }
    }
    
    // Clean up children that no longer exist
    for (const parentId in moduleRelationships) {
        const originalLength = moduleRelationships[parentId].length;
        moduleRelationships[parentId] = moduleRelationships[parentId].filter(
            childId => existingModuleIds.has(childId)
        );
        
        if (originalLength !== moduleRelationships[parentId].length) {
            console.log(`Removed ${originalLength - moduleRelationships[parentId].length} non-existent children from ${parentId}`);
        }
    }
    
    // Save cleaned up relationships
    saveModuleRelationships();
}

// Mark all existing modules as initialized
window.addEventListener('load', function() {
    setTimeout(function() {
        document.querySelectorAll('.module-item').forEach(module => {
            module.setAttribute('data-grouping-initialized', 'true');
        });
    }, 600);
});
