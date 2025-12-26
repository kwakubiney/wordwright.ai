/**
 * Lexi.ai Content Script
 * Extracts context from web pages when saving words
 * Also handles reminder banner display
 */

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_SELECTION_CONTEXT') {
        const context = getSelectionContext();
        sendResponse(context);
    }

    if (message.type === 'SHOW_REMINDER') {
        // Dynamically load and show reminder
        if (window.LexiReminder) {
            window.LexiReminder.show(message.dueCount);
        } else {
            // Load reminder script dynamically
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('src/content/reminder.js');
            script.onload = () => {
                if (window.LexiReminder) {
                    window.LexiReminder.show(message.dueCount);
                }
            };
            document.head.appendChild(script);
        }
    }

    return true; // Keep the message channel open for async response
});

/**
 * Get the context around the current text selection
 * @returns {Object} Context object with sentence, snippet, and page info
 */
function getSelectionContext() {
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0) {
        return {
            sentence: '',
            snippet: '',
            sourceUrl: window.location.href,
            pageTitle: document.title
        };
    }

    const selectedText = selection.toString().trim();
    const range = selection.getRangeAt(0);

    // Get the container element
    let container = range.commonAncestorContainer;
    if (container.nodeType === Node.TEXT_NODE) {
        container = container.parentNode;
    }

    // Find the sentence containing the selection
    const sentence = extractSentence(container, selectedText);

    // Get a larger snippet for more context
    const snippet = extractSnippet(container, selectedText);

    return {
        sentence: sentence,
        snippet: snippet,
        sourceUrl: window.location.href,
        pageTitle: document.title
    };
}

/**
 * Extract the sentence containing the selected text
 * @param {Element} container 
 * @param {string} selectedText 
 * @returns {string}
 */
function extractSentence(container, selectedText) {
    // Get all text content from the container
    const fullText = container.textContent || '';

    // Find the position of the selected text
    const position = fullText.toLowerCase().indexOf(selectedText.toLowerCase());
    if (position === -1) return selectedText;

    // Define sentence boundaries
    const sentenceEnders = /[.!?]/;

    // Find sentence start (look backwards)
    let start = position;
    while (start > 0 && !sentenceEnders.test(fullText[start - 1])) {
        start--;
    }

    // Find sentence end (look forwards)
    let end = position + selectedText.length;
    while (end < fullText.length && !sentenceEnders.test(fullText[end])) {
        end++;
    }
    // Include the sentence ender
    if (end < fullText.length) end++;

    // Extract and clean up the sentence
    let sentence = fullText.substring(start, end).trim();

    // Limit sentence length
    if (sentence.length > 500) {
        // Take 250 chars before and after the selected text
        const selPos = sentence.toLowerCase().indexOf(selectedText.toLowerCase());
        const contextStart = Math.max(0, selPos - 150);
        const contextEnd = Math.min(sentence.length, selPos + selectedText.length + 150);
        sentence = (contextStart > 0 ? '...' : '') +
            sentence.substring(contextStart, contextEnd) +
            (contextEnd < sentence.length ? '...' : '');
    }

    return sentence;
}

/**
 * Extract a larger text snippet for additional context
 * @param {Element} container 
 * @param {string} selectedText 
 * @returns {string}
 */
function extractSnippet(container, selectedText) {
    // Try to get paragraph-level context
    let paragraphContainer = container;

    // Walk up to find a paragraph or meaningful container
    while (paragraphContainer &&
        paragraphContainer.tagName !== 'P' &&
        paragraphContainer.tagName !== 'DIV' &&
        paragraphContainer.tagName !== 'ARTICLE' &&
        paragraphContainer.tagName !== 'SECTION' &&
        paragraphContainer.parentNode) {
        paragraphContainer = paragraphContainer.parentNode;
    }

    if (!paragraphContainer || paragraphContainer === document.body) {
        paragraphContainer = container;
    }

    let snippet = paragraphContainer.textContent || '';

    // Clean up whitespace
    snippet = snippet.replace(/\s+/g, ' ').trim();

    // Limit snippet length
    if (snippet.length > 800) {
        const selPos = snippet.toLowerCase().indexOf(selectedText.toLowerCase());
        if (selPos !== -1) {
            const contextStart = Math.max(0, selPos - 300);
            const contextEnd = Math.min(snippet.length, selPos + selectedText.length + 300);
            snippet = (contextStart > 0 ? '...' : '') +
                snippet.substring(contextStart, contextEnd) +
                (contextEnd < snippet.length ? '...' : '');
        } else {
            snippet = snippet.substring(0, 800) + '...';
        }
    }

    return snippet;
}
