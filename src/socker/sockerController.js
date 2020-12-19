import socketio from 'socket.io';
import Room from './roomManager';

export default (server) => {
  const io = socketio.listen(server, {
    path: '/classic-mode',
  });

  logger.info('Started listening!');

  // Creating a new namespace
  const classicMode = io.of('/classic-mode');

  classicMode.on('connection', async (socket) => {
    // Receive parameters passed from socket client
    const {
      username, roomId, password, action,
    } = socket.handshake.query;

    // Initilaise a the room for connecting socket
    const room = new Room({
      io: classicMode, socket, username, roomId, password, action,
    });

    const joinedRoom = await room.init(username);
    logger.info('Client Connected');

    // Listeners opened by server
    if (joinedRoom) {
      room.showPlayers();
      room.isReady();
      room.shiftTurn();
    }

    room.onDisconnect();
  });

  return io;
};
