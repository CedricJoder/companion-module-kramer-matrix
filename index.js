const {
  InstanceBase,
  Regex,
  runEntrypoint,
  UDPHelper,
  TCPHelper,
} = require("@companion-module/base");

const actions = require('./src/actions');
const api = require('./src/api');



class KramerInstance extends InstanceBase {
  constructor(internal) {
    super(internal);
    
    // Assign the methods from the listed files to this class
    Object.assign(this, {
    //...configFields,
    ...api,
    ...actions,
    //...variables,
    //...feedbacks,
    //...presets,                        
                })
  }



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
	  this.log('debug', 'init');
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
	  this.log('debug', 'configUpdated()');
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
      this.log ('debug', 'reconnecting');
      this.initConnection();
    }
    else {
      this.log('debug', 'connection unchanged');
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
      	  this.log('debug', 'detecting');
      this.PromiseConnected.then(() => {
		if (detectCapabilities.length !== 0) {
          // Once connected, check the capabilities of the matrix if needed.
          this.detectCapabilities(detectCapabilities);
		}
		this.initActions();
        this.initVariables();
        this.initRouting();
		this.requestVideoStatus();
		this.requestAudioStatus();
//		this.initRouting();
//          this.initActions();
//          this.initVariables();
this.log('debug', 'detected');
      }).catch((_) => {
          // Error while connecting. The error message is already logged, but Node requires
          //  the rejected promise to be handled.
      });
    }
    
    else {   
      // Rebuild the actions to reflect the capabilities we have.
this.log('debug', 'init actions');
      this.initActions();
      this.initVariables();
      this.initRouting();
    }

    this.selectedSource = this.selectedDestination = -1;
  }


  /** 
   *Initializes the internal routing matrix
   */
  initRouting() {
    let inputCount = Math.min(64, Math.max(1, this.config.inputCount));
    let outputCount = Math.min(64, Math.max(1, this.config.outputCount));
    let setupsCount = Math.min(64, Math.max(1, this.config.setupsCount));

/*    this.videoRouting = [];	
    for (let i = 0; i<= outputCount; i++) {
      this.videoRouting[i] = 0;
      this.audioRouting[i] = 0;
    }
*/	this.log('debug', 'init routing');
	for (let i = 0; i<= inputCount; i++) {
      this.reverseVideoRouting[i] = [];
      this.reverseAudioRouting[i] = [];
    }
	
  }

  /**
   * Detects the number of inputs/outputs of the matrix.
   *
   * @param detectCapabilities     An array of capabilities to detect from the matrix
   */
  detectCapabilities(detectCapabilities) {
	this.log('debug', 'Detecting Capabilities : ' + detectCapabilities.length);
    // Reset the counter
    this.capabilityWaitingResponsesCounter = 0;

    if (detectCapabilities.length === 0) {
      // No capabilities to detect.
      return;
    }

    for (let i = 0; i < detectCapabilities.length; i++) {
      // Ask the matrix to define its capabilities for anything unknown.
      let cmd = this.makeCommand(this.DEFINE_MACHINE, detectCapabilities[i], 1);

      // Increment the counter to show we're waiting for a response from a capability.
      this.capabilityWaitingResponsesCounter++;
	  this.trySendMessage(cmd);
//      try {
//        this.socket.send(cmd);
//      } catch (error) {
//        this.log("error", `${error}`);
//      }
    }
  }

  /**
   * Connect to the matrix over TCP port 5000 or UDP port 50000.
   */
async  initConnection() {
	  this.log ('debug', 'initConnection');
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
		  socket.writableLength = 4;
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
          this.log("debug", "Network error", err);
          this.updateStatus("connection_failure", err);
          this.log("error", `Network error: ${err.message}`);
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
    }).catch((_) => {
      // The error is already logged, but Node requires all rejected promises to be caught.
    });

    this.socket.on("status_change", (status, message) => {
      this.updateStatus(status, message);
    });

    this.socket.on("data", (data) => {
      // Note: 'data' is an ArrayBuffer
//		  console.log('received raw data : ');
//		  console.log(data);
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

  /**
   * Return config fields for web config.
   *
   * @returns      The config fields for the module
   */
  getConfigFields() {
    return [
      {
        type: "static-text",
        id: "info",
        width: 12,
        label: "Information",
        value:
          "This module works with Kramer matrices using Protocol 2000 and Protocol 3000. " +
          "Check your matrices' manual to confirm which protocol is supported.",
      },
      {
        type: "textinput",
        id: "host",
        label: "Target IP",
        width: 3,
        regex: Regex.IP,
      },
      {
        type: "dropdown",
        id: "protocol",
        label: "Protocol",
        default: this.PROTOCOL_3000,
        width: 4,
        choices: [
          { id: this.PROTOCOL_2000, label: "Protocol 2000" },
          { id: this.PROTOCOL_3000, label: "Protocol 3000" },
        ],
      },
      {
        type: "dropdown",
        id: "connectionProtocol",
        label: "TCP or UDP",
        default: this.CONNECT_TCP,
        width: 2,
        choices: [
          { id: this.CONNECT_TCP, label: "TCP" },
          { id: this.CONNECT_UDP, label: "UDP" },
        ],
      },
      {
        type: "number",
        id: "port",
        label: "Port number",
        default: 5000,
        width: 3,
      },
      {
        type: "static-text",
        id: "info",
        width: 12,
        label: "Counts",
        value:
          "Set the number of inputs, outputs, and presets the matrix supports."
      },
      
      {
        type: "checkbox",
        id: "detectInputs",
        label: "Auto detect inputs",
	width : 2,
        default: true,
      },
      {
        type: "number",
        id: "inputCount",
        label: "Input count",
	isVisible : (options) => { return !options.detectInputs;},
        default: 0,
        width: 2,
//        regex: "/^\\d*$/",
      },
      {
        type: "static-text",
        id: "detectedInputs",
        isVisible : (options) => { return options.detectInputs;},
        width: 2,
        label: "Input count",
        value: "0",
      },
      
      {
        type: "checkbox",
        id: "detectOutputs",
        label: "Auto detect outputs",
	width: 2,
        default: true,
      },
      {
        type: "number",
        id: "outputCount",
        label: "Output count",
        isVisible : (options) => { return !options.detectOutputs;},
        default: 0,
        width: 2,
 //       regex: "/^\\d*$/",
      },
      {
        type: "static-text",
        id: "detectedOutputs",
        isVisible : (options) => { return options.detectOutputs;},
        width: 2,
        label: "Output count",
        value: "0",
      },
      {
        type: "checkbox",
        id: "detectSetups",
        label: "Auto detect setups",
	width : 2,
        default: true,
      },

      {
        type: "number",
        id: "setupsCount",
        isVisible : (options) => { return !options.detectSetups;},
        label: "Setups count",
        default: 0,
        width: 2,
 //       regex: "/^\\d*$/",
      },
      {
        type: "static-text",
        id: "detectedSetups",
        isVisible : (options) => { return options.detectSetups;},
        width: 2,
        label: "Setups\ncount",
        value: "0",
      },
      {
        type: "static-text",
        id: "info_customize",
        width: 12,
        label: "Customize",
        value:
          "Different matrices may use different commands. Customize them here. Leave default if unsure.",
        isVisible : (options) => { return (options.protocol == "3000");},
      },
      {
        type: "dropdown",
        id: "customizeRoute",
        label: "Route command",
        default: this.ROUTE_VID,
        width: 4,
        choices: [
          { id: this.ROUTE_ROUTE, label: "#ROUTE" },
          { id: this.ROUTE_VID, label: "#VID" },
        ],
        isVisible : (options) => { return (options.protocol == "3000");},
      },
      {
        type: "dropdown",
        id: "customizeDisconnect",
        label: "Disconnect parameter",
        default: this.DISCONNECT_0,
        width: 4,
        choices: [
          { id: this.DISCONNECT_0, label: "0 (most common)" },
          { id: this.DISCONNECT_INP1, label: "Number of inputs +1" },
        ],
        isVisible : (options) => { return (options.protocol == "3000");},
      },
    ];
  }

  /**
   * Cleanup when the module gets deleted.
   */
  async destroy() {
    this.log("debug", "destroy");

    if (this.socket !== undefined) {
      this.socket.destroy();
      delete this.socket;
    }
  }

  /**
   * Creates variables.
   */
  
  initVariables() {
	this.log ('debug', 'Initializing variables');
    let variables = [];

    variables.push({ variableId : 'selectedSource', name : 'Selected source'});  
    variables.push({ variableId : 'selectedDestination', name : 'Selected destination'});  
    

    // Set some sane minimum/maximum values on the capabilities
    let inputCount = Math.min(64, Math.max(1, this.config.inputCount));
    let outputCount = Math.min(64, Math.max(1, this.config.outputCount));
    let setupsCount = Math.min(64, this.config.setupsCount);

    for (let i = 1; i <= outputCount; i++) {
      variables.push({ variableId : 'Output_'+ i + '_video_source', name : 'Output #' + i + ' video source'});  
      variables.push({ variableId : 'Output_'+ i + '_audio_source', name : 'Output #' + i + ' audio source'});  
      //variables.push({ variableId : 'output_' + i + '_Label', name : 'Output #' + i + ' label'});
    }

    for (let i = 1; i <= inputCount; i++) { 
      //variables.push({ variableId : 'input_' + i + '_Label', name : 'Intput #' + i + ' label'});
    }

    this.setVariableDefinitions(variables);
  }


  checkVariables(category, type, destination) {
    let variableValues = {};
    switch (category) {
      case 'routing' :
        if (type == 'video' || type == 'audio') {
          if (destination > 0) {
            variableValues['Output_' + destination + '_' + type + '_source'] = this[type + 'Routing'][destination];
          }
          else {
            let outputCount = this[type + 'Routing'].length();
            for (i = 1; i < outputCount; i++) {
              variableValues['Output_' + i + '_' + type + '_source'] = this[type + 'Routing'][i];
            }
          }
        }
        else {
          checkVariables('routing', 'video', destination);
          checkVariables('routing', 'audio', destination);
        x
        }
        break;
      case 'selection' :
        variableValues['selectedSource'] = this.selectedSource;
        variable_values['selectedDestination'] = this.selectedDestination;

        break;

      default : 
        checkVariables('routing');
        checkVariables('selection');
    }
this.log ('debug', 'setting variables');

    if (Object.keys(variableValues).length > 0) {
      this.setVariableValues(variableValues);
    }
  }
}


runEntrypoint(KramerInstance, []);
