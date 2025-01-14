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
    return `0${btoa(encodeURIComponent(meshID))}0`
        .replace(/[=]/g, '0equal0');
};

/**
 * Decode a PeerJS ID to a Mesh ID
 * @param {string} peerID - PeerJS ID
 * @returns {string} Mesh ID
 */
const decodeFromPeerID = function (peerID) {
    return decodeURIComponent(atob(peerID.slice(1, -1)
        .replace(/0equal0/g, '=')));
};

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
        /** @type {string} ICE servers configuration */
        this.iceServers = null;
        /** @type {string|null} Local peer ID */
        this.id = null;
        /** @type {Map<string, DataConnection>} Map of peer connections */
        this.connections = new Map();
        /** @type {Array<Function>} Event listener callback */
        this.eventListeners = [];
        /** @type {Map<string, any>} Map of shared variables */
        this.sharedVars = new Map();
        /** @type {{sender: string, time: number, type: string, data: any}} Last shared event */
        this.lastSharedEvent = {sender: '', time: 0, type: '', data: ''};
        /** @type {Array<Function>} Shared event listener callback */
        this.sharedEventListeners = [];
    }

    /**
     * Add a listener for Mesh events
     * @param {Function} listener - Callback function for events
     * @returns {void}
     */
    addMeshEventListener (listener) {
        this.eventListeners.push(listener);
    }

    /**
     * Remove a listener for Mesh events
     * @param {Function} listener - Callback function for events
     * @returns {void}
     */
    removeMeshEventListener (listener) {
        const index = this.eventListeners.indexOf(listener);
        if (index > -1) {
            this.eventListeners.splice(index, 1);
        }
    }

    /**
     * Add a listener for shared events
     * @param {Function} listener - Callback function for events
     * @returns {void}
     */
    addSharedEventListener (listener) {
        this.sharedEventListeners.push(listener);
    }

    /**
     * Remove a listener for shared events
     * @param {Function} listener - Callback function for events
     * @returns {void}
     */
    removeSharedEventListener (listener) {
        const index = this.sharedEventListeners.indexOf(listener);
        if (index > -1) {
            this.sharedEventListeners.splice(index, 1);
        }
    }

    /**
     * Set ICE servers configuration
     * @param {string} servers - ICE servers configuration in JSON format
     */
    setICEServers (servers) {
        if (servers.charAt(0) !== '[') {
            servers = `[${servers}]`;
        }
        const serversData = JSON.parse(servers);
        this.ICEServers = serversData;
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
            this.peer = new Peer(encodeToPeerID(localID), {
                config: {
                    iceServers: this.iceServers ? this.iceServers : []
                }
            });
            this.peer.on('open', peerID => {
                this.id = decodeFromPeerID(peerID);
                this.peer.on('connection', requested => {
                    const remoteID = decodeFromPeerID(requested.peer);
                    requested.on('open', () => {
                        const onSyncAnswer = data => {
                            if (data.type === 'control' && data.command === 'syncAnswer') {
                                data.vars.forEach(([key, value]) => {
                                    this.setSharedVar(key, value);
                                });
                                requested.off('data', onSyncAnswer);
                                this._setupDataConnection(requested, remoteID);
                                this._registerDataConnection(requested, remoteID);
                                this.eventListeners.forEach(listener => {
                                    listener(
                                        {
                                            type: 'dataConnectionRequested',
                                            data: remoteID
                                        });
                                });
                            }
                        };
                        requested.on('data', onSyncAnswer);
                        const syncRequest = {
                            sender: this.id,
                            time: Date.now(),
                            type: 'control',
                            command: 'syncRequest',
                            vars: Array.from(this.sharedVars)
                        };
                        requested.send(syncRequest);
                    });
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
        for (const connection of this.connections.values()) {
            connection.close();
        }
        this.connections.clear();

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
     * Setup a data connection
     * @param {DataConnection} connection - PeerJS DataConnection instance
     * @param {string} remoteID - Remote Mesh ID
     */
    _setupDataConnection (connection, remoteID) {
        connection.on('data', data => {
            if (data.type === 'var') {
                if (this.sharedVars.get(data.key) !== data.value) {
                    this.connections.forEach(conn => {
                        if (conn !== connection) {
                            conn.send(data);
                        }
                    });
                    this.sharedVars.set(data.key, data.value);
                }
            } else if (data.type === 'event') {
                if (data.sender === this.id) return;
                if (data.sender !== this.lastSharedEvent.sender ||
                    data.time !== this.lastSharedEvent.time) {
                    this.connections.forEach(conn => {
                        if (conn !== connection) {
                            conn.send(data);
                        }
                    });
                    this.onSharedEvent(data);
                }
            }
        });
        connection.on('close', () => {
            this.eventListeners.forEach(listener => {
                listener(
                    {
                        type: 'dataConnectionClosed',
                        data: remoteID
                    });
            });
        });
        connection.on('error', err => {
            this.eventListeners.forEach(listener => {
                listener(
                    {
                        type: 'dataConnectionError',
                        data: remoteID,
                        error: err
                    });
            });
        });
    }

    /**
     * Register a data connection
     * @param {DataConnection} connection - PeerJS DataConnection instance
     * @param {string} remoteID - Remote Mesh ID
     * @private
     */
    _registerDataConnection (connection, remoteID) {
        this.connections.set(remoteID, connection);
    }

    /**
     * Connect to a remote peer
     * @param {string} remoteID - Remote Mesh ID
     * @returns {Promise<SharedDataChannel>} Promise that resolves with the data channel
     */
    openDataConnection (remoteID) {
        if (!this.peer) throw new Error('Peer not initialized');
        if (!remoteID || remoteID === '') {
            return Promise.reject(new Error('Remote ID not set'));
        }
        const conn = this.connections.get(remoteID);
        if (conn && conn.open) {
            return Promise.resolve(conn);
        }
        const newConnection = this.peer.connect(encodeToPeerID(remoteID));
        return new Promise((resolve, reject) => {
            newConnection.on('open', () => {
                const onSyncRequest = data => {
                    if (data.type === 'control' && data.command === 'syncRequest') {
                        data.vars.forEach(([key, value]) => {
                            this.setSharedVar(key, value);
                        });
                        const syncAnswer = {
                            sender: this.id,
                            time: Date.now(),
                            type: 'control',
                            command: 'syncAnswer',
                            vars: Array.from(this.sharedVars)
                        };
                        newConnection.send(syncAnswer);
                        newConnection.off('data', onSyncRequest);
                        this._setupDataConnection(newConnection, remoteID);
                        this._registerDataConnection(newConnection, remoteID);
                        this.eventListeners.forEach(listener => {
                            listener(
                                {
                                    type: 'dataConnectionOpened',
                                    data: remoteID
                                });
                        });
                        resolve(newConnection);
                    }
                };
                newConnection.on('data', onSyncRequest);
            });
            newConnection.on('error', err => {
                reject(err);
            });
        });
    }

    /**
     * Get an existing data connection
     * @param {string} remoteID - Remote Mesh ID
     * @returns {DataConnection|undefined} Data connection if it exists
     */
    getDataConnection (remoteID) {
        return this.connections.get(remoteID);
    }

    /**
     * Check if a data connection is open
     * @param {string} remoteID - Remote Mesh ID
     * @returns {boolean} True if the data channel is open
     */
    isDataConnectionOpen (remoteID) {
        const connection = this.connections.get(remoteID);
        return !!connection && connection.open;
    }

    /**
     * Disconnect and remove a data connection
     * @param {string} remoteID - Remote peer ID
     */
    closeDataConnection (remoteID) {
        const conn = this.connections.get(remoteID);
        if (conn) {
            if (conn.open) {
                conn.close();
            }
        }
    }

    /**
     * Get the ID of the data connection at a given index
     * @param {number} index - Connection index
     * @returns {string} Data connection Mesh ID
     */
    dataConnectionIDAt (index) {
        return Array.from(this.connections.keys())[index];
    }

    /**
     * Get the number of data connections
     * @returns {number} Number of data connections
     */
    dataConnectionCount () {
        return this.connections.size;
    }

    sendSyncRequest () {
        const data = {
            sender: this.id,
            time: Date.now(),
            type: 'control',
            command: 'syncRequest',
            vars: Object.fromEntries(this.sharedVars)
        };
        for (const connection of this.connections.values()) {
            connection.send(data);
        }
    }

    /**
     * Get shared variable
     * @param {string} key - Variable name
     * @returns {any} Variable value
     */
    sharedVar (key) {
        return this.sharedVars.get(key);
    }

    /**
     * Set shared variable
     * @param {string} key - Variable name
     * @param {any} value - Variable value
     */
    setSharedVar (key, value) {
        const data = {
            sender: this.id,
            time: Date.now(),
            type: 'var',
            key: key,
            value: value
        };
        for (const connection of this.connections.values()) {
            connection.send(data);
        }
        this.sharedVars.set(key, value);
    }

    /**
     * Handle incoming shared events
     * @param {object} event - Shared event object
     */
    onSharedEvent (event) {
        this.lastSharedEvent = event;
        for (const listener of this.sharedEventListeners) {
            listener(event);
        }
    }

    /**
     * Dispatch a shared event
     * @param {string} type - Event type
     * @param {any} data - Event data
     * @returns {Promise<void>} Promise that resolves when the event is dispatched
     */
    async dispatchSharedEvent (type, data) {
        const event = {
            sender: this.id,
            time: Date.now(),
            type: 'event',
            eventType: type,
            eventData: data
        };
        for (const connection of this.connections.values()) {
            await connection
                .send(event);
        }
        this.onSharedEvent(event);
    }

    /**
     * Get the type of the last shared event
     * @returns {string} Event type
     */
    lastSharedEventType () {
        return this.lastSharedEvent.eventType;
    }

    /**
     * Get the data of the last shared event
     * @returns {any} Event data
     */
    lastSharedEventData () {
        return this.lastSharedEvent.eventData;
    }
}

export default Mesh;
