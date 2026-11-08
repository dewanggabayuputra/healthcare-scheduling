import { InputType, PartialType } from '@nestjs/graphql';
import { CreateDoctorInput } from './create-doctor.input';

@InputType()
export class UpdateDoctorInput extends PartialType(
  CreateDoctorInput,
) {}