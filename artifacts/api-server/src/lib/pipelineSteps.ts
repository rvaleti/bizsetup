export interface DefaultStep {
  stepKey: string;
  stepName: string;
  description: string;
  order: string;
}

export const DEFAULT_PIPELINE_STEPS: DefaultStep[] = [
  {
    stepKey: "name_search",
    stepName: "Name Search & Reservation",
    description:
      "Search for company name availability and reserve it via RUN (Reserve Unique Name) on MCA portal.",
    order: "01",
  },
  {
    stepKey: "dsc",
    stepName: "Digital Signature Certificate (DSC)",
    description:
      "Obtain DSC for all proposed directors/partners. Required for filing forms digitally with MCA.",
    order: "02",
  },
  {
    stepKey: "din",
    stepName: "Director Identification Number (DIN)",
    description:
      "Apply for DIN for all proposed directors via DIR-3 KYC or SPICe+ form.",
    order: "03",
  },
  {
    stepKey: "moa_aoa",
    stepName: "Drafting MOA & AOA",
    description:
      "Draft Memorandum of Association (MOA) and Articles of Association (AOA) as per chosen entity type.",
    order: "04",
  },
  {
    stepKey: "spice_plus",
    stepName: "SPICe+ Filing",
    description:
      "File SPICe+ (Simplified Proforma for Incorporating Company Electronically Plus) on MCA portal with all documents.",
    order: "05",
  },
  {
    stepKey: "coi",
    stepName: "Certificate of Incorporation",
    description:
      "Receive Certificate of Incorporation (COI) from Registrar of Companies (ROC) upon successful SPICe+ processing.",
    order: "06",
  },
  {
    stepKey: "pan_tan",
    stepName: "PAN & TAN Registration",
    description:
      "Apply for Permanent Account Number (PAN) and Tax Deduction Account Number (TAN) for the company.",
    order: "07",
  },
  {
    stepKey: "bank_account",
    stepName: "Bank Account Opening",
    description:
      "Open a current bank account in the company name using COI, MOA/AOA, PAN, and other KYC documents.",
    order: "08",
  },
  {
    stepKey: "gst",
    stepName: "GST Registration",
    description:
      "Register for Goods and Services Tax (GST) if applicable based on turnover or nature of business.",
    order: "09",
  },
  {
    stepKey: "commencement",
    stepName: "Commencement of Business Filing",
    description:
      "File Form INC-20A (Declaration of commencement of business) within 180 days of incorporation.",
    order: "10",
  },
];
