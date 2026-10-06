const { JSDOM } = require("jsdom");
let html = require("fs").readFileSync(require("path").join(__dirname, "../../dist/index.html"), "utf8");
const WITH_SERVER = process.argv[2] === "server";
if (WITH_SERVER) html = html.replace('const ASR_ENDPOINT = "";', 'const ASR_ENDPOINT = "https://asr.example/transcribe";');
const errors = []; const sleep = ms => new Promise(r => setTimeout(r, ms));
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://example.org/",
  beforeParse(w) {
    w.addEventListener("error", e => errors.push(e.message)); w.addEventListener("unhandledrejection", e => errors.push("rej " + e.reason));
    w.HTMLElement.prototype.scrollIntoView = () => {}; w.scrollTo = () => {}; w.confirm = () => true;
    w.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); }; w.HTMLMediaElement.prototype.pause = () => {};
    w.HTMLCanvasElement.prototype.getContext = () => ({ clearRect() {}, fillRect() {} });
    const { indexedDB } = require("fake-indexeddb"); w.indexedDB = indexedDB;
    w.URL.createObjectURL = () => "blob:fake";
    w.navigator.mediaDevices = { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) };
    w.MediaRecorder = class { constructor(s, o) { this.mimeType = (o && o.mimeType) || "audio/webm"; this.state = "inactive"; } static isTypeSupported(t) { return t.startsWith("audio/webm"); }
      start() { this.state = "recording"; setTimeout(() => this.ondataavailable({ data: new w.Blob(["x"]) }), 10); } requestData() {} stop() { this.state = "inactive"; setTimeout(() => this.onstop(), 10); } };
    w.webkitSpeechRecognition = class { start() { const t = w.__SAY; setTimeout(() => this.onresult && this.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: t }], { isFinal: true })] }), 20); } stop() {} };
    w.fetch = async (u) => ({ ok: true, json: async () => ({ text: w.__SAY }) });
  } });
const w = dom.window, d = w.document, $ = s => d.querySelector(s);
const click = el => el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
const txt = s => ($(s) ? $(s).textContent.replace(/\s+/g, " ").trim() : "∅");
(async () => {
  await sleep(50);
  console.log("tabs:", [...d.querySelectorAll("#tabs button")].map(b => b.textContent).join("|"));
  console.log("home:", txt(".hero h2"), "|", txt(".continue").slice(0, 60));
  // المصحف والقارئ (الفهم منفصل)
  w.eval('openReader(7)');
  console.log("reader seg:", txt(".seg"), "| banner?", !!$(".banner"), "| ends:", d.querySelectorAll(".end").length, "| m:", d.querySelectorAll(".a.m").length);
  w.eval("ayahSheet('2:48')"); console.log("ayah sheet compare:", d.querySelectorAll(".sheet .compare").length); click($("#closeSheet"));
  w.eval("openReader(7,'meaning')"); console.log("meaning verses:", d.querySelectorAll(".verse").length);
  w.eval("openReader(7,'tadabbur')"); console.log("tadabbur:", txt(".today .ayah"), "| an:", d.querySelectorAll(".an").length);
  w.eval("openReader(7,'quiz')"); console.log("quiz:", !!$("#quiz .opt"));
  // من القارئ إلى التسميع
  click($(".recite-cta")); console.log("tasmee:", txt(".target"));
  // تغيير المدى
  click($("#change")); $("#sf").value = "2:47"; $("#sf").dispatchEvent(new w.Event("change")); click($("#okR")); console.log("range:", txt(".target .tiny"));
  w.__SAY = w.eval("Mathani.norm(V('2:47').t).join(' ') + ' ' + Mathani.norm(V('2:123').t).join(' ')");
  click(d.querySelector('[data-m="record"]'));
  // تسجيل صوتي
  click($("#micBtn")); await sleep(80); try{w.eval("new MediaRecorder({}, {mimeType:\"audio/webm\"})");console.log("ctor ok")}catch(e){console.log("ctor err",e.message)}; console.log("err:", w.eval("S.T.err"), "md:", !!w.navigator.mediaDevices); console.log("recording:", !!$(".mic.on"), "| clock:", txt("#clock"));
  click($("#micBtn")); await sleep(120); console.log("recorded:", txt("#studio .tiny"), "| player:", !!$("#playBtn"));
  click($("#playBtn")); click($("#evalRec")); await sleep(300);
  console.log(WITH_SERVER ? "after server ASR:" : "after whisper (no network):", WITH_SERVER ? txt(".score") : txt("#studio .alert").slice(0, 70));
  if (!WITH_SERVER) {
    // التسميع المباشر
    click(d.querySelector('[data-m="text"]')); $("#ta").value = w.__SAY; $("#ta").dispatchEvent(new w.Event("input")); click($("#evalBtn")); await sleep(80);

    console.log("live result:", txt(".score"));
  }
  console.log("result tags:", [...d.querySelectorAll(".res .tag")].map(t => t.textContent.trim().replace(/\s+/g, " ")).join(" | "));
  click($("#again")); click(d.querySelector('[data-m="text"]')); $("#ta").value = "الحمد لله"; $("#ta").dispatchEvent(new w.Event("input")); click($("#hintBtn")); console.log("hint:", txt("#hint").slice(0, 50));
  w.eval("go('review')"); console.log("review:", txt("#view").slice(0, 120));
  click(d.querySelector('[data-tab="profile"]')); await sleep(150); console.log("recordings:", d.querySelectorAll("#recs audio").length, txt("#recs .chip"));
  click(d.querySelector('[data-tab="home"]')); console.log("home recent:", d.querySelectorAll(".item").length);
  console.log("JS errors:", errors.length ? errors : "none");
})();
