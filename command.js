import { htmlescape } from "./utils.js";

import { socketSend } from "./socket.js";

import { appendCommand } from "./terminal.js";

const command = document.getElementById("command");

export function sendCommand(value) {
  const cmd = [];

  for (let idx = 0; idx < value.length; idx += 1) {
    cmd.push(value.charCodeAt(idx));
  }

  cmd.push(10);
  cmd.push(13);

  socketSend(cmd);
}

let edittext = "";
let editpos = 0;
let editpassword = false;
let editcommandpos = null;
let futurecommand = null;
let editcommands = [];

function indicateCursorPos(string, pos) {
  let ret = "";
  for (let i = 0; i < string.length; i += 1) {
    if (pos === i) {
      ret += '<span class="cursor">';
    }
    ret += editpassword ? "*" : htmlescape(string[i]);
    if (pos === i) {
      ret += "</span>";
    }
  }
  if (pos === string.length) {
    ret += '<span class="cursor">&nbsp;</span>';
  }
  return ret;
}

function updateCommandText() {
  command.innerHTML = indicateCursorPos(edittext, editpos);
}

export function setEcho(yes) {
  editpassword = !yes;
}

function doHistoryPrev() {
  if (editcommandpos == null) {
    futurecommand = edittext;
    editcommandpos = editcommands.length;
  }
  if (editcommandpos > 0) {
    editcommandpos--;
    edittext = editcommands[editcommandpos];
    editpos = edittext.length;
  }
  return true;
}

function doHistoryNext() {
  if (editcommandpos != null && editcommandpos < editcommands.length) {
    editcommandpos++;
    if (editcommandpos === editcommands.length) {
      edittext = futurecommand;
      editcommandpos = null;
    } else {
      edittext = editcommands[editcommandpos];
    }
    editpos = edittext.length;
  }
  return true;
}

function doEnter() {
  sendCommand(edittext);
  appendCommand(edittext, !editpassword);
  if (!editpassword) {
    editcommands.push(edittext);
  }
  edittext = "";
  editpos = 0;
  editcommandpos = null;
  futurecommand = "";
  return true;
}

export function setEditText(newcommand) {
  edittext = newcommand;
  editpos = edittext.length;
  updateCommandText();
}

export function resetCommand() {
  setEditText("");
}

updateCommandText();

export function keyDown(event) {
  if (event.key === "Enter") {
    doEnter();
  } else if (event.key === "Backspace") {
    if (editpos > 0) {
      edittext = edittext.slice(0, editpos - 1) + edittext.slice(editpos);
      editpos -= 1;
    }
  } else if (event.key === "ArrowLeft") {
    if (editpos > 0) {
      editpos -= 1;
    }
  } else if (event.key === "ArrowRight") {
    if (editpos < edittext.length) {
      editpos += 1;
    }
  } else if (event.key === "ArrowUp") {
    doHistoryPrev();
  } else if (event.key === "ArrowDown") {
    doHistoryNext();
  } else if (
    event.key.length === 1 &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.metaKey
  ) {
    edittext = edittext.slice(0, editpos) + event.key + edittext.slice(editpos);
    editpos += 1;
  } else if (event.key === "c" && event.ctrlKey) {
    editpos = 0;
    edittext = "";
  } else if (event.key === "k" && event.ctrlKey) {
    edittext = edittext.slice(0, editpos);
  } else if (event.key === "Home" || (event.key === "a" && event.ctrlKey)) {
    editpos = 0;
  } else if (event.key === "End" || (event.key === "e" && event.ctrlKey)) {
    editpos = edittext.length;
  } else {
    return;
  }

  event.preventDefault();
  updateCommandText();
}
