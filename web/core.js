/* مثاني — المنطق الأساسي (بدون واجهة) — قابل للاختبار في Node */
(function (root) {
  const DIAC = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;

  function norm(t) {
    return t.replace(DIAC, "")
      .replace(/[إأآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
      .replace(/ؤ/g, "و").replace(/ئ/g, "ي")
      .replace(/[^\u0621-\u064A\s]/g, " ")
      .split(/\s+/).filter(Boolean);
  }

  // كلمات الآية مع إلحاق علامات الوقف المستقلة بالكلمة السابقة
  function tokens(t) {
    const out = []; let pre = "";
    for (const w of t.split(/\s+/)) {
      if (!w) continue;
      if (norm(w).length === 0) { if (out.length) out[out.length - 1] += " " + w; else pre += w + " "; }
      else { out.push(pre + w); pre = ""; }
    }
    return out;
  }

  // كلمات الآية كما تُكتب في الرسم العثماني: «يا/ها» تُدمج بما بعدها (يا أيها، ها أنتم، يا ابن أم، إل ياسين)
  function mtokens(t) {
    const T = tokens(t), out = []; let i = 0;
    const n = x => norm(x).join("");
    while (i < T.length) {
      const a = n(T[i]);
      if ((a === "يا" || a === "ويا" || a === "ها") && i + 1 < T.length) {
        if (a === "يا" && T[i + 2] && n(T[i + 1]) === "ابن" && n(T[i + 2]) === "ام") { out.push(T.slice(i, i + 3).join(" ")); i += 3; continue; }
        out.push(T[i] + " " + T[i + 1]); i += 2; continue;
      }
      if (a === "ال" && i + 1 < T.length && n(T[i + 1]) === "ياسين") { out.push(T[i] + " " + T[i + 1]); i += 2; continue; }
      out.push(T[i]); i++;
    }
    return out;
  }

  function lev(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++)
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }

  // تطابق الكلمة مع تسامح بسيط لأخطاء التعرف الصوتي (وليس لأخطاء الحفظ)
  function wordEq(a, b) {
    if (a === b) return true;
    const strip = w => w.replace(/^(و|ف)(?=..)/, "").replace(/^ال(?=..)/, "");
    if (strip(a) === strip(b)) return false; // اختلاف حرف عطف/تعريف = خطأ حفظ حقيقي
    return Math.min(a.length, b.length) >= 5 && lev(a, b) <= 1;
  }

  // محاذاة كلمة بكلمة (Needleman–Wunsch) بين المتوقع والمُسمَّع
  function align(expected, heard) {
    const m = expected.length, n = heard.length;
    const D = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
    for (let i = 0; i <= m; i++) D[i][0] = i;
    for (let j = 0; j <= n; j++) D[0][j] = j;
    for (let i = 1; i <= m; i++)
      for (let j = 1; j <= n; j++)
        D[i][j] = Math.min(
          D[i - 1][j - 1] + (wordEq(expected[i - 1], heard[j - 1]) ? 0 : 1),
          D[i - 1][j] + 1, D[i][j - 1] + 1);
    const ops = []; let i = m, j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && D[i][j] === D[i - 1][j - 1] + (wordEq(expected[i - 1], heard[j - 1]) ? 0 : 1)) {
        ops.push({ op: wordEq(expected[i - 1], heard[j - 1]) ? "ok" : "sub", e: i - 1, h: j - 1 }); i--; j--;
      } else if (i > 0 && D[i][j] === D[i - 1][j] + 1) { ops.push({ op: "del", e: i - 1 }); i--; }
      else { ops.push({ op: "ins", h: j - 1, e: i }); j--; }
    }
    return ops.reverse();
  }

  function lcs(a, b) {
    const dp = Array(b.length + 1).fill(0);
    for (let i = 1; i <= a.length; i++) {
      let prev = 0;
      for (let j = 1; j <= b.length; j++) {
        const tmp = dp[j];
        dp[j] = a[i - 1] === b[j - 1] ? prev + 1 : Math.max(dp[j], dp[j - 1]);
        prev = tmp;
      }
    }
    return dp[b.length];
  }
  const sim = (a, b) => (a.length + b.length) ? (2 * lcs(a, b)) / (a.length + b.length) : 0;

  /*
   * تقييم التسميع لمجموعة آيات متتالية.
   * keys: مفاتيح الآيات المطلوبة ["2:47","2:48",...]
   * heardText: النص المُسمَّع (من التعرف الصوتي أو الكتابة)
   * data: بيانات مثاني (verses, mutashabihat)
   */
  function evaluate(keys, heardText, data) {
    if (!keys || !keys.length) return { results: [], accuracy: 0, stoppedAt: -1 };
    const exp = [], owner = [], display = [];
    keys.forEach((k, ai) => {
      const disp = tokens(data.verses[k].t);
      const n = norm(data.verses[k].t);
      // نحاذي الكلمات المعروضة مع المطبّعة (العدد متساوٍ عادةً)
      n.forEach((w, wi) => { exp.push(w); owner.push(ai); display.push(disp[wi] || w); });
    });
    const heard = norm(heardText);
    const ops = align(exp, heard);

    const perAyah = keys.map((k) => ({ k, words: [], segment: [], errors: 0 }));
    let cur = 0;
    for (const o of ops) {
      if (o.op === "ins") {
        const a = perAyah[Math.min(cur, keys.length - 1)];
        a.segment.push(heard[o.h]); a.words.push({ op: "ins", heard: heard[o.h] }); a.errors++;
        continue;
      }
      cur = owner[o.e];
      const a = perAyah[cur];
      const w = { op: o.op, word: display[o.e] };
      if (o.op === "sub") { w.heard = heard[o.h]; a.segment.push(heard[o.h]); a.errors++; }
      else if (o.op === "ok") a.segment.push(heard[o.h]);
      else a.errors++;
      a.words.push(w);
    }

    // تجاهل الآيات التي لم يُسمَّع منها شيء في نهاية المقطع (توقف الطالب)
    let lastHeard = -1;
    perAyah.forEach((a, i) => { if (a.words.some(w => w.op !== "del")) lastHeard = i; });

    const results = perAyah.map((a, i) => {
      const r = { k: a.k, words: a.words, errors: a.errors, status: "ok", transition: null };
      if (i > lastHeard) { r.status = "notReached"; return r; }
      if (!a.errors) return r;
      r.status = "error";
      const partners = data.mutashabihat[a.k] || [];
      const target = norm(data.verses[a.k].t);
      const sTarget = sim(a.segment, target);
      let best = null;
      for (const p of partners) {
        const pn = norm(data.verses[p.k].t);
        const s = sim(a.segment, pn);
        if (s > sTarget + 0.05 && (!best || s > best.score)) best = { k: p.k, score: s };
      }
      if (best) { r.status = "transition"; r.transition = best; }
      return r;
    });
    const total = exp.length;
    const wrong = results.filter(r => r.status !== "notReached").reduce((s, r) => s + r.errors, 0);
    return { results, accuracy: total ? Math.max(0, 1 - wrong / total) : 0, stoppedAt: lastHeard };
  }

  // فروق الكلمات بين آيتين متشابهتين (للتلوين)
  function diffWords(aText, bText) {
    const A = tokens(aText), B = tokens(bText);
    const an = A.map(w => norm(w)[0] || ""), bn = B.map(w => norm(w)[0] || "");
    const m = an.length, n = bn.length;
    const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
    for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--)
      dp[i][j] = an[i] === bn[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const inA = new Set(), inB = new Set(); let i = 0, j = 0;
    while (i < m && j < n) {
      if (an[i] === bn[j]) { inA.add(i); inB.add(j); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
    }
    return { a: A.map((w, x) => ({ w, same: inA.has(x) })), b: B.map((w, x) => ({ w, same: inB.has(x) })) };
  }

  // ---------- المراجعة المتباعدة (نظام صناديق مبسّط) ----------
  const DAY = 864e5;
  function schedule(rec, errors, now) {
    rec = rec || { interval: 0, due: 0, errors: 0, sessions: 0 };
    rec.sessions++;
    rec.errors = Math.round(rec.errors * 0.6 + errors); // أثر الأخطاء القديمة يضعف تدريجياً
    rec.interval = errors === 0 ? Math.min(30, Math.max(1, rec.interval * 2)) : 1;
    rec.due = now + rec.interval * DAY;
    rec.last = now;
    return rec;
  }

  // ---------- مولّد الاختبارات (من نص المصحف فقط) ----------
  function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  function shuffle(arr, r) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const head = (t, n) => tokens(t).slice(0, n).join(" ");

  function makeQuiz(page, data, seed) {
    const r = rng(seed || Date.now());
    const keys = data.pages[page];
    const qs = [];
    const V = k => data.verses[k];

    // ١) أكمل الآية — والمشتِّت الأهم: صيغة الآية المتشابهة
    const long = shuffle(keys.filter(k => tokens(V(k).t).length >= 6), r);
    for (const k of long.slice(0, 2)) {
      const w = tokens(V(k).t); const cut = Math.ceil(w.length * 0.55);
      const tailLen = w.length - cut;
      const correct = w.slice(cut).join(" ");
      const opts = new Set([correct]);
      const partner = (data.mutashabihat[k] || []).map(p => tokens(V(p.k).t)).find(pw => pw.slice(-tailLen).join(" ") !== correct);
      if (partner) opts.add(partner.slice(-tailLen).join(" "));
      for (const o of shuffle(keys.filter(x => x !== k), r)) {
        if (opts.size >= 3) break;
        const ow = tokens(V(o).t); if (ow.length >= tailLen) opts.add(ow.slice(-tailLen).join(" "));
      }
      qs.push({ type: "complete", k, prompt: w.slice(0, cut).join(" "), options: shuffle([...opts], r), answer: correct, mutashabih: !!partner });
    }

    // ٢) موضع المتشابه
    const mk = shuffle(keys.filter(k => (data.mutashabihat[k] || []).some(p => p.r < 1)), r)[0];
    if (mk) {
      const p = data.mutashabihat[mk].find(p => p.r < 1);
      const pick = r() < 0.5 ? mk : p.k;
      qs.push({ type: "where", text: V(pick).t, options: shuffle([mk, p.k], r), answer: pick });
    }

    // ٣) رتّب الآيات
    if (keys.length >= 3) {
      const start = Math.floor(r() * (keys.length - 2));
      const seq = keys.slice(start, start + 3);
      qs.push({ type: "order", items: shuffle(seq, r), answer: seq });
    }

    // ٤) بداية الوجه التالي
    const nextKey = data.pages[page + 1] ? data.pages[page + 1][0] : data.nextPageStart;
    if (nextKey && data.verses[nextKey]) {
      // المشتِّتات من أوجه قريبة، لأنها الأكثر التباساً على الحافظ
      const near = [];
      for (let d = 2; near.length < 6 && d < 12; d++) for (const p of [page + d, page - d + 1]) if (p !== page + 1 && p !== page && data.pages[p]) near.push(p);
      const others = shuffle(near, r).slice(0, 2).map(p => data.pages[p][0]);
      qs.push({ type: "next", options: shuffle([nextKey, ...others], r).map(k => ({ k, t: head(V(k).t, 6) })), answer: nextKey });
    }

    return qs;
  }

  /*
   * متابعة التسميع لحظة بلحظة (للكشف التدريجي للوجه المخفي)
   * E: كلمات الوجه المطبّعة، H: الكلمات المسموعة المطبّعة، nFinal: عدد المسموع النهائي (غير المؤقت)
   * forced: مواضع كُشفت بالتلميح
   * الحالات: 0 مخفية، 1 قُرئت صحيحة، 2 سقطت، 3 كُشفت بتلميح
   */
  function follow(E, H, nFinal, forced) {
    forced = forced || new Set();
    const st = new Array(E.length).fill(0), wrong = new Map();
    let i = 0, lastWrong = -1, heardAtWrong = "", wrongStart = -1;
    const skipForced = () => { while (i < E.length && forced.has(i)) { st[i] = 3; i++; } };
    skipForced();
    for (let j = 0; j < H.length && i < E.length; j++) {
      const fin = j < nFinal;
      if (wordEq(H[j], E[i])) { st[i] = 1; i++; lastWrong = -1; wrongStart = -1; skipForced(); continue; }
      // تصحيح ذاتي أو كلمة زائدة: الكلمة التالية المسموعة هي المطلوبة
      if (j + 1 < H.length && wordEq(H[j + 1], E[i])) continue;
      // سقوط كلمة أو كلمتين: يُشترط أن تؤكده الكلمة المسموعة بعدها
      let jumped = false;
      for (let s = 1; s <= 2 && i + s < E.length; s++) {
        if (!wordEq(H[j], E[i + s])) continue;
        const confirmed = i + s + 1 >= E.length || (j + 1 < H.length && wordEq(H[j + 1], E[i + s + 1]));
        if (!confirmed) break;
        for (let x = i; x < i + s; x++) if (!forced.has(x)) st[x] = 2;
        st[i + s] = 1; i += s + 1; lastWrong = -1; wrongStart = -1; jumped = true; skipForced(); break;
      }
      if (jumped) continue;
      if (j === H.length - 1 && !fin) break; // كلمة مؤقتة لم تستقر بعد
      if (fin) wrong.set(i, (wrong.get(i) || 0) + 1);
      if (lastWrong !== i) wrongStart = j;
      lastWrong = i; heardAtWrong = H[j];
    }
    return { pos: i, st, wrong, lastWrong, heardAtWrong, wrongStart };
  }

  /*
   * هل الخطأ الحالي انتقال إلى آية متشابهة؟
   * ctx: آخر كلمتين صحيحتين قبل موضع الخطأ في الآية نفسها، W: الكلمات المسموعة عند الخطأ
   * يُبحث في كل متشابه عن ctx ثم يُقارن ما بعدها بما قيل
   */
  function slipTo(k, ctx, W, data) {
    for (const p of data.mutashabihat[k] || []) {
      if (p.r >= 1) continue;
      const pn = norm(data.verses[p.k].t);
      for (let t = 0; t + ctx.length < pn.length; t++) {
        let okc = true; for (let x = 0; x < ctx.length; x++) if (!wordEq(pn[t + x], ctx[x])) { okc = false; break; }
        if (!okc) continue;
        const cont = pn.slice(t + ctx.length, t + ctx.length + W.length);
        if (W.length && cont.length && W.every((w, x) => cont[x] === undefined || wordEq(w, cont[x]))) return p.k;
        if (!ctx.length) break;
      }
    }
    return null;
  }


  /*
   * التعرف على موضع القراءة في المصحف كله: يقرأ الحافظ من أي موضع فيُعرف أين هو
   * locIndex يبني فهرساً لكل كلمات المصحف (مرة واحدة)، وlocate تبحث عن أفضل بداية لما سُمع
   */
  const skel = w => w.replace(/[اويء]/g, "") || w; // هيكل الكلمة: يتسامح مع اختلاف الألف والواو والياء في التعرف الصوتي
  function locIndex(data) {
    const keys = Object.keys(data.verses).sort((a, b) => { const [s1, a1] = a.split(":"), [s2, a2] = b.split(":"); return s1 - s2 || a1 - a2; });
    const G = [], K = [], W = [], map = new Map();
    for (const k of keys) norm(data.verses[k].t).forEach((w, i) => { G.push(w); K.push(k); W.push(i); });
    for (let i = 0; i + 1 < G.length; i++) { const b = skel(G[i]) + " " + skel(G[i + 1]); let a = map.get(b); if (!a) map.set(b, a = []); a.push(i); }
    return { G, K, W, map };
  }
  const OPEN = [["اعوذ", "بالله", "من", "الشيطان", "الرجيم"], ["بسم", "الله", "الرحمن", "الرحيم"]];
  // H: الكلمات المسموعة (مطبّعة). near: رقم الوجه الحالي لترجيح المتشابهات. تُرجع null إن لم يتأكد بعد
  function locate(H, idx, data, near) {
    let off = 0;
    for (let again = true; again;) { again = false;
      for (const o of OPEN) { const n = Math.min(o.length, H.length - off);
        if (n > 0 && o.slice(0, n).every((w, x) => wordEq(H[off + x], w))) { if (n < o.length) return null; off += o.length; again = true; } } }
    const Hs = H.slice(off);
    if (Hs.length < 3) return null;
    const cands = new Set();
    for (let j = 0; j + 1 < Math.min(Hs.length, 7); j++) for (const p of idx.map.get(skel(Hs[j]) + " " + skel(Hs[j + 1])) || []) { if (p - j >= 0) cands.add(p - j); if (j && p - j + 1 >= 0) cands.add(p - j + 1); }
    let best = [], top = 0;
    for (const c of cands) {
      const f = follow(idx.G.slice(c, c + Hs.length + 3), Hs, Hs.length);
      const first = f.st.indexOf(1); if (first < 0) continue;
      const score = f.st.filter(x => x === 1).length;
      if (score > top) { top = score; best = [c + first]; } else if (score === top && !best.includes(c + first)) best.push(c + first);
    }
    if (top < Math.min(4, Hs.length) || top < Hs.length * 0.6) return null;
    if (best.length > 1) {
      if (Hs.length < 10) return null; // متشابه: ننتظر كلمات أكثر تميّز الموضع
      const pg = i => data.verses[idx.K[i]].p;
      best.sort((a, b) => Math.abs(pg(a) - near) - Math.abs(pg(b) - near));
    }
    const i = best[0];
    return { k: idx.K[i], wi: idx.W[i], hOff: off, score: top, ties: best.length };
  }

  const api = { locIndex, locate, mtokens, slipTo, follow, tokens, norm, align, evaluate, diffWords, schedule, makeQuiz, sim, wordEq };
  if (typeof module !== "undefined") module.exports = api; else root.Mathani = api;
})(this);
