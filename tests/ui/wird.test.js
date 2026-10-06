// الورد اليومي: الإعداد، الجدول، الإنجاز التلقائي من التسميع، الأيام الفائتة، البستان
const { JSDOM } = require("jsdom"); const assert = require("assert");
const html = require("fs").readFileSync(require("path").join(__dirname, "../../dist/index.html"), "utf8");
const errors = []; const sleep = ms => new Promise(r => setTimeout(r, ms));
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://example.org/",
  beforeParse(w) {
    w.addEventListener("error", e => errors.push(e.message)); w.addEventListener("unhandledrejection", e => errors.push("rej " + e.reason));
    w.HTMLElement.prototype.scrollIntoView = () => {}; w.scrollTo = () => {};
    w.HTMLCanvasElement.prototype.getContext = () => ({ clearRect() {}, fillRect() {} });
    const { indexedDB } = require("fake-indexeddb"); w.indexedDB = indexedDB;
  } });
const w = dom.window, $ = s => w.document.querySelector(s), click = el => el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
(async () => {
  await sleep(50);
  assert.ok($("#wirdGo"), "بطاقة الورد في الرئيسية");
  click($("#wirdGo"));
  click($('[data-k="type"][data-v="both"]')); click($("#wzNext"));
  click($('[data-k="nd"][data-v="7"]')); click($("#wzNext"));
  click($('[data-k="hLines"][data-v="15"]')); click($('[data-k="rPages"][data-v="1"]')); click($("#wzNext"));
  click($('[data-k="tPages"][data-v="2"]')); click($("#wzNext"));
  click($('[data-k="from"][data-v="surah"]')); $("#fs").value = "67"; $("#fs").dispatchEvent(new w.Event("change")); click($("#wzNext"));
  assert.ok(w.document.querySelectorAll(".wday").length >= 3, "معاينة الجدول");
  click($("#wzNext"));
  const d = w.eval("WD.day(WD.today())");
  assert.strictEqual(d.plan.h[0], "67:1"); assert.strictEqual(JSON.stringify(d.plan.t), "[562,2]");
  // تسميع مقدار الحفظ بنجاح يسجله تلقائياً
  for (let i = 0; i < 3 && !w.eval("WD.day(WD.today()).done.h"); i++) {
    await w.eval(`(() => { const d = WD.day(WD.today()); const left = d.plan.h.filter(q => !d.ok.includes(q)), pg = V(left[0]).p, on = d.plan.h.filter(q => V(q).p === pg);
      openTasmee(pg); S.T.noLoc = true; S.T.from = on[0]; S.T.to = on.at(-1); return evaluate(on.map(k => M.norm(V(k).t).join(" ")).join(" "), {}); })()`);
  }
  assert.ok(w.eval("WD.day(WD.today()).done.h"), "الحفظ سُجّل من التسميع");
  assert.strictEqual(w.eval("ST.wird.hKey"), w.eval("WD.nextKey(WD.day(WD.today()).plan.h.at(-1))"));
  w.eval("WD.markDone('t', true)");
  assert.ok(w.eval("WD.complete(WD.day(WD.today()))"), "اكتمل الورد"); assert.strictEqual(w.eval("WD.plants().length"), 1);
  // يومان فائتان
  w.eval("ST.wird.start = WD.addDays(WD.today(), -3); ST.wird.log[WD.addDays(WD.today(), -3)] = { plan: { t: [1, 1] }, done: { t: 1 }, ok: [] }");
  assert.strictEqual(w.eval("WD.missed()"), 2);
  w.eval("go('wird')"); assert.ok($(".wmiss"), "بطاقة الأيام الفائتة"); click($('[data-mc="cu"]')); assert.strictEqual(w.eval("ST.wird.catchup.left"), 4);
  w.eval("go('progress')"); assert.ok($(".pstats")); w.eval("go('garden')"); assert.ok($(".garden"));
  console.log("JS errors:", errors.length ? errors : "none");
})().catch(e => { console.log("FAIL", e.message); console.log("JS errors:", errors.concat(e.message)); });
