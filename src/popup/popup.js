import { StorageService } from '../lib/storage.js';
import { DictionaryService } from '../lib/dictionary.js';
import { FrequencyService } from '../lib/frequency.js';

// State
let allWordsCache = [];
let wordsListInitialized = false;
let currentSortMethod = 'alphabetical';

// DOM Elements
const tabs = {
    practice: document.getElementById('tab-practice'),
    words: document.getElementById('tab-words'),
    stats: document.getElementById('tab-stats'),
    add: document.getElementById('tab-add')
};
const views = {
    practice: document.getElementById('view-practice'),
    words: document.getElementById('view-words'),
    stats: document.getElementById('view-stats'),
    add: document.getElementById('view-add')
};

// Practice View Elements
const practiceEmpty = document.getElementById('practice-empty');
const practiceDue = document.getElementById('practice-due');
const dueCountEl = document.getElementById('due-count');
const startSessionBtn = document.getElementById('start-session-btn');

// Toast
const toast = document.getElementById('toast');

// Add Form Elements
const addForm = document.getElementById('add-word-form');

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    setupTabs();
    setupAddForm();
    setupPracticeFlow();
    setupSettings();
    await loadPracticeStatus();
});

function setupSettings() {
    const settingsBtn = document.getElementById('settings-btn');
    settingsBtn.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });
}

function setupTabs() {
    tabs.practice.addEventListener('click', () => switchTab('practice'));
    tabs.words.addEventListener('click', () => switchTab('words'));
    tabs.stats.addEventListener('click', () => switchTab('stats'));
    tabs.add.addEventListener('click', () => switchTab('add'));
}

async function switchTab(tabName) {
    Object.values(tabs).forEach(t => t.classList.remove('active'));
    tabs[tabName].classList.add('active');

    Object.values(views).forEach(v => v.classList.remove('active'));
    views[tabName].classList.add('active');

    if (tabName === 'practice') {
        await loadPracticeStatus();
    }
    if (tabName === 'words') {
        await loadWordsList();
    }
    if (tabName === 'stats') {
        await loadStats();
    }
}

async function loadPracticeStatus() {
    const dueWords = await StorageService.getDueWords();

    if (dueWords.length === 0) {
        practiceEmpty.classList.remove('hidden');
        practiceDue.classList.add('hidden');
    } else {
        practiceEmpty.classList.add('hidden');
        practiceDue.classList.remove('hidden');
        dueCountEl.textContent = dueWords.length;
    }
}

function setupPracticeFlow() {
    startSessionBtn.addEventListener('click', () => {
        // Open the assessment page in a new tab
        chrome.tabs.create({
            url: chrome.runtime.getURL('src/pages/assessment.html')
        });
    });
}

// ============ ADD WORD ============
function setupAddForm() {
    const lookupBtn = document.getElementById('lookup-btn');
    const wordInput = document.getElementById('word');
    const definitionInput = document.getElementById('definition');
    const exampleInput = document.getElementById('example');

    // Lookup button handler
    lookupBtn.addEventListener('click', async () => {
        const word = wordInput.value.trim();
        if (!word) {
            showToast('Please enter a word first.', 'warning');
            return;
        }

        lookupBtn.disabled = true;
        lookupBtn.textContent = '...';

        try {
            const result = await DictionaryService.lookup(word);
            if (result) {
                definitionInput.value = result.definition;
                exampleInput.value = result.example || '';
                showToast('Definition found', 'success');
            } else {
                showToast('Word not found.', 'warning');
            }
        } catch (error) {
            console.error('Lookup error:', error);
            showToast('Lookup failed.', 'error');
        } finally {
            lookupBtn.disabled = false;
            lookupBtn.textContent = '🔍';
        }
    });

    // Form submit handler
    addForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const word = wordInput.value.trim();
        const definition = definitionInput.value;
        const example = exampleInput.value;

        // Check for duplicate
        const allWords = await StorageService.getAllWords();
        const exists = allWords.some(w => w.word.toLowerCase() === word.toLowerCase());

        if (exists) {
            showToast(`"${word}" is already in your library!`, 'warning');
            return;
        }

        await StorageService.addWord(word, definition, example);
        addForm.reset();
        showToast('Word saved', 'success');
    });
}

// ============ WORDS LIST ============
async function loadWordsList() {
    allWordsCache = await StorageService.getAllWords();

    // Ensure all words have frequency data
    allWordsCache = allWordsCache.map(word => {
        if (!word.frequency) {
            word.frequency = FrequencyService.getFrequency(word.word);
        }
        return word;
    });

    renderWordsList(allWordsCache);

    if (!wordsListInitialized) {
        setupWordsListEvents();
        setupWordsSearch();
        setupWordsSorting();
        wordsListInitialized = true;
    }
}

function setupWordsListEvents() {
    const wordsList = document.getElementById('words-list');
    wordsList.addEventListener('click', async (e) => {
        if (e.target.closest('.delete-btn')) {
            e.stopPropagation();
            const id = e.target.closest('.delete-btn').dataset.id;
            if (confirm('Delete this word?')) {
                await StorageService.deleteWord(id);
                allWordsCache = allWordsCache.filter(w => w.id !== id);
                renderWordsList(allWordsCache);
                showToast('Word deleted', 'success');
            }
        }
    });
}

function setupWordsSearch() {
    const searchInput = document.getElementById('word-search');
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
            renderWordsList(allWordsCache);
        } else {
            const filtered = allWordsCache.filter(w =>
                w.word.toLowerCase().includes(query) ||
                w.definition.toLowerCase().includes(query)
            );
            renderWordsList(filtered);
        }
    });
}

function setupWordsSorting() {
    const sortSelect = document.getElementById('sort-select');
    sortSelect.addEventListener('change', (e) => {
        currentSortMethod = e.target.value;
        renderWordsList(allWordsCache);
    });
}

function sortWords(words, method) {
    const sorted = [...words];
    const now = Date.now();

    switch (method) {
        case 'alphabetical':
            return sorted.sort((a, b) => a.word.localeCompare(b.word));
        case 'frequency':
            return sorted.sort((a, b) => FrequencyService.compareByFrequency(a, b));
        case 'date-new':
            return sorted.sort((a, b) => b.createdAt - a.createdAt);
        case 'date-old':
            return sorted.sort((a, b) => a.createdAt - b.createdAt);
        case 'due':
            return sorted.sort((a, b) => {
                const dueA = a.nextReview <= now ? 0 : a.nextReview;
                const dueB = b.nextReview <= now ? 0 : b.nextReview;
                return dueA - dueB;
            });
        default:
            return sorted;
    }
}

function renderWordsList(words) {
    const wordsList = document.getElementById('words-list');
    const wordsEmpty = document.getElementById('words-empty');

    if (words.length === 0) {
        wordsList.innerHTML = '';
        wordsEmpty.classList.remove('hidden');
        return;
    }

    wordsEmpty.classList.add('hidden');
    const sorted = sortWords(words, currentSortMethod);
    const now = Date.now();

    wordsList.innerHTML = sorted.map(word => {
        const freq = word.frequency || FrequencyService.getFrequency(word.word);
        const isDue = word.nextReview <= now;
        const dueClass = isDue ? 'due-now' : '';
        const badgeHtml = FrequencyService.getBadgeHTML(freq);

        return `
    <div class="word-item ${dueClass}" data-id="${word.id}">
      <div class="word-item-header">
        <span class="word-item-title">${escapeHtml(word.word)}</span>
        <div class="word-item-actions">
          ${badgeHtml}
          <span class="word-item-meta">${getTimeAgo(word.createdAt)}</span>
          <button class="delete-btn" data-id="${word.id}" title="Delete">✕</button>
        </div>
      </div>
    </div>
  `;
    }).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d`;
    if (days < 30) return `${Math.floor(days / 7)}w`;
    return `${Math.floor(days / 30)}mo`;
}

// ============ STATS ============
async function loadStats() {
    const stats = await StorageService.getStats();

    document.getElementById('streak-value').textContent = stats.streak;
    document.getElementById('total-words').textContent = stats.totalWords;
    document.getElementById('due-words').textContent = stats.dueWords;
    document.getElementById('mastered-words').textContent = stats.masteredWords;
    document.getElementById('reviews-today').textContent = stats.reviewsToday;

    const progressPercent = stats.totalWords > 0
        ? Math.round((stats.masteredWords / stats.totalWords) * 100)
        : 0;
    document.getElementById('mastery-progress').style.width = `${progressPercent}%`;
    document.getElementById('progress-text').textContent = `${progressPercent}% of words mastered`;
}

function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.className = 'toast ' + type;
    void toast.offsetWidth;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
