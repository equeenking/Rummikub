import express from 'express';
import '../game-core.js';
const GameCore = globalThis.GameCore;
const { createDeck, shuffleArray, initGameState, calculateHandScore, calculateGroupScore, getJokerRepresentedValue, getJokerSortOrder, calculateJokerValue, sortGroupCards, isValidGroup, validateGroup, validateGroupWithJokers, validateGroupWithBasicJokers, validateRunWithBasicJokers, validateColorChangeRun, validateMirrorGroup, validateMirrorSameNumberGroup, validateMirrorRunGroup, groupCards, tryFormRun, validateMove, validateTable, endGameWithFewestTiles, processPlayCard, processDrawCard, processPass, processSubmit } = GameCore;

const app = express();
app.use(express.json());

const rooms = new Map();
const ROOM_TTL = 30 * 60 * 1000;

const rateLimit = new Map();
const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW = 60 * 1000;

function checkRateLimit(req) {
  const ip = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = rateLimit.get(ip);
  if (!entry) {
    rateLimit.set(ip, { count: 1, startTime: now });
    return { allowed: true };
  }
  if (now - entry.startTime > RATE_LIMIT_WINDOW) {
    rateLimit.set(ip, { count: 1, startTime: now });
    return { allowed: true };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, message: '请求过于频繁，请稍后再试' };
  }
  entry.count++;
  return { allowed: true };
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimit) {
    if (now - entry.startTime > RATE_LIMIT_WINDOW) {
      rateLimit.delete(ip);
    }
  }
}, 2 * RATE_LIMIT_WINDOW);

function touchRoom(room) {
  if (room) room.lastActive = Date.now();
}

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - (room.lastActive || room.createdAt || now) > ROOM_TTL) {
      rooms.delete(code);
      console.log(`房间 ${code} 因超时未活动已自动清理`);
    }
  }
}, 5 * 60 * 1000);

const AVATARS = Array.from({ length: 25 }, (_, i) => `./images/touxiang_${String(i + 1).padStart(2, '0')}.png`);

function getRandomAvatar() {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)];
}

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
    if (player.id === playerId) {
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

app.post('/room/create', (req, res) => {
  const limit = checkRateLimit(req);
  if (!limit.allowed) {
    return res.status(429).json({ success: false, message: limit.message });
  }
  const { playerName, gameMode = 'classic', playerId } = req.body;

  if (!playerName) {
    return res.json({ success: false, message: '请输入玩家名称' });
  }

  const roomCode = generateRoomCode();
  const persistentId = playerId || `player-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  const player = {
    id: persistentId,
    persistentId: persistentId,
    name: playerName,
    avatar: getRandomAvatar(),
    isBot: false,
    isReady: false,
    isHost: true
  };

  rooms.set(roomCode, {
    code: roomCode,
    players: [player],
    maxPlayers: 4,
    gameMode: gameMode,
    gameState: null,
    playerMap: new Map([[persistentId, player]]),
    createdAt: Date.now(),
    lastActive: Date.now()
  });

  res.json({
    success: true,
    data: {
      roomCode,
      playerId: persistentId,
      player: player,
      gameMode
    }
  });
});

app.post('/room/join', (req, res) => {
  const limit = checkRateLimit(req);
  if (!limit.allowed) {
    return res.status(429).json({ success: false, message: limit.message });
  }
  const { roomCode, playerName, playerId } = req.body;

  if (!roomCode || !playerName) {
    return res.json({ success: false, message: '请输入房间号和玩家名称' });
  }

  const room = rooms.get(roomCode);
  if (!room) {
    return res.json({ success: false, message: '房间不存在' });
  }

  if (room.gameState && room.gameState.gameStatus === 'playing') {
    if (playerId) {
      const existingPlayerIndex = room.gameState.players.findIndex(
        p => p.persistentId === playerId || p.id === playerId
      );
      if (existingPlayerIndex !== -1) {
        const existingPlayer = room.gameState.players[existingPlayerIndex];
        return res.json({
          success: true,
          data: {
            roomCode,
            playerId: existingPlayer.id,
            player: existingPlayer,
            players: room.players,
            maxPlayers: room.maxPlayers,
            gameMode: room.gameMode,
            gameState: filterGameStateForPlayer(room.gameState, existingPlayer.id)
          }
        });
      }
    }
    return res.json({ success: false, message: '游戏已开始，无法加入' });
  }

  if (room.players.length >= room.maxPlayers) {
    return res.json({ success: false, message: '房间已满' });
  }

  const persistentId = playerId || `player-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  const player = {
    id: persistentId,
    persistentId: persistentId,
    name: playerName,
    avatar: getRandomAvatar(),
    isBot: false,
    isReady: false,
    isHost: false
  };

  room.players.push(player);
  room.playerMap.set(persistentId, player);

  res.json({
    success: true,
    data: {
      roomCode,
      playerId: persistentId,
      player: player,
      players: room.players,
      maxPlayers: room.maxPlayers,
      gameMode: room.gameMode
    }
  });
});

app.post('/room/leave', (req, res) => {
  const { roomCode, playerId } = req.body;

  const room = rooms.get(roomCode);
  if (!room) {
    return res.json({ success: false, message: '房间不存在' });
  }

  const playerIndex = room.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) {
    return res.json({ success: false, message: '玩家不在房间中' });
  }

  const player = room.players[playerIndex];
  const wasHost = player.isHost;
  room.players.splice(playerIndex, 1);
  room.playerMap.delete(playerId);

  if (wasHost && room.players.length > 0) {
    room.players[0].isHost = true;
  }

  if (room.gameState) {
    room.gameState.players.splice(playerIndex, 1);

    if (room.gameState.currentIndex >= room.gameState.players.length) {
      room.gameState.currentIndex = 0;
    }

    if (room.gameState.consecutivePasses && room.gameState.consecutivePasses > 0) {
      room.gameState.consecutivePasses = Math.max(0, room.gameState.consecutivePasses - 1);
    }

    if (room.gameState.players.length <= 1) {
      if (room.gameState.players.length === 1) {
        room.gameState.winner = room.gameState.players[0];
        room.gameState.gameStatus = 'ended';
        room.gameState.endReason = 'opponentLeft';
      } else {
        room.gameState.gameStatus = 'ended';
        room.gameState.endReason = 'allLeft';
      }
    }
  }

  if (room.players.length === 0) {
    rooms.delete(roomCode);
    return res.json({ success: true, data: { roomDeleted: true } });
  }

  res.json({
    success: true,
    data: {
      roomCode,
      playerName: player.name,
      players: room.players,
      gameState: room.gameState
    }
  });
});

app.post('/room/ready', (req, res) => {
  const { roomCode, playerId, ready } = req.body;

  const room = rooms.get(roomCode);
  if (!room) {
    return res.json({ success: false, message: '房间不存在' });
  }

  const player = room.playerMap.get(playerId);
  if (!player) {
    return res.json({ success: false, message: '玩家不在房间中' });
  }

  player.isReady = ready;

  const allReady = room.players.length >= 2 && room.players.every(p => p.isReady);
  const isFull = room.players.length >= room.maxPlayers;

  // 2人及以上全部准备时自动开始游戏
  let autoStarted = false;
  if (allReady && room.players.length >= 2 && !room.gameState) {
    room.gameState = initGameState(room.players, room.gameMode);
    autoStarted = true;
  }

  res.json({
    success: true,
    data: {
      roomCode,
      playerId,
      isReady: player.isReady,
      allReady,
      autoStarted,
      players: room.players,
      gameState: room.gameState ? filterGameStateForPlayer(room.gameState, playerId) : null
    }
  });
});

app.post('/room/start', (req, res) => {
  const { roomCode, playerId } = req.body;

  const room = rooms.get(roomCode);
  if (!room) {
    return res.json({ success: false, message: '房间不存在' });
  }

  // 房主校验：第一个加入的玩家为房主
  const requester = room.playerMap.get(playerId);
  if (!requester) {
    return res.json({ success: false, message: '玩家不在房间中' });
  }
  if (room.players[0].id !== playerId) {
    return res.json({ success: false, message: '只有房主可以开始游戏' });
  }

  // 人数校验：至少2人
  if (room.players.length < 2) {
    return res.json({ success: false, message: '至少需要2名玩家才能开始游戏' });
  }

  if (!room.players.every(p => p.isReady)) {
    return res.json({ success: false, message: '不是所有玩家都已准备' });
  }

  if (room.gameState && room.gameState.gameStatus === 'playing') {
    return res.json({ success: false, message: '游戏已开始' });
  }

  room.gameState = initGameState(room.players, room.gameMode);

  const filteredState = filterGameStateForPlayer(room.gameState, playerId);

  res.json({
    success: true,
    data: {
      roomCode,
      gameState: filteredState
    }
  });
});

app.get('/room/:code', (req, res) => {
  const room = rooms.get(req.params.code);
  if (!room) {
    return res.json({ success: false, message: '房间不存在' });
  }
  touchRoom(room);

  const playerId = req.query.playerId;
  res.json({
    success: true,
    data: {
      code: room.code,
      players: room.players,
      maxPlayers: room.maxPlayers,
      gameMode: room.gameMode,
      gameState: room.gameState ? filterGameStateForPlayer(room.gameState, playerId) : null,
      allReady: room.players.every(p => p.isReady)
    }
  });
});

app.post('/game/action', (req, res) => {
  const limit = checkRateLimit(req);
  if (!limit.allowed) {
    return res.status(429).json({ success: false, message: limit.message });
  }
  try {
    const { roomCode, playerId, action, payload } = req.body;

    console.log('[HTTP API] 收到游戏操作:', { roomCode, playerId: playerId?.substring(0, 8) + '...', action });

    const room = rooms.get(roomCode);
    if (!room) {
      return res.json({ success: false, message: '房间不存在' });
    }
    touchRoom(room);

    const gameState = room.gameState;
    if (!gameState || gameState.gameStatus !== 'playing') {
      return res.json({ success: false, message: '游戏未开始或已结束' });
    }

    let result;
    switch (action) {
      case 'drawCard':
        result = processDrawCard(gameState, playerId);
        break;
      case 'playCard':
        result = processPlayCard(gameState, playerId, payload.cards, payload.tableGroups);
        break;
      case 'pass':
        result = processPass(gameState, playerId);
        break;
      case 'submit':
        result = processSubmit(gameState, playerId);
        break;
      default:
        return res.json({ success: false, message: '未知操作' });
    }

    if (!result.success) {
      console.log('[HTTP API] 操作失败:', result.message);
      return res.json({ success: false, message: result.message });
    }

    console.log('[HTTP API] 操作成功:', {
      action,
      currentIndex: result.gameState?.currentIndex,
      tableGroupsCount: result.gameState?.table?.length,
      gameStatus: result.gameState?.gameStatus
    });

    const { success, ...data } = result;
    if (data.gameState) {
      data.gameState = filterGameStateForPlayer(data.gameState, playerId);
    }
    res.json({ success: true, data });
  } catch (err) {
    console.error('game/action error:', err);
    res.json({ success: false, message: '服务器内部错误' });
  }
});

app.get('/game/state', (req, res) => {
  const { roomCode, playerId } = req.query;

  const room = rooms.get(roomCode);
  if (!room) {
    return res.json({ success: false, message: '房间不存在' });
  }
  touchRoom(room);

  const player = room.players.find(p => p.id === playerId);
  if (!player) {
    return res.json({ success: false, message: '玩家不在房间中' });
  }

  const filteredState = filterGameStateForPlayer(room.gameState, playerId);

  res.json({
    success: true,
    data: {
      gameState: filteredState,
      players: room.players
    }
  });
});

app.get('/avatars', (req, res) => {
  res.json({ success: true, data: AVATARS });
});

export default app;
