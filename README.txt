Healthcare Scheduling API Collections

Files:
- postman-collection.json: importable Postman Collection v2.1
- postman-environment.json: local Docker environment
- apollo-operations.graphql: operations to paste into Apollo Sandbox

Endpoints:
- Auth: http://localhost:3001/graphql
- Schedule: http://localhost:3002/graphql

Postman:
1. Import collection and environment.
2. Select environment "Healthcare Scheduling - Local Docker".
3. Run Register, then Login. Login automatically saves accessToken.
4. Run Create Customer and Create Doctor.
5. Copy IDs from the create responses into customerId and doctorId environment variables.
6. Run Create Schedule. Then test list/get/delete.

All requests include Content-Type: application/json. Schedule requests include Authorization: Bearer {{accessToken}}.

Email and BullMQ:
- Schedule creation queues a confirmation email; schedule deletion queues a cancellation email.
- BullMQ uses the Redis service from Docker Compose and retries failed jobs up to three times.
- Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM in schedule-service/.env.
- For Gmail, use a Google App Password for SMTP_PASS. Do not commit credentials.
- Recreate the service after changing environment variables:
  docker compose up -d --force-recreate schedule-service

Apollo Sandbox:
Paste the relevant operation into Explorer. Login first on Auth Service. For Schedule Service, configure HTTP header Authorization: Bearer <accessToken> in Sandbox's operation/request headers.

The operations match the generated schema: customer and doctor IDs are String!, while schedule IDs and customerId/doctorId in CreateScheduleInput are ID!.
