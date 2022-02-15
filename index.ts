import { Boom } from '@hapi/boom'
import { unlink } from 'fs';
import P from 'pino'
import * as express from 'express';
import * as http from 'http'
import makeWASocket, { DisconnectReason, useSingleFileAuthState } from '@adiwajshing/baileys'

const port = 3000;
const app = express();
const server = http.createServer(app);
var sock = {};

app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));

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
				unlink(`./sessions/session-${id}.json`, (err) => {
					if (err) throw err;
					console.log(`successfully deleted session ${id}`);
					startSock(id)
				});
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

app.post('/send-message', async (req, res) => {
	const sender = req.body.sender;
  const number = `${req.body.number}@s.whatsapp.net`;
  const message = req.body.message;
	try {
		const sendMessage = await sock[sender].sendMessage(number, { text: message })
		res.status(200).json({
			status: true,
			response: sendMessage
		});
	} catch (error) {
		res.status(500).json({
      status: false,
      response: error,
    });
	}
});

server.listen(port, function () {
  console.log(`http://localhost:${port}/?id=123&as=Ares`);
});