const simpleEval = require('simple-eval');

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
          this.log("debug", `Kramer command: ${cmd}`);
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
          const output = simpleEval(await
            context.parseVariablesInString(event.options.output)
          );
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
            useVariables: true,
            name: "Output #",
            id: "output",
            default: "0",
          },
        ],
        callback: async (event, context) => {
          const output = parseInt(
            context.parseVariablesInString(event.options.output)
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
          this.log("debug", `Kramer command: ${cmd}`);
          try {
            this.socket.send(cmd);
          } catch (error) {
            this.log("error", `${error}`);
          }
        },
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

          try {
            this.socket.send(cmd);
          } catch (error) {
            this.log("error", `${error}`);
          }
        },
      },
      switchVideoDynamic: {
        name: "Switch Video (Dynamic)",
        options: [
          {
            type: "textinput",
            useVariables: true,
            name: "Input #",
            id: "input",
            default: "0",
          },
          {
            type: "textinput",
            useVariables: true,
            name: "Output #",
            id: "output",
            default: "0",
          },
        ],
        callback: async (event, context) => {
          const input = parseInt(
            context.parseVariablesInString(event.options.input)
          );
          const output = parseInt(
            context.parseVariablesInString(event.options.output)
          );
          let cmd = this.makeCommand(this.SWITCH_VIDEO, input, output);
          try {
            this.socket.send(cmd);
          } catch (error) {
            this.log("error", `${error}`);
          }
        },
      },

      switchAudioDynamic: {
        name: "Switch Audio (Dynamic)",
        options: [
          {
            type: "textinput",
            useVariables: true,
            name: "Input #",
            id: "input",
            default: "0",
            regex: "/^\\d*$/",
          },
          {
            type: "textinput",
            useVariables: true,
            name: "Output #",
            id: "output",
            default: "0",
            regex: "/^\\d*$/",
          },
        ],
        callback: async (event, context) => {
          const input = parseInt(
            context.parseVariablesInString(event.options.input)
          );
          const output = parseInt(
            context.parseVariablesInString(event.options.output)
          );
          let cmd = this.makeCommand(this.SWITCH_AUDIO, input, output);
          try {
            this.socket.send(cmd);
          } catch (error) {
            this.log("error", `${error}`);
          }
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
          try {
            this.socket.send(cmd);
          } catch (error) {
            this.log("error", `${error}`);
          }
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
          try {
            this.socket.send(cmd);
          } catch (error) {
            this.log("error", `${error}`);
          }
        },
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
          try {
            this.socket.send(cmd);
          } catch (error) {
            this.log("error", `${error}`);
          }
        },
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
              { id: "0", name: "Unlock" },
              { id: "1", name: "Lock" },
            ],
          },
        ],
        callback: async (event) => {
          let cmd = this.makeCommand(this.FRONT_PANEL, event.options.status, 0);
          try {
            this.socket.send(cmd);
          } catch (error) {
            this.log("error", `${error}`);
          }
        },
      },
    });
  }


}