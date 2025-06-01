import { sendCommand, setEditText } from "./command.js";

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
  prop: false,
  url: null,
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
    style += myattr.fgcol;
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
    style = "background-color:";
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
  return { class: str, style, url: myattr.url };
}

function makeCallback(callback, param) {
  return function () {
    callback(param);
  };
}

function willHandleURL(value)
{
        if (value.startsWith("prompt:")) return true;
        if (value.startsWith("send:")) return true;
        if (value.startsWith("https://")) return true;
        if (value.startsWith("http://")) return true;
}

function handleURLClick(value) {
  if (value.startsWith("prompt:")) {
    let command = decodeURIComponent(value.substring(7));
    setEditText(command);
    return;
  }
  if (value.startsWith("send:")) {
    let command = decodeURIComponent(value.substring(5));
    sendCommand(command);
    appendCommand(command, true);
    return;
  }
  if (value.startsWith("https://") || value.startsWith("http://")) {
    window.open(value, "_blank");
  }
}

function lineToElements(line) {
  let outItem = document.createDocumentFragment();
  let lastClass = {};

  let workingLine = outItem;

  let currentSpan;

  let indent;

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
      cls.url !== lastClass.url
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

let outLine = [];
let cr = false;
let outputBatch = [];

function outputData(data) {
  if (data == null) {
    return;
  }
  outputBatch.push(data);
}

export function renderOutputData() {
  const frag = document.createDocumentFragment();
  for (let line of outputBatch) {
    frag.append(line);
  }
  output.appendChild(frag);
  outputBatch = [];
}

let lastData;

let gotIndentMarker = false;

function handleChar(data) {
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

let promptLine;

function handlePrompt() {
  promptLine = outLine;
  let promptElements = lineToElements(outLine);
  prompt.replaceChildren(promptElements);
  outLine = [];
}

export function appendCommand(command, echo) {
  if (echo) {
    outputData(lineToElements(promptLine));
    outputData(command);
    outputData(document.createElement("br"));
    renderOutputData();
  }
  prompt.replaceChildren();
}

function gettruecolor(r, g, b) {
  let col =
    "#" +
    [r, g, b].map((x) => parseInt(x).toString(16).padStart(2, "0")).join("");
  return col;
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

    return "#".concat(code).concat(code).concat(code);
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
        let oldprop = attr.prop;
        attr = Object.assign({}, defattr);
        attr.prop = oldprop;
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
            commands[idx + 2],
            commands[idx + 3],
            commands[idx + 4]
          );
          idx += 4;
        }
        if (commands[idx + 1] == "5") {
          attr.fgcol = get256(commands[idx + 2]);
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
            commands[idx + 2],
            commands[idx + 3],
            commands[idx + 4]
          );
          idx += 4;
        }
        if (commands[idx + 1] == "5") {
          attr.bgcol = get256(commands[idx + 2]);
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

function handleEscape(str, code) {
  if (code === "m" && str[0] === "[") {
    let commands = str.substr(1).split(";");
    if (commands.length === 0) {
      commands = [0];
    }
    handleColorCommand(commands);
  }
  if (code == "z" && str[0] === "{") {
    gotIndentMarker = true;
  }
}

let mode = 0;
let escStr = "";

const ESC = "\x1B";
const CSI = "\x9B";
const BEL = "\x07";
const OSC = "]";
const OSC_ESC = "]\x1b";

function isLetter(str) {
  return str.length === 1 && str.match(/[a-z]/i);
}

function handleOsc(oscstr) {
  let commands = oscstr.substr(0).split(";");
  if (commands[0] == "0" || commands[0] == "2") document.title = commands[1];

  if (commands[0] == "8") {
    if (commands[2] === "") || willHandleURL(commands[2]) {
        attr.url = commands[2];
    }
  }
}

export function handleANSI(data, charHandler=handleChar) {
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

let utf8fragment = "";

export function handleTerminal(data) {
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

function parseANSI(text)
{
        const origattr = Object.assign({}, attr);
        attr = Object.assign({}, defattr);

        let parsedText = "";

        let buffer = [];

        let handler = (data, attr) => {
                const cls = attrToClassAndStyle(attr);
                buffer.push({ cls, data });
                parsedText += data;
        }

        Array.from(text).forEach(ch => 
        {
                handleANSI(ch, handler);
        });

        if (buffer.length == 0)
                return document.createDocumentFragment();

        attr = Object.assign({}, origattr);

        return lineToElements(buffer);
}

export function handleTable(data)
{
        let table = document.createElement("table");
        table.classList.add("gmcp-table");
        console.log("handleTable", data);

        let headerRow = document.createElement("tr");

        let columns = 0;

        let columnsRight = [];        

        data.header.forEach((cell, idx) => {
                let newCell = document.createElement("th");
                newCell.innerText = cell["text"];
                headerRow.appendChild(newCell);
                if (cell["align"] === "right")
                        columnsRight.push(idx);
                columns = idx + 1;
        });

        if (data.topnote) {
                const topRow = document.createElement("tr");
                topRow.classList.add("topnote-row");
            
                const topCell = document.createElement("td");
                topCell.colSpan = columns;  // Match number of columns
                topCell.replaceChildren(parseANSI(data.topnote));
                topCell.classList.add("topnote");
            
                topRow.appendChild(topCell);
                table.appendChild(topRow);  // Add before the headers if needed
        }

        table.appendChild(headerRow);

        data.data.forEach(
                (row) => {
                        if (row) {
                                let newRow = document.createElement("tr");
                                row.forEach((cell, idx) => {
                                        if (!cell)
                                                return;
                                        let newCell = document.createElement("td");
                                        let text = cell["text"];
                                        if (!text) text = "";

                                        newCell.replaceChildren(parseANSI(text));

                                        if (columnsRight.includes(idx)) {
                                                newCell.style.textAlign = "right";
                                        }
                                        newRow.appendChild(newCell);
                                });
                                table.appendChild(newRow);
                                return;
                        }
                        if (row == null) {
                                const dividerRow = document.createElement("tr");
                                dividerRow.classList.add("section-divider");

                                for (let i = 0; i < columns; i++) {
                                        const cell = document.createElement("td");
                                        cell.classList.add("divider-cell");
                                        dividerRow.appendChild(cell);
                                }
                        
                                table.appendChild(dividerRow);
                                return;
                        }
                }
        );

        if (Array.isArray(data.bottomnotes)) {
                data.bottomnotes.forEach((line, i) => {
                    const row = document.createElement("tr");
                    row.classList.add("bottomnote-row");
            
                    const cell = document.createElement("td");
                    cell.colSpan = columns;  // Adjust as needed
                    cell.classList.add("bottomnote");
                    cell.replaceChildren(parseANSI(line));
                    if (i === 0) cell.style.borderTop = "1px solid #0ff";
            
                    row.appendChild(cell);
                    table.appendChild(row);
                });
        }
                    
        output.appendChild(table);
}