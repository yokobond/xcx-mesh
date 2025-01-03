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
    }

    /**
     * Handle the mesh event.
     * @param {object} event - the mesh event.
     */
    onMeshEvent (event) {
        if (event.type === 'dataChannelConnected') {
            const channel = this.mesh.getDataChannel(event.data);
            channel.addSharedEventListener(this.onSharedEvent.bind(this));
        } else if (event.type === 'dataChannelRequested') {
            this.runtime.startHats('xcxMesh_whenDataChannelRequested');
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
     * @param {object} _args - the block's arguments.
     * @param {object} util - utility object provided by the runtime.
     * @returns {string} - the ID of the local peer.
     */
    myID () {
        return this.mesh.id || '';
    }

    /**
     * Connect data channel to a remote peer.
     * @param {object} args - the block's arguments.
     * @param {object} util - utility object provided by the runtime.
     * @param {string} args.ID - the remote ID.
     * @returns {string} - the result of connecting to the peer.
     */
    async connectDataChannel (args) {
        const remoteID = String(args.ID).trim();
        const channel = this.mesh.getDataChannel(remoteID);
        if (channel && channel.isOpen()) {
            if (channel.remoteID === remoteID) {
                return `Already connected to peer "${remoteID}"`;
            }
            await this.mesh.disconnectDataChannel(remoteID);
        }
        try {
            await this.mesh.connectDataChannel(remoteID);
            return `Connected to peer ${remoteID}`;
        } catch (e) {
            return `Failed to connect to peer ${remoteID}: ${e}`;
        }
    }

    /**
     * Check if the data channel is open.
     * @param {object} args - the block's arguments.
     * @param {string} args.ID - the remote ID.
     * @returns {boolean} - true if the data channel is open.
     */
    isDataChannelConnected (args) {
        const remoteID = String(args.ID).trim();
        const channel = this.mesh.getDataChannel(remoteID);
        if (!channel) return false;
        return channel.isOpen();
    }

    /**
     * When the data channel is opened.
     * @param {object} args - the block's arguments.
     * @param {object} util - utility object provided by the runtime.
     * @returns {boolean} - true if the data channel is opened.
     */
    whenDataChannelConnected (args, util) {
        return this.isDataChannelConnected(args, util);
    }

    /**
     * When the data channel is closed.
     * @param {object} args - the block's arguments.
     * @param {string} args.ID - the remote ID.
     * @param {object} util - utility object provided by the runtime.
     * @returns {boolean} - true if the data channel is closed.
     */
    whenDataChannelDisconnected (args) {
        const remoteID = String(args.ID).trim();
        const channel = this.mesh.getDataChannel(remoteID);
        if (!channel) return false;
        return !channel.isOpen();
    }

    /**
     * Disconnect the peer.
     * @param {object} args - the block's arguments.
     * @param {string} args.ID - the remote ID.
     * @returns {Promise<void>} - a promise which resolves after disconnecting the peer.
     */
    async disconnectDataChannel (args) {
        const remoteID = String(args.ID).trim();
        await this.mesh.disconnectDataChannel(remoteID);
    }

    dataChannelIDAt (args) {
        const index = Cast.toNumber(args.CHANNEL_INDEX) - 1;
        const remoteID = this.mesh.dataChannelIDAt(index);
        return remoteID ? remoteID : '';
    }

    /**
     * Return the number of data channels.
     * @returns {number} - the number of data channels.
     */
    dataChannelCount () {
        return this.mesh.dataChannelCount();
    }

    /**
     * Return the value of the key.
     * @param {object} args - arguments for the block.
     * @param {string} args.ID - the remote ID.
     * @param {string} args.KEY - the key.
     * @return {string} - the value of the key.
     */
    sharedVar (args) {
        const remoteID = String(args.ID).trim();
        const channel = this.mesh.getDataChannel(remoteID);
        if (!channel) return '';
        const key = String(args.KEY).trim();
        return channel.sharedVar(key);
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
        const remoteID = String(args.ID).trim();
        const channel = this.mesh.getDataChannel(remoteID);
        if (!channel) return 'data channel is not connected';
        const key = String(args.KEY).trim();
        const value = Cast.toString(args.VALUE);
        return channel.setSharedVar(key, value);
    }

    /**
     * Return the remote ID of the peer which sent the last event.
     * @returns {string?} - the remote ID of the peer.
     */
    lastSharedEventChannelID () {
        const channelID = this.mesh.lastSharedEventChannelID;
        return channelID ? channelID : '';
    }

    /**
     * Return the last event type.
     * @param {object} args - arguments for the block.
     * @param {string} args.ID - the remote ID.
     * @return {string} - the last event type.
     */
    lastSharedEventType (args) {
        const remoteID = String(args.ID).trim();
        const channel = this.mesh.getDataChannel(remoteID);
        if (!channel) return '';
        return channel.lastSharedEventType();
    }

    /**
     * Return the last event data.
     * @param {object} args - arguments for the block.
     * @param {string} args.ID - the remote ID.
     * @return {string} - the last event data.
     */
    lastSharedEventData (args) {
        const remoteID = String(args.ID).trim();
        const channel = this.mesh.getDataChannel(remoteID);
        if (!channel) return '';
        return channel.lastSharedEventData();
    }

    /**
     * Send the event.
     * @param {object} args - arguments for the block.
     * @param {string} args.TYPE - the event type.
     * @param {string} args.DATA - the event data.
     * @param {string} args.ID - the remote ID.
     * @return {Promise<string>} - resolve with the result of sending the event.
     */
    dispatchSharedEvent (args) {
        const remoteID = String(args.ID).trim();
        const channel = this.mesh.getDataChannel(remoteID);
        if (!channel) return Promise.resolve(`data channel for ${remoteID} is not connected`);
        const type = String(args.TYPE).trim();
        const data = Cast.toString(args.DATA);
        return channel.dispatchSharedEvent(type, data);
    }

    /**
     * Handle the shared event.
     */
    onSharedEvent () {
        this.runtime.startHats('xcxMesh_whenSharedEventReceived');
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
                '---',
                {
                    opcode: 'connectDataChannel',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'xcxMesh.connectDataChannel',
                        default: 'connect data channel with [ID]'
                    }),
                    arguments: {
                        ID: {
                            type: ArgumentType.STRING,
                            defaultValue: formatMessage({
                                id: 'xcxMesh.connectDataChannel.defaultID',
                                default: 'remoteID'
                            })
                        }
                    }
                },
                {
                    opcode: 'whenDataChannelConnected',
                    blockType: BlockType.HAT,
                    isEdgeActivated: true,
                    text: formatMessage({
                        id: 'xcxMesh.whenDataChannelConnected',
                        default: 'when data channel for [ID] connected'
                    }),
                    arguments: {
                        ID: {
                            type: ArgumentType.STRING,
                            defaultValue: formatMessage({
                                id: 'xcxMesh.whenDataChannelConnected.defaultID',
                                default: 'remoteID'
                            })
                        }
                    }
                },
                {
                    opcode: 'whenDataChannelDisconnected',
                    blockType: BlockType.HAT,
                    isEdgeActivated: true,
                    text: formatMessage({
                        id: 'xcxMesh.whenDataChannelDisconnected',
                        default: 'when data channel for [ID] disconnected'
                    }),
                    arguments: {
                        ID: {
                            type: ArgumentType.STRING,
                            defaultValue: formatMessage({
                                id: 'xcxMesh.whenDataChannelDisconnected.defaultID',
                                default: 'remoteID'
                            })
                        }
                    }
                },
                {
                    opcode: 'isDataChannelConnected',
                    blockType: BlockType.BOOLEAN,
                    text: formatMessage({
                        id: 'xcxMesh.isDataChannelConnected',
                        default: 'data channel for [ID] is connected'
                    }),
                    arguments: {
                        ID: {
                            type: ArgumentType.STRING,
                            defaultValue: formatMessage({
                                id: 'xcxMesh.isDataChannelConnected.defaultID',
                                default: 'remoteID'
                            })
                        }
                    }
                },
                {
                    opcode: 'disconnectDataChannel',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'xcxMesh.disconnectDataChannel',
                        default: 'disconnect data channel for [ID]'
                    }),
                    arguments: {
                        ID: {
                            type: ArgumentType.STRING,
                            defaultValue: formatMessage({
                                id: 'xcxMesh.disconnectDataChannel.defaultID',
                                default: 'remoteID'
                            })
                        }
                    }
                },
                {
                    opcode: 'whenDataChannelRequested',
                    blockType: BlockType.EVENT,
                    isEdgeActivated: false,
                    text: formatMessage({
                        id: 'xcxMesh.whenDataChannelRequested',
                        default: 'when data channel requested'
                    })
                },
                {
                    opcode: 'dataChannelIDAt',
                    blockType: BlockType.REPORTER,
                    disableMonitor: true,
                    text: formatMessage({
                        id: 'xcxMesh.dataChannelIDAt',
                        default: 'data channel ID at [CHANNEL_INDEX]'
                    }),
                    arguments: {
                        CHANNEL_INDEX: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 1
                        }
                    }
                },
                {
                    opcode: 'dataChannelCount',
                    blockType: BlockType.REPORTER,
                    disableMonitor: true,
                    text: formatMessage({
                        id: 'xcxMesh.dataChannelCount',
                        default: 'data channel count'
                    })
                },
                '---',
                {
                    opcode: 'setSharedVar',
                    blockType: BlockType.COMMAND,
                    blockAllThreads: false,
                    text: formatMessage({
                        id: 'xcxMesh.setSharedVar',
                        default: 'set value of [KEY] to [VALUE] in channel with [ID]'
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
                        },
                        ID: {
                            type: ArgumentType.STRING,
                            defaultValue: formatMessage({
                                id: 'xcxMesh.setSharedVar.defaultID',
                                default: 'remoteID'
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
                        default: 'value of [KEY] in channel with [ID]'
                    }),
                    arguments: {
                        KEY: {
                            type: ArgumentType.STRING,
                            defaultValue: formatMessage({
                                id: 'xcxMesh.sharedVar.defaultKey',
                                default: 'key'
                            })
                        },
                        ID: {
                            type: ArgumentType.STRING,
                            defaultValue: formatMessage({
                                id: 'xcxMesh.sharedVar.defaultID',
                                default: 'remoteID'
                            })
                        }
                    }
                },
                '---',
                {
                    opcode: 'dispatchSharedEvent',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'xcxMesh.dispatchSharedEvent',
                        default: 'dispatch event [TYPE] with [DATA] in channel [ID]'
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
                        },
                        ID: {
                            type: ArgumentType.STRING,
                            defaultValue: formatMessage({
                                id: 'xcxMesh.dispatchSharedEvent.defaultID',
                                default: 'remoteID'
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
                    opcode: 'lastSharedEventChannelID',
                    blockType: BlockType.REPORTER,
                    disableMonitor: true,
                    text: formatMessage({
                        id: 'xcxMesh.lastSharedEventChannelID',
                        default: 'channel ID of the last event'
                    })
                },
                {
                    opcode: 'lastSharedEventType',
                    blockType: BlockType.REPORTER,
                    disableMonitor: true,
                    text: formatMessage({
                        id: 'xcxMesh.lastSharedEventType',
                        default: 'event in channel [ID]'
                    }),
                    arguments: {
                        ID: {
                            type: ArgumentType.STRING,
                            defaultValue: formatMessage({
                                id: 'xcxMesh.lastSharedEventType.defaultID',
                                default: 'remoteID'
                            })
                        }
                    }
                },
                {
                    opcode: 'lastSharedEventData',
                    blockType: BlockType.REPORTER,
                    disableMonitor: true,
                    text: formatMessage({
                        id: 'xcxMesh.lastSharedEventData',
                        default: 'data of event in channel [ID]'
                    }),
                    arguments: {
                        ID: {
                            type: ArgumentType.STRING,
                            defaultValue: formatMessage({
                                id: 'xcxMesh.lastSharedEventData.defaultID',
                                default: 'remoteID'
                            })
                        }
                    }
                }
            ],
            menus: {
            }
        };
    }
}

export {MeshBlocks as default, MeshBlocks as blockClass};
