module.exports = {

  
  /**
   * Creates variables.
   */
  
  initVariables() {
	this.log ('debug', 'Initializing variables');
    let variables = [];

    variables.push({ variableId : 'selectedVideoSource', name : 'Selected video source'});  
    variables.push({ variableId : 'selectedAudioSource', name : 'Selected audio source'});  
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
  },


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
        }
        break;
      case 'selection' :
        variableValues['selectedVideoSource'] = this.selectedVideoSource;
        variableValues['selectedAudioSource'] = this.selectedAudioSource;
        variableValues['selectedDestination'] = this.selectedDestination;

        break;

      default : 
        checkVariables('routing');
        checkVariables('selection');
    }

    if (Object.keys(variableValues).length > 0) {
      this.setVariableValues(variableValues);
    }
  }
  
}