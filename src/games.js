/**
 * Mini Games with the Robot: Suit (Batu-Gunting-Kertas) & Lempar Koin
 */

const CHOICES = {
  batu: { label: "Batu", emoji: "✊" },
  gunting: { label: "Gunting", emoji: "✌" },
  kertas: { label: "Kertas", emoji: "✋" },
};

const KEYS = Object.keys(CHOICES);

export class MiniGameManager {
  constructor() {
    this.userScore = 0;
    this.robotScore = 0;
  }

  playSuit(userPick) {
    const robotPick = KEYS[Math.floor(Math.random() * KEYS.length)];
    let outcome = "draw";

    if (userPick === robotPick) {
      outcome = "draw";
    } else if (
      (userPick === "batu" && robotPick === "gunting") ||
      (userPick === "gunting" && robotPick === "kertas") ||
      (userPick === "kertas" && robotPick === "batu")
    ) {
      outcome = "win";
      this.userScore += 1;
    } else {
      outcome = "lose";
      this.robotScore += 1;
    }

    return {
      user: CHOICES[userPick],
      robot: CHOICES[robotPick],
      outcome,
      userScore: this.userScore,
      robotScore: this.robotScore,
    };
  }

  flipCoin() {
    const isHeads = Math.random() < 0.5;
    return {
      side: isHeads ? "ANGKA" : "GAMBAR",
      emoji: isHeads ? "🪙" : "⭐",
    };
  }
}
