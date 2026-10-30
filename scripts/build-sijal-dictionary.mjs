// Run with the ar directory of LibreOffice/dictionaries at the commit in
// src/data/sijal-dictionary-NOTICE.txt: node scripts/build-sijal-dictionary.mjs /path/to/ar
// This creates the complete, lazily loaded data source; it is not a build dependency.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const source = process.argv[2];
if (!source) throw new Error("Pass the source directory containing ar.dic and ar.aff.");
const aliases = [],
  rules = [];
const nounFlags = new Set(["HA", "HB", "HC", "HD", "EA", "EB", "EC", "ED", "CA", "CB", "CC", "CD"]);
for (const line of readFileSync(path.join(source, "ar.aff"), "utf8").split(/\r?\n/)) {
  const fields = line.trim().split(/\s+/);
  if (fields[0] === "AF" && fields[1] && !/^\d+$/.test(fields[1])) aliases.push(fields[1]);
  if (fields.length >= 5 && fields[0] === "SFX" && nounFlags.has(fields[1])) {
    rules.push({
      flag: fields[1],
      strip: fields[2] === "0" ? "" : fields[2],
      append: fields[3].split("/")[0],
      continuation: fields[3].split("/")[1],
      condition: new RegExp(`${fields[4]}$`, "u"),
    });
  }
}
function normalized(value) {
  return value
    .normalize("NFKC")
    .replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/[ئىي]/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ء/g, "");
}
const keys = new Set();
const add = (word) => {
  const key = normalized(word);
  if (/^[\u0621-\u064a\u0671]{2,18}$/u.test(key)) keys.add(key);
};
for (const line of readFileSync(path.join(source, "ar.dic"), "utf8").split(/\r?\n/).slice(1)) {
  const fields = line.split("/"),
    word = fields[0].trim();
  if (!/^[\u0621-\u064a\u0671]{2,18}$/u.test(normalized(word))) continue;
  add(word);
  const alias = fields[1]?.split(/\s+/)[0] ?? "";
  const flags = /^\d+$/.test(alias) ? (aliases[Number(alias) - 1] ?? "") : alias;
  const allowed = new Set(flags.match(/../gu) ?? []);
  if (allowed.has("AA")) add(`ال${word}`);
  for (const rule of rules) {
    if (
      !allowed.has(rule.flag) ||
      !rule.condition.test(word) ||
      (rule.strip && !word.endsWith(rule.strip))
    )
      continue;
    const expanded = (rule.strip ? word.slice(0, -rule.strip.length) : word) + rule.append;
    add(expanded);
    const continuation = aliases[Number(rule.continuation) - 1] ?? "";
    if (/mr|mn|mj/.test(continuation)) add(`ال${expanded}`);
  }
}
const header = `// Arabic spelling keys derived from LibreOffice Hunspell-ar (Ayaspell).
// Copyright 2006–2008 Mohamed Kebdani; original tri-license: GPL 2.0/LGPL 2.1/MPL 1.1.
// This modified data is distributed under MPL 1.1 or later; see sijal-dictionary-NOTICE.txt.
// Modifications: remove flags/marks, apply permitted noun plurals/duals and definite articles,
// fold spelling variants, filter 2–18 letters, deduplicate and sort. Full modified source follows.
export const SIJAL_DICTIONARY_KEYS = \``;
const target = new URL("../src/data/sijal-arabic-words.ts", import.meta.url);
writeFileSync(target, header + [...keys].sort().join("\n") + "`;\n");
console.log(`${keys.size} Arabic spelling keys written.`);
