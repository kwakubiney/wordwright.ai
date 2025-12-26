// OpenRouter API configuration
const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-4o-mini';

// Mistake categories for detailed feedback
export const MISTAKE_CATEGORIES = {
    WRONG_MEANING: 'wrong_meaning',
    AWKWARD_USAGE: 'awkward_usage',
    GRAMMAR_ERROR: 'grammar_error',
    PERFECT_USAGE: 'perfect_usage'
};

// Get API key from storage
async function getApiKey() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['openrouter_api_key'], (result) => {
            resolve(result.openrouter_api_key || '');
        });
    });
}

export const AIService = {
    /**
     * Evaluate a user's sentence for a specific word (Enhanced Tutor Mode)
     * @param {string} targetWord - The word being practiced
     * @param {string} definition - The definition of the word
     * @param {string} userSentence - The sentence written by the user
     * @param {Object} context - Optional context where word was found
     */
    async evaluateSentence(targetWord, definition, userSentence, context = null) {
        const systemPrompt = `You are an expert English language tutor who helps learners truly master vocabulary. Your role is to be a helpful teacher, not just a grader. You explain WHY usage is correct or incorrect and help learners understand the nuances of words.

SCORING CRITERIA (be fair but thorough):
- 5/5: Perfect usage - word used correctly with natural, sophisticated phrasing
- 4/5: Good usage - word used correctly with minor stylistic improvements possible
- 3/5: Acceptable but awkward - word technically correct but feels forced or unnatural
- 2/5: Incorrect usage - word doesn't fit the context or meaning is wrong
- 1/5: Completely wrong - word misused or sentence makes no sense

MISTAKE CATEGORIES:
- "wrong_meaning": The word is used with an incorrect meaning
- "awkward_usage": Correct meaning but unnatural/forced phrasing
- "grammar_error": Grammar issues affecting the sentence
- "perfect_usage": No mistakes, excellent usage

IMPORTANT: Provide nuanced teaching that includes:
1. Common collocations (words that naturally go together with the target word)
2. Register/tone guidance (formal vs casual contexts)
3. Common learner mistakes to avoid
4. Two example sentences at different levels:
   - "beginner_example": A simple, clear usage for beginners
   - "advanced_example": A more sophisticated, natural usage

Return ONLY valid JSON (no markdown, no extra text).`;

        const contextInfo = context && context.sentence
            ? `\n\nORIGINAL CONTEXT WHERE USER FOUND THIS WORD:\n"${context.sentence}"\nSource: ${context.pageTitle || context.sourceUrl || 'Unknown'}`
            : '';

        const userPrompt = `TARGET WORD: "${targetWord}"
DEFINITION: "${definition || 'No definition provided'}"
USER'S SENTENCE: "${userSentence}"${contextInfo}

Evaluate the user's sentence and provide comprehensive tutor feedback. Consider ALL common definitions and usages of this word.

Return JSON in this exact format:
{
  "score": <integer 1-5>,
  "mistake_category": "<wrong_meaning|awkward_usage|grammar_error|perfect_usage>",
  "reasoning": "<detailed explanation of why the score was given, explaining proper usage>",
  "feedback": "<short 1-2 sentence encouraging summary>",
  "nuance": {
    "tone": "<formal|neutral|casual|varies> - when to use this word",
    "collocations": ["<common word pairings>", "<up to 3 examples>"],
    "common_mistakes": "<brief note on what learners often get wrong>"
  },
  "examples": {
    "beginner_example": "<simple clear sentence using ${targetWord}>",
    "advanced_example": "<sophisticated natural sentence using ${targetWord}>"
  },
  "suggestions": ["<alternative sentence 1>", "<alternative sentence 2>"]
}`;

        try {
            const apiKey = await getApiKey();
            if (!apiKey) {
                throw new Error('OpenRouter API key not configured. Please add it in Settings.');
            }

            const response = await fetch(OPENROUTER_API, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://lexi.ai',
                    'X-Title': 'Lexi.ai'
                },
                body: JSON.stringify({
                    model: DEFAULT_MODEL,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    response_format: { type: 'json_object' }
                })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`OpenRouter API error: ${error}`);
            }

            const data = await response.json();
            const content = data.choices[0].message.content;

            // Parse the JSON response
            const result = JSON.parse(content);

            return {
                score: result.score || 3,
                mistakeCategory: result.mistake_category || 'perfect_usage',
                reasoning: result.reasoning || '',
                feedback: result.feedback || '',
                nuance: result.nuance || null,
                examples: result.examples || null,
                suggestions: result.suggestions || []
            };
        } catch (error) {
            console.error('AI evaluation error:', error);
            throw new Error(`Failed to evaluate: ${error.message}`);
        }
    },

    /**
     * Get a definition for a word using AI
     * @param {string} word - The word to define
     */
    async getDefinition(word) {
        const systemPrompt = `You are a helpful English dictionary. Provide clear, concise definitions for words.`;

        const userPrompt = `Provide a comprehensive but concise definition for the word: "${word}"

Include the part of speech in parentheses at the start (e.g., "(noun)", "(adjective)", "(verb)"), followed by the definition.

Return ONLY valid JSON (no markdown, no extra text) in this format:
{
  "definition": "(part of speech) clear definition here"
}`;

        try {
            const apiKey = await getApiKey();
            if (!apiKey) {
                throw new Error('OpenRouter API key not configured. Please add it in Settings.');
            }

            const response = await fetch(OPENROUTER_API, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://lexi.ai',
                    'X-Title': 'Lexi.ai'
                },
                body: JSON.stringify({
                    model: DEFAULT_MODEL,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    response_format: { type: 'json_object' }
                })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`OpenRouter API error: ${error}`);
            }

            const data = await response.json();
            const content = data.choices[0].message.content;
            const result = JSON.parse(content);

            return result.definition || '';
        } catch (error) {
            console.error('AI definition error:', error);
            throw new Error(`Failed to get definition: ${error.message}`);
        }
    },

    /**
     * Generate a cloze (fill-in-the-blank) question for a word
     * Uses semantic distractors (near-synonyms) to test real comprehension
     * @param {string} word - The target word
     * @param {string} definition - The word's definition
     */
    async generateClozeQuestion(word, definition) {
        const systemPrompt = `You are an expert vocabulary quiz generator focused on deep learning. Your goal is to create questions that test true understanding, not just pattern recognition.`;

        const userPrompt = `Create a fill-in-the-blank question for the word "${word}" (${definition || 'no definition provided'}).

CRITICAL REQUIREMENTS:
1. Create a sentence where ONLY the target word "${word}" fits perfectly due to its specific nuance
2. Generate 3 SEMANTIC DISTRACTORS - words with SIMILAR but NOT IDENTICAL meanings:
   - These should be near-synonyms, related words, or words a learner might confuse
   - Each distractor should be plausible at first glance but incorrect for a subtle reason
   - Example: for "alchemize" → distractors could be "transform", "convert", "transmute"
3. The sentence must be crafted so the target word is clearly the BEST fit when you understand the nuances

DO NOT include "${word}" in the options array - the user must RECALL it, not recognize it.

Return ONLY valid JSON:
{
  "sentence": "The sentence with _____ as the blank",
  "answer": "${word}",
  "options": ["semantic_distractor1", "semantic_distractor2", "semantic_distractor3", "semantic_distractor4"],
  "why_correct": "Brief explanation of why ${word} is the best fit over the distractors"
}`;

        try {
            const apiKey = await getApiKey();
            if (!apiKey) throw new Error('API key not configured');

            const response = await fetch(OPENROUTER_API, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://lexi.ai',
                    'X-Title': 'Lexi.ai'
                },
                body: JSON.stringify({
                    model: DEFAULT_MODEL,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    response_format: { type: 'json_object' }
                })
            });

            if (!response.ok) throw new Error('API error');

            const data = await response.json();
            const result = JSON.parse(data.choices[0].message.content);

            // Ensure the correct answer is included and shuffle
            const allOptions = [...result.options];
            if (!allOptions.includes(result.answer)) {
                allOptions.push(result.answer);
            }
            const shuffledOptions = allOptions.sort(() => Math.random() - 0.5);

            return {
                sentence: result.sentence,
                answer: result.answer,
                options: shuffledOptions,
                explanation: result.why_correct
            };
        } catch (error) {
            console.error('Cloze generation error:', error);
            throw error;
        }
    },

    /**
     * Generate a meaning-in-context MCQ question
     * @param {string} word - The target word
     * @param {string} definition - The word's definition
     */
    async generateMCQQuestion(word, definition) {
        const systemPrompt = `You are a vocabulary quiz generator. Create multiple-choice questions testing word meaning in context.`;

        const userPrompt = `Create a multiple-choice question for the word "${word}".

Requirements:
1. Show a sentence using the word
2. Ask what the word means in that context
3. Provide 4 options: 1 correct meaning, 3 plausible but incorrect meanings

Return ONLY valid JSON:
{
  "sentence": "A sentence using ${word} naturally",
  "question": "What does '${word}' mean in this context?",
  "correct_answer": "The correct meaning",
  "options": ["correct meaning", "wrong1", "wrong2", "wrong3"]
}`;

        try {
            const apiKey = await getApiKey();
            if (!apiKey) throw new Error('API key not configured');

            const response = await fetch(OPENROUTER_API, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://lexi.ai',
                    'X-Title': 'Lexi.ai'
                },
                body: JSON.stringify({
                    model: DEFAULT_MODEL,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    response_format: { type: 'json_object' }
                })
            });

            if (!response.ok) throw new Error('API error');

            const data = await response.json();
            const result = JSON.parse(data.choices[0].message.content);

            return {
                sentence: result.sentence,
                question: result.question,
                correctAnswer: result.correct_answer,
                options: result.options.sort(() => Math.random() - 0.5)
            };
        } catch (error) {
            console.error('MCQ generation error:', error);
            throw error;
        }
    },

    /**
     * Generate a rewrite prompt for practice
     * @param {string} word - The target word
     * @param {string} definition - The word's definition
     */
    async generateRewritePrompt(word, definition) {
        const systemPrompt = `You are a vocabulary practice generator. Create sentence rewriting exercises.`;

        const userPrompt = `Create a rewrite exercise for the word "${word}" (${definition || 'no definition'}).

Requirements:
1. Provide a sentence using the word
2. Ask the user to rewrite it using the word differently (different context/structure)
3. Provide an example of a good rewrite

Return ONLY valid JSON:
{
  "original_sentence": "A sentence using ${word}",
  "instruction": "Rewrite this sentence using '${word}' in a different way",
  "example_rewrite": "An example of a good rewrite"
}`;

        try {
            const apiKey = await getApiKey();
            if (!apiKey) throw new Error('API key not configured');

            const response = await fetch(OPENROUTER_API, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://lexi.ai',
                    'X-Title': 'Lexi.ai'
                },
                body: JSON.stringify({
                    model: DEFAULT_MODEL,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    response_format: { type: 'json_object' }
                })
            });

            if (!response.ok) throw new Error('API error');

            const data = await response.json();
            return JSON.parse(data.choices[0].message.content);
        } catch (error) {
            console.error('Rewrite generation error:', error);
            throw error;
        }
    }
};
