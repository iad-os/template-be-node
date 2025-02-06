import { IreneKills } from '@iad-os/irene-kills-es';
import { pick } from 'lodash-es';
import log from '../config/log.js';
import apiService from '../main-http.js';
import {
  checkConnectivity,
  kcCredentialsVerifier,
} from '../shared/utils/keycloack.js';
import { ghenghi } from './ghenghi.js';
import options, { AuthConfig } from './options.js';
import * as mongoService from '../main-db.js';
import * as mongo from './mongodb.js';
import { NetworkError } from '@keycloak/keycloak-admin-client';

const irene = new IreneKills({ logger: log({ tags: ['irene'] }) });
let nsick = 0;
const opts = options.snapshot();

irene.resource('mongo', {
  need: async () => {
    log({ tags: ['init-mongo'] }).info('⏳ initialize mongo connection');
    await mongoService.start();
  },
  check: async () => {
    const logger = log({ tags: ['mongo', 'check'] });
    try {
      await mongoService.checkDb(logger);
      logger.info('✅ OK check mongo connection');
      return true;
    } catch (err) {
      logger.error({ error: err }, '💥 KO check mongo connection');
      return false;
    }
  },
  on: {
    healthcheck: async () => {
      const logger = log({ tags: ['mongo', 'healthcheck'] });
      try {
        // await mongoService.checkDb(logger);
        logger.debug('✅ OK check mongo connection');
        return { healthy: true, kill: false };
      } catch (error) {
        logger.error({ error }, '💥 KO check mongo connection');
        return { healthy: false, kill: true };
      }
    },
  },
});

irene.resource<{ waitOnTimeout: number; authOpts: AuthConfig }>('auth', {
  value: pick(opts, ['authOpts', 'waitOnTimeout']),
  check: async ({ value }) => {
    try {
      await checkConnectivity(value.authOpts.issuer, value.waitOnTimeout);
      await kcCredentialsVerifier({
        ssoHost: value.authOpts.ssoHost,
        clientId: value.authOpts.client.clientId,
        clientSecret: value.authOpts.client.clientSecret,
        realmName: value.authOpts.realmName,
      });
      log({ tags: ['auth', 'keycloak'] }).info(
        '✅ KC-CHECK-SA-CREDENTIALS - OK'
      );
      return true;
    } catch (error) {
      if (error instanceof NetworkError) {
        log({ tags: ['auth', 'keycloak'] }).error(
          { reason: error.responseData },
          '💣 KC-CHECK CREDENTIALS - KO'
        );
        return false;
      }
      log({ tags: ['auth', 'keycloak'] }).error(
        { reason: (error as Error)?.message },
        '💣 KC-CHECK CONNETTIVITY - KO'
      );
      return false;
    }
  },
  on: {
    healthcheck: async ({ value }) => {
      try {
        await checkConnectivity(value.authOpts.issuer, value.waitOnTimeout);
        return {
          healthy: true,
          kill: false,
        };
      } catch (err) {
        log({ tags: ['auth', 'keycloak'] }).error(
          '💣 KC-CHECK-CONNECTIVITY - KO'
        );
        return {
          healthy: false,
          kill: true,
        };
      }
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
    mongo.listener('disconnected', () => {
      irene.healthcheck();
    });
    mongo.listener('reconnected', () => {
      irene.healthcheck();
    });

    //ghenghi handle configa
    ghenghi.on('ghenghi:shot', (ev: any) => {
      log({ tags: ['ghenghi', 'kill_ghii'] }).info(ev);
      irene.kill();
    });
    ghenghi.on('ghenghi:recoil', (ev: any) => {
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
