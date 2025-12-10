import { StorageService } from '../lib/storage.js';
import { AIService } from '../lib/ai.js';
import { DictionaryService } from '../lib/dictionary.js';

// State
let currentWord = null;
let dueWords = [];
let peekCount = 0;

// DOM Elements
const tabs = {
    practice: document.getElementById('tab-practice'),
    words: document.getElementById('tab-words'),
    add: document.getElementById('tab-add')
};
const views = {
    practice: document.getElementById('view-practice'),
    words: document.getElementById('view-words'),
    add: document.getElementById('view-add')
};

// Practice Elements
const practiceEmpty = document.getElementById('practice-empty');
const practiceContent = document.getElementById('practice-content');
const targetWordEl = document.getElementById('target-word');
const sentenceInput = document.getElementById('sentence-input');
const checkBtn = document.getElementById('check-btn');
const feedbackArea = document.getElementById('feedback-area');
const scoreBadge = document.getElementById('score-badge');
const scoreValue = document.getElementById('score-value');
const scoreTitle = document.getElementById('score-title');
const feedbackText = document.getElementById('feedback-text');
const suggestionsList = document.getElementById('suggestions-list');
const nextBtn = document.getElementById('next-btn');

// Definition Reveal Elements
const revealBtn = document.getElementById('reveal-definition');
const definitionContainer = document.getElementById('definition-container');
const definitionDisplay = document.getElementById('definition-display');

// Theme Toggle
const themeToggle = document.getElementById('theme-toggle');

// Toast
const toast = document.getElementById('toast');

// Add Form Elements
const addForm = document.getElementById('add-word-form');

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    setupTheme();
    setupTabs();
    setupAddForm();
    setupPracticeFlow();
    setupDefinitionReveal();
    await loadPracticeWords();
});

function setupTabs() {
    tabs.practice.addEventListener('click', () => switchTab('practice'));
    tabs.words.addEventListener('click', () => switchTab('words'));
    tabs.add.addEventListener('click', () => switchTab('add'));
}

function switchTab(tabName) {
    Object.values(tabs).forEach(t => t.classList.remove('active'));
    tabs[tabName].classList.add('active');

    Object.values(views).forEach(v => v.classList.remove('active'));
    views[tabName].classList.add('active');

    // Only reload if switching back and no current word (prevents resetting mid-practice)
    if (tabName === 'practice' && !currentWord) {
        loadPracticeWords();
    }
    if (tabName === 'words') {
        loadWordsList();
    }
}

async function loadPracticeWords() {
    dueWords = await StorageService.getDueWords();

    if (dueWords.length === 0) {
        practiceEmpty.classList.remove('hidden');
        practiceContent.classList.add('hidden');
        currentWord = null;
    } else {
        practiceEmpty.classList.add('hidden');
        practiceContent.classList.remove('hidden');
        showNextWord();
    }
}

function showNextWord() {
    if (dueWords.length === 0) {
        loadPracticeWords();
        return;
    }

    currentWord = dueWords[0];
    peekCount = 0; // Reset peek count for new word

    targetWordEl.textContent = currentWord.word;
    definitionDisplay.textContent = currentWord.definition;

    // Reset UI state
    sentenceInput.value = '';
    feedbackArea.classList.add('hidden');
    checkBtn.classList.remove('hidden');
    checkBtn.disabled = false;
    checkBtn.textContent = 'Check Sentence';

    // Reset definition reveal
    revealBtn.classList.remove('open');
    revealBtn.querySelector('span').textContent = 'Show definition';
    definitionContainer.classList.remove('show');
}

function setupDefinitionReveal() {
    revealBtn.addEventListener('click', async () => {
        const isOpen = definitionContainer.classList.contains('show');

        if (isOpen) {
            definitionContainer.classList.remove('show');
            revealBtn.classList.remove('open');
            revealBtn.querySelector('span').textContent = 'Show definition';
        } else {
            // Check if definition is missing or empty
            if (!currentWord.definition || currentWord.definition.trim() === '') {
                // Fetch definition from dictionary API
                revealBtn.disabled = true;
                revealBtn.querySelector('span').textContent = 'Loading...';

                try {
                    let definition = '';

                    // Try dictionary API first
                    // Try dictionary API first
                    const result = await DictionaryService.lookup(currentWord.word);
                    if (result && result.definition) {
                        definition = result.definition;
                    } else {
                        // Fallback to AI definition
                        definition = await AIService.getDefinition(currentWord.word);
                        if (!definition) {
                            throw new Error('No definition available');
                        }
                    }

                    // Update the word in storage
                    if (definition) {
                        const allWords = await StorageService.getAllWords();
                        const wordIndex = allWords.findIndex(w => w.id === currentWord.id);
                        if (wordIndex !== -1) {
                            allWords[wordIndex].definition = definition;
                            await StorageService.saveWords(allWords);
                            currentWord.definition = definition;
                            definitionDisplay.textContent = definition;
                        }
                    }
                    showToast('Definition loaded', 'success');
                } catch (error) {
                    console.error('Definition lookup error:', error);
                    definitionDisplay.textContent = 'Failed to load definition.';
                    showToast('Failed to load definition', 'error');
                } finally {
                    revealBtn.disabled = false;
                    revealBtn.querySelector('span').textContent = 'Hide definition';
                }
            }

            definitionContainer.classList.add('show');
            revealBtn.classList.add('open');
            revealBtn.querySelector('span').textContent = 'Hide definition';
            peekCount++;

            // Visual feedback for peeking (subtle indicator)
            if (peekCount >= 3) {
                showToast("You've peeked 3+ times. This affects your score!", 'warning');
            }
        }
    });
}

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
        lookupBtn.classList.add('loading');
        lookupBtn.textContent = '...';

        try {
            const result = await DictionaryService.lookup(word);
            if (result) {
                definitionInput.value = result.definition;
                exampleInput.value = result.example || '';
                showToast('Definition found', 'success');
            } else {
                showToast('Word not found. Try a different spelling.', 'warning');
            }
        } catch (error) {
            console.error('Lookup error:', error);
            showToast('Lookup failed. Please try again.', 'error');
        } finally {
            lookupBtn.disabled = false;
            lookupBtn.classList.remove('loading');
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

function setupPracticeFlow() {
    checkBtn.addEventListener('click', async () => {
        const sentence = sentenceInput.value.trim();
        if (!sentence) {
            showToast('Please write a sentence first.', 'warning');
            return;
        }

        checkBtn.disabled = true;
        checkBtn.textContent = 'Analyzing...';

        try {
            const result = await AIService.evaluateSentence(currentWord.word, currentWord.definition, sentence);

            // Adjust score based on peek count
            let adjustedScore = result.score;
            if (peekCount >= 3) {
                adjustedScore = Math.max(1, adjustedScore - 2);
                result.feedback = `(Score reduced due to definition peeks) ${result.feedback}`;
            } else if (peekCount >= 1) {
                adjustedScore = Math.max(1, adjustedScore - 1);
            }

            showFeedback({ ...result, score: adjustedScore });

            // Update SRS with adjusted score
            await StorageService.processReview(currentWord.id, adjustedScore);

            // Remove current word from local queue
            dueWords.shift();
        } catch (error) {
            console.error(error);
            showToast(error.message, 'error');
            checkBtn.disabled = false;
            checkBtn.textContent = 'Check Sentence';
        }
    });

    nextBtn.addEventListener('click', () => {
        showNextWord();
    });

    // Feedback Toggle
    const feedbackToggle = document.getElementById('feedback-toggle');
    const feedbackWrapper = document.getElementById('feedback-wrapper');

    feedbackToggle.addEventListener('click', () => {
        const isCollapsed = feedbackWrapper.classList.toggle('collapsed');
        feedbackToggle.querySelector('.icon-toggle').style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
    });
}

function showFeedback(result) {
    checkBtn.classList.add('hidden');
    feedbackArea.classList.remove('hidden');

    // Ensure expanded
    const feedbackWrapper = document.getElementById('feedback-wrapper');
    const feedbackToggle = document.getElementById('feedback-toggle');
    feedbackWrapper.classList.remove('collapsed');
    feedbackToggle.querySelector('.icon-toggle').style.transform = 'rotate(0deg)';

    // Update score badge with color based on score
    scoreBadge.className = 'score-badge score-' + result.score;
    scoreValue.textContent = result.score;

    // Score title based on score
    const titles = {
        5: 'Excellent!',
        4: 'Great!',
        3: 'Good',
        2: 'Needs Work',
        1: 'Try Again'
    };
    scoreTitle.textContent = titles[result.score] || 'Score';

    // Display reasoning (the WHY)
    const reasoningText = document.getElementById('reasoning-text');
    if (result.reasoning) {
        reasoningText.textContent = result.reasoning;
        reasoningText.classList.remove('hidden');
    } else {
        reasoningText.classList.add('hidden');
    }

    feedbackText.textContent = result.feedback;

    // Handle suggestions
    const suggestionsContainer = document.getElementById('suggestions-container');
    suggestionsList.innerHTML = '';
    if (result.suggestions && result.suggestions.length > 0) {
        result.suggestions.forEach(s => {
            const li = document.createElement('li');
            li.textContent = s;
            suggestionsList.appendChild(li);
        });
        suggestionsContainer.classList.remove('hidden');
    } else {
        suggestionsContainer.classList.add('hidden');
    }
}

function setupTheme() {
    // Load saved theme
    chrome.storage.local.get(['lexi_theme'], (result) => {
        const theme = result.lexi_theme || 'dark';
        if (theme === 'light') {
            document.documentElement.classList.add('light-mode');
            themeToggle.textContent = '☀️';
        }
    });

    // Toggle handler
    themeToggle.addEventListener('click', () => {
        const isLight = document.documentElement.classList.toggle('light-mode');
        themeToggle.textContent = isLight ? '☀️' : '🌙';
        chrome.storage.local.set({ lexi_theme: isLight ? 'light' : 'dark' });
    });
}

function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.className = 'toast ' + type;

    // Force reflow
    void toast.offsetWidth;

    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ============ WORDS LIST ============
let allWordsCache = [];
let wordsListInitialized = false;

async function loadWordsList() {
    allWordsCache = await StorageService.getAllWords();
    renderWordsList(allWordsCache);

    // Only set up event delegation once
    if (!wordsListInitialized) {
        setupWordsListEvents();
        setupWordsSearch();
        wordsListInitialized = true;
    }
}

function setupWordsListEvents() {
    const wordsList = document.getElementById('words-list');

    // Event delegation - one listener handles all clicks
    wordsList.addEventListener('click', async (e) => {
        // Handle delete button
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

function renderWordsList(words) {
    const wordsList = document.getElementById('words-list');
    const wordsEmpty = document.getElementById('words-empty');

    if (words.length === 0) {
        wordsList.innerHTML = '';
        wordsEmpty.classList.remove('hidden');
        return;
    }

    wordsEmpty.classList.add('hidden');

    // Sort alphabetically
    const sorted = [...words].sort((a, b) => a.word.localeCompare(b.word));

    wordsList.innerHTML = sorted.map(word => `
    <div class="word-item" data-id="${word.id}">
      <div class="word-item-header">
        <span class="word-item-title">${escapeHtml(word.word)}</span>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span class="word-item-meta">${getTimeAgo(word.createdAt)}</span>
          <button class="delete-btn icon-only" data-id="${word.id}" title="Delete word">🗑️</button>
        </div>
      </div>
    </div>
  `).join('');
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
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
}
