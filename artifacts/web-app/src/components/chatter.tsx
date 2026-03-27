import { usePipelineEvents, usePostComment } from "@/hooks/use-events";
import { formatDistanceToNow } from "date-fns";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { getInitials } from "@/lib/utils";
import { MessageSquare, Settings2, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function Chatter({ pipelineId }: { pipelineId: string }) {
  const { data: events, isLoading } = usePipelineEvents(pipelineId);
  const postComment = usePostComment();
  const [message, setMessage] = useState("");
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    try {
      await postComment.mutateAsync({ pipelineId, message });
      setMessage("");
    } catch (err: any) {
      toast({ title: "Failed to post", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) return <div className="h-40 flex items-center justify-center text-slate-400">Loading events...</div>;

  return (
    <div className="flex flex-col h-full bg-slate-50/50 rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {events?.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">No activity yet</p>
          </div>
        ) : (
          events?.map((evt) => {
            const isComment = evt.eventType === "COMMENT";
            const isStatus = evt.eventType === "STATUS_CHANGE";
            const isStep = evt.eventType === "STEP_COMPLETE";
            const isAssigned = evt.eventType === "ASSIGNED";

            if (isComment && evt.actor) {
              return (
                <div key={evt.id} className="flex gap-4">
                  <Avatar className="h-10 w-10 shrink-0 border border-slate-200 shadow-sm">
                    <AvatarImage src={evt.actor.avatarUrl || ""} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                      {getInitials(evt.actor.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm">
                      <div className="flex justify-between items-start gap-4 mb-1">
                        <span className="font-semibold text-sm text-slate-900">{evt.actor.name}</span>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                          {formatDistanceToNow(new Date(evt.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{evt.message}</p>
                    </div>
                  </div>
                </div>
              );
            }

            // System / Status events
            return (
              <div key={evt.id} className="flex gap-3 items-center justify-center py-1">
                <div className="h-[1px] flex-1 bg-slate-200"></div>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-slate-200 shadow-sm text-xs font-medium text-slate-500">
                  {isStatus && <Settings2 className="w-3.5 h-3.5 text-blue-500" />}
                  {isStep && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                  {isAssigned && <AlertCircle className="w-3.5 h-3.5 text-purple-500" />}
                  <span>{evt.message}</span>
                </div>
                <div className="h-[1px] flex-1 bg-slate-200"></div>
              </div>
            );
          })
        )}
      </div>
      
      <div className="p-4 bg-white border-t border-slate-200">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <Textarea 
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="min-h-[44px] h-[44px] resize-none py-3"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <Button 
            type="submit" 
            disabled={!message.trim() || postComment.isPending}
            className="shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all"
          >
            Send
          </Button>
        </form>
      </div>
    </div>
  );
}
