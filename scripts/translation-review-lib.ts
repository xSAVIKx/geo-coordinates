type Lang = 'en' | 'pl' | 'uk';
type Messages = Record<Lang, Record<string, string>>;
export interface Suspicious {
  key: string;
  lang: 'pl' | 'uk';
  reason: 'same-as-en' | 'latin-in-uk' | 'cyrillic-in-pl';
}
export interface InfoNote {
  key: string;
  lang: 'pl' | 'uk';
}

// Keys whose value is legitimately identical to English in every language. Each
// entry's reason:
//  - q.answer.*        answer tokens (letters/numbers/symbols, not prose)
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
//  - map.projection.equal-earth  "Equal Earth" is the projection's proper name;
//                       PL/UK have no established exonym, so the controller
//                       ruled it stays untranslated in all three languages
// (`unit.label.deg` and `q.further.option` were pruned: the former is already
// "°" only, caught by onlySymbols(); the latter's UK/PL text never actually
// matches English, so the entry never did anything.)
const SAME_OK = [
  /^q\.answer\./,
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
  /^map\.projection\.equal-earth$/,
];

// Place-name keys are excluded from "info: foreign term" notes — a place name
// identical across languages isn't a foreign term, it's just a name.
const PLACE_NAME_KEY = /^place\.|^label\.australia$/;

const onlySymbols = (s: string) => s.replace(/\{\w+\}/g, '').replace(/[\s\d°′:.,()\-–—·←→#%]/g, '') === '';

// Latin words allowed to appear in Ukrainian text, with reasons. Checked as
// whole standalone tokens (any run of 1+ Latin letters), not by substring, so
// this stays minimal and every entry is actually used somewhere in the real
// message files:
//  - A, B               point labels used in q.nameLine/relative/diff/dist
//                       prompts ("Точка A ({point})", "точками A і B"). C/D
//                       (and E/F) exist only as hardcoded option letters in
//                       ChoiceInput.svelte/ClassQuiz.svelte/quiz/values.ts —
//                       they are never interpolated into an i18n string, so
//                       they never need to be on this list.
//  - UTC, Esc, Shift, Ctrl  keyboard-key / technical abbreviations
//                       conventionally kept in Latin script even in Cyrillic
//                       UI text (classQuiz.keys, map.*.hint,
//                       topic.5/8 step bodies)
//  - Google              brand name ("Google Карти", "Google Картах")
//  - GPS, WGS            technical acronyms (WGS 84 datum)
//  - Maple, Bear         the "Maple Bear" school brand (school data itself is
//                       not i18n text, but the brand name also appears in
//                       prose keys like footer.schools, map.schools.hint)
//  - Mercator, Equal, Earth  map-projection proper names ("Equal Earth" is
//                       kept untranslated per controller ruling; "Mercator"
//                       is listed for when the Latin spelling is used instead
//                       of the transliterated "Меркатор")
//  - GitHub              the GitHub brand name (footer.github link text)
//  - PDF                 the file format named on the print buttons ("Зберегти як PDF")
//  - P, L               the presenter-mode keys in presenter.hint ("P: режим
//                       презентації · L: указка"). They name physical keys and
//                       are printed in Latin on Ukrainian keyboards too (the
//                       shortcut also answers to those keys on a Cyrillic
//                       layout, see src/app/presenterKeys.ts).
// "N", "S", "E", "W" were pruned: no real message contains them as a
// standalone Latin token, and Ukrainian coordinate text must never use Latin
// compass letters (it uses «пн. ш.» / «пд. ш.» / «сх. д.» / «зх. д.»). "km" is
// deliberately NOT here either: Ukrainian uses "км", not the Latin spelling.
const LATIN_OK = new Set(['A', 'B', 'P', 'L', 'UTC', 'Esc', 'Shift', 'Ctrl', 'Google', 'GPS', 'WGS', 'Maple', 'Bear', 'Mercator', 'Equal', 'Earth', 'GitHub', 'PDF']);

// Latin words allowed only in the keys that need them (not anywhere in Ukrainian text):
//  - CC, BY in cheat.foot  the licence name "CC BY 4.0" on the printed cheat sheet and worksheet
const KEY_LATIN_OK: readonly (readonly [RegExp, ReadonlySet<string>])[] = [
  [/^cheat\.foot$/, new Set(['CC', 'BY'])],
];
const latinOk = (key: string, token: string) => LATIN_OK.has(token) || KEY_LATIN_OK.some(([re, words]) => re.test(key) && words.has(token));

const LATIN_TOKEN = /[A-Za-z]+/g;

/** Every maximal run of Latin letters in `s`, params stripped first. */
function latinTokens(s: string): string[] {
  return s.replace(/\{\w+\}/g, '').match(LATIN_TOKEN) ?? [];
}

const hasDisallowedLatin = (key: string, s: string) => latinTokens(s).some((t) => !latinOk(key, t));
const hasAllowedLatin = (key: string, s: string) => latinTokens(s).some((t) => latinOk(key, t));

export function findSuspicious(m: Messages): Suspicious[] {
  const out: Suspicious[] = [];
  for (const key of Object.keys(m.en)) {
    const en = m.en[key]!;
    for (const lang of ['pl', 'uk'] as const) {
      const v = m[lang][key];
      if (v === undefined) continue;
      if (v === en && !onlySymbols(v) && !SAME_OK.some((r) => r.test(key))) out.push({ key, lang, reason: 'same-as-en' });
      else if (lang === 'uk' && hasDisallowedLatin(key, v)) out.push({ key, lang, reason: 'latin-in-uk' });
      else if (lang === 'pl' && /[Ѐ-ӿ]/.test(v)) out.push({ key, lang, reason: 'cyrillic-in-pl' });
    }
  }
  return out;
}

/**
 * Cells that are fine (not suspicious) but worth showing to the owner because
 * they deliberately keep a foreign/Latin term: either the value contains an
 * allow-listed Latin word (Google, GPS, Maple Bear, Ctrl/Shift, ...), or the
 * whole value is identical to English via the SAME_OK allow-list (Equal
 * Earth, the "km"/"min" abbreviations, the N/S pole labels, ...) — excluding
 * pure-symbol values and place names, neither of which is a "foreign term".
 */
export function findInfoNotes(m: Messages): InfoNote[] {
  const flagged = new Set(findSuspicious(m).map((s) => `${s.key}|${s.lang}`));
  const out: InfoNote[] = [];
  for (const key of Object.keys(m.en)) {
    const en = m.en[key]!;
    for (const lang of ['pl', 'uk'] as const) {
      const v = m[lang][key];
      if (v === undefined || flagged.has(`${key}|${lang}`)) continue;
      const sameAsEnAllowed = v === en && !onlySymbols(v) && SAME_OK.some((r) => r.test(key)) && !PLACE_NAME_KEY.test(key);
      if (sameAsEnAllowed || hasAllowedLatin(key, v)) out.push({ key, lang });
    }
  }
  return out;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const LANG_NAMES: Record<Lang, string> = { en: 'English', pl: 'Polski', uk: 'Українська' };

export function buildReviewHtml(m: Messages): string {
  const flagged = new Set(findSuspicious(m).map((s) => `${s.key}|${s.lang}`));
  const info = new Set(findInfoNotes(m).map((s) => `${s.key}|${s.lang}`));
  const groups = new Map<string, string[]>();
  for (const key of Object.keys(m.en).sort()) {
    const parts = key.split('.');
    const group = parts[0] === 'topic' ? parts.slice(0, 2).join('.') : parts[0]!;
    groups.set(group, [...(groups.get(group) ?? []), key]);
  }
  const totalKeys = Object.keys(m.en).length;
  const totalFlagged = new Set([...flagged].map((f) => f.split('|')[0])).size;
  const totalInfo = new Set([...info].map((f) => f.split('|')[0])).size;

  const rows = [...groups.entries()]
    .map(([group, keys]) => {
      const groupFlagCount = keys.filter((k) => flagged.has(`${k}|pl`) || flagged.has(`${k}|uk`)).length;
      const groupInfoCount = keys.filter((k) => info.has(`${k}|pl`) || info.has(`${k}|uk`)).length;
      const groupCounts = `${keys.length}${groupFlagCount ? `, ${groupFlagCount} flagged` : ''}${groupInfoCount ? `, ${groupInfoCount} info` : ''}`;
      return `
    <tbody><tr class="group"><th colspan="4">${esc(group)} <span class="count">(${groupCounts})</span></th></tr>
    ${keys
      .map((k) => {
        const isFlagged = flagged.has(`${k}|pl`) || flagged.has(`${k}|uk`);
        const isInfo = info.has(`${k}|pl`) || info.has(`${k}|uk`);
        return `<tr data-key="${esc(k)}"${isFlagged ? ' data-flagged="1"' : ''}${isInfo ? ' data-info="1"' : ''}><td class="key">${esc(k)}</td>${(
          ['en', 'pl', 'uk'] as const
        )
          .map((l) => {
            const isCellFlagged = flagged.has(`${k}|${l}`);
            const isCellInfo = info.has(`${k}|${l}`);
            const cls = isCellFlagged ? ' flag' : isCellInfo ? ' note' : '';
            const marker = isCellFlagged ? ' <strong>check</strong>' : isCellInfo ? ' <em>info</em>' : '';
            return `<td lang="${l}" class="cell${cls}">${esc(m[l][k] ?? '— MISSING —')}${marker}</td>`;
          })
          .join('')}</tr>`;
      })
      .join('')}
    </tbody>`;
    })
    .join('');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
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
  .flag strong{color:#7a5b00}
  .note{background:#eaf1fb}
  .note em{color:#3a5a8a;font-style:normal;font-size:.85em}
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
<p>Every text in the lesson page, side by side, grouped by area. Yellow cells marked <strong>check</strong> may be untranslated or use the wrong alphabet. Blue cells marked <em>info</em> deliberately keep a foreign term (a brand name, a technical abbreviation, or a proper name with no translation) — nothing to fix, just worth knowing about.</p>
<div class="toolbar">
  <input id="f" type="search" aria-label="Filter by key or text" placeholder="Filter by key or text…">
  <label class="toggle"><input type="checkbox" id="onlyFlagged"> Show only flagged</label>
  <label class="toggle"><input type="checkbox" id="includeInfo"> Include info notes</label>
  <label class="toggle"><input type="checkbox" id="hideEn"> Hide English</label>
  <span id="stats"><strong>${totalKeys}</strong> keys, <strong>${totalFlagged}</strong> flagged, <strong>${totalInfo}</strong> info notes</span>
</div>
<table id="t"><thead><tr><th>Key</th><th>${LANG_NAMES.en}</th><th>${LANG_NAMES.pl}</th><th>${LANG_NAMES.uk}</th></tr></thead>${rows}</table>
<script>
(function () {
  var filter = document.getElementById('f');
  var onlyFlagged = document.getElementById('onlyFlagged');
  var includeInfo = document.getElementById('includeInfo');
  var hideEn = document.getElementById('hideEn');
  var rows = Array.prototype.slice.call(document.querySelectorAll('tr[data-key]'));
  var groups = Array.prototype.slice.call(document.querySelectorAll('tr.group'));
  var enCol = 1; // th/td index within a row (0 = key)

  function apply() {
    var q = filter.value.toLowerCase();
    var onlyF = onlyFlagged.checked;
    var incInfo = includeInfo.checked;
    rows.forEach(function (r) {
      var matchesText = !q || r.textContent.toLowerCase().indexOf(q) !== -1;
      var matchesFlag = !onlyF || r.hasAttribute('data-flagged') || (incInfo && r.hasAttribute('data-info'));
      r.hidden = !(matchesText && matchesFlag);
    });
    groups.forEach(function (g) {
      var body = g.parentElement;
      var anyVisible = Array.prototype.slice.call(body.querySelectorAll('tr[data-key]')).some(function (r) {
        return !r.hidden;
      });
      g.hidden = !anyVisible;
    });
    document.getElementById('t').classList.toggle('hide-en', hideEn.checked);
  }

  filter.addEventListener('input', apply);
  onlyFlagged.addEventListener('change', apply);
  includeInfo.addEventListener('change', apply);
  hideEn.addEventListener('change', function () {
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
