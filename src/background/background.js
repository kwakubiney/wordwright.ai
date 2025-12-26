import { StorageService } from '../lib/storage.js';
import { DictionaryService } from '../lib/dictionary.js';

// Alarm names
const MORNING_ALARM = 'morning_reminder';
const EVENING_ALARM = 'evening_reminder';
const BADGE_ALARM = 'badge_update';

chrome.runtime.onInstalled.addListener(() => {
    console.log('Lexi.ai installed');

    // Badge update every hour
    chrome.alarms.create(BADGE_ALARM, { periodInMinutes: 60 });

    // Set up reminder alarms based on saved settings
    setupReminderAlarms();
    updateBadge();

    // Create context menu
    chrome.contextMenus.create({
        id: "add-to-lexi",
        title: "Add \"%s\" to Lexi",
        contexts: ["selection"]
    });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "add-to-lexi" && info.selectionText) {
        let word = info.selectionText.trim();
        if (!word) return;

        // Capitalize first letter
        word = word.charAt(0).toUpperCase() + word.slice(1);

        // Verify it's a single word (or reasonable length phrase)
        if (word.split(' ').length > 3) {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'src/assets/icon128.png',
                title: 'Too long!',
                message: 'Please select a single word or short phrase.',
                priority: 1
            });
            return;
        }

        try {
            // Check for duplicate
            const allWords = await StorageService.getAllWords();
            const exists = allWords.some(w => w.word.toLowerCase() === word.toLowerCase());

            if (exists) {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'src/assets/icon128.png',
                    title: 'Already saved',
                    message: `"${word}" is already in your Lexi list.`,
                    priority: 1
                });
                return;
            }

            // Get context from the content script
            let context = null;
            try {
                const response = await chrome.tabs.sendMessage(tab.id, {
                    type: 'GET_SELECTION_CONTEXT'
                });
                if (response) {
                    context = response;
                }
            } catch (contextError) {
                console.warn('Could not get context from page:', contextError);
                // Fallback context with just the URL
                context = {
                    sentence: info.selectionText,
                    snippet: '',
                    sourceUrl: tab.url || '',
                    pageTitle: tab.title || ''
                };
            }

            // Fetch definition
            const result = await DictionaryService.lookup(word);
            const definition = result ? result.definition : '';
            const example = result ? result.example : '';

            // Add to storage with context
            await StorageService.addWord(word, definition, example, context);

            // Notify user
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'src/assets/icon128.png',
                title: 'Word Saved!',
                message: result 
                    ? `Added "${word}" with definition and context.` 
                    : `Added "${word}" with context. (No definition found)`,
                priority: 1
            });

            // Update badge immediately
            updateBadge();

        } catch (error) {
            console.error('Context menu add error:', error);
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'src/assets/icon128.png',
                title: 'Error',
                message: 'Could not save word. Please try again.',
                priority: 1
            });
        }
    }
});

// Handle messages from options page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'UPDATE_ALARMS') {
        setupReminderAlarms();
    }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === BADGE_ALARM) {
        updateBadge();
    }

    if (alarm.name === MORNING_ALARM || alarm.name === EVENING_ALARM) {
        await sendReviewNotification();
    }
});

// Handle notification click
chrome.notifications.onClicked.addListener((notificationId) => {
    if (notificationId.startsWith('lexi_review_')) {
        chrome.action.openPopup().catch(() => {
            chrome.runtime.openOptionsPage();
        });
    }
});

// Update when storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.lexi_words) {
        updateBadge();
    }
});

async function setupReminderAlarms() {
    // Clear existing reminder alarms
    await chrome.alarms.clear(MORNING_ALARM);
    await chrome.alarms.clear(EVENING_ALARM);

    // Get settings
    const result = await chrome.storage.local.get(['lexi_settings']);
    const settings = result.lexi_settings || { remindersEnabled: false };

    if (!settings.remindersEnabled) {
        console.log('Reminders disabled');
        return;
    }

    // Parse times
    const morningTime = settings.morningTime;
    const eveningTime = settings.eveningTime;

    // Create alarms for specific times if set
    if (morningTime) {
        createDailyAlarm(MORNING_ALARM, morningTime);
    }

    if (eveningTime) {
        createDailyAlarm(EVENING_ALARM, eveningTime);
    }
}

function createDailyAlarm(alarmName, timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);

    const now = new Date();
    const alarmTime = new Date();
    alarmTime.setHours(hours, minutes, 0, 0);

    // If the time has already passed today, schedule for tomorrow
    if (alarmTime <= now) {
        alarmTime.setDate(alarmTime.getDate() + 1);
    }

    const delayInMinutes = (alarmTime.getTime() - now.getTime()) / 60000;

    chrome.alarms.create(alarmName, {
        delayInMinutes: delayInMinutes,
        periodInMinutes: 24 * 60 // Repeat every 24 hours
    });
}

async function updateBadge() {
    try {
        const dueWords = await StorageService.getDueWords();
        const count = dueWords.length;

        if (count > 0) {
            chrome.action.setBadgeText({ text: count.toString() });
            chrome.action.setBadgeBackgroundColor({ color: '#8b5cf6' });
        } else {
            chrome.action.setBadgeText({ text: '' });
        }
    } catch (error) {
        console.error('Error updating badge:', error);
    }
}

async function sendReviewNotification() {
    try {
        const result = await chrome.storage.local.get(['lexi_settings']);
        const settings = result.lexi_settings || { remindersEnabled: false };
        if (!settings.remindersEnabled) return;

        const dueWords = await StorageService.getDueWords();
        if (dueWords.length === 0) return;

        const word = dueWords[Math.floor(Math.random() * dueWords.length)];

        chrome.notifications.create(`lexi_review_${Date.now()}`, {
            type: 'basic',
            iconUrl: chrome.runtime.getURL('src/assets/icon128.png'),
            title: 'Time to practice with Lexi 😄',
            message: `Review "${word.word}" - ${dueWords.length} word${dueWords.length > 1 ? 's' : ''} waiting`,
            priority: 2
        });
    } catch (error) {
        console.error('Error sending notification:', error);
    }
}
