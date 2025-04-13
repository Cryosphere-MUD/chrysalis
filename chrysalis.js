import "./jquery.js";

import { handleTelnet, sendSize } from "./telnet.js";

import { getSocket } from "./socket.js";

import { keyDown } from "./command.js";

const main = document.getElementById("main");
const measure = document.getElementById("measure");

function updateSize() {
  const fullWidth = $(wide).width();
  const fullHeight= $(main).height();
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

ws.onmessage = event => {
  const arr = new Uint8Array(event.data);
  arr.forEach(ch => handleTelnet(ch));
  scrollToEnd();
};

window.onkeydown = keyDown;
