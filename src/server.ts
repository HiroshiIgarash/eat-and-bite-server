import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import { v4 as uuid } from "uuid";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://192.168.130.84:3000"], // フロントエンドのURL
    methods: ["GET", "POST"],
  },
});

let waitingPlayer: Socket[] = [];
const rooms: {
  [key: string]: {
    players: Socket[];
    serverCurrentTurn: number;
    correctAnswer: string[];
    history: {
      player: string;
      guess: string[];
      results: { eat: number; bite: number };
    }[];
  };
} = {};

const generateRandomAnswer = () => {
  const colors = [
    "red",
    "blue",
    "green",
    "yellow",
    "purple",
    "orange",
  ] as const;
  const answer: (typeof colors)[number][] = [];
  while (answer.length < 4) {
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    if (!answer.includes(randomColor)) {
      answer.push(randomColor);
    }
  }
  return answer;
};

io.on("connection", (socket) => {
  console.log("a user connected");

  socket.on("disconnect", () => {
    waitingPlayer = waitingPlayer.filter((p) => p.id !== socket.id);
    console.log(`${socket.id}が退出しました。`);
    console.log(waitingPlayer.map((p) => p.id));
  });

  socket.on("enter_match", async () => {
    await new Promise((r) => setTimeout(r, 3000));
    if (!waitingPlayer.includes(socket)) {
      waitingPlayer.push(socket);
    }

    console.log(waitingPlayer.map((p) => p.id));
  });

  socket.on("enter_game", ({ roomId }) => {
    console.log("a game connected");
    if (!rooms[roomId]) return;
    const data = {
      ...rooms[roomId],
      players: rooms[roomId].players.map((p) => p.id),
    };
    socket.to(roomId).emit("send_game_info", data);
  });

  socket.on("submit_guess", ({ roomId, guess }) => {
    console.log(`${socket.id}から${guess.join(",")}と返事が来ました`);
    const room = rooms[roomId];
    if (room.players[room.serverCurrentTurn].id !== socket.id) {
      return; // 現在のターンのプレイヤーでない場合は無視
    }
    // ゲームロジック
    const result = calculateResult(guess, room.correctAnswer);
    room.history.push({ player: socket.id, guess, results: result });
    room.serverCurrentTurn = (room.serverCurrentTurn + 1) % 2;

    // ゲーム終了の判定
    const gameOver = checkGameOver(result);
    if (gameOver) {
      io.to(roomId).emit("game_over", { winner: socket.id });
    }

    const data = {
      ...rooms[roomId],
      players: rooms[roomId].players.map((p) => p.id),
    };

    io.to(roomId).emit("send_game_info", data);
  });
});

const calculateResult = (guess: string[], correctAnswer: string[]) => {
  let eat = 0;
  let bite = 0;

  // eatの計算
  guess.forEach((color, index) => {
    if (color === correctAnswer[index]) {
      eat++;
    }
  });

  // biteの計算
  guess.forEach((color, index) => {
    if (color !== correctAnswer[index] && correctAnswer.includes(color)) {
      bite++;
    }
  });

  return { eat, bite };
};

const checkGameOver = (result: { eat: number; bite: number }) => {
  // ゲーム終了の判定
  return result.eat === 4;
};

server.listen(3001, () => {
  console.log("listening on *:3001");
});

setInterval(() => {
  if (waitingPlayer.length < 2) return;

  const roomId = uuid();
  const correctAnswer = generateRandomAnswer();
  const players = waitingPlayer.splice(0, 2);
  rooms[roomId] = {
    players: players,
    serverCurrentTurn: Math.random() < 0.5 ? 0 : 1,
    correctAnswer,
    history: [],
  };
  players[0].join(roomId);
  players[1].join(roomId);
  console.log(`${players[0]}と${players[1]}がマッチングしました。`);
  console.log(`${roomId}の部屋に行きます。`);
  io.to(roomId).emit("match_found", { roomId });
}, 3000);
