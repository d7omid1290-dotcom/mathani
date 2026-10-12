"""
نص المصحف بالرسم العثماني لعرض صفحات المصحف فقط (التسميع والبحث يبقيان على النص الإملائي).
المصدر: نص مجمع الملك فهد «Uthmanic Hafs» الإصدار ١٣ عبر fawazahmed0/quran-api (ara-quranuthmanihaf).
الناتج: data/uthmani.json — لكل آية قائمة كلماتها العثمانية مرتّبة على فهارس كلمات النص الإملائي
(بعد دمج «يا/ها» كما في build_layout.py)، فيبقى تخطيط الأسطر والتظليل والضغط على الكلمة كما هو.
لا يُغيَّر أي حرف: يُحذف فقط فاصل زائد في الملف بين التنوين المفتوح وألفه، وعلامة الاتجاه U+200F.
"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(f"{ROOT}/scripts/build_layout.py", encoding="utf-8").read().split("pages, umax")[0]
g = {"__file__": f"{ROOT}/scripts/build_layout.py"}; exec(src, g)
merged, D, norm = g["merged"], g["D"], g["norm"]

U = {f"{x['chapter']}:{x['verse']}": x["text"] for x in json.load(open(f"{ROOT}/data/ara-quranuthmanihaf.json"))["quran"]}
def clean(t): return re.sub(r"([ࣰ-ࣲ]) (?=[اى])", r"\1", t.replace("‏", "")).strip()
sk = lambda w: "".join(norm(w)).replace("ا", "").replace("و", "").replace("ي", "")  # هيكل تقريبي للمحاذاة

out, uneven = {}, []
for k, v in D["verses"].items():
    S, W = merged(v["t"]), clean(U[k]).split()
    if len(S) == len(W): out[k] = W; continue
    # محاذاة نادرة (٨ آيات مثل «بعدما/بعد ما»، «لوما/لو ما»): تُجمع الكلمات حتى يتطابق الهيكل
    res, i, j = [], 0, 0
    while i < len(S):
        a, b = sk(S[i]), sk(W[j]) if j < len(W) else ""
        if a == b: res.append(W[j]); i += 1; j += 1
        elif len(a) > len(b):  # كلمة إملائية = كلمتان عثمانيتان
            res.append(W[j] + " " + W[j + 1]); i += 1; j += 2
        else:                  # كلمتان إملائيتان = كلمة عثمانية
            res.append(W[j]); res.append(""); i += 2; j += 1
    assert j == len(W) and len(res) == len(S), k
    out[k] = res; uneven.append(k)
json.dump({"source": "مجمع الملك فهد لطباعة المصحف الشريف — Uthmanic Hafs v13 (عبر fawazahmed0/quran-api)", "verses": out},
          open(f"{ROOT}/data/uthmani.json", "w"), ensure_ascii=False, separators=(",", ":"))
print("verses:", len(out), "| aligned:", uneven, "| KB:", os.path.getsize(f"{ROOT}/data/uthmani.json") // 1024)
