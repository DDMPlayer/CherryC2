const fs = require("fs");
const path = require("path");
const s = path.sep;

const modsNameList = fs.readdirSync(`.${s}mods`);
const mods = [];

var runtime;
var system;

require('nw.gui').Window.get().showDevTools();

if(!fs.existsSync(`.${s}mods${s}`)) {
	fs.mkdirSync(`.${s}mods${s}`)
}

//#region Mod Loading
	for(var i = 0, len = modsNameList.length; i < len; i++) {
		let currentModID = modsNameList[i];
		if(fs.existsSync(`.${s}mods${s}`+currentModID+`${s}index.js`)) {
			import(`../mods/`+currentModID+`/index.js`).then(mod => {
				if(mod != null) {
					mods.push(mod);
					CherryLog(`Mod "${currentModID}" loaded successfully.`);
					CallModEvent("Initialize",[],mod)
				} else {
					CherryError(`Unknown error happened while loading mod "${currentModID}".`);
				}
			});
		} else {
			CherryError(`index.js for "${currentModID}" not found.`);
		}
	}
//#endregion

//#region Hooks
	function attempt_runtime_hooks() {
		var runtime_func = window.cr_getC2Runtime;
		if(runtime_func == null) return setTimeout(attempt_runtime_hooks, 5);

		var c2_runtime = runtime_func();
		if(c2_runtime   == null) return setTimeout(attempt_runtime_hooks, 1);

		runtime = c2_runtime;
		reload();
		


		let originalEveryTick = c2_runtime.tick;
		
		c2_runtime.tick = function(background_wake, timestamp, debug_step) {
		    cherry_tick_hook.apply(this, arguments);
		    originalEveryTick.apply(this, arguments);
		};
		

		
		let originalTrigger = c2_runtime.trigger;
		
		c2_runtime.trigger = function(background_wake, timestamp, debug_step) {
		    cherry_trigger_hook.apply(this, arguments);
		    originalTrigger.apply(this, arguments);
		};

		CherryLog("Successfully binded hooks!");
	}

	attempt_runtime_hooks();



	function cherry_tick_hook(background_wake, timestamp, debug_step) {
		CallEvent("EveryTick", arguments)
	}


	function cherry_trigger_hook(method, inst, value) {
		system = cr.system_object.prototype;
		reload();

		if(runtime == null) return;
		if(system == null) return;
		if(!runtime.running_layout) return;

		switch(method) {
			case system.cnds.OnLoadFinished:
				CallEvent("LoadFinished");
				break;
			case system.cnds.OnLayoutStart:
				CallEvent("LayoutStart");
				break;
			case system.cnds.OnLayoutEnd:
				CallEvent("LayoutEnd");
				break;
		}

		CallEvent("Trigger", arguments)
	}
//#endregion

//#region Utility Functions
	function CherryLog(msg) {
		console.log(`[Cherry] ${msg}`);
	}

	function CherryError(msg) {
		console.error(`[Cherry] ERROR: ${msg}`);
	}

	function CallEvent(event,args = []) {
		for(var i = 0, len = mods.length; i < len; i++) {
			CallModEvent(event,args,mods[i]);
		}
	}

	function CallModEvent(event,args,mod) {
		let func = mod[event];
		runtime.Cherry = this; 
		if(typeof func === "function") func.apply(runtime,args);
	}
//#endregion

function reload() {
	window.Cherry = {
		CherryInstance: this,
		Log: CherryLog,
		Error: CherryError,
		CallEvent: CallEvent,
		Runtime: runtime,
		SystemProto: system,
	};

	CallEvent("UpdateCherry")
}