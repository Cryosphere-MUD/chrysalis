import { handleTelnet, negotiated, sendSize, resetTelnet } from "./telnet.js";

import { socketConnect } from "./socket.js";

import { handleTerminal, injectText, renderOutputData, resetANSIState, scrollToEnd } from "./terminal.js";

import { paste, keyDown, resetCommand } from "./command.js";

import { TELOPT_EOR } from "./telnetconstants.js";

const main = document.getElementById("main");
const measure = document.getElementById("measure");
const wide = document.getElementById("wide");
const reconnect = document.getElementById("reconnect");
const onmobile = document.getElementById("onmobile");
const command = document.getElementById("command");
const capture = document.getElementById("keyboard-capture");

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

let connected = false;

function handleConnect(e) {
  connected = true;
  injectText(["/// connected to remote server"]);
  resetCommand();
  command.style.display = "inline";
  reconnect.style.display = "none";
  onmobile.style.display = "block";
}

function handleDisconnect(e) {
  connected = false;
  injectText(["/// connection closed by remote server"]);
  command.style.display = "none";
  onmobile.style.display = "none";
  reconnect.style.display = "inline";
  resetTelnet();
  resetANSIState();
}

function connect() {
  const ws = socketConnect();
  ws.onmessage = (event) => {
    const arr = new Uint8Array(event.data);
    arr.forEach((ch) => handleTelnet(ch));
    if (!negotiated(TELOPT_EOR))
        handleTerminal();
    if (renderOutputData())
        scrollToEnd();
  };
  ws.onopen = handleConnect;
  ws.onerror = handleDisconnect;
  ws.onclose = handleDisconnect;
}

function handleKeyDown(event) {
  if (connected) keyDown(event);
}

function handlePaste(event) {
        if (connected) paste(event);
}
      
window.onkeydown = handleKeyDown;
window.addEventListener('paste', handlePaste);

reconnect.onclick = () => {
  connect();
};

connect();

onmobile.onclick = () => {
        onmobile.style.display = "none";
        capture.style.display = "block";
}

