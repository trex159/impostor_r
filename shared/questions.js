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
    "Wie alt wars du als du deinen ersten Crush hattest?",
    "Wenn du für immer ein Alter haben müsstest, welches wäre es?",

  ],
  film: [
    "Welcher Film/Serie hast du zuletzt geschaut?",
    "Welcher Film hat dich zum Weinen gebracht?",
    "Wer ist dein Lieblingscharakter aus einem Film?",
    "Welchen Film könntest du immer wieder sehen?",
    "Welcher Film beschreibt dich am besten?"
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
