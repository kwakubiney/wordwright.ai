/**
 * Shared service for fetching word definitions
 */
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
                }
            }

            return { definition, example };
        } catch (error) {
            console.error('Dictionary API error:', error);
            return null;
        }
    }
};
