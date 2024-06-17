module.exports = {
	  
    /**
   * Creates the feedbacks for this module.
   */
  initFeedbacks() {
	  
	this.log ('debug', 'Initializing variables');
    let feedbacks = {};
	this.log('debug', 'feedbacks 0');
	
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
                default: 0,
                choices: inputOpts,
            },
            {
                type: 'dropdown',
                label: 'Output',
                id: 'output',
                default: 0,
                choices: outputOpts,
            },
        ],
        callback: (feedback) => {
            return (this.videoRouting[output] == input);
        },
    };
	this.log('debug', 'feedbacks');
	this.setFeedbackDefinitions(feedbacks);
	
  }
  
  
  
}