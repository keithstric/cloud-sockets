# cloud-sockets

A websocket boilerplate using ws for nodejs

## Installation

## Architecture

### Acknowledgements

Some messages you may want to keep retrying until we know a client has received it. This is where acknowledgements come in. If a message type should be acknowledged, we will store that message in the awaiting acknowledgement que which is a `Map<WebSocket, Message[]>`. As the message is sent to a WebSocket it will be stored in the que with an `interval` attached to keep retrying until we receive an acknowledgement back from the client it was sent to.

### Channel Maps

### Connection Map

## WebSocket Server Configuration

## cloud-sockets options

## WebSocket Messages

### Message Types

#### subscribe

#### announce

#### user

#### ack

#### getMapInfo


