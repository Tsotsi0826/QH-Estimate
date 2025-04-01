/**
 * Simple Module Grouping
 * 
 * A very lightweight approach that just adds visual cues to organize modules:
 * - Category modules have green text
 * - Child modules are indented
 * - Preserves all original functionality
 */

// Initialize when DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log("[ModuleGrouping] Initializing simple module grouping");
    setTimeout(applyModuleStyling, 500); // Delay to ensure modules are loaded
});

// Main category modules
const categoryModules = [
    "foundations",
    "brickwork", 
    "surfacebeds",
    "plaster",
    "floor",
    "wall-covering",
    "carpentry",
    "joinery"
];

// Main function to apply styling
function applyModuleStyling() {
    console.log("[ModuleGrouping] Applying module styling");
    
    // Get all modules
    const allModules = document.querySelectorAll('.module-item');
    if (allModules.length === 0) {
        console.log("[ModuleGrouping] No modules found, will try again later");
        setTimeout(applyModuleStyling, 500);
        return;
    }
    
    // Apply styling to each module
    allModules.forEach(module => {
        const moduleId = module.getAttribute('data-module-id');
        const moduleSpan = module.querySelector('span');
        
        // Check if this is a category module
        if (categoryModules.includes(moduleId)) {
            // This is a category module - use green text
            if (moduleSpan) {
                moduleSpan.style.color = '#4eca8b';
                moduleSpan.style.fontWeight = 'bold';
            }
        } 
        // Check if this is a child module (e.g. foundations-concrete)
        else if (moduleId && categoryModules.some(category => moduleId.startsWith(category + '-'))) {
            // This is a child module - add indentation
            module.style.paddingLeft = '30px';
        }
    });
    
    console.log("[ModuleGrouping] Module styling complete");
    
    // Set up observer to handle changes
    setupObserver();
}

// Set up observer to watch for module changes
function setupObserver() {
    const observer = new MutationObserver(function(mutations) {
        let needsStyling = false;
        
        mutations.forEach(mutation => {
            if (mutation.type === 'childList' && 
                (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)) {
                needsStyling = true;
            }
        });
        
        if (needsStyling) {
            console.log("[ModuleGrouping] Module changes detected, reapplying styling");
            setTimeout(applyModuleStyling, 100);
        }
    });
    
    // Start observing the modules container
    const modulesContainer = document.getElementById('modules-container');
    if (modulesContainer) {
        observer.observe(modulesContainer, { childList: true, subtree: true });
    }
}
