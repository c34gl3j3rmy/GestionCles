/*
 * Analyse V2 orientee identification.
 * Les images et coordonnees brutes restent en memoire. Seules des donnees
 * relatives/normalisees sont renvoyees pour stockage.
 */

const ANALYSIS_VERSION = 2;
const VECTOR_SIZE = 64;

function clamp(v, min = 0, max = 1) { return Math.max(min, Math.min(max, v)); }
function median(values) {
  const a = [...values].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
function mean(values) { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0; }
function std(values) {
  const m = mean(values);
  return Math.sqrt(mean(values.map(v => (v - m) ** 2)));
}
function smooth(values, radius = 3) {
  return values.map((_, i) => {
    const from = Math.max(0, i - radius), to = Math.min(values.length, i + radius + 1);
    return mean(values.slice(from, to));
  });
}
function normalize(values) {
  const min = Math.min(...values), max = Math.max(...values), span = max - min;
  if (!Number.isFinite(span) || span < 1e-6) return values.map(() => 0);
  return values.map(v => (v - min) / span);
}
function resample(values, size = VECTOR_SIZE) {
  if (!values.length) return Array(size).fill(0);
  if (values.length === 1) return Array(size).fill(values[0]);
  return Array.from({ length: size }, (_, i) => {
    const p = i * (values.length - 1) / (size - 1);
    const a = Math.floor(p), b = Math.min(values.length - 1, a + 1), t = p - a;
    return values[a] * (1 - t) + values[b] * t;
  });
}
function luma(data, i) { return .2126 * data[i] + .7152 * data[i + 1] + .0722 * data[i + 2]; }

async function imageToCanvas(file) {
  const bitmap = await createImageBitmap(file);
  const max = 1400;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

function detectCard(ctx, width, height) {
  const img = ctx.getImageData(0, 0, width, height);
  const data = img.data;
  const lum = new Float32Array(width * height);
  for (let p = 0; p < width * height; p++) lum[p] = luma(data, p * 4);

  // 1) Bords verticaux de la carte : on analyse surtout le tiers superieur,
  // ou la lame perturbe peu le signal. La carte doit etre en portrait.
  const y0 = Math.floor(height * .05), y1 = Math.floor(height * .40);
  const gx = new Float32Array(Math.max(1, width - 1));
  for (let x = 0; x < width - 1; x++) {
    let sum = 0, count = 0;
    for (let y = y0; y < y1; y += 3) {
      sum += Math.abs(lum[y * width + x + 1] - lum[y * width + x]);
      count++;
    }
    gx[x] = count ? sum / count : 0;
  }
  const sx = smooth([...gx], 4);
  const peaksX = [];
  for (let x = 5; x < width - 6; x++) {
    if (sx[x] >= Math.max(...sx.slice(x - 4, x + 5))) peaksX.push(x);
  }
  peaksX.sort((a, b) => sx[b] - sx[a]);
  const candX = peaksX.slice(0, 80);
  let pair = null;
  for (const a of candX) for (const b of candX) {
    if (b <= a) continue;
    const sep = b - a;
    if (sep < width * .62 || sep > width * .92) continue;
    const centerPenalty = Math.abs((a + b) / 2 - width / 2) / width;
    const score = sx[a] + sx[b] - centerPenalty * 8;
    if (!pair || score > pair.score) pair = { a, b, score };
  }
  if (!pair) return null;

  const cardWidth = pair.b - pair.a;
  const expectedHeight = cardWidth * (85.60 / 53.98); // carte ID-1 en portrait
  if (expectedHeight > height * 1.05) return null;

  // 2) Bord superieur : gradient horizontal dans deux bandes laterales,
  // loin de la cle. Le bord inferieur est derive du ratio ISO connu.
  const leftA = Math.round(pair.a + cardWidth * .05), leftB = Math.round(pair.a + cardWidth * .30);
  const rightA = Math.round(pair.a + cardWidth * .70), rightB = Math.round(pair.a + cardWidth * .95);
  const gy = new Float32Array(Math.max(1, height - 1));
  for (let y = 0; y < height - 1; y++) {
    let sum = 0, count = 0;
    for (let x = leftA; x < leftB; x += 3) { sum += Math.abs(lum[(y + 1) * width + x] - lum[y * width + x]); count++; }
    for (let x = rightA; x < rightB; x += 3) { sum += Math.abs(lum[(y + 1) * width + x] - lum[y * width + x]); count++; }
    gy[y] = count ? sum / count : 0;
  }
  const sy = smooth([...gy], 4);
  const topMax = Math.min(Math.floor(height * .38), Math.floor(height - expectedHeight * .82));
  let top = null;
  for (let y = Math.floor(height * .03); y < topMax; y++) {
    if (sy[y] >= Math.max(...sy.slice(Math.max(0, y - 4), Math.min(sy.length, y + 5)))) {
      if (!top || sy[y] > top.strength) top = { y, strength: sy[y] };
    }
  }
  if (!top) return null;

  const x = Math.max(0, Math.round(pair.a));
  const y = Math.max(0, Math.round(top.y));
  const w = Math.min(width - x, Math.round(cardWidth));
  const h = Math.min(height - y, Math.round(expectedHeight));
  const edgeBalance = Math.min(sx[pair.a], sx[pair.b]) / Math.max(.001, Math.max(sx[pair.a], sx[pair.b]));
  const detectionQuality = Math.round(clamp(.55 + .25 * edgeBalance + .20 * clamp(top.strength / 8)) * 100);
  const perspectiveQuality = Math.round(clamp(.65 + .35 * edgeBalance) * 100);
  return { x, y, w, h, detectionQuality, perspectiveQuality, ratio: h / Math.max(1, w) };
}

function makeCardCanvas(source, card) {
  // Normalisation de la carte a un repere fixe. Cela rend les signatures
  // comparables meme si la distance de prise de vue change.
  const c = document.createElement('canvas');
  c.width = 540; c.height = 856;
  c.getContext('2d', { willReadFrequently: true }).drawImage(source, card.x, card.y, card.w, card.h, 0, 0, c.width, c.height);
  return c;
}

function segmentKey(cardCanvas) {
  const c = cardCanvas;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, c.width, c.height);

  // Acquisition standardisee V2 : carte portrait, cle verticale, tete en bas.
  // On ne segmente que la zone de lame afin d'eviter le trousseau et l'anneau.
  const rx0 = Math.round(c.width * .30), rx1 = Math.round(c.width * .70);
  const ry0 = Math.round(c.height * .16), ry1 = Math.round(c.height * .62);
  const rw = rx1 - rx0, rh = ry1 - ry0;

  const bgSamples = [];
  for (let y = ry0; y < Math.min(ry0 + 45, ry1); y += 3) {
    for (let x = rx0; x < Math.min(rx0 + 45, rx1); x += 3) bgSamples.push(luma(img.data, (y * c.width + x) * 4));
    for (let x = Math.max(rx0, rx1 - 45); x < rx1; x += 3) bgSamples.push(luma(img.data, (y * c.width + x) * 4));
  }
  const bg = median(bgSamples);
  const threshold = bg - 20;
  const mask = new Uint8Array(rw * rh);
  for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) {
    const v = luma(img.data, (((ry0 + y) * c.width + (rx0 + x)) * 4));
    mask[y * rw + x] = v < threshold ? 1 : 0;
  }

  // Composante centrale et allongee : la lame.
  const seen = new Uint8Array(mask.length); let best = null;
  for (let p = 0; p < mask.length; p++) {
    if (!mask[p] || seen[p]) continue;
    const stack = [p]; seen[p] = 1;
    let count = 0, minX = rw, maxX = 0, minY = rh, maxY = 0, sumX = 0, sumY = 0;
    while (stack.length) {
      const cur = stack.pop(), y = Math.floor(cur / rw), x = cur - y * rw;
      count++; sumX += x; sumY += y; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      const nb = [cur - 1, cur + 1, cur - rw, cur + rw];
      for (const q of nb) {
        if (q < 0 || q >= mask.length || seen[q] || !mask[q]) continue;
        const qy = Math.floor(q / rw), qx = q - qy * rw;
        if (Math.abs(qx - x) + Math.abs(qy - y) !== 1) continue;
        seen[q] = 1; stack.push(q);
      }
    }
    if (count < 120) continue;
    const bw = maxX - minX + 1, bh = maxY - minY + 1, cx = sumX / count, cy = sumY / count;
    const elong = bh / Math.max(1, bw), centerDist = Math.abs(cx - rw / 2) / rw;
    const score = (count / (rw * rh)) * 8 + Math.min(elong, 8) * .18 - centerDist;
    if (!best || score > best.score) best = { score, count, minX, maxX, minY, maxY, bw, bh, cx, cy };
  }
  if (!best || best.bh < rh * .35) throw new Error('Lame non detectee. Place la cle verticale, tete en bas, au centre de la carte.');

  const compMask = new Uint8Array(mask.length);
  let seed = -1, seedDist = Infinity;
  for (let y = best.minY; y <= best.maxY; y++) for (let x = best.minX; x <= best.maxX; x++) {
    const p = y * rw + x; if (!mask[p]) continue;
    const d = Math.hypot(x - best.cx, y - best.cy); if (d < seedDist) { seedDist = d; seed = p; }
  }
  const stack = [seed]; compMask[seed] = 1;
  while (stack.length) {
    const cur = stack.pop(), y = Math.floor(cur / rw), x = cur - y * rw;
    for (const q of [cur - 1, cur + 1, cur - rw, cur + rw]) {
      if (q < 0 || q >= mask.length || compMask[q] || !mask[q]) continue;
      const qy = Math.floor(q / rw), qx = q - qy * rw;
      if (Math.abs(qx - x) + Math.abs(qy - y) !== 1) continue;
      if (qx < best.minX || qx > best.maxX || qy < best.minY || qy > best.maxY) continue;
      compMask[q] = 1; stack.push(q);
    }
  }
  const occupancy = best.count / Math.max(1, best.bw * best.bh);
  const segmentationQuality = Math.round(clamp(.35 + Math.min(1, best.bh / (rh * .7)) * .35 + Math.min(1, occupancy / .45) * .30) * 100);
  return { width: rw, height: rh, mask: compMask, bbox: best, segmentationQuality };
}

function rowBounds(seg) {
  const { width, mask, bbox: b } = seg;
  const rows = [];
  for (let y = b.minY; y <= b.maxY; y++) {
    let left = Infinity, right = -Infinity, count = 0;
    for (let x = b.minX; x <= b.maxX; x++) {
      if (!mask[y * width + x]) continue;
      left = Math.min(left, x); right = Math.max(right, x); count++;
    }
    if (count) rows.push({ y, left, right, width: right - left + 1 });
  }
  return rows;
}

function extractProfile(seg) {
  let rows = rowBounds(seg);
  if (rows.length < 50) throw new Error('Contour de lame insuffisant.');

  // La photo est standardisee tete en bas. Les lignes image vont pointe->tete,
  // donc on inverse pour stocker toujours tete->pointe.
  rows = rows.reverse();
  const trim = Math.max(3, Math.floor(rows.length * .04));
  rows = rows.slice(trim, rows.length - trim);
  const left = rows.map(r => r.left), right = rows.map(r => r.right);
  const leftVar = std(smooth(left, 2)), rightVar = std(smooth(right, 2));
  const profileSide = rightVar >= leftVar ? 'right' : 'left';
  let inward;
  if (profileSide === 'right') {
    const baseline = Math.max(...right);
    inward = right.map(v => baseline - v);
  } else {
    const baseline = Math.min(...left);
    inward = left.map(v => v - baseline);
  }
  inward = normalize(smooth(inward, 3));
  const vector = resample(inward, VECTOR_SIZE).map(v => +v.toFixed(5));
  const usefulVariation = std(vector);
  const profileExtraction = Math.round(clamp(.45 + Math.min(1, rows.length / 240) * .25 + Math.min(1, usefulVariation / .22) * .30) * 100);
  return { vector, profileSide, orientation: 'head_to_tip', bladeRows: rows.length, profileExtraction };
}

function detectValleysFromVector(vector) {
  const v = smooth(vector, 2);
  const minDistance = Math.max(5, Math.floor(v.length / 10));
  const candidates = [];
  for (let i = 2; i < v.length - 2; i++) {
    if (v[i] >= v[i - 1] && v[i] >= v[i + 1] && v[i] >= v[i - 2] && v[i] >= v[i + 2]) {
      const localMin = Math.min(...v.slice(Math.max(0, i - minDistance), Math.min(v.length, i + minDistance + 1)));
      const prominence = v[i] - localMin;
      if (prominence >= .07) candidates.push({ i, value: v[i], prominence });
    }
  }
  candidates.sort((a, b) => b.prominence - a.prominence || b.value - a.value);
  const selected = [];
  for (const c of candidates) {
    if (selected.every(s => Math.abs(s.i - c.i) >= minDistance)) selected.push(c);
    if (selected.length >= 8) break;
  }
  selected.sort((a, b) => a.i - b.i);
  if (selected.length < 2) return { valleys: [], variationSimple: null, variationDetailed: [], mainValley: null };
  const depths = selected.map(x => x.value);
  const simple = [], detailed = [];
  for (let i = 0; i < depths.length - 1; i++) {
    const delta = depths[i + 1] - depths[i]; // >0 = prochain creux plus profond
    if (Math.abs(delta) < .08) { simple.push('0'); detailed.push('0'); }
    else if (delta > 0) { simple.push('-'); detailed.push(delta >= .22 ? '--' : '-'); }
    else { simple.push('+'); detailed.push(delta <= -.22 ? '++' : '+'); }
  }
  const maxDepth = Math.max(...depths), mainValley = depths.indexOf(maxDepth) + 1;
  return { valleys: selected, valleyCount: selected.length, variationSimple: simple.join(''), variationDetailed: detailed, mainValley };
}

function qualityDetails(card, seg, profile) {
  const details = {
    cardDetection: card?.detectionQuality || 0,
    perspective: card?.perspectiveQuality || 0,
    keySegmentation: seg?.segmentationQuality || 0,
    profileExtraction: profile?.profileExtraction || 0
  };
  const quality = Math.round(details.cardDetection * .2 + details.perspective * .15 + details.keySegmentation * .3 + details.profileExtraction * .35);
  return { details, quality };
}

export async function analyzeImage(file) {
  const source = await imageToCanvas(file);
  const ctx = source.getContext('2d', { willReadFrequently: true });
  const card = detectCard(ctx, source.width, source.height);
  if (!card) throw new Error('Carte de reference non detectee. Place la cle au centre d’une carte sombre ID-1 bien visible.');
  const cardCanvas = makeCardCanvas(source, card);
  const seg = segmentKey(cardCanvas);
  const profile = extractProfile(seg);
  const valleys = detectValleysFromVector(profile.vector);
  const q = qualityDetails(card, seg, profile);
  return {
    analysisVersion: ANALYSIS_VERSION,
    quality: q.quality,
    qualityDetails: q.details,
    vector: profile.vector,
    vectorLength: profile.vector.length,
    valleyCount: valleys.valleyCount ?? null,
    variationSimple: valleys.variationSimple,
    variationDetailed: valleys.variationDetailed,
    mainValley: valleys.mainValley,
    orientation: profile.orientation,
    profileSide: profile.profileSide,
    repeatability: null,
    acquisitionCount: 1,
    createdAt: new Date().toISOString(),
    note: 'Empreinte V2 relative et normalisee. Aucune photo ni mesure metrique de taillage n’est conservee.'
  };
}

export function similarity(a, b) {
  if (!a?.vector || !b?.vector || a.analysisVersion !== 2 || b.analysisVersion !== 2) return 0;
  const n = Math.min(a.vector.length, b.vector.length);
  let mae = 0;
  for (let i = 0; i < n; i++) mae += Math.abs(a.vector[i] - b.vector[i]);
  mae /= n;
  let score = clamp(1 - mae / .45);
  if (a.valleyCount && b.valleyCount) score *= a.valleyCount === b.valleyCount ? 1 : .82;
  if (a.variationSimple && b.variationSimple) score *= a.variationSimple === b.variationSimple ? 1.04 : .94;
  if (a.mainValley && b.mainValley) score *= a.mainValley === b.mainValley ? 1.03 : .96;
  return clamp(score);
}

export function buildReference(signatures) {
  if (!Array.isArray(signatures) || signatures.length !== 3) throw new Error('Trois acquisitions sont requises.');
  const sims = [
    similarity(signatures[0], signatures[1]),
    similarity(signatures[0], signatures[2]),
    similarity(signatures[1], signatures[2])
  ];
  const avgByShot = [mean([sims[0], sims[1]]), mean([sims[0], sims[2]]), mean([sims[1], sims[2]])];
  const outlierIndex = avgByShot.indexOf(Math.min(...avgByShot));
  const repeatability = Math.round(mean(sims) * 100);
  const divergent = Math.min(...avgByShot) < .72 || repeatability < 76;
  const vector = Array.from({ length: VECTOR_SIZE }, (_, i) => median(signatures.map(s => s.vector[i] ?? 0)));
  const valleys = detectValleysFromVector(vector);
  const qKeys = ['cardDetection', 'perspective', 'keySegmentation', 'profileExtraction'];
  const qualityDetails = Object.fromEntries(qKeys.map(k => [k, Math.round(median(signatures.map(s => s.qualityDetails?.[k] ?? 0)))]));
  const quality = Math.round(median(signatures.map(s => s.quality)));
  return {
    analysisVersion: ANALYSIS_VERSION,
    quality,
    qualityDetails,
    vector: vector.map(v => +v.toFixed(5)),
    vectorLength: VECTOR_SIZE,
    valleyCount: valleys.valleyCount ?? null,
    variationSimple: valleys.variationSimple,
    variationDetailed: valleys.variationDetailed,
    mainValley: valleys.mainValley,
    orientation: 'head_to_tip',
    profileSide: signatures[0].profileSide,
    repeatability,
    acquisitionCount: 3,
    divergent,
    outlierIndex: divergent ? outlierIndex : null,
    pairwiseSimilarity: sims.map(v => Math.round(v * 100)),
    createdAt: new Date().toISOString(),
    note: 'Reference V2 construite par mediane de trois acquisitions. Aucune photo n’est conservee.'
  };
}

export function label(score) {
  return score >= .90 ? 'TRES FORTE' : score >= .75 ? 'FORTE' : score >= .55 ? 'MOYENNE' : 'FAIBLE';
}
