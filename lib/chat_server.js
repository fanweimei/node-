var socketio = require('socket.io');
var io;
var guestNumber = 1;
var nickNames = {};
var namesUsed = [];
var currentRoom = {};
var rooms = [];

exports.listen = function(server){
  io = socketio.listen(server);
  io.set('log level',1);
  io.sockets.on('connection',function(socket){
    guestNumber = assignGuestName(socket,guestNumber,nickNames,namesUsed);
    joinRoom(socket,'Lobby');
    handleMessageBroadcasting(socket,nickNames);
    handleNameChageAttempts(socket,nickNames,namesUsed);
    handleRoomJoining(socket);
    socket.on('rooms',function(){
      socket.emit('rooms', rooms);
    });
    handleClientDisconnection(socket,nickNames,namesUsed);
  });
}

//分配用户昵称
function assignGuestName(socket,guestNumber,nickNames,namesUsed){
  var name = 'Guest'+guestNumber;
  nickNames[socket.id] = name;
  socket.emit('nameResult',{
    success: true,
    name: name
  });
  namesUsed.push(name);
  return guestNumber+1;
}
//进入聊天室
function joinRoom(socket,room){
  if(rooms.indexOf(room)==-1){
    rooms.push(room);
  }
  socket.join(room);
  currentRoom[socket.id] = room;
  socket.emit('joinResult',{room:room});
  socket.broadcast.to(room).emit('message',{
    text: nickNames[socket.id] + ' has joined '+room+'.'
  });
  var usersInRoom = io.sockets.adapter.rooms[room];
  if(usersInRoom.length>1){
    var usersInRoomSummary = 'Users currently in '+room+':';
    var usersArr = [];
    for(var index in usersInRoom.sockets){
      usersArr.push(nickNames[index]);
    }
    usersInRoomSummary += usersArr.join(',')+'.';
    socket.emit('message',{text: usersInRoomSummary});
  }
}
//更名请求的处理逻辑
function handleNameChageAttempts(socket,nickNames,namesUsed){
  socket.on('nameAttempt',function(name){
    if(name.indexOf('Guest')==0){
      socket.emit('nameResult',{
        success: false,
        message: 'Names cannot begin width "Guest".'
      });
    }else {
      if(namesUsed.indexOf(name)==-1){
        var previousName = nickNames[socket.id];
        var previousNameIndex = namesUsed.indexOf(previousName);
        namesUsed.push(name);
        nickNames[socket.id] = name;
        delete namesUsed[previousNameIndex];
        socket.emit('nameResult',{
          success: true,
          name: name
        });
        socket.broadcast.to(currentRoom[socket.id]).emit('message',{
          text: previousName+' is now known as '+name+'.'
        });
      }else {
        socket.emit('nameResult',{
          success: false,
          message: 'That name is already in use.'
        });
      }
    }
  });
}
//发送聊天消息
function handleMessageBroadcasting(socket){
  socket.on('message',function(message){
    socket.broadcast.to(message.room).emit('message',{
      text: nickNames[socket.id]+':'+message.text
    });
  });
}
//创建房间
function handleRoomJoining(socket){
  socket.on('join',function(room){
    socket.leave(currentRoom[socket.id]);
    joinRoom(socket,room.newRoom);
  })
}
//用户断开连接
function handleClientDisconnection(socket){
  socket.on('disconnect',function(){
    var nameIndex = namesUsed.indexOf(nickNames[socket.id]);
    delete namesUsed[nameIndex];
    delete nickNames[socket.id];
  });
}
