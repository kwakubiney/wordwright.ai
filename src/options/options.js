import { StorageService } from '../lib/storage.js';

// DOM Elements
const apiKeyInput = document.getElementById('api-key');
const saveAiSettingsBtn = document.getElementById('save-ai-settings');
const remindersEnabled = document.getElementById('reminders-enabled');
const reminderTimes = document.getElementById('reminder-times');
const morningTime = document.getElementById('morning-time');
const eveningTime = document.getElementById('evening-time');
const saveRemindersBtn = document.getElementById('save-reminders');
const resetBtn = document.getElementById('reset-btn');
const toast = document.getElementById('toast');

// Load saved settings
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
});

async function loadSettings() {
    const result = await chrome.storage.local.get(['lexi_settings', 'openrouter_api_key']);
    const settings = result.lexi_settings || {
        remindersEnabled: false,
        morningTime: '',
        eveningTime: ''
    };

    // Load AI settings
    apiKeyInput.value = result.openrouter_api_key || '';

    // Load reminder settings
    remindersEnabled.checked = settings.remindersEnabled;
    morningTime.value = settings.morningTime;
    eveningTime.value = settings.eveningTime;

    updateTimesVisibility();
}

function updateTimesVisibility() {
    if (remindersEnabled.checked) {
        reminderTimes.classList.remove('disabled-overlay');
    } else {
        reminderTimes.classList.add('disabled-overlay');
    }
}

// Toggle visibility
remindersEnabled.addEventListener('change', () => {
    updateTimesVisibility();
});

// Save reminder times
saveRemindersBtn.addEventListener('click', async () => {
    const settings = {
        remindersEnabled: remindersEnabled.checked,
        morningTime: morningTime.value,
        eveningTime: eveningTime.value
    };

    await chrome.storage.local.set({ lexi_settings: settings });
    showToast('Reminder settings saved!');

    // Notify background script to update alarms
    try {
        await chrome.runtime.sendMessage({ type: 'UPDATE_ALARMS' });
    } catch (e) {
        console.log('Background script may be inactive, settings saved anyway');
    }
});

// Save AI settings
saveAiSettingsBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        showToast('Please enter an API key.');
        return;
    }

    await chrome.storage.local.set({ openrouter_api_key: apiKey });
    showToast('API key saved! ✨');
});

// Reset data
resetBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to delete all your words and progress?')) {
        await StorageService.clearAll();
        showToast('All data has been reset.');
    }
});

// Bulk Import
const importBtn = document.getElementById('import-btn');
const importText = document.getElementById('import-text');

importBtn.addEventListener('click', async () => {
    const text = importText.value.trim();
    if (!text) {
        showToast('Please paste some text first.');
        return;
    }

    importBtn.disabled = true;
    importBtn.textContent = 'Importing...';

    try {
        // Extract words: look for lines that don't start with "Definition:" or "Example:"
        // and aren't empty. The user's format has the word on its own line.
        const lines = text.split('\n');
        const wordsToImport = [];

        for (let line of lines) {
            line = line.trim();
            if (!line) continue;

            // Skip definition/example lines
            if (line.startsWith('Definition:') || line.startsWith('Example:')) continue;

            // Skip lines that look like definitions (long sentences)
            if (line.length > 50 || line.includes(' ')) {
                // Check if it's a multi-word term like "Pyrrhic victory" or "Overton window"
                // If it has more than 3 words, it's probably a sentence/definition
                if (line.split(' ').length > 3) continue;
            }

            wordsToImport.push(line);
        }

        if (wordsToImport.length === 0) {
            showToast('No valid words found.');
            return;
        }

        let addedCount = 0;
        const allWords = await StorageService.getAllWords();

        // Process sequentially to avoid rate limiting
        for (const word of wordsToImport) {
            // Check duplicate
            const exists = allWords.some(w => w.word.toLowerCase() === word.toLowerCase());
            if (!exists) {
                // Update button status
                importBtn.textContent = `Importing "${word}"...`;

                // Lookup definition
                let definition = '';
                let example = '';

                try {
                    const result = await lookupWord(word);
                    if (result) {
                        definition = result.definition;
                        example = result.example;
                    }
                } catch (e) {
                    console.warn(`Could not lookup ${word}`, e);
                }

                await StorageService.addWord(word, definition, example);
                addedCount++;

                // Small delay to be nice to the API
                await new Promise(r => setTimeout(r, 300));
            }
        }

        importText.value = '';
        showToast(`Successfully imported ${addedCount} words with definitions!`);
    } catch (error) {
        console.error('Import error:', error);
        showToast('Error importing words.');
    } finally {
        importBtn.disabled = false;
        importBtn.textContent = 'Import Words';
    }
});

// Dictionary API lookup (copied from popup.js)
async function lookupWord(word) {
    const DICTIONARY_API = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;

    try {
        const response = await fetch(DICTIONARY_API);
        if (!response.ok) return null;

        const data = await response.json();
        if (!data || data.length === 0) return null;

        const entry = data[0];
        let definition = '';
        let example = '';

        if (entry.meanings && entry.meanings.length > 0) {
            const meaning = entry.meanings[0];
            const partOfSpeech = meaning.partOfSpeech || '';

            if (meaning.definitions && meaning.definitions.length > 0) {
                const def = meaning.definitions[0];
                definition = `(${partOfSpeech}) ${def.definition}`;
                example = def.example || '';
            }
        }

        return { definition, example };
    } catch (error) {
        return null;
    }
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
