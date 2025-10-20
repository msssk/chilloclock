import { calcSunriseSet, getJD } from './astro.js';
import { throttle } from './throttle.js';

const HELP_FADE_DELAY = 3000;
const MINUTES_PER_DAY = 24 * 60;
const TWELVE_HOURS_IN_MS = 12 * 60 * 60 * 1000;

const config = new Proxy(JSON.parse(localStorage.getItem('chilloclock') || '{}'), {
	get (target, property) {
		return target[property];
	},
	set (target, property, value) {
		target[property] = value;
		requestAnimationFrame(function () {
			localStorage.setItem('chilloclock', JSON.stringify(target));
		});

		return true;
	},
});

const helpIconNode = document.getElementById('helpIcon');
const welcomeNode = document.getElementById('welcome');
const closeIcon = welcomeNode.querySelector('.closeIcon');
const clockNode = document.querySelector('.chilloclock');
const fadeOverlayNode = document.querySelector('.fadeOverlay');

if (config.baseSize) {
	clockNode.style.setProperty('--base-size', `${config.baseSize}px`);
}

let isNight = false;
let sunrise;
let sunset;
let updateHandle = 0;

// during the day this will be sunrise.timelocal
// during the night sunset.timelocal
let timePeriodBegin;

// during the day this will be sunset.timelocal - sunrise.timelocal
// during the night this will be nextDaySunrise.timelocal - sunset.timelocal
let timePeriodDuration;

// 10 seconds - the angle only actually changes about once every minute
const updateFrequency = 10 * 1000;

function update () {
	clearTimeout(updateHandle);
	const now = new Date();
	const timeInMinutes = (now.getHours() * 60) + now.getMinutes();
	const isAfterMidnight = timeInMinutes < timePeriodBegin;
	const percentOfTimePeriodElapsed = isAfterMidnight ?
		((timeInMinutes + MINUTES_PER_DAY - sunset.timelocal) / timePeriodDuration) :
		((timeInMinutes - timePeriodBegin) / timePeriodDuration);

	if (percentOfTimePeriodElapsed > 1) {
		initClock(config.geolocation.latitude, config.geolocation.longitude);
		return;
	}

	// narrow interpretation of twilight as 10 minutes preceding sunset/sunrise
	const isTwilight = isAfterMidnight ?
		(sunrise.timelocal - timeInMinutes) < 10 :
		(sunset.timelocal - timeInMinutes) < 10;

	if (isTwilight) {
		if (isAfterMidnight) {
			if (!fadeOverlayNode.classList.contains('morningFade')) {
				fadeOverlayNode.classList.add('morningFade');
			}
			else if(!fadeOverlayNode.classList.contains('nightFade')) {
				fadeOverlayNode.classList.add('nightFade');
			}
		}
	}

	const armAngle = (180 * percentOfTimePeriodElapsed) + (isNight ? 0 : 180);
	clockNode.style.setProperty('--arm-angle', `${armAngle}deg`);
	updateHandle = setTimeout(update, updateFrequency);
}

helpIconNode.addEventListener('animationend', function (event) {
	if (event.target.classList.contains('fadeout')) {
		event.target.classList.remove('fadeout');
		event.target.hidden = true;
	}
	else {
		event.target.classList.remove('fadein');
	}
});

let helpFadeHandle = 0;
function fadeoutHelp () {
	helpIconNode.classList.add('fadeout');
}

function showHelpIcon () {
	clearTimeout(helpFadeHandle);

	helpIconNode.classList.remove('fadeout');

	if (helpIconNode.hidden) {
		helpIconNode.classList.add('fadein');
		helpIconNode.hidden = false;
	}

	helpFadeHandle = setTimeout(fadeoutHelp, HELP_FADE_DELAY);
}

function hideWelcome () {
	welcomeNode.hidden = true;
}

function onKeydown (event) {
	if (event.key === 'Escape') {
		hideWelcome();
	}
}

document.addEventListener('keydown', onKeydown);
document.body.addEventListener('pointermove', throttle(showHelpIcon, 500));

closeIcon.addEventListener('click', hideWelcome);

function initClock (latitude, longitude) {
	config.geolocation = { latitude, longitude };

	const now = new Date();
	const timezoneOffset = -(now.getTimezoneOffset() / 60);
	const jday = getJD(now.getFullYear(), now.getMonth() + 1, now.getDate());
	sunrise = calcSunriseSet(1, jday, latitude, longitude, timezoneOffset);
	sunset = calcSunriseSet(0, jday, latitude, longitude, timezoneOffset);
	const timeInMinutes = (now.getHours() * 60) + now.getMinutes();

	// early morning of previous night
	if (timeInMinutes < sunrise.timelocal) {
		isNight = true;
		const previousDay = new Date(now.getTime() - TWELVE_HOURS_IN_MS);
		const previousJday = getJD(previousDay.getFullYear(), previousDay.getMonth() + 1, previousDay.getDate());
		const previousSunset = calcSunriseSet(0, previousJday, latitude, longitude, timezoneOffset);
		timePeriodBegin = previousSunset.timelocal;
		timePeriodDuration = sunrise.timelocal + MINUTES_PER_DAY - timePeriodBegin;
	}
	// current day
	else if (timeInMinutes < sunset.timelocal) {
		isNight = false;
		timePeriodBegin = sunrise.timelocal;
		timePeriodDuration = sunset.timelocal - sunrise.timelocal;
	}
	// night time
	else {
		isNight = true;
		timePeriodBegin = sunset.timelocal;
		const nextDay = new Date(now.getTime() + TWELVE_HOURS_IN_MS);
		const nextJday = getJD(nextDay.getFullYear(), nextDay.getMonth() + 1, nextDay.getDate());
		sunrise = calcSunriseSet(1, nextJday, latitude, longitude, timezoneOffset);
		timePeriodDuration = sunrise.timelocal + MINUTES_PER_DAY - timePeriodBegin;
	}

	if (isNight) {
		document.body.classList.add('night');
	}
	else {
		document.body.classList.remove('night');
	}

	hideWelcome();
	helpFadeHandle = setTimeout(fadeoutHelp, HELP_FADE_DELAY);
	update();
}

const hasGeolocation = 'geolocation' in navigator;

function showLocationForm () {
	const wikiButton = document.getElementById('wikiButton');
	wikiButton.addEventListener('click', function () {
		const cityInput = document.getElementById('city');
		if (cityInput.value) {
			window.open(`https://en.wikipedia.org/w/index.php?title=Special%3ASearch&search=${cityInput.value}`, '_blank');
		}
	});

	const coordinatesForm = document.getElementById('coordinatesForm');
	coordinatesForm.addEventListener('submit', function (event) {
		event.preventDefault();
		const { latitude, longitude } = coordinatesForm.elements;
		initClock(Number(latitude.value), Number(longitude.value));
	});

	const locationForm = document.getElementById('locationForm');
	locationForm.hidden = false;
}

function showWelcomeDialog () {
	const locationButton = document.getElementById('locationButton');
	if (hasGeolocation) {
		locationButton.addEventListener('click', function () {
			navigator.geolocation.getCurrentPosition(function (position) {
				initClock(position.coords.latitude, position.coords.longitude);
			}, showLocationForm);
		});
	}
	else {
		locationButton.hidden = true;
		showLocationForm();
	}

	welcomeNode.hidden = false;
}

let { geolocation } = config;
if (geolocation) {
	initClock(geolocation.latitude, geolocation.longitude);
}
else {
	showWelcomeDialog();
}

helpIconNode.addEventListener('click', showWelcomeDialog);
fadeOverlayNode.addEventListener('animationend', function (event) {
	if (event.animationName === 'nightFade') {
		event.target.classList.remove('nightFade');
		event.target.classList.add('night');
	}
	else {
		event.target.classList.remove('morningFade');
		event.target.classList.remove('night');
	}
});

document.addEventListener('keydown', function (event) {
	let baseSize = config.baseSize ||
		parseInt(getComputedStyle(clockNode).getPropertyValue('--base-size'), 10);

	if (event.key === '=' || event.key === '+') {
		baseSize += 1;
		clockNode.style.setProperty('--base-size', `${baseSize}px`);
		config.baseSize = baseSize;
	}
	else if (event.key === '-') {
		baseSize -= 1;
		clockNode.style.setProperty('--base-size', `${baseSize}px`);
		config.baseSize = baseSize;
	}
});
