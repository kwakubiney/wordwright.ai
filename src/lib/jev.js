const TYPESAFE_API = 'https://api.typesafe.ai/v1/systemone';
const DEFAULT_JEV_MODEL = 'jev-latest';
const REQUEST_TIMEOUT_MS = 15000;
const MIN_SCORE_CONFIDENCE = 0.5;
const NOUL_UNCERTAIN_LOW = 0.35;
const NOUL_UNCERTAIN_HIGH = 0.65;

export class JevUncertainError extends Error {
    constructor(message) {
        super(message);
        this.name = 'JevUncertainError';
    }
}

export function buildJevEvaluationRequest(targetWord, definition, userSentence, context = null) {
    return {
        model: DEFAULT_JEV_MODEL,
        state: {
            target_word: targetWord,
            definition: definition || 'No definition provided',
            learner_sentence: userSentence,
            original_context: context?.sentence || null
        },
        questions: {
            usage_quality: {
                type: 'score',
                instructions: 'Rate how correctly and naturally `learner_sentence` uses `target_word` with the supplied definition. Consider valid senses beyond the supplied definition when clearly applicable.',
                criteria: [
                    'Completely wrong: the word is misused or the sentence does not make sense',
                    'Incorrect: the word does not fit the intended meaning or context',
                    'Acceptable but awkward: understandable and broadly correct, but forced or unnatural',
                    'Good: correct and natural, with only minor stylistic room for improvement',
                    'Excellent: precise, natural, and sophisticated usage'
                ]
            },
            meaning_correct: {
                type: 'noul',
                instructions: 'Does `learner_sentence` use `target_word` with a valid meaning in this context?',
                criteria: {
                    true: 'The word expresses a valid sense that fits the sentence context',
                    false: 'The word expresses the wrong meaning or does not fit the context'
                }
            },
            grammar_correct: {
                type: 'noul',
                instructions: 'Is `learner_sentence` grammatically sound, including the grammatical form of `target_word`?',
                criteria: {
                    true: 'No grammatical issue materially affects the sentence',
                    false: 'A grammatical issue materially affects the sentence'
                }
            },
            natural_usage: {
                type: 'noul',
                instructions: 'Would a fluent English speaker consider the use of `target_word` natural in `learner_sentence`?',
                criteria: {
                    true: 'The wording and collocation sound natural',
                    false: 'The meaning may be understandable, but the wording or collocation sounds forced'
                }
            }
        }
    };
}

function assertObject(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`Invalid Jev response: ${label} must be an object.`);
    }
    return value;
}

function assertProbability(value, label) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
        throw new Error(`Invalid Jev response: ${label} must be between 0 and 1.`);
    }
    return value;
}

function readNoul(answers, key) {
    const answer = assertObject(answers[key], `answers.${key}`);
    if (answer.type !== 'noul') {
        throw new Error(`Invalid Jev response: answers.${key} is not a noul.`);
    }
    return assertProbability(answer.noul, `answers.${key}.noul`);
}

export function parseJevEvaluation(data) {
    const root = assertObject(data, 'response');
    const answers = assertObject(root.answers, 'answers');
    const quality = assertObject(answers.usage_quality, 'answers.usage_quality');

    if (quality.type !== 'score') {
        throw new Error('Invalid Jev response: answers.usage_quality is not a score.');
    }
    if (typeof quality.score !== 'number' || !Number.isFinite(quality.score) || quality.score < 0 || quality.score > 4) {
        throw new Error('Invalid Jev response: usage quality score must be between 0 and 4.');
    }

    const scoreConfidence = assertProbability(
        quality.confidence,
        'answers.usage_quality.confidence'
    );
    const meaningProbability = readNoul(answers, 'meaning_correct');
    const grammarProbability = readNoul(answers, 'grammar_correct');
    const naturalProbability = readNoul(answers, 'natural_usage');

    if (scoreConfidence < MIN_SCORE_CONFIDENCE) {
        throw new JevUncertainError('Jev was not confident enough in the usage score.');
    }

    for (const [label, probability] of Object.entries({
        meaning: meaningProbability,
        grammar: grammarProbability,
        naturalness: naturalProbability
    })) {
        if (probability > NOUL_UNCERTAIN_LOW && probability < NOUL_UNCERTAIN_HIGH) {
            throw new JevUncertainError(`Jev was uncertain about ${label}.`);
        }
    }

    const meaningCorrect = meaningProbability >= 0.5;
    const grammarCorrect = grammarProbability >= 0.5;
    const naturalUsage = naturalProbability >= 0.5;

    let score = Math.round(quality.score) + 1;
    let mistakeCategory = 'perfect_usage';

    if (!meaningCorrect) {
        score = Math.min(score, 2);
        mistakeCategory = 'wrong_meaning';
    } else if (!grammarCorrect) {
        score = Math.min(score, 3);
        mistakeCategory = 'grammar_error';
    } else if (!naturalUsage) {
        score = Math.min(score, 3);
        mistakeCategory = 'awkward_usage';
    }

    return {
        score,
        mistakeCategory,
        confidence: scoreConfidence,
        signals: {
            meaningCorrect,
            grammarCorrect,
            naturalUsage,
            meaningProbability,
            grammarProbability,
            naturalProbability,
            rawScore: quality.score
        }
    };
}

export async function evaluateWithJev(apiKey, targetWord, definition, userSentence, context = null) {
    if (!apiKey) {
        throw new Error('TypeSafe API key not configured. Add it in Settings to enable Jev grading.');
    }

    const response = await fetch(TYPESAFE_API, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        body: JSON.stringify(buildJevEvaluationRequest(
            targetWord,
            definition,
            userSentence,
            context
        ))
    });

    if (!response.ok) {
        const detail = await response.text();
        const summary = (detail || response.statusText).slice(0, 500);
        throw new Error(`Jev API error (${response.status}): ${summary}`);
    }

    const data = await response.json();
    return {
        ...parseJevEvaluation(data),
        usage: data.usage || { input_tokens: 0, output_tokens: 0 }
    };
}
