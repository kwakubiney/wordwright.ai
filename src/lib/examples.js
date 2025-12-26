/**
 * Lexi.ai Example Usage Service
 * Provides real-world example sentences for vocabulary words
 * Uses a combination of built-in corpus and API lookups
 */

// Built-in example corpus for common vocabulary words
// Each word has multiple usage examples from different contexts
const EXAMPLE_CORPUS = {
    'serendipity': [
        { sentence: "Finding that rare book at the garage sale was pure serendipity.", source: "Common Usage" },
        { sentence: "The discovery of penicillin is often cited as an example of serendipity in science.", source: "Scientific History" },
        { sentence: "Their meeting was a moment of serendipity that changed both their lives.", source: "Literature" }
    ],
    'ephemeral': [
        { sentence: "The ephemeral beauty of cherry blossoms draws millions of visitors each spring.", source: "Nature Writing" },
        { sentence: "Social media fame can be ephemeral, lasting only until the next viral trend.", source: "Media Analysis" },
        { sentence: "The artist specialized in ephemeral installations that would disappear within days.", source: "Art Review" }
    ],
    'eloquent': [
        { sentence: "Her eloquent speech moved the entire audience to tears.", source: "News Report" },
        { sentence: "The author's eloquent prose brings the historical period vividly to life.", source: "Book Review" },
        { sentence: "He wasn't always eloquent, but his sincerity made up for any awkwardness.", source: "Biography" }
    ],
    'resilient': [
        { sentence: "The resilient community rebuilt their town within two years of the disaster.", source: "News" },
        { sentence: "Children are often more resilient than adults give them credit for.", source: "Psychology Today" },
        { sentence: "The company's resilient business model helped it survive the economic downturn.", source: "Business Weekly" }
    ],
    'pragmatic': [
        { sentence: "She took a pragmatic approach to solving the budget crisis.", source: "Political Analysis" },
        { sentence: "While idealists dreamed of perfection, the pragmatic engineers focused on what would actually work.", source: "Tech Article" },
        { sentence: "His pragmatic nature made him an effective negotiator.", source: "Business Profile" }
    ],
    'ubiquitous': [
        { sentence: "Smartphones have become ubiquitous in modern society.", source: "Technology Review" },
        { sentence: "Coffee shops are now ubiquitous in urban neighborhoods.", source: "Urban Studies" },
        { sentence: "The ubiquitous presence of social media has transformed how we communicate.", source: "Social Commentary" }
    ],
    'ambiguous': [
        { sentence: "The contract's ambiguous language led to a lengthy legal dispute.", source: "Legal News" },
        { sentence: "Her ambiguous response left us unsure of her true intentions.", source: "Novel Excerpt" },
        { sentence: "The painting's ambiguous symbolism has sparked decades of scholarly debate.", source: "Art History" }
    ],
    'meticulous': [
        { sentence: "The detective's meticulous examination of the crime scene revealed crucial evidence.", source: "Crime Fiction" },
        { sentence: "She was meticulous about keeping her research notes organized.", source: "Academic Writing" },
        { sentence: "The restoration required meticulous attention to historical accuracy.", source: "Museum Report" }
    ],
    'profound': [
        { sentence: "The loss had a profound impact on the entire community.", source: "News Report" },
        { sentence: "His profound understanding of human nature made him an exceptional therapist.", source: "Profile" },
        { sentence: "The discovery had profound implications for our understanding of the universe.", source: "Science Journal" }
    ],
    'nuance': [
        { sentence: "Translation requires understanding the nuance of both languages.", source: "Linguistics" },
        { sentence: "The actor captured every nuance of the complex character.", source: "Film Review" },
        { sentence: "Political discussions often lack the nuance needed to address complex issues.", source: "Opinion Piece" }
    ],
    'compelling': [
        { sentence: "The documentary presented a compelling argument for environmental reform.", source: "Film Review" },
        { sentence: "She made a compelling case for increasing the research budget.", source: "Business Report" },
        { sentence: "The novel's compelling narrative kept readers engaged until the final page.", source: "Book Review" }
    ],
    'innovative': [
        { sentence: "The startup's innovative approach disrupted the entire industry.", source: "Tech News" },
        { sentence: "Teachers are finding innovative ways to engage students in remote learning.", source: "Education Weekly" },
        { sentence: "The architect's innovative design maximized natural light throughout the building.", source: "Architecture Digest" }
    ],
    'authentic': [
        { sentence: "The restaurant prides itself on serving authentic regional cuisine.", source: "Food Review" },
        { sentence: "Audiences respond to leaders who seem authentic and genuine.", source: "Leadership Study" },
        { sentence: "The museum verified that the artifact was authentic.", source: "News Report" }
    ],
    'vulnerable': [
        { sentence: "The species is particularly vulnerable to habitat loss.", source: "Nature Documentary" },
        { sentence: "Being vulnerable with others can actually strengthen relationships.", source: "Psychology Article" },
        { sentence: "The security audit revealed that the system was vulnerable to attacks.", source: "Tech Report" }
    ],
    'paradigm': [
        { sentence: "The discovery represented a paradigm shift in evolutionary biology.", source: "Science Journal" },
        { sentence: "The company operated under an outdated business paradigm.", source: "Management Review" },
        { sentence: "Social media has created a new paradigm for political communication.", source: "Media Studies" }
    ]
};

// Sentence templates for generating examples when word not in corpus
const SENTENCE_TEMPLATES = [
    "The {word} nature of the situation required careful consideration.",
    "Critics described the performance as remarkably {word}.",
    "Her {word} approach to the problem impressed her colleagues.",
    "The report highlighted several {word} aspects of the proposal.",
    "What struck me most was how {word} the entire experience felt."
];

export const ExampleService = {
    /**
     * Get example usages for a word
     * @param {string} word - The word to find examples for
     * @param {number} count - Number of examples to return (default 3)
     * @returns {Promise<Array>} Array of { sentence, source, url? }
     */
    async getExamples(word, count = 3) {
        const normalizedWord = word.toLowerCase().trim();
        
        // Check built-in corpus first
        if (EXAMPLE_CORPUS[normalizedWord]) {
            return EXAMPLE_CORPUS[normalizedWord].slice(0, count);
        }
        
        // Try to fetch from Datamuse API (free, no key required)
        try {
            const apiExamples = await this.fetchFromDatamuse(word);
            if (apiExamples && apiExamples.length > 0) {
                return apiExamples.slice(0, count);
            }
        } catch (error) {
            console.warn('Datamuse API error:', error);
        }

        // Try Free Dictionary API for examples
        try {
            const dictExamples = await this.fetchFromDictionary(word);
            if (dictExamples && dictExamples.length > 0) {
                return dictExamples.slice(0, count);
            }
        } catch (error) {
            console.warn('Dictionary API error:', error);
        }
        
        // Return empty array if no examples found
        return [];
    },

    /**
     * Fetch related words and try to construct context from Datamuse
     * @param {string} word 
     */
    async fetchFromDatamuse(word) {
        // Datamuse doesn't provide sentences directly, but we can use it
        // to verify the word exists and get related context
        const response = await fetch(
            `https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=d&max=1`
        );
        
        if (!response.ok) return [];
        
        const data = await response.json();
        if (!data || data.length === 0) return [];
        
        // Datamuse returns definitions in 'defs' array
        const wordData = data[0];
        if (wordData.defs && wordData.defs.length > 0) {
            // We have confirmation the word exists, but Datamuse doesn't give examples
            // Return empty to fall through to dictionary API
            return [];
        }
        
        return [];
    },

    /**
     * Fetch examples from Free Dictionary API
     * @param {string} word 
     */
    async fetchFromDictionary(word) {
        const response = await fetch(
            `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
        );
        
        if (!response.ok) return [];
        
        const data = await response.json();
        if (!data || data.length === 0) return [];
        
        const examples = [];
        
        // Extract examples from all meanings
        for (const entry of data) {
            if (entry.meanings) {
                for (const meaning of entry.meanings) {
                    if (meaning.definitions) {
                        for (const def of meaning.definitions) {
                            if (def.example) {
                                examples.push({
                                    sentence: def.example,
                                    source: `Dictionary (${meaning.partOfSpeech})`,
                                    url: null
                                });
                            }
                        }
                    }
                }
            }
        }
        
        return examples;
    },

    /**
     * Check if examples need refresh (older than 7 days)
     * @param {number} fetchedAt - Timestamp when examples were fetched
     * @returns {boolean}
     */
    needsRefresh(fetchedAt) {
        if (!fetchedAt) return true;
        const weekInMs = 7 * 24 * 60 * 60 * 1000;
        return Date.now() - fetchedAt > weekInMs;
    },

    /**
     * Add a word to the local corpus (for user-contributed examples)
     * @param {string} word 
     * @param {Object} example - { sentence, source, url? }
     */
    async addToLocalCorpus(word, example) {
        const key = 'lexi_example_corpus';
        return new Promise((resolve) => {
            chrome.storage.local.get([key], (result) => {
                const corpus = result[key] || {};
                if (!corpus[word.toLowerCase()]) {
                    corpus[word.toLowerCase()] = [];
                }
                corpus[word.toLowerCase()].push(example);
                chrome.storage.local.set({ [key]: corpus }, resolve);
            });
        });
    },

    /**
     * Get examples from local corpus
     * @param {string} word 
     */
    async getLocalExamples(word) {
        const key = 'lexi_example_corpus';
        return new Promise((resolve) => {
            chrome.storage.local.get([key], (result) => {
                const corpus = result[key] || {};
                resolve(corpus[word.toLowerCase()] || []);
            });
        });
    }
};
