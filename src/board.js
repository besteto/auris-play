/* Top ten by score, three-letter initials, cleared whenever the tablet's local
   calendar date changes. Three letters needs no on-screen keyboard, limits what
   one client can spell on a screen the next one will read, and keeps the studio
   from holding personal data it has no reason to hold. */
(function (root) {
  'use strict';

  var KEY = 'auris.board.v1';
  var SIZE = 10;
  var store = null;
  var todayFn = null;

  function attach(storage, fn) {
    store = storage;
    todayFn = fn;
  }

  function today() {
    if (todayFn) return todayFn();
    var d = new Date();
    var m = String(d.getMonth() + 1);
    var day = String(d.getDate());
    return d.getFullYear() + '-' + (m.length < 2 ? '0' + m : m) + '-' +
           (day.length < 2 ? '0' + day : day);
  }

  /* Every read goes through here, so a stale board is never returned even if
     the tablet sat on the board screen across midnight. */
  function read() {
    if (!store) return { date: today(), rows: [] };
    var raw;
    try { raw = store.getItem(KEY); } catch (e) { return { date: today(), rows: [] }; }
    if (!raw) return { date: today(), rows: [] };
    var data;
    try { data = JSON.parse(raw); } catch (e) { return { date: today(), rows: [] }; }
    if (!data || data.date !== today() || !Array.isArray(data.rows)) return { date: today(), rows: [] };
    return data;
  }

  function write(data) {
    if (!store) return;
    try { store.setItem(KEY, JSON.stringify(data)); } catch (e) { /* full or private */ }
  }

  function rows() {
    return read().rows.slice();
  }

  function qualifies(score) {
    var r = rows();
    if (r.length < SIZE) return true;
    return score > r[r.length - 1].score;
  }

  function add(initials, score) {
    var data = read();
    data.rows.push({
      initials: String(initials).slice(0, 3).toUpperCase(),
      score: score
    });
    data.rows.sort(function (a, b) { return b.score - a.score; });
    data.rows = data.rows.slice(0, SIZE);
    data.date = today();
    write(data);
    return data.rows.slice();
  }

  root.Board = {
    SIZE: SIZE,
    attach: attach, today: today,
    rows: rows, qualifies: qualifies, add: add
  };

  try { if (typeof localStorage !== 'undefined') attach(localStorage, null); } catch (e) { /* blocked storage */ }
})(typeof window !== 'undefined' ? window : globalThis);
