/* MizanSK mobil uygulama (PWA). Veri yalnız imzalı API'den gelir (82_Api.gs); adres+anahtar cihazda PIN ile şifreli durur.
 * Güvenlik: sayfaya yazılan her metin textContent/createTextNode ile basılır (HTML enjeksiyonu yok); innerHTML YALNIZ aşağıdaki sabit simge dizgeleri için. */
(function () {
  'use strict';
  var MC = window.MizanCrypto, DEPO = 'mizansk.v1', APP_SURUM = '2026-11-02.28';
  var S = { cfg: null, g: null, gTimer: null, ekran: 'bugun', mod: 'soru', sekme: null, kisayollar: [], ref: null, ayar: { gizliSure: 60, kilitDk: 3 }, sonEtkin: Date.now(), gizlendi: 0 };
  var app = document.getElementById('app'), tk = null;

  // ---------------------------------------------------------------- yardımcılar
  function h(tag, a) {
    var e = document.createElement(tag), c = Array.prototype.slice.call(arguments, 2);
    if (a) Object.keys(a).forEach(function (k) {
      var v = a[k];
      if (k === 'class') e.className = v; else if (k === 'style') Object.assign(e.style, v); else if (k.indexOf('on') === 0) e[k] = v;
      else if (v === true) e.setAttribute(k, ''); else if (v !== false && v != null) e.setAttribute(k, v);
    });
    (function ekle(l) { l.forEach(function (x) { if (Array.isArray(x)) return ekle(x); if (x == null || x === false) return; e.appendChild(x.nodeType ? x : document.createTextNode(String(x))); }); })(c);
    return e;
  }
  var IC = {
    bugun: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>', soru: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.7.4-1 .9-1 1.6"/><circle cx="12" cy="17" r=".9" fill="currentColor" stroke="none"/>',
    hareket: '<path d="M4 7h13M4 12h16M4 17h10"/>', ekle: '<path d="M12 5v14M5 12h14"/>', durum: '<path d="M4 18V9M10 18V5M16 18v-7M22 18H2"/>',
    ok: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', ara: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>', kilit: '<rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    yonetim: '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M4 10h16M10 10v10"/>',
    uyari: '<path d="M12 4l9 16H3z"/><path d="M12 10v4"/>', nokta: '<circle cx="12" cy="12" r="4" fill="currentColor"/>', yukari: '<path d="M7 14l5-5 5 5"/>'
  };
  function ic(n, z) { var s = h('span', { class: 'ic' }); s.innerHTML = '<svg width="' + (z || 22) + '" height="' + (z || 22) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + IC[n] + '</svg>'; return s; }
  function para(n) { return Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  var AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  function tarihKisa(iso) { return iso ? Number(iso.slice(8, 10)) + ' ' + AY[Number(iso.slice(5, 7)) - 1] : ''; }
  function tutarMetni(k) {
    if (k.tutar !== '' && k.tutar != null) return para(k.adet > 1 && k.toplam !== '' && k.toplam != null ? k.toplam : k.tutar) + ' ₺';
    return k.dovizTutar !== '' && k.dovizTutar != null ? para(k.dovizTutar) + ' ' + (k.doviz || '') : '?';
  }
  var HATA = { imza: 'İmza geçersiz: adres/anahtar yanlış olabilir', saat: 'Telefon saati sunucudan çok farklı', tekrar: 'Tekrarlanan istek reddedildi', kurulmamis: 'Sunucuda API anahtarı yok (apiKurulum çalıştır)', istek: 'Geçersiz istek',
    eylem: 'Bilinmeyen eylem', gizli: 'Bu kayıt gizli: önce PIN ile aç', pin: 'PIN yanlış', kilit: 'Çok fazla yanlış deneme: bir süre kilitli', pin_yok: 'Sunucuda PIN yok', pin_var: 'Sunucuda PIN zaten var', pin_bicim: 'PIN en az 8 rakam olmalı', mesgul: 'Sunucu meşgul, biraz sonra dene', kapali: 'Uygulama sunucuda kapatılmış (sabit>ayar API_KAPALI)' };

  async function api(eylem, d) {
    var gecerli = S.g && S.g.e > Date.now() ? S.g : null, r, j = null, t0 = performance.now();
    for (var deneme = 0; deneme < 2; deneme++) {                         // bağlantı koparsa/zaman aşımında bir kez yeniden dener (her denemede yeni nonce+imza)
      var govde = await MC.imzala(S.cfg.token, eylem, d || {}, gecerli), ac = new AbortController(), zt = setTimeout(function () { ac.abort(); }, 45000);
      try { r = await fetch(S.cfg.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: govde, redirect: 'follow', cache: 'no-store', referrerPolicy: 'no-referrer', signal: ac.signal }); j = await r.json(); clearTimeout(zt); break; }
      catch (e) { clearTimeout(zt); j = null; if (deneme === 1) throw new Error(e && e.name === 'AbortError' ? 'Sunucu yanıt vermedi (45 sn)' : 'Bağlantı kurulamadı'); }
    }
    S.son = { eylem: eylem, ms: Math.round(performance.now() - t0), sunucuMs: j && j.ms != null ? j.ms : null };
    if (!j) throw new Error('Yanıt okunamadı (adres doğru mu?)');
    if (!j.ok) { var er = new Error(HATA[j.e] || j.m || j.e || 'Hata'); er.kod = j.e; er.j = j; throw er; }
    return j.d === undefined ? j : j.d;
  }
  function hataMetni(e) { var m = e.message || String(e); if (e.kod === 'kilit' && e.j && e.j.bekleMs) m += ' (' + Math.ceil(e.j.bekleMs / 60000) + ' dk)'; if (e.kod === 'pin' && e.j && e.j.kalan != null) m += ' (' + e.j.kalan + ' hak kaldı)'; return m; }

  // ---------------------------------------------------------------- küçük bileşenler
  function toast(metin, eylemAd, eylem) {
    var onceki = document.getElementById('toast'); if (onceki) onceki.remove();
    var t = h('div', { class: 'toast', id: 'toast', role: 'status' }, h('span', null, metin));
    if (eylemAd) t.appendChild(h('button', { onclick: function () { t.remove(); eylem(); } }, eylemAd));
    document.body.appendChild(t); setTimeout(function () { if (t.parentNode) t.remove(); }, eylemAd ? 7000 : 3000);
  }
  function altSayfa(yap) {
    var ort = h('div', { class: 'ort' }), sy = h('div', { class: 'sayfa' }, h('div', { class: 'tut' }));
    function kapat() { ort.remove(); }
    ort.onclick = function (e) { if (e.target === ort) kapat(); };
    ort.appendChild(sy); document.body.appendChild(ort); yap(sy, kapat); return kapat;
  }
  function yukleniyor(m) { return h('div', { class: 'yuk' }, m || 'Yükleniyor…'); }

  /** Rakam tuş takımı; en az 8 hane. Sonuç: PIN metni ya da null (vazgeç). */
  function pinSor(baslik, alt) {
    return new Promise(function (coz) {
      var deger = '', nokta = h('div', { class: 'pin', 'aria-label': 'PIN' }), hata = h('div', { class: 'hata' }), tamam = h('button', { class: 'btn blok', disabled: true }, 'Onayla'), bitti = false;
      function ciz() { nokta.replaceChildren.apply(nokta, deger.split('').map(function () { return h('i'); })); tamam.disabled = deger.length < 8; }
      altSayfa(function (sy, kapat) {
        function bitir(v) { if (bitti) return; bitti = true; kapat(); coz(v); }
        sy.parentNode.addEventListener('click', function (e) { if (e.target === sy.parentNode) bitir(null); });
        var kp = h('div', { class: 'kp' });
        ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'İptal', '0', '⌫'].forEach(function (k) {
          kp.appendChild(h('button', { type: 'button', onclick: function () {
            if (k === 'İptal') return bitir(null);
            if (k === '⌫') deger = deger.slice(0, -1); else if (deger.length < 16) deger += k;
            ciz();
          } }, k));
        });
        tamam.onclick = function () { bitir(deger); };
        sy.append(h('div', { style: { textAlign: 'center', fontWeight: '700', fontSize: '18px' } }, baslik), h('div', { class: 'muted sm', style: { textAlign: 'center', marginTop: '3px' } }, alt || ''), nokta, hata, kp, tamam);
        ciz();
      });
    });
  }

  // ---------------------------------------------------------------- gizli (PIN ile 1 dk)
  function gizliKapat() { S.g = null; if (S.gTimer) { clearTimeout(S.gTimer); S.gTimer = null; } if (S.cfg && document.getElementById('ek')) yenile(); }
  async function gizliAc() {
    if (S.g && S.g.e > Date.now()) return true;
    var pin = await pinSor('PIN gir', 'Gelir/maaş bilgisi ' + S.ayar.gizliSure + ' sn sonra ya da uygulamadan çıkınca yeniden gizlenir');
    if (!pin) return false;
    try {
      var r = await api('gizliAc', { pin: pin }); S.g = r.g; if (r.sure) S.ayar.gizliSure = r.sure;
      if (S.gTimer) clearTimeout(S.gTimer); S.gTimer = setTimeout(gizliKapat, Math.max(1000, r.g.e - Date.now()));
      return true;
    } catch (e) { toast(hataMetni(e)); return false; }
  }

  // ---------------------------------------------------------------- tekerlek (idmanSK metro tekerleği mantığı: aktif kart büyük, komşular ince satır)
  var ROW = 52, GAP = 8, SOL = 2, DRAG = 170;
  function Tekerlek(kap, ogeler) {
    var T = { pos: 0, anim: null }, items = ogeler;
    items.forEach(function (it) { kap.appendChild(it.el); });
    function yerles() {
      var n = items.length; if (!n) return;
      var kapH = kap.clientHeight, sol = kapH >= 700 ? SOL : 1, cardH = Math.max(300, Math.min(480, kapH - 2 * sol * (ROW + GAP) - 4)), hedef = sol * (ROW + GAP), pos = T.pos;
      var hh = items.map(function (_, i) { return ROW + (cardH - ROW) * Math.max(0, 1 - Math.abs(i - pos)); }), tops = [], acc = 0;
      hh.forEach(function (x, i) { tops[i] = acc; acc += x + GAP; });
      var fl = Math.max(0, Math.min(n - 1, Math.floor(pos))), F = tops[fl] + (pos - fl) * (hh[fl] + GAP);
      items.forEach(function (it, i) {
        var y = tops[i] - F + hedef, e = Math.max(0, 1 - Math.abs(i - pos)), st = it.el.style;
        st.transform = 'translateY(' + y.toFixed(1) + 'px)'; st.height = hh[i].toFixed(1) + 'px'; st.setProperty('--e', e.toFixed(3));
        st.visibility = (y > kapH + 4 || y + hh[i] < -4) ? 'hidden' : 'visible'; it.el.classList.toggle('acik', e > 0.5);
      });
    }
    function git(hedefPos, sure) {
      hedefPos = Math.max(0, Math.min(items.length - 1, hedefPos));
      if (T.anim) cancelAnimationFrame(T.anim);
      var bas = T.pos, t0 = performance.now(), d = sure || 260;
      (function adim(t) { var x = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - x, 3); T.pos = bas + (hedefPos - bas) * e; yerles(); if (x < 1) T.anim = requestAnimationFrame(adim); else { T.anim = null; T.pos = hedefPos; yerles(); } })(t0);
    }
    var bas = null;
    kap.addEventListener('pointerdown', function (e) {
      if (e.target.closest && e.target.closest('.kscroll')) { bas = null; return; }               // kartın içindeki seçenek alanı kendi kaydırmasını kullanır (Onayla düğmesi altta sabit)
      bas = { y: e.clientY, pos: T.pos, t: performance.now(), son: [{ y: e.clientY, t: performance.now() }], surukle: false };
    });
    kap.addEventListener('pointermove', function (e) {
      if (!bas) return; var dy = e.clientY - bas.y;
      if (!bas.surukle && Math.abs(dy) > 7) { bas.surukle = true; try { kap.setPointerCapture(e.pointerId); } catch (x) { /* yok say */ } if (T.anim) { cancelAnimationFrame(T.anim); T.anim = null; } }
      if (!bas.surukle) return;
      T.pos = Math.max(-0.25, Math.min(items.length - 0.75, bas.pos - dy / DRAG)); bas.son.push({ y: e.clientY, t: performance.now() }); if (bas.son.length > 6) bas.son.shift(); yerles(); e.preventDefault();
    });
    var bastir = false;
    kap.addEventListener('click', function (e) { if (bastir) { e.stopPropagation(); e.preventDefault(); } }, true);        // sürükleme sonrası düğmeye/etikete yanlışlıkla basılmasın
    function birak() {
      if (!bas) return; var b = bas; bas = null;
      if (!b.surukle) return;
      bastir = true; setTimeout(function () { bastir = false; }, 60);
      var s = b.son, v = s.length > 1 ? (s[s.length - 1].y - s[0].y) / Math.max(1, s[s.length - 1].t - s[0].t) : 0, hedef = T.pos - v * 110 / DRAG;
      hedef = Math.round(Math.max(b.pos - 1, Math.min(b.pos + 1, hedef))); git(hedef);
    }
    kap.addEventListener('pointerup', birak); kap.addEventListener('pointercancel', birak);
    var acc = 0; kap.addEventListener('wheel', function (e) { e.preventDefault(); acc += e.deltaY; if (Math.abs(acc) < 40) return; var d = Math.sign(acc); acc = 0; git(Math.round(T.pos) + d); }, { passive: false });
    kap.addEventListener('keydown', function (e) { if (e.key === 'ArrowDown') git(Math.round(T.pos) + 1); else if (e.key === 'ArrowUp') git(Math.round(T.pos) - 1); });
    kap.addEventListener('click', function (e) { var o = e.target.closest('.oge'); if (!o || o.classList.contains('acik')) return; var i = items.findIndex(function (x) { return x.el === o; }); if (i >= 0) git(i); });
    window.addEventListener('resize', yerles);
    T.git = git; T.yerles = yerles; T.indeks = function () { return Math.round(T.pos); }; yerles();
    return T;
  }

  // ---------------------------------------------------------------- cari seçimi (alt sayfa)
  function cariSec(baslangic) {
    return new Promise(function (coz) {
      var bitti = false;
      altSayfa(function (sy, kapat) {
        function bitir(v) { if (bitti) return; bitti = true; kapat(); coz(v); }
        sy.parentNode.addEventListener('click', function (e) { if (e.target === sy.parentNode) bitir(null); });
        var ara = h('input', { class: 'alan', placeholder: 'Cari ara…', type: 'text', autocomplete: 'off' }), liste = h('div', { class: 'liste' });
        function ciz() {
          var q = ara.value.toLocaleLowerCase('tr-TR');
          liste.replaceChildren.apply(liste, (S.ref.cariler || []).filter(function (c) { return !q || (c.cari + ' ' + c.sinif).toLocaleLowerCase('tr-TR').indexOf(q) >= 0; }).slice(0, 60).map(function (c) {
            return h('div', { class: 'li', role: 'button', tabindex: '0', onclick: function () { etiketAdimi(c.cari); } }, h('div', { class: 'g' }, h('b', null, c.cari), h('span', { class: 'muted sm' }, c.sinif)));
          }));
        }
        function etiketAdimi(cari) {
          var et = ['', '', '', '', ''], ol = (S.ref.cariOneri || {})[cari] || [], inp = [], kural = h('input', { type: 'checkbox' });
          if (ol.length) et = ol[0].slice(); else if (baslangic && baslangic.cari === cari) et = baslangic.etiket.slice();
          sy.replaceChildren(h('div', { class: 'tut' }), h('div', { style: { fontWeight: '700', fontSize: '18px', marginBottom: '8px' } }, cari));
          if (ol.length > 1) { sy.appendChild(h('div', { class: 'etiket' }, 'Sık kullanılan etiketler')); ol.forEach(function (o) { sy.appendChild(h('span', { class: 'chip', onclick: function () { inp.forEach(function (x, i) { x.value = o[i] || ''; }); } }, o.filter(String).join(' / ') || '(boş)')); }); }
          sy.appendChild(h('div', { class: 'etiket', style: { margin: '8px 0 2px' } }, 'Etiket 1–5 (isteğe bağlı)'));
          for (var i = 0; i < 5; i++) { var x = h('input', { class: 'alan', type: 'text', placeholder: 'Etiket-' + (i + 1), value: et[i] || '', style: { minHeight: '44px', margin: '2px 0 6px' } }); inp.push(x); sy.appendChild(x); }
          var acikGiris = null;
          if (baslangic && baslangic.aciklama != null) { sy.appendChild(h('div', { class: 'etiket', style: { margin: '8px 0 2px' } }, 'Açıklama (isteğe bağlı değiştir)')); acikGiris = h('input', { class: 'alan', type: 'text', maxlength: '120', value: baslangic.aciklama, style: { minHeight: '44px', margin: '2px 0 6px' } }); sy.appendChild(acikGiris); }
          sy.appendChild(h('label', { class: 'muted sm', style: { display: 'flex', gap: '10px', alignItems: 'center', margin: '4px 0 12px', minHeight: '44px' } }, kural, 'Bu mağaza/satıcı hep böyle (kural)'));
          sy.appendChild(h('button', { class: 'btn blok', onclick: function () { bitir({ cari: cari, etiket: inp.map(function (x) { return x.value; }), kural: kural.checked, aciklama: acikGiris ? acikGiris.value : undefined }); } }, cari + ' olarak seç'));
        }
        ara.oninput = ciz; sy.append(h('div', { style: { fontWeight: '700', fontSize: '18px', marginBottom: '6px' } }, 'Cari seç'), ara, liste); ciz();
      });
    });
  }

  // ---------------------------------------------------------------- ekranlar
  var ek = null;
  function ekranHazir(tekerlek) { ek = document.getElementById('ek'); ek.className = 'ekran' + (tekerlek ? ' tk' : ''); ek.scrollTop = 0; return ek; }
  function hataGoster(e) { ek.replaceChildren(h('div', { class: 'bos' }, hataMetni(e), h('div', { style: { marginTop: '14px' } }, h('button', { class: 'btn o', onclick: yenile }, 'Yeniden dene')))); }

  async function bugunEkrani() {
    ekranHazir(false); ek.replaceChildren(yukleniyor());
    var d; try { d = await api('bugun'); } catch (e) { return hataGoster(e); }
    var fark = d.oncekiHarcama ? Math.round((d.harcama / d.oncekiHarcama - 1) * 100) : null;
    var parcalar = [h('div', { class: 'ust' }, h('h1', null, 'Bugün'), h('span', { class: 'muted sm' }, d.donem.slice(4) + '/' + d.donem.slice(0, 4))),
      h('div', { class: 'kart gradyan g4' }, h('div', { class: 'etiket' }, 'Bu ay harcama'), h('div', { class: 'big', style: { margin: '10px 0 4px' } }, para(d.harcama) + ' ₺'),
        h('div', { class: 'sm', style: { opacity: '.85' } }, fark == null ? 'geçen ay aynı güne göre veri yok' : 'geçen ay aynı güne göre ' + (fark > 0 ? '+' : '') + fark + '%'))];
    if (d.gizli) parcalar.push(h('button', { class: 'kilit-satir', onclick: async function () { if (await gizliAc()) yenile(); } }, ic('kilit'), 'Gelir ve net', h('span', { class: 'nokta' }, '● ● ● ● ●')),
      h('div', { class: 'muted sm', style: { margin: '6px 4px 14px' } }, 'Maaş ve gelir bilgisi gizli. Görmek için PIN gir.'));
    else parcalar.push(h('div', { class: 'kart' }, h('div', { style: { display: 'flex', justifyContent: 'space-between' } }, h('span', { class: 'muted' }, 'Gelir'), h('b', { class: 'num ok' }, para(d.gelir) + ' ₺')),
      h('div', { style: { display: 'flex', justifyContent: 'space-between', marginTop: '8px' } }, h('span', { class: 'muted' }, 'Net (gelir − harcama)'), h('b', { class: 'num' }, para(d.net) + ' ₺'))));
    if (d.kartlar.length) parcalar.push(h('div', { class: 'etiket', style: { margin: '6px 0 8px' } }, 'Kart borçları (defter)'), h('div', { class: 'hscroll' }, d.kartlar.map(function (k, i) {
      return h('div', { class: 'kart gradyan g' + (i % 3 + 1) }, h('b', null, k.kart), h('div', { class: 'sm', style: { opacity: '.85', marginTop: '18px' } }, k.sonrakiKesim ? 'sonraki kesim ' + tarihKisa(k.sonrakiKesim) : 'kesim bilinmiyor'), h('div', { style: { fontSize: '26px', fontWeight: '700' }, class: 'num' }, para(k.borc) + ' ₺'));
    })));
    d.uyarilar.forEach(function (u) { parcalar.push(h('div', { class: 'uyari', style: { marginTop: '12px' } }, ic('uyari'), h('span', null, u.mesaj))); });
    ek.replaceChildren.apply(ek, parcalar);
  }

  /** Bir soru kartının seçenekleri: plan adayları, geçmişten tekrarlar, öneriler, (hesap sorusunda) hızlı kısayollar. Sıra = varsayılan seçim önceliği. */
  function secenekleriKur(k) {
    var out = [], et = function (a) { return (a || []).filter(String).join(' / '); };
    (k.planlar || []).forEach(function (p) {
      out.push({ grup: 'Plan adayı', cari: p.cari, etiket: p.etiket.slice(), metin: p.cari + ' · plan ' + para(Math.abs(p.planTutar)) + ' ₺ · ' + tarihKisa(p.planTarih) + (p.fark ? ' · fark ' + (p.fark > 0 ? '+' : '') + para(p.fark) : '') + (et(p.etiket) ? ' · ' + et(p.etiket) : '') });
    });
    (k.gecmis || []).forEach(function (g) { out.push({ grup: 'Geçmişten (aynı tutar, ayın aynı günleri)', cari: g.cari, etiket: g.etiket.slice(), metin: g.cari + ' · ' + g.ay + '/' + g.pencere + ' ay' + (et(g.etiket) ? ' · ' + et(g.etiket) : '') }); });
    (k.oneriler || []).slice(0, 3).forEach(function (o) { out.push({ grup: S.mod === 'kontrol' ? 'Mevcut atama / öneri' : o.kaynak === 'gmail' ? 'Siparişten (Gmail)' : 'Öneri', cari: o.cari, etiket: o.etiket.slice(), metin: o.cari + (et(o.etiket) ? ' · ' + et(o.etiket) : '') + (o.yuzde ? ' · %' + o.yuzde : '') }); });
    if (k.kaynak === 'hesap' && S.mod !== 'kontrol') S.kisayollar.forEach(function (c) { out.push({ grup: 'Hızlı', cari: c.cari, etiket: c.etiket.slice(), metin: c.ad }); });
    if (k.kendine) out = out.filter(function (x) { return x.grup === 'Hızlı'; }).concat(out.filter(function (x) { return x.grup !== 'Hızlı'; }));   // kendine FAST/iç transfer: 'Kendi hesabım' varsayılan
    if (S.mod === 'kontrol') { var ilkOneri = out.filter(function (x) { return x.grup.indexOf('Mevcut') === 0; }); out = ilkOneri.concat(out.filter(function (x) { return ilkOneri.indexOf(x) < 0; })); }   // Kontrol: mevcut atama varsayılan
    return out;
  }

  /** Gmail sipariş e-postasından bulunan ürün adları (kesin eşleşmede tek sipariş, belirsizde olası siparişler). */
  function siparisBlogu(k) {
    var sp = k.siparis; if (!sp) return null;
    if (sp.yok) return h('div', { class: 'muted sm', style: { margin: '2px 0 8px' } }, 'Gmail’de bu karta uyan sipariş e-postası yok (kartla çekilen tutar + tarih eşleşmedi; başka hesap olabilir).');
    if (!sp.aday || !sp.aday.length) return null;
    var kutu = h('div', { style: { margin: '2px 0 8px', padding: '8px 10px', borderLeft: '3px solid currentColor', borderRadius: '4px' } });
    kutu.appendChild(h('div', { class: 'etiket' }, sp.kesin ? 'Gmail siparişi · ' + sp.aday[0].no : 'Olası siparişler (belirsiz — hangisi?)'));
    sp.aday.forEach(function (a) {
      kutu.appendChild(h('div', { class: 'sm', style: { margin: '3px 0 0' } }, (sp.kesin ? '' : tarihKisa(a.tarih) + ' · ' + para(a.kart) + ' ₺ · ') + (a.urun.length ? a.urun.join(' · ') : '(ürün adı okunamadı)')));
      if (a.odeme && a.odeme.indexOf('+') > 0) kutu.appendChild(h('div', { class: 'muted sm', style: { margin: '2px 0 0' } }, 'Sipariş ' + para(a.tutar) + ' ₺ · ödeme: ' + a.odeme));
    });
    return kutu;
  }

  function soruOge(it) {
    var k = it.k, el = h('div', { class: 'oge' + (it.done ? ' bitti' : '') });
    var sat = h('div', { class: 'sat' }, ic(it.done ? 'ok' : 'nokta', 18), h('span', { class: 'ad' }, k.gizli ? 'Gizli kayıt' : k.aciklama), h('span', { class: 'tu' }, k.gizli ? '●●●●' : tutarMetni(k)));
    var kt = h('div', { class: 'kt' });
    kt.appendChild(h('div', { class: 'etiket' }, tarihKisa(k.tarih) + (k.banka ? ' · ' + k.banka : '') + (k.adet > 1 ? ' · ' + k.adet + ' kalem' : '')));
    if (k.gizli) {
      kt.append(h('div', { style: { font: '700 20px system-ui', margin: '8px 0' } }, 'Gizli kayıt'), h('div', { class: 'muted sm', style: { marginBottom: '14px' } }, k.maas ? 'Maaş yatışı: tutar ve seçenekler PIN ile açılır.' : 'Bu kaydın bilgisi PIN ile açılır.'),
        h('button', { class: 'btn blok', onclick: async function () { if (await gizliAc()) sorularEkrani(S.sekme); } }, ic('kilit'), 'PIN ile aç'));
    } else {
      kt.append(h('div', { style: { font: '600 18px system-ui', margin: '4px 0' } }, k.aciklama), h('div', { class: 'big', style: { fontSize: '32px', marginBottom: '6px' } }, tutarMetni(k)));
      if (k.maas) {
        kt.append(h('div', { class: 'muted sm', style: { marginBottom: '10px' } }, 'Plandaki aylık maaşla kuruşu kuruşuna uyuşmadı. Bu yatış nedir?'),
          h('button', { class: 'btn blok', style: { marginBottom: '8px' }, onclick: function () { maasCevap(it, 'bes'); } }, 'Aylık maaş (BES %4,5 uygula)'), h('button', { class: 'btn o blok', onclick: function () { maasCevap(it, 'bes_yok'); } }, 'Prim / diğer (BES yok)'));
      } else {
        var secenekler = secenekleriKur(k), sec = it.sec = it.sec || (secenekler[0] ? { cari: secenekler[0].cari, etiket: secenekler[0].etiket.slice(), kural: false, i: 0 } : null), chipler = h('div'), kural = h('input', { type: 'checkbox' });
        function chipCiz() {
          var gruplar = {}, sira = [];
          secenekler.forEach(function (o, i) { if (!gruplar[o.grup]) { gruplar[o.grup] = []; sira.push(o.grup); } gruplar[o.grup].push([o, i]); });
          var parcalar = [];
          sira.forEach(function (g) {
            parcalar.push(h('div', { class: 'etiket', style: { margin: '6px 0 4px' } }, g));
            gruplar[g].forEach(function (x) {
              var o = x[0], i = x[1];
              parcalar.push(h('span', { class: 'chip' + (sec && sec.i === i ? ' s' : ''), onclick: function () { it.sec = sec = { cari: o.cari, etiket: o.etiket.slice(), kural: kural.checked, i: i }; chipCiz(); } }, o.metin));
            });
          });
          parcalar.push(h('span', { class: 'chip' + (sec && sec.i === 'x' ? ' s' : ''), onclick: async function () { var r = await cariSec(sec ? Object.assign({}, sec, it.acik ? { aciklama: it.acik.value } : {}) : (it.acik ? { aciklama: it.acik.value } : null)); if (r) { it.sec = sec = { cari: r.cari, etiket: r.etiket, kural: r.kural, i: 'x' }; kural.checked = r.kural; if (it.acik && r.aciklama != null) it.acik.value = r.aciklama; chipCiz(); } } }, sec && sec.i === 'x' ? sec.cari : 'Başka cari…'));
          chipler.replaceChildren.apply(chipler, parcalar);
        }
        chipCiz();
        var acikOk = k.kaynak === 'hesap' && k.adet === 1, acik = acikOk ? h('input', { class: 'alan', type: 'text', maxlength: '120', value: k.aciklama, style: { minHeight: '44px', margin: '2px 0 6px' } }) : null;
        if (acik) it.acik = acik;
        var kscroll = h('div', { class: 'kscroll' }, siparisBlogu(k), chipler, acik ? h('div', { class: 'etiket', style: { margin: '10px 0 2px' } }, 'Açıklama (isteğe bağlı değiştir)') : null, acik,
          h('label', { class: 'muted sm', style: { display: 'flex', gap: '10px', alignItems: 'center', minHeight: '44px' } }, kural, 'Bu mağaza hep böyle (kural)'));
        kt.append(kscroll, h('div', { class: 'kakt' }, h('div', { class: 'satir-btn' }, h('button', { class: 'btn', onclick: function () { if (!sec) return toast('Önce bir cari seç'); sec.kural = kural.checked; cevapla(it); } }, ic('ok', 20), 'Onayla'), h('button', { class: 'btn o', onclick: function () { if (tk) tk.git(tk.indeks() + 1); } }, 'Atla'))));
      }
    }
    el.append(sat, kt); it.el = el; return el;
  }
  // İYİMSER KAYIT: Onayla'ya basınca kart HEMEN biter ve sıradakine geçilir; sunucu kaydı arka planda sırayla yapılır (sunucu 3-4 sn sürebiliyor, ekranı bekletmez).
  // Hata olursa kart geri açılır ve toast gösterilir. Liste/ekran değişimi bekleyen kayıtları bekler.
  S.kuyruk = []; S.kuyrukIs = null;
  function kuyrukEkle(is) { S.kuyruk.push(is); if (!S.kuyrukIs) S.kuyrukIs = (async function () { while (S.kuyruk.length) { var j = S.kuyruk.shift(); try { await j(); } catch (e) { /* iş kendi hatasını yönetir */ } } S.kuyrukIs = null; })(); }
  function kuyrukBekle() { return S.kuyrukIs || Promise.resolve(); }
  /** Yüklenen kartlar (en çok 60) bitmeye yaklaşınca ve sunucuda daha fazla soru varsa liste kendiliğinden yenilenir (sekme değiştirmeye gerek kalmaz). */
  function listeDoldur() {
    if (!S.liste || S.yenileniyor || !(S.toplam > S.liste.length)) return;
    var kalan = S.liste.filter(function (x) { return !x.done; }).length;
    if (kalan > 8) return;
    S.yenileniyor = true;
    setTimeout(async function () { try { await kuyrukBekle(); await sorularEkrani(S.sekme); } finally { S.yenileniyor = false; } }, 900);
  }
  async function cevapla(it) {
    var k = it.k, sec = it.sec, ac = it.acik ? it.acik.value.trim() : '', mod = S.mod, idx = it.idx;
    if (it.done) return;
    it.done = true; it.el.classList.add('bitti'); it.el.querySelector('.sat .ic').replaceChildren(ic('ok', 18).firstChild);
    toast('Kaydediliyor: ' + k.aciklama.slice(0, 24) + ' → ' + sec.cari);
    listeDoldur();
    setTimeout(function () { if (tk) tk.git(tk.indeks() + 1); }, 150);
    kuyrukEkle(async function () {
      try { await api('cevapla', { anahtar: k.anahtar, cari: sec.cari, etiket: sec.etiket, kural: !!sec.kural, mod: mod, aciklama: ac && ac !== k.aciklama ? ac : undefined, ip: k.ip, siparisNo: k.siparis && k.siparis.kesin ? k.siparis.no : undefined }); }
      catch (e) {
        if (/Soru bulunamad/.test(e.message)) { toast('Bu soru zaten cevaplanmış (liste yenilenince kaybolur)'); return; }
        it.done = false; it.el.classList.remove('bitti'); it.el.querySelector('.sat .ic').replaceChildren(ic('nokta', 18).firstChild);
        toast('Kaydedilemedi: ' + hataMetni(e)); if (tk && idx != null) tk.git(idx); return;
      }
      toast(k.aciklama.slice(0, 28) + ' → ' + sec.cari, 'Geri al', async function () { try { await kuyrukBekle(); await api('geriAl'); sorularEkrani(S.sekme); } catch (e) { toast(hataMetni(e)); } });
    });
  }
  async function maasCevap(it, mod) {
    try { await api('maasCevap', { anahtar: it.k.anahtar, mod: mod }); } catch (e) { return toast(hataMetni(e)); }
    toast(mod === 'bes' ? 'BES satırları açıldı' : 'Onaylandı (BES yok)'); sorularEkrani(S.sekme);
  }

  /** sekme: 'kart' | 'hesap' | 'kontrol'. Boşsa son sekme; ilk açılışta kart, kartta soru yoksa hesap. */
  async function sorularEkrani(sekme) {
    var ilk = !sekme && !S.sekme; S.sekme = sekme || S.sekme || 'kart'; S.mod = S.sekme === 'kontrol' ? 'kontrol' : 'soru';
    var kap = ekranHazir(true); kap.replaceChildren(yukleniyor()); await kuyrukBekle();
    var r; try { r = await api('sorular', { mod: S.mod, kaynak: S.mod === 'kontrol' ? '' : S.sekme, limit: 60 }); } catch (e) { kap.className = 'ekran'; return hataGoster(e); }
    var sayi = r.sayilar || { soru: 0, kontrol: 0, kart: 0, hesap: 0 };
    if (ilk && S.sekme === 'kart' && !sayi.kart && sayi.hesap) return sorularEkrani('hesap');
    S.ref = { cariler: r.cariler, cariOneri: r.cariOneri, bankalar: r.bankalar }; S.kisayollar = r.kisayollar || [];
    var ust = h('div', null, h('div', { class: 'ust' }, h('h1', null, S.sekme === 'kontrol' ? 'Kontrol' : S.sekme === 'hesap' ? 'Hesap soruları' : 'Kart soruları'), h('button', { class: 'chip', style: { margin: '0' }, onclick: async function () { try { var o = await api('oneri'); toast('Claude önerisi: ' + (o.yazilan || 0) + ' soru'); sorularEkrani(S.sekme); } catch (e) { toast(hataMetni(e)); } } }, 'Claude öner')),
      h('div', { class: 'seg' }, h('button', { class: S.sekme === 'kart' ? 'on' : '', onclick: function () { sorularEkrani('kart'); } }, 'Kart ' + (sayi.kart || 0)), h('button', { class: S.sekme === 'hesap' ? 'on' : '', onclick: function () { sorularEkrani('hesap'); } }, 'Hesap ' + (sayi.hesap || 0)), h('button', { class: S.sekme === 'kontrol' ? 'on' : '', onclick: function () { sorularEkrani('kontrol'); } }, 'Kontrol ' + (sayi.kontrol || 0))));
    var alan = h('div', { class: 'tekerlek', tabindex: '0' });
    kap.replaceChildren(ust, alan);
    if (!r.kartlar.length) { alan.appendChild(h('div', { class: 'bos' }, S.sekme === 'kontrol' ? 'Onay bekleyen atama yok' : 'Cevap bekleyen soru yok 🎉')); tk = null; return; }
    var items = r.kartlar.map(function (k, i) { var it = { k: k, done: false, idx: i }; soruOge(it); return it; });
    S.liste = items; S.toplam = r.toplam || items.length;                       // sunucuda daha fazla soru varsa (toplam > yüklenen) liste azalınca otomatik yenilenir
    tk = Tekerlek(alan, items);
    kap.appendChild(h('div', { class: 'ipucu' }, h('span', { style: { transform: 'rotate(0deg)', display: 'inline-flex' } }, ic('yukari', 16)), 'yukarı kaydır: sonraki'));
    requestAnimationFrame(function () { tk.yerles(); });
  }

  async function hareketlerEkrani(filtre, sayfa, q) {
    filtre = filtre || 'hepsi'; sayfa = sayfa || 0; var kap = ekranHazir(false);
    if (!sayfa) kap.replaceChildren(yukleniyor());
    var d; try { d = await api('hareketler', { filtre: filtre, sayfa: sayfa, q: q || '', limit: 50 }); } catch (e) { return hataGoster(e); }
    var FIL = [['hepsi', 'Hepsi'], ['gider', 'Gider'], ['gelir', 'Gelir'], ['kart', 'Kart'], ['yatirim', 'Fon / Yatırım'], ['soru', 'Cevapsız']];
    var ara = h('input', { type: 'search', placeholder: 'Ara: açıklama, banka, cari', value: q || '', autocomplete: 'off' }), liste = h('div', { class: 'liste' });
    ara.onkeydown = function (e) { if (e.key === 'Enter') hareketlerEkrani(filtre, 0, ara.value); };
    d.satirlar.forEach(function (s) {
      liste.appendChild(h('div', { class: 'li' }, h('div', { class: 'g' }, h('b', null, s.aciklama), h('span', { class: 'muted sm' }, tarihKisa(s.tarih) + (s.cari ? ' · ' + s.cari : '') + (s.banka ? ' · ' + s.banka : '') + (s.onay === 'bekliyor' ? ' · cevapsız' : ''))),
        h('span', { class: 't ' + (s.gizli && s.tutar === '' ? 'muted' : s.tutar < 0 ? 'bad' : 'ok') }, s.gizli && s.tutar === '' ? '●●●●' : (typeof s.tutar === 'number' ? (s.tutar > 0 ? '+' : '') + para(s.tutar) : (s.dovizTutar !== '' ? para(s.dovizTutar) + ' ' + s.doviz : '?')))));
    });
    var daha = (sayfa + 1) * 50 < d.toplam;
    var parca = [h('div', { class: 'ust' }, h('h1', null, 'Hareketler'), h('span', { class: 'muted sm' }, d.toplam + ' kayıt')),
      h('div', { class: 'hscroll chips' }, FIL.map(function (f) { return h('span', { class: 'chip' + (filtre === f[0] ? ' s' : ''), onclick: function () { hareketlerEkrani(f[0], 0, ara.value); } }, f[1]); })),
      h('div', { class: 'arama' }, ic('ara', 20), ara)];
    if (d.net != null && filtre !== 'hepsi') parca.push(h('div', { class: 'muted sm', style: { margin: '0 2px 6px' } }, 'Net: ', h('b', { class: 'num' }, (d.net > 0 ? '+' : '') + para(d.net) + ' ₺')));
    else if (d.net == null) parca.push(h('div', { class: 'muted sm', style: { margin: '0 2px 6px' } }, 'Gizli satırlar nedeniyle net gösterilmiyor'));
    parca.push(liste); if (!d.satirlar.length) parca.push(h('div', { class: 'bos' }, 'Kayıt yok'));
    if (daha) parca.push(h('button', { class: 'btn o blok', style: { marginTop: '12px' }, onclick: function () { hareketlerEkrani(filtre, sayfa + 1, ara.value); } }, 'Daha fazla göster'));
    if (sayfa) { var yeniListe = liste; var eski = kap.querySelector('.liste'); if (eski) { d.satirlar.forEach(function (s, i) { eski.appendChild(yeniListe.children[i].cloneNode(true)); }); var b = kap.querySelector('.btn.o.blok'); if (b) { if (daha) b.onclick = function () { hareketlerEkrani(filtre, sayfa + 1, ara.value); }; else b.remove(); } return; } }
    kap.replaceChildren.apply(kap, parca);
  }

  async function ekleEkrani() {
    var kap = ekranHazir(false);
    if (!S.ref) { kap.replaceChildren(yukleniyor()); try { var r = await api('sorular', { mod: 'soru', limit: 10 }); S.ref = { cariler: r.cariler, cariOneri: r.cariOneri, bankalar: r.bankalar }; S.bugunIso = r.bugun; } catch (e) { return hataGoster(e); } }
    var yon = 'gider', cari = null, bugun = S.bugunIso || new Date().toISOString().slice(0, 10);
    var tutar = h('input', { class: 'alan', type: 'text', inputmode: 'decimal', placeholder: '0,00', style: { fontSize: '30px', fontWeight: '700', minHeight: '64px' }, autocomplete: 'off' }), acik = h('input', { class: 'alan', type: 'text', placeholder: 'Açıklama', maxlength: '120' });
    var tarih = h('input', { class: 'alan', type: 'date', value: bugun }), banka = h('input', { class: 'alan', type: 'text', placeholder: 'Hesap / banka (isteğe bağlı)', list: 'bankalar' });
    var dl = h('datalist', { id: 'bankalar' }, (S.ref.bankalar || []).map(function (b) { return h('option', { value: b }); })), seg = h('div', { class: 'seg' }), cariBtn = h('button', { class: 'chip', type: 'button' }, 'Cari seç…');
    function yonCiz() { seg.replaceChildren(h('button', { class: yon === 'gider' ? 'on' : '', onclick: function () { yon = 'gider'; yonCiz(); } }, 'Gider'), h('button', { class: yon === 'gelir' ? 'on' : '', onclick: function () { yon = 'gelir'; yonCiz(); } }, 'Gelir')); }
    yonCiz();
    cariBtn.onclick = async function () { var r = await cariSec(cari); if (r) { cari = r; cariBtn.textContent = r.cari; cariBtn.classList.add('s'); } };
    async function kaydet(zorla) {
      if (!cari) return toast('Cari seç');
      try { var r = await api('ekle', { tarih: tarih.value, tutar: tutar.value, yon: yon, aciklama: acik.value, cari: cari.cari, etiket: cari.etiket, banka: banka.value, zorla: !!zorla });
        if (r.tekrar) return toast('Aynı kayıt var', 'Yine de ekle', function () { kaydet(true); });
        toast('Eklendi: ' + r.ozet); tutar.value = ''; acik.value = ''; } catch (e) { toast(hataMetni(e)); }
    }
    kap.replaceChildren(h('div', { class: 'ust' }, h('h1', null, 'Ekle'), h('span', { class: 'muted sm' }, 'nakit / hesap')), seg, h('label', { class: 'et' }, 'Tutar (₺)'), tutar, h('label', { class: 'et' }, 'Açıklama'), acik,
      h('label', { class: 'et' }, 'Cari'), h('div', { style: { margin: '6px 0 12px' } }, cariBtn), h('label', { class: 'et' }, 'Tarih'), tarih, h('label', { class: 'et' }, 'Hesap'), banka, dl,
      h('button', { class: 'btn blok', onclick: function () { kaydet(false); } }, 'Kaydet'));
  }

  // ---------------------------------------------------------------- Yönetim (kodun Mizan Yönetim dosyasına yazdığı özetin aynısı)
  var YK_SEKMELER = [['özet', 'Özet'], ['kartlar', 'Kartlar'], ['hesaplar', 'Hesaplar'], ['ödemeler', 'Ödemeler'], ['sorular', 'Sorular'], ['transferler', 'Transfer'], ['denetim', 'Denetim']];
  var IYI = /^(TAMAM|GÜNCEL|ÖDENDİ|EŞLEŞTİ|YETER|ONAYLI)/, KOTU = /^(FARK|EKSİK|GECİKTİ|VADESİ GEÇTİ|ESKİ|KOD|AÇIK|DİKKAT|VERİ YOK|BİR BACAK EKSİK|KISMEN)/;
  function ykDeger(x) {
    if (x && typeof x === 'object') { if (x.d) return Number(x.d.slice(8, 10)) + ' ' + AY[Number(x.d.slice(5, 7)) - 1] + ' ' + x.d.slice(0, 4); if (x.say != null) return String(x.say); }
    if (typeof x === 'number') return para(x);
    return x == null ? '' : String(x);
  }
  async function yonetimEkrani(bolum) {
    S.yk = bolum || S.yk || 'özet'; var kap = ekranHazir(false); kap.replaceChildren(yukleniyor());
    var d; try { d = await api('yonetim'); } catch (e) { return hataGoster(e); }
    var p = [h('div', { class: 'ust' }, h('h1', null, 'Yönetim'), h('span', { class: 'muted sm' }, d.acik ? d.acik + ' açık madde' : 'açık madde yok')),
      h('div', { class: 'hscroll chips' }, YK_SEKMELER.map(function (x) { return h('span', { class: 'chip' + (S.yk === x[0] ? ' s' : ''), onclick: function () { yonetimEkrani(x[0]); } }, x[1]); }))];
    var bloklar = d.bolumler[S.yk] || [], gizliVar = false;
    bloklar.forEach(function (b) {
      p.push(h('div', { class: 'etiket', style: { margin: '14px 0 6px' } }, b.baslik));
      if (!b.satirlar.length) p.push(h('div', { class: 'muted sm' }, 'Kayıt yok'));
      b.satirlar.forEach(function (sat) {
        var hc = sat.h, durum = hc.map(ykDeger).filter(function (v) { return IYI.test(v) || KOTU.test(v); })[0] || '';
        var kart = h('div', { class: 'kart' }, h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '10px' } }, h('b', null, sat.g && !hc[0] ? 'Gizli kayıt' : ykDeger(hc[0])), durum ? h('b', { class: IYI.test(durum) ? 'ok' : 'bad' }, durum) : null));
        if (sat.g) gizliVar = true;
        hc.forEach(function (c, i) {
          var v = ykDeger(c); if (i === 0 || v === '' || v === durum) return;
          kart.appendChild(h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '4px' } }, h('span', { class: 'muted sm' }, b.kolonlar[i] || ''), h('span', { class: 'num', style: { textAlign: 'right' } }, v)));
        });
        p.push(kart);
      });
      if (b.not) p.push(h('div', { class: 'muted sm', style: { margin: '2px 2px 8px' } }, b.not));
    });
    if (gizliVar) p.push(h('button', { class: 'kilit-satir', onclick: async function () { if (await gizliAc()) yonetimEkrani(S.yk); } }, ic('kilit'), 'Gizli satırlar (maaş)', h('span', { class: 'nokta' }, '● ● ●')));
    kap.replaceChildren.apply(kap, p);
  }

  async function durumEkrani() {
    var kap = ekranHazir(false); kap.replaceChildren(yukleniyor());
    var d; try { d = await api('durum'); } catch (e) { return hataGoster(e); }
    if (d.ayarlar) { S.ayar = d.ayarlar; }
    var p = [h('div', { class: 'ust' }, h('h1', null, 'Durum'), h('span', { class: 'muted sm' }, d.mod + ' · sunucu ' + d.surum)),
      h('div', { class: 'muted sm', style: { margin: '-4px 2px 8px' } }, 'Uygulama ' + APP_SURUM + (S.son ? ' · son istek (' + S.son.eylem + ') ' + S.son.ms + ' ms' + (S.son.sunucuMs != null ? ', sunucu ' + S.son.sunucuMs + ' ms' : '') : '')),
      h('div', { class: 'kart' }, h('div', { class: 'sm' }, 'Açık soru: ', h('b', null, d.soru), ' · kontrol: ', h('b', null, d.kontrol)), h('div', { class: 'muted sm', style: { marginTop: '6px' } }, 'Belgeler: ' + d.belge)),
      h('div', { class: 'satir-btn', style: { marginBottom: '14px' } }, h('button', { class: 'btn', onclick: async function (ev) { var b = ev.currentTarget; b.disabled = true; b.textContent = 'İşleniyor… (birkaç dk)'; try { var r = await api('isle'); toast('Sonuç: ' + r.durum + (r.islenen != null ? ' (' + r.islenen + ' belge)' : '')); } catch (e) { toast(hataMetni(e)); } durumEkrani(); } }, 'Şimdi işle'), h('button', { class: 'btn o', onclick: kilitle }, ic('kilit', 20), 'Kilitle'))];
    if (d.uyarilar.length) d.uyarilar.forEach(function (u) { p.push(h('div', { class: 'uyari' }, ic('uyari'), h('span', null, u.mesaj))); }); else p.push(h('div', { class: 'kart ok' }, '✓ Aktif uyarı yok'));
    p.push(h('div', { class: 'etiket', style: { margin: '14px 0 4px' } }, 'Kontrol listesi'), h('div', { class: 'liste' }, d.kontrolListesi.map(function (k) { return h('div', { class: 'li' }, h('span', { class: k.ok ? 'ok' : 'bad', style: { fontWeight: '700' } }, k.ok ? '✓' : '✗'), h('div', { class: 'g' }, h('b', null, k.ad), h('span', { class: 'muted sm', style: { whiteSpace: 'normal' } }, k.ayrinti))); })));
    p.push(h('div', { class: 'etiket', style: { margin: '14px 0 4px' } }, 'Son olaylar'), h('div', { class: 'liste' }, d.son.map(function (s) { return h('div', { class: 'li' }, h('div', { class: 'g' }, h('b', { style: { whiteSpace: 'normal' } }, s.olay + ' · ' + s.sonuc), h('span', { class: 'muted sm', style: { whiteSpace: 'normal' } }, s.z + (s.ayrinti ? ' · ' + s.ayrinti : '')))); })));
    p.push(h('button', { class: 'btn g blok', style: { marginTop: '16px' }, onclick: function () { if (confirm('Bu cihazdaki kayıtlı adres/anahtar silinsin mi? (Sunucudaki veri etkilenmez)')) { localStorage.removeItem(DEPO); kilitle(); basla(); } } }, 'Bu cihazdan çıkış (kurulumu sıfırla)'));
    kap.replaceChildren.apply(kap, p);
  }

  // ---------------------------------------------------------------- yönlendirme
  var EKRANLAR = { bugun: bugunEkrani, soru: function () { return sorularEkrani(); }, hareket: function () { return hareketlerEkrani(); }, ekle: ekleEkrani, yonetim: function () { return yonetimEkrani(); }, durum: durumEkrani };
  function yenile() { tk = null; return EKRANLAR[S.ekran](); }
  function git(ad) { S.ekran = ad; document.querySelectorAll('.nav button').forEach(function (b) { b.classList.toggle('on', b.dataset.ad === ad); }); return yenile(); }
  function ana() {
    app.replaceChildren(h('div', { class: 'ekran', id: 'ek' }), h('nav', { class: 'nav' }, [['bugun', 'Bugün'], ['soru', 'Sorular'], ['hareket', 'Hareket'], ['ekle', 'Ekle'], ['yonetim', 'Yönetim'], ['durum', 'Durum']].map(function (x) {
      return h('button', { 'data-ad': x[0], onclick: function () { git(x[0]); } }, ic(x[0]), x[1]);
    })));
    git(S.ekran || 'bugun');
  }
  function kilitle() { S.cfg = null; S.g = null; if (S.gTimer) clearTimeout(S.gTimer); S.ref = null; tk = null; var t = document.getElementById('toast'); if (t) t.remove(); document.querySelectorAll('.ort').forEach(function (o) { o.remove(); }); kilitEkrani(); }

  // ---------------------------------------------------------------- kurulum / kilit
  function giris(baslik, alt, ...govde) { app.replaceChildren(h('div', { class: 'giris' }, h('div', { class: 'logo' }, h('img', { src: 'icon.svg', width: 64, height: 64, alt: '' })), h('h1', null, baslik), h('div', { class: 'muted', style: { margin: '6px 0 18px' } }, alt), govde, h('div', { class: 'muted sm', style: { marginTop: '18px', textAlign: 'center' } }, 'Uygulama ' + APP_SURUM))); }
  function kurulumEkrani() {
    var url = h('input', { class: 'alan', type: 'url', placeholder: 'https://script.google.com/macros/s/…/exec', autocomplete: 'off', autocapitalize: 'off' }), token = h('input', { class: 'alan', type: 'password', placeholder: 'Anahtar (apiKurulum çıktısı)', autocomplete: 'off' });
    var pin = h('input', { class: 'alan', type: 'password', inputmode: 'numeric', placeholder: 'PIN (en az 8 rakam)', autocomplete: 'off' }), pin2 = h('input', { class: 'alan', type: 'password', inputmode: 'numeric', placeholder: 'PIN tekrar', autocomplete: 'off' }), hata = h('div', { class: 'hata' }), dugme = h('button', { class: 'btn blok' }, 'Kur');
    dugme.onclick = async function () {
      hata.textContent = ''; var u = url.value.trim(), t = token.value.trim();
      if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u)) return hata.textContent = 'Adres https://script.google.com/macros/s/…/exec biçiminde olmalı';
      if (t.length < 32) return hata.textContent = 'Anahtar çok kısa';
      if (!/^\d{8,16}$/.test(pin.value)) return hata.textContent = 'PIN 8–16 rakam olmalı';
      if (pin.value !== pin2.value) return hata.textContent = 'PIN\'ler aynı değil';
      dugme.disabled = true; dugme.textContent = 'Doğrulanıyor…'; S.cfg = { url: u, token: t };
      try {
        await api('ping');
        try { await api('pinKur', { pin: pin.value }); } catch (e) { if (e.kod !== 'pin_var') throw e; await api('gizliAc', { pin: pin.value }); }   // sunucuda PIN varsa aynısı mı
        localStorage.setItem(DEPO, JSON.stringify(await MC.sifrele(pin.value, { url: u, token: t })));
        S.g = null; ana();
      } catch (e) { S.cfg = null; hata.textContent = hataMetni(e) + (e.kod === 'pin' ? ' — sunucudaki PIN farklı; pinSifirla() çalıştırıp tekrar dene' : ''); dugme.disabled = false; dugme.textContent = 'Kur'; }
    };
    giris('MizanSK kurulumu', 'Adres ve anahtar bu cihazda PIN ile şifrelenir; PIN hiçbir yere kaydedilmez.', url, token, pin, pin2, hata, dugme);
  }
  function kilitEkrani() {
    var kayit = null; try { kayit = JSON.parse(localStorage.getItem(DEPO)); } catch (e) { kayit = null; }
    if (!kayit) return kurulumEkrani();
    var deger = '', yanlis = 0, nokta = h('div', { class: 'pin' }), hata = h('div', { class: 'hata' }), tamam = h('button', { class: 'btn blok', disabled: true }, 'Aç');
    function ciz() { nokta.replaceChildren.apply(nokta, deger.split('').map(function () { return h('i'); })); tamam.disabled = deger.length < 8; }
    var kp = h('div', { class: 'kp' });
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].forEach(function (k) { kp.appendChild(h('button', { type: 'button', style: k === '' ? { visibility: 'hidden' } : {}, onclick: function () { if (k === '⌫') deger = deger.slice(0, -1); else if (k && deger.length < 16) deger += k; ciz(); } }, k || ' ')); });
    tamam.onclick = async function () {
      tamam.disabled = true;
      try { var c = await MC.coz(deger, kayit); S.cfg = c; S.sonEtkin = Date.now(); deger = ''; ana(); }
      catch (e) { yanlis++; deger = ''; ciz(); hata.textContent = 'PIN yanlış' + (yanlis >= 3 ? ' — ' + Math.min(yanlis * 5, 60) + ' sn bekle' : ''); if (yanlis >= 3) { tamam.disabled = true; setTimeout(function () { ciz(); }, Math.min(yanlis * 5, 60) * 1000); } }
    };
    var unuttum = h('button', { class: 'btn g blok', style: { marginTop: '8px', minHeight: '44px', fontSize: '15px' }, onclick: function () {
      if (confirm('Bu cihazdaki kayıt silinsin mi? Sunucudaki veri etkilenmez; adres + anahtar + yeni PIN ile yeniden kurarsın (PIN sıfırlama: Apps Script’te pinSifirla()).')) { localStorage.removeItem(DEPO); kurulumEkrani(); }
    } }, 'PIN\'i unuttum / bu cihazı sıfırla');
    giris('MizanSK', 'PIN ile aç', nokta, hata, kp, tamam, unuttum); ciz();
  }

  // ---------------------------------------------------------------- otomatik kilit
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { S.gizlendi = Date.now(); S.g = null; if (S.gTimer) clearTimeout(S.gTimer); }
    else if (S.cfg) { if (Date.now() - S.gizlendi > S.ayar.kilitDk * 60000) kilitle(); else if (document.getElementById('ek')) yenile(); }
  });
  ['pointerdown', 'keydown'].forEach(function (o) { document.addEventListener(o, function () { S.sonEtkin = Date.now(); }, { passive: true }); });
  setInterval(function () { if (S.cfg && Date.now() - S.sonEtkin > S.ayar.kilitDk * 60000) kilitle(); }, 15000);

  function basla() { if (localStorage.getItem(DEPO)) kilitEkrani(); else kurulumEkrani(); }
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () { /* kabuk önbelleği isteğe bağlı */ });
  basla();
})();
