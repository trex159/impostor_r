const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const {
  questions,
  getRandomCategory,
  getRandomQuestion
} = require('./shared/questions');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Public Ordner für Frontend
app.use(express.static(path.join(__dirname, 'public')));

const games = new Map(); // Map<code, GameSession>

function generateCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

// Sende regelmäßig die Spielerlisten an alle Räume
setInterval(() => {
  for (const game of games.values()) {
    sendPlayerList(game);
  }
}, 3000); // alle 3 Sekunden

io.on('connection', (socket) => {
  console.log(`🟢 Neue Verbindung: ${socket.id}`);

  // Spiel erstellen
  socket.on('createGame', ({ name }, callback) => {
    try {
      if (!name) return callback({ error: 'Name erforderlich' });
      let code;
      do {
        code = generateCode();
      } while (games.has(code));
      games.set(code, {
        code,
        players: [],
        answers: [],
        votes: {},
        state: 'lobby',
        hostId: socket.id
      });
      console.log(`🟠 Raum erstellt: ${code} von ${name} (${socket.id})`);
      const game = games.get(code);
      game.players.push({ id: socket.id, name });
      socket.join(code);
      callback({ success: true, code });
      sendPlayerList(game);
    } catch (err) {
      callback({ error: 'Serverfehler beim Erstellen des Spiels.' });
    }
  });

  socket.on('joinGame', ({ code, name }, callback) => {
    try {
      if (!code || !name) return callback({ error: 'Ungültiger Code oder Name' });

      if (!games.has(code)) {
        callback({ error: 'Kein Spiel mit diesem Code gefunden!' });
        socket.emit('noGameFound');
        return;
      }

      const game = games.get(code);

      if (game.players.find(p => p.id === socket.id)) {
        return callback({ error: 'Du bist bereits in diesem Spiel.' });
      }

      // Name darf nicht doppelt sein
      if (game.players.find(p => p.name === name)) {
        return callback({ error: 'Name bereits vergeben.' });
      }

      game.players.push({ id: socket.id, name });
      socket.join(code);
      callback({ success: true, code });
      sendPlayerList(game);
    } catch (err) {
      callback({ error: 'Serverfehler beim Beitreten.' });
    }
  });

  // Host startet das Spiel
  socket.on('startGame', ({ code }) => {
    try {
      const game = games.get(code);
      if (!game) return;
      if (game.hostId !== socket.id) return; // Nur Host darf starten
      if (game.players.length < 3) return;
      startGame(code);
      io.to(code).emit('gameStarted');
      sendPlayerList(game);
    } catch (err) {
      // ignore
    }
  });

  // Spieler verlässt den Raum freiwillig
  socket.on('leaveRoom', ({ code }) => {
    try {
      const game = games.get(code);
      if (!game) return;
      const idx = game.players.findIndex(p => p.id === socket.id);
      if (idx !== -1) {
        const wasHost = game.hostId === socket.id;
        game.players.splice(idx, 1);
        socket.leave(code);
        // Host-Wechsel falls nötig
        if (wasHost && game.players.length > 0) {
          game.hostId = game.players[0].id;
        }
        sendPlayerList(game);
        // Lobby löschen wenn leer
        if (game.players.length === 0) {
          games.delete(game.code);
        }
      }
    } catch (err) {
      // ignore
    }
  });

  socket.on('submitAnswer', (answer) => {
    try {
      const game = findGameBySocket(socket.id);
      if (!game || game.state !== 'in-game') return;

      const player = game.players.find(p => p.id === socket.id);
      if (!player) return;

      // Prüfen, ob Spieler schon geantwortet hat
      const alreadyAnswered = game.answers.find(a => a.name === player.name);
      if (alreadyAnswered) return;

      game.answers.push({ name: player.name, answer });

      if (game.answers.length === game.players.length) {
        startDiscussion(game);
      }
      sendPlayerList(game);
    } catch (err) {
      // ignore
    }
  });

  socket.on('castVote', (voteForName) => {
    try {
      const game = findGameBySocket(socket.id);
      if (!game || game.state !== 'discussion') return;

      const voter = game.players.find(p => p.id === socket.id);
      if (!voter) return;

      // Kein Selbst-Voting erlaubt
      if (voter.name === voteForName) return;

      // Stimme speichern/ersetzen
      game.votes[voter.name] = voteForName;

      // Sende anonymisierten Vote-Status (wer hat schon abgestimmt, aber nicht für wen)
      io.to(game.code).emit('voteProgress', {
        voted: Object.keys(game.votes)
      });

      // Stimmen erst offenbaren, wenn alle abgestimmt haben
      if (Object.keys(game.votes).length === game.players.length) {
        // Stimmen offenbaren
        io.to(game.code).emit('voteReveal', game.votes);

        // Nach 2 Sekunden: Auflösung, wer der Impostor war
        setTimeout(() => {
          countVotesAndReveal(game);
        }, 2000);
      }
      sendPlayerList(game);
    } catch (err) {
      // ignore
    }
  });

  socket.on('disconnect', () => {
    try {
      for (const game of games.values()) {
        const idx = game.players.findIndex(p => p.id === socket.id);
        if (idx !== -1) {
          const wasHost = game.hostId === socket.id;
          game.players.splice(idx, 1);
          // Host-Wechsel falls nötig
          if (wasHost && game.players.length > 0) {
            game.hostId = game.players[0].id;
          }
          sendPlayerList(game);
          // Wenn Spiel im Gange und zu wenige Spieler, abbrechen
          if (game.state !== 'lobby' && game.players.length < 3) {
            io.to(game.code).emit('reveal', { impostorName: null, message: 'Zu wenige Spieler. Spiel abgebrochen.' });
            games.delete(game.code);
            break;
          }
          // Lobby löschen wenn leer
          if (game.players.length === 0) {
            games.delete(game.code);
          }
        }
      }
    } catch (err) {
      // ignore
    }
  });
});

function findGameBySocket(socketId) {
  for (const game of games.values()) {
    if (game.players.find(p => p.id === socketId)) return game;
  }
  return null;
}

function sendPlayerList(game) {
  if (!game) return;
  const host = game.players.find(p => p.id === game.hostId);
  io.to(game.code).emit('playerList', {
    players: game.players.map(p => p.name),
    hostName: host ? host.name : null
  });
}

function startGame(code) {
  const game = games.get(code);
  if (!game) return;

  // Wähle eine Kategorie, die auch Fragen enthält
  let category;
  let tries = 0;
  do {
    category = getRandomCategory();
    tries++;
    // Fallback: nach 10 Versuchen nimm einfach die erste Kategorie mit Fragen
    if (tries > 10) {
      const { questions } = require('./shared/questions');
      category = Object.keys(questions).find(cat => questions[cat] && questions[cat].length > 0);
      break;
    }
  } while (!category || !require('./shared/questions').questions[category] || require('./shared/questions').questions[category].length === 0);

  // Frage aus ALLEN verfügbaren Fragen der Kategorie wählen
  const { questions } = require('./shared/questions');
  const questionList = questions[category];
  const questionMain = questionList[Math.floor(Math.random() * questionList.length)];
  let questionImpostor = questionList[Math.floor(Math.random() * questionList.length)];
  while (questionImpostor === questionMain && questionList.length > 1) {
    questionImpostor = questionList[Math.floor(Math.random() * questionList.length)];
  }

  const impostorIndex = Math.floor(Math.random() * game.players.length);
  game.impostorIndex = impostorIndex;
  game.category = category;
  game.mainQuestion = questionMain;
  game.impostorQuestion = questionImpostor;
  game.answers = [];
  game.votes = {};
  game.state = 'in-game';

  game.players.forEach((p, index) => {
    const question = index === impostorIndex ? questionImpostor : questionMain;
    const placeholder = `Antwort eingeben (${category})`;
    io.to(p.id).emit('question', {
      question,
      placeholder,
      isImpostor: index === impostorIndex // <--- NEU
    });
  });
}

function startDiscussion(game) {
  game.state = 'discussion';

  io.to(game.code).emit('startDiscussion', {
    mainQuestion: game.mainQuestion,
    answers: game.answers
  });
}

function countVotesAndReveal(game) {
  // Stimmen zählen
  const counts = {};
  for (const vote of Object.values(game.votes)) {
    counts[vote] = (counts[vote] || 0) + 1;
  }

  // Höchste Stimmenzahl ermitteln
  let maxVotes = 0;
  let candidates = [];

  for (const [name, count] of Object.entries(counts)) {
    if (count > maxVotes) {
      maxVotes = count;
      candidates = [name];
    } else if (count === maxVotes) {
      candidates.push(name);
    }
  }

  // Entscheidung: Eindeutiger Verlierer oder Unentschieden
  let impostorName = null;
  let impostorWon = false;
  if (candidates.length === 1) {
    impostorName = candidates[0];
    // Prüfen, ob der Impostor gefunden wurde
    const impostor = game.players[game.impostorIndex];
    impostorWon = impostor.name !== impostorName;
  }

  // Nach 2 Sekunden: Auflösung senden
  setTimeout(() => {
    io.to(game.code).emit('reveal', { impostorName, impostorWon });
    // Nach weiteren 2 Sekunden: Host bekommt "Spiel beenden"-Knopf
    setTimeout(() => {
      const host = game.players.find(p => p.id === game.hostId);
      if (host) {
        io.to(host.id).emit('showEndGameBtn');
      }
    }, 2000);
  }, 2000);

  // Spiel bleibt bestehen, zurück in die Lobby nach Auflösung
  game.state = 'lobby';
  game.answers = [];
  game.votes = {};
  // (Impostor bleibt gleich, kann aber auch neu gezogen werden, falls gewünscht)
  sendPlayerList(game);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server läuft auf Port ${PORT}`);
});
