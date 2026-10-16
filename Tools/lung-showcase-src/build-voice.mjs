// Pre-records the step narration as MP3 files with edge-tts (Microsoft neural voices).
// Usage: VOICE_PY=<python with edge-tts> node build-voice.mjs [lang ...]
// Output: voice/<lang>/<demo>-<step>.mp3 (steps are numbered from 1). Only step text is sent to the service.
import { LANGS, VOICE_TEXT } from './src/voice-text.js';
import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';

const py = process.env.VOICE_PY || 'python';
const wanted = process.argv.slice(2);
for (const lang of LANGS) {
  if (!lang.voice || (wanted.length && !wanted.includes(lang.id))) continue;
  mkdirSync(`voice/${lang.id}`, { recursive: true });
  for (const [demo, steps] of Object.entries(VOICE_TEXT)) {
    steps.forEach((step, index) => {
      const out = `voice/${lang.id}/${demo}-${index + 1}.mp3`;
      if (existsSync(out)) return;
      const [title, text] = step[lang.id];
      const run = spawnSync(py, ['-m', 'edge_tts', '--voice', lang.voice, '--text', `${title}。${text}`, '--write-media', out], { encoding: 'utf8' });
      if (run.status !== 0) { console.error('FAILED', out, run.stderr); process.exitCode = 1; }
      else console.log('ok', out);
    });
  }
}
