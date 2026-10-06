const assert = require("assert");
const M = require("../web/core.js");
const data = require("../data/mathani-quran.json");
let pass = 0; const t = (name, fn) => { fn(); pass++; console.log("✓", name); };

const V = k => data.verses[k].t;

t("تسميع صحيح كامل", () => {
  const r = M.evaluate(["2:48"], V("2:48"), data);
  assert.strictEqual(r.results[0].status, "ok"); assert.strictEqual(r.accuracy, 1);
});

t("الانتقال إلى المتشابه: قراءة صيغة 2:123 مكان 2:48", () => {
  const r = M.evaluate(["2:48"], V("2:123"), data);
  assert.strictEqual(r.results[0].status, "transition");
  assert.strictEqual(r.results[0].transition.k, "2:123");
});

t("الانتقال إلى المتشابه في وسط مقطع (2:47 ثم 2:48 بصيغة 123 ثم 2:49)", () => {
  const r = M.evaluate(["2:47", "2:48", "2:49"], [V("2:47"), V("2:123"), V("2:49")].join(" "), data);
  assert.deepStrictEqual(r.results.map(x => x.status), ["ok", "transition", "ok"]);
});

t("نص بدون تشكيل (كما يخرج من التعرف الصوتي)", () => {
  const plain = M.norm(V("2:2")).join(" ");
  assert.strictEqual(M.evaluate(["2:2"], plain, data).results[0].status, "ok");
});

t("إسقاط كلمة = خطأ عادي وليس انتقالاً", () => {
  const w = V("2:2").split(" "); w.splice(3, 1);
  const r = M.evaluate(["2:2"], w.join(" "), data).results[0];
  assert.strictEqual(r.status, "error"); assert.ok(r.words.some(x => x.op === "del"));
});

t("حرف العطف خطأ حفظ وليس تسامحاً صوتياً", () => {
  assert.strictEqual(M.wordEq("والذين", "الذين"), false);
  assert.strictEqual(M.wordEq("يومنون", "يؤمنون".replace("ؤ","و")), true);
});

t("التوقف في منتصف الوجه: الآيات التالية 'لم تُسمَّع'", () => {
  const r = M.evaluate(["2:2", "2:3", "2:4"], V("2:2"), data);
  assert.deepStrictEqual(r.results.map(x => x.status), ["ok", "notReached", "notReached"]);
});

t("الاختبار يولّد الأنواع الأربعة ويستخدم المتشابه كمشتِّت", () => {
  const page = data.verses["2:48"].p;
  const q = M.makeQuiz(page, data, 7);
  const types = q.map(x => x.type);
  ["complete", "order", "next"].forEach(tp => assert.ok(types.includes(tp), tp));
  q.filter(x => x.type === "complete").forEach(x => assert.ok(x.options.includes(x.answer)));
});

t("كل الأوجه 1–21 تولّد اختباراً بلا أخطاء", () => {
  for (let p = 1; p <= 21; p++) for (let s = 1; s <= 5; s++) M.makeQuiz(p, data, s);
});

t("الجدولة: بلا أخطاء يتضاعف الفاصل، ومع الخطأ يعود ليوم", () => {
  let r = M.schedule(null, 0, 0); assert.strictEqual(r.interval, 1);
  r = M.schedule(r, 0, 0); assert.strictEqual(r.interval, 2);
  r = M.schedule(r, 3, 0); assert.strictEqual(r.interval, 1);
});

t("فروق المتشابهين تُلوَّن بدقة", () => {
  const d = M.diffWords(V("2:48"), V("2:123"));
  assert.ok(d.a.some(x => !x.same) && d.b.some(x => !x.same));
});
console.log(`\n${pass} اختبار ناجح`);

// ---------- المتابعة التفاعلية ----------
const E = M.norm(V("2:47") + " " + V("2:48"));
const say = t => M.norm(t);
t("متابعة: قراءة صحيحة تكشف الكلمات بالترتيب", () => {
  const H = say(V("2:47")); const f = M.follow(E, H, H.length);
  assert.strictEqual(f.pos, H.length); assert.ok(f.st.slice(0, H.length).every(x => x === 1)); assert.strictEqual(f.lastWrong, -1);
});
t("متابعة: كلمة خاطئة توقف الكشف وتُعلَّم", () => {
  const H = say("يا بني اسراييل اذكروا نعمه"); const f = M.follow(E, H, H.length);
  assert.strictEqual(f.pos, 4); assert.strictEqual(f.lastWrong, 4); assert.ok(f.wrong.get(4) >= 1);
});
t("متابعة: التصحيح الذاتي يُكمل الكشف", () => {
  const H = say("يا بني اسراييل اذكروا نعمه نعمتي التي"); const f = M.follow(E, H, H.length);
  assert.strictEqual(f.pos, 6); assert.strictEqual(f.lastWrong, -1);
});
t("متابعة: إسقاط كلمة يُعلَّم ويستمر الكشف", () => {
  const w = say(V("2:47")); w.splice(2, 1); const f = M.follow(E, w, w.length);
  assert.strictEqual(f.st[2], 2); assert.strictEqual(f.pos, say(V("2:47")).length);
});
t("متابعة: الكلمة المؤقتة لا تُحسب خطأ قبل أن تستقر", () => {
  const H = say("يا بني اسراييل اذكر"); const f = M.follow(E, H, 3);
  assert.strictEqual(f.wrong.size, 0);
});
t("متابعة: التلميح يكشف الكلمة ويتجاوزها", () => {
  const H = say("يا بني اسراييل"); const f = M.follow(E, H.concat(say("نعمتي")), 4, new Set([3]));
  assert.strictEqual(f.st[3], 3); assert.strictEqual(f.st[4], 1); assert.strictEqual(f.pos, 5);
});
console.log(`\n${pass} اختبار ناجح (مع المتابعة)`);
t("الانتقال إلى المتشابه يُكتشف لحظياً عند نقطة الافتراق", () => {
  const ctx = M.norm("يقبل منها"), W = M.norm("عدل ولا");
  assert.strictEqual(M.slipTo("2:48", ctx, W, data), "2:123");
  assert.strictEqual(M.slipTo("2:48", ctx, M.norm("كلام اخر"), data), null);
});
console.log(`${pass} اختبار ناجح`);
