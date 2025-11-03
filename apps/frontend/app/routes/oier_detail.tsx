import { Container } from '@mantine/core';
import { data } from 'react-router';

import { OIerInfo } from '~/components/oier-info';
import { getClient } from '~/libs/client';

import type { Route } from './+types/oier_detail';
import * as styles from './oier_detail.css';

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const client = getClient();
  const uid = Number(params.uid);

  if (isNaN(uid)) {
    throw data({ message: 'Invalid UID' }, { status: 400 });
  }

  const oierData = await client.getOIer(uid);

  if (!oierData) {
    throw data({ message: 'OIer not found' }, { status: 404 });
  }

  return oierData;
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) {
    return [{ title: 'Not Found - OIerDb' }];
  }

  return [{ title: `${loaderData.oier.name} - OIerDb` }];
}

export default function OierDetailPage({ loaderData }: Route.ComponentProps) {
  return (
    <Container size="md" className={styles.container}>
      <h2 className={styles.name}>{loaderData.oier.name}</h2>
      <OIerInfo data={loaderData} />
    </Container>
  );
}
