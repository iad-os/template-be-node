import { Ghenghi } from '@iad-os/ghenghi';
import options from './options.js';

const ghenghiConfig = () => {
  const { bulletPaths, refreshSnapshotInterval } = options.snapshot();
  return Ghenghi(options, {
    bulletPaths,
    refreshSnapshotInterval,
  });
};

export const ghenghi = ghenghiConfig();
