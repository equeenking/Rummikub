/**
 * Rummikub 统一游戏核心模块
 * 所有版本（经典版/豪华版）和所有模式（人机/多人）共用的核心游戏逻辑
 * 同时支持 Node.js ES Module 导入和浏览器 <script> 标签加载
 */

// ============ 牌堆与游戏状态 ============

function createDeck(gameMode = 'classic') {
    const colors = ['red', 'yellow', 'blue', 'black'];
    const deck = [];

    colors.forEach(color => {
        for (let num = 1; num <= 13; num++) {
            deck.push({
                id: `${color}-${num}-a`,
                color: color,
                number: num,
                isJoker: false
            });
            deck.push({
                id: `${color}-${num}-b`,
                color: color,
                number: num,
                isJoker: false
            });
        }
    });

    deck.push({ id: 'joker-1', isJoker: true, jokerType: 'basic' });
    deck.push({ id: 'joker-2', isJoker: true, jokerType: 'basic' });

    if (gameMode === 'deluxe') {
        deck.push({ id: 'joker-double-1', isJoker: true, jokerType: 'double' });
        deck.push({ id: 'joker-double-2', isJoker: true, jokerType: 'double' });
        deck.push({ id: 'joker-color-1', isJoker: true, jokerType: 'color' });
        deck.push({ id: 'joker-color-2', isJoker: true, jokerType: 'color' });
        deck.push({ id: 'joker-mirror-1', isJoker: true, jokerType: 'mirror' });
        deck.push({ id: 'joker-mirror-2', isJoker: true, jokerType: 'mirror' });
    }

    return shuffleArray(deck);
}

function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function initGameState(players, gameMode) {
    const deck = createDeck(gameMode);
    const gameState = {
        players: players.map(p => ({
            id: p.id,
            persistentId: p.persistentId,
            name: p.name,
            avatar: p.avatar,
            isBot: p.isBot || false,
            hand: [],
            hasBrokenIce: false,
            isReady: p.isReady || false
        })),
        currentIndex: 0,
        deck: deck,
        table: [],
        winner: null,
        gameStatus: 'playing',
        hasDrawnThisTurn: false,
        actionHistory: [],
        gameMode: gameMode,
        consecutivePasses: 0
    };

    const playerCount = gameState.players.length;
    const initialTiles = playerCount === 2 ? 14 : 13;

    gameState.players.forEach(player => {
        player.hand = gameState.deck.splice(0, initialTiles);
    });

    return gameState;
}

// ============ 分数计算 ============

function calculateHandScore(hand, hasBrokenIce = true) {
    let score = hand.reduce((sum, card) => {
        if (card.isJoker) {
            if (card.jokerType === 'mirror') {
                return sum + 0;
            }
            return sum + 30;
        }
        return sum + card.number;
    }, 0);
    if (!hasBrokenIce) {
        score *= 2;
    }
    return score;
}

function calculateGroupScore(group) {
    let total = 0;
    const jokerValue = getJokerRepresentedValue(group);
    const normalCards = group.filter(c => !c.isJoker);
    const uniqueNumbers = new Set(normalCards.map(c => c.number));

    for (const card of group) {
        if (card.isJoker) {
            if (card.jokerType === 'mirror') {
                total += 0;
            } else if (card.jokerType === 'double' && uniqueNumbers.size === 1) {
                total += jokerValue * 2;
            } else {
                total += jokerValue;
            }
        } else {
            total += card.number;
        }
    }
    return total;
}

function getJokerRepresentedValue(cards) {
    const normalCards = cards.filter(c => !c.isJoker);
    const jokerCount = cards.length - normalCards.length;

    if (jokerCount === 0) return 0;

    const colors = normalCards.map(c => c.color);
    const numbers = normalCards.map(c => c.number);

    const uniqueColors = new Set(colors);
    const uniqueNumbers = new Set(numbers);

    if (uniqueNumbers.size === 1 && normalCards.length >= 1) {
        return numbers[0];
    }

    if (uniqueColors.size === 1 && normalCards.length >= 2) {
        const sorted = [...numbers].sort((a, b) => a - b);
        const gaps = [];
        for (let i = 1; i < sorted.length; i++) {
            const gap = sorted[i] - sorted[i - 1] - 1;
            if (gap > 0) {
                for (let j = 1; j <= gap; j++) {
                    gaps.push(sorted[i - 1] + j);
                }
            }
        }
        if (gaps.length >= jokerCount) {
            return gaps[0];
        }
        if (sorted[0] > 1) {
            return sorted[0] - 1;
        }
        if (sorted[sorted.length - 1] < 13) {
            return sorted[sorted.length - 1] + 1;
        }
        return 0;
    }

    if (uniqueColors.size === 1 && normalCards.length === 1 && jokerCount >= 2) {
        return numbers[0];
    }

    if (normalCards.length === 0 && jokerCount >= 3) {
        return 10;
    }

    return 0;
}

// ============ 排序 ============

function getJokerSortOrder(jokerType) {
    const order = { 'basic': 0, 'color': 1, 'mirror': 2, 'double': 3 };
    return order[jokerType] || 0;
}

function calculateJokerValue(card, groupCards) {
    if (card.tempValue !== undefined && card.tempValue !== null) {
        return card.tempValue;
    }

    if (!card.isJoker) return card.number;

    const normalCards = groupCards.filter(c => !c.isJoker && c.id !== card.id);
    if (normalCards.length === 0) return 0;

    const colors = normalCards.map(c => c.color);
    const numbers = normalCards.map(c => c.number);
    const uniqueColors = new Set(colors);
    const uniqueNumbers = new Set(numbers);

    if (uniqueNumbers.size === 1) {
        return numbers[0];
    }

    if (uniqueColors.size === 1) {
        const sorted = [...numbers].sort((a, b) => a - b);
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        const totalNeeded = max - min + 1;
        const missing = totalNeeded - sorted.length;

        if (missing <= 1) {
            for (let i = 1; i < sorted.length; i++) {
                if (sorted[i] !== sorted[i - 1] + 1) {
                    return sorted[i - 1] + 1;
                }
            }
            if (min > 1) return min - 1;
            if (max < 13) return max + 1;
        }
    }

    return 0;
}

function sortGroupCards(cards) {
    const normalCards = cards.filter(c => !c.isJoker);
    const jokers = cards.filter(c => c.isJoker);

    if (normalCards.length === 0) {
        return [...cards].sort((a, b) => getJokerSortOrder(a.jokerType) - getJokerSortOrder(b.jokerType));
    }

    const colors = normalCards.map(c => c.color);
    const numbers = normalCards.map(c => c.number);
    const uniqueColors = new Set(colors);
    const uniqueNumbers = new Set(numbers);

    if (uniqueNumbers.size === 1) {
        const colorOrder = { 'red': 0, 'yellow': 1, 'blue': 2, 'black': 3 };
        const sortedCards = [...cards].sort((a, b) => {
            if (!a.isJoker && !b.isJoker) {
                return colorOrder[a.color] - colorOrder[b.color];
            }
            if (!a.isJoker) return -1;
            if (!b.isJoker) return 1;
            return getJokerSortOrder(a.jokerType) - getJokerSortOrder(b.jokerType);
        });

        const mirrorIndex = sortedCards.findIndex(c => c.isJoker && c.jokerType === 'mirror');
        if (mirrorIndex !== -1 && sortedCards.length >= 3) {
            const mirrorCard = sortedCards.splice(mirrorIndex, 1)[0];
            const insertIndex = Math.floor(sortedCards.length / 2);
            sortedCards.splice(insertIndex, 0, mirrorCard);
        }

        return sortedCards;
    }

    if (uniqueColors.size === 1) {
        const jokerValues = {};
        jokers.forEach(joker => {
            jokerValues[joker.id] = getJokerRepresentedValue(cards);
        });

        const sortedCards = [...cards].sort((a, b) => {
            if (!a.isJoker && !b.isJoker) {
                return a.number - b.number;
            }

            const valA = a.isJoker ? (jokerValues[a.id] || 0) : a.number;
            const valB = b.isJoker ? (jokerValues[b.id] || 0) : b.number;

            if (valA !== valB) {
                return valA - valB;
            }

            if (a.isJoker && b.isJoker) {
                return getJokerSortOrder(a.jokerType) - getJokerSortOrder(b.jokerType);
            }

            if (a.isJoker) return 1;
            if (b.isJoker) return -1;

            return 0;
        });

        const mirrorIndex = sortedCards.findIndex(c => c.isJoker && c.jokerType === 'mirror');
        if (mirrorIndex !== -1 && sortedCards.length >= 3) {
            const mirrorCard = sortedCards.splice(mirrorIndex, 1)[0];
            const insertIndex = Math.floor(sortedCards.length / 2);
            sortedCards.splice(insertIndex, 0, mirrorCard);
        }

        return sortedCards;
    }

    return [...cards].sort((a, b) => {
        if (!a.isJoker && !b.isJoker) {
            return a.number - b.number;
        }

        const valA = a.isJoker ? calculateJokerValue(a, cards) : a.number;
        const valB = b.isJoker ? calculateJokerValue(b, cards) : b.number;

        if (valA !== valB) {
            return valA - valB;
        }

        if (a.isJoker && b.isJoker) {
            return getJokerSortOrder(a.jokerType) - getJokerSortOrder(b.jokerType);
        }

        if (a.isJoker) return 1;
        if (b.isJoker) return -1;

        return 0;
    });
}

// ============ 牌组验证 ============

function isValidGroup(cards) {
    if (!Array.isArray(cards) || cards.length < 3) return false;
    const result = validateGroup(cards);
    return result.valid;
}

function validateGroup(cards) {
    if (!Array.isArray(cards) || cards.length < 3) {
        return { valid: false, message: '牌组至少需要3张牌' };
    }

    const normalCards = cards.filter(c => !c.isJoker);
    const jokers = cards.filter(c => c.isJoker);

    if (jokers.length === 0) {
        const colors = normalCards.map(c => c.color);
        const numbers = normalCards.map(c => c.number);

        const allSameColor = colors.every(c => c === colors[0]);
        const allSameNumber = numbers.every(n => n === numbers[0]);

        if (allSameColor && allSameNumber) {
            return { valid: false, message: '不能同时同色同号' };
        }

        if (allSameNumber) {
            const uniqueColors = new Set(colors);
            if (uniqueColors.size < 3) {
                return { valid: false, message: `同号牌组需要至少3种不同颜色，当前只有${uniqueColors.size}种` };
            }
            if (uniqueColors.size !== cards.length) {
                return { valid: false, message: '同号牌组中存在重复颜色' };
            }
            return { valid: true, message: '有效同号牌组' };
        }

        if (allSameColor) {
            const uniqueNumbers = new Set(numbers);
            if (uniqueNumbers.size !== numbers.length) {
                return { valid: false, message: '连续牌组中存在重复数字' };
            }
            const sorted = [...numbers].sort((a, b) => a - b);
            for (let i = 1; i < sorted.length; i++) {
                if (sorted[i] !== sorted[i - 1] + 1) {
                    return { valid: false, message: `连续牌组中存在不连续的数字：${sorted[i-1]} 和 ${sorted[i]}` };
                }
            }
            return { valid: true, message: '有效连续牌组' };
        }

        return { valid: false, message: '牌组既不是同号也不是连续' };
    }

    return validateGroupWithJokers(normalCards, jokers);
}

function validateGroupWithJokers(normalCards, jokers) {
    if (normalCards.length === 0) {
        return { valid: false, message: '百搭牌不能单独组成牌组，需要至少1张普通牌' };
    }

    const colors = normalCards.map(c => c.color);
    const numbers = normalCards.map(c => c.number);
    const uniqueColors = new Set(colors);
    const uniqueNumbers = new Set(numbers);

    const hasColorJoker = jokers.some(j => j.jokerType === 'color');
    const hasMirrorJoker = jokers.some(j => j.jokerType === 'mirror');

    if (hasMirrorJoker) {
        return validateMirrorGroup(normalCards, jokers);
    }

    if (hasColorJoker) {
        if (uniqueNumbers.size > 1) {
            return validateColorChangeRun(normalCards, jokers);
        }
        return { valid: false, message: '变色百搭牌只能在连续牌组中使用' };
    }

    if (uniqueNumbers.size === 1) {
        return validateGroupWithBasicJokers(normalCards, jokers);
    }

    if (uniqueColors.size === 1 && uniqueNumbers.size > 1) {
        return validateRunWithBasicJokers(normalCards, jokers);
    }

    return { valid: false, message: '包含鬼牌的牌组既不是同号也不是连续' };
}

function validateGroupWithBasicJokers(normalCards, jokers) {
    const uniqueColors = new Set(normalCards.map(c => c.color));

    if (uniqueColors.size !== normalCards.length) {
        return { valid: false, message: '同号牌组中存在重复颜色' };
    }

    let doubleJokerCount = 0;
    let basicJokerCount = 0;

    for (const joker of jokers) {
        if (joker.jokerType === 'double') {
            doubleJokerCount++;
        } else if (joker.jokerType === 'basic') {
            basicJokerCount++;
        }
    }

    const totalColors = uniqueColors.size + doubleJokerCount * 2 + basicJokerCount;

    if (totalColors < 3) {
        return { valid: false, message: `同号牌组需要至少3种颜色，当前只有${totalColors}种` };
    }
    if (totalColors > 4) {
        return { valid: false, message: `同号牌组最多只能有4种颜色，当前有${totalColors}种` };
    }

    return { valid: true, message: '有效同号牌组' };
}

function validateRunWithBasicJokers(normalCards, jokers) {
    const numbers = normalCards.map(c => c.number);
    const uniqueNumbers = new Set(numbers);

    if (uniqueNumbers.size !== numbers.length) {
        return { valid: false, message: '连续牌组中存在重复数字' };
    }

    const sorted = [...numbers].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const totalNeeded = max - min + 1;
    const missing = totalNeeded - sorted.length;

    let doubleJokerCount = 0;
    let basicJokerCount = 0;

    for (const joker of jokers) {
        if (joker.jokerType === 'double') {
            doubleJokerCount++;
        } else if (joker.jokerType === 'basic') {
            basicJokerCount++;
        }
    }

    const effectiveJokerCount = doubleJokerCount * 2 + basicJokerCount;

    if (missing > effectiveJokerCount) {
        return { valid: false, message: `连续牌组需要${missing}个空缺填补，当前百搭牌可填补${effectiveJokerCount}个` };
    }

    for (const joker of jokers) {
        if (joker.jokerType === 'double') {
            if (min === 1) {
                return { valid: false, message: '双人百搭牌不能放在数字1后面（2之前）' };
            }
            if (max === 13) {
                return { valid: false, message: '双人百搭牌不能放在数字13前面（12之后）' };
            }
            // 双人百搭牌需要恰好2个连续数字位置
            // 如果空缺数<2，只有在空缺为0且可以扩展2个位置时才有效
            if (missing < 2 * doubleJokerCount) {
                if (missing === 0 && (min >= 3 || max <= 11)) {
                    // 可以在序列两端扩展2个连续位置
                } else {
                    return { valid: false, message: '双人百搭牌需要2个连续数字位置，当前空缺不足' };
                }
            }
        }
    }

    const totalCards = numbers.length + effectiveJokerCount;
    if (totalCards < 3) {
        return { valid: false, message: `连续牌组需要至少3张牌，当前只有${totalCards}张` };
    }

    return { valid: true, message: '有效连续牌组' };
}

function validateColorChangeRun(normalCards, jokers) {
    const colorJokers = jokers.filter(j => j.jokerType === 'color');
    const otherJokers = jokers.filter(j => j.jokerType !== 'color');

    if (colorJokers.length > 1) {
        return { valid: false, message: '一个连续牌组中只能有一个变色百搭牌' };
    }

    const sorted = [...normalCards].sort((a, b) => a.number - b.number);

    const leftNumbers = [];
    const rightNumbers = [];
    const leftColor = sorted[0].color;
    let rightColor = null;

    let jokerPosition = -1;

    for (let i = 0; i < sorted.length - 1; i++) {
        const gap = sorted[i + 1].number - sorted[i].number;
        if (gap >= 2) {
            jokerPosition = i;
            rightColor = sorted[i + 1].color;
            break;
        }
    }

    if (jokerPosition === -1) {
        const min = sorted[0].number;
        const max = sorted[sorted.length - 1].number;

        if (min > 1) {
            jokerPosition = -1;
            rightColor = sorted[0].color;
        } else if (max < 13) {
            jokerPosition = sorted.length - 1;
            rightColor = sorted[sorted.length - 1].color;
        } else {
            return { valid: false, message: '变色百搭牌需要在两种颜色之间有位置' };
        }
    }

    if (leftColor === rightColor) {
        return { valid: false, message: '变色百搭牌需要连接两种不同颜色的连续牌' };
    }

    for (let i = 0; i <= jokerPosition; i++) {
        if (sorted[i].color !== leftColor) {
            return { valid: false, message: '变色百搭牌左侧牌颜色不一致' };
        }
    }

    for (let i = jokerPosition + 1; i < sorted.length; i++) {
        if (sorted[i].color !== rightColor) {
            return { valid: false, message: '变色百搭牌右侧牌颜色不一致' };
        }
    }

    let effectiveJokerCount = 1;
    for (const joker of otherJokers) {
        if (joker.jokerType === 'double') {
            effectiveJokerCount += 2;
        } else {
            effectiveJokerCount += 1;
        }
    }

    const min = sorted[0].number;
    const max = sorted[sorted.length - 1].number;
    const totalNeeded = max - min + 1;
    const missing = totalNeeded - sorted.length;

    if (missing > effectiveJokerCount) {
        return { valid: false, message: `连续牌组需要${missing}个空缺填补，当前百搭牌可填补${effectiveJokerCount}个` };
    }

    const totalCards = sorted.length + effectiveJokerCount;
    if (totalCards < 3) {
        return { valid: false, message: `连续牌组需要至少3张牌，当前只有${totalCards}张` };
    }

    return { valid: true, message: '有效变色连续牌组' };
}

function validateMirrorGroup(normalCards, jokers) {
    const mirrorJokers = jokers.filter(j => j.jokerType === 'mirror');

    if (mirrorJokers.length !== 1) {
        return { valid: false, message: '镜像百搭牌必须且只能有一个' };
    }

    const numbers = normalCards.map(c => c.number);
    const uniqueNumbers = new Set(numbers);

    if (uniqueNumbers.size === 1) {
        return validateMirrorSameNumberGroup(normalCards);
    }

    if (uniqueNumbers.size > 1) {
        return validateMirrorRunGroup(normalCards);
    }

    return { valid: false, message: '镜像百搭牌的牌组无效' };
}

function validateMirrorSameNumberGroup(normalCards) {
    const colorCount = {};
    for (const card of normalCards) {
        colorCount[card.color] = (colorCount[card.color] || 0) + 1;
    }

    for (const count of Object.values(colorCount)) {
        if (count % 2 !== 0) {
            return { valid: false, message: '镜像同数字组中每种颜色的数量必须是偶数' };
        }
    }

    const totalCards = normalCards.length + 1;
    if (totalCards < 3) {
        return { valid: false, message: `镜像牌组需要至少3张牌，当前只有${totalCards}张` };
    }

    const uniqueColors = new Set(normalCards.map(c => c.color));
    if (uniqueColors.size + Object.keys(colorCount).length / 2 > 4) {
        return { valid: false, message: '同数字组最多只能有4种颜色' };
    }

    return { valid: true, message: '有效镜像同数字组' };
}

function validateMirrorRunGroup(normalCards) {
    const sorted = [...normalCards].sort((a, b) => a.number - b.number);
    const numbers = sorted.map(c => c.number);

    const leftNumbers = [];
    const rightNumbers = [];

    const mid = Math.floor(numbers.length / 2);
    const isEven = numbers.length % 2 === 0;

    if (isEven) {
        for (let i = 0; i < mid; i++) {
            leftNumbers.push(numbers[i]);
            rightNumbers.push(numbers[numbers.length - 1 - i]);
        }
    } else {
        for (let i = 0; i < mid; i++) {
            leftNumbers.push(numbers[i]);
            rightNumbers.push(numbers[numbers.length - 1 - i]);
        }
    }

    for (let i = 0; i < leftNumbers.length; i++) {
        if (leftNumbers[i] !== rightNumbers[i]) {
            return { valid: false, message: '镜像连续牌组两侧数字必须对称' };
        }
    }

    const uniqueNumbers = new Set(numbers);
    if (uniqueNumbers.size !== numbers.length) {
        return { valid: false, message: '镜像连续牌组中存在重复数字' };
    }

    const totalCards = normalCards.length + 1;
    if (totalCards < 3) {
        return { valid: false, message: `镜像牌组需要至少3张牌，当前只有${totalCards}张` };
    }

    const colors = normalCards.map(c => c.color);
    const uniqueColors = new Set(colors);
    if (uniqueColors.size !== 1) {
        return { valid: false, message: '镜像连续牌组必须是同一种颜色' };
    }

    return { valid: true, message: '有效镜像连续牌组' };
}

// ============ 自动分组 ============

function groupCards(cards) {
    if (!cards || cards.length < 3) return null;

    if (isValidGroup(cards)) {
        return [cards];
    }

    const jokers = cards.filter(c => c.isJoker);
    const normalCards = cards.filter(c => !c.isJoker);

    const allPossibleGroups = [];

    const numGroups = {};
    normalCards.forEach(card => {
        if (!numGroups[card.number]) numGroups[card.number] = [];
        numGroups[card.number].push(card);
    });

    for (const num in numGroups) {
        const group = numGroups[num];
        const uniqueColorCards = [];
        const usedColors = new Set();
        
        for (const card of group) {
            if (!usedColors.has(card.color)) {
                usedColors.add(card.color);
                uniqueColorCards.push(card);
            }
        }
        
        if (uniqueColorCards.length >= 3) {
            for (let len = 3; len <= uniqueColorCards.length; len++) {
                const combo = uniqueColorCards.slice(0, len);
                if (isValidGroup(combo)) {
                    const score = combo.reduce((s, c) => s + (c.isJoker ? 30 : c.number), 0);
                    allPossibleGroups.push({ cards: combo, score, type: 'group' });
                }
            }
        }
        
        if (uniqueColorCards.length + jokers.length >= 3) {
            for (let jokerCount = 0; jokerCount <= jokers.length; jokerCount++) {
                const combo = [...uniqueColorCards, ...jokers.slice(0, jokerCount)];
                if (combo.length >= 3 && isValidGroup(combo)) {
                    const score = combo.reduce((s, c) => s + (c.isJoker ? 30 : c.number), 0);
                    allPossibleGroups.push({ cards: combo, score, type: 'group' });
                }
            }
        }
    }

    const colorGroups = {};
    normalCards.forEach(card => {
        if (!colorGroups[card.color]) colorGroups[card.color] = [];
        colorGroups[card.color].push(card);
    });

    for (const color in colorGroups) {
        const group = colorGroups[color];
        if (group.length >= 3) {
            const sorted = [...group].sort((a, b) => a.number - b.number);
            
            for (let i = 0; i <= sorted.length - 3; i++) {
                for (let j = i + 2; j < sorted.length; j++) {
                    const run = sorted.slice(i, j + 1);
                    const uniqueNumbers = [...new Set(run.map(c => c.number))];
                    const isConsecutive = uniqueNumbers.every((n, idx) => idx === 0 || n === uniqueNumbers[idx - 1] + 1);
                    if (isConsecutive && uniqueNumbers.length >= 3) {
                        const deduplicated = [];
                        const usedNumbers = new Set();
                        for (const card of run) {
                            if (!usedNumbers.has(card.number)) {
                                usedNumbers.add(card.number);
                                deduplicated.push(card);
                            }
                        }
                        if (isValidGroup(deduplicated)) {
                            const score = deduplicated.reduce((s, c) => s + (c.isJoker ? 30 : c.number), 0);
                            allPossibleGroups.push({ cards: deduplicated, score, type: 'run' });
                        }
                    }
                }
            }
        }
        
        if (group.length + jokers.length >= 3) {
            const sorted = [...group].sort((a, b) => a.number - b.number);
            
            for (let i = 0; i <= sorted.length - 2; i++) {
                for (let j = i + 1; j < sorted.length; j++) {
                    const partialRun = sorted.slice(i, j + 1);
                    
                    let missingCount = 0;
                    for (let k = 1; k < partialRun.length; k++) {
                        missingCount += partialRun[k].number - partialRun[k - 1].number - 1;
                    }
                    
                    if (missingCount <= jokers.length) {
                        const neededJokers = Math.min(missingCount, jokers.length);
                        const combo = [...partialRun, ...jokers.slice(0, neededJokers)];
                        if (isValidGroup(combo)) {
                            const score = combo.reduce((s, c) => s + (c.isJoker ? 30 : c.number), 0);
                            allPossibleGroups.push({ cards: combo, score, type: 'run' });
                        }
                    }
                }
            }
        }
    }

    if (allPossibleGroups.length === 0) return null;

    allPossibleGroups.sort((a, b) => b.score - a.score);

    const bestScoreGroup = allPossibleGroups[0];
    return [bestScoreGroup.cards];
}

function findFirstValidGroup(cards) {
    if (!cards || cards.length < 3) return null;

    const jokers = cards.filter(c => c.isJoker);
    const normalCards = cards.filter(c => !c.isJoker);

    const numGroups = {};
    normalCards.forEach(card => {
        if (!numGroups[card.number]) numGroups[card.number] = [];
        numGroups[card.number].push(card);
    });

    for (const num in numGroups) {
        const group = numGroups[num];
        const uniqueColorCards = [];
        const usedColors = new Set();
        
        for (const card of group) {
            if (!usedColors.has(card.color)) {
                usedColors.add(card.color);
                uniqueColorCards.push(card);
            }
        }
        
        if (uniqueColorCards.length >= 3) {
            const combo = uniqueColorCards.slice(0, 4);
            if (isValidGroup(combo)) return combo;
        }
        
        if (uniqueColorCards.length + jokers.length >= 3) {
            const neededJokers = Math.max(0, 3 - uniqueColorCards.length);
            const combo = [...uniqueColorCards, ...jokers.slice(0, neededJokers)];
            if (isValidGroup(combo)) return combo;
        }
    }

    const colorGroups = {};
    normalCards.forEach(card => {
        if (!colorGroups[card.color]) colorGroups[card.color] = [];
        colorGroups[card.color].push(card);
    });

    for (const color in colorGroups) {
        const group = colorGroups[color];
        if (group.length >= 3) {
            const sorted = [...group].sort((a, b) => a.number - b.number);
            
            for (let i = 0; i <= sorted.length - 3; i++) {
                for (let j = i + 2; j < sorted.length; j++) {
                    const run = sorted.slice(i, j + 1);
                    const isConsecutive = run.every((c, idx) => idx === 0 || c.number === run[idx - 1].number + 1);
                    if (isConsecutive) {
                        return run;
                    }
                }
            }
        }
    }

    return null;
}

function tryGroupCardsRecursive(cards, jokers) {
    const remainingCards = cards.filter(c => !c.used);
    const remainingJokers = jokers.filter(j => !j.used);
    
    if (remainingCards.length === 0) return [];

    const normalCards = remainingCards.filter(c => !c.isJoker);
    const availableJokers = [...remainingJokers];

    const colorGroups = {};
    const numGroups = {};

    normalCards.forEach(card => {
        if (!colorGroups[card.color]) colorGroups[card.color] = [];
        colorGroups[card.color].push(card);
        if (!numGroups[card.number]) numGroups[card.number] = [];
        numGroups[card.number].push(card);
    });

    for (const color in colorGroups) {
        const group = colorGroups[color];
        if (group.length + availableJokers.length >= 3) {
            const sorted = [...group].sort((a, b) => a.number - b.number);
            const runResult = tryFormRun(sorted, availableJokers);
            if (runResult) {
                runResult.forEach(c => {
                    const idx = cards.findIndex(x => x.id === c.id);
                    if (idx >= 0) cards[idx].used = true;
                });
                
                const subResult = tryGroupCardsRecursive(cards, jokers);
                if (subResult !== null) {
                    cards.forEach(c => delete c.used);
                    jokers.forEach(j => delete j.used);
                    return [runResult, ...subResult];
                }
                
                runResult.forEach(c => {
                    const idx = cards.findIndex(x => x.id === c.id);
                    if (idx >= 0) delete cards[idx].used;
                });
            }
        }
    }

    for (const num in numGroups) {
        const group = numGroups[num];
        const colors = new Set(group.map(c => c.color));
        const availableColors = colors.size + availableJokers.length;
        if (availableColors >= 3 && availableColors <= 4) {
            const neededJokers = Math.max(0, 3 - colors.size);
            const usedJokers = availableJokers.slice(0, neededJokers);
            const comboResult = [...group, ...usedJokers];
            
            if (isValidGroup(comboResult)) {
                comboResult.forEach(c => {
                    const idx = cards.findIndex(x => x.id === c.id);
                    if (idx >= 0) cards[idx].used = true;
                });
                
                const subResult = tryGroupCardsRecursive(cards, jokers);
                if (subResult !== null) {
                    cards.forEach(c => delete c.used);
                    jokers.forEach(j => delete j.used);
                    return [comboResult, ...subResult];
                }
                
                comboResult.forEach(c => {
                    const idx = cards.findIndex(x => x.id === c.id);
                    if (idx >= 0) delete cards[idx].used;
                });
            }
        }
    }

    if (availableJokers.length >= 3 && normalCards.length === 0) {
        const jokerGroup = availableJokers.slice(0, 3);
        return [jokerGroup];
    }

    if (normalCards.length === 1 && availableJokers.length >= 2) {
        const result = [...normalCards, ...availableJokers.slice(0, 2)];
        if (isValidGroup(result)) return [result];
    }

    return null;
}

function tryFormRun(sorted, jokers) {
    if (sorted.length === 0) return null;

    const min = sorted[0].number;
    const max = sorted[sorted.length - 1].number;
    const totalNeeded = max - min + 1;
    const missing = totalNeeded - sorted.length;

    if (missing <= jokers.length && totalNeeded >= 3) {
        const result = [...sorted];
        let jokerIdx = 0;
        for (let i = 1; i < sorted.length; i++) {
            const gap = sorted[i].number - sorted[i - 1].number - 1;
            for (let j = 0; j < gap && jokerIdx < jokers.length; j++) {
                const jokerValue = sorted[i - 1].number + j + 1;
                const jokerCopy = { ...jokers[jokerIdx], tempValue: jokerValue };
                result.push(jokerCopy);
                jokerIdx++;
            }
        }
        return result.sort((a, b) => {
            const valA = a.isJoker ? (a.tempValue || 0) : a.number;
            const valB = b.isJoker ? (b.tempValue || 0) : b.number;
            return valA - valB;
        });
    }

    if (sorted.length >= 2 && jokers.length >= 1) {
        if (min > 1) {
            const jokerCopy = { ...jokers[0], tempValue: min - 1 };
            return [jokerCopy, ...sorted].sort((a, b) => {
                const valA = a.isJoker ? (a.tempValue || 0) : a.number;
                const valB = b.isJoker ? (b.tempValue || 0) : b.number;
                return valA - valB;
            });
        }
        if (max < 13) {
            const jokerCopy = { ...jokers[0], tempValue: max + 1 };
            return [...sorted, jokerCopy].sort((a, b) => {
                const valA = a.isJoker ? (a.tempValue || 0) : a.number;
                const valB = b.isJoker ? (b.tempValue || 0) : b.number;
                return valA - valB;
            });
        }
    }

    return null;
}

// ============ 出牌验证 ============

function validateMove(cards, gameState, playerIndex) {
    if (cards.length < 3) return { valid: false, message: '至少需要3张牌' };

    const groups = groupCards(cards);
    if (!groups) return { valid: false, message: '无法组成有效组合' };

    for (const group of groups) {
        if (!isValidGroup(group)) return { valid: false, message: '组合无效' };
    }

    if (gameState && playerIndex !== undefined) {
        const player = gameState.players[playerIndex];
        if (!player.hasBrokenIce) {
            let totalScore = 0;
            groups.forEach(g => totalScore += calculateGroupScore(g));
            if (totalScore < 30) {
                return { valid: false, message: `首次出牌需要至少30分，当前得分: ${totalScore}` };
            }
        }
    }

    return { valid: true, message: '' };
}

function validateTable(tableGroups) {
    if (!tableGroups || tableGroups.length === 0) return true;

    for (const group of tableGroups) {
        if (!group.cards || group.cards.length === 0) {
            return false;
        }
        const result = validateGroup(group.cards);
        if (!result.valid) {
            return false;
        }
    }

    return true;
}

// ============ 游戏结束 ============

function endGameWithFewestTiles(gameState, reason = 'deckEmpty') {
    let minScore = Infinity;
    let winner = null;

    for (const player of gameState.players) {
        const score = calculateHandScore(player.hand, player.hasBrokenIce);
        if (score < minScore) {
            minScore = score;
            winner = player;
        }
    }

    gameState.winner = winner;
    gameState.gameStatus = 'ended';
    gameState.endReason = reason;
    return winner;
}

// ============ 统一操作处理 ============

/**
 * 处理出牌操作的核心逻辑
 * 所有模式共用此函数进行验证和状态更新
 * @returns {{ success: boolean, message?: string, gameState?: object }}
 */
function processPlayCard(gameState, playerId, cards, tableGroups) {
    console.log('[processPlayCard] 收到出牌请求:', {
        playerId: playerId.substring(0, 8) + '...',
        cardsCount: cards ? cards.length : 0,
        tableGroupsCount: tableGroups ? tableGroups.length : 0,
        currentIndex: gameState.currentIndex,
        playerIndex: gameState.players.findIndex(p => p.id === playerId || p.persistentId === playerId),
        hasDrawnThisTurn: gameState.hasDrawnThisTurn
    });
    
    if (!gameState || !Array.isArray(gameState.players)) {
        return { success: false, message: '游戏状态无效' };
    }
    const playerIndex = gameState.players.findIndex(p => p.id === playerId || p.persistentId === playerId);
    if (playerIndex === -1) {
        return { success: false, message: '玩家不在游戏中' };
    }

    if (gameState.currentIndex !== playerIndex) {
        return { success: false, message: '不是你的回合' };
    }

    if (gameState.hasDrawnThisTurn) {
        return { success: false, message: '本回合已摸牌，不能再出牌' };
    }

    const currentPlayer = gameState.players[playerIndex];

    if (!cards || cards.length === 0) {
        if (!tableGroups || tableGroups.length === 0) {
            return { success: false, message: '请选择要出的牌或操作桌面牌组' };
        }
    } else {
        for (const card of cards) {
            const idx = currentPlayer.hand.findIndex(c => c.id === card.id);
            if (idx === -1) {
                return { success: false, message: '你手中没有这张牌: ' + card.id };
            }
        }
    }

    const hasTableGroups = tableGroups && tableGroups.length > 0;
    const hasPlayedHandCards = cards && cards.length > 0;
    let totalScore = 0;

    // 未破冰玩家禁止操作桌面牌组（只能用手牌独立组成新牌组破冰）
    // 精确判断：只有当原有桌面牌组被修改时才拒绝
    if (hasTableGroups && !currentPlayer.hasBrokenIce) {
        const originalGroups = gameState.table;
        const newGroups = tableGroups;
        
        if (originalGroups.length > 0) {
            let modifiedOriginalGroups = false;
            const usedNewGroupIndices = new Set();
            
            for (const origGroup of originalGroups) {
                const origCardIds = new Set(origGroup.cards.map(c => c.id));
                let foundMatch = false;
                
                for (let i = 0; i < newGroups.length; i++) {
                    if (usedNewGroupIndices.has(i)) continue;
                    const newGroup = newGroups[i];
                    if (newGroup.cards.length !== origGroup.cards.length) continue;
                    
                    const newCardIds = new Set(newGroup.cards.map(c => c.id));
                    let allMatch = true;
                    for (const id of origCardIds) {
                        if (!newCardIds.has(id)) {
                            allMatch = false;
                            break;
                        }
                    }
                    
                    if (allMatch) {
                        foundMatch = true;
                        usedNewGroupIndices.add(i);
                        break;
                    }
                }
                
                if (!foundMatch) {
                    modifiedOriginalGroups = true;
                    break;
                }
            }
            
            if (modifiedOriginalGroups) {
                return { success: false, message: '尚未破冰，不能操作桌面牌组，请先用手牌组成独立牌组破冰' };
            }
        }
    }

    // 收集所有合法卡牌ID，用于验证 tableGroups 卡牌来源
    const handCardIds = new Set(hasPlayedHandCards ? cards.map(c => c.id) : []);
    const tableCardIds = new Set();
    gameState.table.forEach(g => g.cards.forEach(c => tableCardIds.add(c.id)));

    let finalTableGroups = [];

    if (hasTableGroups) {
        const hasTempGroups = tableGroups.some(g => g.cards.length < 3);
        if (hasTempGroups) {
            return { success: false, message: '临时牌组不足3张，请添加卡牌后再出牌' };
        }

        // 验证所有桌组卡牌来源合法（要么来自手牌，要么来自原有桌面）
        for (const group of tableGroups) {
            for (const card of group.cards) {
                if (!handCardIds.has(card.id) && !tableCardIds.has(card.id)) {
                    return { success: false, message: '卡牌来源非法: ' + card.id };
                }
            }
        }

        // 验证所有手牌都出现在桌组中（不允许出牌消失）
        if (hasPlayedHandCards) {
            const tableGroupCardIds = new Set();
            tableGroups.forEach(g => g.cards.forEach(c => tableGroupCardIds.add(c.id)));
            for (const card of cards) {
                if (!tableGroupCardIds.has(card.id)) {
                    return { success: false, message: '出牌未放入桌面牌组: ' + card.id };
                }
            }
        }

        // 验证原有桌面的所有牌都还在桌组中（不允许丢牌）
        const allTableGroupCardIds = new Set();
        tableGroups.forEach(g => g.cards.forEach(c => allTableGroupCardIds.add(c.id)));
        for (const origCardId of tableCardIds) {
            if (!allTableGroupCardIds.has(origCardId)) {
                return { success: false, message: '桌面牌丢失: ' + origCardId };
            }
        }

        // 验证桌组有效性
        for (const group of tableGroups) {
            const validation = validateGroup(group.cards);
            if (!validation.valid) {
                return { success: false, message: validation.message };
            }
            finalTableGroups.push({ cards: [...group.cards] });
        }

        // 破冰验证（有桌组时，仅计算手牌本身的分值作为破冰贡献）
        if (hasPlayedHandCards && !currentPlayer.hasBrokenIce) {
            for (const card of cards) {
                totalScore += card.isJoker ? 30 : card.number;
            }
            if (totalScore < 30) {
                return { success: false, message: `首次出牌需要至少30分，当前得分: ${totalScore}` };
            }
        }
    } else if (hasPlayedHandCards) {
        const groups = groupCards(cards);
        if (!groups || groups.length === 0) {
            return { success: false, message: '这些牌无法组成有效组合' };
        }

        for (const group of groups) {
            if (!isValidGroup(group)) {
                return { success: false, message: '组合无效' };
            }
        }

        for (const card of cards) {
            totalScore += card.isJoker ? 30 : card.number;
        }

        if (!currentPlayer.hasBrokenIce && totalScore < 30) {
            return { success: false, message: `首次出牌需要至少30分，当前得分: ${totalScore}` };
        }

        finalTableGroups = gameState.table.map(g => ({ cards: [...g.cards] }));
        groups.forEach(g => {
            finalTableGroups.push({ cards: g });
        });
    } else {
        return { success: false, message: '请选择要出的牌' };
    }

    // 从手牌中移除已出的牌
    if (hasPlayedHandCards) {
        for (const card of cards) {
            const idx = currentPlayer.hand.findIndex(c => c.id === card.id);
            if (idx >= 0) currentPlayer.hand.splice(idx, 1);
        }

        if (!currentPlayer.hasBrokenIce) {
            currentPlayer.hasBrokenIce = true;
        }
    }

    finalTableGroups.forEach(g => {
        g.cards = sortGroupCards(g.cards);
    });

    gameState.table = finalTableGroups;
    gameState.consecutivePasses = 0;

    if (currentPlayer.hand.length === 0) {
        gameState.winner = currentPlayer;
        gameState.gameStatus = 'ended';
        gameState.endReason = 'normal';
    } else {
        gameState.currentIndex = (gameState.currentIndex + 1) % gameState.players.length;
        gameState.hasDrawnThisTurn = false;
    }
    
    console.log('[processPlayCard] 出牌成功:', {
        newTableGroupsCount: gameState.table.length,
        newCurrentIndex: gameState.currentIndex,
        playerHandCount: currentPlayer.hand.length,
        hasBrokenIce: currentPlayer.hasBrokenIce
    });

    return { success: true, gameState };
}

/**
 * 处理摸牌操作的核心逻辑
 */
function processDrawCard(gameState, playerId) {
    if (!gameState || !Array.isArray(gameState.players)) {
        return { success: false, message: '游戏状态无效' };
    }
    const playerIndex = gameState.players.findIndex(p => p.id === playerId || p.persistentId === playerId);
    if (playerIndex === -1) {
        return { success: false, message: '玩家不在游戏中' };
    }

    if (gameState.currentIndex !== playerIndex) {
        return { success: false, message: '不是你的回合' };
    }

    if (gameState.hasDrawnThisTurn) {
        return { success: false, message: '本回合已经摸过牌' };
    }

    const currentPlayer = gameState.players[playerIndex];
    const playerCount = gameState.players.length;

    if (gameState.deck.length > 0) {
        const drawnCard = gameState.deck.pop();
        currentPlayer.hand.push(drawnCard);
        gameState.hasDrawnThisTurn = true;
        gameState.consecutivePasses = 0;

        if (currentPlayer.hand.length === 0) {
            gameState.winner = currentPlayer;
            gameState.gameStatus = 'ended';
            gameState.endReason = 'normal';
        } else {
            gameState.currentIndex = (gameState.currentIndex + 1) % playerCount;
        }

        gameState.hasDrawnThisTurn = false;

        return { success: true, gameState, drawnCard };
    } else {
        return { success: false, message: '牌堆已空，请出牌或过牌' };
    }
}

/**
 * 处理过牌操作的核心逻辑
 */
function processPass(gameState, playerId) {
    if (!gameState || !Array.isArray(gameState.players)) {
        return { success: false, message: '游戏状态无效' };
    }
    const playerIndex = gameState.players.findIndex(p => p.id === playerId || p.persistentId === playerId);
    if (playerIndex === -1) {
        return { success: false, message: '玩家不在游戏中' };
    }

    if (gameState.currentIndex !== playerIndex) {
        return { success: false, message: '不是你的回合' };
    }

    const playerCount = gameState.players.length;
    if (playerCount === 0) {
        return { success: false, message: '无玩家' };
    }

    gameState.consecutivePasses = (gameState.consecutivePasses || 0) + 1;

    if (gameState.consecutivePasses >= playerCount) {
        endGameWithFewestTiles(gameState, 'allPassed');
    } else {
        gameState.currentIndex = (gameState.currentIndex + 1) % playerCount;
        gameState.hasDrawnThisTurn = false;
    }

    return { success: true, gameState };
}

/**
 * 处理提交操作的核心逻辑（当前未使用，保留以备扩展）
 */
function processSubmit(gameState, playerId) {
    const playerIndex = gameState.players.findIndex(p => p.id === playerId || p.persistentId === playerId);
    if (playerIndex === -1) {
        return { success: false, message: '玩家不在游戏中' };
    }

    if (gameState.currentIndex !== playerIndex) {
        return { success: false, message: '不是你的回合' };
    }

    const currentPlayer = gameState.players[playerIndex];

    if (currentPlayer.hand.length === 0) {
        gameState.winner = currentPlayer;
        gameState.gameStatus = 'ended';
        gameState.endReason = 'normal';
    } else {
        gameState.currentIndex = (gameState.currentIndex + 1) % gameState.players.length;
        gameState.hasDrawnThisTurn = false;
    }

    return { success: true, gameState };
}

// ============ 导出 ============

const GameCore = {
    createDeck,
    shuffleArray,
    initGameState,
    calculateHandScore,
    calculateGroupScore,
    getJokerRepresentedValue,
    getJokerSortOrder,
    calculateJokerValue,
    sortGroupCards,
    isValidGroup,
    validateGroup,
    validateGroupWithJokers,
    validateGroupWithBasicJokers,
    validateRunWithBasicJokers,
    validateColorChangeRun,
    validateMirrorGroup,
    validateMirrorSameNumberGroup,
    validateMirrorRunGroup,
    groupCards,
    tryFormRun,
    validateMove,
    validateTable,
    endGameWithFewestTiles,
    processPlayCard,
    processDrawCard,
    processPass,
    processSubmit
};

// 浏览器全局导出（客户端 <script> 标签使用）
if (typeof window !== 'undefined') {
    window.GameCore = GameCore;
}

// Node.js 全局导出（服务器端通过 globalThis.GameCore 访问）
// 注意：不能使用 ES Module 的 export 语法，否则浏览器以普通 <script> 加载时会语法错误
if (typeof globalThis !== 'undefined' && !globalThis.GameCore) {
    globalThis.GameCore = GameCore;
}
