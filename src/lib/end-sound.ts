let context: AudioContext | null = null;
export async function previewEndSound(won: boolean) {
	try {
		context ??= new AudioContext();
		await context.resume();
		if (context.state !== 'running') return false;
		playEndSound(won);
		return true;
	} catch {
		return false;
	}
}
function playEndSound(won: boolean) {
	if (!context || context.state !== 'running') return;
	const notes = won ? [523.25, 659.25, 783.99] : [392, 329.63, 261.63];
	notes.forEach((frequency, i) => {
		const oscillator = context!.createOscillator(),
			gain = context!.createGain(),
			start = context!.currentTime + i * 0.14;
		oscillator.type = 'triangle';
		oscillator.frequency.value = frequency;
		gain.gain.setValueAtTime(0, start);
		gain.gain.linearRampToValueAtTime(0.08, start + 0.015);
		gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
		oscillator.connect(gain);
		gain.connect(context!.destination);
		oscillator.start(start);
		oscillator.stop(start + 0.36);
		oscillator.onended = () => {
			oscillator.disconnect();
			gain.disconnect();
		};
	});
}
