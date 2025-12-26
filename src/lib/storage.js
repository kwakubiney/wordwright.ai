/**
 * Lexi.ai Storage & SRS Library
 * Handles word storage and Spaced Repetition System (SM-2 Algorithm)
 */

const STORAGE_KEY = 'lexi_words';

// SM-2 Algorithm Constants
const MIN_EFACTOR = 1.3;
const DEFAULT_EFACTOR = 2.5;

// Review mode types
export const REVIEW_MODES = {
  PRODUCTION: 'production',    // Write a sentence (current mode)
  CLOZE: 'cloze',              // Fill-in-the-blank
  MCQ: 'mcq',                  // Multiple choice - meaning in context
  REWRITE: 'rewrite'           // Rewrite a sentence
};

export const StorageService = {
  /**
   * Add a new word to storage
   * @param {string} word - The word to learn
   * @param {string} definition - Definition of the word
   * @param {string} example - Example sentence
   * @param {Object} context - Context where word was found (optional)
   * @param {string} context.sentence - The highlighted/selected sentence
   * @param {string} context.snippet - Surrounding text for more context
   * @param {string} context.sourceUrl - URL where word was found
   * @param {string} context.pageTitle - Title of the page
   */
  async addWord(word, definition, example, context = null) {
    const newWord = {
      id: crypto.randomUUID(),
      word,
      definition,
      example,
      createdAt: Date.now(),
      nextReview: Date.now(), // Ready for review immediately
      interval: 0,
      repetition: 0,
      efactor: DEFAULT_EFACTOR,
      history: [],
      // New fields for context intelligence
      context: context ? {
        sentence: context.sentence || '',
        snippet: context.snippet || '',
        sourceUrl: context.sourceUrl || '',
        pageTitle: context.pageTitle || '',
        capturedAt: Date.now()
      } : null,
      // Review mode tracking
      lastReviewMode: null,
      // Frequency data (will be populated by frequency service)
      frequency: null,
      // Example usages cache
      exampleUsages: []
    };

    const words = await this.getAllWords();
    words.push(newWord);
    await this.saveWords(words);
    return newWord;
  },

  /**
   * Get all words from storage
   */
  async getAllWords() {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        resolve(result[STORAGE_KEY] || []);
      });
    });
  },

  /**
   * Save words array to storage
   */
  async saveWords(words) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEY]: words }, resolve);
    });
  },

  /**
   * Get words that are due for review
   * Optionally prioritize by frequency (more common words first)
   */
  async getDueWords(prioritizeByFrequency = true) {
    const words = await this.getAllWords();
    const now = Date.now();
    const dueWords = words.filter(w => w.nextReview <= now);
    
    if (prioritizeByFrequency) {
      // Sort by frequency score (higher = more common = higher priority)
      // Words without frequency data go to the end
      return dueWords.sort((a, b) => {
        const freqA = a.frequency?.score ?? -1;
        const freqB = b.frequency?.score ?? -1;
        return freqB - freqA;
      });
    }
    
    return dueWords;
  },

  /**
   * Process a review for a word
   * @param {string} wordId 
   * @param {number} quality - 0-5 rating (5 = perfect, 0 = blackout)
   */
  async processReview(wordId, quality) {
    const words = await this.getAllWords();
    const wordIndex = words.findIndex(w => w.id === wordId);

    if (wordIndex === -1) return null;

    const word = words[wordIndex];

    // Calculate new SM-2 values
    let { interval, repetition, efactor } = word;

    if (quality >= 3) {
      if (repetition === 0) {
        interval = 1;
      } else if (repetition === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * efactor);
      }
      repetition += 1;
    } else {
      repetition = 0;
      interval = 1;
    }

    efactor = efactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (efactor < MIN_EFACTOR) efactor = MIN_EFACTOR;

    // Update word
    word.interval = interval;
    word.repetition = repetition;
    word.efactor = efactor;
    word.nextReview = Date.now() + (interval * 24 * 60 * 60 * 1000); // interval is in days
    word.history.push({ date: Date.now(), quality });

    words[wordIndex] = word;
    await this.saveWords(words);
    return word;
  },

  /**
   * Delete a word by ID
   */
  async deleteWord(wordId) {
    const words = await this.getAllWords();
    const filtered = words.filter(w => w.id !== wordId);
    await this.saveWords(filtered);
  },

  /**
   * Clear all data (for debugging)
   */
  async clearAll() {
    return new Promise((resolve) => {
      chrome.storage.local.remove([STORAGE_KEY], resolve);
    });
  },

  /**
   * Update a word's context information
   * @param {string} wordId 
   * @param {Object} context 
   */
  async updateContext(wordId, context) {
    const words = await this.getAllWords();
    const wordIndex = words.findIndex(w => w.id === wordId);
    if (wordIndex === -1) return null;

    words[wordIndex].context = {
      sentence: context.sentence || '',
      snippet: context.snippet || '',
      sourceUrl: context.sourceUrl || '',
      pageTitle: context.pageTitle || '',
      capturedAt: Date.now()
    };

    await this.saveWords(words);
    return words[wordIndex];
  },

  /**
   * Update a word's frequency data
   * @param {string} wordId 
   * @param {Object} frequency - { score: 0-10, label: string }
   */
  async updateFrequency(wordId, frequency) {
    const words = await this.getAllWords();
    const wordIndex = words.findIndex(w => w.id === wordId);
    if (wordIndex === -1) return null;

    words[wordIndex].frequency = frequency;
    await this.saveWords(words);
    return words[wordIndex];
  },

  /**
   * Update a word's example usages cache
   * @param {string} wordId 
   * @param {Array} usages - Array of { sentence, source, url }
   */
  async updateExampleUsages(wordId, usages) {
    const words = await this.getAllWords();
    const wordIndex = words.findIndex(w => w.id === wordId);
    if (wordIndex === -1) return null;

    words[wordIndex].exampleUsages = usages;
    words[wordIndex].exampleUsagesFetchedAt = Date.now();
    await this.saveWords(words);
    return words[wordIndex];
  },

  /**
   * Update the last review mode for a word
   * @param {string} wordId 
   * @param {string} mode 
   */
  async updateLastReviewMode(wordId, mode) {
    const words = await this.getAllWords();
    const wordIndex = words.findIndex(w => w.id === wordId);
    if (wordIndex === -1) return null;

    words[wordIndex].lastReviewMode = mode;
    await this.saveWords(words);
    return words[wordIndex];
  },

  /**
   * Get a single word by ID
   * @param {string} wordId 
   */
  async getWord(wordId) {
    const words = await this.getAllWords();
    return words.find(w => w.id === wordId) || null;
  },

  /**
   * Get statistics for the engagement layer
   */
  async getStats() {
    const words = await this.getAllWords();
    const now = Date.now();
    const today = new Date().setHours(0, 0, 0, 0);
    
    // Calculate streak
    const reviewDays = new Set();
    words.forEach(word => {
      word.history.forEach(h => {
        const day = new Date(h.date).setHours(0, 0, 0, 0);
        reviewDays.add(day);
      });
    });
    
    // Count reviews today
    const reviewsToday = words.reduce((count, word) => {
      return count + word.history.filter(h => h.date >= today).length;
    }, 0);

    // Calculate streak (consecutive days)
    const sortedDays = Array.from(reviewDays).sort((a, b) => b - a);
    let streak = 0;
    let checkDate = today;
    
    for (const day of sortedDays) {
      if (day === checkDate) {
        streak++;
        checkDate -= 24 * 60 * 60 * 1000;
      } else if (day < checkDate) {
        break;
      }
    }

    return {
      totalWords: words.length,
      dueWords: words.filter(w => w.nextReview <= now).length,
      masteredWords: words.filter(w => w.repetition >= 5).length,
      reviewsToday,
      streak,
      averageScore: words.length > 0 
        ? words.reduce((sum, w) => {
            const lastReview = w.history[w.history.length - 1];
            return sum + (lastReview?.quality || 0);
          }, 0) / words.length
        : 0
    };
  }
};
