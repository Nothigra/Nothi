// the panel's own download code, checked on Windows and macOS: every AI file from its sources
const os = require('os'), path = require('path'), fs = require('fs');
const VERSION = 'ci', IS_MAC = process.platform === 'darwin', nreq = require, tr = (x) => x;
const AID = fs.mkdtempSync(path.join(os.tmpdir(), 'nl-ai-'));
const nlDir = () => AID, extDir = () => AID, binPath = () => null;
const mkState = { q: 'balanced' };
  const httpsGet = (u, headers, cb) => require('https').get(Object.assign(require('url').parse(u), { headers }), cb);
  function download(url, dest, onProgress, job) {
    const fs = nreq('fs'), urlm = nreq('url');
    return new Promise((resolve, reject) => {
      const go = (u, hops) => {
        const req = httpsGet(u, { 'User-Agent': `NothiToolkit/${VERSION}` }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume(); if (hops > 8) return reject(new Error('Too many redirects'));
            return go(urlm.resolve(u, res.headers.location), hops + 1);
          }
          if (res.statusCode !== 200) { res.resume(); return reject(new Error('Download failed (HTTP ' + res.statusCode + ')')); }
          const total = Number(res.headers['content-length']) || 0, tmp = dest + '.part', out = fs.createWriteStream(tmp);
          let got = 0;
          job.abort = () => { req.abort(); out.destroy(); try { fs.unlinkSync(tmp); } catch { /* nothing */ } reject(new Error('CANCELLED')); };
          res.on('data', (c) => { got += c.length; if (onProgress) onProgress(got, total); });
          res.on('error', reject); out.on('error', reject);
          res.pipe(out);
          out.on('close', () => {
            if (total && got < total) return reject(new Error('The download was cut. Try again'));
            try { if (fs.existsSync(dest)) fs.unlinkSync(dest); fs.renameSync(tmp, dest); resolve(); } catch (e) { reject(e); }
          });
        });
        req.on('error', (e) => reject(new Error('No connection (' + e.message + ')')));
        req.setTimeout(45000, () => req.abort());
      };
      go(url, 0);
    });
  }  function downloadSys(url, dest, onProgress, job, expect) {
    const fs = nreq('fs'), cp = nreq('child_process'), tmp = dest + '.part';
    const ua = `NothiToolkit/${VERSION}`;
    const tries = IS_MAC ? [['/usr/bin/curl', ['-L', '--fail', '-sS', '--retry', '2', '-A', ua, '-o', tmp, url]]]
      : [[(process.env.SystemRoot || 'C:\\Windows') + '\\System32\\curl.exe', ['-L', '--fail', '-sS', '--retry', '2', '--ssl-no-revoke', '-A', ua, '-o', tmp, url]],
        ['powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', `$ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -UserAgent '${ua}' -Uri '${url.replace(/'/g, "''")}' -OutFile '${tmp.replace(/'/g, "''")}'`]]];
    const one = ([cmd, args]) => new Promise((resolve, reject) => {
      let p; try { p = cp.spawn(cmd, args, { windowsHide: true }); } catch (e) { return reject(e); }
      let err = '', done = false;
      const tick = setInterval(() => { try { const g = fs.statSync(tmp).size; if (onProgress) onProgress(g, expect || 0); } catch { /* not started */ } }, 400);
      job.abort = () => { done = true; clearInterval(tick); try { p.kill(); } catch { /* gone */ } try { fs.unlinkSync(tmp); } catch { /* nothing */ } reject(new Error('CANCELLED')); };
      p.stderr.on('data', (c) => { err = (err + c).slice(-600); });
      p.on('error', (e) => { clearInterval(tick); if (!done) reject(e); });
      p.on('close', (code) => {
        clearInterval(tick); if (done) return;
        if (code !== 0) { try { fs.unlinkSync(tmp); } catch { /* nothing */ } return reject(new Error(err.trim().split('\n').pop() || 'code ' + code)); }
        try { if (fs.existsSync(dest)) fs.unlinkSync(dest); fs.renameSync(tmp, dest); resolve(); } catch (e) { reject(e); }
      });
    });
    return tries.reduce((chain, t) => chain.catch((e) => { if (e && e.message === 'CANCELLED') throw e; return one(t); }), Promise.reject(new Error('start')));
  }  async function downloadAny(url, dest, onProgress, job, expect) {
    try { return await download(url, dest, onProgress, job); } catch (e) {
      if (e.message === 'CANCELLED') throw e;
      try { return await downloadSys(url, dest, onProgress, job, expect); } catch (e2) { if (e2.message === 'CANCELLED') throw e2; throw e; }
    }
  }  // ═════════════ AI FILES. The engines and the small models ship inside the panel (bin/). The big models (mask,
  // voice) are downloaded once into the Nothi Labs folder: from nothilabs.com (in parts of 24 MB), else from their
  // public home on Hugging Face (or its mirror). Each file is checked (size and SHA-256) before it is used.
  const AI_SITE = 'https://nothilabs.com/ai/', AI_GH = 'https://github.com/Nothigra/Nothi/releases/download/ai/';
  const AI_SPECS = {
    model: { name: 'birefnet_lite.onnx', size: 224005088, sha256: '5600024376f572a557870a5eb0afb1e5961636bef4e1e22132025467d0f03333', parts: 10 },
    modnet: { name: 'modnet.onnx', size: 25888640, sha256: '07c308cf0fc7e6e8b2065a12ed7fc07e1de8febb7dc7839d7b7f15dd66584df9', parts: 2 },
    voice: { name: 'voice_htdemucs_ft_vocals.bin', size: 83994361, sha256: '19186500a45a551a034d96e9500415ebe73c8bd570bf55337ddc8cc8f53a9120', parts: 4 },
  };
  const AI_ALT = {
    model: ['https://huggingface.co/onnx-community/BiRefNet_lite-ONNX/resolve/main/onnx/model.onnx', 'https://hf-mirror.com/onnx-community/BiRefNet_lite-ONNX/resolve/main/onnx/model.onnx'],
    modnet: ['https://huggingface.co/Xenova/modnet/resolve/main/onnx/model.onnx', 'https://hf-mirror.com/Xenova/modnet/resolve/main/onnx/model.onnx'],
    voice: ['https://huggingface.co/datasets/Retrobear/demucs.cpp/resolve/main/ggml-model-htdemucs_ft_vocals-4s-f16.bin', 'https://hf-mirror.com/datasets/Retrobear/demucs.cpp/resolve/main/ggml-model-htdemucs_ft_vocals-4s-f16.bin'],
  };
  // a tool shipped in the panel (bin/win or bin/mac); on a Mac the folder is cleared of the download quarantine once
  let binClean = false;
  function toolPath(name) {
    const p = binPath(name); if (!p) return null;
    if (IS_MAC && !binClean) { binClean = true; try { nreq('child_process').execFileSync('/usr/bin/xattr', ['-dr', 'com.apple.quarantine', nreq('path').dirname(p)], { stdio: 'ignore' }); } catch { /* not quarantined */ } }
    return p;
  }
  const modelsDir = () => nreq('path').join(extDir(), 'bin', 'models');
  // ── colours: a frame read here must have exactly the colours After Effects shows. A video stores its picture as
  // Y'CbCr: the way back to RGB (BT.709 for HD, BT.601 for SD) and the range of the values (video 16-235 or full
  // 0-255) come from the file's tags, else the same guess as After Effects. Every conversion says them out loud.
  const vidColors = {};
  function srcColor(ff, file) {
    if (vidColors[file]) return vidColors[file];
    let txt = '';
    try { txt = String(nreq('child_process').spawnSync(ff, ['-hide_banner', '-i', file], { windowsHide: true, timeout: 20000 }).stderr || ''); } catch { /* the guess below */ }
    const line = (/Stream #[^\n]*Video:[^\n]*/.exec(txt) || [''])[0], pm = /Video: [^,]+, ([a-z0-9_]+)(?:\(([^)]*)\))?/.exec(line) || [];
    const fmt = pm[1] || '', tags = (pm[2] || '').split(/[,/]\s*/).map((x) => x.trim()), wh = /, (\d{2,5})x(\d{2,5})/.exec(line), H = wh ? Number(wh[2]) : 1080;
    const tm = tags.find((x) => /^(bt709|bt470bg|smpte170m|bt601|bt2020nc|bt2020c|fcc|smpte240m)$/.test(x));
    const m = tm ? ({ bt470bg: 'bt601', smpte170m: 'bt601', bt601: 'bt601', bt2020nc: 'bt2020', bt2020c: 'bt2020' }[tm] || tm) : H >= 720 ? 'bt709' : 'bt601';
    const r = tags.includes('pc') || /^yuvj/.test(fmt) ? 'pc' : 'tv';
    return (vidColors[file] = { m, r });
  }
  // swscale's careful mode: its quick one shifts colours by a level or two
  const ACC = '+accurate_rnd+full_chroma_int';
  const vfIn = (ff, file) => { const c = srcColor(ff, file); return `in_color_matrix=${c.m}:in_range=${c.r}:flags=bicubic${ACC}`; };
  // JPEG frames between the tools: BT.601, full range (what every JPEG reader expects)
  const JPG_OUT = 'out_color_matrix=bt601:out_range=pc', JPG_IN = 'in_color_matrix=bt601:in_range=pc';
  const withFlags = (pre) => (/flags=/.test(pre || '') ? pre : [pre, `flags=bicubic${ACC}`].filter(Boolean).join(':'));
  // a clip written for After Effects: ProRes 422 HQ in BT.709, tagged (else a Motion JPEG .mov). pre: the scale's
  // other options (size, how the frames coming in are coded)
  const CLIP_TRIES = (pre) => [
    ['mov', `scale=${withFlags(pre)}:out_color_matrix=bt709:out_range=tv,format=yuv422p10le`, ['-c:v', 'prores_ks', '-profile:v', '3', '-vendor', 'apl0', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv']],
    ['mov', `scale=${withFlags(pre)}:${JPG_OUT},format=yuvj444p`, ['-c:v', 'mjpeg', '-q:v', '2', '-colorspace', 'bt470bg', '-color_range', 'pc']],
  ];
  // Fast: MODNet (small, quick on any computer). Balanced and Best: BiRefNet (the whole body, fine hair; best on a graphics card)
  const AI_SETS = { mask: ['model'], maskFast: ['modnet'], voice: ['voice'] };
  const mkSet = () => (mkState.q === 'fast' ? 'maskFast' : 'mask');
  function aiDir() { return nlDir('ai'); }
  function aiOk(F) {
    const fs = nreq('fs'), path = nreq('path'), f = path.join(aiDir(), F.name), mark = f + '.ok';
    try { const st = fs.statSync(f); if (st.size !== F.size) return false; return fs.readFileSync(mark, 'utf8') === `${F.size}:${F.sha256}:${Math.round(st.mtimeMs)}`; } catch { return false; }
  }
  function aiCheck(F) {
    const fs = nreq('fs'), path = nreq('path'), crypto = nreq('crypto'), f = path.join(aiDir(), F.name);
    const st = fs.statSync(f); if (st.size !== F.size) return false;
    if (F.sha256) {
      const h = crypto.createHash('sha256'), fd = fs.openSync(f, 'r'), b = Buffer.alloc(1 << 22); let n;
      while ((n = fs.readSync(fd, b, 0, b.length, null)) > 0) h.update(n === b.length ? b : b.subarray(0, n));
      fs.closeSync(fd); if (h.digest('hex') !== F.sha256) return false;
    }
    fs.writeFileSync(f + '.ok', `${F.size}:${F.sha256}:${Math.round(fs.statSync(f).mtimeMs)}`);
    if (IS_MAC) { try { fs.chmodSync(f, 0o755); } catch { /* fine */ } }
    return true;
  }
  // keys: 'mask' / 'voice' or a list of file keys. Resolves { key: path }.
  async function ensureFiles(keys, onMsg, job) {
    const fs = nreq('fs'), path = nreq('path'), list = (typeof keys === 'string' ? AI_SETS[keys] : keys.reduce((a, k) => a.concat(AI_SETS[k] || [k]), [])).map((k) => [k, AI_SPECS[k]]);
    const out = {}, need = list.filter(([, F]) => !aiOk(F)), total = need.reduce((a, [, F]) => a + F.size, 0);
    let before = 0;
    const msg = (got) => onMsg(`Getting the AI files (only once) · ${total ? Math.round(((before + got) / total) * 100) : 100}%`, total ? ((before + got) / total) * 100 : 100);
    for (const [k, F] of list) {
      const dest = path.join(aiDir(), F.name); out[k] = dest;
      if (aiOk(F)) continue;
      let done = false; const tried = [];
      const note = (u, e) => tried.push(`${u} → ${e ? e.message || e : 'the file is not the right one (size or SHA-256)'}`);
      // 1. nothilabs.com, in parts (or whole when small)
      try {
        if (F.parts > 1) {
          const tmp = dest + '.part'; try { fs.unlinkSync(tmp); } catch { /* none */ }
          let got = 0;
          for (let i = 0; i < F.parts; i++) {
            const p = `${dest}.p${i}`;
            await downloadAny(`${AI_SITE}${F.name}.${String(i).padStart(2, '0')}`, p, (g) => msg(got + g), job);
            const b = fs.readFileSync(p); fs.appendFileSync(tmp, b); got += b.length; fs.unlinkSync(p);
          }
          try { fs.unlinkSync(dest); } catch { /* none */ } fs.renameSync(tmp, dest);
        } else await downloadAny(AI_SITE + F.name, dest, (g) => msg(g), job, F.size);
        done = aiCheck(F); if (!done) note(AI_SITE + F.name);
      } catch (e) { if (e.message === 'CANCELLED') throw e; note(AI_SITE + F.name, e); }
      // 2. its public home (Hugging Face, then its mirror), then the GitHub mirror: the whole file
      for (const u of (AI_ALT[k] || []).concat([AI_GH + F.name])) {
        if (done) break;
        try { await downloadAny(u, dest, (g) => msg(g), job, F.size); done = aiCheck(F); if (!done) note(u); } catch (e) { if (e.message === 'CANCELLED') throw e; note(u, e); }
      }
      if (!done) {
        try { fs.unlinkSync(dest); } catch { /* nothing */ }
        try { fs.writeFileSync(path.join(aiDir(), 'download-log.txt'), `${new Date().toISOString()} ${F.name}\n${tried.join('\n')}\n`); } catch { /* fine */ }
        const last = (tried[tried.length - 1] || '').split(' → ').pop().replace(/\s+/g, ' ').slice(0, 120);
        throw new Error(`${tr('Couldn’t get the AI files: check the connection and try again')}${last ? ` · ${last}` : ''} · ${tr('Details in Nothi Labs › ai › download-log.txt')}`);
      }
      before += F.size;
    }
    return out;
  }


const _dA = downloadAny;
downloadAny = async (u, ...a) => { const t = Date.now(); try { const r = await _dA(u, ...a); console.log('  got', u.split('?')[0], Math.round((Date.now() - t) / 100) / 10 + 's'); return r; } catch (e) { console.log('  failed', u.split('?')[0], e.message); throw e; } };
(async () => {
  const which = process.argv[2] || 'modnet', only = process.argv[3]; // only: site | alt (to test one source)
  const job = {}; let lastP = -10;
  try {
    const t0 = Date.now();
    const out = await ensureFiles([which], (t, p) => { if (p - lastP >= 10) { lastP = p; console.log(t); } }, job);
    console.log('OK', which, out[which], fs.statSync(out[which]).size, Math.round((Date.now() - t0) / 1000) + 's');
  } catch (e) { console.log('FAIL', which, e.message); try { console.log(fs.readFileSync(path.join(AID, 'download-log.txt'), 'utf8')); } catch {} }
})();
