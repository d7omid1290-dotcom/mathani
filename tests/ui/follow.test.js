const { JSDOM } = require("jsdom");
const html = require("fs").readFileSync(require("path").join(__dirname, "../../dist/index.html"), "utf8");
const errors = []; const sleep = ms => new Promise(r => setTimeout(r, ms));
let SRI = null;
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://example.org/",
  beforeParse(w) {
    w.addEventListener("error", e => errors.push(e.message));
    w.HTMLElement.prototype.scrollIntoView = () => {}; w.scrollTo = () => {};
    w.HTMLCanvasElement.prototype.getContext = () => ({ clearRect() {}, fillRect() {} });
    const { indexedDB } = require("fake-indexeddb"); w.indexedDB = indexedDB;
    w.webkitSpeechRecognition = class { constructor() { SRI = this; } start() {} stop() {} };
  } });
const w = dom.window, d = w.document, $ = s => d.querySelector(s);
const click = el => el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
const N = k => w.eval(`Mathani.norm(V('${k}').t)`);
// يحاكي نتائج التعرف: words نهائية + كلمة مؤقتة
const emit = (finalWords, interim = "") => SRI.onresult({ results: [
  ...(finalWords.length ? [Object.assign([{ transcript: finalWords.join(" ") }], { isFinal: true })] : []),
  ...(interim ? [Object.assign([{ transcript: interim }], { isFinal: false })] : []) ] });
const state = () => ({ count: $("#fcount").textContent, ok: d.querySelectorAll("#fpage .fw.ok").length, hidden: d.querySelectorAll("#fpage .fw.h").length, cur: !!$("#fpage .fw.cur"), bad: !!$("#fpage .fw.bad"), toast: ($("#ftoast").textContent || "").trim().slice(0, 60) });
(async () => {
  await sleep(30);
  w.eval("openTasmee(7)"); 
  console.log("modes:", [...d.querySelectorAll(".modes button")].map(b => b.textContent + (b.getAttribute("aria-pressed") === "true" ? "✓" : "")).join(" | "));
  click($("#change")); $("#sf").value = "2:47"; $("#sf").dispatchEvent(new w.Event("change")); click($("#okR"));
  console.log("start:", state());
  click($("#fmic")); console.log("listening:", !!$(".mic.on"));
  const a47 = N("2:47"), a123 = N("2:123");
  emit(a47.slice(0, 4), a47[4]); console.log("after 4 + interim:", state());
  emit(a47); console.log("ayah 47 done:", state());
  // ينتقل إلى صيغة البقرة ١٢٣ في الآية ٤٨
  emit(a47.concat(a123.slice(0, 14))); console.log("mutashabih slip:", state());
  click($("#fhint")); console.log("after hint:", state());
  // يكمل الصحيح من موضع التلميح
  const a48 = N("2:48"); const pos = w.eval("Mathani.follow(F.E, followHeard().H, followHeard().nFinal, F.forced).pos") - a47.length;
  emit(a47.concat(a123.slice(0, 14), a48.slice(pos))); await sleep(900);
  console.log("auto-finished →", $(".score") ? $(".score").textContent.replace(/\s+/g, " ").trim() : "no result", "| ", [...d.querySelectorAll(".res .tag")].map(t => t.textContent.trim()).join(" / "));
  // وضع الكتابة داخل التسميع المباشر
  click($("#again")); console.log("again mode:", d.querySelector(".modes [aria-pressed=true]").textContent);
  const ti = $("#ftype"); ti.value = "يا بني اسراييل اذكروا "; ti.dispatchEvent(new w.Event("input")); console.log("typed:", state());
  console.log("JS errors:", errors.length ? errors : "none");
})();
