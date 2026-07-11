/**
 * Rummikub 嵌入式新手引导系统
 * 在游戏页面上通过遮罩、高亮和箭头引导用户操作
 */

class GameGuideSystem {
    constructor() {
        this.isActive = false;
        this.currentStep = 0;
        this.completedSteps = new Set();
        this.gameState = null;
        this.pollingInterval = null;
        this.exampleShowing = false;
        this.standaloneMode = false;
        this.demoMode = false;

        this.guideSteps = [
            {
                id: 'intro',
                title: '欢迎来到拉密',
                text: '在这个引导中，我将带你熟悉游戏的核心操作。点击任意位置开始。',
                selector: null,
                position: 'center',
                requireAction: 'any_click'
            },
            {
                id: 'hand_cards',
                title: '认识手牌',
                text: '这是你的手牌区域。点击任意一张牌来选中它。',
                selector: '#hand-cards',
                position: 'top',
                requireAction: 'card_click'
            },
            {
                id: 'sort_button',
                title: '理牌',
                text: '点击"理牌"按钮可以智能整理手牌。',
                selector: '.control-btn.purple',
                position: 'top',
                requireAction: 'sort_click'
            },
            {
                id: 'card_types',
                title: '牌组类型示例',
                text: '点击查看顺子和刻子的示例（含无效牌组对比），学会区分它们。',
                selector: null,
                position: 'center',
                requireAction: 'example',
                exampleType: 'basic_groups'
            },
            {
                id: 'joker_types',
                title: '百搭牌示例',
                text: '豪华版中还有特殊百搭牌，点击查看示例。',
                selector: null,
                position: 'center',
                requireAction: 'example',
                exampleType: 'jokers'
            },
            {
                id: 'ice_break_rule',
                title: '破冰规则',
                text: '首次出牌必须满足"破冰"条件：牌组必须是有效的顺子或刻子，且总分需≥30分。点击任意位置继续。',
                selector: null,
                position: 'center',
                requireAction: 'any_click'
            },
            {
                id: 'select_cards',
                title: '选择牌组',
                text: '理牌后已自动选中有效牌组。记住两条规则：顺子=同色连续3张以上；刻子=同号不同色3张以上。所有出牌都必须满足其一。',
                selector: '#hand-cards',
                position: 'top',
                requireAction: 'multiple_selected'
            },
            {
                id: 'play_button',
                title: '出牌破冰',
                text: '选中牌组后，点击"出牌"按钮将牌组放到桌面完成破冰。',
                selector: '.control-btn.brand',
                position: 'top',
                requireAction: 'play_click'
            },
            {
                id: 'table_area',
                title: '桌面牌组',
                text: '桌面牌组在这里显示。破冰后，你可以将手牌加入已有牌组，或拆分重组它们。注意：所有牌组必须符合规则——要么是顺子，要么是刻子。',
                selector: '#table-groups',
                position: 'bottom',
                requireAction: 'any_click'
            },
            {
                id: 'add_to_table',
                title: '添加手牌到桌面',
                text: '操作分两步：① 先点选一张手牌选中它；② 再点选桌面上的牌组，卡牌会自动加入该牌组。加入后牌组仍必须是顺子或刻子，否则操作无效。',
                selector: '#table-groups',
                position: 'bottom',
                requireAction: 'any_click'
            },
            {
                id: 'split_table',
                title: '拆分与重组',
                text: '操作演示：点击桌面牌组（红色5-6-7-8-9-10）中的任意一张牌，该牌组会被拆分为两个临时牌组。拆分后你可以将手牌加入临时牌组重新组合。关键规则：拆分后每个牌组仍必须是顺子或刻子，否则无法提交。',
                selector: '#table-groups',
                position: 'top',
                requireAction: 'split_table'
            },
            {
                id: 'add_to_split',
                title: '加入手牌',
                text: '拆分后，尝试将手牌加入临时牌组！操作方法：① 先点选手牌中的红色4或红色J；② 再点击临时牌组，卡牌会自动加入。注意：加入后牌组仍必须是有效的顺子或刻子。',
                selector: '#table-groups',
                position: 'bottom',
                requireAction: 'add_to_split'
            },
            {
                id: 'draw_card',
                title: '摸牌',
                text: '如果无法出牌，点击"摸牌"按钮抽一张新牌。',
                selector: '#btn-draw',
                position: 'top',
                requireAction: 'draw_click'
            },
            {
                id: 'comfort',
                title: '鼓励',
                text: '如果未能破冰不要气馁，继续摸牌等待机会，好的牌组总会出现的！点击继续。',
                selector: null,
                position: 'center',
                requireAction: 'any_click'
            },
            {
                id: 'finish',
                title: '引导完成',
                text: '恭喜！你已掌握基本操作。牢记核心规则：所有牌组必须是顺子（同色连续）或刻子（同号不同色），否则无法出牌。开始你的游戏之旅吧！',
                selector: null,
                position: 'center',
                requireAction: 'any_click'
            }
        ];

        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        const self = this;

        document.addEventListener('click', function(e) {
            if (!self.isActive || self.exampleShowing) return;

            const currentStep = self.guideSteps[self.currentStep];
            if (!currentStep) return;

            if (e.target.closest('.guide-skip-btn')) {
                self.endGuide();
                return;
            }

            if (e.target.closest('.guide-next-btn')) {
                return;
            }

            if (e.target.closest('.guide-tooltip')) {
                return;
            }

            if (currentStep.requireAction === 'example') {
                return;
            }

            if (currentStep.requireAction) {
                self.handleUserAction(e, currentStep.requireAction);
            }
        });

        document.addEventListener('cardSelected', function() {
            self.onCardSelected();
        });

        document.addEventListener('cardPlayed', function() {
            self.onCardPlayed();
        });

        document.addEventListener('turnStarted', function() {
            self.onTurnStarted();
        });

        let resizeTimer = null;
        window.addEventListener('resize', function() {
            if (!self.isActive) return;
            if (resizeTimer) clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function() {
                const currentStep = self.guideSteps[self.currentStep];
                if (!currentStep) return;
                if (self.exampleShowing) return;
                self.showStep(self.currentStep);
            }, 300);
        });

        window.addEventListener('orientationchange', function() {
            if (!self.isActive) return;
            setTimeout(function() {
                self.showStep(self.currentStep);
            }, 500);
        });
    }

    createMiniTile(color, number, isJoker, jokerType) {
        const tile = document.createElement('div');
        tile.className = 'mini-tile';
        if (isJoker) {
            tile.classList.add('joker');
            const jt = jokerType || 'basic';
            tile.classList.add('joker-' + jt);
            const jokerIcons = { 'basic': '😄', 'double': '👥', 'color': '🌈', 'mirror': '🪞' };
            tile.innerHTML = '<span>' + (jokerIcons[jt] || '😄') + '</span>';
        } else if (color) {
            tile.classList.add(color);
            tile.innerHTML = '<span>' + number + '</span>';
        }
        return tile;
    }

    getExampleData(type) {
        if (type === 'basic_groups') {
            return {
                title: '牌组类型：顺子与刻子',
                tabs: [
                    {
                        tabName: '顺子',
                        items: [
                            {
                                label: '✓ 顺子（同色连续）',
                                desc: '规则：同一种颜色 + 3张以上连续数字。示例：红色 5-6-7',
                                tiles: [
                                    { color: 'red', number: 5 },
                                    { color: 'red', number: 6 },
                                    { color: 'red', number: 7 }
                                ]
                            },
                            {
                                label: '✓ 顺子（可超3张）',
                                desc: '顺子可以超过3张，数字必须连续且同色。示例：蓝色 8-9-10-11-12',
                                tiles: [
                                    { color: 'blue', number: 8 },
                                    { color: 'blue', number: 9 },
                                    { color: 'blue', number: 10 },
                                    { color: 'blue', number: 11 },
                                    { color: 'blue', number: 12 }
                                ]
                            }
                        ]
                    },
                    {
                        tabName: '刻子',
                        items: [
                            {
                                label: '✓ 刻子（同号不同色）',
                                desc: '规则：相同数字 + 3张以上不同颜色。示例：红/蓝/黑 7',
                                tiles: [
                                    { color: 'red', number: 7 },
                                    { color: 'blue', number: 7 },
                                    { color: 'black', number: 7 }
                                ]
                            },
                            {
                                label: '✓ 刻子（四色满编）',
                                desc: '刻子最多可包含4种颜色（红黄蓝黑）。示例：四色 10',
                                tiles: [
                                    { color: 'red', number: 10 },
                                    { color: 'yellow', number: 10 },
                                    { color: 'blue', number: 10 },
                                    { color: 'black', number: 10 }
                                ]
                            }
                        ]
                    },
                    {
                        tabName: '无效对比',
                        items: [
                            {
                                label: '✗ 无效：颜色不同且数字不连续',
                                desc: '错误！顺子必须同色，这组有红有蓝且 5 和 8 不连续',
                                tiles: [
                                    { color: 'red', number: 5 },
                                    { color: 'blue', number: 8 },
                                    { color: 'red', number: 7 }
                                ],
                                invalid: true
                            },
                            {
                                label: '✗ 无效：同号但颜色重复',
                                desc: '错误！刻子中不能有重复颜色，两个红色 7 不合法',
                                tiles: [
                                    { color: 'red', number: 7 },
                                    { color: 'red', number: 7 },
                                    { color: 'blue', number: 7 }
                                ],
                                invalid: true
                            }
                        ]
                    }
                ]
            };
        }
        if (type === 'jokers') {
            return {
                title: '百搭牌详解',
                tabs: [
                    {
                        tabName: '基础百搭 ★',
                        items: [
                            {
                                label: '顺子：填补1个空缺',
                                desc: '作用：替代任意1张缺失的普通牌，保持同色连续。示例：红3 + ★ + 红5-红6 = 红3-4-5-6（百搭代表红4）',
                                tiles: [
                                    { color: 'red', number: 3 },
                                    { isJoker: true, jokerType: 'basic' },
                                    { color: 'red', number: 5 },
                                    { color: 'red', number: 6 }
                                ]
                            },
                            {
                                label: '刻子：补1种颜色',
                                desc: '作用：替代1种缺失颜色的牌，凑够3种颜色。示例：红8 + 蓝8 + ★ = 3种颜色的刻子（百搭代表黄8或黑8）',
                                tiles: [
                                    { color: 'red', number: 8 },
                                    { color: 'blue', number: 8 },
                                    { isJoker: true, jokerType: 'basic' }
                                ]
                            }
                        ]
                    },
                    {
                        tabName: '双倍百搭 👥',
                        items: [
                            {
                                label: '顺子：填补2个连续空缺',
                                desc: '作用：一张抵2张连续数字牌。规则：不能放在1之前或13之后。示例：红5 + 👥 + 红8 = 红5-6-7-8',
                                tiles: [
                                    { color: 'red', number: 5 },
                                    { isJoker: true, jokerType: 'double' },
                                    { color: 'red', number: 8 }
                                ]
                            },
                            {
                                label: '刻子：补2种颜色',
                                desc: '作用：一张抵2种颜色。示例：蓝5 + 👥 + 黑5 = 4种颜色的刻子（双倍代表红5和黄5），价值翻倍',
                                tiles: [
                                    { color: 'blue', number: 5 },
                                    { isJoker: true, jokerType: 'double' },
                                    { color: 'black', number: 5 }
                                ]
                            }
                        ]
                    },
                    {
                        tabName: '颜色百搭 🌈',
                        items: [
                            {
                                label: '顺子：跨色连接',
                                desc: '作用：连接两种不同颜色的顺子，一张牌组中只能有1张。规则：两侧必须是不同颜色且各自连续。示例：红5-红6 + 🌈 + 黄8-黄9-黄10',
                                tiles: [
                                    { color: 'red', number: 5 },
                                    { color: 'red', number: 6 },
                                    { isJoker: true, jokerType: 'color' },
                                    { color: 'yellow', number: 8 },
                                    { color: 'yellow', number: 9 },
                                    { color: 'yellow', number: 10 }
                                ]
                            },
                            {
                                label: '刻子：不能用于刻子！',
                                desc: '注意：颜色百搭只能在顺子中使用，不能用于刻子。红8 + 蓝8 + 🌈 = 无效牌组',
                                tiles: [
                                    { color: 'red', number: 8 },
                                    { color: 'blue', number: 8 },
                                    { isJoker: true, jokerType: 'color' }
                                ],
                                invalid: true
                            }
                        ]
                    },
                    {
                        tabName: '镜像百搭 🪞',
                        items: [
                            {
                                label: '顺子：对称顺子（较难组成）',
                                desc: '作用：构成对称顺子。规则：左右数字必须完全对称。示例：黑5 + 黑6 + 🪞 + 黑6 + 黑5 = 有效对称顺子（价值30分）',
                                tiles: [
                                    { color: 'black', number: 5 },
                                    { color: 'black', number: 6 },
                                    { isJoker: true, jokerType: 'mirror' },
                                    { color: 'black', number: 6 },
                                    { color: 'black', number: 5 }
                                ]
                            },
                            {
                                label: '刻子：成对颜色',
                                desc: '作用：与成对的同色牌组合。规则：每种颜色的牌数必须是偶数。示例：红7 + 🪞 + 红7 = 有效刻子（红7成对，镜像复制红7），总分14分',
                                tiles: [
                                    { color: 'red', number: 7 },
                                    { isJoker: true, jokerType: 'mirror' },
                                    { color: 'red', number: 7 }
                                ]
                            },
                            {
                                label: '刻子：多色成对',
                                desc: '作用：可同时组合多种颜色的成对牌。规则：每种颜色的牌数都必须是偶数。示例：红9×2 + 🪞 + 蓝9×2 = 有效刻子（红蓝各成对），总分36分',
                                tiles: [
                                    { color: 'red', number: 9 },
                                    { color: 'red', number: 9 },
                                    { isJoker: true, jokerType: 'mirror' },
                                    { color: 'blue', number: 9 },
                                    { color: 'blue', number: 9 }
                                ]
                            }
                        ]
                    }
                ]
            };
        }
        return null;
    }

    showExamplePanel(exampleType) {
        if (this.exampleShowing) return;
        this.exampleShowing = true;

        const data = this.getExampleData(exampleType);
        if (!data || !data.tabs || data.tabs.length === 0) {
            this.exampleShowing = false;
            return;
        }

        this.hideAllElements();

        const panel = document.getElementById('guideExamplePanel');
        const titleEl = document.getElementById('examplePanelTitle');
        const tabsEl = document.getElementById('examplePanelTabs');
        const bodyEl = document.getElementById('examplePanelBody');
        const dotsEl = document.getElementById('exampleTabDots');

        titleEl.textContent = data.title;
        tabsEl.innerHTML = '';
        bodyEl.innerHTML = '';
        dotsEl.innerHTML = '';

        const self = this;
        data.tabs.forEach(function(tab, tabIndex) {
            const tabBtn = document.createElement('button');
            tabBtn.className = 'example-tab' + (tabIndex === 0 ? ' active' : '');
            tabBtn.textContent = tab.tabName;
            tabBtn.onclick = function() { self.switchExampleTab(tabIndex); };
            tabsEl.appendChild(tabBtn);

            const dot = document.createElement('span');
            dot.className = 'example-tab-dot' + (tabIndex === 0 ? ' active' : '');
            dot.onclick = function() { self.switchExampleTab(tabIndex); };
            dotsEl.appendChild(dot);

            const contentDiv = document.createElement('div');
            contentDiv.className = 'example-tab-content' + (tabIndex === 0 ? ' active' : '');
            contentDiv.dataset.tabIndex = tabIndex;

            tab.items.forEach(function(item) {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'example-item' + (item.invalid ? ' example-item-invalid' : '');

                const labelDiv = document.createElement('div');
                labelDiv.className = 'example-item-label' + (item.invalid ? ' label-invalid' : '');
                labelDiv.textContent = item.label;

                const descDiv = document.createElement('div');
                descDiv.className = 'example-item-desc';
                descDiv.textContent = item.desc;

                const tilesRow = document.createElement('div');
                tilesRow.className = 'example-tiles-row';

                item.tiles.forEach(function(t) {
                    tilesRow.appendChild(self.createMiniTile(t.color, t.number, t.isJoker, t.jokerType));
                });

                itemDiv.appendChild(labelDiv);
                itemDiv.appendChild(descDiv);
                itemDiv.appendChild(tilesRow);

                if (item.note) {
                    const noteDiv = document.createElement('div');
                    noteDiv.className = 'example-item-note';
                    noteDiv.textContent = '💡 ' + item.note;
                    itemDiv.appendChild(noteDiv);
                }

                contentDiv.appendChild(itemDiv);
            });

            bodyEl.appendChild(contentDiv);
        });

        panel.classList.remove('hidden');
        setTimeout(function() { panel.classList.add('visible'); }, 50);
    }

    switchExampleTab(tabIndex) {
        const tabs = document.querySelectorAll('#examplePanelTabs .example-tab');
        const contents = document.querySelectorAll('#examplePanelBody .example-tab-content');
        const dots = document.querySelectorAll('#exampleTabDots .example-tab-dot');

        tabs.forEach(function(t, i) { t.classList.toggle('active', i === tabIndex); });
        contents.forEach(function(c, i) { c.classList.toggle('active', i === tabIndex); });
        dots.forEach(function(d, i) { d.classList.toggle('active', i === tabIndex); });
    }

    closeGuideExample() {
        const panel = document.getElementById('guideExamplePanel');
        if (panel) {
            panel.classList.remove('visible');
            setTimeout(() => panel.classList.add('hidden'), 300);
        }
        this.exampleShowing = false;

        const currentStep = this.guideSteps[this.currentStep];
        if (currentStep && currentStep.requireAction === 'example') {
            this.playSuccessSound();
            this.nextStep();
        } else {
            this.showStep(this.currentStep);
        }
    }

    continueGuideAfterExample() {
        this.closeGuideExample();
    }

    startGuide() {
        this.isActive = true;

        // 检测是否在游戏中（#hand-cards 是否在游戏页面）
        const inGame = document.querySelector('#gamePage:not(.hidden) #hand-cards');
        if (!inGame) {
            // 主菜单独立模式：显示模拟游戏界面
            this.demoMode = true;
            const demoBoard = document.getElementById('tutorialDemoBoard');
            if (demoBoard) {
                demoBoard.classList.remove('hidden');
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        }

        const overlay = document.getElementById('gameGuideOverlay');
        if (overlay) {
            overlay.classList.remove('hidden');
            if (this.demoMode) {
                overlay.classList.add('demo-mode');
            }
            setTimeout(() => overlay.classList.add('active'), 50);
        }
        this.currentStep = 0;
        this.completedSteps.clear();
        this.showStep(this.currentStep);
        this.renderStepsNav();
        this.startPolling();
    }

    restartGuide() {
        this.completedSteps.clear();
        this.currentStep = 0;
        this.startGuide();
    }

    startPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }

        this.pollingInterval = setInterval(() => {
            if (!this.isActive || this.exampleShowing) return;

            const currentStep = this.guideSteps[this.currentStep];
            if (!currentStep) return;

            if (currentStep.requireAction === 'multiple_selected') {
                const selectedCards = document.querySelectorAll('.game-tile.selected');
                if (selectedCards.length >= 2) {
                    this.playSuccessSound();
                    this.nextStep();
                }
            }

            if (currentStep.requireAction === 'card_played' && currentStep.id === 'table_area') {
                const tableGroups = document.querySelectorAll('#table-groups .tile-group');
                if (tableGroups.length > 0) {
                    this.nextStep();
                }
            }

            if (currentStep.requireAction === 'split_table') {
                const tempGroups = document.querySelectorAll('.temp-group');
                if (tempGroups.length > 0) {
                    this.playSuccessSound();
                    this.nextStep();
                }
            }

            if (currentStep.requireAction === 'add_to_split') {
                const tempGroups = document.querySelectorAll('.temp-group');
                if (tempGroups.length > 0) {
                    const selectedCards = document.querySelectorAll('.game-tile.selected');
                    if (selectedCards.length > 0) {
                        this.playSuccessSound();
                        this.nextStep();
                    }
                }
            }
        }, 500);
    }

    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    getNextStepIndex() {
        for (let i = 0; i < this.guideSteps.length; i++) {
            if (!this.completedSteps.has(this.guideSteps[i].id)) {
                return i;
            }
        }
        return 0;
    }

    prepareSplitDemo() {
        // 演示模式：在模拟界面中填充桌面牌组
        if (this.demoMode) {
            const tableGroups = document.querySelector('#tutorialDemoBoard #table-groups');
            if (tableGroups) {
                tableGroups.innerHTML = '';
                const group = document.createElement('div');
                group.className = 'table-group';
                [
                    { color: 'red', number: 5 },
                    { color: 'red', number: 6 },
                    { color: 'red', number: 7 },
                    { color: 'red', number: 8 },
                    { color: 'red', number: 9 },
                    { color: 'red', number: 10 }
                ].forEach(t => {
                    const tile = document.createElement('div');
                    tile.className = 'game-tile in-group ' + t.color;
                    tile.innerHTML = '<span>' + t.number + '</span>';
                    group.appendChild(tile);
                });
                tableGroups.appendChild(group);
            }
            return;
        }

        if (typeof currentGameState === 'undefined' || !currentGameState) return;

        const currentPlayer = currentGameState.players[currentGameState.currentIndex];
        if (currentPlayer && !currentPlayer.hasBrokenIce) {
            currentPlayer.hasBrokenIce = true;
        }

        const hasLongGroup = currentGameState.table.some(g => g.cards.length >= 5);
        if (hasLongGroup) return;

        const splitGroup = {
            cards: [
                { id: 'tut-split-r-5', color: 'red', number: 5, isJoker: false },
                { id: 'tut-split-r-6', color: 'red', number: 6, isJoker: false },
                { id: 'tut-split-r-7', color: 'red', number: 7, isJoker: false },
                { id: 'tut-split-r-8', color: 'red', number: 8, isJoker: false },
                { id: 'tut-split-r-9', color: 'red', number: 9, isJoker: false },
                { id: 'tut-split-r-10', color: 'red', number: 10, isJoker: false }
            ]
        };

        currentGameState.table.push(splitGroup);

        if (typeof tableWorkingCopy !== 'undefined' && tableWorkingCopy.length > 0) {
            tableWorkingCopy.push({ cards: [...splitGroup.cards] });
        }

        if (typeof updateGame === 'function') {
            updateGame(currentGameState);
        }
    }

    showStep(stepIndex) {
        const step = this.guideSteps[stepIndex];
        if (!step) return;

        this.updateProgressUI(stepIndex);
        this.currentStepRequireAction = step.requireAction;

        if (step.id === 'split_table') {
            this.prepareSplitDemo();
        }

        if (step.selector) {
            let target;
            if (this.demoMode) {
                const demoBoard = document.getElementById('tutorialDemoBoard');
                target = demoBoard ? demoBoard.querySelector(step.selector) : null;
            } else {
                target = document.querySelector(step.selector);
            }
            if (target) {
                const rect = target.getBoundingClientRect();
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                const margin = 12;

                const tooltip = document.getElementById('guideTooltip');
                if (tooltip) {
                    tooltip.style.left = '0px';
                    tooltip.style.top = '0px';
                    tooltip.style.maxWidth = (vw <= 480 ? vw - 24 : vw <= 768 ? vw - 32 : 360) + 'px';
                    tooltip.style.visibility = 'hidden';
                    tooltip.classList.add('visible');
                    const realRect = tooltip.getBoundingClientRect();
                    tooltip.classList.remove('visible');
                    tooltip.style.visibility = '';

                    const tooltipWidth = Math.min(realRect.width || 360, vw - margin * 2);
                    const tooltipHeight = realRect.height || 160;

                    const finalPosition = step.position || this.calculateBestPosition(
                        rect, tooltipWidth, tooltipHeight, vw, vh, margin
                    ).position;

                    this.highlightElement(target, finalPosition);
                    this.showTooltip(step.title, step.text, target, finalPosition);
                    this.showArrow(target, finalPosition);
                }
                this.standaloneMode = this.demoMode;
            } else {
                // 目标元素不存在（主菜单独立模式），降级为中心弹窗
                this.hideHighlight();
                this.hideArrow();
                this.showCenteredTooltip(step.title, step.text);
                this.standaloneMode = true;
            }
        } else {
            this.showCenteredTooltip(step.title, step.text);
            this.standaloneMode = false;
        }

        this.updateTooltipActions(step);
    }

    updateTooltipActions(step) {
        const nextBtn = document.getElementById('guideNextBtn');
        const nextBtnText = document.getElementById('guideNextBtnText');
        const hintEl = document.getElementById('tooltipActionHint');

        if (!nextBtn || !nextBtnText || !hintEl) return;

        const actionHints = {
            'card_click': '请点击下方手牌区域的一张牌',
            'sort_click': '请点击"理牌"按钮',
            'play_click': '请点击"出牌"按钮',
            'draw_click': '请点击"摸牌"按钮',
            'multiple_selected': '请选中2张以上的手牌（点击牌即可选中）',
            'split_table': '请点击桌面牌组中的任意一张牌进行拆分',
            'add_to_split': '请点选手牌后再点击临时牌组'
        };

        // 独立模式：所有交互步骤降级为点击继续
        if (this.standaloneMode && step.requireAction !== 'example' && step.requireAction !== 'any_click') {
            nextBtn.classList.remove('hidden');
            nextBtnText.textContent = '下一步';
            if (this.demoMode) {
                // 演示模式：同时显示操作提示，用户可点击模拟元素或直接下一步
                hintEl.textContent = actionHints[step.requireAction] || '或点击"下一步"继续';
                hintEl.classList.add('visible');
            } else {
                hintEl.classList.remove('visible');
                hintEl.textContent = '';
            }
            return;
        }

        if (step.requireAction === 'any_click') {
            nextBtn.classList.remove('hidden');
            nextBtnText.textContent = '下一步';
            hintEl.classList.remove('visible');
            hintEl.textContent = '';
        } else if (step.requireAction === 'example') {
            nextBtn.classList.remove('hidden');
            nextBtnText.textContent = '查看示例';
            hintEl.classList.remove('visible');
            hintEl.textContent = '';
        } else {
            nextBtn.classList.add('hidden');
            hintEl.textContent = actionHints[step.requireAction] || '请按照提示操作';
            hintEl.classList.add('visible');
        }
    }

    advanceStep() {
        const step = this.guideSteps[this.currentStep];
        if (!step) return;
        if (step.requireAction === 'any_click') {
            this.playSuccessSound();
            this.nextStep();
        } else if (step.requireAction === 'example') {
            this.showExamplePanel(step.exampleType);
        } else if (this.standaloneMode) {
            // 独立模式：允许通过按钮推进
            this.playSuccessSound();
            this.nextStep();
        }
    }

    highlightElement(element, position) {
        const highlight = document.getElementById('guideHighlight');
        if (!highlight) return;

        const rect = element.getBoundingClientRect();
        const padding = 16;

        highlight.style.left = `${rect.left - padding}px`;
        highlight.style.top = `${rect.top - padding}px`;
        highlight.style.width = `${rect.width + padding * 2}px`;
        highlight.style.height = `${rect.height + padding * 2}px`;

        highlight.classList.remove('hidden');
        highlight.style.opacity = '1';
    }

    hideHighlight() {
        const highlight = document.getElementById('guideHighlight');
        if (highlight) {
            highlight.classList.add('hidden');
            highlight.style.opacity = '0';
        }
    }

    hideArrow() {
        const arrow = document.getElementById('guideArrow');
        if (arrow) {
            arrow.classList.add('hidden');
        }
    }

    calculateBestPosition(rect, tooltipWidth, tooltipHeight, vw, vh, margin) {
        const arrowGap = 16;
        const elementCenterX = rect.left + rect.width / 2;
        const elementCenterY = rect.top + rect.height / 2;

        const availableSpaces = {
            top: rect.top - margin,
            bottom: vh - rect.bottom - margin,
            left: rect.left - margin,
            right: vw - rect.right - margin
        };

        const hasEnoughSpace = {
            top: availableSpaces.top >= tooltipHeight + arrowGap,
            bottom: availableSpaces.bottom >= tooltipHeight + arrowGap,
            left: availableSpaces.left >= tooltipWidth + arrowGap,
            right: availableSpaces.right >= tooltipWidth + arrowGap
        };

        let bestPosition = 'top';
        let bestLeft, bestTop;

        const centerArea = {
            left: vw * 0.25,
            right: vw * 0.75,
            top: vh * 0.25,
            bottom: vh * 0.75
        };

        const isLeft = elementCenterX < centerArea.left;
        const isRight = elementCenterX > centerArea.right;
        const isTop = elementCenterY < centerArea.top;
        const isBottom = elementCenterY > centerArea.bottom;

        if (hasEnoughSpace.bottom && !isBottom) {
            bestPosition = isLeft ? 'bottom-left' : isRight ? 'bottom-right' : 'bottom';
        } else if (hasEnoughSpace.top && !isTop) {
            bestPosition = isLeft ? 'top-left' : isRight ? 'top-right' : 'top';
        } else if (hasEnoughSpace.right && !isRight) {
            bestPosition = isTop ? 'right-top' : isBottom ? 'right-bottom' : 'right';
        } else if (hasEnoughSpace.left && !isLeft) {
            bestPosition = isTop ? 'left-top' : isBottom ? 'left-bottom' : 'left';
        } else {
            if (availableSpaces.bottom >= availableSpaces.top) {
                bestPosition = isLeft ? 'bottom-left' : isRight ? 'bottom-right' : 'bottom';
            } else {
                bestPosition = isLeft ? 'top-left' : isRight ? 'top-right' : 'top';
            }
        }

        switch (bestPosition) {
            case 'top':
                bestLeft = rect.left + rect.width / 2 - tooltipWidth / 2;
                bestTop = rect.top - tooltipHeight - arrowGap;
                break;
            case 'top-left':
                bestLeft = rect.left - tooltipWidth / 4;
                bestTop = rect.top - tooltipHeight - arrowGap;
                break;
            case 'top-right':
                bestLeft = rect.right - tooltipWidth * 3 / 4;
                bestTop = rect.top - tooltipHeight - arrowGap;
                break;
            case 'bottom':
                bestLeft = rect.left + rect.width / 2 - tooltipWidth / 2;
                bestTop = rect.bottom + arrowGap;
                break;
            case 'bottom-left':
                bestLeft = rect.left - tooltipWidth / 4;
                bestTop = rect.bottom + arrowGap;
                break;
            case 'bottom-right':
                bestLeft = rect.right - tooltipWidth * 3 / 4;
                bestTop = rect.bottom + arrowGap;
                break;
            case 'left':
                bestLeft = rect.left - tooltipWidth - arrowGap;
                bestTop = rect.top + rect.height / 2 - tooltipHeight / 2;
                break;
            case 'left-top':
                bestLeft = rect.left - tooltipWidth - arrowGap;
                bestTop = rect.top - tooltipHeight / 4;
                break;
            case 'left-bottom':
                bestLeft = rect.left - tooltipWidth - arrowGap;
                bestTop = rect.bottom - tooltipHeight * 3 / 4;
                break;
            case 'right':
                bestLeft = rect.right + arrowGap;
                bestTop = rect.top + rect.height / 2 - tooltipHeight / 2;
                break;
            case 'right-top':
                bestLeft = rect.right + arrowGap;
                bestTop = rect.top - tooltipHeight / 4;
                break;
            case 'right-bottom':
                bestLeft = rect.right + arrowGap;
                bestTop = rect.bottom - tooltipHeight * 3 / 4;
                break;
            default:
                bestLeft = rect.left + rect.width / 2 - tooltipWidth / 2;
                bestTop = rect.top - tooltipHeight - arrowGap;
        }

        bestLeft = Math.max(margin, Math.min(vw - tooltipWidth - margin, bestLeft));
        bestTop = Math.max(margin, Math.min(vh - tooltipHeight - margin, bestTop));

        return { position: bestPosition, left: bestLeft, top: bestTop };
    }

    showTooltip(title, text, element, position) {
        const tooltip = document.getElementById('guideTooltip');
        const titleEl = document.getElementById('tooltipTitle');
        const textEl = document.getElementById('tooltipText');

        if (!tooltip || !titleEl || !textEl || !element) return;

        titleEl.textContent = title;
        textEl.textContent = text;

        const rect = element.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const margin = 12;
        const arrowGap = 16;

        tooltip.style.left = '0px';
        tooltip.style.top = '0px';
        tooltip.style.maxWidth = (vw <= 480 ? vw - 24 : vw <= 768 ? vw - 32 : 360) + 'px';

        tooltip.style.visibility = 'hidden';
        tooltip.classList.add('visible');
        const realRect = tooltip.getBoundingClientRect();
        tooltip.classList.remove('visible');
        tooltip.style.visibility = '';

        const tooltipWidth = Math.min(realRect.width || 360, vw - margin * 2);
        const tooltipHeight = realRect.height || 160;

        const result = this.calculateBestPosition(
            rect, tooltipWidth, tooltipHeight, vw, vh, margin
        );
        
        let finalPosition = result.position;
        
        if (position) {
            const checkPosition = (pos) => {
                switch (pos) {
                    case 'top': return rect.top >= tooltipHeight + arrowGap + margin;
                    case 'bottom': return vh - rect.bottom >= tooltipHeight + arrowGap + margin;
                    case 'left': return rect.left >= tooltipWidth + arrowGap + margin;
                    case 'right': return vw - rect.right >= tooltipWidth + arrowGap + margin;
                    default: return true;
                }
            };

            if (checkPosition(position)) {
                finalPosition = position;
            } else {
                const opposite = {
                    'top': 'bottom',
                    'bottom': 'top',
                    'left': 'right',
                    'right': 'left'
                };
                if (opposite[position] && checkPosition(opposite[position])) {
                    finalPosition = opposite[position];
                }
            }
        }
        
        let finalLeft, finalTop;
        
        switch (finalPosition) {
            case 'top':
                finalLeft = rect.left + rect.width / 2 - tooltipWidth / 2;
                finalTop = rect.top - tooltipHeight - arrowGap;
                break;
            case 'bottom':
                finalLeft = rect.left + rect.width / 2 - tooltipWidth / 2;
                finalTop = rect.bottom + arrowGap;
                break;
            case 'left':
                finalLeft = rect.left - tooltipWidth - arrowGap;
                finalTop = rect.top + rect.height / 2 - tooltipHeight / 2;
                break;
            case 'right':
                finalLeft = rect.right + arrowGap;
                finalTop = rect.top + rect.height / 2 - tooltipHeight / 2;
                break;
            default:
                finalLeft = result.left;
                finalTop = result.top;
        }
        
        const arrowHeight = 12;
        
        if (finalPosition === 'top') {
            finalTop = rect.top - tooltipHeight - arrowGap - arrowHeight;
            if (finalTop < margin) {
                finalPosition = 'bottom';
                finalTop = rect.bottom + arrowGap + arrowHeight;
            }
        } else if (finalPosition === 'bottom') {
            finalTop = rect.bottom + arrowGap + arrowHeight;
            if (finalTop + tooltipHeight > vh - margin) {
                finalPosition = 'top';
                finalTop = rect.top - tooltipHeight - arrowGap - arrowHeight;
            }
        }
        
        finalLeft = Math.max(margin, Math.min(vw - tooltipWidth - margin, finalLeft));

        tooltip.className = `guide-tooltip ${finalPosition}`;
        tooltip.style.left = `${finalLeft}px`;
        tooltip.style.top = `${finalTop}px`;

        setTimeout(() => tooltip.classList.add('visible'), 50);
    }

    showCenteredTooltip(title, text) {
        const tooltip = document.getElementById('guideTooltip');
        const titleEl = document.getElementById('tooltipTitle');
        const textEl = document.getElementById('tooltipText');

        if (!tooltip || !titleEl || !textEl) return;

        titleEl.textContent = title;
        textEl.textContent = text;

        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const margin = 12;

        tooltip.className = 'guide-tooltip';
        tooltip.style.maxWidth = (vw <= 480 ? vw - 24 : vw <= 768 ? vw - 32 : 360) + 'px';
        tooltip.style.left = '0px';
        tooltip.style.top = '0px';
        tooltip.style.visibility = 'hidden';
        tooltip.classList.add('visible');
        const realRect = tooltip.getBoundingClientRect();
        tooltip.classList.remove('visible');
        tooltip.style.visibility = '';

        const tooltipWidth = Math.min(realRect.width || 320, vw - margin * 2);
        const tooltipHeight = realRect.height || 160;

        const left = Math.max(margin, (vw - tooltipWidth) / 2);
        const top = Math.max(margin, (vh - tooltipHeight) / 2);

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;

        setTimeout(() => tooltip.classList.add('visible'), 50);
    }

    showArrow(element, position) {
        const arrow = document.getElementById('guideArrow');
        if (!arrow || !element) return;

        const rect = element.getBoundingClientRect();

        arrow.className = `guide-arrow ${position}`;

        switch (position) {
            case 'top':
                arrow.style.left = `${rect.left + rect.width / 2 - 16}px`;
                arrow.style.top = `${rect.top - 36}px`;
                break;
            case 'top-left':
                arrow.style.left = `${rect.left + 24}px`;
                arrow.style.top = `${rect.top - 36}px`;
                break;
            case 'top-right':
                arrow.style.left = `${rect.right - 56}px`;
                arrow.style.top = `${rect.top - 36}px`;
                break;
            case 'bottom':
                arrow.style.left = `${rect.left + rect.width / 2 - 16}px`;
                arrow.style.top = `${rect.bottom + 12}px`;
                break;
            case 'bottom-left':
                arrow.style.left = `${rect.left + 24}px`;
                arrow.style.top = `${rect.bottom + 12}px`;
                break;
            case 'bottom-right':
                arrow.style.left = `${rect.right - 56}px`;
                arrow.style.top = `${rect.bottom + 12}px`;
                break;
            case 'left':
                arrow.style.left = `${rect.left - 36}px`;
                arrow.style.top = `${rect.top + rect.height / 2 - 16}px`;
                break;
            case 'left-top':
                arrow.style.left = `${rect.left - 36}px`;
                arrow.style.top = `${rect.top + 24}px`;
                break;
            case 'left-bottom':
                arrow.style.left = `${rect.left - 36}px`;
                arrow.style.top = `${rect.bottom - 56}px`;
                break;
            case 'right':
                arrow.style.left = `${rect.right + 12}px`;
                arrow.style.top = `${rect.top + rect.height / 2 - 16}px`;
                break;
            case 'right-top':
                arrow.style.left = `${rect.right + 12}px`;
                arrow.style.top = `${rect.top + 24}px`;
                break;
            case 'right-bottom':
                arrow.style.left = `${rect.right + 12}px`;
                arrow.style.top = `${rect.bottom - 56}px`;
                break;
        }

        arrow.classList.remove('hidden');
    }

    hideAllElements() {
        const highlight = document.getElementById('guideHighlight');
        const tooltip = document.getElementById('guideTooltip');
        const arrow = document.getElementById('guideArrow');
        const nextBtn = document.getElementById('guideNextBtn');
        const hintEl = document.getElementById('tooltipActionHint');

        if (highlight) {
            highlight.style.opacity = '0';
            setTimeout(() => highlight.classList.add('hidden'), 300);
        }
        if (tooltip) tooltip.classList.remove('visible');
        if (arrow) arrow.classList.add('hidden');
        if (nextBtn) nextBtn.classList.add('hidden');
        if (hintEl) hintEl.classList.remove('visible');
    }

    handleUserAction(e, actionType) {
        const target = e.target;

        // demo 模式下，手牌点击由 demoTileClick 处理，避免重复推进
        if (this.demoMode && (actionType === 'card_click' || actionType === 'multiple_selected')) {
            return;
        }

        switch (actionType) {
            case 'any_click':
                this.playSuccessSound();
                this.nextStep();
                break;
            case 'card_click':
                if (target.closest('.game-tile.hand') || target.closest('#hand-cards .game-tile')) {
                    this.playSuccessSound();
                    this.nextStep();
                }
                break;
            case 'multiple_selected':
                break;
            case 'play_click':
                if (target.closest('.control-btn.brand')) {
                    if (typeof playCard === 'function') {
                        playCard();
                    }
                    setTimeout(() => {
                        this.playSuccessSound();
                        this.nextStep();
                    }, 500);
                }
                break;
            case 'draw_click':
                if (target.closest('#btn-draw')) {
                    this.playSuccessSound();
                    this.nextStep();
                }
                break;
            case 'sort_click':
                if (target.closest('.control-btn.purple')) {
                    this.playSuccessSound();
                    this.nextStep();
                }
                break;
            case 'split_table':
                if (target.closest('#table-groups .game-tile') || target.closest('.tile-group .game-tile')) {
                    // 拆分操作由轮询机制检测临时牌组出现来推进
                }
                break;
            case 'add_to_split':
                if (target.closest('#table-groups .temp-group') || target.closest('.temp-group')) {
                    // 加入手牌操作由轮询机制检测手牌加入来推进
                }
                break;
        }
    }

    onCardSelected() {
        if (!this.isActive || this.exampleShowing) return;
        const step = this.guideSteps[this.currentStep];
        if (step && step.requireAction === 'multiple_selected') {
            const selectedCards = document.querySelectorAll('.game-tile.selected');
            if (selectedCards.length >= 2) {
                this.playSuccessSound();
                this.nextStep();
            }
        }
    }

    onCardPlayed() {
        if (!this.isActive || this.exampleShowing) return;
        const step = this.guideSteps[this.currentStep];
        if (step && step.id === 'table_area') {
            this.playSuccessSound();
            this.nextStep();
        }
    }

    onTurnStarted() {
        if (!this.isActive || this.exampleShowing) return;
        const step = this.guideSteps[this.currentStep];
        if (step && step.id === 'draw_card') {
            this.showStep(this.currentStep);
        }
    }

    nextStep() {
        const currentStep = this.guideSteps[this.currentStep];
        if (currentStep) {
            this.completedSteps.add(currentStep.id);
        }

        this.hideAllElements();

        if (this.currentStep < this.guideSteps.length - 1) {
            this.currentStep++;

            setTimeout(() => {
                this.showStep(this.currentStep);
            }, 300);
        } else {
            this.endGuide();
        }
    }

    updateProgressUI(stepIndex) {
        this.renderStepsNav();
    }

    renderStepsNav() {
        const nav = document.getElementById('guideStepsNav');
        if (!nav) return;

        nav.innerHTML = '';
        const self = this;

        this.guideSteps.forEach((step, index) => {
            const btn = document.createElement('button');
            btn.className = 'guide-step-btn';
            btn.textContent = index + 1;
            btn.title = step.title;
            btn.setAttribute('aria-label', `步骤 ${index + 1}: ${step.title}`);

            if (index === this.currentStep) {
                btn.classList.add('current');
            } else if (this.completedSteps.has(step.id)) {
                btn.classList.add('completed');
            }

            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                self.jumpToStep(index);
            });

            nav.appendChild(btn);
        });
    }

    jumpToStep(stepIndex) {
        if (stepIndex < 0 || stepIndex >= this.guideSteps.length) return;
        if (stepIndex === this.currentStep) return;

        if (this.exampleShowing) {
            this.closeGuideExample();
        }

        this.hideAllElements();
        this.currentStep = stepIndex;

        const self = this;
        setTimeout(function() {
            self.showStep(self.currentStep);
            self.renderStepsNav();
        }, 200);
    }

    endGuide() {
        this.isActive = false;
        this.stopPolling();
        this.completedSteps.add('finish');

        const overlay = document.getElementById('gameGuideOverlay');
        if (overlay) {
            overlay.classList.remove('active');
            overlay.classList.remove('demo-mode');
            setTimeout(() => overlay.classList.add('hidden'), 300);
        }

        // 隐藏模拟游戏界面
        if (this.demoMode) {
            const demoBoard = document.getElementById('tutorialDemoBoard');
            if (demoBoard) {
                demoBoard.classList.add('hidden');
            }
            this.demoMode = false;
        }

        if (typeof showToast === 'function') {
            showToast('新手引导完成！', 'success');
        }
    }

    playSuccessSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(1760, audioContext.currentTime + 0.1);

            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
        } catch (e) {
            console.warn('Audio playback failed:', e);
        }
    }
}

let gameGuideSystem;

function startGameGuide() {
    if (!gameGuideSystem) {
        gameGuideSystem = new GameGuideSystem();
    }
    gameGuideSystem.startGuide();
}

function restartGameGuide() {
    if (!gameGuideSystem) {
        gameGuideSystem = new GameGuideSystem();
    }
    gameGuideSystem.restartGuide();
}

function skipGuide() {
    if (gameGuideSystem) {
        gameGuideSystem.endGuide();
    }
}

function closeGuideExample() {
    if (gameGuideSystem) {
        gameGuideSystem.closeGuideExample();
    }
}

function continueGuideAfterExample() {
    if (gameGuideSystem) {
        gameGuideSystem.continueGuideAfterExample();
    }
}

function guideAdvanceStep() {
    if (gameGuideSystem) {
        gameGuideSystem.advanceStep();
    }
}

// 演示理牌功能
function demoSortHand() {
    demoSaveSnapshot();
    
    const handCards = document.querySelectorAll('#tutorialDemoBoard .hand-cards .game-tile');
    const tilesArray = Array.from(handCards);
    
    tilesArray.sort((a, b) => {
        const colorOrder = { red: 0, yellow: 1, blue: 2, black: 3, joker: 4 };
        const colorA = a.classList.contains('red') ? 'red' :
                       a.classList.contains('yellow') ? 'yellow' :
                       a.classList.contains('blue') ? 'blue' :
                       a.classList.contains('black') ? 'black' : 'joker';
        const colorB = b.classList.contains('red') ? 'red' :
                       b.classList.contains('yellow') ? 'yellow' :
                       b.classList.contains('blue') ? 'blue' :
                       b.classList.contains('black') ? 'black' : 'joker';
        
        if (colorA !== colorB) return colorOrder[colorA] - colorOrder[colorB];
        
        const numA = parseInt(a.textContent) || 0;
        const numB = parseInt(b.textContent) || 0;
        return numA - numB;
    });
    
    const container = document.querySelector('#tutorialDemoBoard .hand-cards');
    container.innerHTML = '';
    tilesArray.forEach(tile => {
        container.appendChild(tile);
        tile.onclick = () => demoTileClick(tile);
    });
    
    updateDemoStatus('手牌已按颜色和数字排序');
    
    if (gameGuideSystem && gameGuideSystem.isActive && !gameGuideSystem.exampleShowing) {
        const currentStep = gameGuideSystem.guideSteps[gameGuideSystem.currentStep];
        if (currentStep && currentStep.requireAction === 'sort_hand') {
            gameGuideSystem.playSuccessSound();
            gameGuideSystem.nextStep();
        }
    }
}

// 演示出牌功能
function demoPlayCard() {
    const selectedTiles = document.querySelectorAll('#tutorialDemoBoard .game-tile.selected');
    if (selectedTiles.length === 0) {
        updateDemoStatus('请先选择要出的牌');
        return;
    }
    
    demoSaveSnapshot();
    
    const selectedArea = document.querySelector('#tutorialDemoBoard .selected-area');
    selectedTiles.forEach(tile => {
        tile.classList.remove('selected');
        tile.classList.remove('hand');
        tile.classList.add('in-group');
        selectedArea.appendChild(tile);
    });
    
    updateDemoStatus(`已将 ${selectedTiles.length} 张牌放入临时牌组`);
    
    if (gameGuideSystem && gameGuideSystem.isActive && !gameGuideSystem.exampleShowing) {
        const currentStep = gameGuideSystem.guideSteps[gameGuideSystem.currentStep];
        if (currentStep && (currentStep.requireAction === 'play_card' || currentStep.requireAction === 'card_click')) {
            gameGuideSystem.playSuccessSound();
            gameGuideSystem.nextStep();
        }
    }
}

// 演示摸牌功能
let demoDeckCount = 50;

function demoDrawCard() {
    if (demoDeckCount <= 0) {
        updateDemoStatus('牌堆已空，请出牌或过牌');
        
        const btnDraw = document.querySelector('#tutorialDemoBoard #btn-draw');
        const btnPass = document.querySelector('#tutorialDemoBoard #btn-pass');
        if (btnDraw) btnDraw.style.display = 'none';
        if (btnPass) btnPass.style.display = 'inline-flex';
        
        return;
    }
    
    demoSaveSnapshot();
    
    const colors = ['red', 'yellow', 'blue', 'black'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const number = Math.floor(Math.random() * 13) + 1;
    
    const tile = document.createElement('div');
    tile.className = `game-tile ${color} hand`;
    tile.innerHTML = `<span>${number}</span>`;
    tile.onclick = () => demoTileClick(tile);
    
    const handArea = document.querySelector('#tutorialDemoBoard .hand-cards');
    handArea.appendChild(tile);
    
    demoDeckCount--;
    
    // 更新牌堆计数显示
    const deckCountSpan = document.querySelector('#tutorialDemoBoard .deck-info span');
    if (deckCountSpan) deckCountSpan.textContent = demoDeckCount;
    
    updateDemoStatus(`摸牌: ${color === 'red' ? '红' : color === 'yellow' ? '黄' : color === 'blue' ? '蓝' : '黑'}${number}`);
}

// 演示过牌功能
function demoPassTurn() {
    updateDemoStatus('你选择了过牌');
    
    // 清空选中状态
    document.querySelectorAll('#tutorialDemoBoard .game-tile.selected').forEach(t => t.classList.remove('selected'));
    
    if (gameGuideSystem && gameGuideSystem.isActive && !gameGuideSystem.exampleShowing) {
        const currentStep = gameGuideSystem.guideSteps[gameGuideSystem.currentStep];
        if (currentStep && currentStep.requireAction === 'pass_turn') {
            gameGuideSystem.playSuccessSound();
            gameGuideSystem.nextStep();
        }
    }
}

// 演示撤销功能（支持多步撤销）
let demoTurnSnapshots = [];

function demoSaveSnapshot() {
    const handArea = document.querySelector('#tutorialDemoBoard .hand-cards');
    const selectedArea = document.querySelector('#tutorialDemoBoard .selected-area');
    
    const snapshot = {
        handHtml: handArea.innerHTML,
        selectedHtml: selectedArea.innerHTML,
        selectedCards: []
    };
    
    document.querySelectorAll('#tutorialDemoBoard .game-tile.selected').forEach(t => {
        snapshot.selectedCards.push(t.textContent);
    });
    
    demoTurnSnapshots.push(snapshot);
    if (demoTurnSnapshots.length > 10) demoTurnSnapshots.shift();
}

function demoUndo() {
    if (demoTurnSnapshots.length > 0) {
        const snapshot = demoTurnSnapshots.pop();
        const handArea = document.querySelector('#tutorialDemoBoard .hand-cards');
        const selectedArea = document.querySelector('#tutorialDemoBoard .selected-area');
        
        handArea.innerHTML = snapshot.handHtml;
        selectedArea.innerHTML = snapshot.selectedHtml;
        
        // 重新绑定点击事件
        document.querySelectorAll('#tutorialDemoBoard .game-tile.hand').forEach(t => {
            t.onclick = () => demoTileClick(t);
        });
        
        updateDemoStatus('已撤销上一步操作');
    } else {
        // 清空所有选择和临时牌组
        const selectedArea = document.querySelector('#tutorialDemoBoard .selected-area');
        const tilesInSelected = selectedArea.querySelectorAll('.game-tile');
        
        if (tilesInSelected.length > 0) {
            const handArea = document.querySelector('#tutorialDemoBoard .hand-cards');
            tilesInSelected.forEach(tile => {
                tile.classList.remove('in-group');
                tile.classList.add('hand');
                handArea.appendChild(tile);
                tile.onclick = () => demoTileClick(tile);
            });
            updateDemoStatus('已撤销本回合操作');
        } else {
            updateDemoStatus('没有可撤销的操作');
        }
    }
    
    // 清除选中状态
    document.querySelectorAll('#tutorialDemoBoard .game-tile.selected').forEach(t => t.classList.remove('selected'));
}

// 更新演示状态
function updateDemoStatus(message) {
    const statusBar = document.querySelector('#tutorialDemoBoard .status-message');
    if (statusBar) {
        statusBar.textContent = message;
    }
}

// 模拟界面手牌点击交互
function demoTileClick(tile) {
    if (tile.classList.contains('in-group')) return; // 桌面牌组不可点击
    tile.classList.toggle('selected');

    // 检查是否满足引导步骤的推进条件
    if (gameGuideSystem && gameGuideSystem.isActive && !gameGuideSystem.exampleShowing) {
        const currentStep = gameGuideSystem.guideSteps[gameGuideSystem.currentStep];
        if (!currentStep) return;

        if (currentStep.requireAction === 'card_click') {
            const selectedTiles = document.querySelectorAll('#tutorialDemoBoard .game-tile.selected');
            if (selectedTiles.length >= 1) {
                gameGuideSystem.playSuccessSound();
                gameGuideSystem.nextStep();
            }
        }

        if (currentStep.requireAction === 'multiple_selected') {
            const selectedTiles = document.querySelectorAll('#tutorialDemoBoard .game-tile.selected');
            if (selectedTiles.length >= 2) {
                gameGuideSystem.playSuccessSound();
                gameGuideSystem.nextStep();
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    gameGuideSystem = new GameGuideSystem();
});
