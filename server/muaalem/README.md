---
title: Mathani Muaalem
emoji: 📖
colorFrom: green
colorTo: yellow
sdk: docker
app_port: 7860
pinned: false
license: other
---

# خادم فحص الحركات والنطق — مثاني

يستقبل تسجيل تلاوة ونطاق الآيات، ويشغّل نموذج «المعلّم» (obadx/muaalem-model-v3_2) الذي يكتب
ما نُطق حرفاً حرفاً بحركاته (الرسم الصوتي للقرآن)، ثم يقارنه بالرسم الصوتي الصحيح لرواية حفص
ويعيد الأخطاء منسوبة إلى كلماتها: حركة، أو مدّ، أو حرف.

## الواجهة
- `GET /` فحص الحالة.
- `POST /check` (multipart): `audio` ملف التسجيل (webm/mp4/wav/mp3)، `s` السورة، `a` أول آية، `b` آخر آية (اختياري).
  يعيد `words`: لكل كلمة مقروءة `{s, a, i, w, ref, heard, errors?}`، و`i` فهرس الكلمة في الرسم العثماني.

## ما لا يُعدّ خطأ
- الوقف على رأس كل آية، والوقف أو الابتداء داخل الآية (صورة الكلمة الموقوف عليها أو المبتدأ بها).
- اختلاف طول المد الفرعي (٢ أو ٤ أو ٦ حركات).

## تنبيه (شرط رخصة المعلّم QML 1.0)
هذا المعلّم القرآني نموذج ذكاء اصطناعي قد يخطئ؛ فهو للإعانة فقط ولا يُعتمد عليه، وليس بديلاً عن معلّمٍ مُتقِنٍ مُجاز؛ لأنّ القرآن لا يُؤخذ إلا بالمشافهة.

## المصادر والتراخيص
- النموذج: [obadx/muaalem-model-v3_2](https://huggingface.co/obadx/muaalem-model-v3_2) (MIT على صفحة النموذج).
- مكتبة [quran-muaalem](https://github.com/obadx/quran-muaalem): رخصة QML 1.0 (Apache 2.0 مع شروط: التنبيه أعلاه، وعدم الإعلانات، والالتزام بأحكام الشريعة).
- مكتبة [quran-transcript](https://github.com/obadx/quran-transcript) (MIT) للرسم العثماني والرسم الصوتي.
- الورقة: Automatic Pronunciation Error Detection and Correction of the Holy Quran's Learners Using Deep Learning ([arXiv:2509.00094](https://arxiv.org/abs/2509.00094)).
