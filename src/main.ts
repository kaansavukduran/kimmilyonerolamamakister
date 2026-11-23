import './fonts.css';
import './styles.css';

import { createRun, currentQuestion, remainingOptions, restoreRun, rewards, safeStep, saveKey, score, transition } from './game.ts';
import type { Run } from './game.ts';
import { messages } from './i18n.ts';
import { optionIds, questionText, pool } from './questions.ts';
import type { Language, OptionId } from './questions.ts';

type Theme = 'dark' | 'light' | 'system';
type Preferences = { language: Language; questionLanguage: Language | 'auto'; theme: Theme };
type SaveNotice = 'invalidSave' | 'saveUnavailable' | 'saveChanged';
const preferencesKey = 'kmmi:preferences';

function preferencesFromStorage(): Preferences {
  const defaults: Preferences = { language: 'tr', questionLanguage: 'auto', theme: 'dark' };
  try {
    const saved = JSON.parse(localStorage.getItem(preferencesKey) ?? 'null') as Partial<Preferences> | null;
    if (!saved) return defaults;
    const { language, questionLanguage, theme } = saved;
    return {
      language: language === 'en' ? 'en' : 'tr',
      questionLanguage: questionLanguage === 'tr' || questionLanguage === 'en' ? questionLanguage : 'auto',
      theme: theme === 'light' || theme === 'system' ? theme : 'dark',
    };
  } catch {
    return defaults;
  }
}

const preferences = preferencesFromStorage();
let run: Run | null = null;
let atHome = true;
let lastSaved: string | null = null;
let saveNotice: SaveNotice | null = null;
const systemTheme = matchMedia('(prefers-color-scheme: light)');

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <a class="skip-link" href="#main"></a>
  <div class="shell">
    <header class="site-header"></header>
    <main id="main" tabindex="-1"></main>
    <footer class="site-footer"><span></span></footer>
  </div>
  <dialog aria-labelledby="dialog-title"></dialog>`;

const header = app.querySelector('header')!;
const main = app.querySelector('main')!;
const dialog = app.querySelector('dialog')!;
const skip = app.querySelector<HTMLAnchorElement>('.skip-link')!;
const footer = app.querySelector('footer span')!;
const t = () => messages[preferences.language];
const format = (value: number) => new Intl.NumberFormat(preferences.language).format(value);
const copyLanguage = () => preferences.questionLanguage === 'auto' ? preferences.language : preferences.questionLanguage;
const heroUrl = import.meta.env.BASE_URL + 'question-studio.webp';

function loadRun() {
  try {
    lastSaved = localStorage.getItem(saveKey);
    run = lastSaved ? restoreRun(lastSaved) : null;
    saveNotice = lastSaved && !run ? 'invalidSave' : null;
  } catch {
    saveNotice = 'saveUnavailable';
  }
}

function setNotice(notice: SaveNotice | null) {
  saveNotice = notice;
  const area = main.querySelector('[role="status"]');
  if (area) area.textContent = notice ? t()[notice] : '';
}

function saveRun() {
  if (!run || saveNotice === 'saveChanged') return;
  try {
    if (localStorage.getItem(saveKey) !== lastSaved) {
      setNotice('saveChanged');
      return;
    }
    const serialized = JSON.stringify(run);
    localStorage.setItem(saveKey, serialized);
    lastSaved = serialized;
    setNotice(null);
  } catch {
    setNotice('saveUnavailable');
  }
}

function applyTheme() {
  const theme = preferences.theme === 'system' ? (systemTheme.matches ? 'light' : 'dark') : preferences.theme;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#14111b' : '#f4f1fa');
}

function savePreferences() {
  try {
    localStorage.setItem(preferencesKey, JSON.stringify(preferences));
  } catch {
    setNotice('saveUnavailable');
  }
}

function showHome() {
  atHome = true;
  if (saveNotice === 'saveChanged') loadRun();
  renderMain(true);
}

function renderHeader() {
  const copy = t();
  document.documentElement.lang = preferences.language;
  document.title = copy.title;
  skip.textContent = copy.skip;
  footer.textContent = copy.sample;
  header.innerHTML = `
    <button class="brand" type="button" id="home-button" aria-label="${copy.home}">
      <span class="brand-mark" aria-hidden="true">?</span><span>KMOİ</span>
    </button>
    <div class="header-actions">
      <div class="language-picker" role="group" aria-label="${copy.language}">
        <button type="button" lang="tr" id="lang-tr" aria-pressed="${preferences.language === 'tr'}">Türkçe</button>
        <button type="button" lang="en" id="lang-en" aria-pressed="${preferences.language === 'en'}">English</button>
      </div>
      <button class="settings-button" type="button" id="settings-button" aria-label="${copy.settings}" title="${copy.settings}">
        <span class="settings-icon" aria-hidden="true"><i></i><i></i><i></i></span>
      </button>
    </div>`;
  header.querySelector('#home-button')?.addEventListener('click', showHome);
  header.querySelector('#settings-button')?.addEventListener('click', showSettings);
  for (const language of ['tr', 'en'] as const) {
    header.querySelector(`#lang-${language}`)?.addEventListener('click', () => {
      if (preferences.language !== language) {
        preferences.language = language;
        savePreferences();
        renderHeader();
        renderMain();
        header.querySelector<HTMLButtonElement>(`#lang-${language}`)?.focus();
      }
    });
  }
}

function showSettings() {
  const copy = t();
  dialog.innerHTML = `
    <h2 id="dialog-title">${copy.settings}</h2>
    <label for="question-language">${copy.questionLanguage}</label>
    <select id="question-language">
      <option value="auto">${copy.matchInterface}</option>
      <option value="tr" lang="tr">Türkçe</option>
      <option value="en" lang="en">English</option>
    </select>
    <label for="theme">${copy.theme}</label>
    <select id="theme">
      <option value="dark">${copy.dark}</option>
      <option value="light">${copy.light}</option>
      <option value="system">${copy.system}</option>
    </select>
    <div class="dialog-actions"><button class="button primary" type="button">${copy.close}</button></div>`;
  const language = dialog.querySelector<HTMLSelectElement>('#question-language')!;
  const theme = dialog.querySelector<HTMLSelectElement>('#theme')!;
  language.value = preferences.questionLanguage;
  theme.value = preferences.theme;
  language.addEventListener('change', () => {
    preferences.questionLanguage = language.value as Preferences['questionLanguage'];
    savePreferences();
    renderMain();
  });
  theme.addEventListener('change', () => {
    preferences.theme = theme.value as Theme;
    applyTheme();
    savePreferences();
  });
  dialog.querySelector('button')?.addEventListener('click', () => dialog.close());
  dialog.showModal();
}

function confirmAction(title: string, body: string, verb: string, action: () => void) {
  dialog.innerHTML = `
    <h2 id="dialog-title">${title}</h2>
    <p>${body}</p>
    <div class="dialog-actions">
      <button class="button secondary" type="button" autofocus>${t().cancel}</button>
      <button class="button primary" type="button">${verb}</button>
    </div>`;
  const [cancel, confirm] = dialog.querySelectorAll('button');
  cancel.addEventListener('click', () => dialog.close());
  confirm.addEventListener('click', () => {
    dialog.close();
    action();
  });
  dialog.showModal();
}

function renderHome() {
  const copy = t();
  const canResume = Boolean(run && run.phase !== 'finished');
  const ready = pool.length >= rewards.length;
  return `
    <section class="hero" aria-labelledby="page-title">
      <div class="hero-art"><img src="${heroUrl}" alt="" width="1280" height="960"></div>
      <div class="hero-content">
        <div class="hero-meta"><span class="meta-dot"></span>${copy.roundLength}<span class="meta-divider" aria-hidden="true"></span>${copy.noTimer}</div>
        <h1 id="page-title" tabindex="-1">${copy.titleFirst}<br><span>${copy.titleAccent}</span></h1>
        <p>${copy.description}</p>
        <div class="hero-actions">
          ${ready ? `<button class="button primary" id="play" type="button">
            <span class="play-icon" aria-hidden="true"></span>${canResume ? copy.resume : copy.play}
          </button>` : `<p role="alert">${copy.dataError}</p>`}
          ${canResume ? `<button class="button secondary" id="new" type="button">${copy.newRun}</button>` : ''}
        </div>
      </div>
    </section>
    <section class="rules" aria-label="${copy.roundRules}">
      <div class="rule"><span class="rule-icon lifeline-mark" aria-hidden="true">½</span><div><h2>${copy.lifelineLabel}</h2><p>${copy.lifelineRule}</p></div></div>
      <div class="rule"><span class="rule-icon" aria-hidden="true">◇</span><div><h2>${copy.milestoneLabel}</h2><p>${copy.milestoneRule}</p></div></div>
      <div class="rule"><span class="rule-icon" aria-hidden="true">◎</span><div><h2>${copy.roundLabel}</h2><p>${copy.roundRule}</p></div></div>
    </section>`;
}

function ladder(active: Run) {
  const copy = t();
  return rewards.map((points, index) => {
    const step = index + 1;
    const current = index === active.index;
    const cleared = index < active.index;
    return `<li class="ladder-step${step === safeStep ? ' checkpoint' : ''}${cleared ? ' cleared' : ''}"${current ? ' aria-current="step"' : ''}>
      <span class="step-number">${step}</span>
      ${step === safeStep ? `<span class="checkpoint-label">${copy.safeStep}</span>` : ''}
      <strong>${format(points)}</strong>
    </li>`;
  }).reverse().join('');
}

function renderGame(active: Run) {
  const copy = t();
  const revealed = active.phase === 'feedback';
  const question = currentQuestion(active);
  const isCorrect = active.selected === question.correctOptionId;
  const endOfRound = !isCorrect || active.index === rewards.length - 1;
  const allowed = remainingOptions(active);
  const result = score(active);
  const language = copyLanguage();
  return `
    <div class="game-layout">
      <section class="game-card" aria-labelledby="page-title">
        <div class="game-heading">
          <div class="question-counter">
            <span>${copy.question} <strong>${active.index + 1} / ${rewards.length}</strong></span>
            <div class="progress-rail" aria-hidden="true">
              ${rewards.map((_, index) => `<i class="${index === active.index ? 'active' : index < active.index ? 'done' : ''}"></i>`).join('')}
            </div>
          </div>
          <span class="category"><span class="sr-only">${copy.category} </span>${copy.topics[question.topic]}</span>
        </div>
        <h1 id="page-title" tabindex="-1" lang="${language}"></h1>
        <form id="answer-form">
          <fieldset>
            <legend class="sr-only">${copy.question} ${active.index + 1}</legend>
            <div class="choices">
              ${optionIds.map((id, index) => {
                const eliminated = !allowed.includes(id);
                const correct = revealed && id === question.correctOptionId;
                const wrong = revealed && !isCorrect && id === active.selected;
                return `
                  <div class="choice${eliminated ? ' eliminated' : ''}${correct ? ' correct' : ''}${wrong ? ' wrong' : ''}">
                    <input type="radio" id="option-${id}" name="answer" value="${id}" required${id === active.selected ? ' checked' : ''}${eliminated || revealed ? ' disabled' : ''}>
                    <label for="option-${id}">
                      <span class="choice-letter">${'ABCD'[index]}</span>
                      <span class="choice-text" lang="${language}"></span>
                      ${correct ? `<span class="choice-status"><span aria-hidden="true">✓</span><span class="sr-only">${copy.correctOption}</span></span>` : ''}
                      ${wrong ? `<span class="choice-status"><span aria-hidden="true">×</span><span class="sr-only">${copy.chosenOption}</span></span>` : ''}
                    </label>
                  </div>`;
              }).join('')}
            </div>
          </fieldset>
          ${revealed ? `
            <div class="feedback ${isCorrect ? 'good' : 'bad'}" id="feedback" tabindex="-1">
              <strong>${isCorrect ? copy.correct : copy.incorrect}</strong>
              <p class="answer-note" lang="${language}"></p>
            </div>
            <div class="game-actions"><button class="button primary" type="button" id="advance">${endOfRound ? copy.results : copy.next}</button></div>
          ` : `
            <div class="game-actions">
              <button class="button secondary lifeline" id="lifeline" type="button"${active.lifelineAt === null ? '' : ' disabled'}>
                <span aria-hidden="true">½</span> ${copy.lifelineLabel}${active.lifelineAt === null ? '' : ` · ${copy.used}`}
              </button>
              <button class="button primary" type="submit" id="confirm"${active.selected ? '' : ' disabled'}>${copy.confirm}</button>
            </div>
          `}
        </form>
      </section>
      <aside class="score-card" aria-labelledby="score-title">
        <h2 id="score-title">${copy.ladder}</h2>
        <ol class="ladder" reversed>${ladder(active)}</ol>
        <div class="score-totals"><span>${copy.currentPoints} <strong>${format(result.points)}</strong></span><span>${copy.secured} <strong>${format(result.banked)}</strong></span></div>
        ${revealed ? '' : `<button class="button secondary withdraw" type="button" id="withdraw">${copy.withdraw}</button>`}
      </aside>
    </div>`;
}

function renderResult(active: Run) {
  const copy = t();
  const result = score(active);
  const title = active.ending === 'completed' ? copy.completedTitle
    : active.ending === 'wrong' ? copy.wrongTitle : copy.withdrawnTitle;
  return `
    <section class="result-card" aria-labelledby="page-title">
      <span class="result-emblem" aria-hidden="true">${active.ending === 'completed' ? '✓' : '◎'}</span>
      <h1 id="page-title" tabindex="-1">${title}</h1>
      <p class="result-points"><strong>${format(result.points)}</strong> ${copy.points}</p>
      <dl class="result-stats">
        <div><dt>${copy.correctCount}</dt><dd>${result.correct}</dd></div>
        <div><dt>${copy.incorrectCount}</dt><dd>${result.incorrect}</dd></div>
        <div><dt>${copy.answered}</dt><dd>${active.answers.length} / ${rewards.length}</dd></div>
      </dl>
      <div class="result-actions">
        <button class="button primary" id="replay" type="button">${copy.replay}</button>
        <button class="button secondary" id="menu" type="button">${copy.home}</button>
      </div>
    </section>`;
}

function startRun() {
  const [seed, ...identity] = crypto.getRandomValues(new Uint32Array(5));
  const runId = identity.map(value => value.toString(16).padStart(8, '0')).join('');
  run = createRun(runId, seed);
  atHome = false;
  saveRun();
  renderMain(true);
}

function bindGame(active: Run) {
  const question = currentQuestion(active);
  const text = questionText(question, copyLanguage())!;
  const form = main.querySelector<HTMLFormElement>('#answer-form')!;
  main.querySelector('h1')!.textContent = text.prompt;
  const explanation = form.querySelector('.answer-note');
  if (explanation) explanation.textContent = text.explanation;
  for (const id of optionIds) {
    const input = form.querySelector<HTMLInputElement>(`#option-${id}`)!;
    input.parentElement!.querySelector('.choice-text')!.textContent = text.options[id];
    if (input.parentElement!.classList.contains('eliminated')) {
      const note = document.createElement('span');
      note.className = 'eliminated-note';
      note.textContent = t().eliminated;
      input.nextElementSibling!.append(note);
    }
  }

  function dispatch(action: Parameters<typeof transition>[2]) {
    if (!run || run.runId !== active.runId) return;
    const next = transition(run, question.id, action);
    if (next === run) return;
    run = next;
    saveRun();
    if (action.type === 'select') {
      form.querySelector<HTMLButtonElement>('#confirm')!.disabled = false;
      return;
    }
    renderMain(true);
  }

  form.addEventListener('change', event => {
    if (event.target instanceof HTMLInputElement) {
      dispatch({ type: 'select', optionId: event.target.value as OptionId });
    }
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    dispatch({ type: 'confirm' });
  });
  main.querySelector('#advance')?.addEventListener('click', () => dispatch({ type: 'advance' }));
  main.querySelector('#lifeline')?.addEventListener('click', () => dispatch({ type: 'lifeline' }));
  main.querySelector('#withdraw')?.addEventListener('click', () => {
    const copy = t();
    confirmAction(copy.withdraw, copy.withdrawBody, copy.withdraw, () => dispatch({ type: 'withdraw' }));
  });
}

function renderMain(moveFocus = false) {
  let content: string;
  if (atHome || !run) content = renderHome();
  else if (run.phase === 'finished') content = renderResult(run);
  else content = renderGame(run);
  main.innerHTML = `<p class="notice" role="status"></p>${content}`;
  setNotice(saveNotice);

  if (atHome || !run) {
    main.querySelector('#play')?.addEventListener('click', () => {
      if (run && run.phase !== 'finished') {
        atHome = false;
        renderMain(true);
      } else startRun();
    });
    main.querySelector('#new')?.addEventListener('click', () => {
      const copy = t();
      confirmAction(copy.replaceTitle, copy.replaceBody, copy.newRun, startRun);
    });
  } else if (run.phase === 'finished') {
    main.querySelector('#replay')?.addEventListener('click', startRun);
    main.querySelector('#menu')?.addEventListener('click', showHome);
  } else bindGame(run);

  if (moveFocus) (main.querySelector<HTMLElement>('#feedback') ?? main.querySelector<HTMLElement>('#page-title'))?.focus();
}

loadRun();
applyTheme();
renderHeader();
renderMain();
systemTheme.addEventListener('change', applyTheme);
window.addEventListener('storage', event => {
  if (event.key !== saveKey || event.newValue === lastSaved) return;
  if (atHome) {
    loadRun();
    renderMain();
  } else {
    setNotice('saveChanged');
  }
});
