(function () {
  var TIKWM = 'https://www.tikwm.com/api/?hd=1&url=';

  var $ = function (id) { return document.getElementById(id); };
  var urlBox = $('url');
  var form = $('form');
  var goBtn = $('go');
  var statusEl = $('status');
  var resultEl = $('result');
  var coverEl = $('cover');
  var titleEl = $('title');
  var actionsEl = $('actions');

  function setStatus(msg, err) {
    statusEl.textContent = msg || '';
    statusEl.className = err ? 'err' : '';
  }

  function extractUrl(raw) {
    var text = String(raw || '').trim();
    if (!text) return '';
    var matches = text.match(/https?:\/\/[^\s<>"']+/gi) || [];
    var cleaned = matches.map(function (u) { return u.replace(/[.,;!?）】\]]+$/g, ''); });
    var prefer = cleaned.filter(function (u) {
      return /tiktok|douyin|instagram|youtube|youtu\.be|facebook|fb\.watch|fb\.com|twitter|x\.com|t\.me|telegram|vimeo|reddit|vm\.tiktok|vt\.tiktok/i.test(u);
    });
    if (prefer[0]) return prefer[0];
    if (cleaned[0]) return cleaned[0];
    if (/^https?:\/\//i.test(text)) return text;
    return '';
  }

  function inputFromLocation() {
    var q = new URLSearchParams(location.search).get('url') || '';
    var hash = '';
    if (location.hash) {
      var h = location.hash.replace(/^#/, '');
      if (h.indexOf('url=') === 0) hash = decodeURIComponent(h.slice(4));
      else {
        var hp = new URLSearchParams(h);
        hash = hp.get('url') || '';
      }
    }
    return q || hash || '';
  }

  function kind(u) {
    try {
      var h = new URL(u).hostname.replace(/^www\./, '').toLowerCase();
      if (/tiktok|douyin/.test(h)) return 'tiktok';
      if (h === 't.me' || /telegram/.test(h)) return 'telegram';
      if (/instagram/.test(h)) return 'instagram';
      if (/youtube|youtu\.be/.test(h)) return 'youtube';
      if (h === 'x.com' || /twitter/.test(h)) return 'x';
      if (/facebook\.com$|^fb\.watch$|^fb\.com$|^fb\.me$/.test(h)) return 'facebook';
    } catch (e) {}
    return 'other';
  }

  function telegramEmbed(u) {
    var url = new URL(u);
    url.search = '';
    url.hash = '';
    url.protocol = 'https:';
    if (!url.pathname.endsWith('/')) {
      /* keep */
    }
    return url.toString().split('?')[0] + '?embed=1&mode=tme';
  }

  function isPrivateTelegram(u) {
    return /t\.me\/c\/\d+/i.test(u) || /telegram\.me\/c\/\d+/i.test(u);
  }

  var COBALT = [
    'https://rue-cobalt.xenon.zone/',
    'https://cobaltapi.cjs.nz/'
  ];

  var PROXIES = [
    function (u) { return { url: 'https://api.allorigins.win/get?url=' + encodeURIComponent(u), json: true }; },
    function (u) { return { url: 'https://cors.eu.org/' + u }; },
    function (u) { return { url: 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u) }; },
    function (u) { return { url: 'https://corsproxy.io/?url=' + encodeURIComponent(u) }; }
  ];

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function fail(msg) { var e = new Error(msg); e.friendly = true; return e; }

  // Turn raw English / Safari errors into Vietnamese.
  function friendly(e, fallback) {
    if (e && e.friendly) return e.message;
    var m = String((e && e.message) || e || '');
    if (/did not match the expected pattern|Unexpected token|JSON|Url parsing is failed|check url/i.test(m)) {
      return fallback || 'Máy chủ tải trả về dữ liệu lạ, chưa đọc được link này. Thử lại sau vài giây.';
    }
    if (/Load failed|Failed to fetch|NetworkError|network|abort|timeout/i.test(m)) {
      return 'Mạng chập chờn hoặc máy chủ tải đang bận. Thử lại sau vài giây.';
    }
    if (/HTTP 4(29|03)|rate/i.test(m)) return 'Máy chủ tải đang quá tải. Đợi chút rồi thử lại.';
    return fallback || 'Không tải được link này. Thử lại sau vài giây.';
  }

  async function fetchWithTimeout(url, opts, ms) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var t = ctl ? setTimeout(function () { ctl.abort(); }, ms || 20000) : null;
    try {
      return await fetch(url, Object.assign({}, opts || {}, ctl ? { signal: ctl.signal } : {}));
    } finally { if (t) clearTimeout(t); }
  }

  async function safeJson(r) {
    var t = await r.text();
    try { return JSON.parse(t); } catch (e) { return null; }
  }

  async function fetchText(url, check) {
    var last = new Error('Không đọc được trang');
    var tries = [{ url: url, direct: true }].concat(PROXIES.map(function (p) { return p(url); }));
    for (var i = 0; i < tries.length; i++) {
      try {
        var r = await fetchWithTimeout(tries[i].url, {}, 20000);
        if (!r.ok) { last = new Error('HTTP ' + r.status); continue; }
        var t;
        if (tries[i].json) {
          var d = await safeJson(r);
          t = d && d.contents;
        } else {
          t = await r.text();
        }
        if (t && t.length > 40 && (!check || check(t))) return t;
      } catch (e) { last = e; }
    }
    throw last;
  }

  // ---------- cobalt (CORS-enabled public instances) ----------
  var COBALT_ERR = {
    'fetch.short_link': 'Link rút gọn này không mở ra video nào. Mở clip trong app, bấm Chia sẻ → Sao chép liên kết lại rồi thử.',
    'content.post.private': 'Bài này ở chế độ riêng tư hoặc cần đăng nhập. K.Clip chỉ tải được video công khai.',
    'content.video.private': 'Video này ở chế độ riêng tư hoặc cần đăng nhập. K.Clip chỉ tải được video công khai.',
    'content.video.unavailable': 'Video không còn hoặc không xem được công khai.',
    'content.post.unavailable': 'Bài viết không còn hoặc không xem được công khai.',
    'content.video.age': 'Video giới hạn độ tuổi, cần đăng nhập nên K.Clip không tải được.',
    'content.video.region': 'Video bị chặn theo khu vực, máy chủ tải không xem được.',
    'fetch.empty': 'Không tìm thấy video trong link này (có thể riêng tư hoặc cần đăng nhập).'
  };

  function cobaltMessage(code) {
    code = String(code || '').replace(/^error\.api\./, '');
    for (var k in COBALT_ERR) if (code.indexOf(k) === 0) return COBALT_ERR[k];
    return '';
  }

  async function resolveCobalt(url) {
    var last = null, lastMsg = '';
    for (var i = 0; i < COBALT.length; i++) {
      try {
        var r = await fetchWithTimeout(COBALT[i], {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: url, videoQuality: 'max', filenameStyle: 'basic' })
        }, 30000);
        var d = await safeJson(r);
        if (!d) { last = new Error('HTTP ' + r.status); continue; }
        if (d.status === 'redirect' || d.status === 'tunnel') {
          return { title: '', items: [{ type: 'video', href: d.url, name: d.filename || 'kclip.mp4' }] };
        }
        if (d.status === 'picker' && d.picker && d.picker.length) {
          return {
            title: '',
            items: d.picker.map(function (p, j) {
              return { type: p.type === 'photo' ? 'image' : 'video', href: p.url, name: 'kclip-' + (j + 1) + (p.type === 'photo' ? '.jpg' : '.mp4'), cover: p.thumb };
            })
          };
        }
        var code = d.error && d.error.code;
        var msg = cobaltMessage(code);
        if (msg) lastMsg = msg;
        last = new Error(code || 'cobalt error');
      } catch (e) { last = e; }
    }
    if (lastMsg) throw fail(lastMsg);
    throw last || new Error('cobalt failed');
  }

  // ---------- TikTok ----------
  function isShortTiktok(u) {
    return /^(vt|vm)\.tiktok\.com$/i.test(hostOf(u)) || /tiktok\.com\/t\//i.test(u);
  }

  function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch (e) { return ''; } }

  async function tikwmOnce(url) {
    var r = await fetchWithTimeout(TIKWM + encodeURIComponent(url), {}, 20000);
    var d = await safeJson(r);
    if (!d) throw new Error('tikwm non-json HTTP ' + r.status);
    if (d.code !== 0) throw new Error(d.msg || 'tikwm error');
    var data = d.data || {};
    var items = [];
    if (data.images && data.images.length) {
      data.images.forEach(function (src, i) {
        items.push({ type: 'image', href: src, name: 'kclip-' + (i + 1) + '.jpg' });
      });
    } else {
      var video = data.hdplay || data.play;
      if (!video) throw fail('Không tìm thấy bản không logo của clip này.');
      items.push({ type: 'video', href: video, name: 'kclip.mp4', cover: data.origin_cover || data.cover });
    }
    return { title: data.title || '', items: items };
  }

  function cleanTiktok(url) {
    try {
      var u = new URL(url);
      u.protocol = 'https:';
      if (isShortTiktok(url)) {
        u.search = '';
        u.hash = '';
        if (!/\/$/.test(u.pathname)) u.pathname += '/';
      }
      return u.toString();
    } catch (e) { return url; }
  }

  async function resolveTikwm(url) {
    url = cleanTiktok(url);
    var short = isShortTiktok(url);
    var waits = short ? [0, 3000, 4000] : [0, 1500];
    var last;
    for (var i = 0; i < waits.length; i++) {
      if (waits[i]) {
        setStatus('Đang lấy clip… (thử lại ' + i + ')');
        await sleep(waits[i]);
      }
      try { return await tikwmOnce(url); } catch (e) { if (e.friendly) throw e; last = e; }
    }
    // Fallback: cobalt (also removes the logo)
    var cobaltErr = null;
    try { return await resolveCobalt(url); } catch (e2) { cobaltErr = e2; }
    if (short) {
      throw fail('Link TikTok rút gọn này không mở ra clip nào (TikTok trả về trang chủ). Có thể clip đã bị xoá, để riêng tư, hoặc link bị chép thiếu. Mở clip trong TikTok → Chia sẻ → Sao chép liên kết rồi thử lại.');
    }
    if (cobaltErr && cobaltErr.friendly) throw cobaltErr;
    throw fail(friendly(last, 'Chưa lấy được clip TikTok này. Có thể clip riêng tư/đã xoá hoặc máy chủ tải đang bận — thử lại sau vài giây.'));
  }

  // ---------- Facebook ----------
  var FB_PRIVATE = 'K.Clip chỉ tải được video Facebook công khai. Video này có thể để riêng tư, trong nhóm kín hoặc cần đăng nhập nên không lấy được.';

  function fbVideoId(url) {
    var m = url.match(/[?&]v=(\d{6,})/) || url.match(/\/videos\/(?:[^\/?#]+\/)?(\d{6,})/) ||
      url.match(/\/reel\/(\d{6,})/) || url.match(/story_fbid=(\d{6,})/);
    return m ? m[1] : '';
  }

  function unescapeFb(s) {
    return s.replace(/\\u0025/gi, '%').replace(/\\u00253D/gi, '%3D').replace(/\\\//g, '/').replace(/\\u0026/gi, '&').replace(/&amp;/g, '&');
  }

  function pickFbMp4(html) {
    var keys = ['hd_src', 'browser_native_hd_url', 'playable_url_quality_hd', 'sd_src', 'browser_native_sd_url', 'playable_url'];
    for (var i = 0; i < keys.length; i++) {
      var m = html.match(new RegExp('"' + keys[i] + '"\\s*:\\s*"([^"]+)"'));
      if (m && /^https/.test(m[1])) return unescapeFb(m[1]);
    }
    return '';
  }

  async function resolveFacebookPlugin(url) {
    var id = fbVideoId(url);
    var hrefs = [];
    if (id) hrefs.push('https://www.facebook.com/watch/?v=' + id);
    hrefs.push(url);
    for (var i = 0; i < hrefs.length; i++) {
      var plugin = 'https://www.facebook.com/plugins/video.php?href=' + encodeURIComponent(hrefs[i]) + '&show_text=false';
      try {
        var html = await fetchText(plugin, function (t) { return /hd_src|sd_src|playable_url/.test(t); });
        var mp4 = pickFbMp4(html);
        if (mp4) return { title: '', items: [{ type: 'video', href: mp4, name: 'kclip-facebook.mp4' }] };
      } catch (e) {}
    }
    throw new Error('fb plugin failed');
  }

  async function resolveFacebook(url) {
    url = url.replace(/^http:/i, 'https:').replace(/\/\/(m|mbasic|web)\.facebook\.com/i, '//www.facebook.com');
    var cobaltErr = null;
    try { return await resolveCobalt(url); } catch (e) { cobaltErr = e; }
    try { return await resolveFacebookPlugin(url); } catch (e2) {}
    if (cobaltErr && cobaltErr.friendly) throw cobaltErr;
    throw fail(FB_PRIVATE + ' Nếu chắc là video công khai, đợi vài giây rồi thử lại (máy chủ tải có thể đang bận).');
  }

  function decodeAmp(s) { return String(s).replace(/&amp;/g, '&'); }

  async function resolveTelegram(url) {
    if (isPrivateTelegram(url)) {
      throw fail('Đây là link nhóm nội bộ. Group chặn tải thì K.Clip không vượt được hạn chế đó — chỉ tải kênh hoặc bài Telegram công khai.');
    }
    var html;
    try {
      html = await fetchText(telegramEmbed(url));
    } catch (e) {
      throw fail('Không đọc được bài Telegram này. Thử lại sau vài giây — chỉ tải được kênh/bài công khai.');
    }
    var found = [];
    var re = /(?:src|data-src)=["'](https:\/\/[^"']+)["']/gi;
    var m;
    while ((m = re.exec(html))) {
      var src = decodeAmp(m[1]);
      if (/telegram-cdn|cdn\d+\.telesco|\/file\/.+\.mp4|\.mp4(\?|$)/i.test(src)) found.push(src);
    }
    var uniq = found.filter(function (v, i, a) { return a.indexOf(v) === i; });
    if (!uniq.length) {
      throw fail('Không thấy clip công khai trong link Telegram này. Group chặn tải hoặc bài cần vào nhóm thì không tải được.');
    }
    return {
      title: '',
      items: uniq.map(function (href, i) {
        return { type: 'video', href: href, name: 'kclip-' + (i + 1) + '.mp4' };
      })
    };
  }

  async function resolve(url) {
    var k = kind(url);
    if (k === 'telegram') return resolveTelegram(url);
    if (k === 'tiktok') return resolveTikwm(url);
    if (k === 'facebook') return resolveFacebook(url);
    try {
      return await resolveCobalt(url);
    } catch (e) {
      if (e.friendly) throw e;
    }
    throw fail('Chưa tải được link này. K.Clip tải tốt nhất với TikTok (không logo), Facebook công khai và Telegram công khai.');
  }

  function showResult(info) {
    resultEl.hidden = false;
    titleEl.textContent = info.title || '';
    var cover = (info.items[0] && info.items[0].cover) || '';
    if (cover) {
      coverEl.src = cover;
      coverEl.hidden = false;
    } else {
      coverEl.removeAttribute('src');
      coverEl.hidden = true;
    }
    actionsEl.innerHTML = '';
    info.items.forEach(function (item, i) {
      var a = document.createElement('a');
      a.className = 'btn';
      a.href = item.href;
      a.target = '_blank';
      a.rel = 'noopener';
      a.download = item.name;
      a.textContent = info.items.length > 1
        ? ((item.type === 'image' ? 'Ảnh ' : 'Tải ') + (i + 1))
        : 'Tải xuống';
      actionsEl.appendChild(a);
    });
  }

  async function run(raw) {
    var url = extractUrl(raw);
    if (!url) { setStatus('Dán hoặc share một link clip trước.', true); return; }
    urlBox.value = url;
    goBtn.disabled = true;
    resultEl.hidden = true;
    setStatus('Đang lấy clip…');
    try {
      var info = await resolve(url);
      setStatus('Xong. Bấm Tải xuống — trên iPhone có thể mở clip rồi chọn Lưu Video.');
      showResult(info);
      if (info.items.length === 1) {
        setTimeout(function () { window.open(info.items[0].href, '_blank'); }, 250);
      }
    } catch (e) {
      setStatus(friendly(e), true);
    } finally {
      goBtn.disabled = false;
    }
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    run(urlBox.value);
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }

  var incoming = inputFromLocation();
  if (incoming) {
    urlBox.value = extractUrl(incoming) || incoming;
    run(incoming);
  }
})();
