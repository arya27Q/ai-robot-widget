/**
 * Rich Theme-Aware Indonesian Greeting & Personality Library
 * Automatically adapts nickname:
 *  - Pink ("sakura") & Purple ("violet") -> "bib" (cute/feminine vibe)
 *  - Cyan / Emerald / Gold -> "bro" (chill buddy vibe)
 */

const lastPicked = new Map();

export function isGirlTheme(theme) {
  return theme === "sakura" || theme === "violet";
}

export function getCallName(theme) {
  return isGirlTheme(theme) ? "bib" : "bro";
}

function applyName(text, theme) {
  const name = getCallName(theme);
  return text.replaceAll("{name}", name);
}

function pickFresh(key, list, theme = "cyan") {
  if (!list || list.length === 0) return "";
  if (list.length === 1) return applyName(list[0], theme);

  const prev = lastPicked.get(key);
  let idx = Math.floor(Math.random() * list.length);
  if (idx === prev) {
    idx = (idx + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length;
  }
  lastPicked.set(key, idx);
  return applyName(list[idx], theme);
}

const TIME_GREETINGS = {
  morning: [
    "Selamat pagi {name}! Semangat mulai hari ini ya!",
    "Pagi {name}! Udah minum air putih belum?",
    "Halo pagi {name}! Yuk bikin hari ini produktif.",
    "Pagi cerah {name}! Siap nemenin kerjaanmu hari ini.",
    "Good morning {name}! Jangan lupa sarapan biar fokus.",
  ],
  noon: [
    "Selamat siang {name}! Jangan lupa makan siang ya.",
    "Siang {name}! Tetap semangat, setengah hari lagi!",
    "Halo siang {name}! Minum air dulu biar nggak ngantuk.",
    "Siang {name}! Kalau capek, rehat 5 menit dulu yuk.",
    "Semangat siang {name}! Satu per satu pasti beres.",
  ],
  afternoon: [
    "Selamat sore {name}! Gimana progres hari ini?",
    "Sore {name}! Keren banget udah bertahan sampai sore.",
    "Halo sore {name}! Jangan lupa peregangan bahu sebentar.",
    "Sore santai {name}! Mau set timer fokus sebentar lagi?",
    "Sore {name}! Teh atau kopi enak nih buat nemenin.",
  ],
  evening: [
    "Selamat malam {name}! Santai sejenak yuk.",
    "Malam {name}! Kerjaan hari ini udah aman?",
    "Halo malam {name}! Jangan terlalu tegang ya, santai aja.",
    "Malam {name}! Istirahatkan mata bentar dari layar yuk.",
    "Selamat malam {name}! Makasih udah berjuang hari ini.",
  ],
  lateNight: [
    "Udah larut malam nih {name}, jangan lupa tidur ya!",
    "Wah masih melek aja {name}? Jangan begadang terus!",
    "Malam banget nih {name}... baterai manusia juga perlu dicas!",
    "Psst {name}, udah malem! Beresin dikit terus istirahat ya.",
    "Bip-boop... mode burung hantu aktif, jaga kesehatan ya {name}!",
  ],
};

const MOOD_LINES = {
  happy: [
    "Lagi seneng nih, semangat ya {name}!",
    "Vibe hari ini bagus banget {name}!",
    "Hehe, asik nih ditemenin kamu terus {name}!",
    "Bip-boop! Hari ini pasti lancar jaya {name}!",
    "Mood lagi full senyum nih ^ ^",
  ],
  sad: [
    "Huhu, kok aku dicuekin sih {name}...",
    "Elus aku dong {name} biar semangat lagi...",
    "Lagi melow dikit nih {name}... butuh perhatian.",
    "Bip... jangan lupa tengok aku dong {name}...",
    "Hiks, klik 2x aku dong {name} biar nggak sedih.",
  ],
  love: [
    "Makasih udah dielus {name}, sayang deh!",
    "Kamu keren banget hari ini {name}!",
    "Hehe suka banget kalau diperhatiin {name}!",
    "Semangat terus ya {name}, aku selalu dukung!",
    "Aduh jadi makin betah di layarmu {name}!",
  ],
  curious: [
    "Hmm, lagi ngerjain apa tuh {name}?",
    "Serius amat {name}, spill dong!",
    "Eh itu kode atau mantra rahasia ya {name}?",
    "Kepo dikit... lagi fokus apa nih {name}?",
    "Hmm-beep? Kayaknya seru tuh {name}!",
  ],
  excited: [
    "Wih gaspol terus {name}!",
    "YEAY! Energi penuh 100% {name}!",
    "Ayo beresin target hari ini {name}!",
    "Semangat membara nih, gaskeun {name}!",
    "Asik banget! Lanjut terus {name}!",
  ],
  grumpy: [
    "Hmph! Jangan lupa istirahat tau {name}!",
    "Kok aku nggak diajak ngobrol sih {name}...",
    "Brr-bup! Jangan kebanyakan ngopi {name}!",
    "Ngambek dikit nih {name}, elus dong!",
    "Hmph! Duduknya jangan bungkuk ya {name}!",
  ],
  wink: [
    "Santai aja {name}, kamu pasti bisa!",
    "Tenang {name}, aku jagain semua pengingatmu!",
    "Kece banget hari ini {name}, lanjut!",
    "Bip! Jangan lupa senyum ya {name}!",
    "Aman terkendali {name}, percaya diri aja!",
  ],
  starry: [
    "WOOOW! Keren banget sih kamu {name}!",
    "Gokil {name}, produktif banget hari ini!",
    "Auto kagum nih lihat kamu kerja {name}!",
    "Bintang lima buat semangatmu {name}!",
    "Wah jago banget {name}, robot aja terpesona!",
  ],
  dizzy: [
    "Aduh kepalaku muter kebanyakan mikir {name}...",
    "Loading otak 99%... bentar ngelag {name}!",
    "Kebanyakan tab kebuka nih kayaknya {name}...",
    "Wub-wub... butuh kopi listrik dulu {name}!",
    "Bentar {name}, sinyal robot lagi muter-muter...",
  ],
  cool: [
    "Mode santuy aktif {name}. No panic!",
    "Tetap kalem {name}, semua terkendali.",
    "Stay cool {name}, satu-satu pasti kelar!",
    "Chill dulu {name}, fokus tetap jalan.",
    "Santai kayak di pantai {name}, kerjaan tetap beres.",
  ],
  shy: [
    "Eh... jangan diliatin terus dong {name}, malu...",
    "Aduh jadi salting nih diperhatiin {name}!",
    "Hehe makasih udah nemenin aku ya {name}!",
    "Bip... kamu baik banget sih {name}!",
    "Ih jangan bikin robot jadi grogi dong {name}...",
  ],
  laugh: [
    "Wkwk lucu banget sih {name}!",
    "Hahaha, santai {name} jangan tegang terus!",
    "Hehe-bip! Mood langsung naik lagi {name}!",
    "Ketawa dulu biar nggak stres {name}!",
    "Haha asik banget hari ini {name}!",
  ],
};

const WAKE_LINES = [
  "Eh ketiduran! Udah jam berapa nih {name}?",
  "Hoaaam... kaget {name}, kirain udah pagi!",
  "Waduh ketahuan merem sebentar {name}!",
  "Siap {name}! Baterai robot udah penuh lagi!",
  "Bwoop! Eh iya {name}, aku bangun kok!",
];

const WELLNESS_NUDGES = [
  "Jangan lupa minum air putih dulu ya {name}!",
  "Istirahatkan mata 20 detik {name}, lihat ke arah jauh yuk.",
  "Cek postur dudukmu sebentar {name}, tegakin bahu biar nyaman!",
  "Tarik napas pelan 3 detik... buang... rileks dulu yuk {name}!",
  "Udah lama duduk nih {name}, gerakin tangan & leher bentar ya.",
  "Kalau lagi stuck {name}, coba rehat 5 menit pakai Pomodoro!",
  "Jangan lupa save kerjaanmu biar aman ya {name}!",
  "Kamu udah melakukan yang terbaik hari ini {name}, lanjut pelan-pelan!",
  "Bip-boop! Cek jadwalmu {name}, ada yang perlu diingetin nggak?",
  "Minum dulu yuk {name}, biar otak tetap segar & fokus!",
];

export function getTimeGreeting(theme = "cyan") {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return pickFresh("morning", TIME_GREETINGS.morning, theme);
  if (h >= 11 && h < 15) return pickFresh("noon", TIME_GREETINGS.noon, theme);
  if (h >= 15 && h < 18) return pickFresh("afternoon", TIME_GREETINGS.afternoon, theme);
  if (h >= 18 && h < 22) return pickFresh("evening", TIME_GREETINGS.evening, theme);
  return pickFresh("lateNight", TIME_GREETINGS.lateNight, theme);
}

export function getMoodLine(mood, theme = "cyan") {
  const list = MOOD_LINES[mood];
  if (!list) return getTimeGreeting(theme);
  return pickFresh(`mood_${mood}`, list, theme);
}

export function getWakeLine(theme = "cyan") {
  return pickFresh("wake", WAKE_LINES, theme);
}

export function getWellnessNudge(theme = "cyan") {
  return pickFresh("nudge", WELLNESS_NUDGES, theme);
}
