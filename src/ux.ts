const stats = document.getElementById("stats")!;

let statdivs: any = {}

function updateKey(key: string, value: number, maxvalue: number)
{
        if (!statdivs[key])
        {
             let element = document.createElement("span");
             element.className = "statbutton";
             statdivs[key] = element;
             stats.appendChild(element);
        }
        statdivs[key].innerText = key + " " + value + "/" + maxvalue;
}

export function setVitals(payload: any)
{
  const keys = Object.keys(payload).filter(key => !key.startsWith("max"));

  keys.forEach(key => updateKey(key, payload[key], payload["max" + key]));
}