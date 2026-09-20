import { cronJobs } from 'convex/server';
// Keep recurring jobs disabled during the account migration. In particular,
// never reintroduce the full-history statistics rebuild on a recurring schedule.
const crons = cronJobs();
export default crons;
