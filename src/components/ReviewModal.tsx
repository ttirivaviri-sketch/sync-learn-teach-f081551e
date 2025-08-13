import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import StarRating from "./StarRating";

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId?: string;
  reviewedId: string;
  reviewedName: string;
  userType: 'tutor' | 'learner';
  onReviewSubmitted?: () => void;
}

const ReviewModal = ({
  isOpen,
  onClose,
  bookingId,
  reviewedId,
  reviewedName,
  userType,
  onReviewSubmitted
}: ReviewModalProps) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({
        title: "Rating Required",
        description: "Please select a star rating",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('reviews')
        .insert({
          booking_id: bookingId,
          reviewer_id: (await supabase.auth.getUser()).data.user?.id,
          reviewed_id: reviewedId,
          rating,
          comment: comment.trim() || null
        });

      if (error) throw error;

      toast({
        title: "Review Submitted!",
        description: `Your review for ${reviewedName} has been submitted.`,
      });

      onReviewSubmitted?.();
      onClose();
      setRating(0);
      setComment("");
    } catch (error) {
      console.error('Error submitting review:', error);
      toast({
        title: "Error",
        description: "Failed to submit review. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Rate & Review</DialogTitle>
          <DialogDescription>
            How was your experience with {reviewedName}?
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Rating</Label>
            <div className="flex justify-center">
              <StarRating
                rating={rating}
                onRatingChange={setRating}
                size="lg"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="comment">Comment (Optional)</Label>
            <Textarea
              id="comment"
              placeholder={`Share your experience with ${reviewedName}...`}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || rating === 0}>
            {loading ? "Submitting..." : "Submit Review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReviewModal;