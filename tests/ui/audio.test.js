const { JSDOM } = require("jsdom");
const html = require("fs").readFileSync(require("path").join(__dirname, "../../dist/index.html"), "utf8");
const errors = []; const sleep = ms => new Promise(r => setTimeout(r, ms));
const srcs = [];
const dom = new JSDOM(html, { runScripts: "dangerously", url: "https://example.org/", beforeParse(w) {
  w.addEventListener("error", e => errors.push(e.message)); w.addEventListener("unhandledrejection", e => errors.push("rej " + e.reason));
  w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = () => {}; w.HTMLCanvasElement.prototype.getContext = () => ({ clearRect() {}, fillRect() {} });
  w.Audio = class { constructor() { this.paused = true; this.duration = 2; this.currentTime = 0; this._src = ""; }
    set src(v) { this._src = v; } get src() { return this._src; } removeAttribute() { this._src = ""; }
    play() { this.paused = false; if (this === w.P?.el) srcs.push(this._src); return Promise.resolve(); } pause() { this.paused = true; } };
} });
const w = dom.window, d = w.document, $ = s => d.querySelector(s), click = el => el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
const txt = s => $(s) ? $(s).textContent.replace(/\s+/g, " ").trim() : "∅";
(async () => { await sleep(20); w.eval("window.P = P");
  w.eval("ST.rhint=1; openReader(7,'mushaf')");
  click($("#rPlay")); await sleep(10);
  console.log("first src:", srcs.at(-1).replace("https://everyayah.com/data/", ""), "| player:", txt("#mp .who"));
  console.log("highlighted words of 2:38:", d.querySelectorAll('#lines .pl').length);
  w.eval("P.el.onended()"); await sleep(5); console.log("after end →", txt("#mp .who small"), srcs.at(-1).slice(-10));
  // تكرار ٣ مرات
  w.eval("ST.rep=3; P.cnt=0"); w.eval("P.el.onended()"); w.eval("P.el.onended()"); console.log("repeat x3, still:", txt("#mp .who small"), "| rep badge:", txt("#mp .rep"));
  w.eval("P.el.onended()"); console.log("after 3rd → next ayah:", txt("#mp .who small")); w.eval("ST.rep=1");
  // آخر آية في الوجه ← ينتقل للوجه ٨ تلقائياً
  w.eval("playFrom('2:48')"); w.eval("P.el.onended()"); await sleep(5);
  console.log("auto page turn:", txt(".rtop .t small"), "| now:", txt("#mp .who small"), "| highlighted:", d.querySelectorAll('#lines .pl').length);
  // البسملة قبل أول السورة
  w.eval("playFrom('3:1')"); console.log("basmala first:", srcs.at(-1).slice(-10), txt("#mp .who small")); w.eval("P.el.onended()"); console.log("then ayah:", srcs.at(-1).slice(-10));
  w.eval("playFrom('9:1')"); console.log("at-Tawba no basmala:", srcs.at(-1).slice(-10));
  // إعدادات: تغيير القارئ
  click($("#mpSet")); console.log("reciters listed:", d.querySelectorAll("[data-rec]").length);
  const q = $("#rq"); q.value = "الحصري"; q.dispatchEvent(new w.Event("input")); console.log("search الحصري:", [...d.querySelectorAll("[data-rec] b")].map(b => b.textContent + (b.nextElementSibling?.classList.contains("tag") ? "(" + b.nextElementSibling.textContent + ")" : "")).join(" | "));
  click(d.querySelector('[data-rec="Husary_Muallim_128kbps"]')); console.log("switched:", srcs.at(-1).replace("https://everyayah.com/data/", ""));
  click(d.querySelector('[data-rep="0"]')); click(d.querySelector('[data-rate="0.75"]')); console.log("rep∞/rate:", w.eval("ST.rep+'/'+ST.rate"), "| playbackRate:", w.eval("P.el.playbackRate")); click($("#closeSheet"));
  // من ورقة الآية
  w.eval("ayahSheet('2:255')"); click($("#ayPlay")); console.log("from ayah sheet:", txt("#mp .who small"), "| page:", txt(".rtop .t small"));
  click($("#mpPP")); console.log("paused:", w.eval("P.playing"), "| icon:", $("#mpPP").getAttribute("aria-label"));
  click($("#mpX")); console.log("closed:", $("#mp").hidden, "| highlights left:", d.querySelectorAll(".pl").length);
  // الرئيسية: بطاقة استمع
  w.eval("go('home')"); console.log("home listen card:", [...d.querySelectorAll(".qc b")].map(b => b.textContent).join("، "));
  console.log("JS errors:", errors.length ? errors : "none");
})();
