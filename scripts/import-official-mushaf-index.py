"""Import navigation facts, never verse text, from KSU's official Ayat project."""
import ast
import hashlib
import json
from pathlib import Path
import re
from urllib.request import urlopen

SOURCE = "https://quran.ksu.edu.sa/js/quran-data.js"
EXPECTED_SHA256 = "6e93fd099e2897638f7ccd18756663b66b10c2334eaaf760b3f1c99ac0806804"
with urlopen(SOURCE, timeout=30) as response:
    if response.geturl() != SOURCE:
        raise ValueError("Official source redirected; review it before importing")
    original = response.read()
if hashlib.sha256(original).hexdigest() != EXPECTED_SHA256:
    raise ValueError("Official index changed; review it before updating the pinned checksum")
source = original.decode("utf-8")

def table(name):
    match = re.search(r"QuranData\." + name + r"\s*=\s*(\[.*?\]);", source, re.S)
    if not match:
        raise ValueError("Missing official index table: " + name)
    # Literal parsing only: never execute downloaded JavaScript.
    return ast.literal_eval(re.sub(r"//[^\n]*", "", match.group(1)))

sura = table("Sura")
page = table("Page")
juz = table("Juz")
assert len(sura) == 116 and len(page) == 606 and len(juz) == 32
assert sum(row[1] for row in sura[1:115]) == 6236

def offset(s, a):
    return sura[s][0] + a - 1

starts = [offset(*row) for row in page[1:605]]
assert starts == sorted(starts) and starts[0] == 0

def page_for(s, a):
    value = offset(s, a)
    return max(index + 1 for index, start in enumerate(starts) if start <= value)

index = {
    "source": SOURCE,
    "sourceSha256": EXPECTED_SHA256,
    "sourceNotice": "Copyright (C) 2008 tanzil.info, Licenced Under GPL; navigation metadata distributed by King Saud University's official Ayat project. No Quran verse text is included here.",
    "surahs": [{"id": i, "name": row[4], "ayahs": row[1], "start": row[0], "page": page_for(i, 1)} for i, row in enumerate(sura[1:115], 1)],
    "pages": [{"page": i, "surah": row[0], "ayah": row[1], "start": offset(*row)} for i, row in enumerate(page[1:605], 1)],
    "juz": [{"id": i, "page": page_for(*row)} for i, row in enumerate(juz[1:31], 1)],
}
out = Path(__file__).resolve().parents[1] / "src/data/mushaf-index.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
print(f"Verified official KSU index: {len(index['surahs'])} surahs, {len(index['pages'])} pages, {len(index['juz'])} juz; SHA-256 matched")
