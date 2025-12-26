import { StorageService } from '../lib/storage.js';

// DOM Elements
const providerOpenRouter = document.getElementById('provider-openrouter');
const providerOllama = document.getElementById('provider-ollama');
const openrouterConfig = document.getElementById('openrouter-config');
const ollamaConfig = document.getElementById('ollama-config');
const apiKeyInput = document.getElementById('api-key');
const ollamaEndpointInput = document.getElementById('ollama-endpoint');
const ollamaModelSelect = document.getElementById('ollama-model');
const fetchModelsBtn = document.getElementById('fetch-models-btn');
const ollamaStatus = document.getElementById('ollama-status');
const saveAiSettingsBtn = document.getElementById('save-ai-settings');
const remindersEnabled = document.getElementById('reminders-enabled');
const snoozeDuration = document.getElementById('snooze-duration');
const saveReminderSettingsBtn = document.getElementById('save-reminder-settings');
const resetBtn = document.getElementById('reset-btn');
const toast = document.getElementById('toast');

// Load saved settings
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    setupProviderToggle();
    setupFetchModels();
});

function setupProviderToggle() {
    providerOpenRouter.addEventListener('change', updateProviderView);
    providerOllama.addEventListener('change', updateProviderView);
}

function updateProviderView() {
    if (providerOpenRouter.checked) {
        openrouterConfig.style.display = 'block';
        ollamaConfig.style.display = 'none';
    } else if (providerOllama.checked) {
        openrouterConfig.style.display = 'none';
        ollamaConfig.style.display = 'block';
    }
}

function setupFetchModels() {
    fetchModelsBtn.addEventListener('click', fetchOllamaModels);
}

async function fetchOllamaModels() {
    const endpoint = ollamaEndpointInput.value.trim() || 'http://localhost:11434';

    fetchModelsBtn.disabled = true;
    fetchModelsBtn.textContent = 'Fetching...';
    ollamaStatus.textContent = 'Connecting to Ollama...';
    ollamaStatus.style.color = 'var(--text-muted)';

    try {
        const response = await fetch(`${endpoint}/api/tags`);

        if (!response.ok) {
            throw new Error('Could not connect to Ollama');
        }

        const data = await response.json();
        const models = data.models || [];

        if (models.length === 0) {
            ollamaStatus.textContent = 'No models installed. Run: ollama pull llama3.2';
            ollamaStatus.style.color = '#ef4444';
            return;
        }

        // Populate dropdown
        ollamaModelSelect.innerHTML = '';
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.name;
            option.textContent = model.name;
            ollamaModelSelect.appendChild(option);
        });

        ollamaStatus.textContent = `Found ${models.length} model${models.length !== 1 ? 's' : ''}`;
        ollamaStatus.style.color = '#10b981';

    } catch (error) {
        console.error('Fetch models error:', error);
        ollamaStatus.textContent = 'Could not connect. Is Ollama running? (ollama serve)';
        ollamaStatus.style.color = '#ef4444';
    } finally {
        fetchModelsBtn.disabled = false;
        fetchModelsBtn.textContent = 'Fetch Models';
    }
}

async function loadSettings() {
    const result = await chrome.storage.local.get([
        'ai_provider',
        'openrouter_api_key',
        'ollama_endpoint',
        'ollama_model',
        'lexi_reminders_enabled',
        'lexi_snooze_duration'
    ]);

    // AI Provider
    const provider = result.ai_provider || '';
    if (provider === 'openrouter') {
        providerOpenRouter.checked = true;
    } else if (provider === 'ollama') {
        providerOllama.checked = true;
    }
    updateProviderView();

    // OpenRouter
    apiKeyInput.value = result.openrouter_api_key || '';

    // Ollama
    ollamaEndpointInput.value = result.ollama_endpoint || 'http://localhost:11434';

    // If we have a saved model, add it as an option and select it
    const savedModel = result.ollama_model || '';
    if (savedModel) {
        const option = document.createElement('option');
        option.value = savedModel;
        option.textContent = savedModel;
        ollamaModelSelect.appendChild(option);
        ollamaModelSelect.value = savedModel;
    }

    // Reminders
    remindersEnabled.checked = result.lexi_reminders_enabled !== false;
    snoozeDuration.value = result.lexi_snooze_duration || '60';
}

// Save AI settings
saveAiSettingsBtn.addEventListener('click', async () => {
    let provider = null;

    if (providerOpenRouter.checked) {
        provider = 'openrouter';
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            showToast('Please enter an API key.');
            return;
        }
        await chrome.storage.local.set({
            ai_provider: provider,
            openrouter_api_key: apiKey
        });
    } else if (providerOllama.checked) {
        provider = 'ollama';
        const endpoint = ollamaEndpointInput.value.trim() || 'http://localhost:11434';
        const model = ollamaModelSelect.value || 'llama3.2';
        await chrome.storage.local.set({
            ai_provider: provider,
            ollama_endpoint: endpoint,
            ollama_model: model
        });
    } else {
        showToast('Please select an AI provider.');
        return;
    }

    showToast('AI settings saved!');
});

// Save reminder settings
saveReminderSettingsBtn.addEventListener('click', async () => {
    await chrome.storage.local.set({
        lexi_reminders_enabled: remindersEnabled.checked,
        lexi_snooze_duration: snoozeDuration.value
    });
    showToast('Reminder settings saved!');
});

// Reset data
resetBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to delete all your words and progress?')) {
        await StorageService.clearAll();
        showToast('All data has been reset.');
    }
});

function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
