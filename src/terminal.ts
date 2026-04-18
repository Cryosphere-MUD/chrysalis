import { sendCommand, setEditText } from "./command.js";
import { negotiated } from "./telnet.js";
import { TELOPT_EOR } from "./telnetconstants.js";

const ESC = "\x1B";
const CSI = "\x9B";
const BEL = "\x07";
const OSC = "]";
const OSC_ESC = "]\x1b";

const main = document.getElementById("main")!;
const output = document.getElementById("output")!;
const prompt = document.getElementById("prompt")!;

let attr : Attributes = {
  bold: false,
  faint: false,
  fgcol: "white",
  bgcol: "black",
  ital: false,
  und: false,
  und2: false,
  over: false,
  inv: false,
  str: false,
  hide: false,
  prop: false,
  url: null,
  lang: "",
};

const defattr = Object.assign({}, attr);

interface LineElement {  
  isIndentMarker?: boolean;
  cls: any;
  data: any;
}

type Line = LineElement[];

let outLine: Line = [];
let cr = false;
let outputBatch: Element[] = [];

let lastData;

let gotIndentMarker = false;

let promptLine: Line;

let mode : number | string = 0;
let escStr = "";

let utf8fragment = "";

export function resetANSIState() {
  outLine = [];
  cr = false;
  outputBatch = [];
  lastData = undefined;
  gotIndentMarker = false;
  promptLine = [];
  mode = 0;
  escStr = "";
}

interface Attributes
{
  fgcol: string;
  bgcol: string;
  hide: boolean;
  inv: boolean;
  faint: boolean;
  prop: boolean;
  bold: boolean;
  ital: boolean;
  over: boolean;
  und: boolean;
  und2: boolean;
  str: boolean;
  url: string | null;
  lang: string;
};

function attrToClassAndStyle(myattr: Attributes) {
  let str = "";
  let style = "";
  let fg = myattr.fgcol;
  let bg = myattr.bgcol;
  if (myattr.inv) {
    fg = myattr.bgcol;
    bg = myattr.fgcol;
  }
  if (myattr.hide) {
    fg = bg;
  }

  if (fg[0] === "#") {
    style = "color:";
    style += fg;
  } else {
    if (myattr.faint) {
      str = `term_fg${fg}faint`;
    } else if (myattr.bold) {
      str = `term_fg${fg}bold`;
    } else {
      str = `term_fg${fg}`;
    }
  }

  if (bg[0] === "#") {
    if (style.length)
      style += ";";
    
    style += "background-color:";
    style += bg;
  } else {
    str += ` term_bg${bg}`;
  }

  if (myattr.prop) {
    str += " term_prop";
  }
  if (myattr.ital) {
    str += " term_ital";
  }
  if (myattr.und) {
    str += " term_und";
  }
  if (myattr.over) {
    str += " term_over";
  }
  if (myattr.und2) {
    str += " term_und2";
  }
  if (myattr.str) {
    str += " term_str";
  }
  if (myattr.url) {
    str += " link";
  }
  return { class: str, style, url: myattr.url, lang: myattr.lang };
}

function makeCallback(callback: any, param: any) {
  return function () {
    callback(param);
  };
}

function willHandleURL(value: string) {
  if (value.startsWith("prompt:")) return true;
  if (value.startsWith("send:")) return true;
  if (value.startsWith("https://")) return true;
  if (value.startsWith("http://")) return true;
}

function handleURLClick(value: string) {
  if (value.startsWith("prompt:")) {
    let command = decodeURIComponent(value.slice(7));
    setEditText(command);
    return;
  }
  if (value.startsWith("send:")) {
    let command = decodeURIComponent(value.slice(5));
    sendCommand(command);
    appendCommand(command, true);
    return;
  }
  if (value.startsWith("https://") || value.startsWith("http://")) {
    window.open(value, "_blank");
  }
}

function lineToElements(line: Line) {
  if (!line)
        return;

  let outItem : DocumentFragment | HTMLSpanElement = document.createDocumentFragment();
  let lastClass: any = {};

  let workingLine : DocumentFragment | HTMLSpanElement = outItem;

  let currentSpan : HTMLSpanElement | null = null;

  let indent : number;

  line.forEach((arg, pos) => {
    if (arg.isIndentMarker && indent == null) {
      indent = pos;
      workingLine = document.createElement("span");
      workingLine.setAttribute("class", "indent_" + (pos - 1));
      outItem.appendChild(workingLine);
    }
  });

  line.forEach((arg) => {
    const cls = arg.cls;

    if (
      cls.class !== lastClass.class ||
      cls.style !== lastClass.style ||
      cls.url !== lastClass.url ||
      cls.lang !== lastClass.lang
    ) {
      if (currentSpan) {
        workingLine.appendChild(currentSpan);
      }

      currentSpan = document.createElement("span");
      if (cls.url != null) {
        currentSpan.addEventListener(
          "click",
          makeCallback(handleURLClick, cls.url)
        );
        currentSpan.setAttribute("title", cls.url);
      }

      if (cls.class) currentSpan.setAttribute("class", cls.class);
      if (cls.style) currentSpan.setAttribute("style", cls.style);
      if (cls.lang) currentSpan.setAttribute("lang", cls.lang);

      lastClass = cls;
    }

    if (currentSpan)
      currentSpan.innerText += arg.data;
  });

  if (currentSpan) {
    workingLine.appendChild(currentSpan);
    return outItem;
  }
  return;
}

function outputData(data: any) {
  if (data == null) {
    return;
  }
  outputBatch.push(data);
}

export function renderOutputData() {
  if (outputBatch.length == 0)
        return false;
  const frag = document.createDocumentFragment();
  for (let line of outputBatch) {
    frag.append(line);
  }
  output.appendChild(frag);
  outputBatch = [];
  return true;
}

function handleChar(data: string, attr: Attributes) {
  if (data === "\r") {
    cr = true;
  } else if (data === "\n") {
    if (outLine.length) {
      outputData(lineToElements(outLine));
    }
    outputData(document.createElement("br"));
    outLine = [];
    cr = false;
  } else {
    if (cr) {
      outLine = [];
      cr = false;
    }

    const cls = attrToClassAndStyle(attr);

    if (gotIndentMarker) {
      outLine.push({ cls, data, isIndentMarker: gotIndentMarker });
      gotIndentMarker = false;
    } else outLine.push({ cls, data });
  }
}

function handlePrompt() {
  if (!negotiated(TELOPT_EOR))
    while (prompt.firstChild)
      output.appendChild(prompt.firstChild);

  promptLine = outLine;
  const promptElements = lineToElements(outLine);
  if (promptElements)
        prompt.replaceChildren(promptElements);
  else
        prompt.innerHTML = "";
  outLine = [];
}

export function appendCommand(command: string, echo: boolean) {
  outputData(lineToElements(promptLine));
  if (echo) {
    outputData(command);
    outputData(document.createElement("br"));
    renderOutputData();
  }
  prompt.replaceChildren();
  scrollToEnd()
}

export function scrollToEnd() {
  main.scrollTop = main.scrollHeight;
}

export function injectText(text: string[]) {
  outputData(text);
  outputData(document.createElement("br"));
  renderOutputData();
}

function gettruecolor(r: string, g: string, b: string) {
  let col =
    "#" +
    [r, g, b].map((x: string) => parseInt(x).toString(16).padStart(2, "0")).join("");
  return col;
}

function get256(arg: string) {
  const intensities = ["00", "5f", "87", "af", "d7", "ff"]; // per xterm

  let code = parseInt(arg, 10);

  if (code < 16) {
    const colors = [
      "black",
      "red",
      "green",
      "yellow",
      "blue",
      "magenta",
      "cyan",
      "white",
      "grey",
      "redbold",
      "greenbold",
      "yellowbold",
      "bluebold",
      "magentabold",
      "cyanbold",
      "whitebold",
    ];
    return colors[code];
  }

  if (code >= 16 && code < 232) {
    code -= 16;
    const b = code % 6;
    const g = Math.floor(code / 6) % 6;
    const r = Math.floor(code / 36) % 6;
    return "#"
      .concat(intensities[r]!)
      .concat(intensities[g]!)
      .concat(intensities[b]!);
  }
  if (code >= 233 && code < 256) {
    const greyCodes = [
      "08",
      "12",
      "1C",
      "26",
      "30",
      "3A",
      "44",
      "4E",
      "58",
      "62",
      "6c",
      "76",
      "80",
      "8a",
      "94",
      "9e",
      "a8",
      "b2",
      "bc",
      "c6",
      "d0",
      "da",
      "e4",
      "ee",
    ]; // per xterm again

    code -= 233;

    let part = greyCodes[code]!;

    return "#".concat(part).concat(part).concat(part);
  }

  return "#f8f";
}

function handleColorCommand(commands: string[]) {
  for (let idx = 0; idx < commands.length; idx += 1) {
    const cmd = commands[idx];
    switch (cmd) {
      case "":
      case "0":
        let oldprop = attr.prop;
        let oldlang = attr.lang;
        attr = Object.assign({}, defattr);
        attr.prop = oldprop;
        attr.lang = oldlang;
        break;
      case "1":
        attr.bold = true;
        break;
      case "2":
        attr.faint = true;
        break;
      case "3":
        attr.ital = true;
        break;
      case "9":
        attr.str = true;
        break;
      case "4":
        attr.und = true;
        break;
      case "7":
        attr.inv = true;
        break;
      case "8":
        attr.hide = true;
        break;
      case "21":
        attr.und2 = true;
        break;
      case "22":
        attr.bold = false;
        attr.faint = false;
        break;
      case "23":
        attr.ital = false;
        break;
      case "24":
        attr.und = false;
        break;
      case "27":
        attr.inv = false;
        break;
      case "28":
        attr.hide = false;
        break;
      case "29":
        attr.str = false;
        break;
      case "30":
        attr.fgcol = "black";
        break;
      case "31":
        attr.fgcol = "red";
        break;
      case "32":
        attr.fgcol = "green";
        break;
      case "33":
        attr.fgcol = "yellow";
        break;
      case "34":
        attr.fgcol = "blue";
        break;
      case "35":
        attr.fgcol = "magenta";
        break;
      case "36":
        attr.fgcol = "cyan";
        break;
      case "37":
        attr.fgcol = "white";
        break;
      case "38":
        if (commands[idx + 1] == "2") {
          attr.fgcol = gettruecolor(
            commands[idx + 2]!,
            commands[idx + 3]!,
            commands[idx + 4]!
          );
          idx += 4;
        }
        if (commands[idx + 1] == "5") {
          attr.fgcol = get256(commands[idx + 2]!)!;
          idx += 2;
        }
        break;
      case "39":
        attr.fgcol = "white";
        break;
      case "40":
        attr.bgcol = "black";
        break;
      case "41":
        attr.bgcol = "red";
        break;
      case "42":
        attr.bgcol = "green";
        break;
      case "43":
        attr.bgcol = "yellow";
        break;
      case "44":
        attr.bgcol = "blue";
        break;
      case "45":
        attr.bgcol = "magenta";
        break;
      case "46":
        attr.bgcol = "cyan";
        break;
      case "47":
        attr.bgcol = "white";
        break;
      case "48":
        if (commands[idx + 1] == "2") {
          attr.bgcol = gettruecolor(
            commands[idx + 2]!,
            commands[idx + 3]!,
            commands[idx + 4]!
          );
          idx += 4;
        }
        if (commands[idx + 1] == "5") {
          attr.bgcol = get256(commands[idx + 2]!)!;
        }
        idx += 2;
        break;
      case "49":
        attr.bgcol = "black";
        break;
      case "53":
        attr.over = true;
        break;
      case "55":
        attr.over = false;
        break;
      default:
        console.log("unknown ANSI code", cmd);
    }
  }
}

function handleEscape(str: string, code: string) {
  if (code === "m" && str[0] === "[") {
    let commands = str.slice(1).split(";");
    if (commands.length === 0) {
      commands = ["0"];
    }
    handleColorCommand(commands);
  }
  if (code == "z" && str[0] === "{") {
    gotIndentMarker = true;
  }
}

function isLetter(str: string) {
  return str.length === 1 && str.match(/[a-z]/i);
}

function handleOsc(oscstr: string) {
  let commands = oscstr.slice(0).split(";");
  if (commands[0] == "0" || commands[0] == "2")
    document.title = commands[1]!;

  if (commands[0] == "8") {
    if (commands[2] === "" || willHandleURL(commands[2]!)) {
      attr.url = commands[2]!;
    }
  }

  if (commands[0] == "639") {
    attr.lang = commands[1]!;
  }
}

export function handleANSI(data : string | undefined, charHandler = handleChar) {
  if (data === undefined) {
    handlePrompt();
    return;
  }

  if (mode == OSC_ESC) {
    if (data == "\\") {
      handleOsc(escStr);
      escStr = "";
      mode = 0;
      return;
    }
    mode = 0;
    return;
  }

  if (mode == OSC) {
    if (data == ESC) {
      mode = OSC_ESC;
      return;
    }
    if (data == BEL) {
      handleOsc(escStr);
      escStr = "";
      mode = 0;
      return;
    }
    escStr += data;
    return;
  }

  if (mode == CSI) {
    if (isLetter(data)) {
      handleEscape(escStr, data);
      mode = 0;
      escStr = "";
    }
    escStr += data;
    return;
  }

  if (mode == ESC) {
    if (data == OSC) {
      mode = OSC;
      escStr = "";
      return;
    }
    if (data == "[") {
      mode = CSI;
    }
    escStr += data;
    return;
  }

  if (data === ESC) {
    mode = ESC;
    escStr = "";
    return;
  }

  if (data === CSI) {
    mode = ESC;
    escStr = "[";
    return;
  }

  charHandler(data, attr);
}

export function handleTerminal(data : number | undefined = undefined) {
  if (data === undefined) {
    handleANSI(undefined);
    return;
  }
  if (data >= 0 && data <= 0x7f) {
    handleANSI(String.fromCharCode(data));
    return;
  }
  utf8fragment += String.fromCharCode(data);
  try {
    const decoded = utf8.decode(utf8fragment);
    utf8fragment = "";
    handleANSI(decoded);
  } catch (err) {
    // do nothing
  }
}

export function parseANSI(text: string) {
  const origattr = Object.assign({}, attr);
  attr = Object.assign({}, defattr);

  let parsedText = "";

  let buffer: Line = [];

  let handler = (data: any, attr: Attributes) => {
    const cls = attrToClassAndStyle(attr);
    buffer.push({ cls, data });
    parsedText += data;
  };

  Array.from(text).forEach((ch) => {
    handleANSI(ch, handler);
  });

  if (buffer.length == 0) return document.createDocumentFragment();

  attr = Object.assign({}, origattr);

  return lineToElements(buffer);
}
