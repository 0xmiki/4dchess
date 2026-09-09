import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();
crons.interval('expired chat cleanup', { hours: 24 }, internal.chat.cleanup);
crons.interval('matchmaking receipt cleanup', { minutes: 15 }, internal.matchmaking.cleanup);
crons.interval(
	'maintenance and scheduled-failure check',
	{ minutes: 15 },
	internal.operations.maintenance
);
crons.interval('public game statistics', { minutes: 5 }, internal.stats.refresh);
export default crons;
