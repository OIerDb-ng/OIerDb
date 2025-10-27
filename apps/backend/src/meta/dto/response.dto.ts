import type { VersionResponse } from '@oierdb/core';

import { ResponseBaseDto } from '../../common/dto/response-base.dto';

export class VersionResponseDto extends ResponseBaseDto implements VersionResponse {}
