import assert from 'node:assert/strict';
import test from 'node:test';
import { createRun, currentQuestion, remainingOptions, restoreRun, rewards, score, transition } from '../src/game.ts';
import type { Run } from '../src/game.ts';
import { isBilingualAndPlayable, optionIds, pool, questions, questionText } from '../src/questions.ts';

const first = () => createRun('test-round', 20261123);
const act = (run: Run, action: Parameters<typeof transition>[2]) => transition(run, currentQuestion(run).id, action);
const selectCorrect = (run: Run) => act(run, { type: 'select', optionId: currentQuestion(run).correctOptionId });
const selectWrong = (run: Run) => act(run, { type: 'select', optionId: remainingOptions(run).find(id => id !== currentQuestion(run).correctOptionId)! });
const confirm = (run: Run) => act(run, { type: 'confirm' });
const advance = (run: Run) => act(run, { type: 'advance' });
const clearQuestion = (run: Run) => advance(confirm(selectCorrect(run)));
const roundTrip = (run: Run) => assert.deepEqual(restoreRun(JSON.stringify(run)), run);

test('every seed question has unique identity, four distinct options and a reviewed translation', () => {
  assert.equal(pool.length, 10);
  assert.equal(new Set(pool.map(question => question.id)).size, pool.length);
  assert.equal(new Set(pool.map(question => question.contentId)).size, pool.length);
  for (const question of questions) {
    assert.equal(question.provenance.kind, 'original');
    assert.ok(isBilingualAndPlayable(question));
    for (const language of ['tr', 'en'] as const) {
      const text = questionText(question, language)!;
      assert.deepEqual(Object.keys(text.options), [...optionIds]);
      assert.ok(text.options[question.correctOptionId]);
    }
  }
});

test('unreviewed, stale, incomplete and restricted questions are ineligible', () => {
  const question = questions[0];
  const translation = question.translations.en!;
  assert.equal(questionText({ ...question, translations: { en: { ...translation, status: 'draft' } } }, 'en'), undefined);
  assert.equal(isBilingualAndPlayable({ ...question, original: { ...question.original, revision: 2 } }), false);
  assert.equal(isBilingualAndPlayable({ ...question, playability: 'media-required' }), false);
  assert.equal(isBilingualAndPlayable({ ...question, provenance: { kind: 'archive', license: null, publication: 'pending', occurrences: [] } }), false);
  const duplicateText = { ...translation.text, options: { ...translation.text.options, option2: translation.text.options.option1 } };
  assert.equal(isBilingualAndPlayable({ ...question, translations: { en: { ...translation, text: duplicateText } } }), false);
});

test('seeded runs contain five distinct questions and reproduce order', () => {
  const run = first();
  assert.equal(run.questionIds.length, rewards.length);
  assert.equal(new Set(run.questionIds).size, rewards.length);
  assert.deepEqual(first(), run);
  assert.notDeepEqual(run.questionIds, createRun('other-round', 1).questionIds);
});

test('selecting is reversible, submitting once freezes the answer, and stale events cannot skip a step', () => {
  const run = first();
  const id = currentQuestion(run).id;
  assert.equal(confirm(run), run);
  const wrong = selectWrong(run);
  assert.equal(wrong.answers.length, 0);
  const feedback = confirm(selectCorrect(wrong));
  assert.equal(feedback.phase, 'feedback');
  assert.equal(confirm(feedback), feedback);
  assert.equal(selectWrong(feedback), feedback);
  assert.equal(feedback.answers.length, 1);
  const next = advance(feedback);
  assert.equal(transition(next, id, { type: 'advance' }), next);
  assert.equal(next.index, 1);
});

test('five correct answers finish the game and award 2,000 points', () => {
  let run = first();
  for (let step = 0; step < rewards.length; step++) {
    run = clearQuestion(run);
    roundTrip(run);
  }
  assert.equal(run.ending, 'completed');
  assert.deepEqual(score(run), { correct: 5, incorrect: 0, banked: 250, points: 2000 });
  assert.equal(advance(run), run);
});

test('wrong answers settle at zero before the checkpoint and 250 afterward', () => {
  const early = advance(confirm(selectWrong(clearQuestion(first()))));
  assert.equal(early.ending, 'wrong');
  assert.deepEqual(score(early), { correct: 1, incorrect: 1, banked: 0, points: 0 });
  let late = first();
  for (let step = 0; step < 3; step++) late = clearQuestion(late);
  late = advance(confirm(selectWrong(late)));
  assert.equal(late.ending, 'wrong');
  assert.deepEqual(score(late), { correct: 3, incorrect: 1, banked: 250, points: 250 });
  roundTrip(early);
  roundTrip(late);
});

test('withdrawing keeps earned points and leaves the current question unanswered', () => {
  const run = clearQuestion(clearQuestion(clearQuestion(first())));
  const withdrawn = act(selectWrong(run), { type: 'withdraw' });
  assert.equal(withdrawn.ending, 'withdrawn');
  assert.deepEqual(score(withdrawn), { correct: 3, incorrect: 0, banked: 250, points: 500 });
  roundTrip(withdrawn);
});

test('50:50 keeps the right option and one distractor and can only be spent once', () => {
  const run = first();
  const used = act(run, { type: 'lifeline' });
  const allowed = remainingOptions(used);
  const removed = optionIds.find(id => !allowed.includes(id))!;
  assert.equal(allowed.length, 2);
  assert.ok(allowed.includes(currentQuestion(run).correctOptionId));
  assert.equal(act(used, { type: 'select', optionId: removed }), used);
  assert.equal(act(act(run, { type: 'select', optionId: removed }), { type: 'lifeline' }).selected, null);
  const next = clearQuestion(used);
  assert.equal(act(next, { type: 'lifeline' }), next);
  assert.equal(remainingOptions(next).length, 4);
  roundTrip(used);
  roundTrip(next);
});

test('round replay restores pending selection and feedback with the same lifeline', () => {
  const used = act(clearQuestion(first()), { type: 'lifeline' });
  const selected = selectCorrect(used);
  roundTrip(selected);
  roundTrip(confirm(selected));
});

test('corrupt, modified and obsolete saves are rejected', () => {
  const run = first();
  assert.equal(restoreRun('{'), null);
  assert.equal(restoreRun('null'), null);
  assert.equal(restoreRun(JSON.stringify({ ...run, version: 0 })), null);
  assert.equal(restoreRun(JSON.stringify({ ...run, dataVersion: 'old' })), null);
  assert.equal(restoreRun(JSON.stringify({ ...run, questionIds: run.questionIds.toReversed() })), null);
  assert.equal(restoreRun(JSON.stringify({ ...confirm(selectWrong(run)), index: 1 })), null);
  assert.equal(restoreRun(JSON.stringify({ ...run, lifelineAt: 1 })), null);
});
