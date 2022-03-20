const { io } = require("socket.io-client");
const  fs  = require("fs");
const kill = require("tree-kill");
const child_process = require('child_process');
// const { platform } = require("os");
const path = require('path');

let processing_path = null;
let childProcess = null;
let file_path = null;
let file_name = null;
// const socket = io("http://localhost:5000");

$ = selector => document.querySelector(selector);
$$ = selector => document.querySelectorAll(selector);

$('#enter-room-btn').addEventListener('click', () => {
  // get processing folder
  processing_path = getConfigJson('path_processing');
  if (processing_path == null) {
    // open folder dialog
    popupFolderTemplate();
    return;
  }
  
  var room = $('#room-name').value;
  room = room.replace(' ', '_');

  // check if room only contain [A-Z], [0-9], [a-z], [_], [.] and [ ]
  var regex = /^[A-Za-z0-9_.]+$/;
  if (!regex.test(room)) {
    createAlert('Input not valid', 'Room name must only contain [A-Z, a-z, 0-9, _, ., SPACE]', 'Try again');
    return;
  }

  if (room.length > 0) {
    run_socket(room);
  }
});

function run_socket(room_name){
  const socket = io("https://code-jaime-online.herokuapp.com/");
  console.log("connecting...");
  
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
    createAlert('Error', error.info, 'Try again');
  });
  
  socket.on('enter_room', (data) => {
    console.log('enter room!');
    console.log('code: ', data.code);
    console.log('room: ', data.room);
    console.log('program: ', data.program);
    // window.location = 'client_room.html';
    // fetch client_room.html
    ( async () => {
      const response = await fetch('client_room.html') 
      const html_body = await response.text()
      document.body.innerHTML = html_body;
    })();
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

  // set child pid to configjson
  setConfigJson('processing_pid', child.pid);

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

  // run the code
  var time_out = 120000; // 2 minutes
  // console.log('running on: ', process.platform);

  childProcess = run_script(processing_path, ["--force", `--sketch=${path.join(__dirname, room_name)}`, `--output=${path.join(__dirname, room_name,'out')}`, "--run"], {cwd:`${path.join(__dirname, room_name)}`}, time_out, function(buf) {
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

  // stop sending frames to client
  childProcess = null;
  
  // remove child pid to localStorage
  setConfigJson('processing_pid', null);
}

function addListenerFolderPopup(){
  $('#cancel-folder-btn').addEventListener('click', (el) => {
    let pop_up_container = el.currentTarget.parentElement.parentElement;
    pop_up_container.remove();

    // console.log(dialog);
    // console.log(dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] }))
  });

  $('#set-folder-btn').addEventListener('click', (el) => {
    let pop_up_container = el.currentTarget.parentElement.parentElement;
    pop_up_container.remove();

    if (file_path != null) {
      // change config/config.json
      setConfigJson('path_processing', file_path);
    }
  });

  // add event listener when input file change content
  $('#file-input').addEventListener('change', (el) => {
    console.log('file changed');
    file_path = el.currentTarget.files[0].path;
    file_name = el.currentTarget.files[0].name;

    console.log(file_path);

    $('#file-value').innerHTML = file_name;
  });
}

function setConfigJson(attribute, value){
  let config_file = path.join(__dirname, 'config', 'config.json');
  let config = JSON.parse(fs.readFileSync(config_file));
  config[attribute] = value;
  fs.writeFileSync(config_file, JSON.stringify(config));
  console.log("Config file updated.");
  processing_path = file_path;
}

function getConfigJson(attribute){
  let config_file = path.join(__dirname, 'config', 'config.json');
  let config = JSON.parse(fs.readFileSync(config_file));
  return config[attribute];
}

// AUX
let debounceTimer;
function debounce (callback, time) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(callback, time);
};

function createAlert(tittle, message, click_message){
  const NOTIFICATION_TITLE = tittle;
  const NOTIFICATION_BODY = message;
  const CLICK_MESSAGE = click_message;

  new Notification(NOTIFICATION_TITLE, { body: NOTIFICATION_BODY })
    // .onclick = () => document.getElementById("output").innerText = CLICK_MESSAGE
}

function popupFolderTemplate(){
  let pop_up_container = document.createElement('div');
  pop_up_container.classList.add('pop-up');
  pop_up_container.innerHTML = `
    <h3>Processing folder not setted</h3>
    <div class="folder-container">
      <label for="file-input" class="input-btn"><i class="fa-solid fa-folder"></i></label>
      <input type="file" id="file-input" class="hidden">
      <p id="file-value">No file selected</p>
    </div>
    <div class="button-container">
      <button id="set-folder-btn"><i class="fa-solid fa-check"></i></button>
      <button id="cancel-folder-btn"><i class="fa-solid fa-times"></i></button>
    </div>
  `;
  document.body.appendChild(pop_up_container);

  addListenerFolderPopup();
}