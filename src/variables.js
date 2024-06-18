module.exports = {

  
  /**
   * Creates variables.
   */
  
  initVariables() {
	this.log ('debug', 'Initializing variables');
    let variables = [];

    variables.push({ variableId : 'selectedSource', name : 'Selected source'});  
    variables.push({ variableId : 'selectedDestination', name : 'Selected destination'});  


    // Set some sane minimum/maximum values on the capabilities
    let inputCount = Math.min(64, this.config.inputCount);
    let outputCount = Math.min(64, this.config.outputCount);
    let setupsCount = Math.min(64, this.config.setupsCount);

    for (let i = 1; i <= outputCount; i++) {
      variables.push({ variableId : 'Output_'+ i + '_video_source', name : 'Output #' + i + ' video source'});  
      variables.push({ variableId : 'Output_'+ i + '_audio_source', name : 'Output #' + i + ' audio source'});  
      variables.push({ variableId : 'Output_'+ i + '_label', name : 'Output #' + i + ' label'});  
    }

    for (let i = 1; i <= inputCount; i++) { 
      variables.push({ variableId : 'Input_' + i + '_label', name : 'Input #' + i + ' label'});
      variables.push({ variableId : 'Input_' + i + '_routes', name : 'Input #' + i + ' routes'});
    }
    this.setVariableDefinitions(variables);
  },


  checkVariables(category, type, destination) {
    let variableValues = {};
    switch (category) {
      case 'routing' :
        if (type == 'video' || type == 'audio') {
          if (destination > 0) {
            variableValues['Output_' + destination + '_' + type + '_source'] = this.outputs[destination][type+'Source'];
          }
          else {
            let outputCount = this[type + 'Routing'].length();
            for (i = 1; i < outputCount; i++) {
              variableValues['Output_' + i + '_' + type + '_source'] = this.outputs[i][type+'Routing'];
            }
          }
        }
        else {
          checkVariables('routing', 'video', destination);
          checkVariables('routing', 'audio', destination);
        }
        break;
      case 'selection' :
        variableValues['selectedSource'] = this.selectedSource;
        variableValues['selectedDestination'] = this.selectedDestination;

        break;
		
	  case 'labels' :
	    this.inputs.forEach((input) => {
		variableValues['Input_' + input.id + '_label'] = input.label;
		});
		this.outputs.forEach((output) => {
		variableValues['Output_' + output.id + '_label'] = output.label;
		});
		
		break;

      default : 
        checkVariables('routing');
        checkVariables('selection');
		checkVariables('labels');
    }

    if (Object.keys(variableValues).length > 0) {
      this.setVariableValues(variableValues);
    }
  }
  
}