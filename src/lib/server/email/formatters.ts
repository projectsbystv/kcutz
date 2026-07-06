/**
 * Email date/time formatters
 * German formatting for the barbershop: 24h times as "15:00 Uhr", German dates,
 * no timezone abbreviation (all times are Europe/Berlin wall-clock time).
 */

import type { BookingEmailData } from './types';

export interface EmailFormatters {
	formatDate: (date: Date) => string;
	formatTime: (date: Date) => string;
	formatDateTime: (date: Date) => string;
}

/**
 * Create formatters based on user preferences
 */
export function createEmailFormatters(_timeFormat: '12h' | '24h' = '24h', timezone?: string): EmailFormatters {
	const formatDate = (date: Date): string => {
		return new Intl.DateTimeFormat('de-DE', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			timeZone: timezone
		}).format(date);
	};

	const formatTime = (date: Date): string => {
		const time = new Intl.DateTimeFormat('de-DE', {
			hour: '2-digit',
			minute: '2-digit',
			hour12: false,
			timeZone: timezone
		}).format(date);
		return `${time} Uhr`;
	};

	const formatDateTime = (date: Date): string => {
		return `${formatDate(date)}, ${formatTime(date)}`;
	};

	return { formatDate, formatTime, formatDateTime };
}

/**
 * Replace template variables in subject
 */
export function replaceSubjectVariables(subject: string, data: BookingEmailData): string {
	const formatDate = (date: Date) => {
		return new Intl.DateTimeFormat('de-DE', {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			timeZone: data.timezone
		}).format(date);
	};

	const formatTime = (date: Date) => {
		const time = new Intl.DateTimeFormat('de-DE', {
			hour: '2-digit',
			minute: '2-digit',
			hour12: false,
			timeZone: data.timezone
		}).format(date);
		return `${time} Uhr`;
	};

	return subject
		.replace(/{event_name}/g, data.eventName)
		.replace(/{host_name}/g, data.hostName)
		.replace(/{attendee_name}/g, data.attendeeName)
		.replace(/{date}/g, formatDate(data.startTime))
		.replace(/{time}/g, formatTime(data.startTime));
}
