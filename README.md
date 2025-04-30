

This is Chrysalis, a websocket-based MUD client.

It is now nearly ready for production use.  To install on your MUD, just 
serve these files, altering settings.js to have the websock URL.

Because websockets use a HTTP frame rather than being raw sockets, you'll 
need to run a websocket proxy on a server.  I have been using websockify
(github.com/novnc/websockify)


Open issues:
  the width detection doesn't seem to be quite right
  should i use jQuery more?
