import { ApiProperty } from '@nestjs/swagger';
import type { ResponseBase } from '@oierdb/core';

export class ResponseBaseDto implements ResponseBase {
  @ApiProperty({
    description: '后端数据版本（通常为 SHA256 哈希值）',
    example: 'a1b2c3d4e5f6...',
  })
  data_version!: string;
}
