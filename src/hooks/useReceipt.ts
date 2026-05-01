/**
 * useReceipt — Fetch a payment + booking + parties and download a PDF receipt.
 */
import { useState, useCallback } from "react";
import { saveAs } from "file-saver";
import { supabase } from "@/integrations/supabase/client";
import { generateReceiptPdf, type ReceiptData } from "@/lib/generateReceipt";
import { logger } from "@/utils/logger";
import { useToast } from "@/hooks/use-toast";

export function useReceipt() {
  const [downloading, setDownloading] = useState<string | null>(null);
  const { toast } = useToast();

  const downloadReceipt = useCallback(
    async (paymentId: string) => {
      setDownloading(paymentId);
      try {
        const { data, error } = await supabase
          .from("payments")
          .select(
            `
            id,
            amount,
            currency,
            status,
            provider,
            provider_ref,
            created_at,
            payer:profiles!payments_payer_id_fkey(full_name, email),
            booking:bookings(
              scheduled_at,
              duration_minutes,
              tutor_subjects(subject),
              tutor:profiles!bookings_tutor_id_fkey(full_name)
            )
          `
          )
          .eq("id", paymentId)
          .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error("Payment not found");

        const p = data as any;
        const receipt: ReceiptData = {
          paymentId: p.id,
          createdAt: p.created_at,
          amount: Number(p.amount),
          currency: p.currency || "ZAR",
          status: p.status,
          provider: p.provider,
          providerRef: p.provider_ref,
          payerName: p.payer?.full_name || "Customer",
          payerEmail: p.payer?.email || "",
          tutorName: p.booking?.tutor?.full_name || "Tutor",
          subject: p.booking?.tutor_subjects?.subject || "Tutoring Session",
          scheduledAt: p.booking?.scheduled_at || null,
          durationMinutes: p.booking?.duration_minutes ?? null,
        };

        const blob = await generateReceiptPdf(receipt);
        const filename = `StudySync-Receipt-${p.id.slice(0, 8).toUpperCase()}.pdf`;
        saveAs(blob, filename);
      } catch (err) {
        logger.error("Receipt download failed", err);
        toast({
          title: "Could not download receipt",
          description: err instanceof Error ? err.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        setDownloading(null);
      }
    },
    [toast]
  );

  return { downloadReceipt, downloading };
}
