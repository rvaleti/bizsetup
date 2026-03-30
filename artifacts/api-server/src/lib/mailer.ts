import nodemailer from "nodemailer";
import { logger } from "./logger";

let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (_transporter) return _transporter;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!host || !user || !pass) {
    return null;
  }

  _transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return _transporter;
}

export interface MailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendMail(options: MailOptions): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) {
    logger.debug(
      { to: options.to, subject: options.subject },
      "Email skipped — SMTP not configured (set SMTP_HOST, SMTP_USER, SMTP_PASS)"
    );
    return false;
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  try {
    await transporter.sendMail({
      from: `BizSetup <${from}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html ?? options.text.replace(/\n/g, "<br>"),
    });
    logger.info({ to: options.to, subject: options.subject }, "Email sent");
    return true;
  } catch (err) {
    logger.error({ err, to: options.to, subject: options.subject }, "Failed to send email");
    return false;
  }
}

export async function sendNewRegistrationEmail(params: {
  facilitatorEmail: string;
  facilitatorName: string;
  companyName: string;
  entityType: string;
  customerName: string;
  pipelineId: string;
  appUrl?: string;
}) {
  const url = params.appUrl ?? process.env.FRONTEND_URL ?? "";
  const link = url ? `${url.replace(/\/$/, "")}/facilitator/pipeline/${params.pipelineId}` : "";

  return sendMail({
    to: params.facilitatorEmail,
    subject: `[BizSetup] New Registration Assigned — ${params.companyName}`,
    text: [
      `Hi ${params.facilitatorName},`,
      "",
      `A new company registration has been assigned to you on BizSetup.`,
      "",
      `Company: ${params.companyName}`,
      `Entity Type: ${params.entityType.replace(/_/g, " ")}`,
      `Customer: ${params.customerName}`,
      "",
      link ? `View Pipeline: ${link}` : "Log in to BizSetup to view the pipeline.",
      "",
      "Please review the details and begin the registration process.",
      "",
      "— BizSetup Automated Notification",
    ].join("\n"),
  });
}

export async function sendMoreInfoEmail(params: {
  customerEmail: string;
  customerName: string;
  companyName: string;
  facilitatorName: string;
  details: string;
  pipelineId: string;
  appUrl?: string;
}) {
  const url = params.appUrl ?? process.env.FRONTEND_URL ?? "";
  const link = url ? `${url.replace(/\/$/, "")}/dashboard/company` : "";

  return sendMail({
    to: params.customerEmail,
    subject: `[BizSetup] More Information Required — ${params.companyName}`,
    text: [
      `Hi ${params.customerName},`,
      "",
      `Your facilitator ${params.facilitatorName} has requested more information for the registration of ${params.companyName}.`,
      "",
      `Details: ${params.details}`,
      "",
      link ? `Log in to respond: ${link}` : "Log in to BizSetup to respond.",
      "",
      "— BizSetup Automated Notification",
    ].join("\n"),
  });
}
