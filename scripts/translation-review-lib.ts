type Lang = 'en' | 'pl' | 'uk';
type Messages = Record<Lang, Record<string, string>>;
export interface Suspicious {
  key: string;
  lang: 'pl' | 'uk';
  reason: 'same-as-en' | 'latin-in-uk' | 'cyrillic-in-pl';
}

// Keys whose value is legitimately identical to English in every language. Each
// entry's reason:
//  - q.answer.*        answer tokens (letters/numbers/symbols, not prose)
//  - unit.label.deg    the "°" degree symbol
//  - unit.label.km     "km" is the same international SI abbreviation in PL
//  - unit.label.min    "min" is the same international abbreviation in PL
//  - unit.km           "{n} km" — same reason as unit.label.km
//  - q.time.duration.m "{m} min" — same reason as unit.label.min
//  - cross.northPole   "N" is the same one-letter compass code used on PL maps
//                       (spec §6.2 keeps EN/PL notation letters identical)
//  - cross.southPole   "S" — same reason as cross.northPole
//  - place.*           real-world place names shared across languages (Oslo,
//                       Lima, Sydney, Nairobi, Berlin, Delhi, ...)
//  - label.australia   place-like label, same reasoning as place.*
//  - classQuiz.seconds  short unit word that happens to match across langs
//  - spoken.*          spoken-form templates built only from params/units
//  - q.further.option  answer-option token, not prose
//  - map.projection.equal-earth  "Equal Earth" is the projection's proper name,
//                       used unchanged in all three languages
const SAME_OK = [
  /^q\.answer\./,
  /^unit\.label\.deg$/,
  /^unit\.label\.km$/,
  /^unit\.label\.min$/,
  /^unit\.km$/,
  /^q\.time\.duration\.m$/,
  /^cross\.northPole$/,
  /^cross\.southPole$/,
  /^place\./,
  /^label\.australia$/,
  /^classQuiz\.seconds$/,
  /^spoken\./,
  /^q\.further\.option$/,
  /^map\.projection\.equal-earth$/,
];

const onlySymbols = (s: string) => s.replace(/\{\w+\}/g, '').replace(/[\s\d°′:.,()\-–—·←→#%]/g, '') === '';

// Latin words allowed to appear in Ukrainian text, with reasons:
//  - UTC, Esc, Shift, Ctrl  keyboard-key / technical abbreviations conventionally
//                       kept in Latin script even in Cyrillic UI text
//  - N, S, E, W, A, B, C, D, P, L  single-letter option/direction codes
//  - Google             brand name ("Google Карти", "Google Картах")
//  - GPS, WGS           technical acronyms (WGS 84 datum)
//  - Maple, Bear        the "Maple Bear" school brand (not an i18n string —
//                       these come from data — but also appears in prose keys)
//  - Mercator, Equal, Earth  map-projection proper names (Mercator, Equal Earth)
// "km" is deliberately NOT here: Ukrainian uses "км", not the Latin abbreviation.
const LATIN_OK = /\b(UTC|N|S|E|W|A|B|C|D|P|L|Esc|Shift|Ctrl|Google|GPS|WGS|Maple|Bear|Mercator|Equal|Earth)\b/g;

export function findSuspicious(m: Messages): Suspicious[] {
  const out: Suspicious[] = [];
  for (const key of Object.keys(m.en)) {
    const en = m.en[key]!;
    for (const lang of ['pl', 'uk'] as const) {
      const v = m[lang][key];
      if (v === undefined) continue;
      if (v === en && !onlySymbols(v) && !SAME_OK.some((r) => r.test(key))) out.push({ key, lang, reason: 'same-as-en' });
      else if (lang === 'uk' && /[A-Za-z]{3,}/.test(v.replace(/\{\w+\}/g, '').replace(LATIN_OK, '')))
        out.push({ key, lang, reason: 'latin-in-uk' });
      else if (lang === 'pl' && /[Ѐ-ӿ]/.test(v)) out.push({ key, lang, reason: 'cyrillic-in-pl' });
    }
  }
  return out;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const LANG_NAMES: Record<Lang, string> = { en: 'English', pl: 'Polski', uk: 'Українська' };

export function buildReviewHtml(m: Messages): string {
  const flagged = new Set(findSuspicious(m).map((s) => `${s.key}|${s.lang}`));
  const groups = new Map<string, string[]>();
  for (const key of Object.keys(m.en).sort()) {
    const parts = key.split('.');
    const group = parts[0] === 'topic' ? parts.slice(0, 2).join('.') : parts[0]!;
    groups.set(group, [...(groups.get(group) ?? []), key]);
  }
  const totalKeys = Object.keys(m.en).length;
  const totalFlagged = new Set([...flagged].map((f) => f.split('|')[0])).size;

  const rows = [...groups.entries()]
    .map(([group, keys]) => {
      const groupFlagCount = keys.filter((k) => flagged.has(`${k}|pl`) || flagged.has(`${k}|uk`)).length;
      return `
    <tbody><tr class="group"><th colspan="4">${esc(group)} <span class="count">(${keys.length}${groupFlagCount ? `, ${groupFlagCount} flagged` : ''})</span></th></tr>
    ${keys
      .map((k) => {
        const isFlagged = flagged.has(`${k}|pl`) || flagged.has(`${k}|uk`);
        return `<tr data-key="${esc(k)}"${isFlagged ? ' data-flagged="1"' : ''}><td class="key">${esc(k)}</td>${(['en', 'pl', 'uk'] as const)
          .map(
            (l) =>
              `<td lang="${l}" class="cell${flagged.has(`${k}|${l}`) ? ' flag' : ''}">${esc(m[l][k] ?? '— MISSING —')}${
                flagged.has(`${k}|${l}`) ? ' <strong>check</strong>' : ''
              }</td>`,
          )
          .join('')}</tr>`;
      })
      .join('')}
    </tbody>`;
    })
    .join('');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Translation review — Coordinates</title>
<style>
  body{font:15px/1.45 system-ui,sans-serif;margin:1rem;color:#1b2430;background:#fff}
  table{border-collapse:collapse;width:100%}
  td,th{border:1px solid #c9d1db;padding:.35rem .5rem;vertical-align:top;text-align:left}
  td{user-select:text;-webkit-user-select:text}
  .key{font:12px ui-monospace,monospace;color:#4a5666;white-space:nowrap}
  .group th{background:#eef2f6;font-size:1.05rem;position:sticky;top:0}
  .group .count{font-weight:normal;font-size:.85rem;color:#5a6472}
  .flag{background:#fff3c4}
  .toolbar{display:flex;flex-wrap:wrap;gap:.75rem 1.5rem;align-items:center;margin:.5rem 0 1rem}
  input[type=search]{font:inherit;padding:.4rem;width:min(24rem,100%)}
  label.toggle{display:inline-flex;gap:.4rem;align-items:center;font-size:.95rem;white-space:nowrap}
  #stats{font-size:.9rem;color:#3a4452}
  #stats strong{color:#1b2430}
  @media print {
    .toolbar{display:none}
    tr[hidden]{display:none !important}
    .group th{position:static}
  }
</style></head>
<body>
<h1>Translation review</h1>
<p>Every text in the lesson page, side by side, grouped by area. Yellow cells marked <strong>check</strong> may be untranslated or use the wrong alphabet.</p>
<div class="toolbar">
  <input id="f" type="search" aria-label="Filter by key or text" placeholder="Filter by key or text…">
  <label class="toggle"><input type="checkbox" id="onlyFlagged"> Show only flagged</label>
  <label class="toggle"><input type="checkbox" id="hideEn"> Hide English</label>
  <span id="stats"><strong>${totalKeys}</strong> keys, <strong>${totalFlagged}</strong> flagged</span>
</div>
<table id="t"><thead><tr><th>Key</th><th>${LANG_NAMES.en}</th><th>${LANG_NAMES.pl}</th><th>${LANG_NAMES.uk}</th></tr></thead>${rows}</table>
<script>
(function () {
  var filter = document.getElementById('f');
  var onlyFlagged = document.getElementById('onlyFlagged');
  var hideEn = document.getElementById('hideEn');
  var rows = Array.prototype.slice.call(document.querySelectorAll('tr[data-key]'));
  var groups = Array.prototype.slice.call(document.querySelectorAll('tr.group'));
  var enCol = 1; // th/td index within a row (0 = key)

  function apply() {
    var q = filter.value.toLowerCase();
    var onlyF = onlyFlagged.checked;
    rows.forEach(function (r) {
      var matchesText = !q || r.textContent.toLowerCase().indexOf(q) !== -1;
      var matchesFlag = !onlyF || r.hasAttribute('data-flagged');
      r.hidden = !(matchesText && matchesFlag);
    });
    groups.forEach(function (g) {
      var body = g.parentElement;
      var anyVisible = Array.prototype.slice.call(body.querySelectorAll('tr[data-key]')).some(function (r) {
        return !r.hidden;
      });
      g.hidden = !anyVisible;
    });
    document.querySelectorAll('td, th').forEach(function (cell) {
      // no-op placeholder to keep structure stable when toggling columns
    });
    document.getElementById('t').classList.toggle('hide-en', hideEn.checked);
  }

  filter.addEventListener('input', apply);
  onlyFlagged.addEventListener('change', apply);
  hideEn.addEventListener('change', function () {
    var table = document.getElementById('t');
    var idx = enCol; // English is the 2nd column (index 1) in each row
    document.querySelectorAll('tr').forEach(function (r) {
      var cells = r.children;
      if (r.classList.contains('group')) return;
      if (cells[idx]) cells[idx].hidden = hideEn.checked;
    });
    var headCells = document.querySelectorAll('thead th');
    if (headCells[idx]) headCells[idx].hidden = hideEn.checked;
  });
})();
</script>
</body></html>`;
}
