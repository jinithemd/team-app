// renders a 1080x1920 cover image using the drawing functions in reel.html
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  p.on('pageerror', e => console.error('PAGE ERROR', e.message));
  await p.goto('file://' + path.resolve(__dirname, 'reel.html'), { waitUntil: 'networkidle' });
  await p.evaluate(() => window.ready);
  const data = await p.evaluate(() => {
    const t = 1.3;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none';
    CUR_BG = ['#2a63d8', '#0b1c55']; CUR_START = 0;
    background();
    // sun glow behind the wave
    const sg = ctx.createRadialGradient(W / 2, 760, 40, W / 2, 760, 700); sg.addColorStop(0, 'rgba(255,200,90,.55)'); sg.addColorStop(1, 'rgba(255,200,90,0)');
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    // giant beer wave towering behind the houses
    wave(880, t, AMBER, 60, 3.4);
    splash(W / 2, 900, t, .95, 60, 42, 1.8);
    splash(250, 950, t, .9, 30, 77, 1.2); splash(850, 940, t, .92, 30, 99, 1.2);
    houses(t, 1420, 3);
    flow(-200, W + 200, 1420, 110, t);
    { const g2 = ctx.createLinearGradient(0, 1700, 0, H); g2.addColorStop(0, '#d9780f'); g2.addColorStop(1, AMBER2); ctx.fillStyle = g2; ctx.fillRect(0, 1790, W, H - 1790); }
    splash(540, 1330, t, 1.0, 30, 123, 1.4);
    // dark band behind the title for legibility
    const tg = ctx.createLinearGradient(0, 200, 0, 820); tg.addColorStop(0, 'rgba(6,14,40,.85)'); tg.addColorStop(1, 'rgba(6,14,40,0)');
    ctx.fillStyle = tg; ctx.fillRect(0, 0, W, 900);
    // Kadha Files tab
    ctx.fillStyle = '#f2c46d'; ctx.beginPath(); ctx.roundRect(W / 2 - 170, 200, 340, 64, 14); ctx.fill();
    spaced('KADHA FILES', W / 2, 234, 32, OSW, INK, 8, 1, 600);
    spaced('LONDON · 1814', W / 2, 330, 44, OSW, DIM, 14, 1, 600);
    // title
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
    text('BEER', W / 2, 520, 250, ABRIL, CREAM); text('FLOOD', W / 2, 740, 250, ABRIL, GOLD); ctx.restore();
    // Malayalam hook in a pill, inside the grid-safe middle area
    const hook = 'റോഡിലൂടെ ഒഴുകിയത് ബിയർ!';
    ctx.save(); ctx.font = `800 64px ${ML}`; const w = ctx.measureText(hook).width; ctx.restore();
    ctx.fillStyle = 'rgba(12,8,4,.78)'; ctx.beginPath(); ctx.roundRect(W / 2 - w / 2 - 40, 1500, w + 80, 120, 60); ctx.fill();
    text(hook, W / 2, 1562, 64, ML, CREAM, 'center', 1, 800);
    text('🍺', W / 2 + w / 2 + 10, 1470, 90, 'serif', CREAM);
    // light vignette + grain
    const v = ctx.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * .8);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.35)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = .05; ctx.globalCompositeOperation = 'overlay'; ctx.drawImage(grains[0], 0, 0, W, H); ctx.restore();
    return cv.toDataURL('image/png');
  });
  fs.writeFileSync(path.resolve(__dirname, 'COVER_beer_flood.png'), Buffer.from(data.split(',')[1], 'base64'));
  await b.close();
})();
