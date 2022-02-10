import { Boom } from '@hapi/boom'
import P from 'pino'
import makeWASocket, { AnyMessageContent, delay, DisconnectReason, useSingleFileAuthState } from '@adiwajshing/baileys'

const startSock = async (id) => {
	console.log(`ObjectID: ${id}`);
	
	const { state, saveState } = useSingleFileAuthState(`./sessions/session-${id}.json`)
	const sock = makeWASocket({
		logger: P({ level: 'trace' }),
		printQRInTerminal: true,
		auth: state
	})

	sock.ev.on('connection.update', (update) => {
		const { connection, lastDisconnect } = update
		if(connection === 'close') {
      console.log(DisconnectReason.loggedOut);
      console.log(lastDisconnect);
      
			// reconnect if not logged out
			if((lastDisconnect.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut) {
				startSock(id)
			} else {
				console.log('connection closed')
			}
		}
        
		console.log('connection update', update)
	})

	sock.ev.on('creds.update', saveState)

	return sock;
}
var idClient = ["wacs3"]
idClient.forEach(e => {
	startSock(e)
});