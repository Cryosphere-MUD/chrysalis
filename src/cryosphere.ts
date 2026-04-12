import { parseANSI, scrollToEnd } from "./terminal.js";

const output = document.getElementById("output")!;

export function handleTable(data: any) {
  let table = document.createElement("table");

  let loose = data.style === "loose";

  if (loose) table.classList.add("cryosphere-loose-table");
  else table.classList.add("cryosphere-framed-table");

  let headerRow = document.createElement("tr");

  let columns = 0;

  let columnsRight: number[] = [];

  data.header.forEach((cell: any, idx: number) => {
    let newCell = document.createElement("th");
    newCell.innerText = cell["text"];
    headerRow.appendChild(newCell);
    if (cell["align"] === "right") columnsRight.push(idx);
    columns = idx + 1;
  });

  if (data.title && loose) {
    let div = document.createElement("div");
    let span = document.createElement("span");
    div.classList.add("heading-line");
    span.classList.add("heading-label");
    const elements = parseANSI(data.title);
    if (elements)
      span.replaceChildren(elements);
    div.appendChild(span);
    output.appendChild(div);
  }

  if (data.topnotes && !loose) {
    const topnote = data.topnotes[0];
    const topRow = document.createElement("tr");
    topRow.classList.add("topnote-row");

    const topCell = document.createElement("td");
    topCell.colSpan = columns;
    const elements = parseANSI(topnote);
    if (elements)
      topCell.replaceChildren(elements);
    topCell.classList.add("topnote");

    topRow.appendChild(topCell);
    table.appendChild(topRow);
  }

  table.appendChild(headerRow);

  data.data.forEach((row: any) => {
    if (row) {
      let newRow = document.createElement("tr");
      row.forEach((cell: any, idx: number) => {
        if (!cell) return;
        let newCell = document.createElement("td");
        let text = cell["text"];
        if (!text) text = "";

        const elements = parseANSI(text);
        if (elements)
          newCell.replaceChildren(elements);

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
  });

  if (Array.isArray(data.bottomnotes)) {
    data.bottomnotes.forEach((line: any, i: number) => {
      const row = document.createElement("tr");
      row.classList.add("bottomnote-row");

      const cell = document.createElement("td");
      cell.colSpan = columns;
      cell.classList.add("bottomnote");
      const elements = parseANSI(line);
      if (elements)
        cell.replaceChildren(elements);
      if (i === 0) cell.style.borderTop = "1px solid #0ff";

      row.appendChild(cell);
      table.appendChild(row);
    });
  }

  output.appendChild(table);

  if (data.header && loose) {
    let div = document.createElement("div");
    let span = document.createElement("span");
    div.classList.add("heading-line");
    output.appendChild(div);
  }
  
  scrollToEnd()
}
