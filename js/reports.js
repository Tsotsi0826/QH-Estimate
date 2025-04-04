// js/reports.js - Logic for the independent reports page

// --- DOMContentLoaded Listener ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("[Reports] DOM loaded. Initializing reports page.");
    initReportsPage();
});

// --- Global Variables (for this page) ---
let allClients = []; // To store loaded client list
let allModules = []; // To store loaded module definitions
let selectedClientId = null; // Currently selected client ID

// --- Initialization ---

/**
 * Initializes the reports page: fetches data, sets up listeners.
 */
async function initReportsPage() {
    // Get references to key elements
    const clientSelect = document.getElementById('client-select');
    const moduleSelect = document.getElementById('module-select');
    const generateBtn = document.getElementById('generate-report-btn');
    const reportOutput = document.getElementById('report-output');

    if (!clientSelect || !moduleSelect || !generateBtn || !reportOutput) {
        console.error("[Reports] Critical error: One or more UI elements not found.");
        reportOutput.innerHTML = '<p class="status-message error">Error initializing page elements. Please check console.</p>';
        return;
    }

    // Setup event listeners
    clientSelect.addEventListener('change', handleClientSelectionChange);
    generateBtn.addEventListener('click', generateReport);

    // Load initial data
    reportOutput.innerHTML = '<p class="status-message">Loading initial data...</p>';
    try {
        // Load clients first
        await loadClients();
        // Then load module definitions
        await loadModules();
        reportOutput.innerHTML = '<p class="status-message">Please select a client and report scope.</p>';
    } catch (error) {
        console.error("[Reports] Error during initial data load:", error);
        reportOutput.innerHTML = `<p class="status-message error">Error loading initial data: ${error.message}. Please refresh.</p>`;
    }
}

// --- Data Loading Functions ---

/**
 * Loads the list of clients from Firebase and populates the client dropdown.
 */
async function loadClients() {
    console.log("[Reports] Loading clients...");
    const clientSelect = document.getElementById('client-select');
    clientSelect.disabled = true; // Disable while loading
    clientSelect.innerHTML = '<option value="">-- Loading Clients --</option>';

    try {
        // Use ClientManager if available, otherwise try direct Firebase access
        if (window.ConstructionApp?.ClientManager?.loadClients) {
            allClients = await window.ConstructionApp.ClientManager.loadClients();
        } else if (window.ConstructionApp?.Firebase?.loadClients) {
            console.warn("[Reports] ClientManager not found, using direct Firebase.loadClients.");
            allClients = await window.ConstructionApp.Firebase.loadClients();
        } else {
            throw new Error("Client loading function not available.");
        }

        // Sort clients by name
        allClients.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        // Populate dropdown
        clientSelect.innerHTML = '<option value="">-- Select a Client --</option>'; // Reset placeholder
        allClients.forEach(client => {
            if (client && client.id && client.name) { // Basic validation
                const option = document.createElement('option');
                option.value = client.id;
                option.textContent = client.name;
                clientSelect.appendChild(option);
            }
        });
        clientSelect.disabled = false; // Re-enable dropdown
        console.log(`[Reports] Loaded ${allClients.length} clients.`);

    } catch (error) {
        console.error("[Reports] Failed to load clients:", error);
        clientSelect.innerHTML = '<option value="">-- Error Loading Clients --</option>';
        throw error; // Re-throw error to be caught by init
    }
}

/**
 * Loads module definitions from Firebase and populates the module dropdown.
 */
async function loadModules() {
    console.log("[Reports] Loading module definitions...");
    const moduleSelect = document.getElementById('module-select');
    moduleSelect.innerHTML = '<option value="">-- Loading Modules --</option>'; // Placeholder

    try {
        if (window.ConstructionApp?.Firebase?.loadModules) {
            allModules = await window.ConstructionApp.Firebase.loadModules();
            // Ensure Notes is present if not loaded from Firebase
             if (!allModules.some(m => m.id === 'notes')) {
                  allModules.unshift({ id: 'notes', name: 'Notes', type: 'regular', order: -1 });
             }
        } else {
            throw new Error("Module loading function not available.");
        }

        // Filter out header types and sort alphabetically for dropdown
        const reportableModules = allModules
            .filter(m => m.type !== 'header')
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        // Populate dropdown (keep disabled until client selected)
        moduleSelect.innerHTML = '<option value="">-- Select Client First --</option>';
        // Add Comprehensive option first
        const comprehensiveOption = document.createElement('option');
        comprehensiveOption.value = 'comprehensive';
        comprehensiveOption.textContent = 'Comprehensive (All Modules)';
        moduleSelect.appendChild(comprehensiveOption);
        // Add individual modules
        reportableModules.forEach(module => {
            if (module && module.id && module.name) {
                const option = document.createElement('option');
                option.value = module.id;
                option.textContent = module.name;
                moduleSelect.appendChild(option);
            }
        });
        console.log(`[Reports] Loaded ${allModules.length} module definitions for report options.`);

    } catch (error) {
        console.error("[Reports] Failed to load modules:", error);
        moduleSelect.innerHTML = '<option value="">-- Error Loading Modules --</option>';
        throw error; // Re-throw error
    }
}

// --- Event Handlers ---

/**
 * Handles changes in the client selection dropdown.
 */
function handleClientSelectionChange() {
    const clientSelect = document.getElementById('client-select');
    const moduleSelect = document.getElementById('module-select');
    const generateBtn = document.getElementById('generate-report-btn');
    const reportOutput = document.getElementById('report-output');

    selectedClientId = clientSelect.value;

    if (selectedClientId) {
        console.log(`[Reports] Client selected: ${selectedClientId}`);
        moduleSelect.disabled = false;
        generateBtn.disabled = false;
        // Reset module dropdown to default prompt
        moduleSelect.value = "";

        reportOutput.innerHTML = '<p class="status-message">Select report scope and filter, then click Generate.</p>';
    } else {
        console.log("[Reports] Client deselected.");
        moduleSelect.disabled = true;
        generateBtn.disabled = true;
        moduleSelect.value = ""; // Reset value
        reportOutput.innerHTML = '<p class="status-message">Please select a client.</p>';
    }
}

/**
 * Handles the click event for the "Generate Report" button.
 */
async function generateReport() {
    console.log("[Reports] Generate Report button clicked.");
    const reportOutput = document.getElementById('report-output');
    const generateBtn = document.getElementById('generate-report-btn');
    const moduleSelect = document.getElementById('module-select');
    const selectedScope = moduleSelect.value; // 'comprehensive' or a specific module ID
    const filterOption = document.querySelector('input[name="filter-option"]:checked')?.value || 'billable';

    // Basic validation
    if (!selectedClientId) {
        alert("Please select a client first.");
        return;
    }
    if (!selectedScope) {
        alert("Please select a report scope (Comprehensive or a specific module).");
        return;
    }

    console.log(`[Reports] Generating report for Client: ${selectedClientId}, Scope: ${selectedScope}, Filter: ${filterOption}`);
    generateBtn.disabled = true;
    reportOutput.innerHTML = '<p class="status-message">Generating report, please wait...</p>';

    try {
        // Fetch the selected client's full data directly from Firestore
        if (!window.ConstructionApp?.Firebase?.db) {
            throw new Error("Firestore database connection not available.");
        }
        const clientDoc = await window.ConstructionApp.Firebase.db.collection('clients').doc(selectedClientId).get();

        if (!clientDoc.exists) {
            throw new Error(`Client data not found for ID: ${selectedClientId}`);
        }

        const clientData = clientDoc.data();
        const clientModuleData = clientData.moduleData || {}; // Get the moduleData sub-object

        console.log("[Reports] Client data fetched successfully.");

        // --- Generate Report HTML ---
        let reportHTML = `<h2>Report Summary for ${clientData.name || 'Unknown Client'}</h2>`;
        let grandTotal = 0;

        if (selectedScope === 'comprehensive') {
            reportHTML += `<h3>Comprehensive Summary (${filterOption === 'billable' ? 'Billable Items' : 'All Items'})</h3>`;
            reportHTML += `<table class="report-table">
                             <thead><tr><th>Module</th><th class="currency">Total Cost</th></tr></thead>
                             <tbody>`;

            // Sort modules based on the order defined in allModules (or alphabetically)
            const sortedModules = allModules
                .filter(m => m.type !== 'header') // Exclude headers
                .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || (a.name || '').localeCompare(b.name || ''));

            sortedModules.forEach(module => {
                const moduleId = module.id;
                const moduleName = module.name || moduleId;
                const moduleSpecificData = clientModuleData[moduleId];
                const items = moduleSpecificData?.data?.items || moduleSpecificData?.items || []; // Handle different data structures
                let moduleTotal = 0;

                // Calculate total based on filter (if applicable to module total)
                // For now, calculate total based on billable items regardless of filter,
                // as filter mainly applies when showing item details.
                // TODO: Refine if filter should affect module total calculation method.
                if (moduleSpecificData?.totalCost !== undefined) {
                     moduleTotal = parseFloat(moduleSpecificData.totalCost) || 0;
                } else if (Array.isArray(items)) {
                    if (window.ConstructionApp?.ModuleUtils?.calculateModuleTotal) {
                         moduleTotal = window.ConstructionApp.ModuleUtils.calculateModuleTotal(items);
                    }
                }

                grandTotal += moduleTotal;

                reportHTML += `<tr>
                                 <td>${moduleName}</td>
                                 <td class="currency">${window.ConstructionApp?.ModuleUtils?.formatCurrency(moduleTotal) ?? 'R?.??'}</td>
                               </tr>`;
            });

            reportHTML += `</tbody>
                           <tfoot>
                             <tr>
                               <td><strong>Grand Total</strong></td>
                               <td class="currency"><strong>${window.ConstructionApp?.ModuleUtils?.formatCurrency(grandTotal) ?? 'R?.??'}</strong></td>
                             </tr>
                           </tfoot></table>`;

        } else {
            // --- Logic for Specific Module Report (Placeholder) ---
            const selectedModule = allModules.find(m => m.id === selectedScope);
            const moduleName = selectedModule?.name || selectedScope;
            reportHTML += `<h3>Module Details: ${moduleName} (${filterOption === 'billable' ? 'Billable Items' : 'All Items'})</h3>`;

            const moduleSpecificData = clientModuleData[selectedScope];
            const items = moduleSpecificData?.data?.items || moduleSpecificData?.items || [];
            let moduleTotal = 0;

            if (items && Array.isArray(items) && items.length > 0) {
                 reportHTML += `<table class="report-table">
                                 <thead><tr><th>Description</th><th>Qty</th><th class="currency">Rate</th><th class="currency">Total</th></tr></thead>
                                 <tbody>`;
                 items.forEach(item => {
                     const itemTotal = (parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0);
                     const isBillable = (item.qty > 0 || item.checked === true || item.allow === true); // Refine billable logic as needed

                     if (filterOption === 'all' || (filterOption === 'billable' && isBillable)) {
                          moduleTotal += itemTotal; // Only sum filtered items for module total in detail view
                          reportHTML += `<tr>
                                         <td>${item.description || ''}</td>
                                         <td>${item.qty || 0} ${item.unit || ''}</td>
                                         <td class="currency">${window.ConstructionApp?.ModuleUtils?.formatCurrency(item.rate || 0)}</td>
                                         <td class="currency">${window.ConstructionApp?.ModuleUtils?.formatCurrency(itemTotal)}</td>
                                       </tr>`;
                     }
                 });
                 reportHTML += `</tbody>
                                <tfoot>
                                  <tr>
                                      <td colspan="3" style="text-align:right;">Module Total (${filterOption === 'billable' ? 'Billable' : 'All'})</td>
                                      <td class="currency"><strong>${window.ConstructionApp?.ModuleUtils?.formatCurrency(moduleTotal) ?? 'R?.??'}</strong></td>
                                  </tr>
                                </tfoot></table>`;
            } else {
                 reportHTML += "<p>No detailed items found for this module.</p>";
                 // Still check for pre-calculated totalCost if items are missing
                 if (moduleSpecificData?.totalCost !== undefined) {
                      moduleTotal = parseFloat(moduleSpecificData.totalCost) || 0;
                      reportHTML += `<p>Pre-calculated Module Total: <strong>${window.ConstructionApp?.ModuleUtils?.formatCurrency(moduleTotal) ?? 'R?.??'}</strong></p>`;
                 }
            }
            // --- End Specific Module Logic ---
        }

        displayReport(reportHTML);

    } catch (error) {
        console.error("[Reports] Error generating report:", error);
        reportOutput.innerHTML = `<p class="status-message error">Error generating report: ${error.message}</p>`;
    } finally {
        generateBtn.disabled = false; // Re-enable button
    }
}

// --- Display & Formatting ---

/**
 * Displays the generated report HTML in the output area.
 * @param {string} html - The HTML string to display.
 */
function displayReport(html) {
    const reportOutput = document.getElementById('report-output');
    if (reportOutput) {
        reportOutput.innerHTML = html;
    }
}

// --- Placeholder Function (Not used in Comprehensive Summary) ---
/**
 * (Placeholder) Formats data for a single module into an HTML table.
 * @param {string} moduleName - The name of the module.
 * @param {Array} items - Array of item objects for the module.
 * @param {string} filter - 'all' or 'billable'.
 * @returns {string} HTML table string.
 */
function formatReportTable(moduleName, items, filter) {
    // This function can be used later to generate the detailed module report table
    // For now, the logic is incorporated directly into generateReport for simplicity
    let tableHTML = `<h3>${moduleName}</h3>`;
    // ... (Implementation similar to the specific module logic in generateReport) ...
    return tableHTML;
}

