/** @type {any} Peer from PeerJS library */
let Peer;
(async () => {
    ({Peer} = await import(
        /* webpackIgnore: true */
        'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/+esm'
    ));
})();

/**
 * Encode a Mesh ID to a PeerJS ID
 * @param {string} meshID - Mesh ID
 * @returns {string} PeerJS ID
 */
const encodeToPeerID = function (meshID) {
    return btoa(encodeURIComponent(meshID));
};

/**
 * Decode a PeerJS ID to a Mesh ID
 * @param {string} peerID - PeerJS ID
 * @returns {string} Mesh ID
 */
const decodeFromPeerID = function (peerID) {
    return decodeURIComponent(atob(peerID));
};

/**
 * Class representing a data channel for peer-to-peer communication
 */
class SharedDataChannel {
    /**
     * Create a DataChannel instance
     * @param {DataConnection} connection - PeerJS DataConnection instance
     */
    constructor (connection) {
        /** @type {string|null} ID of the remote peer */
        this.remoteID = null;
        /** @type {DataConnection|null} PeerJS DataConnection instance */
        this.connection = null;
        /** @type {boolean} Connection status */
        this.open = false;
        /** @type {Map<string, any>} Map of shared variables */
        this.sharedVars = new Map();
        /** @type {{type: string, data: any}} Last received event */
        this._lastEvent = {type: '', data: ''};
        /** @type {Array<Function>} Array of state change listeners */
        this.stateChangeListeners = [];
        /** @type {Array<Function>} Array of event listeners */
        this.sharedEventListeners = [];

        connection.on('open', () => {
            this._setConnection(connection);
        });
    }

    /**
     * Add a listener for state changes
     * @param {Function} listener - Callback function for state changes
     */
    addStateChangeListener (listener) {
        this.stateChangeListeners.push(listener);
    }

    /**
     * Add a listener for shared events
     * @param {Function} listener - Callback function for shared events
     */
    addSharedEventListener (listener) {
        this.sharedEventListeners.push(listener);
    }

    /**
     * Set up the connection for this channel
     * @param {any} conn - PeerJS connection object
     */
    _setConnection (conn) {
        this.connection = conn;
        this.remoteID = decodeFromPeerID(conn.peer);
        this._setupConnectionHandlers();
        this.open = true;
        if (this.stateChangeListeners) {
            for (const listener of this.stateChangeListeners) {
                listener('open', this);
            }
        }
    }

    /**
     * Set up handlers for connection events
     * @private
     */
    _setupConnectionHandlers () {
        this.connection.on('data', data => {
            if (data.type === 'var') {
                this.sharedVars.set(data.key, data.value);
            } else if (data.type === 'event') {
                this.onSharedEvent(data.eventType, data.eventData);
            }
        });
        this.connection.on('close', () => {
            this.open = false;
            if (this.stateChangeListeners) {
                for (const listener of this.stateChangeListeners) {
                    listener('closed', this);
                }
            }
        });
    }

    /**
     * Get the value of a shared variable
     * @param {string} key - Variable name
     * @returns {any} Variable value or empty string if not found
     */
    sharedVar (key) {
        return this.sharedVars.get(key) || '';
    }

    /**
     * Set a shared variable
     * @param {string} key - Variable name
     * @param {any} value - Variable value
     * @returns {Promise<string|void>} Promise resolving with error message or void
     */
    setSharedVar (key, value) {
        if (!this.open) return Promise.resolve('not connected');
        this.sharedVars.set(key, value);
        return this.connection.send({
            type: 'var',
            key: key,
            value: value
        });
    }

    /**
     * Handle incoming shared events
     * @param {string} type - Event type
     * @param {any} data - Event data
     */
    onSharedEvent (type, data) {
        this._lastEvent = {
            type: type,
            data: data
        };
        for (const listener of this.sharedEventListeners) {
            listener(type, data);
        }
    }

    /**
     * Dispatch a shared event
     * @param {string} type - Event type
     * @param {any} data - Event data
     * @returns {Promise<string|void>} Promise resolving with error message or void
     */
    async dispatchSharedEvent (type, data) {
        if (!this.open) return Promise.resolve('not connected');
        await this.connection.send({
            type: 'event',
            eventType: type,
            eventData: data
        });
        this.onSharedEvent(type, data);
    }

    /**
     * Get the type of the last shared event
     * @returns {string} Event type
     */
    lastSharedEventType () {
        return this._lastEvent.type;
    }

    /**
     * Get the data of the last shared event
     * @returns {any} Event data
     */
    lastSharedEventData () {
        return this._lastEvent.data;
    }

    /**
     * Close the data channel
     */
    close () {
        if (this.connection && this.connection.open) {
            this.connection.close();
        }
        this.open = false;
        if (this.stateChangeListeners) {
            for (const listener of this.stateChangeListeners) {
                listener('closed', this);
            }
        }
    }
}

/**
 * Class representing a mesh network of peer connections
 */
class Mesh {
    /**
     * Create a Mesh instance
     */
    constructor () {
        /** @type {Peer|null} PeerJS instance */
        this.peer = null;
        /** @type {string|null} Local peer ID */
        this.id = null;
        /** @type {Map<string, SharedDataChannel>} Map of data channels */
        this.channels = new Map();
    }

    /**
     * Set event listener for mesh events
     * @param {Function} listener - Event listener callback
     */
    setEventListener (listener) {
        this.eventListener = listener;
    }


    /**
     * Get or create a data channel for a remote peer
     * @param {DataConnection} connection - PeerJS DataConnection instance
     * @returns {SharedDataChannel} Data channel instance
     * @private
     */
    _getOrCreateChannel (connection) {
        const remoteID = decodeFromPeerID(connection.peer);
        let channel = this.channels.get(remoteID);
        if (!channel) {
            channel = new SharedDataChannel(connection);
            channel.addStateChangeListener(state => {
                if (state === 'open') {
                    if (this.eventListener) {
                        this.eventListener(
                            {
                                type: 'dataChannelConnected',
                                data: channel.remoteID
                            });
                    }
                }
                if (state === 'closed') {
                    this.channels.delete(remoteID);
                }
            });
            channel.addSharedEventListener(() => {
                this.lastSharedEventChannelID = remoteID;
            });
            this.channels.set(remoteID, channel);
        }
        return channel;
    }

    /**
     * Open a peer connection.
     * If the connection is already open with the same ID, return the existing instance.
     * @param {string} localID - Local Mesh ID
     * @returns {Promise<Peer>} Promise that resolves with the PeerJS instance
     */
    openPeer (localID) {
        if (localID === '') {
            localID = `mesh-${Math.random().toString(36)
                .substring(2, 6)}`;
        }
        if (this.peer) {
            if (this.id === localID && !this.peer.disconnected) {
                return Promise.resolve(this.peer);
            }
            this.closePeer();
        }
        return new Promise((resolve, reject) => {
            this.peer = new Peer(encodeToPeerID(localID));
            this.peer.on('open', peerID => {
                this.id = decodeFromPeerID(peerID);
                this.peer.on('connection', conn => {
                    this._getOrCreateChannel(conn);
                });
                resolve(this.peer);
            });
            this.peer.on('error', err => {
                this.closePeer();
                reject(err);
            });
        });
    }

    /**
     * Close the peer connection and all data channels
     */
    closePeer () {
        // Close all data channels first
        for (const channel of this.channels.values()) {
            channel.close();
        }
        this.channels.clear();

        // Destroy the peer connection
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
            this.id = null;
        }
    }

    /**
     * Check if the peer connection is open
     * @returns {boolean} True if the peer connection is open
     */
    isPeerOpen () {
        return !!this.peer && !this.peer.disconnected;
    }

    /**
     * Connect to a remote peer
     * @param {string} remoteID - Remote Mesh ID
     * @returns {Promise<SharedDataChannel>} Promise that resolves with the data channel
     */
    connectDataChannel (remoteID) {
        if (!this.peer) throw new Error('Peer not initialized');
        if (this.channels.has(remoteID)) {
            return Promise.resolve(this.channels.get(remoteID));
        }
        const conn = this.peer.connect(encodeToPeerID(remoteID));
        const channel = this._getOrCreateChannel(conn);
        return new Promise((resolve, reject) => {
            conn.on('open', () => {
                resolve(channel);
            });
            conn.on('error', err => reject(err));
        });
    }
    /**
     * Get an existing data channel
     * @param {string} remoteID - Remote Mesh ID
     * @returns {SharedDataChannel|undefined} Data channel if it exists
     */
    getDataChannel (remoteID) {
        return this.channels.get(remoteID);
    }

    /**
     * Disconnect and remove a data channel
     * @param {string} remoteID - Remote peer ID
     */
    disconnectDataChannel (remoteID) {
        const channel = this.channels.get(remoteID);
        if (channel) {
            this.channels.delete(remoteID);
            if (channel.open) {
                channel.close();
            }
        }
    }

    /**
     * Get the ID of the data channel at a given index
     * @param {number} index - Channel index
     * @returns {string} Data channel Mesh ID
     */
    dataChannelIDAt (index) {
        return Array.from(this.channels.keys())[index];
    }

    /**
     * Get the number of data channels
     * @returns {number} Number of data channels
     */
    dataChannelCount () {
        return this.channels.size;
    }
}

export default Mesh;
