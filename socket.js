import { url } from "./settings.js";

let ws;

export function socketSend(arr) {
  if (arr.length === 0 || ws == null) {
    return;
  }
  ws.send(new Uint8Array(arr));
}

export function socketConnect() {
  ws = new WebSocket(url);
  if (ws) {
    ws.binaryType = "arraybuffer";
  }
  return ws;
}
