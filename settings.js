export const url = (location.protocol === "https:" ? "wss" : "ws") + "://" + location.host + ":4443/ws/";

export const mudhost = "cryosphere.org";
export const mudport = 6666;
export const conn_title = "Cryosphere [Connected]";
export const disconn_title = "Cryosphere [Disconnected]";

import { handleTable } from "./cryosphere.js";
export { handleTable };
