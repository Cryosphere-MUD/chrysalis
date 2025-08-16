export const url = (location.protocol === "https:" ? "wss" : "ws") + "://" + location.host + ":4443/ws/";
import { handleTable } from "./cryosphere.js";

export const settings = {
        url,
        handleTable
};
