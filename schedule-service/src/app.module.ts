import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { APP_GUARD } from '@nestjs/core';
import { Request } from 'express';
import { join } from 'path';
import { AuthClientModule } from './auth-client/auth-client.module';
import { GqlAuthGuard } from './auth-client/gql-auth.guard';
import { AppResolver } from './app.resolver';
import { PrismaModule } from './prisma/prisma.module';
import { CustomersModule } from './customers/customers.module';
import { DoctorsModule } from './doctors/doctors.module';
import { SchedulesModule } from './schedules/schedules.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      context: ({ req }: { req: Request }) => ({ req }),
    }),
    PrismaModule,
    AuthClientModule,
    CustomersModule,
    DoctorsModule,
    SchedulesModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useExisting: GqlAuthGuard,
    },
    AppResolver,
  ],
})
export class AppModule {}
