/* MizanSK mobil uygulama (PWA) · Cep 2.0 Faz 1: yalnız teyit ve operasyon ekranları (Sorular, Öneriler, İşlemler, Yapıştır). Bilgi ekranı yok.
 * Veri yalnız imzalı API'den gelir (82_Api.gs). Adres+anahtar cihaz anahtarıyla (IndexedDB, dışa aktarılamaz) şifreli durur; açılışta şifre sorulmaz.
 * Face ID (passkey + PRF) kuruluysa uygulama Face ID ile açılır ve maaş satırları açık gelir; yoksa maaş maskeli gelir, "İçeriği göster" şifre ister (60 sn).
 * Güvenlik: sayfaya yazılan her metin textContent/createTextNode ile basılır; innerHTML YALNIZ sabit simge dizgeleri için. */
(function () {
  'use strict';
  var MC = window.MizanCrypto, DEPO = 'mizansk.v2', DEPO_FID = 'mizansk.faceid', APP_SURUM = '2.04';
  var S = { cfg: null, pin: null, g: null, gTimer: null, ekran: 'soru', sekme: null, bas: {}, kisayollar: [], ref: null, onb: {}, gec: {}, dokundu: false, ayar: { gizliSure: 60, kilitDk: 3 }, sonEtkin: Date.now(), faceId: null, kilitli: false, sayilar: {} };
  var app = document.getElementById('app');

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
    soru: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.7.4-1 .9-1 1.6"/><circle cx="12" cy="17" r=".9" fill="currentColor" stroke="none"/>',
    oneri: '<path d="M4 6h10M4 12h10M4 18h7"/><path d="M16 12l2.5 2.5L23 10"/>', islem: '<path d="M6 4l14 8-14 8z"/>', yapistir: '<rect x="5" y="4" width="14" height="17" rx="2.5"/><path d="M9 4V3h6v1M9 10h6M9 14h6"/>',
    ok: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', kilit: '<rect x="5" y="11" width="14" height="9" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', nokta: '<circle cx="12" cy="12" r="4" fill="currentColor"/>',
    yuz: '<path d="M4 9V6a2 2 0 0 1 2-2h3M15 4h3a2 2 0 0 1 2 2v3M20 15v3a2 2 0 0 1-2 2h-3M9 20H6a2 2 0 0 1-2-2v-3"/><circle cx="9" cy="10" r=".9" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r=".9" fill="currentColor" stroke="none"/><path d="M12 10v3h-1M9 15.5c.8 1 1.8 1.5 3 1.5s2.2-.5 3-1.5"/>',
    uyari: '<path d="M12 4l9 16H3z"/><path d="M12 10v4"/>', ara: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>', sag: '<path d="M9 6l6 6-6 6"/>', not: '<path d="M5 4h14v12l-4 4H5z"/><path d="M15 20v-4h4M8 9h8M8 13h5"/>', geri: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-4"/>'
  };
  function ic(n, z) { var s = h('span', { class: 'ic' }); s.innerHTML = '<svg width="' + (z || 22) + '" height="' + (z || 22) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + IC[n] + '</svg>'; return s; }
  function para(n) { return Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  var AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  function tarihKisa(iso) { return iso ? Number(iso.slice(8, 10)) + ' ' + AY[Number(iso.slice(5, 7)) - 1] : ''; }
  function tutarMetni(k) {
    if (k.gizli) return '●●●,●● ₺';
    if (k.tutar !== '' && k.tutar != null) return para(k.adet > 1 && k.toplam !== '' && k.toplam != null ? k.toplam : k.tutar) + ' ₺';
    return k.dovizTutar !== '' && k.dovizTutar != null ? para(k.dovizTutar) + ' ' + (k.doviz || '') : '?';
  }
  var HATA = { imza: 'İmza geçersiz: adres/anahtar yanlış olabilir', saat: 'Telefon saati sunucudan çok farklı', tekrar: 'Tekrarlanan istek reddedildi', kurulmamis: 'Sunucuda API anahtarı yok (apiKurulum çalıştır)', istek: 'Geçersiz istek',
    eylem: 'Bilinmeyen eylem', gizli: 'Bu kayıt maskeli: önce şifreyle aç', pin: 'Şifre yanlış', kilit: 'Çok fazla yanlış deneme: bir süre kilitli', pin_yok: 'Sunucuda şifre yok', pin_var: 'Sunucuda şifre zaten var', pin_bicim: 'Şifre en az 8 rakam olmalı', mesgul: 'Sunucu meşgul, biraz sonra dene', kapali: 'Uygulama sunucuda kapatılmış (sabit>ayar API_KAPALI)' };

  // Yeniden deneme YALNIZ okuma eylemlerinde: yazan eylem ikinci kez gönderilirse çift kayıt düşer.
  var OKUMA_ = { sorular: 1, durum: 1, ping: 1 }, YAZAN_ = { bol: 1, cevapla: 1, maasCevap: 1, geriAl: 1, ekle: 1, oneri: 1, isle: 1, onaylaToplu: 1, kurCek: 1, onbellekIsit: 1, yedekAl: 1, apiKapat: 1, yapistir: 1, bicim: 1 };
  var UZUN_ = { onaylaToplu: 120000, bol: 60000, isle: 330000, yapistir: 330000, bicim: 330000, yedekAl: 120000, kurCek: 120000, onbellekIsit: 120000 };
  async function api(eylem, d) {
    if (eylem !== 'gizliAc' && eylem !== 'ping') await gizliYenile();
    var gecerli = S.g && S.g.e > Date.now() ? S.g : null, r, j = null, t0 = performance.now(), deneme_say = OKUMA_[eylem] ? 2 : 1, sure = UZUN_[eylem] || 45000;
    if (YAZAN_[eylem]) S.gec = {};
    for (var deneme = 0; deneme < deneme_say; deneme++) {
      var govde = await MC.imzala(S.cfg.token, eylem, d || {}, gecerli), ac = new AbortController(), zt = setTimeout(function () { ac.abort(); }, sure);
      try { r = await fetch(S.cfg.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: govde, redirect: 'follow', cache: 'no-store', referrerPolicy: 'no-referrer', signal: ac.signal }); j = await r.json(); clearTimeout(zt); break; }
      catch (e) { clearTimeout(zt); j = null; if (deneme === deneme_say - 1) throw new Error(e && e.name === 'AbortError' ? 'Sunucu yanıt vermedi (' + Math.round(sure / 1000) + ' sn)' : 'Bağlantı kurulamadı'); }
    }
    S.son = { eylem: eylem, ms: Math.round(performance.now() - t0), sunucuMs: j && j.ms != null ? j.ms : null };
    if (!j) throw new Error('Yanıt okunamadı (adres doğru mu?)');
    if (!j.ok) { var er = new Error(HATA[j.e] || j.m || j.e || 'Hata'); er.kod = j.e; er.j = j; throw er; }
    return j.d === undefined ? j : j.d;
  }
  async function apiOnb(eylem, d, omur) {
    var anah = eylem + '|' + (S.g && S.g.e > Date.now() ? 'g' : '-') + '|' + JSON.stringify(d || {}), c = S.gec[anah];
    if (c && Date.now() - c.t < (omur || 60000)) return c.d;
    var r = await api(eylem, d); S.gec[anah] = { d: r, t: Date.now() }; return r;
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
  function onayla(baslik, metin, dugme) {
    return new Promise(function (coz) {
      altSayfa(function (sy, kapat) {
        sy.append(h('div', { class: 'b18' }, baslik), h('div', { class: 'muted', style: { margin: '6px 0 14px' } }, metin),
          h('div', { class: 'satir-btn' }, h('button', { class: 'btn o', onclick: function () { kapat(); coz(false); } }, 'Vazgeç'), h('button', { class: 'btn' + (dugme && dugme.tehlike ? ' kirmizi' : ''), onclick: function () { kapat(); coz(true); } }, dugme && dugme.ad || 'Tamam')));
      });
    });
  }
  /** Rakam tuş takımı; en az 8 hane. Sonuç: şifre metni ya da null (vazgeç). Yalnız Face ID yokken maaş satırını açmak için. */
  function pinSor(baslik, alt) {
    return new Promise(function (coz) {
      var deger = '', nokta = h('div', { class: 'pin', 'aria-label': 'Şifre' }), tamam = h('button', { class: 'btn blok', disabled: true }, 'Göster'), bitti = false;
      function ciz() { nokta.replaceChildren.apply(nokta, deger.split('').map(function () { return h('i'); })); tamam.disabled = deger.length < 8; }
      altSayfa(function (sy, kapat) {
        function bitir(v) { if (bitti) return; bitti = true; kapat(); coz(v); }
        sy.parentNode.addEventListener('click', function (e) { if (e.target === sy.parentNode) bitir(null); });
        var kp = h('div', { class: 'kp' });
        ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'İptal', '0', '⌫'].forEach(function (k) {
          kp.appendChild(h('button', { type: 'button', onclick: function () { if (k === 'İptal') return bitir(null); if (k === '⌫') deger = deger.slice(0, -1); else if (deger.length < 16) deger += k; ciz(); } }, k));
        });
        tamam.onclick = function () { bitir(deger); };
        sy.append(h('div', { class: 'b18', style: { textAlign: 'center' } }, baslik), h('div', { class: 'muted sm', style: { textAlign: 'center', marginTop: '3px' } }, alt || ''), nokta, kp, tamam);
        ciz();
      });
    });
  }

  // ---------------------------------------------------------------- gizli (maaş) izni
  function gizliKapat() { S.g = null; if (S.gTimer) { clearTimeout(S.gTimer); S.gTimer = null; } if (S.cfg && document.getElementById('ek') && !S.pin) yenile(); }
  async function gizliAcPinle(pin) {
    var r = await api('gizliAc', { pin: pin }); S.g = r.g; if (r.sure) S.ayar.gizliSure = r.sure;
    if (S.gTimer) clearTimeout(S.gTimer); S.gTimer = setTimeout(gizliKapat, Math.max(1000, r.g.e - Date.now()));
  }
  /** Face ID ile açıldıysa şifre bellektedir: izin süresi dolunca sessizce yenilenir (maaş hep açık). */
  async function gizliYenile() {
    if (!S.pin || (S.g && S.g.e > Date.now() + 3000) || S.gYenileniyor) return;
    S.gYenileniyor = true;
    try { await gizliAcPinle(S.pin); } catch (e) { S.pin = null; } finally { S.gYenileniyor = false; }
  }
  /** Face ID yok: maaş satırını şifreyle 60 sn açar. */
  async function gizliAc() {
    if (S.g && S.g.e > Date.now()) return true;
    var pin = await pinSor('Şifre gir', 'Maaş açıklaması ve tutarı ' + S.ayar.gizliSure + ' sn görünür, sonra yeniden maskelenir');
    if (!pin) return false;
    try { await gizliAcPinle(pin); return true; } catch (e) { toast(hataMetni(e)); return false; }
  }

  // ---------------------------------------------------------------- Face ID (passkey + PRF): şifre cihazda PRF anahtarıyla şifreli durur
  var FID = {
    var: function () { return !!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.get); },
    /** Cihazda kullanıcı doğrulamalı platform doğrulayıcı (Face ID / Touch ID) var mı? Sonuç S.fidVar'da tutulur. */
    async varMi() { if (S.fidVar != null) return S.fidVar; try { S.fidVar = this.var() && !!(await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch (e) { S.fidVar = false; } return S.fidVar; },
    kayit: function () { try { return JSON.parse(localStorage.getItem(DEPO_FID) || 'null'); } catch (e) { return null; } },
    async kur(pin) {
      if (!this.var()) throw new Error('Bu cihazda passkey yok');
      var tuz = crypto.getRandomValues(new Uint8Array(32)), kimlik = crypto.getRandomValues(new Uint8Array(16));
      var cred = await navigator.credentials.create({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), rp: { name: 'MizanSK' }, user: { id: kimlik, name: 'mizan', displayName: 'MizanSK' },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }], authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'required', userVerification: 'required' }, extensions: { prf: {} } } });
      var ext = cred.getClientExtensionResults ? cred.getClientExtensionResults() : {};
      if (!(ext.prf && ext.prf.enabled)) throw new Error('Face ID çalışıyor ama PRF uzantısı yok: maaş için şifre kullanılacak');
      var id = new Uint8Array(cred.rawId), anahtar = await this.anahtar(id, tuz);
      var iv = crypto.getRandomValues(new Uint8Array(12)), ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, anahtar, new TextEncoder().encode(pin));
      localStorage.setItem(DEPO_FID, JSON.stringify({ v: 1, id: MC.b64(id), tuz: MC.b64(tuz), iv: MC.b64(iv), ct: MC.b64(ct) }));
      return true;
    },
    async anahtar(id, tuz) {
      var a = await navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ id: id, type: 'public-key' }], userVerification: 'required', extensions: { prf: { eval: { first: tuz } } } } });
      var ext = a.getClientExtensionResults ? a.getClientExtensionResults() : {}, ham = ext.prf && ext.prf.results && ext.prf.results.first;
      if (!ham) throw new Error('PRF sonucu yok');
      return crypto.subtle.importKey('raw', ham, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    },
    /** Kilit açma: Face ID → PRF → şifre → sunucuda gizli izin. */
    async ac() {
      var k = this.kayit(); if (!k) return false;
      var anahtar = await this.anahtar(MC.unb64(k.id), MC.unb64(k.tuz));
      var pin = new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: MC.unb64(k.iv) }, anahtar, MC.unb64(k.ct)));
      S.pin = pin; try { await gizliAcPinle(pin); } catch (e) { /* sunucu izni sonra yenilenir */ }
      return true;
    },
    sil: function () { localStorage.removeItem(DEPO_FID); S.pin = null; }
  };

  // ---------------------------------------------------------------- cari seçimi (alt sayfa): arama, sık etiketler, 5 etiket, açıklama, kural
  function cariSec(baslangic) {
    return new Promise(function (coz) {
      var bitti = false;
      altSayfa(function (sy, kapat) {
        function bitir(v) { if (bitti) return; bitti = true; kapat(); coz(v); }
        sy.parentNode.addEventListener('click', function (e) { if (e.target === sy.parentNode) bitir(null); });
        var ara = h('input', { class: 'alan ara-alan', placeholder: 'Cari ara…', type: 'search', autocomplete: 'off' }), liste = h('div', { class: 'liste' });
        function ciz() {
          var q = ara.value.trim().toLocaleLowerCase('tr-TR');
          liste.replaceChildren.apply(liste, (S.ref.cariler || []).filter(function (c) { return !q || (c.cari + ' ' + c.sinif).toLocaleLowerCase('tr-TR').indexOf(q) >= 0; }).slice(0, 60).map(function (c) {
            return h('div', { class: 'li cs', role: 'button', tabindex: '0', onclick: function () { etiketAdimi(c.cari); } }, cariSimge(c.cari, 40), h('div', { class: 'g' }, h('b', null, c.cari)), h('span', { class: 'muted sm' }, c.sinif));
          }));
        }
        function etiketAdimi(cari) {
          var et = ['', '', '', '', ''], ol = (S.ref.cariOneri || {})[cari] || [], inp = [], kural = h('input', { type: 'checkbox' }), acikGiris = null;
          sy.replaceChildren(h('div', { class: 'tut' }), h('div', { class: 'b18' }, cari), h('div', { class: 'muted sm', style: { marginBottom: '8px' } }, 'Etiketler (isteğe bağlı)'));
          if (ol.length) { sy.appendChild(h('div', { class: 'etiket' }, 'Sık kullanılan etiketler')); sy.appendChild(h('div', null, ol.map(function (o) { return h('span', { class: 'chip', onclick: function () { inp.forEach(function (x, i) { x.value = o[i] || ''; }); } }, o.filter(String).join(' / ') || '(boş)'); }))); }
          for (var i = 0; i < 5; i++) { var x = h('input', { class: 'alan', type: 'text', placeholder: 'Etiket-' + (i + 1), value: et[i] || '', style: { minHeight: '44px', margin: '2px 0 6px' } }); inp.push(x); sy.appendChild(x); }
          if (baslangic && baslangic.aciklama != null) { sy.appendChild(h('div', { class: 'etiket', style: { margin: '8px 0 2px' } }, 'Açıklama (isteğe bağlı değiştir)')); acikGiris = h('input', { class: 'alan', type: 'text', maxlength: '120', value: baslangic.aciklama, style: { minHeight: '44px', margin: '2px 0 6px' } }); sy.appendChild(acikGiris); }
          sy.appendChild(h('label', { class: 'muted sm', style: { display: 'flex', gap: '10px', alignItems: 'center', margin: '4px 0 12px', minHeight: '44px' } }, kural, 'Bu satıcı hep böyle (kural)'));
          sy.appendChild(h('button', { class: 'btn blok', onclick: function () { bitir({ cari: cari, etiket: inp.map(function (x) { return x.value; }), kural: kural.checked, aciklama: acikGiris ? acikGiris.value : undefined }); } }, cari + ' olarak seç'));
          sy.scrollTop = 0;
        }
        ara.oninput = ciz; sy.append(ara, liste); ciz(); setTimeout(function () { ara.focus(); }, 50);
      });
    });
  }

  // ---------------------------------------------------------------- ekranlar
  var ek = null;
  function ekranHazir(tekerlek) { ek = document.getElementById('ek'); ek.className = 'ekran' + (tekerlek ? ' tk' : ''); ek.scrollTop = 0; return ek; }
  function hataGoster(e) { ek.replaceChildren(h('div', { class: 'bos' }, hataMetni(e), h('div', { style: { marginTop: '14px' } }, h('button', { class: 'btn o', onclick: yenile }, 'Yeniden dene')))); }
  function baslik(ad, sag) { return h('div', { class: 'ust' }, h('h1', null, ad), sag ? h('span', { class: 'muted sm' }, sag) : null); }

  /** Bir soru kartının seçenekleri: plan adayları, geçmişten tekrarlar, öneriler, (hesap sorusunda) hızlı kısayollar. Sıra = varsayılan seçim önceliği. */
  function secenekleriKur(k, mod) {
    var out = [], et = function (a) { return (a || []).filter(String).join(' / '); };
    (k.planlar || []).forEach(function (p) {
      out.push({ grup: 'Plan adayı', cari: p.cari, etiket: p.etiket.slice(), metin: p.cari + (et(p.etiket) ? ' · ' + et(p.etiket) : ''), alt: 'plan ' + para(Math.abs(p.planTutar)) + ' ₺ · ' + tarihKisa(p.planTarih) + (p.fark ? ' · fark ' + (p.fark > 0 ? '+' : '') + para(p.fark) : ' · fark 0') });
    });
    (k.gecmis || []).forEach(function (g) { out.push({ grup: 'Geçmişten · aynı tutar, ayın aynı günleri', cari: g.cari, etiket: g.etiket.slice(), metin: g.cari + (et(g.etiket) ? ' · ' + et(g.etiket) : ''), alt: g.ay + ' / ' + g.pencere + ' ay' }); });
    (k.oneriler || []).slice(0, 3).forEach(function (o) { out.push({ grup: mod === 'kontrol' ? 'Mevcut atama / öneri' : o.kaynak === 'gmail' ? 'Siparişten (Gmail)' : 'Öneri', cari: o.cari, etiket: o.etiket.slice(), metin: o.cari + (et(o.etiket) ? ' · ' + et(o.etiket) : ''), alt: o.kaynak === 'mevcut' ? 'sistemin yazdığı' : (o.kaynak === 'claude' ? 'Claude önerisi' : o.kaynak === 'gmail' ? 'sipariş e-postası' : 'geçmiş') + (o.yuzde ? ' · %' + o.yuzde : '') }); });
    if (k.kaynak === 'hesap' && mod !== 'kontrol') S.kisayollar.forEach(function (c) { out.push({ grup: 'Hızlı', cari: c.cari, etiket: c.etiket.slice(), metin: c.ad, hizli: true }); });
    if (k.kendine) out = out.filter(function (x) { return x.hizli; }).concat(out.filter(function (x) { return !x.hizli; }));
    if (mod === 'kontrol') { var ilk = out.filter(function (x) { return x.grup.indexOf('Mevcut') === 0; }); out = ilk.concat(out.filter(function (x) { return ilk.indexOf(x) < 0; })); }
    return out;
  }
  /** Gmail sipariş bloğu: kesinse numara + ürünler; belirsizse adaylar (hangisi?). */
  function siparisBlogu(k) {
    var sp = k.siparis; if (!sp) return null;
    if (sp.yok) return h('div', { class: 'muted sm', style: { margin: '2px 0 6px' } }, 'Sipariş e-postası bulunamadı (satıcı tanındı, tutar eşleşmedi)');
    if (!sp.aday || !sp.aday.length) return null;
    var kutu = h('div', { class: 'siparis' });
    kutu.appendChild(h('div', { class: 'etiket' }, sp.kesin ? 'Gmail siparişi · ' + sp.aday[0].no : 'Olası siparişler · hangisi?'));
    sp.aday.forEach(function (a) {
      kutu.appendChild(h('div', { class: 'sm', style: { margin: '3px 0 0' } }, (sp.kesin ? '' : tarihKisa(a.tarih) + ' · ' + para(a.kart) + ' ₺ · ') + (a.urun.length ? a.urun.join(' · ') : '(ürün adı okunamadı)')));
      if (a.odeme && a.odeme.indexOf('+') > 0) kutu.appendChild(h('div', { class: 'muted sm', style: { margin: '2px 0 0' } }, 'Sipariş ' + para(a.tutar) + ' ₺ · ödeme: ' + a.odeme));
    });
    return kutu;
  }
  function kaynakCipi(k) { return h('span', { class: 'cip' }, h('i', { class: 'dot ' + (k.kaynak === 'hesap' ? 'tp' : 'kk') }), k.gizli ? (k.banka || 'hesap') : (k.banka || '') + (k.kaynak === 'hesap' ? ' hesap' : ' kart')); }

  /** 2.20 Sorular: gelen kutusu (liste, kaydırarak onay, toplu onay) + satıra dokununca soru ekranı (tek dokunuşla cevap). */
  var BANKA_RENK = { kuveyt: '#1FA971', qnb: '#9A6BE0', vakif: '#E9B10C' }, SINIF_RENK = [['aile', '#F49AC1'], ['ev', '#5EC8C0'], ['muhtelif', '#F5C451'], ['hasene', '#B79CFF'], ['birikim', '#4ADE9A'], ['yatırım', '#7AA2FF'], ['karakaya', '#FFB37A'], ['maaş', '#4ADE9A'], ['kredi', '#FF8E7A']];
  function tk_(x) { return String(x || '').toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/ğ/g, 'g'); }
  function bankaRengi(b) { return BANKA_RENK[tk_(b)] || '#7B8494'; }
  function bankaRozet(b) { return h('span', { class: 'brz', style: { background: bankaRengi(b) } }, String(b || '?').charAt(0).toLocaleUpperCase('tr-TR')); }
  function cariRengi(cari) { var c = (S.ref && S.ref.cariler || []).filter(function (x) { return x.cari === cari; })[0], sn = c ? String(c.sinif).toLocaleLowerCase('tr-TR') : ''; for (var i = 0; i < SINIF_RENK.length; i++) if (sn.indexOf(SINIF_RENK[i][0]) >= 0) return SINIF_RENK[i][1]; return cari === '_Nakil' ? '#7AA2FF' : '#A7B1C0'; }
  function cariSimge(cari, z) { var r = cariRengi(cari), t = String(cari || '?').replace(/^_/, '').split(/\s+/).map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toLocaleUpperCase('tr-TR'); return h('span', { class: 'csim', style: { width: z + 'px', height: z + 'px', color: r, background: r + '26' } }, t); }
  function ad_(k) { return k.gizli ? 'Maaş · maskeli' : (k.alici || k.aciklama); }
  function etMetni(e) { return (e || []).filter(String).join(' / '); }
  /** Kartın en iyi önerisi (kısayollar hariç): {cari, etiket, alt} ya da null. */
  function enIyi(k) { if (k.gizli || k.maas || k.sistem) return null; var o = secenekleriKur(k, 'soru').filter(function (x) { return !x.hizli; })[0]; return o ? { cari: o.cari, etiket: o.etiket.slice(), alt: o.alt || o.grup } : null; }
  function gun_(iso) { var g = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'], d = new Date(iso + 'T12:00:00'); return Number(iso.slice(8, 10)) + ' ' + ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'][Number(iso.slice(5, 7)) - 1] + ' ' + g[d.getDay()]; }

  /** Liste satırı: seçim halkası, banka rozeti, karşı taraf, önerilen cari, tutar. Sağa kaydır: önerilenle onayla; sola: atla. Dokun: soru ekranı. */
  function satirOge(it, i) {
    var k = it.k, o = it.oneri = it.oneri || enIyi(k);
    var hal = h('span', { class: 'hl' + (it.secili ? ' on' : '') + (o ? '' : ' yok'), onclick: function (e) { e.stopPropagation(); if (!o || it.done) return; it.secili = !it.secili; hal.classList.toggle('on', it.secili); topluCiz(); } }, it.secili ? ic('ok', 16) : null);
    var alt = it.done ? h('div', { class: 's2 tp' }, '✓ ' + (it.sonuc || 'kaydedildi')) : (o ? h('div', { class: 's2 mavi' }, '› ' + o.cari + (etMetni(o.etiket) ? ' · ' + etMetni(o.etiket) : '')) : h('div', { class: 's2' }, k.maas ? 'Maaş · BES sorusu' : k.provizyon ? 'Provizyon · cari seç' : 'Cari yok · sor'));
    var ic_ = h('div', { class: 'sri' }, hal, bankaRozet(k.banka), h('div', { class: 'g' }, h('div', { class: 'n' }, ad_(k)), alt),
      h('div', { class: 'a' }, h('div', { class: (k.toplam > 0 ? 'tp' : '') }, tutarMetni(k)), h('div', { class: 's2' }, (k.hesap || (k.kaynak === 'kart' ? 'kart' : '')) + (k.hesapSon4 ? ' ····' + k.hesapSon4 : ''))));
    var arka = h('div', { class: 'srb' }, h('span', { class: 'ok' }, '✓ Onayla'), h('span', { class: 'at' }, 'Atla ›'));
    var el = h('div', { class: 'sr' + (it.done ? ' bitti' : '') + (it.atla ? ' atla' : '') }, arka, ic_);
    var x0 = null, y0 = 0, dx = 0, yatay = false;
    ic_.addEventListener('pointerdown', function (e) { if (it.done) return; x0 = e.clientX; y0 = e.clientY; dx = 0; yatay = false; });
    ic_.addEventListener('pointermove', function (e) {
      if (x0 == null) return; var ddx = e.clientX - x0, ddy = e.clientY - y0;
      if (!yatay && Math.abs(ddx) > 12 && Math.abs(ddx) > Math.abs(ddy) * 1.5) { yatay = true; try { ic_.setPointerCapture(e.pointerId); } catch (x) { /* yok */ } }
      if (!yatay) return; dx = ddx; if (dx > 0 && !o) dx = Math.min(dx, 40); ic_.style.transform = 'translateX(' + dx + 'px)'; el.classList.toggle('sag', dx > 0);
    });
    function birak() {
      if (x0 == null) return; x0 = null; ic_.style.transform = '';
      if (!yatay) return; S.surukle = Date.now();
      if (dx > 90 && o) cevapGonder(it, o, {}); else if (dx < -90) { it.atla = true; el.classList.add('atla'); }
    }
    ic_.addEventListener('pointerup', birak); ic_.addEventListener('pointercancel', birak);
    ic_.addEventListener('click', function () { if (S.surukle && Date.now() - S.surukle < 300) return; if (!it.done) soruDetay(i); });
    it.el = el; return el;
  }
  function topluCiz() {
    var n = (S.liste || []).filter(function (x) { return x.secili && !x.done; }).length, b = document.getElementById('toplu-onay');
    if (b) { b.textContent = n ? '✓ ' + n + ' öneriyi onayla' : 'Seçili öneri yok'; b.disabled = !n; }
  }
  /** Soru ekranı: bağlam, büyük karşı taraf + tutar, "Bu ne içindi?", gerekçeli cevaplar (tek dokunuş), Başka cari, açıklama, Atla/Böl. */
  function soruDetay(i) {
    var it = S.liste[i]; if (!it) return listeCiz();
    S.detay = i; var k = it.k, kap = ekranHazir(false); kap.classList.add('detay');
    var kalan = S.liste.filter(function (x) { return !x.done && !x.atla; }).length;
    var ust = h('div', { class: 'du' }, h('button', { class: 'geri', onclick: function () { S.detay = null; listeCiz(); } }, '‹ Liste'), h('span', { class: 'muted sm' }, kalan + ' kaldı'),
      h('span', { class: 'du-ok' }, h('button', { class: 'ok', 'aria-label': 'Önceki', onclick: function () { sonraki(i, -1); } }, '‹'), h('button', { class: 'ok', 'aria-label': 'Sonraki', onclick: function () { sonraki(i, 1); } }, '›')));
    var yon = k.kaynak === 'kart' ? (k.toplam > 0 ? 'iade / gelir' : 'harcama') : (k.toplam > 0 ? 'geldi' : 'gönderildi');
    var bag = h('div', { class: 'bag' }, bankaRozet(k.banka), h('span', null, h('b', null, k.banka || ''), ' ' + (k.hesap || (k.kaynak === 'kart' ? 'kart' : '')) + (k.hesapSon4 ? ' ····' + k.hesapSon4 : '')), h('span', { class: 'sag' }, tarihKisa(k.tarih) + (k.adet > 1 ? ' · ' + k.adet + ' kalem' : '')));
    var parca = [ust, bag, k.kullanan ? h('span', { class: 'kullanan' }, 'Kullanan: ' + k.kullanan) : null,
      h('div', { class: 'dn disp' }, ad_(k)), h('div', { class: 'dt disp' + (k.toplam > 0 ? ' tp' : '') + (k.gizli ? ' maske' : '') }, k.gizli ? '●●●,●● ₺' : tutarMetni(k), h('span', { class: 'muted dy' }, ' ' + yon))];
    if (k.eski) parca.push(h('div', { class: 'eski' }, h('small', null, k.eski.kural === 'cevap' ? 'ÖNCEKİ CEVABIN' : 'ESKİ KAYIT · ' + (k.eski.kural === 'birebir' ? 'AYNI GÜN, AYNI TUTAR' : k.eski.kural)), h('b', null, k.eski.cari || '?'), k.eski.acik ? ' · ' + k.eski.acik : '', k.eski.not ? h('div', { class: 'sari sm' }, k.eski.not) : null));
    if (k.maas) {
      parca.push(k.gizli && !S.faceId ? h('button', { class: 'baglanti', onclick: async function () { if (await gizliAc()) { S.onb = {}; sorularEkrani(S.sekme, 'yeniden'); } } }, 'İçeriği göster · şifre ile ›') : null,
        h('div', { class: 'soru disp' }, 'Bu gelir ne?'),
        h('div', { class: 'cvp' }, cevapSatiri('Aylık maaş', 'BES ayrıştırılır (kesinti + işveren katkısı)', null, function () { maasCevap(it, 'bes'); }),
          cevapSatiri('Prim / diğer', 'BES yok, yalnız onay', null, function () { maasCevap(it, 'bes_yok'); }),
          cevapSatiri('Kesinti var', 'Fark seçeceğin cariye yazılır', null, async function () { var c = await cariSec(null); if (c && c.cari) maasCevap(it, 'kesinti', c.cari); })));
    } else {
      var sec = secenekleriKur(k, 'soru'), cev = sec.filter(function (x) { return !x.hizli; }).slice(0, 4), hz = sec.filter(function (x) { return x.hizli; });
      parca.push(siparisBlogu(k), h('div', { class: 'soru disp' }, 'Bu ne içindi?'));
      parca.push(h('div', { class: 'cvp' }, cev.map(function (o, j) { return cevapSatiri(o.cari + (etMetni(o.etiket) ? ' · ' + etMetni(o.etiket) : ''), o.alt || o.grup, o.cari, function () { cevapGonder(it, { cari: o.cari, etiket: o.etiket.slice() }, {}); }, j === 0); }),
        h('button', { class: 'baska2', onclick: async function () { var c = await cariSec({ aciklama: it.acik != null ? it.acik : k.aciklama }); if (c && c.cari) cevapGonder(it, c, { kural: c.kural, aciklama: c.aciklama }); } }, ic('ara', 22), 'Başka bir cari…')));
      if (hz.length) parca.push(h('div', { class: 'hizli-satir' }, hz.map(function (o) { return h('span', { class: 'chip', onclick: function () { cevapGonder(it, { cari: o.cari, etiket: o.etiket.slice() }, {}); } }, o.metin); })));
      if (!k.gizli && k.adet === 1) parca.push(h('button', { class: 'acik-sat', onclick: function () { ayrintiSayfasi(it); } }, ic('not', 20), h('span', { class: 'muted' }, 'Açıklama: '), h('span', { class: 'g' }, it.acik != null ? it.acik : k.aciklama), h('b', { class: 'mavi' }, 'Düzenle')));
    }
    parca.push(h('div', { class: 'df' }, h('button', { class: 'btn o', onclick: function () { it.atla = true; sonraki(i, 1); } }, 'Atla'),
      k.bolunebilir ? h('button', { class: 'btn o', onclick: function () { bolEkrani(it); } }, 'Böl') : null,
      !k.maas && !k.gizli ? h('button', { class: 'btn', onclick: function () { ayrintiSayfasi(it); } }, 'Ayrıntılı') : null));
    kap.replaceChildren.apply(kap, parca.filter(Boolean));
    S.soruAnahtar = k.anahtar;
  }
  function cevapSatiri(baslik, alt, cari, f, ilk) { return h('button', { class: 'cv' + (ilk ? ' ilk' : ''), onclick: f }, cari ? cariSimge(cari, 44) : h('span', { class: 'csim', style: { width: '44px', height: '44px' } }, '₺'), h('span', { class: 'g' }, h('b', null, baslik), alt ? h('span', { class: 'muted sm' }, alt) : null), ic('sag', 20)); }
  function sonraki(i, d) {
    var n = S.liste.length;
    for (var j = i + d; j >= 0 && j < n; j += d) if (!S.liste[j].done && !S.liste[j].atla) return soruDetay(j);
    S.detay = null; listeCiz();
  }
  /** Ayrıntı: seçili cari (değiştir), açıklama (öneriler), Etiket-1…5 (seviye önerileri), kural; Kaydet ve sonraki. */
  function ayrintiSayfasi(it) {
    var k = it.k, sec = it.sec || (enIyi(k) ? { cari: enIyi(k).cari, etiket: enIyi(k).etiket.slice() } : { cari: '', etiket: ['', '', '', '', ''] });
    altSayfa(function (sy, kapat) {
      var cariSat = h('div', { class: 'secili' }), acik = h('input', { class: 'alan', type: 'text', maxlength: '120', value: it.acik != null ? it.acik : k.aciklama, 'aria-label': 'Açıklama' }), et = [], etKutu = h('div', { class: 'etk' }), setler = h('div', { class: 'hizli-satir' });
      var kural = h('input', { type: 'checkbox' });
      function cariCiz() {
        cariSat.replaceChildren(sec.cari ? cariSimge(sec.cari, 44) : h('span', { class: 'csim', style: { width: '44px', height: '44px' } }, '?'), h('div', { class: 'g' }, h('b', null, sec.cari || 'Cari seçilmedi'), h('span', { class: 'muted sm' }, ad_(k) + ' · ' + tutarMetni(k))),
          h('button', { class: 'chip', onclick: async function () { var c = await cariSec(null); if (c && c.cari) { sec = { cari: c.cari, etiket: (c.etiket || []).slice() }; cariCiz(); etCiz(); } } }, 'Değiştir'));
      }
      function etCiz() {
        var havuz = (S.ref.etiketHavuzu || {})[sec.cari] || [];
        et = []; etKutu.replaceChildren();
        for (var i = 0; i < 5; i++) {
          var dl = 'dl-et-' + i, x = h('input', { class: 'alan et-alan', type: 'text', placeholder: (i + 1) + '. etiket', list: dl, value: (sec.etiket || [])[i] || '' });
          et.push(x); etKutu.append(h('label', { class: 'et-sat' }, h('small', null, String(i + 1)), x), h('datalist', { id: dl }, (havuz[i] || []).map(function (v) { return h('option', { value: v }); })));
          if (i >= 1 && !(sec.etiket || [])[i] && !(sec.etiket || [])[i - 1] && !(havuz[i] || []).length) break;     // gereken kadar seviye
        }
        var ol = (S.ref.cariOneri || {})[sec.cari] || [];
        setler.replaceChildren.apply(setler, ol.filter(function (o) { return etMetni(o); }).map(function (o) { return h('span', { class: 'chip', onclick: function () { sec.etiket = o.slice(); etCiz(); } }, etMetni(o)); }));
      }
      var acikCip = h('div', { class: 'hizli-satir' }, (k.acikOneri || []).concat([k.aciklama]).filter(function (v, j, a) { return v && a.indexOf(v) === j; }).map(function (v) { return h('span', { class: 'chip', onclick: function () { acik.value = v; } }, v === k.aciklama ? 'Banka metni' : v); }));
      cariCiz(); etCiz();
      sy.append(cariSat, h('div', { class: 'etiket', style: { marginTop: '14px' } }, 'Açıklama'), acik, acikCip,
        h('div', { class: 'etiket', style: { marginTop: '14px' } }, 'Etiket'), setler, etKutu,
        h('label', { class: 'muted sm', style: { display: 'flex', gap: '10px', alignItems: 'center', minHeight: '48px' } }, kural, 'Bu satıcı hep böyle (kural)'),
        k.kaynak === 'kart' ? h('div', { class: 'muted sm', style: { marginBottom: '8px' } }, 'Kartta banka metni başta kalır; yazdığın " — " ile eklenir.') : null,
        h('div', { class: 'satir-btn' }, h('button', { class: 'btn o', onclick: kapat }, 'Vazgeç'), h('button', { class: 'btn', style: { flex: 1 }, onclick: function () {
          if (!sec.cari) return toast('Önce cari seç');
          it.acik = acik.value; kapat(); cevapGonder(it, { cari: sec.cari, etiket: et.map(function (x) { return x.value.trim(); }).concat(['', '', '', '', '']).slice(0, 5) }, { kural: kural.checked, aciklama: acik.value });
        } }, '✓ Kaydet ve sonraki')));
    });
  }

  // ---------------------------------------------------------------- cevap kuyruğu: kart hemen kapanır, yazım arkada; hata olursa kart geri açılır
  S.kuyruk = []; S.kuyrukIs = null;
  function kuyrukEkle(is) { S.kuyruk.push(is); if (!S.kuyrukIs) S.kuyrukIs = (async function () { while (S.kuyruk.length) { var j = S.kuyruk.shift(); try { await j(); } catch (e) { /* iş kendi hatasını yönetir */ } } S.kuyrukIs = null; })(); }
  function kuyrukBekle() { return S.kuyrukIs || Promise.resolve(); }
  /** Cevap gönder: satır hemen işaretlenir, sonraki soruya geçilir; yazım arkada (sırayla). Hata olursa satır geri açılır. */
  function cevapGonder(it, sec, ek) {
    var k = it.k, ac = ek && ek.aciklama != null ? String(ek.aciklama).trim() : (it.acik != null ? String(it.acik).trim() : undefined), idx = S.liste.indexOf(it);
    it.done = true; it.secili = false; it.sonuc = sec.cari + (etMetni(sec.etiket) ? ' · ' + etMetni(sec.etiket) : '');
    S.sayilar.soru = Math.max(0, (S.sayilar.soru || 0) - 1); rozetleriCiz();
    if (S.detay != null) sonraki(idx, 1); else if (it.el) it.el.replaceWith(satirOge(it, idx));
    topluCiz();
    kuyrukEkle(async function () {
      try { await api('cevapla', { anahtar: k.anahtar, cari: sec.cari, etiket: sec.etiket, kural: !!(ek && ek.kural), mod: 'soru', aciklama: ac && ac !== k.aciklama ? ac : undefined, ip: k.ip, siparisNo: k.siparis && k.siparis.kesin ? k.siparis.no : undefined }); }
      catch (e) {
        if (/Soru bulunamad/.test(e.message)) { toast('Bu soru zaten cevaplanmış'); return; }
        it.done = false; it.sonuc = ''; if (it.el && S.detay == null) it.el.replaceWith(satirOge(it, idx));
        toast('Kaydedilemedi: ' + hataMetni(e)); return;
      }
      S.onb = {};
      toast(ad_(k).slice(0, 24) + ' → ' + sec.cari, 'Geri al', async function () { try { await kuyrukBekle(); await api('geriAl'); S.onb = {}; sorularEkrani(S.sekme, 'taze'); } catch (e) { toast(hataMetni(e)); } });
    });
  }
  /** Bölme: satır tutarı birden çok cariye ayrılır; parçaların toplamı tutara eşit olmadan kaydedilmez. Tutarlar mutlak girilir, işaret satırdan. */
  function tutarOku(v) { var s = String(v || '').trim().replace(/\s/g, ''); if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, ''); var n = Number(s); return isFinite(n) ? Math.round(Math.abs(n) * 100) / 100 : NaN; }
  function bolEkrani(kaynak, mod, sonra) {
    var it = kaynak && kaynak.k ? kaynak : null, k = it ? it.k : kaynak; mod = mod || 'soru';
    var toplam = Math.round(Math.abs(k.tutar) * 100), ilk = it && it.sec ? { cari: it.sec.cari, etiket: (it.sec.etiket || []).slice() } : { cari: '', etiket: [] };
    var parcalar = [{ cari: ilk.cari, etiket: ilk.etiket, tutar: '' }, { cari: '', etiket: [], tutar: '' }];
    if (!it) ilk = (k.oneriler && k.oneriler[0]) ? { cari: k.oneriler[0].cari, etiket: (k.oneriler[0].etiket || []).slice() } : ilk, parcalar[0].cari = ilk.cari, parcalar[0].etiket = ilk.etiket;
    altSayfa(function (sy, kapat) {
      var liste = h('div'), kalanEl = h('div', { class: 'b17', style: { margin: '10px 0' } }), kaydet = h('button', { class: 'btn blok' }, 'Böl ve kaydet');
      function hesap() { var t = 0, tamam = parcalar.length >= 2; parcalar.forEach(function (p) { var n = tutarOku(p.tutar); if (!(n > 0) || !p.cari) tamam = false; else t += Math.round(n * 100); }); return { kalan: toplam - t, tamam: tamam && t === toplam }; }
      function ciz() {
        liste.replaceChildren.apply(liste, parcalar.map(function (p, i) {
          var tu = h('input', { class: 'alan', type: 'text', inputmode: 'decimal', placeholder: 'Tutar', value: p.tutar, style: { maxWidth: '140px' }, oninput: function () { p.tutar = tu.value; durum(); } });
          return h('div', { class: 'satir', style: { gap: '8px', margin: '6px 0' } },
            h('button', { class: 'btn o', style: { flex: 1, textAlign: 'left' }, onclick: async function () { var r = await cariSec(p.cari ? { cari: p.cari, etiket: p.etiket } : null); if (r) { p.cari = r.cari; p.etiket = r.etiket || []; ciz(); } } }, p.cari ? p.cari + ((p.etiket || []).filter(String).length ? ' · ' + p.etiket.filter(String).join(' / ') : '') : 'Cari seç ›'),
            tu, parcalar.length > 2 ? h('button', { class: 'btn o', style: { flex: '0 0 48px' }, onclick: function () { parcalar.splice(i, 1); ciz(); } }, '×') : null);
        }));
        durum();
      }
      function durum() { var d = hesap(); kalanEl.textContent = d.kalan === 0 ? 'Toplam tutuyor' : 'Kalan: ' + para(d.kalan / 100) + ' ₺'; kaydet.disabled = !d.tamam; }
      kaydet.onclick = async function () {
        var d = hesap(); if (!d.tamam) return; kaydet.disabled = true; kaydet.textContent = 'Kaydediliyor…';
        try { var r = await api('bol', { anahtar: k.anahtar, mod: mod, parcalar: parcalar.map(function (p) { return { cari: p.cari, etiket: p.etiket, tutar: tutarOku(p.tutar) }; }) }); }
        catch (e) { kaydet.disabled = false; kaydet.textContent = 'Böl ve kaydet'; return toast(hataMetni(e)); }
        kapat(); S.onb = {};
        toast(r.adet + ' parçaya bölündü', r.geriAl ? 'Geri al' : null, async function () { try { await api('geriAl'); S.onb = {}; if (it) sorularEkrani(S.sekme, 'taze'); else if (sonra) sonra(); } catch (e) { toast(hataMetni(e)); } });
        if (it) { it.done = true; it.sonuc = r.adet + ' parça'; S.sayilar.soru = Math.max(0, (S.sayilar.soru || 0) - 1); rozetleriCiz(); if (S.detay != null) sonraki(S.liste.indexOf(it), 1); else listeCiz(); }
        else if (sonra) sonra();
      };
      sy.append(h('div', { class: 'b18' }, 'Böl: ' + k.aciklama), h('div', { class: 'muted sm', style: { marginBottom: '8px' } }, tutarMetni(k) + ' · ' + tarihKisa(k.tarih)), liste,
        h('button', { class: 'baska', onclick: function () { if (parcalar.length < 10) { parcalar.push({ cari: '', etiket: [], tutar: '' }); ciz(); } } }, h('b', null, '+ Parça ekle')), kalanEl, kaydet);
      ciz();
    });
  }
  async function maasCevap(it, mod, cari) {
    try { await api('maasCevap', { anahtar: it.k.anahtar, mod: mod, cari: cari || undefined }); } catch (e) { return toast(hataMetni(e)); }
    toast(mod === 'bes' ? 'Maaş + BES satırları deftere yazıldı' : mod === 'kesinti' ? 'Maaş + BES + kesinti (' + cari + ') deftere yazıldı' : 'Onaylandı (BES yok)');
    it.done = true; it.sonuc = 'maaş'; S.onb = {}; sonraki(S.liste.indexOf(it), 1);
  }
  /** 40'lık blok gezinme: ‹ Önceki · 1–40 / 123 · Sonraki ›. Blok boşaldıysa başa döner. */
  function sayfaCipleri(r, sek, yenile) {
    var top = r.toplam || 0, bas = r.bas || 0, n = (r.kartlar || []).length; if (top <= ISTEMCI_LIMIT && !bas) return null;
    return h('div', { class: 'sayfa-cip' },
      h('button', { class: 'chip', disabled: !bas, onclick: function () { S.bas[sek] = Math.max(0, bas - ISTEMCI_LIMIT); yenile(); } }, '‹ Önceki'),
      h('span', { class: 'muted sm' }, (bas + 1) + '–' + (bas + n) + ' / ' + top),
      h('button', { class: 'chip', disabled: bas + n >= top, onclick: function () { S.bas[sek] = bas + ISTEMCI_LIMIT; yenile(); } }, 'Sonraki ›'));
  }

  // ---------------------------------------------------------------- Sorular ekranı (Kart | Hesap)
  var ISTEMCI_LIMIT = 40;                                                                  // 2.19: 40'lık bloklar; ‹ Önceki / Sonraki › ile gezilir
  var FILTRE_ = { cevapUyan: 1, cevapUymayan: 1, eskiKayit: 1 };
  async function soruListesiAl(sekme, taze) {
    var mod = sekme === 'kontrol' || FILTRE_[sekme] ? 'kontrol' : 'soru', r = await api('sorular', { mod: mod, kaynak: mod === 'kontrol' ? '' : sekme, filtre: FILTRE_[sekme] ? sekme : undefined, limit: ISTEMCI_LIMIT, bas: S.bas[sekme] || 0, taze: taze ? true : undefined });
    S.onb[sekme] = { r: r, t: Date.now() }; S.ref = { cariler: r.cariler, cariOneri: r.cariOneri, bankalar: r.bankalar, etiketHavuzu: r.etiketHavuzu || {} }; S.kisayollar = r.kisayollar || []; S.bugunIso = r.bugun; S.sayilar = r.sayilar || S.sayilar; rozetleriCiz();
    return r;
  }

  async function sorularEkrani(sekme, mod2) {
    var ilk = !sekme && !S.sekme; if (sekme === 'kart' || sekme === 'hesap') S.sekme = sekme; else if (!S.sekme) S.sekme = 'hesap';
    var sek = S.sekme, kap = ekranHazir(false), r, onb = S.onb[sek];
    S.detay = null;
    if (onb && mod2 !== 'taze' && mod2 !== 'yeniden') r = onb.r;
    else { kap.replaceChildren(yukleniyor()); try { r = await soruListesiAl(sek, mod2 === 'taze'); } catch (e) { if (S.ekran === 'soru' && S.sekme === sek) hataGoster(e); return; } }
    if (S.ekran !== 'soru' || S.sekme !== sek) return;
    if (!r.kartlar.length && (r.bas || 0) > 0) { S.bas[sek] = 0; return sorularEkrani(sek, 'taze'); }
    var sayi = r.sayilar || {};
    if (ilk && sek === 'hesap' && !sayi.hesap && sayi.kart) return sorularEkrani('kart');
    S.liste = r.kartlar.map(function (k) { var it = { k: k, done: false }; it.oneri = enIyi(k); it.secili = !!it.oneri && !k.provizyon; return it; });
    S.listeR = r; listeCiz();
  }
  function listeCiz() {
    var kap = ekranHazir(false), r = S.listeR, sek = S.sekme, sayi = (r && r.sayilar) || {};
    if (!r) return sorularEkrani(sek);
    var ust = h('div', { class: 'ust' }, h('h1', { class: 'disp' }, 'Sorular'), h('button', { class: 'chip', style: { margin: 0 }, onclick: function () { sorularEkrani(sek, 'taze'); } }, 'Yenile'));
    var sg = h('div', { class: 'fl' }, h('button', { class: 'chip' + (sek === 'hesap' ? ' s' : ''), onclick: function () { sorularEkrani('hesap'); } }, 'Hesap ' + (sayi.hesap || 0)), h('button', { class: 'chip' + (sek === 'kart' ? ' s' : ''), onclick: function () { sorularEkrani('kart'); } }, 'Kart ' + (sayi.kart || 0)),
      sayfaCipleri(r, sek, function () { sorularEkrani(sek, 'taze'); }));
    if (!S.liste.length) { kap.replaceChildren(ust, sg, h('div', { class: 'bos' }, 'Bu listede soru yok')); return; }
    var liste = h('div', { class: 'sl' }), son = '';
    S.liste.forEach(function (it, i) { if (it.k.tarih !== son) { son = it.k.tarih; liste.appendChild(h('div', { class: 'etiket gun' }, gun_(son))); } liste.appendChild(satirOge(it, i)); });
    var bar = h('div', { class: 'fab' }, h('button', { class: 'btn o', style: { flex: '0 0 auto' }, onclick: function () { var hep = S.liste.some(function (x) { return x.oneri && !x.done && !x.secili; }); S.liste.forEach(function (x) { if (x.oneri && !x.done) x.secili = hep; }); listeCiz(); } }, 'Seç'),
      h('button', { class: 'btn', id: 'toplu-onay', style: { flex: 1 }, onclick: topluOnay }, ''));
    kap.replaceChildren(ust, sg, h('div', { class: 'muted sm ipucu2' }, 'Sağa kaydır: önerilenle onayla · sola: atla · dokun: sor'), liste, bar);
    topluCiz();
  }
  async function topluOnay(ev) {
    var b = ev.currentTarget, sec = S.liste.filter(function (x) { return x.secili && !x.done && x.oneri; }); if (!sec.length) return;
    b.disabled = true; b.textContent = 'Onaylanıyor… ' + sec.length;
    await kuyrukBekle();
    try {
      var r = await api('cevaplaToplu', { liste: sec.map(function (x) { return { anahtar: x.k.anahtar, cari: x.oneri.cari, etiket: x.oneri.etiket, ip: x.k.ip }; }) });
      var hata = {}; (r.hatalar || []).forEach(function (x) { hata[x.anahtar] = x.hata; });
      sec.forEach(function (x) { if (!hata[x.k.anahtar]) { x.done = true; x.secili = false; x.sonuc = x.oneri.cari; } });
      S.sayilar.soru = Math.max(0, (S.sayilar.soru || 0) - (r.tamam || 0)); rozetleriCiz(); S.onb = {};
      toast(r.tamam + ' soru deftere yazıldı' + ((r.hatalar || []).length ? ' · ' + r.hatalar.length + ' atlandı' : ''));
    } catch (e) { toast(hataMetni(e)); }
    listeCiz();
  }

  // ---------------------------------------------------------------- Öneriler ekranı (sistemin yazdıkları; toplu onay)
  function yan(u) { return h('div', { class: 'yan', style: { borderTopColor: bankaRengi(u.banka) } }, h('div', { class: 'b' }, u.banka || ''), h('div', { class: 'h' }, u.hesap || ''), h('div', { class: 't ' + (u.tutar < 0 ? 'mp' : 'tp') }, para(u.tutar) + ' ₺'), h('div', { class: 'h' }, tarihKisa(u.tarih) + ' · ' + String(u.aciklama || '').slice(0, 22))); }
  function oneriSatiri(k, secili, degistir) {
    var o = (k.oneriler || [])[0] || { cari: '', etiket: [] }, kutu = h('input', { type: 'checkbox', checked: secili.has(k), onchange: function () { if (kutu.checked) secili.add(k); else secili.delete(k); toplamCiz(); } });
    var g = k.grup || '', nakil = k.sistem && g.indexOf('~N') === 0, kisi = k.sistem && g.indexOf('~P') === 0;
    var kaynak = k.sistem ? (g.indexOf('~M') === 0 ? 'maaş + BES' : nakil ? 'nakil çifti' : kisi ? 'kişi çifti' : 'kart ödemesi') : (o.kaynak === 'mevcut' && k.kural ? 'kural' : k.eski ? 'eski kayıt · ' + k.eski.kural : 'otomatik');
    var ad = k.gizli ? 'Maaş · ' + (k.adet > 1 ? k.adet + ' satır' : 'maskeli') : (nakil ? 'Kendi hesaplarım arası nakil' : k.aciklama) + (k.adet > 1 && !nakil ? ' · ' + k.adet + ' satır' : '');
    var gov = h('span', { class: 'g' }, h('span', { class: 'satir' }, h('b', null, ad), h('span', { class: 'tu ' + (k.toplam < 0 ? 'mp' : 'tp') }, nakil ? '0,00 ₺' : tutarMetni(k))),
      h('span', { class: 'muted sm' }, tarihKisa(k.tarih) + (k.banka && !nakil ? ' · ' + k.banka : '') + (k.hesap && !nakil ? ' ' + k.hesap : '') + (k.sistem && g ? ' · ' + g : '') + ' · ' + kaynak));
    if (nakil && k.uyeler && k.uyeler.length >= 2) { var cik = k.uyeler.filter(function (u) { return u.tutar < 0; })[0] || k.uyeler[0], gir = k.uyeler.filter(function (u) { return u.tutar > 0; })[0] || k.uyeler[1]; gov.appendChild(h('div', { class: 'iki' }, yan(cik), h('div', { class: 'ok' }, '→'), yan(gir))); }
    else if (kisi && k.uyeler) k.uyeler.slice(0, 4).forEach(function (u) { gov.appendChild(h('span', { class: 'satir sm' }, h('span', null, tarihKisa(u.tarih) + ' · ' + String(u.aciklama || '').slice(0, 28)), h('span', { class: u.tutar < 0 ? 'mp' : 'tp' }, para(u.tutar) + ' ₺'))); });
    if (k.eski && !k.sistem) gov.appendChild(h('span', { class: 'muted sm' }, 'eski kayıt: ' + (k.eski.cari || '?') + (k.eski.tutar != null ? ' · ' + para(Math.abs(k.eski.tutar)) + ' ₺' : '') + (k.eski.tarih ? ' · ' + tarihKisa(k.eski.tarih) : '') + (k.eski.not ? ' · ' + k.eski.not : '')));
    gov.appendChild(h('span', { class: 'satir sm' }, h('span', { class: 'mavi' }, '→ ' + (k.sistem ? (k.gizli ? 'Maaş / BES' : o.cari || k.cari || 'sistem') : (o.cari || '') + ((o.etiket || []).filter(String).length ? ' · ' + o.etiket.filter(String).join(' / ') : ''))),
      k.sistem ? null : h('button', { class: 'baglanti', onclick: function (e) { e.preventDefault(); degistir(k); } }, 'değiştir')));
    return h('label', { class: 'oneri' }, kutu, gov);
    function toplamCiz() { var t = document.getElementById('oneri-toplam'); if (t) t.textContent = secili.size + ' öneri seçili'; var b = document.getElementById('oneri-onayla'); if (b) { b.textContent = 'Seçili ' + secili.size + '’i onayla ✓'; b.disabled = !secili.size; } }
  }
  async function onerilerEkrani(mod2) {
    var sek = S.oneriSekme || 'kontrol', kap = ekranHazir(false), r, onb = S.onb[sek];
    if (onb && mod2 !== 'taze' && mod2 !== 'yeniden') r = onb.r;
    else { kap.replaceChildren(yukleniyor()); try { r = await soruListesiAl(sek, mod2 === 'taze'); } catch (e) { return hataGoster(e); } }
    if (S.ekran !== 'oneri') return;
    if (!r.kartlar.length && (r.bas || 0) > 0) { S.bas[sek] = 0; return onerilerEkrani('taze'); }
    var bilgi = h('div', { class: 'muted sm', style: { margin: '-4px 0 8px' } }, (r.toplam || r.kartlar.length) + ' öneri' + (r.kartlar.length ? ' · bu sayfa ' + para(r.kartlar.reduce(function (a, k) { return a + (Number(k.toplam) || 0); }, 0)) + ' ₺' : ''), sayfaCipleri(r, sek, function () { onerilerEkrani('taze'); }));
    var cs = r.cevapSay || {}, sekmeler = (cs.cevap || cs.eskiKayit || sek !== 'kontrol') ? h('div', { class: 'fl' }, [['kontrol', 'Tümü'], ['cevapUyan', 'Eski cevap · uyan ' + (cs.cevapUyan || 0)], ['cevapUymayan', 'Uymayan ' + (cs.cevapUymayan || 0)], ['eskiKayit', 'Eski kayıtlar ' + (cs.eskiKayit || 0)]].map(function (x) { return h('button', { class: 'chip' + (sek === x[0] ? ' s' : ''), onclick: function () { S.oneriSekme = x[0]; onerilerEkrani(); } }, x[1]); })) : null;
    if (sek === 'cevapUymayan') return uymayanCiz(kap, r, sekmeler, bilgi);
    if (sek === 'eskiKayit') return eskiKayitCiz(kap, r, sekmeler, bilgi);
    var secili = new Set(r.kartlar);                                                    // kart başına seçim: birebir aynı iki kart (aynı anahtar) ikisi de gider
    var sistem = r.kartlar.filter(function (k) { return k.sistem; }), diger = r.kartlar.filter(function (k) { return !k.sistem; });
    function degistir(k) {
      var secenekler = secenekleriKur(k, 'kontrol');
      altSayfa(function (sy, kapat) {
        sy.append(h('div', { class: 'b18' }, k.aciklama), h('div', { class: 'muted sm', style: { marginBottom: '10px' } }, tutarMetni(k) + ' · ' + tarihKisa(k.tarih)));
        if (k.bolunebilir) sy.appendChild(h('button', { class: 'btn o blok', style: { marginBottom: '8px' }, onclick: function () { kapat(); bolEkrani(k, 'kontrol', function () { S.onb = {}; onerilerEkrani('yeniden'); }); } }, 'Böl · birden çok cariye ayır'));
        secenekler.forEach(function (o) { sy.appendChild(h('button', { class: 'aday blok', onclick: async function () { kapat(); try { await api('cevapla', { anahtar: k.anahtar, cari: o.cari, etiket: o.etiket, kural: false, mod: 'kontrol', ip: k.ip }); toast(k.aciklama.slice(0, 24) + ' → ' + o.cari); S.onb = {}; onerilerEkrani('yeniden'); } catch (e) { toast(hataMetni(e)); } } }, h('span', { class: 'g' }, h('b', null, o.metin), h('span', { class: 'muted sm' }, o.grup + (o.alt ? ' · ' + o.alt : ''))))); });
        sy.appendChild(h('button', { class: 'btn o blok', style: { marginTop: '8px' }, onclick: async function () { kapat(); var c = await cariSec(null); if (!c) return; try { await api('cevapla', { anahtar: k.anahtar, cari: c.cari, etiket: c.etiket, kural: !!c.kural, mod: 'kontrol', ip: k.ip }); toast(k.aciklama.slice(0, 24) + ' → ' + c.cari); S.onb = {}; onerilerEkrani('yeniden'); } catch (e) { toast(hataMetni(e)); } } }, 'Başka cari…'));
      });
    }
    var ust = h('div', { class: 'ust' }, h('h1', null, 'Öneriler'), h('button', { class: 'chip', style: { margin: 0 }, onclick: function () { onerilerEkrani('taze'); } }, 'Yenile'), h('button', { class: 'chip', style: { margin: 0 }, onclick: function () { S.islemSekme = 'tetik'; git('islem'); } }, 'Claude öner ›'));
    if (!r.kartlar.length) { kap.replaceChildren(ust, sekmeler || '', bilgi, h('div', { class: 'bos' }, 'Onay bekleyen öneri yok', h('div', { style: { marginTop: '14px' } }, h('button', { class: 'btn o', onclick: function () { onerilerEkrani('taze'); } }, 'Yenile')))); return; }
    var liste = h('div', { class: 'kart', style: { padding: '4px 14px' } });
    if (sistem.length) { liste.appendChild(h('div', { class: 'etiket', style: { margin: '10px 0 2px' } }, 'Sistem grupları · alan değişmez')); sistem.forEach(function (k) { liste.appendChild(oneriSatiri(k, secili, degistir)); }); }
    if (diger.length) { liste.appendChild(h('div', { class: 'etiket', style: { margin: '10px 0 2px' } }, 'Otomatik sınıflama')); diger.forEach(function (k) { liste.appendChild(oneriSatiri(k, secili, degistir)); }); }
    var alt = h('div', { class: 'yapisik' }, h('button', { class: 'btn o', style: { flex: '0 0 120px' }, onclick: function () { secili.clear(); kap.querySelectorAll('.oneri input').forEach(function (x) { x.checked = false; }); document.getElementById('oneri-toplam').textContent = '0 öneri seçili'; var b = document.getElementById('oneri-onayla'); b.disabled = true; b.textContent = 'Seçili 0’ı onayla ✓'; } }, 'Hepsini kaldır'),
      h('button', { class: 'btn', id: 'oneri-onayla', style: { flex: 1 }, onclick: async function (ev) {
        var b = ev.currentTarget, liste2 = Array.from(secili).map(function (k) { return k.anahtar; }); if (!liste2.length) return; b.disabled = true;
        var bitti = 0, satir = 0, atlanan = 0, son = null, hata = null;                        // 40'arlık paketler SIRAYLA: bir paket bitmeden sonraki gitmez
        for (var i = 0; i < liste2.length; i += 40) {
          b.textContent = 'Onaylanıyor… ' + bitti + '/' + liste2.length;
          try { son = await api('onaylaToplu', { anahtarlar: liste2.slice(i, i + 40), mod: 'kontrol' }); satir += son.adet || 0; atlanan += son.atlanan || 0; bitti = Math.min(liste2.length, i + 40); }
          catch (e) { hata = e; break; }
        }
        S.onb = {};
        if (hata) toast(bitti + ' öneri onaylandı (' + satir + ' satır), ' + (liste2.length - bitti) + ' kaldı · ' + hataMetni(hata) + ' · tekrar dene');
        else toast(satir + ' satır deftere taşındı' + (atlanan ? ' · ' + atlanan + ' atlandı' : '') + (son && son.geriAl ? ' · geri al yalnız son paketi alır' : ''), son && son.geriAl ? 'Son paketi geri al' : null, async function () { try { await api('geriAl'); S.onb = {}; onerilerEkrani('taze'); } catch (e) { toast(hataMetni(e)); } });
        onerilerEkrani('taze');
      } }, 'Seçili ' + secili.size + '’i onayla ✓'));
    kap.replaceChildren(ust, sekmeler || '', bilgi, h('div', { class: 'kart satir', style: { padding: '12px 16px' } }, h('span', { class: 'sm', id: 'oneri-toplam' }, secili.size + ' öneri seçili'), h('span', { class: 'muted sm' }, 'kaldırdığın kalır')), liste, alt);
  }

  /** 2.21 geçici: eşleşmeyen eski kayıtlar (eski sistemde yazılmış, dökümde karşılığı yok). Gruplu liste; seçilenler "Deftere al" ya da "Alma". */
  function eskiKayitCiz(kap, r, sekmeler, bilgi) {
    var ust = h('div', { class: 'ust' }, h('h1', null, 'Öneriler'), h('button', { class: 'chip', style: { margin: 0 }, onclick: function () { onerilerEkrani('taze'); } }, 'Yenile'));
    if (!r.kartlar.length) { kap.replaceChildren(ust, sekmeler || '', bilgi, h('div', { class: 'bos' }, 'Bekleyen eski kayıt yok')); return; }
    var secili = new Set(), liste = h('div'), gr = {}, sira = [];
    r.kartlar.forEach(function (k) { var g = k.kategori || 'Diğer'; if (!gr[g]) { gr[g] = []; sira.push(g); } gr[g].push(k); });
    function say() { var n = secili.size; document.getElementById('ek-al').textContent = 'Deftere al (' + n + ')'; document.getElementById('ek-alma').textContent = 'Alma (' + n + ')'; document.getElementById('ek-al').disabled = document.getElementById('ek-alma').disabled = !n; }
    sira.forEach(function (g) {
      var kutular = [];
      var bas = h('div', { class: 'satir', style: { margin: '14px 0 4px' } }, h('span', { class: 'etiket' }, g + ' · ' + gr[g].length), h('button', { class: 'baglanti', onclick: function () { var hep = gr[g].some(function (k) { return !secili.has(k); }); gr[g].forEach(function (k, j) { if (hep) secili.add(k); else secili.delete(k); kutular[j].checked = hep; }); say(); } }, 'hepsini seç'));
      var kart = h('div', { class: 'kart', style: { padding: '2px 14px' } }, gr[g].map(function (k, j) {
        var c = h('input', { type: 'checkbox', onchange: function () { if (c.checked) secili.add(k); else secili.delete(k); say(); } }); kutular.push(c);
        return h('label', { class: 'oneri' }, c, h('span', { class: 'g' }, h('span', { class: 'satir' }, h('b', null, k.aciklama), h('span', { class: 'tu ' + (k.toplam < 0 ? 'mp' : 'tp') }, tutarMetni(k))),
          h('span', { class: 'satir sm' }, h('span', { class: 'muted' }, tarihKisa(k.tarih) + ' · ' + (k.cari || 'cari yok')), h('button', { class: 'baglanti', onclick: async function (e) { e.preventDefault(); var cc = await cariSec(null); if (!cc) return; try { await api('cevapla', { anahtar: k.anahtar, cari: cc.cari, etiket: cc.etiket, kural: false, mod: 'kontrol', ip: k.ip }); toast('Deftere alındı → ' + cc.cari); S.onb = {}; onerilerEkrani('taze'); } catch (x) { toast(hataMetni(x)); } } }, 'başka cariyle al'))));
      }));
      liste.append(bas, kart);
    });
    async function uygula(al) {
      var a = Array.from(secili).map(function (k) { return k.anahtar; }); if (!a.length) return;
      try { var x = al ? await api('onaylaToplu', { anahtarlar: a, mod: 'kontrol' }) : await api('eskiReddet', { anahtarlar: a }); toast((x.adet || 0) + (al ? ' kayıt deftere alındı' : ' kayıt alınmadı')); S.onb = {}; onerilerEkrani('taze'); } catch (e) { toast(hataMetni(e)); }
    }
    var alt = h('div', { class: 'yapisik' }, h('button', { class: 'btn o', id: 'ek-alma', style: { flex: 1 }, disabled: true, onclick: function () { uygula(false); } }, 'Alma (0)'), h('button', { class: 'btn', id: 'ek-al', style: { flex: 1 }, disabled: true, onclick: function () { uygula(true); } }, 'Deftere al (0)'));
    kap.replaceChildren(ust, sekmeler || '', bilgi, h('div', { class: 'muted sm' }, 'Eski sistemde yazılmış, banka dökümünde karşılığı bulunamayan kayıtlar. Seçtiklerin deftere alınır ya da alınmaz.'), liste, alt);
  }
  /** 2.20 geçici (2.21'de kalkar): eski cevap ↔ yeni motor önerisi farklı olanlar. Satır başına "Eskisi" / "Yenisi"; toplu "Hepsinde eski" / "Hepsinde yeni". */
  function uymayanCiz(kap, r, sekmeler, bilgi) {
    var ust = h('div', { class: 'ust' }, h('h1', null, 'Öneriler'), h('button', { class: 'chip', style: { margin: 0 }, onclick: function () { onerilerEkrani('taze'); } }, 'Yenile'));
    if (!r.kartlar.length) { kap.replaceChildren(ust, sekmeler || '', bilgi, h('div', { class: 'bos' }, 'Uymayan eski cevap yok')); return; }
    async function uygula(kartlar, yeni) {
      try {
        var t = 0;
        if (yeni) { var x = await api('cevaplaToplu', { liste: kartlar.map(function (k) { return { anahtar: k.anahtar, cari: k.eski.yeni, etiket: k.eski.yeniEtiket || [], ip: k.ip, mod: 'kontrol' }; }) }); t = x.tamam; }
        else { var y = await api('onaylaToplu', { anahtarlar: kartlar.map(function (k) { return k.anahtar; }), mod: 'kontrol' }); t = y.adet; }
        toast(t + ' satır deftere · ' + (yeni ? 'yeni öneri' : 'eski cevap')); S.onb = {}; onerilerEkrani('taze');
      } catch (e) { toast(hataMetni(e)); }
    }
    var liste = h('div', { class: 'kart', style: { padding: '4px 14px' } }, r.kartlar.map(function (k) {
      return h('div', { class: 'uy' }, h('div', { class: 'satir' }, h('b', null, k.alici || k.aciklama), h('span', { class: 'tu ' + (k.toplam < 0 ? 'mp' : 'tp') }, tutarMetni(k))),
        h('div', { class: 'muted sm' }, tarihKisa(k.tarih) + ' · ' + (k.banka || '') + ' ' + (k.hesap || '')),
        h('div', { class: 'uy-s' }, h('button', { class: 'uyb', onclick: function () { uygula([k], false); } }, h('small', null, 'ESKİ CEVAP'), h('b', null, k.eski.cari + (etMetni(k.oneriler && k.oneriler[0] && k.oneriler[0].etiket) ? ' · ' + etMetni(k.oneriler[0].etiket) : ''))),
          h('button', { class: 'uyb y', onclick: function () { uygula([k], true); } }, h('small', null, 'YENİ KURAL'), h('b', null, k.eski.yeni + (etMetni(k.eski.yeniEtiket) ? ' · ' + etMetni(k.eski.yeniEtiket) : '')))));
    }));
    var alt = h('div', { class: 'yapisik' }, h('button', { class: 'btn o', style: { flex: 1 }, onclick: function () { uygula(r.kartlar, false); } }, 'Hepsinde eski'), h('button', { class: 'btn', style: { flex: 1 }, onclick: function () { uygula(r.kartlar, true); } }, 'Hepsinde yeni'));
    kap.replaceChildren(ust, sekmeler || '', bilgi, liste, alt);
  }
  // ---------------------------------------------------------------- İşlemler ekranı (durum, elle tetikleme, geri al, nakit ekle, acil fren)
  function tetikle(ad, eylem) {
    return async function (ev) {
      var b = ev.currentTarget, eski = b.querySelector('.sag'); b.disabled = true; if (eski) eski.textContent = 'çalışıyor…';
      try { var r = await api(eylem); toast(ad + ': ' + ozetMetni(r)); } catch (e) { toast(hataMetni(e)); }
      S.gec = {}; S.onb = {}; islemlerEkrani();
    };
  }
  var OZET_AD = { durum: 'durum', islenen: 'işlenen belge', eklenen: 'eklenen', yazilan: 'yazılan öneri', istenen: 'istenen', kalan: 'kalan hak', ms: 'ms', sayfa: 'sayfa', adet: 'adet' };
  function ozetMetni(r) {
    if (!r || typeof r !== 'object') return 'tamam';
    var p = [];
    Object.keys(OZET_AD).forEach(function (k) { if (r[k] != null && r[k] !== '') p.push(OZET_AD[k] + ' ' + r[k]); });
    return p.join(' · ') || 'tamam';
  }
  function opSatiri(ikon, ad, alt, sag, onclick, renk) {
    return h('button', { class: 'op', onclick: onclick }, h('span', { class: 'ik ' + (renk || 'mavi') }, ikon), h('span', { class: 'g' }, h('b', null, ad), h('span', { class: 'muted sm' }, alt)), h('span', { class: 'muted sm sag' }, sag || ''));
  }
  async function islemlerEkrani() {
    var kap = ekranHazir(false); kap.replaceChildren(baslik('İşlemler', ''), yukleniyor());
    var d; try { d = await apiOnb('durum', {}, 30000); } catch (e) { return hataGoster(e); }
    if (S.ekran !== 'islem') return;
    if (d.ayarlar) S.ayar = Object.assign(S.ayar, d.ayarlar);
    var son = d.son && d.son[0], okList = d.kontrolListesi || [], sorun = okList.filter(function (x) { return !x.ok; });
    var durum = h('div', { class: 'kart' }, h('div', { class: 'satir' }, h('span', { class: 'b17' }, h('i', { class: 'dot ' + (sorun.length ? 'sari' : 'tp'), style: { marginRight: '8px' } }), d.mod === 'CANLI' ? 'Sistem çalışıyor' : 'KURU mod: deftere yazmıyor'), h('span', { class: 'muted sm' }, 'sürüm ' + d.surum)),
      h('div', { class: 'ds' }, h('span', { class: 'muted' }, 'Son olay'), h('b', null, son ? son.z + ' · ' + son.olay + ' · ' + son.sonuc.slice(0, 40) : '—')),
      h('div', { class: 'ds' }, h('span', { class: 'muted' }, 'Bekleyen'), h('b', { class: 'sari' }, (d.soru || 0) + ' soru · ' + (d.kontrol || 0) + ' öneri')),
      h('div', { class: 'ds' }, h('span', { class: 'muted' }, 'Belgeler'), h('b', null, d.belge || '—')),
      sorun.length ? h('div', { class: 'ds' }, h('span', { class: 'muted' }, 'Kontrol'), h('b', { class: 'sari' }, sorun.map(function (x) { return x.ad; }).join(', '))) : h('div', { class: 'ds' }, h('span', { class: 'muted' }, 'Kontrol listesi'), h('b', { class: 'tp' }, okList.length + ' madde tamam')),
      h('div', { class: 'ds' }, h('span', { class: 'muted' }, 'Face ID'), h('b', null, S.faceId ? 'kurulu · maaş açık' : 'yok · maaş maskeli, şifreyle açılır')));
    var tetik = [h('div', { class: 'b18', style: { margin: '4px 0 2px' } }, 'Elle Tetikleme'),
      h('div', { class: 'muted sm', style: { margin: '0 0 12px' } }, 'Zamanlı işler sunucuda kendi kendine çalışır. Bir sorun olursa ya da hemen istersen buradan çalıştır.'),
      opSatiri('▶', 'Turu başlat', 'Gmail tarama, ekstre, hesap hareketi, yapıştırma, bakım adımları', '2–5 dk', tetikle('Tur', 'isle')),
      opSatiri('₺', 'Kur çek', 'TCMB EVDS: USD, EUR, altın; eksik günler tamamlanır', '', tetikle('Kur', 'kurCek'), 'sari'),
      opSatiri('✦', 'Claude öner', 'Sınıflanmamış kart satırlarına öneri; günlük hak sınırlı, kartlar maskeli gider', '', tetikle('Claude önerisi', 'oneri'), 'mavi'),
      opSatiri('⟳', 'Önbelleği ısıt', 'Kart, hesap ve öneri listeleri önceden hazırlanır', '', tetikle('Önbellek', 'onbellekIsit'), 'gri'),
      opSatiri('⬇', 'Yedek al', 'Planlar, kural, kart, ayar, kuyruk', okList.filter(function (x) { return x.ad === 'Yedek'; }).map(function (x) { return x.ayrinti; })[0] || '', tetikle('Yedek', 'yedekAl'), 'gri'),
      opSatiri('▦', 'Tabloları biçimle', 'Sistem tabloları standart biçime gelir; değerler değişmez. Mizan Rapor ve eski dosyalara dokunmaz', '1–3 dk', tetikle('Biçim', 'bicim'), 'gri')];
    var ops = [h('div', { class: 'etiket', style: { margin: '12px 0 6px' } }, 'Düzelt')];
    (d.geriAl || []).slice(0, 5).forEach(function (g, i) {
      ops.push(opSatiri('↶', (i ? 'Geri al · ' : 'Son işlemi geri al · ') + g.aciklama, g.adet + ' satır' + (g.cari ? ' → ' + g.cari : '') + (g.z ? ' · ' + g.z : ''), i ? 'sırada' : '', i ? function () { toast('Önce daha yeni işlemler geri alınır'); } : async function () { if (!await onayla('Geri al', g.adet + ' satır kuyruğa döner: ' + g.aciklama, { ad: 'Geri al' })) return; try { var r = await api('geriAl'); toast(r.adet + ' satır kuyruğa döndü'); } catch (e) { toast(hataMetni(e)); } S.onb = {}; S.gec = {}; islemlerEkrani(); }, 'tp'));
    });
    if (!(d.geriAl || []).length) ops.push(h('div', { class: 'muted sm', style: { padding: '4px 2px 8px' } }, 'Geri alınacak işlem yok'));
    ops.push(opSatiri('+', 'Nakit harcama ekle', 'tutar, cari, gün · dikte', '', ekleSayfasi, 'tp'));
    if (!S.faceId && await FID.varMi()) ops.push(opSatiri('◎', 'Face ID kur', 'uygulama Face ID ile açılır; maaş açık gelir', '', async function () { var pin = await pinSor('Şifreni gir', 'Face ID, maaş şifresini cihazda saklar'); if (!pin) return; try { await gizliAcPinle(pin); await FID.kur(pin); S.faceId = true; S.pin = pin; toast('Face ID kuruldu'); islemlerEkrani(); } catch (e) { toast(hataMetni(e)); } }, 'mavi'));
    if (S.faceId) ops.push(opSatiri('◎', 'Face ID’yi kaldır', 'maaş yeniden maskeli gelir', '', async function () { if (await onayla('Face ID kaldırılsın mı?', 'Uygulama Face ID istemez; maaş satırları şifreyle açılır.', { ad: 'Kaldır' })) { FID.sil(); S.faceId = false; S.g = null; islemlerEkrani(); } }, 'gri'));
    var acil = h('button', { class: 'btn kirmizi o blok', style: { marginTop: '12px' }, onclick: async function () { if (!await onayla('Acil fren', 'Sunucu tüm telefon isteklerini reddeder. Yeniden açmak için sabit>ayar API_KAPALI boşaltılır.', { ad: 'API’yi kapat', tehlike: true })) return; try { await api('apiKapat'); toast('API kapatıldı'); } catch (e) { toast(hataMetni(e)); } } }, 'Acil fren · API’yi kapat');
    var sekme = S.islemSekme === 'tetik' ? 'tetik' : 'durum';
    var seg2 = h('div', { class: 'seg' }, h('button', { class: sekme === 'durum' ? 'on' : '', onclick: function () { S.islemSekme = 'durum'; islemlerEkrani(); } }, 'Durum'), h('button', { class: sekme === 'tetik' ? 'on' : '', onclick: function () { S.islemSekme = 'tetik'; islemlerEkrani(); } }, 'Elle Tetikleme'));
    kap.replaceChildren(baslik('İşlemler', new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })), seg2, h('div', null, sekme === 'tetik' ? tetik : [durum, h('div', null, ops), acil]), h('div', { class: 'muted sm', style: { margin: '14px 2px 0' } }, 'Uygulama ' + APP_SURUM + (S.son ? ' · son istek ' + S.son.ms + ' ms' : '')));
  }
  /** Nakit/hesap gerçek işlem ekleme (alt sayfa). */
  function ekleSayfasi() {
    altSayfa(async function (sy, kapat) {
      if (!S.ref) { sy.appendChild(yukleniyor()); try { await soruListesiAl('kart', false); } catch (e) { sy.replaceChildren(h('div', { class: 'bos' }, hataMetni(e))); return; } sy.replaceChildren(h('div', { class: 'tut' })); }
      var bugun = S.bugunIso || new Date().toISOString().slice(0, 10), cari = null;
      var tutar = h('input', { class: 'alan', type: 'text', inputmode: 'decimal', placeholder: '0,00', style: { fontSize: '30px', fontWeight: '700', minHeight: '64px' }, autocomplete: 'off' }), acik = h('input', { class: 'alan', type: 'text', placeholder: 'Açıklama', maxlength: '120' });
      var tarih = h('input', { class: 'alan', type: 'date', value: bugun }), banka = h('input', { class: 'alan', type: 'text', placeholder: 'Hesap / banka (isteğe bağlı)', list: 'bankalar' });
      var dl = h('datalist', { id: 'bankalar' }, (S.ref.bankalar || []).map(function (b) { return h('option', { value: b }); }));
      var yon = 'gider', yonSeg = h('div', { class: 'seg' }, h('button', { class: 'on', onclick: function () { yon = 'gider'; yonSeg.children[0].className = 'on'; yonSeg.children[1].className = ''; } }, 'Gider'), h('button', { onclick: function () { yon = 'gelir'; yonSeg.children[1].className = 'on'; yonSeg.children[0].className = ''; } }, 'Gelir'));
      var cariBtn = h('button', { class: 'btn o blok', onclick: async function () { var c = await cariSec(null); if (c) { cari = c; cariBtn.textContent = c.cari + (c.etiket.filter(String).length ? ' · ' + c.etiket.filter(String).join(' / ') : ''); } } }, 'Cari seç');
      async function kaydet(zorla) {
        if (!cari) return toast('Önce cari seç');
        try { var r = await api('ekle', { tarih: tarih.value, tutar: tutar.value, yon: yon, aciklama: acik.value, cari: cari.cari, etiket: cari.etiket, banka: banka.value, zorla: !!zorla });
          if (r.tekrar) { if (await onayla('Aynı satır var', 'Aynı tarih, tutar ve açıklama deftere yazılmış. Yine de eklensin mi?', { ad: 'Yine de ekle' })) return kaydet(true); return; }
          toast('Eklendi: ' + r.ozet); kapat(); S.onb = {}; } catch (e) { toast(hataMetni(e)); }
      }
      sy.append(h('div', { class: 'b18' }, 'Nakit harcama ekle'), yonSeg, h('label', { class: 'et' }, 'Tutar (₺)'), tutar, h('label', { class: 'et' }, 'Açıklama'), acik, h('label', { class: 'et' }, 'Tarih'), tarih, h('label', { class: 'et' }, 'Hesap'), banka, dl, cariBtn, h('button', { class: 'btn blok', style: { marginTop: '10px' }, onclick: function () { kaydet(false); } }, 'Deftere yaz'));
    });
  }

  // ---------------------------------------------------------------- Yapıştır ekranı (banka metni → telefonda maskele → sunucu → sorular)
  function maskeleCep(metin) {
    var say = { kart: 0, iban: 0, tel: 0 };
    var m = String(metin).replace(/\bTR\d{2}(?:\s?\d{4}){5}\s?\d{2}\b/g, function () { say.iban++; return '[IBAN]'; })                 // önce IBAN (içindeki 16 hane kart sanılmasın)
      .replace(/\b(\d{4})[ -]?\d{4}[ -]?\d{4}[ -]?(\d{4})\b/g, function () { say.kart++; return '****' + arguments[2]; })
      .replace(/\b0?5\d{2}[ -]?\d{3}[ -]?\d{2}[ -]?\d{2}\b/g, function () { say.tel++; return '[TEL]'; });
    return { metin: m, say: say };
  }
  var YAP = { kart: '', metin: '' };
  async function yapistirEkrani() {
    var kap = ekranHazir(false); kap.replaceChildren(baslik('Yapıştır', 'dönem içi işlemler'), yukleniyor());
    var d; try { d = await apiOnb('durum', {}, 120000); } catch (e) { d = { kartlar: [] }; }
    if (S.ekran !== 'yapistir') return;
    var kartlar = (d.kartlar || []).map(function (k) { return k.kart; }); if (!YAP.kart && kartlar.length) YAP.kart = kartlar[0];
    var cips = h('div', null, kartlar.map(function (k) { return h('span', { class: 'chip' + (YAP.kart === k ? ' s' : ''), onclick: function () { YAP.kart = k; yapistirEkrani(); } }, k); }));
    var alan = h('textarea', { class: 'alan metin', placeholder: 'Banka uygulamasından kopyalanan işlem listesi', rows: '9', 'aria-label': 'Yapıştırılan metin' }); alan.value = YAP.metin;
    var ozet = h('div', { class: 'kart' }, h('div', { class: 'satir' }, h('b', null, 'Ön okuma'), h('span', { class: 'muted sm' }, 'telefonda, modelsiz')));
    function ozetCiz() {
      var t = alan.value, satir = t.split(/\r?\n/).filter(function (x) { return x.trim(); }).length, mk = maskeleCep(t), tut = (t.match(/\d{1,3}(?:\.\d{3})*,\d{2}\s*(?:TL|TRY|₺)/g) || []).length;
      ozet.replaceChildren(h('div', { class: 'satir' }, h('b', null, 'Ön okuma'), h('span', { class: 'muted sm' }, 'telefonda, modelsiz')), h('div', { class: 'ds' }, h('span', { class: 'muted' }, 'Satır'), h('b', null, satir + ' satır · ' + tut + ' tutar')), h('div', { class: 'ds' }, h('span', { class: 'muted' }, 'Kart'), h('b', null, YAP.kart || 'seçilmedi')), h('div', { class: 'ds' }, h('span', { class: 'muted' }, 'Maskeleme'), h('b', { class: 'tp' }, 'kart no ' + mk.say.kart + ' · IBAN ' + mk.say.iban + ' · telefon ' + mk.say.tel)));
    }
    alan.oninput = function () { YAP.metin = alan.value; ozetCiz(); }; ozetCiz();
    var pano = h('button', { class: 'baglanti', onclick: async function () { try { alan.value = YAP.metin = await navigator.clipboard.readText(); ozetCiz(); } catch (e) { toast('Panodan okunamadı: elle yapıştır'); } } }, 'Panodan al');
    var isle = h('button', { class: 'btn', style: { flex: 1 }, onclick: async function (ev) {
      var t = alan.value.trim(); if (!t) return toast('Metin boş'); if (!YAP.kart) return toast('Kart seç');
      if (t.split(/\r?\n/).length > 800) return toast('Çok uzun: en fazla 800 satır');
      var b = ev.currentTarget; b.disabled = true; b.textContent = 'İşleniyor… (birkaç dk)';
      try { var r = await api('yapistir', { kart: YAP.kart, metin: maskeleCep(t).metin }); toast('Sonuç: ' + (r.durum || 'tamam') + (r.ayrinti ? ' · ' + String(r.ayrinti).slice(0, 80) : '')); if (r.durum !== 'hata' && r.durum !== 'meşgul') { YAP.metin = ''; S.onb = {}; } }
      catch (e) { toast(hataMetni(e)); }
      yapistirEkrani();
    } }, 'İşle → sorulara gönder');
    kap.replaceChildren(baslik('Yapıştır', 'dönem içi işlemler'), cips, h('div', { class: 'satir', style: { margin: '6px 0 4px' } }, h('span', { class: 'muted sm' }, 'Metin telefonda maskelenir, sonra sunucuya gider.'), pano), alan, ozet,
      h('div', { class: 'satir-btn' }, h('button', { class: 'btn o', style: { flex: '0 0 110px' }, onclick: function () { alan.value = YAP.metin = ''; ozetCiz(); } }, 'Temizle'), isle),
      h('div', { class: 'muted sm', style: { margin: '10px 2px 0' } }, 'Okunan satırlar Sorular’a düşer; deftere doğrudan yazılmaz. Aynı içerik ikinci kez işlenmez.'));
  }

  // ---------------------------------------------------------------- gezinti, kilit, kurulum
  var EKRANLAR = { soru: function () { return sorularEkrani(); }, oneri: function () { return onerilerEkrani(); }, islem: islemlerEkrani, yapistir: yapistirEkrani };
  function yenile() { return (EKRANLAR[S.ekran] || EKRANLAR.soru)(); }
  function git(ad) { S.ekran = ad; document.querySelectorAll('.nav button').forEach(function (b) { b.classList.toggle('on', b.dataset.ad === ad); }); return yenile(); }
  function rozetleriCiz() {
    var s = S.sayilar || {};
    [['soru', s.soru], ['oneri', s.kontrol]].forEach(function (p) { var b = document.querySelector('.nav button[data-ad=' + p[0] + '] .rozet'); if (!b) return; b.textContent = p[1] || ''; b.style.display = p[1] ? '' : 'none'; });
  }
  function uygulamaKur() {
    app.replaceChildren(h('div', { class: 'ekran', id: 'ek' }), h('nav', { class: 'nav' }, [['soru', 'Sorular'], ['oneri', 'Öneriler'], ['islem', 'İşlemler'], ['yapistir', 'Yapıştır']].map(function (x) {
      return h('button', { 'data-ad': x[0], class: S.ekran === x[0] ? 'on' : '', onclick: function () { git(x[0]); } }, h('span', { class: 'ikk' }, ic(x[0], 24), h('span', { class: 'rozet', style: { display: 'none' } })), x[1]);
    })));
    yenile();
  }
  function kilitEkrani(hata) {
    S.kilitli = true;
    app.replaceChildren(h('div', { class: 'giris kilit' }, h('img', { class: 'logo', src: 'icon.svg', alt: '' }), h('h1', null, 'MizanSK'), ic('yuz', 64),
      h('div', { class: 'muted', style: { textAlign: 'center', margin: '10px 0 18px' } }, 'Face ID ile açılır. Şifre ekranı yok; Face ID tanımazsa iOS kendi cihaz kodunu ister.'),
      hata ? h('div', { class: 'hata' }, hata) : null,
      h('button', { class: 'btn blok', onclick: async function () { try { await FID.ac(); S.kilitli = false; S.faceId = true; uygulamaKur(); } catch (e) { kilitEkrani('Açılamadı: ' + (e.message || e)); } } }, 'Face ID ile aç'),
      h('button', { class: 'btn g blok', style: { marginTop: '8px' }, onclick: async function () { if (await onayla('Face ID kaldırılsın mı?', 'Uygulama şifresiz açılır; maaş satırları maskeli gelir, şifreyle açılır.', { ad: 'Kaldır' })) { FID.sil(); S.faceId = false; S.kilitli = false; uygulamaKur(); } } }, 'Face ID’yi kaldır')));
  }
  function kurulumEkrani(hataMsg) {
    var url = h('input', { class: 'alan', type: 'url', placeholder: 'https://script.google.com/macros/s/…/exec', autocomplete: 'off', autocapitalize: 'off' }), token = h('input', { class: 'alan', type: 'password', placeholder: 'Anahtar (apiKurulum çıktısı)', autocomplete: 'off' });
    var pin = h('input', { class: 'alan', type: 'password', inputmode: 'numeric', placeholder: 'Maaş şifresi (en az 8 rakam)', autocomplete: 'off' }), pin2 = h('input', { class: 'alan', type: 'password', inputmode: 'numeric', placeholder: 'Şifre tekrar', autocomplete: 'off' }), hata = h('div', { class: 'hata' }, hataMsg || ''), dugme = h('button', { class: 'btn blok' }, 'Kur');
    dugme.onclick = async function () {
      hata.textContent = '';
      var u = url.value.trim(), t = token.value.trim(), p = pin.value.trim();
      if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u)) { hata.textContent = 'Adres biçimi: https://script.google.com/macros/s/…/exec'; return; }
      if (!/^[0-9a-f]{64}$/.test(t)) { hata.textContent = 'Anahtar 64 haneli onaltılık olmalı'; return; }
      if (!/^\d{8,16}$/.test(p) || p !== pin2.value.trim()) { hata.textContent = 'Şifre en az 8 rakam ve iki giriş aynı olmalı'; return; }
      dugme.disabled = true; dugme.textContent = 'Bağlanıyor…';
      try {
        S.cfg = { url: u, token: t };
        await api('ping');
        try { await api('pinKur', { pin: p }); } catch (e) { if (e.kod !== 'pin_var') throw e; }
        await Depo.yaz(S.cfg);
        S.ekran = 'soru';
        if (await FID.varMi()) {
          if (await onayla('Face ID kurulsun mu?', 'Uygulama Face ID ile açılır; maaş satırları açık görünür. Şifre cihazda Face ID anahtarıyla saklanır.', { ad: 'Face ID kur' })) {
            try { await gizliAcPinle(p); await FID.kur(p); S.faceId = true; S.pin = p; toast('Face ID kuruldu'); } catch (e) { toast('Face ID kurulamadı: ' + (e.message || e)); }
          }
        }
        uygulamaKur();
      } catch (e) { S.cfg = null; hata.textContent = hataMetni(e); dugme.disabled = false; dugme.textContent = 'Kur'; }
    };
    app.replaceChildren(h('div', { class: 'giris' }, h('img', { class: 'logo', src: 'icon.svg', alt: '' }), h('h1', null, 'MizanSK'), h('div', { class: 'muted', style: { margin: '6px 0 18px' } }, 'Web uygulaması adresi ve anahtar Apps Script’ten (apiKurulum). Şifre yalnız maaş satırını açmak için; Face ID varsa şifre sorulmaz.'),
      h('label', { class: 'et' }, 'Adres'), url, h('label', { class: 'et' }, 'Anahtar'), token, h('label', { class: 'et' }, 'Maaş şifresi'), pin, pin2, hata, dugme));
  }

  // ---------------------------------------------------------------- cihaz deposu: adres+anahtar, cihaza bağlı AES anahtarıyla (IndexedDB, dışa aktarılamaz) şifreli
  var Depo = {
    db: function () {
      return new Promise(function (coz, red) { var r = indexedDB.open('mizansk', 1); r.onupgradeneeded = function () { r.result.createObjectStore('k'); }; r.onsuccess = function () { coz(r.result); }; r.onerror = function () { red(r.error); }; });
    },
    async anahtar(olustur) {
      var db = await this.db(), tx = db.transaction('k', olustur ? 'readwrite' : 'readonly'), st = tx.objectStore('k');
      var k = await new Promise(function (coz, red) { var g = st.get('cihaz'); g.onsuccess = function () { coz(g.result || null); }; g.onerror = function () { red(g.error); }; });
      if (!k && olustur) { k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); await new Promise(function (coz, red) { var p = st.put(k, 'cihaz'); p.onsuccess = coz; p.onerror = function () { red(p.error); }; }); }
      return k;
    },
    async yaz(cfg) {
      var k = await this.anahtar(true), iv = crypto.getRandomValues(new Uint8Array(12)), ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, new TextEncoder().encode(JSON.stringify(cfg)));
      localStorage.setItem(DEPO, JSON.stringify({ v: 2, iv: MC.b64(iv), ct: MC.b64(ct) }));
    },
    async oku() {
      var ham = localStorage.getItem(DEPO); if (!ham) return null;
      var k = await this.anahtar(false); if (!k) return null;
      var j = JSON.parse(ham); return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: MC.unb64(j.iv) }, k, MC.unb64(j.ct))));
    },
    sil: function () { localStorage.removeItem(DEPO); localStorage.removeItem(DEPO_FID); }
  };

  // ---------------------------------------------------------------- boşta kilit: Face ID varsa yeniden Face ID; yoksa maaş izni düşer
  function etkin() { S.sonEtkin = Date.now(); }
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { document.addEventListener(ev, etkin, { passive: true }); });
  setInterval(function () {
    if (!S.cfg || S.kilitli) return;
    if (Date.now() - S.sonEtkin > S.ayar.kilitDk * 60000) { if (S.faceId) kilitEkrani(); else { S.g = null; } S.sonEtkin = Date.now(); }
  }, 15000);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { S.gizlendi = Date.now(); return; }
    if (S.cfg && !S.kilitli && S.gizlendi && Date.now() - S.gizlendi > 30000) { if (S.faceId) kilitEkrani(); else { S.g = null; } }
    S.gizlendi = 0;
  });

  // ---------------------------------------------------------------- başlangıç
  (async function basla() {
    if ('serviceWorker' in navigator) { try { await navigator.serviceWorker.register('sw.js'); } catch (e) { /* çevrimdışı kabuk olmadan da çalışır */ } }
    var cfg = null; try { cfg = await Depo.oku(); } catch (e) { cfg = null; }
    if (!cfg) return kurulumEkrani(localStorage.getItem('mizansk.v1') ? 'Eski sürüm kaydı bulundu: adres ve anahtarı yeniden gir (şifre ekranı kalktı).' : '');
    S.cfg = cfg;
    if (FID.kayit()) { S.faceId = true; return kilitEkrani(); }
    uygulamaKur();
  })();
})();
