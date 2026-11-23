import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { currentQuestion, saveKey } from '../src/game.ts';
import type { Run } from '../src/game.ts';

const build = resolve('dist');
const html = readFileSync(resolve(build, 'index.html'), 'utf8');
const scriptPath = html.match(/<script type="module" [^>]*src="([^"]+)"/)![1];
const script = readFileSync(resolve(build, scriptPath), 'utf8');

function openGame(initialStorage: Record<string, string> = {}, inlineHtml?: string) {
  const dom = new JSDOM(inlineHtml ?? html, {
    url: 'https://example.test/kimmilyonerolamamakister/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  const document = window.document;
  window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
  });
  // JSDOM models the dialog element but does not implement its modal API.
  // Exercise the application's actions without claiming native modality or focus trapping.
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  for (const [key, value] of Object.entries(initialStorage)) window.localStorage.setItem(key, value);
  const inlineScript = inlineHtml?.match(/<script type="module">([\s\S]+)<\/script>/)?.[1];
  window.eval(inlineScript ?? script);
  const get = <T extends HTMLElement = HTMLElement>(selector: string) => {
    const element = document.querySelector<T>(selector);
    assert.ok(element, `Missing element ${selector}`);
    return element;
  };
  const storedRun = () => JSON.parse(window.localStorage.getItem(saveKey)!) as Run;
  return {
    window,
    document,
    get,
    click: (selector: string) => get(selector).click(),
    storedRun,
    heading: () => get('h1').textContent,
    close: () => window.close(),
  };
}

test('static build uses relative asset links and opens under a project path', () => {
  const stylesheet = html.match(/<link rel="stylesheet" [^>]*href="([^"]+)"/)![1];
  for (const asset of [scriptPath, stylesheet]) {
    assert.ok(asset.startsWith('./assets/'));
    assert.ok(existsSync(resolve(build, asset)));
  }
  const css = readFileSync(resolve(build, stylesheet), 'utf8');
  for (const [, font] of css.matchAll(/url\((\.\/[^)]+\.woff2)\)/g)) {
    assert.ok(existsSync(resolve(build, 'assets', font)));
  }
  const game = openGame();
  try {
    assert.equal(game.document.documentElement.lang, 'tr');
    assert.match(game.heading()!, /Kim Milyoner/);
    assert.equal(game.get<HTMLImageElement>('.hero img').src,
      'https://example.test/kimmilyonerolamamakister/question-studio.webp');
    assert.ok(existsSync(resolve(build, 'question-studio.webp')));
  } finally {
    game.close();
  }
});

test('normal controls play a full round, show the score and start a fresh round', () => {
  const game = openGame();
  try {
    game.click('#play');
    const firstId = game.storedRun().runId;
    for (let index = 0; index < 5; index++) {
      const run = game.storedRun();
      assert.equal(run.index, index);
      assert.equal(game.document.querySelectorAll('input[type="radio"]').length, 4);
      assert.equal(game.get<HTMLButtonElement>('#confirm').disabled, true);
      const option = currentQuestion(run).correctOptionId;
      game.click(`label[for="option-${option}"]`);
      assert.equal(game.storedRun().answers.length, index);
      game.click('#confirm');
      assert.match(game.get('#feedback').textContent!, /Doğru cevap/);
      assert.equal(game.document.activeElement?.id, 'feedback');
      game.click('#advance');
    }
    assert.match(game.heading()!, /Beş soruyu da geçtin/);
    assert.match(game.get('.result-points').textContent!, /2\.000/);
    game.click('#replay');
    assert.notEqual(game.storedRun().runId, firstId);
    assert.equal(game.storedRun().index, 0);
  } finally {
    game.close();
  }
});

test('language switching and reopening preserve the selected option and spent lifeline', () => {
  const game = openGame();
  let reopened: ReturnType<typeof openGame> | undefined;
  try {
    game.click('#play');
    game.click('#lifeline');
    const remaining = game.document.querySelectorAll<HTMLInputElement>('input[type="radio"]:not(:disabled)');
    assert.equal(remaining.length, 2);
    remaining[0].click();
    const before = game.storedRun();
    const turkish = game.heading();
    game.click('#lang-en');
    assert.equal(game.document.documentElement.lang, 'en');
    assert.notEqual(game.heading(), turkish);
    assert.deepEqual(game.storedRun(), before);
    assert.equal(game.get<HTMLInputElement>('input:checked').value, before.selected);
    assert.equal(game.get<HTMLButtonElement>('#lifeline').disabled, true);
    game.click('#home-button');
    assert.match(game.get('#play').textContent!, /Continue round/);
    reopened = openGame({
      [saveKey]: game.window.localStorage.getItem(saveKey)!,
      'kmmi:preferences': game.window.localStorage.getItem('kmmi:preferences')!,
    });
    reopened.click('#play');
    assert.equal(reopened.document.documentElement.lang, 'en');
    assert.equal(reopened.get<HTMLInputElement>('input:checked').value, before.selected);
    assert.equal(reopened.get<HTMLButtonElement>('#lifeline').disabled, true);
    assert.deepEqual(reopened.storedRun(), before);
  } finally {
    game.close();
    reopened?.close();
  }
});

test('settings and withdraw dialogs use their normal controls without changing the current question', () => {
  const game = openGame();
  try {
    game.click('#play');
    const run = game.storedRun();
    game.click('#settings-button');
    const settings = game.get<HTMLDialogElement>('dialog');
    assert.ok(settings.open);
    const language = game.get<HTMLSelectElement>('#question-language');
    language.value = 'en';
    language.dispatchEvent(new game.window.Event('change'));
    assert.equal(game.get('h1').lang, 'en');
    assert.equal(game.document.documentElement.lang, 'tr');
    const theme = game.get<HTMLSelectElement>('#theme');
    theme.value = 'light';
    theme.dispatchEvent(new game.window.Event('change'));
    assert.equal(game.document.documentElement.dataset.theme, 'light');
    game.click('dialog button');
    assert.ok(!settings.open);
    assert.deepEqual(game.storedRun(), run);

    game.click('#withdraw');
    game.click('dialog .secondary');
    assert.deepEqual(game.storedRun(), run);
    game.click('#withdraw');
    game.click('dialog .primary');
    assert.equal(game.storedRun().ending, 'withdrawn');
    assert.match(game.heading()!, /Puanını aldın/);
  } finally {
    game.close();
  }
});

test('corrupted saves recover and an external tab update is protected', () => {
  const game = openGame({ [saveKey]: '{' });
  try {
    assert.match(game.get('.notice').textContent!, /açılamadı/);
    game.click('#play');
    assert.equal(game.get('.notice').textContent, '');
    const otherSave = JSON.stringify({ ...game.storedRun(), runId: 'other-tab' });
    game.window.localStorage.setItem(saveKey, otherSave);
    game.window.dispatchEvent(new game.window.StorageEvent('storage', { key: saveKey, newValue: otherSave }));
    game.click('input[type="radio"]');
    assert.equal(game.window.localStorage.getItem(saveKey), otherSave);
    assert.match(game.get('.notice').textContent!, /başka bir sekmede/);
  } finally {
    game.close();
  }
});

test('standalone output embeds runtime, fonts and artwork and runs a game without asset links', () => {
  const standalone = readFileSync(resolve(build, 'oyun.html'), 'utf8');
  assert.doesNotMatch(standalone, /<script[^>]+src=|<link rel="stylesheet"/);
  assert.equal([...standalone.matchAll(/data:font\/woff2;base64,/g)].length, 4);
  const game = openGame({}, standalone);
  try {
    assert.match(game.get<HTMLImageElement>('.hero img').src, /^data:image\/webp;base64,/);
    game.click('#play');
    const correct = currentQuestion(game.storedRun()).correctOptionId;
    game.click(`label[for="option-${correct}"]`);
    game.click('#confirm');
    assert.match(game.get('#feedback').textContent!, /Doğru cevap/);
  } finally {
    game.close();
  }
});
