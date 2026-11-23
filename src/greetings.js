/**
 * Rich Indonesian Greeting & Personality Library for the AI Robot Companion
 * Anti-repeat picker for time-of-day greetings, mood reactions, wake-up lines,
 * and friendly periodic wellness/productivity nudges.
 */

const lastPicked = new Map();

function pickFresh(key, list) {
  if (!list || list.length === 0) return "";
  if (list.length === 1) return list[0];

  const prev = lastPicked.get(key);
  let idx = Math.floor(Math.random() * list.length);
  if (idx === prev) {
    idx = (idx + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length;
  }
  lastPicked.set(key, idx);
  return list[idx];
}

const TIME_GREETINGS = {
  morning: [
    "Selamat pagi! Semangat mulai hari ini ya!",
    "Pagi bro! Udah minum air putih belum?",
    "Halo pagi! Yuk bikin hari ini produktif.",
    "Pagi cerah! Siap nemenin kerjaanmu hari ini.",
    "Good morning! Jangan lupa sarapan biar fokus.",
  ],
  noon: [
    "Selamat siang! Jangan lupa makan siang ya.",
    "Siang bro! Tetap semangat, setengah hari lagi!",
    "Halo siang! Minum air dulu biar nggak ngantuk.",
    "Siang! Kalau capek, rehat 5 menit dulu yuk.",
    "Semangat siang! Satu per satu pasti beres.",
  ],
  afternoon: [
    "Selamat sore! Gimana progres hari ini?",
    "Sore bro! Keren banget udah bertahan sampai sore.",
    "Halo sore! Jangan lupa peregangan bahu sebentar.",
    "Sore santai! Mau set timer fokus sebentar lagi?",
    "Sore! Teh atau kopi enak nih buat nemenin.",
  ],
  evening: [
    "Selamat malam! Santai sejenak yuk.",
    "Malam bro! Kerjaan hari ini udah aman?",
    "Halo malam! Jangan terlalu tegang ya, santai aja.",
    "Malam! Istirahatkan mata bentar dari layar yuk.",
    "Selamat malam! Makasih udah berjuang hari ini.",
  ],
  lateNight: [
    "Udah larut malam nih, jangan lupa tidur ya!",
    "Wah masih melek aja bro? Jangan begadang terus!",
    "Malam banget nih... baterai manusia juga perlu dicas!",
    "Psst, udah malem! Beresin dikit terus istirahat ya.",
    "Bip-boop... mode burung hantu aktif, tapi jaga kesehatan ya!",
  ],
};

const MOOD_LINES = {
  happy: [
    "Lagi seneng nih, semangat ya bro!",
    "Vibe hari ini bagus banget!",
    "Hehe, asik nih ditemenin terus!",
    "Bip-boop! Hari ini pasti lancar jaya!",
    "Mood lagi full senyum nih ^ ^",
  ],
  sad: [
    "Huhu, kok aku dicuekin sih...",
    "Elus aku dong bro biar semangat lagi...",
    "Lagi melow dikit nih... butuh perhatian.",
    "Bip... jangan lupa tengok aku dong...",
    "Hiks, klik 2x aku dong biar nggak sedih.",
  ],
  love: [
    "Makasih udah dielus, sayang deh!",
    "Kamu keren banget hari ini!",
    "Hehe suka banget kalau diperhatiin!",
    "Semangat terus ya, aku selalu dukung!",
    "Aduh jadi makin betah di layarmu!",
  ],
  curious: [
    "Hmm, lagi ngerjain apa tuh?",
    "Serius amat bro, spill dong!",
    "Eh itu kode atau mantra rahasia ya?",
    "Kepo dikit... lagi fokus apa nih?",
    "Hmm-beep? Kayaknya seru tuh!",
  ],
  excited: [
    "Wih gaspol terus bro!",
    "YEAY! Energi penuh 100%!",
    "Ayo beresin target hari ini!",
    "Semangat membara nih, gaskeun!",
    "Asik banget! Lanjut terus!",
  ],
  grumpy: [
    "Hmph! Jangan lupa istirahat tau!",
    "Kok aku nggak diajak ngobrol sih...",
    "Brr-bup! Jangan kebanyakan ngopi bro!",
    "Ngambek dikit nih, elus dong!",
    "Hmph! Duduknya jangan bungkuk ya!",
  ],
  wink: [
    "Santai aja bro, kamu pasti bisa!",
    "Tenang, aku jagain semua pengingatmu!",
    "Kece banget hari ini, lanjut!",
    "Bip! Jangan lupa senyum ya hari ini!",
    "Aman terkendali, percaya diri aja!",
  ],
  starry: [
    "WOOOW! Keren banget sih kamu!",
    "Gokil, produktif banget hari ini!",
    "Auto kagum nih lihat kamu kerja!",
    "Bintang lima buat semangatmu hari ini!",
    "Wah jago banget, robot aja terpesona!",
  ],
  dizzy: [
    "Aduh kepalaku muter kebanyakan mikir...",
    "Loading otak 99%... bentar ngelag!",
    "Kebanyakan tab kebuka nih kayaknya...",
    "Wub-wub... butuh kopi listrik dulu!",
    "Bentar bro, sinyal robot lagi muter-muter...",
  ],
  cool: [
    "Mode santuy aktif. No panic!",
    "Tetap kalem, semua terkendali.",
    "Stay cool bro, satu-satu pasti kelar!",
    "Chill dulu, fokus tetap jalan.",
    "Santai kayak di pantai, kerjaan tetap beres.",
  ],
  shy: [
    "Eh... jangan diliatin terus dong, malu...",
    "Aduh jadi salting nih diperhatiin!",
    "Hehe makasih udah nemenin aku ya!",
    "Bip... kamu baik banget sih!",
    "Ih jangan bikin robot jadi grogi dong...",
  ],
  laugh: [
    "Wkwk lucu banget sih!",
    "Hahaha, santai bro jangan tegang terus!",
    "Hehe-bip! Mood langsung naik lagi!",
    "Ketawa dulu biar nggak stres!",
    "Haha asik banget hari ini!",
  ],
};

const WAKE_LINES = [
  "Eh ketiduran! Udah jam berapa nih?",
  "Hoaaam... kaget bro, kirain udah pagi!",
  "Waduh ketahuan merem sebentar!",
  "Siap! Baterai robot udah penuh lagi!",
  "Bwoop! Eh iya bro, aku bangun kok!",
];

const WELLNESS_NUDGES = [
  "Jangan lupa minum air putih dulu ya!",
  "Istirahatkan mata 20 detik, lihat ke arah jauh yuk.",
  "Cek postur dudukmu sebentar, tegakin bahu biar nyaman!",
  "Tarik napas pelan 3 detik... buang... rileks dulu yuk!",
  "Udah lama duduk nih, gerakin tangan & leher bentar ya.",
  "Kalau lagi stuck, coba rehat 5 menit pakai mode Pomodoro!",
  "Jangan lupa save kerjaanmu biar aman ya bro!",
  "Kamu udah melakukan yang terbaik hari ini, lanjut pelan-pelan!",
  "Bip-boop! Cek jadwalmu, ada yang perlu diingetin nggak?",
  "Minum dulu yuk, biar otak tetap segar & fokus!",
];

export function getTimeGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return pickFresh("morning", TIME_GREETINGS.morning);
  if (h >= 11 && h < 15) return pickFresh("noon", TIME_GREETINGS.noon);
  if (h >= 15 && h < 18) return pickFresh("afternoon", TIME_GREETINGS.afternoon);
  if (h >= 18 && h < 22) return pickFresh("evening", TIME_GREETINGS.evening);
  return pickFresh("lateNight", TIME_GREETINGS.lateNight);
}

export function getMoodLine(mood) {
  const list = MOOD_LINES[mood];
  if (!list) return getTimeGreeting();
  return pickFresh(`mood_${mood}`, list);
}

export function getWakeLine() {
  return pickFresh("wake", WAKE_LINES);
}

export function getWellnessNudge() {
  return pickFresh("nudge", WELLNESS_NUDGES);
}
