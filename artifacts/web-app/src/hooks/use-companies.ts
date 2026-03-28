import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { UserSchema } from "./use-auth";
import type { User } from "./use-auth";

export const EntityTypeEnum = z.enum(["LLP", "PRIVATE_LIMITED", "OPC", "PARTNERSHIP", "SOLE_PROPRIETORSHIP", "SECTION_8", "PUBLIC_LIMITED"]);

export const PipelineSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  assignedFacilitatorId: z.string().nullable().optional(),
  assignedFacilitator: UserSchema.nullable().optional(),
  status: z.string(),
  currentStep: z.string().nullable().optional(),
  rejectionReason: z.string().nullable().optional(),
  rectificationNotes: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CompanySchema = z.object({
  id: z.string(),
  customerId: z.string(),
  name: z.string(),
  address: z.string(),
  city: z.string(),
  state: z.string(),
  pincode: z.string(),
  entityType: EntityTypeEnum,
  primaryPhone: z.string(),
  alternatePhone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CompanyWithPipelineSchema = CompanySchema.extend({
  pipeline: PipelineSchema.nullable().optional(),
  customer: UserSchema.nullable().optional(),
});

export type CompanyWithPipeline = z.infer<typeof CompanyWithPipelineSchema>;

const ListResponseSchema = z.object({
  data: z.array(CompanyWithPipelineSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
});

export function useCompanies(params?: { status?: string; entityType?: string; search?: string }) {
  const queryStr = new URLSearchParams(params as Record<string, string>).toString();
  const url = `/api/companies${queryStr ? `?${queryStr}` : ""}`;
  
  return useQuery({
    queryKey: [url],
    queryFn: async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch companies");
      return ListResponseSchema.parse(await res.json());
    },
  });
}

export function useCompany(id: string) {
  return useQuery({
    queryKey: [`/api/companies/${id}`],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${id}`);
      if (!res.ok) throw new Error("Failed to fetch company");
      return CompanyWithPipelineSchema.parse(await res.json());
    },
    enabled: !!id,
  });
}

export const CreateCompanyInput = z.object({
  name: z.string().min(1, "Company Name is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  pincode: z.string().regex(/^[0-9]{6}$/, "Must be a 6-digit pin"),
  entityType: EntityTypeEnum,
  primaryPhone: z.string().min(10, "Valid phone number required"),
  alternatePhone: z.string().optional(),
  email: z.string().email("Valid email required").or(z.literal("")).optional(),
  description: z.string().optional(),
});

export type CreateCompanyInputType = z.infer<typeof CreateCompanyInput>;

export function useCreateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateCompanyInputType) => {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to create company");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
    },
  });
}
