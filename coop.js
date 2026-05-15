const RTCOOP = {
  enabled: false,
  myName: null,
  myRole: null,
  connectedPlayers: {},
  playerOrder: [],
  isHost: false,
  mapStatus: 'idle',
  currentController: '',
  mapPollTimer: null,
  battlePollTimer: null,
  joinCountdownTimer: null,
  endTransitionTimer: null,
  _wavePending: false,
  _lastDeclinedInvite: 0,
  _joinData: null,
  _joiningInviteId: 0,
  _defeatBroadcasting: false,
};

function _rtNameKey(name) {
  return (name || 'unknown').trim().toLowerCase().replace(/[^a-z0-9]/gi, '_').slice(0, 40);
}

function _rtcoopOnlineCount() {
  const cutoff = Date.now() - 8000;
  return Object.values(RTCOOP.connectedPlayers).filter(ts => ts > cutoff).length;
}

function _rtcoopOnlineNames() {
  const cutoff = Date.now() - 8000;
  return Object.entries(RTCOOP.connectedPlayers)
    .filter(([,ts]) => ts > cutoff)
    .sort(([,a],[,b]) => a - b)
    .map(([name]) => name);
}

function _rtcoopCurrentScreenId() {
  const scr = document.querySelector('.screen.active');
  return scr ? scr.id : '';
}

function _rtcoopCanReceiveInvite() {
  if (!RTCOOP.enabled || campaignMode !== 'coop') return false;
  const id = _rtcoopCurrentScreenId();
  return id === 'scr-map' || id === 'scr-story' || id === 'scr-victory' || id === 'scr-defeat';
}

function _rtcoopCanRematchAfterDefeat() {
  if (!(RTCOOP.enabled && G.mode === 'coop')) return true;
  if (RTCOOP.currentController) return RTCOOP.currentController === RTCOOP.myName;
  const baseController = RTCOOP.myName || '';
  const nextController = _rtcoopNextControllerName(baseController);
  return nextController === RTCOOP.myName;
}

function _rtcoopBuildCampaignSnapshot() {
  return {
    prov_state: JSON.stringify(provState),
    player_prov_id: playerProvId,
  };
}

function _rtcoopBuildEnemySnapshot(enemy) {
  if (!enemy) return {};
  return {
    enemy_hp: enemy.currentHp !== undefined ? enemy.currentHp : (enemy.hp || 0),
    enemy_max_hp: enemy.maxHp || enemy.hp || 0,
    enemy_name: enemy.name || '',
    enemy_nameEn: enemy.nameEn || '',
    enemy_sprite: enemy.sprite || '',
    enemy_announce: enemy.announce || '',
    enemy_isCivilBoss: !!enemy.isCivilBoss,
    enemy_isGeneral: !!enemy.isGeneral,
    enemy_build_activity: enemy.buildActivity || null,
    enemy_feast_course: enemy.feastCourse || null,
  };
}

function _rtcoopSessionMatchesMapBattle(mapData, session) {
  if (!mapData || !session || typeof session !== 'object') return false;
  if (session.status !== 'active') return false;
  if ((session.host || '') !== (mapData.host || '')) return false;
  if ((session.prov_id ?? -1) !== (mapData.battle_prov_id ?? -1)) return false;
  if ((session.battle_at || 0) < (mapData.started_at || 0)) return false;
  return true;
}

function _rtcoopBattleInviteStillJoinable(mapData, session, expectedInviteId) {
  if (!mapData) return false;
  const inviteId = mapData.started_at || mapData.battle_prov_id || 0;
  if (expectedInviteId && inviteId !== expectedInviteId) return false;
  if (inviteId && mapData.retreated_at && mapData.retreated_at >= inviteId) return false;
  if (mapData.status === 'waiting_for_guest') return true;
  if (mapData.status === 'battle_active') return _rtcoopSessionMatchesMapBattle(mapData, session);
  return false;
}

function _rtcoopClearJoinPrompt(opts) {
  opts = opts || {};
  clearInterval(RTCOOP.joinCountdownTimer);
  RTCOOP.joinCountdownTimer = null;
  if (opts.stopMapPoll) {
    clearInterval(RTCOOP.mapPollTimer);
    RTCOOP.mapPollTimer = null;
  }
  if (opts.clearJoinData) RTCOOP._joinData = null;
  const popup = document.getElementById('coop-join-popup');
  if (popup) popup.style.display = 'none';
}

async function _rtcoopPatchMapIdle(controller, extra) {
  const patch = {
    status: 'idle',
    host: '',
    battle_prov_id: -1,
    battle_prov_name: '',
    started_at: 0,
    auto_join_guests: false,
    ..._rtcoopBuildCampaignSnapshot(),
    ...(extra || {}),
  };
  if (controller) patch.controller = controller;
  await _rtPatch('coop_map', patch);
}

function _rtcoopApplyCampaignState(source) {
  if (!source || source.prov_state == null) return;
  try {
    const nextProvState = typeof source.prov_state === 'string' ? JSON.parse(source.prov_state) : source.prov_state;
    if (!nextProvState || typeof nextProvState !== 'object') return;
    provState = nextProvState;
    if (typeof source.player_prov_id === 'number' && source.player_prov_id >= 0) {
      playerProvId = source.player_prov_id;
    }
    if (document.getElementById('scr-map')?.classList.contains('active')) {
      renderProvinces();
      const cur = PROVINCES[playerProvId];
      if (cur) moveHeroToken(cur.x, cur.y);
      updateMapInfo();
    }
  } catch(e) {}
}

function _rtcoopPreferredControllerName() {
  return _rtcoopOnlineOrderedPlayerNames()[0] || RTCOOP.myName || '';
}

function _rtcoopOrderedPlayerNames() {
  const ordered = [];
  const seen = new Set();
  const push = (name) => {
    if (typeof name !== 'string') return;
    const clean = name.trim();
    if (!clean || seen.has(clean)) return;
    seen.add(clean);
    ordered.push(clean);
  };
  (RTCOOP.playerOrder || []).forEach(push);
  Object.keys(RTCOOP.connectedPlayers || {}).forEach(push);
  push(RTCOOP.myName);
  return ordered;
}

function _rtcoopOnlineOrderedPlayerNames() {
  const online = new Set(_rtcoopOnlineNames());
  return _rtcoopOrderedPlayerNames().filter(name => online.has(name));
}

function _rtcoopOnlineOrderedPlayerNamesFromMap(mapData) {
  if (!mapData || typeof mapData !== 'object') return _rtcoopOnlineOrderedPlayerNames();
  const now = Date.now();
  const cutoff = now - 8000;
  const connected = {};
  for (const [key, value] of Object.entries(mapData)) {
    if (key.startsWith('p_') && !key.endsWith('_declined') && typeof value === 'number' && value > cutoff) {
      connected[key.slice(2)] = value;
    }
  }
  if (mapData.player_names) {
    for (const [key, name] of Object.entries(mapData.player_names)) {
      if (connected[key] !== undefined) {
        connected[name] = connected[key];
        if (key !== name) delete connected[key];
      }
    }
  }

  const ordered = [];
  const seen = new Set();
  const push = (name) => {
    if (typeof name !== 'string') return;
    const clean = name.trim();
    if (!clean || seen.has(clean) || connected[clean] === undefined) return;
    seen.add(clean);
    ordered.push(clean);
  };
  (RTCOOP.playerOrder || []).forEach(push);
  Object.keys(connected).forEach(push);
  return ordered;
}

function _rtcoopNextControllerNameFromMap(mapData, currentName) {
  const names = _rtcoopOnlineOrderedPlayerNamesFromMap(mapData);
  if (!names.length) return currentName || RTCOOP.myName || '';
  const idx = names.indexOf(currentName);
  if (idx === -1) return names[0];
  return names[(idx + 1) % names.length] || names[0];
}

function _rtcoopNextControllerName(currentName) {
  const names = _rtcoopOnlineOrderedPlayerNames();
  if (!names.length) return currentName || RTCOOP.myName || '';
  const idx = names.indexOf(currentName);
  if (idx === -1) return names[0];
  return names[(idx + 1) % names.length] || names[0];
}

function _rtcoopOwnerNameFromKey(ownerKey, existingByOwner) {
  if (!ownerKey) return '';
  for (const ownerName of existingByOwner.keys()) {
    if (_rtNameKey(ownerName) === ownerKey) return ownerName;
  }
  for (const ownerName of _rtcoopOrderedPlayerNames()) {
    if (_rtNameKey(ownerName) === ownerKey) return ownerName;
  }
  for (const player of PLAYERS) {
    if (_rtNameKey(player.name) === ownerKey) return player.name;
  }
  return ownerKey;
}

function _rtcoopSyncHeroesFromSession(session) {
  if (!session || !Array.isArray(G.heroes)) return;
  const existingByOwner = new Map();
  G.heroes.forEach(hero => {
    const ownerName = hero.ownerName || getPlayerById(hero.level)?.name || hero.name;
    if (ownerName) existingByOwner.set(ownerName, hero);
  });

  const sessionOwnerKeys = Object.keys(session)
    .filter(key => key.startsWith('hero_key_') && session[key])
    .map(key => key.slice('hero_key_'.length));
  const orderedKeys = [];
  const seenOwnerKeys = new Set();
  const pushOwnerKey = (ownerKey) => {
    if (!ownerKey || seenOwnerKeys.has(ownerKey)) return;
    seenOwnerKeys.add(ownerKey);
    orderedKeys.push(ownerKey);
  };

  pushOwnerKey(_rtNameKey(RTCOOP.myName));
  _rtcoopOrderedPlayerNames().forEach(name => pushOwnerKey(_rtNameKey(name)));
  sessionOwnerKeys.forEach(pushOwnerKey);

  const nextHeroes = orderedKeys.map(ownerKey => {
    const ownerName = _rtcoopOwnerNameFromKey(ownerKey, existingByOwner);
    const remoteKey = session['hero_key_' + ownerKey];
    const current = existingByOwner.get(ownerName);
    if (!remoteKey) return current || null;
    const def = ALL_HEROES.find(h => h.key === remoteKey);
    if (!def) return current || null;
    const remoteHp = session['hp_' + ownerKey];
    const remoteMaxHp = session['maxhp_' + ownerKey];
    const isSelf = ownerName === RTCOOP.myName;
    return {
      ...def,
      level: current ? current.level : (isSelf ? RTCOOP.myRole : ownerName),
      ownerId: current ? current.ownerId : (isSelf ? RTCOOP.myRole : ownerName),
      ownerName,
      hp: isSelf
        ? (current ? current.hp : (remoteHp !== undefined ? Math.max(0, remoteHp) : def.maxHp))
        : (remoteHp !== undefined ? Math.max(0, remoteHp) : (current ? current.hp : def.maxHp)),
      maxHp: isSelf
        ? (current ? current.maxHp : (remoteMaxHp || def.maxHp))
        : (remoteMaxHp || (current ? current.maxHp : def.maxHp)),
      _online: isSelf ? true : (current ? current._online !== false : true),
    };
  }).filter(Boolean);

  const changed = nextHeroes.length !== G.heroes.length || nextHeroes.some((hero, index) => {
    const prev = G.heroes[index];
    return !prev || prev.ownerName !== hero.ownerName || prev.key !== hero.key;
  });

  G.heroes = nextHeroes;
  if (changed) renderHeroBars();
}

async function rtcoopInit(playerId) {
  const cfg = _getFirebaseConfig();
  if (!cfg.key) {
    RTCOOP.enabled = false;
    alert('⚠️ Co-op requires a Family Key.\n\nGo to Settings → ☁️ Cloud Sync and enter your Family Key first.');
    showScr('scr-profile');
    return;
  }
  try {
    const testPath = cfg.url + '/' + (typeof FIREBASE_ROOT !== 'undefined' ? FIREBASE_ROOT : 'xiyou') + '/' + encodeURIComponent(cfg.key) + '/coop_ping.json';
    const r = await fetch(testPath, {method:'PUT', headers:{'Content-Type':'application/json'}, body:'"ok"'});
    if (!r.ok) throw new Error('HTTP ' + r.status);
  } catch(e) {
    RTCOOP.enabled = false;
    alert('⚠️ Cannot connect to Firebase.\n\nPlease check your internet connection and try again.\n\n(' + e.message + ')');
    showScr('scr-profile');
    return;
  }

  const player = getPlayerById(playerId);
  const name = player ? player.name : (playerId || 'Player');
  RTCOOP.enabled = true;
  RTCOOP.myName = name;
  RTCOOP.myRole = playerId;
  RTCOOP.connectedPlayers = {};
  RTCOOP.playerOrder = [name];
  RTCOOP._wavePending = false;
  RTCOOP._lastDeclinedInvite = 0;
  RTCOOP.isHost = false;

  await _rtPatch('coop_map', {
    ['p_' + _rtNameKey(name)]: Date.now(),
    ['player_names/' + _rtNameKey(name)]: name,
  });

  _rtcoopStartMapPoll();
}

function rtcoopDisable() {
  RTCOOP.enabled = false;
  RTCOOP.myName = null;
  RTCOOP.connectedPlayers = {};
  RTCOOP.playerOrder = [];
  RTCOOP.mapStatus = 'idle';
  RTCOOP.currentController = '';
  RTCOOP._defeatBroadcasting = false;
  clearInterval(RTCOOP.mapPollTimer);
  clearInterval(RTCOOP.battlePollTimer);
  clearTimeout(RTCOOP.joinCountdownTimer);
  clearTimeout(RTCOOP.endTransitionTimer);
  RTCOOP.mapPollTimer = null;
  RTCOOP.battlePollTimer = null;
  RTCOOP.endTransitionTimer = null;

  const waitingBanner = document.getElementById('coop-map-waiting');
  if (waitingBanner) waitingBanner.style.display = 'none';
  const joinPopup = document.getElementById('coop-join-popup');
  if (joinPopup) joinPopup.style.display = 'none';
  document.querySelectorAll('[data-prov]').forEach(el => {
    el.style.pointerEvents = '';
    el.style.opacity = '';
  });
}

function _rtcoopStartMapPoll() {
  clearInterval(RTCOOP.mapPollTimer);
  RTCOOP.mapPollTimer = setInterval(_rtcoopMapPoll, 2000);
  _rtcoopMapPoll();
}

async function _rtcoopMapPoll() {
  if (!RTCOOP.enabled) return;

  const myKey = _rtNameKey(RTCOOP.myName);

  await _rtPatch('coop_map', {
    ['p_' + myKey]: Date.now(),
    ['player_names/' + myKey]: RTCOOP.myName,
  });

  const data = await _rtGet('coop_map');
  if (!data) {
    await _rtSet('coop_map', {
      controller: _rtcoopPreferredControllerName(),
      status: 'idle',
      host: '',
      battle_prov_id: -1,
      battle_prov_name: '',
      battle_ctype: 'battle',
      ['p_' + myKey]: Date.now(),
      player_names: { [myKey]: RTCOOP.myName },
      ..._rtcoopBuildCampaignSnapshot(),
    });
    RTCOOP.isHost = _rtcoopPreferredControllerName() === RTCOOP.myName;
    RTCOOP.connectedPlayers = { [RTCOOP.myName]: Date.now() };
    _rtcoopUpdateMapUI('idle', _rtcoopPreferredControllerName());
    return;
  }

  _rtcoopApplyCampaignState(data);

  const now = Date.now();
  const cutoff = now - 8000;
  const connected = {};
  for (const [k, v] of Object.entries(data)) {
    if (k.startsWith('p_') && !k.endsWith('_declined') && typeof v === 'number' && v > cutoff) {
      connected[k.slice(2)] = v;
    }
  }
  if (data.player_names) {
    for (const [k, name] of Object.entries(data.player_names)) {
      if (connected[k] !== undefined) {
        connected[name] = connected[k];
        if (k !== name) delete connected[k];
      }
    }
  }

  RTCOOP.connectedPlayers = connected;
  RTCOOP.playerOrder = [
    ...(data.player_names ? Object.values(data.player_names) : []),
    ...Object.keys(connected),
    RTCOOP.myName,
  ].filter((name, index, arr) => typeof name === 'string' && name.trim() && arr.indexOf(name) === index);

  let controller = data.controller || data.host || '';
  const status = data.status || 'idle';
  const hostName = data.host || '';
  const hostOnline = !!(hostName && connected[hostName] && connected[hostName] > cutoff);
  if (!controller && status === 'idle') {
    controller = _rtcoopPreferredControllerName();
    if (controller) await _rtPatch('coop_map', { controller });
  }
  const amController = controller === RTCOOP.myName;
  RTCOOP.mapStatus = status;
  RTCOOP.currentController = controller;
  RTCOOP.isHost = amController;

  if ((status === 'waiting_for_guest' || status === 'battle_active') && hostName && !hostOnline) {
    const fallbackController = controller || _rtcoopNextControllerName(hostName);
    RTCOOP.mapStatus = 'idle';
    RTCOOP.currentController = fallbackController;
    await _rtcoopPatchMapIdle(fallbackController, { stale_cleared_at: Date.now() });
    _rtcoopUpdateMapUI('idle', fallbackController);
    return;
  }

  const inviteId = data.started_at || 0;
  const inviteRetreated = !!(inviteId && data.retreated_at && data.retreated_at >= inviteId);
  if (status === 'waiting_for_guest' && inviteRetreated) {
    const fallbackController = controller || _rtcoopPreferredControllerName();
    RTCOOP.mapStatus = 'idle';
    RTCOOP.currentController = fallbackController;
    await _rtcoopPatchMapIdle(fallbackController, { stale_cleared_at: Date.now() });
    _rtcoopUpdateMapUI('idle', fallbackController);
    return;
  }

  let liveSession = null;
  const canReceiveInvite = _rtcoopCanReceiveInvite();
  if ((status === 'waiting_for_guest' || status === 'battle_active') && hostName && hostName !== RTCOOP.myName && hostOnline && canReceiveInvite) {
    liveSession = await _rtGet('coop_session');
    const battleJoinable = _rtcoopBattleInviteStillJoinable(data, liveSession, inviteId);
    if (battleJoinable) {
      if (data.auto_join_guests) {
        RTCOOP._joinData = data;
        rtcoopJoinBattle();
      } else if (RTCOOP._lastDeclinedInvite !== inviteId) {
        RTCOOP._joinData = data;
        _rtcoopShowJoinPopup(data);
      } else {
        _rtcoopUpdateMapUI(status, controller || hostName);
      }
      return;
    }
  }

  if (status !== 'waiting_for_guest' && status !== 'battle_active') {
    _rtcoopClearJoinPrompt({ clearJoinData: true });
  }

  if (status === 'idle' && document.getElementById('scr-battle')?.classList.contains('active')) {
    clearInterval(RTCOOP.battlePollTimer);
    RTCOOP.isHost = false;
    RTCOOP._wavePending = false;
    returnToMap();
    return;
  }

  if (status === 'battle_active' && !document.getElementById('scr-battle')?.classList.contains('active')) {
    const session = liveSession || await _rtGet('coop_session');
    if (!_rtcoopSessionMatchesMapBattle(data, session)) {
      const fallbackController = controller || hostName || _rtcoopPreferredControllerName();
      await _rtcoopPatchMapIdle(fallbackController, { stale_cleared_at: Date.now() });
      RTCOOP.mapStatus = 'idle';
      RTCOOP.currentController = fallbackController;
      RTCOOP.isHost = fallbackController === RTCOOP.myName;
      _rtcoopUpdateMapUI('idle', fallbackController);
      return;
    }
  }

  if (status === 'battle_active') {
    _rtcoopUpdateMapUI(status, controller);
    return;
  }

  _rtcoopUpdateMapUI(status, controller);
}

function _rtcoopUpdateMapUI(status, controller) {
  const amController = controller === RTCOOP.myName;
  const waitingBanner = document.getElementById('coop-map-waiting');
  if (!waitingBanner || !RTCOOP.enabled) {
    if (waitingBanner) waitingBanner.style.display = 'none';
    return;
  }

  const now = Date.now();
  const cutoff = now - 8000;
  const others = Object.entries(RTCOOP.connectedPlayers).filter(([name]) => name !== RTCOOP.myName);
  const count = others.length + 1;
  const playerDots = others.map(([name, ts]) => {
    const dot = ts > cutoff ? '🟢' : '🔴';
    return `${dot} ${name}`;
  }).join('  ');

  const mi = document.getElementById('map-info');

  if (amController) {
    waitingBanner.style.display = 'none';
    if (mi) {
      const owned = Object.values(provState).filter(v=>v==='owned').length;
      const waitingStr = count < 2 ? '  ⏳ Waiting for players…' : '';
      mi.textContent = `已行经${owned}/${PROVINCES.length}站  ⭐ Your turn${waitingStr}${playerDots ? '  ' + playerDots : ''}`;
    }
    document.querySelectorAll('[data-prov]').forEach(el => {
      el.style.pointerEvents = '';
      el.style.opacity = '';
    });
  } else {
    waitingBanner.style.display = 'block';
    document.getElementById('coop-waiting-text').textContent =
      `⏳ ${controller} 的回合 ${controller}'s turn`;
    document.querySelectorAll('[data-prov]').forEach(el => {
      el.style.pointerEvents = 'none';
      el.style.opacity = '0.6';
    });
    const fp = document.getElementById('fort-panel');
    if (fp) fp.style.display = 'none';
    if (mi) {
      const owned = Object.values(provState).filter(v=>v==='owned').length;
      mi.textContent = `已行经${owned}/${PROVINCES.length}站${playerDots ? '  ' + playerDots : ''}`;
    }
  }
}

async function rtcoopHostStartBattle(fort, opts) {
  if (!RTCOOP.enabled) return;
  clearTimeout(RTCOOP.endTransitionTimer);
  RTCOOP.endTransitionTimer = null;
  const prov = PROVINCES[fort.provId];
  await _rtPatch('coop_map', {
    controller: RTCOOP.myName,
    status: 'waiting_for_guest',
    battle_prov_id: fort.provId,
    battle_prov_name: prov ? prov.hz : '',
    battle_ctype: getProvType(fort.provId),
    host: RTCOOP.myName,
    started_at: Date.now(),
    auto_join_guests: !!(opts && opts.autoJoinGuests),
    ['p_' + _rtNameKey(RTCOOP.myName)]: Date.now(),
    ..._rtcoopBuildCampaignSnapshot(),
  });
}

function _rtcoopShowJoinPopup(data) {
  const popup = document.getElementById('coop-join-popup');
  if (!popup) return;
  if (popup.style.display === 'flex') return;

  clearInterval(RTCOOP.mapPollTimer);
  RTCOOP._joinData = data;

  const provName = data.battle_prov_name || '?';
  const hostName = data.host || '?';
    const ctIcon = data.battle_ctype==='feast'?'🪷':data.battle_ctype==='build'?'⛰️':'⚔️';
  document.getElementById('coop-join-title').textContent =
    `${ctIcon} ${hostName} 正在前往 ${provName}！`;

  popup.style.display = 'flex';

  let secs = 10;
  const secsEl = document.getElementById('coop-join-secs');
  const cdEl = document.getElementById('coop-join-countdown');
  if (secsEl) secsEl.textContent = secs;
  if (cdEl) cdEl.textContent = secs;

  clearInterval(RTCOOP.joinCountdownTimer);
  RTCOOP.joinCountdownTimer = setInterval(() => {
    secs--;
    if (secsEl) secsEl.textContent = secs;
    if (cdEl) cdEl.textContent = secs;
    if (secs <= 0) { clearInterval(RTCOOP.joinCountdownTimer); rtcoopJoinBattle(); }
  }, 1000);
}

async function rtcoopJoinBattle() {
  _rtcoopClearJoinPrompt({ stopMapPoll: true });
  const data = RTCOOP._joinData;
  if (!data) return;
  const inviteId = data.started_at || data.battle_prov_id || Date.now();
  if (RTCOOP._joiningInviteId === inviteId || document.getElementById('scr-battle')?.classList.contains('active')) return;

  const liveMap = await _rtGet('coop_map');
  const liveSession = await _rtGet('coop_session');
  const liveInviteId = liveMap && (liveMap.started_at || liveMap.battle_prov_id || 0);
  const inviteStillOpen = !!(liveMap && liveMap.host === data.host && liveInviteId === inviteId && _rtcoopBattleInviteStillJoinable(liveMap, liveSession, inviteId));
  if (!inviteStillOpen) {
    _rtcoopClearJoinPrompt({ clearJoinData: true });
    RTCOOP._joiningInviteId = 0;
    _rtcoopStartMapPoll();
    return;
  }

  RTCOOP.isHost = false;
  const provId = data.battle_prov_id;
  const prov = PROVINCES[provId];
  if (!prov) return;
  RTCOOP._joiningInviteId = inviteId;
  RTCOOP._joinData = null;
  const fort = {
    id:'p'+provId, name:prov.hz, en:prov.en,
    diff: Math.max(1, Math.floor(provId/10)+1),
    provId, conquered: provState[provId]==='owned'
  };
  await _rtPatch('coop_map', {
    status:'battle_active',
    ..._rtcoopBuildCampaignSnapshot(),
  });
  startBattle(fort, 'coop');
}

async function rtcoopDeclineBattle() {
  _rtcoopClearJoinPrompt();
  RTCOOP._lastDeclinedInvite = (RTCOOP._joinData && RTCOOP._joinData.started_at) || Date.now();
  RTCOOP._joinData = null;
  await _rtPatch('coop_map', {
    ['p_' + _rtNameKey(RTCOOP.myName) + '_declined']: Date.now(),
  });
  _rtcoopStartMapPoll();
}

async function rtcoopHostInitSession(totalWaves, enemyData) {
  if (!RTCOOP.enabled) return;
  RTCOOP._defeatBroadcasting = false;
  const myKey = _rtNameKey(RTCOOP.myName);
  const session = {
    host: RTCOOP.myName,
    status: 'active',
    wave: G.wave,
    totalWaves,
    damage_seq: 0,
    hits: null,
    prov_id: G.battleProvId,
    battle_at: Date.now(),
    ..._rtcoopBuildEnemySnapshot(enemyData),
  };
  _rtcoopOnlineNames().forEach(name => {
    const k = _rtNameKey(name);
    session['hp_' + k] = 0;
    session['maxhp_' + k] = 0;
    session['streak_' + k] = 0;
    session['ans_' + k] = '';
    session['ts_' + k] = 0;
  });
  G.heroes.forEach(h => {
    const ownerKey = _rtNameKey(h.ownerName || getPlayerById(h.level)?.name || h.name);
    session['hero_key_' + ownerKey] = h.key;
    session['hero_name_' + ownerKey] = h.name;
    if (h.level === RTCOOP.myRole) {
      session['hp_' + myKey] = h.hp;
      session['maxhp_' + myKey] = h.maxHp;
    }
  });
  session['ts_' + myKey] = Date.now();
  await _rtSet('coop_session', session);
  _rtcoopStartBattlePoll();
}

async function rtcoopGuestJoinSession() {
  if (!RTCOOP.enabled) return;
  RTCOOP._defeatBroadcasting = false;
  const myKey = _rtNameKey(RTCOOP.myName);
  const myHero = G.heroes.find(h => h.level === RTCOOP.myRole);
  await _rtPatch('coop_session', {
    ['ts_' + myKey]: Date.now(),
    ['hp_' + myKey]: myHero ? myHero.hp : 0,
    ['maxhp_' + myKey]: myHero ? myHero.maxHp : 0,
    ['streak_' + myKey]: 0,
    ['ans_' + myKey]: '',
    ['hero_key_' + myKey]: myHero ? myHero.key : '',
    ['hero_name_' + myKey]: myHero ? myHero.name : '',
  });
  const session = await _rtGet('coop_session');
  if (session) {
    _rtcoopSyncHeroesFromSession(session);
    _rtcoopSyncWave(session, { force: true, healHeroes: false });
  }
  _rtcoopStartBattlePoll();
}

async function rtcoopPublishOwnHeroState() {
  if (!(RTCOOP.enabled && G.mode === 'coop')) return;
  const myKey = _rtNameKey(RTCOOP.myName);
  const myHero = G.heroes.find(h => h.level === RTCOOP.myRole || h.ownerName === RTCOOP.myName);
  if (!myHero) return;
  await _rtPatch('coop_session', {
    ['ts_' + myKey]: Date.now(),
    ['hp_' + myKey]: Math.max(0, myHero.hp),
    ['maxhp_' + myKey]: myHero.maxHp,
    ['streak_' + myKey]: G.streak,
  });
}

async function rtcoopBroadcastDefeat() {
  if (!(RTCOOP.enabled && G.mode === 'coop')) return;
  if (RTCOOP.isHost) {
    await rtcoopHostSignalEnd('defeat');
    return;
  }
  if (RTCOOP._defeatBroadcasting) return;
  RTCOOP._defeatBroadcasting = true;
  try {
    await _rtPatch('coop_session', {
      status: 'defeat',
      ..._rtcoopBuildCampaignSnapshot(),
    });
    if (RTCOOP.isHost) {
      await _rtPatch('coop_map', {
        ..._rtcoopBuildCampaignSnapshot(),
      });
    }
  } finally {
    RTCOOP._defeatBroadcasting = false;
  }
}

function _rtcoopAllHeroesDefeatedFromSession(session) {
  if (!session || typeof session !== 'object') return false;
  const participants = Object.keys(session).filter(k => k.startsWith('hero_key_') && session[k]);
  if (!participants.length) return false;
  return participants.every(k => {
    const ownerKey = k.slice('hero_key_'.length);
    return (session['hp_' + ownerKey] || 0) <= 0;
  });
}

function _rtcoopStartBattlePoll() {
  clearInterval(RTCOOP.battlePollTimer);
  RTCOOP.battlePollTimer = setInterval(_rtcoopBattlePoll, 1500);
}

async function _rtcoopBattlePoll() {
  if (!RTCOOP.enabled) return;
  const session = await _rtGet('coop_session');
  if (!session) {
    clearInterval(RTCOOP.battlePollTimer);
    RTCOOP._wavePending = false;
    if (document.getElementById('scr-battle')?.classList.contains('active')) returnToMap();
    return;
  }
  if (session.status === 'ended') return;

  const myKey = _rtNameKey(RTCOOP.myName);
  const myHero = G.heroes.find(h => h.level === RTCOOP.myRole);

  await _rtPatch('coop_map', {
    ['p_' + myKey]: Date.now(),
    ['player_names/' + myKey]: RTCOOP.myName,
  });

  await _rtPatch('coop_session', {
    ['ts_' + myKey]: Date.now(),
    ['hp_' + myKey]: myHero ? myHero.hp : 0,
    ['maxhp_' + myKey]: myHero ? myHero.maxHp : 0,
    ['streak_' + myKey]: G.streak,
  });

  _rtcoopUpdatePartnerBar(session);
  _rtcoopSyncHeroesFromSession(session);

  G.heroes.forEach(h => {
    if (h.level === RTCOOP.myRole) return;
    const hKey = _rtNameKey(h.ownerName || getPlayerById(h.level)?.name || h.level);
    const remoteHp = session['hp_' + hKey];
    const remoteMaxHp = session['maxhp_' + hKey];
    const isOnline = (session['ts_' + hKey] || 0) > (Date.now() - 5000);
    if (remoteHp !== undefined) h.hp = Math.max(0, remoteHp);
    if (remoteMaxHp) h.maxHp = remoteMaxHp;
    h._online = isOnline;
  });
  G.heroes.forEach(h => {
    if (h.level === RTCOOP.myRole) h._online = true;
  });
  if (session.next_controller) RTCOOP.currentController = session.next_controller;
  updateHeroBars();
  _rtcoopRefreshQuestionLock();
  const allHeroesDefeated = _rtcoopAllHeroesDefeatedFromSession(session);
  if (session.status !== 'defeat' && allHeroesDefeated) {
    if (RTCOOP.isHost) RTCOOP.currentController = _rtcoopNextControllerName(RTCOOP.myName);
    rtcoopBroadcastDefeat();
    if (!document.getElementById('scr-defeat')?.classList.contains('active')) showDefeat({ skipSignal: true });
    return;
  }
  if (checkDefeat()) return;

  const hits = session.hits || {};
  const sessionWave = session.wave || 1;
  const enemyMaxHp = session.enemy_max_hp || (G.enemy ? G.enemy.maxHp : 1);
  const totalDmg = Object.values(hits).reduce((sum, h) => sum + (h.dmg || 0), 0);
  const authHp = Math.max(0, enemyMaxHp - totalDmg);

  if (G.enemy && G.enemy.currentHp !== authHp) {
    G.enemy.currentHp = authHp;
    updateEnemyHp();
  }

  if (RTCOOP.isHost && authHp <= 0 && !RTCOOP._wavePending) {
    RTCOOP._wavePending = true;
    checkEnemyDead();
  }
  if (!RTCOOP.isHost && (sessionWave > G.wave || session.enemy_name !== (G.enemy && G.enemy.name))) {
    RTCOOP._wavePending = false;
    _rtcoopSyncWave(session, { force: sessionWave === G.wave, healHeroes: sessionWave > G.wave });
  }
  if (RTCOOP.isHost && sessionWave === G.wave) RTCOOP._wavePending = false;

  if (session.status === 'victory') {
    clearInterval(RTCOOP.battlePollTimer);
    if (!RTCOOP.isHost) {
      _rtcoopApplyCampaignState(session);
      showVictory();
    }
  }
  if (session.status === 'defeat') {
    clearInterval(RTCOOP.battlePollTimer);
    if (!document.getElementById('scr-defeat')?.classList.contains('active')) showDefeat({ skipSignal: true });
  }
  if ((session.status === 'idle' || session.status === 'retreated') && !RTCOOP.isHost) {
    clearInterval(RTCOOP.battlePollTimer);
    RTCOOP._wavePending = false;
    returnToMap();
  }
}

async function rtcoopLogHit(dmg) {
  if (!RTCOOP.enabled || !G.enemy) return;
  const key = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await _rtPatch('coop_session', {
    ['hits/' + key]: { by: RTCOOP.myName, dmg, ts: Date.now() },
    ['ans_' + _rtNameKey(RTCOOP.myName)]: '✓',
    ['ts_' + _rtNameKey(RTCOOP.myName)]: Date.now(),
  });
}

async function rtcoopHostWaveAdvance() {
  if (!RTCOOP.enabled || !RTCOOP.isHost || !G.enemy) return;
  await _rtPatch('coop_session', {
    wave: G.wave,
    prov_id: G.battleProvId,
    hits: null,
    ['ans_' + _rtNameKey(RTCOOP.myName)]: '',
    ..._rtcoopBuildEnemySnapshot(G.enemy),
  });
}

async function rtcoopHostSignalEnd(result) {
  if (!RTCOOP.enabled || !RTCOOP.isHost) return;
  clearInterval(RTCOOP.battlePollTimer);
  const mapSnapshot = await _rtGet('coop_map');
  const endingInviteId = mapSnapshot && (mapSnapshot.started_at || mapSnapshot.battle_prov_id || 0);
  const nextController = _rtcoopNextControllerNameFromMap(mapSnapshot, RTCOOP.myName);
  RTCOOP.currentController = nextController;
  await _rtPatch('coop_session', {
    status: result,
    next_controller: nextController,
    ..._rtcoopBuildCampaignSnapshot(),
  });
  await _rtPatch('coop_map', {
    controller: nextController,
    ..._rtcoopBuildCampaignSnapshot(),
  });
  clearTimeout(RTCOOP.endTransitionTimer);
  RTCOOP.endTransitionTimer = setTimeout(async () => {
    const latestMap = await _rtGet('coop_map');
    const latestInviteId = latestMap && (latestMap.started_at || latestMap.battle_prov_id || 0);
    if (latestMap && latestInviteId && endingInviteId && latestInviteId !== endingInviteId) {
      RTCOOP.endTransitionTimer = null;
      return;
    }
    await _rtcoopPatchMapIdle(nextController);
    RTCOOP.endTransitionTimer = null;
  }, 1500);
}

function _rtcoopSyncWave(session, opts) {
  opts = opts || {};
  const nextWave = session.wave || G.wave;
  const waveChanged = opts.force || nextWave !== G.wave;
  G.wave = nextWave;
  const enemyMaxHp = session.enemy_max_hp || (G.enemy ? G.enemy.maxHp : 0);
  const hits = session.hits || {};
  const totalDmg = Object.values(hits).reduce((sum, hit) => sum + (hit.dmg || 0), 0);
  G.enemy = {
    ...(G.enemy || {}),
    hp: enemyMaxHp,
    maxHp: enemyMaxHp,
    currentHp: Math.max(0, (session.enemy_hp !== undefined ? session.enemy_hp : enemyMaxHp) - totalDmg),
    name: session.enemy_name || (G.enemy && G.enemy.name) || '',
    nameEn: session.enemy_nameEn || '',
    sprite: session.enemy_sprite || (G.enemy && G.enemy.sprite) || 'soldier',
    announce: session.enemy_announce || ((session.enemy_name || (G.enemy && G.enemy.name) || '') + '出现！'),
    isCivilBoss: !!session.enemy_isCivilBoss,
    isGeneral: !!session.enemy_isGeneral,
    buildActivity: session.enemy_build_activity || null,
    feastCourse: session.enemy_feast_course || null,
  };
  const waveEl = document.getElementById('btl-wave');
  if (waveEl) waveEl.textContent = `第${cnNum(G.wave)}关  Wave ${G.wave}/${G.totalWaves}`;
  if (G.enemy) {
    const hasCry = !!(GENERAL_CRIES && GENERAL_CRIES[G.enemy.name] && (G.enemy.isGeneral || G.enemy.isCivilBoss));
    if (hasCry) {
      G._battleCrySpeaking = true;
      const earlyGrid = document.getElementById('ans-grid');
      if (earlyGrid) { earlyGrid.style.opacity = '0.35'; earlyGrid.style.pointerEvents = 'none'; }
      setTimeout(() => showBattleCry(G.enemy.name), 800);
    }
    renderEnemy();
  }
  if (opts.healHeroes !== false && waveChanged) {
    _healHeroesBetweenWaves();
    _rtcoopRefreshQuestionLock();
  }
  if (!musicMuted) playBattleMusic(G.wave);
}

function _rtcoopUpdatePartnerBar(session) {
  const bar = document.getElementById('coop-partner-bar');
  const statusEl = document.getElementById('coop-partner-status');
  if (!bar || !statusEl) return;
  bar.style.display = 'none';
  statusEl.textContent = '';
  return;
}

function rtcoopHeroBarLabel(hero, index) {
  if (!RTCOOP.enabled || G.mode !== 'coop') return hero.name;
  const ownerName = hero.ownerName || getPlayerById(hero.level)?.name || hero.name;
  const dot = hero._online === false ? '🔴' : '🟢';
  return hero.name + ' ' + dot + ' ' + ownerName;
}

function _rtPath(sub) {
  const {url, key} = _getFirebaseConfig();
  if (!url || !key) return null;
  return url + '/' + (typeof FIREBASE_ROOT !== 'undefined' ? FIREBASE_ROOT : 'xiyou') + '/' + encodeURIComponent(key) + '/' + sub + '.json';
}

async function _rtGet(sub) {
  const path = _rtPath(sub);
  if (!path) return null;
  const r = await fetch(path);
  if (!r.ok) return null;
  return r.json();
}

async function _rtSet(sub, data) {
  const path = _rtPath(sub);
  if (!path) return false;
  const r = await fetch(path, {
    method:'PUT', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(data)
  });
  return r.ok;
}

async function _rtPatch(sub, data) {
  const path = _rtPath(sub);
  if (!path) return false;
  const r = await fetch(path, {
    method:'PATCH', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(data)
  });
  return r.ok;
}
