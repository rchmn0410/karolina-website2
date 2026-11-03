/* ============ PENGATURAN ============ */
const AUDIO_SRC = "karolina.mp3"; // file lagu, taruh di folder yang sama
const OFFSET    = 0;     // kalau mp3 sudah dipotong: isi detik lagu asli di awal file (mis. 99)
const START_AT  = 99;    // mulai putar dari detik ke-? (waktu lagu asli) -> 1:39
const END_AT    = 158;   // berhenti/ulang di detik ke-? (waktu lagu asli) -> 2:38
const LOOP      = true;  // ulang terus
const REACTIVE  = false; // true = hati ikut dentuman musik (kalau suara hilang, balikin ke false)

const HEART_X    = 0.66; // posisi hati kiri-kanan (0 = kiri, 1 = kanan)
const HEART_Y    = 0.46; // posisi hati atas-bawah (0 = atas, 1 = bawah)
const HEART_SIZE = 0.33; // lebar hati dibanding lebar layar

/* Tempel lirik mentah di bawah ini, formatnya: "menit:detik lirik"
   Satu baris satu lirik. Baris yang diawali dan diakhiri kurung
   otomatis jadi suara latar (tampil lebih tipis).
   Baris judul "Timestamp Lirik" boleh ikut dipaste, otomatis diabaikan. */
const LIRIK_MENTAH = `
01:41.06 I love you, my lady in the night
01:51.10 I'll lead you to my life
02:03.17 Through the finest hour of my life
02:08.77 (Through the finest hour of my life)
02:12.74 You my light guiding me
02:24.56 Through the darkest hour of my life
02:30.02 (Through the darkest hour of my life)
`;
/* ====================================== */

const LYRICS = LIRIK_MENTAH.trim().split("\n").map(line => {
  const m = line.trim().match(/^(\d+):(\d+(?:\.\d+)?)\s+(.*)$/);
  if (!m) return null;
  const text = m[3].trim();
  return {
    t: parseInt(m[1], 10) * 60 + parseFloat(m[2]),
    text: text,
    echo: text.startsWith("(") && text.endsWith(")")
  };
}).filter(Boolean);

const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);

/* ---------- Canvas ---------- */
const cv = $("c"), ctx = cv.getContext("2d");
const lyricsEl = $("lyrics");
let W, H, cx, cy, S;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  cx = W * HEART_X;
  cy = H * HEART_Y;
  S = Math.min(W * HEART_SIZE / 32, H * 0.3 / 29); // skala hati

  // lirik sejajar dengan tengah hati, lebarnya berhenti sebelum hati
  const heartW = (32 * S) / W;
  lyricsEl.style.top = (HEART_Y * 100) + "%";
  lyricsEl.style.width = Math.max(25, (HEART_X - heartW / 2 - 0.09) * 100) + "%";
}
addEventListener("resize", resize);
resize();

/* ---------- Partikel hati (beberapa lapis) ---------- */
const LAYERS = [1, 0.8, 0.6, 0.4, 0.22];
const parts = [];
LAYERS.forEach(k => {
  const n = Math.round(200 * k + 30);
  for (let i = 0; i < n; i++) {
    parts.push({
      t: Math.random() * Math.PI * 2, k,
      jx: rand(-1, 1), jy: rand(-1, 1),
      x: rand(0, W), y: rand(0, H),
      r: rand(0.6, 1.4), ph: rand(0, 6.28)
    });
  }
});

/* ---------- Bintang latar ---------- */
const stars = Array.from({ length: 110 }, () => ({
  x: Math.random(), y: Math.random(), r: rand(0.4, 1.1), ph: rand(0, 6.28)
}));

/* ---------- Percikan biru kecil ---------- */
const sparks = [];
let nextBurst = 0;

function burst() {
  const bx = rand(0.1, 0.55) * W, by = rand(0.25, 0.38) * H;
  for (let i = 0; i < 22; i++) {
    const a = rand(0, 6.28), v = rand(0.2, 1.3);
    sparks.push({ x: bx, y: by, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1 });
  }
}

/* ---------- Audio ---------- */
const audio = new Audio(AUDIO_SRC);
audio.preload = "auto";
const hint = $("hint");
let ac = null, analyser = null, freq = null, energy = 0, started = false;

function showHint(text) {
  hint.textContent = text;
  hint.classList.add("show");
}

function setupAnalyser() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    ac = new AC();
    const src = ac.createMediaElementSource(audio);
    analyser = ac.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    analyser.connect(ac.destination);
    freq = new Uint8Array(analyser.frequencyBinCount);
  } catch (e) { analyser = null; }
}

function seekStart() { audio.currentTime = Math.max(0, START_AT - OFFSET); }

function begin() {
  if (ac && ac.state === "suspended") ac.resume();
  if (audio.readyState >= 1) seekStart();
  else audio.addEventListener("loadedmetadata", seekStart, { once: true });

  audio.play().then(() => {
    started = true;
    hint.classList.remove("show");
  }).catch(() => {
    if (audio.error) {
      showHint("File " + AUDIO_SRC + " tidak ketemu. Taruh di folder yang sama dengan index.html.");
      return;
    }
    // browser memblokir putar otomatis -> mulai di ketukan pertama di mana saja
    showHint("Ketuk layar untuk memutar");
    addEventListener("pointerdown", begin, { once: true });
  });
}

if (REACTIVE) setupAnalyser();
begin(); // langsung jalan saat halaman dibuka

/* ---------- Lirik ---------- */
const nowEl = $("now"), prevEl = $("prev");
let idx = -2;

function updateLyrics(st) {
  let i = -1;
  for (let k = 0; k < LYRICS.length; k++) if (st >= LYRICS[k].t) i = k;
  if (i === idx) return;
  idx = i;
  nowEl.classList.remove("show");
  setTimeout(() => {
    if (idx !== i) return;
    if (i < 0) { nowEl.textContent = ""; prevEl.textContent = ""; return; }
    prevEl.textContent = i > 0 ? LYRICS[i - 1].text : "";
    nowEl.textContent = LYRICS[i].text;
    nowEl.classList.toggle("echo", !!LYRICS[i].echo);
    nowEl.classList.add("show");
  }, 220);
}

/* ---------- Loop animasi ---------- */
function heart(t) {
  return {
    x: 16 * Math.pow(Math.sin(t), 3),
    y: 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
  };
}

function frame(ms) {
  const time = ms / 1000;

  // jejak halus
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(0, 0, W, H);

  // sinkron lirik + loop
  if (started) {
    const st = audio.currentTime + OFFSET;
    if (st >= END_AT) {
      if (LOOP) seekStart(); else { audio.pause(); started = false; }
    }
    updateLyrics(st);
  }

  // denyut
  let target = 0;
  if (analyser) {
    analyser.getByteFrequencyData(freq);
    let sum = 0;
    for (let i = 0; i < 8; i++) sum += freq[i];
    target = sum / 8 / 255;
  } else {
    target = started ? 0.5 + 0.5 * Math.sin(time * 5.2) : 0.3;
  }
  energy += (target - energy) * 0.2;
  const beat = 1 + Math.sin(time * 2.2) * 0.025 + energy * 0.1;

  // bintang
  ctx.fillStyle = "#fff";
  for (const s of stars) {
    ctx.globalAlpha = 0.15 + 0.35 * (0.5 + 0.5 * Math.sin(time * 1.5 + s.ph));
    ctx.fillRect(s.x * W, s.y * H, s.r, s.r);
  }

  // hati
  ctx.fillStyle = "#fff";
  for (const p of parts) {
    const h = heart(p.t);
    const wob = 0.25 + 0.15 * Math.sin(time * 1.6 + p.ph);
    const tx = cx + (h.x * p.k * beat + p.jx * wob) * S;
    const ty = cy - ((h.y + 2.5) * p.k * beat + p.jy * wob) * S;
    p.x += (tx - p.x) * 0.035;
    p.y += (ty - p.y) * 0.035;
    ctx.globalAlpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * 2 + p.ph));
    ctx.fillRect(p.x, p.y, p.r, p.r);
  }

  // percikan biru
  if (time > nextBurst) { burst(); nextBurst = time + rand(1.6, 3.2); }
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.x += s.vx; s.y += s.vy; s.vy += 0.012; s.life -= 0.012;
    if (s.life <= 0) { sparks.splice(i, 1); continue; }
    ctx.globalAlpha = s.life;
    ctx.fillStyle = "#9fd0ff";
    ctx.fillRect(s.x, s.y, 1.6, 1.6);
  }

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);