// App State
let allPeople = [];
let currentPerson = null;

// API Base URL
const API_BASE = '/api';

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    // Check auth status first
    await checkAuthStatus();

    // Then load data
    loadPeople();
    loadStats();
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    // Search
    document.getElementById('search').addEventListener('input', handleSearch);

    // Toolbar buttons
    document.getElementById('refresh-btn').addEventListener('click', () => {
        loadPeople();
        loadStats();
    });

    document.getElementById('export-btn').addEventListener('click', exportData);

    // Modal
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('person-modal').addEventListener('click', (e) => {
        if (e.target.id === 'person-modal') closeModal();
    });

    // Modal actions
    document.getElementById('add-note-btn').addEventListener('click', addNote);
    document.getElementById('delete-person-btn').addEventListener('click', deletePerson);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

// API Functions
async function checkAuthStatus() {
    try {
        const response = await fetch('/api/auth/status', {
            credentials: 'include'
        });

        if (!response.ok) {
            showToast(`Auth check failed: HTTP ${response.status}`, 'error');
            return false;
        }

        const data = await response.json();

        if (!data.authenticated) {
            showToast('Not authenticated. Please access through MentraOS app.', 'error');
            console.error('Auth status:', data);
            return false;
        }

        console.log('✓ Authenticated as user:', data.userId);
        return true;
    } catch (error) {
        showToast(`Auth check error: ${error.message}`, 'error');
        console.error('Auth check failed:', error);
        return false;
    }
}

async function apiRequest(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        if (!response.ok) {
            let errorMsg = `HTTP ${response.status}`;
            try {
                const errorData = await response.json();
                errorMsg += `: ${errorData.error || errorData.message || 'Unknown error'}`;
                if (errorData.details) {
                    console.error('Error details:', errorData.details);
                }
            } catch (e) {
                errorMsg += ` - ${response.statusText}`;
            }
            throw new Error(errorMsg);
        }

        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        showToast(error.message, 'error');
        throw error;
    }
}

async function loadPeople() {
    try {
        const response = await apiRequest('/people');

        if (response.success) {
            allPeople = response.people;
            renderPeopleList(allPeople);
        }
    } catch (error) {
        console.error('Error loading people:', error);
    }
}

async function loadStats() {
    try {
        const response = await apiRequest('/stats');

        if (response.success) {
            const stats = response.stats;
            document.getElementById('stat-people').textContent =
                `${stats.totalPeople} ${stats.totalPeople === 1 ? 'person' : 'people'}`;
            document.getElementById('stat-conversations').textContent =
                `${stats.totalConversations} ${stats.totalConversations === 1 ? 'conversation' : 'conversations'}`;
            document.getElementById('stat-voices').textContent =
                `${stats.peopleWithVoices} ${stats.peopleWithVoices === 1 ? 'voice' : 'voices'}`;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function exportData() {
    try {
        window.location.href = `${API_BASE}/export`;
        showToast('Export started!', 'success');
    } catch (error) {
        console.error('Error exporting data:', error);
    }
}

async function addNote() {
    const note = document.getElementById('note-input').value.trim();

    if (!note) {
        showToast('Please enter a note', 'error');
        return;
    }

    if (!currentPerson) return;

    try {
        const response = await apiRequest(`/people/${encodeURIComponent(currentPerson.name)}/notes`, {
            method: 'POST',
            body: JSON.stringify({ note })
        });

        if (response.success) {
            currentPerson = response.person;
            renderPersonModal(currentPerson);
            document.getElementById('note-input').value = '';
            showToast('Note added!', 'success');
            loadPeople(); // Refresh list
        }
    } catch (error) {
        console.error('Error adding note:', error);
    }
}

async function deletePerson() {
    if (!currentPerson) return;

    if (!confirm(`Are you sure you want to delete ${currentPerson.name}? This cannot be undone.`)) {
        return;
    }

    try {
        const response = await apiRequest(`/people/${encodeURIComponent(currentPerson.name)}`, {
            method: 'DELETE'
        });

        if (response.success) {
            showToast('Person deleted', 'success');
            closeModal();
            loadPeople();
            loadStats();
        }
    } catch (error) {
        console.error('Error deleting person:', error);
    }
}

// UI Functions
function renderPeopleList(people) {
    const listEl = document.getElementById('people-list');

    if (people.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state">
                <h3>No people yet</h3>
                <p>Start using Nametag on your glasses to remember people you meet!</p>
            </div>
        `;
        return;
    }

    listEl.innerHTML = people.map(person => {
        const lastConv = person.conversationHistory && person.conversationHistory.length > 0
            ? person.conversationHistory[person.conversationHistory.length - 1]
            : null;

        const keyPoints = lastConv?.keyPoints || [];
        const displayedPoints = keyPoints.slice(0, 3);

        return `
            <div class="person-card" onclick="openPersonDetail('${escapeHtml(person.name)}')">
                <h3>${escapeHtml(person.name)}</h3>
                <div class="person-meta">
                    <span class="meta-badge">Speaker ${escapeHtml(person.speakerId)}</span>
                    ${person.voiceReference ?
            '<span class="meta-badge voice-indicator">🎤 Voice Profile</span>' : ''}
                    <span class="meta-badge">${person.conversationHistory?.length || 0} conversations</span>
                    ${person.lastMet ?
            `<span class="meta-badge">${formatDate(person.lastMet)}</span>` : ''}
                </div>
                ${lastConv?.transcript ?
            `<p class="person-summary">${escapeHtml(lastConv.transcript.substring(0, 120))}${lastConv.transcript.length > 120 ? '...' : ''}</p>`
            : ''}
                ${displayedPoints.length > 0 ?
            `<div class="person-key-points">
                        <ul>
                            ${displayedPoints.map(point => `<li>${escapeHtml(point)}</li>`).join('')}
                        </ul>
                    </div>`
            : ''}
            </div>
        `;
    }).join('');
}

function openPersonDetail(name) {
    const person = allPeople.find(p => p.name === name);
    if (!person) return;

    currentPerson = person;
    renderPersonModal(person);

    document.getElementById('person-modal').classList.remove('hidden');
}

function renderPersonModal(person) {
    document.getElementById('modal-name').textContent = person.name;
    document.getElementById('modal-speaker-id').textContent = person.speakerId;
    document.getElementById('modal-last-met').textContent = person.lastMet ? formatDateTime(person.lastMet) : 'Never';
    document.getElementById('modal-conversation-count').textContent = person.conversationHistory?.length || 0;
    document.getElementById('modal-voice-status').textContent = person.voiceReference ? '✅ Saved' : '❌ Not saved';

    // Render conversations
    const convsEl = document.getElementById('modal-conversations');

    if (!person.conversationHistory || person.conversationHistory.length === 0) {
        convsEl.innerHTML = '<div class="empty-state"><p>No conversations yet</p></div>';
        return;
    }

    convsEl.innerHTML = person.conversationHistory
        .slice()
        .reverse() // Show most recent first
        .map(conv => `
            <div class="conversation-item">
                <div class="conversation-date">${formatDateTime(conv.date)}</div>
                ${conv.transcript ?
            `<div class="conversation-text">${escapeHtml(conv.transcript)}</div>` : ''}
                ${conv.topics && conv.topics.length > 0 ?
            `<div class="conversation-topics">
                        ${conv.topics.map(topic =>
                `<span class="topic-tag">${escapeHtml(topic)}</span>`
            ).join('')}
                    </div>`
            : ''}
                ${conv.keyPoints && conv.keyPoints.length > 0 ?
            `<div class="conversation-keypoints">
                        <ul>
                            ${conv.keyPoints.map(point =>
                `<li>${escapeHtml(point)}</li>`
            ).join('')}
                        </ul>
                    </div>`
            : ''}
            </div>
        `).join('');
}

function closeModal() {
    document.getElementById('person-modal').classList.add('hidden');
    currentPerson = null;
    document.getElementById('note-input').value = '';
}

function handleSearch(e) {
    const query = e.target.value.toLowerCase();

    if (!query) {
        renderPeopleList(allPeople);
        return;
    }

    const filtered = allPeople.filter(person =>
        person.name.toLowerCase().includes(query)
    );

    renderPeopleList(filtered);
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// Utility Functions
function formatDate(date) {
    const d = new Date(date);
    const now = new Date();
    const diffTime = Math.abs(now - d);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
}

function formatDateTime(date) {
    const d = new Date(date);
    return d.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
