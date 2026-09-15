/* Auris Merge — rendering, input, screen flow.
   All game rules live in rules.js; this file only draws them and listens. */
(function () {
  'use strict';

  var R = Rules;
  var G = R.GRID;

  var CROWN_MS = 1250;       // must match the crown-* animations in style.css

  var lang = localStorage.getItem('auris.lang') || 'ru';

  function pair(key) { return Manifest.find(Collections, key); }

  /* Everything nameable comes from the manifest at runtime, which is what makes
     adding a collection a data change rather than a code change. */
  function labelOf(key) {
    var p = pair(key);
    if (!p) return '';
    return p.collection.name[lang] + ' · ' + p.set.name[lang];
  }

  /* Static, non-manifest copy (button labels, toasts, the manual) lives in
     data/copy.js. Runtime-built strings read through this instead of
     hard-coding a language. */
  function copyOf(key) {
    var dict = Copy[lang] || Copy.ru;
    return dict[key] !== undefined ? dict[key] : key;
  }

  function accentOf(key) {
    var p = pair(key);
    return p ? p.collection.accent : '#888';
  }

  function spriteOf(piece) {
    var p = pair(piece.key);
    if (!p) return '';
    return 'assets/pieces/' + p.collection.id + '_' + p.set.id + '_' + piece.tier + '.png';
  }

  var state = null;
  var els = {};              // piece id -> element
  var selected = -1;         // tap-then-tap source, or -1
  var busy = false;          // ignore input while a merge animates
  var toastTimer = 0;
  var featured = null;       // featured collection id for demo mode
  var pendingPlate = null;   // set key of completed chain awaiting plate overlay

  var PLATE_MS = 3000;
  var plateTimer = 0;
  var initials = ['А', 'А', 'А'];
  var slot = 0;
  var pendingScore = 0;

  var tray = document.getElementById('tray');
  var scoreEl = document.getElementById('score');
  var toastEl = document.getElementById('toast');

  /* ── geometry ──────────────────────────────────────────────────────────
     Positions are percentages of the tray, so everything is responsive and
     no layout measuring is ever needed. */
  function pct(index) {
    return { left: (index % G) * (100 / G) + '%', top: Math.floor(index / G) * (100 / G) + '%' };
  }

  /* ── build ─────────────────────────────────────────────────────────────── */
  function buildCells() {
    tray.innerHTML = '';
    for (var i = 0; i < R.CELLS; i++) {
      var c = document.createElement('div');
      var p = pct(i);
      c.className = 'cell';
      c.dataset.index = i;
      c.style.left = p.left;
      c.style.top = p.top;
      tray.appendChild(c);
    }
  }

  function makePiece(piece) {
    var el = document.createElement('div');
    el.className = 'piece is-new';
    el.dataset.collection = pair(piece.key) ? pair(piece.key).collection.id : '';
    el.dataset.id = piece.id;
    el.style.setProperty('--accent', accentOf(piece.key));

    var face = document.createElement('div');
    face.className = 'piece-face';
    face.style.backgroundImage = 'url("' + spriteOf(piece) + '")';

    var pips = document.createElement('div');
    pips.className = 'pips';
    for (var t = 0; t < piece.tier; t++) pips.appendChild(document.createElement('i'));

    face.appendChild(pips);
    el.appendChild(face);
    tray.appendChild(el);

    setTimeout(function () { el.classList.remove('is-new'); }, 360);
    return el;
  }

  /* Reconcile the DOM against state: add what is new, drop what is gone,
     move everything else. Elements are keyed by piece id so CSS transitions
     do the animating for us. */
  function sync() {
    var live = {};
    for (var i = 0; i < R.CELLS; i++) {
      var piece = state.cells[i];
      if (!piece) continue;
      live[piece.id] = true;

      var el = els[piece.id] || (els[piece.id] = makePiece(piece));
      var p = pct(i);
      el.style.left = p.left;
      el.style.top = p.top;
      el.dataset.index = i;
    }

    Object.keys(els).forEach(function (id) {
      if (live[id]) return;
      var el = els[id];
      delete els[id];
      if (el.dataset.keep === '1') return;   // a crown animation owns it
      el.classList.add('is-gone');
      setTimeout(function () { el.remove(); }, 320);
    });
  }

  /* ── effects ───────────────────────────────────────────────────────────── */
  function floatPoints(index, points) {
    var f = document.createElement('div');
    var p = pct(index);
    f.className = 'float';
    f.textContent = '+' + points;
    f.style.left = 'calc(' + p.left + ' + ' + (100 / G / 2) + '%)';
    f.style.top = 'calc(' + p.top + ' + ' + (100 / G / 2) + '%)';
    tray.appendChild(f);
    setTimeout(function () { f.remove(); }, 1000);
  }

  /* The finished piece is the prettiest thing in the set and the whole reason
     the game exists, so it does not just wink out where it was made: it swells
     to the middle of the tray, names its collection, and then rises to the ear.

     It never blocks input. This happens 35 times a game, so the player has to be
     able to keep merging underneath it. */
  function showCrown(index, piece) {
    var el = makePiece(piece);
    var p = pct(index);
    var col = index % G;
    var row = Math.floor(index / G);

    el.style.left = p.left;
    el.style.top = p.top;
    /* Offsets are in percentages of the PIECE, which is 100/G % of the tray, so
       one tray-percent is G element-percents. This lands its centre on the tray
       centre from any cell. */
    el.style.setProperty('--dx', ((G - 1) / 2 - col) * 100 + '%');
    el.style.setProperty('--dy', ((G - 1) / 2 - row) * 100 + '%');
    el.dataset.keep = '1';
    el.classList.remove('is-new');
    el.classList.add('is-crowned');
    /* It sits over live cells throughout. Without this it hit-tests as a piece
       with no cell index and the drop under it resolves to nothing. */
    el.style.pointerEvents = 'none';

    var label = document.createElement('div');
    label.className = 'crown-label';
    label.textContent = labelOf(piece.key);
    tray.appendChild(label);

    setTimeout(function () { el.remove(); label.remove(); }, CROWN_MS);
  }

  /* Move an element onto a cell with no transition, so the change of coordinates
     is invisible. Used when a drag succeeds: the piece is already sitting over
     the target, and it should stay there. */
  function landOn(el, index) {
    var p = pct(index);
    var prev = el.style.transition;
    el.style.transition = 'none';
    el.style.transform = '';
    el.style.left = p.left;
    el.style.top = p.top;
    void el.offsetWidth;                       // commit before transitions resume
    el.style.transition = prev;
  }

  function toast(text) {
    toastEl.textContent = text;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 1800);
  }

  /* ── HUD ───────────────────────────────────────────────────────────────── */
  function drawHud() {
    scoreEl.textContent = state.score;

    /* Pips are progress inside the sets on the tray: how many of each chain's
       finished pieces are done before it retires. The score is the other meter,
       and it counts total output. */
    var pips = document.getElementById('set-pips');
    pips.innerHTML = '';
    state.tray.forEach(function (d) {
      var done = state.finished[d.key] || 0;
      var box = document.createElement('div');
      box.className = 'set-pip';
      box.style.setProperty('--accent', accentOf(d.key));
      for (var i = 0; i < R.PIECES_PER_SET; i++) {
        var dot = document.createElement('i');
        if (i < done) dot.className = 'is-set';
        box.appendChild(dot);
      }
      pips.appendChild(box);
    });
  }

  function bumpScore() {
    var box = document.querySelector('.hud-score');
    box.classList.remove('is-bumped');
    void box.offsetWidth;                      // restart the animation
    box.classList.add('is-bumped');
  }

  /* ── turn resolution ───────────────────────────────────────────────────── */
  function runEvents(events) {
    var scored = false;

    events.forEach(function (e) {
      if (e.type === 'merge') {
        Sfx.play('merge');
        if (e.points) { floatPoints(e.to, e.points); scored = true; }
      } else if (e.type === 'score') {
        showCrown(e.index, e.piece);
        Sfx.play('score');
        floatPoints(e.index, e.points);
        scored = true;
      } else if (e.type === 'spawn') {
        Sfx.play('spawn');
      } else if (e.type === 'dissolve') {
        toast(copyOf('toast.safe'));
      } else if (e.type === 'setComplete') {
        pendingPlate = e.key;
      }
    });

    sync();
    drawHud();
    if (scored) bumpScore();

    if (pendingPlate) {
      var key = pendingPlate;
      pendingPlate = null;
      showSetPlate(key);
    }

    if (R.isComplete(state)) return;

    /* The tray must never dead-end in front of a client in the chair. Endless
       has no end state to fall through to, so this is not a courtesy any more --
       it is the only thing standing between a jam and a board that can only be
       left by the idle timer. */
    if (!R.hasLegalMove(state)) {
      setTimeout(function () { runEvents(R.relieve(state)); }, 420);
    }
  }

  function attempt(from, to) {
    if (busy) return false;
    var events = R.apply(state, from, to);
    if (!events.length) return false;
    runEvents(events);
    return true;
  }

  /* ── input: drag, or tap-then-tap ──────────────────────────────────────── */
  var drag = null;

  function indexUnder(x, y) {
    var el = document.elementFromPoint(x, y);
    if (!el) return -1;
    var cell = el.closest('.cell, .piece');
    if (!cell) return -1;
    var index = parseInt(cell.dataset.index, 10);
    return R.isCell(index) ? index : -1;
  }

  function clearSelection() {
    if (selected >= 0) {
      var piece = state.cells[selected];
      if (piece && els[piece.id]) els[piece.id].classList.remove('is-hint');
    }
    selected = -1;
  }

  function select(index) {
    clearSelection();
    var piece = state.cells[index];
    if (!piece) return;
    selected = index;
    els[piece.id].classList.add('is-hint');
  }

  function highlightTarget(index) {
    var cells = tray.querySelectorAll('.cell');
    for (var i = 0; i < cells.length; i++) cells[i].classList.remove('is-target');
    if (index < 0 || drag === null) return;
    if (R.classify(state, drag.from, index)) {
      var c = tray.querySelector('.cell[data-index="' + index + '"]');
      if (c) c.classList.add('is-target');
    }
  }

  tray.addEventListener('pointerdown', function (ev) {
    Sfx.unlock();
    if (busy) return;

    var pieceEl = ev.target.closest('.piece');
    if (!pieceEl) { clearSelection(); return; }

    var from = parseInt(pieceEl.dataset.index, 10);
    if (isNaN(from) || !state.cells[from]) return;

    drag = {
      from: from,
      el: pieceEl,
      x0: ev.clientX,
      y0: ev.clientY,
      moved: false,
      rect: tray.getBoundingClientRect()
    };
    pieceEl.setPointerCapture(ev.pointerId);
  });

  tray.addEventListener('pointermove', function (ev) {
    if (!drag) return;
    var dx = ev.clientX - drag.x0;
    var dy = ev.clientY - drag.y0;

    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 7) return;

    if (!drag.moved) {
      drag.moved = true;
      drag.el.classList.add('is-picked');
      drag.el.style.pointerEvents = 'none';   // so elementFromPoint sees the cell
    }
    drag.el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    highlightTarget(indexUnder(ev.clientX, ev.clientY));
  });

  function endDrag(ev) {
    if (!drag) return;
    var d = drag;
    drag = null;

    /* Resolve the drop target while the dragged piece is still transparent to
       hit-testing. Restoring pointer-events first lets elementFromPoint return
       the dragged piece itself, which classifies as from === to and silently
       does nothing — a merge that just refuses to happen. */
    var to = d.moved ? indexUnder(ev.clientX, ev.clientY) : -1;
    var kind = to >= 0 ? R.classify(state, d.from, to) : null;

    d.el.classList.remove('is-picked');
    d.el.style.pointerEvents = '';

    if (kind) {
      /* The drag worked, so the piece belongs at the target now. Simply clearing
         the drag offset would spring it home and fade it out there, which reads
         as a rejected move at the exact moment it succeeded. Rebase it onto the
         target instead: on a merge it dissolves where the bigger piece appears,
         and on a move it is already in its final place before sync() runs. */
      landOn(d.el, to);
    } else {
      d.el.style.transform = '';               // rejected: spring back home
    }

    highlightTarget(-1);

    if (!d.moved) {
      /* a tap: first selects, second acts */
      if (selected >= 0 && selected !== d.from) {
        if (!attempt(selected, d.from)) select(d.from);
        else clearSelection();
      } else if (selected === d.from) {
        clearSelection();
      } else {
        select(d.from);
      }
      return;
    }

    clearSelection();
    if (to >= 0) attempt(d.from, to);
  }

  tray.addEventListener('pointerup', endDrag);
  tray.addEventListener('pointercancel', endDrag);

  /* ── screens ───────────────────────────────────────────────────────────── */
  function show(id) {
    if (id !== 'screen-collection-plate') { Sfx.stop('celebrate'); Sfx.stop('voice'); }
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) screens[i].classList.remove('is-on');
    document.getElementById(id).classList.add('is-on');
  }

  function start(mode, featuredId) {
    var seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
    var rnd = R.mulberry32(seed);
    var order = mode === 'demo'
      ? Manifest.demoOrder(Collections, featuredId, rnd)
      : Manifest.endlessOrder(Collections, rnd);

    state = R.createState(seed, { sets: order, mode: mode });
    featured = featuredId || null;
    els = {};
    busy = false;
    pendingPlate = null;
    clearSelection();
    buildCells();
    sync();
    drawHud();
    document.body.dataset.mode = mode;
    show('screen-game');
  }

  /* The collections page: every tier of every chain, so the pieces can be looked
     at properly rather than glimpsed on a tray. Built from the manifest so it
     reflects exactly what the game deals. */
  function showCollections() {
    var list = document.getElementById('collection-list');
    list.innerHTML = '';
    Collections.forEach(function (c) {
      var row = document.createElement('section');
      row.className = 'coll-row';
      row.style.setProperty('--accent', c.accent);

      var name = document.createElement('h3');
      name.className = 'coll-name';
      name.textContent = c.name[lang];
      row.appendChild(name);

      (c.sets || []).forEach(function (set) {
        var strip = document.createElement('ol');
        strip.className = 'coll-strip';
        for (var t = 1; t <= (set.tiers || 3); t++) {
          var li = document.createElement('li');
          var img = document.createElement('img');
          img.src = 'assets/pieces/' + c.id + '_' + set.id + '_' + t + '.png';
          img.alt = '';
          li.appendChild(img);
          strip.appendChild(li);
        }
        row.appendChild(strip);
      });
      list.appendChild(row);
    });
    show('screen-collections');
  }

  /* The rung reward. An overlay, not a screen: it dims the tray and is
     tap-skippable, because a client about to be called should not have to wait
     out a reward. */
  function showSetPlate(key) {
    var p = pair(key);
    if (!p) return;
    var plate = (p.set.plate && p.set.plate[lang]) || {};
    document.getElementById('set-plate-eyebrow').textContent = p.collection.name[lang];
    document.getElementById('set-plate-title').textContent = p.set.name[lang];
    document.getElementById('set-plate-ref').textContent = plate.ref || '';
    document.getElementById('set-plate-body').textContent = plate.body || '';
    document.getElementById('set-plate-shot').src =
      'assets/plates/' + p.collection.id + '_' + p.set.id + '.jpg';

    var specs = document.getElementById('set-plate-specs');
    specs.innerHTML = '';
    Object.keys(plate.specs || {}).forEach(function (k) {
      var row = document.createElement('div');
      row.innerHTML = '<dt></dt><dd></dd>';
      row.querySelector('dt').textContent = k;
      row.querySelector('dd').textContent = plate.specs[k];
      specs.appendChild(row);
    });

    var box = document.getElementById('set-plate');
    box.hidden = false;
    box.style.setProperty('--accent', p.collection.accent);
    clearTimeout(plateTimer);
    plateTimer = setTimeout(hideSetPlate, PLATE_MS);

    if (R.isComplete(state)) {
      clearTimeout(plateTimer);
      plateTimer = setTimeout(function () {
        hideSetPlate();
        showCollectionPlate(featured);
      }, PLATE_MS);
    }
  }

  function hideSetPlate() {
    clearTimeout(plateTimer);
    document.getElementById('set-plate').hidden = true;
  }

  document.getElementById('set-plate').addEventListener('click', hideSetPlate);

  /* стоп is a control, not an event: the client is called at an unpredictable
     moment and must be able to leave with their score recorded. */
  function stopRun() {
    if (!state) { show('screen-title'); return; }
    var score = state.score;
    state = null;
    if (Board.qualifies(score) && score > 0) showInitials(score);
    else showBoard();
  }

  function showInitials(score) {
    initials = ['А', 'А', 'А'];
    slot = 0;
    document.getElementById('initials-score').textContent = score;
    pendingScore = score;
    buildPad();
    drawInitials();
    show('screen-initials');
  }

  /* An on-screen alphabet, not a keyboard: three taps and out. */
  function buildPad() {
    var letters = lang === 'ru'
      ? 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЭЮЯ'
      : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var pad = document.getElementById('initials-pad');
    pad.innerHTML = '';
    for (var i = 0; i < letters.length; i++) {
      var b = document.createElement('button');
      b.className = 'pad-key';
      b.textContent = letters[i];
      b.dataset.letter = letters[i];
      pad.appendChild(b);
    }
  }

  function drawInitials() {
    var slots = document.querySelectorAll('.initials-slot');
    for (var i = 0; i < slots.length; i++) {
      slots[i].textContent = initials[i];
      slots[i].classList.toggle('is-on', i === slot);
    }
  }

  function showBoard() {
    var list = document.getElementById('board-list');
    list.innerHTML = '';
    Board.rows().forEach(function (row) {
      var li = document.createElement('li');
      li.innerHTML = '<span class="board-initials"></span><span class="board-score"></span>';
      li.querySelector('.board-initials').textContent = row.initials;
      li.querySelector('.board-score').textContent = row.score;
      list.appendChild(li);
    });
    show('screen-board');
  }

  function showCollectionPlate(collectionId) {
    var c = null;
    Collections.forEach(function (x) { if (x.id === collectionId) c = x; });
    if (!c) c = Collections[0];
    document.getElementById('coll-plate-title').textContent = c.name[lang];
    document.getElementById('coll-plate-body').textContent =
      (c.plate && c.plate[lang] && c.plate[lang].body) || '';
    document.getElementById('coll-plate-hero').src = c.hero;
    document.body.style.setProperty('--accent', c.accent);
    featured = c.id;
    show('screen-collection-plate');
  }

  /* The Auris code points at the collection the client just assembled when they
     arrive from demo, and at the catalogue otherwise. */
  function showContacts(collectionId) {
    var file = 'assets/qr/auris.png';
    if (collectionId) file = 'assets/qr/auris_' + collectionId + '.png';
    document.getElementById('qr-auris').src = file;
    show('screen-contacts');
  }

  function syncMuteGlyph() {
    var btn = document.querySelector('[data-act="mute"]');
    var off = Sfx.isMuted();
    document.getElementById('mute-glyph').textContent = off ? '✕' : '♪';
    btn.classList.toggle('is-off', off);
  }

  /* Every [data-i18n] node gets its text from data/copy.js. Screens built at
     runtime (the collections list, the plates, the board) read Copy[lang]
     themselves through labelOf/copyOf, since they do not exist in the DOM
     for this loop to find until the moment they are shown. */
  function applyCopy(which) {
    lang = which;
    document.documentElement.lang = which;
    var dict = Copy[which] || Copy.ru;
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].dataset.i18n;
      if (dict[key] !== undefined) nodes[i].textContent = dict[key];
    }
    var ariaNodes = document.querySelectorAll('[data-i18n-aria]');
    for (var a = 0; a < ariaNodes.length; a++) {
      var ariaKey = ariaNodes[a].dataset.i18nAria;
      if (dict[ariaKey] !== undefined) ariaNodes[a].setAttribute('aria-label', dict[ariaKey]);
    }
    var altNodes = document.querySelectorAll('[data-i18n-alt]');
    for (var b = 0; b < altNodes.length; b++) {
      var altKey = altNodes[b].dataset.i18nAlt;
      if (dict[altKey] !== undefined) altNodes[b].setAttribute('alt', dict[altKey]);
    }
  }

  document.addEventListener('click', function (ev) {
    var btn = ev.target.closest('[data-act]');
    if (!btn) return;
    Sfx.unlock();

    switch (btn.dataset.act) {
      case 'play-endless':  start('endless'); break;
      case 'play-demo':     start('demo', btn.dataset.collection || Collections[0].id); break;
      case 'collections':   showCollections(); break;
      case 'manual':        document.getElementById('manual').hidden = false; break;
      case 'close-manual':  document.getElementById('manual').hidden = true;  break;
      case 'home':          show('screen-title'); break;
      case 'mute':          Sfx.toggleMute(); syncMuteGlyph(); break;
      case 'pouch':
        if (!busy) runEvents(R.spawn(state));
        break;
      case 'stop':          stopRun(); break;
      case 'board':         showBoard(); break;
      case 'contacts':      showContacts(featured); break;
      case 'demo-again':    start('demo', featured); break;
      case 'initials-ok':
        Board.add(initials.join(''), pendingScore);
        showBoard();
        break;
      case 'lang':
        lang = lang === 'ru' ? 'en' : 'ru';
        localStorage.setItem('auris.lang', lang);
        applyCopy(lang);
        break;
    }
  });

  document.getElementById('manual').addEventListener('click', function (ev) {
    if (ev.target === this) this.hidden = true;
  });

  document.getElementById('initials-pad').addEventListener('click', function (ev) {
    var k = ev.target.closest('.pad-key');
    if (!k) return;
    initials[slot] = k.dataset.letter;
    slot = (slot + 1) % 3;
    drawInitials();
  });

  document.querySelector('.initials-slots').addEventListener('click', function (ev) {
    var s = ev.target.closest('.initials-slot');
    if (!s) return;
    slot = parseInt(s.dataset.slot, 10);
    drawInitials();
  });

  syncMuteGlyph();
  applyCopy(lang);

  /* Deep links, so any screen can be previewed without playing to it:
     #manual, #endless, #demo/*, #collections, #board, #contacts */
  (function (hash) {
    if (hash === '#manual') document.getElementById('manual').hidden = false;
    else if (hash === '#endless') start('endless');
    else if (hash.indexOf('#demo/') === 0) start('demo', hash.slice(6));
    else if (hash === '#collections') showCollections();
    else if (hash === '#board') showBoard();
    else if (hash === '#contacts') showContacts();
  })(location.hash);

  /* exposed so the smoke test can drive a full game headlessly */
  window.Game = {
    start: start,
    attempt: attempt,
    getState: function () { return state; }
  };
})();
