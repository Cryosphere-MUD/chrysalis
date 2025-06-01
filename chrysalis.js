import { handleTelnet, sendSize } from "./telnet.js";

import { getSocket, socketSend } from "./socket.js";

import { renderOutputData } from "./terminal.js";

import { keyDown } from "./command.js";

const main = document.getElementById("main");
const measure = document.getElementById("measure");
const wide = document.getElementById("wide");

function updateSize() {
  const fullWidth = wide.offsetWidth;
  const fullHeight = main.offsetHeight;
  const lineHeight = measure.offsetHeight;

  const width = Math.floor(fullWidth / measure.offsetWidth) - 10;
  const height = Math.floor(fullHeight / lineHeight) - 2;
  sendSize(width, height);
}

window.addEventListener("resize", updateSize);

updateSize();

function scrollToEnd() {
  main.scrollTop = main.scrollHeight;
}

const ws = getSocket();

ws.onmessage = (event) => {
  const arr = new Uint8Array(event.data);
  arr.forEach((ch) => handleTelnet(ch));
  renderOutputData();
  scrollToEnd();
};

window.onkeydown = keyDown;
