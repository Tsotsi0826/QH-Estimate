/**
 * Simple Module Grouping
 * 
 * Direct approach to style modules with immediately visible changes
 */

// Run immediately when loaded
(function() {
    console.log("SIMPLE MODULE GROUPING SCRIPT LOADED");
    
    // Apply styling immediately
    styleModules();
    
    // Also set up to run when DOM is loaded
    document.addEventListener('DOMContentLoaded', function() {
        console.log("DOM LOADED - STYLING MODULES");
        styleModules();
        
        // Also set up an interval to keep checking and applying styles
        setInterval(styleModules, 1000);
    });
    
    // If window is already loaded, apply styling now
    if (document.readyState === 'complete') {
        console.log("DOCUMENT ALREADY COMPLETE - STYLING MODULES");
        styleModules();
    }
})();

// Main function to style modules - very direct approach
function styleModules() {
    console.log("Applying module styling...");
    
    // Define foundation modules (hardcoded for reliability)
    const foundationModules = [
        "foundations-excavation",
        "foundations-concrete",
        "foundations-steel"
    ];
    
    // Find all modules in the sidebar
    const allModules = document.querySelectorAll('.module-item');
    console.log(`Found ${allModules.length} modules`);
    
    // First, create a clear header for Foundations if it doesn't exist
    if (!document.querySelector('.foundation-header') && allModules.length > 0) {
        const foundationsHeader = document.createElement('div');
        foundationsHeader.className = 'foundation-header';
        foundationsHeader.textContent = "FOUNDATIONS";
        foundationsHeader.style.padding = "10px 20px";
        foundationsHeader.style.fontWeight = "bold";
        foundationsHeader.style.backgroundColor = "#4eca8b";
        foundationsHeader.style.color = "white";
        foundationsHeader.style.margin = "5px 0";
        
        // Insert at the beginning of the module container
        const modulesContainer = document.getElementById('modules-container');
        if (modulesContainer) {
            modulesContainer.insertBefore(foundationsHeader, modulesContainer.firstChild);
            console.log("Added Foundations header");
        }
    }
    
    // Now style all foundation modules
    allModules.forEach(module => {
        const moduleId = module.getAttribute('data-module-id');
        
        // Style foundation modules
        if (foundationModules.includes(moduleId)) {
            // Add obvious styling
            module.style.paddingLeft = "40px";
            module.style.borderLeft = "3px solid #4eca8b";
            console.log(`Styled module: ${moduleId}`);
        }
    });
}
