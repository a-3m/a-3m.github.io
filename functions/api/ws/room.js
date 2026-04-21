/* file: functions/api/ws/room.js */
/*
# vim: set ts=4 sw=4 sts=4 noet :
*/

export class Room {
	constructor(state, env){
		this.state = state;
	}

	async fetch(req){
		if (req.headers.get('Upgrade') !== 'websocket')
			return new Response('websocket required', { status: 426 });

		var pair = new WebSocketPair();
		var client = pair[0];
		var server = pair[1];

		this.state.acceptWebSocket(server);

		return new Response(null, {
			status: 101,
			webSocket: client
		});
	}

	webSocketMessage(ws, msg){
		var list = this.state.getWebSockets();
		var i = 0;

		for (i = 0; i < list.length; i++){
			if (list[i] !== ws){
				try { list[i].send(msg); } catch (e) {}
			}
		}
	}

	webSocketClose(ws){
		try { ws.close(); } catch (e) {}
	}
}

export async function onRequest(context){
	var id = context.env.ROOM.idFromName('room');
	var stub = context.env.ROOM.get(id);
	return stub.fetch(context.request);
}