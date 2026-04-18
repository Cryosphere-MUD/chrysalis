import { handleTelnet, negotiated, sendSize, resetTelnet } from "./telnet.js";

import { socketConnect } from "./socket.js";

import { handleTerminal, injectText, renderOutputData, resetANSIState, scrollToEnd } from "./terminal.js";

import { mudhost, mudport, conn_title, disconn_title } from "./settings.js";

import { keyDown, resetCommand } from "./command.js";

import { TELOPT_EOR } from "./telnetconstants.js";

const main = document.getElementById("main")!;
const measure = document.getElementById("measure")!;
const wide = document.getElementById("wide")!;
const reconnect = document.getElementById("reconnect")!;
const command = document.getElementById("command")!;
const output = document.getElementById("output")!;

function getCharSize(container: HTMLElement) {
  const test = document.createElement("span");
  test.textContent = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"; // 40 chars
  test.style.whiteSpace = "pre";

  container.appendChild(test);

  const rect = test.getBoundingClientRect();
  const charWidth = rect.width / test.textContent.length;
  const charHeight = rect.height;

  container.removeChild(test);

  return { charWidth, charHeight };
}

function updateSize() {
  const { charWidth, charHeight } = getCharSize(output);

  const cols = Math.floor(output.clientWidth / charWidth);
  const rows = Math.floor(output.clientHeight / charHeight);

  sendSize(cols, rows);
}

window.addEventListener("resize", updateSize);

updateSize();

let connected = false;

function handleConnect(e: Event) {
  document.title = conn_title;
  connected = true;
  injectText(["/// connected to " + mudhost + " " + mudport]);
  resetCommand();
  reconnect.style.display = "none";
}

function handleDisconnect(e: Event) {
  document.title = disconn_title;
  connected = false;
  injectText(["/// connection closed by remote server"]);
  reconnect.style.display = "inline";
  resetTelnet();
  resetANSIState();
}

function connect() {
  const ws = socketConnect();
  ws.onmessage = (event: MessageEvent) => {
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

function handleKeyDown(event: KeyboardEvent) {
  if (connected) keyDown(event);
}


command.onkeydown = handleKeyDown;

main.addEventListener("click", () =>
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
