import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class ImportEsocialXmlDto {
  @IsOptional()
  @IsString()
  xml?: string;

  @IsOptional()
  @IsString()
  xmlBase64?: string;

  @IsOptional()
  @IsBoolean()
  validateXsd?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  sourceLabel?: string;
}
