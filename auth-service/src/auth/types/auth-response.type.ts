import { ObjectType, Field } from '@nestjs/graphql';
import { UserType } from './user.type';

@ObjectType()
export class AuthResponseType {
  @Field()
  accessToken: string;

  @Field(() => UserType)
  user: UserType;
}