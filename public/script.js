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

function getByIdSafe(id) {
  const el = document.getElementById(id);
  if (!el) {
    console.warn('Element not found:', id);
  }
  return el;
}

// Spiel erstellen
createBtn.onclick = () => {
  playerName = document.getElementById('username').value.trim();
  if (!playerName) {
    document.getElementById('join-error').textContent = 'Bitte gib einen Benutzernamen ein!';
    return;
  }
  socket.emit('createGame', { name: playerName }, (res) => {
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
  players.forEach(name => {
    const li = document.createElement('li');
    li.textContent = name + (name === hostName ? ' (Host)' : '');
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
  screenJoin.style.display = 'none';
});

socket.on('question', (data) => {
  screenQuestion.style.display = 'block';
  screenDiscussion.style.display = 'none';
  screenResult.style.display = 'none';
  screenJoin.style.display = 'none';
  // Speichere, ob man Impostor ist (wenn Frage abweicht)
  let isImpostor = false;
  if (data && data.question && data.placeholder) {
    // Wenn die Placeholder-Kategorie im Text steht, kann man das nutzen, aber besser: Server sendet explizit Info
    // Wir merken uns, ob die Frage für den Impostor ist (wird im nächsten Schritt vom Server gesendet)
    if (data.isImpostor) isImpostor = true;
  }
  // Speichere für Voting-Screen
  window.__isImpostor = !!data.isImpostor;

  document.getElementById('questionText').textContent = data.question;
  const answerInput = document.getElementById('answerInput');
  answerInput.value = '';
  answerInput.placeholder = data.placeholder || 'Deine Antwort';
});

submitAnswerBtn.onclick = () => {
  const answer = document.getElementById('answerInput').value.trim();
  if (!answer) return;

  socket.emit('submitAnswer', answer);
  screenQuestion.style.display = 'none';
  screenWaiting.style.display = 'block';
};

socket.on('startDiscussion', (data) => {
  screenDiscussion.style.display = 'block';
  screenQuestion.style.display = 'none';
  screenResult.style.display = 'none';
  screenJoin.style.display = 'none';
  screenWaiting.style.display = 'none';

  playersInGame = data.answers.map(a => a.name);

  document.getElementById('mainQuestion').textContent = `Frage: ${data.mainQuestion}`;
  const answersList = document.getElementById('answersList');
  answersList.innerHTML = '';
  data.answers.forEach(({ name, answer }) => {
    const li = document.createElement('li');
    li.textContent = `${name}: ${answer}`;
    answersList.appendChild(li);
  });

  // "Zur Abstimmung"-Button immer anzeigen und aktivieren
  const voteBtn = document.getElementById('voteBtn');
  if (voteBtn) {
    voteBtn.style.display = 'block';
    voteBtn.disabled = false;
    voteBtn.onclick = () => startVoting();
  }
});

function startVoting() {
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

  const ul = document.createElement('ul');
  votingDiv.appendChild(ul);

  playersInGame.forEach(name => {
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

  // Anzeige für abgegebene Stimmen (nur wer hat schon abgestimmt)
  voteProgressList = document.createElement('div');
  voteProgressList.id = 'votesList';
  voteProgressList.style.marginTop = '20px';
  votingDiv.appendChild(voteProgressList);
  showVoteProgress([]);
}

// Zeige Fortschritt der abgegebenen Stimmen (nur Namen, nicht für wen)
function showVoteProgress(voted) {
  if (!voteProgressList || !Array.isArray(playersInGame)) return;
  voteProgressList.innerHTML = '<h3>Abgestimmt:</h3>';
  const ul = document.createElement('ul');
  voteProgressList.appendChild(ul);
  playersInGame.forEach(name => {
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
socket.on('voteReveal', (votes) => {
  if (!voteProgressList) return;
  voteProgressList.innerHTML = '<h3>Stimmen:</h3>';
  const ul = document.createElement('ul');
  voteProgressList.appendChild(ul);
  Object.entries(votes).forEach(([voter, votedFor]) => {
    const li = document.createElement('li');
    li.textContent = `${voter} stimmt für ${votedFor}`;
    ul.appendChild(li);
  });
  // Zeige die Liste auch im Abstimmungsbereich, falls Voting-Screen noch sichtbar
  let votingDiv = document.getElementById('screen-voting');
  if (votingDiv) {
    votingDiv.style.display = 'block';
  }
});

// Auflösung nach Stimmen-Enthüllung
socket.on('reveal', (data) => {
  const votingDiv = document.getElementById('screen-voting');
  if (votingDiv) votingDiv.style.display = 'none';

  screenResult.style.display = 'block';
  screenDiscussion.style.display = 'none';
  screenQuestion.style.display = 'none';
  screenJoin.style.display = 'none';

  let text = '';
  if (data.impostorName) {
    text = `Der Impostor war: ${data.impostorName}`;
    if (data.impostorWon) {
      text += ' – Der Impostor hat GEWONNEN!';
    } else {
      text += ' – Der Impostor wurde gefunden!';
    }
  } else {
    text = 'Unentschieden! Niemand wird eliminiert.';
  }
  document.getElementById('resultText').textContent = text;
});

// Host bekommt "Spiel beenden"-Knopf nach Auflösung
socket.on('showEndGameBtn', () => {
  const btn = document.createElement('button');
  btn.textContent = 'Spiel beenden';
  btn.onclick = () => {
    // Nach Spielende zurück in die Lobby
    screenResult.style.display = 'none';
    screenJoin.style.display = 'block';
    playerListContainer.style.display = 'block';
    startGameBtn.style.display = 'none';
    document.getElementById('resultText').textContent = '';
  };
  document.getElementById('screen-result').appendChild(btn);
});

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

