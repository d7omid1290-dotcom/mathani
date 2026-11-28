// فحص الحركات والنطق: الزر يظهر بعد تقييم تسجيل صوتي، والتنبيه قبل أول فحص، وعرض الأخطاء على كلماتها (بخادم مُحاكى)
const { JSDOM } = require("jsdom");
const html = require("fs").readFileSync(require("path").join(__dirname, "../../dist/index.html"), "utf8");
const errors = []; const sleep = ms => new Promise(r => setTimeout(r, ms));
const sent = [];
const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://example.org/", beforeParse(w) {
  w.addEventListener("error", e => errors.push(e.message)); w.addEventListener("unhandledrejection", e => errors.push("rej " + e.reason));
  w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = () => {}; w.HTMLCanvasElement.prototype.getContext = () => ({ clearRect() {}, fillRect() {} });
  w.fetch = async (url, opt) => {
    if (!/\/check$/.test(url)) return { ok: false, json: async () => ({}) };
    sent.push({ url, keys: opt.body.get("keys"), audio: !!opt.body.get("audio") });
    return { ok: true, json: async () => ({ words: [
      { s: 1, a: 4, i: 0, w: "مَـٰلِكِ", ref: "مَاالِكِ", heard: "مَاالِكَ", errors: [{ kind: "haraka", msg: "نطقتَ فتحة مكان كسرة" }] },
      { s: 1, a: 4, i: 1, w: "يَوْمِ", ref: "يَومِ", heard: "يَومِ" },
      { s: 1, a: 4, i: 2, w: "ٱلدِّينِ", ref: "ددِۦۦن", heard: "ددِۦۦن" }] }) };
  };
} });
const w = dom.window, d = w.document, $ = s => d.querySelector(s), click = el => el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
const txt = s => $(s) ? $(s).textContent.replace(/\s+/g, " ").trim() : "∅";
(async () => { await sleep(20);
  // بلا خادم مضبوط: لا يظهر الفحص
  w.eval(`openTasmee(1); S.T.mode = "record"; S.T.from = "1:4"; S.T.to = "1:4"; S.T.blob = new Blob(["x"]); S.T.url = "blob:x"; evaluate("مالك يوم الدين")`); await sleep(20);
  console.log("hidden without endpoint:", !$("#harBox"));
  w.eval(`window.__MUAALEM = "https://example.hf.space/"; tasmee()`); await sleep(5);
  console.log("card:", txt("#harBox .card .small"), "| button:", txt("#harGo"), "| notice shown:", /قد يخطئ/.test(txt("#harBox")));
  click($("#harGo")); await sleep(5);
  console.log("notice sheet before first use:", /بالمشافهة/.test(txt("#sheetRoot")), "| sent yet:", sent.length);
  click($("#harOk")); await sleep(30);
  console.log("sent:", sent.map(x => x.url + " keys=" + x.keys + " audio=" + x.audio).join(" "));
  console.log("result:", txt("#harBox .small.muted"), "| error word:", txt("#harBox .w-har"), "| msg:", txt("#harBox .harl li"));
  // المرة الثانية بلا تنبيه
  w.eval(`S.T.har = null; tasmee()`); click($("#harGo")); await sleep(30);
  console.log("second run without sheet:", !$("#harOk"), sent.length === 2);
  console.log("acked saved:", w.eval("ST.muaalemOk"));
  console.log("JS errors:", errors.length ? errors : "none");
})();
