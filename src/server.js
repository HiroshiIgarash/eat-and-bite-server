"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const uuid_1 = require("uuid");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: [
            "http://localhost:3000",
            "http://192.168.130.84:3000",
            "https://eat-and-bite-client.vercel.app/",
        ], // フロントエンドのURL
        methods: ["GET", "POST"],
    },
});
let waitingPlayer = [];
const rooms = {};
const generateRandomAnswer = () => {
    const colors = [
        "red",
        "blue",
        "green",
        "yellow",
        "purple",
        "orange",
    ];
    const answer = [];
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
    socket.on("enter_match", () => __awaiter(void 0, void 0, void 0, function* () {
        yield new Promise((r) => setTimeout(r, 3000));
        if (!waitingPlayer.includes(socket)) {
            waitingPlayer.push(socket);
        }
        console.log(waitingPlayer.map((p) => p.id));
    }));
    socket.on("enter_game", ({ roomId }) => {
        console.log("a game connected");
        if (!rooms[roomId])
            return;
        const data = Object.assign(Object.assign({}, rooms[roomId]), { players: rooms[roomId].players.map((p) => p.id) });
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
        const data = Object.assign(Object.assign({}, rooms[roomId]), { players: rooms[roomId].players.map((p) => p.id) });
        io.to(roomId).emit("send_game_info", data);
    });
});
const calculateResult = (guess, correctAnswer) => {
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
const checkGameOver = (result) => {
    // ゲーム終了の判定
    return result.eat === 4;
};
server.listen(3001, () => {
    console.log("listening on *:3001");
});
setInterval(() => {
    if (waitingPlayer.length < 2)
        return;
    const roomId = (0, uuid_1.v4)();
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
