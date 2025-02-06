import { Credentials } from '@keycloak/keycloak-admin-client/lib/utils/auth.js';
import KcAdminClient from '@keycloak/keycloak-admin-client';
import waitOn from 'wait-on';
import log from '../../config/log.js';

type CredentialsVerifier = {
  ssoHost: string;
  realmName: string;
  clientId: string;
  clientSecret: string;
};
export async function kcCredentialsVerifier({
  ssoHost,
  realmName,
  clientId,
  clientSecret,
}: CredentialsVerifier) {
  const client = new KcAdminClient({
    baseUrl: ssoHost,
    realmName,
  });
  const credentials: Credentials = {
    grantType: 'client_credentials',
    clientId,
    clientSecret,
  };
  await client.auth(credentials);
  const accessToken = await client.getAccessToken();
  if (!accessToken) {
    throw new Error('unable to authenticate');
  }
}

export function checkConnectivity(kcUrl: string, waitOnTimeout: number) {
  log({ tags: ['auth', 'keycloak'] }).info('START TO KC-CHECK-CONNECTIVITY...');
  return waitOn({ resources: [kcUrl], timeout: waitOnTimeout });
}
