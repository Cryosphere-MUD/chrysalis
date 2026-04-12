import { sendCommand, setEditText } from "./command.js";
import { negotiated } from "./telnet.js";
import { TELOPT_EOR } from "./telnetconstants.js";

const ESC = "\x1B";
const CSI = "\x9B";
const BEL = "\x07";
const OSC = "]";
const OSC_ESC = "]\x1b";

interface Attributes
{
  fgcol: string;
  bgcol: string;
  inv: boolean;
  hide: boolean;
  faint: boolean;
  bold: boolean;
  prop: boolean;
  ital: boolean;
  und: boolean;
  over: boolean;
  und2: boolean;
  str: boolean;
  url: string | null;
  lang?: string | undefined;
}

const defattr = {
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
      url: null};

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

interface Class { class: string; style: string; url: string | null; lang: string | undefined; };

interface Line { cls: Class; data: string; isIndentMarker?: boolean; }

export class Terminal {
  output: HTMLElement;
  prompt: HTMLElement;
  attr: Attributes;
  defattr: Attributes;
  outLine: Line[];
  cr: boolean;
  outputBatch: HTMLElement[];
  gotIndentMarker: boolean;
  promptLine: any;
  mode: string | number;
  escStr: string;
  utf8fragment: string;
  constructor() {
    this.output = document.getElementById("output")!;
    this.prompt = document.getElementById("prompt")!;
    this.attr = {
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
      url: null};

    this.defattr = Object.assign({}, this.attr);

    this.outLine = [];
    this.cr = false;
    this.outputBatch = [];

    this.gotIndentMarker = false;

    this.promptLine;

    this.mode = 0;
    this.escStr = "";

    this.utf8fragment = "";
  }

  resetANSIState() {
    this.outLine = [];
    this.cr = false;
    this.outputBatch = [];
    this.gotIndentMarker = false;
    this.promptLine = false;
    this.mode = 0;
    this.escStr = "";
  }

  outputData(data: any) {
    if (data == null) {
      return;
    }
    this.outputBatch.push(data);
  }

  renderOutputData() {
    if (this.outputBatch.length == 0)
        return false;
    const frag = document.createDocumentFragment();
    for (let line of this.outputBatch) {
      frag.append(line);
    }
    this.output.appendChild(frag);
    this.outputBatch = [];
    return true;
  }

  injectText(text: string[]) {
    this.outputData(text);
    this.outputData(document.createElement("br"));
    this.renderOutputData();
  }

  handleChar(data: string) {
    if (data === "\r") {
      this.cr = true;
    } else if (data === "\n") {
      if (this.outLine.length) {
        this.outputData(lineToElements(this.outLine));
      }
      this.outputData(document.createElement("br"));
      this.outLine = [];
      this.cr = false;
    } else {
      if (this.cr) {
        this.outLine = [];
        this.cr = false;
      }

      const cls = attrToClassAndStyle(this.attr);

      if (this.gotIndentMarker) {
        this.outLine.push({ cls, data, isIndentMarker: this.gotIndentMarker });
        this.gotIndentMarker = false;
      } else this.outLine.push({ cls, data });
    }
  }

  handleEscape(str: string, code: string) {
    if (code === "m" && str[0] === "[") {
      let commands = str.slice(1).split(";");
      if (commands.length === 0) {
        commands = ["0"];
      }
      handleColorCommand(commands, this.attr, this.defattr);
    }
    if (code == "z" && str[0] === "{") {
      this.gotIndentMarker = true;
    }
  }

  handleANSI(data?: string, charHandler?: (data: string, attr: Attributes) => void) {
    if (data === undefined) {
      this.handlePrompt();
      return;
    }

    if (this.mode == OSC_ESC) {
      if (data == "\\") {
        this.handleOsc(this.escStr);
        this.escStr = "";
        this.mode = 0;
        return;
      }
      this.mode = 0;
      return;
    }

    if (this.mode == OSC) {
      if (data == ESC) {
        this.mode = OSC_ESC;
        return;
      }
      if (data == BEL) {
        this.handleOsc(this.escStr);
        this.escStr = "";
        this.mode = 0;
        return;
      }
      this.escStr += data;
      return;
    }

    if (this.mode == CSI) {
      if (isLetter(data)) {
        this.handleEscape(this.escStr, data);
        this.mode = 0;
        this.escStr = "";
      }
      this.escStr += data;
      return;
    }

    if (this.mode == ESC) {
      if (data == OSC) {
        this.mode = OSC;
        this.escStr = "";
        return;
      }
      if (data == "[") {
        this.mode = CSI;
      }
      this.escStr += data;
      return;
    }

    if (data === ESC) {
      this.mode = ESC;
      this.escStr = "";
      return;
    }

    if (data === CSI) {
      this.mode = ESC;
      this.escStr = "[";
      return;
    }

    if (charHandler)
      charHandler(data, this.attr);
    else
      this.handleChar(data);
  }

  handleTerminal(data?: any) {
    if (data === undefined) {
      this.handleANSI(undefined);
      return;
    }
    if (data >= 0 && data <= 0x7f) {
      this.handleANSI(String.fromCharCode(data));
      return;
    }
    this.utf8fragment += String.fromCharCode(data);
    try {
      const decoded = utf8.decode(this.utf8fragment);
      this.utf8fragment = "";
      this.handleANSI(decoded);
    } catch (err) {
      // do nothing
    }
  }

  handlePrompt() {
    if (!negotiated(TELOPT_EOR))
      while (this.prompt.firstChild)
        this.output.appendChild(this.prompt.firstChild);

    this.promptLine = this.outLine;
    const promptElements = lineToElements(this.outLine);
    if (promptElements)
      this.prompt.replaceChildren(promptElements);
    else
      this.prompt.innerHTML = "";
    this.outLine = [];
  }

  appendCommand(command: string, echo: boolean) {
    this.outputData(lineToElements(this.promptLine));
    if (echo) {
      this.outputData(command);
      this.outputData(document.createElement("br"));
      this.renderOutputData();
    }
    this.prompt.replaceChildren();
    scrollToEnd()
  }

  handleOsc(oscstr: string) {
    let commands = oscstr.slice(0).split(";");
    if (commands[0] == "0" || commands[0] == "2") document.title = commands[1]!;

    if (commands[0] == "8") {
      if (commands[2] === "" || willHandleURL(commands[2]!)) {
        this.attr.url = commands[2]!;
      }
    }

    if (commands[0] == "639") {
      this.attr.lang = commands[1]!;
    }
  }


};

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
  return false;
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
    terminal.appendCommand(command, true);
    return;
  }
  if (value.startsWith("https://") || value.startsWith("http://")) {
    window.open(value, "_blank");
  }
}

function lineToElements(line: Line[]) {

  let outItem: any = document.createDocumentFragment();
  let lastClass: Class = {class: "", style :"", url : "", lang: ""};

  let workingLine = outItem;

  let currentSpan: any;

  let indent : number | null;

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

    currentSpan.innerText += arg.data;
  });

  if (currentSpan) {
    workingLine.appendChild(currentSpan);
    return outItem;
  }
  return;
}

const main = document.getElementById("main")!;

export function scrollToEnd() {
  main.scrollTop = main.scrollHeight;
}

function gettruecolor(r: string, g: string, b: string) {
  let col =
    "#" +
    [r, g, b].map((x) => parseInt(x).toString(16).padStart(2, "0")).join("");
  return col;
}

function get256(stringcode: string) {
  const intensities = ["00", "5f", "87", "af", "d7", "ff"]; // per xterm

  let code = parseInt(stringcode, 10);

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
    return colors[code]!;
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

    const grey = greyCodes[code]!;

    return "#".concat(grey).concat(grey).concat(grey);
  }

  return "#f8f";
}

function handleColorCommand(commands: string[], attr: Attributes, defattr: Attributes) {
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
          attr.fgcol = get256(commands[idx + 2]!);
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
          attr.bgcol = get256(commands[idx + 2]!);
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

function isLetter(str: string) {
  return str.length === 1 && str.match(/[a-z]/i);
}

export function parseANSI(text: string) {
  const attr = Object.assign({}, defattr);

  let parsedText = "";

  let buffer: any[] = [];

  const localTerm = new Terminal();

  let handler = (data: string, attr: Attributes) => {
    const cls = attrToClassAndStyle(attr);
    buffer.push({ cls, data });
    parsedText += data;
  };

  Array.from(text).forEach((ch) => {
    localTerm.handleANSI(ch, handler);
  });

  if (buffer.length == 0) return document.createDocumentFragment();

  return lineToElements(buffer);
}

export const terminal = new Terminal();
