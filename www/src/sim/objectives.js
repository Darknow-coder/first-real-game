// Level objectives (stars). Each level has three: landing + two challenges.
import { diameterMm } from './classify.js';

/**
 * Evaluate one objective.
 * @returns {{done: boolean, value: number|string|null, goal: number|string|null, ratio: number}}
 */
export function evaluate(obj, ctx) {
  const { world, analysis } = ctx;
  const c = world.crystal;
  const landed = world.status === 'landed';
  switch (obj.kind) {
    case 'land':
      return { done: landed, value: null, goal: null, ratio: landed ? 1 : world.progress };
    case 'shards': {
      const v = world.stats.shards;
      return { done: v >= obj.n && landed, value: v, goal: obj.n, ratio: Math.min(1, v / obj.n) };
    }
    case 'size': {
      const v = diameterMm(c.R);
      return { done: v >= obj.mm && landed, value: v, goal: obj.mm, ratio: Math.min(1, v / obj.mm) };
    }
    case 'beauty': {
      const v = analysis ? analysis.beauty : 0;
      return { done: v >= obj.n && landed, value: v, goal: obj.n, ratio: Math.min(1, v / obj.n) };
    }
    case 'type': {
      const v = analysis ? analysis.type : null;
      const ok = Array.isArray(obj.type) ? obj.type.includes(v) : v === obj.type;
      return { done: ok && landed, value: v, goal: obj.type, ratio: ok ? 1 : 0 };
    }
    case 'match': {
      const v = analysis && analysis.match !== null ? Math.round(analysis.match * 100) : 0;
      return { done: v >= obj.pct && landed, value: v, goal: obj.pct, ratio: Math.min(1, v / obj.pct) };
    }
    case 'intact': {
      const ok = c.hits === 0 && world.stats.merges === 0;
      return { done: ok && landed, value: c.hits, goal: 0, ratio: ok ? 1 : 0 };
    }
    case 'nomelt': {
      const ok = c.melted < 0.8;
      return { done: ok && landed, value: c.melted, goal: 0, ratio: ok ? 1 : 0 };
    }
    case 'badge': {
      const ok = analysis ? analysis.badges.includes(obj.badge) : false;
      return { done: ok && landed, value: null, goal: obj.badge, ratio: ok ? 1 : 0 };
    }
    default:
      return { done: false, value: null, goal: null, ratio: 0 };
  }
}

export function evaluateAll(objectives, ctx) {
  return objectives.map((o) => ({ obj: o, ...evaluate(o, ctx) }));
}

/** Objectives whose state can only get worse during play (shown as "kept"). */
export const KEEP_KINDS = new Set(['intact', 'nomelt']);
