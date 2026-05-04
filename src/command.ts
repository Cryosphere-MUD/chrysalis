import { htmlescape } from "./utils.js";

import { socketSend } from "./socket.js";

import { terminal } from "./terminal.js";

const command = document.getElementById("command") as HTMLInputElement;

export function sendCommand(value: string) {
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
let editcommandpos: number | null = null;
let futurecommand: string | null = null;
let editcommands: string[] = [];

export function setEcho(yes: boolean) {
  editpassword = !yes;
  if (editpassword)
    command.type = "password";
  else
    command.type = "input";
}

function setCommand(newCommand: string | undefined | null)
{
    if (newCommand != null)
      command.value = newCommand;
    else
      command.value = "";
}

function doHistoryPrev() {
  if (editcommandpos == null) {
    futurecommand = command.value;
    editcommandpos = editcommands.length;
  }
  if (editcommandpos > 0) {
    editcommandpos--;
    setCommand(editcommands[editcommandpos]);
  }
  return true;
}

function doHistoryNext() {
  if (editcommandpos != null && editcommandpos < editcommands.length) {
    editcommandpos++;
    if (editcommandpos === editcommands.length) {
      setCommand(futurecommand);
      editcommandpos = null;
    } else {
      setCommand(editcommands[editcommandpos]);
    }
  }
  return true;
}

function doEnter() {
  sendCommand(command.value);
  terminal.appendCommand(command.value, !editpassword);
  if (!editpassword && !command.value.match(/^\s*$/) && command.value !== editcommands[editcommands.length-1]) {
    editcommands.push(command.value);
  }
  command.value = "";
  editcommandpos = null;
  futurecommand = "";
  return true;
}

export function setEditText(newcommand : string) {
  command.value = newcommand;
}

export function resetCommand() {
  setEditText("");
}

const keyHandlers: Record<string, () => boolean> = 
{
        "Enter": doEnter,
        "ArrowUp": doHistoryPrev,
        "Control-P": doHistoryPrev,
        "ArrowDown": doHistoryNext,
        "Control-N": doHistoryNext,
};

export function keyDown(event : KeyboardEvent) {
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

  let handler = keyHandlers[keyname];

  if (handler != null)
  {
        if (handler() !== false)
        {
                event.preventDefault();
                return;
        }
  }
}
