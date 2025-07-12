const socket = io();

const screenJoin = document.getElementById('screen-join');
const screenQuestion = document.getElementById('screen-question');
const screenDiscussion = document.getElementById('screen-discussion');
const screenVoting = document.getElementById('screen-voting');
const screenResult = document.getElementById('screen-result');
const screenWaiting = document.getElementById('screen-waiting');

const joinBtn = document.getElementById('joinBtn');
const createBtn = document.getElementById('createBtn');
const submitAnswerBtn = document.getElementById('submitAnswerBtn');
const playerListContainer = document.getElementById('playerListContainer');
const playerList = document.getElementById('playerList');
const startGameBtn = document.getElementById('startGameBtn');

let playerName = '';
let currentGameCode = '';
let playersInGame = [];
let hasVoted = false;
let isHost = false;
let voteProgressList = null;
let voteRevealTimeout = null;
let revealTimeout = null;
let lastPlayersInGame = [];

let roundState = 0; // 0 = Lobby, 1 = Antwort, 2 = Diskussion, 3 = Abstimmung, 4 = Auflösung

function getByIdSafe(id) {
  const el = document.getElementById(id);
  if (!el) {
    console.warn('Element not found:', id);
  }
  return el;
}

// Hilfsfunktion: Spielcode validieren (nur Buchstaben/Zahlen)
function isValidGameCode(code) {
  return /^[A-Z0-9]+$/i.test(code);
}

// Hilfsfunktion: Ist der aktuelle Spieler ingame?
function isCurrentPlayerIngame() {
  // Fallback: Wenn __playersInGame nicht gesetzt, lasse zu (z.B. beim ersten Start)
  if (!window.__playersInGame) return true;
  return window.__playersInGame.includes(playerName);
}

// Spiel erstellen
createBtn.onclick = () => {
  playerName = document.getElementById('username').value.trim();
  let inputCode = document.getElementById('gameCode').value.trim();
  if (!playerName) {
    document.getElementById('join-error').textContent = 'Bitte gib einen Benutzernamen ein!';
    return;
  }
  // Wenn Spielcode-Feld ausgefüllt, nutze diesen Code (Großschreibung, nur Buchstaben/Zahlen)
  let customCode = '';
  if (inputCode) {
    customCode = inputCode.toUpperCase();
    if (!isValidGameCode(customCode)) {
      document.getElementById('join-error').textContent = 'Spielcode darf nur Buchstaben und Zahlen enthalten!';
      return;
    }
  }
  socket.emit('createGame', { name: playerName, customCode }, (res) => {
    if (res.error) {
      document.getElementById('join-error').textContent = res.error;
    } else {
      currentGameCode = res.code;
      isHost = true;
      document.getElementById('gameCode').value = currentGameCode;
      showLobby();
    }
  });
};

// Spiel beitreten
joinBtn.onclick = () => {
  currentGameCode = document.getElementById('gameCode').value.trim().toUpperCase();
  playerName = document.getElementById('username').value.trim();
  if (!currentGameCode && !playerName) {
    document.getElementById('join-error').textContent = 'Bitte gib einen Spielcode und einen Benutzernamen ein!';
    return;
  }
  if (!currentGameCode) {
    document.getElementById('join-error').textContent = 'Bitte gib einen Spielcode ein!';
    return;
  }
  if (!playerName) {
    document.getElementById('join-error').textContent = 'Bitte gib einen Benutzernamen ein!';
    return;
  }

  socket.emit('joinGame', { code: currentGameCode, name: playerName }, (res) => {
    if (res.error) {
      document.getElementById('join-error').textContent = res.error;
    } else {
      isHost = false;
      showLobby();
    }
  });
};

function showLobby() {
  playerListContainer.style.display = 'block';
  startGameBtn.style.display = 'none';
  document.getElementById('join-error').textContent = '';
  document.getElementById('gameCode').value = currentGameCode;
  updateLobbyStatus('Warte auf weitere Spieler...');
}

// Spielerlisten-Update empfangen
socket.on('playerList', ({ players, hostName }) => {
  // Zeige Statusänderungen (Beitritt/Verlassen)
  if (lastPlayersInGame.length && players.length !== lastPlayersInGame.length) {
    if (players.length > lastPlayersInGame.length) {
      updateLobbyStatus('Ein Spieler ist beigetreten.');
    } else {
      updateLobbyStatus('Ein Spieler hat den Raum verlassen.');
    }
    setTimeout(() => updateLobbyStatus('Warte auf weitere Spieler...'), 2000);
  }
  lastPlayersInGame = [...players];

  playersInGame = players;
  playerList.innerHTML = '';
  players.forEach(obj => {
    const name = obj.name;
    const ingame = obj.ingame;
    let status = ingame ? ' (im Spiel)' : ' (Lobby)';
    const li = document.createElement('li');
    li.textContent = name + (name === hostName ? ' (Host)' : '') + status;
    playerList.appendChild(li);
  });
  // Host sieht Start-Button, wenn genug Spieler
  if (isHost && players.length >= 3) {
    startGameBtn.style.display = 'block';
    updateLobbyStatus('Du kannst das Spiel starten!');
  } else if (isHost) {
    updateLobbyStatus('Mindestens 3 Spieler benötigt.');
  }
  playerListContainer.style.display = 'block';
});

// Zeige Status in der Lobby
function updateLobbyStatus(msg) {
  let statusDiv = document.getElementById('lobbyStatus');
  if (!statusDiv) {
    statusDiv = document.createElement('div');
    statusDiv.id = 'lobbyStatus';
    statusDiv.style.margin = '0.5em 0 0.5em 0';
    statusDiv.style.fontWeight = 'bold';
    playerListContainer.insertBefore(statusDiv, playerListContainer.firstChild);
  }
  statusDiv.textContent = msg;
}

// Fehleranzeige für ungültigen Spielcode
socket.on('noGameFound', () => {
  document.getElementById('join-error').textContent = 'Kein Spiel mit diesem Code gefunden!';
  playerListContainer.style.display = 'none';
});

// Host startet das Spiel
startGameBtn.onclick = () => {
  socket.emit('startGame', { code: currentGameCode });
};

// Wenn das Spiel startet, Lobby ausblenden
socket.on('gameStarted', () => {
  setRoundState(1); // Antwortphase
});

socket.on('question', (data) => {
  // Setze die aktuelle Ingame-Spieler-Liste, falls vom Server gesendet
  if (data && data.playersInGame) {
    window.__playersInGame = data.playersInGame;
  }
  // Fallback: Wenn nicht vorhanden, versuche aus dem Voting-Screen oder der letzten Antwortliste zu übernehmen
  if (!window.__playersInGame && data && data.players) {
    window.__playersInGame = data.players;
  }
  // Nur anzeigen, wenn Spieler wirklich im Spiel ist
  if (!isCurrentPlayerIngame()) {
    setRoundState(0);
    return;
  }
  // Zeige Fragescreen erst, wenn Frage und Placeholder da sind
  if (data && data.question && data.placeholder) {
    document.getElementById('questionText').textContent = data.question;
    const answerInput = document.getElementById('answerInput');
    answerInput.value = '';
    answerInput.placeholder = data.placeholder || 'Deine Antwort';
    setRoundState(1);
  }
  // Speichere, ob man Impostor ist (wenn Frage abweicht)
  let isImpostor = false;
  if (data && data.question && data.placeholder) {
    // Wenn die Placeholder-Kategorie im Text steht, kann man das nutzen, aber besser: Server sendet explizit Info
    // Wir merken uns, ob die Frage für den Impostor ist (wird im nächsten Schritt vom Server gesendet)
    if (data.isImpostor) isImpostor = true;
  }
  // Speichere für Voting-Screen
  window.__isImpostor = !!data.isImpostor;
});

submitAnswerBtn.onclick = () => {
  const answer = document.getElementById('answerInput').value.trim();
  if (!answer) return;

  socket.emit('submitAnswer', answer);
  setRoundState(0); // Nach Antwort: Warten/Lobby bis Diskussion startet
  // Zeige immer den Bitte-Warten-Screen nach Antwort
  if (screenWaiting) screenWaiting.style.display = 'block';
  if (screenQuestion) screenQuestion.style.display = 'none';
  if (screenDiscussion) screenDiscussion.style.display = 'none';
  if (screenVoting) screenVoting.style.display = 'none';
  if (screenResult) screenResult.style.display = 'none';
  if (screenJoin) screenJoin.style.display = 'none';
  if (playerListContainer) playerListContainer.style.display = 'none';
};

socket.on('startDiscussion', (data) => {
  // Setze die aktuelle Ingame-Spieler-Liste aus den Antworten
  window.__playersInGame = data.answers.map(a => a.name);

  // Nur anzeigen, wenn Spieler wirklich im Spiel ist
  if (!isCurrentPlayerIngame()) {
    setRoundState(0);
    return;
  }
  setRoundState(2);

  // Antworten der Mitspieler immer korrekt anzeigen, auch wenn der Screen schon sichtbar ist
  playersInGame = data.answers.map(a => a.name);

  // Setze die Diskussionsfrage und Antworten
  document.getElementById('mainQuestion').textContent = `Frage: ${data.mainQuestion}`;
  const answersList = document.getElementById('answersList');
  answersList.innerHTML = '';
  data.answers.forEach(({ name, answer }) => {
    const li = document.createElement('li');
    li.textContent = `${name}: ${answer}`;
    answersList.appendChild(li);
  });

  // Impostor-Alert immer anzeigen, wenn nötig
  if (window.__isImpostor) {
    setTimeout(() => {
      alert('Du bist der IMPOSTOR! Versuche, nicht aufzufallen.');
    }, 100); // Verzögerung, damit Screen sichtbar ist
  }

  // "Zur Abstimmung"-Button immer anzeigen und aktivieren
  const voteBtn = document.getElementById('voteBtn');
  if (voteBtn) {
    voteBtn.style.display = 'block';
    voteBtn.disabled = false;
    voteBtn.onclick = () => startVoting();
  }

  // Stelle sicher, dass der Bitte-Warten-Screen ausgeblendet wird
  screenWaiting.style.display = 'none';
});

function startVoting() {
  // Nur anzeigen, wenn Spieler wirklich im Spiel ist
  if (!isCurrentPlayerIngame()) {
    screenDiscussion.style.display = 'none';
    screenQuestion.style.display = 'none';
    screenResult.style.display = 'none';
    screenJoin.style.display = 'none';
    screenWaiting.style.display = 'none';
    updateLobbyStatus('Du bist aktuell nicht im Spiel. Warte auf die nächste Runde.');
    playerListContainer.style.display = 'block';
    return;
  }
  setRoundState(3);

  screenDiscussion.style.display = 'none';

  // Voting-Screen bauen
  let votingDiv = document.getElementById('screen-voting');
  if (!votingDiv) {
    votingDiv = document.createElement('div');
    votingDiv.id = 'screen-voting';
    document.body.appendChild(votingDiv);
  }
  votingDiv.style.display = 'block';
  votingDiv.innerHTML = '';

  // Impostor-Hinweis
  if (window.__isImpostor) {
    const impostorHint = document.createElement('div');
    impostorHint.textContent = 'DU bist der IMPOSTOR!';
    impostorHint.style.background = 'var(--orange)';
    impostorHint.style.color = 'var(--light)';
    impostorHint.style.fontWeight = 'bold';
    impostorHint.style.fontSize = '1.2em';
    impostorHint.style.padding = '0.7em 1em';
    impostorHint.style.marginBottom = '1em';
    impostorHint.style.textAlign = 'center';
    impostorHint.style.letterSpacing = '1px';
    votingDiv.appendChild(impostorHint);
  }

  const title = document.createElement('h2');
  title.textContent = 'Stimme für den Impostor ab!';
  votingDiv.appendChild(title);

  hasVoted = false;

  // Nur ingame-Spieler dürfen abstimmen und werden angezeigt
  const ingameNames = window.__playersInGame || [];
  const ul = document.createElement('ul');
  votingDiv.appendChild(ul);

  ingameNames.forEach(name => {
    if (name === playerName) return; // Nicht für sich selbst stimmen

    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.textContent = name;
    btn.onclick = () => {
      if (hasVoted) return;
      socket.emit('castVote', name);
      hasVoted = true;
      votingDiv.innerHTML = '<p>Danke für deine Stimme! Warte auf die anderen...</p>';
      showVoteProgress([]);
    };
    li.appendChild(btn);
    ul.appendChild(li);
  });

  // Anzeige für abgegebene Stimmen (nur wer hat schon abgestimmt, nur ingame)
  voteProgressList = document.createElement('div');
  voteProgressList.id = 'votesList';
  voteProgressList.style.marginTop = '20px';
  votingDiv.appendChild(voteProgressList);
  showVoteProgress([]);
}

// Zeige Fortschritt der abgegebenen Stimmen (nur Namen, nicht für wen)
function showVoteProgress(voted) {
  // Nur ingame-Spieler anzeigen
  if (!voteProgressList || !Array.isArray(window.__playersInGame)) return;
  voteProgressList.innerHTML = '<h3>Abgestimmt:</h3>';
  const ul = document.createElement('ul');
  voteProgressList.appendChild(ul);
  window.__playersInGame.forEach(name => {
    const li = document.createElement('li');
    li.textContent = name + (voted.includes(name) ? ' ✅' : '');
    ul.appendChild(li);
  });
}

// Fortschritt der Votes (nur wer hat schon abgestimmt)
socket.on('voteProgress', ({ voted }) => {
  showVoteProgress(voted);
});

// Stimmen werden offenbart (wer für wen gestimmt hat)
// Speichere die Votes für die Ergebnisanzeige
let lastVotes = {};
socket.on('voteReveal', (votes) => {
  lastVotes = votes;
  if (!voteProgressList) return;
  voteProgressList.innerHTML = '<h3>Stimmen:</h3>';
  const ul = document.createElement('ul');
  voteProgressList.appendChild(ul);
  // Nur ingame-Spieler anzeigen
  const ingameNames = window.__playersInGame || [];
  Object.entries(votes).forEach(([voter, votedFor]) => {
    if (ingameNames.includes(voter)) {
      const li = document.createElement('li');
      li.textContent = `${voter} stimmt für ${votedFor}`;
      ul.appendChild(li);
    }
  });
  // Zeige die Liste auch im Abstimmungsbereich, falls Voting-Screen noch sichtbar
  let votingDiv = document.getElementById('screen-voting');
  if (votingDiv) {
    votingDiv.style.display = 'none'; // Voting-Screen ausblenden
  }

  // Timer ausblenden nach Auswertung
  if (voteTimerDiv) voteTimerDiv.style.display = 'none';
  if (voteTimerInterval) {
    clearInterval(voteTimerInterval);
    voteTimerInterval = null;
  }
  // Wechsel direkt zum Ergebnis-Screen
  //setTimeout(() => {
  //setRoundState(4); // Auflösung anzeigen
  //document.getElementById('resultText').textContent = 'Ergebnisse werden angezeigt...';
  //}, 1000)

});

// Abstimmungs-Button anpassen, falls vorhanden
const voteBtn = document.getElementById('voteBtn');
if (voteBtn) voteBtn.textContent = 'Abstimmung starten';

// Buttons für Spielende/Lobby nur einmal erzeugen
function ensureResultButtons() {
  let backToLobbyBtn = document.getElementById('backToLobbyBtn');
  if (!backToLobbyBtn) {
    backToLobbyBtn = document.createElement('button');
    backToLobbyBtn.id = 'backToLobbyBtn';
    backToLobbyBtn.textContent = 'Zurück zur Lobby';
    backToLobbyBtn.style.display = 'none';
    backToLobbyBtn.onclick = () => {
      screenResult.style.display = 'none';
      screenJoin.style.display = 'block';
      playerListContainer.style.display = 'block';
      startGameBtn.style.display = 'none';
      document.getElementById('resultText').textContent = '';
      // Entferne die Vote-Details falls vorhanden
      const voteDetails = document.getElementById('voteDetails');
      if (voteDetails) voteDetails.remove();
    };
    document.getElementById('screen-result').appendChild(backToLobbyBtn);
  }
}
ensureResultButtons();

// Spieler kann Raum verlassen
if (playerListContainer) {
  let leaveBtn = document.getElementById('leaveRoomBtn');
  if (!leaveBtn) {
    leaveBtn = document.createElement('button');
    leaveBtn.id = 'leaveRoomBtn';
    leaveBtn.textContent = 'Raum verlassen';
    leaveBtn.onclick = () => {
      socket.emit('leaveRoom', { code: currentGameCode });
      playerListContainer.style.display = 'none';
      screenJoin.style.display = 'block';
      startGameBtn.style.display = 'none';
      currentGameCode = '';
      isHost = false;
      playerName = '';
      document.getElementById('username').value = '';
      document.getElementById('gameCode').value = '';
    };
    playerListContainer.appendChild(leaveBtn);
  }
}

// Entferne die Beispiel-Funktion am Ende der Datei:
// function safeButton(id, text, handler) {
//   let btn = getByIdSafe(id);
//   if (!btn) {
//     btn = document.createElement('button');
//     btn.id = id;
//     btn.textContent = text;
//     document.body.appendChild(btn);
//   }
//   btn.onclick = handler;
//   return btn;
// }

function setRoundState(state) {
  roundState = state;
  updateScreen();
}

function updateScreen() {
  // Lobby
  if (roundState === 0 || !isCurrentPlayerIngame()) {
    if (screenJoin) screenJoin.style.display = 'none';
    if (screenQuestion) screenQuestion.style.display = 'none';
    if (screenDiscussion) screenDiscussion.style.display = 'none';
    if (screenVoting) screenVoting.style.display = 'none';
    if (screenResult) screenResult.style.display = 'none';
    if (screenWaiting) screenWaiting.style.display = 'none';
    if (playerListContainer) playerListContainer.style.display = 'block';
    updateLobbyStatus('Du bist aktuell nicht im Spiel. Warte auf die nächste Runde.');
    return;
  }
  // Antwort
  if (roundState === 1) {
    if (screenJoin) screenJoin.style.display = 'none';
    if (screenQuestion) screenQuestion.style.display = 'block';
    if (screenDiscussion) screenDiscussion.style.display = 'none';
    if (screenVoting) screenVoting.style.display = 'none';
    if (screenResult) screenResult.style.display = 'none';
    if (screenWaiting) screenWaiting.style.display = 'none';
    if (playerListContainer) playerListContainer.style.display = 'none';
    return;
  }
  // Diskussion
  if (roundState === 2) {
    if (screenJoin) screenJoin.style.display = 'none';
    if (screenQuestion) screenQuestion.style.display = 'none';
    if (screenDiscussion) screenDiscussion.style.display = 'block';
    if (screenVoting) screenVoting.style.display = 'none';
    if (screenResult) screenResult.style.display = 'none';
    if (screenWaiting) screenWaiting.style.display = 'none';
    if (playerListContainer) playerListContainer.style.display = 'none';
    return;
  }
  // Abstimmung
  if (roundState === 3) {
    if (screenJoin) screenJoin.style.display = 'none';
    if (screenQuestion) screenQuestion.style.display = 'none';
    if (screenDiscussion) screenDiscussion.style.display = 'none';
    // Voting-Screen bleibt IMMER sichtbar während roundState === 3!
    if (screenVoting) screenVoting.style.display = 'block';
    if (screenResult) screenResult.style.display = 'none';
    if (screenWaiting) screenWaiting.style.display = 'none';
    if (playerListContainer) playerListContainer.style.display = 'none';
    return;
  }
  // Auflösung
  if (roundState === 4) {
    if (screenJoin) screenJoin.style.display = 'none';
    if (screenQuestion) screenQuestion.style.display = 'none';
    if (screenDiscussion) screenDiscussion.style.display = 'none';
    if (screenVoting) screenVoting.style.display = 'none';
    if (screenResult) screenResult.style.display = 'block';
    if (screenWaiting) screenWaiting.style.display = 'none';
    if (playerListContainer) playerListContainer.style.display = 'none';
    return;
  }
}

// Abstimmungs-Timer anzeigen (gut sichtbar, oben rechts im Abstimmungs-Screen)
let voteTimerDiv = null;
let voteTimerInterval = null;
socket.on('voteTimerStarted', ({ seconds }) => {
  setRoundState(3);
  let votingDiv = document.getElementById('screen-voting');
  if (!voteTimerDiv) {
    voteTimerDiv = document.createElement('div');
    voteTimerDiv.id = 'voteTimerDiv';
    voteTimerDiv.style.position = 'absolute';
    voteTimerDiv.style.top = '12px';
    voteTimerDiv.style.right = '18px';
    voteTimerDiv.style.zIndex = '10';
    voteTimerDiv.style.fontWeight = 'bold';
    voteTimerDiv.style.color = 'var(--orange)';
    voteTimerDiv.style.background = 'var(--light)';
    voteTimerDiv.style.border = '2px solid var(--orange)';
    voteTimerDiv.style.borderRadius = '8px';
    voteTimerDiv.style.padding = '0.5em 1em';
    voteTimerDiv.style.fontSize = '1.1em';
    voteTimerDiv.style.boxShadow = '0 2px 12px rgba(237,75,0,0.12)';
    if (votingDiv) votingDiv.appendChild(voteTimerDiv);
  }
  voteTimerDiv.style.display = 'block';
  let timeLeft = seconds;
  voteTimerDiv.textContent = `⏳ ${timeLeft}s`;
  if (voteTimerInterval) clearInterval(voteTimerInterval);
  voteTimerInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft > 0) {
      voteTimerDiv.textContent = `⏳ ${timeLeft}s`;
    } else {
      voteTimerDiv.textContent = '⏳ Abstimmung beendet!';
      clearInterval(voteTimerInterval);
      voteTimerInterval = null;
      // Timer bleibt sichtbar bis zur Auswertung, Abstimmungs-Screen bleibt offen
    }
  }, 1000);
});

function updateScreen() {
  // Lobby
  if (roundState === 0 || !isCurrentPlayerIngame()) {
    if (screenJoin) screenJoin.style.display = 'none';
    if (screenQuestion) screenQuestion.style.display = 'none';
    if (screenDiscussion) screenDiscussion.style.display = 'none';
    if (screenVoting) screenVoting.style.display = 'none';
    if (screenResult) screenResult.style.display = 'none';
    if (screenWaiting) screenWaiting.style.display = 'none';
    if (playerListContainer) playerListContainer.style.display = 'block';
    updateLobbyStatus('Du bist aktuell nicht im Spiel. Warte auf die nächste Runde.');
    return;
  }
  // Antwort
  if (roundState === 1) {
    if (screenJoin) screenJoin.style.display = 'none';
    if (screenQuestion) screenQuestion.style.display = 'block';
    if (screenDiscussion) screenDiscussion.style.display = 'none';
    if (screenVoting) screenVoting.style.display = 'none';
    if (screenResult) screenResult.style.display = 'none';
    if (screenWaiting) screenWaiting.style.display = 'none';
    if (playerListContainer) playerListContainer.style.display = 'none';
    return;
  }
  // Diskussion
  if (roundState === 2) {
    if (screenJoin) screenJoin.style.display = 'none';
    if (screenQuestion) screenQuestion.style.display = 'none';
    if (screenDiscussion) screenDiscussion.style.display = 'block';
    if (screenVoting) screenVoting.style.display = 'none';
    if (screenResult) screenResult.style.display = 'none';
    if (screenWaiting) screenWaiting.style.display = 'none';
    if (playerListContainer) playerListContainer.style.display = 'none';
    return;
  }
  // Abstimmung
  if (roundState === 3) {
    if (screenJoin) screenJoin.style.display = 'none';
    if (screenQuestion) screenQuestion.style.display = 'none';
    if (screenDiscussion) screenDiscussion.style.display = 'none';
    // Voting-Screen bleibt IMMER sichtbar während roundState === 3!
    if (screenVoting) screenVoting.style.display = 'block';
    if (screenResult) screenResult.style.display = 'none';
    if (screenWaiting) screenWaiting.style.display = 'none';
    if (playerListContainer) playerListContainer.style.display = 'none';
    return;
  }
  // Auflösung
  if (roundState === 4) {
    if (screenJoin) screenJoin.style.display = 'none';
    if (screenQuestion) screenQuestion.style.display = 'none';
    if (screenDiscussion) screenDiscussion.style.display = 'none';
    if (screenVoting) screenVoting.style.display = 'none';
    if (screenResult) screenResult.style.display = 'block';
    if (screenWaiting) screenWaiting.style.display = 'none';
    if (playerListContainer) playerListContainer.style.display = 'none';
    return;
  }
}

socket.on('reveal', ({ impostorName, impostorWon }) => {
  setRoundState(4); // Wechsel auf Ergebnisbildschirm

  let resultText = '';
  if (impostorName) {
    resultText = `Der Impostor war: ${impostorName}. `;
    resultText += impostorWon
      ? 'Der Impostor konnte unentdeckt bleiben!'
      : 'Der Impostor wurde enttarnt!';
  } else {
    resultText = 'Unentschieden oder Spiel wurde abgebrochen.';
  }

  const resultEl = document.getElementById('resultText');
  if (resultEl) resultEl.textContent = resultText;

  // Voting-Screen ausblenden
  const votingScreen = document.getElementById('screen-voting');
  if (votingScreen) votingScreen.style.display = 'none';
});

const stayInRoomBtn = document.getElementById('stayInRoomBtn');
if (stayInRoomBtn) {
  stayInRoomBtn.onclick = () => {
    screenResult.style.display = 'none';
    playerListContainer.style.display = 'block';
    startGameBtn.style.display = isHost && playersInGame.length >= 3 ? 'block' : 'none';
    document.getElementById('resultText').textContent = '';
    const voteDetails = document.getElementById('voteDetails');
    if (voteDetails) voteDetails.remove();
  };
}

const leaveRoomToLobbyBtn = document.getElementById('leaveRoomToLobbyBtn');
if (leaveRoomToLobbyBtn) {
  leaveRoomToLobbyBtn.onclick = () => {
    socket.emit('leaveRoom', { code: currentGameCode });
    screenResult.style.display = 'none';
    screenJoin.style.display = 'block';
    playerListContainer.style.display = 'none';
    startGameBtn.style.display = 'none';
    currentGameCode = '';
    isHost = false;
    playerName = '';
    document.getElementById('username').value = '';
    document.getElementById('gameCode').value = '';
    document.getElementById('resultText').textContent = '';
    const voteDetails = document.getElementById('voteDetails');
    if (voteDetails) voteDetails.remove();
  };
}
