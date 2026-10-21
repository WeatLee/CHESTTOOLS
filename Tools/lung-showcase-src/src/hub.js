// The start page: one card per examination. It is deliberately light (no 3D, no demo code);
// the 3D scene is only loaded when a card is opened (see entry.js).
import { versioned } from './ver.js';

export const SITE = 'https://weatlee.github.io/CHESTTOOLS/Tools/lung-showcase.html';

// Order of the cards (also the order of the previous / next buttons inside an examination).
export const HUB = [
  {
    id: 'wash', name: '支氣管鏡沖洗', en: 'Bronchoscopic washing',
    text: '肺部有發炎或感染時，醫師用支氣管鏡到發炎的位置，注入少量無菌生理食鹽水再吸回來，收集檢體送去培養或檢驗，找出致病的原因。',
    picture: 'lung-showcase/images/wash-room.webp'
  },
  {
    id: 'bronch', name: '支氣管鏡切片', en: 'Bronchoscopic biopsy',
    text: '肺部有腫瘤或異常陰影、位置在鏡子可以到達的支氣管附近時，用支氣管鏡夾取一小塊組織做病理檢查。',
    picture: 'lung-showcase/images/bronch-room.webp'
  },
  {
    id: 'tbna', name: '超音波支氣管鏡淋巴結穿刺', en: 'EBUS-TBNA',
    text: '用超音波支氣管鏡看著氣管外的淋巴結，用細針穿過氣管壁取樣，確認有沒有癌細胞，也用在肺癌的分期。',
    picture: 'lung-showcase/images/tbna-room.webp'
  },
  {
    id: 'ct', name: '電腦斷層導引穿刺', en: 'CT-guided biopsy',
    text: '腫瘤長在肺的外圍、支氣管鏡不容易到達時，在電腦斷層的導引下，用細針從胸壁穿刺取樣。',
    picture: 'lung-showcase/images/ct-table.webp'
  },
  {
    id: 'drain', name: '胸腔引流（豬尾巴導管）', en: 'Pleural drainage',
    text: '胸腔積了太多水、造成喘或胸悶時，放一條細細的豬尾巴導管，把水慢慢引流出來，讓被壓住的肺重新張開。',
    picture: 'lung-showcase/images/pigtail-bedside.webp'
  }
];

const link = id => `${SITE}#${id}`;

function card(item, index) {
  const el = document.createElement('article');
  el.className = 'hub-card';
  el.innerHTML = `
    <div class="hub-pic none"><span class="hub-no">${index + 1}</span></div>
    <div class="hub-body">
      <h2>${item.name}</h2>
      <p class="hub-en">${item.en}</p>
      <p class="hub-text">${item.text}</p>
      <div class="hub-actions">
        <a class="hub-open" href="#${item.id}">看 3D 示範 <span aria-hidden="true">→</span></a>
        <button class="hub-qr-btn" type="button" aria-expanded="false">QR Code</button>
      </div>
      <div class="hub-qr" hidden>
        <img src="${versioned(`lung-showcase/qr/${item.id}.png`)}" alt="${item.name}的 QR Code，掃描後在手機開啟" width="168" height="168" loading="lazy">
        <p>用手機相機掃描，直接開啟「${item.name}」</p>
      </div>
    </div>`;
  if (item.picture) {
    const pic = el.querySelector('.hub-pic');
    const image = new Image();
    image.alt = '';
    image.addEventListener('load', () => { pic.append(image); pic.classList.remove('none'); });
    image.src = versioned(item.picture);
  }
  const button = el.querySelector('.hub-qr-btn'), box = el.querySelector('.hub-qr');
  button.addEventListener('click', () => {
    box.hidden = !box.hidden;
    button.setAttribute('aria-expanded', String(!box.hidden));
  });
  return el;
}

export function renderHub(container) {
  const list = container.querySelector('#hubCards');
  HUB.forEach((item, index) => list.appendChild(card(item, index)));
}
