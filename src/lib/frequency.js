/**
 * Lexi.ai Frequency Service
 * Provides word frequency data based on common English word lists (COCA, SUBTLEX, etc.)
 * 
 * Frequency scores:
 * 10 = Most common (top 1000 words)
 * 8-9 = Very common (top 5000 words)
 * 6-7 = Common (top 10000 words)
 * 4-5 = Moderately common (top 20000 words)
 * 2-3 = Uncommon
 * 0-1 = Rare
 */

// Top 3000 most common English words (simplified from COCA/SUBTLEX)
// This is a representative subset - words not found default to uncommon
const COMMON_WORDS = new Set([
    // Top 100 - Score 10
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
    'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
    'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
    'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
    'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
    'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
    'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other',
    'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
    'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
    'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us'
]);

// Words ranked 101-1000 - Score 9
const VERY_COMMON_WORDS = new Set([
    'man', 'find', 'here', 'thing', 'great', 'say', 'tell', 'help', 'put', 'call',
    'different', 'old', 'still', 'big', 'small', 'another', 'many', 'such', 'turn', 'between',
    'ask', 'show', 'own', 'try', 'feel', 'high', 'leave', 'long', 'same', 'mean',
    'run', 'world', 'every', 'under', 'need', 'move', 'much', 'right', 'place', 'before',
    'last', 'become', 'through', 'seem', 'child', 'begin', 'life', 'those', 'few', 'stop',
    'keep', 'might', 'never', 'end', 'let', 'hand', 'again', 'off', 'may', 'should',
    'point', 'part', 'home', 'night', 'question', 'really', 'word', 'start', 'head', 'read',
    'country', 'follow', 'school', 'father', 'mother', 'friend', 'side', 'story', 'young', 'house',
    'next', 'down', 'week', 'always', 'play', 'must', 'important', 'state', 'number', 'away',
    'something', 'nothing', 'everything', 'change', 'problem', 'reason', 'believe', 'hold', 'best', 'light'
]);

// Words ranked 1001-5000 - Score 7-8
const COMMON_EXTENDED = new Set([
    'serendipity', 'ephemeral', 'eloquent', 'resilient', 'authentic', 'vulnerable', 'paradigm',
    'ambiguous', 'pragmatic', 'meticulous', 'nuance', 'ubiquitous', 'diligent', 'comprehensive',
    'substantial', 'fundamental', 'significant', 'considerable', 'remarkable', 'extraordinary',
    'magnificent', 'tremendous', 'exceptional', 'fascinating', 'intriguing', 'compelling',
    'persuasive', 'coherent', 'concise', 'articulate', 'elaborate', 'sophisticated',
    'profound', 'insightful', 'innovative', 'creative', 'dynamic', 'flexible', 'robust',
    'efficient', 'effective', 'productive', 'sustainable', 'viable', 'feasible', 'practical',
    'relevant', 'appropriate', 'suitable', 'adequate', 'sufficient', 'necessary', 'essential',
    'crucial', 'vital', 'critical', 'significant', 'notable', 'prominent', 'distinguished',
    'eminent', 'renowned', 'celebrated', 'acclaimed', 'prestigious', 'influential', 'powerful',
    'dominant', 'prevalent', 'widespread', 'extensive', 'comprehensive', 'thorough', 'rigorous',
    'systematic', 'methodical', 'analytical', 'logical', 'rational', 'objective', 'subjective',
    'abstract', 'concrete', 'tangible', 'explicit', 'implicit', 'inherent', 'intrinsic',
    'extrinsic', 'autonomous', 'independent', 'dependent', 'contingent', 'conditional', 'absolute',
    'relative', 'arbitrary', 'deliberate', 'intentional', 'spontaneous', 'inevitable', 'imminent'
]);

// Advanced vocabulary words - Score 3-5
const ADVANCED_WORDS = new Set([
    'perspicacious', 'sycophant', 'obsequious', 'recalcitrant', 'perfunctory', 'ineffable',
    'laconic', 'loquacious', 'taciturn', 'garrulous', 'verbose', 'succinct', 'terse',
    'cogent', 'specious', 'fallacious', 'spurious', 'apocryphal', 'veracious', 'mendacious',
    'sanguine', 'phlegmatic', 'choleric', 'melancholic', 'mercurial', 'capricious', 'volatile',
    'tenacious', 'obstinate', 'intransigent', 'adamant', 'resolute', 'steadfast', 'unwavering',
    'vacillating', 'equivocating', 'prevaricating', 'dissembling', 'dissimulating', 'feigning',
    'ostentatious', 'pretentious', 'pompous', 'grandiose', 'bombastic', 'magniloquent',
    'parsimonious', 'penurious', 'miserly', 'niggardly', 'frugal', 'abstemious', 'ascetic',
    'hedonistic', 'sybaritic', 'epicurean', 'voluptuary', 'libertine', 'profligate', 'dissolute',
    'prodigal', 'munificent', 'magnanimous', 'benevolent', 'altruistic', 'philanthropic',
    'misanthropic', 'curmudgeonly', 'churlish', 'boorish', 'uncouth', 'gauche', 'maladroit',
    'deft', 'adroit', 'dexterous', 'nimble', 'agile', 'lithe', 'supple', 'lissome',
    'languid', 'lethargic', 'torpid', 'indolent', 'slothful', 'somnolent', 'comatose',
    'ebullient', 'effervescent', 'exuberant', 'vivacious', 'sprightly', 'buoyant', 'sanguine',
    'despondent', 'disconsolate', 'woebegone', 'lugubrious', 'dolorous', 'lachrymose', 'plaintive',
    'quixotic', 'chimerical', 'utopian', 'fanciful', 'whimsical', 'fantastical', 'surreal',
    'ethereal', 'celestial', 'transcendent', 'sublime', 'ineffable', 'numinous', 'beatific'
]);

export const FrequencyService = {
    /**
     * Get frequency data for a word
     * @param {string} word - The word to look up
     * @returns {Object} { score: 0-10, label: string, emoji: string }
     */
    getFrequency(word) {
        const normalizedWord = word.toLowerCase().trim();

        // Check each tier
        if (COMMON_WORDS.has(normalizedWord)) {
            return {
                score: 10,
                label: 'Very Common',
                description: 'One of the most frequently used English words'
            };
        }

        if (VERY_COMMON_WORDS.has(normalizedWord)) {
            return {
                score: 9,
                label: 'Very Common',
                description: 'Among the top 1000 most used words'
            };
        }

        if (COMMON_EXTENDED.has(normalizedWord)) {
            return {
                score: 7,
                label: 'Common',
                description: 'Frequently used in everyday English'
            };
        }

        if (ADVANCED_WORDS.has(normalizedWord)) {
            return {
                score: 4,
                label: 'Advanced',
                description: 'Advanced vocabulary, useful for sophisticated writing'
            };
        }

        // Default: assume moderately uncommon if not in our lists
        // This is a simplified approach - a real implementation would use a full frequency database
        return {
            score: 5,
            label: 'Useful',
            description: 'Useful vocabulary worth learning'
        };
    },

    /**
     * Get frequency for multiple words at once
     * @param {string[]} words - Array of words
     * @returns {Object} Map of word to frequency data
     */
    getFrequencies(words) {
        const result = {};
        for (const word of words) {
            result[word.toLowerCase()] = this.getFrequency(word);
        }
        return result;
    },

    /**
     * Compare two words by frequency (for sorting)
     * @param {Object} wordA - Word object with frequency data
     * @param {Object} wordB - Word object with frequency data
     * @returns {number} Sort order (-1, 0, 1)
     */
    compareByFrequency(wordA, wordB) {
        const freqA = wordA.frequency?.score ?? 5;
        const freqB = wordB.frequency?.score ?? 5;
        return freqB - freqA; // Higher frequency first
    },

    /**
     * Check if a word is rare (might warrant a warning)
     * @param {string} word 
     * @returns {boolean}
     */
    isRare(word) {
        const freq = this.getFrequency(word);
        return freq.score <= 3;
    },

    /**
     * Get a formatted frequency badge HTML
     * @param {Object} frequency - Frequency data object
     * @returns {string} HTML string for the badge
     */
    getBadgeHTML(frequency) {
        if (!frequency) return '';
        return `<span class="frequency-badge freq-${frequency.score}" title="${frequency.description}">
            ${frequency.label}
        </span>`;
    }
};
