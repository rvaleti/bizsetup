export interface DefaultStep {
  stepKey: string;
  stepName: string;
  description: string;
  order: string;
  assignedTo: "CUSTOMER" | "FACILITATOR";
}

export const DEFAULT_PIPELINE_STEPS: DefaultStep[] = [
  {
    stepKey: "company_details",
    stepName: "Company Details",
    description:
      "Initial company information collected from the customer. A facilitator reviews the details and confirms the registration is ready to proceed.",
    order: "01",
    assignedTo: "FACILITATOR",
  },
  {
    stepKey: "gst_filing",
    stepName: "File for GST with Government of India",
    description:
      "File GST registration application on the GST portal. Upon submission, status moves to Waiting — pending government acknowledgement and GSTIN issuance.",
    order: "02",
    assignedTo: "FACILITATOR",
  },
  {
    stepKey: "govt_registration",
    stepName: "File for Registration with Government of India",
    description:
      "Submit the company incorporation / registration application with the Ministry of Corporate Affairs (MCA) or relevant authority. Pending government review and approval.",
    order: "03",
    assignedTo: "FACILITATOR",
  },
  {
    stepKey: "company_registered",
    stepName: "Company Registered",
    description:
      "Certificate of Incorporation (COI) / registration certificate received from the government. The company is now officially registered.",
    order: "04",
    assignedTo: "FACILITATOR",
  },
];

export const DYNAMIC_STEP_TEMPLATES = {
  rectification: {
    stepKey: "rectification",
    stepName: "Rectification & Re-submission",
    description:
      "A query was raised by the government authority. Facilitator addresses the query, rectifies the application, and re-submits to the government. Status moves to RE_SUBMITTED after submission.",
    assignedTo: "FACILITATOR" as const,
  },
  more_info_required: {
    stepKey: "more_info_required",
    stepName: "More Information Required from Customer",
    description:
      "Facilitator requires additional documents or information from the customer to proceed. Customer has been notified and must respond via the chat or portal.",
    assignedTo: "CUSTOMER" as const,
  },
};

export type DynamicStepType = keyof typeof DYNAMIC_STEP_TEMPLATES;
