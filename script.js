/* ═══════════════════════════════════════════════════════════
   CONTAINMENT TCG — Game Logic
   14 Cards · Energy System · Combat Resolution · Turn Manager
═══════════════════════════════════════════════════════════ */

'use strict';

/* ─── Card Database (14 cards) ─── */
const CARD_DB = [
    {
        id: 'neural-strike',
        name: 'Neural Strike',
        type: 'attack',
        rarity: 'common',
        cost: 1,
        art: '⚡',
        desc: 'Deal <b>8</b> damage. If enemy has Vulnerable, deal <b>10</b> instead.',
        effect(gs) {
            const base = 8;
            const bonus = gs.enemyStatus.find(s => s.id === 'vulnerable') ? 2 : 0;
            const dmg = applyDamage(gs, 'enemy', base + bonus);
            addLog(`Neural Strike → <b>${dmg}</b> DMG to Corruptor.`, 'player');
            triggerCombatFlow('p-card');
        }
    },
    {
        id: 'firewall',
        name: 'Firewall',
        type: 'skill',
        rarity: 'common',
        cost: 1,
        art: '🛡',
        desc: 'Gain <b>8</b> Armor. Draw <b>1</b> card.',
        effect(gs) {
            gs.player.armor += 8;
            updatePlayerStat('armor');
            addLog('Firewall → +8 Armor gained.', 'player');
            drawCard(gs);
        }
    },
    {
        id: 'data-breach',
        name: 'Data Breach',
        type: 'attack',
        rarity: 'rare',
        cost: 2,
        art: '💻',
        desc: 'Deal <b>12</b> damage. Apply <b>Vulnerable</b> (2) to enemy.',
        effect(gs) {
            const dmg = applyDamage(gs, 'enemy', 12);
            applyStatus(gs, 'enemy', { id: 'vulnerable', name: 'VULNER', icon: '↓', color: 'red', count: 2 });
            addLog(`Data Breach → <b>${dmg}</b> DMG + Vulnerable×2.`, 'player');
        }
    },
    {
        id: 'core-overload',
        name: 'Core Overload',
        type: 'attack',
        rarity: 'exotic',
        cost: 3,
        art: '💥',
        desc: 'Deal <b>22</b> damage. Exhaust this card.',
        effect(gs) {
            const dmg = applyDamage(gs, 'enemy', 22);
            addLog(`Core Overload → <b>${dmg}</b> DMG! Card exhausted.`, 'player');
        },
        exhaust: true
    },
    {
        id: 'system-patch',
        name: 'System Patch',
        type: 'skill',
        rarity: 'common',
        cost: 2,
        art: '💊',
        desc: 'Heal <b>12</b> HP. Gain <b>Regen</b> (2).',
        effect(gs) {
            gs.player.hp = Math.min(gs.player.maxHp, gs.player.hp + 12);
            updatePlayerStat('hp');
            applyStatus(gs, 'player', { id: 'regen', name: 'REGEN', icon: '+', color: 'green', count: 2 });
            addLog(`System Patch → Healed <b>12</b> HP + Regen×2.`, 'player');
            showDamageNumber('+12', 'heal', true);
        }
    },
    {
        id: 'cipher-blade',
        name: 'Cipher Blade',
        type: 'attack',
        rarity: 'rare',
        cost: 2,
        art: '🗡',
        desc: 'Deal <b>9</b> damage twice. Apply <b>Weak</b> (1) to enemy.',
        effect(gs) {
            const d1 = applyDamage(gs, 'enemy', 9);
            const d2 = applyDamage(gs, 'enemy', 9);
            applyStatus(gs, 'enemy', { id: 'weak', name: 'WEAK', icon: '—', color: 'red', count: 1 });
            addLog(`Cipher Blade → <b>${d1}+${d2}</b> DMG + Weak×1.`, 'player');
        }
    },
    {
        id: 'emp-burst',
        name: 'EMP Burst',
        type: 'attack',
        rarity: 'rare',
        cost: 2,
        art: '🌀',
        desc: 'Deal <b>10</b> damage to all enemies. Reduce enemy Armor by <b>4</b>.',
        effect(gs) {
            gs.enemy.armor = Math.max(0, gs.enemy.armor - 4);
            updateEnemyStat('armor');
            const dmg = applyDamage(gs, 'enemy', 10);
            addLog(`EMP Burst → <b>${dmg}</b> DMG + enemy Armor -4.`, 'player');
        }
    },
    {
        id: 'ghost-protocol',
        name: 'Ghost Protocol',
        type: 'skill',
        rarity: 'rare',
        cost: 1,
        art: '👻',
        desc: 'Gain <b>Evade</b> (1). Draw <b>2</b> cards.',
        effect(gs) {
            applyStatus(gs, 'player', { id: 'evade', name: 'EVADE', icon: '◇', color: 'cyan', count: 1 });
            drawCard(gs);
            drawCard(gs);
            addLog('Ghost Protocol → Evade×1 + drew 2 cards.', 'player');
        }
    },
    {
        id: 'entropy-cascade',
        name: 'Entropy Cascade',
        type: 'attack',
        rarity: 'exotic',
        cost: 3,
        art: '🌊',
        desc: 'Deal <b>6</b> damage <b>4</b> times. Chain bonus applies to each hit.',
        effect(gs) {
            let total = 0;
            for (let i = 0; i < 4; i++) total += applyDamage(gs, 'enemy', 6);
            addLog(`Entropy Cascade → <b>4×6 = ${total}</b> DMG total.`, 'player');
        }
    },
    {
        id: 'quantum-shield',
        name: 'Quantum Shield',
        type: 'skill',
        rarity: 'exotic',
        cost: 2,
        art: '🔮',
        desc: 'Gain <b>16</b> Shield. Remove all negative status effects.',
        effect(gs) {
            gs.player.shield += 16;
            updatePlayerStat('shield');
            gs.playerStatus = gs.playerStatus.filter(s => !['weak', 'vulnerable', 'burn'].includes(s.id));
            renderStatus();
            addLog('Quantum Shield → +16 Shield + cleared debuffs.', 'player');
            showDamageNumber('+16◈', 'shield', true);
        }
    },
    {
        id: 'void-strike',
        name: 'Void Strike',
        type: 'attack',
        rarity: 'legendary',
        cost: 3,
        art: '⚫',
        desc: '<b>Legendary.</b> Deal <b>30</b> damage. Ignores Armor and Shield.',
        effect(gs) {
            const dmg = 30;
            gs.enemy.hp = Math.max(0, gs.enemy.hp - dmg);
            updateEnemyStat('hp');
            showDamageNumber(`-${dmg}`, 'enemy');
            addLog(`Void Strike → <b>${dmg}</b> DMG (ignores defenses)!`, 'player');
        }
    },
    {
        id: 'neural-overwrite',
        name: 'Neural Overwrite',
        type: 'skill',
        rarity: 'legendary',
        cost: 3,
        art: '🧠',
        desc: '<b>Legendary.</b> Copy the top card of your discard pile into your hand. Draw <b>2</b> cards.',
        effect(gs) {
            if (gs.discard.length > 0) {
                const top = { ...gs.discard[gs.discard.length - 1] };
                gs.hand.push(top);
                renderHand(gs);
            }
            drawCard(gs);
            drawCard(gs);
            addLog('Neural Overwrite → Copied discard top + drew 2.', 'player');
        }
    },
    {
        id: 'data-harvest',
        name: 'Data Harvest',
        type: 'economy',
        rarity: 'common',
        cost: 1,
        art: '📦',
        desc: 'Draw <b>3</b> cards. Gain <b>1</b> extra energy this turn.',
        effect(gs) {
            drawCard(gs); drawCard(gs); drawCard(gs);
            // +1 bonus energy, capped at maxEnergy + 1 to allow one extra action
            gs.energy = Math.min(gs.maxEnergy + 1, gs.energy + 1);
            updateEnergy(gs);
            addLog('Data Harvest → Drew 3 cards + 1 bonus energy.', 'player');
        }
    },
    {
        id: 'exploit-vuln',
        name: 'Exploit Vuln.',
        type: 'attack',
        rarity: 'exotic',
        cost: 3,
        art: '🎯',
        desc: 'Deal <b>18</b> damage. If enemy is Vulnerable, deal <b>28</b> instead.',
        effect(gs) {
            const hasVuln = gs.enemyStatus.find(s => s.id === 'vulnerable');
            const dmg = applyDamage(gs, 'enemy', hasVuln ? 28 : 18);
            addLog(`Exploit Vuln. → <b>${dmg}</b> DMG${hasVuln ? ' (Vulnerable!)' : ''}.`, 'player');
        }
    }
];

/* ─── Game State ─── */
const GameState = {
    // Turn 7: combat scenario starts mid-run, matching the reference mockup state
    turn: 7,
    phase: 'player', // 'player' | 'enemy'
    energy: 3,
    maxEnergy: 3,
    player: {
        hp: 54, maxHp: 75,
        armor: 12, shield: 8
    },
    enemy: {
        hp: 38, maxHp: 80,
        armor: 6, shield: 0,
        intent: { type: 'attack', value: 18 }
    },
    deck: [],
    hand: [],
    discard: [],
    exhaust: [],
    playerStatus: [
        { id: 'fortify', name: 'FORTIFY', icon: '⬡', color: 'cyan', count: 3 },
        { id: 'regen',   name: 'REGEN',   icon: '+', color: 'green', count: 2 }
    ],
    enemyStatus: [
        { id: 'vulnerable', name: 'VULNER', icon: '↓', color: 'red', count: 2 }
    ],
    chainBonus: 2,
    rewardProgress: 56,
    activeFilter: 'all',
    combatLog: [],
    valorPips: 3,
    turnEnded: false
};

/* ─── DOM References ─── */
const DOM = {
    handArea:      () => document.getElementById('hand-area'),
    combatLog:     () => document.getElementById('combat-log'),
    energyCurrent: () => document.getElementById('energy-current'),
    energyMax:     () => document.getElementById('energy-max'),
    energyPips:    () => document.querySelectorAll('.energy-pip'),
    turnNumber:    () => document.getElementById('turn-number'),
    playerHp:      () => document.getElementById('player-hp'),
    playerArmor:   () => document.getElementById('player-armor'),
    playerShield:  () => document.getElementById('player-shield'),
    enemyHp:       () => document.getElementById('enemy-hp'),
    enemyArmor:    () => document.getElementById('enemy-armor'),
    enemyShield:   () => document.getElementById('enemy-shield'),
    playerStatus:  () => document.getElementById('player-status'),
    enemyStatus:   () => document.getElementById('enemy-status'),
    intentAction:  () => document.getElementById('intent-action'),
    rewardFill:    () => document.getElementById('reward-fill'),
    rewardPct:     () => document.getElementById('reward-pct'),
    deckCount:     () => document.getElementById('deck-count'),
    discardCount:  () => document.getElementById('discard-count'),
    chainBonus:    () => document.getElementById('chain-bonus'),
    damageOverlay: () => document.getElementById('damage-overlay'),
    cardPlayOverlay:()=> document.getElementById('card-play-overlay'),
    nodeMap:       () => document.getElementById('node-map'),
    endTurnBtn:    () => document.getElementById('end-turn-btn'),
    yourMoveTitle: () => document.querySelector('.your-move-title'),
};

/* ─── Game Object (public API for HTML onclick) ─── */
const Game = {
    filterHand(type) {
        GameState.activeFilter = type;
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.classList.contains(type)) btn.classList.add('active');
        });
        document.querySelectorAll('.card').forEach(card => {
            if (type === 'all') {
                card.classList.remove('filtered-out');
            } else {
                card.classList.toggle('filtered-out', card.dataset.type !== type);
            }
        });
    },

    playCard(cardId) {
        if (GameState.phase !== 'player') return;
        const gs = GameState;
        const cardIdx = gs.hand.findIndex(c => c.id === cardId);
        if (cardIdx === -1) return;
        const card = gs.hand[cardIdx];
        if (gs.energy < card.cost) {
            shakeElement(document.querySelector(`[data-card-id="${cardId}"]`));
            addLog(`Not enough energy to play ${card.name}.`, 'system');
            return;
        }

        // Spend energy
        gs.energy -= card.cost;
        updateEnergy(gs);

        // Play animation
        const cardEl = document.querySelector(`[data-card-id="${cardId}"]`);
        if (cardEl) cardEl.classList.add('playing');

        // Apply card effect
        setTimeout(() => {
            card.effect(gs);

            // Move to discard (or exhaust)
            gs.hand.splice(cardIdx, 1);
            if (card.exhaust) {
                gs.exhaust.push(card);
            } else {
                gs.discard.push(card);
            }

            // Re-render
            renderHand(gs);
            updateDeckCounts(gs);
            checkCombatEnd(gs);
        }, 120);

        // Flash effect
        flashScreen();
    },

    endTurn() {
        if (GameState.phase !== 'player') return;
        GameState.phase = 'enemy';
        document.body.classList.add('enemy-turn');
        DOM.yourMoveTitle().textContent = 'ENEMY TURN';
        DOM.yourMoveTitle().style.color = 'var(--red)';
        DOM.yourMoveTitle().style.textShadow = 'var(--glow-red)';
        DOM.yourMoveTitle().style.animation = 'none';

        addLog('— Turn ended —', 'system');

        // Process end-of-turn status effects
        processEndOfTurnEffects(GameState);

        // Discard hand
        GameState.discard.push(...GameState.hand);
        GameState.hand = [];
        renderHand(GameState);

        // Enemy turn
        setTimeout(() => runEnemyTurn(GameState), 800);
    }
};

/* ─── Combat Helpers ─── */
function applyDamage(gs, target, baseDmg) {
    // Chain bonus
    let dmg = baseDmg;
    if (gs.chainBonus > 1) dmg = Math.floor(dmg * (1 + (gs.chainBonus - 1) * 0.25));

    // Enemy vulnerability
    if (target === 'enemy' && gs.enemyStatus.find(s => s.id === 'vulnerable')) {
        dmg = Math.floor(dmg * 1.25);
    }
    if (target === 'player' && gs.playerStatus.find(s => s.id === 'vulnerable')) {
        dmg = Math.floor(dmg * 1.25);
    }

    const t = target === 'enemy' ? gs.enemy : gs.player;
    let remaining = dmg;

    if (t.shield > 0) {
        const absorbed = Math.min(t.shield, remaining);
        t.shield -= absorbed;
        remaining -= absorbed;
    }
    if (remaining > 0 && t.armor > 0) {
        const absorbed = Math.min(t.armor, remaining);
        t.armor -= absorbed;
        remaining -= absorbed;
    }
    if (remaining > 0) {
        t.hp = Math.max(0, t.hp - remaining);
    }

    if (target === 'enemy') {
        updateEnemyStat('hp'); updateEnemyStat('armor'); updateEnemyStat('shield');
        showDamageNumber(`-${dmg}`, 'enemy');
    } else {
        updatePlayerStat('hp'); updatePlayerStat('armor'); updatePlayerStat('shield');
        showDamageNumber(`-${dmg}`, 'player');
    }

    return dmg;
}

function applyStatus(gs, target, status) {
    const list = target === 'enemy' ? gs.enemyStatus : gs.playerStatus;
    const existing = list.find(s => s.id === status.id);
    if (existing) {
        existing.count += status.count;
    } else {
        list.push({ ...status });
    }
    renderStatus();
}

function drawCard(gs) {
    if (gs.deck.length === 0) {
        if (gs.discard.length === 0) return;
        // Reshuffle discard into deck
        gs.deck = shuffleArray([...gs.discard]);
        gs.discard = [];
        addLog('Deck reshuffled from discard.', 'system');
    }
    const card = gs.deck.pop();
    gs.hand.push(card);
    renderHand(gs);
    updateDeckCounts(gs);
}

function processEndOfTurnEffects(gs) {
    // Regen
    const regen = gs.playerStatus.find(s => s.id === 'regen');
    if (regen) {
        gs.player.hp = Math.min(gs.player.maxHp, gs.player.hp + 4 * regen.count);
        updatePlayerStat('hp');
        addLog(`Regen healed <b>${4 * regen.count}</b> HP.`, 'player');
    }
    // Decrement status counts
    gs.playerStatus = gs.playerStatus
        .map(s => ({ ...s, count: s.count - 1 }))
        .filter(s => s.count > 0);
    gs.enemyStatus = gs.enemyStatus
        .map(s => ({ ...s, count: s.count - 1 }))
        .filter(s => s.count > 0);
    renderStatus();
}

function runEnemyTurn(gs) {
    const intent = gs.enemy.intent;

    if (intent.type === 'attack') {
        setTimeout(() => {
            const dmg = applyDamage(gs, 'player', intent.value);
            addLog(`Corruptor attacks for <b>${dmg}</b> DMG!`, 'enemy');
            checkCombatEnd(gs);
            setTimeout(() => startPlayerTurn(gs), 1000);
        }, 600);
    } else if (intent.type === 'buff') {
        setTimeout(() => {
            gs.enemy.armor += intent.value;
            updateEnemyStat('armor');
            addLog(`Corruptor reinforces — +${intent.value} Armor.`, 'enemy');
            setTimeout(() => startPlayerTurn(gs), 1000);
        }, 600);
    }
}

function startPlayerTurn(gs) {
    gs.turn += 1;
    gs.phase = 'player';
    gs.energy = gs.maxEnergy;

    // Quantum Cache relic: grants +1 bonus energy above maxEnergy
    gs.energy = gs.maxEnergy + 1;

    updateEnergy(gs);
    DOM.turnNumber().textContent = gs.turn;

    // Draw 5 cards
    for (let i = 0; i < 5; i++) drawCard(gs);

    // Randomize enemy intent
    gs.enemy.intent = randomEnemyIntent();
    updateIntentDisplay(gs);

    // Advance reward
    gs.rewardProgress = Math.min(100, gs.rewardProgress + 8);
    updateRewardBar(gs);

    document.body.classList.remove('enemy-turn');
    DOM.yourMoveTitle().textContent = 'YOUR MOVE';
    DOM.yourMoveTitle().style.color = '';
    DOM.yourMoveTitle().style.textShadow = '';
    DOM.yourMoveTitle().style.animation = '';

    addLog(`— Turn ${gs.turn} begins — ${gs.energy} energy restored.`, 'system');
}

function checkCombatEnd(gs) {
    if (gs.enemy.hp <= 0) {
        setTimeout(() => {
            addLog('⚡ CORRUPTOR DEFEATED! Combat complete.', 'system');
            DOM.endTurnBtn().textContent = 'VICTORY';
            DOM.endTurnBtn().style.borderColor = 'var(--green)';
            DOM.endTurnBtn().style.color = 'var(--green)';
            DOM.endTurnBtn().style.boxShadow = 'var(--glow-green)';
            gs.phase = 'victory';
        }, 400);
    }
    if (gs.player.hp <= 0) {
        setTimeout(() => {
            addLog('💀 AXIOM DEFEATED. Run over.', 'system');
            DOM.endTurnBtn().innerHTML = '<span class="end-turn-text" style="color:var(--red)">DEFEATED</span>';
            DOM.endTurnBtn().style.borderColor = 'var(--red)';
            gs.phase = 'defeat';
        }, 400);
    }
}

function randomEnemyIntent() {
    const intents = [
        { type: 'attack', value: Math.floor(Math.random() * 14) + 10 },
        { type: 'attack', value: Math.floor(Math.random() * 10) + 8 },
        { type: 'buff',   value: Math.floor(Math.random() * 6) + 4 }
    ];
    return intents[Math.floor(Math.random() * intents.length)];
}

/* ─── UI Update Helpers ─── */
function updatePlayerStat(stat) {
    const gs = GameState;
    if (stat === 'hp') {
        const el = DOM.playerHp();
        if (el) el.textContent = `${Math.max(0, gs.player.hp)}/${gs.player.maxHp}`;
        const fill = document.querySelector('.player-entity .hp-fill');
        if (fill) fill.style.width = `${Math.max(0, gs.player.hp / gs.player.maxHp * 100)}%`;
    }
    if (stat === 'armor') {
        const el = DOM.playerArmor();
        if (el) el.textContent = gs.player.armor;
        const fill = document.querySelector('.player-entity .armor-fill');
        if (fill) fill.style.width = `${Math.min(100, gs.player.armor / 30 * 100)}%`;
    }
    if (stat === 'shield') {
        const el = DOM.playerShield();
        if (el) el.textContent = gs.player.shield;
        const fill = document.querySelector('.player-entity .shield-fill');
        if (fill) fill.style.width = `${Math.min(100, gs.player.shield / 30 * 100)}%`;
    }
}

function updateEnemyStat(stat) {
    const gs = GameState;
    if (stat === 'hp') {
        const el = DOM.enemyHp();
        if (el) el.textContent = `${Math.max(0, gs.enemy.hp)}/${gs.enemy.maxHp}`;
        const fill = document.querySelector('.enemy-entity .hp-fill');
        if (fill) fill.style.width = `${Math.max(0, gs.enemy.hp / gs.enemy.maxHp * 100)}%`;
    }
    if (stat === 'armor') {
        const el = DOM.enemyArmor();
        if (el) el.textContent = gs.enemy.armor;
        const fill = document.querySelector('.enemy-entity .armor-fill');
        if (fill) fill.style.width = `${Math.min(100, gs.enemy.armor / 30 * 100)}%`;
    }
    if (stat === 'shield') {
        const el = DOM.enemyShield();
        if (el) el.textContent = gs.enemy.shield;
        const fill = document.querySelector('.enemy-entity .shield-fill');
        if (fill) fill.style.width = `${Math.min(100, gs.enemy.shield / 30 * 100)}%`;
    }
}

function updateEnergy(gs) {
    DOM.energyCurrent().textContent = gs.energy;
    DOM.energyMax().textContent = gs.maxEnergy;
    const pips = DOM.energyPips();
    pips.forEach((pip, i) => {
        pip.classList.toggle('active', i < gs.energy);
        pip.classList.toggle('spent',  i >= gs.energy && i < gs.maxEnergy);
    });
    // Update card affordability
    document.querySelectorAll('.card').forEach(el => {
        const cost = parseInt(el.dataset.cost, 10);
        el.classList.toggle('unaffordable', cost > gs.energy);
    });
}

function renderStatus() {
    const gs = GameState;
    const pEl = DOM.playerStatus();
    const eEl = DOM.enemyStatus();
    if (pEl) pEl.innerHTML = gs.playerStatus.map(s => statusChipHTML(s)).join('');
    if (eEl) eEl.innerHTML = gs.enemyStatus.map(s => statusChipHTML(s)).join('');
}

function statusChipHTML(s) {
    return `<div class="status-chip ${s.color}" title="${s.name}: stacks ${s.count}">
        <span class="chip-icon">${s.icon}</span>
        <span class="chip-name">${s.name}</span>
        <span class="chip-count">×${s.count}</span>
    </div>`;
}

function addLog(msg, type = '') {
    const gs = GameState;
    gs.combatLog.push({ msg, type });
    const log = DOM.combatLog();
    if (!log) return;
    const entry = document.createElement('div');
    entry.className = `log-entry ${type === 'player' ? 'player-action' : type === 'enemy' ? 'enemy-action' : type === 'system' ? 'system' : ''} new`;
    entry.innerHTML = msg;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;

    // Remove 'new' class after animation
    setTimeout(() => entry.classList.remove('new'), 400);

    // Trim log to 50 entries
    while (log.children.length > 50) log.removeChild(log.firstChild);
}

function updateDeckCounts(gs) {
    const dc = DOM.deckCount();
    const dd = DOM.discardCount();
    if (dc) dc.textContent = gs.deck.length;
    if (dd) dd.textContent = gs.discard.length;
}

function updateIntentDisplay(gs) {
    const intent = gs.enemy.intent;
    const el = DOM.intentAction();
    if (!el) return;
    if (intent.type === 'attack') el.textContent = `ATTACK ×${intent.value}`;
    else if (intent.type === 'buff') el.textContent = `REINFORCE +${intent.value}`;
    else el.textContent = intent.type.toUpperCase();
}

function updateRewardBar(gs) {
    const fill = DOM.rewardFill();
    const pct  = DOM.rewardPct();
    if (fill) fill.style.width = `${gs.rewardProgress}%`;
    if (pct)  pct.textContent  = `${gs.rewardProgress}% SYNCED`;
}

function triggerCombatFlow(nodeId) {
    const el = document.getElementById(`flow-${nodeId}`);
    if (!el) return;
    el.classList.add('active');
    setTimeout(() => el.classList.remove('active'), 800);
}

function showDamageNumber(text, type, isPlayer = false) {
    const overlay = DOM.damageOverlay();
    if (!overlay) return;

    const el = document.createElement('div');
    el.className = `damage-number ${type}`;
    el.textContent = text;

    // Position near entity
    const x = isPlayer
        ? (Math.random() * 60 + 10)
        : (Math.random() * 60 + 55);
    const y = 20 + Math.random() * 10;
    el.style.left = `${x}%`;
    el.style.top  = `${y}%`;

    overlay.appendChild(el);
    setTimeout(() => el.remove(), 1300);
}

function flashScreen() {
    const overlay = DOM.cardPlayOverlay();
    if (!overlay) return;
    const flash = document.createElement('div');
    flash.className = 'card-play-flash';
    overlay.appendChild(flash);
    setTimeout(() => flash.remove(), 450);
}

function shakeElement(el) {
    if (!el) return;
    el.style.animation = 'none';
    el.style.transform = 'translateX(-6px)';
    setTimeout(() => { el.style.transform = 'translateX(6px)'; }, 80);
    setTimeout(() => { el.style.transform = ''; }, 160);
}

/* ─── Render Hand ─── */
function renderHand(gs) {
    const area = DOM.handArea();
    if (!area) return;
    area.innerHTML = '';

    gs.hand.forEach((card, idx) => {
        const el = createCardElement(card, gs);
        el.style.animationDelay = `${idx * 60}ms`;
        el.classList.add('drawing');
        area.appendChild(el);
    });

    // Apply current filter
    if (gs.activeFilter && gs.activeFilter !== 'all') {
        area.querySelectorAll('.card').forEach(c => {
            c.classList.toggle('filtered-out', c.dataset.type !== gs.activeFilter);
        });
    }
}

function createCardElement(card, gs) {
    const el = document.createElement('div');
    el.className = `card ${card.type} ${card.rarity}`;
    el.dataset.cardId = card.id;
    el.dataset.type   = card.type;
    el.dataset.cost   = card.cost;

    if (card.cost > gs.energy) el.classList.add('unaffordable');

    el.innerHTML = `
        <div class="card-header">
            <span class="card-name">${card.name}</span>
            <span class="card-cost">${card.cost}</span>
        </div>
        <div class="card-art">${card.art}</div>
        <div class="card-type-badge">${card.type.toUpperCase()}</div>
        <div class="card-desc">${card.desc}</div>
        <div class="card-rarity-strip"></div>
    `;

    el.addEventListener('click', () => Game.playCard(card.id));
    el.addEventListener('mouseenter', () => {
        if (!el.classList.contains('unaffordable')) {
            el.title = card.desc.replace(/<[^>]+>/g, '');
        }
    });

    return el;
}

/* ─── Node Map ─── */
function buildNodeMap() {
    const map = DOM.nodeMap();
    if (!map) return;

    const nodes = [
        { type: 'start',   label: '●',  locked: false },
        { type: 'elite',   label: '⚔',  locked: false },
        { type: 'rest',    label: '♦',  locked: false },
        { type: 'shop',    label: '$',  locked: false },
        { type: 'elite',   label: '⚔',  locked: false, current: true },
        { type: 'rest',    label: '♦',  locked: true },
        { type: 'shop',    label: '$',  locked: true },
        { type: 'boss',    label: '☠',  locked: true },
        { type: 'boss',    label: '★',  locked: true }
    ];

    nodes.forEach(n => {
        const el = document.createElement('div');
        el.className = `map-node ${n.type}${n.locked ? ' locked' : ''}${n.current ? ' current' : ''}`;
        el.textContent = n.label;
        el.title = n.type.charAt(0).toUpperCase() + n.type.slice(1) + (n.current ? ' (Current)' : '');
        map.appendChild(el);
    });
}

/* ─── Initialize Deck ─── */
function buildStartingDeck(gs) {
    // Starting deck: all 14 cards, 2 copies of common/rare, 1 of exotic/legendary
    const counts = {
        common: 2,
        rare: 2,
        exotic: 1,
        legendary: 1
    };
    const deck = [];
    CARD_DB.forEach(card => {
        const copies = counts[card.rarity] || 1;
        for (let i = 0; i < copies; i++) {
            deck.push({ ...card });
        }
    });
    gs.deck = shuffleArray(deck);
}

function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/* ─── Keyboard Shortcut ─── */
let spaceHeld = false;
let spaceTimer = null;

document.addEventListener('keydown', e => {
    if (e.code === 'Space' && !spaceHeld) {
        e.preventDefault();
        spaceHeld = true;
        // Hold SPACE for 600ms to end turn
        spaceTimer = setTimeout(() => {
            Game.endTurn();
        }, 600);
    }
});
document.addEventListener('keyup', e => {
    if (e.code === 'Space') {
        spaceHeld = false;
        clearTimeout(spaceTimer);
    }
});

/* ─── Boot Sequence ─── */
function init() {
    const gs = GameState;

    // Build deck and draw starting hand
    buildStartingDeck(gs);

    // Put 5 cards into hand immediately (starting hand)
    for (let i = 0; i < 5; i++) drawCard(gs);

    // Build node map
    buildNodeMap();

    // Initial UI sync
    updatePlayerStat('hp');
    updatePlayerStat('armor');
    updatePlayerStat('shield');
    updateEnemyStat('hp');
    updateEnemyStat('armor');
    updateEnemyStat('shield');
    updateEnergy(gs);
    renderStatus();
    updateDeckCounts(gs);
    updateIntentDisplay(gs);
    updateRewardBar(gs);

    addLog(`— Turn ${gs.turn} — Combat engaged with Corruptor.`, 'system');
    addLog('OSP uplink stable. Proceed with containment.', 'system');
}

// Run on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
