/** Session storage on a parent-domain cookie so every *.lantr.site app
 *  shares one sign-in. Chunked (cookies cap ~4KB); falls back to
 *  localStorage off-domain (localhost, vercel.app previews). */

const DOMAIN = ".lantr.site";
const CHUNK = 1800;

function setCookie(name: string, value: string, maxAge = 30 * 86400) {
  document.cookie = `${name}=${encodeURIComponent(value)}; Domain=${DOMAIN}; Path=/; Max-Age=${maxAge}; Secure; SameSite=Lax`;
}
function getCookie(name: string): string | null {
  const m = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/\./g, "\\.")}=([^;]*)`)
  );
  return m ? decodeURIComponent(m[1]) : null;
}
function delCookie(name: string) {
  document.cookie = `${name}=; Domain=${DOMAIN}; Path=/; Max-Age=0`;
}

export const cookieStorage = {
  getItem(key: string): string | null {
    const single = getCookie(key);
    if (single !== null) return single;
    let out = "";
    for (let i = 0; ; i++) {
      const c = getCookie(`${key}.${i}`);
      if (c === null) break;
      out += c;
    }
    return out || null;
  },
  setItem(key: string, value: string) {
    this.removeItem(key);
    if (value.length <= CHUNK) {
      setCookie(key, value);
      return;
    }
    for (let i = 0; i * CHUNK < value.length; i++) {
      setCookie(`${key}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
    }
  },
  removeItem(key: string) {
    delCookie(key);
    for (let i = 0; ; i++) {
      if (getCookie(`${key}.${i}`) === null) break;
      delCookie(`${key}.${i}`);
    }
  },
};

export const onLantrSite =
  typeof document !== "undefined" && location.hostname.endsWith("lantr.site");
