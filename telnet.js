import {
  IAC,
  DONT,
  DO,
  WILL,
  WONT,
  ECHO,
  TTYPE,
  SB,
  SE,
  IS,
  SEND,
  NOP,
  TELOPT_NAWS,
  TELOPT_EOR,
  EOR,
  MTTS_ANSI,
  MTTS_UTF8,
  MTTS_256,
  MTTS_TRUECOLOR,
} from "./telnetconstants.js";

import { socketSend } from "./socket.js";

import { handleTerminal } from "./terminal.js";

import { setEcho } from "./command.js";

function encodeIAC(data) {
  const str = [];
  data.forEach((ch) => {
    if (ch === IAC) {
      str.push(IAC);
    }
    str.push(data);
  });
  return data;
}

function encodeSubNeg(subMode, data) {
  const cmd = [IAC, SB, subMode];
  data = encodeIAC(data);
  data.forEach((ch) => cmd.push(ch));
  cmd.push(IAC);
  cmd.push(SE);
  return cmd;
}

let currentWidth = 80;
let currentHeight = 30;

function encodeNAWS() {
  return encodeSubNeg(TELOPT_NAWS, [0, currentWidth, 0, currentHeight]);
}

let naws = false;

export function sendSize(width, height) {
  currentWidth = width;
  currentHeight = height;
  if (naws) {
    socketSend(encodeNAWS());
  }
}

function handleNegotiation(state, code) {
  if (state === WILL && code === ECHO) {
    setEcho(false);
    socketSend([IAC, DO, ECHO]);
    return;
  }
  if (state === WONT && code === ECHO) {
    setEcho(true);
    socketSend([IAC, DONT, ECHO]);
    return;
  }
  if (state === DO && code === TTYPE) {
    socketSend([IAC, WILL, TTYPE]);
    return;
  }
  if (state === DO && code === TELOPT_NAWS) {
    naws = true;
    socketSend([IAC, WILL, TELOPT_NAWS].concat(encodeNAWS()));
    return;
  }
  if (state === WILL && code === TELOPT_EOR) {
    socketSend([IAC, DO, TELOPT_EOR]);
    return;
  }

  console.log("IAC ", state, code);
}

let ttypeCount = 0;

function handleSubnegotiation(subMode, subData) {
  if (subMode === TTYPE && subData.length === 1 && subData[0] === SEND) {
    const cmd = [IAC, SB, TTYPE, IS];

    let name;

    switch (ttypeCount) {
      case 0:
        name = "chrysalis2";
        break;
      case 1:
        name = "chrysalis2:002_2025-05-06";
        break;
      case 2:
      default:
        name = "MTTS " + (MTTS_ANSI | MTTS_UTF8 | MTTS_256 | MTTS_TRUECOLOR);
    }

    ttypeCount++;

    for (let idx = 0; idx < name.length; idx += 1) {
      cmd.push(name.charCodeAt(idx));
    }

    cmd.push(IAC);
    cmd.push(SE);

    return cmd;
  }

  return [];
}

let telnetState = 0;
let subMode = 0;
let subData = [];

export function handleTelnet(data) {
  if (telnetState === 0 && data === IAC) {
    telnetState = IAC;
    return;
  }

  if (telnetState === SB) {
    subMode = data;
    subData = [];
    telnetState = 0;
    return;
  }

  if (telnetState === IAC) {
    if (
      data === WILL ||
      data === WONT ||
      data === DO ||
      data === DONT ||
      data === SB
    ) {
      telnetState = data;
      return;
    }

    if (data === SE && subMode !== 0) {
      socketSend(handleSubnegotiation(subMode, subData));
      telnetState = 0;
      subMode = 0;
      return;
    }

    if (data === NOP) {
      telnetState = 0;
      return;
    }

    if (data === EOR) {
      telnetState = 0;
      handleTerminal();
      return;
    }

    if (data === IAC) {
      if (subMode) {
        subData.push(data);
      } else {
        handleTerminal(data);
      }
      telnetState = 0;
      return;
    }

    console.error("unknown byte", data, "in state", telnetState);
    return;
  }

  if (
    telnetState === WILL ||
    telnetState === WONT ||
    telnetState === DO ||
    telnetState === DONT
  ) {
    handleNegotiation(telnetState, data);
    telnetState = 0;
    return;
  }

  if (telnetState === 0) {
    if (subMode) {
      subData.push(data);
    } else {
      handleTerminal(data);
    }
  } else {
    console.error("unknown byte", data, "in state", telnetState);
  }
}
