/* Turns the manifest into what rules.js actually needs: a flat, ordered list of
   set descriptors. Pure — no DOM, no state. The orderings live here rather than
   in rules.js so the rules never learn what a "collection" or a "featured"
   collection is; to them a run is just three chains and a queue. */
(function (root) {
  'use strict';

  function sets(collections) {
    var out = [];
    collections.forEach(function (c) {
      (c.sets || []).forEach(function (s) {
        out.push({
          key: c.id + '/' + s.id,
          collection: c.id,
          set: s.id,
          tiers: s.tiers || 3
        });
      });
    });
    return out;
  }

  function find(collections, key) {
    var parts = String(key).split('/');
    for (var i = 0; i < collections.length; i++) {
      if (collections[i].id !== parts[0]) continue;
      var list = collections[i].sets || [];
      for (var j = 0; j < list.length; j++) {
        if (list[j].id === parts[1]) return { collection: collections[i], set: list[j] };
      }
    }
    return null;
  }

  /* Fisher-Yates against an injected rnd, so orderings are reproducible in tests
     and per-session in play. */
  function shuffle(list, rnd) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function hue(hex) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var r = parseInt(h.slice(0, 2), 16) / 255,
        g = parseInt(h.slice(2, 4), 16) / 255,
        b = parseInt(h.slice(4, 6), 16) / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (!d) return 0;
    var deg;
    if (max === r) deg = ((g - b) / d) % 6;
    else if (max === g) deg = (b - r) / d + 2;
    else deg = (r - g) / d + 4;
    deg *= 60;
    return deg < 0 ? deg + 360 : deg;
  }

  function hueDistance(a, b) {
    var d = Math.abs(hue(a) - hue(b));
    return d > 180 ? 360 - d : d;
  }

  /* Round-robin the opening so the first tray is never one collection — the same
     reason createState deals its opening hand round-robin. The tail is shuffled
     so two clients in a row do not get the same climb. */
  function endlessOrder(collections, rnd) {
    var byCollection = collections.map(function (c) {
      return sets([c]);
    }).filter(function (list) { return list.length; });

    var head = [], tail = [], round = 0, taken = true;
    while (taken) {
      taken = false;
      for (var i = 0; i < byCollection.length; i++) {
        var d = byCollection[i][round];
        if (!d) continue;
        taken = true;
        (head.length < 3 ? head : tail).push(d);
      }
      round++;
    }
    return head.concat(shuffle(tail, rnd));
  }

  /* The featured collection's sets first, then fillers ordered by how far their
     accent sits from the featured one — a demo tray that reads as three different
     things even when two of them are borrowed. */
  function demoOrder(collections, featuredId, rnd) {
    var featured = null;
    collections.forEach(function (c) { if (c.id === featuredId) featured = c; });
    if (!featured) return endlessOrder(collections, rnd);

    var mine = shuffle(sets([featured]), rnd);
    var others = collections.filter(function (c) { return c.id !== featuredId; });
    others.sort(function (a, b) {
      return hueDistance(featured.accent, b.accent) - hueDistance(featured.accent, a.accent);
    });

    var fillers = [];
    others.forEach(function (c) { fillers = fillers.concat(sets([c])); });
    return mine.concat(fillers);
  }

  root.Manifest = {
    sets: sets, find: find, shuffle: shuffle,
    hue: hue, hueDistance: hueDistance,
    endlessOrder: endlessOrder, demoOrder: demoOrder
  };
})(typeof window !== 'undefined' ? window : globalThis);
