function renderEnemy() {
  const e = G.enemy;
  const ctype = G.provConquestType || 'battle';
  const _nameLbl = document.getElementById('enemy-name-lbl');
  _nameLbl.textContent = e.name + (e.nameEn ? '  ' + e.nameEn : '');
  _nameLbl.style.color = ctype==='feast' ? '#40c8c8' : ctype==='build' ? '#f0c040' : 'var(--redb)';
  _nameLbl.style.textShadow = ctype==='feast' ? '0 0 14px rgba(40,200,200,.6)' : ctype==='build' ? '0 0 14px rgba(201,162,39,.6)' : '0 0 14px rgba(200,50,50,.6)';
  const hpLabel = document.getElementById('enemy-name-hp2');
  updateEnemyHp();
  const isCivil = (ctype !== 'battle');
  const _hpBar = document.getElementById('enemy-hp-bar');
  const _hpWrap = document.getElementById('enemy-hp-wrap');
  if (_hpBar) { _hpBar.className = 'enemy-hp-bar' + (isCivil ? ' blue' : ''); }
  if (_hpWrap) { _hpWrap.className = 'enemy-hp-wrap' + (isCivil ? ' blue' : ''); }
    if (ctype === 'build') hpLabel.textContent = e.isCivilBoss ? '🧿 破关 Trial' : '⛰️ 进度 Progress';
    else if (ctype === 'feast') hpLabel.textContent = e.isCivilBoss ? '🪷 诱惑 Temptation' : '🪷 进度 Progress';
  else hpLabel.textContent = e.name;
  const svg = document.getElementById('enemy-svg');
  if (e.sprite === 'build' || e.sprite === 'feast') {
    svg.setAttribute('width','159'); svg.setAttribute('height','159');
    if (e.sprite === 'build') drawBuildSprite(svg, e.buildActivity);
    else drawFeastSprite(svg, e.feastCourse);
  } else {
    svg.setAttribute('width','128'); svg.setAttribute('height','159');
    svg.setAttribute('viewBox','0 0 64 80');
    if (ENEMY_SPRITES[e.sprite]) ENEMY_SPRITES[e.sprite](svg);
    else if (ENEMY_SPRITES.general) ENEMY_SPRITES.general(svg);
  }
  const ann = e.announce || (e.name + '出现！');
  G._waitingForAnnounce = true;
  G._pendingCharSpeak = null;
  G._pendingBattleCry = null;
  if (G._announceTimer) clearTimeout(G._announceTimer);
  G._announceTimer = setTimeout(() => {
    if (G._waitingForAnnounce) {
      G._waitingForAnnounce = false;
      G._pendingBattleCry = null;
      if (G._pendingCharSpeak) {
        speakChinese(G._pendingCharSpeak);
        G._pendingCharSpeak = null;
      }
    }
  }, 4000);
  try { window.speechSynthesis.cancel(); } catch(e3) {}
  setTimeout(() => {
    try {
      const annU = new SpeechSynthesisUtterance(ann);
      annU.lang = 'zh-CN'; annU.rate = 0.85; annU.pitch = 1;
      annU.onend = () => {
        clearTimeout(G._announceTimer);
        G._waitingForAnnounce = false;
        const cry = G._pendingBattleCry;
        G._pendingBattleCry = null;
        if (cry) {
          const cryU = _speakBattleCry(cry.text, cry.isFemale);
          if (cryU) {
            G._battleCrySpeaking = true;
            const grid = document.getElementById('ans-grid');
            if (grid) { grid.style.opacity = '0.35'; grid.style.pointerEvents = 'none'; }
            const _restoreGrid = () => {
              G._battleCrySpeaking = false;
              if (grid) { grid.style.opacity = ''; grid.style.pointerEvents = ''; }
              const _overlay = document.getElementById('battle-cry-overlay');
              const _textEl = document.getElementById('battle-cry-text');
              if (_overlay && _textEl) {
                _textEl.style.animation = 'cryfadeout 0.6s ease forwards';
                setTimeout(() => { _overlay.style.display = 'none'; _textEl.style.animation = ''; }, 650);
              }
            };
            cryU.onend = () => {
              clearTimeout(crySafety);
              _restoreGrid();
              if (G._pendingCharSpeak) {
                setTimeout(() => { speakChinese(G._pendingCharSpeak); G._pendingCharSpeak = null; }, 250);
              }
            };
            cryU.onerror = () => {
              _restoreGrid();
              if (G._pendingCharSpeak) { speakChinese(G._pendingCharSpeak); G._pendingCharSpeak = null; }
            };
            const crySafety = setTimeout(() => {
              _restoreGrid();
              if (G._pendingCharSpeak) { speakChinese(G._pendingCharSpeak); G._pendingCharSpeak = null; }
            }, 5000);
            cryU.onend = () => {
              clearTimeout(crySafety);
              _restoreGrid();
              if (G._pendingCharSpeak) {
                setTimeout(() => { speakChinese(G._pendingCharSpeak); G._pendingCharSpeak = null; }, 250);
              }
            };
            window.speechSynthesis.speak(cryU);
            return;
          }
        }
        G._battleCrySpeaking = false;
        const _grid = document.getElementById('ans-grid');
        if (_grid) { _grid.style.opacity = ''; _grid.style.pointerEvents = ''; }
        const _ov = document.getElementById('battle-cry-overlay');
        const _tx = document.getElementById('battle-cry-text');
        if (_ov && _tx) {
          _tx.style.animation = 'cryfadeout 0.6s ease forwards';
          setTimeout(() => { _ov.style.display = 'none'; _tx.style.animation = ''; }, 650);
        }
        if (G._pendingCharSpeak) {
          setTimeout(() => {
            speakChinese(G._pendingCharSpeak);
            G._pendingCharSpeak = null;
          }, 200);
        }
      };
      annU.onerror = () => {
        clearTimeout(G._announceTimer);
        G._waitingForAnnounce = false;
        G._pendingBattleCry = null;
        if (G._pendingCharSpeak) {
          speakChinese(G._pendingCharSpeak);
          G._pendingCharSpeak = null;
        }
      };
      window.speechSynthesis.speak(annU);
    } catch(e2) {
      clearTimeout(G._announceTimer);
      G._waitingForAnnounce = false;
      G._pendingBattleCry = null;
    }
  }, 300);
  const badge = document.getElementById('btl-badge');
  if (badge) {
     if (ctype==='build') badge.textContent = '⛰️ 障碍关 Obstacle';
     else if (ctype==='feast') badge.textContent = '🪷 诱惑关 Temptation';
    else badge.textContent = G.mode==='coop'?'⚔️ 合作 Co-op':getPlayerName(G.mode);
  }
}

function updateEnemyHp() {
  const e = G.enemy;
  const pct = Math.max(0,e.currentHp/e.maxHp*100);
  document.getElementById('enemy-hp-bar').style.width=pct+'%';
  document.getElementById('enemy-hp-txt').textContent=Math.max(0,e.currentHp)+'/'+e.maxHp;
  const ctype = G.provConquestType || 'battle';
  const isBlue = ctype !== 'battle';
  document.getElementById('enemy-hp-bar').className = 'enemy-hp-bar' + (isBlue ? ' blue' : '');
  document.getElementById('enemy-hp-wrap').className = 'enemy-hp-wrap' + (isBlue ? ' blue' : '');
}

function _heroSpriteHTML(key) {
  const tmp = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  drawHeroInSvg(tmp, key);
  return tmp.innerHTML;
}

function renderHeroBars() {
  const cont = document.getElementById('hero-bars');
  cont.innerHTML = G.heroes.map((h,i)=>{
    const label = rtcoopHeroBarLabel(h, i);
    const spriteHTML = _heroSpriteHTML(getHeroSpriteKey(h.key));
    return `
    <div class="hero-bar" id="hb-${i}">
      <div class="hero-bar-top">
        <svg class="hb-icon" viewBox="0 0 64 80" id="hb-svg-${i}">${spriteHTML}</svg>
        <span class="hb-name">${label}</span>
        <span class="hb-hp" id="hb-hp-${i}">${h.hp}/${h.maxHp}</span>
      </div>
      <div class="hp-bg"><div class="hp-fill" id="hb-fill-${i}" style="width:${h.hp/h.maxHp*100}%"></div></div>
    </div>`;
  }).join('');
}

function updateHeroBars() {
  G.heroes.forEach((h,i)=>{
    const pct=Math.max(0,h.hp/h.maxHp*100);
    const fill=document.getElementById('hb-fill-'+i);
    const hp=document.getElementById('hb-hp-'+i);
    const name=document.querySelector('#hb-'+i+' .hb-name');
    if(!fill) return;
    fill.style.width=pct+'%';
    fill.className='hp-fill'+(pct<25?' low':pct<55?' mid':'');
    if (hp) hp.textContent=Math.max(0,h.hp)+'/'+h.maxHp;
    if (name && RTCOOP.enabled && G.mode === 'coop') name.textContent = rtcoopHeroBarLabel(h, i);
  });
}

function getPlayers() {
  if (RTCOOP.enabled && G.mode === 'coop' && RTCOOP.myRole) {
    const p = getPlayerById(RTCOOP.myRole);
    const idx = PLAYERS.findIndex(pl => pl.id === RTCOOP.myRole);
    return [{ name: p ? p.name : (RTCOOP.myName || RTCOOP.myRole), emoji: PLAYER_EMOJIS[idx >= 0 ? idx : 0], level: RTCOOP.myRole }];
  }
  if (G.mode !== 'coop') {
    const p = getPlayerById(G.mode);
    const idx = PLAYERS.findIndex(pl => pl.id === G.mode);
    return [{ name: p ? p.name : G.mode, emoji: PLAYER_EMOJIS[idx >= 0 ? idx : 0], level: G.mode }];
  }
  return PLAYERS.length ? [{ name: PLAYERS[0].name, emoji: PLAYER_EMOJIS[0], level: PLAYERS[0].id }] : [{name:'Player',emoji:'⚔️',level:'p0'}];
}
function curPlayer() { return getPlayers()[G.playerIdx % getPlayers().length]; }

function pickChar(player) {
  const _rLvl = playerDifficulty[player.level] || 3;
  for (let i = 0; i < G.retryQueue.length; i++) {
    const rc = G.retryQueue[i];
    if (charToNumericLevel(rc) > _rLvl) continue;
    G.retryQueue.splice(i, 1);
    return rc;
  }
  const _plvl2 = playerDifficulty[player.level] || 3;
  const pool=G.charPool.filter(c=>charToNumericLevel(c)<=_plvl2);
  const weights = pool.map(c=>{
    const s=G.seenChars[c.hz];
    if(!s) return 3;
    const acc=s.seen>0?s.correct/s.seen:0;
    return acc<0.5?4:acc<0.8?2:1;
  });
  const tot=weights.reduce((a,b)=>a+b,0);
  let r=Math.random()*tot;
  for(let i=0;i<pool.length;i++){r-=weights[i];if(r<=0)return pool[i];}
  return pool[Math.floor(Math.random()*pool.length)];
}

function nextQ() {
  const player=curPlayer();
  const char=pickChar(player);
  const qtype=Q_TYPES[Math.floor(Math.random()*Q_TYPES.length)];
  const _pLvl=playerDifficulty[player.level] || 3;
  const pool=G.charPool.filter(c=>charToNumericLevel(c)<=_pLvl);
  const others=pool.filter(c=>c.hz!==char.hz).sort(()=>Math.random()-.5).slice(0,3);
  const opts=[char,...others].sort(()=>Math.random()-.5);
  G.currentQ={char,qtype,player,opts};
  renderQ();
  if (G._waitingForAnnounce) {
    G._pendingCharSpeak = char.hz;
  } else {
    setTimeout(() => speakChinese(char.hz), 400);
  }
}

function renderQ() {
  document.getElementById('next-btn').style.display='none';
  const {char,qtype,player,opts}=G.currentQ;
  const showPy=G.pinyinState[char.hz]!==false;
  document.getElementById('q-player').textContent=`${player.emoji} ${player.name}`;
  document.getElementById('btl-wave').textContent=getBattleWaveLabel();
  document.getElementById('streak-n').textContent=G.streak;
  document.getElementById('score-n').textContent=G.score;
  const bigC=document.getElementById('big-char');
  const pyD=document.getElementById('py-disp');
  const qPr=document.getElementById('q-prompt');
  const grid=document.getElementById('ans-grid');
  bigC.style.fontSize=''; bigC.style.color='';
  if(qtype==='char_to_meaning'){
    document.getElementById('q-type').textContent='汉字→意思 Char→Meaning';
    bigC.textContent=char.hz; pyD.textContent=showPy?char.py:''; pyD.className='py-disp'+(showPy?'':' hidden');
    qPr.textContent='这个字是什么意思？ What does this mean?';
    grid.innerHTML=opts.map(o=>`<button class="ans-btn" onclick="handleAns('${o.hz.replace(/'/g,"\\'")}','${char.hz.replace(/'/g,"\\'")}')">${o.en}</button>`).join('');
  } else if(qtype==='hear_to_char'){
    document.getElementById('q-type').textContent='听→认字 Listen→Identify';
    bigC.textContent='🔊'; bigC.style.fontSize='clamp(38px,10vw,62px)';
    pyD.textContent=showPy?char.py:'???'; pyD.className='py-disp';
    qPr.textContent='听音认字 Listen, then tap the character:';
    grid.innerHTML=opts.map(o=>`<button class="ans-btn" onclick="handleAns('${o.hz.replace(/'/g,"\\'")}','${char.hz.replace(/'/g,"\\'")}') " style="font-family:'Ma Shan Zheng',cursive;font-size:clamp(26px,7.5vw,42px);padding:7px 5px">${o.hz}</button>`).join('');
  } else {
    document.getElementById('q-type').textContent='意思→汉字 Meaning→Char';
    bigC.textContent=showPy?char.py:'？';
    if(!showPy){
      bigC.style.fontSize='clamp(48px,12vw,82px)';
      bigC.style.fontFamily="'Ma Shan Zheng',cursive";
    } else {
      bigC.style.fontSize='clamp(22px,6vw,36px)';
      bigC.style.color='var(--gold)';
      bigC.style.fontFamily="'Noto Serif SC',serif";
    }
    pyD.textContent=''; pyD.className='py-disp hidden';
    qPr.textContent=`Tap the character for: "${char.en}"`;
    grid.innerHTML=opts.map(o=>`<button class="ans-btn" onclick="handleAns('${o.hz.replace(/'/g,"\\'")}','${char.hz.replace(/'/g,"\\'")}') " style="font-family:'Ma Shan Zheng',cursive;font-size:clamp(26px,7.5vw,42px);padding:7px 5px">${o.hz}</button>`).join('');
  }
  _rtcoopRefreshQuestionLock();
}

function _rtcoopCurrentHero() {
  if (!(RTCOOP.enabled && G.mode === 'coop')) return null;
  return G.heroes.find(h => h.level === RTCOOP.myRole || h.ownerName === RTCOOP.myName) || null;
}

function _healHeroesBetweenWaves() {
  if (RTCOOP.enabled && G.mode === 'coop') {
    const hero = _rtcoopCurrentHero();
    if (hero && hero.hp < hero.maxHp) hero.hp = Math.min(hero.maxHp, hero.hp + 1);
    updateHeroBars();
    rtcoopPublishOwnHeroState();
    return;
  }
  G.heroes.forEach(h => {
    if (h.hp < h.maxHp) h.hp = Math.min(h.maxHp, h.hp + 1);
  });
  updateHeroBars();
}

function _rtcoopCurrentHeroDefeated() {
  const hero = _rtcoopCurrentHero();
  return !!(hero && hero.hp <= 0);
}

function _rtcoopRefreshQuestionLock() {
  const card = document.getElementById('q-card');
  const grid = document.getElementById('ans-grid');
  const nextBtn = document.getElementById('next-btn');
  const prompt = document.getElementById('q-prompt');
  if (!card || !grid || !nextBtn || !prompt) return;
  const wasLocked = !!RTCOOP._questionLocked;
  const locked = _rtcoopCurrentHeroDefeated();
  RTCOOP._questionLocked = locked;
  if (!locked) {
    card.style.opacity = '';
    card.style.filter = '';
    grid.style.pointerEvents = '';
    grid.style.opacity = '';
    if (wasLocked && document.getElementById('scr-battle')?.classList.contains('active')) {
      nextQ();
    }
    return;
  }
  card.style.opacity = '0.45';
  card.style.filter = 'grayscale(85%)';
  grid.style.pointerEvents = 'none';
  grid.style.opacity = '0.35';
  nextBtn.style.display = 'none';
  nextBtn.disabled = true;
  prompt.textContent = '💀 同伴已倒下，只能观战。 Companion defeated - you can no longer answer.';
  document.querySelectorAll('.ans-btn').forEach(b => { b.disabled = true; });
}

function handleAns(chosen,correct){
  if (G._battleCrySpeaking) return;
  if (_rtcoopCurrentHeroDefeated()) return;
  const ok=chosen===correct;
  G.totalAnswered++;
  if(!G.seenChars[correct])G.seenChars[correct]={seen:0,correct:0};
  G.seenChars[correct].seen++;
  document.querySelectorAll('.ans-btn').forEach(b=>{
    b.disabled=true;
    const v=b.getAttribute('onclick').match(/'([^']+)'/)?.[1];
    if(v===correct)b.classList.add('correct');
    else if(v===chosen&&!ok)b.classList.add('wrong');
  });
  if(ok){
    G.seenChars[correct].correct++;
    G.streak++;G.totalCorrect++;
    if(G.streak>G.bestStreak)G.bestStreak=G.streak;
    const dmg=1+Math.min(Math.floor(G.streak/3),2);
    G.score+=dmg*10;
    document.getElementById('streak-n').textContent=G.streak;
    document.getElementById('score-n').textContent=G.score;
    if(G.seenChars[correct].correct>=3)G.pinyinState[correct]=false;
    const _ct = G.provConquestType || 'battle';
    if (_ct === 'battle') {
      dealDmg(dmg);
      flashField('flash-g');
    } else {
      dealProgress(dmg, _ct);
      flashField('flash-b');
    }
  } else {
    G.streak=0;
    document.getElementById('streak-n').textContent='0';
    const _ctW = G.provConquestType || 'battle';
    enemyHitsHero();
    if (checkDefeat()) return;
    if (_ctW === 'battle') flashField('flash-r');
    else { shakeBuildFeast(); flashField('flash-b'); }
    speakChinese(correct);
    const wrongChar = CHARACTER_DB.find(c=>c.hz===correct);
    if(wrongChar) {
      if(!G.retryQueue.some(c=>c.hz===correct)) G.retryQueue.push(wrongChar);
    }
  }
  revealAnswer();
  saveProgress();
  G.playerIdx++;
  const nb = document.getElementById('next-btn');
  nb.style.display = 'block';
  if (ok) {
    nb.textContent = '继续 Continue ▶';
    nb.disabled = false;
    nb.style.opacity = '1';
    nb.style.background = 'linear-gradient(135deg,#1a3a1a,#2a5a2a)';
    nb.style.borderColor = '#50cc80';
    nb.style.color = '#88ffcc';
    if (G.streak >= 3 && G.streak % 3 === 0) setTimeout(() => showCombo(G.streak), 50);
  } else {
    nb.textContent = '📖 Revision 练习... (3)';
    nb.disabled = true;
    nb.style.opacity = '0.55';
    nb.style.background = 'linear-gradient(135deg,#3a1a1a,#5a2a2a)';
    nb.style.borderColor = '#cc5050';
    nb.style.color = '#ffaaaa';
    let secs = 3;
    const countdown = setInterval(() => {
      secs--;
      if (secs > 0) {
        nb.textContent = `📖 Revision 练习... (${secs})`;
      } else {
        clearInterval(countdown);
        nb.textContent = '知道了 Got it ▶';
        nb.disabled = false;
        nb.style.opacity = '1';
      }
    }, 1000);
  }
}

function getBattleWaveLabel() {
  const ctype = G.provConquestType || 'battle';
  const enemy = G.enemy || {};
  const step = `${G.wave}/${G.totalWaves}`;
  if (ctype === 'build') {
    return enemy.isCivilBoss
      ? `终难 · ${enemy.name || '守关人'}  Final Ordeal ${step}`
      : `第${cnNum(G.wave)}难 · ${enemy.name || '破障'}  Ordeal ${step}`;
  }
  if (ctype === 'feast') {
    return enemy.isCivilBoss
      ? `终惑 · ${enemy.name || '设宴者'}  Final Temptation ${step}`
      : `第${cnNum(G.wave)}惑 · ${enemy.name || '诱惑'}  Temptation ${step}`;
  }
  return enemy.isGeneral
    ? `终战 · ${enemy.name || '妖王'}  Final Battle ${step}`
    : `第${cnNum(G.wave)}战 · ${enemy.name || '群妖'}  Skirmish ${step}`;
}

function advanceFromAnswer(){
  const nb = document.getElementById('next-btn');
  if (nb) { nb.style.display='none'; nb.disabled=false; nb.style.opacity='1'; }
  if (RTCOOP.enabled && G.mode === 'coop' && !RTCOOP.isHost) {
    if(checkDefeat())return;
    nextQ();
    return;
  }
  if (RTCOOP.enabled && G.mode === 'coop' && RTCOOP.isHost) {
    if (checkDefeat()) return;
    if (G.enemy && G.enemy.currentHp <= 0 && !RTCOOP._wavePending) {
      RTCOOP._wavePending = true;
      if (checkEnemyDead()) return;
      RTCOOP._wavePending = false;
    }
    nextQ();
    return;
  }
  if(checkEnemyDead())return;
  if(checkDefeat())return;
  nextQ();
}

function revealAnswer(){
  const{char}=G.currentQ;
  const bc=document.getElementById('big-char');
  bc.textContent=char.hz;
  bc.style.fontSize='';
  bc.style.color='';
  bc.style.fontFamily="'Ma Shan Zheng',cursive";
  document.getElementById('py-disp').textContent=char.py;
  document.getElementById('py-disp').className='py-disp';
  document.getElementById('q-prompt').textContent=`✓ ${char.hz} = ${char.en} (${char.py})`;
  setTimeout(() => speakChinese(char.hz + '，' + char.en.replace(/\//g,'，')), 150);
}

function dealProgress(amount, ctype){
  if (RTCOOP.enabled && G.mode === 'coop') {
    G.enemy.currentHp = Math.max(0, G.enemy.currentHp - amount);
    updateEnemyHp();
    rtcoopLogHit(amount);
  } else {
    G.enemy.currentHp -= amount; updateEnemyHp();
  }
  const fig = document.getElementById('enemy-fig');
  const el = document.createElement('div');
  el.className = 'dmg-num';
  el.style.color = ctype==='feast' ? '#ffdd44' : '#88ffcc';
  el.style.textShadow = ctype==='feast'
    ? '0 0 12px rgba(255,200,40,0.9)'
    : '0 0 12px rgba(60,220,140,0.9)';
  el.textContent = ctype === 'feast' ? '✓ ' + amount + ' 次识破 🪷' : '✓ ' + amount + ' 重关卡 ⛰️';
  fig.style.position = 'relative'; fig.appendChild(el);
  setTimeout(() => el.remove(), 1300);
  const svg = document.getElementById('enemy-svg');
  svg.classList.add('glow-pulse');
  svg.style.transform = 'scale(1.08)';
  setTimeout(() => { svg.style.transform = ''; svg.classList.remove('glow-pulse'); }, 500);
}

function shakeBuildFeast(){
  const svg = document.getElementById('enemy-svg');
  svg.style.opacity = '0.45';
  svg.style.transform = 'scale(0.88)';
  svg.style.filter = 'grayscale(80%)';
  setTimeout(() => { svg.style.opacity='1'; svg.style.transform=''; svg.style.filter=''; }, 380);
}

function dealDmg(dmg){
  if (RTCOOP.enabled && G.mode === 'coop') {
    G.enemy.currentHp = Math.max(0, G.enemy.currentHp - dmg);
    updateEnemyHp();
    rtcoopLogHit(dmg);
  } else {
    G.enemy.currentHp -= dmg; updateEnemyHp();
  }
  const fig=document.getElementById('enemy-fig');
  const el=document.createElement('div');
  el.className='dmg-num';el.textContent='-'+dmg+' ⚔️';
  fig.style.position='relative';fig.appendChild(el);
  setTimeout(()=>el.remove(),1300);
  const svg=document.getElementById('enemy-svg');
  svg.style.transform='translateX(-6px)';setTimeout(()=>svg.style.transform='',200);
}

function enemyHitsHero(){
  let t = null;
  if (RTCOOP.enabled && G.mode === 'coop') {
    t = G.heroes.find(h => h.hp > 0 && (h.level === RTCOOP.myRole || h.ownerName === RTCOOP.myName)) || null;
  }
  if (!t) {
    const alive=G.heroes.filter(h=>h.hp>0);
    if(!alive.length)return;
    t=alive[Math.floor(Math.random()*alive.length)];
  }
  t.hp--;updateHeroBars();
  if (RTCOOP.enabled && G.mode === 'coop') rtcoopPublishOwnHeroState();
  _rtcoopRefreshQuestionLock();
  const i=G.heroes.indexOf(t);
  const bar=document.getElementById('hb-'+i);
  if(bar){bar.style.transform='translateX(-5px)';setTimeout(()=>bar.style.transform='',200);}
}

function flashField(cls){
  const f=document.getElementById('btl-field');
  f.classList.add(cls);setTimeout(()=>f.classList.remove(cls),400);
}

function checkEnemyDead(){
  if(G.enemy.currentHp>0)return false;
  if(G.enemy.isGeneral && G.battleProvId!==null) defeatedGenerals.add(G.battleProvId);
  G.wave++;
  if(G.wave>G.totalWaves){
    showVictory();
    if(RTCOOP.enabled && G.mode==='coop') rtcoopHostSignalEnd('victory');
    return true;
  }
  _healHeroesBetweenWaves();
  if(!musicMuted)playBattleMusic(G.wave);
  setTimeout(()=>{
    spawnEnemy(G.battleProvId);
    nextQ();
    if(RTCOOP.enabled && G.mode==='coop' && RTCOOP.isHost) rtcoopHostWaveAdvance();
  },700);
  return true;
}

function checkDefeat(){
  if (!G.heroes.every(h=>h.hp<=0)) return false;
  if (RTCOOP.enabled && G.mode === 'coop') {
    if (RTCOOP.isHost) {
      RTCOOP.currentController = _rtcoopNextControllerName(RTCOOP.myName);
      rtcoopHostSignalEnd('defeat');
    } else {
      rtcoopBroadcastDefeat();
    }
    if (!document.getElementById('scr-defeat')?.classList.contains('active')) showDefeat({ skipSignal: true });
    return true;
  }
  showDefeat();
  return true;
}

function showVictory(){
  if(G.retryQueue.length>0) G.pendingRetry=G.retryQueue[0];
  stopMusic();
  if (G.battleProvId !== null) {
    provState[G.battleProvId] = 'owned';
    playerProvId = G.battleProvId;
    G.launchProvId = G.battleProvId;
  }
  saveProgress();
  saveCampaign(campaignMode);

  const _provId = G.battleProvId;
  const _showVictoryScreen = () => _showVictoryScreenInner(_provId);

  if (_provId !== null && PROVINCE_STORIES[_provId]) {
    showProvinceStory(_provId, _showVictoryScreen);
  } else {
    _showVictoryScreen();
  }
}

function _showVictoryScreenInner(provId) {
  document.getElementById('v-prov').textContent = G.fort ? G.fort.hz||G.fort.name : '—';
  document.getElementById('v-chars').textContent = Object.keys(G.seenChars).length;
  document.getElementById('v-corr').textContent = G.totalCorrect+'/'+G.totalAnswered;
  document.getElementById('v-streak').textContent = G.bestStreak;
  document.getElementById('v-score').textContent = G.score;
  document.getElementById('v-levelup').style.display = 'none';
  const _xpResult = (campaignMode !== 'coop') ? awardHeroXP(campaignMode, G.score, G.bestStreak) : null;
  if (_xpResult) {
    document.getElementById('v-xp').textContent = '+' + _xpResult.xpGained + ' 功德' + (_xpResult.xpGained > Math.floor(G.score/10) ? ' ×2 佛缘' : '');
    if (_xpResult.leveledUp) {
      const hero = ALL_HEROES.find(h=>h.key===_xpResult.heroKey);
      document.getElementById('v-levelup').style.display = 'block';
      document.getElementById('v-levelup-text').textContent = (hero?hero.name:_xpResult.heroKey) + ' → 第' + cnNum(_xpResult.newLevel) + '重修行';
      document.getElementById('v-levelup-perk').textContent = HERO_LEVEL_PERKS[_xpResult.newLevel] || '';
      setTimeout(() => speakChinese('修行更深了！'), 800);
    }
  } else {
    document.getElementById('v-xp').textContent = '—';
  }
  const totalOwned = Object.values(provState).filter(v => v === 'owned').length;
  const unifBanner = document.getElementById('v-unification');
  if (unifBanner) unifBanner.style.display = 'none';
  if (totalOwned >= PROVINCES.length) {
    if (unifBanner) unifBanner.style.display = 'block';
    setTimeout(() => speakChinese('恭喜取得真经！'), 1200);
  }
  document.getElementById('v-hero-found').style.display = 'none';
  if (campaignMode !== 'coop') {
    const foundHero = checkHeroFound(campaignMode);
    if (foundHero) {
      playerRosters[campaignMode].roster.push(foundHero.key);
      if (!playerRosters[campaignMode].startHero) playerRosters[campaignMode].startHero = foundHero.key;
      saveRosters();
      saveCampaign(campaignMode);
      document.getElementById('v-hero-found').style.display = 'block';
      document.getElementById('v-hero-name').textContent = foundHero.name;
      document.getElementById('v-hero-en').textContent = foundHero.nameEn + ' — ' + foundHero.desc;
      const svg = document.getElementById('v-hero-svg');
      if(svg) drawHeroInSvg(svg, getHeroSpriteKey(foundHero.key));
      setTimeout(() => speakChinese(foundHero.name + '与西行结缘！'), 600);
    }
  }
  const ac=getAudio();if(ac&&!musicMuted){
    const m=ac.createGain();m.gain.value=0.25;m.connect(ac.destination);
    [392,523,659,784].forEach((f,i)=>{
      const o=ac.createOscillator(),g=ac.createGain();
      o.type='triangle';o.frequency.value=f;
      g.gain.setValueAtTime(0,ac.currentTime+i*.18);
      g.gain.linearRampToValueAtTime(0.35,ac.currentTime+i*.18+.06);
      g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+i*.18+.9);
      o.connect(g);g.connect(m);o.start(ac.currentTime+i*.18);o.stop(ac.currentTime+i*.18+.95);
    });
  }
  if (!musicMuted) playVictoryMusic();
  if(RTCOOP.enabled && G.mode==='coop') clearInterval(RTCOOP.battlePollTimer);
  const newChapter = checkMilestoneStory();
  const storyUnlockedBanner = document.getElementById('v-story-unlocked');
  if (storyUnlockedBanner) {
    if (newChapter) {
      storyUnlockedBanner.style.display = 'block';
      document.getElementById('v-story-unlocked-title').textContent = newChapter.illus + ' ' + newChapter.title + ' — ' + newChapter.titleEn;
      setTimeout(() => speakChinese('新故事解锁！' + newChapter.title), 1800);
    } else {
      storyUnlockedBanner.style.display = 'none';
    }
  }
  showScr('scr-victory');
}

function showDefeat(opts){
  opts = opts || {};
  if(G.retryQueue.length>0) G.pendingRetry=G.retryQueue[0];
  stopMusic();
  saveProgress();
  playerProvId = G.launchProvId !== null ? G.launchProvId : playerProvId;
  if(RTCOOP.enabled && G.mode==='coop') {
    clearInterval(RTCOOP.battlePollTimer);
    if(RTCOOP.isHost && !opts.skipSignal) rtcoopHostSignalEnd('defeat');
  }
  document.getElementById('d-waves').textContent=G.wave;
  document.getElementById('d-score').textContent=G.score;
  const rematchBtn = document.getElementById('defeat-rematch-btn');
  if (rematchBtn) {
    const canRematch = _rtcoopCanRematchAfterDefeat();
    rematchBtn.disabled = !canRematch;
    rematchBtn.style.opacity = canRematch ? '1' : '0.4';
    rematchBtn.style.pointerEvents = canRematch ? '' : 'none';
  }
  showScr('scr-defeat');
}

function showCampaignVictory() {
  const _mode = campaignMode;
  if (_mode !== 'coop') {
    const saved = loadCampaign(_mode);
    const totalScore = (saved && saved.totalScore) || G.score;
    const globalBest = (saved && saved.globalBestStreak) || G.bestStreak;
    const rating = calcCampaignRating(_mode, totalScore, globalBest);
    saveCampaignRating(_mode, rating);
    const unifBanner = document.getElementById('v-unification');
    if (unifBanner) {
      const stars = '⭐'.repeat(rating.stars) + '☆'.repeat(5-rating.stars);
      unifBanner.innerHTML = `
        <div style="font-size:28px;margin-bottom:6px">👑</div>
        <div style="font-family:'Ma Shan Zheng',cursive;font-size:clamp(18px,5vw,26px);color:var(--goldb);letter-spacing:.1em">恭喜你取得真经！</div>
        <div style="font-size:13px;color:var(--parch2);margin-top:6px">Scriptures won! Journey Rating:</div>
        <div style="font-size:26px;margin-top:4px">${stars}</div>
        <div style="font-size:11px;color:var(--parch2);margin-top:4px">功德圆满 ${rating.masteryPct}% · 最佳连击 ${rating.globalBestStreak} · 总分 ${rating.totalScore}</div>`;
    }
  }
  clearCampaign(campaignMode);
}

function showCombo(n){
  const b=document.getElementById('combo-banner');
  const msgs={3:'🔥 三连击 TRIPLE!',6:'⚡ 六连击 BLAZING!',9:'💫 九连击 LEGENDARY!',12:'👑 无敌 INVINCIBLE!'};
  b.textContent=msgs[n]||`🌟 ${n}连击 COMBO!`;
  b.classList.remove('show');void b.offsetWidth;b.classList.add('show');
  setTimeout(()=>b.classList.remove('show'),1600);
}

function speakChinese(text, afterCurrent){
  if(!text||!window.speechSynthesis)return;
  try{
    const u=new SpeechSynthesisUtterance(text);
    u.lang='zh-CN'; u.rate=0.85; u.pitch=1;
    if(!afterCurrent) window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }catch(e){}
}

function speakAnnouncement(announcementText, charText) {
  if(!window.speechSynthesis) return;
  speakChinese(announcementText, () => {
    if(charText) {
      setTimeout(() => speakChinese(charText), 200);
    }
  });
}
function speakChar(){
  if (G._battleCrySpeaking || G._waitingForAnnounce) return;
  if(G.currentQ)speakChinese(G.currentQ.char.hz);
}
function speakModal(){speakChinese(document.getElementById('modal-char').textContent);}
