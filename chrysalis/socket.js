import { settings } from "./settings.js";

let sessionID = null; // localStorage.getItem("sessionID");

export const socket = io({
  auth: { sessionID },
  autoConnect: true,
  reconnection: true
});

export function socketSend(arr) {
  console.log("sending", arr);
  socket.emit("mud-input", arr);
}

export function socketConnect() {
  console.log("connecting");
}
