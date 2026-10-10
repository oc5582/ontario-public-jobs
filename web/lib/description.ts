// Rebuild hard-wrapped plain-text job descriptions into headings, field rows,
// paragraphs, and lists. The feed stores plain text (not HTML). The old
// pipeline turned every newline into its own paragraph, so a narrow column
// wrap became one word or one phrase per line. Words are not added, dropped,
// or reordered. Characters that are not letters or numbers (a wrapped period,
// a bullet glyph) may move onto the sentence they belong to.

const STOP = new Set(
  `a an the of to and in for on at by or as is be it we you our with from this that not no
are was were been being has have had do does did but if so than then too very can will just
into over per its their them they your my he she who what when where which while about after
before between also such only own same other more most some any each both few via under above
out up off all nor now am its i me him her how may yes yet plus within without across during
through these those there here than onto upon because until unless whether once`
    .split(/\s+/)
    .filter(Boolean),
);

const KNOWN = new Set(
  `${[...STOP].join(" ")} able about above act add age ago aid aim air all amp and ant any ape apt arc ark arm art ash ask ate awe axe bad bag ban bar bat bay bed bee beg bet bid big bin bit bob bog boo bow box boy bud bug bun bus buy cab can cap car cat cop cow cry cup cut dad dam day den did die dig dim dip dog dot dry due dug dye ear eat egg ego elm end era eve eye fan far fat fax fed fee few fig fin fir fit fix fly foe fog for fox fry fun fur gag gap gas gay gel gem get gig gin god got gum gun gut guy gym had ham has hat hay hen her hey hid him hip his hit hog hop hot how hub hug hum hut ice icy ill ink inn ion its ivy jab jam jar jaw jay jet jig job jog jot joy jug keg key kid kin kit lab lad lag lap law lay led leg let lid lie lip lit log lot low lux mad man map mat may men met mid mix mob mom mop mud mug nab nag nap nay net new nit nod nor not now nun nut oak oar oat odd off oft oil old one opt orb ore our out owe owl own pad pal pan pat paw pay pea peg pen pet pie pin pit ply pod pop pot pro pry pub pug pun pup put rag ram ran rap rat raw ray red ref rib rid rig rim rip rob rod rot row rub rug rum run rut rye sac sad sag sap sat saw say sea set sew she shy sin sip sir sit six ski sky sly sob sod son sot sow soy spa spy sty sub sue sum sun tab tad tag tan tap tar tax tea ten the tie tin tip toe ton too top tow toy try tub tug two urn use van vat vet vow wad wag war was wax way web wed wet who why wig win wit wok won woo wow wry yam yap yaw yea yen yes yet you zap zen zip zoo zone
able also back band bank base bear beat been beer bell belt best bill bird bite blew blow blue boat body bomb bond bone book boom boot born boss both bout bowl bulk bull burn bush busy call came camp card care cart case cash cast cell chat chip city club coal coat code cold come cook cool cope copy cord core cost crew crop crow cube cure cute damn dare dark data date dawn days dead deal dean dear debt deck deep deed deem deer desk dial diet dirt dish disk does done door dose down drag draw drew drop drug drum dual duck dues duet dull dump dust duty each earn ease east easy edge else even ever evil exit face fact fail fair fall farm fast fate fear feed feel feet fell felt file fill film find fine fire firm fish five flag flat flew flip flow folk font food fool foot ford fork form fort four free from fuel full fund fuss gain game gang gave gear gene gift girl give glad glow glue goal goes gold golf gone good grew grey grid grow gulf guru hack hair half hall hand hang hard harm hate have head hear heat held hell help here hero hers hide high hill him hire his hit hold hole home hook hope host hour huge hung hunt hurt idea inch into iron item jack jazz join jump jury just keen keep kept kick kill kind king knee knew knit know lack laid lake lamp land lane last late lava lawn lazy lead leaf leak lean left lend less lied life lift like line link lion list live load loan lock loft long look loop lord lose loss lost loud love luck made mail main make male mall many mark mask mass mate math meal mean meat meet menu mere mess mild mile milk mind mine miss mode mood moon more most move much must name near neck need news next nice nine none noon nose note noun once only onto open oral over pace pack page paid pain pair palm park part pass past path peak pick pile pine pink pipe plan play plot plug plus poem poet pole poll pond pool poor port pose post pour pull pump pure push race rail rain rank rare rate read real rear rely rent rest rice rich ride ring rise risk road rock role roll roof room root rope rose ruin rule rush safe said sake sale salt same sand save saw say seal seat seed seek seem seen self sell send sent ship shop shot show shut sick side sign silk sing sink site size skin skip slam slap slot slow snow soap sofa soft soil sold sole some song soon sort soul soup sour span spin spit spot star stay stem step stir stop such suit sure swam swim tack tail take tale talk tall tank tape task team tell tend tent term test text than that thee them then they thin this thus tide tied tier tile till time tiny told toll tone took tool tops tore torn tour town tree trip true tube tuck tune turn twin type ugly unit unto upon used user uses vain vary vast veil vein verb very vice view vine visa void vote wage wait wake walk wall want ward warm warn wash wave ways weak wear week well went were west what when whom wide wife wild will wind wine wing wink wire wise wish with woke wolf wood word wore work worm worn yard yeah year your zone
about above after again agent agree ahead alarm allow alone along already always among amount angle apart apple apply arena argue arise armed aside asset avoid award aware badly basic basis beach began begin being below bench birth black blank blast bleed blend bless block blood board bonus boost bound brain brand brave bread break brick brief bring broad broke brown build built buyer cabin candy carry catch cause chain chair charm chart chase cheap check chest chief child civil claim class clean clear clerk click cliff climb clock close cloth cloud coach coast could count court cover craft crash cream crime cross crowd crown curve cycle daily dance death debug delay depth diary dirty doubt draft drama drank drawn dream dress dried drink drive drove dying early earth eight elect empty enjoy enter equal error event every exact exist extra faith false fault field fifth fight final first fixed flame flash fleet floor fluid focus force forth found frame fresh front fruit fully funny given glass globe going grace grade grain grand grant grape grass grave great great green group grown guard guess guest guide habit happy heart heavy hotel house human humour humor ideal image index inner input issue joint judge juice known label labor labour large later laugh layer learn least leave legal level light limit lined lines liver living local loose lower lucky lunch magic major march match maybe mayor meant media metal meter metre might minor model money month moral motor mount mouth music needs never night noise north novel nurse occur ocean offer often olive order other ought outer owned owner paint panel paper party peace phase phone photo piano piece pilot pitch place plain plane plant plate point pound power press price prime print prior prize proof proud prove queen quick quiet quite radio raise range rapid reach ready refer relax reply right river rough round route royal rural salad scale scene scope score sense serve setup seven shall shape share sharp sheet shelf shell shift shine shirt shock shook shoot short should shout shown shows sight since sixth skill slash slave sleep slept slide small smart smell smile smoke snake snow solid solve sorry sound south space speak speed spend spent split spoke sport staff stage stand start state steam steel stick still stock stone stood store storm story strip stuck study stuff style sugar suite super swear sweat sweet swept table taste teach teeth thank their theme there these thick thing think third those three threw throw tight times title today token tooth topic total touch tough tower track trade train treat trend trial tribe trick tried truck truly trust truth twice under union unity until upper urban usual value video visit vital voice voter wagon waste watch water wheel where which while white whole whose woman women world worry would write wrote wrong years young youth`
    .split(/\s+/)
    .filter(Boolean),
);

const LABEL_WORDS = new Set(
  `job title id id# number of positions open posting period shift information work location
category division section type duration salary affiliation requisition vacancies vacancy
department reports pay scale group employment weekly hours off days worker language languages
term closing date posted last day apply status details range grade union schedule city remote
hybrid hour week month months required languages worker type closing date mm dd yyyy
position positions info contact email phone fax code level step grade band`
    .split(/\s+/)
    .filter(Boolean),
);

const SECTION_RE =
  /qualificat|responsibilit|accountabilit|requirement|competenc|\bskills\b|\beducation\b|\bexperience\b|\bopportunit|\bprofile\b|\bvision\b|\bmission\b|accommodation|\bequity\b|\bdiversity\b|\binclusion\b|\babout\b|please note|^notes?$|\bwhat you\b|\bhow you\b|\bwhy\b|\byou.?ll\b|\bwe offer\b|\bthe role\b|\byour role\b|\bduties\b|\bwho we\b|\bwho you\b|\bkey\b|\bmajor\b/i;

const SUFFIXES = new Set(["s", "es", "ed", "ing", "ion", "y", "nce", "ic", "ly", "g", "e", "ment", "tion", "ness", "er"]);

const NO_GLUE = new Set(["a", "i", "à", "á", "y"]);

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;|&#160;|&ensp;|&emsp;/gi, " ")
    .replace(/&#64;|&#x40;/gi, "@")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n: string) => {
      const code = Number(n);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => {
      const code = parseInt(n, 16);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : _;
    });
}

function htmlToPlain(raw: string): string {
  if (!/<[a-zA-Z][^>]*>/.test(raw)) return raw;
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article|ul|ol|table|blockquote|pre)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<[^>]+>/g, " ");
}

function prep(raw: string): string {
  return decodeEntities(htmlToPlain(raw))
    .replace(/\u00ad/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\u00a0\u202f\u2007\u2009]/g, " ")
    .replace(/[\u200b\u200c\u200d\u200e\u200f\ufeff\u2060]/g, "");
}

function wordsOf(value: string): string[] {
  return value.trim().split(/\s+/).filter(Boolean);
}

function lastWord(value: string): string {
  const words = wordsOf(value);
  return words.length ? words[words.length - 1] : "";
}

function tokenCore(token: string): string {
  return token.toLowerCase().replace(/^[^a-zà-ÿ0-9]+|[^a-zà-ÿ0-9]+$/gi, "");
}

function isKnownWord(token: string): boolean {
  const core = tokenCore(token);
  if (!core) return false;
  if (KNOWN.has(core) || STOP.has(core)) return true;
  if (core.endsWith("'s") || core.endsWith("’s")) return KNOWN.has(core.slice(0, -2));
  return false;
}

function endsSentence(value: string): boolean {
  const trimmed = value.trim();
  if (!/[.!?…]["')\]]*$/.test(trimmed)) return false;
  if (/\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|etc|e\.g|i\.e|vs|No|Dept|Inc|Ltd|Ave|Rd|Blvd)\.$/.test(trimmed)) return false;
  if (/\b[A-Z]\.$/.test(trimmed)) return false;
  return true;
}

function isAllCaps(value: string): boolean {
  const letters = value.replace(/[^A-Za-z]/g, "");
  return letters.length >= 2 && letters === letters.toUpperCase();
}

function isBullet(value: string): boolean {
  const line = value.trim();
  if (/^[•●▪◦·]\s+\S/.test(line)) return true;
  if (/^[-*–—]\s+\S/.test(line)) return true;
  if (/^\d{1,2}[.)]\s+\S/.test(line)) return true;
  if (/^o\s{2,}\S/.test(line)) return true;
  return false;
}

function isTitleCase(value: string): boolean {
  const words = wordsOf(value).filter((word) => /[A-Za-z]/.test(word));
  if (words.length < 2) return false;
  let significant = 0;
  let capped = 0;
  for (const word of words) {
    const core = word.replace(/[^A-Za-z]/g, "");
    if (!core) continue;
    if (core.length <= 3 && STOP.has(core.toLowerCase())) continue;
    significant += 1;
    if (/^[A-Z]/.test(core)) capped += 1;
  }
  return significant > 0 && capped / significant >= 0.75;
}

function isSectionLabel(value: string): boolean {
  const label = value.replace(/:\s*$/, "").trim();
  if (!label || label.length > 80) return false;
  return SECTION_RE.test(label);
}

function isFieldLabel(value: string): boolean {
  const line = value.trim();
  if (!line.endsWith(":")) return false;
  if (line.length > 120 || line.length < 3) return false;
  if (wordsOf(line).length > 12) return false;
  // A clause with a comma is a sentence lead-in, not "Job Title:".
  if (/,/.test(line.slice(0, -1))) return false;
  if (isSectionLabel(line)) return false;
  return true;
}

function isBareLabel(value: string): boolean {
  const words = wordsOf(value);
  if (words.length !== 1 || value.trim().endsWith(":")) return false;
  const core = tokenCore(words[0]).replace(/[^a-z]/g, "");
  return new Set([
    "department",
    "division",
    "section",
    "shift",
    "location",
    "hours",
    "salary",
    "affiliation",
    "vacancy",
    "vacancies",
    "duration",
    "schedule",
    "compensation",
  ]).has(core);
}

function isLabelWordLine(value: string): boolean {
  const words = wordsOf(value);
  if (!words.length || words.length > 3) return false;
  return words.every((word) => {
    const core = tokenCore(word);
    return STOP.has(core) || LABEL_WORDS.has(core);
  });
}

function isLabelFragment(prev: string, next: string): boolean {
  const label = next.trim();
  if (!label.endsWith(":")) return false;
  // Only a one-word colon line is an unfinished label ("Title:", "Open:").
  // "Posted On:" is already a full label and must not swallow the value before it.
  const name = label.slice(0, -1).trim();
  if (wordsOf(name).length !== 1 || name.length > 24) return false;
  if (endsSentence(prev) || isBullet(prev) || isAllCaps(prev)) return false;
  if (prev.length > 48 || /\d/.test(prev)) return false;
  const words = wordsOf(prev);
  if (!words.length || words.length > 5) return false;
  const modifiers = new Set(["major", "key", "your", "our", "general", "minimum", "preferred", "required", "additional", "other", "core", "basic", "primary"]);
  return words.every((word) => {
    const core = tokenCore(word).replace(/[^a-z]/g, "");
    return STOP.has(core) || LABEL_WORDS.has(core) || modifiers.has(core);
  });
}

function looksLikeHeading(value: string, next?: string): boolean {
  const line = value.trim();
  if (!line || isBullet(line)) return false;
  if (isFieldLabel(line) && next && isShortValue(next) && !isFieldLabel(next)) return false;
  if (/^(qualifications|responsibilities|requirements|duties|overview|benefits|skills|education|competencies|accountabilities|summary)$/i.test(line)) {
    return true;
  }
  if (line.length > 90) return false;
  if (/[,;]$/.test(line)) return false;
  const words = wordsOf(line);
  if (words.length > 14) return false;
  if (/[.!?…]$/.test(line) && !/[?]$/.test(line)) return false;
  if (/[?:]$/.test(line) || /[-–—]$/.test(line)) {
    return words.length <= 12 && line.length <= 80;
  }
  if (isAllCaps(line) && words.length >= 2 && line.length >= 12 && line.length <= 72) return true;
  if (
    isTitleCase(line) &&
    words.length >= 2 &&
    words.length <= 12 &&
    line.length <= 72 &&
    !/[.!,;:]$/.test(line) &&
    next &&
    (next.length > 80 || startsLikeItem(next))
  ) {
    return true;
  }
  if (words.length === 1 && line.length >= 12 && /^[A-Z]/.test(line) && next && next.length > 80) return true;
  if (next && words.length <= 8 && line.length <= 52 && /^[A-Z]/.test(line) && (startsLikeItem(next) || next.length > 80)) {
    return true;
  }
  return false;
}

function startsLikeItem(value?: string): boolean {
  if (!value) return false;
  const line = value.trim();
  if (isBullet(line)) return true;
  if (line.length < 28 || line.length > 320) return false;
  if (!/^[A-Z“"•]/.test(line)) return false;
  if (/[,:;]$/.test(line)) return false;
  return wordsOf(line).length >= 5;
}

function lastToken(value: string): string {
  const match = value.match(/[A-Za-zÀ-ÿ0-9'’]+$/);
  return match ? match[0] : "";
}

function firstToken(value: string): string {
  const match = value.match(/^[A-Za-zÀ-ÿ0-9'’]+/);
  return match ? match[0] : "";
}

function glueMid(prev: string, next: string): string | null {
  if (!prev || !next || isBullet(next)) return null;
  if (/[A-Za-zÀ-ÿ][-‐]$/.test(prev) && /^[A-Za-zÀ-ÿ]/.test(next)) return prev + next;
  const end = prev[prev.length - 1];
  if (!/[A-Za-zÀ-ÿ]/.test(end)) return null;
  if (!/^[a-zà-ÿ]/.test(next)) return null;
  const lt = lastToken(prev);
  const ft = firstToken(next);
  if (!lt || !ft) return null;
  const ll = lt.toLowerCase();
  const fl = ft.toLowerCase();
  if (STOP.has(fl) || STOP.has(ll)) return null;
  if (NO_GLUE.has(ll)) return null;
  const rest = next.slice(ft.length);
  if (SUFFIXES.has(fl) && !isKnownWord(fl) && (rest === "" || /^[\s,.;:)]/.test(rest))) {
    if (!isKnownWord(ll) || fl.length <= 3) return prev + next;
  }
  if (isKnownWord(ll) && isKnownWord(fl)) return null;
  const short = lt.length <= 3 || ft.length <= 3;
  if (!short) return null;
  if (isKnownWord(ll) || isKnownWord(fl)) {
    if (lt.length === 1 && !isKnownWord(fl)) return prev.slice(0, -lt.length) + lt + next;
    if (lt.length === 1 && fl.length <= 3 && !STOP.has(fl)) return prev.slice(0, -lt.length) + lt + next;
    return null;
  }
  return prev.slice(0, -lt.length) + lt + next;
}

function isCompleteSentence(value: string): boolean {
  return endsSentence(value) && wordsOf(value).length >= 8 && value.length >= 40;
}

function shouldJoin(prev: string, next: string, tail: number, wrap: number | null): boolean {
  const nxt = next.trim();
  if (!prev.trim() || !nxt) return false;
  // A new bullet is its own item. Continuations of a bullet do not start with another marker.
  if (isBullet(nxt)) return false;
  if (isFieldLabel(prev)) return false;
  if (isLabelFragment(prev, nxt)) return true;
  if (isFieldLabel(nxt) || (nxt.endsWith(":") && nxt.length <= 120)) return false;
  if (endsSentence(prev) && /^[A-Z“"]/.test(nxt)) return false;
  if (looksLikeHeading(nxt) && (endsSentence(prev) || (looksLikeHeading(prev) && prev.length < 100))) return false;
  if (/^[a-zà-ÿ(“"]/.test(nxt)) return true;
  if (/^[-–—]\$?\d/.test(nxt)) return true;
  if (/[,;/(–—-]$/.test(prev.trim())) return true;
  const tailWord = tokenCore(lastWord(prev));
  if (tailWord && STOP.has(tailWord) && !(looksLikeHeading(prev) && prev.length < 80)) return true;
  if (isBullet(prev) && !/[;.!?…]$/.test(prev.trim())) return true;
  if (
    isAllCaps(prev) &&
    isAllCaps(nxt) &&
    wordsOf(prev).length <= 3 &&
    wordsOf(nxt).length <= 3 &&
    prev.length <= 24 &&
    nxt.length <= 24
  ) {
    return true;
  }
  // A following sentence that already ends is not a wrapped fragment.
  if (isCompleteSentence(nxt)) return false;
  if (
    !endsSentence(prev) &&
    wordsOf(nxt).length === 1 &&
    nxt.length <= 18 &&
    !isLabelWordLine(nxt) &&
    !looksLikeHeading(nxt)
  ) {
    return true;
  }
  // "Project" / "Lead and Support" is one heading split after the first word.
  if (
    !isBareLabel(prev) &&
    wordsOf(prev).length === 1 &&
    /^[A-Z]/.test(prev) &&
    prev.length <= 16 &&
    !endsSentence(prev) &&
    wordsOf(nxt).length <= 4 &&
    nxt.length <= 40 &&
    !isBareLabel(nxt) &&
    !isFieldLabel(nxt) &&
    !isLabelWordLine(nxt) &&
    !isCompleteSentence(nxt)
  ) {
    return true;
  }
  // Keep joining only while we are already inside a long wrapped sentence.
  if (
    tail < 55 &&
    prev.length > 90 &&
    !endsSentence(prev) &&
    !looksLikeHeading(nxt) &&
    !isFieldLabel(nxt) &&
    !isLabelWordLine(nxt) &&
    !isCompleteSentence(nxt)
  ) {
    return true;
  }
  // A line that fills the posting's wrap column and does not end a sentence
  // continues into the next line (Scugog, Taleo, narrow SuccessFactors wraps).
  if (
    wrap &&
    prev.length >= wrap - 12 &&
    prev.length <= wrap + 15 &&
    !endsSentence(prev) &&
    !/[;:]$/.test(prev.trim()) &&
    !looksLikeHeading(nxt) &&
    !looksLikeHeading(prev) &&
    !isCompleteSentence(nxt)
  ) {
    return true;
  }
  return false;
}

function isDecoration(value: string): boolean {
  return /^[-–—~*_.=]{1,}$/.test(value) && !/^[.!?…]$/.test(value);
}

function normalizeLines(raw: string): string[][] {
  const text = prep(raw);
  const groups: string[][] = [];
  let current: string[] = [];
  const pushCurrent = () => {
    if (current.length) groups.push(current);
    current = [];
  };
  for (const piece of text.split("\n")) {
    const line = piece.replace(/[ \t]{2,}/g, " ").trim();
    if (!line) {
      pushCurrent();
      continue;
    }
    if (/^[.!?…]$/.test(line)) {
      if (current.length) current[current.length - 1] = `${current[current.length - 1]}${line}`;
      continue;
    }
    if (isDecoration(line) || line === "•" || line === "-" || line === "*" || line === "·") continue;
    current.push(line);
  }
  pushCurrent();
  return groups;
}

function wrapWidth(lines: string[]): number | null {
  const buckets = new Map<number, number>();
  for (const line of lines) {
    if (line.length < 55 || isBullet(line)) continue;
    const bucket = Math.round(line.length / 10) * 10;
    buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
  }
  let best = 0;
  let width = 0;
  for (const [bucket, count] of buckets) {
    if (count > best) {
      best = count;
      width = bucket;
    }
  }
  if (best >= 4 && width >= 60 && width <= 150) return width;
  return null;
}

function reflowGroup(lines: string[]): string[] {
  const wrap = wrapWidth(lines);
  const prepared: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const upcoming = lines[i + 1];
    if (
      line.length === 1 &&
      /[A-Za-zÀ-ÿ]/.test(line) &&
      !NO_GLUE.has(line.toLowerCase()) &&
      upcoming &&
      /^[a-zà-ÿ]/.test(upcoming)
    ) {
      prepared.push(line + upcoming);
      i += 1;
      continue;
    }
    prepared.push(line);
  }
  const out: { text: string; tail: number }[] = [];
  for (const line of prepared) {
    if (!out.length) {
      out.push({ text: line, tail: line.length });
      continue;
    }
    const prev = out[out.length - 1];
    const glued = glueMid(prev.text, line);
    if (glued) {
      prev.text = glued;
      prev.tail = line.length;
      continue;
    }
    if (shouldJoin(prev.text, line, prev.tail, wrap)) {
      prev.text = `${prev.text} ${line}`.replace(/[ \t]{2,}/g, " ");
      prev.tail = line.length;
      continue;
    }
    out.push({ text: line, tail: line.length });
  }
  return out.map((item) => item.text.replace(/[ \t]{2,}/g, " ").trim()).filter(Boolean);
}

export function reflowDescription(raw: string): string[] {
  if (!raw || !raw.trim()) return [];
  return normalizeLines(raw).flatMap((group) => reflowGroup(group));
}

function isShortValue(value: string): boolean {
  const line = value.trim();
  if (!line || isFieldLabel(line) || isBullet(line)) return false;
  if (line.length > 200) return false;
  const words = wordsOf(line);
  if (words.length > 18) return false;
  if (/[.!?…]$/.test(line) && words.length > 10) return false;
  return true;
}

function parseInlineField(value: string): { label: string; value: string } | null {
  const match = value.trim().match(/^([^:]{2,80}?):\s+(\S[\s\S]*)$/);
  if (!match) return null;
  const label = match[1].trim();
  const body = match[2].trim();
  if (!label || body.length > 160 || wordsOf(body).length > 16) return null;
  if (isSectionLabel(`${label}:`)) return null;
  if (/[.!?…]$/.test(body) && wordsOf(body).length > 10) return null;
  return { label: `${label}:`, value: body };
}

function takeFieldRun(lines: string[], start: number): { rows: { label: string; value: string }[]; consumed: number } {
  const rows: { label: string; value: string }[] = [];
  let index = start;
  while (index < lines.length) {
    const inline = parseInlineField(lines[index]);
    if (inline) {
      rows.push(inline);
      index += 1;
      continue;
    }
    if (
      isBareLabel(lines[index]) &&
      index + 1 < lines.length &&
      isShortValue(lines[index + 1]) &&
      !isBareLabel(lines[index + 1]) &&
      !isFieldLabel(lines[index + 1])
    ) {
      rows.push({ label: lines[index].trim(), value: lines[index + 1].trim() });
      index += 2;
      continue;
    }
    if (isFieldLabel(lines[index]) && index + 1 < lines.length && isShortValue(lines[index + 1]) && !parseInlineField(lines[index + 1])) {
      rows.push({ label: lines[index].trim(), value: lines[index + 1].trim() });
      index += 2;
      continue;
    }
    break;
  }
  if (!rows.length) return { rows: [], consumed: 0 };
  return { rows, consumed: index - start };
}

function isListItem(value: string, next?: string): boolean {
  const line = value.trim();
  if (!line || isFieldLabel(line) || parseInlineField(line) || looksLikeHeading(line, next)) return false;
  if (isBullet(line)) return true;
  if (line.length > 320 || line.length < 20) return false;
  if (/[,:;(\-–—]$/.test(line)) return false;
  const words = wordsOf(line);
  if (words.length < 4) return false;
  const tail = tokenCore(words[words.length - 1]);
  if (STOP.has(tail)) return false;
  if (!/^[A-Z“"•\-\d]/.test(line)) return false;
  return true;
}

function stripMarker(value: string): string {
  return value.replace(/^(?:[•●▪◦·]\s*|[*]\s+|[-–—]\s+)/, "").trim();
}

type Block =
  | { type: "fields"; rows: { label: string; value: string }[] }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "p"; text: string };

function previousEndsColon(blocks: Block[]): boolean {
  const last = blocks[blocks.length - 1];
  return Boolean(last && last.type === "p" && last.text.trim().endsWith(":"));
}

function previousIsHeading(blocks: Block[]): boolean {
  const last = blocks[blocks.length - 1];
  return Boolean(last && last.type === "h3");
}

function structure(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let index = 0;
  while (index < lines.length) {
    const run = takeFieldRun(lines, index);
    if (run.rows.length >= 2 || (run.rows.length === 1 && run.consumed > 0 && isFieldLabel(lines[index]))) {
      blocks.push({ type: "fields", rows: run.rows });
      index += run.consumed;
      continue;
    }
    const line = lines[index];
    if (looksLikeHeading(line, lines[index + 1])) {
      blocks.push({ type: "h3", text: line });
      index += 1;
      continue;
    }
    let count = 0;
    while (index + count < lines.length && isListItem(lines[index + count], lines[index + count + 1])) count += 1;
    const bulletRun = isBullet(line);
    if ((bulletRun && count >= 1) || ((previousIsHeading(blocks) || previousEndsColon(blocks)) && count >= 2)) {
      const items: string[] = [];
      for (let step = 0; step < count; step += 1) items.push(stripMarker(lines[index + step]));
      blocks.push({ type: "ul", items });
      index += count;
      continue;
    }
    blocks.push({ type: "p", text: line });
    index += 1;
  }
  const merged: Block[] = [];
  for (const block of blocks) {
    const prev = merged[merged.length - 1];
    if (block.type === "fields" && prev && prev.type === "fields") {
      prev.rows.push(...block.rows);
      continue;
    }
    merged.push(block);
  }
  return merged;
}

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function formatDescription(raw: string): string {
  const lines = reflowDescription(raw);
  if (!lines.length) return "";
  const blocks = structure(lines);
  return blocks
    .map((block) => {
      if (block.type === "h3") return `<h3>${esc(block.text)}</h3>`;
      if (block.type === "p") return `<p>${esc(block.text)}</p>`;
      if (block.type === "ul") return `<ul>${block.items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`;
      const rows = block.rows
        .map((row) => `<div class="meta-row"><dt>${esc(row.label)}</dt><dd>${esc(row.value)}</dd></div>`)
        .join("");
      return `<dl class="desc-fields">${rows}</dl>`;
    })
    .join("");
}

function decodeEscaped(value: string): string {
  return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

export function descriptionParagraphs(raw: string): string[] {
  const html = formatDescription(raw);
  if (!html) return [];
  const parts: string[] = [];
  const re = /<(h3|p|li|dt|dd)>([\s\S]*?)<\/\1>/g;
  let pending = "";
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const text = decodeEscaped(match[2]);
    if (match[1] === "dt") {
      pending = text;
      continue;
    }
    if (match[1] === "dd") {
      parts.push(pending ? `${pending} ${text}` : text);
      pending = "";
      continue;
    }
    parts.push(text);
  }
  return parts;
}

export function signature(value: string): string {
  return prep(value)
    .toLowerCase()
    .replace(/[^0-9a-zà-ÿ]+/gi, "");
}
