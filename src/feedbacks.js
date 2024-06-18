const {
  combineRgb
} = require("@companion-module/base");

const simpleEval = require('simple-eval').default;


module.exports = {
	  
    /**
   * Creates the feedbacks for this module.
   */
  initFeedbacks() {
	  
  	this.log ('debug', 'Initializing feedbacks');
	
    let inputOpts = this.inputs;
    let outputOpts = this.outputs;
    let setups = this.setups;

	
	
    let feedbacks = {};
    
    feedbacks['input_bg'] = {
        type: 'boolean',
        name: 'Change background color by destination',
        description: 'If the input specified is in use by the output specified, change background color of the bank',
        defaultStyle: {
            color: combineRgb(0, 0, 0),
            bgcolor: combineRgb(255, 255, 0),
        },
        options: [
            {
                type: 'dropdown',
                label: 'Input',
                id: 'input',
                default: "0",
                choices: inputOpts
            },
            {
                type: 'dropdown',
                label: 'Output',
                id: 'output',
                default: "0",
                choices: outputOpts
            },
        ],
        callback: (feedback) => {
            return (this.outputs[output]?.videoSource == feedback.options.input);
        },
    };

    feedbacks['input_bg_dyn'] = {
      type: 'boolean',
      name: 'Change background color by destination (dynamic)',
      description: 'If the input specified is in use by the output specified, change background color of the bank',
      defaultStyle: {
        color: combineRgb(0, 0, 0),
        bgcolor: combineRgb(255, 255, 0),
      },
      options: [
        {
          type: 'textinput',
          label: 'Output',
          id: 'output',
          default: '',
          useVariables: {local: true}
        },
        {
          type: 'textinput',
          label: 'Input',
          id: 'input',
          default: '',
          useVariables: {local: true}
        },
      ],
      callback: async function (feedback, context) {
        let outputNum = await context.parseVariablesInString(feedback.options.output);
        let inputNum= await context.parseVariablesInString(feedback.options.input);
        let outputId = simpleEval(outputNum);
        let inputId = simpleEval(inputNum);

        return (this.outputs[output]?.videoSource == inputId)
      },
    };
        
                feedbacks['selected_destination'] = {
                type: 'boolean',
                name: 'Change background color by selected destination',
                description: 'If the output specified is selected, change background color of the bank',
                defaultStyle: {
                        color: combineRgb(0, 0, 0),
                        bgcolor: combineRgb(255, 255, 0),
                },
                options: [
                        {
                                type: 'dropdown',
                                label: 'Output',
                                id: 'output',
                                default: 0,
                                choices: this.outputOpts,
                        },
                ],
                callback: (feedback) => {
                    return feedback.options.output == this.selectedDestination;
                },
        },

        feedbacks['selected_destination_dyn'] = {
                type: 'boolean',
                name: 'Change background color by selected destination (dynamic)',
                description: 'If the output specified is selected, change background color of the bank',
                defaultStyle: {
                        color: combineRgb(0, 0, 0),
                        bgcolor: combineRgb(255, 255, 0),
                },
                options: [
                        {
                                type: 'textinput',
                                label: 'Output',
                                id: 'output',
                                default: '',
                                useVariables: {local: true}
                        },
                ],
                callback: async function (feedback, context) {
                        let outputNum = await context.parseVariablesInString(feedback.options.output);
                        let outputId = simpleEval(outputNum);
                        return (outputId == this.selectedDestination);
                },
        },


        feedbacks['selected_output_source'] = {
                type: 'boolean',
                name: 'Change background color by route to selected destination',
                description: 'If the video input specified is in use by the selected output, change background color of the bank',
                defaultStyle: {
                        color: combineRgb(0, 0, 0),
                        bgcolor: combineRgb(255, 255, 255),
                },
                options: [
                        {
                                type: 'dropdown',
                                label: 'Input',
                                id: 'input',
                                default: 0,
                                choices: this.inputOpts,
                        },
                ],
                callback: (feedback) => {
                        return (this.outputs[this.selectedDestination]?.videoSource == feedback.options.input);
                },
        }

        feedbacks['selected_output_source_dyn'] = {
                type: 'boolean',
                name: 'Change background color by route to selected destination (dynamic)',
                description: 'If the video input specified is in use by the selected output, change background color of the bank',
                defaultStyle: {
                        color: combineRgb(0, 0, 0),
                        bgcolor: combineRgb(255, 255, 255),
                },
                options: [
                        {
                                type: 'textinput',
                                label: 'Input',
                                id: 'input',
                                default: '',
                                useVariables: {local: true}
                        },
                ],
                callback: async function (feedback, context) {
                        let inputNum = await context.parseVariablesInString(feedback.options.input);
                        let inputId = simpleEval(inputNum);
                        return (this.outputs[this.selectedDestination]?.videoSource == inputId)
                },
        }

        feedbacks['selected_source'] = {
                type: 'boolean',
                name: 'Change background color by selected source',
                description: 'If the input specified is selected, change background color of the bank',
                defaultStyle: {
                        color: combineRgb(0, 0, 0),
                        bgcolor: combineRgb(255, 255, 255),
                },
                options: [
                        {
                                type: 'dropdown',
                                label: 'Input',
                                id: 'input',
                                default: 0,
                                choices: this.inputOpts,
                        },
                ],
                callback: (feedback) => {
                        return this.selectedSource == feedback.options.input;
                },
        }

        feedbacks['selected_source_dyn'] = {
                type: 'boolean',
                name: 'Change background color by selected source (dynamic)',
                description: 'If the input specified is selected, change background color of the bank',
                defaultStyle: {
                        color: combineRgb(0, 0, 0),
                        bgcolor: combineRgb(255, 255, 255),
                },
                options: [
                        {
                                type: 'textinput',
                                label: 'Input',
                                id: 'input',
                                default: '',
                                useVariables: {local: true}
                        },
                ],
                callback: async function (feedback, context) {
                        let inputNum = await context.parseVariablesInString(feedback.options.input);
                        let inputId = simpleEval(inputNum)
                        return this.selectedSource = inputId;
                },
        }


        feedbacks['take'] = {
                type: 'boolean',
                name: 'Change background color if take has a route queued',
                description: 'If a route is queued for take, change background color of the bank',
                defaultStyle: {
                        color: combineRgb(255, 255, 255),
                        bgcolor: combineRgb(255, 0, 0),
                },
                options: [],
                callback: () => {
                        return (this.selectedDestination && this.selectedSource);
                },
        }

	this.setFeedbackDefinitions(feedbacks);
	
  }
  
  
  
}