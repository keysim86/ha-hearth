// Kody kart lojalnościowych do zeskanowania przy kasie, liczone w panelu — numer karty nie trafia do żadnego
// zewnętrznego generatora. EAN-13 (PAYBACK), Code 128 / GS1-128 (Moja Biedronka) i QR (Lidl Plus; wersje 1–6,
// korekcja M, tryb liczbowy albo bajtowy).

// ---- EAN-13 ----

const EAN_L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const EAN_R = EAN_L.map((p) => [...p].map((b) => (b === "1" ? "0" : "1")).join(""));
const EAN_G = EAN_R.map((p) => [...p].reverse().join(""));
/** Układ L/G sześciu cyfr lewej połowy zależnie od pierwszej cyfry (ona sama nie ma kresek). */
const EAN_PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

export const eanValid = (code: string): boolean => {
  if (!/^\d{13}$/.test(code)) return false;
  const sum = [...code.slice(0, 12)].reduce((s, c, i) => s + Number(c) * (i % 2 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === Number(code[12]);
};

/** 95 modułów EAN-13 („1” = kreska) albo null, gdy treść nie jest 13 cyframi z poprawną cyfrą kontrolną. */
export function ean13(code: string): string | null {
  if (!eanValid(code)) return null;
  const d = [...code].map(Number);
  const left = d.slice(1, 7).map((n, i) => (EAN_PARITY[d[0]][i] === "L" ? EAN_L : EAN_G)[n]).join("");
  const right = d.slice(7).map((n) => EAN_R[n]).join("");
  return `101${left}01010${right}101`;
}

// ---- Code 128 (GS1-128 = Code 128 z FNC1 na początku) ----

/** Szerokości kresek i przerw (kreska, przerwa, …) symboli 0–106; 103–105 = Start A/B/C, 106 = Stop. */
const C128 = ("212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 " +
  "123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 " +
  "111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 " +
  "231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 " +
  "141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 " +
  "124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 " +
  "311141 411131 211412 211214 211232 2331112").split(" ");

/** Moduły Code 128 („1” = kreska) albo null, gdy treść ma znaki spoza ASCII 32–126. Same cyfry: zestaw C (para cyfr
 *  na symbol, nieparzysta ostatnia cyfra w zestawie B), reszta: zestaw B. `gs1` = FNC1 zaraz po starcie (GS1-128). */
export function code128(text: string, gs1 = false): string | null {
  if (!text || !/^[\x20-\x7e]+$/.test(text)) return null;
  const v: number[] = [];
  if (/^\d{2,}$/.test(text)) {
    v.push(105);
    if (gs1) v.push(102);
    const pary = text.length - (text.length % 2);
    for (let i = 0; i < pary; i += 2) v.push(Number(text.slice(i, i + 2)));
    if (pary < text.length) v.push(100, text.charCodeAt(pary) - 32);
  } else {
    v.push(104);
    if (gs1) v.push(102);
    for (const ch of text) v.push(ch.charCodeAt(0) - 32);
  }
  v.push(v.reduce((a, x, i) => a + x * (i || 1), 0) % 103, 106);
  return v.map((x) => [...C128[x]].map((w, i) => (i % 2 ? "0" : "1").repeat(Number(w))).join("")).join("");
}

// ---- QR ----

/** Wersje 1–6, korekcja M: [słowa korekcyjne na blok, długości bloków danych]. */
const QR_BLOCKS: Array<[number, number[]]> = [[10, [16]], [16, [28]], [26, [44]], [18, [32, 32]], [24, [43, 43]], [16, [27, 27, 27, 27]]];
/** Środki wzorców wyrównania (wersja 1 nie ma żadnego). */
const QR_ALIGN = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34]];

const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++, x = x & 128 ? ((x << 1) ^ 0x11d) & 255 : x << 1) {
  EXP[i] = x;
  LOG[x] = i;
}
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
const gmul = (a: number, b: number) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

/** Reszta Reeda-Solomona: `n` słów korekcyjnych dla bloku danych. */
function rsRemainder(data: number[], n: number): number[] {
  let gen = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array<number>(gen.length + 1).fill(0);
    gen.forEach((c, j) => { next[j] ^= c; next[j + 1] ^= gmul(c, EXP[i]); });
    gen = next;
  }
  const r = [...data, ...new Array<number>(n).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const c = r[i];
    if (c) gen.forEach((g, j) => (r[i + j] ^= gmul(g, c)));
  }
  return r.slice(data.length);
}

const MASKS: Array<(y: number, x: number) => boolean> = [
  (y, x) => (y + x) % 2 === 0,
  (y) => y % 2 === 0,
  (_y, x) => x % 3 === 0,
  (y, x) => (y + x) % 3 === 0,
  (y, x) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (y, x) => ((y * x) % 2) + ((y * x) % 3) === 0,
  (y, x) => (((y * x) % 2) + ((y * x) % 3)) % 2 === 0,
  (y, x) => (((y + x) % 2) + ((y * x) % 3)) % 2 === 0,
];

/** Kara za wygląd maski (reguły standardu: ciągi, bloki 2×2, wzorce podobne do znaczników, proporcja ciemnych). */
function penalty(m: number[][]): number {
  const n = m.length;
  let p = 0, dark = 0;
  const lines: number[][] = [];
  for (let i = 0; i < n; i++) {
    lines.push(m[i]);
    lines.push(m.map((row) => row[i]));
  }
  for (const line of lines) {
    let run = 1;
    for (let i = 1; i <= n; i++) {
      if (i < n && line[i] === line[i - 1]) run++;
      else {
        if (run >= 5) p += run - 2;
        run = 1;
      }
    }
    const s = `0000${line.join("")}0000`;
    for (let i = s.indexOf("1011101"); i >= 0; i = s.indexOf("1011101", i + 1))
      if (s.slice(i - 4, i) === "0000" || s.slice(i + 7, i + 11) === "0000") p += 40;
  }
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      dark += m[y][x];
      if (y < n - 1 && x < n - 1 && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
    }
  return p + 10 * (Math.ceil(Math.abs(dark * 20 - n * n * 10) / (n * n)) - 1);
}

/** Macierz QR (wiersze 0/1, bez marginesu) albo null, gdy treść nie mieści się w wersji 6. */
export function qr(text: string): number[][] | null {
  const numeric = /^\d+$/.test(text);
  const bytes = numeric ? [] : [...new TextEncoder().encode(text)];
  const bits: number[] = [];
  const put = (v: number, len: number) => { for (let i = len - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
  if (numeric) {
    put(0b0001, 4);
    put(text.length, 10);
    for (let i = 0; i < text.length; i += 3) {
      const g = text.slice(i, i + 3);
      put(Number(g), g.length * 3 + 1);
    }
  } else {
    put(0b0100, 4);
    put(bytes.length, 8);
    bytes.forEach((b) => put(b, 8));
  }
  const version = QR_BLOCKS.findIndex(([, blocks]) => bits.length <= blocks.reduce((a, b) => a + b, 0) * 8) + 1;
  if (!version) return null;
  const [ec, blocks] = QR_BLOCKS[version - 1];
  const capacity = blocks.reduce((a, b) => a + b, 0) * 8;
  put(0, Math.min(4, capacity - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  for (let pad = 0xec; data.length < capacity / 8; pad ^= 0xec ^ 0x11) data.push(pad);

  // Bloki: dane i korekcja, potem przeplot słów między blokami.
  const split: number[][] = [];
  blocks.reduce((at, len) => (split.push(data.slice(at, at + len)), at + len), 0);
  const ecs = split.map((b) => rsRemainder(b, ec));
  const words: number[] = [];
  for (let i = 0; i < Math.max(...blocks); i++) split.forEach((b) => i < b.length && words.push(b[i]));
  for (let i = 0; i < ec; i++) ecs.forEach((b) => words.push(b[i]));

  const size = 17 + 4 * version;
  const m = Array.from({ length: size }, () => new Array<number>(size).fill(0));
  const fn = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const set = (x: number, y: number, v: number) => { m[y][x] = v; fn[y][x] = true; };
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 ? 0 : 1);
    set(i, 6, i % 2 ? 0 : 1);
  }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]])
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4 ? 1 : 0);
      }
  const al = QR_ALIGN[version - 1];
  for (const cy of al)
    for (const cx of al) {
      if ((cx === 6 && cy === 6) || (cx === 6 && cy === al[al.length - 1]) || (cy === 6 && cx === al[al.length - 1])) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) === 1 ? 0 : 1);
    }
  const format = (mask: number, apply: (x: number, y: number, v: number) => void) => {
    const d = (0b00 << 3) | mask; // poziom M = 00
    let r = d;
    for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const f = ((d << 10) | r) ^ 0x5412;
    const bit = (i: number) => (f >>> i) & 1;
    for (let i = 0; i <= 5; i++) apply(8, i, bit(i));
    apply(8, 7, bit(6));
    apply(8, 8, bit(7));
    apply(7, 8, bit(8));
    for (let i = 9; i < 15; i++) apply(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) apply(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) apply(8, size - 15 + i, bit(i));
    apply(8, size - 8, 1);
  };
  format(0, set); // rezerwacja pól formatu

  // Dane zygzakiem od prawego dolnego rogu, parami kolumn (z pominięciem kolumny wzorca taktującego).
  const stream = words.flatMap((w) => [7, 6, 5, 4, 3, 2, 1, 0].map((i) => (w >>> i) & 1));
  let k = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let v = 0; v < size; v++)
      for (let j = 0; j < 2; j++) {
        const x = right - j, y = ((right + 1) & 2) === 0 ? size - 1 - v : v;
        if (!fn[y][x]) m[y][x] = k < stream.length ? stream[k++] : 0;
      }
  }

  let best: number[][] | null = null, bestP = Infinity;
  MASKS.forEach((mask, i) => {
    const c = m.map((row, y) => row.map((v, x) => (fn[y][x] ? v : v ^ (mask(y, x) ? 1 : 0))));
    format(i, (x, y, v) => (c[y][x] = v));
    const p = penalty(c);
    if (p < bestP) [best, bestP] = [c, p];
  });
  return best;
}
