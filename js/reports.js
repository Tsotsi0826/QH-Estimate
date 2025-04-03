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
        } else {
            throw new Error("Module loading function not available.");
        }

        // Filter out header types and sort alphabetically
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
        console.log(`[Reports] Loaded ${allModules.length} module definitions.`);

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
        moduleSelect.innerHTML = ''; // Clear previous options
        // Re-populate module select now that client is chosen
        const defaultOption = document.createElement('option');
        defaultOption.value = "";
        defaultOption.textContent = "-- Select Report Scope --";
        moduleSelect.appendChild(defaultOption);
        const comprehensiveOption = document.createElement('option');
        comprehensiveOption.value = 'comprehensive';
        comprehensiveOption.textContent = 'Comprehensive (All Modules)';
        moduleSelect.appendChild(comprehensiveOption);
        allModules
            .filter(m => m.type !== 'header')
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
            .forEach(module => {
                if (module && module.id && module.name) {
                    const option = document.createElement('option');
                    option.value = module.id;
                    option.textContent = module.name;
                    moduleSelect.appendChild(option);
                }
            });

        reportOutput.innerHTML = '<p class="status-message">Select report scope and filter, then click Generate.</p>';
    } else {
        console.log("[Reports] Client deselected.");
        moduleSelect.disabled = true;
        generateBtn.disabled = true;
        moduleSelect.innerHTML = '<option value="">-- Select Client First --</option>';
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
    const selectedModuleId = moduleSelect.value;
    const filterOption = document.querySelector('input[name="filter-option"]:checked')?.value || 'billable'; // Default to billable

    // Basic validation
    if (!selectedClientId) {
        alert("Please select a client first.");
        return;
    }
    if (!selectedModuleId) {
        alert("Please select a report scope (Comprehensive or a specific module).");
        return;
    }

    console.log(`[Reports] Generating report for Client: ${selectedClientId}, Scope: ${selectedModuleId}, Filter: ${filterOption}`);
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

        // --- Placeholder for report generation logic ---
        // TODO: Implement HTML generation based on scope and filter
        let reportHTML = `<h2>Report for ${clientData.name || 'Unknown Client'}</h2>`;
        reportHTML += `<p>Scope: ${selectedModuleId === 'comprehensive' ? 'Comprehensive' : allModules.find(m=>m.id===selectedModuleId)?.name || selectedModuleId}</p>`;
        reportHTML += `<p>Filter: ${filterOption === 'billable' ? 'Billable Items Only' : 'All Items'}</p>`;
        reportHTML += "<hr>";
        reportHTML += "<p><i>Report generation logic not yet implemented.</i></p>";
        reportHTML += `<pre>${JSON.stringify(clientModuleData, null, 2)}</pre>`; // Display raw data for now
        // --- End Placeholder ---

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

/**
 * (Placeholder) Formats data for a single module into an HTML table.
 * @param {string} moduleName - The name of the module.
 * @param {Array} items - Array of item objects for the module.
 * @param {string} filter - 'all' or 'billable'.
 * @returns {string} HTML table string.
 */
function formatReportTable(moduleName, items, filter) {
    // TODO: Implement filtering based on 'filter' parameter
    // TODO: Implement table generation using item data
    let tableHTML = `<h3>${moduleName}</h3>`;
    if (!items || items.length === 0) {
        tableHTML += "<p>No data entered for this module.</p>";
        return tableHTML;
    }

    tableHTML += `<table class="report-table">
                    <thead>
                        <tr>
                            <th>Description</th>
                            <th>Qty</th>
                            <th>Rate</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>`;

    let moduleTotal = 0;
    items.forEach(item => {
        // Placeholder: Apply filter logic here
        const isBillable = (item.qty > 0 || item.checked === true); // Example filter logic
        if (filter === 'all' || (filter === 'billable' && isBillable)) {
            const itemTotal = (parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0);
            moduleTotal += itemTotal;
            tableHTML += `<tr>
                            <td>${item.description || ''}</td>
                            <td class="currency">${item.qty || 0}</td>
                            <td class="currency">${window.ConstructionApp?.ModuleUtils?.formatCurrency(item.rate || 0)}</td>
                            <td class="currency">${window.ConstructionApp?.ModuleUtils?.formatCurrency(itemTotal)}</td>
                          </tr>`;
        }
    });

    tableHTML += `</tbody>
                  <tfoot>
                    <tr>
                        <td colspan="3" style="text-align:right;">Module Total</td>
                        <td class="currency">${window.ConstructionApp?.ModuleUtils?.formatCurrency(moduleTotal)}</td>
                    </tr>
                  </tfoot></table>`;

    return tableHTML;
}

