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

### 部署环境差异

| 特性 | Socket.IO 服务器 | IGA Pages / Serverless |
|-----|-----------------|----------------------|
| 实时通信 | ✅ WebSocket | ❌ 不支持，需 HTTP 轮询 |
| 状态存储 | ✅ 内存 Map | ⚠️ 多实例不可靠，需外部数据库 |
| 多人对战 | ✅ 完整支持 | ⚠️ 受实例隔离限制 |
| 扩展性 | 需手动扩容 | 自动弹性伸缩 |
| 部署方式 | PM2 / Docker / ECS | IGA Pages / 扣子编程 |

> **重要**：Serverless 环境（IGA Pages、扣子编程）中，房间状态存储在内存 Map 中，不同请求可能命中不同函数实例，导致跨实例房间数据丢失。多人对战功能需将状态持久化到外部数据库（如 Redis、PostgreSQL）才能正常工作。

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
- [ ] **Serverless 多人对战不可用**：`api/[[default]].js` 使用内存 Map 存储房间状态，多实例部署时跨实例数据丢失，多人对战功能失效
- [ ] **Serverless WebSocket 不支持**：IGA Pages / 扣子编程等 Serverless 平台不支持 WebSocket，需依赖 HTTP 轮询，实时性较差
- [ ] **预览 URL Token 过期**：IGA Pages 预览 URL 的 `iga_token` 为临时凭证，每次重新部署后旧 token 立即失效（返回 410 Gone）

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
# 构建生产版本（复制到 dist 目录）
npm run build

# 部署到火山引擎 IGA Pages
iga pages deploy
iga pages deploy --name rummikub-game

# 查看部署列表
iga pages list

# 查看项目信息
iga pages link --format=json

# 查看环境变量
iga pages env list
```

### 5.3 多人游戏测试命令

```bash
# 运行多人游戏自动化测试（2人/3人/4人）
node test-multiplayer.js

# 测试单个 API 接口
curl -X POST http://localhost:3000/room/create \
  -H "Content-Type: application/json" \
  -d '{"playerName":"test","gameMode":"classic"}'
```

### 5.4 Git 命令

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

### 5.5 问题排查命令

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

### 5.6 浏览器调试技巧

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

---

## 7. 部署与环境配置

### 7.1 GitHub 仓库

- **仓库地址**：https://github.com/equeenking/Rummikub
- **主分支**：main
- **忽略文件**：`node_modules/`、`dist/`、`*.log`、`.env`、`test-*.js`、`.iga/`

### 7.2 火山引擎 IGA Pages 部署

#### 项目信息

| 项目 | 信息 |
|-----|------|
| 项目名称 | rummikub-game |
| 项目 ID | dzkgg9ayrl |
| 预览域名格式 | `https://rummikub-game-dzkgg9ayrl-{deploy-id}.preview.iga-pages.com` |
| 正式域名格式 | `https://rummikub-game-dzkgg9ayrl.iga-pages.com`（需发布到生产环境） |

#### 关键配置

1. **API 路径双重挂载**：`server/index.js` 中同时挂载带 `/api` 前缀和不带前缀的路由，兼容本地和 IGA Pages 环境
2. **CORS 中间件**：`api/[[default]].js` 中添加 `cors()` 中间件，解决跨域请求问题
3. **构建脚本**：`build.cjs` 将 `index.html`、`game-core.js`、`tutorial.js`、`api/[[default]].js` 和 `images/` 复制到 `dist/` 目录
4. **环境检测**：前端通过 `isIgaPreviewEnv()` 检测 IGA 环境，自动切换 API 请求路径前缀

#### 已知问题

- **410 Gone**：预览 URL 的 `iga_token` 是临时凭证，每次重新部署后旧 token 立即失效
- **Serverless 实例隔离**：内存状态（房间 Map）在多实例间不共享，多人对战功能不可靠
- **WebSocket 不支持**：IGA Pages 不支持 WebSocket，需使用 HTTP 轮询

### 7.3 扣子编程部署需求

#### 前置要求

- 注册扣子编程账号（https://www.coze.cn/）
- 项目试运行通过
- 可选：准备已备案的自定义域名

#### 部署方式

1. **从 GitHub 导入**：支持直接导入 GitHub 仓库
2. **AI 编程创建**：通过自然语言描述生成项目

#### 关键适配工作

| 适配项 | 说明 | 优先级 |
|-------|------|--------|
| 状态持久化 | 将内存 Map 改为数据库存储（支持 MySQL/PostgreSQL） | 高 |
| API 路径适配 | 确认 `/api/*` 路径在扣子编程环境中可正确访问 | 中 |
| CORS 配置 | 确保支持扣子编程域名的跨域请求 | 中 |
| 环境变量 | 将 API 地址、数据库连接等配置为环境变量 | 中 |
| WebSocket 替代 | 使用 HTTP 轮询或 SSE 替代实时通信 | 中 |

#### 部署流程

1. 左侧导航栏 → 项目管理 → 导入项目（从 GitHub）
2. 配置数据库集成（如需多人对战）
3. 修改 API 代码使用数据库存储房间状态
4. 配置环境变量
5. 点击部署 → 配置域名 → 开始部署

---

## 8. 多人游戏测试与问题修复记录

### 8.1 测试覆盖

| 测试类型 | 状态 | 说明 |
|---------|------|------|
| 2人游戏 | ✅ 通过 | 完整流程测试通过，184回合，正常结束 |
| 3人游戏 | ⚠️ 限流 | 创建房间时触发服务器限流（100次/分钟） |
| 4人游戏 | ⚠️ 限流 | 同上，连续测试时触发限流 |

### 8.2 浏览器控制台 4 条错误日志分析与修复

#### 错误 1：JSON 解析错误

```
SyntaxError: Unexpected token '<', "<!DOCTYPE"... is not valid JSON
```

- **原因**：前端在火山引擎环境中给 API 路径添加了 `/api` 前缀，但服务器端没有对应路由，返回了 HTML 页面而非 JSON
- **修复**：在 `server/index.js` 中同时挂载带前缀和不带前缀的路由：
  ```javascript
  app.use(apiRouter);
  app.use('/api', apiRouter);
  ```

#### 错误 2：请求中止

```
net::ERR_ABORTED http://localhost:3000/
```

- **原因**：跨域资源共享（CORS）问题
- **修复**：在 `api/[[default]].js` 中添加 CORS 中间件：
  ```javascript
  app.use(cors());
  ```

#### 错误 3-4：域名解析失败

```
net::ERR_NAME_NOT_RESOLVED f00v5hdjnx.iga-pages.com
```

- **原因**：旧项目域名 DNS 解析失败，项目已迁移到新 ID（dzkgg9ayrl）
- **说明**：需使用最新的项目地址访问

### 8.3 测试脚本关键修复

1. **出牌失败无限重试**：出牌失败时仍将 `actionTaken` 设为 true，导致玩家卡在出牌阶段
   - 修复：仅在出牌成功时设置 `actionTaken = true`

2. **请求限流**：测试脚本请求频率过高触发服务器限流
   - 修复：添加 `delay` 函数控制请求间隔（500ms），摸牌失败时实现重试机制

3. **牌堆为空处理**：牌堆耗尽后玩家应过牌而非继续摸牌
   - 修复：添加过牌（pass）操作处理

### 8.4 构建脚本修复

- **问题**：`build.cjs` 未打包 `game-core.js` 和 `tutorial.js`，导致 Serverless 函数无法导入游戏核心模块
- **修复**：在构建脚本中添加这两个文件的复制
