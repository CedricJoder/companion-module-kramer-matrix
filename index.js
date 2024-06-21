
const {
  InstanceBase,
  UDPHelper,
  TCPHelper,
  runEntrypoint,
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
  
/*
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
*/  
  

  /**
   * Initializes the module and try to detect capabilities.
   */
  async init(config) {
    this.log('debug', 'Initialization');
    this.config = config;
    this.updateStatus("ok");

 
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
		// Initializes the internal matrix
        this.initRouting();
		// Get channels name and then build actions & variables
		this.getAssignations();
	    this.requestVideoStatus();
	    this.requestAudioStatus();
      },() => {
        this.initRouting();
		this.getAssignations();
      }).catch((_) => {
          // Error while connecting. The error message is already logged, but Node requires
          //  the rejected promise to be handled.
      });
    }
    
    else {   
      this.initRouting();
	  this.getAssignations();
    }

  }
}


runEntrypoint(KramerInstance, []);
