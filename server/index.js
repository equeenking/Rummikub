import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import '../game-core.js';
const GameCore = globalThis.GameCore;
const { createDeck, shuffleArray, initGameState, calculateHandScore, calculateGroupScore, getJokerRepresentedValue, getJokerSortOrder, calculateJokerValue, sortGroupCards, isValidGroup, validateGroup, validateGroupWithJokers, validateGroupWithBasicJokers, validateRunWithBasicJokers, validateColorChangeRun, validateMirrorGroup, validateMirrorSameNumberGroup, validateMirrorRunGroup, groupCards, tryFormRun, validateMove, validateTable, endGameWithFewestTiles, processPlayCard, processDrawCard, processPass, processSubmit } = GameCore;

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST'],
  credentials: true
}));

// 仅暴露必要的公开文件，阻止访问敏感文件
app.use((req, res, next) => {
  if (/\.(md|cjs|env|log)$/i.test(req.path) || req.path.includes('node_modules') || req.path.includes('.git') || req.path.includes('package.json') || req.path.includes('package-lock')) {
    return res.status(403).send('Forbidden');
  }
  next();
});

app.use(express.static(join(__dirname, '../')));

import apiRouter from '../api/[[default]].js';
app.use(apiRouter);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// 全局错误兜底，防止单个异常导致进程崩溃
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

const AVATARS = Array.from({ length: 25 }, (_, i) => `./images/touxiang_${String(i + 1).padStart(2, '0')}.png`);

function getRandomAvatar() {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)];
}

const rooms = new Map();
const ROOM_TTL = 30 * 60 * 1000;

const rateLimit = new Map();
const RATE_LIMIT_MAX = 1000;
const RATE_LIMIT_WINDOW = 60 * 1000;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimit.get(ip);
  if (!entry) {
    rateLimit.set(ip, { count: 1, startTime: now });
    return true;
  }
  if (now - entry.startTime > RATE_LIMIT_WINDOW) {
    rateLimit.set(ip, { count: 1, startTime: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }
  entry.count++;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimit) {
    if (now - entry.startTime > RATE_LIMIT_WINDOW) {
      rateLimit.delete(ip);
    }
  }
}, 2 * RATE_LIMIT_WINDOW);

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - (room.lastActive || room.createdAt || now) > ROOM_TTL) {
      rooms.delete(code);
      console.log(`房间 ${code} 因超时未活动已自动清理`);
    }
  }
}, 5 * 60 * 1000);

function generateRoomCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function filterGameStateForPlayer(gameState, playerId) {
  if (!gameState) return null;

  const filteredState = JSON.parse(JSON.stringify(gameState));

  if (filteredState.gameStatus === 'ended') {
    if (filteredState.deck && typeof filteredState.deck === 'number') {
      filteredState.deck = new Array(filteredState.deck).fill({ isBack: true });
    }
    return filteredState;
  }

  filteredState.players = filteredState.players.map(player => {
    if (player.id === playerId || player.persistentId === playerId) {
      return player;
    }
    return {
      ...player,
      hand: player.hand ? player.hand.length : 0
    };
  });

  if (filteredState.deck) {
    filteredState.deck = filteredState.deck.length;
  }

  return filteredState;
}

function emitGameStateToRoom(roomCode, gameState) {
  const room = rooms.get(roomCode);
  if (!room || !gameState) return;
  
  console.log('[emitGameStateToRoom] 广播游戏状态:', {
    roomCode,
    playerCount: gameState.players.length,
    currentIndex: gameState.currentIndex,
    tableGroupsCount: gameState.table.length,
    deckCount: gameState.deck ? gameState.deck.length : 0,
    gameStatus: gameState.gameStatus
  });

  gameState.players.forEach(player => {
    const filtered = filterGameStateForPlayer(gameState, player.id);
    io.to(player.id).emit('gameState', filtered);
  });
}

io.on('connection', (socket) => {
  console.log('新客户端连接:', socket.id);
  
  socket.emit('avatars', AVATARS);
  
  socket.on('createRoom', (data) => {
    const { playerName, avatar, gameMode, playerId } = data;
    const roomCode = generateRoomCode();
    const persistentId = playerId || `player-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    
    rooms.set(roomCode, {
      code: roomCode,
      players: [{
        id: socket.id,
        persistentId: persistentId,
        name: playerName,
        avatar: avatar || getRandomAvatar(),
        isBot: false,
        isReady: false,
        isHost: true
      }],
      gameMode: gameMode || 'classic',
      maxPlayers: 4,
      gameState: null,
      createdAt: Date.now()
    });
    
    socket.join(roomCode);
    socket.emit('roomCreated', { roomCode, playerId: persistentId });
    socket.emit('roomInfo', rooms.get(roomCode));
    
    console.log(`房间创建: ${roomCode}, 创建者: ${playerName}, 头像: ${avatar}, 持久化ID: ${persistentId}`);
  });
  
  socket.on('joinRoom', (data) => {
    const { roomCode, playerName, avatar, playerId } = data;
    const room = rooms.get(roomCode);
    
    if (!room) {
      socket.emit('joinFailed', { message: '房间不存在或已关闭' });
      return;
    }
    
    if (room.gameState && room.gameState.gameStatus === 'playing') {
      let existingPlayerIndex = -1;
      for (let i = 0; i < room.gameState.players.length; i++) {
        const p = room.gameState.players[i];
        if (p.isBot) continue;
        if (playerId && (p.persistentId === playerId || p.id === playerId)) {
          existingPlayerIndex = i;
          break;
        }
        if (!playerId && p.name === playerName) {
          existingPlayerIndex = i;
          break;
        }
      }
      
      if (existingPlayerIndex === -1) {
        socket.emit('joinFailed', { message: '游戏已开始，无法加入新玩家' });
        return;
      }
      
      const rejoiningPlayer = room.gameState.players[existingPlayerIndex];
      const oldSocketId = rejoiningPlayer.id;
      
      const oldRoomPlayerIndex = room.players.findIndex(p => p.id === oldSocketId);
      if (oldRoomPlayerIndex !== -1) {
        room.players.splice(oldRoomPlayerIndex, 1);
      }
      
      room.players.push({
        id: socket.id,
        persistentId: rejoiningPlayer.persistentId || playerId,
        name: playerName,
        avatar: avatar || rejoiningPlayer.avatar || getRandomAvatar(),
        isBot: false,
        isReady: true,
        isHost: rejoiningPlayer.isHost || false
      });
      
      rejoiningPlayer.id = socket.id;
      
      socket.join(roomCode);
      socket.emit('joinSuccess', { roomCode });
      socket.emit('gameState', filterGameStateForPlayer(room.gameState, socket.id));
      io.to(roomCode).emit('roomInfo', room);
      
      console.log(`玩家重新加入房间 ${roomCode}: ${playerName}, 持久化ID: ${playerId}`);
      return;
    }
    
    if (room.players.length >= room.maxPlayers) {
      socket.emit('joinFailed', { message: '房间已满' });
      return;
    }
    
    const persistentId = playerId || `player-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    
    room.players.push({
      id: socket.id,
      persistentId: persistentId,
      name: playerName,
      avatar: avatar || getRandomAvatar(),
      isBot: false,
      isReady: false,
      isHost: false
    });
    
    socket.join(roomCode);
    socket.emit('joinSuccess', { roomCode, playerId: persistentId });
    io.to(roomCode).emit('roomInfo', room);
    
    console.log(`玩家加入房间 ${roomCode}: ${playerName}, 头像: ${avatar}, 持久化ID: ${persistentId}`);
  });
  
  socket.on('updateAvatar', (data) => {
    const { roomCode, avatar } = data;
    const room = rooms.get(roomCode);
    if (!room) return;
    
    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      player.avatar = avatar;
      io.to(roomCode).emit('roomInfo', room);
    }
  });
  
  socket.on('playerReady', (roomCode) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    
    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      player.isReady = !player.isReady;
      
      const allReady = room.players.length >= 2 && 
                       room.players.every(p => p.isReady);
      
      io.to(roomCode).emit('roomInfo', room);
      
      if (allReady && room.gameState === null && room.players.length >= 2) {
        room.gameState = initGameState(room.players, room.gameMode);
        room.gameState.gameStatus = 'playing';
        room.gameState.players.forEach(player => {
          const filtered = filterGameStateForPlayer(room.gameState, player.id);
          io.to(player.id).emit('gameStarted', filtered);
        });
        console.log(`房间 ${roomCode} ${room.players.length}人全部准备，自动开始游戏`);
      }
    }
  });
  
  socket.on('startGame', (roomCode) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    
    const player = room.players.find(p => p.id === socket.id);
    if (!player || !player.isHost) {
      socket.emit('actionRejected', { message: '只有房主可以开始游戏' });
      return;
    }
    
    const allReady = room.players.length >= 2 && 
                     room.players.every(p => p.isReady);
    
    if (!allReady) {
      socket.emit('actionRejected', { message: '请等待所有玩家准备就绪' });
      return;
    }
    
    if (room.gameState !== null) {
      socket.emit('actionRejected', { message: '游戏已开始' });
      return;
    }
    
    room.gameState = initGameState(room.players, room.gameMode);
    room.gameState.gameStatus = 'playing';
    room.gameState.players.forEach(player => {
      const filtered = filterGameStateForPlayer(room.gameState, player.id);
      io.to(player.id).emit('gameStarted', filtered);
    });
    console.log(`房间 ${roomCode} 房主开始游戏`);
  });
  
  socket.on('syncGameState', (roomCode) => {
    const room = rooms.get(roomCode);
    if (!room || !room.gameState) return;
    
    socket.join(roomCode);
    
    const existingPlayerIndex = room.gameState.players.findIndex(
      p => !p.isBot && (p.persistentId && room.players.find(rp => rp.id === socket.id)?.persistentId === p.persistentId || 
                        room.players.find(rp => rp.id === socket.id)?.name === p.name)
    );
    
    if (existingPlayerIndex !== -1) {
      room.gameState.players[existingPlayerIndex].id = socket.id;
      
      const oldRoomPlayerIndex = room.players.findIndex(p => p.id === socket.id);
      if (oldRoomPlayerIndex !== -1) {
        room.players[oldRoomPlayerIndex].id = socket.id;
      }
    }
    
    const filtered = filterGameStateForPlayer(room.gameState, socket.id);
    socket.emit('gameState', filtered);
    
    console.log(`玩家通过syncGameState重新加入房间 ${roomCode}, socket.id: ${socket.id}`);
  });
  
  socket.on('playerAction', (data) => {
    try {
      const ip = socket.handshake.address || 'unknown';
      if (!checkRateLimit(ip)) {
        socket.emit('actionRejected', { message: '操作过于频繁，请稍后再试' });
        return;
      }
      if (!data || typeof data !== 'object') return;
      const { roomCode, action, payload } = data;
      const room = rooms.get(roomCode);

      if (!room || !room.gameState) return;
      room.lastActive = Date.now();

      const currentPlayerInGame = room.gameState.players[room.gameState.currentIndex];
      const isCurrentPlayer = currentPlayerInGame.id === socket.id || 
                              currentPlayerInGame.persistentId && 
                              room.players.find(p => p.id === socket.id)?.persistentId === currentPlayerInGame.persistentId;

      if (!isCurrentPlayer) {
        socket.emit('actionRejected', { message: '不是你的回合' });
        return;
      }

      const gameState = room.gameState;
      let result;

      switch (action) {
        case 'playCard': {
          result = processPlayCard(gameState, currentPlayerInGame.id, payload.cards, payload.tableGroups);
          break;
        }
        case 'drawCard': {
          result = processDrawCard(gameState, currentPlayerInGame.id);
          break;
        }
        case 'pass': {
          result = processPass(gameState, currentPlayerInGame.id);
          break;
        }
        case 'submit': {
          result = processSubmit(gameState, currentPlayerInGame.id);
          break;
        }
        case 'undo': {
          break;
        }
      }

      if (result && !result.success) {
        socket.emit('actionRejected', { message: result.message });
        return;
      }

      emitGameStateToRoom(roomCode, gameState);
    } catch (err) {
      console.error('playerAction error:', err);
      socket.emit('actionRejected', { message: '服务器内部错误' });
    }
  });
  
  function handlePlayerLeave(room, playerId, socket) {
    const leavingPlayerIndex = room.players.findIndex(p => p.id === playerId);
    const isHostLeaving = room.players[leavingPlayerIndex]?.isHost;
    
    room.players = room.players.filter(p => p.id !== playerId);
    
    if (room.players.length === 0) {
      rooms.delete(room.code);
      console.log(`房间 ${room.code} 已关闭`);
      return;
    }
    
    if (isHostLeaving) {
      room.players[0].isHost = true;
    }
    
    if (room.gameState && room.gameState.gameStatus === 'playing') {
      const gsPlayerIndex = room.gameState.players.findIndex(p => p.id === playerId);
      if (gsPlayerIndex !== -1) {
        room.gameState.players.splice(gsPlayerIndex, 1);
      }
      
      const playerCount = room.gameState.players.length;
      
      if (gsPlayerIndex === room.gameState.currentIndex) {
        room.gameState.currentIndex = room.gameState.currentIndex % playerCount;
      } else if (gsPlayerIndex < room.gameState.currentIndex) {
        room.gameState.currentIndex--;
      }

      if (room.gameState.consecutivePasses && room.gameState.consecutivePasses > 0) {
        room.gameState.consecutivePasses = Math.max(0, room.gameState.consecutivePasses - 1);
      }
      
      if (playerCount === 1) {
        room.gameState.winner = room.gameState.players[0];
        room.gameState.gameStatus = 'ended';
        room.gameState.endReason = 'opponentLeft';
      }
    }
    
    io.to(room.code).emit('roomInfo', room);
    if (room.gameState) {
      emitGameStateToRoom(room.code, room.gameState);
    }
    console.log(`玩家离开房间 ${room.code}`);
  }
  
  socket.on('leaveRoom', (roomCode) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    
    handlePlayerLeave(room, socket.id, socket);
    socket.leave(roomCode);
  });
  
  const RECONNECT_GRACE_PERIOD = 30 * 1000;

  socket.on('disconnect', () => {
    console.log('客户端断开连接:', socket.id);
    
    for (const [code, room] of rooms) {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        room.players[playerIndex].disconnectedAt = Date.now();
        
        if (room.gameState) {
          const gsPlayerIndex = room.gameState.players.findIndex(p => p.id === socket.id);
          if (gsPlayerIndex !== -1) {
            room.gameState.players[gsPlayerIndex].disconnectedAt = Date.now();
          }
        }
        
        console.log(`玩家 ${room.players[playerIndex].name} 断开连接，进入${RECONNECT_GRACE_PERIOD/1000}秒重连缓冲期`);
        
        setTimeout(() => {
          const nowRoom = rooms.get(code);
          if (!nowRoom) return;
          
          const stillDisconnectedIndex = nowRoom.players.findIndex(
            p => p.id === socket.id && p.disconnectedAt && Date.now() - p.disconnectedAt >= RECONNECT_GRACE_PERIOD
          );
          
          if (stillDisconnectedIndex !== -1) {
            handlePlayerLeave(nowRoom, socket.id, socket);
          }
        }, RECONNECT_GRACE_PERIOD);
        
        break;
      }
    }
  });
});

app.get('/api/rooms/:code', (req, res) => {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ success: false, message: '请求过于频繁，请稍后再试' });
  }
  const room = rooms.get(req.params.code);
  if (room) {
    res.json({
      success: true,
      data: {
        code: room.code,
        playerCount: room.players.length,
        maxPlayers: room.maxPlayers,
        gameStatus: room.gameState?.gameStatus || 'waiting'
      }
    });
  } else {
    res.json({ success: false, message: '房间不存在' });
  }
});

app.get('/api/avatars', (req, res) => {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ success: false, message: '请求过于频繁，请稍后再试' });
  }
  res.json({ success: true, data: AVATARS });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`局域网访问: http://${iface.address}:${PORT}`);
      }
    }
  }
});
