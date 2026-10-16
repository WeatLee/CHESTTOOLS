// Spoken narration for the step captions. Pre-recorded MP3 files (voice/<lang>/<demo>-<n>.mp3,
// n counts from 1) start when the current step begins, while the animation keeps running.
// showcase.js holds the animation at the end of a step until the clip has finished (afterClip),
// so the next step never appears while the voice is still describing the previous one.
import { LANGS, VOICE_TEXT } from './voice-text.js';

const KEY = 'showcase-voice';
// Languages whose audio files exist. Taiwanese has no recording yet, so it stays disabled.
const READY = new Set(['zh', 'en', 'vi', 'ms', 'id']);

function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
function save(state) { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage blocked: fine */ } }

export function createVoice({ onLangChange }) {
  const saved = load();
  const state = { on: false, lang: READY.has(saved.lang) ? saved.lang : 'zh' };
  let audio = null, token = 0, timer = 0, after = null;

  const bar = document.getElementById('voicebar');
  const toggle = document.getElementById('voiceToggle');
  const select = document.getElementById('voiceLang');
  for (const lang of LANGS) {
    if (!READY.has(lang.id)) continue; // Taiwanese is hidden until its recordings exist
    const option = document.createElement('option');
    option.value = lang.id;
    option.textContent = READY.has(lang.id) ? lang.label : `${lang.label}（準備中）`;
    option.disabled = !READY.has(lang.id);
    select.appendChild(option);
  }
  select.value = state.lang;

  const refreshToggle = () => {
    toggle.setAttribute('aria-pressed', String(state.on));
    toggle.textContent = state.on ? '🔊 語音：開' : '🔇 語音：關';
  };
  refreshToggle();

  function stop() {
    token++; // a pending start belongs to the old token and is dropped
    clearTimeout(timer);
    after = null;
    if (audio) { audio.pause(); audio = null; }
  }

  // Caption for a step in the chosen language (Chinese keeps the page's own text).
  function caption(demo, index) {
    const step = demo.steps[index];
    const entry = VOICE_TEXT[demo.id]?.[index]?.[state.lang];
    return state.lang === 'zh' || !entry ? { t: step.title, d: step.text, lang: 'zh-TW' }
      : { t: entry[0], d: entry[1], lang: LANGS.find(l => l.id === state.lang).htmlLang };
  }

  // Plays the clip for one step from its beginning.
  function speak(demo, index) {
    stop();
    if (!state.on || !VOICE_TEXT[demo.id]?.[index]) return;
    const mine = token;
    const done = () => { if (mine !== token) return; const next = after; after = null; audio = null; next?.(); };
    audio = new Audio(`lung-showcase/voice/${state.lang}/${demo.id}-${index + 1}.mp3`);
    audio.addEventListener('ended', done);
    audio.addEventListener('error', done);
    audio.play().catch(done);
  }

  // Called when the visible step changes. While the animation runs the clip starts at once;
  // otherwise (dragging the progress bar) it waits briefly so that passing steps are not all read out.
  function stepChanged(demo, index, playing) {
    stop();
    if (!state.on) return;
    if (playing) { speak(demo, index); return; }
    const mine = token;
    timer = setTimeout(() => { if (mine === token) speak(demo, index); }, 250);
  }

  toggle.addEventListener('click', () => {
    state.on = !state.on;
    save({ lang: state.lang });
    refreshToggle();
    if (!state.on) stop();
    onLangChange(true);
  });
  select.addEventListener('change', () => {
    state.lang = select.value;
    save({ lang: state.lang });
    stop();
    onLangChange(false);
  });

  return {
    state, caption, speak, stop, stepChanged, bar,
    busy: () => !!audio,                 // a clip is playing (or paused by the user)
    holding: () => after !== null,       // the animation is waiting for the clip to end
    afterClip(fn) { after = fn; },       // run fn when the current clip ends; dropped by stop()
    pauseAudio() { after = null; audio?.pause(); },
    resumeAudio() { audio?.play().catch(() => {}); }
  };
}
