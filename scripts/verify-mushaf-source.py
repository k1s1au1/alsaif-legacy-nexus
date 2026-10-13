"""Audit all official KSU scans without changing or republishing their content."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path
import struct
from urllib.request import urlopen

BASE = "https://quran.ksu.edu.sa/safahat/png_big/"

def check(page):
    url = BASE + str(page) + ".png"
    for attempt in range(2):
        try:
            with urlopen(url, timeout=20) as response:
                if response.status != 200 or response.geturl() != url:
                    raise ValueError("Official source changed or redirected")
                data = response.read()
                if not data.startswith(b"\x89PNG\r\n\x1a\n"):
                    raise ValueError("Not a PNG scan")
                width, height = struct.unpack(">II", data[16:24])
                if width < 500 or height < 700:
                    raise ValueError("Unexpected scan dimensions")
                return {"page": page, "url": url, "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data), "width": width, "height": height}
        except Exception as exc:
            if attempt:
                return {"page": page, "url": url, "error": str(exc)}

results = []
with ThreadPoolExecutor(max_workers=4) as pool:
    for future in as_completed([pool.submit(check, page) for page in range(1, 605)]):
        results.append(future.result())
        if len(results) % 50 == 0:
            print(f"Official scans audited: {len(results)}/604", flush=True)
results.sort(key=lambda result: result["page"])
errors = [result for result in results if "error" in result]
manifest = {"source": BASE, "verifiedAt": datetime.now(timezone.utc).isoformat(), "pageCount": 604, "validated": len(results) - len(errors), "pages": results}
output = Path(__file__).resolve().parents[1] / "docs/mushaf-source-verification.json"
output.write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
print(json.dumps({"validated": len(results) - len(errors), "failed": errors}, ensure_ascii=False), flush=True)
if errors:
    raise SystemExit(1)
