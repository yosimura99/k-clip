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
      if (/facebook|fb\.watch|fb\.com/.test(h)) return 'facebook';
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

  async function fetchText(url) {
    var tries = [
      url,
      'https://corsproxy.io/?' + encodeURIComponent(url),
      'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(url)
    ];
    var last = new Error('Không đọc được trang');
    for (var i = 0; i < tries.length; i++) {
      try {
        var r = await fetch(tries[i]);
        if (!r.ok) { last = new Error('HTTP ' + r.status); continue; }
        var t = await r.text();
        if (t && t.length > 40) return t;
      } catch (e) { last = e; }
    }
    throw last;
  }

  async function resolveTikwm(url) {
    var r = await fetch(TIKWM + encodeURIComponent(url));
    var d = await r.json();
    if (d.code !== 0) throw new Error(d.msg || 'Không tải được từ TikTok');
    var data = d.data || {};
    var items = [];
    if (data.images && data.images.length) {
      data.images.forEach(function (src, i) {
        items.push({ type: 'image', href: src, name: 'kclip-' + (i + 1) + '.jpg' });
      });
    } else {
      var video = data.hdplay || data.play;
      if (!video) throw new Error('Không tìm thấy bản không logo');
      items.push({ type: 'video', href: video, name: 'kclip.mp4', cover: data.origin_cover || data.cover });
    }
    return { title: data.title || '', items: items };
  }

  function decodeAmp(s) { return String(s).replace(/&amp;/g, '&'); }

  async function resolveTelegram(url) {
    if (isPrivateTelegram(url)) {
      throw new Error('Đây là link nhóm nội bộ. Group chặn tải thì K.Clip không vượt được hạn chế đó — chỉ tải kênh hoặc bài Telegram công khai.');
    }
    var html = await fetchText(telegramEmbed(url));
    var found = [];
    var re = /(?:src|data-src)=["'](https:\/\/[^"']+)["']/gi;
    var m;
    while ((m = re.exec(html))) {
      var src = decodeAmp(m[1]);
      if (/telegram-cdn|cdn\d+\.telesco|\/file\/.+\.mp4|\.mp4(\?|$)/i.test(src)) found.push(src);
    }
    var uniq = found.filter(function (v, i, a) { return a.indexOf(v) === i; });
    if (!uniq.length) {
      throw new Error('Không thấy clip công khai trong link Telegram này. Group chặn tải hoặc bài cần vào nhóm thì không tải được.');
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
    try {
      return await resolveTikwm(url);
    } catch (e) {
      throw new Error('Chưa tải được link này. K.Clip tải tốt nhất với TikTok (không logo) và Telegram công khai.');
    }
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
      setStatus(e.message || 'Không tải được.', true);
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
