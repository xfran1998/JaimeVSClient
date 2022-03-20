const { io } = require("socket.io-client");
const  fs  = require("fs");
const kill = require("tree-kill");
const child_process = require('child_process');
// const { platform } = require("os");
const path = require('path');
const Alert = require("electron-alert");

let childProcess;

// const socket = io("http://localhost:5000");

$ = selector => document.querySelector(selector);
$$ = selector => document.querySelectorAll(selector);

$('#enter-room-btn').addEventListener('click', () => {
  var room = $('#room-name').value;
  room = room.replace(' ', '_');

  // check if room only contain [A-Z], [0-9], [a-z], [_], [.] and [ ]
  var regex = /^[A-Za-z0-9_.]+$/;
  if (!regex.test(room)) {
    createAlert('Input not valid', 'Room name must only contain [A-Z, a-z, 0-9, _, ., SPACE]', 'error', 'Error');
    return;
  }

  if (room.length > 0) {
    run_socket(room);
    
  }
});

function run_socket(room_name){
  const socket = io("https://code-jaime-online.herokuapp.com/");
  
  socket.on("connect", () => {
    console.log("Connected");
  
    socket.emit('join_room',  {
      // check if data room is valid
      room: room_name,
      user_type: "img_user",
    });
  
    // socket.emit('create_room', {
    //   room: 'room1',
    //   user: 'user1',
    //   program: 'processing'
    // });
  });
  
  socket.on('error', error => {
    console.log('error code: ', error.code);
    console.log('error info: ', error.info);
  });
  
  socket.on('enter_room', (data) => {
    console.log('enter room!');
    console.log('code: ', data.code);
    console.log('room: ', data.room);
    console.log('program: ', data.program);
    window.location = 'client_room.html';
  });
  
  socket.on("run_code_server", (code) => {
    console.log("run code");
    write_code(code);
    run_code(socket, 'template');
  });
  
  socket.on('stop_code_server', () => {
    stopCode();
  });
}

// user variables
const frame_rate = 30;
const premium_frame_rate = 60;
const interval_time = 1000/frame_rate;

// const socket = io("wss://localhost:5000");

// const socket = io("ws://localhost:5000", {
//   reconnectionDelayMax: 10000,
//   auth: {
//     token: "123"
//   },
//   query: {
//     "my-key": "my-value"
//   }
// });


function createAlert(tittle, message, type, tittle_window, cancel_btn=false){
  let alert = new Alert();
  let swalOptions = {
    title: `<p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica,
    Arial, sans-serif !important;">Error ${tittle}</p>`,
    html: `<p style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica,
    Arial, sans-serif !important;">${message}</p>`,
    icon: type,
    showCancelButton: cancel_btn,
    // showConfirmButton: true,
  };
  
  let promise = alert.fireWithFrame(swalOptions, tittle_window, null, true);
  // promise.then((result) => {
  //   if (result.value) {
  //     // confirmed
  //   } else if (result.dismiss === Alert.DismissReason.cancel) {
  //     // canceled
  //   }
  // })
  // alert('error code: ' + error.code + '\n' + 'error info: ' + error.info);
}


function write_code(data) {
  const dir_name = path.join(__dirname, 'template', 'template.pde');

  fs.writeFile(dir_name, data.code, (err) => {
    if (err) throw err;
    console.log("The file has been saved!");
  });
}

function run_script(command, args, cwd, time_out=null, callback) {
  console.log("Starting Process.");
  console.log("Command: " + command);
  console.log("Args: " + args);
  console.log("CWD: " + cwd);
  console.log("Timeout: " + time_out);

  if (time_out == null) {
      console.log("Error no time setted of process child.");
      return;
    }
  
  var child = child_process.spawn(command, args, cwd);
  console.log("Child created");
  
  child.stdout.setEncoding('ascii'); // binary
  child.stdout.on('data', function(data) {
      callback(data);
  });

  child.stderr.setEncoding('ascii');
  child.stderr.on('data', function(data) {
      console.log("Error: " + data);
  });

  child.on('close', function() {
      console.log('finish code: ' + child.exitCode);
  });

  return child;
}

// process==program : IP (your local ip) and PORT (65102)

// process (65102) -> (65103)

function run_code(socket, room_name){
  // check if a code is already running
  if (childProcess) {
    console.log("Process already running.");
    // stop it
    stopCode();
  }
  // may need a timeout

  // run the code
  var time_out = 120000; // 2 minutes
  // console.log('running on: ', process.platform);

  childProcess = run_script(path.join(__dirname, 'Processing', 'processing-java.exe'), ["--force", `--sketch=${path.join(__dirname, room_name)}`, `--output=${path.join(__dirname, room_name,'out')}`, "--run"], {cwd:`${path.join(__dirname, room_name)}`}, time_out, function(buf) {
      socket.emit('processing_output_client', buf); // sending prints to server
  });
    
  if (childProcess == null)  return;

  // TODO: DISPLAY IMAGE, set it to room attribute so it can stopped later on
  var int_display = setInterval(() => {
      // read frame.svg from template/img_output
      fs.readFile(path.join(__dirname, room_name, 'img_output', 'frame.svg'), function(err, data) {
          if (err) {
              // if still not sending image reset all finish timers, so it's time_out when start sending image to the client
              debounce(() => {
                  // kill process
                  kill(childProcess.pid);
                  console.log("Process killed.");

                  // stop sending frames to client
                  clearInterval(int_display);
                  console.log('display cleared');
                  socket.emit('processing_info_client', 'Processing finished'); // sending porgram finished to server

              }, time_out);
              // console.log('Reset timeout');
              return;
          }
          // covert to base64
          var base64data = new Buffer(data).toString('base64');
          // console.log('sent');
          socket.emit('image_client', base64data); // sending image to server
      });
      // emit image to socket
  }, interval_time);
}

function stopCode(){
  if (childProcess) {
    kill(childProcess.pid);
  }
}


// AUX
let debounceTimer;
function debounce (callback, time) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(callback, time);
};
