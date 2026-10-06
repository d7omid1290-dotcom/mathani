"""
تخطيط مصحف المدينة (١٥ سطراً): أي كلمات كل آية تقع في كل سطر من كل وجه.
المصدر: zonetecde/mushaf-layout (المبني على بيانات Quran.com / QUL).
الناتج: data/layout.json — لكل وجه أسطره: ["h", سورة] | ["b"] | ["t", [[سورة:آية, من, إلى], ...]]
الفهارس تشير إلى كلمات الآية بعد دمج «يا/ها» بما بعدها كما يُكتب في الرسم العثماني (الدالة نفسها في core.js).
"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_data import norm
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = json.load(open(f"{ROOT}/data/mathani-quran.json"))

def tokens(t):
    out, pre = [], ""
    for w in t.split():
        if not norm(w):
            if out: out[-1] += " " + w
            else: pre += w + " "
        else: out.append(pre + w); pre = ""
    return out
def merged(t):
    T, out, i = tokens(t), [], 0
    while i < len(T):
        n = "".join(norm(T[i]))
        if n in ("يا", "ويا", "ها") and i + 1 < len(T):
            nxt = ["".join(norm(x)) for x in T[i+1:i+3]]
            if n == "يا" and nxt[:2] == ["ابن", "ام"]: out.append(" ".join(T[i:i+3])); i += 3; continue
            out.append(T[i] + " " + T[i+1]); i += 2; continue
        if n == "ال" and i + 1 < len(T) and "".join(norm(T[i+1])) == "ياسين": out.append(T[i] + " " + T[i+1]); i += 2; continue
        out.append(T[i]); i += 1
    return out

pages, umax = {}, {}
raw = {}
for p in range(1, 605):
    d = json.load(open(f"{ROOT}/data/layout_raw/page-{p:03d}.json"))
    raw[p] = d
    for l in d["lines"]:
        if l["type"] == "text":
            for w in l["words"]:
                s, a, x = map(int, w["location"].split(":")); k = f"{s}:{a}"; umax[k] = max(umax.get(k, 0), x)
fallback = 0
for p, d in raw.items():
    lines = []
    for l in d["lines"]:
        if l["type"] == "surah-header": lines.append(["h", int(l["surah"])]); continue
        if l["type"] == "basmala": lines.append(["b"]); continue
        segs = {}
        order = []
        for w in l["words"]:
            s, a, x = map(int, w["location"].split(":")); k = f"{s}:{a}"
            if k not in segs: segs[k] = [x, x]; order.append(k)
            else: segs[k][1] = x
        row = []
        for k in order:
            n = len(merged(D["verses"][k]["t"])); u = umax[k]; x0, x1 = segs[k]
            if n == u: i0, i1 = x0 - 1, x1 - 1
            else:  # احتياط نادر: توزيع نسبي
                fallback += 1
                i0 = round((x0 - 1) * n / u); i1 = round(x1 * n / u) - 1
            row.append([k, i0, max(i0, i1)])
        lines.append(["t", row])
    pages[p] = lines
# التحقق: كل كلمة من كل آية تظهر مرة واحدة بالترتيب
missing = 0
seen = {}
for p in range(1, 605):
    for l in pages[p]:
        if l[0] != "t": continue
        for k, i0, i1 in l[1]:
            exp = seen.get(k, 0)
            if i0 != exp: missing += 1
            seen[k] = i1 + 1
for k in D["verses"]:
    if seen.get(k, 0) != len(merged(D["verses"][k]["t"])): missing += 1
json.dump({"source": "zonetecde/mushaf-layout (Quran.com / QUL)", "pages": pages}, open(f"{ROOT}/data/layout.json", "w"), ensure_ascii=False, separators=(",", ":"))
print("pages:", len(pages), "| fallback segments:", fallback, "| continuity errors:", missing, "| size KB:", os.path.getsize(f"{ROOT}/data/layout.json") // 1024)
