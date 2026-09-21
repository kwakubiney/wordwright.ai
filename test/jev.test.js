import test from 'node:test';
import assert from 'node:assert/strict';

import {
    JevUncertainError,
    buildJevEvaluationRequest,
    parseJevEvaluation
} from '../src/lib/jev.js';

function response({ score = 3.2, confidence = 0.8, meaning = 0.95, grammar = 0.9, natural = 0.85 } = {}) {
    return {
        model: 'jev-1.13.0',
        answers: {
            usage_quality: { type: 'score', score, confidence },
            meaning_correct: { type: 'noul', noul: meaning },
            grammar_correct: { type: 'noul', noul: grammar },
            natural_usage: { type: 'noul', noul: natural }
        },
        usage: { input_tokens: 100, output_tokens: 20 }
    };
}

test('builds an atomic Jev request with learner state', () => {
    const request = buildJevEvaluationRequest(
        'alchemize',
        'to transform',
        'She alchemized grief into art.',
        { sentence: 'We can alchemize setbacks into strength.' }
    );

    assert.equal(request.model, 'jev-latest');
    assert.equal(request.state.target_word, 'alchemize');
    assert.equal(request.state.learner_sentence, 'She alchemized grief into art.');
    assert.deepEqual(Object.keys(request.questions), [
        'usage_quality',
        'meaning_correct',
        'grammar_correct',
        'natural_usage'
    ]);
});

test('maps confident Jev answers into an integer application score', () => {
    const result = parseJevEvaluation(response());

    assert.equal(result.score, 4);
    assert.equal(result.mistakeCategory, 'perfect_usage');
    assert.equal(result.signals.meaningCorrect, true);
});

test('wrong meaning takes precedence and caps the score', () => {
    const result = parseJevEvaluation(response({ score: 3.8, meaning: 0.1 }));

    assert.equal(result.score, 2);
    assert.equal(result.mistakeCategory, 'wrong_meaning');
});

test('grammar errors and awkward usage are classified deterministically', () => {
    const grammar = parseJevEvaluation(response({ grammar: 0.1, natural: 0.1 }));
    const awkward = parseJevEvaluation(response({ grammar: 0.9, natural: 0.1 }));

    assert.equal(grammar.mistakeCategory, 'grammar_error');
    assert.equal(grammar.score, 3);
    assert.equal(awkward.mistakeCategory, 'awkward_usage');
    assert.equal(awkward.score, 3);
});

test('rejects uncertain judgments instead of guessing', () => {
    assert.throws(
        () => parseJevEvaluation(response({ confidence: 0.2 })),
        JevUncertainError
    );
    assert.throws(
        () => parseJevEvaluation(response({ natural: 0.5 })),
        JevUncertainError
    );
});

test('rejects malformed response shapes', () => {
    assert.throws(
        () => parseJevEvaluation({ answers: {} }),
        /usage_quality/
    );
    assert.throws(
        () => parseJevEvaluation(response({ score: 8 })),
        /between 0 and 4/
    );
});
