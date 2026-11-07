// Read-aloud voice, running in the reader's own browser.
//
// The voice is Microsoft's free read-aloud service (Edge TTS): realistic
// neural voices, no key and no account. The browser opens a WebSocket
// straight to Microsoft and the audio streams back as MP3 — the phone
// does no heavy work (no model to download, no warming up), so the
// first sound starts in seconds and the page stays responsive. It needs
// internet every time it reads, which the user accepted.
//
// Endpoint history (2026-11-07): the voice first went through our own
// server, but Microsoft refuses the messages from Vercel's datacenter
// IPs. Then the browser connected to Microsoft's NEW endpoint
// (api.msedgeservices.com) — the connection never opened, from the
// test browser or the user's phone, even though a browser CAN reach
// that host (it answers HTTP 404) and the voices list loads fine.
// The new endpoint only accepts Microsoft Edge's own handshake, which
// a normal browser cannot make. So this client now uses Microsoft's
// OLD read-aloud endpoint (speech.platform.bing.com), the one browsers
// and extensions used for years — the voices list proves the browser
// reaches that host, so this is the connection worth testing.

const TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const WSS_URL = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";
const OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3";

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

// Synthesize one piece of text with one voice. Resolves with the MP3
// bytes (Uint8Array). Rejects with an Error carrying a short `trace`
// of what happened, so a failure can be diagnosed.
export async function synthesizeInBrowser(text, voice, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const requestId = uuid();
    const audio = [];
    const trace = [];
    let settled = false;
    let ws = null;

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

    const timer = setTimeout(() => fail(new Error("Timed out waiting for the voice.")), timeoutMs);

    const connectionId = uuid().replace(/-/g, "");
    const url = `${WSS_URL}?TrustedClientToken=${TOKEN}&ConnectionId=${connectionId}`;

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
                metadataoptions: { sentenceBoundaryEnabled: false, wordBoundaryEnabled: false },
                outputFormat: OUTPUT_FORMAT
              }
            }
          }
        });
      const msg =
        `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\n` +
        `X-Timestamp:${ts}Z\r\nPath:ssml\r\n\r\n${ssml(text, voice)}`;
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
}
