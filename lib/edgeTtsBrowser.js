// Read-aloud voice, running in the reader's own browser.
//
// The voice is Microsoft's free read-aloud service (Edge TTS): realistic
// neural voices, no key and no account. The browser opens a WebSocket
// straight to Microsoft's current endpoint and the audio streams back
// as MP3 — the phone does no heavy work (no model to download, no
// warming up), so the first sound starts in seconds and the page stays
// responsive. It needs internet every time it reads, which the user
// accepted.
//
// Why in the browser and not on our server: the server route was built
// first and worked from a normal network, but Microsoft's service
// refuses the WebSocket messages when they come from Vercel's
// datacenter IPs (the connection opens, then closes with
// "Invalid message format"). A phone browser connects from a normal
// mobile network, which the service accepts — this is exactly how
// Microsoft Edge's own Read Aloud works, and the same approach is
// used by the maintained andresayac/edge-tts browser build, which
// this client follows.
//
// The endpoint and token are Microsoft's own public read-aloud
// service; the Sec-MS-GEC token is a time-based SHA-256 that any
// client computes locally (Unix time + Windows epoch offset, rounded
// to 5 minutes, hashed with the public client token).

const TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const WSS_URL = "wss://api.msedgeservices.com/tts/cognitiveservices/websocket/v1";
const GEC_VERSION = "1-155.0.4283.45";
const OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3";

let clockSkewMs = 0;

async function secMsGec() {
  const ticks = Math.floor((Date.now() + clockSkewMs) / 1000) + 11644473600;
  const rounded = ticks - (ticks % 300);
  const windowsTicks = rounded * 10_000_000;
  const data = new TextEncoder().encode(`${windowsTicks}${TOKEN}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function uuid() {
  return "xxxxxxxx-xxxx-xxxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
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

async function adjustClockFromServer() {
  try {
    const res = await fetch("https://api.msedgeservices.com/", { method: "HEAD" });
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

// Synthesize one piece of text with one voice. Resolves with the MP3
// bytes (Uint8Array). Rejects with an Error carrying a short `trace`
// of what happened, so a failure can be diagnosed.
export async function synthesizeInBrowser(text, voice, timeoutMs = 15000) {
  const attempt = () => {
    return new Promise(async (resolve, reject) => {
      const requestId = uuid();
      const audio = [];
      const trace = [];
      let settled = false;
      let ws = null;
      let timer = null;

      const fail = (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { ws?.close(); } catch {}
        err.trace = trace.join(" | ");
        reject(err);
      };
      const done = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { ws?.close(); } catch {}
        const total = audio.reduce((n, c) => n + c.length, 0);
        if (total === 0) {
          const e = new Error("The service returned no audio for this text.");
          e.trace = trace.join(" | ");
          reject(e);
          return;
        }
        const out = new Uint8Array(total);
        let off = 0;
        for (const c of audio) { out.set(c, off); off += c.length; }
        resolve(out);
      };

      timer = setTimeout(() => fail(new Error("Timed out waiting for the voice.")), timeoutMs);

      let gec;
      try {
        gec = await secMsGec();
      } catch (e) {
        fail(new Error("This browser could not prepare the voice request."));
        return;
      }
      const connectionId = uuid().replace(/-/g, "");
      const url =
        `${WSS_URL}?Ocp-Apim-Subscription-Key=${TOKEN}` +
        `&Sec-MS-GEC=${gec}&Sec-MS-GEC-Version=${GEC_VERSION}&ConnectionId=${connectionId}`;

      ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        trace.push("open");
        const ts = new Date().toUTCString();
        const config =
          `X-Timestamp:${ts}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
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
        const msg =
          `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\n` +
          `X-Timestamp:${ts}\r\nPath:ssml\r\n\r\n${ssml(text, voice)}`;
        ws.send(config);
        ws.send(msg);
        trace.push("ssml-sent");
      };

      ws.onmessage = (event) => {
        if (typeof event.data === "string") {
          const path = /Path:([^\r\n]*)/i.exec(event.data)?.[1]?.trim() || "text";
          trace.push(`text:${path}`);
          if (event.data.includes("turn.end")) {
            clearTimeout(timer);
            done();
          }
          return;
        }
        const data = new Uint8Array(event.data);
        if (data.length < 2) return;
        const headerLength = (data[0] << 8) | data[1];
        const header = new TextDecoder().decode(data.subarray(2, 2 + headerLength));
        if (/Path:audio/i.test(header)) {
          audio.push(data.slice(2 + headerLength));
          if (audio.length === 1) trace.push("audio:first-chunk");
        } else {
          const path = /Path:([^\r\n]*)/i.exec(header)?.[1]?.trim() || "bin";
          trace.push(`bin:${path}`);
        }
      };

      ws.onclose = (event) => {
        trace.push(`close:${event.code}:${event.reason || ""}`);
        clearTimeout(timer);
        if (!settled) {
          fail(new Error(`The read-aloud service closed the connection (code ${event.code}).`));
        }
      };

      ws.onerror = () => {
        trace.push("error");
        clearTimeout(timer);
        if (!settled) fail(new Error("Could not reach the read-aloud service. Check your connection."));
      };
    });
  };

  // Diagnose the failure: can this browser even reach the service host
  // over plain HTTPS? If yes, the WebSocket handshake itself was
  // refused; if no, the browser has no route to the service at all.
  // The result travels on the error so the player can show it.
  async function probeReachable(e) {
    try {
      const res = await fetch("https://api.msedgeservices.com/", {
        method: "HEAD",
        signal: AbortSignal.timeout(8000)
      });
      e.reachable = `https:${res.status}`;
    } catch {
      e.reachable = "https:fail";
    }
    return e;
  }

  try {
    return await attempt();
  } catch (err) {
    // A 403-style handshake failure can mean the phone's clock is off
    // by more than the token's 5-minute window — retry once with the
    // server's own clock.
    if (/code 1006|1007|403/.test(err?.message || "") || /close:1006|close:1007/.test(err?.trace || "")) {
      if (await adjustClockFromServer()) {
        try {
          return await attempt();
        } catch (err2) {
          throw await probeReachable(err2);
        }
      }
    }
    throw await probeReachable(err);
  }
}
