import { PipelineStep } from "@/hooks/use-pipelines";
import { Check, Circle, Clock, Minus, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export function PipelineStepper({ steps }: { steps: PipelineStep[] }) {
  const sortedSteps = [...steps].sort((a, b) => a.order - b.order);

  return (
    <div className="w-full">
      <div className="space-y-4">
        {sortedSteps.map((step, index) => {
          const isLast = index === sortedSteps.length - 1;
          const isCompleted = step.status === "COMPLETED";
          const isInProgress = step.status === "IN_PROGRESS";
          const isPending = step.status === "PENDING";
          const isSkipped = step.status === "SKIPPED";

          return (
            <div key={step.id} className="relative flex gap-4">
              {/* Vertical line connector */}
              {!isLast && (
                <div className={cn(
                  "absolute left-[15px] top-8 bottom-[-16px] w-[2px]",
                  isCompleted ? "bg-emerald-500" : "bg-slate-200"
                )} />
              )}
              
              {/* Status Icon */}
              <div className="relative shrink-0 mt-1">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center border-2 bg-white z-10 relative",
                  isCompleted ? "border-emerald-500 bg-emerald-50 text-emerald-600" :
                  isInProgress ? "border-primary bg-primary/10 text-primary" :
                  isSkipped ? "border-slate-300 bg-slate-50 text-slate-400" :
                  "border-slate-200 bg-slate-50 text-slate-400"
                )}>
                  {isCompleted ? <Check className="w-4 h-4" /> :
                   isInProgress ? <Clock className="w-4 h-4 animate-pulse" /> :
                   isSkipped ? <Minus className="w-4 h-4" /> :
                   <Circle className="w-3 h-3 fill-current opacity-20" />}
                </div>
              </div>

              {/* Content */}
              <div className={cn(
                "flex-1 pb-4",
                isPending && "opacity-60"
              )}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className={cn(
                      "font-semibold text-sm",
                      isCompleted ? "text-emerald-700" :
                      isInProgress ? "text-primary" : "text-slate-700"
                    )}>
                      {step.order}. {step.stepName}
                    </h4>
                    {step.description && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{step.description}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-xs font-medium">
                    {isCompleted && step.completedAt && (
                      <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                        Done {new Date(step.completedAt).toLocaleDateString()}
                      </span>
                    )}
                    {isInProgress && (
                      <span className="text-primary bg-primary/5 px-2 py-1 rounded-md">In Progress</span>
                    )}
                    {isPending && (
                      <span className="text-slate-400">Pending</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
