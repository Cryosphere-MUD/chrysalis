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

const keyHandlers = 
{
        "Enter": doEnter,
        "Backspace": () => {
                if (editpos > 0) {
                  edittext = edittext.slice(0, editpos - 1) + edittext.slice(editpos);
                  editpos -= 1;
                }
              },
        "Delete": () => {
                if (editpos < edittext.length) {
                   edittext = edittext.slice(0, editpos) + edittext.slice(editpos + 1);
                }
              },
        "ArrowLeft": () => {
                if (editpos > 0) {
                        editpos -= 1;
                }
        },
        "ArrowRight": () => {
                if (editpos < edittext.length) {
                        editpos += 1;
                }
        },
        "ArrowUp": doHistoryPrev,
        "ArrowDown": doHistoryNext,
        "Control-A": () => { editpos = 0},
        "Control-E": () => { editpos = edittext.length; },
        "Control-K": () => { edittext = edittext.slice(0, editpos); },
        "Control-C": () => {
                if (window.getSelection().toString().length > 0) {
                        return false;
                }
                editpos = 0;
                edittext = "";            
        },
        "Home": () => { editpos = 0},
        "End": () => { editpos = edittext.length; },
};

export function keyDown(event) {
  let keyname = event.key;
  if (event.ctrlKey)
  {
        keyname = "Control-" + keyname.toUpperCase();
  }

  if (keyHandlers[keyname] != null)
  {
        if (keyHandlers[keyname]() !== false)
        {
                event.preventDefault();
                updateCommandText();
                return;
        }
  }

  if (
    event.key.length === 1 &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.metaKey
  ) {
    edittext = edittext.slice(0, editpos) + event.key + edittext.slice(editpos);
    editpos += 1;
    event.preventDefault();
    updateCommandText();
  }
}

export function paste(event) {
  const text = (event.clipboardData || window.clipboardData).getData('text');
  edittext = edittext.slice(0, editpos) + text + edittext.slice(editpos);
  editpos += text.length;
  event.preventDefault();
  updateCommandText();
}
