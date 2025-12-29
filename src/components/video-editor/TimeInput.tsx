import type React from 'react';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';

interface TimeInputProps {
	value: string;
	onChange: (value: string) => void;
	onBlur: () => void;
}

const TimeInput: React.FC<TimeInputProps> = ({ value, onChange, onBlur }) => {
	const [hours, setHours] = useState('');
	const [minutes, setMinutes] = useState('');
	const [seconds, setSeconds] = useState('');

	useEffect(() => {
		const stringValue = value;
		const parts = stringValue.split(':');
		setHours(parts[0] || '');
		setMinutes(parts[1] || '');
		setSeconds(parts[2] || '');
	}, [value]);

	const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newHours = e.target.value;
		setHours(newHours);
		onChange(`${newHours}:${minutes}:${seconds}`);
	};

	const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newMinutes = e.target.value;
		setMinutes(newMinutes);
		onChange(`${hours}:${newMinutes}:${seconds}`);
	};

	const handleSecondsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newSeconds = e.target.value;
		setSeconds(newSeconds);
		onChange(`${hours}:${minutes}:${newSeconds}`);
	};

	return (
		<div className="flex flex-row gap-1">
			<Input
				type="text"
				className="field-sizing-content"
				value={hours}
				onChange={handleHoursChange}
				onBlur={onBlur}
				placeholder="hh"
				maxLength={2}
			/>
			<span className="content-center">:</span>
			<Input
				type="text"
				className="field-sizing-content"
				value={minutes}
				onChange={handleMinutesChange}
				onBlur={onBlur}
				placeholder="mm"
				maxLength={2}
			/>
			<span className="content-center">:</span>
			<Input
				type="text"
				className="field-sizing-content"
				value={seconds}
				onChange={handleSecondsChange}
				onBlur={onBlur}
				placeholder="ss"
				maxLength={2}
			/>
		</div>
	);
};

export default TimeInput;
