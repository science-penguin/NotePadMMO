const http = require("http");
const { WebSocketServer } = require("ws");
const crypto = require("crypto");
const fs = require("fs");
const send = require("send");

//allocate buffer
const buffer_alloc = 1000000
const blank_val = Buffer.from("0", "latin1")[0];
const buffer = Buffer.alloc(buffer_alloc);
for(let index = 0; index < buffer_alloc; index++) {
	buffer[index] = blank_val;
}
fs.readFile("savefile.txt", function(error, data) {
	if(error) {
		console.log("generating new world (wait for confirmation to join)");
		fs.writeFile("savefile.txt", buffer.toString("latin1"), { "encoding": "latin1" }, function(error) {
			if(error) {
				throw error;
			} else {
				console.log("world generated: safe to join");
			}
		});
	} else {
		console.log("gathering world from file (wait for confirmation to join)");
		for(let index = 0; index < buffer_alloc; index++) {
			buffer[index] = data[index] ?? blank_val;
		}
		console.log("file gathered: safe to join");
	}
});

//background service
async function background_write() {
	while(1) {
		await new Promise(function(resolve) {setTimeout(resolve, 100000);});
		fs.writeFile("savefile.txt", buffer.toString("latin1"), { "encoding": "latin1" }, function(error) {
			if(error) {
				throw error;
			} else {
				console.log("Backup Saved");
			}
		});
	}
}
background_write();

//http server
const server = http.createServer(function(request, response) {
	if(request.url === "/") {
		console.log("serving home page");
		send(request, "client-home.html").pipe(response);
	} else if(request.url === "/raw") {
		response.writeHead(200, { "Content-Type": "text/plain" });
		response.end(buffer.toString("latin1"));
	} else if(request.url === "/main.js") {
		send(request, "main.js").pipe(response);
	} else if(request.url === "/favicon.ico" || request.url === "/favicon.png") {
		send(request, "icon.png").pipe(response);
	} else {
		send(request, "client-404.html").pipe(response);
	}
});

//helper function
function isValid(string, index) {
	if (typeof string !== "string") {
		return false;
	}
	if (string.length !== 1) {
		return false;
	}
	const bytes = Buffer.from(string, "latin1");
	const byte = bytes[0];
	if(byte === 0) {
		return false;
	}
	return Buffer.from([byte]).toString("latin1") === string && bytes.length === 1 && Number.isInteger(index) && index >= 0 && index < buffer.length;
}

//ws server
const clients = {};
async function handle_rate_limit() {
	while(1) {
		for(client in clients) {
			clients[client][1] = 12;
		}
		await new Promise(function(resolve) {setTimeout(resolve, 1000);});
	}
}
handle_rate_limit();
let incoming = [];
async function handle_incoming() {
	while(1) {
		if(incoming.length > 0) {
			const message = incoming[0];
			incoming.splice(0,1);
			try {
				const messageObj = JSON.parse(message);
				if("index" in messageObj && "value" in messageObj) {
					if(isValid(messageObj.value, messageObj.index)) {
						let decoded_message = message.toString("latin1");
						buffer[messageObj.index] = Buffer.from(messageObj.value, "latin1")[0];
						for(const client in clients) {
							try {
								clients[client][0].send(decoded_message);
							} catch(error) {
								console.log("client dropped");
							}
						}
					} else {
						console.log("invalid inputs")
					}
				} else {
					console.log("Missing dict values");
				}
			} catch(error) {
				console.log("corrupt packet")
			}
		} else {
			await new Promise(function(resolve) {setTimeout(resolve, 1000);});
		}
	}
}
handle_incoming()
const websockserver = new WebSocketServer({ "noServer": true });
websockserver.on("connection", function(websock) {
	let uid = crypto.randomUUID();
	while(uid in clients) {
		uid = crypto.randomUUID();
	}
	clients[uid] = [websock, 12]
	console.log("client connected");
	websock.on("message", function(message) {
		if(clients[uid][1] > 0) {
			clients[uid][1] -= 1;
			incoming.push(message);
		} else {
			console.log("token bucket rate limit reached");
			websock.terminate();
		}
	});
	websock.on("close", function() {
		delete clients[uid];
		console.log("client dropped");
	});
});

//upgrade http to ws for /ws
server.on("upgrade", function(request, socket, head) {
	if(request.url === "/ws") {
		websockserver.handleUpgrade(request, socket, head, function(websock) {
			websockserver.emit("connection", websock, request);
		});
	} else {
		socket.destroy();
	}
});

//start server
server.listen(3000, function() {
	console.log("server started");
});
