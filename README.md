This is Chrysalis, a basic minimal-dependency websocket-based MUD
client. It is intended for use on the Cryosphere MUD.

If you want to use it: great! I haven't tested it a lot of MUDs but am
always happy to fix its behaviour or take patches.

Because websockets use a HTTP frame rather than being raw sockets, you'll 
need to run a websocket proxy on a server.  I have been using websockify
(github.com/novnc/websockify)

To install on your MUD, just serve these files, altering settings.js to
have the websock URL. It has one dependency, utf8.js, which is provided
as a git submodule. (git submodule update)

Technically this is chrysalis2, which is why it identifies itself as such
in TTYPE. The original iteration was AJAX based and had the misfortune to
have been developed a couple of years before WebSocket was standardised.

It's currently not really useful on a phone because of the way it doesn't
use a standard <input> control. I think I might just make it use one on
phones rather than try and be clever and use a hidden one, since they're
not going to get the benefit of our readline()-like functionality anyway.

Medium term goals for the client include making it implement more relevant
TELNET and terminal features (MTTS, OSC8 and TrueColor have now been done
and CHARSET is next on the list). Longer terms goals will involve interpreting
metadata in order to do more client-side layout.
