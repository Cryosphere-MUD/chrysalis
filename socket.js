import { url } from "./settings.js";

import { FramedSocket } from "./FramedSocket.js"

function isIPhone() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

let ws;

export function socketSend(arr) {
  if (arr.length === 0 || ws == null) {
    return;
  }
  ws.send(new Uint8Array(arr));
}

export function socketConnect() {
  ws = new FramedSocket(url);
  if (ws) {
    ws.binaryType = "arraybuffer";
  }
  return ws;
}
