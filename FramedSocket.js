export class FramedSocket {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.apparentOpenness = false;
        this.onmessage = null;
        this.onopen = null;
        this.onclose = null;
        this.onerror = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 20;
        this.maxReconnectDelay = 30000; // cap at 30 seconds
        this.sessionToken = null;
        this.baseDelay = 1000; // start at 1 second
        this.byteCount = 0;         // How many Telnet bytes received
        this.buffer = new Uint8Array(0);
        this.connect();
    }

    connect() {
        this.ws = new WebSocket(this.url);
        this.ws.binaryType = "arraybuffer";

        this.ws.onopen = () => {
            console.log("[FramedSocket] Connected to server.");
            // Optionally send resume request here if you have a session token
            if (this.sessionToken) {
                this.sendControl({ resume: this.sessionToken, ack: this.byteCount });
            } else {
                this.sendControl({});
            }
            if (this.onopen && !this.apparentOpenness)
            {
                this.onopen();
                this.apparentOpenness = true;
            }

            this.reconnectAttempts = 0; // reset on successful connection
        };

        this.ws.onmessage = (evt) => {
            const data = new Uint8Array(evt.data);
            this._handleIncoming(data);
        };

        this.ws.onclose = () => {
            console.log("[FramedSocket] Disconnected.");
            this.scheduleReconnect();
        };

        this.ws.onerror = (err) => {
            console.error("[FramedSocket] WebSocket error:", err);
            this.ws.close();
        };
    }

    scheduleReconnect() {
        this.reconnectAttempts++;

        if (this.reconnectAttempts > this.maxReconnectAttempts)
        {
                if (this.apparentOpenness)
                        if (this.onclose) this.onclose();
                else
                        if (this.onerror) this.onerror();
                this.apparentOpenness = false;
                return;
        }

        // Exponential backoff: baseDelay * 2^(attempts-1), capped at maxReconnectDelay
        const delay = Math.min(this.baseDelay * Math.pow(2, this.reconnectAttempts - 1), this.maxReconnectDelay);

        console.log(`[FramedSocket] Trying reconnect in ${delay / 1000} seconds (attempt #${this.reconnectAttempts})`);

        setTimeout(() => {
            this.connect();
        }, delay);
    }

    _handleIncoming(chunk) {
        // Append new data to internal buffer
        let newBuf = new Uint8Array(this.buffer.length + chunk.length);
        newBuf.set(this.buffer);
        newBuf.set(chunk, this.buffer.length);
        this.buffer = newBuf;

        // Process frames
        let offset = 0;
        while (this.buffer.length - offset >= 3) {
            const type = this.buffer[offset];
            const len = (this.buffer[offset + 1] << 8) | this.buffer[offset + 2];
            if (offset + 3 + len > this.buffer.length) break; // incomplete frame

            const payload = this.buffer.slice(offset + 3, offset + 3 + len);
            this._dispatchFrame(type, payload);
            offset += 3 + len;
        }

        // Keep any remaining incomplete data
        this.buffer = this.buffer.slice(offset);
    }

    _dispatchFrame(type, payload) {
        if (type === 0x00) {
            this.byteCount += payload.length;
            const ab = payload.buffer.slice(
                payload.byteOffset,
                payload.byteOffset + payload.byteLength
            );
           if (this.onmessage) this.onmessage({data: ab});
        } else if (type === 0x01) {
            try {
                const msg = JSON.parse(new TextDecoder().decode(payload));
                if (msg.session) this.sessionToken = msg.session;
                if (msg.error && this.onclose) this.onclose();
                if (this.onControl) this.onControl(msg);
            } catch (e) {
                console.error("[FramedSocket] Invalid control frame:", e);
            }
        } else {
            console.warn("[FramedSocket] Unknown frame type:", type);
        }
    }

    send(data) {
        // data is Uint8Array or string
        if (typeof data === "string") {
            data = new TextEncoder().encode(data);
        }
        this._sendFrame(0x00, data);
    }

    sendControl(obj) {
        const json = JSON.stringify(obj);
        const bytes = new TextEncoder().encode(json);
        this._sendFrame(0x01, bytes);
    }

    _sendFrame(type, payload) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const frame = new Uint8Array(3 + payload.length);
        frame[0] = type;
        frame[1] = (payload.length >> 8) & 0xFF;
        frame[2] = payload.length & 0xFF;
        frame.set(payload, 3);
        this.ws.send(frame);
    }

    sendAck() {
        this.sendControl({ ack: this.byteCount });
    }
}
