import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();
crons.interval(
	'maintenance and scheduled-failure check',
	{ minutes: 15 },
	internal.operations.maintenance
);
export default crons;
