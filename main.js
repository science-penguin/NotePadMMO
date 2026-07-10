let length = 999999;
async function update_highlight(new_index) {
	const paragraph_element = document.getElementById("display");
	const text_content = paragraph_element.textContent;
	let result = "";
	for(let index = 0; index < text_content.length; index++) {
		if(index === new_index) {
			result += `<span style="background: black; color: white;">${text_content[index]}</span>`;
		} else {
			result += text_content[index];
		}
	}
	paragraph_element.innerHTML = result;
}
async function load() {
	const resp = await fetch("/raw");
	const text = await resp.text();
	length = text.length;
	document.getElementById("display").innerText = text;
	update_highlight(0);
}
load();
let pos = 0;
let websock = new WebSocket("/ws");
let isopen = false;
let packets = [];
let outgoing = [];
async function handle_outgoing() {
	while(1) {
		if(outgoing.length > 0) {
			if(isopen) {
				websock.send(outgoing[0]);
				outgoing.splice(0,1);
			}
		}
		await new Promise(function(resolve) {setTimeout(resolve, 100);});
	}
}
handle_outgoing();
async function handle_incoming() {
	while(true) {
		if(packets.length > 0) {
			if(isopen) {
				const packet = packets[0];
				packets.splice(0,1);
				const data = JSON.parse(packet);
				const paragraph_element = document.getElementById("display");
				let text_content = paragraph_element.textContent;
				const result = text_content.slice(0, data.index) + data.value + text_content.slice(data.index + 1);
				paragraph_element.innerText = result;
				update_highlight(pos);
			}
		} else {
			await new Promise(function(resolve) {setTimeout(resolve, 100);});
		}
	}
}
websock.addEventListener("open", function() {
	isopen = true;
	window.addEventListener("keydown", function(event) {
		if(event.key === "ArrowLeft" && pos > 0) {
			event.preventDefault();
			if(pos > 0) {
				pos -= 1;
			}
			update_highlight(pos);
		} else if(event.key === "ArrowRight" && pos < length) {
			event.preventDefault();
			if(pos < length) {
				pos += 1;
			}
			update_highlight(pos);
		} else if(event.key.length === 1){
			event.preventDefault();
			outgoing.push(JSON.stringify({ "index": pos, "value": event.key }));
			if(pos < length) {
				pos += 1;
			}
		} else if(event.key === "Backspace"){
			event.preventDefault();
			if(pos > 0){
				pos -= 1;
				outgoing.push(JSON.stringify({ "index": pos, "value": " " }));
			}
		} else if(event.key === "ArrowDown") {
			const style = getComputedStyle(document.getElementById("display"));
			const probe = document.createElement("span");
			probe.textContent = "M";
			probe.style.fontFamily = style.fontFamily;
			probe.style.fontSize = style.fontSize;
			probe.style.visibility = "hidden";
			document.body.appendChild(probe);
			const charWidth = probe.getBoundingClientRect().width;
			probe.remove();
			const inc = Math.floor(document.getElementById("display").clientWidth / charWidth);
			if(pos + inc > length) {
				pos = length;
			} else {
				pos += inc;
			}
			update_highlight(pos);
		} else if(event.key === "ArrowUp") {
			const style = getComputedStyle(document.getElementById("display"));
			const probe = document.createElement("span");
			probe.textContent = "M";
			probe.style.fontFamily = style.fontFamily;
			probe.style.fontSize = style.fontSize;
			probe.style.visibility = "hidden";
			document.body.appendChild(probe);
			const charWidth = probe.getBoundingClientRect().width;
			probe.remove();
			const inc = Math.floor(document.getElementById("display").clientWidth / charWidth);
			if(pos - inc < 0) {
				pos = 0;
			} else {
				pos -= inc;
			}
			update_highlight(pos);
		}
	});
});
function show_error() {
	document.getElementById("opening").innerHTML = `<h1>connection closed: refresh to reconnect.</h1>`;
	document.getElementById("opening").style.display = "block";
}
websock.addEventListener("close", function() {
	isopen = false;
	show_error();
});
websock.addEventListener("error", function(event) {
	isopen = false;
	show_error();
});
websock.addEventListener("message", function(event) {
	let packet = event.data;
	packets.push(packet);
});
handle_incoming();
