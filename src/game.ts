import { dataVersion, optionIds, pool, questionById } from './questions.ts';
import type { OptionId } from './questions.ts';

export const rewards = [100, 250, 500, 1_000, 2_000] as const;
export const safeStep = 2;
export const runVersion = 1;

type Answer = { questionId: string; optionId: OptionId };
type Ending = 'wrong' | 'completed' | 'withdrawn';

export type Run = {
  version: typeof runVersion;
  dataVersion: string;
  runId: string;
  seed: number;
  questionIds: string[];
  index: number;
  phase: 'question' | 'feedback' | 'finished';
  selected: OptionId | null;
  lifelineAt: number | null;
  answers: Answer[];
  ending: Ending | null;
};

type Action =
  | { type: 'select'; optionId: OptionId }
  | { type: 'confirm' | 'advance' | 'lifeline' | 'withdraw' };

export function createRun(runId: string, seed: number): Run {
  if (pool.length < rewards.length) throw new Error('Insufficient question pool');
  const ids = pool.map(question => question.id);
  let random = seed;
  for (let index = ids.length - 1; index > 0; index--) {
    random = (Math.imul(1_664_525, random) + 1_013_904_223) >>> 0;
    const swapIndex = Math.floor(random / 2 ** 32 * (index + 1));
    [ids[index], ids[swapIndex]] = [ids[swapIndex], ids[index]];
  }

  return {
    version: runVersion,
    dataVersion,
    runId,
    seed,
    questionIds: ids.slice(0, rewards.length),
    index: 0,
    phase: 'question',
    selected: null,
    lifelineAt: null,
    answers: [],
    ending: null,
  };
}

export function currentQuestion(run: Run) {
  return questionById.get(run.questionIds[run.index])!;
}

export function remainingOptions(run: Run): readonly OptionId[] {
  if (run.lifelineAt !== run.index) return optionIds;
  const correct = currentQuestion(run).correctOptionId;
  const wrong = optionIds.filter(id => id !== correct);
  const survivor = wrong[(run.seed + run.index) % wrong.length];
  return optionIds.filter(id => id === correct || id === survivor);
}

export function transition(run: Run, questionId: string, action: Action): Run {
  const question = currentQuestion(run);
  if (run.phase === 'finished' || question.id !== questionId) return run;

  if (run.phase === 'feedback') {
    if (action.type !== 'advance') return run;
    if (run.selected !== question.correctOptionId) {
      return { ...run, phase: 'finished', ending: 'wrong' };
    }
    if (run.index === rewards.length - 1) {
      return { ...run, phase: 'finished', ending: 'completed' };
    }
    return { ...run, index: run.index + 1, phase: 'question', selected: null };
  }

  switch (action.type) {
    case 'select':
      if (!remainingOptions(run).includes(action.optionId) || run.selected === action.optionId) return run;
      return { ...run, selected: action.optionId };
    case 'confirm':
      if (!run.selected) return run;
      return {
        ...run,
        phase: 'feedback',
        answers: [...run.answers, { questionId, optionId: run.selected }],
      };
    case 'lifeline': {
      if (run.lifelineAt !== null) return run;
      const next = { ...run, lifelineAt: run.index };
      if (next.selected && !remainingOptions(next).includes(next.selected)) next.selected = null;
      return next;
    }
    case 'withdraw':
      return { ...run, phase: 'finished', ending: 'withdrawn' };
    default:
      return run;
  }
}

export function score(run: Run) {
  const correct = run.answers.filter(answer => questionById.get(answer.questionId)?.correctOptionId === answer.optionId).length;
  const incorrect = run.answers.length - correct;
  const banked = correct >= safeStep ? rewards[safeStep - 1] : 0;
  return { correct, incorrect, banked, points: incorrect ? banked : (rewards[correct - 1] ?? 0) };
}

export const saveKey = 'kmmi:run';

export function restoreRun(serialized: string): Run | null {
  try {
    const stored = JSON.parse(serialized) as Partial<Run>;
    if (!stored || stored.version !== runVersion || stored.dataVersion !== dataVersion
      || typeof stored.runId !== 'string' || !stored.runId.length
      || typeof stored.seed !== 'number' || !Number.isInteger(stored.seed) || stored.seed < 0 || stored.seed > 0xffffffff
      || !Number.isInteger(stored.index) || stored.index! < 0 || stored.index! >= rewards.length
      || !Array.isArray(stored.questionIds) || stored.questionIds.length !== rewards.length
      || !Array.isArray(stored.answers) || stored.answers.length > rewards.length) return null;

    let run = createRun(stored.runId, stored.seed);
    if (run.questionIds.some((id, index) => id !== stored.questionIds![index])) return null;

    for (const answer of stored.answers) {
      if (run.phase !== 'question' || answer?.questionId !== currentQuestion(run).id) return null;
      if (run.index === stored.lifelineAt) run = transition(run, answer.questionId, { type: 'lifeline' });
      run = transition(run, answer.questionId, { type: 'select', optionId: answer.optionId });
      if (!run.selected) return null;
      run = transition(run, answer.questionId, { type: 'confirm' });
      if (run.index < stored.index! || stored.phase === 'finished') {
        run = transition(run, answer.questionId, { type: 'advance' });
      }
    }

    if (run.phase === 'question') {
      const id = currentQuestion(run).id;
      if (run.index === stored.lifelineAt) run = transition(run, id, { type: 'lifeline' });
      if (stored.selected) run = transition(run, id, { type: 'select', optionId: stored.selected });
      if (stored.ending === 'withdrawn') run = transition(run, id, { type: 'withdraw' });
    }

    if (run.phase !== stored.phase || run.index !== stored.index || run.ending !== stored.ending
      || run.selected !== stored.selected || run.lifelineAt !== stored.lifelineAt) return null;
    return run;
  } catch {
    return null;
  }
}
