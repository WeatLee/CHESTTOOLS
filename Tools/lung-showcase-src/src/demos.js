import { createSoundDemo } from './auscultation.js';
import { createCtDemo } from './ctguide.js';
import { createWashDemo } from './washing.js';

// The five demonstrations. Each one sets the hidden scene controls and supplies
// the patient-facing text. Every demo is a schematic illustration, not a real case.
// Progress values are 0-100 and match the stage boundaries in main.js.
const HOME = [[0, .15, 7.9], [0, -.1, 0]];

// Pictures to show under a demo once the files exist in Tools/lung-showcase/images/.
// A picture whose file is missing stays hidden, so these can be added at any time.
const pictures = {
  bronch: [{ src: 'lung-showcase/images/bronch-room.webp', caption: 'AI 生成之示意圖：支氣管鏡室，醫師站在床頭，鏡子由鼻孔進入，旁邊的螢幕顯示氣管內部，夾子可以夾取組織' }],
  tbna: [{ src: 'lung-showcase/images/tbna-room.webp', caption: 'AI 生成之示意圖：超音波支氣管鏡檢查，病人嘴巴含著咬口器，鏡子由口腔進入；螢幕同時顯示超音波影像（看到淋巴結和針）與氣管內部' }],
  drain: [{ src: 'lung-showcase/images/pigtail-bedside.webp', caption: 'AI 生成之示意圖：床邊放置胸腔引流管，病人坐著、身體前傾，醫師從側背部把導管放入' }],
  sound: [{ src: 'lung-showcase/images/auscultation.webp', caption: '用聽診器聽診的情形' }],
  ct: [{ src: 'lung-showcase/images/ct-table.webp', caption: 'AI 生成之示意圖：病人躺在檢查台上，醫師看著影像引導針進入' }]
};

// Demos driven by one of the engine's built-in players (slider, play and reset buttons).
function enginePlayer(slider, play, reset) {
  return {
    slider, play, reset,
    seek(c, value) { c.setVal(slider, value); }
  };
}

export const DEMOS = [
  {
    id: 'bronch', no: 1, tab: '支氣管鏡切片',
    title: '支氣管鏡切片',
    when: '當肺部有腫瘤或異常陰影，而且位置在鏡子可以到達的支氣管附近時，醫師會用支氣管鏡取一小塊組織做病理檢查。檢查前會先做局部麻醉，必要時搭配鎮靜。',
    camera: HOME,
    pictures: pictures.bronch,
    ...enginePlayer('procedure', 'playBtn', 'resetProcedure'),
    steps: [
      { at: 0, title: '進入氣管', text: '麻醉後，細長的支氣管鏡從鼻腔或口腔進入，經過喉嚨到達氣管。' },
      { at: 31, title: '進入右側主支氣管', text: '沿著氣管往下，到氣管分岔的地方（隆突）後，轉進右側的主支氣管。' },
      { at: 65, title: '接近腫瘤', text: '轉進右上葉的前段支氣管，鏡頭靠近黃色標示的腫瘤位置。' },
      { at: 90, title: '夾取組織', text: '取樣鉗從鏡子前端伸出，夾取少量組織送去做病理檢查。' }
    ],
    enter(c) {
      c.setVal('locationSelect', 'RS3', 'change'); // right upper lobe, anterior segment
      c.setVal('size', 3);                          // a 3 cm mass
      c.api.setCamera(...this.camera);
      c.setVal('procedure', 0);                     // enters the scope mode and shows the lesion
      c.click('playBtn');
    }
  },
  {
    id: 'tbna', no: 2, tab: 'EBUS-TBNA',
    title: '超音波支氣管鏡淋巴結針吸取樣（EBUS-TBNA）',
    when: '用來檢查胸腔中央、氣管與支氣管旁的淋巴結，確認有沒有癌細胞或其他疾病，也用在肺癌的分期。淋巴結在氣管壁外面，所以要用超音波看著，把針穿過氣管壁取樣。',
    pictures: pictures.tbna,
    ...enginePlayer('tbnaProgress', 'tbnaPlay', 'tbnaReset'),
    steps: [
      { at: 0, title: '鏡子進入氣管', text: '超音波支氣管鏡前端有一個小型超音波探頭，沿著氣管前進到氣管分岔處的下方。' },
      { at: 35, title: '用超音波找到淋巴結', text: '探頭貼住氣管壁，在超音波畫面中找到隆突下方的淋巴結（黃色標示），並確認旁邊沒有大血管。' },
      { at: 60, title: '細針穿過氣管壁', text: '在超音波的即時引導下，細針穿過氣管壁刺入淋巴結。' },
      { at: 85, title: '抽吸取樣', text: '針在淋巴結內來回抽吸，取得細胞或少量組織，送去檢查。' }
    ],
    enter(c) {
      c.setVal('tbnaStation', '7', 'change'); // subcarinal node: the clearest to see; also starts the demo
    }
  },
  createCtDemo(),
  {
    id: 'drain', no: 4, tab: '胸腔引流',
    title: '胸腔引流管（豬尾巴導管）置入',
    when: '當胸腔裡積了太多水（胸水），造成喘、胸悶時，可以放一條細細的豬尾巴導管，把水慢慢引流出來，讓被壓住的肺重新張開。',
    pictures: pictures.drain,
    ...enginePlayer('drainProgress', 'drainPlay', 'drainReset'),
    steps: [
      { at: 0, title: '超音波定位', text: '先用超音波看到積水的位置，在皮膚上做記號，並選一個肋骨之間比較安全的位置。' },
      { at: 12, title: '局部麻醉', text: '皮膚消毒後，用細針把麻醉藥打在皮膚到胸膜的路徑上，並抽到胸水，確認位置正確。' },
      { at: 24, title: '導管連同內針直接放入', text: '豬尾巴導管套在較硬的內針上，一起從兩根肋骨之間的縫隙直接穿過胸壁，進入胸腔（不需要導線）。' },
      { at: 46, title: '退出內針，導管捲曲', text: '內針慢慢退出，導管繼續往胸腔裡送，前端自然捲成豬尾巴的形狀，避免滑出來。' },
      { at: 62, title: '胸水流出，肺張開', text: '胸水經由導管慢慢流出，水位下降，被壓住的肺再慢慢張開。' }
    ],
    enter(c) {
      c.setVal('drainSide', 'R', 'change'); // right side; also starts the demo
    }
  },
  createSoundDemo(),
  createWashDemo()
];
