import { ghenghi } from './config/ghenghi.js';
import irene from './config/Irene.js';
import log from './config/log.js';

await irene.wakeUp();

log({ tags: ['wakeup', 'application', 'status'] }).info(
  `⚙️  APPLICATION STATUS -> ${irene.mood()}`
);

ghenghi.run();
