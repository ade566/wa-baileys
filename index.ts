import { Boom } from '@hapi/boom'
import { unlink } from 'fs';
import P from 'pino'
import makeWASocket, { DisconnectReason, useSingleFileAuthState } from '@adiwajshing/baileys'

var sock = {};

const startSock = async (id) => {
	console.log(`ObjectID: ${id}`);
	
	const { state, saveState } = useSingleFileAuthState(`./sessions/session-${id}.json`)
	sock[id] = makeWASocket({
		logger: P({ level: 'trace' }),
		printQRInTerminal: true,
		auth: state
	})

	sock[id].ev.on('connection.update', (update) => {
		const { connection, lastDisconnect } = update
		if(connection === 'close') {
			// reconnect if not logged out
			if((lastDisconnect.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut) {
				startSock(id)
			} else {
				console.log('connection closed')
			}
		}
	})

	sock[id].ev.on('creds.update', saveState)

	return sock[id];
}

var idClient = ["wacs3"]
idClient.forEach(e => {
	startSock(e)
});