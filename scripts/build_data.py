"""
مثاني — بناء بيانات الأوجه من مصادر مفتوحة موثقة (Tanzil عبر quran-api)
- نص المصحف: quran-simple (Tanzil)
- التفسير الميسر: مجمع الملك فهد لطباعة المصحف الشريف (Tanzil)
- غريب الكلمات: السراج في بيان غريب القرآن (Tanzil)
- المتشابهات: تُحسب آلياً بمقارنة نصية على القرآن كاملاً (بدون نماذج لغوية)
"""
import json, re, sys
from difflib import SequenceMatcher
from collections import defaultdict

D = sys.argv[1] if len(sys.argv) > 1 and __name__ == "__main__" else "data"
PAGES = range(1, 605)         # المصحف كاملاً: 604 أوجه

def load(name): return json.load(open(f"{D}/{name}.json"))["quran"]
BASMALA = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ"
DIAC = re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]")
def norm(t):
    t = DIAC.sub("", t)
    t = re.sub("[إأآٱ]", "ا", t).replace("ى", "ي").replace("ة", "ه").replace("ؤ", "و").replace("ئ", "ي")
    return re.sub(r"[^\u0621-\u064A\s]", "", t).split()


def main():
    global verses
    simple, muyassar, siraj = load("ara-quransimple"), load("ara-kingfahadquranc"), load("ara-sirajtafseer")
    info = json.load(open(f"{D}/info.json"))["chapters"]

    surah_name = {c["chapter"]: re.sub(r"^سورة\s*", "", " ".join(DIAC.sub("", c["arabicname"]).split()))
                  for c in info}
    meta = {(c["chapter"], v["verse"]): v for c in info for v in c["verses"]}

    verses = []
    for s, m, g in zip(simple, muyassar, siraj):
        c, v, text = s["chapter"], s["verse"], s["text"].strip()
        if v == 1 and c != 1:
            w = text.split()
            if [norm(x)[0] if norm(x) else "" for x in w[:4]] == ["بسم", "الله", "الرحمن", "الرحيم"]:
                text = " ".join(w[4:])
        gharib = [{"w": a.strip(), "m": b.strip()} for a, b in re.findall(r"\(([^():]+):\s*([^()]+)\)", g["text"])]
        verses.append({"k": f"{c}:{v}", "s": c, "a": v, "t": text, "n": norm(text),
                       "tf": m["text"].strip(), "gh": gharib, "p": meta[(c, v)]["page"]})
    by_key = {x["k"]: x for x in verses}

    # ---------- فهرس المتشابهات ----------
    def grams(ws, n=3): return {" ".join(ws[i:i+n]) for i in range(len(ws)-n+1)}
    idx = defaultdict(set)
    for i, x in enumerate(verses):
        for g in grams(x["n"]): idx[g].add(i)

    def longest_run(a, b):
        m = SequenceMatcher(None, a, b, autojunk=False).find_longest_match(0, len(a), 0, len(b))
        return m.size

    target = list(range(len(verses)))
    mut = {}
    for i in target:
        a = verses[i]["n"]
        if len(a) < 4: continue
        cand = defaultdict(int)
        for g in grams(a):
            for j in idx[g]:
                if j != i: cand[j] += 1
        res = []
        for j, shared in cand.items():
            if shared < 2: continue
            b = verses[j]["n"]
            ratio = SequenceMatcher(None, a, b, autojunk=False).ratio()
            run = longest_run(a, b)
            if (ratio >= 0.6 and run >= 4) or run >= 6:
                res.append((round(ratio, 3), run, verses[j]["k"]))
        res.sort(reverse=True)
        if res:
            mut[verses[i]["k"]] = [{"k": k, "r": r, "run": run} for r, run, k in res[:4]]

    # ---------- إخراج بيانات الأوجه ----------
    juz = {}
    for c in info:
        for v in c["verses"]: juz.setdefault(v["juz"], set()).add(v["page"])
    # أسماء السور وتصنيفها المكي والمدني كما في الموسوعة القرآنية quranpedia.net/mushaf/1
    QP_NAMES = ['الفاتحة', 'البقرة', 'آل عمران', 'النساء', 'المائدة', 'الأنعام', 'الأعراف', 'الأنفال', 'التوبة', 'يونس', 'هود', 'يوسف', 'الرعد', 'إبراهيم', 'الحجر', 'النحل', 'الإسراء', 'الكهف', 'مريم', 'طه', 'الأنبياء', 'الحج', 'المؤمنون', 'النور', 'الفرقان', 'الشعراء', 'النمل', 'القصص', 'العنكبوت', 'الروم', 'لقمان', 'السجدة', 'الأحزاب', 'سبأ', 'فاطر', 'يس', 'الصافات', 'ص', 'الزمر', 'غافر', 'فصلت', 'الشورى', 'الزخرف', 'الدخان', 'الجاثية', 'الأحقاف', 'محمد', 'الفتح', 'الحجرات', 'ق', 'الذاريات', 'الطور', 'النجم', 'القمر', 'الرحمن', 'الواقعة', 'الحديد', 'المجادلة', 'الحشر', 'الممتحنة', 'الصف', 'الجمعة', 'المنافقون', 'التغابن', 'الطلاق', 'التحريم', 'الملك', 'القلم', 'الحاقة', 'المعارج', 'نوح', 'الجن', 'المزمل', 'المدثر', 'القيامة', 'الإنسان', 'المرسلات', 'النبأ', 'النازعات', 'عبس', 'التكوير', 'الإنفطار', 'المطففين', 'الإنشقاق', 'البروج', 'الطارق', 'الأعلى', 'الغاشية', 'الفجر', 'البلد', 'الشمس', 'الليل', 'الضحى', 'الشرح', 'التين', 'العلق', 'القدر', 'البينة', 'الزلزلة', 'العاديات', 'القارعة', 'التكاثر', 'العصر', 'الهمزة', 'الفيل', 'قريش', 'الماعون', 'الكوثر', 'الكافرون', 'النصر', 'المسد', 'الإخلاص', 'الفلق', 'الناس']
    QP_MADANI = [2, 3, 4, 5, 8, 9, 13, 22, 24, 33, 47, 48, 49, 55, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 76, 98, 99, 110]
    rev = {n: ("مدنية" if n in QP_MADANI else "مكية") for n in range(1, 115)}
    surah_name.update({i + 1: n for i, n in enumerate(QP_NAMES)})
    out = {
        "sources": {
            "text": "نص المصحف برواية حفص عن عاصم: Tanzil (quran-simple)، موافق لطبعة مجمع الملك فهد",
            "tafsir": "التفسير الميسر — مجمع الملك فهد لطباعة المصحف الشريف",
            "gharib": "السراج في بيان غريب القرآن — د. محمد الخضيري",
            "mutashabihat": "حساب نصي آلي على القرآن كاملاً (يُراجع بشرياً)"
        },
        "surahs": surah_name,
        "surahInfo": {c["chapter"]: {"n": len(c["verses"]), "rev": rev[c["chapter"]], "page": c["verses"][0]["page"]} for c in info},
        "juz": {j: [min(ps), max(ps)] for j, ps in sorted(juz.items())},
        "pages": {p: [x["k"] for x in verses if x["p"] == p] for p in PAGES},
        "verses": {x["k"]: {kk: x[kk] for kk in ("s", "a", "t", "tf", "gh", "p")} for x in verses},
        "mutashabihat": mut,
    }
    json.dump(out, open(f"{D}/mathani-quran.json", "w"), ensure_ascii=False)
    print("verses:", len(out["verses"]), "with mutashabih:", len(mut))
    for k in ["2:48", "2:123", "2:47", "2:40", "1:2"]: print(k, mut.get(k))


if __name__ == "__main__":
    main()
