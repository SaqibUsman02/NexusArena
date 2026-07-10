const API_BASE = window.location.origin;

// State management
let state = {
  token: localStorage.getItem('arena_session_token') || null,
  user: null,
  isSearching: false,
  searchTimer: null,
  searchSeconds: 0,
  matchPollInterval: null,
  activeMatch: null, // Holds matched opponent details
};

// UI Elements
const el = {
  authCard: document.getElementById('auth-card'),
  authForm: document.getElementById('auth-form'),
  authTitle: document.getElementById('auth-title'),
  usernameGroup: document.getElementById('username-group'),
  regUsername: document.getElementById('reg-username'),
  authEmail: document.getElementById('auth-email'),
  authPassword: document.getElementById('auth-password'),
  authSubmitBtn: document.getElementById('auth-submit-btn'),
  authToggleAction: document.getElementById('auth-toggle-action'),
  authToggleLink: document.getElementById('auth-toggle-link'),

  profileCard: document.getElementById('profile-card'),
  profileDisplayName: document.getElementById('profile-display-name'),
  profileLevel: document.getElementById('profile-level'),
  profileWins: document.getElementById('profile-wins'),
  profileLosses: document.getElementById('profile-losses'),
  logoutBtn: document.getElementById('logout-btn'),

  matchmakingTitle: document.getElementById('matchmaking-title'),
  matchmakingDesc: document.getElementById('matchmaking-desc'),
  matchmakingControls: document.getElementById('matchmaking-controls'),
  matchmakeBtn: document.getElementById('matchmake-btn'),
  cancelMatchmakeBtn: document.getElementById('cancel-matchmake-btn'),
  radarCenterNode: document.getElementById('radar-center-node'),
  queueTimerDisplay: document.getElementById('queue-timer-display'),
  queueSec: document.getElementById('queue-sec'),

  leaderboardList: document.getElementById('leaderboard-list'),
  refreshLeaderboardBtn: document.getElementById('refresh-leaderboard-btn'),
  
  matchHistoryList: document.getElementById('match-history-list'),
  refreshHistoryBtn: document.getElementById('refresh-history-btn'),

  matchModalOverlay: document.getElementById('match-modal-overlay'),
  competitor1Name: document.getElementById('competitor-1-name'),
  competitor1Details: document.getElementById('competitor-1-details'),
  competitor2Name: document.getElementById('competitor-2-name'),
  competitor2Details: document.getElementById('competitor-2-details'),
  simulateGameBtn: document.getElementById('simulate-game-btn'),
};

// Mode configuration
let isRegisterMode = false;

/* ==========================================
   1. Helper / API Functions
   ========================================== */

const apiFetch = async (endpoint, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...(state.token && { 'Authorization': `Bearer ${state.token}` }),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong');
  }
  return data;
};

// Check connection on load
const checkConnection = async () => {
  try {
    const indicator = document.getElementById('connection-indicator');
    const welcome = await apiFetch('/api/players/me').catch(() => null); // dummy test
    indicator.textContent = '📡 Server Connected';
    indicator.style.background = 'rgba(16,185,129,0.1)';
    indicator.style.color = 'var(--success)';
  } catch (err) {
    const indicator = document.getElementById('connection-indicator');
    indicator.textContent = '❌ Offline';
    indicator.style.background = 'rgba(239,68,68,0.1)';
    indicator.style.color = 'var(--danger)';
  }
};

/* ==========================================
   2. Auth Handler Functions
   ========================================== */

const updateAuthView = () => {
  if (state.token && state.user) {
    // Logged In view
    el.authCard.classList.add('hidden');
    el.profileCard.classList.remove('hidden');
    
    el.profileDisplayName.textContent = state.user.username;
    el.profileLevel.textContent = `Level ${state.user.level}`;
    el.profileWins.textContent = state.user.totalWins !== undefined ? state.user.totalWins : 0;
    el.profileLosses.textContent = state.user.totalLosses !== undefined ? state.user.totalLosses : 0;
    
    el.matchmakingTitle.textContent = 'Matchmaking Arena';
    el.matchmakingDesc.textContent = 'Prepare to enter the queue. You will be matched against players of a similar level tier.';
    el.matchmakingControls.classList.remove('hidden');
  } else {
    // Logged Out view
    el.profileCard.classList.add('hidden');
    el.authCard.classList.remove('hidden');
    
    el.matchmakingTitle.textContent = 'Arena Matchmaking';
    el.matchmakingDesc.textContent = 'Authenticate to join the competitive matching pool.';
    el.matchmakingControls.classList.add('hidden');
    
    stopMatchmakingSearch();
  }
};

const fetchCurrentUser = async () => {
  if (!state.token) return;
  try {
    const profile = await apiFetch('/api/players/me');
    state.user = profile;
    updateAuthView();
  } catch (err) {
    console.error('Session validation failed:', err);
    logout();
  }
};

const logout = async () => {
  if (state.token) {
    try {
      await apiFetch('/api/players/logout', { method: 'POST' });
    } catch (e) {
      console.warn('Logout call failed (possibly expired already).');
    }
  }
  state.token = null;
  state.user = null;
  localStorage.removeItem('arena_session_token');
  updateAuthView();
};

/* ==========================================
   3. Matchmaking Radar & Search Logics
   ========================================== */

const startMatchmakingSearch = async () => {
  try {
    const result = await apiFetch('/api/matchmaking/join', { method: 'POST' });
    
    state.isSearching = true;
    el.matchmakeBtn.classList.add('hidden');
    el.cancelMatchmakeBtn.classList.remove('hidden');
    el.radarCenterNode.classList.add('searching');
    el.queueTimerDisplay.classList.remove('hidden');
    
    state.searchSeconds = 0;
    el.queueSec.textContent = '0s';
    state.searchTimer = setInterval(() => {
      state.searchSeconds++;
      el.queueSec.textContent = `${state.searchSeconds}s`;
    }, 1000);

    if (result.matched) {
      handleMatchFound(result);
    } else {
      // Start polling for a match every 3 seconds
      state.matchPollInterval = setInterval(async () => {
        try {
          const pollResult = await apiFetch('/api/matchmaking/join', { method: 'POST' });
          if (pollResult.matched) {
            handleMatchFound(pollResult);
          }
        } catch (err) {
          console.error('Matchmaking poll error:', err);
          stopMatchmakingSearch();
          alert('Queue error: ' + err.message);
        }
      }, 3000);
    }
  } catch (err) {
    alert('Matchmaking Join Failed: ' + err.message);
  }
};

const stopMatchmakingSearch = async (callServer = true) => {
  if (state.isSearching && callServer) {
    try {
      await apiFetch('/api/matchmaking/leave', { method: 'POST' });
    } catch (e) {
      console.warn('Leave pool error:', e);
    }
  }

  state.isSearching = false;
  clearInterval(state.searchTimer);
  clearInterval(state.matchPollInterval);
  
  el.matchmakeBtn.classList.remove('hidden');
  el.cancelMatchmakeBtn.classList.add('hidden');
  el.radarCenterNode.classList.remove('searching');
  el.queueTimerDisplay.classList.add('hidden');
};

const handleMatchFound = (matchData) => {
  stopMatchmakingSearch(false); // Stop local timer/polling loop (don't call leave pool)
  
  state.activeMatch = matchData;

  // Render modal competitor labels
  el.competitor1Name.textContent = state.user.username;
  el.competitor1Details.textContent = `Level ${state.user.level}`;

  el.competitor2Name.textContent = matchData.opponent.username;
  el.competitor2Details.textContent = `Opponent ID: ${matchData.opponent.id}`;

  // Display matchup modal overlay
  el.matchModalOverlay.classList.add('active');
};

const simulateMatchResult = async () => {
  if (!state.activeMatch) return;
  
  const player1Id = state.user.id;
  const player2Id = state.activeMatch.opponent.id;

  // Generate random non-tying scores between 5 and 15
  let score1 = Math.floor(Math.random() * 11) + 5;
  let score2 = Math.floor(Math.random() * 11) + 5;
  while (score1 === score2) {
    score2 = Math.floor(Math.random() * 11) + 5;
  }
  
  const winnerId = score1 > score2 ? player1Id : player2Id;

  el.simulateGameBtn.disabled = true;
  el.simulateGameBtn.textContent = 'Writing Game Logs...';

  try {
    // Submit scores to match queue list
    await apiFetch('/api/matches/submit', {
      method: 'POST',
      body: JSON.stringify({
        playerOneId: player1Id,
        playerTwoId: player2Id,
        playerOneScore: score1,
        playerTwoScore: score2,
        winnerId: winnerId,
      }),
    });

    console.log('Match successfully submitted!');
    
    // Close modal
    el.matchModalOverlay.classList.remove('active');
    state.activeMatch = null;
    
    // Refresh modules
    await fetchCurrentUser(); // Refreshes win/loss stats
    loadLeaderboard();
    loadMatchHistory();
  } catch (err) {
    alert('Failed to submit game simulation results: ' + err.message);
  } finally {
    el.simulateGameBtn.disabled = false;
    el.simulateGameBtn.textContent = 'Simulate Game Result';
  }
};

/* ==========================================
   4. Leaderboard & History Fetching
   ========================================== */

const loadLeaderboard = async () => {
  try {
    const data = await apiFetch('/api/leaderboard/top?limit=10');
    el.leaderboardList.innerHTML = '';
    
    if (data.leaderboard.length === 0) {
      el.leaderboardList.innerHTML = `
        <tr>
          <td colspan="3" class="text-center text-muted" style="padding: 2rem;">
            No players registered on the scoreboard yet.
          </td>
        </tr>
      `;
      return;
    }

    data.leaderboard.forEach((entry) => {
      const isTop3 = entry.rank <= 3;
      const rankClass = isTop3 ? `rank-${entry.rank}` : 'rank-other';
      
      const row = document.createElement('tr');
      row.className = `leaderboard-row ${rankClass}`;
      row.innerHTML = `
        <td><span class="rank-badge">${entry.rank}</span></td>
        <td style="font-weight: 600;">${entry.username}</td>
        <td class="player-score">${entry.score} pts</td>
      `;
      el.leaderboardList.appendChild(row);
    });
  } catch (err) {
    console.error('Failed to load leaderboard:', err);
  }
};

const loadMatchHistory = async () => {
  try {
    const data = await apiFetch('/api/matches/history');
    el.matchHistoryList.innerHTML = '';

    if (data.history.length === 0) {
      el.matchHistoryList.innerHTML = `
        <div class="text-center text-muted" style="padding: 3rem;">
          No matches played yet. Start a match in matchmaking!
        </div>
      `;
      return;
    }

    data.history.forEach((match) => {
      const winnerName = match.Winner.username;
      
      const item = document.createElement('div');
      item.className = 'history-item';
      item.innerHTML = `
        <div class="history-players">
          <span class="history-player ${match.winnerId === match.playerOneId ? 'player-score' : ''}">${match.PlayerOne.username}</span>
          <span class="history-vs">VS</span>
          <span class="history-player ${match.winnerId === match.playerTwoId ? 'player-score' : ''}">${match.PlayerTwo.username}</span>
          <span class="winner-tag">Winner: ${winnerName}</span>
        </div>
        <div class="history-scores">
          ${match.playerOneScore} - ${match.playerTwoScore}
        </div>
      `;
      el.matchHistoryList.appendChild(item);
    });
  } catch (err) {
    console.error('Failed to load match history:', err);
  }
};

/* ==========================================
   5. Event Listeners & Bootstrapping
   ========================================== */

// Auth Mode Toggle
el.authToggleAction.addEventListener('click', () => {
  isRegisterMode = !isRegisterMode;
  if (isRegisterMode) {
    el.authTitle.textContent = 'Player Registration';
    el.usernameGroup.classList.remove('hidden');
    el.authSubmitBtn.textContent = 'Create Account';
    el.authToggleAction.textContent = 'Sign In instead';
    el.authToggleLink.innerHTML = `Already have an account? <span id="auth-toggle-action">Sign In instead</span>`;
  } else {
    el.authTitle.textContent = 'Player Sign In';
    el.usernameGroup.classList.add('hidden');
    el.authSubmitBtn.textContent = 'Sign In';
    el.authToggleLink.innerHTML = `Don't have an account? <span id="auth-toggle-action">Register here</span>`;
  }
  // Rebind toggler since innerHTML overwrites the node
  document.getElementById('auth-toggle-action').addEventListener('click', () => el.authToggleAction.click());
});

// Authentication Submit
el.authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = el.authEmail.value;
  const password = el.authPassword.value;
  
  try {
    if (isRegisterMode) {
      const username = el.regUsername.value;
      if (!username) throw new Error('Username is required for registration.');
      
      await apiFetch('/api/players/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password }),
      });
      
      // Auto-toggle to sign in after registration
      alert('Registration successful! Please sign in.');
      el.authToggleAction.click();
    } else {
      const data = await apiFetch('/api/players/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      
      state.token = data.token;
      state.user = data.player;
      localStorage.setItem('arena_session_token', data.token);
      
      el.authForm.reset();
      updateAuthView();
      loadLeaderboard(); // Reload profiles on the leaderboard
    }
  } catch (err) {
    alert(err.message);
  }
});

// Logout Button
el.logoutBtn.addEventListener('click', logout);

// Matchmaking button listeners
el.matchmakeBtn.addEventListener('click', startMatchmakingSearch);
el.cancelMatchmakeBtn.addEventListener('click', () => stopMatchmakingSearch(true));

// Simulate button trigger
el.simulateGameBtn.addEventListener('click', simulateMatchResult);

// Refresh panels trigger
el.refreshLeaderboardBtn.addEventListener('click', loadLeaderboard);
el.refreshHistoryBtn.addEventListener('click', loadMatchHistory);

// Initialize App
const init = async () => {
  await checkConnection();
  if (state.token) {
    await fetchCurrentUser();
  } else {
    updateAuthView();
  }
  loadLeaderboard();
  loadMatchHistory();
};

init();
