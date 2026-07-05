# Rummikub 拉密游戏项目上下文

## 1. 项目架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        浏览器客户端 (index.html)                │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────────────┐  │
│  │   UI 渲染   │  │  游戏交互   │  │  客户端状态管理       │  │
│  │ (HTML/CSS)  │  │ (点击/拖拽) │  │ - selectedCards       │  │
│  │             │  │             │  │ - tempGroup1/2        │  │
│  │             │  │             │  │ - turnSnapshots       │  │
│  │             │  │             │  │ - tableWorkingCopy    │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬───────────┘  │
│         │                │                     │               │
│         └────────────────┼─────────────────────┘               │
│                          │                                     │
│              ┌───────────┴────────────┐                        │
│              │   game-core.js (共享)  │                        │
│              │  - 牌组验证 validate    │                        │
│              │  - 分数计算             │                        │
│              │  - 排序 sortGroupCards │                        │
│              │  - Bot 逻辑 findBotMove  │                        │
│              └───────────┬────────────┘                        │
│                          │                                     │
│          ┌───────────────┴───────────────┐                     │
│          │                               │                     │
│  ┌───────┴───────┐              ┌───────┴───────┐             │
│  │  Socket.IO    │              │  HTTP 轮询   │             │
│  │  (实时多人)   │              │  (IGA Pages)  │             │
│  └───────┬───────┘              └───────┬───────┘             │
└──────────┼──────────────────────────────┼─────────────────────┘
           │                              │
           ▼                              ▼
┌──────────────────────┐     ┌──────────────────────┐
│  Socket.IO 服务器     │     │  IGA Pages API       │
│  (server/index.js)   │     │  (api/[[default]].js) │
│  - 房间管理           │     │  - 房间管理           │
│  - 实时同步           │     │  - 游戏状态轮询       │
│  - 玩家进出           │     │  - 游戏动作提交       │
└──────────┬───────────┘     └──────────┬───────────┘
           │                              │
           └──────────────┬───────────────┘
                          │
              ┌───────────┴────────────┐
              │   game-core.js (共享)  │
              │  - 游戏状态初始化       │
              │  - 动作处理             │
              │  - 规则验证             │
              └────────────────────────┘
```

### 模块关系与数据流

1. **统一核心层 (game-core.js)**
   - 同时支持浏览器 `window.GameCore` 和 Node.js ES Module
   - 所有游戏规则、验证、计算逻辑的唯一来源
   - 客户端和服务器共用，消除重复实现

2. **客户端层 (index.html)**
   - UI 渲染与用户交互
   - 本地回合状态管理（临时牌组、选中卡牌、撤销快照）
   - 支持两种网络模式：Socket.IO 实时 和 HTTP 轮询

3. **服务层**
   - **Socket.IO 服务器** (server/index.js)：实时多人对战，房间管理，状态广播
   - **IGA Pages API** (api/[[default]].js)：无服务器部署，HTTP 轮询模式

---

## 2. 已实现 API 列表

### 2.1 HTTP REST API (api/[[default]].js)

| 接口名称 | 方法 | URL路径 | 请求参数 | 响应格式 | 功能说明 |
|---------|------|---------|---------|---------|---------|
| 创建房间 | POST | `/room/create` | `playerName: string`<br>`gameMode: 'classic'/'deluxe'` | `{ success, data: { roomCode, playerId, player, gameMode } }` | 创建新游戏房间 |
| 加入房间 | POST | `/room/join` | `roomCode: string`<br>`playerName: string` | `{ success, data: { roomCode, playerId, player, players, gameMode } }` | 加入已有房间 |
| 离开房间 | POST | `/room/leave` | `roomCode: string`<br>`playerId: string` | `{ success, data: { roomCode, playerName, players, gameState } }` | 离开当前房间 |
| 准备/取消准备 | POST | `/room/ready` | `roomCode: string`<br>`playerId: string`<br>`ready: boolean` | `{ success, data: { roomCode, playerId, isReady, allReady } }` | 切换玩家准备状态 |
| 开始游戏 | POST | `/room/start` | `roomCode: string`<br>`playerId: string` | `{ success, data: { roomCode, gameState } }` | 房主开始游戏 |
| 获取房间信息 | GET | `/room/:code` | - | `{ success, data: { code, players, maxPlayers, gameMode, gameState, allReady } }` | 查询房间详情 |
| 游戏动作 | POST | `/game/action` | `roomCode: string`<br>`playerId: string`<br>`action: string`<br>`payload: object` | `{ success, data }` | 执行游戏动作（摸牌/出牌/过牌/提交） |
| 获取游戏状态 | GET | `/game/state` | `roomCode, playerId` (query) | `{ success, data: { gameState, players } }` | 轮询获取最新游戏状态 |
| 获取头像列表 | GET | `/avatars` | - | `{ success, data: string[] }` | 获取可用头像路径列表 |

### 2.2 Socket.IO 事件 (server/index.js)

**客户端发送事件：**

| 事件名 | 参数 | 功能说明 |
|-------|------|---------|
| `createRoom` | `{ playerName, avatar, gameMode }` | 创建房间 |
| `joinRoom` | `{ roomCode, playerName, avatar }` | 加入房间 |
| `updateAvatar` | `{ roomCode, avatar }` | 更新头像 |
| `playerReady` | `roomCode` | 切换准备状态 |
| `startGame` | `roomCode` | 房主开始游戏 |
| `syncGameState` | `roomCode` | 请求同步游戏状态 |
| `playerAction` | `{ roomCode, action, payload }` | 执行游戏动作 |
| `leaveRoom` | `roomCode` | 离开房间 |

**服务器发送事件：**

| 事件名 | 参数 | 功能说明 |
|-------|------|---------|
| `avatars` | `string[]` | 连接后发送头像列表 |
| `roomCreated` | `{ roomCode }` | 房间创建成功 |
| `roomInfo` | room object | 房间信息更新广播 |
| `joinSuccess` | `{ roomCode }` | 加入房间成功 |
| `joinFailed` | `{ message }` | 加入房间失败 |
| `gameStarted` | filtered gameState | 游戏开始通知 |
| `gameState` | filtered gameState | 游戏状态更新 |
| `actionRejected` | `{ message }` | 动作被拒绝 |

---

## 3. 核心工具函数说明

### 3.1 game-core.js 核心函数

| 函数名 | 参数 | 返回值 | 功能描述 |
|-------|------|--------|---------|
| `createDeck` | `gameMode: 'classic'/'deluxe'` | `Card[]` | 创建并洗牌，经典版106张，豪华版112张 |
| `shuffleArray` | `array: any[]` | `any[]` | Fisher-Yates 洗牌算法 |
| `initGameState` | `players: Player[]`<br>`gameMode: string` | `GameState` | 初始化游戏状态，发牌（2人14张，3-4人13张） |
| `calculateHandScore` | `hand: Card[]`<br>`hasBrokenIce: boolean` | `number` | 计算手牌分数，未破冰加倍，镜像百搭牌0分 |
| `calculateGroupScore` | `group: Card[]` | `number` | 计算牌组分数，双百搭在同数字组中计2倍 |
| `getJokerRepresentedValue` | `cards: Card[]` | `number` | 推断百搭牌代表的数字 |
| `sortGroupCards` | `cards: Card[]` | `Card[]` | 牌组排序，镜像百搭置于中央 |
| `isValidGroup` | `cards: Card[]` | `boolean` | 快速判断牌组是否有效 |
| `validateGroup` | `cards: Card[]` | `{ valid, type, message }` | 完整验证牌组（含百搭牌） |
| `validateGroupWithJokers` | `normalCards, jokers` | `{ valid, type }` | 含百搭牌的牌组验证入口 |
| `validateGroupWithBasicJokers` | `normalCards, jokers` | `{ valid, type }` | 基础百搭牌验证 |
| `validateRunWithBasicJokers` | `normalCards, jokers` | `{ valid }` | 基础百搭顺子验证 |
| `validateColorChangeRun` | `normalCards, jokers` | `{ valid }` | 颜色百搭顺子验证 |
| `validateMirrorGroup` | `normalCards, jokers` | `{ valid, type }` | 镜像百搭牌组验证入口 |
| `validateMirrorSameNumberGroup` | `normalCards` | `{ valid }` | 镜像同数字组验证（左右对称） |
| `validateMirrorRunGroup` | `normalCards` | `{ valid }` | 镜像顺子组验证（左右对称） |
| `groupCards` | `cards: Card[]` | `GroupedCards` | 按颜色和数字分组卡牌 |
| `tryFormRun` | `sorted: Card[]`<br>`jokers: Card[]` | `{ valid, usedJokers }` | 尝试用百搭牌组成顺子 |
| `validateMove` | `cards, gameState, playerIndex` | `{ valid, message }` | 验证出牌动作 |
| `validateTable` | `tableGroups` | `{ valid, message }` | 验证桌面所有牌组合规 |
| `endGameWithFewestTiles` | `gameState` | `void` | 牌堆耗尽时结束游戏，剩余最少者胜 |
| `processPlayCard` | `gameState, playerId, cards, tableGroups` | `{ success, message }` | 处理出牌动作 |
| `processDrawCard` | `gameState, playerId` | `{ success, message }` | 处理摸牌动作 |
| `processPass` | `gameState, playerId` | `{ success, message }` | 处理过牌动作 |
| `processSubmit` | `gameState, playerId` | `{ success, message, gameState }` | 提交回合，验证并结算 |

### 3.2 客户端核心函数 (index.html)

| 函数名 | 参数 | 返回值 | 功能描述 |
|-------|------|--------|---------|
| `saveTurnSnapshot` | `actionType: string` | `void` | 保存完整回合状态快照（用于撤销） |
| `sortHand` | - | `void` | 理牌：自动识别并整理有效牌组 |
| `organizeHand` | `cards: Card[]` | `{ sortedHand, groupIndices }` | 手牌整理算法（贪心策略） |
| `undoAction` | - | `void` | 撤销上一步操作（从快照恢复） |
| `handleGroupClick` | `groupIndex: number` | `void` | 点击桌面牌组（拆组/添加牌） |
| `handleCardRemoveFromGroup` | `groupIndex, cardIndex` | `void` | 从牌组移除单张牌（智能拆分顺子） |
| `resetTurnState` | - | `void` | 重置本回合所有临时状态 |
| `findBotMove` | `player: Player` | `Move` | Bot 玩家决策算法 |
| `calculateFlexibility` | `group, colorGroups, numGroups` | `number` | 计算牌组可扩展性权重 |
| `calculateGroupWeight` | `cards, type, jokerCount` | `number` | 计算牌组综合权重 |
| `showStatus` | `message, type, duration` | `void` | 显示状态栏提示信息 |
| `showToast` | `message, type` | `void` | 显示浮动提示 |
| `filterGameStateForPlayer` | `gameState, playerId` | `GameState` | 过滤其他玩家手牌（隐私保护） |

---

## 4. 未完成的遗留问题

### 4.1 功能待实现

- [ ] **撤销功能服务端同步**：当前撤销仅在客户端本地生效，多人模式下撤销后状态无法同步到服务器和其他玩家
- [ ] **Bot 玩家高级策略**：当前 Bot 只使用简单贪心策略，缺乏深度规划和策略性
- [ ] **游戏回放功能**：记录整局游戏操作历史，支持回放查看
- [ ] **聊天系统**：多人模式下玩家间文字聊天
- [ ] **游戏设置面板**：可自定义游戏规则（初始手牌数、破冰分数等）
- [ ] **音效系统**：出牌、摸牌、获胜等场景音效

### 4.2 已知缺陷

- [ ] **Socket.IO 服务器撤销功能未实现**：`playerAction` 的 `undo` case 为空，服务器不处理撤销请求
- [ ] **多人模式临时牌组状态同步**：临时牌组 `tempGroup1/2` 仅存在客户端，多人模式下其他玩家看不到拆解过程
- [ ] **断网重连恢复**：Socket.IO 断开后重连，游戏状态恢复逻辑不完善
- [ ] **移动端拖拽体验**：触摸设备上卡牌拖拽操作灵敏度需优化
- [ ] **牌堆耗尽边界情况**：连续过牌判定逻辑在某些边缘情况下可能提前结束游戏

### 4.3 优化建议

- [ ] **性能优化**：`organizeHand` 函数在大牌组情况下可能超过 300ms，建议增加剪枝优化
- [ ] **代码结构**：index.html 中 JavaScript 代码过长（8500+行），建议拆分为独立模块
- [ ] **TypeScript 迁移**：逐步迁移到 TypeScript 以获得更好的类型安全
- [ ] **单元测试**：为 game-core.js 添加 Jest 单元测试，覆盖所有验证逻辑
- [ ] **错误监控**：集成 Sentry 等错误监控工具，收集线上异常
- [ ] **国际化**：提取所有文案到语言包，支持多语言切换

---

## 5. 常用调试命令

### 5.1 开发启动命令

```bash
# 启动 Socket.IO 多人游戏服务器
cd Rummikub
npm run dev

# 或直接运行
node server/index.js

# 构建生产版本（复制到 dist 目录）
npm run build
```

### 5.2 部署命令

```bash
# 部署到 IGA Pages（预览环境）
iga pages deploy

# 查看部署列表
iga pages list
```

### 5.3 Git 命令

```bash
# 查看当前状态
git status

# 查看提交历史
git log --oneline -20

# 添加并提交
git add .
git commit -m "描述信息"

# 推送到远程仓库
git push origin main

# 查看远程仓库地址
git remote -v

# 修改远程仓库地址
git remote set-url origin https://github.com/equeenking/Rummikub
```

### 5.4 问题排查命令

```bash
# 检查 Node.js 版本
node --version

# 检查 npm 版本
npm --version

# 查看端口占用（查找 3000 端口）
netstat -ano | findstr :3000

# 杀死占用端口的进程
taskkill /PID <进程ID> /F

# 查看当前目录结构
dir /s /b *.js | findstr /v node_modules

# 检查文件编码和行尾符
# (使用 VS Code 右下角状态栏查看)
```

### 5.5 浏览器调试技巧

1. **Console 面板**：
   - 输入 `currentGameState` 查看当前游戏状态
   - 输入 `selectedCards` 查看选中的卡牌
   - 输入 `tempGroup1` / `tempGroup2` 查看临时牌组

2. **Network 面板**：
   - 筛选 `WS` 查看 Socket.IO 实时通信
   - 筛选 `Fetch/XHR` 查看 HTTP 轮询请求
   - 检查 `game/state` 轮询频率和响应数据

3. **Application 面板**：
   - 查看 `localStorage` 中的用户设置
   - 检查 `sessionStorage` 中的临时数据

4. **常见报错定位**：
   - `Uncaught SyntaxError: redeclaration` → 检查变量重复声明
   - `Uncaught ReferenceError: xxx is not defined` → 检查函数/变量作用域
   - `socket.io connection error` → 检查服务器是否启动、CORS 配置

---

## 6. 游戏规则速查

### 6.1 基本规则

- **玩家人数**：2-4人
- **初始手牌**：2人 → 14张，3-4人 → 13张
- **破冰要求**：首次出牌牌组总分 ≥ 30分
- **获胜条件**：最先出完手牌者胜；牌堆耗尽则剩余最少者胜

### 6.2 牌组类型

1. **顺子组 (Run)**：同颜色，数字连续，≥3张
2. **同数字组 (Group)**：同数字，不同颜色，≥3张

### 6.3 百搭牌类型（豪华版）

| 类型 | 图标 | 规则 | 分数 |
|-----|------|------|------|
| 基础百搭 | 🌈 | 可代表任意数字和颜色 | 30 |
| 双百搭 | 👥 | 同数字组中占2个连续位置 | 30×2（同数字组） |
| 颜色百搭 | 💎 | 连接不同颜色的顺子 | 30 |
| 镜像百搭 | 🪞 | 置于牌组中央，左右对称 | 0 |

### 6.4 桌面牌组拆解规则

- 点击桌面牌组进入拆解模式
- 拆分为两个独立临时牌组（虚线边框标识）
- 每个临时牌组可放入 1-2 张牌
- 验证仅在提交时进行
- 支持从手牌/其他牌组移动卡牌
