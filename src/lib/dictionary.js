/**
 * Shared service for fetching word definitions
 */
import { isAIConfigured, generateExample } from './ai.js';

export const DictionaryService = {
    /**
     * Fetch definition from dictionary API
     * @param {string} word - The word to look up
     * @returns {Promise<{definition: string, example: string}|null>}
     */
    async lookup(word) {
        const DICTIONARY_API = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;

        try {
            const response = await fetch(DICTIONARY_API);

            if (!response.ok) {
                return null;
            }

            const data = await response.json();

            if (!data || data.length === 0) {
                return null;
            }

            const entry = data[0];

            // Get the first definition
            let definition = '';
            let example = '';

            if (entry.meanings && entry.meanings.length > 0) {
                const meaning = entry.meanings[0];
                const partOfSpeech = meaning.partOfSpeech || '';

                if (meaning.definitions && meaning.definitions.length > 0) {
                    const def = meaning.definitions[0];
                    definition = `(${partOfSpeech}) ${def.definition}`;
                    example = def.example || '';

                    // If no example in first definition, search others
                    if (!example) {
                        for (const m of entry.meanings) {
                            for (const d of m.definitions) {
                                if (d.example) {
                                    example = d.example;
                                    break;
                                }
                            }
                            if (example) break;
                        }
                    }
                }
            }

            // If still no example, try AI generation
            if (!example && definition) {
                const aiConfigured = await isAIConfigured();
                if (aiConfigured) {
                    example = await generateExample(word, definition);
                }
            }

            return { definition, example };
        } catch (error) {
            console.error('Dictionary API error:', error);
            return null;
        }
    }
};
