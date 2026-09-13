/* Three-way merge. Missing records represent deletions. */
(() => {
  const groups = ['geckos', 'growth', 'pairings'];
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const empty = () => ({ geckos: [], growth: [], pairings: [] });
  const data = value => Object.fromEntries(groups.map(k => [k, value[k] || []]));
  function merge(base, local, remote) {
    const conflicts = [];
    function value(b, l, r, path) {
      if (equal(l, r) || equal(b, r)) return l;
      if (equal(b, l)) return r;
      if ([b, l, r].every(v => v && typeof v === 'object' && !Array.isArray(v))) {
        const out = {};
        for (const key of new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)])) {
          const v = value(b[key], l[key], r[key], path + '.' + key);
          if (v !== undefined) out[key] = v;
        }
        return out;
      }
      conflicts.push(path);
      return l;
    }
    const result = empty();
    for (const group of groups) {
      const [b, l, r] = [base, local, remote].map(d => new Map((d[group] || []).map(v => [v.id, v])));
      for (const id of new Set([...r.keys(), ...l.keys(), ...b.keys()])) {
        const v = value(b.get(id), l.get(id), r.get(id), group + '.' + id);
        if (v !== undefined) result[group].push(v);
      }
    }
    return { data: result, conflicts };
  }
  globalThis.CrestieSync = { equal, empty, data, merge };
})();
