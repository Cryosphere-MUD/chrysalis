const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const net = require("net");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
  allowRequest: (req, callback) => callback(true, 1000 * 60 * 5),
});

app.use(express.static("chrysalis"));

const sessions = {};

function createSessionID() {
  return crypto.randomBytes(8).toString("hex");
}

function connectMud(sessionID) {
  const mud = net.createConnection({ host: "localhost", port: 6666 });

  const session = sessions[sessionID];
  session.mudSocket = mud;
  session.mudAlive = false;

  mud.on("connect", () => {
    console.log("Connected to MUD for session", sessionID);
    session.mudAlive = true;

    if (session.browserSocket) {
      session.browserSocket.emit("mud-status", "connected");
    }
  });

  mud.on("data", (data) => {
    if (session.browserSocket) {
      session.browserSocket.emit("mud-output", data);
    }
  });

  mud.on("error", (err) => {
    console.log("MUD connection error:", err.message);
    session.mudAlive = false;

    if (session.browserSocket) {
      session.browserSocket.emit("mud-status", "error: " + err.message);
    }
  });

  mud.on("end", () => {
    console.log("MUD closed connection");
    session.mudAlive = false;

    if (session.browserSocket) {
      session.browserSocket.emit("mud-status", "disconnected");
    }
  });

  mud.on("close", () => {
    console.log("MUD socket closed");
    session.mudAlive = false;
    session.mudSocket = null;
  });
}

function createMudSession() {
  const sessionID = createSessionID();

  sessions[sessionID] = {
    mudSocket: null,
    mudAlive: false,
    browserSocket: null,
  };

  connectMud(sessionID);

  return sessionID;
}

function attachSocketToSession(socket, sessionID) {
  const session = sessions[sessionID];
  if (!session) return false;

  session.browserSocket = socket;

  // if (session.mudAlive) {
  //   socket.emit("mud-status", "connected");
  // }
  // } else {
  //   socket.emit("mud-status", "disconnected");
  // }

  return true;
}

io.on("connection", (socket) => {
  let { sessionID } = socket.handshake.auth;

  if (!sessionID || !sessions[sessionID]) {
    sessionID = createMudSession();
    socket.emit("sessionID", sessionID);
  }

  console.log("Browser connected with sessionID:", sessionID);

  attachSocketToSession(socket, sessionID);

  socket.on("mud-input", (line) => {
    const session = sessions[sessionID];

    if (!session?.mudAlive) {
      socket.emit("mud-status", "mud not connected");
      return;
    }

    try {
      session.mudSocket.write(Buffer.from(line));
    } catch (err) {
      console.log("Write failed:", err.message);
    }
  });

  socket.on("reconnect-mud", () => {
    const session = sessions[sessionID];
    if (!session.mudAlive) {
      console.log("Attempting MUD reconnect");
      connectMud(sessionID);
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`Browser disconnected (${reason}) sessionID: ${sessionID}`);
    const session = sessions[sessionID];
    if (session) session.browserSocket = null;
  });
});

server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});