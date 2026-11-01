/* MizanSK istemci kriptosu (WebCrypto): API imzası + cihazdaki yapılandırmanın PIN ile şifrelenmesi.
 * Sunucu (82_Api.gs) ile birebir uyumlu: imza = HMAC-SHA256(token, "eylem|zaman|nonce|JSON(d)").
 * PIN hiçbir yerde saklanmaz: PBKDF2 ile AES-GCM anahtarı türetilir, adres+anahtar (token) şifreli tutulur. */
(function (kok) {
  'use strict';
  var subtle = (kok.crypto || require('node:crypto').webcrypto).subtle, rnd = function (n) { return (kok.crypto || require('node:crypto').webcrypto).getRandomValues(new Uint8Array(n)); };
  var enc = new TextEncoder(), dec = new TextDecoder(), TEKRAR = 600000;

  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function b64(buf) { var s = '', u = new Uint8Array(buf); for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); }
  function unb64(t) { var s = atob(t), u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
  function nonce() { return b64(rnd(24)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }

  async function hmacHex(mesaj, anahtar) {
    var k = await subtle.importKey('raw', enc.encode(anahtar), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return hex(await subtle.sign('HMAC', k, enc.encode(mesaj)));
  }

  /** İmzalı istek gövdesi (düz metin JSON). g: gizli izin {e,s} (isteğe bağlı). */
  async function imzala(token, eylem, d, g, simdi) {
    d = d || {};
    var t = simdi || Date.now(), n = nonce(), s = await hmacHex([eylem, t, n, JSON.stringify(d)].join('|'), token);
    var o = { a: eylem, t: t, n: n, s: s, d: d };
    if (g) o.g = g;
    return JSON.stringify(o);
  }

  async function anahtarTuret(pin, tuz, tekrar) {
    var ham = await subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
    return subtle.deriveKey({ name: 'PBKDF2', salt: tuz, iterations: tekrar, hash: 'SHA-256' }, ham, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function sifrele(pin, nesne, tekrar) {
    var t = tekrar || TEKRAR, tuz = rnd(16), iv = rnd(12), k = await anahtarTuret(pin, tuz, t);
    var ct = await subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, enc.encode(JSON.stringify(nesne)));
    return { v: 1, i: t, tuz: b64(tuz), iv: b64(iv), ct: b64(ct) };
  }
  /** Yanlış PIN'de hata atar (AES-GCM doğrulaması). */
  async function coz(pin, kayit) {
    var k = await anahtarTuret(pin, unb64(kayit.tuz), kayit.i);
    var d = await subtle.decrypt({ name: 'AES-GCM', iv: unb64(kayit.iv) }, k, unb64(kayit.ct));
    return JSON.parse(dec.decode(d));
  }

  var api = { imzala: imzala, hmacHex: hmacHex, sifrele: sifrele, coz: coz, nonce: nonce };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else kok.MizanCrypto = api;
})(typeof self !== 'undefined' ? self : globalThis);
