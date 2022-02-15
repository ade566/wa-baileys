import { Boom } from '@hapi/boom'
import { unlink } from 'fs';
import P from 'pino'
import * as express from 'express';
import * as http from 'http'
import * as qrcode from 'qrcode'
import {Server} from 'socket.io'
import makeWASocket, { DisconnectReason, useSingleFileAuthState } from '@adiwajshing/baileys'

const port = 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server);

var sock = {};

app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));

const startSock = async (id) => {
	try {
		console.log(`ObjectID: ${id}`);
		
		const { state, saveState } = useSingleFileAuthState(`./sessions/session-${id}.json`)
		sock[id] = makeWASocket({
			// logger: P({ level: 'trace' }),
			printQRInTerminal: true,
			auth: state
		})

		sock[id].ev.on('connection.update', async (update) => {
			try {
				const { connection, lastDisconnect, qr } = update
				if(qr){
					qrcode.toDataURL(qr, (err, url) => {
						io.emit('qr', { id: id, src: url });
					});
				}
				if(connection === 'close') {
					console.log(`connection: ${connection}`);
					if((lastDisconnect.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut) {
						console.log('run close not logout');
						setTimeout(() => {
							startSock(id)
						}, 10000)
					} else {
						unlink(`./sessions/session-${id}.json`, (err) => {
							if (err) throw err;
							console.log(`successfully deleted session ${id}`);
							startSock(id)
						});
					}
				}
			} catch (error) {
					
			}
		})

		sock[id].ev.on('creds.update', saveState)

		return false;
	} catch (error) {
		console.log('error: startSock');
		console.log(error);
	}
}

const init = async (socket?) => {
	var idClient = ["wacs3"]
	console.log('run init');
	idClient.forEach(e => {
		startSock(e)
	});
}
init()
io.on('connection', function (socket) {
  init(socket);
});

app.get('/', (req, res) => {
	res.sendFile('views/index.html', {
    root: __dirname
  });
});

app.post('/send-message', async (req, res) => {
	const sender = req.body.sender;
  const number = `${req.body.number}@s.whatsapp.net`;
  const message = req.body.message;
	setTimeout(async () => {
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
	}, 5000)
});

server.listen(port, function () {
  console.log(`http://localhost:${port}/?id=123&as=Ares`);
});