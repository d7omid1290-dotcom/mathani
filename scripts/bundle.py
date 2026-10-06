"""يجمع الواجهة والمنطق والبيانات في dist/index.html، وينسخ ملفات موسوعة التفسير إلى dist/dorar للتحميل عند الحاجة"""
import json, os, glob, shutil
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda p: open(f"{root}/{p}", encoding="utf-8").read()
js = lambda p: json.dumps(json.load(open(f"{root}/{p}", encoding="utf-8")), ensure_ascii=False, separators=(",", ":"))
INLINE = [1, 2]  # سور تُضمَّن في الملف نفسه (تعمل حتى بلا اتصال وفي المعاينة)
dorar_files = sorted(glob.glob(f"{root}/data/dorar/*.json"))
inline = {}
for f in dorar_files:
    n = int(os.path.basename(f)[:-5])
    if n in INLINE: inline[n] = json.load(open(f, encoding="utf-8"))
html = rd("web/app2.template.html").replace("/*CORE*/", rd("web/core.js")) \
    .replace("/*DATA*/", js("data/mathani-quran.json")).replace("/*CONTENT*/", js("data/content-juz1.json")) \
    .replace("/*I18N*/", js("data/i18n.json")).replace("/*LAYOUT*/", js("data/layout.json")).replace("/*DORAR*/", json.dumps(inline, ensure_ascii=False, separators=(",", ":")))
import base64
AR_RANGE = "U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0897-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC"
LAT_RANGE = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
def face(fam, file, w, rng):
    b = base64.b64encode(open(f"{root}/web/fonts/{file}", "rb").read()).decode()
    return f"@font-face{{font-family:'{fam}';font-style:normal;font-weight:{w};font-display:swap;src:url(data:font/woff2;base64,{b}) format('woff2');unicode-range:{rng}}}"
FONTS = "".join([face("Amiri Quran", "amiri-quran-arabic-400-normal.woff2", 400, AR_RANGE), face("Amiri Quran", "amiri-quran-latin-400-normal.woff2", 400, LAT_RANGE),
    face("Amiri", "amiri-arabic-700-normal.woff2", 700, AR_RANGE)] +
    [face("Readex Pro", f"readex-pro-arabic-{w}-normal.woff2", w, AR_RANGE) + face("Readex Pro", f"readex-pro-latin-{w}-normal.woff2", w, LAT_RANGE) for w in (400, 600, 700)])
html = html.replace("<style>", "<style>" + FONTS, 1)
os.makedirs(f"{root}/dist/dorar", exist_ok=True)
for f in dorar_files: shutil.copy(f, f"{root}/dist/dorar/")
# التفسير الميسر مترجماً (data/tafsir/{lang}.json) يُحمَّل عند اختيار اللغة
os.makedirs(f"{root}/dist/tafsir", exist_ok=True)
for f in glob.glob(f"{root}/data/tafsir/*.json"): shutil.copy(f, f"{root}/dist/tafsir/")
open(f"{root}/dist/index.html", "w", encoding="utf-8").write(html)
print("dist/index.html", round(len(html.encode()) / 1024), "KB | dorar:", len(dorar_files), "surahs")
