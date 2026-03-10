import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

export class SyncEsocialCatalogItemDto {
  @IsString()
  code!: string;

  @IsString()
  officialDescription!: string;

  @IsOptional()
  @IsString()
  humanExplanation?: string;

  @IsOptional()
  @IsString()
  probableCause?: string;

  @IsOptional()
  @IsString()
  suggestedAction?: string;

  @IsOptional()
  @IsString()
  category?: string;
}

export class SyncEsocialCatalogDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SyncEsocialCatalogItemDto)
  messages?: SyncEsocialCatalogItemDto[];
}
