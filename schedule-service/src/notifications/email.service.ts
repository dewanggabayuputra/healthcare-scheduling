import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);

    private readonly transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    async sendScheduleCreatedEmail(data: {
        customerEmail: string;
        customerName: string;
        doctorName: string;
        objective: string;
        scheduledAt: Date;
    }) {
        const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: data.customerEmail,
        subject: 'Healthcare Schedule Confirmation',
        html: `
            <h2>Schedule Confirmation</h2>
            <p>Hello ${data.customerName},</p>
            <p>Your schedule has been successfully created.</p>
            <ul>
            <li>Doctor: ${data.doctorName}</li>
            <li>Objective: ${data.objective}</li>
            <li>Schedule: ${new Date(data.scheduledAt).toLocaleString('en-US', {
                timeZone: 'Asia/Jakarta',
            })}</li>
            </ul>
            <p>Thank you.</p>
        `,
        });

        this.logger.log(`Email sent. Message ID: ${info.messageId}`);

        if (nodemailer.getTestMessageUrl(info)) {
        this.logger.log(
            `Email preview: ${nodemailer.getTestMessageUrl(info)}`,
        );
        }

        return info;
    }

    async sendScheduleDeletedEmail(data: {
        customerEmail: string;
        customerName: string;
        doctorName: string;
        objective: string;
        scheduledAt: Date;
    }) {
        const info = await this.transporter.sendMail({
            from: process.env.SMTP_FROM,
            to: data.customerEmail,
            subject: 'Healthcare Schedule Cancellation',
            html: `
            <h2>Schedule Cancellation</h2>
            <p>Hello ${data.customerName},</p>
            <p>Your healthcare schedule has been cancelled.</p>
            <ul>
                <li>Doctor: ${data.doctorName}</li>
                <li>Objective: ${data.objective}</li>
                <li>Schedule: ${new Date(data.scheduledAt).toLocaleString('en-US', {
                timeZone: 'Asia/Jakarta',
                })}</li>
            </ul>
            <p>Thank you.</p>
            `,
        });

        this.logger.log(`Cancellation email sent: ${info.messageId}`);

        const previewUrl = nodemailer.getTestMessageUrl(info);

        if (previewUrl) {
            this.logger.log(`Email preview: ${previewUrl}`);
        }

        return info;
    }
}