(function(){
  const sameOriginWs = (location.host && !/github\.io$/i.test(location.hostname))
    ? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`
    : '';
  const ONLINE_FALLBACK_WS = 'wss://deadtown-by-cedrrriiiccc.online';
  const ONLINE_DEFAULT_WS = localStorage.getItem('deadtown_online_server_url') || sameOriginWs || ONLINE_FALLBACK_WS;
  const ONLINE_T = {
    en: {
      onlineBtn: 'Online Co-op',
      onlineTitle: 'ONLINE CO-OP',
      onlineDesc: 'Authoritative co-op preview. Rooms, shared wave state, enemies, boss, airdrops, pickups, and damage are now synchronized through the server.',
      serverUrl: 'WebSocket Server URL',
      roomName: 'Room Name',
      createRoom: 'Create Room',
      connect: 'Connect',
      disconnect: 'Disconnect',
      refresh: 'Refresh',
      join: 'Join',
      leave: 'Leave Room',
      ready: 'Ready',
      unready: 'Unready',
      startMatch: 'Start Match',
      roomPlayers: 'Players',
      statusIdle: 'Status: idle',
      statusConnecting: 'Status: connecting...',
      statusConnected: 'Status: connected',
      statusError: 'Status: connection error',
      back: 'Back',
      host: 'Host',
      players: 'Players',
      peers: 'Peers',
      readyStatus: 'Ready',
      unreadyStatus: 'Not Ready',
      inGame: 'In Game',
      autoStarting: 'Auto start in',
      rooms: 'Public Rooms',
      noRooms: 'No public rooms yet.',
      onlinePreview: 'ONLINE SYNC',
      onlineNoLeaderboard: 'Online co-op matches do not submit leaderboard scores.',
      onlineRoomCreated: 'Room created.',
      onlineNeedName: 'Set your player name first.',
      onlineNeedServer: 'Enter the WebSocket server URL first.',
      onlineJoined: 'Joined room.',
      onlineDisconnected: 'Disconnected from online server.',
      onlineRoomNameFallback: 'DeadTown Room',
      onlineRoomOwner: 'Owner',
      onlineStateStarted: 'Started',
      onlineStateWaiting: 'Lobby',
      onlinePlayersLabel: 'Room Players',
      onlineConnection: 'Server Connection',
      onlineServerStatus: 'Server Status',
      onlineStatusIdle: 'Idle',
      onlineStatusBusy: 'Busy',
      onlineStatusFull: 'Full',
      onlineQueueLabel: 'Queue',
      onlineQueuedAt: 'Waiting in queue',
      onlineQueuedSuffix: 'players ahead',
      onlineReconnectNow: 'Retrying connection...',
      onlineReconnectIn: 'Reconnecting in',
      onlineStartInfo: 'Starting synchronized online match...',
      onlineMatchEnded: 'Match ended.',
      onlineScoreboard: 'SCORES',
      onlineTotalScore: 'TOTAL',
      onlineSummaryTitle: 'MATCH SUMMARY',
      onlineSummaryDesc: 'Online match complete.',
      onlineSummaryPlayer: 'Player',
      onlineSummaryScore: 'Score',
      onlineSummaryKills: 'Kills',
      onlineSummarySurvive: 'Survive',
      onlineSummaryTotalScore: 'Team Score',
      onlineSummaryTotalKills: 'Team Kills',
      onlineSummaryMatchTime: 'Match Time',
      returnToRoom: 'Return to Room',
      mainMenu: 'Main Menu',
    },
    zh: {
      onlineBtn: '在线合作',
      onlineTitle: '在线合作',
      onlineDesc: '这是带房间级共享战局的联机预览版。波次、僵尸、Boss、空投、掉落物和伤害现在都由服务器统一同步。',
      serverUrl: 'WebSocket 服务器地址',
      roomName: '房间名',
      createRoom: '创建房间',
      connect: '连接',
      disconnect: '断开',
      refresh: '刷新',
      join: '加入',
      leave: '离开房间',
      ready: '准备',
      unready: '取消准备',
      startMatch: '开始游戏',
      roomPlayers: '玩家',
      statusIdle: '状态：空闲',
      statusConnecting: '状态：连接中...',
      statusConnected: '状态：已连接',
      statusError: '状态：连接失败',
      back: '返回',
      host: '房主',
      players: '玩家',
      peers: '其他玩家',
      readyStatus: '已准备',
      unreadyStatus: '未准备',
      inGame: '进行中',
      autoStarting: '自动开始倒计时',
      rooms: '公共房间',
      noRooms: '还没有公共房间。',
      onlinePreview: '在线同步版',
      onlineNoLeaderboard: '在线合作模式不会上传排行榜成绩。',
      onlineRoomCreated: '房间已创建。',
      onlineNeedName: '请先设置玩家名字。',
      onlineNeedServer: '请先输入 WebSocket 服务器地址。',
      onlineJoined: '已加入房间。',
      onlineDisconnected: '已断开在线服务器。',
      onlineRoomNameFallback: 'DeadTown 房间',
      onlineRoomOwner: '房主',
      onlineStateStarted: '已开始',
      onlineStateWaiting: '大厅中',
      onlinePlayersLabel: '房间玩家',
      onlineConnection: '服务器连接',
      onlineServerStatus: '服务器状态',
      onlineStatusIdle: '空闲',
      onlineStatusBusy: '繁忙',
      onlineStatusFull: '爆满',
      onlineQueueLabel: '排队',
      onlineQueuedAt: '排队中',
      onlineQueuedSuffix: '人在前面',
      onlineReconnectNow: '正在重试连接...',
      onlineReconnectIn: '将在此时间后重连',
      onlineStartInfo: '正在进入联机同步对局...',
      onlineMatchEnded: '对局已结束。',
      onlineScoreboard: '局内分数',
      onlineTotalScore: '总分',
      onlineSummaryTitle: '对局结算',
      onlineSummaryDesc: '在线对局结束。',
      onlineSummaryPlayer: '玩家',
      onlineSummaryScore: '分数',
      onlineSummaryKills: '击杀',
      onlineSummarySurvive: '存活时间',
      onlineSummaryTotalScore: '队伍总分',
      onlineSummaryTotalKills: '队伍总击杀',
      onlineSummaryMatchTime: '对局时长',
      returnToRoom: '返回房间',
      mainMenu: '主菜单',
    }
  };

  const online = {
    state: 'idle',
    connected: false,
    connecting: false,
    started: false,
    ws: null,
    clientId: null,
    serverUrl: ONLINE_DEFAULT_WS,
    roomId: null,
    rooms: [],
    roomState: null,
    countdownEndsAt: null,
    peers: {},
    worldSeed: null,
    gameMode: 'single',
    sendTimer: 0,
    lastSnapshotAt: 0,
    pendingSnapshot: null,
    lastServerHp: null,
    syncedProjectiles: [],
    syncedShotFx: [],
    syncedFlameFx: [],
    remoteParticles: [],
    seenEffectIds: new Set(),
    seenBloodIds: new Set(),
    seenSoundIds: new Set(),
    spectating: false,
    spectateTargetId: null,
    selfAlive: true,
    matchSummary: null,
    matchOverMessage: '',
    localStateSeq: 0,
    lastAckInputSeq: 0,
    matchStartAt: 0,
    desiredConnected: false,
    manualDisconnect: false,
    reconnectTimer: null,
    reconnectAt: 0,
    reconnectAttempts: 0,
    serverInfo: {
      activeClients: 0,
      queueLength: 0,
      maxClients: 60,
      status: 'idle',
      queued: false,
      queuePosition: 0,
    },
  };
  window.deadtownOnline = online;

  function ot(){ return ONLINE_T[lang] || ONLINE_T.en; }
  function onlineIsMode(){ return online.gameMode === 'online'; }
  function onlineStatusText(){
    const t = ot();
    if(online.state === 'connecting') return t.statusConnecting;
    if(online.state === 'connected') return t.statusConnected;
    if(online.state === 'error') return t.statusError;
    return t.statusIdle;
  }
  function onlinePersistUrl(v){ online.serverUrl = String(v || '').trim(); localStorage.setItem('deadtown_online_server_url', online.serverUrl); }
  function onlineClearReconnectTimer(){
    if(online.reconnectTimer){
      clearTimeout(online.reconnectTimer);
      online.reconnectTimer = null;
    }
    online.reconnectAt = 0;
  }
  function onlineReconnectSeconds(){
    if(!online.reconnectAt) return 0;
    return Math.max(0, Math.ceil((online.reconnectAt - Date.now()) / 1000));
  }
  function onlineAutoStatusText(){
    const t = ot();
    const retryIn = onlineReconnectSeconds();
    if(online.connected) return t.statusConnected;
    if(online.connecting) return t.statusConnecting;
    if(retryIn > 0) return `${t.onlineReconnectIn} ${retryIn}s`;
    if(online.state === 'error' && online.desiredConnected) return t.onlineReconnectNow;
    return t.statusIdle;
  }
  function onlineServerStatusText(){
    const t = ot();
    const status = online.serverInfo?.status || 'idle';
    if(status === 'full') return t.onlineStatusFull;
    if(status === 'busy') return t.onlineStatusBusy;
    return t.onlineStatusIdle;
  }
  function onlineServerStatusColor(){
    const status = online.serverInfo?.status || 'idle';
    if(status === 'full') return '#ff6767';
    if(status === 'busy') return '#f0c36b';
    return '#59c36a';
  }
  function onlineUpdateServerInfo(info){
    if(!info) return;
    online.serverInfo = Object.assign({}, online.serverInfo || {}, info);
  }
  function onlineScheduleReconnect(delayMs){
    if(online.reconnectTimer || online.connected || online.connecting) return;
    if(!online.desiredConnected || !online.serverUrl) return;
    online.reconnectAt = Date.now() + delayMs;
    online.reconnectTimer = setTimeout(()=>{
      online.reconnectTimer = null;
      online.reconnectAt = 0;
      if(online.desiredConnected) onlineConnect();
    }, delayMs);
  }
  function onlineEnsureConnected(){
    if(!online.desiredConnected) return;
    if(online.connected || online.connecting) return;
    onlineConnect();
  }
  function onlineSend(data){ if(online.ws && online.ws.readyState === 1) online.ws.send(JSON.stringify(data)); }
  function onlineSendAction(action){ if(online.connected && online.started) onlineSend({ type:'player_action', action }); }
  function onlineSendDevCommand(command, extra={}){
    if(!(online.connected && online.started && onlineIsMode() && state.devMode)) return false;
    onlineSend(Object.assign({ type:'dev_command', command }, extra));
    return true;
  }

  function bindOnlineDevButtons(){
    const setup = [
      ['devShotgunBtn', ()=>onlineSendDevCommand('set_weapon', { weapon:'shotgun' })],
      ['devGatlingBtn', ()=>onlineSendDevCommand('set_weapon', { weapon:'gatling' })],
      ['devRocketBtn', ()=>onlineSendDevCommand('set_weapon', { weapon:'rocket' })],
      ['devFlameBtn', ()=>onlineSendDevCommand('set_weapon', { weapon:'flamethrower' })],
      ['devHealBtn', ()=>onlineSendDevCommand('heal')],
      ['devThrowablesBtn', ()=>onlineSendDevCommand('throwables')],
      ['devChargerBtn', ()=>onlineSendDevCommand('spawn_charger')],
      ['devBossBtn', ()=>onlineSendDevCommand('spawn_boss')],
      ['devBloaterBtn', ()=>onlineSendDevCommand('spawn_bloater')],
    ];
    for(const [id, fn] of setup){
      const el = $(id);
      if(!el || el.dataset.onlineDevBound) continue;
      el.dataset.onlineDevBound = '1';
      el.addEventListener('click', (ev)=>{
        if(!(online.connected && online.started && onlineIsMode() && state.devMode)) return;
        ev.preventDefault();
        ev.stopImmediatePropagation();
        fn();
      }, true);
    }
  }

  const __origLoadLeaderboard = loadLeaderboard;
  loadLeaderboard = async function(force=false){ if(onlineIsMode()) return; return __origLoadLeaderboard(force); };
  const __origSyncPlayerBest = syncPlayerBest;
  syncPlayerBest = async function(){ if(onlineIsMode()) return; return __origSyncPlayerBest(); };
  const __origSubmitLeaderboardScore = submitLeaderboardScore;
  submitLeaderboardScore = async function(score){ if(onlineIsMode()) return; return __origSubmitLeaderboardScore(score); };

  function makeSeededRng(seed){ let s=(seed>>>0)||123456789; return function(){ s=(1664525*s+1013904223)>>>0; return s/4294967296; }; }
  const __origGenerateWorld = generateWorld;
  generateWorld = function(){
    if(onlineIsMode() && Number.isInteger(online.worldSeed)){
      const seeded = makeSeededRng(online.worldSeed);
      const prevRand = Math.random;
      Math.random = seeded;
      try{ return __origGenerateWorld(); }
      finally{ Math.random = prevRand; }
    }
    return __origGenerateWorld();
  };

  function onlineResetState(keepConnection=false){
    online.roomId = null;
    online.roomState = null;
    online.peers = {};
    online.started = false;
    online.worldSeed = null;
    online.sendTimer = 0;
    online.lastSnapshotAt = 0;
    online.pendingSnapshot = null;
    online.lastServerHp = null;
    online.localStateSeq = 0;
    online.lastAckInputSeq = 0;
    online.matchStartAt = 0;
    online.syncedProjectiles = [];
    online.syncedShotFx = [];
    online.syncedFlameFx = [];
    online.seenEffectIds = new Set();
    online.seenBloodIds = new Set();
    online.seenSoundIds = new Set();
    online.spectating = false;
    online.spectateTargetId = null;
    online.selfAlive = true;
    online.serverInfo = Object.assign({}, online.serverInfo || {}, { queued: false, queuePosition: 0 });
    if(!keepConnection){
      online.connected = false;
      online.connecting = false;
      online.clientId = null;
      online.state = 'idle';
    }
  }

  function onlineDisconnect(silent=false, manual=true){
    online.manualDisconnect = manual;
    if(manual) online.desiredConnected = false;
    onlineClearReconnectTimer();
    if(online.ws){
      try{ online.ws.onclose = null; online.ws.close(); }catch(err){}
      online.ws = null;
    }
    onlineResetState(true);
    online.connected = false;
    online.connecting = false;
    online.state = 'idle';
    if(!silent) pushOnlineNotice(ot().onlineDisconnected, 'warn');
  }

  function onlineConnect(){
    if(online.connected || online.connecting) return;
    if(!state.playerName){ pushOnlineNotice(ot().onlineNeedName, 'warn'); return; }
    if(!online.serverUrl){ return; }
    online.manualDisconnect = false;
    online.connecting = true;
    online.state = 'connecting';
    onlineClearReconnectTimer();
    if(state.overlayScreen === 'online-lobby') renderOnlineLobby();
    try{
      const ws = new WebSocket(online.serverUrl);
      online.ws = ws;
      ws.onopen = ()=>{
        online.connecting = false;
        online.connected = true;
        online.state = 'connected';
        online.reconnectAttempts = 0;
        onlineClearReconnectTimer();
        onlineSend({ type:'hello', name:state.playerName, version:'dt-online-p0', lang });
        onlineSend({ type:'list_rooms' });
        if(state.overlayScreen === 'online-lobby') renderOnlineLobby();
      };
      ws.onmessage = (ev)=>{
        let msg = null;
        try{ msg = JSON.parse(ev.data); }catch(err){ return; }
        handleOnlineMessage(msg);
      };
      ws.onerror = ()=>{ online.state = 'error'; if(state.overlayScreen === 'online-lobby') renderOnlineLobby(); };
      ws.onclose = ()=>{
        const wasOnlineMatch = state.running && !state.gameOver && onlineIsMode();
        const shouldRetry = online.desiredConnected && !online.manualDisconnect;
        onlineResetState(true);
        online.connected = false;
        online.connecting = false;
        online.state = shouldRetry ? 'error' : 'idle';
        if(wasOnlineMatch){
          pushOnlineNotice(ot().onlineDisconnected, 'error');
          if(state.running) goToMainMenu();
        }
        if(state.overlayScreen === 'online-lobby' || state.overlayScreen === 'online-room' || state.overlayScreen==='online-summary'){
          renderOnlineLobby();
        }
        if(shouldRetry){
          online.reconnectAttempts = Math.min((online.reconnectAttempts || 0) + 1, 10);
          const delay = Math.min(1000 * Math.max(1, online.reconnectAttempts), 5000);
          onlineScheduleReconnect(delay);
        }
        online.manualDisconnect = false;
      };
    }catch(err){
      online.connecting = false;
      online.connected = false;
      online.state = 'error';
      if(state.overlayScreen === 'online-lobby') renderOnlineLobby();
      if(online.desiredConnected) onlineScheduleReconnect(1500);
    }
  }

  function mapBuffAnnouncement(buff){
    if(buff === 'damage') return T[lang].serumDamage;
    if(buff === 'speed') return T[lang].serumSpeed;
    if(buff === 'health') return T[lang].serumHealth;
    return '';
  }


  function onlineAudioListenerPos(){
    const target = onlineSpectateTarget();
    if(target && online.spectating) return { x: target.displayX ?? target.x ?? player.x, y: target.displayY ?? target.y ?? player.y };
    return { x: player.x, y: player.y };
  }

  function onlineShouldHearFx(x, y, maxDistance = 950){
    if(!Number.isFinite(x) || !Number.isFinite(y)) return true;
    const listener = onlineAudioListenerPos();
    return dist(listener.x, listener.y, x, y) <= maxDistance;
  }

  function playOnlineSoundFx(fx, selfId){
    if(!fx || fx.id == null) return;
    if(online.seenSoundIds.has(fx.id)) return;
    online.seenSoundIds.add(fx.id);
    if((fx.kind === 'shot' || fx.kind === 'dash') && fx.ownerId && fx.ownerId === selfId) return;
    if(!onlineShouldHearFx(fx.x, fx.y, fx.kind === 'shot' ? 1100 : 900)) return;
    if(fx.kind === 'shot') playShot(fx.weapon || 'shotgun');
    else if(fx.kind === 'hit' || fx.kind === 'player_hit') playHit();
    else if(fx.kind === 'pickup') playPickup();
    else if(fx.kind === 'dash') playDash();
    else if(fx.kind === 'gore') playGore();
    else if(fx.kind === 'boom') playBoom();
  }

  function reconcileOnlineBloodFx(bloodFx, selfId){
    const activeIds = new Set();
    for(const fx of (bloodFx || [])){
      if(!fx || fx.id == null) continue;
      activeIds.add(fx.id);
      if(online.seenBloodIds.has(fx.id)) continue;
      online.seenBloodIds.add(fx.id);
      if(fx.targetId && fx.targetId === selfId) continue;
      blood(fx.x, fx.y, fx.count || 8, fx.color || 'rgba(120,15,15,0.95)', fx.force || 1);
    }
    for(const seenId of Array.from(online.seenBloodIds)){
      if(!activeIds.has(seenId)) online.seenBloodIds.delete(seenId);
    }
  }

  function reconcileOnlineSoundFx(soundFx, selfId){
    const activeIds = new Set();
    for(const fx of (soundFx || [])){
      if(!fx || fx.id == null) continue;
      activeIds.add(fx.id);
      playOnlineSoundFx(fx, selfId);
    }
    for(const seenId of Array.from(online.seenSoundIds)){
      if(!activeIds.has(seenId)) online.seenSoundIds.delete(seenId);
    }
  }

  function onlineAlivePeers(){
    return Object.values(online.peers).filter(p=>p && p.alive && (p.hp||0) > 0);
  }

  function onlinePickSpectateTarget(){
    if(!online.spectating){
      online.spectateTargetId = null;
      return;
    }
    const alivePeers = onlineAlivePeers();
    if(!alivePeers.length){
      online.spectateTargetId = null;
      return;
    }
    if(online.spectateTargetId && online.peers[online.spectateTargetId] && online.peers[online.spectateTargetId].alive && (online.peers[online.spectateTargetId].hp||0) > 0) return;
    online.spectateTargetId = alivePeers[0].id;
  }

  function onlineSpectateTarget(){
    if(!online.spectating) return null;
    onlinePickSpectateTarget();
    return online.spectateTargetId ? (online.peers[online.spectateTargetId] || null) : null;
  }

  function onlineSetSpectating(next){
    online.spectating = !!next;
    if(!online.spectating){
      online.spectateTargetId = null;
      online.selfAlive = true;
      updateCursorVisibility();
      return;
    }
    state.paused = false;
    mouseDown = false;
    if(typeof touchState === 'object' && touchState) touchState.shootHeld = false;
    onlinePickSpectateTarget();
    updateCursorVisibility();
  }

  function applySelfFromServer(self){
    if(!self) return;
    const prevHp = online.lastServerHp == null ? player.hp : online.lastServerHp;
    const wasAlive = online.selfAlive !== false;
    online.selfAlive = !!self.alive && (self.hp||0) > 0;
    const dx = self.x - player.x;
    const dy = self.y - player.y;
    const error = Math.hypot(dx, dy);
    const serverKnockback = (self.knockbackTime||0) > 0.02;
    const carriedByCharger = !!self.carryingByCharger;
    const serverZombiePush = (self.zombiePushTime||0) > 0.02;
    const inBurstMove = (player.dashTime||0) > 0 || (player.rocketJumpTime||0) > 0 || (player.knockbackTime||0) > 0;
    const ackSeq = Number(self.inputSeq || 0);
    if(ackSeq > online.lastAckInputSeq) online.lastAckInputSeq = ackSeq;
    const pendingInputs = Math.max(0, (online.localStateSeq || 0) - (online.lastAckInputSeq || 0));
    const startupGrace = online.matchStartAt > 0 && (performance.now() - online.matchStartAt) < 700;
    const staleSnapshot = pendingInputs > 2;
    if(!state.running || error > 120 || carriedByCharger || serverKnockback){
      player.x = self.x;
      player.y = self.y;
    }else if(serverZombiePush){
      if(error > 72){
        player.x = self.x;
        player.y = self.y;
      }else if(error > 8){
        player.x += dx * 0.22;
        player.y += dy * 0.22;
      }
    }else if(!(startupGrace || staleSnapshot) && !inBurstMove && error > 18){
      player.x += dx * 0.10;
      player.y += dy * 0.10;
    }
    player.zombiePushTime = Math.max(player.zombiePushTime||0, self.zombiePushTime||0);
    player.hp = self.hp;
    player.maxHp = self.maxHp;
    player.faceDir = self.faceDir || player.faceDir || 1;
    player.weapon = self.weapon || player.weapon;
    player.mag = self.mag ?? player.mag;
    player.magSize = self.magSize ?? player.magSize;
    player.grenades = self.grenades ?? player.grenades;
    player.molotovs = self.molotovs ?? player.molotovs;
    player.gatlingAmmo = self.gatlingAmmo ?? player.gatlingAmmo;
    player.rocketAmmo = self.rocketAmmo ?? player.rocketAmmo;
    player.flameAmmo = self.flameAmmo ?? player.flameAmmo;
    player.speedMul = self.speedMul ?? player.speedMul;
    player.damageMul = self.damageMul ?? player.damageMul;
    if(Number.isFinite(self.appearanceIndex)) player.onlineAppearanceIndex = self.appearanceIndex;
    player.score = self.score ?? player.score ?? state.score ?? 0;
    player.kills = self.kills ?? player.kills ?? state.kills ?? 0;
    if((self.rocketJumpTime||0) > 0.02 && (player.rocketJumpTime||0) <= 0.02){
      player.rocketJumpTime = self.rocketJumpTime || 0;
      player.rocketJumpVX = self.rocketJumpVX || 0;
      player.rocketJumpVY = self.rocketJumpVY || 0;
      player.dashTime = 0;
      player.dashVX = 0;
      player.dashVY = 0;
      player.knockbackTime = 0;
      player.knockbackVX = 0;
      player.knockbackVY = 0;
      if(player.rocketJumpVX < 0) player.faceDir = -1; else if(player.rocketJumpVX > 0) player.faceDir = 1;
      state.cameraShake = Math.max(state.cameraShake, 8);
      state.screenFlash = Math.max(state.screenFlash, 0.26);
    }
    if((self.knockbackTime||0) > 0.02){
      player.knockbackTime = self.knockbackTime || 0;
      player.knockbackVX = self.knockbackVX || 0;
      player.knockbackVY = self.knockbackVY || 0;
      player.rocketJumpTime = 0;
      player.rocketJumpVX = 0;
      player.rocketJumpVY = 0;
      player.dashTime = 0;
      player.dashVX = 0;
      player.dashVY = 0;
      if(player.knockbackVX < 0) player.faceDir = -1; else if(player.knockbackVX > 0) player.faceDir = 1;
    }
    if(prevHp > self.hp){
      addDamageText(player.x+rand(-8,8), player.y-player.radius-10, prevHp-self.hp, '#ff6767');
      state.cameraShake = Math.max(state.cameraShake, 1.8);
      state.screenFlash = Math.max(state.screenFlash, 0.14);
      blood(player.x, player.y, 8, 'rgba(150,24,24,0.8)', 0.8);
    }
    if(self.buffAnnouncement && self.buffAnnouncementTimer > 0){
      state.buffAnnouncement = mapBuffAnnouncement(self.buffAnnouncement);
      state.buffAnnouncementTimer = self.buffAnnouncementTimer;
    }
    if(wasAlive && !online.selfAlive){
      pushOnlineNotice(lang==='zh' ? '你已倒下，正在观战队友。' : 'You are down. Spectating your teammate.', 'warn', 2600);
      onlineSetSpectating(true);
    }else if(!wasAlive && online.selfAlive){
      onlineSetSpectating(false);
    online.matchSummary = null;
    online.matchOverMessage = '';
    }
    online.lastServerHp = self.hp;
  }

  function mergeOnlinePeer(prevPeer, nextPeer, now){
    if(!prevPeer){
      return Object.assign({}, nextPeer, {
        targetX: nextPeer.x || 0,
        targetY: nextPeer.y || 0,
        displayX: nextPeer.x || 0,
        displayY: nextPeer.y || 0,
        vx: 0,
        vy: 0,
        lastSeen: now,
      });
    }
    const snapDt = Math.max(0.016, Math.min(0.25, (now - (prevPeer.lastSeen || now)) / 1000));
    const prevTargetX = prevPeer.targetX ?? prevPeer.x ?? nextPeer.x ?? 0;
    const prevTargetY = prevPeer.targetY ?? prevPeer.y ?? nextPeer.y ?? 0;
    const vx = ((nextPeer.x || 0) - prevTargetX) / snapDt;
    const vy = ((nextPeer.y || 0) - prevTargetY) / snapDt;
    return Object.assign({}, prevPeer, nextPeer, {
      targetX: nextPeer.x || 0,
      targetY: nextPeer.y || 0,
      displayX: Number.isFinite(prevPeer.displayX) ? prevPeer.displayX : (nextPeer.x || 0),
      displayY: Number.isFinite(prevPeer.displayY) ? prevPeer.displayY : (nextPeer.y || 0),
      vx,
      vy,
      lastSeen: now,
    });
  }

  function mergeOnlineProjectile(_prevProjectile, nextProjectile){
    return Object.assign({}, nextProjectile);
  }


  function spawnOnlineEffectParticles(effect, selfId){
    if(!effect || effect.ownerId === selfId) return;
    if(effect.molotov){
      for(let k=0;k<46;k++){
        const a=Math.random()*Math.PI*2,s=rand(40,220),life=rand(0.35,0.9);
        online.remoteParticles.push({x:effect.x,y:effect.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-rand(20,80),life,maxLife:life,size:rand(3,8),color:Math.random()>0.45?'rgba(255,210,70,0.95)':'rgba(255,120,30,0.85)',drag:0.93});
      }
      for(let k=0;k<24;k++){
        const life=rand(0.8,1.8);
        online.remoteParticles.push({x:effect.x+rand(-12,12),y:effect.y+rand(-8,8),vx:rand(-20,20),vy:rand(-65,-20),life,maxLife:life,size:rand(8,18),color:'rgba(70,70,70,0.32)',drag:0.97,floaty:true});
      }
      return;
    }
    if(effect.bloaterBurst){
      for(let i=0;i<18;i++){
        const a=Math.random()*Math.PI*2,s=rand(40,180);
        online.remoteParticles.push({x:effect.x,y:effect.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-rand(10,40),life:rand(0.18,0.38),maxLife:0.38,size:rand(2,5),color:Math.random()>0.45?'rgba(140,210,90,0.75)':'rgba(110,160,70,0.6)',drag:0.93});
      }
      return;
    }
    const rocket = !!effect.rocket;
    for(let k=0;k<(rocket?42:26);k++){
      const a=Math.random()*Math.PI*2,s=rand(70,rocket?340:260);
      online.remoteParticles.push({x:effect.x,y:effect.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rocket?rand(0.35,0.6):0.35,maxLife:rocket?0.6:0.35,size:rand(2,rocket?6:5),color:Math.random()>0.45?'rgba(255,150,60,0.95)':'rgba(80,80,80,0.65)'});
    }
    for(let k=0;k<22;k++){
      const a=Math.random()*Math.PI*2,s=rand(20,95);
      const life=rand(0.65,1.2);
      online.remoteParticles.push({x:effect.x+rand(-8,8),y:effect.y+rand(-8,8),vx:Math.cos(a)*s,vy:Math.sin(a)*s-rand(10,45),life,maxLife:life,size:rand(6,12),color:'rgba(70,70,70,0.55)'});
    }
    for(let k=0;k<36;k++){
      const a=Math.random()*Math.PI*2,s=rand(10,55);
      const life=rand(0.9,1.8);
      online.remoteParticles.push({x:effect.x+rand(-10,10),y:effect.y+rand(-10,10),vx:Math.cos(a)*s,vy:Math.sin(a)*s-rand(22,70),life,maxLife:life,size:rand(8,18),color:Math.random()>0.5?'rgba(65,65,65,0.58)':'rgba(110,110,110,0.32)',drag:0.965,floaty:true});
    }
    for(let k=0;k<18;k++){
      const life=rand(1.2,2.1);
      online.remoteParticles.push({x:effect.x+rand(-14,14),y:effect.y+rand(-10,10),vx:rand(-18,18),vy:rand(-55,-22),life,maxLife:life,size:rand(10,22),color:'rgba(58,58,58,0.26)',drag:0.975,floaty:true});
    }
    blood(effect.x,effect.y,20,'rgba(180,60,24,0.95)',1.5);
  }

  function reconcileOnlineEffects(effects, selfId){
    const activeIds = new Set();
    for(const effect of (effects || [])){
      if(!effect || effect.id == null) continue;
      activeIds.add(effect.id);
      if(!online.seenEffectIds.has(effect.id)){
        online.seenEffectIds.add(effect.id);
        spawnOnlineEffectParticles(effect, selfId);
      }
    }
    for(const seenId of Array.from(online.seenEffectIds)){
      if(!activeIds.has(seenId)) online.seenEffectIds.delete(seenId);
    }
  }

  function onlineApplySnapshot(msg){
    const now = performance.now();
    online.lastSnapshotAt = now;
    online.roomState = msg.room || online.roomState;
    online.roomId = online.roomState?.roomId || online.roomId;
    const selfId = msg.selfId || online.clientId;
    const nextPeers = {};
    let self = null;
    for(const p of (msg.players || [])){
      if(!p) continue;
      if(p.id === selfId){ self = p; continue; }
      nextPeers[p.id] = mergeOnlinePeer(online.peers[p.id], p, now);
    }
    online.peers = nextPeers;
    onlinePickSpectateTarget();
    if(self) applySelfFromServer(self);
    const match = msg.match || {};
    state.wave = match.wave ?? state.wave;
    state.surviveTime = match.surviveTime ?? state.surviveTime;
    state.kills = self?.kills ?? state.kills;
    state.score = self?.score ?? state.score;
    state.bossAnnouncement = Math.max(state.bossAnnouncement, match.bossAnnouncement || 0);
    state.airdropAnnouncement = Math.max(state.airdropAnnouncement, match.airdropAnnouncement || 0);
    state.zombies = Array.isArray(match.zombies) ? match.zombies.map(z=>Object.assign({}, z)) : [];
    state.pickups = Array.isArray(match.pickups) ? match.pickups.map(p=>Object.assign({}, p)) : [];
    state.airdrops = Array.isArray(match.airdrops) ? match.airdrops.map(a=>Object.assign({}, a)) : [];
    state.fireZones = Array.isArray(match.fireZones) ? match.fireZones.map(z=>Object.assign({}, z)) : [];
    state.explosions = Array.isArray(match.effects) ? match.effects.map(e=>Object.assign({}, e)) : [];
    reconcileOnlineEffects(match.effects, selfId);
    reconcileOnlineBloodFx(match.bloodFx, selfId);
    reconcileOnlineSoundFx(match.soundFx, selfId);
    online.syncedProjectiles = Array.isArray(match.projectiles)
      ? match.projectiles.filter(p=>p && p.ownerId !== selfId).map(p=>mergeOnlineProjectile(null, p))
      : [];
    online.syncedShotFx = Array.isArray(match.shotFx) ? match.shotFx.map(fx=>Object.assign({}, fx)) : [];
    online.syncedFlameFx = Array.isArray(match.flameFx) ? match.flameFx.map(fx=>Object.assign({}, fx)) : [];
    state.damageTexts = Array.isArray(match.damageTexts) ? match.damageTexts.map(t=>Object.assign({}, t)) : [];
    updateHUD();
  }

  function handleOnlineMessage(msg){
    if(msg.type === 'welcome'){ online.clientId = msg.clientId; onlineUpdateServerInfo(msg.server || msg.serverInfo); return; }
    if(msg.type === 'server_status'){
      onlineUpdateServerInfo(msg.server || msg.serverInfo);
      if(state.overlayScreen === 'online-lobby') renderOnlineLobby();
      return;
    }
    if(msg.type === 'queue_status'){
      onlineUpdateServerInfo(Object.assign({}, msg.server || msg.serverInfo || {}, { queued: true, queuePosition: msg.position || 0 }));
      if(state.overlayScreen === 'online-lobby') renderOnlineLobby();
      return;
    }
    if(msg.type === 'queue_promoted'){
      onlineUpdateServerInfo(Object.assign({}, msg.server || msg.serverInfo || {}, { queued: false, queuePosition: 0 }));
      pushOnlineNotice(lang==='zh' ? '已从排队进入服务器。' : 'You reached the server.', 'info');
      return;
    }
    if(msg.type === 'room_list'){
      online.rooms = Array.isArray(msg.rooms) ? msg.rooms : [];
      onlineUpdateServerInfo(msg.server || msg.serverInfo);
      if(state.overlayScreen === 'online-lobby') renderOnlineLobby();
      return;
    }
    if(msg.type === 'room_joined' || msg.type === 'room_update'){
      onlineUpdateServerInfo(msg.server || msg.serverInfo);
      online.roomState = msg.room || null;
      online.roomId = online.roomState?.roomId || null;
      online.countdownEndsAt = online.roomState?.countdownEndsAt || null;
      if(state.overlayScreen === 'online-lobby' || state.overlayScreen === 'online-room') renderOnlineRoom();
      return;
    }
    if(msg.type === 'left_room'){
      onlineUpdateServerInfo(msg.server || msg.serverInfo);
      online.roomId = null;
      online.roomState = null;
      online.peers = {};
      online.started = false;
      online.worldSeed = null;
      online.countdownEndsAt = null;
      online.syncedProjectiles = [];
      online.syncedShotFx = [];
      online.syncedFlameFx = [];
      online.remoteParticles = [];
      online.seenEffectIds = new Set();
    online.seenBloodIds = new Set();
    online.seenSoundIds = new Set();
      renderOnlineLobby();
      return;
    }
    if(msg.type === 'match_started'){
      online.roomState = msg.room || online.roomState;
      online.roomId = online.roomState?.roomId || online.roomId;
      online.started = true;
      online.gameMode = 'online';
      onlineSetSpectating(false);
      online.worldSeed = Number.isInteger(msg.worldSeed) ? msg.worldSeed : 12345;
      online.localStateSeq = 0;
      online.lastAckInputSeq = 0;
      online.matchStartAt = performance.now();
      pushOnlineNotice(ot().onlineStartInfo, 'info');
      resetGame();
      state.pellets = [];
      state.rockets = [];
      state.flameParticles = [];
      state.grenades = [];
      state.explosions = [];
      state.fireZones = [];
      online.remoteParticles = [];
      online.seenEffectIds = new Set();
    online.seenBloodIds = new Set();
    online.seenSoundIds = new Set();
      return;
    }
    if(msg.type === 'room_closed'){
      online.roomId = null;
      online.roomState = null;
      online.peers = {};
      online.started = false;
      online.worldSeed = null;
      online.countdownEndsAt = null;
      online.syncedProjectiles = [];
      online.syncedShotFx = [];
      online.syncedFlameFx = [];
      online.remoteParticles = [];
      online.seenEffectIds = new Set();
    online.seenBloodIds = new Set();
    online.seenSoundIds = new Set();
      online.gameMode = 'single';
      const rawMessage = String(msg.message || '');
      const hostNameMatch = rawMessage.match(/^(.*?)\s(?:disconnected\.|closed the room\.)/i);
      const hostName = hostNameMatch && hostNameMatch[1] ? hostNameMatch[1].trim() : '';
      const closeText = hostName
        ? (lang==='zh' ? `[房主] ${hostName} 已退出房间，房间已被关闭。` : `[Host] ${hostName} left the room. The room has been closed.`)
        : (lang==='zh' ? '[房主] 已退出房间，房间已被关闭。' : '[Host] left the room. The room has been closed.');
      pushOnlineNotice(closeText, 'warn', 4600);
      goToMainMenu();
      return;
    }
    if(msg.type === 'player_left'){
      if(msg.playerId) delete online.peers[msg.playerId];
      const playerLabel = msg.name || (lang==='zh' ? '玩家' : 'A player');
      const leaveText = online.started
        ? (lang==='zh' ? `${playerLabel} 已退出对局。` : `${playerLabel} left the match.`)
        : (lang==='zh' ? `${playerLabel} 已退出房间。` : `${playerLabel} left the room.`);
      pushOnlineNotice(leaveText, 'info');
      return;
    }
    if(msg.type === 'player_down'){
      if(msg.playerId && msg.playerId !== online.clientId){
        const playerLabel = msg.name || (lang==='zh' ? '队友' : 'A teammate');
        pushOnlineNotice(lang==='zh' ? `${playerLabel} 已倒下。` : `${playerLabel} is down.`, 'warn', 2200);
      }
      return;
    }
    if(msg.type === 'snapshot'){
      onlineApplySnapshot(msg);
      return;
    }
    if(msg.type === 'match_over'){
      online.started = false;
      onlineSetSpectating(false);
      online.matchSummary = msg.summary || null;
      online.matchOverMessage = msg.message || ot().onlineMatchEnded;
      online.roomState = msg.room || online.roomState;
      online.gameMode = 'online';
      state.running = false;
      state.paused = false;
      state.gameOver = false;
      mouseDown = false;
      if(typeof touchState === 'object' && touchState) touchState.shootHeld = false;
      renderOnlineMatchSummary(online.matchSummary, online.matchOverMessage);
      return;
    }
    if(msg.type === 'error'){
      pushOnlineNotice(msg.message || 'Server error', 'error');
    }
  }

  function createOnlineRoom(){
    const fallbackName = lang==='zh' ? `${state.playerName}的房间` : `${state.playerName}'s Room`;
    const name = (($('onlineRoomNameInput')?.value)||'').trim().slice(0,24) || fallbackName;
    onlineSend({ type:'create_room', roomName:name });
  }
  function joinOnlineRoom(id){ onlineSend({ type:'join_room', roomId:id }); }
  function leaveOnlineRoom(){ onlineSend({ type:'leave_room' }); }
  function toggleOnlineReady(){ onlineSend({ type:'toggle_ready' }); }
  function startOnlineMatch(){ onlineSend({ type:'start_match' }); }
  function refreshOnlineRooms(){ onlineSend({ type:'list_rooms' }); }

  function renderOnlineLobby(){
    state.overlayScreen = 'online-lobby';
    online.desiredConnected = true;
    const t = ot();
    $('overlayCard').className = 'card';
    const roomsMarkup = online.rooms.length ? online.rooms.map(room=>{
      const disabled = !online.connected || online.serverInfo?.queued || room.started || room.playerCount>=room.maxPlayers;
      const joinLabel = room.started ? t.inGame : (room.playerCount>=room.maxPlayers ? 'Full' : t.join);
      return `<div style="display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:10px 12px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);margin-top:8px;"><div><div class="accent" style="font-size:16px;">${escapeHtml(room.roomName)}</div><div style="opacity:0.75;font-size:13px;">${t.onlineRoomOwner}: ${escapeHtml(room.hostName)} · ${t.players}: ${room.playerCount}/${room.maxPlayers} · ${room.started?t.onlineStateStarted:t.onlineStateWaiting}</div></div><div><button data-join-room="${escapeHtml(room.roomId)}" ${disabled?'disabled':''}>${joinLabel}</button></div></div>`;
    }).join('') : `<p style="opacity:0.72;">${t.noRooms}</p>`;
    $('overlayCard').innerHTML = `
      <h2>${t.onlineTitle}</h2>
      <p>${t.onlineDesc}</p>
      <p class="compactNote"><span class="accent">${t.onlineNoLeaderboard}</span></p>
      <div style="text-align:left;margin:14px 0;padding:12px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;flex:1;">
            <div>
              <div style="opacity:0.72;font-size:13px;margin-bottom:4px;">${t.onlineConnection}</div>
              <div class="accent" style="font-size:18px;">${onlineAutoStatusText()}</div>
            </div>
            <div>
              <div style="opacity:0.72;font-size:13px;margin-bottom:4px;">${t.onlineServerStatus}</div>
              <div style="font-size:18px;color:${onlineServerStatusColor()};font-weight:bold;">${onlineServerStatusText()}</div>
              <div style="opacity:0.72;font-size:12px;margin-top:4px;">${online.serverInfo.activeClients||0}/${online.serverInfo.maxClients||60}${online.serverInfo.queueLength?` · ${t.onlineQueueLabel}: ${online.serverInfo.queueLength}`:''}</div>
            </div>
            ${online.serverInfo.queued ? `<div>
              <div style="opacity:0.72;font-size:13px;margin-bottom:4px;">${t.onlineQueueLabel}</div>
              <div class="accent" style="font-size:18px;">${t.onlineQueuedAt} #${online.serverInfo.queuePosition||1}</div>
              <div style="opacity:0.72;font-size:12px;margin-top:4px;">${Math.max(0,(online.serverInfo.queuePosition||1)-1)} ${t.onlineQueuedSuffix}</div>
            </div>` : ''}
          </div>
          <button id="onlineBackBtn">${t.back}</button>
        </div>
      </div>
      <div style="text-align:left;margin:14px 0;padding:12px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);">
        <label style="display:block;opacity:0.75;margin-bottom:6px;">${t.roomName}</label>
        <input id="onlineRoomNameInput" placeholder="${escapeHtml(t.onlineRoomNameFallback)}" style="width:100%;padding:10px 12px;background:#141111;border:1px solid rgba(255,255,255,0.14);color:#f0e6d8;font:inherit;">
        <div class="controls" style="justify-content:center;flex-wrap:wrap;margin-top:12px;">
          <button id="onlineCreateBtn" ${(!online.connected || online.serverInfo?.queued)?'disabled':''}>${t.createRoom}</button>
          <button id="onlineRefreshBtn" ${!online.connected?'disabled':''}>${t.refresh}</button>
        </div>
      </div>
      <div style="text-align:left;max-height:min(42vh, 360px);overflow-y:auto;padding-right:6px;">${roomsMarkup}</div>
    `;
    $('overlay').classList.remove('hidden');
    setTimeout(()=>{
      const back = $('onlineBackBtn'); if(back) back.onclick = ()=>{ onlineDisconnect(true, true); state.menuScreen='main'; online.gameMode='single'; applyLang(); };
      const create = $('onlineCreateBtn'); if(create) create.onclick = ()=>createOnlineRoom();
      const refresh = $('onlineRefreshBtn'); if(refresh) refresh.onclick = ()=>refreshOnlineRooms();
      document.querySelectorAll('[data-join-room]').forEach(btn=>btn.onclick = ()=>joinOnlineRoom(btn.getAttribute('data-join-room')));
      onlineEnsureConnected();
    },0);
  }

  function renderOnlineRoom(){
    state.overlayScreen = 'online-room';
    online.desiredConnected = true;
    const t = ot();
    const room = online.roomState;
    if(!room){ renderOnlineLobby(); return; }
    const me = (room.players||[]).find(p=>p.id===online.clientId) || null;
    const meReady = !!me?.ready;
    const isHost = online.clientId === room.hostId;
    const countdownLeft = room.countdownEndsAt ? Math.max(0, Math.ceil((room.countdownEndsAt - Date.now())/1000)) : 0;
    const playersMarkup = (room.players||[]).map(p=>`<div style="display:flex;justify-content:space-between;gap:10px;padding:8px 10px;border-top:1px solid rgba(255,255,255,0.08);"><span>${escapeHtml(p.name)} ${p.id===room.hostId?`<span class="accent">(${t.host})</span>`:''}</span><span style="opacity:0.72;">${room.started?t.inGame:(p.ready?t.readyStatus:t.unreadyStatus)}</span></div>`).join('');
    $('overlayCard').className='card';
    $('overlayCard').innerHTML = `
      <div class="accent" style="font-size:32px;font-weight:bold;line-height:1.15;margin-bottom:12px;">${escapeHtml(room.roomName)}</div>
      <p style="opacity:0.75;">${t.onlineRoomOwner}: <span class="accent">${escapeHtml(room.hostName)}</span></p>
      <p style="opacity:0.75;">${t.onlinePlayersLabel}: ${room.players.length}/${room.maxPlayers}</p>
      ${room.countdownEndsAt?`<p class="accent" style="font-size:20px;letter-spacing:1px;">${t.autoStarting} ${countdownLeft}</p>`:''}
      <div style="text-align:left;margin:14px 0;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);">${playersMarkup}</div>
      <div class="controls" style="justify-content:center;flex-wrap:wrap;">
        <button id="onlineLeaveBtn">${t.leave}</button>
        <button id="onlineReadyBtn" ${room.started?'disabled':''}>${meReady?t.unready:t.ready}</button>
        ${isHost?`<button id="onlineStartBtn" ${room.started?'disabled':''}>${t.startMatch}</button>`:''}
      </div>
    `;
    $('overlay').classList.remove('hidden');
    setTimeout(()=>{
      const leave = $('onlineLeaveBtn'); if(leave) leave.onclick = ()=>leaveOnlineRoom();
      const ready = $('onlineReadyBtn'); if(ready) ready.onclick = ()=>toggleOnlineReady();
      const start = $('onlineStartBtn'); if(start) start.onclick = ()=>startOnlineMatch();
    },0);
  }

  window.joinOnlineRoom = joinOnlineRoom;

  function formatOnlineTime(seconds){
    const total = Math.max(0, Math.floor(seconds || 0));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  function renderOnlineMatchSummary(summary, message){
    const t = ot();
    const safeSummary = summary || { players: [], totalScore: 0, totalKills: 0, surviveTime: 0 };
    const players = Array.isArray(safeSummary.players) ? safeSummary.players.slice().sort((a,b)=> (b.score||0) - (a.score||0)) : [];
    state.overlayScreen = 'online-summary';
    $('overlayCard').className='card';
    const rows = players.map((p)=>`<tr><td style="padding:6px 8px;text-align:left;">${escapeHtml(p.name || 'Player')}</td><td style="padding:6px 8px;">${Math.round(p.score||0)}</td><td style="padding:6px 8px;">${Math.round(p.kills||0)}</td><td style="padding:6px 8px;">${formatOnlineTime(p.surviveTime||0)}</td></tr>`).join('');
    $('overlayCard').innerHTML = `
      <h2>${t.onlineSummaryTitle}</h2>
      <p>${escapeHtml(message || t.onlineSummaryDesc)}</p>
      <div style="margin:14px 0;padding:10px 12px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);text-align:left;">
        <div><span class="accent">${t.onlineSummaryTotalScore}:</span> ${Math.round(safeSummary.totalScore||0)}</div>
        <div style="margin-top:6px;"><span class="accent">${t.onlineSummaryTotalKills}:</span> ${Math.round(safeSummary.totalKills||0)}</div>
        <div style="margin-top:6px;"><span class="accent">${t.onlineSummaryMatchTime}:</span> ${formatOnlineTime(safeSummary.surviveTime||0)}</div>
      </div>
      <div style="max-height:340px;overflow:auto;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);">
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead>
            <tr>
              <th style="padding:8px 8px;text-align:left;">${t.onlineSummaryPlayer}</th>
              <th style="padding:8px 8px;">${t.onlineSummaryScore}</th>
              <th style="padding:8px 8px;">${t.onlineSummaryKills}</th>
              <th style="padding:8px 8px;">${t.onlineSummarySurvive}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="controls" style="justify-content:center;flex-wrap:wrap;margin-top:14px;">
        <button id="onlineSummaryRoomBtn">${t.returnToRoom}</button>
        <button id="onlineSummaryMenuBtn">${t.mainMenu}</button>
      </div>
    `;
    $('overlay').classList.remove('hidden');
    setTimeout(()=>{
      const roomBtn = $('onlineSummaryRoomBtn');
      if(roomBtn) roomBtn.onclick = ()=>renderOnlineRoom();
      const menuBtn = $('onlineSummaryMenuBtn');
      if(menuBtn) menuBtn.onclick = ()=>{ onlineDisconnect(true, true); goToMainMenu(); };
    },0);
  }

  setInterval(()=>{
    if(state.overlayScreen === 'online-room' && online.roomState && online.roomState.countdownEndsAt && !online.roomState.started){
      renderOnlineRoom();
    }else if(state.overlayScreen === 'online-lobby' && online.desiredConnected && (!online.connected || online.connecting || online.reconnectAt)){
      renderOnlineLobby();
    }
  }, 250);

  const __origRenderMainMenu = renderMainMenu;
  renderMainMenu = function(){
    __origRenderMainMenu();
    if(state.overlayScreen !== 'main') return;
    const t = ot();
    const parent = $('overlayCard');
    if(!parent) return;
    const target = parent.querySelector('.pcMenuRow.primary') || parent.querySelector('.menuActions');
    if(target && !parent.querySelector('#onlineCoopBtn')){
      const btn = document.createElement('button');
      btn.id = 'onlineCoopBtn';
      btn.textContent = t.onlineBtn;
      btn.onclick = ()=>{ online.gameMode='single'; renderOnlineLobby(); };
      const startBtn = target.querySelector('#startBtn');
      if(startBtn) startBtn.insertAdjacentElement('afterend', btn);
      else target.appendChild(btn);
    }
  };

  const __origSetWeaponLoadout = setWeaponLoadout;
  setWeaponLoadout = function(choice){
    if(onlineSendDevCommand('set_weapon', { weapon: choice })) return;
    return __origSetWeaponLoadout(choice);
  };

  const __origSpawnCharger = typeof spawnCharger === 'function' ? spawnCharger : null;
  if(__origSpawnCharger){
    spawnCharger = function(dev=false){
      if(dev && onlineSendDevCommand('spawn_charger')) return;
      return __origSpawnCharger(dev);
    };
  }

  const __origSpawnBoss = typeof spawnBoss === 'function' ? spawnBoss : null;
  if(__origSpawnBoss){
    spawnBoss = function(){
      if(onlineSendDevCommand('spawn_boss')) return;
      return __origSpawnBoss();
    };
  }

  const __origSpawnDevBloater = typeof spawnDevBloater === 'function' ? spawnDevBloater : null;
  if(__origSpawnDevBloater){
    spawnDevBloater = function(){
      if(onlineSendDevCommand('spawn_bloater')) return;
      return __origSpawnDevBloater();
    };
  }

  const __origStartGameFromMenu = startGameFromMenu;
  startGameFromMenu = function(){ online.gameMode='single'; return __origStartGameFromMenu(); };

  const __origGoToMainMenu = goToMainMenu;
  goToMainMenu = function(){
    online.started = false;
    online.worldSeed = null;
    online.peers = {};
    onlineSetSpectating(false);
    online.matchSummary = null;
    online.matchOverMessage = '';
    online.gameMode = 'single';
    online.desiredConnected = false;
    onlineClearReconnectTimer();
    return __origGoToMainMenu();
  };

  function updateOnlineRemoteVisuals(dt){
    const now = performance.now();
    for(const peer of Object.values(online.peers)){
      peer.dashTime = Math.max(0, (peer.dashTime || 0) - dt);
      peer.rocketJumpTime = Math.max(0, (peer.rocketJumpTime || 0) - dt);
      peer.knockbackTime = Math.max(0, (peer.knockbackTime || 0) - dt);
      const age = Math.min(0.1, Math.max(0, (now - (peer.lastSeen || now)) / 1000));
      const targetX = (peer.targetX ?? peer.x ?? 0) + (peer.vx || 0) * age;
      const targetY = (peer.targetY ?? peer.y ?? 0) + (peer.vy || 0) * age;
      const blend = Math.min(1, dt * 22);
      if(!Number.isFinite(peer.displayX) || Math.abs(targetX - peer.displayX) > 160) peer.displayX = targetX;
      else peer.displayX += (targetX - peer.displayX) * blend;
      if(!Number.isFinite(peer.displayY) || Math.abs(targetY - peer.displayY) > 160) peer.displayY = targetY;
      else peer.displayY += (targetY - peer.displayY) * blend;
      if((peer.dashTime||0) > 0){
        spawnDashDustAt(peer.displayX||peer.x||0, peer.displayY||peer.y||0, peer.dashVX||0, peer.dashVY||0);
      }
    }

    for(let i=online.syncedProjectiles.length-1;i>=0;i--){
      const p = online.syncedProjectiles[i];
      if(!p) continue;
      if(p.kind === 'grenade' || p.kind === 'molotov'){
        p.timer = Math.max(0, (p.timer || 0) - dt);
        p.progress = clamp(1 - p.timer / Math.max(0.0001, p.total || 1), 0, 1);
        p.x = (p.startX || 0) + ((p.targetX || 0) - (p.startX || 0)) * p.progress;
        p.y = (p.startY || 0) + ((p.targetY || 0) - (p.startY || 0)) * p.progress;
        const height = Math.sin(p.progress * Math.PI) * (p.arc || 0);
        p.drawX = p.x;
        p.drawY = p.y - height;
        continue;
      }
      if(p.kind === 'rocket'){
        const prevX = p.x || 0;
        const prevY = p.y || 0;
        p.x = prevX + (p.vx || 0) * dt;
        p.y = prevY + (p.vy || 0) * dt;
        p.life = Math.max(0, (p.life || 0) - dt);
        p.angle = Math.atan2(p.vy || 0, p.vx || 1);
        for(let t=0;t<2;t++){
          online.remoteParticles.push({
            x:p.x-(p.vx||0)*0.01*t+rand(-1.5,1.5),
            y:p.y-(p.vy||0)*0.01*t+rand(-1.5,1.5),
            vx:rand(-12,12),vy:rand(-12,12),life:rand(0.18,0.3),maxLife:0.3,size:rand(2,4),
            color:Math.random()>0.5?'rgba(255,180,90,0.75)':'rgba(80,80,80,0.5)',drag:0.95
          });
        }
        continue;
      }
      if(p.kind === 'pellet'){
        const pelletArray = [p];
        updateVisualPelletArray(pelletArray, dt);
        if(pelletArray.length === 0) online.syncedProjectiles.splice(i,1);
        continue;
      }
      if(p.kind === 'flame'){
        const v = Math.hypot(p.vx || 0, p.vy || 0) || 1;
        const sideX = -(p.vy || 0) / v;
        const sideY = (p.vx || 0) / v;
        p.vx = (p.vx || 0) + sideX * (p.swirl || 0) * dt;
        p.vy = (p.vy || 0) + sideY * (p.swirl || 0) * dt;
        p.x = (p.x || 0) + (p.vx || 0) * dt;
        p.y = (p.y || 0) + (p.vy || 0) * dt;
        const flameDamping = Math.pow(FLAME_VELOCITY_DAMPING_PER_SECOND, dt);
        p.vx *= flameDamping;
        p.vy *= flameDamping;
        p.vy -= 30 * dt * (p.heat || 1);
        p.life = Math.max(0, (p.life || 0) - dt);
        p.size = (p.size || 0) + dt * 8;
        p.swirl = (p.swirl || 0) * Math.pow(0.7, dt * 60);
      }
    }

    for(let i=online.remoteParticles.length-1;i>=0;i--){
      const p=online.remoteParticles[i];
      p.x += (p.vx || 0) * dt;
      p.y += (p.vy || 0) * dt;
      p.vx *= p.drag || 0.95;
      p.vy *= p.drag || 0.95;
      if(p.floaty) p.vy -= 18 * dt;
      p.life -= dt;
      if(p.life <= 0) online.remoteParticles.splice(i,1);
    }
  }

  function updateVisualPelletArray(pelletArray, dt){
    for(let i=pelletArray.length-1;i>=0;i--){
      const p=pelletArray[i], prevX=p.x, prevY=p.y;
      p.x+=p.vx*dt; p.y+=p.vy*dt; p.life-=dt;
      let removed=false;
      for(const b of WORLD.buildings){
        for(const wr of getBuildingWallRects(b)){
          if(lineIntersectsRect(prevX,prevY,p.x,p.y,wr) || circleRectCollision(p.x,p.y,p.radius||2,wr)){
            pelletArray.splice(i,1); removed=true; break;
          }
        }
        if(removed) break;
      }
      if(removed) continue;
      for(let j=state.zombies.length-1;j>=0;j--){
        const z=state.zombies[j];
        if((p.hitIds||[]).includes(z.id)) continue;
        if(dist(z.x,z.y,p.x,p.y) < z.radius + (p.radius||2) + 1){
          p.hitIds = p.hitIds || [];
          p.hitIds.push(z.id);
          if(p.penetration != null){
            p.penetration -= 1;
            if(p.penetration <= 0){ pelletArray.splice(i,1); }
          }else{
            pelletArray.splice(i,1);
          }
          removed = true;
          break;
        }
      }
      if(removed) continue;
      if(p.life<=0||p.x<-20||p.x>WORLD.w+20||p.y<-20||p.y>WORLD.h+20) pelletArray.splice(i,1);
    }
  }

  function spawnDashDustAt(x,y,dashVX,dashVY){
    if(Math.random()<0.95){
      for(let d=0;d<2;d++){
        state.particles.push({
          x:x-rand(-6,6),
          y:y+10-rand(0,4),
          vx:rand(-40,40)-(dashVX||0)*0.05,
          vy:rand(-18,6),
          life:rand(0.18,0.38),
          maxLife:0.38,
          size:rand(4,7),
          color:Math.random()>0.5?'rgba(168,142,98,0.34)':'rgba(110,102,88,0.30)',
          drag:0.92,
          floaty:true
        });
      }
    }
  }

  function emitOnlineFireZoneParticles(){
    for(const zone of state.fireZones){
      for(let s=0;s<2;s++){
        const a=Math.random()*Math.PI*2,r=Math.random()*zone.radius*0.9;
        state.particles.push({
          x:zone.x+Math.cos(a)*r,
          y:zone.y+Math.sin(a)*r,
          vx:rand(-16,16),
          vy:rand(-36,-8),
          life:rand(0.16,0.34),
          maxLife:0.34,
          size:rand(4,8),
          color:Math.random()>0.45?'rgba(255,210,70,0.82)':'rgba(255,110,30,0.72)',
          drag:0.92
        });
      }
    }
  }

  function updateOnlineVisualProjectiles(dt){
    for(let i=state.grenades.length-1;i>=0;i--){
      const g=state.grenades[i];
      g.timer-=dt;
      g.progress=clamp(1-g.timer/g.total,0,1);
      g.x=g.startX+(g.targetX-g.startX)*g.progress;
      g.y=g.startY+(g.targetY-g.startY)*g.progress;
      g.height=Math.sin(g.progress*Math.PI)*g.arc;
      g.drawX=g.x;
      g.drawY=g.y-g.height;
      if(g.timer<=0){
        g.x=g.targetX; g.y=g.targetY; g.drawX=g.targetX; g.drawY=g.targetY;
        state.explosions.push({x:g.x,y:g.y,radius:0,maxRadius:g.type==='molotov'?84:128,life:g.type==='molotov'?0.34:0.42,maxLife:g.type==='molotov'?0.34:0.42,ring:0,rocket:false,molotov:g.type==='molotov'});
        state.grenades.splice(i,1);
      }
    }
    for(let i=state.rockets.length-1;i>=0;i--){
      const r=state.rockets[i];
      const prevX=r.x,prevY=r.y;
      r.x+=r.vx*dt; r.y+=r.vy*dt; r.life-=dt;
      for(let t=0;t<2;t++){
        state.particles.push({
          x:r.x-r.vx*0.01*t+rand(-1.5,1.5),
          y:r.y-r.vy*0.01*t+rand(-1.5,1.5),
          vx:rand(-12,12),
          vy:rand(-12,12),
          life:rand(0.18,0.3),
          maxLife:0.3,
          size:rand(2,4),
          color:Math.random()>0.5?'rgba(255,180,90,0.75)':'rgba(80,80,80,0.5)',
          drag:0.95
        });
      }
      let done=dist(r.x,r.y,r.targetX,r.targetY)<14||r.life<=0||r.x<0||r.y<0||r.x>WORLD.w||r.y>WORLD.h;
      if(!done){
        for(const b of WORLD.buildings){
          for(const wr of getBuildingWallRects(b)){
            if(lineIntersectsRect(prevX,prevY,r.x,r.y,wr)){ done=true; break; }
          }
          if(done) break;
        }
      }
      if(done){
        state.explosions.push({x:clamp(r.x,10,WORLD.w-10),y:clamp(r.y,10,WORLD.h-10),radius:0,maxRadius:150,life:0.56,maxLife:0.56,ring:0,rocket:true});
        state.rockets.splice(i,1);
      }
    }
    for(let i=state.flameParticles.length-1;i>=0;i--){
      const f=state.flameParticles[i];
      const v=Math.hypot(f.vx,f.vy)||1;
      const sideX=-f.vy/v,sideY=f.vx/v;
      f.vx+=sideX*(f.swirl||0)*dt; f.vy+=sideY*(f.swirl||0)*dt;
      f.x+=f.vx*dt; f.y+=f.vy*dt;
      const flameDamping=Math.pow(FLAME_VELOCITY_DAMPING_PER_SECOND,dt);
      f.vx*=flameDamping; f.vy*=flameDamping; f.vy-=30*dt*(f.heat||1);
      f.life-=dt; f.size+=dt*8; f.swirl=(f.swirl||0)*Math.pow(0.7,dt*60);
      for(const b of WORLD.buildings){
        for(const wr of getBuildingWallRects(b)){
          if(circleRectCollision(f.x,f.y,f.size*0.35,wr)){ f.life=0; break; }
        }
        if(f.life<=0) break;
      }
      if(f.life<=0) state.flameParticles.splice(i,1);
    }
    updateVisualPelletArray(state.pellets, dt);
    for(let i=state.particles.length-1;i>=0;i--){
      const p=state.particles[i];
      p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=p.drag||0.95; p.vy*=p.drag||0.95; if(p.floaty)p.vy-=18*dt; p.life-=dt;
      if(p.life<=0) state.particles.splice(i,1);
    }
    for(let i=state.damageTexts.length-1;i>=0;i--){
      const t=state.damageTexts[i]; t.y+=t.vy*dt; t.x+=(t.dx||0)*dt; t.life-=dt; if(t.life<=0) state.damageTexts.splice(i,1);
    }
  }

  function localReloadPredict(dt){
    player.shootCooldown=Math.max(0,player.shootCooldown-dt);
    player.reloadTimer=Math.max(0,player.reloadTimer-dt);
    player.dashCooldown=Math.max(0,player.dashCooldown-dt);
    player.dashTime=Math.max(0,player.dashTime-dt);
    player.rocketJumpTime=Math.max(0,player.rocketJumpTime-dt);
    player.knockbackTime=Math.max(0,player.knockbackTime-dt);
    player.hurtTimer=Math.max(0,player.hurtTimer-dt);
    if(player.wasReloading&&player.reloadTimer===0){
      player.wasReloading=false;
      if(player.weapon==='shotgun'){player.mag=player.magSize;}
      else if(player.weapon==='gatling'&&player.gatlingAmmo>0){const load=Math.min(player.magSize-player.mag,player.gatlingAmmo);player.mag+=load;player.gatlingAmmo-=load;}
      else if(player.weapon==='rocket'&&player.rocketAmmo>0){const load=Math.min(player.magSize-player.mag,player.rocketAmmo);player.mag+=load;player.rocketAmmo-=load;}
      else if(player.weapon==='flamethrower'&&player.flameAmmo>0){const load=Math.min(player.magSize-player.mag,player.flameAmmo);player.mag+=load;player.flameAmmo-=load;}
      else{player.weapon='shotgun';player.magSize=6;player.mag=6;}
    }
  }

  function onlineUpdate(dt){
    updateCursorVisibility();
    if(state.gameOver){
      state.deathAnim=Math.max(0,state.deathAnim-dt);
      if(state.deathAnim===0&&$('overlay').classList.contains('hidden'))showGameOverOverlay();
      return;
    }
    if(!state.running) return;
    if(state.paused) return;
    state.time += dt;
    state.buffAnnouncementTimer=Math.max(0,state.buffAnnouncementTimer-dt);
    state.cameraShake=Math.max(0,state.cameraShake-dt*18);
    state.screenFlash=Math.max(0,state.screenFlash-dt*1.2);
    state.bossAnnouncement=Math.max(0,state.bossAnnouncement-dt);
    state.airdropAnnouncement=Math.max(0,state.airdropAnnouncement-dt);
    localReloadPredict(dt);
    player.zombiePushTime = Math.max(0, (player.zombiePushTime || 0) - dt);

    const spectating = online.spectating || !online.selfAlive;
    if(spectating){
      mouseDown = false;
      state.keys.delete('shift');
      if(typeof touchState === 'object' && touchState) touchState.shootHeld = false;
    }

    let mx=0,my=0;
    if(MOBILE_MODE){
      const mag=Math.hypot(touchState.move.dx,touchState.move.dy);
      const moveBase=$('moveBase'); const moveRadius=Math.max(28,(moveBase?.getBoundingClientRect().width||108)*0.5-4);
      if(touchState.move.active && mag>6){ mx=touchState.move.dx/moveRadius; my=touchState.move.dy/moveRadius; }
    }else{
      if(state.keys.has('w')||state.keys.has('arrowup'))my-=1;
      if(state.keys.has('s')||state.keys.has('arrowdown'))my+=1;
      if(state.keys.has('a')||state.keys.has('arrowleft'))mx-=1;
      if(state.keys.has('d')||state.keys.has('arrowright'))mx+=1;
      const len=Math.hypot(mx,my)||1; mx/=len; my/=len;
    }
    if(!spectating && !MOBILE_MODE && state.keys.has('shift') && player.dashCooldown<=0 && (mx||my)){
      player.dashCooldown=1.3; player.dashTime=0.18;
      const dashSpeed=460;
      player.dashVX=mx*dashSpeed; player.dashVY=my*dashSpeed;
      player.dashFacing=Math.atan2(my,mx);
      player.dashSpinDir=mx<0?-1:mx>0?1:(state.mouse.x<SW*0.5?-1:1);
      playDash();
    }
    if(MOBILE_MODE) syncAimCursor();
    const mobileAimActive = MOBILE_MODE && touchState.aim.active && Math.hypot(touchState.aim.dx,touchState.aim.dy)>12;
    if(MOBILE_MODE && !mobileAimActive){
      if(mx<-0.12) player.faceDir=-1;
      else if(mx>0.12) player.faceDir=1;
    }else{
      const camAim=camera();
      const aimWorldX=camAim.x+state.mouse.x;
      if(aimWorldX<player.x-2) player.faceDir=-1; else if(aimWorldX>player.x+2) player.faceDir=1;
    }
    if(spectating){ mx = 0; my = 0; }
    if(player.rocketJumpTime>0){
      moveWithWallCollision(player,player.rocketJumpVX*dt,player.rocketJumpVY*dt);
      const rocketJumpDamping=Math.pow(ROCKET_JUMP_DAMPING_PER_SECOND,dt);
      player.rocketJumpVX*=rocketJumpDamping; player.rocketJumpVY*=rocketJumpDamping;
    }else if(player.knockbackTime>0){
      moveWithWallCollision(player,player.knockbackVX*dt,player.knockbackVY*dt);
      const knockbackDamping=Math.pow(0.08,dt);
      player.knockbackVX*=knockbackDamping; player.knockbackVY*=knockbackDamping;
    }else if(player.dashTime>0){
      moveWithWallCollision(player,player.dashVX*dt,player.dashVY*dt);
    }else{
      moveWithWallCollision(player,mx*player.speed*(player.speedMul||1)*dt,my*player.speed*(player.speedMul||1)*dt);
    }

    if(!spectating && ((MOBILE_MODE&&touchState.shootHeld)||(!MOBILE_MODE&&mouseDown))){
      if(player.shootCooldown<=0&&player.reloadTimer<=0&&player.mag>0){
        const cam=camera(), worldMouseX=cam.x+state.mouse.x, worldMouseY=cam.y+state.mouse.y;
        const angle=Math.atan2(worldMouseY-player.y,worldMouseX-player.x);
        shoot();
        onlineSendAction({ kind:'fire', aimAngle:angle, targetX:worldMouseX, targetY:worldMouseY });
        if(player.mag===0&&player.reloadTimer<=0) startReload();
      }
    }

    updateOnlineRemoteVisuals(dt);
    updateOnlineVisualProjectiles(dt);
    if(player.dashTime>0) spawnDashDustAt(player.x, player.y, player.dashVX||0, player.dashVY||0);
    emitOnlineFireZoneParticles();
    updateBuildingRoofs();
    bindMenuButtons();
    bindOnlineDevButtons();
    updateHUD();

    online.sendTimer -= dt;
    if(online.sendTimer<=0){
      online.sendTimer = 1/60;
      if(!spectating){
        onlineSend({
          type:'player_state',
          state:{
            x:player.x,
            y:player.y,
            faceDir:player.faceDir,
            aimAngle:Math.atan2((camera().y+state.mouse.y)-player.y,(camera().x+state.mouse.x)-player.x),
            moving:!!(mx||my||mouseDown||touchState.shootHeld),
            name:state.playerName,
            dashTime:player.dashTime||0,
            dashVX:player.dashVX||0,
            dashVY:player.dashVY||0,
            dashFacing:player.dashFacing||0,
            dashSpinDir:player.dashSpinDir||1
          }
        });
      }
    }
  }

  const __origUpdate = update;
  update = function(dt){
    if(online.connected && online.started && state.running && !state.loading && onlineIsMode()) return onlineUpdate(dt);
    return __origUpdate(dt);
  };

  const __origCamera = camera;
  camera = function(){
    if(online.connected && online.started && onlineIsMode() && online.spectating){
      const target = onlineSpectateTarget();
      if(target){
        const shakeX = state.cameraShake>0?rand(-state.cameraShake,state.cameraShake):0;
        const shakeY = state.cameraShake>0?rand(-state.cameraShake,state.cameraShake):0;
        const tx = Number.isFinite(target.displayX) ? target.displayX : (target.x || 0);
        const ty = Number.isFinite(target.displayY) ? target.displayY : (target.y || 0);
        return {x:clamp(tx-SW/2+shakeX,0,WORLD.w-SW),y:clamp(ty-SH/2+shakeY,0,WORLD.h-SH)};
      }
    }
    return __origCamera();
  };

  const __origDrawCrosshair = drawCrosshair;
  drawCrosshair = function(){
    if(online.connected && online.started && onlineIsMode() && online.spectating) return;
    return __origDrawCrosshair();
  };

  const __origThrowThrowable = throwThrowable;
  throwThrowable = function(kind='grenade'){
    if(!(online.connected && online.started && state.running && onlineIsMode())) return __origThrowThrowable(kind);
    if(online.spectating || !online.selfAlive) return;
    const isMolotov=kind==='molotov';
    if(isMolotov&&player.molotovs<=0)return;
    if(!isMolotov&&player.grenades<=0)return;
    const cam=camera(),worldMouseX=cam.x+state.mouse.x,worldMouseY=cam.y+state.mouse.y;
    let dx=worldMouseX-player.x,dy=worldMouseY-player.y;
    const maxDist=isMolotov?420:340;
    const d=Math.hypot(dx,dy)||1;
    if(d>maxDist){dx=dx/d*maxDist;dy=dy/d*maxDist;}
    const targetX=clamp(player.x+dx,10,WORLD.w-10),targetY=clamp(player.y+dy,10,WORLD.h-10);
    __origThrowThrowable(kind);
    onlineSendAction({ kind:'throw', throwable: kind, targetX, targetY });
  };

  const __origStartReload = startReload;
  startReload = function(){
    const before = player.reloadTimer;
    if(online.connected && online.started && state.running && onlineIsMode() && (online.spectating || !online.selfAlive)) return;
    __origStartReload();
    if(online.connected && online.started && state.running && onlineIsMode() && player.reloadTimer>0 && before===0){
      onlineSendAction({ kind:'reload' });
    }
  };

  function withTempRenderArrays(temp, cb){
    const prev = {
      grenades: state.grenades,
      pellets: state.pellets,
      rockets: state.rockets,
      flameParticles: state.flameParticles,
      particles: state.particles,
    };
    state.grenades = temp.grenades;
    state.pellets = temp.pellets;
    state.rockets = temp.rockets;
    state.flameParticles = temp.flameParticles;
    state.particles = temp.particles;
    try{ cb(); }
    finally{
      state.grenades = prev.grenades;
      state.pellets = prev.pellets;
      state.rockets = prev.rockets;
      state.flameParticles = prev.flameParticles;
      state.particles = prev.particles;
    }
  }

  function buildOnlineRenderArrays(){
    const temp = { grenades: [], pellets: [], rockets: [], flameParticles: [], particles: (online.remoteParticles || []).map(p=>Object.assign({}, p)) };
    for(const projectile of (online.syncedProjectiles || [])){
      if(!projectile || projectile.ownerId === online.clientId) continue;
      if(projectile.kind === 'grenade' || projectile.kind === 'molotov') temp.grenades.push(projectile);
      else if(projectile.kind === 'pellet') temp.pellets.push(projectile);
      else if(projectile.kind === 'rocket') temp.rockets.push(projectile);
      else if(projectile.kind === 'flame') temp.flameParticles.push(projectile);
    }
    return temp;
  }


  function getOnlineScoreEntries(){
    const entries = [];
    const selfScore = Number.isFinite(state.score) ? state.score : (Number.isFinite(player.score) ? player.score : 0);
    entries.push({ id: online.clientId || 'self', name: state.playerName || 'Player', score: Math.round(selfScore || 0) });
    for(const peer of Object.values(online.peers || {})) entries.push({ id: peer.id, name: peer.name || 'Player', score: Math.round(peer.score || 0) });
    entries.sort((a,b)=>{
      const ds = (b.score||0) - (a.score||0);
      if(ds) return ds;
      if(a.id === online.clientId) return -1;
      if(b.id === online.clientId) return 1;
      return String(a.name||'').localeCompare(String(b.name||''));
    });
    return entries;
  }

  function getOnlineScoreboardLayout(){
    const mobile = MOBILE_MODE;
    const entries = getOnlineScoreEntries();
    const mw = mobile ? 136 : 196;
    const mh = mobile ? 76 : 120;
    const rowH = mobile ? 16 : 18;
    const headerH = mobile ? 24 : 26;
    const totalH = mobile ? 20 : 22;
    const panelH = headerH + entries.length * rowH + totalH + 12;
    const mx = mobile ? (SW - mw - 8) : (SW - mw - 14);
    const baseMinimapY = SH - mh - 14;
    let panelY = baseMinimapY - panelH - 8;
    let my = baseMinimapY;
    if(panelY < 8){
      panelY = 8;
      my = panelY + panelH + 8;
    }
    return { entries, mw, mh, mx, my, panelY, panelH, rowH, headerH, totalH, totalScore: entries.reduce((sum,e)=>sum + (e.score||0), 0) };
  }

  const __origDrawMinimap = drawMinimap;
  drawMinimap = function(cam){
    if(!(online.connected && online.started && onlineIsMode() && state.running && !state.gameOver)) return __origDrawMinimap(cam);
    const mobile = MOBILE_MODE;
    const { mw, mh, mx, my } = getOnlineScoreboardLayout();
    pxRect(mx,my,mw,mh,'rgba(10,10,10,0.72)');
    ctx.strokeStyle='rgba(255,255,255,0.15)';
    ctx.strokeRect(mx,my,mw,mh);
    const sx=mw/WORLD.w, sy=mh/WORLD.h;
    ctx.fillStyle='rgba(70,70,70,0.6)';
    for(const b of WORLD.buildings) ctx.fillRect(mx+b.x*sx,my+b.y*sy,Math.max(1,b.w*sx),Math.max(1,b.h*sy));
    ctx.fillStyle='rgba(100,100,100,0.4)';
    for(const r of WORLD.road) ctx.fillRect(mx+r.x*sx,my+r.y*sy,Math.max(1,r.w*sx),Math.max(1,r.h*sy));
    ctx.fillStyle='#ff5555';
    for(const z of state.zombies) ctx.fillRect(mx+z.x*sx,my+z.y*sy,z.type==='boss'?(mobile?3:4):2,z.type==='boss'?(mobile?3:4):2);
    ctx.fillStyle='#7fc4ff';
    for(const a of state.airdrops) ctx.fillRect(mx+a.x*sx-2,my+a.y*sy-2,mobile?4:5,mobile?4:5);
    ctx.fillStyle='#ffd27f';
    ctx.fillRect(mx+player.x*sx-2,my+player.y*sy-2,mobile?3:4,mobile?3:4);
    for(const peer of Object.values(online.peers || {})){
      const pxv = Number.isFinite(peer.displayX) ? peer.displayX : (peer.x || 0);
      const pyv = Number.isFinite(peer.displayY) ? peer.displayY : (peer.y || 0);
      ctx.fillStyle='#9cc2ff';
      ctx.fillRect(mx+pxv*sx-2,my+pyv*sy-2,mobile?3:4,mobile?3:4);
    }
    ctx.strokeStyle='rgba(255,255,255,0.4)';
    ctx.strokeRect(mx+cam.x*sx,my+cam.y*sy,SW*sx,SH*sy);
  };

  function drawOnlineScoreboardPanel(){
    if(!(online.connected && online.started && onlineIsMode() && state.running && !state.gameOver)) return;
    const t = ot();
    const layout = getOnlineScoreboardLayout();
    const { entries, mx, mw, panelY, panelH, rowH, headerH, totalH, totalScore } = layout;
    pxRect(mx,panelY,mw,panelH,'rgba(10,10,10,0.78)');
    ctx.strokeStyle='rgba(255,255,255,0.15)';
    ctx.strokeRect(mx,panelY,mw,panelH);
    ctx.font = `${MOBILE_MODE ? 'bold 11px' : 'bold 12px'} Courier New`;
    ctx.textAlign='left';
    ctx.fillStyle='#9cc2ff';
    ctx.fillText(t.onlineScoreboard, mx + 8, panelY + 16);
    const scoreX = mx + mw - 8;
    let rowTop = panelY + headerH;
    ctx.font = `${MOBILE_MODE ? '11px' : '12px'} Courier New`;
    for(const entry of entries){
      const isSelf = entry.id === (online.clientId || 'self');
      const textY = rowTop + rowH - 5;
      if(isSelf) pxRect(mx + 4, rowTop - 1, mw - 8, rowH, 'rgba(255,210,110,0.10)');
      ctx.fillStyle = isSelf ? '#ffd27f' : '#f0e6d8';
      ctx.textAlign='left';
      ctx.fillText(String(entry.name || 'Player').slice(0, MOBILE_MODE ? 11 : 15), mx + 8, textY);
      ctx.textAlign='right';
      ctx.fillText(String(Math.round(entry.score || 0)), scoreX, textY);
      rowTop += rowH;
    }
    const dividerY = panelY + panelH - totalH - 4;
    ctx.strokeStyle='rgba(255,255,255,0.10)';
    ctx.beginPath();
    ctx.moveTo(mx + 6, dividerY);
    ctx.lineTo(mx + mw - 6, dividerY);
    ctx.stroke();
    const totalY = panelY + panelH - 8;
    ctx.fillStyle='#f0d39c';
    ctx.textAlign='left';
    ctx.fillText(t.onlineTotalScore, mx + 8, totalY);
    ctx.textAlign='right';
    ctx.fillText(String(Math.round(totalScore || 0)), scoreX, totalY);
    ctx.textAlign='left';
  }

  
  const SURVIVOR_LOOKS = [
    { hair:'#1f1b18', face:'#d7c6b8', hurt:'#efc0bf', coat:'#4c574d', legs:'#262826', accent:'#71785f', detail:'#8a7b64', gunBody:'#545f66', gunTrim:'#2c2c2c', accessory:'hood' },
    { hair:'#24201c', face:'#d2c0b0', hurt:'#efc0bf', coat:'#5a4b43', legs:'#2d2623', accent:'#7a675c', detail:'#8d7a6b', gunBody:'#7d614f', gunTrim:'#2c2c2c', accessory:'bandolier' },
    { hair:'#1b1d20', face:'#d5c4b6', hurt:'#efc0bf', coat:'#4a5560', legs:'#292d31', accent:'#6b7780', detail:'#7f6e61', gunBody:'#5a646f', gunTrim:'#2c2c2c', accessory:'cap' },
    { hair:'#26211e', face:'#d8c4b1', hurt:'#efc0bf', coat:'#655a4f', legs:'#322d29', accent:'#8a7a68', detail:'#5e4f43', gunBody:'#7a7a7a', gunTrim:'#303030', accessory:'shoulder' },
    { hair:'#1c1f1b', face:'#d0bdae', hurt:'#efc0bf', coat:'#4a5244', legs:'#262923', accent:'#66735e', detail:'#7f5e50', gunBody:'#545f66', gunTrim:'#2c2c2c', accessory:'mask' },
    { hair:'#221d1f', face:'#d4c1b3', hurt:'#efc0bf', coat:'#564b53', legs:'#2e272c', accent:'#74636f', detail:'#8a796e', gunBody:'#7d614f', gunTrim:'#2c2c2c', accessory:'poncho' },
    { hair:'#201d1b', face:'#d6c3b4', hurt:'#efc0bf', coat:'#5e5447', legs:'#2d2a25', accent:'#85735f', detail:'#5f666a', gunBody:'#5a646f', gunTrim:'#2c2c2c', accessory:'pack' },
    { hair:'#1d2021', face:'#d3c2b6', hurt:'#efc0bf', coat:'#4d4f53', legs:'#28292d', accent:'#6e7278', detail:'#8a6d58', gunBody:'#7a7a7a', gunTrim:'#2c2c2c', accessory:'beanie' },
  ];
  function stableHashString(str){ let h = 2166136261; const s = String(str || 'player'); for(let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619);} return h >>> 0; }
  function onlineAppearanceIndexFor(playerId, explicitIndex){ if(Number.isFinite(explicitIndex)) return ((explicitIndex % SURVIVOR_LOOKS.length) + SURVIVOR_LOOKS.length) % SURVIVOR_LOOKS.length; if(online.roomState && Array.isArray(online.roomState.players)){ const entry = online.roomState.players.find(p => p && p.id === playerId); if(entry && Number.isFinite(entry.appearanceIndex)) return ((entry.appearanceIndex % SURVIVOR_LOOKS.length) + SURVIVOR_LOOKS.length) % SURVIVOR_LOOKS.length; } return stableHashString(playerId || 'player') % SURVIVOR_LOOKS.length; }
  function onlineAppearanceFor(playerId, explicitIndex){ return SURVIVOR_LOOKS[onlineAppearanceIndexFor(playerId, explicitIndex)] || SURVIVOR_LOOKS[0]; }
  function drawSurvivorAccessory(x, y, faceDir, look, alive){ const accent = alive ? look.accent : '#666666'; const detail = alive ? look.detail : '#555555'; switch(look.accessory){ case 'hood': pxRect(x-7,y-10,14,3,accent); pxRect(x-7,y-8,2,4,accent); pxRect(x+5,y-8,2,4,accent); break; case 'bandolier': pxRect(x-5,y+3,2,7,accent); pxRect(x-2,y+2,2,7,detail); pxRect(x+1,y+1,2,7,accent); break; case 'cap': pxRect(x-7,y-10,14,3,accent); if(faceDir>0) pxRect(x+4,y-7,4,2,accent); else pxRect(x-8,y-7,4,2,accent); break; case 'shoulder': if(faceDir>0){ pxRect(x+4,y+1,5,4,accent); pxRect(x+4,y+5,4,2,detail); } else { pxRect(x-9,y+1,5,4,accent); pxRect(x-8,y+5,4,2,detail); } break; case 'mask': pxRect(x-4,y-2,8,3,accent); break; case 'poncho': pxRect(x-7,y+1,14,3,accent); pxRect(x-6,y+4,12,2,detail); break; case 'pack': if(faceDir>0) pxRect(x-8,y+2,3,9,accent); else pxRect(x+5,y+2,3,9,accent); break; case 'beanie': pxRect(x-6,y-10,12,3,accent); pxRect(x-2,y-11,4,2,detail); break; }}
  function drawStyledSurvivorBody(x, y, baseX, baseY, look, opts){ const alive = !!opts.alive; const faceDir = (opts.faceDir||1)<0 ? -1 : 1; const weapon = opts.weapon || 'shotgun'; const weaponAng = Number.isFinite(opts.weaponAng) ? opts.weaponAng : (faceDir<0?Math.PI:0); const jumpVisual = opts.jumpVisual || { lift:0, shadowScale:1 }; const bodyColor = alive ? look.coat : '#545454'; const legsColor = alive ? look.legs : '#3c3c3c'; const faceColor = alive ? (opts.hurt ? look.hurt : look.face) : '#9a9a9a'; const hairColor = alive ? look.hair : '#666666'; const ember = alive ? '#ff7a1a' : '#8b8b8b'; const muzzleWood = alive ? look.detail : '#666666'; const gunBody = weapon==='gatling' ? '#545f66' : weapon==='rocket' ? '#5a646f' : weapon==='flamethrower' ? '#7a7a7a' : (look.gunBody || '#7d614f'); const gunTrim = look.gunTrim || '#2c2c2c'; pxRect(baseX-11*(jumpVisual.shadowScale||1),baseY+12,22*(jumpVisual.shadowScale||1),5,'rgba(0,0,0,0.2)'); if(opts.spinMode){ const spin = opts.spin || 0; ctx.save(); ctx.translate(x,y+3); ctx.rotate(spin); pxRect(-7,-6,14,5,hairColor); pxRect(-8,-3,16,7,faceColor); pxRect(6,-1,6,2,muzzleWood); pxRect(11,-1,2,2,ember); pxRect(-8,4,16,8,bodyColor); pxRect(-10,2,3,10,legsColor); pxRect(7,2,3,10,legsColor); if(look.accessory==='bandolier'){ pxRect(-5,4,2,7,alive?look.accent:'#666'); pxRect(-1,3,2,7,alive?look.detail:'#555'); pxRect(3,2,2,7,alive?look.accent:'#666'); } else if(look.accessory==='poncho'){ pxRect(-8,3,16,3,alive?look.accent:'#666'); } else if(look.accessory==='hood'){ pxRect(-8,-6,16,2,alive?look.accent:'#666'); } drawRotatedGun(0,4,spin,gunBody,gunTrim,weapon); ctx.restore(); return; } pxRect(x-6,y-8,12,10,faceColor); pxRect(x-6,y-10,12,3,hairColor); pxRect(x-5,y-6,10,3,'#0a0a0a'); drawSurvivorAccessory(x, y, faceDir, look, alive); if(faceDir>0){ pxRect(x+5,y-3,5,2,muzzleWood); pxRect(x+10,y-3,2,2,ember); } else { pxRect(x-10,y-3,5,2,muzzleWood); pxRect(x-12,y-3,2,2,ember); } pxRect(x-5,y+2,10,9,bodyColor); pxRect(x-7,y+10,4,6,legsColor); pxRect(x+3,y+10,4,6,legsColor); if(alive) drawRotatedGun(x,y+4,weaponAng,gunBody,gunTrim,weapon); }
  function drawStyledLocalPlayer(cam){ const look = onlineAppearanceFor(online.clientId || state.playerName, player.onlineAppearanceIndex); const s=worldToScreen(player.x,player.y,cam),baseX=px(s.x),baseY=px(s.y); const jumpVisual=getPlayerJumpVisual(),lift=jumpVisual.lift; const x=baseX,y=px(baseY-lift); if(state.deathAnim>0){ const collapse=(1.4-state.deathAnim)/1.4; pxRect(baseX-8,baseY-2+collapse*10,16,4,'#7b1b1b'); pxRect(baseX-4,baseY+2+collapse*10,8,6,look.coat); return; } const worldMouseX=cam.x+state.mouse.x,worldMouseY=cam.y+state.mouse.y; const aimAng=Math.atan2(worldMouseY-player.y,worldMouseX-player.x); const mobileAimActive = MOBILE_MODE && touchState.aim.active && Math.hypot(touchState.aim.dx,touchState.aim.dy)>12; let weaponAng=aimAng; if(MOBILE_MODE && !mobileAimActive){ if(player.dashTime>0) weaponAng=player.dashFacing; else if(player.rocketJumpTime>0) weaponAng=Math.atan2(player.rocketJumpVY||0,player.rocketJumpVX||player.faceDir||1); else if(player.knockbackTime>0) weaponAng=Math.atan2(player.knockbackVY||0,player.knockbackVX||player.faceDir||1); else if(Math.hypot(touchState.move.dx,touchState.move.dy)>6) weaponAng=Math.atan2(touchState.move.dy,touchState.move.dx); else weaponAng=(player.faceDir||1)<0?Math.PI:0; } const moveAng=player.dashTime>0?player.dashFacing:player.rocketJumpTime>0?Math.atan2(player.rocketJumpVY||0,player.rocketJumpVX||1):weaponAng; if(player.dashTime>0||player.rocketJumpTime>0){ for(let i=3;i>=1;i--){ const trailX=x-Math.cos(moveAng)*i*7,trailY=y-Math.sin(moveAng)*i*7; ctx.fillStyle=`rgba(255,190,120,${0.09*i})`; ctx.fillRect(px(trailX-7),px(trailY-7),14,18); } } ctx.fillStyle='rgba(0,0,0,0.65)'; ctx.font='12px Courier New'; ctx.textAlign='center'; ctx.fillText(state.playerName,x+1,y-15); ctx.fillStyle='#f0e6d8'; ctx.fillText(state.playerName,x,y-16); if(player.dashTime>0||player.rocketJumpTime>0){ const spinBase=player.dashTime>0?1-(player.dashTime/0.18):1-(player.rocketJumpTime/ROCKET_JUMP_DURATION); const spin=spinBase*Math.PI*2*player.dashSpinDir; drawStyledSurvivorBody(x,y,baseX,baseY,look,{alive:true,hurt:player.hurtTimer>0,faceDir:player.faceDir,weapon:player.weapon,weaponAng,spinMode:true,spin,jumpVisual}); return; } drawStyledSurvivorBody(x,y,baseX,baseY,look,{alive:true,hurt:player.hurtTimer>0,faceDir:player.faceDir,weapon:player.weapon,weaponAng,jumpVisual}); }

  const __origDrawPlayer = drawPlayer;
  drawPlayer = function(cam){
    if(online.connected && online.started && onlineIsMode()){
      for(const peer of Object.values(online.peers)) drawRemotePlayer(peer, cam);
      return drawStyledLocalPlayer(cam);
    }
    return __origDrawPlayer(cam);
  };

  const __origRender = render;
  render = function(){
    if(!(online.connected && online.started && state.running && !state.gameOver)){
      __origRender();
      return;
    }
    const temp = buildOnlineRenderArrays();
    withTempRenderArrays({
      grenades: state.grenades.concat(temp.grenades),
      pellets: state.pellets.concat(temp.pellets),
      rockets: state.rockets.concat(temp.rockets),
      flameParticles: state.flameParticles.concat(temp.flameParticles),
      particles: state.particles.concat(temp.particles),
    }, ()=>__origRender());
    drawOnlineScoreboardPanel();
    ctx.textAlign='left';
    ctx.font='bold 12px Courier New';
    ctx.fillStyle='rgba(0,0,0,0.55)';
    ctx.fillRect(12, SH-64, 220, 48);
    ctx.fillStyle='#9cc2ff';
    ctx.fillText(`${ot().onlinePreview}`, 20, SH-42);
    ctx.fillStyle='#f0e6d8';
    ctx.fillText(`${ot().peers}: ${Object.keys(online.peers).length}`, 20, SH-24);
    if(online.spectating){
      const target = onlineSpectateTarget();
      const label = target ? `${lang==='zh' ? '正在观战' : 'SPECTATING'}: ${target.name || 'Player'}` : (lang==='zh' ? '你已倒下，等待队友。' : 'You are down. Waiting on your teammate.');
      ctx.textAlign='center';
      ctx.font='bold 18px Courier New';
      ctx.fillStyle='rgba(0,0,0,0.55)';
      ctx.fillRect(Math.round(SW*0.5-180), 18, 360, 34);
      ctx.fillStyle='#f0d39c';
      ctx.fillText(label, Math.round(SW*0.5), 40);
    }
  };

  function getRemoteJumpVisual(peer){
    if((peer.rocketJumpTime || 0) <= 0) return {lift:0, shadowScale:0.86, shadowAlpha:0.2};
    const progress=1-((peer.rocketJumpTime || 0)/ROCKET_JUMP_DURATION);
    const arc=Math.sin(progress*Math.PI);
    return {lift:arc*48, shadowScale:0.86-arc*0.22, shadowAlpha:0.2};
  }

  function drawRemotePlayer(peer, cam){
    const worldX = Number.isFinite(peer.displayX) ? peer.displayX : (peer.x || 0);
    const worldY = Number.isFinite(peer.displayY) ? peer.displayY : (peer.y || 0);
    const baseS = worldToScreen(worldX, worldY, cam),baseX=px(baseS.x),baseY=px(baseS.y);
    const jumpVisual=getRemoteJumpVisual(peer),lift=jumpVisual.lift;
    const x=baseX,y=px(baseY-lift);
    const alive = !!peer.alive && (peer.hp||0) > 0;
    const look = onlineAppearanceFor(peer.id || peer.name, peer.appearanceIndex);
    const worldMouseAngle = Number.isFinite(peer.aimAngle) ? peer.aimAngle : (((peer.faceDir||1)<0)?Math.PI:0);
    let weaponAng = worldMouseAngle;
    const faceDir=(peer.faceDir||1)<0?-1:1;
    const dashFacing = Number.isFinite(peer.dashFacing) ? peer.dashFacing : Math.atan2(peer.dashVY||0, peer.dashVX||faceDir||1);
    if((peer.dashTime||0)>0) weaponAng = dashFacing;
    else if((peer.rocketJumpTime||0)>0) weaponAng = Math.atan2(peer.rocketJumpVY||0,peer.rocketJumpVX||peer.faceDir||1);
    else if((peer.knockbackTime||0)>0) weaponAng = Math.atan2(peer.knockbackVY||0,peer.knockbackVX||peer.faceDir||1);
    else weaponAng = (peer.faceDir||1)<0?Math.PI:worldMouseAngle;
    ctx.fillStyle='rgba(0,0,0,0.65)';
    ctx.font='12px Courier New';
    ctx.textAlign='center';
    ctx.fillText(String(peer.name||'Player'),x+1,y-15);
    ctx.fillStyle=alive ? '#f0e6d8' : '#c2c2c2';
    ctx.fillText(String(peer.name||'Player'),x,y-16);
    if((peer.dashTime||0)>0 || (peer.rocketJumpTime||0)>0){
      const spinBase=(peer.dashTime||0)>0?1-((peer.dashTime||0)/0.18):1-((peer.rocketJumpTime||0)/ROCKET_JUMP_DURATION);
      const spinDir = Number.isFinite(peer.dashSpinDir) ? peer.dashSpinDir : (((peer.dashVX||0)<0)?-1:((peer.dashVX||0)>0?1:faceDir));
      const spin=spinBase*Math.PI*2*spinDir;
      drawStyledSurvivorBody(x,y,baseX,baseY,look,{alive,hurt:false,faceDir,weapon:peer.weapon,weaponAng,spinMode:true,spin,jumpVisual});
    }else{
      drawStyledSurvivorBody(x,y,baseX,baseY,look,{alive,hurt:false,faceDir,weapon:peer.weapon,weaponAng,jumpVisual});
    }
    const barW=22, ratio=Math.max(0,Math.min(1,(peer.hp||0)/(peer.maxHp||100)));
    pxRect(x-barW/2,y-28,barW,4,'rgba(255,255,255,0.12)');
    pxRect(x-barW/2,y-28,barW*ratio,4,alive ? '#59c36a' : '#7d7d7d');
  }
})();
