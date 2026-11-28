"""
خادم فحص الحركات والنطق لتطبيق مثاني.

يستقبل تسجيل تلاوة ونطاق الآيات المقروءة، ويشغّل نموذج «المعلّم» (obadx/muaalem-model-v3_2)
فيكتب ما نُطق حرفاً حرفاً بحركاته (الرسم الصوتي للقرآن)، ثم يقارنه بالرسم الصوتي الصحيح
للآيات (حفص) ويعيد الأخطاء منسوبة إلى كلماتها.

لا يولّد أي تفسير، ولا يعدّل نص المصحف: النص المرجعي من مكتبة quran-transcript كما هو.
تنبيه رخصة «المعلّم» (QML 1.0) يعرضه التطبيق قبل أول استعمال.
"""
import difflib
import io
import os
import subprocess
import tempfile
from functools import lru_cache

import numpy as np
import torch
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from quran_transcript import Aya, MoshafAttributes, quran_phonetizer
from quran_transcript import alphabet as alph

MODEL = os.environ.get("MUAALEM_MODEL", "obadx/muaalem-model-v3_2")
MAX_SEC = float(os.environ.get("MAX_SEC", "240"))  # أطول تسجيل مقبول
CHUNK_SEC = 18.0  # النموذج يُشغَّل على مقاطع قصيرة تُقطع عند السكتات
SR = 16000

PH = alph.phonetics
HARAKAT = set(PH.fatha + PH.dama + PH.kasra + PH.fatha_momala + PH.dama_mokhtalasa)
MADD = set(PH.alif + PH.waw_madd + PH.yaa_madd + PH.alif_momala)
H_NAME = {PH.fatha: "فتحة", PH.dama: "ضمة", PH.kasra: "كسرة", PH.fatha_momala: "إمالة", PH.dama_mokhtalasa: "اختلاس"}

MOSHAF = MoshafAttributes(rewaya="hafs", madd_monfasel_len=4, madd_mottasel_len=4,
                          madd_mottasel_waqf=4, madd_aared_len=4)

app = FastAPI(title="Mathani Muaalem")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["POST", "GET"], allow_headers=["*"])

_model = None


def model():
    global _model
    if _model is None:
        from quran_muaalem import Muaalem
        torch.set_num_threads(max(1, os.cpu_count() or 1))
        _model = Muaalem(model_name_or_path=MODEL, device="cpu", dtype=torch.float32)
    return _model


def load_audio(raw: bytes) -> np.ndarray:
    """أي صيغة يسجّلها المتصفح (webm/mp4/wav) ← 16kHz أحادي عبر ffmpeg."""
    with tempfile.NamedTemporaryFile(suffix=".bin") as f:
        f.write(raw); f.flush()
        p = subprocess.run(["ffmpeg", "-nostdin", "-loglevel", "error", "-i", f.name, "-ac", "1", "-ar", str(SR),
                            "-f", "f32le", "-"], capture_output=True, timeout=120)
    if p.returncode != 0 or not p.stdout:
        raise HTTPException(400, "تعذّرت قراءة التسجيل")
    return np.frombuffer(p.stdout, dtype=np.float32).copy()


def chunks(w: np.ndarray):
    """تقطيع عند السكتات إلى مقاطع لا تتجاوز CHUNK_SEC."""
    import librosa
    iv = librosa.effects.split(w, top_db=35, frame_length=1024, hop_length=256)
    if not len(iv):
        return []
    out, s, e = [], iv[0][0], iv[0][1]
    for a, b in iv[1:]:
        if (b - s) / SR > CHUNK_SEC:
            out.append((s, e)); s = a
        e = b
    out.append((s, e))
    res = []
    for s, e in out:  # مقطع طويل بلا سكتة يُقطع قطعاً
        step = int(CHUNK_SEC * SR)
        for x in range(s, e, step):
            seg = w[max(0, x - 1600): min(len(w), min(e, x + step) + 1600)]
            if len(seg) > SR * 0.3:
                res.append(seg)
    return res


@lru_cache(maxsize=4096)
def ayah_words(s: int, a: int):
    return tuple(Aya(s, a).get().uthmani.split(" "))


def ph(text: str) -> str:
    return quran_phonetizer(text, MOSHAF, remove_spaces=True).phonemes


def reference(keys):
    """الرسم الصوتي للنطاق: كل آية مستقلة (وقف على رأس الآية، وهو الأغلب في التسميع)،
    ومواضع كل كلمة فيه بالتقريب، وصور كل كلمة الجائزة عند الوقف عليها أو الابتداء بها."""
    words, bounds, alts, full = [], [], [], ""
    for (s, a) in keys:
        W = ayah_words(s, a)
        aph = ph(" ".join(W))
        prev = 0
        for k in range(len(W)):
            if k == len(W) - 1:
                end = len(aph)
            else:  # طول صوتنة الكلمات 1..k+1 موصولة بما بعدها = صوتنة البادئة حتى k+2 ناقصاً صوتنة الكلمة k+2 منفردة
                end = len(ph(" ".join(W[:k + 2]))) - len(ph(W[k + 1]))
                end = max(prev, min(len(aph), end))
            stop = ph(" ".join(W[:k + 1]))[prev:]  # الصورة عند الوقف على الكلمة
            alone = ph(W[k])  # الصورة عند الابتداء بها والوقف عليها
            words.append((s, a, k, W[k])); bounds.append((len(full) + prev, len(full) + end))
            alts.append({stop, alone, aph[prev:end]})
            prev = end
        full += aph
    return words, full, bounds, alts


def squash(x: str) -> str:
    """توحيد أطوال المدود (٢، ٤، ٦ حركات كلها جائزة بحسب المد) لأجل المقارنة."""
    out = []
    for c in x:
        if out and c in MADD | {PH.waw, PH.yaa} and out[-1] == c and len(out) > 1 and out[-2] == c:
            continue
        out.append(c)
    return "".join(out)


def classify(ref: str, out: str):
    rs, os_ = set(ref), set(out)
    diff = (rs ^ os_) | ({c for c in rs if ref.count(c) != out.count(c)})
    if not diff:
        return None
    if diff <= MADD:
        rm = sum(ref.count(c) for c in MADD); om = sum(out.count(c) for c in MADD)
        if min(rm, om) >= 2:  # اختلاف طول المد الفرعي (٢/٤/٦) لا يُعدّ خطأ: له أوجه جائزة
            return None
        return "madd"
    if diff <= HARAKAT:
        return "haraka"
    if diff <= HARAKAT | MADD:
        return "haraka"
    return "letter"


def message(kind, ref, out):
    if kind == "haraka":
        r = [H_NAME[c] for c in ref if c in H_NAME]; o = [H_NAME[c] for c in out if c in H_NAME]
        if len(r) == len(o):
            pairs = [(a, b) for a, b in zip(r, o) if a != b]
            if pairs:
                return "نطقتَ " + "، ".join(f"{b} مكان {a}" for a, b in pairs)
        if len(o) < len(r):
            return "سكّنتَ حرفاً متحركاً"
        if len(o) > len(r):
            return "حرّكتَ حرفاً ساكناً"
        return "خطأ في الحركات"
    if kind == "madd":
        return "زدتَ مدّاً في غير موضعه" if sum(out.count(c) for c in MADD) > sum(ref.count(c) for c in MADD) else "أسقطتَ المدّ"
    strip = lambda x: "".join(c for c in x if c not in HARAKAT and c not in MADD)
    rl, ol = strip(ref), strip(out)
    if PH.hamza in rl and PH.hamza not in ol:
        return "أسقطتَ الهمزة"
    if len(rl) == len(ol):
        pairs = [(a, b) for a, b in zip(rl, ol) if a != b]
        if pairs:
            return "نطقتَ " + "، ".join(f"«{b}» مكان «{a}»" for a, b in pairs)
    if len(ol) > len(rl):
        return "زدتَ حرفاً"
    if len(ol) < len(rl):
        return "أسقطتَ حرفاً"
    return "خطأ في النطق"


def compare(words, ref_ph: str, bounds, alts, out_ph: str):
    sm = difflib.SequenceMatcher(None, ref_ph, out_ph, autojunk=False)
    ops = sm.get_opcodes()
    owner = np.zeros(len(ref_ph) + 1, dtype=int)
    for wi, (a, b) in enumerate(bounds):
        owner[a:b] = wi
    owner[len(ref_ph)] = len(words) - 1
    heard = [""] * len(words)
    bad = [[] for _ in words]
    first_eq = next((o for o in ops if o[0] == "equal"), None)
    last_eq = next((o for o in reversed(ops) if o[0] == "equal"), None)
    for tag, i1, i2, j1, j2 in ops:
        if tag == "equal":
            for k in range(i1, i2):
                heard[owner[k]] += out_ph[j1 + k - i1]
            continue
        # ما قبل أول تطابق وبعد آخره: استعاذة أو بسملة أو توقف قبل نهاية النطاق، لا يُحسب
        if first_eq and (i2 <= first_eq[1] and tag == "insert"):
            continue
        if last_eq and i1 >= last_eq[2] and tag in ("delete", "insert"):
            continue
        wi = owner[min(i1, len(ref_ph) - 1)] if tag != "insert" else owner[max(0, i1 - 1)] if i1 > 0 else 0
        heard[wi] += out_ph[j1:j2]
        # سياق المد المجاور (المتطابق) يُضاف للطرفين حتى يُعرف طول المد كاملاً
        l = i1
        while l > 0 and ref_ph[l - 1] in MADD:
            l -= 1
        r = i2
        while r < len(ref_ph) and ref_ph[r] in MADD:
            r += 1
        ctx_l, ctx_r = ref_ph[l:i1], ref_ph[i2:r]
        bad[wi].append((ctx_l + ref_ph[i1:i2] + ctx_r, ctx_l + out_ph[j1:j2] + ctx_r))
    # الكلمات التي لم تُقرأ في نهاية النطاق
    reached = len(words)
    if last_eq:
        reached = owner[max(0, last_eq[2] - 1)] + 1
    res = []
    for wi, (s, a, i, w) in enumerate(words):
        if wi >= reached:
            break
        rb = ref_ph[bounds[wi][0]:bounds[wi][1]]
        errs = []
        if squash(heard[wi]) in {squash(v) for v in alts[wi]}:
            bad[wi] = []  # نطق صحيح بصورة الوقف أو الابتداء
        for r, o in bad[wi]:
            # نوسّع الموضع بحرفه حتى يُعرف أي حركة على أي حرف
            kind = classify(r, o)
            if kind:
                errs.append({"kind": kind, "msg": message(kind, r, o)})
        item = {"s": s, "a": a, "i": i, "w": w, "ref": rb, "heard": heard[wi]}
        if errs:
            item["errors"] = errs
        res.append(item)
    return res


@app.get("/")
def health():
    return {"ok": True, "model": MODEL}


@app.post("/check")
async def check(audio: UploadFile = File(...), s: int = Form(0), a: int = Form(0), b: int = Form(0),
                keys: str = Form("")):
    """النطاق: إما s وa وb، أو keys بصيغة «2:286,3:1» (قد تمتد عبر سورتين)."""
    try:
        K = [tuple(map(int, x.split(":"))) for x in keys.split(",") if x.strip()] if keys else \
            [(s, x) for x in range(a, (b or a) + 1)]
    except ValueError:
        raise HTTPException(400, "نطاق الآيات غير صحيح")
    if not K or len(K) > 40 or any(not (1 <= x <= 114) or y < 1 for x, y in K):
        raise HTTPException(400, "نطاق الآيات غير صحيح")
    keys = K
    try:
        for k in keys:
            ayah_words(*k)
    except Exception:
        raise HTTPException(400, "الآية غير موجودة")
    w = load_audio(await audio.read())
    if len(w) / SR > MAX_SEC:
        raise HTTPException(413, "التسجيل أطول من المسموح")
    words, ref_ph, bounds, alts = reference(keys)
    ref = quran_phonetizer(" ".join(ayah_words(*keys[0])), MOSHAF, remove_spaces=True)  # لفك الصفات فقط
    segs = chunks(w)
    if not segs:
        return {"words": [], "heard": "", "ref": ref_ph, "empty": True}
    m = model()
    out = ""
    for seg in segs:  # المرجع يُمرَّر للنموذج لفك الصفات فقط؛ الحروف والحركات تُفك بحرية
        out += m([seg], [ref], sampling_rate=SR)[0].phonemes.text
    res = compare(words, ref_ph, bounds, alts, out)
    return {"words": res, "heard": out, "ref": ref_ph,
            "errors": sum(1 for x in res if x.get("errors"))}
