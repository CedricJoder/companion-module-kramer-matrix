const {
  UDPHelper,
  TCPHelper  
} = require("@companion-module/base");
const fs = require('fs');
const readline = require('readline');


module.exports = {
  
    // Decimal codes for the instructions supported by Kramer Matrix (Protocol 2000).
  // See https://kramerav.com/support/download.asp?f=35567
  // See https://kramerav.com/downloads/protocols/protocol_2000_rev0_51.pdf
  SWITCH_VIDEO : 1,
  SWITCH_AUDIO : 2,
  STORE_SETUP : 3,
  RECALL_SETUP : 4,
  REQUEST_VIDEO_STATUS : 5,
  REQUEST_AUDIO_STATUS : 6,
  FRONT_PANEL : 30,
  DEFINE_MACHINE : 62,
  ERROR : 80,

  CAPS_VIDEO_INPUTS : 1,
  CAPS_VIDEO_OUTPUTS : 2,
  CAPS_SETUPS : 3,

  //  Define the protocols this module may support:
  PROTOCOL_2000 : "2000",
  PROTOCOL_3000 : "3000",

  // Define the possible parameters to disconnect an output:
  DISCONNECT_0 : "0",
  DISCONNECT_INP1 : "+1",
  
  
  

  // Protocol 2000: The most significant bit for bytes 2-4 must be 1. Adding 128 to
  //  each of those bytes accomplishes this.
  MSB : 128,
  
  
  
  // Internal variables reflecting the state of the matrix
  outputs : [],
  inputs : [],
  selectedSource : '',
  selectedDestination : '',




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
  },


  /**
   * Cleanup when the module gets deleted.
   */
  async destroy() {
    this.log("debug", "destroy");

    if (this.socket !== undefined) {
      this.socket.destroy();
      delete this.socket;
    }
  },





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
    }
  },




    /**
   * Handles a response from a Protocol 2000 matrix.
   *
   * @param data     The data received from the matrix (ArrayBuffer)
   */
   
  async receivedData2000 (data) {
    // The response to a command returns the first byte with the second most
    //  significant bit on. If we turn that second bit off, we can compare the
    //  first byte of the response to the first byte of the command sent to see
    //  what the response is for.

    let input = data[1] ^ this.MSB;
    let output = data[2] ^ this.MSB;

    switch (data[0] ^ 64) {
      case this.DEFINE_MACHINE:
        // Turn off the MSB to get the actual count of this capability.
        let count = data[2] ^ this.MSB;

        // Turn off the MSB of the second byte to see what the capability
        //  response is actually for.
        switch (data[1] ^ this.MSB) {
          case this.CAPS_VIDEO_INPUTS:
            this.log("info", `Detected: ${count} inputs.`);
            this.config.inputCount = count;
            this.config.detectedInputs = count.toString();
            break;
            
          case this.CAPS_VIDEO_OUTPUTS:
            this.log("info", `Detected: ${count} outputs.`);
            this.config.outputCount = count;
            this.config.detectedOutputs = count.toString();
            break;

          case this.CAPS_SETUPS:
            this.log("info", `Detected: ${count} presets.`);
            this.config.setupsCount = count;
            this.config.detectedSetups = count.toString();
            break;
            
        }
        
        case this.ERROR :
        // Decrement the counter now that it responded. Save the config
        //  if all the requests responded.
        if (--this.capabilityWaitingResponsesCounter === 0) {
          // Update the actions now that the new capabilities have been stored.
		  await this.initRouting();
//          this.initActions();
//          this.initVariables();
//	      this.initFeedbacks();
          this.saveConfig(this.config);
        }
        break;
	  case this.REQUEST_VIDEO_STATUS : 
	    // Look for the requested parameter 
	    output = this.outBuffer[0][2] ^ this.MSB;
		input = data[2] ^ this.MSB;
      case this.SWITCH_VIDEO : {
        let formerInput = this.outputs[output]?.videoSource;
        this.outputs[output].videoSource = input;
	    let index = this.inputs[formerInput]?.videoDestinations?.indexOf(output);
		  if (index > -1) {
            this.inputs[formerInput]?.videoDestinations?.splice(index, 1);
          }
		else {
		this.log('debug', 'former routing not found');  
		}
		this.inputs[input]?.videoDestinations.push(output);
		// Update variables
        this.checkVariables('routing', 'video', output);
        break;
      }
	  
      case this.REQUEST_AUDIO_STATUS : 
	    output = this.outBuffer[0][2] ^ this.MSB;
		input = data[2] ^ this.MSB;
      case this.SWITCH_AUDIO : {
        let formerInput = this.outputs[output]?.audioSource;
        this.outputs[output].audioSource = input;
        let index = this.inputs[formerInput]?.audioDestinations.indexOf(output);
        if (index > -1) {
          this.inputs[formerInput]?.audioDestinations.splice(index, 1);
        }
        this.inputs[input].audioDestinations.push(output);
        this.checkVariables('routing', 'audio', output);
        break;
      }
    }
  },

  /**
   * Handles a response from a Protocol 3000 matrix.
   *
   * @param data     The data received from the matrix (string)
   */
  async receivedData3000(data) {
    // Decrement the counter now that it responded.
    --this.capabilityWaitingResponsesCounter;

    // Response will look like: ~01@COMMAND PARAMETERS
    var response = data.match(/^~\d+@([\w-]+)\s(.*)/);
    if (response === null || response.length !== 3) {
      // Bad response. Log and abort.
      this.log("error", `Error parsing response: ${data}`);
      return;
    }

    switch (response[1]) {
      case "INFO-IO":
        // response[2] will look like: IN 11,OUT 9
        var io = response[2].match(/IN (\d+),OUT (\d+)/);
        if (io === null || io.length !== 3) {
          this.log("error", "Error parsing input/output response.");
        }

        if (this.config.inputCount === 0) {
          this.log("info", `Detected: ${io[1]} inputs.`);
          this.config.inputCount = parseInt(io[1]);
        }
        if (this.config.outputCount === 0) {
          this.log("info", `Detected: ${io[2]} outputs.`);
          this.config.outputCount = parseInt(io[2]);
        }
        break;

      case "INFO-PRST":
        // response[2] will look like: VID 60,AUD 0. Only care about video presets.
        var prst = response[2].match(/VID (\d+)/);
        if (prst === null || prst.length !== 2) {
          this.log("error", "Error parsing presets response.");
        }

        if (this.config.setupsCount === 0) {
          this.log("info", `Detected: ${prst[1]} presets.`);
          this.config.setupsCount = parseInt(prst[1]);
        }
        break;
    }

    // Save the config if all the requests responded.
    if (this.capabilityWaitingResponsesCounter === 0) {
      // Update the actions now that the new capabilities have been stored.
      await this.initRouting();
      this.initActions();
      this.initVariables();
	  this.initFeedbacks();
      this.saveConfig(this.config);
    }
  },


  /**
     * Formats the command as per the Kramer 2000 protocol.
     *
     * @param instruction    String or base 10 instruction code for the command
     * @param paramA         String or base 10 parameter A for the instruction
     * @param paramB         String or base 10 parameter B for the instruction
     * @param machine        String or base 10 for the machine to target
     * @returns              The built command to send
     */

    makeCommand (instruction, paramA, paramB, machine) {
      switch (this.config.protocol) {
        case this.PROTOCOL_2000:
          return Buffer.from([
            parseInt(instruction, 10),
            this.MSB + parseInt(paramA || 0, 10),
            this.MSB + parseInt(paramB || 0, 10),
            this.MSB + parseInt(machine || 1, 10),
          ]);

        case this.PROTOCOL_3000:
          switch (instruction) {
            case this.DEFINE_MACHINE:
              switch (paramA) {
                case this.CAPS_VIDEO_INPUTS:
                case this.CAPS_VIDEO_OUTPUTS:
                  // Are combined into one instruction in Protocol 3000
                  return "#INFO-IO?\r";

                case this.CAPS_SETUPS:
                  return "#INFO-PRST?\r";
              }
              break;

            case this.SWITCH_AUDIO:
              // paramA = inputs
              // paramB = outputs

              if (paramA === "0") {
                paramA = this.getDisconnectParameter();
              }

              if (paramB === "0") {
                // '0' means route to all outputs
                paramB = "*";
              }

              switch (this.config.customizeRoute) {
                case this.ROUTE_ROUTE:
                  return `#ROUTE 1,${paramB},${paramA}\r`;

                default:
                  this.log(
                    "info",
                    "Audio can only be switched using the #ROUTE command."
                  );
                  return null;
              }
              break;

            case this.SWITCH_VIDEO:
              // paramA = inputs
              // paramB = outputs

              if (paramA === "0") {
                paramA = this.getDisconnectParameter();
              }

              if (paramB === "0") {
                // '0' means route to all outputs
                paramB = "*";
              }

              switch (this.config.customizeRoute) {
                case this.ROUTE_ROUTE:
                  return `#ROUTE 0,${paramB},${paramA}\r`;

                case this.ROUTE_VID:
                default:
                  return `#VID ${paramA}>${paramB}\r`;
              }
              break;

            case this.STORE_SETUP:
              return `#PRST-STO ${paramA}\r`;

            case this.DELETE_SETUP:
              this.log(
                "info",
                "Deleting presets is not supported on Protocol 3000 matrices."
              );
              return;

            case this.RECALL_SETUP:
              return `#PRST-RCL ${paramA}\r`;

            case this.FRONT_PANEL:
              return `#LOCK-FP ${paramA}\r`;
          }

          break;
      }
    },



    /**
     * Difference matrices use different command to issue a disconnect.
     * Return the command appropriate for the user's matrix.
     *
     * @returns              The parameter to disconnect the output
     */
    getDisconnectParameter() {
      switch (this.config.customizeDisconnect) {
        case this.DISCONNECT_INP1:
          return this.config.inputCount + 1;

        case this.DISCONNECT_0:
        default:
          return "0";
      }
    },
   
   
  
  requestVideoStatus(output) {
	if (output > 0) {
      let cmd = this.makeCommand(this.REQUEST_VIDEO_STATUS, 0, output,1);
      this.trySendMessage(cmd);
	}
    else {
      for (let i = 1; i <= this.config.outputCount; i++) {
        let cmd = this.makeCommand(this.REQUEST_VIDEO_STATUS, 0, i,1);
        this.trySendMessage(cmd);
      }
    }
  },
  
  
  
  requestAudioStatus(output) {
    if (output > 0) {
      let cmd = this.makeCommand(this.REQUEST_AUDIO_STATUS, 0, output,1);
      this.trySendMessage(cmd);
    }
    else {
      for (let i = 1; i <= this.config.outputCount; i++) {
        let cmd = this.makeCommand(this.REQUEST_AUDIO_STATUS, 0, i,1);
        this.trySendMessage(cmd);
      }
    }
  },
  
  

    // Load channels name from agn file (Kramer Taylormade)
	// based on module generic readfile
	getAssignations() {
	  let flag = '';
	  let count = 0;
	  let path = this.config.assignations;
	  
	  this.log('debug', 'loading assignations from : ' + path);
	  
	  try {	
			if (!fs.existsSync(path))
			{
				throw new Error('File does not exist');
			}
			
			const fileStream = fs.createReadStream(path, {encoding: 'latin1'});

			const rl = readline.createInterface({
				input: fileStream,
				crlfDelay: Infinity
			});
			
            rl.on('line', (line) => {
				
				let name = line.slice(0,20);
				if (name === '--------------------') {
				  flag = name;
				  return;
				}
				switch (flag) {
				  case 'SOURCES             ' :
				    input = this.inputs[++count];
					if (input) {
                      input.label = name;
					}
				    break;
					
				  case 'DESTINATIONS        ' :
				    output = this.outputs[++count];
					if (output) {
                      output.label = name;
					}
				    break;
					
				  case '--------------------' :
				    flag = name;
					count = 0;
				}
			})
			
			// on end or closing of file builds actions and variables
			rl.on('close', () => {
			  this.initActions();
              this.initVariables();
	          this.initFeedbacks();
			  this.checkVariables('labels');
			});
		
	
		
	  } catch (error) {
		  // on error, goes on building actions and variables with default names
			this.log('error', 'error updating names : ' + error);
			this.initActions();
            this.initVariables();
			this.checkVariables('labels');
	        this.initFeedbacks();
	  };
	  
	  
	},

  
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
  },
	


  // Buffers message, then sends it if not waiting for a response.
  trySendMessage(cmd) { 
    if (this.outBuffer.push(cmd) == 1) {
      this.sendMessage();
    }
  },

  // Acknowledges response from device, and send next messag after timeout.
  ackResponse () {
	this.attempts = 0;
	clearTimeout(this.timeoutId);
	setTimeout(() => {
	  this.outBuffer?.shift();
      this.sendMessage();
	}, this.config.messageTimeout)
  },


  // Timeout function to handle long waiting state 
  lateResponse() {
	if (this.outBuffer?.length > 0) { 
	  if (this.attempts < this.config.maxAttempts) { 
        this.sendMessage();
	  }
	  else {
            let mes = new Uint8Array(this.outBuffer[0]);
            let hexMes = mes.map((x) => {x.toString(16)});
//toString('hex');
           
	    this.log('error', 'error waiting for message : ' + hexMes);
		this.ackResponse();
	  }
	}
  },

 
  // Sends next message from buffer
  sendMessage() {
    let cmd = this.outBuffer[0];
	this.log('debug', 'trying to send message');
    if (cmd) {
      try {
		this.attempts++;
		let cmdstring = '';
		for (let i=0; i<4; i++){
		  cmdstring += (Number(cmd[i]) + ',');
		}
                let msg = Array.from(cmd);
		this.log('debug', 'sending message : ' + msg);
		clearTimeout(this.timeoutId);
		this.timeoutId = setTimeout(() => {
			this.lateResponse();
		  }, 
		  this.config.responseTimeout
		);
		this.socket.send(cmd);
	  }
	  catch (error) {
          this.log("error", `${error}`);
      }
    }
  },




  /**
   * Connect to the matrix over TCP or UDP.
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
	  this.checkFeedbacks();
    });
  },


  
  requestVideoStatus(output) {
	if (output > 0) {
      let cmd = this.makeCommand(this.REQUEST_VIDEO_STATUS, 0, output,1);
      this.trySendMessage(cmd);
	}
    else {
      for (let i = 1; i <= this.config.outputCount; i++) {
        let cmd = this.makeCommand(this.REQUEST_VIDEO_STATUS, 0, i,1);
        this.trySendMessage(cmd);
      }
    }
  },
  
  
  
  requestAudioStatus(output) {
    if (output > 0) {
      let cmd = this.makeCommand(this.REQUEST_AUDIO_STATUS, 0, output,1);
      this.trySendMessage(cmd);
    }
    else {
      for (let i = 1; i <= this.config.outputCount; i++) {
        let cmd = this.makeCommand(this.REQUEST_AUDIO_STATUS, 0, i,1);
        this.trySendMessage(cmd);
      }
    }
  }
  

}
