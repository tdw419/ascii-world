// Electrobun handles the index.js mapping automatically during bundling

(window as any).sendControl = async (label: string) => {
    console.log("GUI sending label:", label);
    try {
        const response = await fetch('http://localhost:3421/control', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ label })
        });
        
        if (!response.ok) {
            console.error("Failed to send control:", await response.text());
        }
    } catch (e) {
        console.error("Error connecting to Control API:", e);
    }
};

(window as any).updateState = (data: any, ascii: string) => {
    // 1. Update Global Status
    const stateEl = document.getElementById('current-state');
    if (stateEl) stateEl.textContent = data.state;
    
    // 2. Update ASCII View
    const asciiEl = document.getElementById('ascii-content');
    if (asciiEl) asciiEl.textContent = ascii;

    // 3. Update GUI View based on state
    const views = ['home-view', 'tasks-view', 'settings-view'];
    const currentViewId = `${data.state.toLowerCase()}-view`;
    
    views.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = (id === currentViewId) ? 'block' : 'none';
    });

    // 4. Update dynamic data for specific views
    if (data.state === 'TASKS') {
        renderTasks(data.tasks);
    } else if (data.state === 'SETTINGS') {
        renderSettings(data.settings);
    }
};

function renderTasks(tasks: any[]) {
    const list = document.getElementById('task-list');
    if (!list) return;
    
    list.innerHTML = `
        <table class="task-table">
            <thead>
                <tr>
                    <th>Label</th>
                    <th>Status</th>
                    <th>Task Description</th>
                    <th>Priority</th>
                </tr>
            </thead>
            <tbody>
                ${tasks.map((task, index) => {
                    const label = String.fromCharCode(65 + index);
                    return `
                        <tr>
                            <td class="label-cell"><button onclick="sendControl('${label}')">[${label}]</button></td>
                            <td>${task.completed ? '✅' : '⏳'}</td>
                            <td>${task.title}</td>
                            <td><span class="priority-tag ${task.priority}">${task.priority}</span></td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

function renderSettings(settings: any) {
    const autoSaveEl = document.getElementById('gui-auto-save');
    if (autoSaveEl) autoSaveEl.textContent = settings.autoSave ? 'ON' : 'OFF';
    
    const themeEl = document.getElementById('gui-theme');
    if (themeEl) themeEl.textContent = settings.theme.toUpperCase();
}

console.log("Mainview script initialized.");
