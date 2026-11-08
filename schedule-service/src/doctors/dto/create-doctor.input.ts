import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, MaxLength } from 'class-validator';

@InputType()
export class CreateDoctorInput {
  @Field()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;
}