import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';

@InputType()
export class CreateCustomerInput {
  @Field()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @Field()
  @IsEmail()
  @MaxLength(255)
  email: string;
}