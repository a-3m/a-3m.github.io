/* file: functions/api/ws/[room].js */
/*
# vim: set ts=4 sw=4 sts=4 noet :
*/

export async function onRequest(context){
	var room = context.params.room || 'main';
	var id = context.env.ROOM.idFromName(room);
	var stub = context.env.ROOM.get(id);
	return stub.fetch(context.request);
}