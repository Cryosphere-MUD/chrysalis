import { htmlescape } from "./utils.js";

import { socketSend } from "./socket.js";

import { appendCommand } from "./terminal.js";

const command = document.getElementById("command");

export function sendCommand(value) {
  value = utf8.encode(value);

  const cmd = [];

  for (let idx = 0; idx < value.length; idx += 1) {
    cmd.push(value.charCodeAt(idx));
  }

  cmd.push(13);
  cmd.push(10);

  socketSend(cmd);
}

let editpassword = false;
let editcommandpos = null;
let futurecommand = null;
let editcommands = [];

export function setEcho(yes) {
  editpassword = !yes;
  if (editpassword)
    command.type = "password";
  else
    command.type = "input";
}

function doHistoryPrev() {
  if (editcommandpos == null) {
    futurecommand = command.value;
    editcommandpos = editcommands.length;
  }
  if (editcommandpos > 0) {
    editcommandpos--;
    command.value = editcommands[editcommandpos];
  }
  return true;
}

function doHistoryNext() {
  if (editcommandpos != null && editcommandpos < editcommands.length) {
    editcommandpos++;
    if (editcommandpos === editcommands.length) {
      command.value = futurecommand;
      editcommandpos = null;
    } else {
      command.value = editcommands[editcommandpos];
    }
  }
  return true;
}

function doEnter() {
  sendCommand(command.value);
  appendCommand(command.value, !editpassword);
  if (!editpassword && !command.value.match(/^\s*$/) && command.value !== editcommands[editcommands.length-1]) {
    editcommands.push(command.value);
  }
  command.value = "";
  editcommandpos = null;
  futurecommand = "";
  return true;
}

export function setEditText(newcommand) {
  command.value = newcommand;
}

export function resetCommand() {
  setEditText("");
}

const keyHandlers = 
{
        "Enter": doEnter,
        "ArrowUp": doHistoryPrev,
        "Control-P": doHistoryPrev,
        "ArrowDown": doHistoryNext,
        "Control-N": doHistoryNext,
};

export function keyDown(event) {
  let keyname = event.code;
  keyname = keyname.replace(/^Key/, '');

  if (event.altKey)
  {
        keyname = "Alt-" + keyname;
  }

  if (event.ctrlKey)
  {
        keyname = "Control-" + keyname;
  }

  if (keyHandlers[keyname] != null)
  {
        if (keyHandlers[keyname]() !== false)
        {
                event.preventDefault();
                return;
        }
  }
}
