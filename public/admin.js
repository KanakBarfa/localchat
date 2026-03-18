const passwordInput = document.getElementById('admin-password');
const unlockButton = document.getElementById('unlock-admin-btn');
const adminAuthSection = document.getElementById('admin-auth');
const authStatus = document.getElementById('auth-status');
const actionStatus = document.getElementById('action-status');
const adminActions = document.getElementById('admin-actions');
const tableBody = document.getElementById('messages-table-body');

const refreshButton = document.getElementById('refresh-list-btn');
const selectAllButton = document.getElementById('select-all-btn');
const clearSelectionButton = document.getElementById('clear-selection-btn');
const deleteSelectedButton = document.getElementById('delete-selected-btn');
const deleteAllButton = document.getElementById('delete-all-btn');
const deleteClientButton = document.getElementById('delete-client-btn');
const clientNameInput = document.getElementById('client-name');

let adminPassword = '';
let currentMessages = [];

function setStatus(element, message, isError = false) {
    element.textContent = message;
    element.classList.toggle('error', isError);
}

async function callAdminApi(path, options = {}) {
    const response = await fetch(path, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'x-admin-password': adminPassword,
            ...(options.headers || {})
        }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || 'Request failed');
    }

    return data;
}

function renderTable(messages) {
    tableBody.innerHTML = '';

    if (messages.length === 0) {
        const emptyRow = document.createElement('tr');
        const emptyCell = document.createElement('td');
        emptyCell.colSpan = 5;
        emptyCell.textContent = 'No persisted messages.';
        emptyCell.className = 'admin-empty-cell';
        emptyRow.appendChild(emptyCell);
        tableBody.appendChild(emptyRow);
        return;
    }

    messages.forEach((message) => {
        const row = document.createElement('tr');

        const selectCell = document.createElement('td');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'message-select';
        checkbox.dataset.id = String(message.id);
        selectCell.appendChild(checkbox);

        const idCell = document.createElement('td');
        idCell.textContent = String(message.id);

        const userCell = document.createElement('td');
        userCell.textContent = message.user || '-';

        const messageCell = document.createElement('td');
        messageCell.textContent = message.message;

        const timestampCell = document.createElement('td');
        timestampCell.textContent = new Date(message.timestamp).toLocaleString();

        row.appendChild(selectCell);
        row.appendChild(idCell);
        row.appendChild(userCell);
        row.appendChild(messageCell);
        row.appendChild(timestampCell);

        tableBody.appendChild(row);
    });
}

function selectedMessageIds() {
    return Array.from(document.querySelectorAll('.message-select:checked'))
        .map((checkbox) => Number(checkbox.dataset.id))
        .filter((id) => Number.isInteger(id) && id > 0);
}

async function refreshMessages() {
    const data = await callAdminApi('/api/admin/messages?limit=2000');
    currentMessages = data.messages || [];
    renderTable(currentMessages);
}

unlockButton.addEventListener('click', async () => {
    const password = passwordInput.value;
    if (!password) {
        setStatus(authStatus, 'Enter the admin password first.', true);
        return;
    }

    adminPassword = password;

    try {
        await refreshMessages();
        adminAuthSection.hidden = true;
        adminActions.hidden = false;
        setStatus(authStatus, 'Admin unlocked.');
        setStatus(actionStatus, 'Loaded latest messages.');
    } catch (error) {
        adminPassword = '';
        adminAuthSection.hidden = false;
        adminActions.hidden = true;
        setStatus(authStatus, error.message, true);
    }
});

passwordInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        unlockButton.click();
    }
});

refreshButton.addEventListener('click', async () => {
    try {
        await refreshMessages();
        setStatus(actionStatus, 'Message list refreshed.');
    } catch (error) {
        setStatus(actionStatus, error.message, true);
    }
});

selectAllButton.addEventListener('click', () => {
    document.querySelectorAll('.message-select').forEach((checkbox) => {
        checkbox.checked = true;
    });
});

clearSelectionButton.addEventListener('click', () => {
    document.querySelectorAll('.message-select').forEach((checkbox) => {
        checkbox.checked = false;
    });
});

deleteAllButton.addEventListener('click', async () => {
    const confirmed = window.confirm('Delete ALL messages? This cannot be undone.');
    if (!confirmed) {
        return;
    }

    try {
        const data = await callAdminApi('/api/admin/messages/all', { method: 'DELETE' });
        await refreshMessages();
        setStatus(actionStatus, `Deleted ${data.deletedCount} messages.`);
    } catch (error) {
        setStatus(actionStatus, error.message, true);
    }
});

deleteClientButton.addEventListener('click', async () => {
    const clientName = clientNameInput.value.trim();
    if (!clientName) {
        setStatus(actionStatus, 'Enter a client name.', true);
        return;
    }

    const confirmed = window.confirm(`Delete all messages from ${clientName}?`);
    if (!confirmed) {
        return;
    }

    try {
        const encodedName = encodeURIComponent(clientName);
        const data = await callAdminApi(`/api/admin/messages/client/${encodedName}`, { method: 'DELETE' });
        await refreshMessages();
        setStatus(actionStatus, `Deleted ${data.deletedCount} messages for ${clientName}.`);
    } catch (error) {
        setStatus(actionStatus, error.message, true);
    }
});

deleteSelectedButton.addEventListener('click', async () => {
    const ids = selectedMessageIds();
    if (ids.length === 0) {
        setStatus(actionStatus, 'Select at least one message.', true);
        return;
    }

    const confirmed = window.confirm(`Delete ${ids.length} selected message(s)?`);
    if (!confirmed) {
        return;
    }

    try {
        const data = await callAdminApi('/api/admin/messages/selected', {
            method: 'DELETE',
            body: JSON.stringify({ ids })
        });
        await refreshMessages();
        setStatus(actionStatus, `Deleted ${data.deletedCount} selected message(s).`);
    } catch (error) {
        setStatus(actionStatus, error.message, true);
    }
});
