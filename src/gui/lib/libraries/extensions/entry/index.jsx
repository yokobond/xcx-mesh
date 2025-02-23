/**
 * This is an extension for Xcratch.
 */

import iconURL from './entry-icon.png';
import insetIconURL from './inset-icon.svg';
import translations from './translations.json';

/**
 * Formatter to translate the messages in this extension.
 * This will be replaced which is used in the React component.
 * @param {object} messageData - data for format-message
 * @returns {string} - translated message for the current locale
 */
let formatMessage = messageData => messageData.defaultMessage;

const entry = {
    get name () {
        return formatMessage({
            id: 'xcxMesh.entry.name',
            defaultMessage: 'Mesh',
            description: 'name of the extension'
        });
    },
    extensionId: 'xcxMesh',
    extensionURL: 'https://yokobond.github.io/xcx-mesh/dist/xcxMesh.mjs',
    collaborator: 'yokobond',
    iconURL: iconURL,
    insetIconURL: insetIconURL,
    get description () {
        return formatMessage({
            defaultMessage: 'Perform peer-to-peer communication. Use WebRTC to send and receive text data.',
            id: 'xcxMesh.entry.description'
        });
    },
    tags: ['network', 'communication', 'p2p', 'mesh'],
    featured: true,
    disabled: false,
    bluetoothRequired: false,
    internetConnectionRequired: true,
    helpLink: 'https://yokobond.github.io/xcx-mesh/',
    setFormatMessage: formatter => {
        formatMessage = formatter;
    },
    translationMap: translations
};

export {entry}; // loadable-extension needs this line.
export default entry;
