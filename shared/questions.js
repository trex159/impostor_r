const questions = {
  person_fiktiv: [
    "Mit wem würdest du gerne einen Tag verbringen?",
    "Wen bewunderst du am meisten?",
    "Mit welcher fiktiven Person würdest du dein Leben tauschen wollen?",
    "Von welchem Charakter aus einem Buch/Film/Serie würdest du dich adoptieren lassen?",
    "Welchen Charakter aus einem Buch/Film/Serie würdest du heiraten?"
  ],
  person_real: [
    "Mit wem würdest du gerne einen Tag verbringen?",
    "Wen bewunderst du am meisten?",
    "Wer war dein schlimmster Lehrer?",
    "Wer hat dich zuletzt zum Lachen gebracht?",
    "Mit welcher bekannten Person würdest du dein Leben tauschen wollen?"
  ],
  ort_land: [
    "Wo warst du zuletzt im Urlaub?",
    "Wohin würdest du gerne auswandern?",
    "Wo würdest du niemals hin auswandern?",
    "Welches Land ist am Gefährlichsten?",
    "Wo hast du das leckerste Essen gegessen?"
  ],
  zahl_klein: [
    "Wie viele Haustiere hattest du bisher?",
    "Wie viele Länder hast du schon besucht?",
    "Wie oft checkst du dein Handy pro Tag?",
    "Wie viele Stunden schläfst du normalerweise?"
  ],
  alter: [
    "Ab wann findest du sollte man saufen dürfen?",
    "Ab wann findest du sollte man heiraten dürfen?",
    "Wie alt warst du als du deinen ersten Crush hattest?",
    "Wenn du für immer ein Alter haben müsstest, welches wäre es?",

  ],
  film: [
    "Welcher Film/Serie hast du zuletzt geschaut?",
    "Welcher Film hat dich zum Weinen gebracht?",
    "Wer ist dein Lieblingscharakter aus einem Film?",
    "Welchen Film könntest du immer wieder sehen?",
    "Welcher Film beschreibt dich am besten?"
  ],
  Lebensmittel: [
  "Was würdest du jeden Tag essen können?",
  "Was hast du zuletzt gegessen?",
  "Was sollte man niemals zum Frühstück essen?",
  "Was war das Leckerste, das du je gegessen hast?",
  "Was würdest du sofort von der Speisekarte streichen?"
  ],
  spielfigur: [
  "Welchen Game-Charakter findest du am coolsten?",
  "Von welchem Game-Charakter hättest du gern die Fähigkeiten?",
  "Welcher Game-Charakter war für dich immer zu schwer zu besiegen?",
  "Welchen Game-Charakter würdest du nie in echt treffen wollen?",
  "Welcher Game-Charakter wär ein guter Lehrer?"
  ],
  verrückter_Ort: [
    "Was ist der seltsmaste Ort, an dem du je geschlafen hast?",
    "Was ist der ungewöhnlichste Ort, an dem du je warst?",
    "Was ist der verrückteste Ort, an dem du je gegessen hast?",
    "Was ist der unpassendste Ort, an dem du mal auf dem Klo warst?",
    "Was ist der komischste Ort, an dem du Hausaufgaben gemacht hast?"
  ],
  Mitspieler: [
    "Wer ist der beste Spieler in diesem Raum?",
    "Wer ist der schlechteste Spieler in diesem Raum?",
    "Wer ist der lustigste Spieler in diesem Raum?",
    "Wer ist der kreativste Spieler in diesem Raum?",
    "Wer ist der faulste Spieler in diesem Raum?",
    "Welcher Mitspieler hat am meisten Mundgeruch?",
  ],
  tier: [
    "Welches Tier wärst du gerne?",
    "Welches Tier findest du am hässlichsten?",
    "Welches Tier findest du am leckersten?",
    "Welches Tier würdest du niemals essen?",
    "Welches Tier würdest du niemals streicheln?",
    "Gegen welches Tier würdest du am ehesten 1 vs 1  kämpfen?"
  ]

};

function getRandomCategory() {
  const keys = Object.keys(questions);
  return keys[Math.floor(Math.random() * keys.length)];
}

function getRandomQuestion(category) {
  const list = questions[category];
  return list[Math.floor(Math.random() * list.length)];
}

module.exports = {
  questions,
  getRandomCategory,
  getRandomQuestion
};
