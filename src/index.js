const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const kill = require("tree-kill");
const { spawnSync } = require('child_process');

const is_Dev = false;
// remove last two folders of path
const src_path = path.join(path.dirname(path.dirname(path.dirname((__dirname)))), 'src');
const root_dir = getRootDir();

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  // eslint-disable-line global-require
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    // width: 1000,
    width: 680,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      devTools: false,
      // devTools: true,
    },
    resizable: false,
    autoHideMenuBar: true,
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.commandLine.appendSwitch("disable-renderer-backgrounding"); // foreground performance augmentation
app.commandLine.appendSwitch("disable-background-timer-throttling"); // foreground performance augmentation
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  // stop processing if it's running
  stopCode();
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

function stopCode(){
  let childProcess_pid = getConfigJson('processing_pid');

  if (childProcess_pid) {
    kill(childProcess_pid);
    console.log('Processing stopped: ', childProcess_pid);
  }

  /// get all processes with the contains "electron" or "java" or "jdk" in the name of the process, depending of the platform
  let processes = [];
  if (process.platform === 'win32') {
    processes = spawnSync('tasklist', ['/fo', 'csv', '/nh']).stdout.toString().split('\n');
    
    processes.forEach(process => {
      // lower case the process name
      console.log(process.toLowerCase());
      process = process.toLowerCase();
      // if the process contains "electron" or "java" or "jdk"
      if (process.includes('electron') || process.includes('java') || process.includes('jdk')) {
        // convert pid string to number and remove "" before parseInt
        console.log('Process to kill: ', process.split(','));
        let int_pid = parseInt(process.split(',')[1].replace(/\"/g, ''));
        // kill the process
        console.log('Process killed: ', int_pid);
        kill(int_pid);
      }
    });
  } else if (process.platform === 'darwin') {
    processes = spawnSync('ps', ['-A', '-o', 'pid,comm']).stdout.toString().split('\n');
    
    processes.forEach(process => {
      // lower case the process name
      process = process.toLowerCase();
      // if the process contains "electron" or "java" or "jdk"
      if (process.includes('electron') || process.includes('java') || process.includes('jdk')) {
        // kill the process
        // let int_pid = parseInt(process.split(',')[0].replace(/\"/g, ''));
        let int_pid = parseInt(process.split(',')[0]);
        kill(int_pid);
      }
    });
  } else if (process.platform === 'linux') {
    processes = spawnSync('ps', ['-A', '-o', 'pid,comm']).stdout.toString().split('\n');
    
    processes.forEach(process => {
      // lower case the process name
      process = process.toLowerCase();
      // if the process contains "electron" or "java" or "jdk"
      if (process.includes('electron') || process.includes('java') || process.includes('jdk')) {
        // kill the process
        // let int_pid = parseInt(process.split(',')[0].replace(/\"/g, ''));
        let int_pid = parseInt(process.split(',')[0]);
        kill(int_pid);
      }
    });
  }
}

function getConfigJson(attribute){
  let config_file = path.join(root_dir, 'config', 'config.json');
  let config = JSON.parse(fs.readFileSync(config_file));
  return config[attribute];
}



function getRootDir(){
  if (is_Dev){
    return __dirname;
  }
  else{
    return src_path;
  }
}