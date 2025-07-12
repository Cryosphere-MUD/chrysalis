export const url = (location.protocol === "https:" ? "wss" : "ws") + "://" + location.host + "/ws/";
import { handleTable } from "./cryosphere.js";
export { handleTable };
