import { IreneKills } from '@iad-os/irene-kills-es';
import { map, pick } from 'lodash-es';
import log from '../config/log.js';
import apiService from '../main-http.js';

import { ghenghi } from './ghenghi.js';
import options, { AuthConfig } from './options.js';
import { checkConnectivity, credentialsVerifier } from '../utils/idp.js';

const irene = new IreneKills({ logger: log({ tags: ['irene'] }) });
let nsick = 0;
const opts = options.snapshot();

irene.resource<{ waitOnTimeout: number; authOpts: AuthConfig }>('auth', {
  value: pick(opts, ['authOpts', 'waitOnTimeout']),
  check: async ({ value }) => {
    const checks = map(value.authOpts.issuers, async (auth, issuer) => {
      try {
        await checkConnectivity(issuer, value.waitOnTimeout);
        await credentialsVerifier(auth);
        log({ tags: ['auth', issuer] }).info('✅ CHECK-SA-CREDENTIALS - OK');
      } catch (error) {
        log({ tags: ['auth', issuer] }).error(
          { reason: (error as Error)?.message },
          '💣 CHECK CONNETTIVITY - KO'
        );
        throw error;
      }
    });

    const result = await Promise.allSettled(checks);
    return result.reduce(
      (acc, prev) => acc && prev.status === 'fulfilled',
      true
    );
  },
  on: {
    healthcheck: async ({ value }) => {
      const checks = map(value.authOpts.issuers, async (_, issuer) => {
        try {
          await checkConnectivity(issuer, value.waitOnTimeout);
        } catch (err) {
          log({ tags: ['auth', issuer] }).error('💣 CHECK-CONNECTIVITY - KO');
          throw err;
        }
      });
      const result = await Promise.allSettled(checks);
      const healthy = result.reduce(
        (acc, prev) => acc && prev.status === 'fulfilled',
        true
      );
      return {
        healthy: healthy,
        kill: !healthy,
      };
    },
  },
});

irene.resource('http', {
  activate: async () => {
    try {
      await apiService.start(opts);
      log({ tags: ['server'] }).info('✅ Application started');
      return { kill: false, healthy: true };
    } catch (err) {
      log({ tags: ['server'] }).error(err);
      return { kill: true, healthy: false };
    }
  },
});

irene.resource('appCondition', {
  need: async () => {
    //ghenghi handle configa
    ghenghi.on('ghenghi:shot', ev => {
      log({ tags: ['ghenghi', 'kill_ghii'] }).info(ev);
      irene.kill();
    });
    ghenghi.on('ghenghi:recoil', ev => {
      log({ tags: ['ghenghi', 'ghii_error'] }).error(ev);
    });
  },
  sick: () => {
    nsick++;
    return { kill: nsick === options.snapshot().flags.faliureCondition };
  },
  healthy: () => {
    nsick = 0;
    return { kill: false, healthy: true };
  },
});

export default irene;
