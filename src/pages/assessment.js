import { StorageService, REVIEW_MODES } from '../lib/storage.js';
import { AIService } from '../lib/ai.js';

// State
let sessionWords = [];
let currentIndex = 0;
let currentWord = null;
let currentQuestionData = null;
let currentMode = null;

// DOM Elements
const elements = {
    // Header
    progressBar: document.getElementById('session-progress'),
    progressText: document.getElementById('progress-text'),
    closeBtn: document.getElementById('close-btn'),

    // Main Areas
    loadingState: document.getElementById('loading-state'),
    finishedState: document.getElementById('finished-state'),
    questionContainer: document.getElementById('question-container'),

    // Question Parts
    modeBadge: document.getElementById('mode-badge'),
    targetWord: document.getElementById('target-word'),
    instruction: document.getElementById('instruction'),
    questionContent: document.getElementById('question-content'),

    // Action Area
    feedbackDisplay: document.getElementById('feedback-display'),
    feedbackResult: document.getElementById('feedback-result'),
    feedbackDetail: document.getElementById('feedback-detail'),
    checkBtn: document.getElementById('check-btn'),
    skipBtn: document.getElementById('skip-btn'),
    nextBtn: document.getElementById('next-btn'), // Note: Usually hidden, flow is auto or click to proceed?
    // For this design, let's have Check -> Show Feedback + Next Button

    // Finished State
    sessionStats: document.getElementById('session-stats'),
    closeSessionBtn: document.getElementById('close-session-btn')
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    setupEvents();
    await startSession();
});

function setupEvents() {
    elements.closeBtn.addEventListener('click', () => window.close());
    elements.closeSessionBtn.addEventListener('click', () => window.close());

    elements.checkBtn.addEventListener('click', handleCheck);
    elements.skipBtn.addEventListener('click', handleSkip);
    elements.nextBtn.addEventListener('click', advanceToNext);
}

async function startSession() {
    // 1. Get words due for review
    const dueWords = await StorageService.getDueWords();

    if (dueWords.length === 0) {
        showFinishedState();
        return;
    }

    sessionWords = dueWords;
    currentIndex = 0;

    updateProgress();
    showQuestion();
}

function updateProgress() {
    const total = sessionWords.length;
    const current = currentIndex;
    const percent = Math.round((current / total) * 100);

    elements.progressBar.style.width = `${percent}%`;
    elements.progressText.textContent = `${current}/${total}`;
}

async function showQuestion() {
    // Show loading if needed? Usually fast enough.
    elements.loadingState.classList.add('hidden');
    elements.finishedState.classList.add('hidden');
    elements.questionContainer.classList.remove('hidden');

    // Reset state
    clearFeedback();
    elements.checkBtn.classList.remove('hidden');
    elements.skipBtn.classList.remove('hidden');
    elements.nextBtn.classList.add('hidden');
    elements.checkBtn.disabled = true; // Disabled until interaction

    currentWord = sessionWords[currentIndex];
    elements.targetWord.textContent = currentWord.word;

    // Select Mode
    currentMode = selectReviewMode(currentWord);

    // Setup UI for Mode
    await renderMode(currentMode);
}

function selectReviewMode(word) {
    // Logic copied/adapted from popup.js
    const repetition = word.repetition || 0;
    const lastMode = word.lastReviewMode;
    const earlyModes = [REVIEW_MODES.MCQ, REVIEW_MODES.CLOZE];
    const lateModes = [REVIEW_MODES.PRODUCTION, REVIEW_MODES.REWRITE];
    const allModes = [...earlyModes, ...lateModes];

    let modePool;
    if (repetition <= 1) modePool = earlyModes;
    else if (repetition <= 3) modePool = allModes;
    else modePool = lateModes;

    let availableModes = modePool.filter(m => m !== lastMode);
    if (availableModes.length === 0) availableModes = modePool;

    return availableModes[Math.floor(Math.random() * availableModes.length)];
}

async function renderMode(mode) {
    elements.loadingState.classList.remove('hidden');
    elements.questionContainer.classList.add('hidden');

    try {
        switch (mode) {
            case REVIEW_MODES.CLOZE:
                await setupCloze();
                break;
            case REVIEW_MODES.MCQ:
                await setupMCQ();
                break;
            case REVIEW_MODES.PRODUCTION:
                setupProduction();
                break;
            case REVIEW_MODES.REWRITE:
                await setupRewrite();
                break;
        }
        elements.loadingState.classList.add('hidden');
        elements.questionContainer.classList.remove('hidden');
    } catch (err) {
        console.error("Error setting up mode:", err);
        // Fallback to production if generation fails
        currentMode = REVIEW_MODES.PRODUCTION;  // Update mode so checkHandler uses correct logic
        setupProduction();
        elements.loadingState.classList.add('hidden');
        elements.questionContainer.classList.remove('hidden');
    }
}

// --- Mode Setups ---

async function setupCloze() {
    elements.modeBadge.textContent = "Fill in the Blank";
    elements.instruction.textContent = "Select the correct word to complete the sentence.";

    const data = await AIService.generateClozeQuestion(currentWord.word, currentWord.definition);
    currentQuestionData = data;

    // Replace blank with pill
    const sentenceHtml = data.sentence.replace('_____', `<span class="cloze-blank"></span>`);

    const optionsHtml = data.options.map(opt =>
        `<button class="option-btn" data-value="${opt}">${opt}</button>`
    ).join('');

    elements.questionContent.innerHTML = `
        <div class="cloze-sentence">${sentenceHtml}</div>
        <div class="cloze-options">${optionsHtml}</div>
    `;

    // Add interactions
    const opts = elements.questionContent.querySelectorAll('.option-btn');
    opts.forEach(btn => {
        btn.addEventListener('click', () => {
            opts.forEach(o => o.classList.remove('selected'));
            btn.classList.add('selected');
            elements.checkBtn.disabled = false;
        });
    });
}

async function setupMCQ() {
    elements.modeBadge.textContent = "Multiple Choice";
    elements.instruction.textContent = "Choose the correct meaning in this context.";

    const data = await AIService.generateMCQQuestion(currentWord.word, currentWord.definition);
    currentQuestionData = data;

    // Highlight word in sentence
    const regex = new RegExp(`(${currentWord.word})`, 'gi');
    const sentenceHtml = data.sentence.replace(regex, `<span style="color: var(--primary); font-weight: bold;">$1</span>`);

    const optionsHtml = data.options.map(opt =>
        `<button class="option-btn" data-value="${opt}">${opt}</button>`
    ).join('');

    elements.questionContent.innerHTML = `
        <div class="mcq-prompt">"${sentenceHtml}"</div>
        <p style="margin-bottom: 1rem; font-weight:500;">${data.question}</p>
        <div class="cloze-options" style="grid-template-columns: 1fr;">${optionsHtml}</div>
    `;

    const opts = elements.questionContent.querySelectorAll('.option-btn');
    opts.forEach(btn => {
        btn.addEventListener('click', () => {
            opts.forEach(o => o.classList.remove('selected'));
            btn.classList.add('selected');
            elements.checkBtn.disabled = false;
        });
    });
}

function setupProduction() {
    elements.modeBadge.textContent = "Write a Sentence";
    elements.instruction.textContent = "Write a sentence using this word correctly.";
    currentQuestionData = null;

    elements.questionContent.innerHTML = `
        <div class="input-area">
             <textarea id="answer-input" placeholder="Type your sentence here..."></textarea>
        </div>
    `;

    const input = document.getElementById('answer-input');
    input.addEventListener('input', () => {
        elements.checkBtn.disabled = input.value.trim().length === 0;
    });
    // Auto focus
    setTimeout(() => input.focus(), 100);
}

async function setupRewrite() {
    elements.modeBadge.textContent = "Rewrite Sentence";
    elements.instruction.textContent = "Rewrite the sentence to change its tone or structure as requested.";

    const data = await AIService.generateRewritePrompt(currentWord.word, currentWord.definition);
    currentQuestionData = data;

    const regex = new RegExp(`(${currentWord.word})`, 'gi');
    const originalHtml = data.original_sentence.replace(regex, `<span style="color: var(--primary); font-weight: bold;">$1</span>`);

    elements.questionContent.innerHTML = `
        <div class="cloze-sentence" style="font-style: italic; margin-bottom: 1rem;">"${originalHtml}"</div>
        <p style="margin-bottom: 1rem; color: var(--text);"><strong>Goal:</strong> ${data.instruction}</p>
        <div class="input-area">
             <textarea id="answer-input" placeholder="Rewrite here..."></textarea>
        </div>
    `;

    const input = document.getElementById('answer-input');
    input.addEventListener('input', () => {
        elements.checkBtn.disabled = input.value.trim().length === 0;
    });
    setTimeout(() => input.focus(), 100);
}

// --- Handling Checks ---

async function handleCheck() {
    elements.checkBtn.disabled = true;
    elements.checkBtn.textContent = "Checking...";

    try {
        let result;
        if (currentMode === REVIEW_MODES.CLOZE) {
            result = checkCloze();
        } else if (currentMode === REVIEW_MODES.MCQ) {
            result = checkMCQ();
        } else if (currentMode === REVIEW_MODES.PRODUCTION) {
            result = await checkProduction();
        } else if (currentMode === REVIEW_MODES.REWRITE) {
            result = await checkRewrite();
        }

        showFeedback(result);

        // Save Result
        await StorageService.processReview(currentWord.id, result.score);
        await StorageService.updateLastReviewMode(currentWord.id, currentMode);

    } catch (e) {
        console.error(e);
        alert("Something went wrong checking the answer.");
        elements.checkBtn.disabled = false;
        elements.checkBtn.textContent = "Check Answer";
    }
}

async function handleSkip() {
    // Show the definition and mark as "didn't know"
    const definition = currentWord.definition || 'No definition available';
    const example = currentWord.example || '';

    // Build the help content
    let helpContent = `
        <div class="skip-help" style="text-align: left;">
            <p style="color: var(--text-muted); margin-bottom: 0.5rem;">📖 <strong>Definition:</strong></p>
            <p style="margin-bottom: 1rem; padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px;">${definition}</p>
    `;

    if (example) {
        helpContent += `
            <p style="color: var(--text-muted); margin-bottom: 0.5rem;">💡 <strong>Example:</strong></p>
            <p style="font-style: italic; margin-bottom: 1rem; padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px;">"${example}"</p>
        `;
    }

    if (currentWord.context?.sentence) {
        helpContent += `
            <p style="color: var(--text-muted); margin-bottom: 0.5rem;">📍 <strong>Where you found it:</strong></p>
            <p style="font-style: italic; margin-bottom: 1rem; padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px;">"${currentWord.context.sentence}"</p>
        `;
    }

    helpContent += `</div>`;

    elements.questionContent.innerHTML = helpContent;

    // Show feedback with encouragement
    showFeedback({
        score: 1,
        isCorrect: false,
        title: "No worries! 💪",
        message: "This word will come back soon. Take a moment to review the definition above."
    });

    // Process with score 1 - this resets the SRS interval
    // Word will appear again in ~1 day
    await StorageService.processReview(currentWord.id, 1);
    await StorageService.updateLastReviewMode(currentWord.id, currentMode);
}

function checkCloze() {
    const selectedBtn = elements.questionContent.querySelector('.option-btn.selected');
    if (!selectedBtn || !currentQuestionData) {
        throw new Error('No answer selected or question data missing');
    }
    const answer = selectedBtn.dataset.value;
    const isCorrect = answer.toLowerCase() === currentQuestionData.answer.toLowerCase();

    // UI Update
    const opts = elements.questionContent.querySelectorAll('.option-btn');
    opts.forEach(btn => {
        const val = btn.dataset.value;
        if (val.toLowerCase() === currentQuestionData.answer.toLowerCase()) btn.classList.add('correct');
        else if (btn.classList.contains('selected')) btn.classList.add('incorrect');
    });

    // Fill blank
    const blank = elements.questionContent.querySelector('.cloze-blank');
    if (blank) {
        blank.textContent = currentQuestionData.answer;
        blank.classList.add('filled');
    }

    return {
        score: isCorrect ? 5 : 2,
        isCorrect,
        title: isCorrect ? "Correct!" : "Not quite",
        message: isCorrect ? "Great job!" : `The correct answer was "${currentQuestionData.answer}".`
    };
}

function checkMCQ() {
    const selectedBtn = elements.questionContent.querySelector('.option-btn.selected');
    if (!selectedBtn || !currentQuestionData) {
        throw new Error('No answer selected or question data missing');
    }
    const answer = selectedBtn.dataset.value;
    const isCorrect = answer === currentQuestionData.correctAnswer;

    const opts = elements.questionContent.querySelectorAll('.option-btn');
    opts.forEach(btn => {
        const val = btn.dataset.value;
        if (val === currentQuestionData.correctAnswer) btn.classList.add('correct');
        else if (btn.classList.contains('selected')) btn.classList.add('incorrect');
    });

    return {
        score: isCorrect ? 5 : 2,
        isCorrect,
        title: isCorrect ? "Correct!" : "Incorrect",
        message: isCorrect ? "Good understanding of the context." : `The correct meaning is "${currentQuestionData.correctAnswer}".`
    };
}

async function checkProduction() {
    const input = document.getElementById('answer-input');
    const sentence = input.value;

    try {
        const result = await AIService.evaluateSentence(
            currentWord.word,
            currentWord.definition,
            sentence,
            currentWord.context
        );

        return {
            score: result.score,
            isCorrect: result.score >= 3,
            title: getTitleForScore(result.score),
            message: result.feedback
        };
    } catch (error) {
        console.error('AI evaluation failed, using self-grade:', error);
        // Fallback to self-grading when AI is unavailable
        return await showSelfGradeDialog(sentence);
    }
}

async function checkRewrite() {
    const input = document.getElementById('answer-input');
    const sentence = input.value;

    try {
        const result = await AIService.evaluateSentence(
            currentWord.word,
            currentWord.definition,
            sentence,
            currentWord.context
        );

        return {
            score: result.score,
            isCorrect: result.score >= 3,
            title: getTitleForScore(result.score),
            message: result.feedback
        };
    } catch (error) {
        console.error('AI evaluation failed, using self-grade:', error);
        return await showSelfGradeDialog(sentence);
    }
}

// Self-grading dialog when AI is unavailable
async function showSelfGradeDialog(userSentence) {
    return new Promise((resolve) => {
        elements.questionContent.innerHTML = `
            <div class="self-grade-container">
                <p style="margin-bottom: 0.5rem; color: var(--text-muted);">⚠️ AI unavailable. Please rate your own answer:</p>
                <div class="user-sentence" style="background: var(--bg-secondary); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; font-style: italic;">
                    "${userSentence}"
                </div>
                <p style="margin-bottom: 0.5rem;">Did you use <strong>"${currentWord.word}"</strong> correctly?</p>
                <div class="self-grade-options" style="display: flex; gap: 0.5rem;">
                    <button class="grade-btn" data-score="5" style="flex: 1; padding: 0.75rem; border: none; border-radius: 8px; background: var(--success); color: white; cursor: pointer;">✓ Correct</button>
                    <button class="grade-btn" data-score="3" style="flex: 1; padding: 0.75rem; border: none; border-radius: 8px; background: var(--warning); color: white; cursor: pointer;">~ Unsure</button>
                    <button class="grade-btn" data-score="1" style="flex: 1; padding: 0.75rem; border: none; border-radius: 8px; background: var(--error); color: white; cursor: pointer;">✗ Wrong</button>
                </div>
            </div>
        `;

        elements.checkBtn.classList.add('hidden');

        elements.questionContent.querySelectorAll('.grade-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const score = parseInt(btn.dataset.score);
                resolve({
                    score,
                    isCorrect: score >= 3,
                    title: score >= 5 ? "Self-rated: Correct" : score >= 3 ? "Self-rated: Partial" : "Self-rated: Needs work",
                    message: "AI feedback unavailable. Your self-assessment was recorded."
                });
            });
        });
    });
}

function getTitleForScore(score) {
    if (score >= 5) return "Excellent!";
    if (score >= 4) return "Great job!";
    if (score >= 3) return "Good attempt";
    return "Needs improvement";
}

function showFeedback(result) {
    elements.checkBtn.classList.add('hidden');
    elements.skipBtn.classList.add('hidden');
    elements.checkBtn.textContent = "Check Answer"; // Reset text
    elements.nextBtn.classList.remove('hidden');

    elements.feedbackDisplay.classList.remove('hidden');

    elements.feedbackResult.textContent = result.title;
    elements.feedbackResult.className = 'feedback-result ' + (result.isCorrect ? 'success' : 'error');

    elements.feedbackDetail.textContent = result.message;
}

function clearFeedback() {
    elements.feedbackDisplay.classList.add('hidden');
    elements.questionContainer.querySelectorAll('.option-btn').forEach(b => {
        b.classList.remove('correct', 'incorrect', 'selected');
    });
    // Inputs cleared by re-render
}

function advanceToNext() {
    currentIndex++;
    updateProgress();

    if (currentIndex >= sessionWords.length) {
        showFinishedState();
    } else {
        showQuestion();
    }
}

function showFinishedState() {
    elements.questionContainer.classList.add('hidden');
    elements.loadingState.classList.add('hidden');
    elements.finishedState.classList.remove('hidden');

    elements.sessionStats.textContent = `You reviewed ${sessionWords.length} words today.`;

    // Trigger confetti? Maybe later.
}
