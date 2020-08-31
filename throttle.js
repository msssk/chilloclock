const DEFAULT_DELAY = 16;
export function throttle(callback, delay = DEFAULT_DELAY) {
	let ready = true;
	let callbackArgs;
	let wasInvoked = false;
	function readyCallback() {
		if (wasInvoked) {
			callback.apply(this, callbackArgs);
			callbackArgs = undefined;
			wasInvoked = false;
			setTimeout(readyCallback, delay);
		}
		else {
			ready = true;
		}
	}
	return function (...args) {
		if (ready) {
			ready = false;
			setTimeout(readyCallback, delay);
			callback.apply(this, args);
		}
		else {
			callbackArgs = args;
			wasInvoked = true;
		}
	};
}
