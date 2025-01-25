# Mesh Extension for Xcratch

A peer-to-peer communication extension for [Xcratch](https://xcratch.github.io/). This extension establishes data channels using WebRTC to enable direct communication between Scratch projects.

## ⚡ Getting Started

### Using in Xcratch

1. Open [Xcratch Editor](https://xcratch.github.io/)
2. Click 'Add Extension' button
3. Select 'Extension Loader' extension
4. Type the following URL in the input field:
```
https://yokobond.github.io/xcx-mesh/dist/xcxMesh.mjs
```
5. Click 'OK' button
6. Now you can use the blocks of this extension

## ✨ What You Can Do With This Extension

Play [Example Project](https://xcratch.github.io/editor/#https://yokobond.github.io/xcx-mesh/projects/example.sb3) to look at what you can do with "Mesh" extension.

This project demonstrates how to use the "Mesh" extension to establish a peer-to-peer connection between two or more Scratch projects. Start the project in multiple tabs or browsers to see how the projects can communicate with each other. Press the green flag to start the project and click the "Mesh" sprite to open peer with a unique ID. After each peer of the projects are opened, you can connect to other peers by clicking the "Mesh" sprite and typing the ID in the input field. Once the connection is established, you can share key=values and events with the connected peers. Then you can move your cat sprite with arrow keys and see movement of the cat sprite in other connected projects. You can also make your sprite speak by clicking it, and press the space key to make it say "pruuu". These actions will be synchronized across all connected peers.

<iframe src="https://xcratch.github.io/editor/player#https://yokobond.github.io/xcx-mesh/projects/example.sb3" width="540px" height="460px"></iframe>

## 🔌 Implementation Details

### PeerJS Integration

This extension uses [PeerJS](https://peerjs.com/) library for WebRTC peer-to-peer connections. PeerJS simplifies WebRTC peer-to-peer data by providing an API for:

- Unique ID generation and management
- Automatic connection establishment through a signaling server
- Data channel creation and management
- ICE server configuration for NAT traversal

By default, the extension uses the public PeerJS server (0.peerjs.com) for signaling. You can change this using the "set peer server to [SERVER]" block. For production use, consider:

1. Setting up your own PeerJS server
2. Configuring custom ICE servers
3. Using secure WebSocket connections (wss://)

The extension implements these key features:

- Accepting unicode characters in peer IDs
- Shared variable synchronization across peers
- Event broadcasting system
- Connection state monitoring

Each peer in the network can:
- Connect to multiple peers simultaneously
- Share variables that stay synchronized
- Broadcast events to all connected peers
- Monitor connection status

## 🏠 Home Page

Open this page from [https://yokobond.github.io/xcx-mesh/](https://yokobond.github.io/xcx-mesh/)

## 🤝 Contributing

Contributions, issues and feature requests are welcome!<br />Feel free to check [issues page](https://github.com/yokobond/xcx-mesh/issues). 

## 📝 License

This software is licensed under the [GNU Affero General Public License Version 3](LICENSE).
