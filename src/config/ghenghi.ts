import { Ghenghi } from '@iad-os/ghenghi-es';
import options from './options.js';

const ghenghiConfig = () => {
  const { bulletPaths, refreshSnapshotInterval } = options.snapshot();
  return Ghenghi<any>(options, {
    bulletPaths,
    refreshSnapshotInterval,
  });
};

export const ghenghi = ghenghiConfig();
