import { useCompanies, useCreateCompany } from "@/hooks/use-companies";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Link } from "wouter";
import { Plus, Building, MapPin, Loader2, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateCompanyInput, CreateCompanyInputType } from "@/hooks/use-companies";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function CustomerDashboard() {
  const { data: response, isLoading } = useCompanies();
  const createCompany = useCreateCompany();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm<CreateCompanyInputType>({
    resolver: zodResolver(CreateCompanyInput),
    defaultValues: {
      name: "", address: "", city: "", state: "", pincode: "", 
      entityType: "PRIVATE_LIMITED", primaryPhone: "", email: ""
    }
  });

  const onSubmit = async (data: CreateCompanyInputType) => {
    try {
      await createCompany.mutateAsync(data);
      toast({ title: "Company registered successfully!" });
      setDialogOpen(false);
      form.reset();
    } catch (err: any) {
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
    }
  };

  const companies = response?.data || [];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display text-slate-900">My Companies</h1>
          <p className="text-slate-500 mt-1">Manage your registrations and track progress.</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">
              <Plus className="w-4 h-4 mr-2" /> Register New Company
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Register New Company</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Company Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="entityType" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Entity Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="SOLE_PROPRIETORSHIP">Sole Proprietorship</SelectItem>
                          <SelectItem value="PARTNERSHIP">Partnership</SelectItem>
                          <SelectItem value="LLP">LLP</SelectItem>
                          <SelectItem value="PRIVATE_LIMITED">Private Limited</SelectItem>
                          <SelectItem value="OPC">One Person Company</SelectItem>
                          <SelectItem value="PUBLIC_LIMITED">Public Limited</SelectItem>
                          <SelectItem value="SECTION_8">Section 8</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="primaryPhone" render={({ field }) => (
                    <FormItem><FormLabel>Primary Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-3 gap-4">
                  <FormField control={form.control} name="city" render={({ field }) => (
                    <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="state" render={({ field }) => (
                    <FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="pincode" render={({ field }) => (
                    <FormItem><FormLabel>Pincode</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="pt-4 flex justify-end">
                  <Button type="submit" disabled={createCompany.isPending}>
                    {createCompany.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Submit Registration
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => <div key={i} className="h-48 rounded-2xl bg-slate-100 animate-pulse" />)}
        </div>
      ) : companies.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
          <Building className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900">No companies yet</h3>
          <p className="text-slate-500 max-w-sm mx-auto mt-2 mb-6">Register your first company to kickstart the registration pipeline.</p>
          <Button onClick={() => setDialogOpen(true)}>Register Now</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companies.map(company => (
            <Link key={company.id} href={`/dashboard/company/${company.id}`}>
              <Card className="p-6 h-full flex flex-col hover-lift cursor-pointer bg-white border-slate-200 group">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Building className="w-5 h-5 text-primary" />
                  </div>
                  {company.pipeline?.status && <StatusBadge status={company.pipeline.status} />}
                </div>
                <h3 className="font-semibold text-lg text-slate-900 group-hover:text-primary transition-colors line-clamp-1">{company.name}</h3>
                <p className="text-sm text-slate-500 mt-1">{company.entityType.replace('_', ' ')}</p>
                
                <div className="mt-6 flex items-center text-sm text-slate-600 gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span className="truncate">{company.city}, {company.state}</span>
                </div>
                
                <div className="mt-auto pt-6 flex justify-between items-center text-sm font-medium text-primary">
                  View Progress
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
