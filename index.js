
const {
  InstanceBase,
  Regex,
  runEntrypoint,
  UDPHelper,
  TCPHelper
} = require("@companion-module/base");

const actions = require('./src/actions');
const api = require('./src/api');
const variables = require('./src/variables');
const configFields = require('./src/configFields');
const feedbacks = require('./src/feedbacks');

const simpleEval = require('simple-eval').default;

class KramerInstance extends InstanceBase {
  constructor(internal) {
    super(internal);
    
    // Assign the methods from the listed files to this class
    Object.assign(this, {
    ...configFields,
    ...api,
    ...actions,
    ...variables,
    ...feedbacks,
    //...presets,                        
                });
				
  }

//  simpleEval = require('simple-eval').default;

  //  Define the connection protocols this module will use:
  CONNECT_TCP = "TCP";
  CONNECT_UDP = "UDP";

  // Define the possible Protocol 3000 commands to route video:
  ROUTE_ROUTE = "ROUTE";
  ROUTE_VID = "VID";


  // A promise that's resolved when the socket connects to the matrix.
  PromiseConnected = null;

  // A buffer for outgoing messages 
  outBuffer = [];

  // The number of capabilities we're waiting responses for before saving the config.
  capabilityWaitingResponsesCounter = 0;
  

  // time limit for waiting for response from device
  RESPONSE_TIMEOUT = 100;
  // Number of tries for same message
  MAX_ATTEMPTS = 10;
  // Timeout between a response and next message
  NEXT_MESSAGE_TIMEOUT = 500
  // timeout id for escaping waiting state
  timeoutId = 0;
  // current attempts number
  attempts = 0;
  
  

  /**
   * Initializes the module and try to detect capabilities.
   */
  async init(config) {
    this.log('debug', 'Initialization');
    this.config = config;
    this.updateStatus("ok");

//    this.init_actions();
 
    // TODO: Convert this to the new upgrade infrastructure!
    //
    let configUpgraded = false;

    // These config options were adding in version 1.2.0 of this module.
    // Set the defaults if not set:

    if (this.config.connectionProtocol === undefined) {
      this.config.connectionProtocol = this.CONNECT_TCP;
      configUpgraded = true;
    }

    if (this.config.customizeRoute === undefined) {
      this.config.customizeRoute = this.ROUTE_VID;
      configUpgraded = true;
    }

    if (this.config.customizeDisconnect === undefined) {
      this.config.customizeDisconnect = this.DISCONNECT_0;
      configUpgraded = true;
    }

    if (configUpgraded) {
      this.saveConfig(this.config);
    }

//    this.initVariables();
//    this.initConnection();
    await this.configUpdated(this.config);
  }

  /**
   * The user updated the config.
   *
   * @param config         The new config object
   */
  async configUpdated(config) {
	  this.log('debug', 'Updating config');
    // Reconnect to the matrix if the IP or protocol changed
    if (
      this.config.host !== config.host || 
      this.config.port !== config.port || 
      this.config.connectionProtocol !== config.connectionProtocol || 
      this.isConnected() === false
    ) {
      // Have to set the new host IP/protocol before making the connection.
      this.config.host = config.host;
      this.config.port = config.port;
      this.config.connectionProtocol = config.connectionProtocol;
      this.log ('debug', 'Reconnecting');
      await this.initConnection();
    }
    else {
      this.log('debug', 'Connection unchanged');
    }
    this.config = config;
	
    // If any of the values are '0' then attempt to auto-detect:
    let detectCapabilities = [];
    if (this.config.detectInputs) {
      detectCapabilities.push(this.CAPS_VIDEO_INPUTS);
    }
    if (this.config.detectOutputs) {
      detectCapabilities.push(this.CAPS_VIDEO_OUTPUTS);
    }
    if (this.config.detectSetups) {
      detectCapabilities.push(this.CAPS_SETUPS);
    }
	
    if (this.PromiseConnected !== null) {
      this.PromiseConnected.then(() => {
		if (detectCapabilities.length !== 0) {
          // Once connected, check the capabilities of the matrix if needed.
          this.detectCapabilities(detectCapabilities);
		}
        this.initRouting();
//	    this.initActions();
//        this.initVariables();
//	    this.initFeedbacks();
	    this.requestVideoStatus();
	    this.requestAudioStatus();
      },() => {
        this.initRouting();
//	    this.initActions();
//        this.initVariables();
//	    this.initFeedbacks();
      }).catch((_) => {
          // Error while connecting. The error message is already logged, but Node requires
          //  the rejected promise to be handled.
      });
    }
    
    else {   
      // Rebuild the actions to reflect the capabilities we have.
      this.initRouting();
//      this.initActions();
//      this.initVariables();
//      this.initFeedbacks();
    }

  }


  /** 
   *Initializes the internal routing matrix
   */
  initRouting() {
    let inputCount = Math.min(64, this.config.inputCount);
    let outputCount = Math.min(64, this.config.outputCount);
    let setupsCount = Math.min(64, this.config.setupsCount);

	this.log('debug', 'Initializing internal routing matrix');
	
	this.inputs = [{ id: "0", label: "Off", videoDestinations : [], audioDestinations : [] }]; 
	this.outputs = [{ id: "0", label: 'All', videoSource : '', audioSource : "" }];
    this.setups = [];

	for (let i = 1; i<= inputCount; i++) {
      this.inputs.push({id: i, label : 'Input '+ i, videoDestinations : [], audioDestinations : []});
    }
    for (let i = 1; i<= outputCount; i++) {
      this.outputs.push({id: i, label : 'Output '+ i, videoSource : '', audioSource : ''});
    }
    for (let i = 1; i <= setupsCount; i++) {
    this.setups.push({ id: i, label: `Preset ` + i});
    }
	
	this.getAssignations();
  }
	


  /**
   * Connect to the matrix over TCP port 5000 or UDP port 50000.
   */
  async  initConnection() {
    this.log ('debug', 'Connection pending');
    this.PromiseConnected = null;
	this.outBuffer = [];
    	   
    if (this.socket !== undefined) {
		this.log ('debug', 'socket exists');
      await this.socket.destroy();
      delete this.socket;
    }

    if (!this.config.host) {
      return;
    }
	
    this.updateStatus("connecting");
	
    this.PromiseConnected = new Promise((resolve, reject) => {
      switch (this.config.connectionProtocol) { 
        case this.CONNECT_TCP:
          this.socket = new TCPHelper(this.config.host, this.config.port, {
            reconnect_interval: 5000,
          });
          this.socket.writableLength = 4;
          break;

        case this.CONNECT_UDP:
          this.socket = new UDPHelper(this.config.host, this.config.port);
          this.updateStatus("ok");
          this.log("debug", "Connected (UDP)");
          break;
      }

      this.socket.on("error", (err) => {
        if (this.currentStatus !== "error") {
          // Only log the error if the module isn't already in this state.
          // This is to prevent spamming the log during reconnect failures.
          //this.log("debug", "Network error", err);
          this.updateStatus("connection_failure", err.message);
          this.log("error", 'Network error: ' + err.message);
        }
        reject(err);
      });

      this.socket.on("connect", () => {
        // This event only fires for TCP connections.
        this.updateStatus("ok");
        this.log("debug", "Connected (TCP)");
        resolve();
      });

      if (this.config.connectionProtocol === this.CONNECT_UDP) {
        // Auto-resolve the promise if this is a UDP connection.
        resolve();
      }

    });

    this.socket.on("status_change", (status, message) => {
      this.updateStatus(status, message);
    });

    this.socket.on("data", (data) => {
      // Note: 'data' is an ArrayBuffer
      if (typeof data !== "object" || data.length < 4) {
        // Unknown or invalid response
        return;
      }

      switch (this.config.protocol) {
        case this.PROTOCOL_2000:
		  for (let i = 0; i < data.length; i += 4) {
			let chunk = data.slice(i, i+4);
			if (chunk[0] < this.MSB) {
			  this.ackResponse();
			  let cmdstring = '';
		      for (let i=0; i<4; i++){
		        cmdstring += (Number(chunk[i]) + ',');
		        }
              this.log('debug', 'Received Protocol 2000 data : ' + cmdstring);
              this.receivedData2000(chunk);
	        }
		  }
          break;

        case this.PROTOCOL_3000:
          // data may come in as a multiline response to the request. Handle
          //  each line separately.
		  this.log('debug', 'Received Protocol 3000 data : ' + data);
          data = data.toString().split("\r\n");

          for (var i = 0; i < data.length; i++) {
            if (data[i].length !== 0) {
              this.receivedData3000(data[i]);
            }
          }
          break;
      }
    });
  }



  /**
   * Returns if the socket is connected.
   *
   * @returns      If the socket is connected
   */
  isConnected() {
    switch (this.config.connectionProtocol) {
      case this.CONNECT_TCP: 
        if (this.socket) { 
          return this.socket.isConnected;
        }
        return false;
      case this.CONNECT_UDP:
        return true;
    }
    return false;
  }


}


runEntrypoint(KramerInstance, []);
