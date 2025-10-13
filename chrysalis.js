import { handleTelnet, negotiated, sendSize, resetTelnet } from "./telnet.js";

import { socketConnect } from "./socket.js";

import { handleTerminal, injectText, renderOutputData, resetANSIState, scrollToEnd } from "./terminal.js";

import { mudhost, mudport, conn_title, disconn_title } from "./settings.js";

import { keyDown, resetCommand } from "./command.js";

import { TELOPT_EOR } from "./telnetconstants.js";

const main = document.getElementById("main");
const measure = document.getElementById("measure");
const wide = document.getElementById("wide");
const reconnect = document.getElementById("reconnect");
const command = document.getElementById("command");
const output = document.getElementById("output");

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
  document.title = conn_title;
  connected = true;
  injectText(["/// connected to " + mudhost + " " + mudport]);
  resetCommand();
  reconnect.style.display = "none";
}

function handleDisconnect(e) {
  document.title = disconn_title;
  connected = false;
  injectText(["/// connection closed by remote server"]);
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
      

command.onkeydown = handleKeyDown;

output.addEventListener("click", () => 
{
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) {
    command.focus();
  }
})

reconnect.onclick = () => {
  connect();
};

connect();
