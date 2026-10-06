"""
جلب موسوعة التفسير من الدرر السنية (dorar.net/tafseer) إلى ملفات JSON لمثاني.
يُستخدم بإذن الجهة المنظمة للتحدي — انظر PERMISSIONS.md. جميع الحقوق لمؤسسة الدرر السنية.

التشغيل (على جهاز متصل بالإنترنت):
    pip install requests beautifulsoup4
    python3 scripts/fetch_dorar.py            # كل السور
    python3 scripts/fetch_dorar.py 78 114     # من سورة إلى سورة
المخرجات: data/dorar/{رقم السورة}.json  — والطلبات مخزنة في .cache/dorar حتى لا تتكرر.
"""
import json, os, re, sys, time
BASE = "https://dorar.net"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT, CACHE = f"{ROOT}/data/dorar", f"{ROOT}/.cache/dorar"
DELAY = 1.5  # ثانية بين الطلبات: لطفاً بخوادم الموقع

DIAC = re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u0640]")
def key_of(title):
    t = DIAC.sub("", title).replace(":", "").replace("ـ", "").strip()
    t = re.sub("[أإآ]", "ا", t).replace("ة", "ه").replace("ى", "ي")
    table = {"اسماء السوره": "names", "فضائل السوره وخصائصها": "fadael", "بيان المكي والمدني": "makki",
             "مقاصد السوره": "maqasid", "موضوعات السوره": "mawdoat", "المعني الاجمالي": "ijmali",
             "غريب الكلمات": "gharib", "مشكل الاعراب": "irab", "تفسير الايات": "tafsir", "تفسير الايه": "tafsir",
             "الفوائد التربويه": "tarbawi", "الفوائد العلميه واللطائف": "ilmi", "بلاغه الايات": "balagha", "بلاغه الايه": "balagha"}
    for k, v in table.items():
        if t.startswith(k): return v
    return "other:" + t

FOOT = re.compile(r"\s?\[\d+\][^\[\]]*?\.\s\.(?=\s|$)")
def clean_text(t):
    """يحذف الحواشي المرقمة [n] ... . . والإحالات المتبقية، ويرتب الأسطر"""
    t = FOOT.sub("", t)
    t = re.sub(r"\s?\[\d+\]", "", t)
    t = re.sub(r"/hadith/sharh/\d+", "", t)
    t = re.sub(r"[ \t]+", " ", t)
    return "\n".join(l.strip() for l in t.splitlines() if l.strip())

def extract_asbab(tafsir):
    """يلتقط فقرات «سبب النزول» من نص تفسير الآيات"""
    out, cur, ayah = [], None, None
    for line in tafsir.splitlines():
        m = re.search(r"\((\d+)\)\.?$", line)
        if m and len(line) < 400: ayah = int(m.group(1))
        n = DIAC.sub("", line)
        if "سبب النزول" in n or "سبب نزول" in n:
            cur = {"ayah": ayah, "text": []}; out.append(cur); continue
        if cur is not None:
            if m or n.startswith("مناسبه") or n.startswith("مناسبة") or n.startswith("القراءات"): cur = None
            else: cur["text"].append(line)
    return [{"ayah": a["ayah"], "text": "\n".join(a["text"])} for a in out if a["text"]]

def get(url):
    import requests
    os.makedirs(CACHE, exist_ok=True)
    f = f"{CACHE}/{re.sub(r'[^0-9a-z]+', '_', url)}.html"
    if os.path.exists(f): return open(f, encoding="utf-8").read()
    time.sleep(DELAY)
    r = requests.get(url, headers={"User-Agent": "Mathani-Hackathon/1.0 (educational, with permission)"}, timeout=40)
    r.raise_for_status()
    open(f, "w", encoding="utf-8").write(r.text)
    return r.text

def sections(html):
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")
    for el in soup.select("sup, [class*=tip], [class*=foot], [class*=hamesh], [class*=tooltip], script, style"): el.decompose()
    for a in soup.select('a[href*="/hadith/sharh/"]'): a.decompose()
    out = {}
    for h in soup.find_all("h5"):
        title = h.get_text(" ", strip=True)
        if not title.endswith(":") and key_of(title).startswith("other:"): continue
        parts = []
        for sib in h.find_next_siblings():
            if sib.name == "h5" or (sib.name in ("a",) and "التالي" in sib.get_text()): break
            if sib.find("h5"): break
            parts.append(sib.get_text("\n", strip=False))
        text = clean_text("\n".join(parts))
        if text: out[key_of(title)] = {"title": title.rstrip(":").strip(), "text": text}
    og = soup.find("meta", property="og:title")
    rng = None
    if og:
        m = re.search(r"الآي[ةات]+\s*\((\d+)\s*(?:-\s*(\d+))?\)", og.get("content", ""))
        if m: rng = [int(m.group(1)), int(m.group(2) or m.group(1))]
    nxt = None
    for a in soup.find_all("a"):
        if a.get_text(strip=True) == "التالي": nxt = a.get("href"); break
    return out, rng, nxt

def fetch_surah(s):
    url = f"{BASE}/tafseer/{s}"
    intro, _, nxt = sections(get(url))
    data = {"s": s, "source": "موسوعة التفسير — مؤسسة الدرر السنية (dorar.net)", "url": url,
            "intro": {k: v for k, v in intro.items() if not k.startswith("other:")}, "groups": []}
    while nxt and re.search(rf"/tafseer/{s}/\d+$", nxt):
        page = nxt if nxt.startswith("http") else BASE + nxt
        secs, rng, nxt = sections(get(page))
        g = {"from": rng[0] if rng else None, "to": rng[1] if rng else None, "url": page,
             "sections": {k: v for k, v in secs.items() if not k.startswith("other:")}}
        if "tafsir" in g["sections"]: g["asbab"] = extract_asbab(g["sections"]["tafsir"]["text"])
        data["groups"].append(g)
        print(f"  {s}: الآيات {rng}", flush=True)
    os.makedirs(OUT, exist_ok=True)
    json.dump(data, open(f"{OUT}/{s}.json", "w", encoding="utf-8"), ensure_ascii=False)
    return data

if __name__ == "__main__":
    a = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    b = int(sys.argv[2]) if len(sys.argv) > 2 else 114
    for s in range(a, b + 1):
        print(f"سورة {s}…", flush=True)
        fetch_surah(s)
    print("تم. شغّل bundle.py لنسخ الملفات إلى dist/dorar")
