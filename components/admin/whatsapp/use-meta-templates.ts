"use client";

import { useQuery } from "@tanstack/react-query";
import { whatsappApi } from "@/lib/whatsapp/client-fetch";
import type { MetaTemplate } from "@/lib/whatsapp/meta-types";

export interface MetaTemplatesResponse {
  templates: MetaTemplate[];
  mappings: Record<string, { triggerEvent: string; isActive: boolean }[]>;
}

export function useMetaTemplates() {
  return useQuery({
    queryKey: ["admin", "whatsapp", "meta-templates"],
    queryFn: () => whatsappApi<MetaTemplatesResponse>("/api/admin/whatsapp/meta-templates"),
    staleTime: 60_000,
  });
}
