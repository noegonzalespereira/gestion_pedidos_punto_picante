import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ItemDto } from './item.dto';

export class AddItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  items: ItemDto[];
}
