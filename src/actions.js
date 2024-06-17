const simpleEval = require('simple-eval').default;

module.exports = {
	  
    /**
   * Creates the actions for this module.
   */
  initActions() {
	this.log('debug', 'Initializing actions');
    let inputOpts = [{ id: "0", label: "Off" }];
    let outputOpts = [{ id: "0", label: "All" }];
    let setups = [];

    // Set some sane minimum/maximum values on the capabilities
    let inputCount = Math.min(64, Math.max(1, this.config.inputCount));
    let outputCount = Math.min(64, Math.max(1, this.config.outputCount));
    let setupsCount = Math.min(64,this.config.setupsCount);

    // Build the inputs, outputs, and setups
    for (let i = 1; i <= inputCount; i++) {
      inputOpts.push({ id: i, label: `Input ${i}` });
    }
    for (let i = 1; i <= outputCount; i++) {
      outputOpts.push({ id: i, label: `Output ${i}` });
    }
    for (let i = 1; i <= setupsCount; i++) {
      setups.push({ id: i, label: `Preset ${i}` });
    }


    this.setActionDefinitions({
		
		
      selectOutput: {
        name: "Select output",
		options : [
		  {
            type: "dropdown",
            name: "Output #",
            id: "output",
            default: "0",
            choices: outputOpts,
          },
        ],
        callback: async (event) => {
		  this.selectedDestination = event.options.output;
		  this.checkVariables ('selection');
		}
	  },
		
	  selectOutputDynamic: {
        name: "Select output (dynamic)",
		options : [
		  {
            type: "textinput",
            useVariables: {local : true},
            name: "Output #",
            id: "output",
            default: "0",
          },
        ],
        callback: async (event, context) => {console.log('output selection');
		  const output = simpleEval(await context.parseVariablesInString(event.options.output));
		  this.selectedDestination = output;
		  this.checkVariables ('selection');
		}
	  },
				
      selectVideoInput: {
        name: "Select video input",
		options : [
		  {
            type: "dropdown",
            name: "input #",
            id: "input",
            default: "0",
            choices: inputOpts,
          },
        ],
        callback: async (event) => {
		  this.selectedVideoSource = event.options.input;
		  this.checkVariables ('selection');
		}
	  },
		
	  selectVideoInputDynamic: {
        name: "Select video input (dynamic)",
		options : [
		  {
            type: "textinput",
            useVariables: {local : true},
            name: "input #",
            id: "input",
            default: "0",
          },
        ],
        callback: async (event, context) => {
		  const input = simpleEval(await context.parseVariablesInString(event.options.input));
		  this.selectedVideoSource = input;
		  this.checkVariables ('selection');
		}
	  },
			
		
      selectAudioInput: {
        name: "Select audio input",
		options : [
		  {
            type: "dropdown",
            name: "input #",
            id: "input",
            default: "0",
            choices: inputOpts,
          },
        ],
        callback: async (event) => {
		  this.selectedAudioSource = event.options.input;
		  this.checkVariables ('selection');
		}
	  },
		
	  selectAudioInputDynamic: {
        name: "Select audio input (dynamic)",
		options : [
		  {
            type: "textinput",
            useVariables: {local : true},
            name: "input #",
            id: "input",
            default: "0",
          },
        ],
        callback: async (event, context) => {
		  const input = simpleEval(await context.parseVariablesInString(event.options.input));
		  this.selectedAudioSource = input;
		  this.checkVariables ('selection');
		}
	  },
							
		
      requestAudio: {
        name: "Request Audio Source routed to destination",
        options: [
          {
            type: "dropdown",
            name: "Output #",
            id: "output",
            default: "0",
            choices: outputOpts,
          },
        ],
        callback: async (event) => {
		  this.requestAudioStatus(event.options.output);
          //this.log("debug", `Kramer command: ${cmd}`);
        },
      },
	
      requestAudioDynamic: {
        name: "Request Audio Source routed to destination (dynamic)",
        options: [
          {
            type: "textinput",
            useVariables: {local : true},
            name: "Output #",
            id: "output",
            default: "0",
          },
        ],
        callback: async (event, context) => {
          const output = simpleEval(await context.parseVariablesInString(event.options.output));
          this.requestAudioStatus(output);
        },
      },
	  
      requestVideo: {
        name: "Request Video Source routed to destination",
        options: [
          {
            type: "dropdown",
            name: "Output #",
            id: "output",
            default: "0",
            choices: outputOpts,
          },
        ],
        callback: async (event) => {
		  this.requestVideoStatus(event.options.output);
        },
      },
	  	
      requestVideoDynamic: {
        name: "Request Video Source routed to destination (dynamic)",
        options: [
          {
            type: "textinput",
            useVariables: {local : true},
            name: "Output #",
            id: "output",
            default: "0",
          },
        ],
        callback: async (event, context) => {
          const output = simpleEval(await context.parseVariablesInString(event.options.output)
          );
          this.requestVideoStatus(output);
        },
      },
	  
	  
      switchAudio: {
        name: "Switch Audio",
        options: [
          {
            type: "dropdown",
            name: "Input #",
            id: "input",
            default: "0",
            choices: inputOpts,
          },
          {
            type: "dropdown",
            name: "Output #",
            id: "output",
            default: "0",
            choices: outputOpts,
          },
        ],
        callback: async (event) => {
          let cmd = this.makeCommand(
            this.SWITCH_AUDIO,
            event.options.input,
            event.options.output
          );
         // this.log("debug", `Kramer command: ${cmd}`);
		 this.trySendMessage(cmd);
/*          try {
            this.socket.send(cmd);
          } catch (error) {
            this.log("error", `${error}`);
          }
*/        },
      },
      switchVideo: {
        name: "Switch Video",
        options: [
          {
            type: "dropdown",
            name: "Input #",
            id: "input",
            default: "0",
            choices: inputOpts,
          },
          {
            type: "dropdown",
            name: "Output #",
            id: "output",
            default: "0",
            choices: outputOpts,
          },
        ],
        callback: async (event) => {
          let cmd = this.makeCommand(
            this.SWITCH_VIDEO,
            event.options.input,
            event.options.output
          );
		  this.trySendMessage(cmd);
        },
      },
	  
      switchVideoDynamic: {
        name: "Switch Video (Dynamic)",
        options: [
          {
            type: "textinput",
            useVariables: {local : true},
            name: "Input #",
            id: "input",
            default: "0",
          },
          {
            type: "textinput",
            useVariables: {local : true},
            name: "Output #",
            id: "output",
            default: "0",
          },
        ],
        callback: async (event, context) => {
		  const input = simpleEval(await context.parseVariablesInString(event.options.input));
		  const output = simpleEval(await context.parseVariablesInString(event.options.output));
          let cmd = this.makeCommand(this.SWITCH_VIDEO, input, output);
		  this.trySendMessage(cmd);
        },
      },

      switchAudioDynamic: {
        name: "Switch Audio (Dynamic)",
        options: [
          {
            type: "textinput",
            useVariables: {local : true},
            name: "Input #",
            id: "input",
            default: "0",
            regex: "/^\\d*$/",
          },
          {
            type: "textinput",
            useVariables: {local : true},
            name: "Output #",
            id: "output",
            default: "0",
            regex: "/^\\d*$/",
          },
        ],
        callback: async (event, context) => {
		  const input = simpleEval(await context.parseVariablesInString(event.options.input));
		  const output = simpleEval(await context.parseVariablesInString(event.options.output));

          let cmd = this.makeCommand(this.SWITCH_AUDIO, input, output);
		  this.trySendMessage(cmd);
        },
      },

      recall_setup: {
        name: "Recall Preset",
        options: [
          {
            type: "dropdown",
            name: "Preset",
            id: "setup",
            default: "1",
            choices: setups,
          },
        ],
        callback: async (event) => {
          let cmd = this.makeCommand(this.RECALL_SETUP, event.options.setup, 0);
		  this.trySendMessage(cmd);
        },
      },

      store_setup: {
        name: "Store Preset",
        options: [
          {
            type: "dropdown",
            name: "Preset",
            id: "setup",
            default: "1",
            choices: setups,
          },
        ],
        callback: async (event) => {
          let cmd = this.makeCommand(
            this.STORE_SETUP,
            event.options.setup,
            0 /* STORE */
          );
		  this.trySendMessage(cmd);
/*          try {
            this.socket.send(cmd);
          } catch (error) {
            this.log("error", `${error}`);
          }
*/        },
      },

      delete_setup: {
        name: "Delete Preset",
        options: [
          {
            type: "dropdown",
            name: "Preset",
            id: "setup",
            default: "1",
            choices: setups,
          },
        ],

        callback: async (event) => {
          // Not a bug. The command to delete a setup is to store it.
          let cmd = this.makeCommand(
            this.STORE_SETUP,
            event.options.setup,
            1 /* DELETE */
          );
		  this.trySendMessage(cmd);
/*          try {
            this.socket.send(cmd);
          } catch (error) {
            this.log("error", `${error}`);
          }
*/        },
      },

      front_panel: {
        name: "Front Panel Lock",
        options: [
          {
            type: "dropdown",
            name: "Status",
            id: "status",
            default: "0",
            choices: [
              { id: "0", label: "Unlock" },
              { id: "1", label: "Lock" },
            ],
          },
        ],
        callback: async (event) => {
          let cmd = this.makeCommand(this.FRONT_PANEL, event.options.status, 0);
		  this.trySendMessage(cmd);
        },
      },
	  
	  take: {
        name: "Take",
		options: [
		  {
		    type : "dropdown",
		    name: "Audio , Video or Both",
		    id: "type",
		    default: "0",
		    choices: [
		      {id: "0", label: "Audio & Video" },
			  {id: this.SWITCH_VIDEO, label: "Video"},
			  {id: this.SWITCH_AUDIO, label: "Audio" }
            ]
		  }
	    ],
	    callback: async (event) => {
		  if (this.selectedDestination == "") {
		    return;
		  }
		  switch (event.options.type) {
            case "0" : {
			  if (this.selectedAudioSource > 0) {
		        let cmd = this.makeCommand(this.SWITCH_AUDIO, this.selectedAudioSource, this.selectedDestination);
		        this.selectedAudioSource = "";
		        this.trySendMessage(cmd);
			  }
			}
			case this.SWITCH_VIDEO : {
			  if (this.selectedVideoSource > 0) {
			    let cmd = this.makeCommand(this.SWITCH_VIDEO, this.selectedVideoSource, this.selectedDestination);
		        this.selectedVideoSource = "";
		        this.selectedDestination = "";
		        this.trySendMessage(cmd);
			    }
			  break;
			}
			case this.SWITCH_AUDIO : {
			  if (this.selectedAudioSource > 0) {
		        let cmd = this.makeCommand(this.SWITCH_AUDIO, this.selectedAudioSource, this.selectedDestination);
		        this.selectedAudioSource = "";
		        this.selectedDestination = "";
                this.trySendMessage(cmd);
			  }
			}
		  }
		  this.checkVariables("selection");
		}
    },
	
	  clear: {
        name : "Clear",
		options: [],
	    callback: async (event) => {
		  this.selectedAudioSource = "";
		  this.selectedVideoSource = "";
		  this.selectedDestination = "";
		  this.checkVariables("selection");
		}
    }
	
	
	
  });

  this.inputOpts = inputOpts;
  this.outputOpts =outputOpts;
  }


}