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

function previousWordStart(str, position) {
  const substr = str.slice(0, position);
  const match = substr.match(/^.*\s\S/);
  return match ? match[0].length - 1 : 0;
}

function nextWordStart(str, position) {
  const substr = str.slice(position);
  const match = substr.match(/\s\S/);
  return match ? position + match.index + 1 : str.length;
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
        "Control-H": () => {
                if (editpos > 0) {
                  edittext = edittext.slice(0, editpos - 1) + edittext.slice(editpos);
                  editpos -= 1;
                }
              },
        "Alt-Backspace": () => {
                const newpos = previousWordStart(edittext, editpos);
                edittext = edittext.slice(0, newpos) + edittext.slice(editpos);
                editpos = newpos;
              },
        "Delete": () => {
                if (editpos < edittext.length) {
                   edittext = edittext.slice(0, editpos) + edittext.slice(editpos + 1);
                }
              },
        "Control-D": () => {
                if (editpos < edittext.length) {
                   edittext = edittext.slice(0, editpos) + edittext.slice(editpos + 1);
                }
              },
        "Alt-D": () => {
                edittext = edittext.slice(0, editpos) + edittext.slice(nextWordStart(edittext, editpos));
              },
        "ArrowLeft": () => {
                if (editpos > 0) {
                        editpos -= 1;
                }
        },
        "Control-B": () => {
                if (editpos > 0) {
                        editpos -= 1;
                }
        },
        "ArrowRight": () => {
                if (editpos < edittext.length) {
                        editpos += 1;
                }
        },
        "Control-F": () => {
                if (editpos < edittext.length) {
                        editpos += 1;
                }
        },
        "Alt-B": () => { editpos = previousWordStart(edittext, editpos) },
        "Alt-F": () => { editpos = nextWordStart(edittext, editpos) },
        "ArrowUp": doHistoryPrev,
        "Control-P": doHistoryPrev,
        "ArrowDown": doHistoryNext,
        "Control-N": doHistoryNext,
        "Control-A": () => { editpos = 0 },
        "Control-E": () => { editpos = edittext.length; },
        "Control-K": () => { edittext = edittext.slice(0, editpos); },
        "Control-U": () => { editpos = 0; edittext = ""; },
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
