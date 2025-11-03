import type { GetOIerResponse } from '@oierdb/core';

import { OIerIntro } from './oier-intro';
import { OIerRecords } from './oier-records';

interface OIerInfoProps {
  data: GetOIerResponse;
}

export const OIerInfo: React.FC<OIerInfoProps> = ({ data }) => {
  return (
    <>
      <OIerIntro oier={data.oier} />
      <OIerRecords
        records={data.records}
        schoolsMap={data.schools_map}
        contestsMap={data.contests_map}
        enrollMiddle={data.oier.enroll_middle}
      />
    </>
  );
};
