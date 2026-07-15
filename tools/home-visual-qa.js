'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'mockups');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9337;
const BASE = 'http://127.0.0.1:8080/index.html?dev';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForJson(url, attempts = 80) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch (_) { /* Chrome is still starting. */ }
    await sleep(100);
  }
  throw new Error(`Chrome DevTools no respondió en ${url}`);
}

class Cdp {
  constructor(url) {
    this.id = 0;
    this.pending = new Map();
    this.events = new Map();
    this.ws = new WebSocket(url);
  }
  async open() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const handler = this.pending.get(message.id);
        if (!handler) return;
        this.pending.delete(message.id);
        if (message.error) handler.reject(new Error(message.error.message));
        else handler.resolve(message.result);
        return;
      }
      const listeners = this.events.get(message.method) || [];
      listeners.splice(0).forEach((resolve) => resolve(message.params));
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  once(method, timeout = 8000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timeout esperando ${method}`)), timeout);
      const listeners = this.events.get(method) || [];
      listeners.push((value) => { clearTimeout(timer); resolve(value); });
      this.events.set(method, listeners);
    });
  }
  close() { this.ws.close(); }
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'Runtime.evaluate falló');
  return result.result.value;
}

async function ready(cdp) {
  for (let i = 0; i < 80; i += 1) {
    const state = await evaluate(cdp, `({ready:document.readyState,home:!document.querySelector('#screen-start')?.hidden})`);
    if (state.ready === 'complete' && state.home) return;
    await sleep(100);
  }
  throw new Error('Inicio no llegó a estar visible');
}

async function seed(cdp) {
  await evaluate(cdp, `(() => {
    localStorage.setItem('cv_user', 'Jugador');
    localStorage.setItem('cv_tut', '1');
    localStorage.setItem('cv_best', '3571');
    localStorage.setItem('cv_profile', JSON.stringify({name:'Jugador', color:'#00d0ff'}));
    // Estado válido de nivel 1: conserva el 35 % visual de la referencia sin
    // fabricar un XP mayor que el umbral real del juego (300).
    localStorage.setItem('cv_meta', JSON.stringify({xp:105, level:1, coins:1000, gems:30, streak:{count:0,date:''}}));
    return true;
  })()`);
}

async function navigateHome(cdp) {
  const loaded = cdp.once('Page.loadEventFired');
  await cdp.send('Page.navigate', { url: BASE });
  await loaded;
  await seed(cdp);
  const reloaded = cdp.once('Page.loadEventFired');
  await cdp.send('Page.reload', { ignoreCache: true });
  await reloaded;
  await ready(cdp);
  await sleep(250);
}

async function viewport(cdp, width, height, scale = 1) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: scale, mobile: true,
    screenWidth: width, screenHeight: height,
  });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await sleep(180);
}

async function screenshot(cdp, name) {
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  const target = path.join(OUT, name);
  fs.writeFileSync(target, Buffer.from(shot.data, 'base64'));
  return target;
}

async function audit(cdp) {
  return evaluate(cdp, `(() => {
    const ids = ['#screen-start','.appbar','.daily-banner','.home-play-zone','#btn-play','.home-context','.home-cards','.home-today','.bottom-nav'];
    const rect = (el) => { const r=el.getBoundingClientRect(); return {x:+r.x.toFixed(1),y:+r.y.toFixed(1),w:+r.width.toFixed(1),h:+r.height.toFixed(1),bottom:+r.bottom.toFixed(1)}; };
    const boxes = Object.fromEntries(ids.map((selector) => [selector, rect(document.querySelector(selector))]));
    const visible = [...document.querySelectorAll('#screen-start button')].filter((el) => {
      const r=el.getBoundingClientRect(), s=getComputedStyle(el);
      return !el.hidden && s.display!=='none' && r.width>0 && r.height>0 && r.bottom>0 && r.top<innerHeight;
    });
    // El eje vertical de .home-scroll es desplazable en pantallas bajas. Un
    // control fuera del viewport actual no es un recorte si se alcanza al
    // desplazar; aquí auditamos el defecto real: desbordamiento horizontal.
    const clipped = visible.filter((el) => { const r=el.getBoundingClientRect(); return r.left < -0.5 || r.right > innerWidth + .5; }).map((el) => ({id:el.id,act:el.dataset.act,box:rect(el)}));
    const overlaps = [];
    for (let i=0;i<visible.length;i++) for (let j=i+1;j<visible.length;j++) {
      const first=visible[i], second=visible[j];
      const actions=[first.dataset.act,second.dataset.act];
      // El lápiz está deliberadamente superpuesto al bloque de perfil. En
      // scroll corto el contenido pasa por debajo de cabecera/nav fijas.
      const intentionalProfile=actions.includes('profile') && actions.includes('edit-name');
      const scrollAgainstChrome=(first.closest('.home-scroll') && (second.closest('.appbar') || second.closest('.bottom-nav') || second.classList.contains('home-bell')))
        || (second.closest('.home-scroll') && (first.closest('.appbar') || first.closest('.bottom-nav') || first.classList.contains('home-bell')));
      if (intentionalProfile || scrollAgainstChrome) continue;
      const a=visible[i].getBoundingClientRect(), b=visible[j].getBoundingClientRect();
      const area=Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
      if (area > 80 && !visible[i].contains(visible[j]) && !visible[j].contains(visible[i])) overlaps.push([visible[i].id||visible[i].dataset.act,visible[j].id||visible[j].dataset.act,Math.round(area)]);
    }
    return {
      viewport:{w:innerWidth,h:innerHeight,dpr:devicePixelRatio},
      document:{scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight},
      homeScroll:{clientHeight:document.querySelector('.home-scroll').clientHeight,scrollHeight:document.querySelector('.home-scroll').scrollHeight},
      boxes, clipped, overlaps,
      text:{name:document.querySelector('.appbar-name')?.textContent,coins:document.querySelector('[data-econ-num=coins]')?.textContent,gems:document.querySelector('[data-econ-num=gems]')?.textContent,best:document.querySelector('#start-best')?.textContent},
      errors:window.__qaErrors || []
    };
  })()`);
}

async function interactionAudit(cdp) {
  return evaluate(cdp, `(async () => {
    const result={};
    const click=(selector)=>document.querySelector(selector)?.click();
    const wait=(ms=60)=>new Promise(r=>setTimeout(r,ms));
    const modalOpen=(selector)=>!document.querySelector(selector)?.hidden;
    const close=(selector)=>document.querySelector(selector+' [data-close]')?.click();
    click('#btn-play'); await new Promise(r=>setTimeout(r,80));
    result.play=!document.querySelector('#screen-modes').hidden;
    document.querySelector('#modes-back')?.click(); await new Promise(r=>setTimeout(r,50));
    click('#home-classic-card'); await new Promise(r=>setTimeout(r,80));
    result.classic=!document.querySelector('#screen-worlds').hidden;
    if (window.__cv) window.__cv.refreshStart();
    document.querySelectorAll('.screen').forEach(s=>s.hidden=s.id!=='screen-start');
    click('#home-daily-card'); await new Promise(r=>setTimeout(r,80));
    result.tournament=!document.querySelector('#modal-daily').hidden;
    document.querySelector('#modal-daily [data-close]')?.click();
    click('[data-act=open-guide]'); await new Promise(r=>setTimeout(r,80));
    result.guide=!document.querySelector('#modal-how').hidden;
    document.querySelector('#modal-how [data-close]')?.click();
    click('[data-act=settings]'); await new Promise(r=>setTimeout(r,80));
    result.settings=!document.querySelector('#modal-settings').hidden;
    close('#modal-settings'); await wait();

    click('[data-act=profile]'); await wait();
    result.profile=modalOpen('#modal-medals');
    close('#modal-medals'); await wait();

    const nativePrompt=window.prompt;
    window.prompt=()=> 'Jugador QA';
    click('[data-act=edit-name]'); await wait();
    result.rename=document.querySelector('#screen-start .appbar-name')?.textContent==='Jugador QA';
    window.prompt=nativePrompt;

    click('[data-act=buy-coins]'); await wait();
    result.coinsShop=modalOpen('#modal-shop');
    close('#modal-shop'); await wait();
    click('[data-act=buy-gems]'); await wait();
    result.gemsShop=modalOpen('#modal-shop');
    close('#modal-shop'); await wait();

    click('.home-bell'); await wait();
    result.missions=modalOpen('#modal-missions');
    close('#modal-missions'); await wait();

    const beforeCoins=Number((document.querySelector('#screen-start [data-econ-num=coins]')?.textContent||'0').replace(/\D/g,''));
    click('[data-act=claim-daily]'); await wait(100);
    const afterCoins=Number((document.querySelector('#screen-start [data-econ-num=coins]')?.textContent||'0').replace(/\D/g,''));
    result.dailyReward=afterCoins>beforeCoins && document.querySelector('[data-act=claim-daily]')?.disabled;

    click('[data-act=home-daily]'); await wait();
    result.daily=modalOpen('#modal-daily');
    close('#modal-daily'); await wait();
    click('[data-act=open-chests]'); await wait();
    result.chests=modalOpen('#modal-chests');
    close('#modal-chests'); await wait();
    click('[data-act=nav-medals]'); await wait();
    result.achievements=modalOpen('#modal-medals');
    close('#modal-medals'); await wait();
    click('[data-act=nav-shop]'); await wait();
    result.shop=modalOpen('#modal-shop');
    close('#modal-shop'); await wait();

    const toastCount=()=>document.querySelectorAll('#toasts .toast').length;
    let beforeToasts=toastCount();
    click('[data-act=home-multi]'); await wait();
    result.multiplayerNotice=toastCount()>beforeToasts;
    beforeToasts=toastCount();
    click('[data-act=home-friends]'); await wait();
    result.friendsNotice=toastCount()>beforeToasts;
    click('[data-act=nav-home]'); await wait();
    result.home=!document.querySelector('#screen-start').hidden;
    return result;
  })()`);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const profile = path.join(os.tmpdir(), `cv-home-qa-${Date.now()}`);
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--hide-scrollbars',
    'about:blank',
  ], { stdio: 'ignore' });
  try {
    await waitForJson(`http://127.0.0.1:${PORT}/json/version`);
    const tab = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(BASE)}`, { method: 'PUT' }).then((r) => r.json());
    const cdp = new Cdp(tab.webSocketDebuggerUrl);
    await cdp.open();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__qaErrors=[];addEventListener('error',e=>__qaErrors.push(String(e.message)));addEventListener('unhandledrejection',e=>__qaErrors.push(String(e.reason)));` });

    const results = {};
    for (const spec of [
      { width: 854, height: 1280, scale: 1, name: 'home-actual-854x1280.png' },
      { width: 1024, height: 1536, scale: 1, name: 'home-actual-1024x1536.png' },
      { width: 390, height: 844, scale: 1, name: 'home-actual-390x844.png' },
      { width: 360, height: 640, scale: 1, name: 'home-actual-360x640.png' },
    ]) {
      await viewport(cdp, spec.width, spec.height, spec.scale);
      await navigateHome(cdp);
      results[`${spec.width}x${spec.height}`] = await audit(cdp);
      await screenshot(cdp, spec.name);
      if (spec.width === 360) {
        await evaluate(cdp, `(() => { const el=document.querySelector('.home-scroll'); el.scrollTop=el.scrollHeight; return {top:el.scrollTop,max:el.scrollHeight-el.clientHeight}; })()`);
        await sleep(120);
        results['360x640-bottom'] = await audit(cdp);
        await screenshot(cdp, 'home-actual-360x640-bottom.png');
      }
    }
    await viewport(cdp, 390, 844, 1);
    await navigateHome(cdp);
    results.interactions = await interactionAudit(cdp);
    cdp.close();
    process.stdout.write(JSON.stringify(results, null, 2));
  } finally {
    chrome.kill();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
