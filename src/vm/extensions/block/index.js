import BlockType from '../../extension-support/block-type';
import ArgumentType from '../../extension-support/argument-type';
import Cast from '../../util/cast';
import translations from './translations.json';
import blockIcon from './block-icon.png';
import Mesh from './mesh';

/**
 * Formatter which is used for translation.
 * This will be replaced which is used in the runtime.
 * @param {object} messageData - format-message object
 * @returns {string} - message for the locale
 */
let formatMessage = messageData => messageData.default;

/**
 * Setup format-message for this extension.
 */
const setupTranslations = () => {
    const localeSetup = formatMessage.setup();
    if (localeSetup && localeSetup.translations[localeSetup.locale]) {
        Object.assign(
            localeSetup.translations[localeSetup.locale],
            translations[localeSetup.locale]
        );
    }
};

const EXTENSION_ID = 'xcxMesh';

/**
 * URL to get this extension as a module.
 * When it was loaded as a module, 'extensionURL' will be replaced a URL which is retrieved from.
 * @type {string}
 */
let extensionURL = 'https://yokobond.github.io/xcx-mesh/dist/xcxMesh.mjs';

/**
 * Class for the extension blocks.
 */
class MeshBlocks {
    /**
     * A translation object which is used in this class.
     * @param {FormatObject} formatter - translation object
     */
    static set formatMessage (formatter) {
        formatMessage = formatter;
        if (formatMessage) setupTranslations();
    }

    /**
     * @return {string} - the name of this extension.
     */
    static get EXTENSION_NAME () {
        return formatMessage({
            id: 'xcxMesh.name',
            default: 'Mesh',
            description: 'name of the extension'
        });
    }

    /**
     * @return {string} - the ID of this extension.
     */
    static get EXTENSION_ID () {
        return EXTENSION_ID;
    }

    /**
     * URL to get this extension.
     * @type {string}
     */
    static get extensionURL () {
        return extensionURL;
    }

    /**
     * Set URL to get this extension.
     * The extensionURL will be changed to the URL of the loading server.
     * @param {string} url - URL
     */
    static set extensionURL (url) {
        extensionURL = url;
    }

    /**
     * Construct a set of blocks for Mesh.
     * @param {Runtime} runtime - the Scratch 3.0 runtime.
     */
    constructor (runtime) {
        /**
         * The Scratch 3.0 runtime.
         * @type {Runtime}
         */
        this.runtime = runtime;

        if (runtime.formatMessage) {
            // Replace 'formatMessage' to a formatter which is used in the runtime.
            formatMessage = runtime.formatMessage;
        }

        /**
         * The peer connection manager.
         * @type {Mesh}
         */
        this.mesh = new Mesh();
        this.mesh.addMeshEventListener(this.onMeshEvent.bind(this));

        /** @type {object} the current processing event */
        this.processingSharedEvent = null;
        /** @type {number} the interval for polling the shared event */
        this.sharedEventPollingInterval = 10;
        /** @type {number} the interval for checking the completion of the shared event */
        this.eventCompletionCheckInterval = 10;
        this.startSharedEventProcessing();
    }

    /**
     * Handle the mesh event.
     * @param {object} event - the mesh event.
     */
    onMeshEvent (event) {
        if (event.type === 'dataConnectionRequested') {
            this.runtime.startHats('xcxMesh_whenDataConnectionRequested');
        }
    }

    /**
     * Open the peer with ID.
     * If the peer is already signaling with the same ID, it will not reconnect.
     * If the peer is already signaling with a different ID, it will disconnect and reconnect.
     * @param {object} args - the block's arguments.
     * @param {object} util - utility object provided by the runtime.
     * @param {string} args.ID - local ID.
     * @returns {Promise<string>} - a promise which resolves after signaling the peer.
     * @throws {Error} - Thrown if the peer is already signaling with the same signal name.
     * @throws {Error} - Thrown if the peer is already disconnected.
     */
    async openPeer (args, util) {
        if (this.isPeerOpening) {
            util.yield();
            return;
        }
        this.isPeerOpening = true;
        const localID = String(args.ID).trim();
        try {
            await this.mesh.openPeer(localID);
            return `Open as "${this.mesh.id}"`;
        } catch (e) {
            return `Failed to open as "${localID}": ${e}`;
        } finally {
            this.isPeerOpening = false;
        }
    }

    /**
     * Check if the peer is open.
     * @returns {boolean} - true if the peer is open.
     */
    isPeerOpen () {
        return this.mesh.isPeerOpen();
    }

    /**
     * Close the peer.
     */
    closePeer () {
        this.mesh.closePeer();
    }

    /**
     * Return the ID of the local peer.
     * @returns {string} - the ID of the local peer.
     */
    myID () {
        return this.mesh.id || '';
    }

    /**
     * Set ICE servers.
     * @param {object} args - arguments for the block.
     * @param {string} args.SERVERS - the ICE servers.
     * @return {string} - the result of setting the ICE servers.
     */
    setICEServers (args) {
        const servers = String(args.SERVERS).trim();
        try {
            this.mesh.setICEServers(servers);
            return `ICE servers set to "${servers}"`;
        } catch (e) {
            return `Failed to set ICE servers: ${e}`;
        }
    }

    /**
     * Set PeerJS server.
     * @param {object} args - arguments for the block.
     * @param {string} args.SERVER - the server URL.
     * @returns {string} - result message
     */
    setPeerServer (args) {
        const server = String(args.SERVER).trim();
        try {
            this.mesh.setPeerServer(server);
            return `PeerJS server set to "${server}"`;
        } catch (e) {
            return `Failed to set PeerJS server: ${e}`;
        }
    }

    /**
     * Open data connection with a remote peer.
     * @param {object} args - the block's arguments.
     * @param {string} args.ID - the remote ID.
     * @returns {string} - the result of connecting to the peer.
     */
    async openDataConnection (args) {
        const remoteID = String(args.ID).trim();
        try {
            await this.mesh.openDataConnection(remoteID);
            return `Connected to peer ${remoteID}`;
        } catch (e) {
            return `Failed to connect to peer ${remoteID}: ${e}`;
        }
    }

    /**
     * Check if the data connection is open.
     * @param {object} args - the block's arguments.
     * @param {string} args.ID - the remote ID.
     * @returns {boolean} - true if the data channel is open.
     */
    isDataConnectionOpen (args) {
        const remoteID = String(args.ID).trim();
        return this.mesh.isDataConnectionOpen(remoteID);
    }

    /**
     * Close the data connection of the remote peer.
     * @param {object} args - the block's arguments.
     * @param {string} args.ID - the remote ID.
     * @returns {Promise<void>} - a promise which resolves after disconnecting the peer.
     */
    async closeDataConnection (args) {
        const remoteID = String(args.ID).trim();
        await this.mesh.closeDataConnection(remoteID);
    }

    /**
     * Return the data connection ID at the index.
     * @param {object} args - arguments for the block.
     * @param {number} args.CONNECTION_INDEX - the index of the data connection.
     * @return {string} - the data connection ID.
     */
    dataConnectionIDAt (args) {
        const index = Cast.toNumber(args.CONNECTION_INDEX) - 1;
        const remoteID = this.mesh.dataConnectionIDAt(index);
        return remoteID ? remoteID : '';
    }

    /**
     * Return the number of data channels.
     * @returns {number} - the number of data channels.
     */
    dataConnectionCount () {
        return this.mesh.dataConnectionCount();
    }

    /**
     * Return the value of the key.
     * @param {object} args - arguments for the block.
     * @param {string} args.KEY - the key.
     * @return {string} - the value of the key.
     */
    sharedVar (args) {
        const key = String(args.KEY).trim();
        return this.mesh.sharedVar(key) || '';
    }

    /**
     * Set the value of the key.
     * @param {object} args - arguments for the block.
     * @param {string} args.KEY - the key.
     * @param {string} args.VALUE - the value.
     * @param {object} util - utility object provided by the runtime.
     * @return {string} - the result of setting the value.
     */
    setSharedVar (args) {
        const key = String(args.KEY).trim();
        const value = Cast.toString(args.VALUE);
        try {
            this.mesh.setSharedVar(key, value);
        } catch (e) {
            return `Failed to set "${key}" to "${value}": ${e}`;
        }
        return `Set "${key}" to "${value}"`;
    }

    /**
     * Return the last event type.
     * @return {string} - the last event type.
     */
    lastSharedEventType () {
        const event = this.processingSharedEvent;
        return (event && event.eventType) || '';
    }

    /**
     * Return the last event data.
     * @return {string} - the last event data.
     */
    lastSharedEventData () {
        const event = this.processingSharedEvent;
        return (event && event.eventData) || '';
    }

    /**
     * Send the event.
     * @param {object} args - arguments for the block.
     * @param {string} args.TYPE - the event type.
     * @param {string} args.DATA - the event data.
     * @return {Promise<string>} - resolve with the result of sending the event.
     */
    dispatchSharedEvent (args) {
        const type = String(args.TYPE).trim();
        const data = Cast.toString(args.DATA);
        try {
            this.mesh.dispatchSharedEvent(type, data);
        } catch (e) {
            return `Failed to dispatch event "${type}": ${e}`;
        }
    }

    /**
     * Handle the shared event.
     */
    onSharedEvent () {
        this.runtime.startHats('xcxMesh_whenSharedEventReceived');
    }

    /**
     * Start the shared event processing.
     * This is called when the project is started.
     * This gets a next event from the mesh and process it then repeat.
     * This is called only once.
     */
    startSharedEventProcessing () {
        const blocks = this;
        const nextEvent = () => {
            const event = blocks.mesh.nextSharedEvent();
            if (event) {
                this.processingSharedEvent = event;
                blocks.processSharedEvent(event, nextEvent);
            } else {
                setTimeout(nextEvent, this.sharedEventPollingInterval);
            }
        };
        setTimeout(nextEvent, 0);
    }

    /**
     * Process the shared event with the callback.
     * The callback will be called after the all started threads are finished.
     * @param {object} event - the shared event.
     * @param {Function} onCompletion - the callback function.
     */
    processSharedEvent (event, onCompletion) {
        // Have we run before, starting threads?
        if (!event.startedThreads) {
            // No - start hats for this broadcast.
            event.startedThreads = this.runtime.startHats('xcxMesh_whenSharedEventReceived');
            if (event.startedThreads.length === 0) {
                // Nothing was started.
                return;
            }
        }
        // We've run before; check if the wait is still going on.
        const waiting = event.startedThreads
            .some(thread => this.runtime.threads.indexOf(thread) !== -1);
        if (waiting) {
            setTimeout(() => {
                this.processSharedEvent(event, onCompletion);
            }, this.eventCompletionCheckInterval);
        } else {
            onCompletion();
        }
    }

    /**
     * Return all shared variable keys as comma separated string.
     * @returns {string} - comma separated keys.
     */
    sharedVarKeys () {
        return this.mesh.sharedVarKeys();
    }

    /**
     * @returns {object} metadata for this extension and its blocks.
     */
    getInfo () {
        setupTranslations();
        return {
            id: MeshBlocks.EXTENSION_ID,
            name: MeshBlocks.EXTENSION_NAME,
            extensionURL: MeshBlocks.extensionURL,
            blockIconURI: blockIcon,
            showStatusButton: false,
            blocks: [
                {
                    opcode: 'openPeer',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'xcxMesh.openPeer',
                        default: 'open peer [ID]'
                    }),
                    arguments: {
                        ID: {
                            type: ArgumentType.STRING,
                            defaultValue: formatMessage({
                                id: 'xcxMesh.openPeer.defaultID',
                                default: 'myID'
                            })
                        }
                    }
                },
                {
                    opcode: 'myID',
                    blockType: BlockType.REPORTER,
                    disableMonitor: true,
                    text: formatMessage({
                        id: 'xcxMesh.myID',
                        default: 'my ID'
                    })
                },
                {
                    opcode: 'isPeerOpen',
                    blockType: BlockType.BOOLEAN,
                    text: formatMessage({
                        id: 'xcxMesh.isPeerOpen',
                        default: 'peer is open'
                    })
                },
                {
                    opcode: 'closePeer',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'xcxMesh.closePeer',
                        default: 'close peer'
                    })
                },
                {
                    opcode: 'setPeerServer',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'xcxMesh.setPeerServer',
                        default: 'set peer server to [SERVER]'
                    }),
                    arguments: {
                        SERVER: {
                            type: ArgumentType.STRING,
                            defaultValue: 'https://0.peerjs.com'
                        }
                    }
                },
                {
                    opcode: 'setICEServers',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'xcxMesh.setICEServers',
                        default: 'set ICE servers to [SERVERS]'
                    }),
                    arguments: {
                        SERVERS: {
                            type: ArgumentType.STRING,
                            defaultValue: ' '
                        }
                    }
                },
                '---',
                {
                    opcode: 'openDataConnection',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'xcxMesh.openDataConnection',
                        default: 'open connection to [ID]'
                    }),
                    arguments: {
                        ID: {
                            type: ArgumentType.STRING,
                            defaultValue: formatMessage({
                                id: 'xcxMesh.openDataConnection.defaultID',
                                default: 'remoteID'
                            })
                        }
                    }
                },
                {
                    opcode: 'isDataConnectionOpen',
                    blockType: BlockType.BOOLEAN,
                    text: formatMessage({
                        id: 'xcxMesh.isDataConnectionOpen',
                        default: 'connection to [ID] is open'
                    }),
                    arguments: {
                        ID: {
                            type: ArgumentType.STRING,
                            defaultValue: formatMessage({
                                id: 'xcxMesh.isDataConnectionOpen.defaultID',
                                default: 'remoteID'
                            })
                        }
                    }
                },
                {
                    opcode: 'closeDataConnection',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'xcxMesh.closeDataConnection',
                        default: 'close connection to [ID]'
                    }),
                    arguments: {
                        ID: {
                            type: ArgumentType.STRING,
                            defaultValue: formatMessage({
                                id: 'xcxMesh.closeDataConnection.defaultID',
                                default: 'remoteID'
                            })
                        }
                    }
                },
                {
                    opcode: 'whenDataConnectionRequested',
                    blockType: BlockType.EVENT,
                    isEdgeActivated: false,
                    text: formatMessage({
                        id: 'xcxMesh.whenDataConnectionRequested',
                        default: 'when connection requested'
                    })
                },
                {
                    opcode: 'dataConnectionIDAt',
                    blockType: BlockType.REPORTER,
                    disableMonitor: true,
                    text: formatMessage({
                        id: 'xcxMesh.dataConnectionIDAt',
                        default: 'connection ID at [CONNECTION_INDEX]'
                    }),
                    arguments: {
                        CONNECTION_INDEX: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 1
                        }
                    }
                },
                {
                    opcode: 'dataConnectionCount',
                    blockType: BlockType.REPORTER,
                    disableMonitor: true,
                    text: formatMessage({
                        id: 'xcxMesh.dataConnectionCount',
                        default: 'connection count'
                    })
                },
                '---',
                {
                    opcode: 'setSharedVar',
                    blockType: BlockType.COMMAND,
                    blockAllThreads: false,
                    text: formatMessage({
                        id: 'xcxMesh.setSharedVar',
                        default: 'set value of [KEY] to [VALUE]'
                    }),
                    arguments: {
                        KEY: {
                            type: ArgumentType.STRING,
                            defaultValue: formatMessage({
                                id: 'xcxMesh.setSharedVar.defaultKey',
                                default: 'key'
                            })
                        },
                        VALUE: {
                            type: ArgumentType.STRING,
                            defaultValue: formatMessage({
                                id: 'xcxMesh.setSharedVar.defaultValue',
                                default: 'value'
                            })
                        }
                    }
                },
                {
                    opcode: 'sharedVar',
                    blockType: BlockType.REPORTER,
                    blockAllThreads: false,
                    text: formatMessage({
                        id: 'xcxMesh.sharedVar',
                        default: 'value of [KEY]'
                    }),
                    arguments: {
                        KEY: {
                            type: ArgumentType.STRING,
                            defaultValue: formatMessage({
                                id: 'xcxMesh.sharedVar.defaultKey',
                                default: 'key'
                            })
                        }
                    }
                },
                {
                    opcode: 'sharedVarKeys',
                    blockType: BlockType.REPORTER,
                    disableMonitor: true,
                    text: formatMessage({
                        id: 'xcxMesh.sharedVarKeys',
                        default: 'all shared variable keys'
                    })
                },
                '---',
                {
                    opcode: 'dispatchSharedEvent',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'xcxMesh.dispatchSharedEvent',
                        default: 'dispatch event [TYPE] with [DATA]'
                    }),
                    arguments: {
                        TYPE: {
                            type: ArgumentType.STRING,
                            defaultValue: formatMessage({
                                id: 'xcxMesh.dispatchSharedEvent.defaultEvent',
                                default: 'event'
                            })
                        },
                        DATA: {
                            type: ArgumentType.STRING,
                            defaultValue: formatMessage({
                                id: 'xcxMesh.dispatchSharedEvent.defaultData',
                                default: 'data'
                            })
                        }
                    }
                },
                {
                    opcode: 'whenSharedEventReceived',
                    blockType: BlockType.EVENT,
                    isEdgeActivated: false,
                    shouldRestartExistingThreads: true,
                    text: formatMessage({
                        id: 'xcxMesh.whenSharedEventReceived',
                        default: 'when event received'
                    })
                },
                {
                    opcode: 'lastSharedEventType',
                    blockType: BlockType.REPORTER,
                    disableMonitor: true,
                    text: formatMessage({
                        id: 'xcxMesh.lastSharedEventType',
                        default: 'event type'
                    }),
                    arguments: {
                    }
                },
                {
                    opcode: 'lastSharedEventData',
                    blockType: BlockType.REPORTER,
                    disableMonitor: true,
                    text: formatMessage({
                        id: 'xcxMesh.lastSharedEventData',
                        default: 'event data'
                    }),
                    arguments: {
                    }
                }
            ],
            menus: {
            }
        };
    }
}

export {MeshBlocks as default, MeshBlocks as blockClass};
