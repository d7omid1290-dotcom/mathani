const { JSDOM } = require("jsdom");
const html = require("fs").readFileSync(require("path").join(__dirname, "../../dist/index.html"), "utf8");
const errors = []; const sleep = ms => new Promise(r => setTimeout(r, ms));
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://example.org/",
  beforeParse(w) { w.addEventListener("error", e => errors.push(e.message)); w.HTMLElement.prototype.scrollIntoView = () => {}; w.scrollTo = () => {};
    w.HTMLCanvasElement.prototype.getContext = () => ({ clearRect() {}, fillRect() {} }); } });
const w = dom.window, d = w.document, $ = s => d.querySelector(s), click = el => el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
(async () => {
  await sleep(30); const t0 = Date.now();
  click(d.querySelector('[data-tab="mushaf"]')); console.log("surah list:", d.querySelectorAll(".sl").length, "| first:", $(".sl .nm").textContent);
  const q = $("#q"); q.value = "الكهف"; q.dispatchEvent(new w.Event("input")); console.log("search الكهف:", [...d.querySelectorAll(".sl .nm")].map(x => x.textContent).join(","), txt(".sl .tiny"));
  q.value = "١١٤"; q.dispatchEvent(new w.Event("input")); console.log("search ١١٤:", txt(".sl .nm"));
  click($(".sl")); console.log("reader:", txt(".bar h1"), "| banner:", txt(".banner"), "| basmala:", !!$(".basmala"));
  click($("#pgPrev")); console.log("prev:", txt(".bar h1"));
  click(d.querySelector('[data-tab="mushaf"]')); click(d.querySelector('[data-mv="juz"]')); console.log("juz blocks:", d.querySelectorAll(".jz").length, "| tiles:", d.querySelectorAll(".jz .tile").length);
  click(d.querySelector('.jz .tile[data-read="187"]')); console.log("p187:", txt(".bar h1"), "| banner:", txt(".banner"), "| basmala (التوبة):", !!$(".basmala"));
  w.eval("openReader(7,'tadabbur')"); console.log("tadabbur p187:", txt("#rv").slice(0, 45));
  w.eval("openReader(7,'quiz')"); console.log("quiz p187:", !!$("#quiz .opt"));
  click(d.querySelector('[data-v="mushaf"]')); const m = d.querySelector(".a.m"); if (m) { w.eval("ayahSheet('" + m.dataset.k + "')"); console.log("mutashabih sheet:", d.querySelectorAll(".sheet .compare").length); click($("#closeSheet")); }
  w.eval("openTasmee(S.reader)"); console.log("tasmee target:", txt(".target .grow"));
  click($("#change")); const ss = $("#ss"); ss.value = "112"; ss.dispatchEvent(new w.Event("change")); console.log("picker pages for الإخلاص:", [...d.querySelectorAll("[data-pp]")].map(b => b.textContent).join(","));
  click($("#okR")); console.log("target:", txt(".target .grow"), "| hidden words:", d.querySelectorAll("#fpage .fw.h").length);
  const ti = $("#ftype"); ti.value = "قل هو الله احد الله الصمد "; ti.dispatchEvent(new w.Event("input")); console.log("typed reveal:", txt("#fcount"));
  click(d.querySelector('[data-tab="home"]')); console.log("home ring:", txt(".continue"));
  console.log("ms:", Date.now() - t0, "| JS errors:", errors.length ? errors : "none");
  function txt(s) { return $(s) ? $(s).textContent.replace(/\s+/g, " ").trim() : "∅"; }
})();
