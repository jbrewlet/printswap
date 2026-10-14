/** Parse Bambu "total estimated time" fragments like `1d 2h 3m 4s`. */
export function parseEstimatedTimeSeconds(timeString: string): number {
	let total = 0;
	const secondsMatch = timeString.match(/\d+s/);
	total += secondsMatch ? parseInt(secondsMatch[0], 10) : 0;
	const minutesMatch = timeString.match(/\d+m/);
	total += (minutesMatch ? parseInt(minutesMatch[0], 10) : 0) * 60;
	const hoursMatch = timeString.match(/\d+h/);
	total += (hoursMatch ? parseInt(hoursMatch[0], 10) : 0) * 60 * 60;
	const daysMatch = timeString.match(/\d+d/);
	total += (daysMatch ? parseInt(daysMatch[0], 10) : 0) * 60 * 60 * 24;
	return total;
}

export function extractEstimatedTimeFromGcode(gcode: string): {
	timeString: string;
	totalSeconds: number;
} {
	const marker = 'total estimated time: ';
	const start = gcode.indexOf(marker);
	if (start === -1) {
		return { timeString: '', totalSeconds: 0 };
	}
	const valueStart = start + marker.length;
	const lineEnd = gcode.indexOf('\n', valueStart);
	const timeString = gcode.slice(valueStart, lineEnd === -1 ? undefined : lineEnd).trim();
	return { timeString, totalSeconds: parseEstimatedTimeSeconds(timeString) };
}

export function formatDuration(totalSeconds: number): string {
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	return `${hours}h ${minutes}m ${seconds}s`;
}
