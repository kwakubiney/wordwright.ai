import { StorageService } from '../lib/storage.js';

// DOM Elements
const apiKeyInput = document.getElementById('api-key');
const saveAiSettingsBtn = document.getElementById('save-ai-settings');
const resetBtn = document.getElementById('reset-btn');
const toast = document.getElementById('toast');

// Load saved settings
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
});

async function loadSettings() {
    const result = await chrome.storage.local.get(['openrouter_api_key']);
    apiKeyInput.value = result.openrouter_api_key || '';
}

// Save AI settings
saveAiSettingsBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        showToast('Please enter an API key.');
        return;
    }

    await chrome.storage.local.set({ openrouter_api_key: apiKey });
    showToast('API key saved!');
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
