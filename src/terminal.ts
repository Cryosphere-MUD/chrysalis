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
  url: null,
  lang: "",
};

type Line = LineElement[];

class ANSIParser {
  attr: Attributes;
  outLine: Line;
  cr: boolean;
  outputBatch: Element[];
  promptLine: Line;
  gotIndentMarker: boolean;
  mode: number | string;
  escStr: string;
  utf8fragment: string;

  constructor() {
    this.attr = Object.assign({}, defattr);
    this.outLine = [];
    this.cr = false;
    this.outputBatch = [];
    this.gotIndentMarker = false;
    this.promptLine = [];
    this.mode = 0;
    this.escStr = "";
    this.utf8fragment = "";
  }

  handleColorCommand(commands: string[]) {
    for (let idx = 0; idx < commands.length; idx += 1) {
      const cmd = commands[idx];
      switch (cmd) {
        case "":
        case "0":
          let oldprop = this.attr.prop;
          let oldlang = this.attr.lang;
          this.attr = Object.assign({}, defattr);
          this.attr.prop = oldprop;
          this.attr.lang = oldlang;
          break;
        case "1":
          this.attr.bold = true;
          break;
        case "2":
          this.attr.faint = true;
          break;
        case "3":
          this.attr.ital = true;
          break;
        case "9":
          this.attr.str = true;
          break;
        case "4":
          this.attr.und = true;
          break;
        case "7":
          this.attr.inv = true;
          break;
        case "8":
          this.attr.hide = true;
          break;
        case "21":
          this.attr.und2 = true;
          break;
        case "22":
          this.attr.bold = false;
          this.attr.faint = false;
          break;
        case "23":
          this.attr.ital = false;
          break;
        case "24":
          this.attr.und = false;
          break;
        case "27":
          this.attr.inv = false;
          break;
        case "28":
          this.attr.hide = false;
          break;
        case "29":
          this.attr.str = false;
          break;
        case "30":
          this.attr.fgcol = "black";
          break;
        case "31":
          this.attr.fgcol = "red";
          break;
        case "32":
          this.attr.fgcol = "green";
          break;
        case "33":
          this.attr.fgcol = "yellow";
          break;
        case "34":
          this.attr.fgcol = "blue";
          break;
        case "35":
          this.attr.fgcol = "magenta";
          break;
        case "36":
          this.attr.fgcol = "cyan";
          break;
        case "37":
          this.attr.fgcol = "white";
          break;
        case "38":
          if (commands[idx + 1] == "2") {
            this.attr.fgcol = gettruecolor(
              commands[idx + 2]!,
              commands[idx + 3]!,
              commands[idx + 4]!
            );
            idx += 4;
          }
          if (commands[idx + 1] == "5") {
            this.attr.fgcol = get256(commands[idx + 2]!)!;
            idx += 2;
          }
          break;
        case "39":
          this.attr.fgcol = "white";
          break;
        case "40":
          this.attr.bgcol = "black";
          break;
        case "41":
          this.attr.bgcol = "red";
          break;
        case "42":
          this.attr.bgcol = "green";
          break;
        case "43":
          this.attr.bgcol = "yellow";
          break;
        case "44":
          this.attr.bgcol = "blue";
          break;
        case "45":
          this.attr.bgcol = "magenta";
          break;
        case "46":
          this.attr.bgcol = "cyan";
          break;
        case "47":
          this.attr.bgcol = "white";
          break;
        case "48":
          if (commands[idx + 1] == "2") {
            this.attr.bgcol = gettruecolor(
              commands[idx + 2]!,
              commands[idx + 3]!,
              commands[idx + 4]!
            );
            idx += 4;
          }
          if (commands[idx + 1] == "5") {
            this.attr.bgcol = get256(commands[idx + 2]!)!;
          }
          idx += 2;
          break;
        case "49":
          this.attr.bgcol = "black";
          break;
        case "53":
          this.attr.over = true;
          break;
        case "55":
          this.attr.over = false;
          break;
        default:
          console.log("unknown ANSI code", cmd);
      }
    }
  }

  handleEscape(str: string, code: string) {
    if (code === "m" && str[0] === "[") {
      let commands = str.slice(1).split(";");
      if (commands.length === 0) {
        commands = ["0"];
      }
      this.handleColorCommand(commands);
    }
    if (code == "z" && str[0] === "{") {
      this.gotIndentMarker = true;
    }
  }

  handleOsc(oscstr: string) {
    let commands = oscstr.slice(0).split(";");
    if (commands[0] == "0" || commands[0] == "2")
      document.title = commands[1]!;

    if (commands[0] == "8") {
      if (commands[2] === "" || willHandleURL(commands[2]!)) {
        this.attr.url = commands[2]!;
      }
    }

    if (commands[0] == "639") {
      this.attr.lang = commands[1]!;
    }
  }

  handleANSI(data: string | undefined, charHandler?: (data: string, attr: Attributes)=>void) {
    if (data === undefined) {
      terminal.handlePrompt();
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
      this.handleChar(data, this.attr);
  }

  handleTerminal(data: number | undefined = undefined) {
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

  resetANSIState() {
    this.outLine = [];
    this.cr = false;
    this.outputBatch = [];
    this.gotIndentMarker = false;
    this.promptLine = [];
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
    output.appendChild(frag);
    this.outputBatch = [];
    return true;
  }

  handleChar(data: string, attr: Attributes) {
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

      const cls = attrToClassAndStyle(attr);

      if (this.gotIndentMarker) {
        this.outLine.push({ cls, data, isIndentMarker: this.gotIndentMarker });
        this.gotIndentMarker = false;
      } else this.outLine.push({ cls, data });
    }
  }

  handlePrompt() {
    if (!negotiated(TELOPT_EOR))
      while (prompt.firstChild)
        output.appendChild(prompt.firstChild);

    this.promptLine = this.outLine;
    const promptElements = lineToElements(this.outLine);
    if (promptElements)
      prompt.replaceChildren(promptElements);
    else
      prompt.innerHTML = "";
    this.outLine = [];
  }

  appendCommand(command: string, echo: boolean) {
    this.outputData(lineToElements(this.promptLine));
    if (echo) {
      this.outputData(command);
      this.outputData(document.createElement("br"));
      this.renderOutputData();
    }
    prompt.replaceChildren();
    scrollToEnd()
  }

};


interface LineElement {
  isIndentMarker?: boolean;
  cls: any;
  data: any;
}

interface Attributes {
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
    terminal.appendCommand(command, true);
    return;
  }
  if (value.startsWith("https://") || value.startsWith("http://")) {
    window.open(value, "_blank");
  }
}

function lineToElements(line: Line) {
  if (!line)
    return;

  let outItem: DocumentFragment | HTMLSpanElement = document.createDocumentFragment();
  let lastClass: any = {};

  let workingLine: DocumentFragment | HTMLSpanElement = outItem;

  let currentSpan: HTMLSpanElement | null = null;

  let indent: number;

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



export function scrollToEnd() {
  main.scrollTop = main.scrollHeight;
}

export function injectText(text: string[]) {
  terminal.outputData(text);
  terminal.outputData(document.createElement("br"));
  terminal.renderOutputData();
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

function isLetter(str: string) {
  return str.length === 1 && str.match(/[a-z]/i);
}

export function parseANSI(text: string) {
  let parser = new ANSIParser();

  let parsedText = "";

  let buffer: Line = [];

  let handler = (data: any, attr: Attributes) => {
    const cls = attrToClassAndStyle(attr);
    buffer.push({ cls, data });
    parsedText += data;
  };

  Array.from(text).forEach((ch) => {
    parser.handleANSI(ch, handler);
  });

  if (buffer.length == 0) return document.createDocumentFragment();

  return lineToElements(buffer);
}

export let terminal = new ANSIParser();