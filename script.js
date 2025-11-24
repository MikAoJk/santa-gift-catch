/* Santa Gift Catch Game */
const gameEl = document.getElementById('game');
const santaEl = document.getElementById('santa');
const scoreEl = document.getElementById('score');
const timeEl  = document.getElementById('time');
const livesEl = document.getElementById('lives');
const highScoreEl = document.getElementById('highScore');
const pauseBtn = document.getElementById('pauseBtn');
const restartBtn = document.getElementById('restartBtn');
const leftBtn = document.getElementById('leftBtn');
const rightBtn = document.getElementById('rightBtn');
const overlay = document.getElementById('overlay');
const finalScoreText = document.getElementById('finalScoreText');
const finalTitle = document.getElementById('finalTitle');
const playAgainBtn = document.getElementById('playAgain');
const ariaLive = document.getElementById('ariaLive');

let state = {
  playing: false,
  paused: false,
  score: 0,
  lives: 3,
  timeLeft: 60,
  santaX: 0,
  santaSpeed: 7,
  spawnInterval: 1100,
  lastSpawn: 0,
  items: [],
  startTs: null,
  difficultyRamp: 0,
  raf: null
};

const HIGH_KEY = 'santaGiftCatchHighScore';

function init() {
  let hs = localStorage.getItem(HIGH_KEY);
  if (hs) highScoreEl.textContent = hs;
  centerSanta();
  bindEvents();
  startGame();
}

function bindEvents() {
  window.addEventListener('resize', () => centerSanta());
  document.addEventListener('keydown', e => {
    if (!state.playing || state.paused) return;
    if (e.key === 'ArrowLeft' || e.key === 'a') moveSanta(-1);
    else if (e.key === 'ArrowRight' || e.key === 'd') moveSanta(1);
    else if (e.key === ' ') togglePause();
  });

  // Touch drag
  let dragging = false;
  gameEl.addEventListener('touchstart', e => {
    dragging = true;
    if (state.paused) togglePause(false);
  }, { passive: true });

  gameEl.addEventListener('touchmove', e => {
    if (!dragging || !state.playing) return;
    const touch = e.touches[0];
    const rect = gameEl.getBoundingClientRect();
    state.santaX = Math.min(Math.max(touch.clientX - rect.left - santaEl.offsetWidth / 2, 0), rect.width - santaEl.offsetWidth);
    updateSantaPosition();
  }, { passive: true });

  gameEl.addEventListener('touchend', () => dragging = false);

  // Buttons
  leftBtn.addEventListener('click', () => { moveSanta(-1); });
  rightBtn.addEventListener('click', () => { moveSanta(1); });
  pauseBtn.addEventListener('click', () => togglePause());
  restartBtn.addEventListener('click', restartGame);
  playAgainBtn.addEventListener('click', restartGame);
}

function centerSanta() {
  const w = gameEl.clientWidth;
  state.santaX = (w - santaEl.offsetWidth) / 2;
  updateSantaPosition();
}

function moveSanta(direction) {
  if (!state.playing) return;
  state.santaX += direction * state.santaSpeed * 8; // multiply for button taps
  clampSanta();
  updateSantaPosition();
}

function clampSanta() {
  const maxX = gameEl.clientWidth - santaEl.offsetWidth;
  state.santaX = Math.max(0, Math.min(maxX, state.santaX));
}

function updateSantaPosition() {
  santaEl.style.left = state.santaX + 'px';
}

function startGame() {
  Object.assign(state, {
    playing: true,
    paused: false,
    score: 0,
    lives: 3,
    timeLeft: 60,
    spawnInterval: 1100,
    lastSpawn: 0,
    items: [],
    startTs: performance.now(),
    difficultyRamp: 0
  });
  updateHUD();
  overlay.hidden = true;
  clearItems();
  state.raf = requestAnimationFrame(loop);
}

function restartGame() {
  cancelAnimationFrame(state.raf);
  startGame();
}

function togglePause(force) {
  if (!state.playing) return;
  state.paused = force !== undefined ? force : !state.paused;
  pauseBtn.textContent = state.paused ? '▶ Resume' : '⏸ Pause';
  pauseBtn.setAttribute('aria-pressed', state.paused);
  if (!state.paused) {
    state.startTs = performance.now() - ((60 - state.timeLeft) * 1000);
    state.raf = requestAnimationFrame(loop);
  } else {
    cancelAnimationFrame(state.raf);
  }
}

function loop(ts) {
  if (!state.playing || state.paused) return;
  // time
  const elapsed = (ts - state.startTs) / 1000;
  state.timeLeft = Math.max(0, Math.ceil(60 - elapsed));
  if (state.timeLeft <= 0) {
    endGame();
    return;
  }

  // difficulty escalation
  state.difficultyRamp = elapsed;
  const rampFactor = Math.min(1, elapsed / 45); // reaches near full near end
  state.spawnInterval = 1100 - rampFactor * 650; // faster spawns
  state.santaSpeed = 7 + rampFactor * 5;

  // spawn items
  if (ts - state.lastSpawn > state.spawnInterval) {
    spawnItem();
    state.lastSpawn = ts;
  }

  // update items
  updateItems(ts);

  updateHUD();

  state.raf = requestAnimationFrame(loop);
}

function spawnItem() {
  const el = document.createElement('div');
  const isCoal = Math.random() < Math.min(.18, .05 + state.difficultyRamp / 80); // increase coal probability
  el.className = 'item ' + (isCoal ? 'coal' : 'gift');
  el.dataset.type = isCoal ? 'coal' : 'gift';
  el.style.left = Math.random() * (gameEl.clientWidth - 48) + 'px';
  const endY = gameEl.clientHeight + 60;
  el.style.setProperty('--endY', endY + 'px');

  // Variation
  const duration = 4.5 - Math.min(3.3, state.difficultyRamp / 12); // faster later
  el.style.animationDuration = duration + 's';

  // Content (emoji)
  if (isCoal) {
    el.textContent = '🧱';
  } else {
    const gifts = ['🎁','🎄','🧸','🍬','🕯️','⭐','🧦'];
    el.textContent = gifts[Math.floor(Math.random() * gifts.length)];
  }

  gameEl.appendChild(el);
  state.items.push({ el, spawned: performance.now(), duration, taken: false });
}

function updateItems(ts) {
  const santaRect = santaEl.getBoundingClientRect();
  const gameRect = gameEl.getBoundingClientRect();

  for (let i = state.items.length - 1; i >= 0; i--) {
    const item = state.items[i];
    const rect = item.el.getBoundingClientRect();
    const progress = (ts - item.spawned) / (item.duration * 1000);

    // collision
    if (!item.taken && progress > 0 && progress < 1) {
      if (rect.bottom >= santaRect.top + 10 &&
          rect.top <= santaRect.bottom &&
          rect.left + rect.width * 0.6 >= santaRect.left &&
          rect.right - rect.width * 0.6 <= santaRect.right) {
        item.taken = true;
        collectItem(item);
      }
    }

    // remove if off-screen
    if (progress >= 1) {
      // If gift missed penalize slightly (optional)
      if (!item.taken && item.el.dataset.type === 'gift') {
        // optional small penalty or none
      }
      item.el.remove();
      state.items.splice(i, 1);
    }
  }
}

function collectItem(item) {
  const type = item.el.dataset.type;
  item.el.style.transition = 'transform .4s, opacity .4s';
  item.el.style.transform = 'scale(.4) translateY(-20px)';
  item.el.style.opacity = '.2';

  if (type === 'gift') {
    const base = 10;
    const bonus = Math.floor(state.difficultyRamp / 10) * 2;
    state.score += base + bonus;
    flashSanta();
  } else {
    state.lives--;
    shakeGame();
    if (state.lives <= 0) {
      endGame();
    }
  }
  updateHUD();
  setTimeout(() => item.el.remove(), 450);
}

function flashSanta() {
  santaEl.animate([
    { filter: 'brightness(1)' },
    { filter: 'brightness(2)' },
    { filter: 'brightness(1)' }
  ], { duration: 400, easing: 'ease-out' });
}

function shakeGame() {
  gameEl.animate([
    { transform: 'translateX(0)' },
    { transform: 'translateX(-8px)' },
    { transform: 'translateX(8px)' },
    { transform: 'translateX(-5px)' },
    { transform: 'translateX(5px)' },
    { transform: 'translateX(0)' }
  ], { duration: 500, easing: 'ease-in-out' });
}

function updateHUD() {
  scoreEl.textContent = state.score;
  timeEl.textContent = state.timeLeft;
  livesEl.textContent = state.lives;
  ariaLive.textContent = `Score ${state.score}. Time ${state.timeLeft} seconds. Lives ${state.lives}.`;
}

function clearItems() {
  state.items.forEach(it => it.el.remove());
  state.items = [];
}

function endGame() {
  state.playing = false;
  cancelAnimationFrame(state.raf);
  clearItems();
  finalScoreText.textContent = `You scored ${state.score} points!`;
  finalTitle.textContent = state.lives <= 0 ? 'Santa Ran Out of Cheer!' : 'Time Up!';
  overlay.hidden = false;

  const hs = parseInt(localStorage.getItem(HIGH_KEY) || '0', 10);
  if (state.score > hs) {
    localStorage.setItem(HIGH_KEY, state.score);
    highScoreEl.textContent = state.score;
    finalScoreText.textContent += ' New High Score! 🎉';
  }
}

// Utility: Throttle to optimize heavy events (not used but available)
function throttle(fn, wait = 100) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= wait) {
      last = now;
      fn(...args);
    }
  };
}

init();