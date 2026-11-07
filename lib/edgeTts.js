// A small, self-contained client for Microsoft's Edge read-aloud voices.
//
// Why this exists instead of the `edge-tts` npm package: that package
// talks to Microsoft's OLD endpoint (speech.platform.bing.com), which
// started answering WebSocket handshakes with HTTP 403 in 2026
// (edge-tts issue #490 — the voice list still works, synthesis does
// not). Real Microsoft Edge 155 now reads aloud through the NEW
// endpoint below, and this client follows the maintained
// andresayac/edge-tts implementation of that protocol:
//
//   wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1
//     ?Ocp-Apim-Subscription-Key=<token>
//     &Sec-MS-GEC=<time-based SHA-256>
//     &Sec-MS-GEC-Version=1-155.0.4283.45
//     &ConnectionId=<uuid>
//
// The Sec-MS-GEC token is SHA-256 of "<windows ticks><token>", where
// the ticks are the current Unix time (plus the Windows epoch offset),
// rounded down to 5 minutes, in 100-nanosecond units. It is valid
// only inside that 5-minute window, so a wrong clock gets a 403 —
// on a handshake failure we read the server's own clock (HEAD request)
// and retry once with the corrected time.

import { createHash, randomUUID } from "node:crypto";
import { WebSocket } from "ws";

const TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const WSS_URL = "wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1";
const GEC_VERSION = "1-155.0.4283.45";
const OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36 Edg/155.0.0.0";

let clockSkewMs = 0;

function nowMs() {
  return Date.now() + clockSkewMs;
}

function secMsGec() {
  const ticks = Math.floor(nowMs() / 1000) + 11644473600;
  const rounded = ticks - (ticks % 300);
  const windowsTicks = rounded * 10_000_000;
  return createHash("sha256")
    .update(`${windowsTicks}${TOKEN}`)
    .digest("hex")
    .toUpperCase();
}

function buildUrl() {
  const id = randomUUID().replace(/-/g, "");
  return (
    `${WSS_URL}?Ocp-Apim-Subscription-Key=${TOKEN}` +
    `&Sec-MS-GEC=${secMsGec()}` +
    `&Sec-MS-GEC-Version=${GEC_VERSION}` +
    `&ConnectionId=${id}`
  );
}

function headers() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const muid = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return {
    "User-Agent": UA,
    "Accept-Encoding": "gzip, deflate, br, zstd",
    "Accept-Language": "en-US,en;q=0.9",
    Cookie: `MUID=${muid}`,
    Pragma: "no-cache",
    "Cache-Control": "no-cache",
    Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold"
  };
}

function rfc1123(d = new Date()) {
  return d.toUTCString();
}

function escapeXml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function ssml(text, voice) {
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" ` +
    `xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">` +
    `<voice name="${voice}"><prosody pitch="+0Hz" rate="+0%" volume="+0%">` +
    `${escapeXml(text)}</prosody></voice></speak>`
  );
}

// One synthesis attempt. Resolves with the MP3 bytes, or rejects.
function attempt(text, voice, timeoutMs) {
  return new Promise((resolve, reject) => {
    const requestId = randomUUID();
    const audio = [];
    let settled = false;
    const fail = (err) => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch {}
      reject(err);
    };
    const done = () => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch {}
      const buf = Buffer.concat(audio);
      if (buf.length === 0) {
        reject(new Error("The service returned no audio for this text."));
      } else {
        resolve(buf);
      }
    };

    const timer = setTimeout(() => fail(new Error("Timed out waiting for the voice.")), timeoutMs);
    const ws = new WebSocket(buildUrl(), { headers: headers() });

    ws.on("open", () => {
      const config =
        `X-Timestamp:${rfc1123()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
        JSON.stringify({
          context: {
            synthesis: {
              audio: {
                metadataoptions: { sentenceBoundaryEnabled: true, wordBoundaryEnabled: true },
                outputFormat: OUTPUT_FORMAT
              }
            }
          }
        });
      ws.send(config, { compress: true }, (err) => {
        if (err) return fail(err);
        const msg =
          `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\n` +
          `X-Timestamp:${rfc1123()}Z\r\nPath:ssml\r\n\r\n${ssml(text, voice)}`;
        ws.send(msg, { compress: true }, (err2) => {
          if (err2) fail(err2);
        });
      });
    });

    ws.on("message", (raw, isBinary) => {
      if (!isBinary) {
        if (String(raw).includes("turn.end")) {
          clearTimeout(timer);
          done();
        }
        return;
      }
      const data = Buffer.from(raw);
      if (data.length < 2) return;
      // Binary frames: 2-byte header length, then the header, then audio.
      const headerLength = (data[0] << 8) | data[1];
      const header = data.subarray(2, 2 + headerLength).toString("utf8");
      if (/Path:audio/i.test(header)) {
        audio.push(data.subarray(2 + headerLength));
      }
    });

    ws.on("error", (err) => {
      clearTimeout(timer);
      fail(err);
    });
    ws.on("unexpected-response", (_req, res) => {
      clearTimeout(timer);
      const e = new Error(`Unexpected server response: ${res.statusCode}`);
      e.status = res.statusCode;
      fail(e);
    });
  });
}

// Read the server's own clock (HEAD on the service origin) so a
// handshake failure caused by clock skew can be retried with the
// corrected time.
async function adjustClockFromServer() {
  try {
    const res = await fetch("https://api.msedgeservices.com/", { method: "HEAD", signal: AbortSignal.timeout(8000) });
    const date = Date.parse(res.headers.get("date") || "");
    if (Number.isNaN(date)) return false;
    const delta = date - Date.now();
    if (Math.abs(delta) < 2000) return false;
    clockSkewMs += delta;
    return true;
  } catch {
    return false;
  }
}

// Synthesize `text` with `voice` and return the MP3 bytes.
// Retries once after a handshake failure, with the server clock.
export async function synthesizeEdgeTts(text, voice) {
  try {
    return await attempt(text, voice, 9000);
  } catch (err) {
    if (err?.status === 403 || /Unexpected server response: 403/.test(err?.message || "")) {
      if (await adjustClockFromServer()) {
        return await attempt(text, voice, 9000);
      }
    }
    throw err;
  }
}
