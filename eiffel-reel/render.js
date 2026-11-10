// usage: node render.js preview <out.png>   |   node render.js video <out.mp4>
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path'), fs = require('fs');
(async () => {
  const [mode, out] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  p.on('pageerror', e => console.error('PAGE ERROR', e.message));
  await p.goto('http://127.0.0.1:8767/eiffel.html', { waitUntil: 'networkidle' });
  const total = await p.evaluate(() => window.ready);
  const fps = await p.evaluate(() => window.FPS);
  console.log('total', total.toFixed(2), 's');
  if (mode === 'preview') {
    const times = JSON.parse(process.argv[4] || '[]');
    const dir = out; fs.mkdirSync(dir, { recursive: true });
    for (const t of times) { const d = await p.evaluate(t => window.grab(t), t);
      fs.writeFileSync(`${dir}/f_${String(t).padStart(5, '0')}.jpg`, Buffer.from(d.split(',')[1], 'base64')); }
  } else {
    const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const n = Math.round(total * fps);
    for (let i = 0; i < n; i++) {
      const d = await p.evaluate(t => window.grab(t), i / fps);
      if (!ff.stdin.write(Buffer.from(d.split(',')[1], 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 300 === 0) console.log('frame', i, '/', n);
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
  }
  await b.close();
})();
