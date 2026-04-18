import { settings } from "./settings.js";

// import { LifelineSocket } from "./lifeline/LifelineSocket.js"

let ws: WebSocket;

export function socketSend(arr: number[]) {
  if (arr.length === 0 || ws == null) {
    return;
  }
  ws.send(new Uint8Array(arr));
}

export function socketConnect() {
  ws = new WebSocket(settings.url);
  if (ws) {
    ws.binaryType = "arraybuffer";
  }
  return ws;
}
