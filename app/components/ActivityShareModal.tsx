'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  activityLabel,
  formatDistance,
  formatDuration,
  HR_ZONE_COLORS,
  MAF_HR,
} from '@/lib/utils';

interface Activity {
  id: number;
  activity_id: string;
  activity_type: string;
  date: string;
  start_time_local: string;
  duration_seconds: number;
  distance_meters: number;
  avg_hr: number;
  max_hr: number;
  avg_pace_min_per_km: string;
  avg_cadence_spm: number;
  calories: number;
  elevation_gain_m: number;
  name: string;
  hr_zone_1_seconds: number | null;
  hr_zone_2_seconds: number | null;
  hr_zone_3_seconds: number | null;
  hr_zone_4_seconds: number | null;
  hr_zone_5_seconds: number | null;
  weather_temp_c: number | null;
  weather_apparent_temp_c: number | null;
  weather_humidity_pct: number | null;
  weather_wind_kph: number | null;
  weather_conditions: string | null;
  splits_json: string | null;
}

type SizeOption = 'story' | 'portrait' | 'square' | 'wide';
type ThemeOption = 'noir' | 'paper' | 'transparent';
type LayoutOption = 'bold' | 'clean' | 'minimal' | 'strava' | 'grid' | 'headline';

interface Fields {
  distance: boolean;
  activityName: boolean;
  date: boolean;
  pace: boolean;
  duration: boolean;
  avgHr: boolean;
  maxHr: boolean;
  calories: boolean;
  elevation: boolean;
  hrZones: boolean;
  laps: boolean;
  watermark: boolean;
}

interface Options {
  size: SizeOption;
  theme: ThemeOption;
  layout: LayoutOption;
  fields: Fields;
}

interface Props {
  activity: Activity;
  onClose: () => void;
  canvasFont?: string;
}

// ── helpers ─────────────────────────────────────────────────

function isSwim(t: string) { return (t || '').toLowerCase().includes('swim'); }
function isRun(t: string) { return (t || '').toLowerCase().includes('run'); }

function zoneSecs(a: Activity) {
  return [a.hr_zone_1_seconds ?? 0, a.hr_zone_2_seconds ?? 0, a.hr_zone_3_seconds ?? 0, a.hr_zone_4_seconds ?? 0, a.hr_zone_5_seconds ?? 0];
}
function hasHRZones(a: Activity) { return zoneSecs(a).some(s => s > 0); }

function paceKmToPace100m(p: string): string {
  if (!p) return '—';
  const parts = p.split(':');
  if (parts.length !== 2) return '—';
  const sec = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  if (!Number.isFinite(sec) || sec <= 0) return '—';
  const s100 = sec / 10;
  const m = Math.floor(s100 / 60);
  const s = Math.round(s100 - m * 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fullDate(date: string) {
  const d = new Date(date);
  const M = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${M[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function clip(ctx: CanvasRenderingContext2D, t: string, maxW: number) {
  if (ctx.measureText(t).width <= maxW) return t;
  let s = t;
  while (s.length && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}

function tracked(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, sp: number) {
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + sp;
  }
}
function trackedW(ctx: CanvasRenderingContext2D, t: string, sp: number) {
  let w = 0;
  for (let i = 0; i < t.length; i++) {
    w += ctx.measureText(t[i]).width;
    if (i < t.length - 1) w += sp;
  }
  return w;
}

// ── dimensions ───────────────────────────────────────────────

function getDims(size: SizeOption) {
  const map: Record<SizeOption, { W: number; H: number }> = {
    story:    { W: 1080, H: 1920 },
    portrait: { W: 1080, H: 1350 },
    square:   { W: 1080, H: 1080 },
    wide:     { W: 1200, H: 630 },
  };
  return map[size];
}

function isVertical(size: SizeOption) { return size === 'story' || size === 'portrait'; }

// ── palette ──────────────────────────────────────────────────

interface Pal {
  bg: string;
  fg: string;
  muted: string;
  faint: string;
  accent: string;
  div: string;
  transparent: boolean;
}

function pal(theme: ThemeOption): Pal {
  if (theme === 'paper') {
    return { bg: '#F2EDE4', fg: '#0C0C0C', muted: '#282828', faint: '#7A7570', accent: '#CC1111', div: 'rgba(0,0,0,0.14)', transparent: false };
  }
  if (theme === 'transparent') {
    return { bg: 'transparent', fg: '#FFFFFF', muted: '#E0DCD4', faint: '#909090', accent: '#F5C842', div: 'rgba(255,255,255,0.22)', transparent: true };
  }
  return { bg: '#0A0A0A', fg: '#F0EDE4', muted: '#BEB8B0', faint: '#484644', accent: '#F5C842', div: 'rgba(255,255,255,0.14)', transparent: false };
}

// ── font scale ───────────────────────────────────────────────

interface FScale {
  hero: number;   // the big distance number
  unit: number;   // km / metres label
  label: number;  // stat field label (PACE, HR, etc)
  value: number;  // stat field value (5:30, 148, etc)
  eyebrow: number; // sport + date top row
  name: number;   // activity name
  foot: number;   // footer watermark / MAF
}

function scale(size: SizeOption, layout: LayoutOption): FScale {
  // Base sizes — deliberately large
  const base: Record<SizeOption, FScale> = {
    story:    { hero: 320, unit: 22, label: 18, value: 88, eyebrow: 18, name: 24, foot: 16 },
    portrait: { hero: 280, unit: 20, label: 17, value: 80, eyebrow: 17, name: 22, foot: 15 },
    square:   { hero: 240, unit: 18, label: 15, value: 72, eyebrow: 15, name: 20, foot: 14 },
    wide:     { hero: 180, unit: 14, label: 12, value: 56, eyebrow: 13, name: 17, foot: 12 },
  };
  const s = { ...base[size] };
  if (layout === 'minimal') {
    s.hero = Math.round(s.hero * 1.2);
    s.value = Math.round(s.value * 0.85); // minimal shows fewer stats, smaller
  }
  return s;
}

function fontWeights(layout: LayoutOption) {
  if (layout === 'bold')     return { hero: 900, value: 700, label: 700 };
  if (layout === 'clean')    return { hero: 300, value: 300, label: 600 };
  return                             { hero: 100, value: 200, label: 500 }; // minimal
}

// ── activity type stripe color ───────────────────────────────
function stripeColor(actType: string): string {
  if ((actType || '').toLowerCase().includes('run')) return '#FF5722';
  if ((actType || '').toLowerCase().includes('swim')) return '#1565C0';
  if ((actType || '').toLowerCase().includes('cycl') || (actType || '').toLowerCase().includes('bike')) return '#2E7D32';
  return '#7B1FA2';
}

// ── Layout: Strava ───────────────────────────────────────────
// Left accent stripe, pace as hero, horizontal stats grid
function drawLayoutStrava(
  ctx: CanvasRenderingContext2D,
  a: Activity,
  opts: Options,
  p: Pal,
  W: number,
  H: number,
  FONT: string,
) {
  const swim = isSwim(a.activity_type);
  const run = isRun(a.activity_type);
  const vert = isVertical(opts.size);
  const STRIPE = Math.round(W * 0.055);
  const GAP = Math.round(W * 0.04);
  const PAD_LEFT = STRIPE + GAP;
  const PAD_RIGHT = Math.round(W * 0.07);
  const PAD_V = vert ? Math.round(H * 0.05) : Math.round(H * 0.07);
  const CW = W - PAD_LEFT - PAD_RIGHT;

  // Left accent stripe
  const strCol = stripeColor(a.activity_type);
  ctx.fillStyle = strCol;
  ctx.fillRect(0, 0, STRIPE, H);
  // Main background
  ctx.fillStyle = p.bg;
  ctx.fillRect(STRIPE, 0, W - STRIPE, H);
  if (!p.transparent) {
    const bg2 = ctx.createLinearGradient(STRIPE, 0, W, H);
    bg2.addColorStop(0, 'rgba(255,255,255,0.02)');
    bg2.addColorStop(1, 'rgba(0,0,0,0.15)');
    ctx.fillStyle = bg2;
    ctx.fillRect(STRIPE, 0, W - STRIPE, H);
  }

  let y = PAD_V;

  // Eyebrow: sport type + date
  const sport = swim ? 'SWIMMING' : run ? 'RUNNING' : a.activity_type?.toUpperCase() || 'ACTIVITY';
  const eyeSize = vert ? 16 : 13;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.font = `700 ${eyeSize}px ${FONT}`;
  ctx.fillStyle = strCol;
  tracked(ctx, sport, PAD_LEFT, y, 3);

  if (opts.fields.date) {
    const dateStr = fullDate(a.date);
    ctx.font = `400 ${eyeSize}px ${FONT}`;
    ctx.fillStyle = p.muted;
    const dW = trackedW(ctx, dateStr, 1);
    tracked(ctx, dateStr, W - PAD_RIGHT - dW, y, 1);
  }
  y += eyeSize + (vert ? 36 : 24);

  // Hero: PACE (not distance)
  const paceVal = swim
    ? paceKmToPace100m(a.avg_pace_min_per_km)
    : (a.avg_pace_min_per_km || '—');
  const paceUnit = swim ? '/100M' : '/KM';
  const heroSize = vert ? (opts.size === 'story' ? 200 : 160) : 120;
  ctx.font = `800 ${heroSize}px ${FONT}`;
  ctx.fillStyle = p.fg;
  ctx.textBaseline = 'top';
  ctx.fillText(paceVal, PAD_LEFT, y);

  // Unit beside/below
  const paceW = ctx.measureText(paceVal).width;
  const unitSize = vert ? 22 : 16;
  ctx.font = `700 ${unitSize}px ${FONT}`;
  ctx.fillStyle = strCol;
  if (vert) {
    ctx.fillText(paceUnit, PAD_LEFT, y + heroSize * 1.05);
    y += heroSize * 1.05 + unitSize + (vert ? 12 : 8);
  } else {
    ctx.fillText(paceUnit, PAD_LEFT + paceW + 12, y + heroSize * 0.6);
    y += heroSize * 1.1;
  }

  // Divider
  ctx.fillStyle = p.div;
  ctx.fillRect(PAD_LEFT, y, CW, 2);
  y += vert ? 28 : 20;

  // Horizontal stats grid: distance | duration | hr
  const statItems: { label: string; value: string }[] = [];
  if (opts.fields.distance && a.distance_meters) {
    statItems.push({
      label: 'DISTANCE',
      value: swim ? `${Math.round(a.distance_meters)}M` : `${formatDistance(a.distance_meters)} KM`,
    });
  }
  if (opts.fields.duration && a.duration_seconds) {
    statItems.push({ label: 'DURATION', value: formatDuration(a.duration_seconds) });
  }
  if (opts.fields.avgHr && a.avg_hr) {
    statItems.push({ label: 'AVG HR', value: `${a.avg_hr} BPM` });
  }
  if (opts.fields.calories && a.calories) {
    statItems.push({ label: 'KCAL', value: String(a.calories) });
  }

  const showCols = Math.min(statItems.length, vert ? 2 : 3);
  if (showCols > 0) {
    const colW = CW / showCols;
    const labelSz = vert ? 13 : 11;
    const valSz = vert ? 52 : 40;
    for (let i = 0; i < showCols; i++) {
      const s = statItems[i];
      const cx = PAD_LEFT + i * colW;
      ctx.font = `600 ${labelSz}px ${FONT}`;
      ctx.fillStyle = p.faint;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      tracked(ctx, s.label, cx, y, 2);
      ctx.font = `700 ${valSz}px ${FONT}`;
      ctx.fillStyle = p.fg;
      ctx.fillText(s.value, cx, y + labelSz + 6);
    }
    y += (vert ? 13 : 11) + 6 + (vert ? 52 : 40) * 1.15;
  }

  // Footer
  const footerY = H - PAD_V;
  // HR zones ribbon
  if (opts.fields.hrZones && run && hasHRZones(a)) {
    const zs = zoneSecs(a);
    const total = zs.reduce((s, v) => s + v, 0) || 1;
    const ribbonH = vert ? 8 : 6;
    const ribbonY = footerY - ribbonH - (vert ? 20 : 14);
    let xo = PAD_LEFT;
    zs.forEach((s, i) => {
      const sw = (s / total) * CW;
      ctx.fillStyle = HR_ZONE_COLORS[i];
      ctx.fillRect(xo, ribbonY, sw, ribbonH);
      xo += sw;
    });
  }
  // MAF + watermark
  const footSz = vert ? 14 : 11;
  if (run && a.avg_hr && opts.fields.avgHr) {
    const mafText = a.avg_hr <= MAF_HR ? 'MAF ✓' : `+${a.avg_hr - MAF_HR} OVER MAF`;
    ctx.font = `600 ${footSz}px ${FONT}`;
    ctx.fillStyle = a.avg_hr <= MAF_HR ? '#4ade80' : p.muted;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    tracked(ctx, mafText, PAD_LEFT, footerY, 1.5);
  }
  if (opts.fields.watermark) {
    ctx.font = `500 ${footSz}px ${FONT}`;
    ctx.fillStyle = p.faint;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'right';
    const wm = 'GARMIN.HANIF.APP';
    const wmW = trackedW(ctx, wm, 1.5);
    tracked(ctx, wm, PAD_LEFT + CW - wmW + trackedW(ctx, wm, 1.5), footerY, 1.5);
  }
}

// ── Layout: Grid ──────────────────────────────────────────────
// Data dashboard — equal-weight 2-col grid of stats
function drawLayoutGrid(
  ctx: CanvasRenderingContext2D,
  a: Activity,
  opts: Options,
  p: Pal,
  W: number,
  H: number,
  FONT: string,
) {
  const swim = isSwim(a.activity_type);
  const run = isRun(a.activity_type);
  const vert = isVertical(opts.size);
  const PAD = vert ? Math.round(W * 0.07) : Math.round(W * 0.065);
  const CW = W - PAD * 2;

  // Background
  if (!p.transparent) {
    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, 'rgba(255,255,255,0.02)');
    g.addColorStop(1, 'rgba(0,0,0,0.12)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  let y = PAD;

  // Header: sport + date
  const sport = swim ? 'SWIMMING' : run ? 'RUNNING' : (a.activity_type || 'ACTIVITY').toUpperCase();
  const headerSz = vert ? 15 : 12;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.font = `700 ${headerSz}px ${FONT}`;
  ctx.fillStyle = p.accent;
  tracked(ctx, sport, PAD, y, 2.5);
  if (opts.fields.date) {
    const ds = fullDate(a.date);
    ctx.font = `400 ${headerSz}px ${FONT}`;
    ctx.fillStyle = p.muted;
    const dw = trackedW(ctx, ds, 1);
    tracked(ctx, ds, W - PAD - dw, y, 1);
  }
  y += headerSz + (vert ? 12 : 10);

  // Activity name
  if (opts.fields.activityName && a.name) {
    const nameSz = vert ? 20 : 16;
    ctx.font = `500 ${nameSz}px ${FONT}`;
    ctx.fillStyle = p.fg;
    const nm = clip(ctx, a.name, CW);
    ctx.fillText(nm, PAD, y);
    y += nameSz + (vert ? 14 : 10);
  }

  // Divider
  ctx.fillStyle = p.div;
  ctx.fillRect(PAD, y, CW, 2);
  y += vert ? 20 : 16;

  // Build stat cells
  interface GridCell { label: string; value: string; accent?: boolean }
  const cells: GridCell[] = [];

  if (opts.fields.distance && a.distance_meters) {
    cells.push({
      label: 'DISTANCE',
      value: swim ? `${Math.round(a.distance_meters)} M` : `${formatDistance(a.distance_meters)} KM`,
      accent: true,
    });
  }
  if (opts.fields.pace && a.avg_pace_min_per_km) {
    cells.push({
      label: swim ? 'PACE /100M' : 'AVG PACE',
      value: swim ? paceKmToPace100m(a.avg_pace_min_per_km) : a.avg_pace_min_per_km,
    });
  }
  if (opts.fields.duration && a.duration_seconds) {
    cells.push({ label: 'DURATION', value: formatDuration(a.duration_seconds) });
  }
  if (opts.fields.avgHr && a.avg_hr) {
    cells.push({ label: 'AVG HEART RATE', value: `${a.avg_hr} BPM` });
  }
  if (opts.fields.elevation && run && a.elevation_gain_m) {
    cells.push({ label: 'ELEVATION', value: `+${a.elevation_gain_m} M` });
  }
  if (opts.fields.calories && a.calories) {
    cells.push({ label: 'CALORIES', value: `${a.calories} KCAL` });
  }
  if (opts.fields.maxHr && a.max_hr) {
    cells.push({ label: 'MAX HR', value: `${a.max_hr} BPM` });
  }

  // Draw 2-column grid
  const COLS = 2;
  const cellW = CW / COLS;
  const rowCount = Math.ceil(cells.length / COLS);
  const availH = H - y - PAD - (vert ? 48 : 36); // reserve footer
  const cellH = Math.min(availH / rowCount, vert ? 160 : 110);

  const labelSz = vert ? 12 : 10;
  const valSz = vert ? Math.min(Math.round(cellH * 0.42), 60) : Math.min(Math.round(cellH * 0.42), 44);

  for (let row = 0; row < rowCount; row++) {
    for (let col = 0; col < COLS; col++) {
      const idx = row * COLS + col;
      if (idx >= cells.length) continue;
      const cell = cells[idx];
      const cx = PAD + col * cellW;
      const cy = y + row * cellH;

      // Cell border
      ctx.strokeStyle = p.div;
      ctx.lineWidth = 1;
      ctx.strokeRect(cx + (col > 0 ? 1 : 0), cy, cellW - (col > 0 ? 1 : 0), cellH);

      // Label
      const cellPad = vert ? 16 : 12;
      ctx.font = `600 ${labelSz}px ${FONT}`;
      ctx.fillStyle = p.faint;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      tracked(ctx, cell.label, cx + cellPad, cy + cellPad, 2);

      // Value
      ctx.font = `700 ${valSz}px ${FONT}`;
      ctx.fillStyle = cell.accent ? p.accent : p.fg;
      ctx.fillText(cell.value, cx + cellPad, cy + cellPad + labelSz + 8);
    }
  }

  y += rowCount * cellH + (vert ? 16 : 10);

  // Footer
  const footerY = H - PAD + (vert ? 0 : 4);
  ctx.fillStyle = p.div;
  ctx.fillRect(PAD, footerY - (vert ? 30 : 22), CW, 1);

  if (opts.fields.hrZones && run && hasHRZones(a)) {
    const zs = zoneSecs(a);
    const total = zs.reduce((s, v) => s + v, 0) || 1;
    const ribbonH = 5;
    const ribbonY = footerY - (vert ? 18 : 14);
    let xo = PAD;
    zs.forEach((s, i) => {
      const sw = (s / total) * CW;
      ctx.fillStyle = HR_ZONE_COLORS[i];
      ctx.fillRect(xo, ribbonY, sw, ribbonH);
      xo += sw;
    });
  }

  if (opts.fields.watermark) {
    const footSz = vert ? 13 : 10;
    ctx.font = `500 ${footSz}px ${FONT}`;
    ctx.fillStyle = p.faint;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'right';
    const wm = 'GARMIN.HANIF.APP';
    const wmW = trackedW(ctx, wm, 1.5);
    tracked(ctx, wm, PAD + CW - wmW + trackedW(ctx, wm, 1.5), footerY, 1.5);
  }
}

// ── Layout: Headline ─────────────────────────────────────────
// Editorial / magazine style — activity type header, centered distance, stats ribbon
function drawLayoutHeadline(
  ctx: CanvasRenderingContext2D,
  a: Activity,
  opts: Options,
  p: Pal,
  W: number,
  H: number,
  FONT: string,
) {
  const swim = isSwim(a.activity_type);
  const run = isRun(a.activity_type);
  const vert = isVertical(opts.size);
  const PAD = vert ? Math.round(W * 0.08) : Math.round(W * 0.065);
  const CW = W - PAD * 2;

  // Background
  if (!p.transparent) {
    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, H * 0.3, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // Top rule
  ctx.fillStyle = p.accent;
  ctx.fillRect(PAD, Math.round(H * 0.06), CW, 3);

  let y = Math.round(H * 0.06) + 3 + (vert ? 20 : 14);

  // Sport category (large, bold, left)
  const sport = swim ? 'SWIMMING' : run ? 'RUNNING' : (a.activity_type || 'ACTIVITY').toUpperCase();
  const sportSz = vert ? 36 : 26;
  ctx.font = `800 ${sportSz}px ${FONT}`;
  ctx.fillStyle = p.fg;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  tracked(ctx, sport, PAD, y, 4);
  y += sportSz + (vert ? 8 : 6);

  // Date
  if (opts.fields.date) {
    const dateSz = vert ? 15 : 12;
    ctx.font = `400 ${dateSz}px ${FONT}`;
    ctx.fillStyle = p.muted;
    tracked(ctx, fullDate(a.date), PAD, y, 1.5);
    y += dateSz + (vert ? 32 : 20);
  } else {
    y += vert ? 24 : 16;
  }

  // Center rule
  ctx.fillStyle = p.div;
  ctx.fillRect(PAD, y, CW, 1);
  y += vert ? 32 : 20;

  // Hero: BIG centered distance
  if (opts.fields.distance && a.distance_meters) {
    const distVal = swim
      ? String(Math.round(a.distance_meters))
      : formatDistance(a.distance_meters);
    const distUnit = swim ? 'M' : 'KM';

    const heroSz = vert ? (opts.size === 'story' ? 260 : 220) : 140;
    ctx.font = `900 ${heroSz}px ${FONT}`;
    ctx.fillStyle = p.fg;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    ctx.fillText(distVal, W / 2, y);
    y += heroSz * 1.0;

    // Unit centered below
    const unitSz = vert ? 24 : 18;
    ctx.font = `800 ${unitSz}px ${FONT}`;
    ctx.fillStyle = p.accent;
    ctx.textAlign = 'center';
    tracked(ctx, distUnit, W / 2 - trackedW(ctx, distUnit, 4) / 2, y, 4);
    y += unitSz + (vert ? 32 : 20);
  }

  // Activity name
  if (opts.fields.activityName && a.name) {
    const nameSz = vert ? 18 : 14;
    ctx.font = `300 ${nameSz}px ${FONT}`;
    ctx.fillStyle = p.faint;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const nm = clip(ctx, a.name, CW * 0.8);
    ctx.fillText(nm, W / 2, y);
    y += nameSz + (vert ? 20 : 12);
  }

  // Bottom stats ribbon
  const footH = vert ? Math.round(H * 0.18) : Math.round(H * 0.25);
  const footY = H - footH;

  ctx.fillStyle = p.div;
  ctx.fillRect(PAD, footY, CW, 2);

  const ribbonStats: { label: string; value: string }[] = [];
  if (opts.fields.pace && a.avg_pace_min_per_km) {
    ribbonStats.push({ label: swim ? '/ 100M' : '/ KM', value: swim ? paceKmToPace100m(a.avg_pace_min_per_km) : a.avg_pace_min_per_km });
  }
  if (opts.fields.duration && a.duration_seconds) {
    ribbonStats.push({ label: 'TIME', value: formatDuration(a.duration_seconds) });
  }
  if (opts.fields.avgHr && a.avg_hr) {
    ribbonStats.push({ label: 'BPM', value: String(a.avg_hr) });
  }
  if (opts.fields.elevation && run && a.elevation_gain_m) {
    ribbonStats.push({ label: 'ELEV', value: `+${a.elevation_gain_m}M` });
  }

  const ribbonCols = Math.min(ribbonStats.length, vert ? 3 : 4);
  if (ribbonCols > 0) {
    const colW2 = CW / ribbonCols;
    const labSz2 = vert ? 12 : 10;
    const valSz2 = vert ? 42 : 30;
    const ry = footY + (vert ? 20 : 14);
    for (let i = 0; i < ribbonCols; i++) {
      const s = ribbonStats[i];
      const cx = PAD + i * colW2;
      ctx.font = `600 ${labSz2}px ${FONT}`;
      ctx.fillStyle = p.faint;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      tracked(ctx, s.label, cx, ry, 2);
      ctx.font = `700 ${valSz2}px ${FONT}`;
      ctx.fillStyle = p.fg;
      ctx.fillText(s.value, cx, ry + labSz2 + 6);
    }
  }

  // HR zones
  if (opts.fields.hrZones && run && hasHRZones(a)) {
    const zs = zoneSecs(a);
    const total = zs.reduce((s, v) => s + v, 0) || 1;
    const ribbonH2 = 5;
    const ribbonY2 = H - (vert ? 40 : 30);
    let xo = PAD;
    zs.forEach((s, i) => {
      const sw = (s / total) * CW;
      ctx.fillStyle = HR_ZONE_COLORS[i];
      ctx.fillRect(xo, ribbonY2, sw, ribbonH2);
      xo += sw;
    });
  }

  // Bottom rule + watermark
  ctx.fillStyle = p.div;
  ctx.fillRect(PAD, H - (vert ? 52 : 38), CW, 1);

  if (opts.fields.watermark) {
    const wmSz = vert ? 13 : 10;
    ctx.font = `500 ${wmSz}px ${FONT}`;
    ctx.fillStyle = p.faint;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'right';
    const wm = 'GARMIN.HANIF.APP';
    const wmW = trackedW(ctx, wm, 1.5);
    tracked(ctx, wm, PAD + CW - wmW + trackedW(ctx, wm, 1.5), H - (vert ? 28 : 18), 1.5);
  }
}

// ── main draw ────────────────────────────────────────────────

function drawCard(canvas: HTMLCanvasElement, a: Activity, opts: Options, overrideFont?: string) {
  const FONT = overrideFont ?? '"Helvetica Neue", "Arial", system-ui, -apple-system, sans-serif';
  const { W, H } = getDims(opts.size);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Dispatch new layouts early
  if (opts.layout === 'strava') { drawLayoutStrava(ctx, a, opts, pal(opts.theme), W, H, FONT); return; }
  if (opts.layout === 'grid') { drawLayoutGrid(ctx, a, opts, pal(opts.theme), W, H, FONT); return; }
  if (opts.layout === 'headline') { drawLayoutHeadline(ctx, a, opts, pal(opts.theme), W, H, FONT); return; }

  const p = pal(opts.theme);
  const fs = scale(opts.size, opts.layout);
  const wt = fontWeights(opts.layout);
  const swim = isSwim(a.activity_type);
  const run = isRun(a.activity_type);
  const vert = isVertical(opts.size);
  const PAD = opts.size === 'story' ? 88 : opts.size === 'wide' ? 60 : 80;
  const CW = W - PAD * 2;

  // ── background ──
  if (!p.transparent) {
    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, W, H);
    // Subtle tone gradient
    const g = ctx.createLinearGradient(0, 0, W, H);
    if (opts.theme === 'noir') {
      g.addColorStop(0, 'rgba(255,255,255,0.025)');
      g.addColorStop(1, 'rgba(0,0,0,0.18)');
    } else {
      g.addColorStop(0, 'rgba(255,255,255,0.25)');
      g.addColorStop(1, 'rgba(0,0,0,0.04)');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  let y = PAD;

  // ─────────────────────────────────────────────
  // EYEBROW: sport + date
  // ─────────────────────────────────────────────

  const sport = swim ? 'SWIMMING' : run ? 'RUNNING' : activityLabel(a.activity_type).toUpperCase();

  // Top rule
  ctx.fillStyle = p.div;
  ctx.fillRect(PAD, y, CW, 2);
  y += vert ? 20 : 16;

  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  // Sport tag
  ctx.font = `${wt.label} ${fs.eyebrow}px ${FONT}`;
  ctx.fillStyle = p.fg;
  tracked(ctx, sport, PAD, y, 3);

  // Date — right
  if (opts.fields.date) {
    const dateStr = fullDate(a.date);
    ctx.font = `400 ${fs.eyebrow}px ${FONT}`;
    ctx.fillStyle = p.muted;
    const dW = trackedW(ctx, dateStr, 1.2);
    tracked(ctx, dateStr, PAD + CW - dW, y, 1.2);
  }

  y += fs.eyebrow + (vert ? 40 : 28);

  // ─────────────────────────────────────────────
  // HERO: Distance
  // ─────────────────────────────────────────────

  if (opts.fields.distance && a.distance_meters) {
    const distVal = swim
      ? String(Math.round(a.distance_meters))
      : formatDistance(a.distance_meters);
    const distUnit = swim ? 'METRES' : 'KM';

    ctx.font = `${wt.hero} ${fs.hero}px ${FONT}`;
    ctx.fillStyle = p.fg;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(distVal, PAD, y);

    y += fs.hero * 1.08;

    // Unit on its own line — bold, accented
    ctx.font = `800 ${fs.unit}px ${FONT}`;
    ctx.fillStyle = p.accent;
    tracked(ctx, distUnit, PAD, y, 3);
    y += fs.unit + (vert ? 16 : 10);
  } else if (!opts.fields.distance) {
    // Still need some spacing
    y += vert ? 40 : 20;
  }

  // Activity name
  if (opts.fields.activityName && a.name) {
    const nm = clip(ctx, a.name, CW);
    ctx.font = `400 ${fs.name}px ${FONT}`;
    ctx.fillStyle = p.faint;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(nm, PAD, y);
    y += fs.name + (vert ? 12 : 8);
  }

  // ─────────────────────────────────────────────
  // STATS
  // ─────────────────────────────────────────────

  interface Stat { label: string; value: string }
  const stats: Stat[] = [];

  if (opts.fields.pace) {
    stats.push({
      label: swim ? 'PACE / 100M' : 'AVG PACE',
      value: swim
        ? paceKmToPace100m(a.avg_pace_min_per_km) + (a.avg_pace_min_per_km ? ' MIN' : '')
        : (a.avg_pace_min_per_km ? a.avg_pace_min_per_km + ' /KM' : '—'),
    });
  }
  if (opts.fields.duration) {
    stats.push({ label: 'DURATION', value: a.duration_seconds ? formatDuration(a.duration_seconds) : '—' });
  }
  if (opts.fields.avgHr) {
    stats.push({ label: 'AVG HEART RATE', value: a.avg_hr ? `${a.avg_hr} BPM` : '—' });
  }
  if (opts.fields.maxHr && a.max_hr) {
    stats.push({ label: 'MAX HEART RATE', value: `${a.max_hr} BPM` });
  }
  if (opts.fields.calories && a.calories) {
    stats.push({ label: 'CALORIES', value: `${a.calories} KCAL` });
  }
  if (opts.fields.elevation && run && a.elevation_gain_m) {
    stats.push({ label: 'ELEVATION GAIN', value: `+${a.elevation_gain_m} M` });
  }
  if (opts.fields.laps && swim && a.distance_meters) {
    const laps = Math.round(a.distance_meters / 50);
    if (laps > 0) stats.push({ label: 'LAPS · 50M POOL', value: String(laps) });
  }

  if (stats.length > 0) {
    y += vert ? 28 : 20;

    // Rule above stats
    ctx.fillStyle = p.div;
    ctx.fillRect(PAD, y, CW, 2);
    y += vert ? 36 : 26;

    if (vert) {
      // ── Vertical list (portrait / story) ──────────────────
      // Each stat: label small above, value BIG below
      stats.forEach((s, i) => {
        // Label
        ctx.font = `700 ${fs.label}px ${FONT}`;
        ctx.fillStyle = p.faint;
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        tracked(ctx, s.label, PAD, y, 2.5);
        y += fs.label + 8;

        // Value — the big number
        ctx.font = `${wt.value} ${fs.value}px ${FONT}`;
        ctx.fillStyle = p.fg;
        ctx.textBaseline = 'top';
        ctx.fillText(s.value, PAD, y);
        y += fs.value * 1.1;

        // Thin rule between stats (not after last)
        if (i < stats.length - 1) {
          y += vert ? 20 : 14;
          ctx.fillStyle = p.div;
          ctx.fillRect(PAD, y, CW, 1);
          y += vert ? 28 : 18;
        }
      });

    } else {
      // ── Horizontal row (wide / square) ────────────────────
      // Show max 3 stats in equal columns — all left-aligned in their col
      const showN = Math.min(stats.length, 3);
      const colW = CW / showN;
      let maxBottom = y;

      for (let i = 0; i < showN; i++) {
        const s = stats[i];
        const cx = PAD + i * colW;
        let ly = y;

        // Label
        ctx.font = `700 ${fs.label}px ${FONT}`;
        ctx.fillStyle = p.faint;
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        tracked(ctx, s.label, cx, ly, 2.2);
        ly += fs.label + 10;

        // Value
        ctx.font = `${wt.value} ${fs.value}px ${FONT}`;
        ctx.fillStyle = p.fg;
        ctx.fillText(s.value, cx, ly);
        ly += fs.value * 1.15;

        maxBottom = Math.max(maxBottom, ly);
      }

      y = maxBottom;
    }
  }

  // ─────────────────────────────────────────────
  // FOOTER
  // ─────────────────────────────────────────────

  const footerBottom = H - PAD;
  const ruleY = footerBottom - (vert ? 56 : 36);

  ctx.fillStyle = p.div;
  ctx.fillRect(PAD, ruleY, CW, 2);

  // HR zones ribbon — run only
  if (opts.fields.hrZones && run && hasHRZones(a)) {
    const zs = zoneSecs(a);
    const total = zs.reduce((sum, v) => sum + v, 0) || 1;
    const ribbonH = vert ? 8 : 6;
    const ribbonY = ruleY + (vert ? 12 : 8);
    let xo = PAD;
    zs.forEach((s, i) => {
      const sw = (s / total) * CW;
      ctx.fillStyle = HR_ZONE_COLORS[i];
      ctx.fillRect(xo, ribbonY, sw, ribbonH);
      xo += sw;
    });
  }

  // MAF line (run only) — left side
  if (run && a.avg_hr && opts.fields.avgHr) {
    const mafText = a.avg_hr <= MAF_HR ? 'MAF MAINTAINED' : `${a.avg_hr - MAF_HR} BPM OVER MAF`;
    ctx.font = `600 ${fs.foot}px ${FONT}`;
    ctx.fillStyle = a.avg_hr <= MAF_HR ? (opts.theme === 'paper' ? '#166534' : '#4ade80') : p.muted;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    tracked(ctx, mafText, PAD, footerBottom, 1.5);
  }

  // Watermark — right side
  if (opts.fields.watermark) {
    ctx.font = `500 ${fs.foot}px ${FONT}`;
    ctx.fillStyle = p.faint;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'right';
    const wm = 'GARMIN.HANIF.APP';
    const wmW = trackedW(ctx, wm, 1.5);
    tracked(ctx, wm, PAD + CW - wmW, footerBottom, 1.5);
  }
}

// ─── default fields ──────────────────────────────────────────

const DEFAULT_FIELDS: Fields = {
  distance: true,
  activityName: false,
  date: true,
  pace: true,
  duration: true,
  avgHr: true,
  maxHr: false,
  calories: false,
  elevation: false,
  hrZones: true,
  laps: true,
  watermark: true,
};

// ─── React component ─────────────────────────────────────────

const SIZE_LABELS: Record<SizeOption, string> = {
  story: 'Story 9:16',
  portrait: 'Portrait 4:5',
  square: 'Square 1:1',
  wide: 'Wide 16:9',
};
const THEME_LABELS: Record<ThemeOption, string> = {
  noir: 'Noir',
  paper: 'Paper',
  transparent: 'Clear',
};
const LAYOUT_LABELS: Record<LayoutOption, string> = {
  bold: 'Bold',
  clean: 'Clean',
  minimal: 'Minimal',
  strava: 'Strava',
  grid: 'Grid',
  headline: 'Headline',
};
const FIELD_META: { key: keyof Fields; label: string }[] = [
  { key: 'distance',     label: 'Distance' },
  { key: 'pace',         label: 'Pace' },
  { key: 'duration',     label: 'Duration' },
  { key: 'avgHr',        label: 'Avg BPM' },
  { key: 'maxHr',        label: 'Max BPM' },
  { key: 'calories',     label: 'Calories' },
  { key: 'elevation',    label: 'Elevation' },
  { key: 'laps',         label: 'Laps (swim)' },
  { key: 'hrZones',      label: 'HR Zones bar' },
  { key: 'date',         label: 'Date' },
  { key: 'activityName', label: 'Activity name' },
  { key: 'watermark',    label: 'Watermark' },
];

export default function ActivityShareModal({ activity, onClose, canvasFont }: Props) {
  const [opts, setOpts] = useState<Options>({
    size: 'portrait',
    theme: 'noir',
    layout: 'bold',
    fields: { ...DEFAULT_FIELDS },
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const redraw = useCallback(() => {
    const c = canvasRef.current;
    if (c) drawCard(c, activity, opts, canvasFont);
  }, [activity, opts, canvasFont]);

  useEffect(() => { redraw(); }, [redraw]);

  const doDownload = () => {
    setDownloading(true);
    const off = document.createElement('canvas');
    drawCard(off, activity, opts, canvasFont);
    off.toBlob(blob => {
      if (!blob) { setDownloading(false); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const slug = (activity.name || activityLabel(activity.activity_type))
        .replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 36);
      a.href = url;
      a.download = `garmin-${slug}-${opts.size}-${opts.layout}.png`;
      a.click();
      URL.revokeObjectURL(url);
      setDownloading(false);
    }, 'image/png');
  };

  const doCopy = async () => {
    try {
      const off = document.createElement('canvas');
      drawCard(off, activity, opts, canvasFont);
      const blob = await new Promise<Blob | null>(res => off.toBlob(res, 'image/png'));
      if (!blob) return;
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch { /* clipboard may not be supported */ }
  };

  const toggleField = (key: keyof Fields) =>
    setOpts(o => ({ ...o, fields: { ...o.fields, [key]: !o.fields[key] } }));

  const { W: cW, H: cH } = getDims(opts.size);
  const isTransparent = opts.theme === 'transparent';

  // Fit preview in modal
  const MAX_PREVIEW_W = 440;
  const MAX_PREVIEW_H = 440;
  const scaleRatio = Math.min(MAX_PREVIEW_W / cW, MAX_PREVIEW_H / cH);
  const pvW = Math.round(cW * scaleRatio);
  const pvH = Math.round(cH * scaleRatio);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          background: 'var(--bg-elev)',
          border: '1px solid rgba(255,255,255,0.08)',
          width: Math.max(pvW + 48, 480),
          maxWidth: '96vw',
          maxHeight: '96vh',
          overflowY: 'auto',
          padding: '22px 22px 18px',
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-4 text-2xl leading-none"
          style={{ color: 'var(--text-tertiary)' }}
        >×</button>

        {/* Header */}
        <div className="mb-3">
          <div className="label mb-0.5">Export Activity</div>
          <div className="text-sm font-medium truncate" style={{ color: 'var(--text-secondary)' }}>
            {activity.name || activityLabel(activity.activity_type)}
          </div>
        </div>

        {/* Canvas preview */}
        <div
          className="rounded-xl overflow-hidden mx-auto mb-4"
          style={{
            width: pvW,
            height: pvH,
            flexShrink: 0,
            background: isTransparent
              ? 'repeating-conic-gradient(#383838 0% 25%, #1c1c1c 0% 50%) 0 0 / 14px 14px'
              : 'rgba(0,0,0,0.25)',
          }}
        >
          <canvas
            ref={canvasRef}
            style={{ width: pvW, height: pvH, display: 'block' }}
          />
        </div>

        {/* Controls */}
        <div className="space-y-2 mb-4">
          <OptionRow label="Layout">
            {(['bold', 'clean', 'minimal', 'strava', 'grid', 'headline'] as LayoutOption[]).map(v => (
              <Chip key={v} label={LAYOUT_LABELS[v]} active={opts.layout === v}
                onClick={() => setOpts(o => ({ ...o, layout: v }))} />
            ))}
          </OptionRow>

          <OptionRow label="Size">
            {(['portrait', 'story', 'square', 'wide'] as SizeOption[]).map(v => (
              <Chip key={v} label={SIZE_LABELS[v]} active={opts.size === v}
                onClick={() => setOpts(o => ({ ...o, size: v }))} />
            ))}
          </OptionRow>

          <OptionRow label="Theme">
            {(['noir', 'paper', 'transparent'] as ThemeOption[]).map(v => (
              <Chip key={v} label={THEME_LABELS[v]} active={opts.theme === v}
                onClick={() => setOpts(o => ({ ...o, theme: v }))} />
            ))}
          </OptionRow>

          {/* Field toggles */}
          <div>
            <div className="label mb-2">Data Fields</div>
            <div
              className="rounded-xl p-3"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="grid grid-cols-2 gap-y-1.5 gap-x-4">
                {FIELD_META.map(({ key, label }) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 cursor-pointer select-none"
                    style={{ color: opts.fields[key] ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
                  >
                    <span
                      className="flex-shrink-0 rounded"
                      style={{
                        width: 14,
                        height: 14,
                        border: `1.5px solid ${opts.fields[key] ? 'rgba(244,241,236,0.6)' : 'rgba(255,255,255,0.15)'}`,
                        background: opts.fields[key] ? 'rgba(244,241,236,0.15)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onClick={() => toggleField(key)}
                    >
                      {opts.fields[key] && (
                        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                          <path d="M1 3L3 5L7 1" stroke="#F0EDE4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <span className="text-xs" onClick={() => toggleField(key)}>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={doDownload}
            disabled={downloading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: downloading ? 'rgba(255,255,255,0.06)' : '#f0ede4',
              color: downloading ? 'rgba(255,255,255,0.3)' : '#0a0a0a',
              cursor: downloading ? 'not-allowed' : 'pointer',
            }}
          >
            {downloading ? 'Generating…' : 'Download PNG'}
          </button>
          <button
            onClick={doCopy}
            className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: copied ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${copied ? 'rgba(34,197,94,0.28)' : 'rgba(255,255,255,0.08)'}`,
              color: copied ? '#4ade80' : 'var(--text-tertiary)',
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <div className="mt-1.5 text-center" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          {cW} × {cH} px · PNG{isTransparent ? ' · Transparent' : ''}
        </div>
      </div>
    </div>
  );
}

function OptionRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="label w-14 flex-shrink-0 pt-1">{label}</span>
      <div className="flex gap-1.5 flex-wrap">{children}</div>
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="py-1.5 px-3 rounded-lg text-xs font-medium transition-all"
      style={{
        background: active ? 'rgba(244,241,236,0.12)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${active ? 'rgba(244,241,236,0.32)' : 'rgba(255,255,255,0.06)'}`,
        color: active ? '#f0ede4' : 'var(--text-tertiary)',
      }}
    >
      {label}
    </button>
  );
}
