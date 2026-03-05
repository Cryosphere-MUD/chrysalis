import { parseANSI, scrollToEnd } from "./terminal.js";

export function handleTable(data) {
  let table = document.createElement("table");

  let loose = data.style === "loose";

  if (loose) table.classList.add("cryosphere-loose-table");
  else table.classList.add("cryosphere-framed-table");

  let headerRow = document.createElement("tr");

  let columns = 0;

  let columnsRight = [];

  data.header.forEach((cell, idx) => {
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
    span.replaceChildren(parseANSI(data.title));
    div.appendChild(span);
    output.appendChild(div);
  }

  if (data.topnotes && !loose) {
    const topnote = data.topnotes[0];
    const topRow = document.createElement("tr");
    topRow.classList.add("topnote-row");

    const topCell = document.createElement("td");
    topCell.colSpan = columns;
    topCell.replaceChildren(parseANSI(topnote));
    topCell.classList.add("topnote");

    topRow.appendChild(topCell);
    table.appendChild(topRow);
  }

  table.appendChild(headerRow);

  data.data.forEach((row) => {
    if (row) {
      let newRow = document.createElement("tr");
      row.forEach((cell, idx) => {
        if (!cell) return;
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
  });

  if (Array.isArray(data.bottomnotes)) {
    data.bottomnotes.forEach((line, i) => {
      const row = document.createElement("tr");
      row.classList.add("bottomnote-row");

      const cell = document.createElement("td");
      cell.colSpan = columns;
      cell.classList.add("bottomnote");
      cell.replaceChildren(parseANSI(line));
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
