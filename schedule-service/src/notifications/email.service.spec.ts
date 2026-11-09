import { Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { EmailService } from './email.service';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn() })),
  getTestMessageUrl: jest.fn(),
}));

describe('EmailService', () => {
  let service: EmailService;
  let sendMail: jest.Mock;
  const data = {
    customerEmail: 'patient@example.com',
    customerName: 'Patient',
    doctorName: 'Dr. Doe',
    objective: 'Consultation',
    scheduledAt: new Date('2030-01-15T09:00:00.000Z'),
  };

  beforeEach(() => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'smtp-user';
    process.env.SMTP_PASS = 'smtp-password';
    process.env.SMTP_FROM = 'Healthcare Scheduling <no-reply@example.com>';
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    service = new EmailService();
    const transporter = jest.mocked(nodemailer.createTransport).mock.results.at(-1)
      ?.value as unknown as { sendMail: jest.Mock };
    sendMail = transporter.sendMail;
    jest.mocked(nodemailer.getTestMessageUrl).mockReturnValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends schedule confirmation email with appointment details', async () => {
    const info = { messageId: 'confirmation-id' };
    sendMail.mockResolvedValue(info);

    await expect(service.sendScheduleCreatedEmail(data)).resolves.toBe(info);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: process.env.SMTP_FROM,
        to: data.customerEmail,
        subject: 'Healthcare Schedule Confirmation',
        html: expect.stringContaining('Schedule Confirmation'),
      }),
    );
    expect(sendMail.mock.calls[0][0].html).toContain(data.doctorName);
  });

  it('logs a preview URL for confirmation emails when available', async () => {
    sendMail.mockResolvedValue({ messageId: 'confirmation-id' });
    jest.mocked(nodemailer.getTestMessageUrl).mockReturnValue(
      'https://preview.example.com/email',
    );
    const log = jest.spyOn(Logger.prototype, 'log');

    await service.sendScheduleCreatedEmail(data);

    expect(log).toHaveBeenCalledWith(
      'Email preview: https://preview.example.com/email',
    );
  });

  it('sends schedule cancellation email with appointment details', async () => {
    const info = { messageId: 'cancellation-id' };
    sendMail.mockResolvedValue(info);

    await expect(service.sendScheduleDeletedEmail(data)).resolves.toBe(info);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: process.env.SMTP_FROM,
        to: data.customerEmail,
        subject: 'Healthcare Schedule Cancellation',
        html: expect.stringContaining('Schedule Cancellation'),
      }),
    );
  });

  it('logs a preview URL for cancellation emails when available', async () => {
    sendMail.mockResolvedValue({ messageId: 'cancellation-id' });
    jest.mocked(nodemailer.getTestMessageUrl).mockReturnValue(
      'https://preview.example.com/cancellation',
    );
    const log = jest.spyOn(Logger.prototype, 'log');

    await service.sendScheduleDeletedEmail(data);

    expect(log).toHaveBeenCalledWith(
      'Email preview: https://preview.example.com/cancellation',
    );
  });
});
