import { StorageService } from '../lib/storage.js';

const typesafeApiKeyInput = document.getElementById('typesafe-api-key');
const saveAiSettingsBtn = document.getElementById('save-ai-settings');
const remindersEnabled = document.getElementById('reminders-enabled');
const snoozeDuration = document.getElementById('snooze-duration');
const saveReminderSettingsBtn = document.getElementById('save-reminder-settings');
const resetBtn = document.getElementById('reset-btn');
const toast = document.getElementById('toast');

document.addEventListener('DOMContentLoaded', loadSettings);

async function loadSettings() {
    const result = await chrome.storage.local.get([
        'typesafe_api_key',
        'lexi_reminders_enabled',
        'lexi_snooze_duration'
    ]);
    typesafeApiKeyInput.value = result.typesafe_api_key || '';
    remindersEnabled.checked = result.lexi_reminders_enabled !== false;
    snoozeDuration.value = result.lexi_snooze_duration || '60';
}

saveAiSettingsBtn.addEventListener('click', async () => {
    const typesafeApiKey = typesafeApiKeyInput.value.trim();
    if (!typesafeApiKey) {
        showToast('Please enter a TypeSafe API key for Jev.');
        return;
    }
    await chrome.storage.local.set({
        typesafe_api_key: typesafeApiKey,
        ai_provider: 'jev'
    });
    showToast('Jev settings saved!');
});

saveReminderSettingsBtn.addEventListener('click', async () => {
    await chrome.storage.local.set({
        lexi_reminders_enabled: remindersEnabled.checked,
        lexi_snooze_duration: snoozeDuration.value
    });
    showToast('Reminder settings saved!');
});

resetBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to delete all your words and progress?')) {
        await StorageService.clearAll();
        showToast('All data has been reset.');
    }
});

function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}
