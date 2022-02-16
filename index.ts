import { Boom } from '@hapi/boom'
import { unlink, existsSync,  writeFileSync, readFileSync, writeFile} from 'fs';
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

const sessions = [];
const SESSIONS_FILE = './sessions/whatsapp-id.json';

const createSessionsFileIfNotExists = function () {
  if (!existsSync(SESSIONS_FILE)) {
		try {
    	writeFileSync(SESSIONS_FILE, JSON.stringify([]));
      console.log('Sessions file created successfully');
    } catch (err) {
      console.log('Failed to create sessions file: ', err);
    }
  }
}
createSessionsFileIfNotExists();

const getSessionsFile = function () {
  try {
    return JSON.parse(readFileSync(SESSIONS_FILE).toString());
  } catch (error) {
    return []
  }
}

const setSessionsFile = function (sessions) {
  writeFile(SESSIONS_FILE, JSON.stringify(sessions), function (err) {
    if (err) {
      console.log(err);
    }
  });
}

const startSock = async (id) => {
	try {
		console.log(`ObjectID: ${id}`);
		
		const { state, saveState } = useSingleFileAuthState(`./sessions/session-${id}.json`)
		sock[id] = makeWASocket({
			connectTimeoutMs: 10000,
			defaultQueryTimeoutMs: 10000000,
			keepAliveIntervalMs: 10000000,
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
					console.log(`connection: close`);
					if((lastDisconnect.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut) {
						console.log('run close not logout');
						setTimeout(() => {
							startSock(id)
						}, 15000)
					} else {
						if (existsSync(`./sessions/session-${id}.json`)) {
							unlink(`./sessions/session-${id}.json`, (err) => {
								if (err) throw err;
								console.log(`successfully deleted session ${id}`);
								const savedSessions = getSessionsFile();
								const sessionIndex = savedSessions.findIndex(e => e.id == id);
								savedSessions.splice(sessionIndex, 1);
								setSessionsFile(savedSessions);
							});
						}
					}
				} else if(connection === 'open'){
					console.log(`connection: open`);
					io.emit('name', { id: id, name: state.creds.me.name, status: 'open' });
				}
			} catch (error) {
					
			}
		})

		sock[id].ev.on('creds.update', saveState)
		const savedSessions = getSessionsFile();
		const sessionIndex = savedSessions.findIndex(sess => sess.id == id);
	
		if (sessionIndex == -1) {
			savedSessions.push({
				id: id,
			});
			setSessionsFile(savedSessions);
		}
		return false;
	} catch (error) {
		console.log('error: startSock');
		console.log(error);
	}
}

const init = async (socket?) => {
	const savedSessions = getSessionsFile();
	console.log('run init');
	savedSessions.forEach(e => {
		console.log(`init :${e.id}`);
		startSock(e.id)
	});
}
init()

io.on('connection', function (socket) {
  init(socket);
	socket.on('create-session', function (data) {
		if(data.id){
			console.log('io connection: ' + data.id);
			startSock(data.id);
		}
  });
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