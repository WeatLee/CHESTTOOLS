// Patient-education text under a demo (edu/<id>.html, made by build-edu.mjs from the Obsidian drafts).
// Examinations without a text file simply show nothing here.
import { versioned } from './ver.js';

const ids = new Set(['wash', 'bronch', 'tbna', 'drain']);   // examinations whose text has been published
export const hasEdu = id => ids.has(id);
const cache = new Map();

export async function showEdu(id) {
  const box = document.getElementById('edu');
  box.hidden = true;
  box.replaceChildren();
  if (!ids.has(id)) return;
  try {
    if (!cache.has(id)) {
      const response = await fetch(versioned(`lung-showcase/edu/${id}.html`));
      if (!response.ok) throw new Error(response.status);
      cache.set(id, await response.text());
    }
    if (location.hash.slice(1) !== id) return;       // the user already moved on
    box.innerHTML = cache.get(id);
    box.hidden = false;
  } catch { /* the demo works without the text */ }
}

export function hideEdu() {
  const box = document.getElementById('edu');
  if (box) { box.hidden = true; box.replaceChildren(); }
}
