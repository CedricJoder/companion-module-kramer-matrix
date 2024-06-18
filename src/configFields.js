const {
  Regex,
} = require("@companion-module/base");


module.exports = {


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
		  type: "textinput",
		  id: "assignations",
	  label: "Assignation file"
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
  }
  
}