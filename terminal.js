import { htmlescape } from "./utils.js";

const output = document.getElementById("output");
const prompt = document.getElementById("prompt");

let attr = {
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
};

function attrToClassAndStyle(myattr) {
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
    style += attr.fgcol;
  } else {
    if (attr.faint) {
      str = `term_fg${fg}faint`;
    } else if (attr.bold) {
      str = `term_fg${fg}bold`;
    } else {
      str = `term_fg${fg}`;
    }
  }
  if (bg[0] === "#") {
    style = "background-color:";
    style += bg;
  } else {
    str += ` term_bg${bg}`;
  }
  if (attr.ital) {
    str += " term_ital";
  }
  if (attr.und) {
    str += " term_und";
  }
  if (attr.over) {
    str += " term_over";
  }
  if (attr.und2) {
    str += " term_und2";
  }
  if (attr.str) {
    str += " term_str";
  }
  return { class: str, style };
}

function lineToHTML(line) {
  let outLine = "";
  let lastClass = {};

  line.forEach(arg => {
    const cls = arg.cls;
    if (cls.class !== lastClass.class || cls.style !== lastClass.style) {
      if (outLine.length) {
        outLine += "</span>";
      }
      let myattr = "";
      if (cls.class) {
        myattr += `class="${cls.class} "`;
      }
      if (cls.style) {
        myattr += `style="${cls.style} "`;
      }
      outLine += `<span ${myattr}>`;
      lastClass = cls;
    }

    outLine += arg.data;
  });

  return outLine;
}

let outLine = [];
let cr = false;

function handleChar(data) {
  if (data === "\r") {
    cr = true;
  } else if (data === "\n") {
    output.innerHTML += lineToHTML(outLine);
    output.innerHTML += "<br />";
    outLine = [];
    cr = false;
  } else {
    if (cr) {
      outLine = [];
      cr = false;
    }

    const cls = attrToClassAndStyle(attr);

    if (data === " ") data = "&nbsp;";
    if (data === "<") data = "&lt;";
    if (data === ">") data = "&gt;";
    if (data === "&") data = "&amp;";

    outLine.push({ cls, data });
  }
}

function handlePrompt() {
  prompt.innerHTML = lineToHTML(outLine);
  outLine = [];
}

export function appendCommand(command, echo) {
  if (echo) {
    output.innerHTML += prompt.innerHTML;
    output.innerHTML += htmlescape(command);
    output.innerHTML += "<br />";
  }
  prompt.innerHTML = "";
}

function get256(code) {
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

  const intensities = ["00", "5f", "87", "af", "d7", "ff"]; // per xterm

  code = parseInt(code, 10);
  if (code >= 16 && code < 232) {
    code -= 16;
    const b = code % 6;
    const g = Math.floor(code / 6) % 6;
    const r = Math.floor(code / 36) % 6;
    return "#"
      .concat(intensities[r])
      .concat(intensities[g])
      .concat(intensities[b]);
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

    code = greyCodes[code];

    return "#"
      .concat(code)
      .concat(code)
      .concat(code);
  }

  return "#f8f";
}

const defattr = Object.assign({}, attr);

function handleColorCommand(commands) {
  for (let idx = 0; idx < commands.length; idx += 1) {
    const cmd = commands[idx];
    switch (cmd) {
      case "":
      case "0":
        attr = Object.assign({}, defattr);
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
        attr.fgcol = get256(commands[idx + 2]);
        idx += 2;
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
        attr.bgcol = get256(commands[idx + 2]);
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

function handleEscape(str, code) {
  if (code === "m" && str[0] === "[") {
    let commands = str.substr(1).split(";");
    if (commands.length === 0) {
      commands = [0];
    }
    handleColorCommand(commands);
  }
}

let esc = false;
let escStr = "";

const ESC = "\x1B";
const CSI = "\x9B";

function isLetter(str) {
  return str.length === 1 && str.match(/[a-z]/i);
}

export function handleUnicode(data) {
  if (data === undefined) {
    handlePrompt();
    return;
  }

  if (esc) {
    if (isLetter(data)) {
      handleEscape(escStr, data);
      esc = false;
      escStr = "";
    }
    escStr += data;
    return;
  }

  if (data === ESC) {
    esc = true;
    escStr = "";
    return;
  }

  if (data === CSI) {
    esc = true;
    escStr = "[";
    return;
  }

  handleChar(data);
}

let utf8fragment = "";

export function handleTerminal(data) {
  if (data === undefined) {
    handleUnicode(undefined);
    return;
  }
  if (data >= 0 && data <= 0x7f) {
    handleUnicode(String.fromCharCode(data));
    return;
  }
  utf8fragment += String.fromCharCode(data);
  try { 
    const decoded = utf8.decode(utf8fragment);
    utf8fragment = "";
    handleUnicode(decoded);
  } catch (err) {
    // do nothing
  }
}
