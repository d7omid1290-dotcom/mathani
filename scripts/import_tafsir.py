"""يحوّل ملف ترجمة التفسير (CSV أو JSON أو Excel) إلى data/tafsir/{lang}.json بالشكل {"سورة:آية": "النص"}
الاستخدام: python3 scripts/import_tafsir.py en path/to/file.csv"""
import json, sys, os, csv, re
lang, src = sys.argv[1], sys.argv[2]
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = {}
def add(s, a, t):
    try: s, a = int(float(s)), int(float(a))
    except (TypeError, ValueError): return
    t = re.sub(r"\s+", " ", str(t or "")).strip()
    if 1 <= s <= 114 and t: out[f"{s}:{a}"] = t
low = src.lower()
if low.endswith(".json"):
    j = json.load(open(src, encoding="utf-8"))
    if isinstance(j, dict) and "result" in j: j = j["result"]          # QuranEnc API
    if isinstance(j, dict):
        for k, v in j.items():
            if ":" in k: s, a = k.split(":"); add(s, a, v)
    else:
        for r in j: add(r.get("sura") or r.get("surah"), r.get("aya") or r.get("ayah"), r.get("translation") or r.get("text"))
elif low.endswith((".xlsx", ".xls")):
    import openpyxl
    ws = openpyxl.load_workbook(src, read_only=True).active
    for r in ws.iter_rows(values_only=True):
        if r and len(r) >= 3: add(r[0], r[1], r[2])
else:
    for r in csv.reader(open(src, encoding="utf-8-sig")):
        if len(r) >= 3: add(r[0], r[1], r[2])
os.makedirs(f"{root}/data/tafsir", exist_ok=True)
json.dump(out, open(f"{root}/data/tafsir/{lang}.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(lang, len(out), "آية")
