module.exports = {
  
    // Decimal codes for the instructions supported by Kramer Matrix (Protocol 2000).
  // See https://kramerav.com/support/download.asp?f=35567
  // See https://kramerav.com/downloads/protocols/protocol_2000_rev0_51.pdf
  SWITCH_VIDEO = 1,
  SWITCH_AUDIO = 2,
  STORE_SETUP = 3,
  RECALL_SETUP = 4,
  REQUEST_VIDEO_STATUS = 5,
  REQUEST_AUDIO_STATUS = 6,
  FRONT_PANEL = 30,
  DEFINE_MACHINE = 62,

  CAPS_VIDEO_INPUTS = 1,
  CAPS_VIDEO_OUTPUTS = 2,
  CAPS_SETUPS = 3,

  //  Define the protocols this module may support:
  PROTOCOL_2000 = "2000",
  PROTOCOL_3000 = "3000",

  // Define the possible parameters to disconnect an output:
  DISCONNECT_0 = "0",
  DISCONNECT_INP1 = "+1",
  
  
  

  // Protocol 2000: The most significant bit for bytes 2-4 must be 1. Adding 128 to
  //  each of those bytes accomplishes this.
  MSB = 128,
  
  
  
  // Internal variables reflecting the state of the matrix
  videoRouting = [],
  audioRouting = [],
  reverseVideoRouting = [[]],
  reverseAudioRouting = [[]],
  selectedSource = -1,
  selectedDestination = -1,

    /**
   * Handles a response from a Protocol 2000 matrix.
   *
   * @param data     The data received from the matrix (ArrayBuffer)
   */
   
  receivedData2000 (data) {
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

        // Decrement the counter now that it responded. Save the config
        //  if all the requests responded.
        if (--this.capabilityWaitingResponsesCounter === 0) {
          // Update the actions now that the new capabilities have been stored.
          this.saveConfig(this.config);
        }
        break;
	  case this.REQUEST_VIDEO_STATUS : 
	    // Look for the requested parameter 
	    output = this.outBuffer[0][2] ^ this.MSB;
		input = data[2] ^ this.MSB;
      case this.SWITCH_VIDEO : {
        let formerInput = this.videoRouting[output];
        this.videoRouting[output] = input;
this.log('debug', 'Output ' + output + ' / former input : ' + formerInput);
		if (this.reverseVideoRouting[formerInput] && this.reverseVideoRouting[formerInput].length > 0) {
		  let index = this.reverseVideoRouting[formerInput].indexOf(output);
		  if (index > -1) {
            this.reverseVideoRouting[formerInput].splice(index, 1);
          }
		} 
		else {
		this.log('debug', 'routing empty');  
		}
		if (this.reverseVideoRouting[input]) {
          this.reverseVideoRouting[input].push(output);
		}
        this.checkVariables('routing', 'video', output);
        break;
      }
      case this.REQUEST_AUDIO_STATUS : 
	    output = this.outBuffer[0][2] ^ this.MSB;
		input = data[2] ^ this.MSB;
      case this.SWITCH_AUDIO : {
        let formerInput = this.audioRouting[output];
        this.audioRouting[output] = input;
        let index = this.reverseAudioRouting[formerInput].indexOf(output);
        if (index > -1) {
          this.reverseAudioRouting[formerInput].splice(index, 1);
        }
        this.reverseAudioRouting[input].push(output);
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
  receivedData3000(data) {
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
      this.initActions();
      this.initVariables();
      this.initRouting();
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
/*		  try {
            this.socket.send(cmd);
          } catch (error) {
            this.log("error", `${error}`);
          }
*/	  }
	  else {
		  for (let i = 1; i <= this.config.outputCount; i++) {
			let cmd = this.makeCommand(this.REQUEST_VIDEO_STATUS, 0, i,1);
		    this.trySendMessage(cmd);
/*	  	      try {
                this.socket.send(cmd);
                } catch (error) {
              this.log("error", `${error}`);
            }
*/	        }
	  }
  },
  
  
  
  requestAudioStatus(output) {
	  if (output > 0) {
		  let cmd = this.makeCommand(this.REQUEST_AUDIO_STATUS, 0, output,1);
		  this.trySendMessage(cmd);
/*		  try {
            this.socket.send(cmd);
          } catch (error) {
            this.log("error", `${error}`);
          }
*/	  }
	  else {
		  for (let i = 1; i <= this.config.outputCount; i++) {
			let cmd = this.makeCommand(this.REQUEST_AUDIO_STATUS, 0, i,1);
		    this.trySendMessage(cmd);
/*	  	      try {
                this.socket.send(cmd);
                } catch (error) {
              this.log("error", `${error}`);
            }
*/	        }
	  }
  },
  
  

  // Buffers message, then sends it if not waiting for a response.

  trySendMessage(cmd) {
    if (this.outBuffer.push(cmd) == 1) {
      this.sendMessage();
    }
  },

  // Acknowledges response from device, and send next message.
  ackResponse () {
	this.attempts = 0;
	clearTimeout(this.timeoutId);
	setTimeout(() => {
	  this.outBuffer?.shift();
      this.sendMessage();
	}, this.NEXT_MESSAGE_TIMEOUT)
  },


  // Timeout function to handle long waiting state
  
  lateResponse() {
	if (this.outBuffer?.length > 0) {
	  if (this.attempts < this.MAX_ATTEMPTS) {
        this.sendMessage();
	  }
	  else {
	    this.log('error', 'error waiting for message : ' + this.outBuffer[0]);
		this.ackResponse();
	  }
	}
  },

 
  // Sends next message from buffer

  sendMessage() {
    let cmd = this.outBuffer[0];
    if (cmd) {
      try {
		this.attempts++;
		let cmdstring = '';
		for (let i=0; i<4; i++){
		  cmdstring += (Number(cmd[i]) + ',');
		}
		this.log('debug', 'sending message : ' + cmdstring);
		clearTimeout(this.timeoutId);
		this.timeoutId = setTimeout(() => {
			this.lateResponse();
		  }, 
		  this.RESPONSE_TIMEOUT
		);
		this.socket.send(cmd);
	  }
	  catch (error) {
          this.log("error", `${error}`);
      }
    }
  },


}
