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
  TELOPT_GMCP,
} from "./telnetconstants.js";

import { socketSend } from "./socket.js";

import { handleTerminal } from "./terminal.js";

import { settings } from "./settings.js";

import { setEcho } from "./command.js";

/* not actually part of the telnet stack, but information from the terminal */
let currentWidth = 80;
let currentHeight = 30;

let naws = false;
let ttypeCount = 0;
let telnetState = 0;
let subMode = 0;
let subData = [];

export function resetTelnet() {
  naws = false;
  ttypeCount = 0;
  telnetState = 0;
  subMode = 0;
  subData = [];
}

function encodeIAC(data) {
  const str = [];
  data.forEach((ch) => {
    if (ch === IAC) {
      str.push(IAC);
    }
    str.push(ch);
  });
  return str;
}

function encodeSubNeg(subMode, data) {
  const cmd = [IAC, SB, subMode];
  data = encodeIAC(data);
  data.forEach((ch) => cmd.push(ch));
  cmd.push(IAC);
  cmd.push(SE);
  return cmd;
}

function encodeGMCP(gmcpPackage, data) {
  return encodeSubNeg(
    TELOPT_GMCP,
    Array.from(gmcpPackage + " " + JSON.stringify(data), (char) =>
      char.charCodeAt(0)
    )
  );
}

function encodeNAWS() {
  return encodeSubNeg(TELOPT_NAWS, [
    (currentWidth >> 8) & 0xff,
    currentWidth & 0xff,
    (currentHeight >> 8) & 0xff,
    currentHeight & 0xff,
  ]);
}

export function sendSize(width, height) {
  currentWidth = width;
  currentHeight = height;
  if (naws) {
    socketSend(encodeNAWS());
  }
}

let modes = {};

export function negotiated(option)
{
        return modes[option];
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
    modes[TELOPT_EOR] = WILL;
    socketSend([IAC, DO, TELOPT_EOR]);
    return;
  }
  if (state === WILL && code === TELOPT_GMCP) {
    socketSend([IAC, DO, TELOPT_GMCP]);
    socketSend(
      encodeGMCP("Core.Hello", { client: "Chrysalis", version: "2025.06.01" })
    );
    socketSend(encodeGMCP("Core.Supports.Set", ["Client.Table 1"]));
    return;
  }
}

function indexOfAny(str, chars) {
  for (let i = 0; i < str.length; i++) {
    if (chars.includes(str[i])) {
      return i;
    }
  }
  return -1;
}

function parseGMCP(byteArray) {
  const text = new TextDecoder("utf-8").decode(new Uint8Array(byteArray));

  const splitAt = indexOfAny(text, "[{");

  if (splitAt === -1) {
    return { package: text.trim(), payload: null };
  }

  const packageName = text.slice(0, splitAt).trim();
  const payloadText = text.slice(splitAt).trim();

  let payload;
  try {
    payload = JSON.parse(payloadText);
  } catch (e) {
    console.warn("Failed to parse GMCP payload:", payloadText);
    payload = null;
  }

  return { package: packageName, payload };
}

function handleGMCP(gmcp) {
}

function handleTType(subData) {
  if (subData.length !== 1 || subData[0] !== SEND) {
    return [];
  }

  const cmd = [IAC, SB, TTYPE, IS];

  let name;

  switch (ttypeCount) {
    case 0:
      name = "chrysalis_experimental";
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

function handleSubnegotiation(subMode, subData) {
  try {
    if (subMode === TELOPT_GMCP) {
      handleGMCP(parseGMCP(subData));
      return [];
    }

    if (subMode === TTYPE) {
      return handleTType(subData);
    }
  } catch (e) {
    console.error(e);
    return [];
  }
}

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
