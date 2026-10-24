import { atom, read, update } from 'claude-code'
import type { ElementTable, Register } from 'claude-code'

import type { Cabin } from '../types'

const PANE = 'snow-cabin'
const STRINGS = {
  en: {
    title: 'Snowy cabin',
    alt: 'A cabin in a snowy forest with mountains behind. Snow falls softly, and a white rabbit, a white fox, a magpie and a husky come by.',
    working: (clock: string, tools: number) => `Working ${clock} · tools ${tools}`,
    idle: 'Idle',
    opened: 'Opened the snowy cabin pane.',
    note: 'The animation shows in the desktop app.',
  },
  ko: {
    title: '눈 오는 오두막',
    alt: '눈 덮인 숲속 오두막. 뒤로 설산이 보이고 눈이 소복소복 내리며, 흰 토끼와 흰 여우, 까치가 찾아옵니다.',
    working: (clock: string, tools: number) => `작업 중 ${clock} · 도구 ${tools}회`,
    idle: '쉬는 중',
    opened: '눈 오는 오두막을 열었습니다.',
    note: '그림 움직임은 데스크톱 앱에서 보입니다.',
  },
}

type Words = (typeof STRINGS)['en']

const MAX = 6 // snowmen the yard holds
const FIRST = 2 // seconds into a turn the first snowman starts
const EVERY = 15 // and a new one after that

// ---scene-start
type Yard = { working: boolean; startedAt: number; endedAt: number; built: number; base: number }
type Key = [number, number, number] // seconds into the loop, x, y

const W = 400
const H = 1200
const GROUND = 700

const n = (v: number) => String(Math.round(v * 10) / 10)
const r3 = (v: number) => String(Math.round(v * 1000) / 1000)
const EASE = '.45 0 .55 1'
const rnd = (s: number) => {
  const v = Math.sin(s * 127.1 + 311.7) * 43758.5453

  return v - Math.floor(v)
}

// Looping motion shifts back by the time already elapsed, so redrawing the picture never makes it jump.
// Tags marked data-once (nightfall, a snowman being built) are timed from now and left alone.
const retime = (svg: string, elapsed: number) =>
  svg.replace(/<(animate|animateTransform|animateMotion)\b[^>]*>/g, tag => {
    if (tag.includes('data-once')) {
      return tag
    }
    const found = / begin="(-?[\d.]+)s"/.exec(tag)
    const shifted = ` begin="${n((found ? parseFloat(found[1] ?? '0') : 0) - elapsed)}s"`

    return found ? tag.replace(found[0], shifted) : tag.replace(/^<(\w+)/, `<$1${shifted}`)
  })

// a translate through timed points, looping
const track = (keys: Key[], period: number, begin: number) =>
  `<animateTransform attributeName="transform" type="translate" values="${keys.map(([, x, y]) => `${n(x)} ${n(y)}`).join(';')}" keyTimes="${keys.map(([t]) => r3(t / period)).join(';')}" dur="${period}s" begin="${begin}s" repeatCount="indefinite"/>`

// ---- the sky and the far peaks ---------------------------------------------------------------------------
const SKY =
  `<rect x="0" y="0" width="${W}" height="${GROUND + 20}" fill="url(#sky)"/>` +
  '<circle cx="300" cy="150" r="70" fill="#fff" opacity=".25"/><circle cx="300" cy="150" r="30" fill="#fffbea" opacity=".9"/>'

const MOUNTAINS =
  // the far range, pale; then the near one, with its shadowed faces and snowfields
  '<path d="M0 520 L60 450 L110 488 L180 400 L250 470 L310 420 L400 500 V660 H0Z" fill="#d6e2ee"/>' +
  '<path d="M180 400 L215 445 L200 470 L250 470Z M310 420 L340 450 L330 470 L400 500 V520 L330 480Z" fill="#bccdde"/>' +
  '<path d="M-20 600 L70 500 L120 540 L210 450 L300 545 L350 510 L420 580 V680 H-20Z" fill="#eef4fa"/>' +
  '<path d="M210 450 L250 494 L236 520 L300 545 L270 560 L230 530Z M70 500 L95 530 L86 550 L120 540 L100 570Z M350 510 L380 545 L420 580 L380 590Z" fill="#c4d4e4"/>' +
  '<path d="M196 466 L210 450 L224 466 L216 470 L210 464 L203 471Z" fill="#fff"/>'

// ---- the white forest -------------------------------------------------------------------------------------
// far trees skip the grey edge on their snow: too small to need it, and it keeps the picture light
const pine = (x: number, base: number, h: number, w: number, dark: string, k: number, edged = true) => {
  const tiers = [0, 1, 2, 3]
    .map(i => {
      const top = base - h + i * h * 0.2
      const bot = top + h * 0.36
      const hw = (w / 2) * (0.42 + 0.2 * i)
      const mid = top + (bot - top) * 0.62

      return (
        `<path d="M${n(x)} ${n(top)} L${n(x + hw)} ${n(bot)} Q${n(x)} ${n(bot + 7)} ${n(x - hw)} ${n(bot)}Z" fill="${dark}"/>` +
        // snow lying on the tier: a cap, and a soft rim along its lower edge
        `<path d="M${n(x)} ${n(top)} L${n(x + hw * 0.66)} ${n(mid)} Q${n(x + hw * 0.3)} ${n(mid - 5 + rnd(k + i) * 4)} ${n(x + hw * 0.05)} ${n(mid + 2)} Q${n(x - hw * 0.3)} ${n(mid - 6)} ${n(x - hw * 0.66)} ${n(mid)}Z" fill="#fbfdff"${edged ? ' stroke="#a9bccf" stroke-width="1"' : ''}/>` +
        (edged
          ? [
              ['#a9bccf', Math.max(2, w / 22) + 2],
              ['#fbfdff', Math.max(2, w / 22)],
            ]
          : [['#fbfdff', Math.max(2, w / 22)]]
        )
          .map(([c, sw]) => `<path d="M${n(x - hw * 0.95)} ${n(bot - 1)} Q${n(x - hw * 0.5)} ${n(bot - 6)} ${n(x)} ${n(bot + 3)} Q${n(x + hw * 0.5)} ${n(bot - 6)} ${n(x + hw * 0.95)} ${n(bot - 1)}" fill="none" stroke="${c}" stroke-width="${n(sw as number)}" stroke-linecap="round"/>`)
          .join('')
      )
    })
    .join('')

  return `<rect x="${n(x - w * 0.05)}" y="${n(base - 6)}" width="${n(w * 0.1)}" height="12" fill="#5a4636"/>${tiers}`
}

const birch = (x: number, base: number, h: number) =>
  `<rect x="${x - 3.5}" y="${base - h}" width="7" height="${h}" fill="#f4f2ec"/><rect x="${x + 1.5}" y="${base - h}" width="2" height="${h}" fill="#d8d4ca"/>` +
  Array.from({ length: Math.floor(h / 18) }, (_, k) => `<path d="M${x - 3.5} ${base - h + 10 + k * 18 + rnd(x + k) * 6} h${n(3 + rnd(x + k + 5) * 4)}" stroke="#3a3530" stroke-width="1.6"/>`).join('') +
  `<path d="M${x} ${base - h * 0.7} l-22 -26 M${x} ${base - h * 0.5} l20 -22 M${x} ${base - h * 0.85} l14 -20" stroke="#8a8278" stroke-width="1.4" fill="none"/>` +
  `<path d="M${x - 22} ${base - h * 0.7 - 26} l8 9 M${x + 20} ${base - h * 0.5 - 22} l-7 8" stroke="#fbfdff" stroke-width="2.4" stroke-linecap="round"/>`

const FAR_FOREST = Array.from({ length: 19 }, (_, k) => {
  const x = k * 22 - 4 + rnd(k) * 8
  const h = 30 + rnd(k + 40) * 26

  return pine(x, GROUND + 4 + rnd(k + 80) * 6, h, h * 0.62, '#7891a6', k, false)
}).join('')

const MID_FOREST = [
  [104, 772, 130],
  [352, 774, 140],
  [380, 790, 110],
  [70, 790, 100],
]
  .map(([x, b, h], k) => pine(x, b, h, h * 0.6, '#3d6658', k + 100))
  .join('')

const NEAR_TREES = pine(34, 960, 300, 150, '#24483c', 200) + pine(392, 990, 320, 160, '#24483c', 210) + birch(124, 900, 150) + birch(350, 916, 120)

// ---- the ground: soft drifts, rabbit tracks, a fence and a woodpile ----------------------------------------
const GROUND_SNOW =
  `<path d="M0 ${GROUND} Q100 ${GROUND - 12} 200 ${GROUND - 2} T400 ${GROUND - 6} V${H} H0Z" fill="#e8eff7"/>` +
  [
    [70, 820, 120, 14],
    [300, 900, 140, 16],
    [140, 1000, 170, 18],
    [330, 1090, 150, 18],
    [80, 1150, 140, 16],
  ]
    .map(([x, y, rx, ry]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#d2deea"/><ellipse cx="${x - 10}" cy="${y - 6}" rx="${rx * 0.9}" ry="${ry * 0.8}" fill="#eef3f9"/>`)
    .join('') +
  Array.from({ length: 12 }, (_, k) => `<g fill="#b9c8d8"><ellipse cx="${30 + k * 30}" cy="${n(940 + Math.sin(k) * 6)}" rx="2.2" ry="3"/><ellipse cx="${36 + k * 30}" cy="${n(944 + Math.sin(k) * 6)}" rx="2.2" ry="3"/><ellipse cx="${44 + k * 30}" cy="${n(938 + Math.sin(k) * 6)}" rx="3" ry="5"/></g>`).join('')

const FENCE =
  '<path d="M-4 874 H150 M-4 892 H150" stroke="#6a5240" stroke-width="4"/><path d="M-4 871 H150 M-4 889 H150" stroke="#fbfdff" stroke-width="3" stroke-linecap="round"/>' +
  [8, 38, 68, 98, 128].map(x => `<rect x="${x - 4}" y="860" width="8" height="44" fill="#7a5e48"/><ellipse cx="${x}" cy="860" rx="6.6" ry="4" fill="#fbfdff"/>`).join('')

const WOODPILE =
  '<g transform="translate(336 852)"><rect x="-4" y="-30" width="58" height="34" fill="#5a4030"/>' +
  [0, 1, 2]
    .map(r => [0, 1, 2, 3].map(c => `<circle cx="${4 + c * 14 + (r % 2) * 6}" cy="${-4 - r * 10}" r="5.6" fill="#b88a5a" stroke="#7a5638" stroke-width="1.2"/>`).join(''))
    .join('') +
  '<path d="M-6 -32 Q10 -42 26 -36 Q42 -44 58 -32 Z" fill="#fbfdff"/></g>'

// ---- the cabin ---------------------------------------------------------------------------------------------
const WINDOWS: [number, number, number, number][] = [
  [172, 790, 34, 30],
  [270, 790, 34, 30],
]

const CABIN =
  // log walls
  '<rect x="152" y="758" width="176" height="104" fill="#7a5238"/>' +
  Array.from({ length: 8 }, (_, k) => `<path d="M152 ${770 + k * 12} H328" stroke="#5e3e2a" stroke-width="2"/><circle cx="152" cy="${764 + k * 12}" r="5" fill="#a87c58"/><circle cx="328" cy="${764 + k * 12}" r="5" fill="#a87c58"/>`).join('') +
  // gable, roof, and the thick snow on it with icicles
  '<path d="M160 760 L240 700 L320 760Z" fill="#6a4630"/><circle cx="240" cy="736" r="10" fill="#3a3040"/><circle cx="240" cy="736" r="10" fill="none" stroke="#5a3e2a" stroke-width="3"/>' +
  '<path d="M130 772 L240 686 L350 772 L338 776 L240 700 L142 776Z" fill="#4a3428"/>' +
  '<path d="M124 774 Q130 760 140 762 L240 680 L340 762 Q352 760 356 774 Q340 782 324 776 Q300 784 280 776 Q260 784 240 778 Q220 786 200 777 Q178 785 160 777 Q140 784 124 774Z" fill="#fbfdff" stroke="#b8c8da" stroke-width="1.4"/>' +
  '<path d="M240 680 L340 762 Q300 740 240 700 Q180 740 140 762Z" fill="#e6eef6"/>' +
  [148, 176, 206, 232, 262, 290, 318, 342].map((x, k) => `<path d="M${x - 3} ${778 + (k % 2)} L${x} ${790 + (k % 3) * 4} L${x + 3} ${778 + (k % 2)}Z" fill="#dff0ff"/>`).join('') +
  // chimney
  '<rect x="284" y="694" width="24" height="48" fill="#8a8590"/><path d="M284 704 H308 M284 716 H308 M284 728 H308 M296 694 V704 M290 704 V716 M302 716 V728" stroke="#6e6a74" stroke-width="1.4"/>' +
  '<path d="M280 696 Q284 684 296 688 Q308 682 312 696Z" fill="#fbfdff"/>' +
  // door with a wreath, the step, and the windows' frames and snowy sills
  '<rect x="226" y="806" width="30" height="56" rx="3" fill="#5a3826"/><circle cx="250" cy="836" r="2" fill="#d8b04a"/>' +
  '<circle cx="241" cy="822" r="7" fill="none" stroke="#3f7a4a" stroke-width="3.4"/><circle cx="241" cy="816" r="1.8" fill="#d8403a"/>' +
  '<rect x="218" y="860" width="46" height="8" fill="#fbfdff"/>' +
  WINDOWS.map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#3a4a64"/><path d="M${x + 2} ${y + h - 4} L${x + w * 0.45} ${y + 2}" stroke="#fff" stroke-opacity=".25" stroke-width="5"/>`).join('')

const FRAMES = WINDOWS.map(
  ([x, y, w, h]) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#e8dcc8" stroke-width="3"/><path d="M${x + w / 2} ${y} V${y + h} M${x} ${y + h / 2} H${x + w}" stroke="#e8dcc8" stroke-width="2"/>` +
    `<path d="M${x - 4} ${y + h + 2} Q${x + w / 2} ${y + h - 6} ${x + w + 4} ${y + h + 2}Z" fill="#fbfdff"/>`,
).join('')

// warm light in the windows and spilling on the snow, and the lantern by the door
const LIGHTS =
  WINDOWS.map(
    ([x, y, w, h]) =>
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffd27a"><animate attributeName="fill" values="#ffd27a;#ffc860;#ffd27a" dur="3s" repeatCount="indefinite"/></rect>` +
      `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w}" ry="${h}" fill="#ffd27a" opacity=".22"/><path d="M${x - 6} 868 L${x + w + 6} 868 L${x + w + 20} 910 L${x - 20} 910Z" fill="#ffd27a" opacity=".16"/>`,
  ).join('') +
  '<circle cx="240" cy="736" r="8" fill="#ffd27a"/>' +
  '<rect x="262" y="808" width="8" height="12" rx="2" fill="#ffe2a0"/><circle cx="266" cy="814" r="22" fill="#ffd27a" opacity=".2"/>'

// a few wisps by day; at night the stove is going and the smoke rolls out
const smoke = (busy: boolean) =>
  Array.from({ length: busy ? 6 : 2 }, (_, k) => {
    const dur = busy ? 6 : 9
    const begin = n((-k * dur) / (busy ? 6 : 2))
    const r = busy ? 9 : 5

    return (
      `<circle cx="296" cy="684" r="${r}" fill="#eef1f6" opacity="0">` +
      `<animate attributeName="opacity" values="0;${busy ? '.5' : '.4'};0" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>` +
      `<animate attributeName="r" values="${r};${r * 3.2}" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>` +
      `<animateTransform attributeName="transform" type="translate" values="0 0;-14 -70;-44 -180" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/></circle>`
    )
  }).join('')

// ---- visitors: a white rabbit, a white fox and a magpie ---------------------------------------------------
const RABBIT_ART =
  '<ellipse cx="0" cy="1" rx="17" ry="3.6" fill="#8ea2b8" opacity=".45"/>' +
  '<ellipse cx="0" cy="-10" rx="13" ry="10" fill="#fbfdff" stroke="#8396ac" stroke-width="1.5"/><circle cx="-12" cy="-8" r="4.4" fill="#fbfdff" stroke="#8396ac" stroke-width="1.5"/>' +
  '<ellipse cx="6" cy="-2" rx="7" ry="3.4" fill="#d6e0ea"/><circle cx="12" cy="-18" r="7" fill="#fbfdff" stroke="#8396ac" stroke-width="1.5"/>' +
  '<g><animateTransform attributeName="transform" type="rotate" values="0 10 -24;0 10 -24;-14 10 -24;0 10 -24" keyTimes="0;.8;.9;1" dur="2.6s" repeatCount="indefinite"/>' +
  '<ellipse cx="8" cy="-34" rx="3.4" ry="11" fill="#fbfdff" stroke="#8396ac" stroke-width="1.5" transform="rotate(-12 8 -34)"/><ellipse cx="8" cy="-34" rx="1.6" ry="8" fill="#f6c6d0" transform="rotate(-12 8 -34)"/>' +
  '<ellipse cx="14" cy="-33" rx="3.2" ry="10" fill="#fbfdff" stroke="#8396ac" stroke-width="1.5" transform="rotate(10 14 -33)"/></g>' +
  '<circle cx="15" cy="-19" r="1.5" fill="#2a2030"/><circle cx="19" cy="-16" r="1.2" fill="#f2a0b0"/>'

// hop along: [from x, hops, length of each], then sit a while, then hop off
const hopKeys = (y: number, start: number, legs: [number, number][], sit: number, period: number): Key[] => {
  const keys: Key[] = [[0, -40, y], [start, -40, y]]
  let t = start
  let x = -40
  legs.forEach(([count, step], i) => {
    for (let k = 0; k < count; k++) {
      keys.push([t + 0.22, x + step / 2, y - 14], [t + 0.45, x + step, y])
      t += 0.45
      x += step
    }
    if (i < legs.length - 1) {
      t += sit
      keys.push([t, x, y])
    }
  })
  keys.push([period, x, y])

  return keys
}

const RABBIT = `<g>${track(hopKeys(946, 2, [[9, 20], [14, 20]], 4, 34), 34, -10)}${RABBIT_ART}</g>`

const FOX_ART =
  // facing left: a full white tail, a dark-tipped muzzle and amber eyes
  '<ellipse cx="4" cy="9" rx="30" ry="4" fill="#8ea2b8" opacity=".45"/>' +
  '<path d="M16 -14 Q40 -22 44 -6 Q38 2 18 -4Z" fill="#fbfdff" stroke="#8396ac" stroke-width="1.5"/>' +
  '<g><animateTransform attributeName="transform" type="rotate" values="-6;6;-6" dur=".5s" repeatCount="indefinite"/>' +
  '<path d="M-10 -4 V8 M10 -4 V8" stroke="#b8c6d6" stroke-width="4.4" stroke-linecap="round"/></g>' +
  '<path d="M-6 -4 V8 M14 -4 V8" stroke="#8396ac" stroke-width="6" stroke-linecap="round"/><path d="M-6 -4 V8 M14 -4 V8" stroke="#fbfdff" stroke-width="3.4" stroke-linecap="round"/>' +
  '<ellipse cx="2" cy="-10" rx="18" ry="9" fill="#fbfdff" stroke="#8396ac" stroke-width="1.5"/><path d="M-12 -4 Q2 0 18 -5" stroke="#c8d4e2" stroke-width="3" fill="none" stroke-linecap="round"/>' +
  '<path d="M-14 -14 Q-20 -28 -30 -18 L-36 -14 Q-30 -8 -18 -6Z" fill="#fbfdff" stroke="#8396ac" stroke-width="1.5"/>' +
  '<path d="M-22 -24 L-20 -34 L-14 -24Z M-14 -22 L-10 -31 L-8 -21Z" fill="#fbfdff" stroke="#8396ac" stroke-width="1.5"/>' +
  '<circle cx="-36" cy="-14" r="1.8" fill="#2a2030"/><circle cx="-22" cy="-19" r="1.6" fill="#c88a2a"/>'

const FOX = `<g>${track(
  [
    [0, 450, 902],
    [9, 450, 902],
    [15, 250, 896],
    [19, 250, 896],
    [26, -60, 904],
    [47, -60, 904],
  ],
  47,
  -20,
)}<g transform="scale(.95)"><g><animateTransform attributeName="transform" type="translate" values="0 0;0 -2;0 0" dur=".5s" repeatCount="indefinite"/>${FOX_ART}</g></g></g>`

const HUSKY_ART =
  '<ellipse cx="4" cy="1" rx="30" ry="4" fill="#8ea2b8" opacity=".45"/>' +
  // the curled tail, wagging
  '<g><animateTransform attributeName="transform" type="rotate" values="-10 -20 -20;14 -20 -20;-10 -20 -20" dur=".5s" repeatCount="indefinite"/>' +
  '<path d="M-20 -20 Q-34 -24 -30 -38 Q-24 -46 -16 -38" fill="none" stroke="#4e5868" stroke-width="7" stroke-linecap="round"/><path d="M-17 -40 Q-14 -36 -16 -32" stroke="#f4f6fa" stroke-width="4" stroke-linecap="round" fill="none"/></g>' +
  // the far legs, then the body, then the near legs, swinging as it trots
  '<g><animateTransform attributeName="transform" type="rotate" values="12 0 -12;-12 0 -12;12 0 -12" dur=".42s" repeatCount="indefinite"/><path d="M-12 -8 V2 M16 -8 V2" stroke="#c8d0dc" stroke-width="5" stroke-linecap="round"/></g>' +
  '<ellipse cx="0" cy="-16" rx="23" ry="11" fill="#4e5868" stroke="#2e3644" stroke-width="1.2"/><path d="M-20 -10 Q0 -2 22 -11 Q12 -6 0 -6 Q-12 -6 -20 -10Z" fill="#f4f6fa"/>' +
  '<g><animateTransform attributeName="transform" type="rotate" values="-12 0 -12;12 0 -12;-12 0 -12" dur=".42s" repeatCount="indefinite"/><path d="M-16 -8 V3 M12 -8 V3" stroke="#f4f6fa" stroke-width="5.4" stroke-linecap="round"/></g>' +
  // the head: grey cap and ears, a white mask, blue eye, black nose, and a lolling tongue
  '<path d="M14 -22 Q18 -34 26 -36 L30 -26 Z" fill="#4e5868"/>' +
  '<circle cx="26" cy="-32" r="10" fill="#4e5868" stroke="#2e3644" stroke-width="1.2"/>' +
  '<path d="M19 -40 L21 -52 L27 -41Z M25 -41 L30 -52 L32 -39Z" fill="#4e5868" stroke="#2e3644" stroke-width="1"/><path d="M21.4 -42 L22 -48 L25 -42Z" fill="#f2b8c4"/>' +
  '<path d="M18 -30 Q22 -26 26 -30 Q28 -34 32 -34 Q38 -32 40 -27 Q38 -21 30 -21 Q22 -21 18 -26Z" fill="#f4f6fa"/><path d="M22 -34 Q26 -36 29 -34" stroke="#f4f6fa" stroke-width="2.4" fill="none"/>' +
  '<circle cx="27.6" cy="-31.4" r="2.2" fill="#6ac6ff"/><circle cx="28" cy="-31.4" r="1" fill="#14202e"/><circle cx="40" cy="-27.6" r="2.2" fill="#14202e"/>' +
  '<path d="M33 -22 Q35 -16 38 -19 Q37 -22 35 -22Z" fill="#ff8aa0"/>'

// it trots in, stops to look about with its tail going, then bounds off
const HUSKY = `<g>${track(
  [
    [0, -70, 1072],
    [4, -70, 1072],
    [9, 118, 1066],
    [15, 118, 1066],
    [18, 470, 1078],
    [38, 470, 1078],
  ],
  38,
  -12,
)}<g><animateTransform attributeName="transform" type="translate" values="0 0;0 -2.4;0 0" dur=".42s" repeatCount="indefinite"/>${HUSKY_ART}</g></g>`

const MAGPIE_PERIOD = 26
const MAGPIE_FLYING = [3, 6, 14, 18] // flies in between the first two, away between the last two
const MAGPIE_ART = (() => {
  const shown = (flying: boolean) => {
    const [a, b, c, d] = MAGPIE_FLYING.map(t => r3(t / MAGPIE_PERIOD))

    return `<animate attributeName="opacity" values="${flying ? '0;1;0;1;0' : '1;0;1;0;1'}" keyTimes="0;${a};${b};${c};${d}" calcMode="discrete" dur="${MAGPIE_PERIOD}s" begin="-4s" repeatCount="indefinite"/>`
  }

  return (
    // a long blue-black tail, white belly, black head
    '<g><animateTransform attributeName="transform" type="rotate" values="0;0;-16;0" keyTimes="0;.7;.8;1" dur="2.2s" repeatCount="indefinite"/><path d="M-6 -4 L-30 4 L-28 8 L-4 2Z" fill="#1f2a4a"/></g>' +
    '<ellipse cx="0" cy="-6" rx="10" ry="6.4" fill="#141418"/><ellipse cx="2" cy="-4" rx="6" ry="4" fill="#fbfdff"/><circle cx="9" cy="-12" r="5" fill="#141418"/><path d="M13 -12 L19 -11 L13 -10Z" fill="#141418"/><circle cx="10" cy="-13" r=".9" fill="#fff"/>' +
    `<g opacity="1">${shown(false)}<path d="M-6 -8 Q0 -12 6 -7 Q0 -4 -6 -5Z" fill="#1f2a4a"/><path d="M-2 -8 Q2 -9 4 -7" stroke="#fbfdff" stroke-width="1.6" fill="none"/><path d="M-2 0 V6 M3 0 V6" stroke="#141418" stroke-width="1.4"/></g>` +
    `<g opacity="0">${shown(true)}<path d="M-4 -8 Q-10 -26 4 -30 Q2 -18 6 -8Z" fill="#1f2a4a"><animate attributeName="d" values="M-4 -8 Q-10 -26 4 -30 Q2 -18 6 -8Z;M-4 -6 Q-8 8 4 12 Q2 2 6 -6Z;M-4 -8 Q-10 -26 4 -30 Q2 -18 6 -8Z" dur=".36s" repeatCount="indefinite"/></path><path d="M-2 -14 Q0 -22 3 -24" stroke="#fbfdff" stroke-width="2" fill="none"/></g>`
  )
})()

const MAGPIE = `<g>${track(
  [
    [0, -40, 640],
    [3, -40, 640],
    [6, 98, 856],
    [9, 98, 856],
    [9.3, 98, 850],
    [9.6, 98, 856],
    [14, 98, 856],
    [18, 440, 600],
    [MAGPIE_PERIOD, 440, 600],
  ],
  MAGPIE_PERIOD,
  -4,
)}${MAGPIE_ART}</g>`

// ---- snowmen ----------------------------------------------------------------------------------------------
const SPOTS: [number, number, number][] = [
  [104, 1010, 1],
  [296, 1046, 1.05],
  [196, 1124, 1.15],
  [350, 1150, 1.2],
  [56, 1150, 1.15],
  [250, 968, 0.85],
]

const HATS = [
  '<rect x="-10" y="-6" width="20" height="3" fill="#1a1a22"/><rect x="-7" y="-20" width="14" height="15" fill="#1a1a22"/><rect x="-7" y="-9" width="14" height="3" fill="#c8403a"/>',
  '<path d="M-9 -4 L-7 -16 H7 L9 -4Z" fill="#d8403a"/><rect x="-10" y="-5" width="20" height="3" rx="1" fill="#b83030"/>',
  '<path d="M-10 -3 Q-10 -18 0 -18 Q10 -18 10 -3Z" fill="#3a7ad8"/><rect x="-10" y="-5" width="20" height="4" fill="#fbfdff"/><circle cy="-20" r="4" fill="#fbfdff"/>',
]
const SCARVES = ['#d8403a', '#3a9a5a', '#e8a63c', '#7a5ad8', '#3a7ad8', '#d84a8a']

// built in four steps, each popping into place: the base, the body, the head, then the dressing
const snowman = (k: number, at: number | null) => {
  const [x, y, s] = SPOTS[k]!
  // a step that finished before the picture was drawn is drawn in place: an animation that ended
  // before time zero does not hold its last frame
  const step =(cx: number, cy: number, inner: string, i: number) =>
    at === null || at + i * 0.8 + 0.7 <= 0
      ? `<g transform="translate(${cx} ${cy})">${inner}</g>`
      : `<g transform="translate(${cx} ${cy})"><g transform="scale(0)"><animateTransform data-once="1" attributeName="transform" type="scale" values="0;1.14;1" keyTimes="0;.7;1" dur=".7s" begin="${n(at + i * 0.8)}s" fill="freeze"/>${inner}</g></g>`
  const ball = (r: number) => `<circle r="${r}" fill="#fbfdff" stroke="#aabdd2" stroke-width="1.4"/><path d="M${n(-r * 0.2)} ${n(r * 0.9)} A${r} ${r} 0 0 0 ${r} 0 A${r * 0.9} ${r * 0.9} 0 0 1 ${n(-r * 0.2)} ${n(r * 0.9)}Z" fill="#dbe5ef"/>`

  return (
    `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="4" cy="0" rx="28" ry="6" fill="#c9d6e4"/>` +
    step(0, -20, ball(22), 0) +
    step(0, -50, ball(15) + '<circle cy="-6" r="1.8" fill="#2a2a30"/><circle cy="2" r="1.8" fill="#2a2a30"/><circle cy="9" r="1.8" fill="#2a2a30"/>', 1) +
    step(0, -72, ball(11) + '<circle cx="-3.6" cy="-2" r="1.5" fill="#2a2a30"/><circle cx="3.6" cy="-2" r="1.5" fill="#2a2a30"/><path d="M0 1 L11 3 L0 4Z" fill="#f08a2a"/><path d="M-4 5 q4 3 8 0" stroke="#2a2a30" stroke-width="1" fill="none" stroke-dasharray="1 1.6"/>', 2) +
    step(
      0,
      -62,
      `<path d="M-12 -2 Q0 4 12 -2 L12 2 Q0 8 -12 2Z" fill="${SCARVES[k]}"/><path d="M6 1 L9 16 L4 16 L2 3Z" fill="${SCARVES[k]}"/>` +
        '<path d="M-13 10 L-32 -2 M-26 2 L-30 -6 M13 10 L32 0 M26 4 L30 -4" stroke="#6a4a30" stroke-width="2" stroke-linecap="round"/>' +
        `<g transform="translate(0 -19)">${HATS[k % HATS.length]}</g>`,
      3,
    ) +
    '</g>'
  )
}

// ---- falling snow, near and far, drifting as it comes down -------------------------------------------
const SNOW = Array.from({ length: 84 }, (_, k) => {
  const near = k % 3 === 0
  const x = rnd(k + 2000) * 420 - 10
  const r = near ? 2.4 + rnd(k + 2100) * 1.6 : 1 + rnd(k + 2200) * 1
  const dur = near ? 10 + rnd(k + 2300) * 4 : 18 + rnd(k + 2400) * 8
  const sway = (near ? 16 : 9) * (rnd(k + 2500) < 0.5 ? 1 : -1)

  return (
    `<circle r="${n(r)}" fill="#fff" opacity="${near ? 0.95 : 0.75}">` +
    `<animateTransform attributeName="transform" type="translate" values="${n(x)} -10;${n(x + sway)} ${H * 0.35};${n(x - sway * 0.5)} ${H * 0.7};${n(x + sway * 0.3)} ${H + 10}" calcMode="spline" keyTimes="0;.33;.66;1" keySplines="${EASE};${EASE};${EASE}" dur="${n(dur)}s" begin="${n(-rnd(k + 2600) * dur)}s" repeatCount="indefinite"/></circle>`
  )
}).join('')

// ---- nightfall --------------------------------------------------------------------------------------------
const STARS = Array.from({ length: 30 }, (_, k) => `<circle cx="${n(rnd(k + 3000) * 400)}" cy="${n(20 + rnd(k + 3100) * 420)}" r="${n(0.8 + rnd(k + 3200) * 1)}" fill="#fff"/>`).join('')
const MOON = '<circle cx="300" cy="150" r="54" fill="#fff6d8" opacity=".12"/><circle cx="300" cy="150" r="24" fill="#fff6d8"/><circle cx="292" cy="144" r="4" fill="#ece0b8"/><circle cx="306" cy="158" r="3" fill="#ece0b8"/>'

// how dark it is: [from, to]. A rebuilt picture carries on from where the fade already is.
const nightSpan = (w: Yard, now: number): [number, number] => {
  const since = (now - w.startedAt) / 1000
  const sinceEnd = (now - w.endedAt) / 1000
  if (w.working) {
    return [Math.min(1, since / 1.6), 1]
  }

  return w.endedAt > 0 && sinceEnd < 1.6 ? [1 - sinceEnd / 1.6, 0] : [0, 0]
}

const fade = ([a0, a1]: [number, number], inner: string) =>
  a0 === a1
    ? a1 > 0
      ? inner
      : ''
    : `<g opacity="${r3(a0)}"><animate data-once="1" attributeName="opacity" values="${r3(a0)};${a1}" dur="${n(1.6 * Math.abs(a1 - a0))}s" fill="freeze"/>${inner}</g>`

// ---- the whole picture --------------------------------------------------------------------------------
const buildScene = (w: Yard, elapsed: number, vh: number, now: number) => {
  const view = Math.min(H, Math.max(vh, 240))
  const y0 = H - view
  const span = nightSpan(w, now)
  const since = (now - w.startedAt) / 1000

  const defs =
    '<defs>' +
    '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9cc0de"/><stop offset=".7" stop-color="#d8e6f2"/><stop offset="1" stop-color="#f2f6fa"/></linearGradient>' +
    '</defs>'

  // snowmen already standing, and while Claude works, the ones still to come, each in its own time
  const men = SPOTS.map((_, k) =>
    k < (w.working ? w.base : w.built) ? snowman(k, null) : w.working ? snowman(k, FIRST + (k - w.base) * EVERY - since) : '',
  ).join('')

  const land =
    SKY +
    MOUNTAINS +
    FAR_FOREST +
    GROUND_SNOW +
    MID_FOREST +
    CABIN +
    WOODPILE +
    FENCE +
    FRAMES +
    RABBIT +
    FOX +
    NEAR_TREES +
    men +
    HUSKY +
    MAGPIE

  const night = `<rect x="0" y="0" width="${W}" height="${H}" fill="#0c1838" opacity=".72"/><g>${STARS}${MOON}</g>`

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${n(y0)} ${W} ${n(view)}" width="${W}" height="${n(view)}" preserveAspectRatio="xMidYMax slice">${defs}` +
    retime(land, elapsed) +
    // by night the land darkens, stars come out, and the windows and lantern glow; the snow falls over it all
    fade(span, night) +
    fade(span, LIGHTS + FRAMES) +
    retime(smoke(w.working) + SNOW, elapsed) +
    '</svg>'
  )
}
// ---scene-end

const TERMINAL_ART: [string, string][] = [
  ['   *  ▲    *   ▲▲  *', '#d6e2ee'],
  ['  ▲ *   ▲  ⌂   *  ▲ ', '#8fa8b8'],
  ['  ▲▲  * /██\\  *  ▲▲', '#fbfdff'],
  ['   *   |▯▯|   ☃  * ', '#ffd27a'],
  ['  ░░░░░░░░░░░░░░░░░░', '#f6f9fc'],
]

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))

  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

const label = (w: Cabin, now: number, T: Words) => (w.working ? T.working(clock(now - w.startedAt), w.tools) : T.idle)

const yard = atom({ plugin: 'snow-cabin', key: 'yard' } as const, { working: false, tools: 0, startedAt: 0, endedAt: 0, built: 0, base: 0, tick: 0 } as Cabin)

// The picture is built again only when the state it draws changes; the same text keeps it running.
let t0 = 0
let cache = { key: '', svg: '' }

export const register: Register = (on, options) => {
  // `language` is a field of the plugin's userConfig: 'en' (default) or 'ko'
  const T: Words = STRINGS[options.language === 'ko' ? 'ko' : 'en']

  on('session.start', async ($, e, next) => {
    t0 = await $.clock.now()
    await $.command.register({
      name: 'snow',
      description: 'Open the snowy cabin pane',
    })
    // Wakes the pane each second while Claude works, for the stopwatch in its top line.
    $.clock.every(1000, () => {
      void read($, yard)
        .then(r => (r.working ? update($, yard, v => ({ ...v, tick: v.tick + 1 })) : undefined))
        .catch(() => {})
    })

    return next(e)
  })

  on('command.run', { command: 'snow' }, async $ => {
    await $.ui.open({ id: PANE, title: T.title })

    return { text: T.opened }
  })

  // The main loop's turns only: a subagent's run is not Claude at work.
  // A turn adds snowmen to those standing; once the yard is full it starts again from none.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      const now = await $.clock.now()
      await update($, yard, v => (v.working ? v : { ...v, working: true, tools: 0, startedAt: now, base: v.built >= MAX ? 0 : v.built }))
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      const now = await $.clock.now()
      await update($, yard, v => {
        if (!v.working) {
          return v
        }
        const since = (now - v.startedAt) / 1000
        const made = since < FIRST ? 0 : Math.floor((since - FIRST) / EVERY) + 1

        return { ...v, working: false, endedAt: now, built: Math.min(MAX, v.base + made) }
      })
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    await update($, yard, v => ({ ...v, tools: v.tools + 1 }))

    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const w = await read($, yard)
    const now = await $.clock.now()
    if (t0 === 0) t0 = now
    const cols = e.props?.bodyColumns ?? 40
    const rows = e.props?.scroll?.bodyRows ?? 20
    const line = label(w, now, T)

    if (e.surface !== 'terminal') {
      const { Box, Text, Svg } = els as ElementTable<'desktop'>
      // The pane's px: its cells over the code font's advance (about 7.8 px) and line height
      // (about 19.5 px). Short of the whole picture, the sky is cut, never the yard.
      const width = Math.max(160, Math.round(cols * 7.8))
      const full = Math.round((width * H) / W)
      const tall = e.props?.scroll?.bodyRows ? Math.round((rows - 1) * 19.5) : full
      const height = Math.min(full, tall)
      // nightfall and daybreak take 1.6 s; a rebuild after that draws them settled
      const fading = w.working ? (now - w.startedAt) / 1000 < 1.6 : w.endedAt > 0 && (now - w.endedAt) / 1000 < 1.6
      const key = `${w.working}|${fading}|${w.startedAt}|${w.endedAt}|${w.built}|${height}|${width}`
      if (cache.key !== key) cache = { key, svg: buildScene(w, (now - t0) / 1000, (height * W) / width, now) }

      return (
        <Box flexDirection="column" justifyContent="center" minHeight={rows}>
          <Box justifyContent="center">
            <Text bold={w.working} dimColor={!w.working}>
              {line}
            </Text>
          </Box>
          <Svg source={cache.svg} alt={T.alt} width={width} height={height} isInteractive />
        </Box>
      )
    }

    const { Box, Text } = els as ElementTable<'terminal'>

    return (
      <Box flexDirection="column">
        {TERMINAL_ART.map(([row, color]) => (
          <Text color={color}>{row}</Text>
        ))}
        <Text>{line}</Text>
        <Text dimColor>{T.note}</Text>
      </Box>
    )
  })
}
