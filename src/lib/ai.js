import { evaluateWithJev } from './jev.js';

export const MISTAKE_CATEGORIES = {
    WRONG_MEANING: 'wrong_meaning',
    AWKWARD_USAGE: 'awkward_usage',
    GRAMMAR_ERROR: 'grammar_error',
    PERFECT_USAGE: 'perfect_usage'
};

function getTypeSafeKey() {
    return new Promise(resolve => {
        chrome.storage.local.get(['typesafe_api_key'], result => {
            resolve(result.typesafe_api_key || '');
        });
    });
}

export async function isAIConfigured() {
    return Boolean(await getTypeSafeKey());
}

export async function generateExample() {
    return '';
}

function generationUnavailable() {
    throw new Error('Jev provides grading only; text generation is not configured.');
}

export const AIService = {
    async evaluateSentence(targetWord, definition, userSentence, context = null) {
        try {
            const judgment = await evaluateWithJev(
                await getTypeSafeKey(),
                targetWord,
                definition,
                userSentence,
                context
            );

            const feedback = {
                wrong_meaning: `The sentence does not use “${targetWord}” with a meaning that fits this context. Review the definition and try a context where that meaning is explicit.`,
                grammar_error: `Your use of “${targetWord}” is understandable, but a grammatical issue affects the sentence. Check the word form and sentence structure, then try again.`,
                awkward_usage: `You have the right general meaning, but “${targetWord}” sounds forced in this phrasing. Try a more natural collocation or sentence structure.`,
                perfect_usage: `You used “${targetWord}” correctly and naturally in context.`
            }[judgment.mistakeCategory];

            return { ...judgment, feedback };
        } catch (error) {
            console.error('Jev evaluation error:', error);
            throw new Error(`Failed to evaluate: ${error.message}`);
        }
    },

    async getDefinition() {
        return generationUnavailable();
    },

    async generateClozeQuestion() {
        return generationUnavailable();
    },

    async generateMCQQuestion() {
        return generationUnavailable();
    },

    async generateRewritePrompt() {
        return generationUnavailable();
    }
};
